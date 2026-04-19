const express = require('express');
const path = require('path');

const app = express();

// Serve static files from expo_app/dist
app.use(express.static(path.join(__dirname, '../expo_app/dist')));

// SPA fallback - all routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../expo_app/dist/index.html'));
});

module.exports = app;
