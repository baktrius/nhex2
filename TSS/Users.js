const axios = require('axios');

module.exports = class Users {
  /**
   * Reprezentuje połączenie z usługą uwierzytelniającą.
   * @param {string} address adres usługi uwierzytelniającej
   */
  constructor(address) {
    this.address = address;
  }
  /**
   * Pobiera informacje o użytkowniku identyfikującym się tokenem.
   * @param {string} token token użytkownika
   * @return {*} informacje o użytkowniku
   */
  async getInfo(token) {
    console.log(this.address);
    const response = await axios.get(this.address, {
      params: {
        token: token,
      },
      timeout: 5000,
    });
    if (response.status !== 200) {
      throw new Error('authorization request failed');
    }
    return response.data;
  }
};
