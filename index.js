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

// Use separate log file if staging
const IS_STAGING = process.env.STAGING === 'true';
const VISIT_LOG_FILE = path.join(__dirname, IS_STAGING ? 'visits-staging.json' : 'visits.json');

const FUNKY_IMAGE_URL = IS_STAGING 
  ? 'https://i.imgur.com/9TZLz8U.png' // Staging image
  : 'https://media.istockphoto.com/id/994269878/photo/the-rhesus-macaque.jpg?s=1024x1024&w=is&k=20&c=f7-S7OvIGUjo69BmOmOd_v4nryjD1YFB7NJjrkT4PDw=';

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
      <head>
        <title>${IS_STAGING ? '🧪 STAGING Gotcha' : '🎉 Gotcha!'}</title>
        <style>
          body { text-align: center; font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: ${IS_STAGING ? '#FFF3CD' : '#f4f4f4'}; }
          img { width: 100%; max-width: 500px; border-radius: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div>
          <h1 style="font-size: 2.5rem; color: #2D3748;">
            ${IS_STAGING ? '🧪 You are in the STAGING environment!' : '🎉 You have been fooled!! 🎉'}
          </h1>
          <img src="${FUNKY_IMAGE_URL}">
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

// Admin Dashboard (simpler UI without audit logs or notifications)
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
    <html class="dark">
    <head>
      <title>Visitor Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        /* Minimal custom styles */
        body { transition: background-color 0.3s; }
        .toggle-btn { position: fixed; top: 10px; right: 10px; padding: 0.5rem 1rem; background-color: #4FD1C5; color: white; border: none; border-radius: 0.375rem; cursor: pointer; }
      </style>
    </head>
    <body class="bg-gray-100 dark:bg-gray-900 dark:text-gray-200 p-4">
      <!-- Dark Mode Toggle Button (minimal style) -->
      <button class="toggle-btn" onclick="document.body.classList.toggle('dark')">Toggle Dark Mode</button>
      
      <h1 class="text-2xl font-bold mb-4">🌍 Visitor Analytics Dashboard</h1>
      
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${visits.length}</div>
          <div>Total Visits</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${uniqueIPs}</div>
          <div>Unique Visitors</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${topCountry}</div>
          <div>Top Country</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${topDevice}</div>
          <div>Top Device</div>
        </div>
      </div>
      
      <!-- Charts Section -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <canvas id="countryChart"></canvas>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <canvas id="deviceChart"></canvas>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded shadow sm:col-span-2">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>
      
      <!-- Visits Table -->
      <div class="bg-white dark:bg-gray-800 p-4 rounded shadow overflow-x-auto mb-6">
        <h2 class="text-lg font-bold mb-2">All Visits</h2>
        <table class="min-w-full text-left border">
          <thead>
            <tr class="bg-gray-200 dark:bg-gray-700 text-sm">
              <th class="p-2">#</th>
              <th class="p-2">IP</th>
              <th class="p-2">Location</th>
              <th class="p-2">Device</th>
              <th class="p-2">Time</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      
      <!-- Real-Time Visitor Counter (Fake) -->
      <div id="realTimeCounter" class="bg-white dark:bg-gray-800 p-4 rounded shadow text-center mb-6">
        <div id="visitorCount" class="text-xl font-semibold">0</div>
        <div>Real-Time Visitors</div>
      </div>
      
      <script>
        // Chart configuration with custom colors and basic tooltips
        const chartConfig = {
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true },
              tooltip: { enabled: true }
            },
            scales: { x: { beginAtZero: true }, y: { beginAtZero: true } }
          }
        };

        function updateCharts(data) {
          // Country Chart (Bar)
          new Chart(document.getElementById('countryChart'), {
            type: 'bar',
            data: {
              labels: Object.keys(data.countryCount),
              datasets: [{
                label: 'Visits by Country',
                data: Object.values(data.countryCount),
                backgroundColor: '#60A5FA'
              }]
            },
            ...chartConfig
          });

          // Device Chart (Pie)
          new Chart(document.getElementById('deviceChart'), {
            type: 'pie',
            data: {
              labels: Object.keys(data.deviceCount),
              datasets: [{
                label: 'Devices',
                data: Object.values(data.deviceCount),
                backgroundColor: ['#F87171','#34D399','#60A5FA','#FBBF24']
              }]
            },
            ...chartConfig
          });

          // Timeline Chart (Line)
          const ctx = document.getElementById('timelineChart').getContext('2d');
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, '#34D399');
          gradient.addColorStop(1, '#60A5FA');
          
          new Chart(document.getElementById('timelineChart'), {
            type: 'line',
            data: {
              labels: Object.keys(data.timelineData),
              datasets: [{
                label: 'Visits Over Time',
                data: Object.values(data.timelineData),
                borderColor: '#34D399',
                backgroundColor: gradient,
                fill: true
              }]
            },
            ...chartConfig
          });
        }
        
        // Polling every 10 seconds for chart updates
        async function fetchChartData() {
          const res = await fetch('/admin/data');
          const data = await res.json();
          updateCharts(data);
        }
        fetchChartData();
        setInterval(fetchChartData, 10000);
        
        // Simulated Real-Time Visitor Counter (fake numbers)
        function updateVisitorCounter() {
          const counterEl = document.getElementById('visitorCount');
          const fakeCount = Math.floor(Math.random() * 11) + 5; // random between 5 and 15
          counterEl.innerText = fakeCount;
        }
        updateVisitorCounter();
        setInterval(updateVisitorCounter, 5000);
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
  console.log(`🚀 ${IS_STAGING ? '[STAGING]' : '[PRODUCTION]'} Server running at http://0.0.0.0:${PORT}`);
});
