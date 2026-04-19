const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // Sers index.html pour toutes les routes (SPA)
  const indexPath = path.join(__dirname, '../expo_app/dist/index.html');

  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(indexPath, 'utf8'));
  } else {
    res.status(404).send('Not found');
  }
};
