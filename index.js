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

// Use separate file when staging
const IS_STAGING = process.env.STAGING === 'true';
const VISIT_LOG_FILE = path.join(__dirname, IS_STAGING ? 'visits-staging.json' : 'visits.json');

const FUNKY_IMAGE_URL = IS_STAGING 
  ? 'https://media.istockphoto.com/id/1206006585/photo/girl-painting-picture-stock-photo.webp?a=1&b=1&s=612x612&w=0&k=20&c=GDmdQRNHpxddU50QCKcA28dPZ24nP0DEQCG_yasu6N8=' // Staging image
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
          body { text-align:center; font-family:Arial, sans-serif; margin:0; padding:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color: ${IS_STAGING ? '#FFF3CD' : '#f4f4f4'}; }
          img { width:100%; max-width:500px; border-radius:10px; margin:20px 0; }
        </style>
      </head>
      <body>
        <div>
          <h1 style="font-size:2.5rem; color:#000;">${IS_STAGING ? '🧪 You are in the STAGING environment!' : '🎉 You have been fooled!! 🎉'}</h1>
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

// Admin Dashboard with Minimal Black and White UI
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
    <tr style="border-top: 1px solid #000; font-size: 0.9rem;">
      <td style="padding: 6px;">${v.visit}</td>
      <td style="padding: 6px;">${v.ip}</td>
      <td style="padding: 6px;">${v.location}</td>
      <td style="padding: 6px;">${v.deviceType || 'Unknown'}</td>
      <td style="padding: 6px;">${new Date(v.time).toLocaleString()}</td>
    </tr>
  `).join('');

  res.send(`
    <html>
    <head>
      <title>Visitor Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        /* Minimal Black and White CSS */
        body { font-family: Arial, sans-serif; background-color: #fff; color: #000; margin: 0; padding: 20px; }
        h1, h2 { margin: 0 0 20px 0; }
        .grid { display: grid; gap: 20px; }
        .grid-4 { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
        .grid-2 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .card { padding: 15px; border: 1px solid #000; border-radius: 4px; background-color: #fff; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #f0f0f0; padding: 8px; text-align: left; border: 1px solid #000; }
        td { padding: 8px; border: 1px solid #000; }
        canvas { width: 100% !important; height: 300px !important; }
      </style>
    </head>
    <body>
      <h1>Visitor Analytics Dashboard</h1>
      
      <!-- Summary Cards -->
      <div class="grid grid-4" style="margin-bottom: 20px;">
        <div class="card">
          <div style="font-size: 1.5rem; font-weight: bold;">${visits.length}</div>
          <div>Total Visits</div>
        </div>
        <div class="card">
          <div style="font-size: 1.5rem; font-weight: bold;">${uniqueIPs}</div>
          <div>Unique Visitors</div>
        </div>
        <div class="card">
          <div style="font-size: 1.5rem; font-weight: bold;">${topCountry}</div>
          <div>Top Country</div>
        </div>
        <div class="card">
          <div style="font-size: 1.5rem; font-weight: bold;">${topDevice}</div>
          <div>Top Device</div>
        </div>
      </div>
      
      <!-- Charts Section -->
      <div class="grid grid-2" style="margin-bottom: 20px;">
        <div class="card">
          <canvas id="countryChart"></canvas>
        </div>
        <div class="card">
          <canvas id="deviceChart"></canvas>
        </div>
        <div class="card" style="grid-column: span 2;">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>
      
            <!-- Real-Time Visitor Counter (Fake) -->
      <div class="card" style="text-align: center;">
        <div style="font-size: 1.5rem; font-weight: bold;" id="visitorCount">0</div>
        <div>Real-Time Visitors</div>
      </div>
      
      <!-- Visits Table -->
      <div class="card" style="overflow-x: auto; margin-bottom: 20px;">
        <h2>All Visits</h2>
        <table>
          <thead>
            <tr>
              <th>#</th><th>IP</th><th>Location</th><th>Device</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
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

          // Timeline Chart (Line) with gradient
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
        
        // Simulated Real-Time Visitor Counter (Fake numbers)
        function updateVisitorCounter() {
          const counterEl = document.getElementById('visitorCount');
          const fakeCount = Math.floor(Math.random() * 101) + 25;
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
