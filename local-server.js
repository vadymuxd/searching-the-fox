// local-server.js - Simple Express server for local testing
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Parse JSON bodies
app.use(express.json());

// Handle FastAPI passthrough endpoint
app.post('/api/fastapi-scrape', async (req, res) => {
  try {
    const axios = require('axios');
    
    console.log('FastAPI passthrough request:', req.body);
    
    const response = await axios.post('http://localhost:8001/scrape', req.body, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000  // 5 minutes timeout for large result sets
    });
    
    console.log('FastAPI response received:', {
      success: response.data.success,
      totalResults: response.data.total_results,
      jobCount: response.data.jobs ? response.data.jobs.length : 0
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('FastAPI passthrough error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.response?.data?.detail || 'Unknown error'
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
  console.log('Use this for testing instead of vercel dev');
});
