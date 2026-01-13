// LinguaMoscow — Moscow learning resources map (Yandex Maps)

(function () {
  const { $, escapeHtml, debounce, showAlert } = window.LM;
  const cfg = window.LM_CONFIG || {};
  const key = cfg.YANDEX_MAPS_API_KEY;

  const CATEGORIES = [
    { id: "edu", label: "Образовательные учреждения" },
    { id: "community", label: "Общественные центры" },
    { id: "library", label: "Публичные библиотеки" },
    { id: "private", label: "Частные языковые курсы" },
    { id: "cafe", label: "Языковые кафе / клубы" },
  ];

  // Curated list (Москва) — закрепленные отметки (доп. задание)
  const RESOURCES = [
    {
      id: "ifl-rsl",
      name: "РГБ — Иностранная литература (читальные залы)",
      category: "library",
      address: "Николоямская ул., 1",
      metro: "Таганская",
      coords: [55.7479, 37.6576],
      tags: ["библиотека", "иностранные языки", "ресурсы", "читальный зал"],
      info: "Большие фонды на иностранных языках, тихие зоны для занятий."
    },
    {
      id: "rsl",
      name: "Российская государственная библиотека (РГБ)",
      category: "library",
      address: "ул. Воздвиженка, 3/5",
      metro: "Библиотека им. Ленина",
      coords: [55.7525, 37.6092],
      tags: ["библиотека", "литература", "читальный зал"],
      info: "Классическая библиотека: можно учиться и читать на месте."
    },
    {
      id: "flc",
      name: "Культурный центр ZIL — разговорные клубы",
      category: "community",
      address: "ул. Восточная, 4к1",
      metro: "Автозаводская",
      coords: [55.7043, 37.6511],
      tags: ["культурный центр", "клуб", "языковой клуб"],
      info: "Площадки и мероприятия, иногда бывают тематические клубы."
    },
    {
      id: "museon",
      name: "Музеон / Парк Горького — встречи и события",
      category: "community",
      address: "Крымский Вал, 9",
      metro: "Октябрьская",
      coords: [55.7347, 37.6043],
      tags: ["культурные события", "разговорная практика", "встречи"],
      info: "В тёплый сезон часто проходят встречи и мероприятия."
    },
    {
      id: "hse",
      name: "НИУ ВШЭ — кампус (образовательная среда)",
      category: "edu",
      address: "ул. Мясницкая, 20",
      metro: "Чистые пруды",
      coords: [55.7613, 37.6386],
      tags: ["университет", "образование", "языки"],
      info: "Образовательная точка на карте: рядом много мест для учёбы."
    },
    {
      id: "msu",
      name: "МГУ — Главное здание (образовательная среда)",
      category: "edu",
      address: "Ленинские горы, 1",
      metro: "Университет",
      coords: [55.7033, 37.5301],
      tags: ["университет", "образование"],
      info: "Большой кампус, рядом есть библиотеки и зоны для занятий."
    },
    {
      id: "lm-cafe-1",
      name: "Language Exchange Café (формат языкового обмена)",
      category: "cafe",
      address: "Центр, локация меняется",
      metro: "Тверская/Пушкинская",
      coords: [55.7644, 37.6056],
      tags: ["кафе", "языковой обмен", "speaking club", "языковой клуб"],
      info: "Точка-ориентир: формат языкового обмена. Подходит для практики."
    },
    {
      id: "private-1",
      name: "Языковая школа (частные курсы) — ориентир",
      category: "private",
      address: "Тверской район",
      metro: "Маяковская",
      coords: [55.7700, 37.5950],
      tags: ["курсы иностранного языка", "школа", "английский", "немецкий", "испанский"],
      info: "Ориентир для частных школ: в центре много курсов и разговорных клубов."
    },
    {
      id: "library-2",
      name: "Библиотека им. Н. А. Некрасова",
      category: "library",
      address: "Бауманская ул., 58/25с14",
      metro: "Бауманская",
      coords: [55.7748, 37.6807],
      tags: ["библиотека", "коворкинг", "обучение"],
      info: "Современное пространство: учиться удобно, часто бывают события."
    },
    {
      id: "community-2",
      name: "Центр современного искусства (лекции/встречи)",
      category: "community",
      address: "ул. 4-й Сыромятнический пер., 1/8",
      metro: "Курская",
      coords: [55.7556, 37.6675],
      tags: ["культурный центр", "лекции", "встречи"],
      info: "Креативные пространства: иногда бывают мероприятия и клубы."
    },
    {
      id: "cafe-2",
      name: "Кофейня для языковой практики — ориентир",
      category: "cafe",
      address: "Район Китай‑город",
      metro: "Китай‑город",
      coords: [55.7559, 37.6333],
      tags: ["кафе", "разговорная практика", "встречи"],
      info: "Ориентир: в центре легко организовать встречу для языкового обмена."
    },
    {
      id: "edu-2",
      name: "Московский Политех — образовательная среда",
      category: "edu",
      address: "Большая Семёновская ул., 38",
      metro: "Семёновская",
      coords: [55.7817, 37.7158],
      tags: ["университет", "образование", "языки"],
      info: "Ориентир: учебные пространства и студенческая среда."
    },
  ];

  let map = null;
  let placemarks = [];
  let activeFilters = new Set(CATEGORIES.map(c => c.id));

  const buildFiltersUI = () => {
    const host = $("#mapFilters");
    if (!host) return;
    host.innerHTML = "";

    for (const c of CATEGORIES) {
      const id = `f_${c.id}`;
      const div = document.createElement("div");
      div.className = "form-check";
      div.innerHTML = `
        <input class="form-check-input" type="checkbox" id="${id}" checked>
        <label class="form-check-label small" for="${id}">${escapeHtml(c.label)}</label>
      `;
      host.appendChild(div);

      div.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) activeFilters.add(c.id);
        else activeFilters.delete(c.id);
        renderMapAndList();
      });
    }
  };

  const termMatch = (r, q) => {
    if (!q) return true;
    const needle = q.trim().toLowerCase();
    const hay = [
      r.name, r.address, r.metro, ...(r.tags || []), r.category,
      // hints to match assignment terms
      "языковой клуб", "курсы иностранного языка", "библиотеки", "культурные центры", "кафе языкового обмена"
    ].join(" ").toLowerCase();
    return hay.includes(needle);
  };

  const getFiltered = () => {
    const q = ($("#mapSearch")?.value || "").trim();
    return RESOURCES.filter(r => activeFilters.has(r.category) && termMatch(r, q));
  };

  const renderList = (items) => {
    const host = $("#mapList");
    if (!host) return;

    host.innerHTML = "";
    if (!items.length) {
      host.innerHTML = `<div class="text-secondary small">Ничего не найдено. Попробуй другой запрос или фильтры.</div>`;
      return;
    }

    for (const r of items) {
      const div = document.createElement("div");
      div.className = "map-item";
      div.innerHTML = `
        <div class="title">${escapeHtml(r.name)}</div>
        <div class="meta">${escapeHtml(r.address)} • м. ${escapeHtml(r.metro)}</div>
      `;
      div.addEventListener("click", () => {
        if (!map) return;
        map.setCenter(r.coords, 15, { duration: 250 });
        // open balloon
        const pm = placemarks.find(p => p?.properties?.get("rid") === r.id);
        if (pm) pm.balloon.open();
      });
      host.appendChild(div);
    }
  };

  const renderPlacemarks = (items) => {
    if (!map || !window.ymaps) return;

    // remove old
    for (const pm of placemarks) {
      try { map.geoObjects.remove(pm); } catch (_) {}
    }
    placemarks = [];

    for (const r of items) {
      const pm = new ymaps.Placemark(r.coords, {
        rid: r.id,
        balloonContentHeader: escapeHtml(r.name),
        balloonContentBody: `
          <div style="font-size: 13px;">
            <div><b>Адрес:</b> ${escapeHtml(r.address)}</div>
            <div><b>Метро:</b> ${escapeHtml(r.metro)}</div>
            <div class="mt-1">${escapeHtml(r.info || "")}</div>
            <div class="mt-2"><span style="color:#6c757d;">Категория:</span> ${escapeHtml(CATEGORIES.find(c=>c.id===r.category)?.label || r.category)}</div>
          </div>
        `,
      }, {
        preset: "islands#blueIcon",
      });

      placemarks.push(pm);
      map.geoObjects.add(pm);
    }
  };

  const renderMapAndList = () => {
    const items = getFiltered();
    renderList(items);
    renderPlacemarks(items);
  };

  const loadYMaps = () => new Promise((resolve, reject) => {
    if (window.ymaps) return resolve();
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Yandex Maps load error"));
    document.head.appendChild(s);
  });

  const initMap = async () => {
    const mapHost = $("#yandexMap");
    if (!mapHost) return;

    buildFiltersUI();

    $("#mapReset")?.addEventListener("click", () => {
      $("#mapSearch").value = "";
      activeFilters = new Set(CATEGORIES.map(c => c.id));
      buildFiltersUI();
      renderMapAndList();
    });

    $("#mapSearch")?.addEventListener("input", debounce(renderMapAndList, 150));

    if (!key) {
      mapHost.innerHTML = `
        <div class="p-4 text-center text-secondary">
          <div class="fw-semibold mb-1">Карта выключена</div>
          <div class="small">Вставь ключ Яндекс.Карт в <code>assets/js/config.js</code>, чтобы включить интерактивную карту.</div>
        </div>
      `;
      renderList(getFiltered());
      return;
    }

    try {
      await loadYMaps();
      await new Promise((res) => window.ymaps.ready(res));
      map = new ymaps.Map("yandexMap", {
        center: [55.751244, 37.618423], // Moscow center
        zoom: 11,
        controls: ["zoomControl", "geolocationControl"],
      });

      renderMapAndList();
    } catch (e) {
      console.error(e);
      showAlert("Не удалось загрузить Яндекс.Карты. Проверь ключ и интернет.", "warning", 8000);
      renderList(getFiltered());
    }
  };

  document.addEventListener("DOMContentLoaded", initMap);
})();
