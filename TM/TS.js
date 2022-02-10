const axios = require('axios');

module.exports = class TS {
  /**
   * Reprezentuje serwer przechowujący stoły.
   * @param {String} controlAddress adres portu do zarządzania serwerem
   * @param {String} usersAddress adres portu dla użytkowników
   */
  constructor(controlAddress, usersAddress) {
    this.controlAddress = controlAddress;
    this.usersAddress = usersAddress;
  }
  /**
   * Zwraca adres do połączenia się do serwera.
   * @return {String} adres łączenia się do serwera
   */
  getAddress() {
    return this.usersAddress;
  }
  /**
   * Inicjuje stół na serwerze przechowującym
   * @param {*} boardId id stołu
   * @return {Boolean} udało się utworzyć stół
   */
  async initTable(boardId) {
    const response = await axios(`/board/${boardId}/init`, {
      method: 'post',
      baseURL: this.controlAddress,
      timeout: 5000,
    });
    if (response.status !== 200) {
      throw new Error(
          `table init request failed with status ${response.status}`);
    }
    try {
      console.log(response.data);
      const data = response.data;
      if (data.success === false) {
        throw new Error(data.reason ?? 'Unknown reason');
      } else if (data.success !== true) {
        throw new Error('Invalid response structure');
      }
      return true;
    } catch (err) {
      console.log(err);
      throw new Error('Unable to parse request');
    }
  }
};
