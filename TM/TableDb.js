const {Sequelize, DataTypes, Model} = require('sequelize');

module.exports = class TableDb {
  /**
   * Reprezentuje połączenie z bazą danych meta informacji o stołach.
   * @param {String} dbConnectionString string połączenia z bazą danych
   */
  constructor(dbConnectionString) {
    const seq = this.sequelize = new Sequelize(dbConnectionString);

    /**
     * Reprezentuje stół.
     */
    this.Table = class Table extends Model {};

    this.Table.init({
      name: {
        type: DataTypes.STRING,
      },
      storage: {
        type: DataTypes.STRING,
      },
      public: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      owner: {
        type: DataTypes.STRING,
      },
    }, {
      sequelize: seq,
    });

    /**
     * Reprezentuje prawa użytkownika dostępu do stołu.
     */
    this.Privilege = class Privilege extends Model {};

    this.Privilege.init({
      user: {
        type: DataTypes.STRING,
      },
    }, {
      sequelize: seq,
    });

    this.Table.hasMany(this.Privilege);
  }
  /**
   * inicjalizuje połączenie z bazą danych
   */
  async init() {
    await this.sequelize.sync({alter: true});
  }
  /**
   * Tworzy stół.
   * @param {String} name nazwa stołu
   */
  async createTable(name) {
    const newTable = await this.Table.create({
      name: name,
    });
    return newTable.id;
  }
  /**
   * Ustawia adres serwera przechowującego dla stołu.
   * @param {*} boardId id stołu
   * @param {String} storage adres serwera przechowującego
   */
  async setTableStorage(boardId, storage) {
    const table = await this.Table.findByPk(boardId);
    table.storage = storage;
    await table.save();
  }
  /**
   * Usuwa stół.
   * @param {*} boardId id stołu
   */
  async removeTable(boardId) {
    const table = await this.Table.findByPk(boardId);
    await table.destroy();
  }
  /**
   * Zwraca info o zadanym stole.
   * @param {*} boardId id stołu
   * @return {Object} Słownik zawierający własności stołu 
   */
  async getTableInfo(boardId) {
    const table = await this.Table.findByPk(boardId);
    return {
      name: table.name,
      storage: table.storage,
    };
  }
  /**
   * zamyka połączenie z bazą danych
   */
  async close() {
    await this.sequelize.close();
  }
};
