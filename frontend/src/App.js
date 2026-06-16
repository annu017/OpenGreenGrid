import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer
} from "react-leaflet";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

console.log("API_URL =", API_URL);

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

function getWeatherMultiplier(weather) {
  if (weather === "Sunny") return 1.25;
  if (weather === "Cloudy") return 0.8;
  if (weather === "Rainy") return 0.55;
  return 1;
}

function runEnergyDecisionEngine(homes, weather, gridLoad, backendImpact) {
  const weatherMultiplier = getWeatherMultiplier(weather);

  const analyzedHomes = homes.map((home) => {
    const adjustedGeneratedPower = Number(
      (Number(home.generatedPower || 0) * weatherMultiplier).toFixed(2)
    );
    const consumedPower = Number(home.consumedPower || 0);
    const batteryLevel = Number(home.batteryLevel || 0);
    const netEnergy = Number((adjustedGeneratedPower - consumedPower).toFixed(2));

    let aiRole = "BALANCED";
    let aiDecision = "Maintain current energy usage";

    if (netEnergy > 1.5 && batteryLevel > 50) {
      aiRole = "SELLER";
      aiDecision = "Sell surplus renewable energy to nearby buyers";
    } else if (netEnergy > 0 && batteryLevel <= 50) {
      aiRole = "STORAGE";
      aiDecision = "Store surplus energy in battery";
    } else if (netEnergy < -1) {
      aiRole = "BUYER";
      aiDecision = "Buy renewable energy from local sellers";
    }

    return {
      ...home,
      adjustedGeneratedPower,
      netEnergy,
      aiRole,
      aiDecision
    };
  });

  const sellers = analyzedHomes.filter((home) => home.aiRole === "SELLER");
  const buyers = analyzedHomes.filter((home) => home.aiRole === "BUYER");

  const totalGenerated = Number(
    analyzedHomes.reduce((sum, home) => sum + home.adjustedGeneratedPower, 0).toFixed(2)
  );

  const totalConsumed = Number(
    analyzedHomes.reduce((sum, home) => sum + Number(home.consumedPower || 0), 0).toFixed(2)
  );

  let energyPrice = 6;
  if (buyers.length > sellers.length) energyPrice += 2;
  if (sellers.length > buyers.length) energyPrice -= 1;
  if (gridLoad > 80) energyPrice += 3;

  const renewablePercentage =
    totalConsumed > 0 ? Number(((totalGenerated / totalConsumed) * 100).toFixed(1)) : 0;

  return {
    homes: analyzedHomes,
    sellers,
    buyers,
    totalGenerated,
    totalConsumed,
    renewablePercentage,
    energyPrice: backendImpact?.energyPrice || Math.max(3, energyPrice),
    carbonSaved: backendImpact?.carbonSaved || Number((totalGenerated * 0.7).toFixed(2)),
    blackoutPrevented: backendImpact?.blackoutPrevented || false,
    gridStatus:
      backendImpact?.blackoutPrevented
        ? "AI PREVENTED OVERLOAD"
        : totalGenerated >= totalConsumed
        ? "GRID OPERATING EFFICIENTLY"
        : "HIGH GRID LOAD DETECTED"
  };
}

