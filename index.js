const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 10000;

// Replace with your own simple credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'password';

const FUNKY_IMAGE_URL = 'https://media.istockphoto.com/id/994269878/photo/the-rhesus-macaque.jpg?s=1024x1024&w=is&k=20&c=f7-S7OvIGUjo69BmOmOd_v4nryjD1YFB7NJjrkT4PDw=';
const VISIT_LOG_FILE = path.join(__dirname, 'visits.json');

let visits = [];

// Load visits from file if it exists
if (fs.existsSync(VISIT_LOG_FILE)) {
  try {
    const data = fs.readFileSync(VISIT_LOG_FILE);
    visits = JSON.parse(data);
  } catch (err) {
    console.error('⚠️ Error loading visit log:', err.message);
  }
}

function getRealIP(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  return forwardedFor ? forwardedFor.split(',')[0] : req.connection.remoteAddress;
}

function saveVisitsDebounced() {
  clearTimeout(saveVisitsDebounced._t);
  saveVisitsDebounced._t = setTimeout(() => {
    fs.writeFileSync(VISIT_LOG_FILE, JSON.stringify(visits, null, 2));
  }, 1000);
}

// /meet endpoint
app.get('/meet', async (req, res) => {
  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'];
  const timestamp = new Date().toISOString();
  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || 'Desktop';

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

  const visitData = {
    visit: visits.length + 1,
    ip,
    location: `${locationData.city}, ${locationData.regionName}, ${locationData.country}`,
    userAgent,
    deviceType,
    time: timestamp
  };

  visits.push(visitData);
  saveVisitsDebounced();

  console.table(visits);
  console.log(`🌍 Total Visits: ${visits.length}`);

  res.send(`
    <html>
      <head><title>🎉 Gotcha!</title></head>
      <body style="text-align:center; font-family:Arial, sans-serif;">
        <h1>🎉 You have been fooled!! 🎉</h1>
        <img src="${FUNKY_IMAGE_URL}" style="width:90%; max-width:500px; border-radius:10px; margin:20px 0;">
      </body>
    </html>
  `);
});

// Basic Auth Middleware for /admin
app.use('/admin', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required');
  }
  const [type, value] = auth.split(' ');
  const [user, pass] = Buffer.from(value, 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Unauthorized');
  }
});

// Admin UI
app.get('/admin', (req, res) => {
  let tableRows = visits.map(v => `
    <tr>
      <td>${v.visit}</td>
      <td>${v.ip}</td>
      <td>${v.location}</td>
      <td>${v.deviceType}</td>
      <td style="font-size:12px;">${v.userAgent}</td>
      <td>${v.time}</td>
    </tr>
  `).join('');

  res.send(`
    <html>
      <head>
        <title>Visitor Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; padding: 20px; background: #f7f7f7; }
          h2 { margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; overflow-x: auto; display: block; }
          th, td { padding: 8px 10px; border: 1px solid #ccc; text-align: left; word-break: break-all; }
          th { background: #444; color: #fff; }
          tr:nth-child(even) { background: #eee; }
        </style>
      </head>
      <body>
        <h2>📊 Total Visits: ${visits.length}</h2>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr><th>#</th><th>IP</th><th>Location</th><th>Device</th><th>User Agent</th><th>Time</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
