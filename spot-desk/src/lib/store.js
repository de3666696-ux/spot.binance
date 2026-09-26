const LS_KEY = "spot-desk:fund:v3";

export function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { history: [], watchlist: [], alerts: [], chatHistory: [], capital: 100 };
    const j = JSON.parse(raw);
    return {
      history: j.history || [],
      watchlist: j.watchlist || [],
      alerts: j.alerts || [],
      chatHistory: j.chatHistory || [],
      capital: typeof j.capital === "number" && j.capital > 0 ? j.capital : 100,
    };
  } catch {
    return { history: [], watchlist: [], alerts: [], chatHistory: [], capital: 100 };
  }
}

export function saveStore(data) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        history: data.history || [],
        watchlist: data.watchlist || [],
        alerts: data.alerts || [],
        chatHistory: (data.chatHistory || []).slice(-20),
        capital: data.capital ?? 100,
      }),
    );
  } catch { /* quota */ }
}
