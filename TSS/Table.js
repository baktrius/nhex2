const Ws = require('ws');

module.exports = class Table {
  /**
   * Reprezentuje synchronizowany stół.
   * @param {string} backup adres pod którym zapisywany jest stół
   */
  constructor(backup) {
    this.backup = backup;
    this.clients = [];
  }
  /**
   * Ustanawia połączenie z zadanym serwerem przechowującym stoły
   */
  async connect() {
    this.backup_ws = new Ws(this.backup);
    return new Promise((resolve, reject) => {
      this.backup_ws.on('open', () => {
        this.backup_ws.once('message', (message) => {
          try {
            const data = JSON.parse(message);
            if (data?.success !== true) {
              reject(new Error(data?.reason ?? 'unknown reason'));
              return;
            }
            const {data: {boardId, commands}} = data;
            if (typeof commands !== 'object' || !Array.isArray(commands)) {
              reject(new Error('invalid response structure'));
              return;
            }
            this.backup_ws.on('message', this.handleBackupMessage.bind(this));
            this.boardId = boardId;
            this.commands = commands;
            this.future = [];
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
      this.backup_ws.on('error', (err) => {
        reject(new Error(err));
      });
      this.backup_ws.on('close', (code, reason) => {
        reject(new Error(reason));
      });
    });
  }
  /**
   * Obsługuje wiadomości zwrotne z serwera przechowującego stoły
   * @param {Buffer} message wiadomość od serwera przechowującego stoły
   */
  async handleBackupMessage(message) {
    
  }
  /**
   * Dodaje klienta do stołu.
   * @param {Client} client dodawany klient
   */
  async addClient(client) {
    // TODO autoryzacja
    this.clients.push(client);
    client.ws.on('close', () => {
      const index = this.clients.indexOf(client);
      if (index > -1) {
        this.clients.splice(index, 1);
      }
    });
    client.ws.on('message', async (message) => {
      try {
        const commands = JSON.parse(message);
        // wysłanie potwierdzenia odebrania komend do klienta
        client.send(
            JSON.stringify({success: true, message: message.toString()}));
        // wysłanie komend do innych podłączonych użytkowników
        this.clients.forEach((desClient) => {
          if (desClient !== client) {
            desClient.send(
                JSON.stringify({exec: commands}));
          }
        });
        // dodanie komend do listy komend niezatwierdzonych
        this.future = this.future.concat(commands);
        // inicjalizacja zapisu do serwera przechowującego
        this.backup_ws.send(message);
      } catch (err) {
        client.ws.send(JSON.stringify({success: false,
          message: message.toString(), reason: err?.message}));
      }
    });
    client.send(this.generateClientGreetings());
  }
  /**
   * Generuje wiadomość powitalną dla klienta.
   * @return {string} wiadomość powitalna klienta
   */
  generateClientGreetings() {
    return JSON.stringify({success: true, data: {
      boardId: this.boardId,
      commands: this.commands.concat(this.future),
    }});
  }
  /**
   * Zamyka stół
   */
  async close() {
    this.backup_ws.close();
    this.clients.forEach((client) => {
      client.close();
    });
  }
};
