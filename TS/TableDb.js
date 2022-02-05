const {MongoClient} = require('mongodb');

module.exports = class TableDb {
  /**
   * Reprezentuje połączenie z bazą danych.
   * @param {string} uri uri połączenia z bazą danych
   * @param {string} dbName nazwa bazy danych, z którą wykonać połączenie
   */
  constructor(uri, dbName) {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }
  /**
   * Nawiązuje połączenie z bazą danych.
   */
  async init() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.boards = this.db.collection('boards');
  }
  /**
   * Zamyka połączenie z bazą danych.
   */
  async close() {
    await this.client.close();
  }
  /**
   * Inicjalizuje w bazie danych
   * struktury potrzebne do przechowywania planszy.
   * @param {number} boardId id planszy
   */
  async initBoard(boardId) {
    return (await this.boards
        .insertOne({boardId: boardId, commands: []}))?.acknowledged === true;
  }
  /**
   * Pobiera zawartość planszy.
   * @param {number} boardId id planszy
   */
  async getBoard(boardId) {
    return await this.boards.findOne({boardId: boardId});
  }
  /**
   * Dodaje zadane komendy do planszy.
   * @param {number} boardId id planszy
   * @param {Array<Object>} commands komendy do dodania do stołu
   */
  async appendToBoard(boardId, commands) {
    return (await this.boards.updateOne({boardId: boardId},
        {$push: {'commands': {$each: commands}}}))?.matchedCount > 0;
  }
};
