const express = require("express");
const cors = require("cors");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);

const cityAssets = [
  { id: 1, house: "Home 1", area: "Connaught Place", zone: "Commercial", type: "Smart Home", latitude: 28.6315, longitude: 77.2167 },
  { id: 2, house: "Home 2", area: "Karol Bagh", zone: "Residential", type: "Smart Home", latitude: 28.6517, longitude: 77.1907 },
  { id: 3, house: "Home 3", area: "Lajpat Nagar", zone: "Residential", type: "Smart Home", latitude: 28.5677, longitude: 77.2433 },
  { id: 4, house: "Home 4", area: "Saket", zone: "Residential", type: "Smart Home", latitude: 28.5245, longitude: 77.2066 },
  { id: 5, house: "Home 5", area: "Dwarka", zone: "Residential", type: "Smart Home", latitude: 28.5921, longitude: 77.046 },
  { id: 6, house: "Solar Farm 1", area: "Noida Solar Zone", zone: "Solar Zone", type: "Solar Farm", latitude: 28.5355, longitude: 77.391 },
  { id: 7, house: "EV Station 1", area: "India Gate", zone: "EV Charging Zone", type: "EV Station", latitude: 28.6129, longitude: 77.2295 },
  { id: 8, house: "Factory Grid 1", area: "Okhla Industrial Area", zone: "Industrial", type: "Industrial Load", latitude: 28.5358, longitude: 77.2716 },
  { id: 9, house: "Metro Hub 1", area: "Rajiv Chowk", zone: "Transport", type: "Public Infrastructure", latitude: 28.6328, longitude: 77.2197 },
  { id: 10, house: "Hospital Grid 1", area: "AIIMS Delhi", zone: "Critical Infrastructure", type: "Hospital", latitude: 28.5672, longitude: 77.21 }
];

