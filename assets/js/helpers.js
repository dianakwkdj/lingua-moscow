// LinguaMoscow — helpers

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const pad2 = (n) => String(n).padStart(2, "0");

  const formatDateRU = (dateStr) => {
    if (!dateStr) return "—";
    // dateStr: YYYY-MM-DD
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    return `${pad2(d)}.${pad2(m)}.${y}`;
  };

  const formatMoneyRU = (n) => {
    const v = Math.round(Number(n || 0));
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const toDateOnly = (isoOrDate) => {
    // Accept ISO string or date string; return YYYY-MM-DD
    if (!isoOrDate) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const toTimeOnly = (isoOrTime) => {
    // Accept ISO string or HH:MM; return HH:MM
    if (!isoOrTime) return "";
    if (/^\d{2}:\d{2}$/.test(isoOrTime)) return isoOrTime;
    const d = new Date(isoOrTime);
    if (Number.isNaN(d.getTime())) return "";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const addWeeks = (dateStr, weeks) => addDays(dateStr, weeks * 7);

  // Holidays (fixed-date): Russia, minimal set
  const isHolidayRU = (d) => {
    // d: Date
    const mmdd = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const fixed = new Set([
      "01-01","01-02","01-03","01-04","01-05","01-06","01-07","01-08",
      "02-23",
      "03-08",
      "05-01",
      "05-09",
      "06-12",
      "11-04",
    ]);
    return fixed.has(mmdd);
  };

  const isWeekendOrHolidayMultiplier = (dateStr) => {
    if (!dateStr) return 1;
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const weekend = day === 0 || day === 6;
    return (weekend || isHolidayRU(d)) ? 1.5 : 1;
  };

  const timeToMinutes = (hhmm) => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(":").map(Number);
    return (h * 60) + (m || 0);
  };

  const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
  };

  const calcSurcharges = (timeStart) => {
    const mins = timeToMinutes(timeStart);
    const morning = (mins >= 9 * 60 && mins < 12 * 60) ? 400 : 0;
    const evening = (mins >= 18 * 60 && mins < 20 * 60) ? 1000 : 0;
    return { morning, evening };
  };

  // Base formula (from assignment): ((fee×duration×weekendFactor)+morning+evening)×persons
  const calcBaseCourseCost = ({ feePerHour, durationHours, dateStart, timeStart, persons }) => {
    const fee = Number(feePerHour || 0);
    const dur = Number(durationHours || 0);
    const p = Math.max(1, Number(persons || 1));

    const weekendFactor = isWeekendOrHolidayMultiplier(dateStart);
    const { morning, evening } = calcSurcharges(timeStart);

    const base = ((fee * dur * weekendFactor) + morning + evening) * p;
    return {
      base: Math.round(base),
      parts: {
        fee, dur, weekendFactor, morning, evening, persons: p,
      }
    };
  };

  // Options modifications (per spec 3.3.5)
  const applyOptions = ({ baseCost, persons, weeks, opts }) => {
    let total = Number(baseCost || 0);
    const breakdown = [];

    const pct = (label, factor) => {
      total = total * factor;
      breakdown.push(`${label} ×${factor}`);
    };
    const add = (label, value) => {
      total = total + value;
      breakdown.push(`${label} +${formatMoneyRU(value)}₽`);
    };

    // Discounts (automatic)
    if (opts.early_registration) pct("Ранняя регистрация", 0.9);
    if (opts.group_enrollment) pct("Группа 5+", 0.85);

    // Increases
    if (opts.intensive_course) pct("Интенсив", 1.2);
    if (opts.excursions) pct("Экскурсии", 1.25);
    if (opts.interactive) pct("Платформа", 1.5);

    // Fixed additions
    if (opts.supplementary) add("Материалы", 2000 * persons);
    if (opts.personalized) add("Индивидуальные", 1500 * Math.max(1, weeks));
    if (opts.assessment) add("Оценка", 300);

    return {
      total: Math.round(total),
      breakdown,
    };
  };

  const debounce = (fn, ms = 250) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const renderPager = ({ ul, page, pages, onPage }) => {
    ul.innerHTML = "";
    const mk = (label, p, disabled = false, active = false) => {
      const li = document.createElement("li");
      li.className = `page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}`;
      const a = document.createElement("a");
      a.className = "page-link";
      a.href = "#";
      a.textContent = label;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (!disabled) onPage(p);
      });
      li.appendChild(a);
      return li;
    };

    ul.appendChild(mk("«", Math.max(1, page - 1), page <= 1));
    // show up to 7 buttons
    const windowSize = 7;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    for (let p = start; p <= end; p++) {
      ul.appendChild(mk(String(p), p, false, p === page));
    }
    ul.appendChild(mk("»", Math.min(pages, page + 1), page >= pages));
  };

  const showAlert = (message, type = "info", timeoutMs = 5000) => {
    const host = $("#alerts");
    if (!host) return;

    const id = `a_${Math.random().toString(16).slice(2)}`;
    const div = document.createElement("div");
    div.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
    div.role = "alert";
    div.id = id;
    div.innerHTML = `
      <div>${escapeHtml(message)}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Закрыть"></button>
    `;
    host.prepend(div);

    if (timeoutMs) {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          try {
            const a = bootstrap.Alert.getOrCreateInstance(el);
            a.close();
          } catch (_) {
            el.remove();
          }
        }
      }, timeoutMs);
    }
  };

  window.LM = {
    $, $$, escapeHtml,
    pad2, formatDateRU, formatMoneyRU,
    toDateOnly, toTimeOnly, addWeeks, minutesToTime, timeToMinutes,
    isWeekendOrHolidayMultiplier, calcSurcharges, calcBaseCourseCost, applyOptions,
    debounce, renderPager, showAlert,
  };
})();
