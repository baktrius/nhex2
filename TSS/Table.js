const Ws = require('ws');

const CLOSE_TIMEOUT = 60 * 1000;

module.exports = class Table {
  /**
   * Reprezentuje synchronizowany stół.
   * @param {String} backup adres pod którym zapisywany jest stół
   * @param {Function} closeCallback funkcja do wywołania przy zamknięciu stołu
   */
  constructor(backup, closeCallback) {
    this.backup = backup;
    this.closeCallback = closeCallback;
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
            this.backup_ws.on('close', this.close.bind(this));
            this.boardId = boardId;
            this.commands = commands;
            this.future = [];
            this.startCloseService();
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
   * Uruchamia serwis usuwający stół po czasie.
   */
  startCloseService() {
    if (this.closeService !== undefined) {
      this.stopCloseService();
    }
    console.log('started table close service');
    this.closeService = setTimeout(this.close.bind(this), CLOSE_TIMEOUT);
  }
  /**
   * Wyłącza serwis usuwający stół po czasie.
   */
  stopCloseService() {
    if (this.closeService !== undefined) {
      console.log('stopped table close service');
      clearTimeout(this.closeService);
      this.closeService = undefined;
    }
  }
  /**
   * Dodaje klienta do stołu.
   * @param {Client} client dodawany klient
   */
  async addClient(client) {
    if (this.allowed !== undefined) {
      try {
        if (!(await client.authorizeAgainst(this.allowed))) {
          client.ws.send(JSON.stringify({success: false,
            reason: 'authorization failed'}));
          client.ws.close();
          return;
        }
      } catch (err) {
        client.ws.send(JSON.stringify({success: false,
          reason: err.message}));
        client.ws.close();
        return;
      }
    }
    this.clients.push(client);
    this.stopCloseService();
    client.ws.on('close', () => {
      console.log(`client disconnected from board ${this.backup}`);
      const index = this.clients.indexOf(client);
      if (index > -1) {
        this.clients.splice(index, 1);
      }
      if (this.clients.length == 0) {
        this.startCloseService();
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
   * Ustawia listę dozwolonych użytkowników.
   * @param {Array|undefined} users dozwoleni użytkownicy
   */
  async setAllowed(users) {
    this.allowed = users;
    if (this.allowed !== undefined) {
      await Promise.all(this.clients.map(async (client) => {
        try {
          if (!(await client.authorizeAgainst(this.allowed))) {
            client.close();
          }
        } catch (err) {
          client.close();
        }
      }));
    }
  }
  /**
   * Zamyka stół
   */
  close() {
    this.backup_ws.close();
    this.clients.forEach((client) => {
      client.close();
    });
    this.closeCallback?.();
  }
};
