// Serve the Expo web export static files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../web/dist');

export default (req, res) => {
  // Get the requested path
  let filePath = path.join(distPath, req.url);

  // If it's a directory or doesn't exist, serve index.html (SPA routing)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distPath, 'index.html');
  }

  try {
    const fileContent = fs.readFileSync(filePath);

    // Determine content type
    const ext = path.extname(filePath);
    let contentType = 'text/plain';

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
    };

    if (mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }

    res.setHeader('Content-Type', contentType);

    // Cache busting for index.html
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    res.send(fileContent);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(404).send('Not found');
  }
};
