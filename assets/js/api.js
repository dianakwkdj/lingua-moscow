// LinguaMoscow — API wrapper

(function () {
  const { showAlert } = window.LM;

  const cfg = window.LM_CONFIG || {};
  const apiKey = cfg.API_KEY;
  const bases = cfg.API_BASE_URLS || [];

  const withApiKey = (url) => {
    const u = new URL(url);
    u.searchParams.set("api_key", apiKey);
    return u.toString();
  };

  const normalizePath = (path) => {
    if (!path.startsWith("/")) path = "/" + path;
    return path;
  };

  const tryFetch = async (path, options) => {
    const errors = [];

    for (const base of bases) {
      const url = withApiKey(base.replace(/\/$/, "") + normalizePath(path));
      try {
        const res = await fetch(url, options);
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

        if (!res.ok) {
          const msg = (data && data.error) ? data.error : `Ошибка API: ${res.status}`;
          throw new Error(msg);
        }
        return data;
      } catch (err) {
        errors.push({ base, err: String(err?.message || err) });
        // continue
      }
    }

    const hint = (location.protocol === "https:" && (bases || []).some(b => b.startsWith("http://")))
      ? "Похоже, браузер блокирует http-запросы со страницы https (mixed content). Если https у API не работает — открой проект через локальный http-сервер."
      : "Проверь интернет и правильность API Key.";

    console.error("API errors:", errors);
    showAlert(`Не удалось связаться с API. ${hint}`, "danger", 9000);
    throw new Error("API unavailable");
  };

  const jsonOptions = (method, body) => ({
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const api = {
    get: (path) => tryFetch(path, { method: "GET" }),
    post: (path, body) => tryFetch(path, jsonOptions("POST", body)),
    put: (path, body) => tryFetch(path, jsonOptions("PUT", body)),
    del: (path) => tryFetch(path, { method: "DELETE" }),
  };

  window.LM_API = api;
})();
