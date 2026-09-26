/** Score + acción de compra clara (heurística con datos públicos, no garantía) */

export function scoreFundamental(coin, global, capital) {
  if (!coin) return null;
  const parts = {};
  let total = 0;

  let rankS = 4;
  if (coin.rank != null) {
    if (coin.rank <= 10) rankS = 22;
    else if (coin.rank <= 30) rankS = 18;
    else if (coin.rank <= 50) rankS = 14;
    else if (coin.rank <= 100) rankS = 10;
    else if (coin.rank <= 200) rankS = 6;
  }
  if (coin.marketCap && coin.volume24h) {
    const vr = coin.volume24h / coin.marketCap;
    if (vr > 0.08) rankS = Math.min(22, rankS + 2);
    if (vr < 0.005) rankS = Math.max(0, rankS - 4);
  }
  parts.liquidez = rankS;
  total += rankS;

  let tok = 6;
  if (coin.circulating && coin.maxSupply) {
    const r = coin.circulating / coin.maxSupply;
    if (r > 0.85) tok += 10;
    else if (r > 0.5) tok += 7;
    else if (r > 0.25) tok += 4;
    else tok += 1;
  } else if (coin.maxSupply == null && coin.circulating) {
    tok += 4;
  }
  parts.tokenomics = Math.min(18, tok);
  total += parts.tokenomics;

  let val = 4;
  const fromAth = coin.percentFromAth;
  if (fromAth != null) {
    const d = Math.abs(fromAth);
    if (d >= 40 && d <= 75) val += 8;
    else if (d >= 20 && d < 40) val += 6;
    else if (d > 85) val += 2;
    else if (d < 10) val += 3;
  }
  parts.valoracion = Math.min(14, val);
  total += parts.valoracion;

  let proj = 4;
  if (coin.description && coin.description.length > 120) proj += 4;
  if (coin.openSource) proj += 4;
  if (coin.links?.website) proj += 2;
  if (coin.links?.sourceCode) proj += 3;
  if (coin.links?.whitepaper) proj += 2;
  if (coin.hardwareWallet) proj += 2;
  if (coin.tags?.length >= 3) proj += 2;
  if (coin.team?.length >= 2) proj += 2;
  if (coin.developmentStatus && /working|mvp|on.?going/i.test(coin.developmentStatus)) proj += 2;
  parts.proyecto = Math.min(24, proj);
  total += parts.proyecto;

  let mom = 4;
  const c7 = coin.change7d;
  const c30 = coin.change30d;
  if (c7 != null && c7 > 0 && c7 < 25) mom += 3;
  if (c7 != null && c7 > 40) mom -= 2;
  if (c30 != null && c30 > -15 && c30 < 40) mom += 3;
  if (c30 != null && c30 < -50) mom -= 2;
  parts.momentum = Math.max(0, Math.min(12, mom));
  total += parts.momentum;

  let risk = 8;
  if (coin.beta != null && coin.beta > 1.4) risk -= 2;
  if (coin.rank != null && coin.rank > 150) risk -= 3;
  if (!coin.isActive) risk = 0;
  parts.riesgo = Math.max(0, risk);
  total += parts.riesgo;

  total = Math.max(0, Math.min(100, Math.round(total)));

  let label = "Débil";
  let color = "no";
  let plain =
    "Con los datos públicos disponibles, el perfil se ve frágil o incompleto frente a activos más consolidados.";
  if (total >= 72) {
    label = "Sólido";
    color = "buy";
    plain =
      "Perfil sólido en datos públicos: liquidez, visibilidad e información del proyecto por encima de la media.";
  } else if (total >= 58) {
    label = "Aceptable";
    color = "scale";
    plain =
      "Señales mixtas. Conviene contrastar rank, supply y contexto de mercado antes de decidir.";
  } else if (total >= 45) {
    label = "Mixto";
    color = "wait";
    plain = "Señales mezcladas. Revisa descripción, rank y comparación con referencias.";
  }

  const bullets = [];
  if (coin.rank != null && coin.rank <= 20)
    bullets.push("Alta capitalización relativa: mejor profundidad de mercado.");
  if (coin.rank != null && coin.rank > 100)
    bullets.push("Capitalización más baja: suele implicar mayor volatilidad.");
  if (coin.percentFromAth != null && Math.abs(coin.percentFromAth) > 50)
    bullets.push("Lejos del máximo histórico: puede ser oportunidad o deterioro.");
  if (coin.openSource) bullets.push("Código abierto declarado.");
  if (!coin.links?.website) bullets.push("Sin web oficial en los metadatos.");
  if (global?.btcDominance != null && global.btcDominance > 55)
    bullets.push("Dominancia BTC alta: las alts suelen quedar más flojas.");
  if (coin.change24h != null && Math.abs(coin.change24h) > 15)
    bullets.push("Movimiento fuerte en 24h: volatilidad elevada.");

  const action = buildBuyAction(coin, global, total, parts);
  const size = suggestSize(capital, action.action);
  if (size.note) action.reasons = [...(action.reasons || []), size.note];
  action.size = size;
  return { total, label, color, plain, bullets, parts, action };
}


