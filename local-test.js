// local-test.js - Test the serverless function directly
const handler = require('./api/scrape.js');

// Mock request and response objects
const mockReq = {
  method: 'POST',
  body: {
    jobTitle: 'Software Engineer',
    location: 'San Francisco',
    count: 25
  }
};

const mockRes = {
  status: (code) => {
    console.log(`Status: ${code}`);
    return mockRes;
  },
  json: (data) => {
    console.log('Response:', JSON.stringify(data, null, 2));
    return mockRes;
  },
  setHeader: (key, value) => {
    console.log(`Header: ${key} = ${value}`);
    return mockRes;
  },
  end: () => {
    console.log('Response ended');
    return mockRes;
  }
};

// Run the test
console.log('Testing serverless function locally...');
handler(mockReq, mockRes).catch(console.error);
