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
  ? 'https://i.postimg.cc/yxM0JkpT/received-443561689372990.jpg' // Staging image
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

// /creepy endpoint
app.get('/creepy', async (req, res) => {
  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'];
  const timestamp = new Date().toISOString();
  const parser = new UAParser(userAgent);
  
  const deviceInfo = parser.getDevice();
  const osInfo = parser.getOS();
  const browserInfo = parser.getBrowser();

  const deviceType = deviceInfo.model || 'Unknown Device';
  const os = osInfo.name || 'Unknown OS';
  const browser = browserInfo.name || 'Unknown Browser';

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
    deviceType,
    os,
    browser
  };

  visits.push(visitData);
  saveVisitsDebounced();

  console.table(visits);
  console.log(`🌍 Total Visits: ${visits.length}`);

  // Creepy Page content
  res.send(`
    <html>
      <head>
        <title>Creepy Experience</title>
        <style>
          body {
            text-align: center;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #000;
            color: #fff;
            overflow: hidden;
          }
          h3 {
            font-size: 2rem;
            color: #f00;
            margin: 20px 0;
            text-shadow: 0 0 10px red, 0 0 20px red;
          }
          img {
            width: 100%;
            max-width: 500px;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 0 30px red;
            animation: glitch 1.5s infinite;
          }
          @keyframes glitch {
            0% { transform: translate(0); }
            20% { transform: translate(-5px, 5px); }
            40% { transform: translate(5px, -5px); }
            60% { transform: translate(-5px, -5px); }
            80% { transform: translate(5px, 5px); }
            100% { transform: translate(0); }
          }
          .alert {
            font-size: 1.5rem;
            color: #ff00ff;
            animation: alert 0.5s infinite;
          }
          @keyframes alert {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
          }
          .malfunction {
            font-size: 1.2rem;
            color: #ffcc00;
            text-shadow: 0 0 15px #ff0000;
            animation: blink 1s step-end infinite;
          }
          @keyframes blink {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
          }
          .emoji {
            position: absolute;
            font-size: 2rem;
            animation: floatDown 5s linear infinite;
          }
          @keyframes floatDown {
            0% { top: -5%; opacity: 1; }
            100% { top: 105%; opacity: 0; }
          }
          .button {
            margin-top: 20px;
            background-color: red;
            color: white;
            border: none;
            padding: 12px 20px;
            font-size: 1rem;
            cursor: pointer;
            box-shadow: 0 0 15px red;
          }
        </style>
      </head>
      <body>
        <h3>Warning: Something is very wrong!</h3>
        <img src="${FUNKY_IMAGE_URL}" alt="Creepy Image" />
        <p class="alert">⚠️ Unauthorized Access Detected!</p>
        <p class="malfunction">System Malfunctioning... Please wait...</p>
        <button class="button" onclick="alert('💥 Self-Destruct Sequence Initiated! Just kidding 😈')">Self Destruct</button>

        <script>
          // Flashing message
          setInterval(() => {
            const msg = document.querySelector('.malfunction');
            msg.style.opacity = msg.style.opacity === "1" ? "0.5" : "1";
          }, 1000);

          // Random alert popup
          setInterval(() => {
            alert("⚠️ SYSTEM ERROR: Unusual Activity Detected!");
          }, 5000);

          // Emoji Rain
          const emojis = ["🐒","🧠","💥","👀","😱","🔥","🤖","👻"];
          setInterval(() => {
            const emoji = document.createElement("div");
            emoji.classList.add("emoji");
            emoji.style.left = Math.random() * 100 + "%";
            emoji.style.top = "-5%";
            emoji.innerText = emojis[Math.floor(Math.random() * emojis.length)];
            document.body.appendChild(emoji);
            setTimeout(() => emoji.remove(), 6000);
          }, 300);
        </script>
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
        <div class="card" style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;" id="visitorCount">0</div>
          <div>Real-Time Visitors</div>
        </div>
        <div class="grid grid-2">
          <div class="card">
            <h2>Visitor Countries</h2>
            <canvas id="countryChart"></canvas>
          </div>
          <div class="card">
            <h2>Device Types</h2>
            <canvas id="deviceChart"></canvas>
          </div>
        </div>
        <div class="card">
          <h2>Visitor Log</h2>
          <table>
            <thead>
              <tr>
                <th>Visit #</th>
                <th>IP Address</th>
                <th>Location</th>
                <th>Device</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <script>
          let counter = 0;
          setInterval(() => {
            counter++;
            document.getElementById('visitorCount').innerText = counter;
          }, 1000);

          const countryData = ${JSON.stringify(countryCount)}; 
          const deviceData = ${JSON.stringify(deviceCount)};
          
          const ctxCountry = document.getElementById('countryChart').getContext('2d');
          const ctxDevice = document.getElementById('deviceChart').getContext('2d');
          
          new Chart(ctxCountry, {
            type: 'pie',
            data: {
              labels: Object.keys(countryData),
              datasets: [{
                label: 'Country Visits',
                data: Object.values(countryData),
                backgroundColor: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'],
              }]
            }
          });

          new Chart(ctxDevice, {
            type: 'bar',
            data: {
              labels: Object.keys(deviceData),
              datasets: [{
                label: 'Device Visits',
                data: Object.values(deviceData),
                backgroundColor: '#333',
              }]
            }
          });
        </script>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
