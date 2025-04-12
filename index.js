const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const FUNKY_IMAGE_URL = 'https://images.unsplash.com/photo-1741866987680-5e3d7f052b87?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'; // Replace with your funky image URL

// Helper function to extract the real IP address
function getRealIP(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  return forwardedFor ? forwardedFor.split(',')[0] : req.connection.remoteAddress;
}

app.get('/meet', async (req, res) => {
  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'];
  const timestamp = new Date().toISOString();

  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
    const location = geoRes.data;

    console.log(`📍 New Visit`);
    console.log(`IP: ${ip}`);
    console.log(`Location: ${location.city}, ${location.regionName}, ${location.country}`);
    console.log(`User Agent: ${userAgent}`);
    console.log(`Time: ${timestamp}`);

    if (location.status === 'fail') {
      console.error('⚠️ Error fetching location:', location.message);
    }
  } catch (err) {
    console.error('⚠️ Error fetching location:', err.message);
  }

  // Serve a funky image with a message and location info
  res.send(`
    <html>
      <head>
        <title>Welcome!</title>
      </head>
      <body style="text-align:center; font-family:Arial, sans-serif;">
        <h1>🎉 Welcome! 🎉</h1>
        <p>Here's a funky image just for you!</p>
        <img src="${FUNKY_IMAGE_URL}" alt="Funky Image" style="width:50%; max-width:400px; border-radius:10px;">
        <p><strong>Your location:</strong> ${location.city}, ${location.regionName}, ${location.country}</p>
        <p><strong>IP Address:</strong> ${ip}</p>
        <p><strong>Time of visit:</strong> ${timestamp}</p>
      </body>
    </html>
  `);
});

// Use '0.0.0.0' to make the app accessible externally, not just on localhost
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
