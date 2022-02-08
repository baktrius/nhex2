const Table = require('./Table.js');

const table = new Table('ws://localhost:8000/board/125');

/**
 * Wykonuje testowe połączenie
 */
async function exec() {
  console.log('connecting...');
  try {
    await table.connect();
    console.log('connected');
  } catch (err) {
    console.log('error');
    console.dir(err);
  }
}

exec();
