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
    lat: locationData.lat,
    lon: locationData.lon,
    userAgent,
    time: timestamp,
    deviceType
  };

  visits.push(visitData);
  saveVisitsDebounced();

  console.table(visits);
  console.log(`🌍 Total Visits: ${visits.length}`);

  res.send(`
    <html>
      <head><title>🎉 Gotcha!</title></head>
      <body style="text-align:center; font-family:Arial, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f4f4;">
        <div style="text-align:center;">
          <h1 style="font-size:2.5rem; color:#2D3748;">🎉 You have been fooled!! 🎉</h1>
          <img src="${FUNKY_IMAGE_URL}" style="width:100%; max-width:500px; border-radius:10px; margin:20px 0;">
        </div>
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

// Admin Dashboard
app.get('/admin', (req, res) => {
  const uniqueIPs = new Set(visits.map(v => v.ip)).size;
  const countryCount = {};
  const deviceCount = {};
  const timelineData = {};

  visits.forEach(v => {
    const country = v.location.split(', ').pop();
    countryCount[country] = (countryCount[country] || 0) + 1;
    const device = v.deviceType || 'Unknown';
    deviceCount[device] = (deviceCount[device] || 0) + 1;
    const date = new Date(v.time).toISOString().split('T')[0];
    timelineData[date] = (timelineData[date] || 0) + 1;
  });

  const topCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
  const topDevice = Object.entries(deviceCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  const tableRows = visits.map(v => `
    <tr class="border-t text-sm">
      <td class="p-2">${v.visit}</td>
      <td class="p-2">${v.ip}</td>
      <td class="p-2">${v.location}</td>
      <td class="p-2">${v.deviceType || 'Unknown'}</td>
      <td class="p-2">${new Date(v.time).toLocaleString()}</td>
    </tr>
  `).join('');

  res.send(`
    <html>
    <head>
      <title>Visitor Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 text-gray-800 p-4">
      <h1 class="text-2xl font-bold mb-4">🌍 Visitor Analytics Dashboard</h1>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
        <div class="bg-white p-4 rounded shadow"><div class="text-xl font-semibold">${visits.length}</div><div>Total Visits</div></div>
        <div class="bg-white p-4 rounded shadow"><div class="text-xl font-semibold">${uniqueIPs}</div><div>Unique Visitors</div></div>
        <div class="bg-white p-4 rounded shadow"><div class="text-xl font-semibold">${topCountry}</div><div>Top Country</div></div>
        <div class="bg-white p-4 rounded shadow"><div class="text-xl font-semibold">${topDevice}</div><div>Top Device</div></div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div class="bg-white p-4 rounded shadow">
          <canvas id="countryChart"></canvas>
        </div>
        <div class="bg-white p-4 rounded shadow">
          <canvas id="deviceChart"></canvas>
        </div>
        <div class="bg-white p-4 rounded shadow sm:col-span-2">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>

      <div class="bg-white p-4 rounded shadow overflow-x-auto">
        <h2 class="text-lg font-bold mb-2">All Visits</h2>
        <table class="min-w-full text-left border">
          <thead><tr class="bg-gray-200 text-sm"><th class="p-2">#</th><th class="p-2">IP</th><th class="p-2">Location</th><th class="p-2">Device</th><th class="p-2">Time</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>

      <script>
        const chartConfig = {
          type: 'bar',
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { beginAtZero: true },
              y: { beginAtZero: true }
            }
          }
        };

        function updateCharts(data) {
          const countryData = data.countryCount;
          const deviceData = data.deviceCount;
          const timelineData = data.timelineData;

          const labels1 = Object.keys(countryData);
          const data1 = Object.values(countryData);
          new Chart(document.getElementById('countryChart'), {
            ...chartConfig,
            data: { labels: labels1, datasets: [{ label: 'Visits by Country', data: data1, backgroundColor: '#60A5FA' }] }
          });

          const labels2 = Object.keys(deviceData);
          const data2 = Object.values(deviceData);
          new Chart(document.getElementById('deviceChart'), {
            ...chartConfig,
            type: 'pie',
            data: { labels: labels2, datasets: [{ label: 'Devices', data: data2 }] }
          });

          const labels3 = Object.keys(timelineData);
          const data3 = Object.values(timelineData);
          new Chart(document.getElementById('timelineChart'), {
            ...chartConfig,
            type: 'line',
            data: { labels: labels3, datasets: [{ label: 'Visits Over Time', data: data3, borderColor: '#34D399', fill: false }] }
          });
        }

        setInterval(async () => {
          const response = await fetch('/admin/data');
          const data = await response.json();
          updateCharts(data);
        }, 10000);
      </script>
    </body>
    </html>
  `);
});

// Data endpoint for charts
app.get('/admin/data', (req, res) => {
  const countryCount = {};
  const deviceCount = {};
  const timelineData = {};

  visits.forEach(v => {
    const country = v.location.split(', ').pop();
    countryCount[country] = (countryCount[country] || 0) + 1;
    const device = v.deviceType || 'Unknown';
    deviceCount[device] = (deviceCount[device] || 0) + 1;
    const date = new Date(v.time).toISOString().split('T')[0];
    timelineData[date] = (timelineData[date] || 0) + 1;
  });

  res.json({ countryCount, deviceCount, timelineData });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
