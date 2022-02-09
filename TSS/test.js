const Ws = require('ws');

const backupWs = new Ws('ws://localhost:8000/board/125');
/**
 * ustanawia połączenie
 * @return {Promise} promise
 */
/* async function connect() {
  return new Promise((resolve, reject) => {
    backup_ws.on('open', () => {
      resolve();
    });
  });
}*/

backupWs.on('open', (err) => {
  console.log('open', err);
});
backupWs.on('message', (data) => {
  console.log('message', JSON.parse(data));
});
backupWs.on('error', (err) => {
  console.log('error', err);
});
backupWs.on('close', (code, reason) => {
  console.log('close', reason);
});

/**
 * lol
 * @return {Promise} lol
 */
async function test() {
  return new Promise((resolve, reject) => {
    reject(new Error('lol'));
    resolve();
  });
}

/**
 * lol2
 */
async function test2() {
  try {
    await test();
    console.log('resolved');
  } catch (err) {
    console.log('rejected');
  }
  
}

test2();
