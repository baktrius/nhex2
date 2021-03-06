'use strict';
const ws = require('ws');
const express = require('express');
const process = require('process');
const axios = require('axios');
const Table = require('./Table.js');
const Client = require('./Client.js');

const HEART_BEAT_INTERVAL = 15000;

const TSS_INTERNAL_CONTROL_PORT = parseInt(process.env.TSS_INTERNAL_CONTROL_PORT);
const TSS_INTERNAL_CLIENTS_PORT = parseInt(process.env.TSS_INTERNAL_CLIENTS_PORT);
const TSS_INTERNAL_CONTROL_ADDR = process.env.TSS_INTERNAL_CONTROL_ADDR;
const TSS_EXTERNAL_CLIENTS_ADDR = process.env.TSS_EXTERNAL_CLIENTS_ADDR;

const MASTER_ADDR = `http://TM:${process.env.TM_TSS_PORT}`;
const USERS_ADDR = `http://Users:${process.env.USERS_PORT}`;

/**
 * Wyświetla komunikat błędu i kończy program.
 * @param {*} text komunikat błędu
 * @param {*} code zwracany kod
 */
function fatal(text, code) {
  console.error(text);
  process.exit(code);
}

const tables = new Map();


/**
 * Zamyka stół o zadanym id.
 * @param {string} boardId id stołu do zamknięcia
 * @return {boolean} stół został zamknięty
 */
async function closeBoard(boardId) {
  if (tables.has(boardId)) {
    const current = tables.get(boardId);
    await current.close();
    return true;
  }
  return false;
}

/**
 * Ładuje podany stół jeśli nie jest załadowany.
 * @param {string} boardId id stołu, pod jakim będzie widziany dla użytkowników
 * @param {string} backend adres serwera przechowującego stół
 * @param {Array|undefined} allowedUsers dozwoleni użytkownicy
 */
async function reloadBoard(boardId, backend, allowedUsers) {
  if (tables.has(boardId)) {
    const current = tables.get(boardId);
    if (current.backup === backend) {
      await current.setAllowed(allowedUsers);
      return;
    }
    await closeBoard(boardId);
  }
  const future = new Table(backend, () => {
    tables.delete(boardId);
  });
  await future.connect();
  await future.setAllowed(allowedUsers);
  tables.set(boardId, future);
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

// http control api
const app = express();
app.use(noCache);

app.post('/board/:boardId/load', async (req, res) => {
  const boardId = req.params.boardId;
  const backend = req.query.backend;
  console.log(boardId, backend);
  let allowedUsers;
  if (req.query.allowed !== undefined) {
    console.log(req.query.allowed);
    try {
      allowedUsers = JSON.parse(req.query.allowed);
      if (typeof allowedUsers !== 'object' || !Array.isArray(allowedUsers)) {
        throw new Error('allowed param invalid value');
      }
    } catch (err) {
      res.json({success: false, reason: err.message});
      return;
    }
  }
  if (backend === undefined) {
    res.json({success: false, reason: 'backend not specified'});
    return;
  }
  try {
    await reloadBoard(boardId, backend, allowedUsers);
    res.json({success: true});
  } catch (err) {
    res.json({success: false, reason: err.message});
  }
});

app.post('/board/:boardId/close', async (req, res) => {
  const boardId = req.params.boardId;
  try {
    const result = await closeBoard(boardId);
    if (result) {
      res.json({success: true});
    } else {
      res.json({success: false, reason: 'board is not loaded'});
    }
  } catch (err) {
    res.json({success: false, reason: err.message});
  }
});

/**
 * Obsługuje utworzone połączenie ws
 * @param {*} ws utworzony websocket
 * @param {*} req żądanie http inicjujące połączenie ws
 */
async function wsConnectionHandler(ws, req) {
  const url = req.url;
  const method = req.method;
  const boardId = url.match(/^\/board\/([0-9]+)\/?(\?.*)?$/)?.[1];
  if (method.toUpperCase() !== 'GET') {
    ws.send(JSON.stringify({success: false, reason: 'invalid http method'}));
    ws.terminate();
    return;
  }
  if (boardId === undefined) {
    ws.send(JSON.stringify({success: false, reason: 'unspecified board'}));
    ws.terminate();
    return;
  }
  if (!tables.has(boardId)) {
    ws.send(JSON.stringify({success: false, reason: 'board is not loaded'}));
    ws.terminate();
    return;
  }
  try {
    const board = tables.get(boardId);
    console.log(`adding client to board ${boardId}`);
    await board.addClient(new Client(ws, req, USERS_ADDR));
    console.log('done');
  } catch (err) {
    ws.send(JSON.stringify({success: false, reason: err.message}));
    ws.terminate();
  }
}

/**
 * Wysyła info działania serwera do TM'a.
 */
async function sendInfo() {
  try {
    const response = await axios(`/info`, {
      method: 'post',
      data: {
        control: TSS_INTERNAL_CONTROL_ADDR,
        users: TSS_EXTERNAL_CLIENTS_ADDR,
        tables: JSON.stringify([...tables.entries()].map(([id]) => id)),
      },
      baseURL: MASTER_ADDR,
      timeout: 5000,
    });
    if (response.status !== 200) {
      throw new Error(`info request failed with code ${response.status}`);
    }
    const success = response?.data?.success;
    if (success !== true) {
      throw new Error(`info request failed with ${response?.data?.reason}`);
    }
    const toBeClosed = response?.data?.toBeClosed;
    await Promise.all(toBeClosed?.map(async (id) => {
      await closeBoard(id);
    }) ?? []);
    return true;
  } catch (err) {
    console.log(err.message);
    return false;
  }
}

/**
 * Główna funkcja programu
 */
async function run() {
  // clients api
  const wss = new ws.WebSocketServer({port: TSS_INTERNAL_CLIENTS_PORT});
  wss.on('connection', wsConnectionHandler);
  console.log('setting up control endpoint');
  const serwer = await new Promise((resolve) => {
    const temp = app.listen(TSS_INTERNAL_CONTROL_PORT, () => {
      resolve(temp);
    });
  });
  console.log('setting up heart bit service');
  // sending initial heartbeat
  if (!(await sendInfo())) {
    console.log('initial heartbeat failed');
  }
  const heartBeatService = setInterval(sendInfo, HEART_BEAT_INTERVAL);
  console.log('ready');
  /**
   * Obsługuje sygnał wyłączenia aplikacji.
   * @param {*} signal otrzymany sygnał
   */
  async function handleQuit(signal) {
    try {
      clearInterval(heartBeatService);
      tables.forEach((table) => table.close());
      await Promise.all([
        new Promise((resolve) => wss.close(() => resolve())),
        new Promise((resolve) => serwer.close(() => resolve())),
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
