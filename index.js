const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

const FUNKY_IMAGE_URL = 'https://media.istockphoto.com/id/994269878/photo/the-rhesus-macaque.jpg?s=1024x1024&w=is&k=20&c=f7-S7OvIGUjo69BmOmOd_v4nryjD1YFB7NJjrkT4PDw=';

let visitCount = 0;
const visitLogs = [];

// Helper to get real IP
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
    } else {
      console.error('⚠️ Error fetching location:', geoRes.data.message);
    }

    visitCount++;

    visitLogs.push({
      visit: visitCount,
      ip,
      location: `${locationData.city}, ${locationData.regionName}, ${locationData.country}`,
      userAgent,
      time: timestamp
    });

    console.clear();
    console.log(`\n🌍 Total Visits: ${visitCount}`);
    console.table(visitLogs.slice(-10));
  } catch (err) {
    console.error('⚠️ Error fetching location:', err.message);
  }

  res.send(`
    <html>
      <head>
        <title>🎉 You Have Been Fooled! 🎉</title>
        <script>
          const funnyQuotes = [
            "I'm not lazy, I'm on energy-saving mode.",
            "Why don’t skeletons fight each other? They don’t have the guts.",
            "I'm not arguing, I'm just explaining why I’m right.",
            "If you think nobody cares, try missing a few payments.",
            "My brain has too many tabs open.",
            "Error 404: Motivation not found.",
            "Life’s short. Smile while you still have teeth."
          ];
          window.onload = () => {
            const quote = funnyQuotes[Math.floor(Math.random() * funnyQuotes.length)];
            document.getElementById("funny-quote").innerText = quote;
          };
        </script>
      </head>
      <body style="text-align:center; font-family:Arial, sans-serif;">
        <h1>🎉 You have been fooled!! 🎉</h1>
        <img src="${FUNKY_IMAGE_URL}" alt="Funky Image" style="width:60%; max-width:600px; border-radius:10px; margin:20px 0;">
        <p id="funny-quote" style="font-size:1.2em; color:#444; margin-top:20px;"></p>
      </body>
    </html>
  `);
});

// Use '0.0.0.0' to make the app accessible externally
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
