const axios = require('axios');

const TSS_EXPIRE_TIMEOUT = 1000 * 60;
module.exports = class TSS {
  /**
   * Reprezentuje serwer synchronizujący stoły.
   * @param {String} controlAddress adres portu do zarządzania serwerem
   * @param {String} usersAddress adres portu do łączenia się użytkowników
   * @param {Function} closeCallback funkcja do wywołania przy zamknięciu stołu
   */
  constructor(controlAddress, usersAddress, closeCallback) {
    this.controlAddress = controlAddress;
    this.usersAddress = usersAddress;
    this.tables = new Set();
    this.closeCallback = closeCallback;
    this.closeService = setTimeout(this.close.bind(this), TSS_EXPIRE_TIMEOUT);
  }
  /**
   * Sprawdza czy stół jest otwarty na serwerze synchronizującym.
   * @param {*} tableId id stołu
   * @return {Boolean} stół jest obsługiwany przez serwer
   */
  operate(tableId) {
    return this.tables.has(tableId);
  }
  /**
   * Zleca załadowanie stołu serwerowi synchronizującemu.
   * @param {*} tableId id stołu
   * @param {String} backend serwer przechowujący stół
   */
  async prepareTable(tableId, backend) {
    console.log(this.controlAddress);
    const response = await axios(`/board/${tableId}/load`, {
      method: 'post',
      params: {
        backend: `${backend}/board/${tableId}`,
      },
      baseURL: this.controlAddress,
      timeout: 5000,
    });
    console.log(response);
    if (response.status !== 200) {
      throw new Error(
          `table load request failed with status ${response.status}`);
    }
    try {
      const data = response.data;
      console.log(data);
      if (data.success === false) {
        return false;
      } else if (data.success !== true) {
        throw new Error('Invalid response structure');
      }
      this.tables.add(tableId);
      return true;
    } catch (err) {
      throw new Error('Unable to parse request');
    }
  }
  /**
   * Zleca zamknięcie stołu.
   * @param {*} tableId id stołu
   */
  async closeTable(tableId) {
    const response = await axios(`/board/${tableId}/close`, {
      method: 'post',
      baseURL: this.controlAddress,
      timeout: 5000,
    });
    if (response.status !== 200) {
      throw new Error(
          `table close request failed with status ${response.status}`);
    }
    try {
      const data = response.data;
      if (data.success === false) {
        throw new Error(data.reason ?? 'Unknown reason');
      } else if (data.success !== true) {
        throw new Error('Invalid response structure');
      }
      this.tables.delete(tableId);
    } catch (err) {
      throw new Error('Unable to parse request');
    }
  }
  /**
   * Zwraca link pod którym synchronizowany jest stół.
   * @param {*} tableId id stołu
   * @return {String} link pod którym synchronizowany jest stół
   */
  getTableLink(tableId) {
    if (this.tables.has(tableId)) {
      return `${this.usersAddress}/board/${tableId}`;
    }
  }
  /**
   * Przedłuża czas ważności serwera.
   */
  touch() {
    console.log(`touched TSS ${this.controlAddress}`);
    clearTimeout(this.closeService);
    this.closeService = setTimeout(this.close.bind(this), TSS_EXPIRE_TIMEOUT);
  }
  /**
   * Dodaje informacje o obsłudze stołu przez serwer.
   * @param {*} tableId id stołu
   */
  addTable(tableId) {
    this.tables.add(tableId);
  }
  /**
   * Zamyka stół.
   */
  close() {
    console.log(`removed TSS ${this.controlAddress}`);
    this.closeCallback?.();
  }
};
