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
      <title>Chaos Arcade 🎮</title>
      <style>
        body {
          font-family: 'Comic Sans MS', cursive, sans-serif;
          background: linear-gradient(135deg, #ffcccc, #ccffff);
          margin: 0;
          padding: 0;
          text-align: center;
        }
        h1 { font-size: 3rem; margin-top: 30px; }
        button {
          padding: 12px 20px;
          margin: 10px;
          font-size: 1.2rem;
          cursor: pointer;
          border: none;
          border-radius: 8px;
          background: #ff66cc;
          color: white;
        }
        #game-area > div {
          display: none;
          margin-top: 30px;
        }
        .active { display: block !important; }
        .monkey {
          position: absolute;
          width: 100px;
          cursor: pointer;
          transition: top 0.1s, left 0.1s;
        }
        #banana-player {
          position: absolute;
          bottom: 10px;
          left: 50%;
          width: 60px;
          height: 60px;
          background: #ffcc00;
          border-radius: 50%;
          transform: translateX(-50%);
        }
        .banana {
          position: absolute;
          top: 0;
          width: 30px;
          height: 30px;
          background: url('https://emojicdn.elk.sh/🍌') no-repeat center/contain;
        }
        #hack-output {
          font-family: monospace;
          background: black;
          color: green;
          padding: 15px;
          height: 200px;
          overflow-y: auto;
          text-align: left;
          margin: 0 10%;
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <h1>Welcome to the Chaos Arcade 🎮</h1>
      <div>
        <button onclick="showGame('monkeyGame')">🐒 Catch the Monkey</button>
        <button onclick="showGame('clickGame')">🟥 Do Not Click</button>
        <button onclick="showGame('bananaGame')">🍌 Banana Rain</button>
        <button onclick="showGame('hackGame')">💻 Hack the System</button>
      </div>

      <div id="game-area">
        <!-- Monkey Game -->
        <div id="monkeyGame">
          <h2>Catch the Monkey!</h2>
          <p>Score: <span id="monkeyScore">0</span></p>
          <img id="monkey" class="monkey" src="https://emojicdn.elk.sh/🐒" />
        </div>

        <!-- Do Not Click Game -->
        <div id="clickGame">
          <h2>DO NOT CLICK THE BUTTON 😈</h2>
          <p>Clicks: <span id="clickScore">0</span></p>
          <button onclick="clickMadness()">DO NOT CLICK</button>
          <div id="clickSpamArea"></div>
        </div>

        <!-- Banana Rain Game -->
        <div id="bananaGame">
          <h2>Catch the Bananas!</h2>
          <p>Score: <span id="bananaScore">0</span></p>
          <div id="banana-player"></div>
        </div>

        <!-- Hack Game -->
        <div id="hackGame">
          <h2>Hack the System</h2>
          <input id="hackInput" type="text" placeholder="Type a command..." onkeydown="if(event.key === 'Enter') hackCommand()" />
          <div id="hack-output"></div>
        </div>
      </div>

      <script>
        function showGame(id) {
          document.querySelectorAll('#game-area > div').forEach(div => div.classList.remove('active'));
          document.getElementById(id).classList.add('active');

          if (id === 'monkeyGame') startMonkeyGame();
          if (id === 'bananaGame') startBananaRain();
        }

        // Catch the Monkey
        let monkeyScore = 0;
        function startMonkeyGame() {
          const monkey = document.getElementById("monkey");
          const moveMonkey = () => {
            monkey.style.top = Math.random() * 80 + "vh";
            monkey.style.left = Math.random() * 80 + "vw";
          };
          monkey.onclick = () => {
            monkeyScore++;
            document.getElementById("monkeyScore").innerText = monkeyScore;
            moveMonkey();
          };
          moveMonkey();
        }

        // Click Madness
        let clickScore = 0;
        function clickMadness() {
          clickScore++;
          document.getElementById("clickScore").innerText = clickScore;
          const btn = document.createElement("button");
          btn.innerText = "STOP!";
          btn.style.margin = "4px";
          btn.onclick = () => alert("Too late!");
          document.getElementById("clickSpamArea").appendChild(btn);
          document.body.style.backgroundColor = "#" + Math.floor(Math.random()*16777215).toString(16);
        }

        // Banana Rain Game
        let bananaScore = 0;
        function startBananaRain() {
          const player = document.getElementById("banana-player");
          const gameArea = document.getElementById("bananaGame");

          document.onkeydown = function(e) {
            const left = parseInt(window.getComputedStyle(player).left);
            if (e.key === "ArrowLeft") player.style.left = Math.max(0, left - 50) + "px";
            if (e.key === "ArrowRight") player.style.left = Math.min(window.innerWidth - 60, left + 50) + "px";
          };

          setInterval(() => {
            const banana = document.createElement("div");
            banana.className = "banana";
            banana.style.left = Math.random() * window.innerWidth + "px";
            gameArea.appendChild(banana);

            let top = 0;
            const fall = setInterval(() => {
              top += 5;
              banana.style.top = top + "px";
              const playerRect = player.getBoundingClientRect();
              const bananaRect = banana.getBoundingClientRect();
              if (top > window.innerHeight - 80 &&
                  bananaRect.left < playerRect.right &&
                  bananaRect.right > playerRect.left) {
                bananaScore++;
                document.getElementById("bananaScore").innerText = bananaScore;
                banana.remove();
                clearInterval(fall);
              }
              if (top > window.innerHeight) {
                banana.remove();
                clearInterval(fall);
              }
            }, 50);
          }, 1000);
        }

        // Hack the System
        function hackCommand() {
          const input = document.getElementById("hackInput");
          const output = document.getElementById("hack-output");
          const val = input.value.trim();
          const replies = [
            "ACCESS GRANTED ✅",
            "DEPLOYING BANANA BOTS 🍌",
            "CRITICAL ERROR 0xDEADBEEF 💀",
            "MONKEYS ARE TAKING OVER 🐒",
            "SYSTEM OVERRIDE... COMPLETE 🔐"
          ];
          const response = replies[Math.floor(Math.random() * replies.length)];
          output.innerHTML += "$ " + val + "<br>" + response + "<br>";
          input.value = "";
          output.scrollTop = output.scrollHeight;
        }
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
