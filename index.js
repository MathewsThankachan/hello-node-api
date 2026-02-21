const express = require("express");
const config = require("./config");
const app = express();
const port = config.port;
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

// GET /weather?q=<location>
// Requires environment variable WEATHERAPI_KEY to be set (from WeatherAPI.com)
app.get("/weather", async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res
      .status(400)
      .json({ error: "missing required query parameter 'q' (location)" });
  }

  const apiKey = config.weatherApi.key;
  if (!apiKey) {
    return res.status(500).json({ error: "WEATHERAPI_KEY not configured" });
  }

  try {
    const url = `${config.weatherApi.baseUrl}/current.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return res
        .status(r.status)
        .json({ error: "weatherapi request failed", detail: text });
    }
    const data = await r.json();

    // Return a compact payload with location and current conditions
    return res.json({
      location: data.location,
      current: data.current,
    });
  } catch (err) {
    return res.status(500).json({ error: "fetch failed", detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
