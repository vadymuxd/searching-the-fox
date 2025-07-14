// local-server.js - Simple Express server for local testing
const express = require('express');
const path = require('path');
const handler = require('./api/scrape.js');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Parse JSON bodies
app.use(express.json());

// Handle the API endpoint
app.post('/api/scrape', (req, res) => {
  handler(req, res);
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
  console.log('Use this for testing instead of vercel dev');
});