/**
 * Acción clara: COMPRAR | ESPERAR | NO COMPRAR
 * Basada en score + timing de mercado (no predicción garantizada).
 */
export function buildBuyAction(coin, global, total, parts) {
  const reasons = [];
  let action = "ESPERAR";
  let tone = "wait"; // buy | wait | no
  let headline = "Esperar";
  let detail =
    "El perfil no es lo bastante claro o el momento de mercado no favorece entrar ya.";

  const rank = coin?.rank;
  const ch24 = coin?.change24h;
  const ch7 = coin?.change7d;
  const fromAth = coin?.percentFromAth != null ? Math.abs(coin.percentFromAth) : null;
  const dom = global?.btcDominance;
  const isBtc = (coin?.symbol || "").toUpperCase() === "BTC";
  const isEth = (coin?.symbol || "").toUpperCase() === "ETH";
  const big = rank != null && rank <= 20;

  // Hard no
  if (!coin?.isActive) {
    return {
      action: "NO COMPRAR",
      tone: "no",
      headline: "No comprar",
      detail: "El activo no aparece activo en los datos.",
      reasons: ["Marcado como inactivo."],
    };
  }
  if (rank != null && rank > 200) {
    reasons.push("Rank muy bajo (#" + rank + "): más riesgo y menos liquidez.");
  }
  if (total < 45) {
    action = "NO COMPRAR";
    tone = "no";
    headline = "No comprar";
    detail =
      "El score fundamental es débil. Mejor no entrar hasta que el proyecto se vea más claro.";
    reasons.push("Score " + total + "/100 por debajo del umbral útil.");
    if (rank != null && rank > 100) reasons.push("Proyecto relativamente pequeño.");
    return { action, tone, headline, detail, reasons };
  }

  // Overextended short term
  if (ch24 != null && ch24 > 20) {
    action = "ESPERAR";
    tone = "wait";
    headline = "Esperar (muy caliente hoy)";
    detail =
      "Subió mucho en 24h. Entrar ahora suele ser peor momento; espera un retroceso o consolidación.";
    reasons.push("Cambio 24h: +" + Number(ch24).toFixed(1) + "%.");
    if (total >= 72) reasons.push("El proyecto puede ser sólido, pero el timing no.");
    return { action, tone, headline, detail, reasons };
  }

  // Strong profile + reasonable timing (top assets a bit más flexibles)
  const strongEnough = total >= 72 || (total >= 68 && (isBtc || isEth || (rank != null && rank <= 10)));
  if (strongEnough && (big || isBtc || isEth)) {
    if (ch7 != null && ch7 < -12) {
      action = "COMPRAR";
      tone = "buy";
      headline = "Comprar (zona más interesante)";
      detail =
        "Proyecto sólido y la última semana corrigió. Puede ser mejor momento relativo que comprar en euforia.";
      reasons.push("Score " + total + "/100.");
      reasons.push("7d: " + Number(ch7).toFixed(1) + "% (corrección reciente).");
      if (fromAth != null && fromAth > 25)
        reasons.push("No está en máximos absolutos (desde ATH ~" + fromAth.toFixed(0) + "%).");
    } else if (ch24 != null && ch24 < -5 && ch24 > -18) {
      action = "COMPRAR";
      tone = "buy";
      headline = "Comprar (con calma)";
      detail =
        "Buen perfil y el precio aflojó un poco en el día. Entrada razonable si tu plan es a medio plazo.";
      reasons.push("Score " + total + "/100 · rank #" + (rank ?? "—") + ".");
      reasons.push("24h: " + Number(ch24).toFixed(1) + "%.");
    } else if (fromAth != null && fromAth >= 30 && fromAth <= 70 && (ch7 == null || ch7 < 15)) {
      action = "COMPRAR";
      tone = "buy";
      headline = "Comprar (posible)";
      detail =
        "Perfil sólido y lejos del ATH sin estar en colapso extremo. Condiciones aceptables para una entrada fraccionada.";
      reasons.push("Score " + total + "/100.");
      reasons.push("Distancia al ATH ~" + fromAth.toFixed(0) + "%.");
    } else {
      action = "ESPERAR";
      tone = "wait";
      headline = "Esperar (proyecto bien, timing regular)";
      detail =
        "El activo se ve sólido, pero el momento no es el más cómodo (sin corrección clara o cerca de zona caliente).";
      reasons.push("Score alto (" + total + "), pero sin señal de mejor entrada reciente.");
      if (ch7 != null && ch7 > 15)
        reasons.push("7d fuerte (+" + Number(ch7).toFixed(1) + "%): mejor no perseguir.");
    }
  } else if (total >= 58 && total < 72) {
    action = "ESPERAR";
    tone = "wait";
    headline = "Esperar";
    detail =
      "No es un no rotundo, pero tampoco un sí claro. Reduce tamaño o espera más confirmación del proyecto/mercado.";
    reasons.push("Score intermedio " + total + "/100.");
    if (!big) reasons.push("No está entre los ranks más líquidos.");
  } else if (total >= 45 && total < 58) {
    action = "ESPERAR";
    tone = "wait";
    headline = "Esperar (o evitar si eres conservador)";
    detail = "Datos mixtos. Si no conoces bien el proyecto, mejor no comprar aún.";
    reasons.push("Score " + total + "/100.");
  }

  // Alt + high BTC dominance penalty
  if (!isBtc && dom != null && dom > 56 && action === "COMPRAR") {
    action = "ESPERAR";
    tone = "wait";
    headline = "Esperar (BTC manda el mercado)";
    detail =
      "Aunque el proyecto se ve aceptable, con dominancia BTC alta las alts suelen sufrir más. Prioriza paciencia.";
    reasons.push("Dominancia BTC ~" + Number(dom).toFixed(1) + "%.");
  }

  if (!reasons.length) {
    reasons.push("Evaluación con score " + total + "/100 y datos de mercado disponibles.");
  }

  return { action, tone, headline, detail, reasons };
}

