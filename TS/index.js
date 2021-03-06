'use strict';
const ws = require('ws');
const express = require('express');
const process = require('process');
const TableDb = require('./TableDb.js');

const WS_PORT = parseInt(process.env.TS_WS_PORT);
const HTTP_PORT = parseInt(process.env.TS_HTTP_PORT);
const DB_HOST = process.env.TS_MONGO_HOST;
const DB_PORT = '27017';
const DB_OPTIONS = 'maxPoolSize=20&w=majority';
const DB_CONNECTION_STRING = `mongodb://${DB_HOST}:${DB_PORT}/?${DB_OPTIONS}`;
const DB_NAME = 'boards';

/**
 * Wyświetla komunikat błędu i kończy program.
 * @param {*} text komunikat błędu
 * @param {*} code zwracany kod
 */
function fatal(text, code) {
  console.error(text);
  process.exit(code);
}

/**
 * Zwraca zawartość planszy o zadanym id.
 * @param {number} id id planszy
 */
async function getBoard(id) {
  try {
    const {boardId, commands} = await tableDb.getBoard(id);
    return {boardId: boardId, commands: commands};
  } catch (err) {
    throw new Error(`Missing board with specified id.`);
  }
}

// obiekt umożliwiający operacje na bazie danych
const tableDb = new TableDb(DB_CONNECTION_STRING, DB_NAME);

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

// http api
const app = express();
app.use(noCache);

// endpoint umożliwiający pobranie planszy
app.get('/board/:boardId', async (req, res) => {
  const boardId = req.params.boardId;
  try {
    res.json({success: true, data: await getBoard(boardId)});
  } catch (err) {
    console.dir(err);
    res.json({success: false, reason: err?.message});
  }
});

// endpoint umożliwiający zainicjalizowanie planszy
app.post('/board/:boardId/init', async (req, res) => {
  const boardId = req.params.boardId;
  try {
    if (!(await tableDb.initBoard(boardId))) {
      throw new Error('Unable to init db with specified id');
    }
    res.json({success: true});
  } catch (err) {
    console.dir(err);
    res.json({success: false, reason: err?.message});
  }
});

// endpoint umożliwiający dodanie komend do planszy
app.post('/board/:boardId/append', async (req, res) => {
  const boardId = req.params.boardId;
  const commands = req.query.commands;
  try {
    if (!(await tableDb.appendToBoard(boardId, JSON.parse(commands)))) {
      throw new Error('Unable to append commands to board with specified id');
    }
    res.json({success: true});
  } catch (err) {
    console.dir(err);
    res.json({success: false, reason: err?.message});
  }
});

/**
 * Obsługuje utworzone połączenie ws
 * @param {*} ws utworzony websocket
 * @param {*} req rządnie http inicjujące połączenie ws
 */
async function wsConnectionHandler(ws, req) {
  const url = req.url;
  const method = req.method;
  const boardId = url.match(/^\/board\/([0-9]+)$/)?.[1];
  if (boardId !== undefined && method.toUpperCase() === 'GET') {
    try {
      ws.send(JSON.stringify({success: true, data: await getBoard(boardId)}));
      ws.on('message', async (mes) => {
        try {
          const commands = JSON.parse(mes);
          if (!await tableDb.appendToBoard(boardId, commands)) {
            throw new Error(
                'Unable to append commands to board with specified id');
          }
          ws.send(JSON.stringify({success: true, message: mes.toString()}));
        } catch (err) {
          ws.send(JSON.stringify({success: false,
            message: mes.toString(), reason: err?.message}));
        }
      });
    } catch (err) {
      ws.send(JSON.stringify({success: false,
        reason: 'Board with specified id is missing.'}));
      ws.terminate();
    }
  } else {
    ws.send(JSON.stringify({success: false, reason: 'unspecified board'}));
    ws.terminate();
  }
}

/**
 * Główna funkcja programu
 */
async function run() {
  // oczekiwanie na połączenie z bazą danych
  await tableDb.init();
  console.log('connection with db established');
  // ws api
  const wss = new ws.WebSocketServer({port: WS_PORT});
  wss.on('connection', wsConnectionHandler);

  const serwer = await new Promise((resolve) => {
    const temp = app.listen(HTTP_PORT, () => {
      resolve(temp);
    });
  });
  /**
   * Obsługuje sygnał wyłączenia aplikacji.
   * @param {*} signal otrzymany sygnał
   */
  async function handleQuit(signal) {
    try {
      await Promise.all([
        new Promise((resolve) => wss.close(() => resolve())),
        new Promise((resolve) => serwer.close(() => resolve())),
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
