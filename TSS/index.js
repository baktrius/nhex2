'use strict';
const ws = require('ws');
const express = require('express');
const Table = require('./Table.js');
const Client = require('./Client.js');

const CONTROL_PORT = parseInt(process.argv[2]);
const CLIENTS_PORT = parseInt(process.argv[3]);
const MASTER_ADDR = process.argv[4];
const USERS_ADDR = process.argv[5];

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
    tables.delete(boardId);
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
    if (current.backend === backend) {
      await current.setAllowed(allowedUsers);
      return;
    }
    await closeBoard(boardId);
  }
  const future = new Table(backend);
  await future.connect();
  await future.setAllowed(allowedUsers);
  tables.set(boardId, future);
}

// http control api
const app = express();

app.post('/board/:boardId/load', async (req, res) => {
  const boardId = req.params.boardId;
  const backend = req.query.backend;
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
 * @param {*} req rządnie http inicjujące połączenie ws
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
 * Główna funkcja programu
 */
async function run() {
  // clients api
  const wss = new ws.WebSocketServer({port: CLIENTS_PORT});
  wss.on('connection', wsConnectionHandler);

  app.listen(CONTROL_PORT, () => {});
  console.log('ready');
}

run().catch(console.dir);