function App() {
  const [homes, setHomes] = useState([]);
  const [trades, setTrades] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [cityImpact, setCityImpact] = useState(null);
  const [weather, setWeather] = useState("Sunny");
  const [gridLoad, setGridLoad] = useState(72);
  const [liveSimulation, setLiveSimulation] = useState(true);

  const engine = useMemo(
    () => runEnergyDecisionEngine(homes, weather, gridLoad, cityImpact),
    [homes, weather, gridLoad, cityImpact]
  );

  useEffect(() => {
    const fetchEnergy = () => {
  console.log(
    "Calling API:",
    `${API_URL}/energy?weather=${weather}&gridLoad=${gridLoad}`
  );

  fetch(`${API_URL}/energy?weather=${weather}&gridLoad=${gridLoad}`)
    .then((res) => {
      console.log("Response Status:", res.status);
      return res.json();
    })
    .then((data) => {
      console.log("API Data:", data);

      setHomes(data.homes || []);
      setTrades(data.trades || []);
      setPredictions(data.predictions || []);
      setAlerts(data.alerts || []);
      setCityImpact(data.cityImpact || null);

      setChartData((prev) => [
        ...prev.slice(-9),
        {
          time: new Date().toLocaleTimeString(),
          generated: data.grid?.totalGenerated || 0,
          consumed: data.grid?.totalConsumed || 0,
        },
      ]);
    })
    .catch((error) => {
      console.error("Energy API error:", error);
    });
};

    if (!liveSimulation && homes.length > 0) return;

    fetchEnergy();

    if (!liveSimulation) return;

    const interval = setInterval(fetchEnergy, 3000);
    return () => clearInterval(interval);
  }, [weather, gridLoad, liveSimulation, homes.length]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <style>
        {`
          .energy-flow-line {
            animation: dashFlow 1.2s linear infinite;
          }

          @keyframes dashFlow {
            to {
              stroke-dashoffset: -40;
            }
          }
        `}
      </style>

      <h1 className="text-5xl font-bold text-green-400 mb-10 text-center">
        OpenGreenGrid Autonomous Smart City
      </h1>
      <h1>TEST DEPLOY 123</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <MetricCard title="Total City Assets" value={engine.homes.length} border="border-cyan-400" text="text-cyan-300" />
        <MetricCard title="AI Energy Sellers" value={engine.sellers.length} border="border-green-400" text="text-green-300" />
        <MetricCard title="AI Energy Buyers" value={engine.buyers.length} border="border-red-400" text="text-red-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
        <div className="bg-gray-900 border border-yellow-400 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-yellow-300">Weather Impact</h2>
          <select
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            className="mt-4 w-full bg-black border border-yellow-400 p-3 rounded-xl"
          >
            <option>Sunny</option>
            <option>Cloudy</option>
            <option>Rainy</option>
          </select>
        </div>

        <div className="bg-gray-900 border border-blue-400 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-blue-300">Grid Load</h2>
          <input
            type="range"
            min="30"
            max="100"
            value={gridLoad}
            onChange={(e) => setGridLoad(Number(e.target.value))}
            className="w-full mt-5"
          />
          <p className="text-3xl font-bold mt-3">{gridLoad}%</p>
        </div>

        <div className="bg-gray-900 border border-lime-400 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-lime-300">Live Simulation</h2>
          <button
            onClick={() => setLiveSimulation((value) => !value)}
            className={`mt-4 w-full p-3 rounded-xl font-bold ${
              liveSimulation ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {liveSimulation ? "ON" : "OFF"}
          </button>
          <p className="text-sm text-gray-400 mt-3">
            {liveSimulation ? "Updates every 3 seconds" : "Paused for presentation"}
          </p>
        </div>

        <MetricCard title="Carbon Saved" value={`${engine.carbonSaved} kg`} border="border-emerald-400" text="text-emerald-300" compact />
        <MetricCard title="Energy Price" value={`₹${engine.energyPrice}/kWh`} border="border-pink-400" text="text-pink-300" compact />
      </div>

      <Section title="Smart City Energy Map" color="text-green-400">
        <div className="rounded-2xl overflow-hidden border border-green-500">
          <MapContainer
            center={[28.6139, 77.209]}
            zoom={11}
            style={{ height: "560px", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {trades.map((trade) => (
              <Polyline
                key={trade.id}
                positions={[
                  [trade.fromLatitude, trade.fromLongitude],
                  [trade.toLatitude, trade.toLongitude]
                ]}
                pathOptions={{
                  color: "#22d3ee",
                  weight: 5,
                  opacity: 0.9,
                  dashArray: "12 12",
                  className: "energy-flow-line"
                }}
              >
                <Popup>
                  <div>
                    <h3>Energy Flow</h3>
                    <p>{trade.from} to {trade.to}</p>
                    <p>{trade.energy} kWh</p>
                    <p>₹{trade.totalCost}</p>
                    <p>{trade.reason}</p>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {engine.homes.map((home) => (
              <CircleMarker
                key={home.id}
                center={[home.latitude, home.longitude]}
                radius={home.aiRole === "SELLER" ? 12 : home.aiRole === "BUYER" ? 10 : 8}
                pathOptions={{
                  color:
                    home.aiRole === "SELLER"
                      ? "#22c55e"
                      : home.aiRole === "BUYER"
                      ? "#ef4444"
                      : "#eab308",
                  fillColor:
                    home.aiRole === "SELLER"
                      ? "#22c55e"
                      : home.aiRole === "BUYER"
                      ? "#ef4444"
                      : "#eab308",
                  fillOpacity: 0.75
                }}
              >
                <Popup>
                  <div>
                    <h2>{home.house}</h2>
                    <p>Area: {home.area}</p>
                    <p>Zone: {home.zone}</p>
                    <p>Type: {home.type}</p>
                    <p>Generated: {home.adjustedGeneratedPower} kWh</p>
                    <p>Consumed: {home.consumedPower} kWh</p>
                    <p>Battery: {home.batteryLevel}%</p>
                    <p>Status: {home.status}</p>
                    <p>AI Role: {home.aiRole}</p>
                    <p>{home.aiDecision}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {engine.homes.map((home) => (
              <Marker key={`marker-${home.id}`} position={[home.latitude, home.longitude]}>
                <Popup>
                  <div>
                    <h2>{home.house}</h2>
                    <p>{home.area}</p>
                    <p>{home.aiRole}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </Section>

      <Section title="City Asset Intelligence" color="text-green-400">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {engine.homes.map((home) => (
            <div key={home.id} className="bg-gray-900 border border-green-500 rounded-2xl p-6 shadow-lg">
              <h2 className="text-2xl font-semibold text-green-300">{home.house}</h2>
              <p className="text-cyan-300 mb-4">{home.area} | {home.zone}</p>

              <Info label="Type" value={home.type} color="text-white" />
              <Info label="Generated" value={`${home.generatedPower} kWh`} color="text-green-400" />
              <Info label="Weather Adjusted" value={`${home.adjustedGeneratedPower} kWh`} color="text-cyan-400" />
              <Info label="Consumed" value={`${home.consumedPower} kWh`} color="text-yellow-400" />
              <Info label="Net Energy" value={`${home.netEnergy} kWh`} color={home.netEnergy >= 0 ? "text-green-400" : "text-red-400"} />
              <Info label="Battery" value={`${home.batteryLevel}%`} color="text-blue-400" />
              <Info label="Carbon Saved" value={`${home.carbonSaved} kg`} color="text-emerald-400" />
              <Info label="Efficiency" value={`${home.efficiencyScore}%`} color="text-pink-400" />

              <div className="p-3 rounded-xl text-center font-bold text-lg bg-gray-800 mt-4">
                {home.status}
              </div>

              <div className="mt-4 bg-black border border-cyan-500 rounded-xl p-4">
                <p className="text-cyan-300 font-bold">AI Role: {home.aiRole}</p>
                <p className="text-sm mt-2">{home.aiDecision}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Autonomous DeFi Energy Trades" color="text-cyan-400">
        {trades.length === 0 ? (
          <div className="bg-gray-900 p-4 rounded-xl text-gray-400">
            No active trades currently
          </div>
        ) : (
          trades.map((trade) => (
            <div key={trade.id} className="bg-cyan-900 border border-cyan-400 p-5 rounded-xl mb-4">
              <p className="text-xl">
                <b>{trade.from}</b> ({trade.fromArea}) sold{" "}
                <b className="text-cyan-300">{trade.energy} kWh</b> to{" "}
                <b>{trade.to}</b> ({trade.toArea})
              </p>
              <p className="text-cyan-300 mt-2">
                Price: ₹{trade.price}/kWh | Total: ₹{trade.totalCost}
              </p>
              <p className="text-sm mt-2">Blockchain Hash: {trade.transactionHash}</p>
              <p className="text-sm mt-2 text-gray-200">AI Reason: {trade.reason}</p>
            </div>
          ))
        )}
      </Section>

      <Section title="Real-Time Energy Analytics" color="text-purple-400">
        <div className="bg-gray-900 p-6 rounded-2xl border border-purple-500">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="generated" stroke="#00ff88" strokeWidth={3} />
              <Line type="monotone" dataKey="consumed" stroke="#ff4444" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Smart Grid Health" color="text-blue-400">
        <div className="bg-gray-900 border border-blue-500 rounded-2xl p-8">
          <Info label="Total Generated Energy" value={`${engine.totalGenerated} kWh`} color="text-green-400" />
          <Info label="Total Consumed Energy" value={`${engine.totalConsumed} kWh`} color="text-yellow-400" />
          <Info label="Renewable Percentage" value={`${engine.renewablePercentage}%`} color="text-emerald-400" />
          <Info label="Grid Status" value={engine.gridStatus} color="text-cyan-400" />
          {engine.blackoutPrevented && (
            <p className="text-green-400 text-xl mt-4 font-bold">
              AI rerouted surplus renewable energy and prevented overload.
            </p>
          )}
        </div>
      </Section>

      <Section title="AI Prediction Engine" color="text-orange-400">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictions.map((item, index) => (
            <div key={index} className="bg-gray-900 border border-orange-500 rounded-2xl p-6">
              <h3 className="text-2xl font-bold text-orange-300">
                {item.house} - {item.area}
              </h3>
              <p className="text-sm text-gray-300 mt-1">{item.zone}</p>
              <p className="text-lg font-semibold mt-3">{item.prediction}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Smart Grid Alerts" color="text-red-400">
        {alerts.length === 0 ? (
          <div className="bg-gray-900 p-5 rounded-xl text-gray-400">
            No critical alerts detected
          </div>
        ) : (
          alerts.map((alert, index) => (
            <div key={index} className="bg-red-900 border border-red-500 p-5 rounded-xl mb-4 animate-pulse">
              <p className="text-xl font-bold">{alert.house} - {alert.area}</p>
              <p className="text-lg mt-2">{alert.message}</p>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function MetricCard({ title, value, border, text, compact }) {
  return (
    <div className={`bg-gray-900 ${border} border rounded-2xl p-6 text-center shadow-lg`}>
      <h2 className={`text-xl font-bold ${text}`}>{title}</h2>
      <p className={`${compact ? "text-4xl" : "text-5xl"} font-bold mt-4`}>
        {value}
      </p>
    </div>
  );
}

function Info({ label, value, color }) {
  return (
    <p className="text-lg mb-2">
      {label}: <span className={`${color} font-bold`}>{value}</span>
    </p>
  );
}

function Section({ title, color, children }) {
  return (
    <div className="mt-12">
      <h2 className={`text-4xl font-bold ${color} mb-6`}>{title}</h2>
      {children}
    </div>
  );
}

export default App;