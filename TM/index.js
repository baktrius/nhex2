'use strict';
const express = require('express');
const process = require('process');
const TSS = require('./TSS.js');
const TS = require('./TS.js');
const TableDb = require('./TableDb.js');

// port na którym TSSy łączą się do TMa
const TSS_PORT = process.env.TM_TSS_PORT;
// port na którym Main przysyła żądania od klientów
const APP_PORT = process.env.TM_APP_PORT;
const DB_HOST = process.env.TM_DB_HOST ?? 'TM_maria';
const TS_CONFIGURATION = process.env.TM_TS_CONFIGURATION;

// lista aktywnych TSSów
const TSSs = new Map();
// lista TSów skonfigurowanych w systemie
let TSs;
try {
  TSs = TS_CONFIGURATION.split('|').map((entry) => {
    const [http, ws] = entry.split(';');
    return new TS(http, ws);
  });
} catch (err) {
  console.error(err);
  console.error('Unable to parse TSs configuration');
  process.exit(1);
}

const tableDb = new TableDb(`mariadb://TM@${DB_HOST}:3306/tables`);

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
 * Zwraca serwer synchronizacji stołów przez który obsługiwany jest stół.
 * @param {Array} TSSs lista serwerów synchronizacji stołów
 * @param {*} boardId id stołu
 * @return {*} serwer stołów obsługujący stół o zadanym id
 */
function getBoardTSS(TSSs, boardId) {
  for (const [, TSS] of TSSs.entries()) {
    if (TSS.operate(boardId)) {
      return TSS;
    }
  }
  return undefined;
}

/**
 * Przetwarza wiadomość informacyjną od serwera synchronizującego
 * @param {Map} TSSs lista serwerów synchronizujących
 * @param {String} control adres kontrolny serwera
 * @param {String} users adres użytkowników serwera
 * @param {Array} tables lista obsługiwanych stołów zadeklarowana przez serwer
 * @return {Array} lista stołów do zamknięcia
 */
function handleTSSInfo(TSSs, control, users, tables) {
  let tss = TSSs.get(control);
  if (tss === undefined) {
    console.log(`added TSS ${control}`);
    tss = new TSS(control, users, () => TSSs.delete(control));
    TSSs.set(control, tss);
  } else {
    tss.touch();
    tss.clearTables();
  }
  const toBeClosed = tables.filter((tableId) => {
    const tableTSS = getBoardTSS(TSSs, tableId);
    if (tableTSS === undefined) {
      tss.addTable(tableId);
      return false;
    } else {
      return tableTSS !== tss;
    }
  });
  return toBeClosed;
}

/**
 * Wybiera najlepszy TSS dla zadanej synchronizacji stołu.
 * Jeśli stół jest otwarty przez jakiś TSS to właśnie ten jest zwracany.
 * @param {Map} TSSs lista dostępnych TSSów
 * @param {String} boardId id stołu do synchronizacji
 * @param {*} req powiązane żądanie
 * @return {*} wybrany TSS
 */
function selectOptimalTSS(TSSs, boardId, req) {
  if (TSSs.length === 0) {
    throw Error('no TSS connected');
  }
  return getBoardTSS(TSSs, boardId) ??
      [...TSSs.entries()]
          .map(([, tss]) => tss)[Math.floor(Math.random() * TSSs.size)];
}

/**
 * Wyłącza cachowanie odpowiedzi.
 * @param {*} req otrzymane żądanie
 * @param {*} res przygotowywana odpowiedź
 * @param {*} next next
 */
function noCache(req, res, next) {
  res.set('Cache-control', `no-store`);
  next();
}

const app = express();
app.use(noCache);

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

app.post('/board/:boardId/join', async (req, res) => {
  const boardId = req.params.boardId;
  const boardInfo = await tableDb.getTableInfo(boardId);
  const boardStorage = boardInfo.storage;
  try {
    // Check if game is actually active
    const currentTSS = getBoardTSS(TSSs, boardId);
    if (currentTSS !== undefined) {
      for (let i = 0; i < 3; ++i) {
        try {
          if (await currentTSS.prepareTable(boardId, boardStorage)) {
            res.json({success: true, link: currentTSS.getTableLink(boardId)});
            return;
          }
        } catch (err) {}
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      currentTSS.close();
    }
    for (let i = 0; i < 5; ++i) {
      const TSS = selectOptimalTSS(TSSs, boardId, req);
      try {
        if (await TSS.prepareTable(boardId, boardStorage)) {
          res.json({success: true, link: TSS.getTableLink(boardId)});
          return;
        }
      } catch (err) {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    res.json({success: false, reason: 'unable to load board'});
  } catch (err) {
    res.json({success: false, reason: err.message});
  }
});

app.get('/boards', (req, res) => {
  res.json([...TSSs.entries()]
      .map(([_, tss]) => [
        tss.controlAddress,
        [...tss.tables.entries()].map(([id]) => id),
      ]));
});

app.use(express.static('../Client'));

const app2 = express();
app2.use(noCache);
app2.use(express.json());
app2.use(express.urlencoded({extended: true}));

app2.post('/info', (req, res) => {
  try {
    const {control, users, tables} = req.body;
    const parsedTables = JSON.parse(tables);
    const toBeClosed = handleTSSInfo(TSSs, control, users, parsedTables);
    res.json({success: true, toBeClosed: toBeClosed});
  } catch (err) {
    console.log(err);
    res.json({success: false, reason: 'invalid params structure'});
  }
});

/**
 * Główna funkcja programu
 */
async function run() {
  // oczekiwanie na połączenie z bazą danych
  await tableDb.init();
  console.log('connection with db established');

  console.log('setting up TSS endpoint');
  const serwer2 = await new Promise((resolve) => {
    const temp = app2.listen(TSS_PORT, () => {
      resolve(temp);
    });
  });
  console.log('waiting 20s for TSSs servers to connect...');
  await new Promise((resolve) => setTimeout(resolve, 20000));
  console.log('done');
  console.log('setting up users endpoint');
  const serwer = await new Promise((resolve) => {
    const temp = app.listen(APP_PORT, () => {
      resolve(temp);
    });
  });
  console.log('done');
  /**
   * Obsługuje sygnał wyłączenia aplikacji.
   * @param {*} signal otrzymany sygnał
   */
  async function handleQuit(signal) {
    try {
      console.log('gracefully closing endpoints and db connection');
      await Promise.all([
        new Promise((resolve) => serwer2.close(() => resolve())),
        new Promise((resolve) => serwer.close(() => resolve())),
        tableDb.close(),
      ]);
      console.log('done');
    } catch (err) {
      console.log(err);
      console.log(err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  process.on('SIGTERM', handleQuit);
}

run().catch(console.dir);

