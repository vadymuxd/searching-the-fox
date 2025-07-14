// Simple test handler to verify dependencies work
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
  try {
    console.log('Test handler called');
    console.log('Axios version:', axios.VERSION);
    console.log('Cheerio loaded:', typeof cheerio);
    
    res.status(200).json({ 
      success: true, 
      message: 'Dependencies loaded successfully',
      axios: !!axios,
      cheerio: !!cheerio
    });
  } catch (error) {
    console.error('Test handler error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
};
