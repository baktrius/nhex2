const Users = require('./Users.js');
const url = require('url');

module.exports = class Client {
  /**
   * Reprezentuje podłączonego klienta.
   * @param {socket} ws socket klienta
   * @param {*} req żądanie http powiązane z ws
   * @param {string} usersAddress adres serwera użytkowników
   */
  constructor(ws, req, usersAddress) {
    this.ws = ws;
    this.req = req;
    this.usersAddress = usersAddress;
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
   * Zwraca token użytkownika
   * @return {String} token użytkownika
   */
  getToken() {
    const query = url.parse(this.req.url, true).query;
    const cookiesHeader = this.req.headers?.cookie;
    // TODO
    console.log(cookiesHeader, query);
    return cookiesHeader ?? query?.token;
  }
  /**
   * Sprawdza należenie klienta do listy
   * @param {Array} list dozwoleni użytkownicy
   * @return {Boolean} należenie do listy
   */
  async authorizeAgainst(list) {
    if (this.info === undefined) {
      this.info = new Users(this.usersAddress).getInfo(this.getToken());
    }
    const id = (await this.info).id;
    return list.includes(id);
  }
  /**
   * Kończy połączenie.
   */
  close() {
    this.ws.close();
  }
};
