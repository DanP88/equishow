// Serve the Expo web export static files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../web/dist');

export default (req, res) => {
  // Get the requested path, remove query params and fragments
  const cleanUrl = req.url.split('?')[0].split('#')[0];
  let filePath = path.join(distPath, cleanUrl);

  try {
    // Check if file exists
    let exists = false;
    let isDir = false;

    try {
      const stat = fs.statSync(filePath);
      exists = true;
      isDir = stat.isDirectory();
    } catch (err) {
      exists = false;
    }

    // For SPA routing: if file doesn't exist or is a directory, serve index.html
    if (!exists || isDir) {
      filePath = path.join(distPath, 'index.html');
    }

    const fileContent = fs.readFileSync(filePath);

    // Determine content type
    const ext = path.extname(filePath);
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
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    const contentType = mimeTypes[ext] || 'text/plain';
    res.setHeader('Content-Type', contentType);

    // Cache busting for index.html
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    res.send(fileContent);
  } catch (err) {
    console.error('Error serving file:', err);
    // Fallback: try to serve index.html for SPA
    try {
      const fallbackPath = path.join(distPath, 'index.html');
      const fileContent = fs.readFileSync(fallbackPath);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(fileContent);
    } catch (fallbackErr) {
      console.error('Fallback failed:', fallbackErr);
      res.status(500).send('Internal server error');
    }
  }
};
