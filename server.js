/**
 * Elijah's Train Mayhem - static game server
 * Render runs:  npm install  ->  npm start
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Find the folder holding index.html.
 *
 * Render runs Linux, where "Public" and "public" are two different folders, but
 * phones and Macs treat them as the same name. So instead of trusting one
 * spelling, look for index.html and use whatever folder actually contains it.
 */
function findStaticDir() {
  const candidates = [];
  let entries = [];
  try {
    entries = fs.readdirSync(__dirname, { withFileTypes: true });
  } catch (err) {
    entries = [];
  }
  entries.forEach((e) => {
    if (!e.isDirectory()) return;
    const n = e.name.toLowerCase();
    if (n === 'public' || n === 'static' || n === 'www' || n === 'dist' || n === 'build') {
      candidates.push(path.join(__dirname, e.name));
    }
  });
  // Or the repo root itself, if index.html was committed without a folder.
  candidates.push(__dirname);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

const STATIC_DIR = findStaticDir();

// Print what actually landed on the server. If the game 404s, this listing in
// the Render log tells you exactly which files made it into the repo.
function logTree() {
  console.log('--- repo contents at ' + __dirname + ' ---');
  let entries = [];
  try {
    entries = fs.readdirSync(__dirname, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.log('  (could not read directory: ' + err.message + ')');
    return;
  }
  entries.forEach((e) => {
    if (e.name === 'node_modules' || e.name === '.git') {
      console.log('  ' + e.name + '/  (skipped)');
      return;
    }
    if (e.isDirectory()) {
      console.log('  ' + e.name + '/');
      let kids = [];
      try {
        kids = fs.readdirSync(path.join(__dirname, e.name)).sort();
      } catch (err) {
        kids = ['(unreadable)'];
      }
      kids.forEach((k) => console.log('      ' + k));
    } else {
      console.log('  ' + e.name);
    }
  });
  console.log('---------------------------------------');
}

app.use(compression());

if (STATIC_DIR) {
  app.use(express.static(STATIC_DIR, {
    etag: true,
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  }));
}

// Health check (Render pings this happily)
app.get('/healthz', (req, res) => res.status(200).send('ok'));

// Everything else -> the game
app.get('*', (req, res) => {
  if (!STATIC_DIR) {
    res.status(500).type('html').send(
      '<body style="font:16px/1.6 -apple-system,Helvetica,sans-serif;max-width:34em;margin:12vh auto;padding:0 1.2em;background:#101216;color:#e8e8ea">' +
      '<h1 style="color:#ff6319">index.html is missing</h1>' +
      '<p>The server started, but there is no <code>index.html</code> in this repo &mdash; not in ' +
      '<code>public/</code>, and not at the root.</p>' +
      '<p>Most likely cause: on GitHub the folder is named <code>Public</code> with a capital P, or the ' +
      'folder vanished because Git does not keep empty folders. Re-create the file at the exact path ' +
      '<code>public/index.html</code>, all lowercase.</p>' +
      '<p style="opacity:.7">Open the Render log for this service &mdash; it prints a full listing of every ' +
      'file it can see, so you can compare it against what you expected.</p></body>'
    );
    return;
  }
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log("🚇 Elijah's Train Mayhem running on port " + PORT);
  if (STATIC_DIR) {
    console.log('Serving game files from: ' + STATIC_DIR);
  } else {
    console.log('!! No index.html found. The game cannot be served.');
    logTree();
  }
});
