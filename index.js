const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const FUNKY_IMAGE_URL = 'https://images.unsplash.com/photo-1741866987680-5e3d7f052b87?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

// Helper function to extract the real IP address
function getRealIP(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  return forwardedFor ? forwardedFor.split(',')[0].trim() : req.connection.remoteAddress;
}

app.get('/meet', async (req, res) => {
  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'];
  const timestamp = new Date().toISOString();

  let locationText = 'Unknown';
  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
    const location = geoRes.data;

    if (location.status === 'success') {
      locationText = `${location.city}, ${location.regionName}, ${location.country}`;
    } else {
      console.error('⚠️ Failed to fetch location:', location.message);
    }

    console.log(`📍 New Visit`);
    console.log(`IP: ${ip}`);
    console.log(`Location: ${locationText}`);
    console.log(`User Agent: ${userAgent}`);
    console.log(`Time: ${timestamp}`);
  } catch (err) {
    console.error('⚠️ Error fetching location:', err.message);
  }

  // Serve a funky image with a message and location info
 res.send(`
  <html>
    <head>
      <title>Welcome, Curious One!</title>
      <style>
        body {
          background: linear-gradient(to right, #ffecd2, #fcb69f);
          font-family: 'Comic Sans MS', 'Arial', sans-serif;
          text-align: center;
          padding: 50px;
          color: #333;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 1.5rem;
          color: #555;
          margin-bottom: 30px;
        }
        img {
          width: 60%;
          max-width: 500px;
          border-radius: 20px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s ease-in-out;
        }
        img:hover {
          transform: scale(1.05) rotate(-1deg);
        }
        .footer {
          margin-top: 30px;
          font-size: 1rem;
          color: #666;
        }
      </style>
    </head>
    <body>
      <h1>🎉 Welcome! 🎉</h1>
      <div class="subtitle">You’ve officially been fooled! 😜</div>
      <img src="${FUNKY_IMAGE_URL}" alt="Funky Image">
      <div class="footer">Enjoy your day — and maybe prank someone else 😉</div>
    </body>
  </html>
`);

// Use '0.0.0.0' to make the app accessible externally, not just on localhost
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
