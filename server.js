/**
 * Elijah's Train Mayhem - static game server
 * Render runs:  npm install  ->  npm start
 */
const path = require('path');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());

// Serve the game
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Health check (Render pings this happily)
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Everything else -> the game
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚇 Elijah's Train Mayhem running on port ${PORT}`);
});
