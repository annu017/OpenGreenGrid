export function runEnergyDecisionEngine(homes, weather, gridLoad) {
  const weatherMultiplier = getWeatherMultiplier(weather);

  const analyzedHomes = homes.map((home) => {
    const generated = Number(home.generatedPower || 0) * weatherMultiplier;
    const consumed = Number(home.consumedPower || 0);
    const battery = Number(home.batteryLevel || 0);
    const netEnergy = generated - consumed;

    let role = "BALANCED";
    let decision = "Maintain current energy usage";

    if (netEnergy > 1.5 && battery > 60) {
      role = "SELLER";
      decision = "Sell surplus energy to nearby buyers";
    } else if (netEnergy > 0 && battery <= 60) {
      role = "STORAGE";
      decision = "Store surplus energy in home battery";
    } else if (netEnergy < -1) {
      role = "BUYER";
      decision = "Buy renewable energy from local sellers";
    }

    return {
      ...home,
      adjustedGeneratedPower: Number(generated.toFixed(2)),
      netEnergy: Number(netEnergy.toFixed(2)),
      aiRole: role,
      aiDecision: decision
    };
  });

  const sellers = analyzedHomes.filter((home) => home.aiRole === "SELLER");
  const buyers = analyzedHomes.filter((home) => home.aiRole === "BUYER");

  const energyPrice = calculateEnergyPrice(buyers.length, sellers.length, gridLoad);
  const trades = createTrades(sellers, buyers, energyPrice);

  const totalGenerated = analyzedHomes.reduce(
    (sum, home) => sum + home.adjustedGeneratedPower,
    0
  );

  const totalConsumed = analyzedHomes.reduce(
    (sum, home) => sum + Number(home.consumedPower || 0),
    0
  );

  const carbonSaved = trades.reduce(
    (sum, trade) => sum + trade.energy * 0.7,
    0
  );

  const blackoutPrevented = gridLoad > 85 && sellers.length > 0;

  return {
    homes: analyzedHomes,
    sellers,
    buyers,
    trades,
    energyPrice,
    totalGenerated: Number(totalGenerated.toFixed(2)),
    totalConsumed: Number(totalConsumed.toFixed(2)),
    carbonSaved: Number(carbonSaved.toFixed(2)),
    renewablePercentage:
      totalConsumed > 0
        ? Number(((totalGenerated / totalConsumed) * 100).toFixed(1))
        : 0,
    blackoutPrevented,
    gridStatus: blackoutPrevented
      ? "AI PREVENTED OVERLOAD"
      : totalGenerated >= totalConsumed
      ? "GRID OPERATING EFFICIENTLY"
      : "HIGH GRID LOAD DETECTED"
  };
}

function getWeatherMultiplier(weather) {
  if (weather === "Sunny") return 1.2;
  if (weather === "Cloudy") return 0.8;
  if (weather === "Rainy") return 0.55;
  return 1;
}

function calculateEnergyPrice(buyers, sellers, gridLoad) {
  let price = 6;

  if (buyers > sellers) price += 2;
  if (sellers > buyers) price -= 1;
  if (gridLoad > 80) price += 3;

  return Math.max(price, 3);
}

function createTrades(sellers, buyers, price) {
  return buyers
    .map((buyer, index) => {
      const seller = sellers[index % sellers.length];
      if (!seller) return null;

      const energy = Math.min(Math.abs(buyer.netEnergy), seller.netEnergy);

      return {
        id: `TX-${Date.now()}-${buyer.house}`,
        from: seller.house,
        to: buyer.house,
        energy: Number(energy.toFixed(2)),
        price,
        totalCost: Number((energy * price).toFixed(2)),
        hash: Math.random().toString(16).slice(2, 12).toUpperCase(),
        reason: `${seller.house} sold ${energy.toFixed(
          2
        )} kWh to ${buyer.house} because seller had surplus energy and buyer had energy shortage.`
      };
    })
    .filter(Boolean);
}