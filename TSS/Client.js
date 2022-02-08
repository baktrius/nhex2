module.exports = class Client {
  /**
   * Reprezentuje podłączonego klienta.
   * @param {socket} ws socket klienta
   */
  constructor(ws) {
    this.ws = ws;
  }
  /**
   * Wysyła wiadomość do klienta.
   * @param {string} data treść wiadomości
   * @return {*} wynik wysłania wiadomości
   */
  send(data) {
    return this.ws.send(data);
  }
  /**
   * Kończy połączenie.
   */
  close() {
    this.ws.close();
  }
};
