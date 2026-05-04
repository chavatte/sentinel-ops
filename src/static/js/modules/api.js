export const api = {
  getStatus: async () => {
    const r = await fetch("/api/status?ts=" + Date.now());
    if (!r.ok) throw new Error("API /api/status HTTP " + r.status);
    return await r.json();
  },
  run: async () => {
    const r = await fetch("/api/run", { method: "POST" });
    if (!r.ok) throw new Error("API /api/run HTTP " + r.status);
    return await r.json();
  },
  getMetrics: async () => {
    const r = await fetch("/api/metrics");
    if (!r.ok) throw new Error("Erro nas métricas");
    return await r.json();
  },
  getRepos: async () => {
    const r = await fetch("/api/repos");
    return await r.json();
  },
  addRepo: async (payload) => {
    await fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  deleteRepo: async (id) => {
    await fetch(`/api/repos?id=${id}`, { method: "DELETE" });
  },
  toggleRepo: async (id) => {
    await fetch("/api/repos/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  },
  checkUpdate: async () => {
    try {
      const r = await fetch("/api/update");
      if (r.ok) return await r.json();
    } catch (e) {
      return null;
    }
  },
};
