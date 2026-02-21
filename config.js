// Central configuration for the application.
// Values are read from environment variables with sensible defaults.

const config = {
  port: process.env.PORT || 3000,
  weatherApi: {
    // Base URL for WeatherAPI.com (v1). Change here if needed.
    baseUrl: process.env.WEATHERAPI_BASE_URL || "http://api.weatherapi.com/v1",
    // API key: prefer env var WEATHERAPI_KEY. For deployments, inject via env or Kubernetes Secret.
    key: process.env.WEATHERAPI_KEY || "1444f559ef5c4e92ba2233715262002",
  },
};

module.exports = config;
