'use strict';
const ws = require('ws');
const express = require('express');
const promisify = require('util').promisify;
const process = require('process');
const TSS = require('./TSS.js');
const TS = require('./TS.js');
const TableDb = require('./TableDb.js');

// port na którym TSSy łączą się do TMa
const TSS_PORT = process.argv[2];
// port na którym main przysyła żądania od klientów
const APP_PORT = process.argv[3];

// lista aktywnych TSSów
const TSSs = [
  new TSS('http://127.0.0.1:8081', 'ws://127.0.0.1:8080'),
];
// lista TSów skonfigurowanych w systemie
const TSs = [
  new TS('http://127.0.0.1:8000', 'ws://ts:8080'),
];

const tableDb = new TableDb('mariadb://TM:@127.0.0.1:3306/tables');

/**
 * Wybiera najlepszy TS dla zadanego żądania utworzenia stołu.
 * @param {Array} TSs lista dostępnych TSów
 * @param {*} req powiązane żądanie
 * @return {*} wybrany TS
 */
function selectOptimalTS(TSs, req) {
  if (TSs.length === 0) {
    throw Error('no TS connected');
  }
  // TODO improve
  return TSs[Math.floor(Math.random() * TSs.length)];
}

/**
 * Wybiera najlepszy TSS dla zadanej synchronizacji stołu.
 * Jeśli stół jest otwarty przez jakiś TSS to właśnie ten jest zwracany.
 * @param {Array} TSSs lista dostępnych TSSów
 * @param {String} boardId id stołu do synchronizacji
 * @param {*} req powiązane żądanie
 * @return {*} wybrany TSS
 */
function selectOptimalTSS(TSSs, boardId, req) {
  if (TSSs.length === 0) {
    throw Error('no TSS connected');
  }
  for (const TSS of TSSs) {
    if (TSS.operate(boardId)) {
      return TSS;
    }
  }
  // TODO improve
  return TSSs[Math.floor(Math.random() * TSs.length)];
}

// obsługa TSSów
/*
const wss = new ws.WebSocketServer({port: TSS_PORT});
wss.on('connection', (ws) => {
  TSSs.push(new TSS(ws));
});
*/
const app = express();

app.post('/board/create', async (req, res) => {
  try {
    const boardName = req.query.name;
    const boardId = await tableDb.createTable(boardName);
    for (let i = 0; i < 5; ++i) {
      const TS = selectOptimalTS(TSs, req);
      if (await TS.initTable(boardId)) {
        await tableDb.setTableStorage(boardId, TS.getAddress());
        res.json({success: true, id: boardId});
        return;
      }
    }
    await tableDb.removeTable(boardId);
    res.json({success: false, reason: 'unable to allocate board'});
  } catch (err) {
    console.log(err);
    res.json({success: false, reason: err.message});
  }
});

app.get('/board/:boardId/join', async (req, res) => {
  const boardId = req.params.boardId;
  const boardInfo = await tableDb.getTableInfo(boardId);
  const boardStorage = boardInfo.storage;
  try {
    for (let i = 0; i < 5; ++i) {
      const TSS = selectOptimalTSS(TSSs, boardId, req);
      if (await TSS.prepareTable(boardId, boardStorage)) {
        res.json({success: true, link: TSS.getTableLink(boardId)});
        return;
      }
    }
    res.json({success: false, reason: 'unable to load board'});
  } catch (err) {
    res.json({success: false, reason: err.message});
  }
});

/**
 * Główna funkcja programu
 */
async function run() {
  // oczekiwanie na połączenie z bazą danych
  await tableDb.init();
  console.log('connection with db established');

  const serwer = app.listen(APP_PORT, () => {});
  /**
   * Obsługuje sygnał wyłączenia aplikacji.
   * @param {*} signal otrzymany sygnał
   */
  async function handleQuit(signal) {
    try {
      await Promise.all([
        // promisify(wss.close)(),
        promisify(serwer.close)(),
        tableDb.close(),
      ]);
    } catch (err) {
      console.log(err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  process.on('SIGTERM', handleQuit);
}

run().catch(console.dir);