/** Sugerencia de tamaño según capital y acción (orientativa) */
export function suggestSize(capital, action) {
  const cap = Number(capital) || 0;
  if (cap < 5) return { pct: 0, usd: 0, note: "Pon un capital mínimo de unos $5–10 para operar con sentido." };
  if (action === "NO COMPRAR") return { pct: 0, usd: 0, note: "No se sugiere tamaño: la lectura es no comprar." };
  if (action === "ESPERAR") return { pct: 0, usd: 0, note: "Espera: no hace falta asignar capital todavía." };
  // COMPRAR: 5–10% del capital, tope suave
  let pct = cap < 50 ? 10 : cap < 200 ? 8 : 5;
  let usd = Math.round((cap * pct) / 100 * 100) / 100;
  usd = Math.max(5, Math.min(usd, cap * 0.15));
  return {
    pct,
    usd,
    note: `Si decides entrar, una idea orientativa es ~${pct}% del capital (~$${usd}), no todo de golpe.`,
  };
}


export function beginnerPicks(scan) {
  if (!scan?.length) return [];
  const want = ["BTC", "ETH", "SOL", "BNB", "XRP"];
  const out = [];
  for (const s of want) {
    const hit = scan.find((x) => x.symbol === s);
    if (hit) out.push(hit);
  }
  return out;
}

export function topMovers(scan) {
  if (!scan?.length) return { up: [], down: [] };
  const sorted = [...scan].sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
  return {
    up: sorted.filter((x) => (x.change24h || 0) > 0).slice(0, 5),
    down: sorted.filter((x) => (x.change24h || 0) < 0).slice(-5).reverse(),
  };
}
