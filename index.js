const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 10000;

// Multi-User Support: List of valid admin users (username: password)
const ADMIN_USERS = {
  admin: 'password',
  user2: 'secret'
};

// In-memory audit logs for admin logins
const auditLogs = [];

// Staging support: use separate file when STAGING=true
const IS_STAGING = process.env.STAGING === 'true';
const VISIT_LOG_FILE = path.join(__dirname, IS_STAGING ? 'visits-staging.json' : 'visits.json');

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
      </head>
      <body style="text-align:center; font-family:Arial, sans-serif; margin:0; padding:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color:${IS_STAGING ? '#FFF3CD' : '#f4f4f4'};">
        <div style="text-align:center;">
          <h1 style="font-size:2.5rem; color:#2D3748;">${IS_STAGING ? '🧪 You are in the STAGING environment!' : '🎉 You have been fooled!! 🎉'}</h1>
          <img src="${IS_STAGING ? 'https://i.imgur.com/9TZLz8U.png' : 'https://media.istockphoto.com/id/994269878/photo/the-rhesus-macaque.jpg?s=1024x1024&w=is&k=20&c=f7-S7OvIGUjo69BmOmOd_v4nryjD1YFB7NJjrkT4PDw='}" style="width:100%; max-width:500px; border-radius:10px; margin:20px 0;">
        </div>
      </body>
    </html>
  `);
});

// Basic Auth Middleware for /admin with multi-user support and audit logging
app.use('/admin', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required');
  }
  const [type, value] = auth.split(' ');
  const credentials = Buffer.from(value, 'base64').toString().split(':');
  const [user, pass] = credentials;
  if (ADMIN_USERS[user] && ADMIN_USERS[user] === pass) {
    // Log admin login (audit log)
    auditLogs.push({ user, time: new Date().toLocaleString() });
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Unauthorized');
});

// Admin Dashboard with enhancements: Dark mode, real-time fake visitor counter, notifications, audit logs, improved layout and charts
app.get('/admin', (req, res) => {
  // Compute statistics
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

  // The HTML dashboard: dark mode toggle, notification area, real-time fake visitor counter, audit logs
  res.send(`
    <html class="dark">
    <head>
      <title>Visitor Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        /* Custom colors and styles */
        body.dark { background-color: #1a202c; color: #e2e8f0; }
        .dark .card { background-color: #2d3748; }
        .toggle-btn { position: fixed; top: 10px; right: 10px; padding: 0.5rem 1rem; background-color: #4FD1C5; color: #fff; border: none; border-radius: 0.375rem; cursor: pointer; }
      </style>
    </head>
    <body class="bg-gray-100 dark:bg-gray-900 dark:text-gray-200 p-4">
      <!-- Dark Mode Toggle Button -->
      <button class="toggle-btn" onclick="document.body.classList.toggle('dark')">Toggle Dark Mode</button>
      
      <h1 class="text-2xl font-bold mb-4">🌍 Visitor Analytics Dashboard</h1>
      
      <!-- Notification Area -->
      <div id="notification" class="mb-4 p-2 bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 text-center rounded">
        New visitor spike detected!
      </div>
      
      <!-- Real-time Visitor Counter (Fake) -->
      <div id="realTimeCounter" class="mb-6 p-4 bg-white dark:bg-gray-800 rounded shadow text-center">
        <div class="text-xl font-semibold" id="visitorCount">0</div>
        <div>Real-Time Visitors</div>
      </div>
      
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${visits.length}</div>
          <div>Total Visits</div>
        </div>
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${uniqueIPs}</div>
          <div>Unique Visitors</div>
        </div>
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${topCountry}</div>
          <div>Top Country</div>
        </div>
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
          <div class="text-xl font-semibold">${topDevice}</div>
          <div>Top Device</div>
        </div>
      </div>
      
      <!-- Charts Section -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
          <canvas id="countryChart"></canvas>
        </div>
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
          <canvas id="deviceChart"></canvas>
        </div>
        <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow sm:col-span-2">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>
      
      <!-- Visits Table -->
      <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow overflow-x-auto mb-6">
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
      
      <!-- Audit Logs Section -->
      <div class="card bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h2 class="text-lg font-bold mb-2">Audit Logs</h2>
        <table class="min-w-full text-left border">
          <thead>
            <tr class="bg-gray-200 dark:bg-gray-700 text-sm">
              <th class="p-2">User</th>
              <th class="p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            ${auditLogs.map(log => `<tr class="border-t text-sm"><td class="p-2">${log.user}</td><td class="p-2">${log.time}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      
      <script>
        // Chart configuration with custom colors and gradient for timeline chart
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
          
          // Timeline Chart (Line) with gradient background
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
        
        // Simulated Real-Time Visitor Counter (fake numbers that update randomly)
        function updateVisitorCounter() {
          const counterEl = document.getElementById('visitorCount');
          // Simulate current visitors between 5 and 15
          const fakeCount = Math.floor(Math.random() * 11) + 5;
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
