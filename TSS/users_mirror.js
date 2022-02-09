const express = require('express');

const app = express();

app.get('/info', async (req, res) => {
  console.log(req.query.token);
  res.json({id: req.query.token});
});

app.listen(3000, () => {
  console.log('running');
});
