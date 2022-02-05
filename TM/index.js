'use strict';
const ws = import(ws);
const express = import(express);
const TSS = import('TSS.js');
const TS = import('TS.js');
const TableDb = import('TableDb.js');

// port na którym TSSy łączą się do TMa
const TSS_PORT = 8080;
// port na którym main przysyła żądania od klientów
const APP_PORT = 3000;

// lista aktywnych TSSów
const TSSs = [];
// lista TSów skonfigurowanych w systemie
const TSs = [];
// lista aktywnych plansz
const boards = [];

// obsługa TSSów
const wss = new ws.WebSocketServer({port: TSS_PORT});
wss.on('connection', (ws) => {
  TSSs.push(new TSS(ws));
});

const app = express();

app.post('/board/create', async (req, res) => {
  const boardId = await TableDb.createTable(req);
  let TS;
  do {
    TS = selectOptimalTS(TSs, req);
  } while (!(await TS.initTable(boardId)));
  res.json({success: true, id: boardId});
});

app.get('/board/:boardId/join', async (req, res) => {
  const boardId = req.params.boardId;
  const boardStorage = TableDb.getBoardStorage(boardId);
  let TSS;
  do {
    TSS = selectOptimalTSS(TSS, boards, boardId, req);
  } while (!(await TSS.prepareTable(boardId, boardStorage)));
  res.json({success: true, link: TSS.getTableLink(boardId)});
});

app.listen(APP_PORT, () => {});
