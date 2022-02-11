const express = require('express');
const proxy = require('express-http-proxy');
const process = require('process');

const APP_PORT = process.argv[2];
const USERS_ADDR = process.argv[3];
const TM_ADDR = process.argv[4];

const app = express();

app.use('/auth', proxy(USERS_ADDR, {
  proxyReqPathResolver: function(req) {
    console.log(req.path);
    return '/auth' + req.path;
  },
}));
app.use('/board', proxy(TM_ADDR, {
  proxyReqPathResolver: function(req) {
    console.log(req.path);
    return '/board' + req.path;
  },
}));
app.use('/boards', proxy(TM_ADDR, {
  proxyReqPathResolver: function(req) {
    console.log(req.path);
    return '/boards' + req.path;
  },
}));
app.use('/', express.static('../Client'));

app.listen(APP_PORT, () => {
  console.log('running');
});
