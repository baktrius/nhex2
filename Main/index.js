const express = require('express');
const proxy = require('express-http-proxy');
const process = require('process');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const APP_PORT = process.argv[2];
const USERS_ADDR = process.argv[3];
const TM_ADDR = process.argv[4];

const app = express();

app.use(cookieParser());

/**
 * Sprawdza czy użtykownik o zadanym tokenie jest zalogowany.
 * @param {*} token token użytkownika
 * @return {Boolean} Użytkownik jest zalogowany
 */
async function isLogged(token) {
  return token !== undefined;
}

const anonymousEndpoints = new Set([
  '/auth/login',
  '/auth/register',
  '/login.htm',
  '/register.htm',
  '/login.js',
  '/register.js',
  '/form.css',
]);


app.use('/', async (req, res, next) => {
  console.log(`'${req.path}'`);
  console.log(req.cookies);
  const userToken = req.cookies?.token;
  const logged = await isLogged(userToken);
  if (anonymousEndpoints.has(req.path)) {
    if (logged) {
      res.redirect('index.htm');
    } else {
      next();
    }
  } else {
    if (!logged) {
      next(); // res.redirect('login.htm');
    } else {
      next();
    }
  }
});

app.use('/auth', proxy(USERS_ADDR, {
  proxyReqPathResolver: function(req) {
    return '/auth' + req.path;
  },
}));
app.use('/board', proxy(TM_ADDR, {
  proxyReqPathResolver: function(req) {
    return '/board' + req.path;
  },
}));
app.use('/boards', proxy(TM_ADDR, {
  proxyReqPathResolver: function(req) {
    return '/boards' + req.path;
  },
}));
app.use('/', express.static('../Client'));

/**
 * Główna funkcja programu
 */
async function run() {
  console.log('setting up clients endpoint');
  const serwer = await new Promise((resolve) => {
    const temp = app.listen(APP_PORT, () => {
      resolve(temp);
    });
  });
  console.log('done');
  /**
   * Obsługuje sygnał wyłączenia aplikacji.
   * @param {*} signal otrzymany sygnał
   */
  async function handleQuit(signal) {
    try {
      console.log('gracefully closing endpoints and db connection');
      await Promise.all([
        new Promise((resolve) => serwer.close(() => resolve())),
      ]);
      console.log('done');
    } catch (err) {
      console.log(err);
      console.log(err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  process.on('SIGTERM', handleQuit);
}

run().catch(console.dir);