function random(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function weatherMultiplier(weather) {
  if (weather === "Sunny") return 1.25;
  if (weather === "Cloudy") return 0.8;
  if (weather === "Rainy") return 0.55;
  return 1;
}

app.get("/", (req, res) => {
  res.send("OpenGreenGrid Backend Running");
});

app.get("/energy", (req, res) => {
  const weather = req.query.weather || "Sunny";
  const gridLoad = Number(req.query.gridLoad || 72);
  const multiplier = weatherMultiplier(weather);

  const homes = cityAssets.map((asset) => {
    let generatedPower = random(1, 9);
    let consumedPower = random(2, 8);

    if (asset.type === "Solar Farm") {
      generatedPower = random(14, 24) * multiplier;
      consumedPower = random(1, 3);
    }

    if (asset.type === "EV Station") {
      generatedPower = random(1, 5);
      consumedPower = random(9, 17);
    }

    if (asset.type === "Industrial Load") {
      generatedPower = random(2, 7);
      consumedPower = random(12, 22);
    }

    if (asset.type === "Hospital") {
      generatedPower = random(2, 6);
      consumedPower = random(10, 18);
    }

    generatedPower = Number(generatedPower.toFixed(2));
    consumedPower = Number(consumedPower.toFixed(2));

    const batteryLevel = asset.type === "Solar Farm" ? 100 : Math.floor(Math.random() * 100);

    let status = "STORING ENERGY";

    if (asset.type === "Solar Farm" || (generatedPower > consumedPower && batteryLevel > 50)) {
      status = "SELLING ENERGY";
    }

    if (
      asset.type === "EV Station" ||
      asset.type === "Industrial Load" ||
      asset.type === "Hospital" ||
      batteryLevel < 25 ||
      consumedPower > generatedPower
    ) {
      status = "BUYING ENERGY";
    }

    return {
      ...asset,
      generatedPower,
      consumedPower,
      netEnergy: Number((generatedPower - consumedPower).toFixed(2)),
      batteryLevel,
      carbonSaved: Number((generatedPower * 0.7).toFixed(2)),
      efficiencyScore: Math.min(100, Math.max(10, Math.floor((generatedPower / Math.max(consumedPower, 1)) * 70))),
      status
    };
  });

  const sellers = homes.filter((home) => home.status === "SELLING ENERGY");
  const buyers = homes.filter((home) => home.status === "BUYING ENERGY");

  const totalGenerated = Number(homes.reduce((sum, home) => sum + home.generatedPower, 0).toFixed(2));
  const totalConsumed = Number(homes.reduce((sum, home) => sum + home.consumedPower, 0).toFixed(2));
  const renewablePercentage = totalConsumed > 0 ? Number(((totalGenerated / totalConsumed) * 100).toFixed(1)) : 0;

  let energyPrice = 6;
  if (buyers.length > sellers.length) energyPrice += 2.5;
  if (sellers.length > buyers.length) energyPrice -= 1;
  if (gridLoad > 80) energyPrice += 3;
  if (renewablePercentage > 100) energyPrice -= 0.75;
  energyPrice = Number(Math.max(3, energyPrice).toFixed(2));

  const trades = [];

  buyers.forEach((buyer, index) => {
    const seller = sellers[index % sellers.length];
    if (!seller) return;

    const surplus = Math.max(seller.generatedPower - seller.consumedPower, 0);
    const required = Math.max(buyer.consumedPower - buyer.generatedPower, 0);
    const energy = Number(Math.min(surplus, required).toFixed(2));

    if (energy <= 0) return;

    trades.push({
      id: `TX-${Date.now()}-${index + 1}`,
      from: seller.house,
      fromArea: seller.area,
      fromLatitude: seller.latitude,
      fromLongitude: seller.longitude,
      to: buyer.house,
      toArea: buyer.area,
      toLatitude: buyer.latitude,
      toLongitude: buyer.longitude,
      energy,
      price: energyPrice,
      totalCost: Number((energy * energyPrice).toFixed(2)),
      transactionHash: Math.random().toString(16).slice(2, 14).toUpperCase(),
      reason: `${seller.house} has surplus renewable energy and ${buyer.house} has high demand.`
    });
  });

  const predictions = homes.map((home) => ({
    house: home.house,
    area: home.area,
    zone: home.zone,
    prediction:
      home.consumedPower > 12
        ? "HIGH ENERGY DEMAND EXPECTED"
        : home.batteryLevel < 25
        ? "BATTERY MAY DRAIN SOON"
        : home.generatedPower > 10
        ? "EXCESS SOLAR ENERGY AVAILABLE"
        : "GRID STABLE"
  }));

  const alerts = [];

  homes.forEach((home) => {
    if (home.batteryLevel < 15) {
      alerts.push({ house: home.house, area: home.area, message: "CRITICAL BATTERY LEVEL" });
    }

    if (home.consumedPower > 14) {
      alerts.push({ house: home.house, area: home.area, message: "HIGH POWER CONSUMPTION" });
    }

    if (gridLoad > 85 && home.status === "BUYING ENERGY") {
      alerts.push({ house: home.house, area: home.area, message: "AI LOAD BALANCING REQUIRED" });
    }
  });

  const blackoutPrevented = gridLoad > 85 && sellers.length > 0 && trades.length > 0;

  res.json({
    weather,
    gridLoad,
    homes,
    trades,
    predictions,
    alerts,
    cityImpact: {
      carbonSaved: Number(homes.reduce((sum, home) => sum + home.carbonSaved, 0).toFixed(2)),
      renewablePercentage,
      energyPrice,
      activeSellers: sellers.length,
      activeBuyers: buyers.length,
      blackoutPrevented
    },
    grid: {
      totalGenerated,
      totalConsumed,
      gridStatus: blackoutPrevented
        ? "AI PREVENTED OVERLOAD"
        : totalGenerated > totalConsumed
        ? "GRID OPERATING EFFICIENTLY"
        : "HIGH GRID LOAD DETECTED"
    }
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});
