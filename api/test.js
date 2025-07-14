// Simple test handler to verify dependencies work
module.exports = async function handler(req, res) {
  try {
    console.log('Test handler called');
    
    // Test basic Node.js functionality
    const nodeVersion = process.version;
    const platform = process.platform;
    
    // Use dynamic imports to avoid bundling issues
    const axios = await import('axios');
    const cheerio = await import('cheerio');
    
    console.log('Axios loaded:', !!axios.default);
    console.log('Cheerio loaded:', !!cheerio.load);
    
    res.status(200).json({ 
      success: true, 
      message: 'Dependencies loaded successfully',
      nodeVersion,
      platform,
      axios: !!axios.default,
      cheerio: !!cheerio.load,
      timestamp: new Date().toISOString()
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
