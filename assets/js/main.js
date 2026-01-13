// LinguaMoscow — main page logic (courses + tutors + create order)

(function () {
  const {
    $, $$, escapeHtml, formatMoneyRU, formatDateRU, toDateOnly, toTimeOnly,
    addWeeks, minutesToTime, timeToMinutes,
    calcBaseCourseCost, applyOptions, renderPager, showAlert, debounce
  } = window.LM;

  const API = window.LM_API;

  const state = {
    courses: [],
    tutors: [],
    coursePage: 1,
    courseFiltered: [],
    selectedCourse: null,
    selectedTutor: null,
    selectedTutorKey: null,
  };

  const setYear = () => {
    const y = new Date().getFullYear();
    const el = $("#year");
    if (el) el.textContent = String(y);
  };

  const badgeLevel = (level) => {
    const t = String(level || "").toLowerCase();
    if (t.includes("нач")) return `<span class="badge badge-soft">Начальный</span>`;
    if (t.includes("сред")) return `<span class="badge text-bg-warning-subtle border">Средний</span>`;
    if (t.includes("прод")) return `<span class="badge text-bg-success-subtle border">Продвинутый</span>`;
    return `<span class="badge text-bg-light border">${escapeHtml(level || "—")}</span>`;
  };

  const tutorKey = (t) => String(
    (t && (t.id ?? t.tutor_id ?? t.uuid ?? t._id ?? t.email ?? t.name ?? "")) || ""
  );



  const uniq = (arr) => Array.from(new Set(arr));

  const buildCourseDateMap = (course) => {
    const map = new Map(); // date -> [time1,time2]
    (course.start_dates || []).forEach((dt) => {
      const date = toDateOnly(dt);
      const time = toTimeOnly(dt);
      if (!date || !time) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(time);
    });
    for (const [k, v] of map.entries()) {
      map.set(k, uniq(v).sort());
    }
    return map;
  };

  const renderCourses = () => {
    const grid = $("#coursesGrid");
    const pager = $("#coursesPager");
    const meta = $("#coursesMeta");
    if (!grid || !pager || !meta) return;

    const pageSize = window.LM_CONFIG?.PAGE_SIZE || 5;
    const items = state.courseFiltered;
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    state.coursePage = Math.min(state.coursePage, pages);

    const slice = items.slice((state.coursePage - 1) * pageSize, state.coursePage * pageSize);

    grid.innerHTML = "";
    if (!items.length) {
      grid.innerHTML = `<div class="col-12"><div class="alert alert-warning mb-0">По фильтрам ничего не нашлось.</div></div>`;
    } else {
      for (const c of slice) {
        const dateMap = buildCourseDateMap(c);
        const dates = Array.from(dateMap.keys()).sort();
        const next = dates[0] ? formatDateRU(dates[0]) : "—";

        const card = document.createElement("div");
        card.className = "col-12 col-md-6 col-xl-4";
        card.innerHTML = `
          <div class="card card-course h-100 border-0 shadow-sm rounded-4">
            <div class="card-body">
              <div class="d-flex align-items-start justify-content-between gap-2">
                <div>
                  <h3 class="h6 mb-1">${escapeHtml(c.name)}</h3>
                  <div class="text-secondary small">${escapeHtml(c.teacher)}</div>
                </div>
                ${badgeLevel(c.level)}
              </div>

              <p class="mt-3 mb-3 text-secondary small course-desc">
                ${escapeHtml(c.description || "Описание отсутствует.")}
              </p>

              <div class="d-flex flex-wrap gap-2 small">
                <span class="badge text-bg-light border">Старт: ${next}</span>
                <span class="badge text-bg-light border">${escapeHtml(c.total_length)} нед.</span>
                <span class="badge text-bg-light border">${escapeHtml(c.week_length)} ч/нед</span>
              </div>

              <div class="mt-3 d-flex align-items-center justify-content-between">
                <div>
                  <div class="text-secondary small">Цена/час</div>
                  <div class="fw-semibold">${formatMoneyRU(c.course_fee_per_hour)} ₽</div>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline-secondary btn-sm btnDetails">Подробнее</button>
                  <button class="btn btn-primary btn-sm btnOrder">Подать заявку</button>
                </div>
              </div>

              <div class="collapse mt-3" id="course_${c.id}">
                <div class="p-3 bg-body-tertiary border rounded-3 small">
                  <div><b>Уровень:</b> ${escapeHtml(c.level)}</div>
                  <div><b>Длительность:</b> ${escapeHtml(c.total_length)} недель</div>
                  <div><b>Нагрузка:</b> ${escapeHtml(c.week_length)} часов/нед</div>
                  <div class="mt-2 text-secondary">Доступные старты: ${dates.length ? dates.map(formatDateRU).join(", ") : "—"}</div>
                </div>
              </div>
            </div>
          </div>
        `;

        card.querySelector(".btnDetails").addEventListener("click", () => {
          const el = card.querySelector(`#course_${c.id}`);
          const bs = bootstrap.Collapse.getOrCreateInstance(el, { toggle: true });
          bs.toggle();
        });

        card.querySelector(".btnOrder").addEventListener("click", () => openOrderForCourse(c));

        grid.appendChild(card);
      }
    }

    meta.textContent = `Показано ${slice.length} из ${items.length}. Страница ${state.coursePage} из ${pages}.`;
    renderPager({
      ul: pager,
      page: state.coursePage,
      pages,
      onPage: (p) => {
        state.coursePage = p;
        renderCourses();
        grid.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
  };

  const applyCourseFilters = () => {
    const q = ($("#courseSearch")?.value || "").trim().toLowerCase();
    const level = ($("#courseLevel")?.value || "").trim().toLowerCase();

    state.courseFiltered = state.courses.filter(c => {
      const okQ = !q || String(c.name || "").toLowerCase().includes(q);
      const okL = !level || String(c.level || "").toLowerCase().includes(level);
      return okQ && okL;
    });
    state.coursePage = 1;
    renderCourses();
  };

  const fillTutorFilters = () => {
    const langSel = $("#tutorLanguage");
    const lvlSel = $("#tutorLevel");
    if (!langSel || !lvlSel) return;

    const langs = uniq(state.tutors.flatMap(t => t.languages_offered || [])).sort();
    langSel.innerHTML = `<option value="">Любой язык</option>` + langs.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

    const lvls = uniq(state.tutors.map(t => t.language_level).filter(Boolean)).sort();
    lvlSel.innerHTML = `<option value="">Любой уровень</option>` + lvls.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");
  };

  const renderTutors = () => {
    const tbody = $("#tutorsTbody");
    const meta = $("#tutorsMeta");
    if (!tbody || !meta) return;

    const lang = ($("#tutorLanguage")?.value || "").trim().toLowerCase();
    const lvl = ($("#tutorLevel")?.value || "").trim().toLowerCase();
    const expMin = Number($("#tutorExperience")?.value || 0);

    const filtered = state.tutors.filter(t => {
      const okLang = !lang || (t.languages_offered || []).some(x => String(x).toLowerCase() === lang);
      const okLvl = !lvl || String(t.language_level || "").toLowerCase().includes(lvl);
      const okExp = !expMin || Number(t.work_experience || 0) >= expMin;
      return okLang && okLvl && okExp;
    });

    tbody.innerHTML = "";
    for (const t of filtered) {
      const tr = document.createElement("tr");
      tr.className = "tutor-row";
      if (state.selectedTutorKey && tutorKey(t) === state.selectedTutorKey) tr.classList.add("selected");

      tr.innerHTML = `
        <td><img class="avatar" src="./assets/img/avatar.svg" alt="avatar"></td>
        <td class="fw-semibold">${escapeHtml(t.name)}</td>
        <td>${escapeHtml(t.language_level)}</td>
        <td class="text-secondary small">${escapeHtml((t.languages_spoken || []).join(", ") || "—")}</td>
        <td>${escapeHtml(t.work_experience)} лет</td>
        <td>${formatMoneyRU(t.price_per_hour)} ₽/ч</td>
        <td class="text-end">
          ${state.selectedTutorKey && tutorKey(t) === state.selectedTutorKey ? `<button class="btn btn-success btn-sm me-2 btnPick">Выбран</button>` : `<button class="btn btn-outline-secondary btn-sm me-2 btnPick">Выбрать</button>`}
          <button class="btn btn-primary btn-sm btnOrder">Подать заявку</button>
        </td>
      `;

      const pick = () => {
        state.selectedTutor = t;
        state.selectedTutorKey = tutorKey(t);
        // rerender to highlight
        renderTutors();
      };

      tr.addEventListener("click", (e) => {
        // ignore if clicking buttons
        if ((e.target.closest("button"))) return;
        pick();
      });

      tr.querySelector(".btnPick").addEventListener("click", (e) => {
        e.stopPropagation();
        pick();
        showAlert(`Выбран репетитор: ${t.name}`, "success", 2500);
      });

      tr.querySelector(".btnOrder").addEventListener("click", (e) => {
        e.stopPropagation();
        pick();
        openOrderForTutor(t);
      });

      tbody.appendChild(tr);
    }

    meta.innerHTML = `Найдено репетиторов: ${filtered.length}.` + (state.selectedTutor ? ` <span class="ms-2">Выбран: <strong>${escapeHtml(state.selectedTutor.name)}</strong></span>` : "");
  };

  // --- Order modal logic ---
  let orderModal = null;

  const modalEls = () => ({
    type: $("#orderType"),
    courseId: $("#orderCourseId"),
    tutorId: $("#orderTutorId"),
    hint: $("#orderModalHint"),
    title: $("#orderTitle"),
    date: $("#orderDate"),
    dateHelp: $("#orderDateHelp"),
    time: $("#orderTime"),
    timeHelp: $("#orderTimeHelp"),
    duration: $("#orderDuration"),
    durationHelp: $("#orderDurationHelp"),
    persons: $("#orderPersons"),
    price: $("#orderPrice"),
    breakdown: $("#priceBreakdown"),
    submit: $("#orderSubmit"),
    // opts
    supplementary: $("#optSupplementary"),
    personalized: $("#optPersonalized"),
    excursions: $("#optExcursions"),
    assessment: $("#optAssessment"),
    interactive: $("#optInteractive"),
    early: $("#optEarly"),
    group: $("#optGroup"),
    intensive: $("#optIntensive"),
    autoBadges: $("#autoBadges"),
  });

  const getOptsFromModal = () => {
    const m = modalEls();
    return {
      early_registration: !!m.early.checked,
      group_enrollment: !!m.group.checked,
      intensive_course: !!m.intensive.checked,
      supplementary: !!m.supplementary.checked,
      personalized: !!m.personalized.checked,
      excursions: !!m.excursions.checked,
      assessment: !!m.assessment.checked,
      interactive: !!m.interactive.checked,
    };
  };

  const setAutoBadges = (badges) => {
    const el = $("#autoBadges");
    if (!el) return;
    el.innerHTML = badges.map(b => `<span class="badge text-bg-light border me-1">${escapeHtml(b)}</span>`).join("");
  };

  const updateAutoOptions = (context) => {
    const m = modalEls();
    const date = m.date.value;
    const persons = Number(m.persons.value || 1);

    // early registration: date >= today + 30 days
    const today = new Date();
    const in30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    const start = date ? new Date(date) : null;
    const early = !!(start && start.getTime() >= in30.getTime());

    // group: persons >= 5
    const group = persons >= 5;

    // intensive: course week_length >= 5 OR tutor duration >= 5
    let intensive = false;
    if (context.kind === "course") intensive = Number(context.course.week_length || 0) >= 5;
    if (context.kind === "tutor") intensive = Number(m.duration.value || 0) >= 5;

    m.early.checked = early;
    m.group.checked = group;
    m.intensive.checked = intensive;

    const badges = [];
    if (early) badges.push("Сработала скидка -10%");
    if (group) badges.push("Сработала скидка -15%");
    if (intensive) badges.push("Интенсив +20%");
    setAutoBadges(badges);
  };

  const computeAndRenderPrice = (context) => {
    const m = modalEls();

    const dateStart = m.date.value;
    const timeStart = m.time.value;
    const persons = Number(m.persons.value || 1);
    const durationHours = Number(m.duration.value || 0);

    const feePerHour = context.kind === "course"
      ? Number(context.course.course_fee_per_hour || 0)
      : Number(context.tutor.price_per_hour || 0);

    const weeks = context.kind === "course"
      ? Number(context.course.total_length || 1)
      : Math.max(1, Math.ceil(durationHours / 4)); // heuristic for tutor

    // base formula
    const baseRes = calcBaseCourseCost({ feePerHour, durationHours, dateStart, timeStart, persons });

    const opts = getOptsFromModal();
    const optRes = applyOptions({ baseCost: baseRes.base, persons, weeks, opts });

    m.price.textContent = formatMoneyRU(optRes.total);

    const parts = baseRes.parts;
    const breakdown = [
      `База: ((${formatMoneyRU(parts.fee)}×${parts.dur}×${parts.weekendFactor}) + ${parts.morning} + ${parts.evening}) × ${parts.persons}`,
      ...(optRes.breakdown.length ? [`Опции: ${optRes.breakdown.join(", ")}`] : []),
    ].join(" • ");

    m.breakdown.textContent = breakdown;

    return { total: optRes.total, base: baseRes.base, opts, weeks };
  };

  const setupTimeControl = (context) => {
    const m = modalEls();

    const enable = (yes) => {
      m.time.disabled = !yes;
    };

    m.time.innerHTML = "";
    m.timeHelp.textContent = "";

    if (context.kind === "course") {
      const dateMap = buildCourseDateMap(context.course);
      const chosen = m.date.value;
      const times = dateMap.get(chosen) || [];

      if (!chosen) {
        enable(false);
        m.time.innerHTML = `<option value="">Сначала выбери дату</option>`;
        return;
      }

      if (!times.length) {
        enable(false);
        m.time.innerHTML = `<option value="">Нет доступных времён</option>`;
        return;
      }

      enable(true);
      m.time.innerHTML = `<option value="">Выбери время</option>` + times.map((t) => {
        const end = minutesToTime(timeToMinutes(t) + Number(context.course.week_length || 0) * 60);
        return `<option value="${escapeHtml(t)}">${escapeHtml(t)}–${escapeHtml(end)}</option>`;
      }).join("");

      m.timeHelp.textContent = "В заявке отправляется только время начала.";
      return;
    }

    // tutor: generate time slots 09:00..20:00 every 30 min
    if (context.kind === "tutor") {
      if (!m.date.value) {
        enable(false);
        m.time.innerHTML = `<option value="">Сначала выбери дату</option>`;
        return;
      }

      const times = [];
      for (let mins = 9 * 60; mins <= 20 * 60; mins += 30) times.push(minutesToTime(mins));

      enable(true);
      m.time.innerHTML = `<option value="">Выбери время</option>` + times.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
      m.timeHelp.textContent = "Выбери старт. Конец рассчитаем по продолжительности.";
    }
  };

  const configureModalForCourse = (course) => {
    const m = modalEls();
    m.type.value = "course";
    m.courseId.value = course.id;
    m.tutorId.value = "";
    m.hint.textContent = `Курс: ${course.name}`;
    m.title.value = `${course.name} — ${course.teacher}`;

    // Date restrictions (from API start_dates)
    const dateMap = buildCourseDateMap(course);
    const dates = Array.from(dateMap.keys()).sort();
    m.date.value = "";
    m.date.min = dates[0] || "";
    m.date.max = dates[dates.length - 1] || "";
    m.dateHelp.textContent = dates.length ? `Доступные даты из API: ${dates.map(formatDateRU).join(", ")}` : "Дат старта нет.";

    // Duration in hours is total_length * week_length
    const dur = Number(course.total_length || 0) * Number(course.week_length || 0);
    m.duration.value = String(dur || "");
    m.duration.disabled = true;

    // persons reset
    m.persons.value = "1";

    // options reset
    m.supplementary.checked = false;
    m.personalized.checked = false;
    m.excursions.checked = false;
    m.assessment.checked = false;
    m.interactive.checked = false;

    m.durationHelp.textContent = `Курс: ${course.total_length} нед. (${dur} часов суммарно). Дата окончания появится после выбора даты.`;

    // setup time control
    setupTimeControl({ kind: "course", course });

    updateAutoOptions({ kind: "course", course });
    m.price.textContent = "—";
    m.breakdown.textContent = "";
  };

  const configureModalForTutor = (tutor) => {
    const m = modalEls();
    m.type.value = "tutor";
    m.courseId.value = "";
    m.tutorId.value = tutor.id;
    m.hint.textContent = `Репетитор: ${tutor.name}`;
    m.title.value = `${tutor.name} — ${tutor.language_level}`;

    m.date.value = "";
    m.date.min = toDateOnly(new Date().toISOString());
    m.date.max = toDateOnly(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
    m.dateHelp.textContent = "Для репетитора можно выбрать любую дату (в пределах 3 месяцев).";

    m.duration.disabled = false;
    m.duration.value = "2";
    m.duration.min = "1";
    m.duration.max = "40";
    m.durationHelp.textContent = "Для репетиторов допустимо 1–40 часов (по ТЗ).";

    m.persons.value = "1";

    m.supplementary.checked = false;
    m.personalized.checked = false;
    m.excursions.checked = false;
    m.assessment.checked = false;
    m.interactive.checked = false;

    setupTimeControl({ kind: "tutor", tutor });
    updateAutoOptions({ kind: "tutor", tutor });
    m.price.textContent = "—";
    m.breakdown.textContent = "";
  };

  const wireModalEvents = () => {
    const m = modalEls();
    if (!m.submit) return;

    // recalc on changes
    const recalc = debounce((e) => {
      const kind = m.type.value;
      if (!kind) return;
      const context = kind === "course"
        ? { kind: "course", course: state.selectedCourse || state.courses.find(x => String(x.id) === String(m.courseId.value)) }
        : { kind: "tutor", tutor: state.selectedTutor || state.tutors.find(x => String(x.id) === String(m.tutorId.value)) };

      if (kind === "course" && !context.course) return;
      if (kind === "tutor" && !context.tutor) return;

      // update time dropdown ONLY when the date changes.
      // If we rebuild the <select> on every change (including time change),
      // the chosen time gets reset and it looks like "time cannot be selected".
      if (!e || e.target === m.date) {
        setupTimeControl(context);
      }

      // update end date info for course
      if (kind === "course" && m.date.value) {
        const weeks = Number(context.course.total_length || 1);
        const end = addWeeks(m.date.value, weeks - 1);
        m.durationHelp.textContent = `Курс: ${weeks} нед. (${m.duration.value} часов). Последнее занятие: ${formatDateRU(end)}.`;
      }

      updateAutoOptions(context);

      // if time not selected yet, keep price dash
      if (!m.date.value || !m.time.value || !m.duration.value) {
        m.price.textContent = "—";
        m.breakdown.textContent = "Выбери дату и время, чтобы увидеть стоимость.";
        return;
      }

      computeAndRenderPrice(context);
    }, 120);

    ["change", "input"].forEach(evt => {
      m.date.addEventListener(evt, recalc);
      m.time.addEventListener(evt, recalc);
      m.duration.addEventListener(evt, recalc);
      m.persons.addEventListener(evt, recalc);
      m.supplementary.addEventListener(evt, recalc);
      m.personalized.addEventListener(evt, recalc);
      m.excursions.addEventListener(evt, recalc);
      m.assessment.addEventListener(evt, recalc);
      m.interactive.addEventListener(evt, recalc);
    });

    m.submit.addEventListener("click", async () => {
      const kind = m.type.value;
      if (!kind) return;

      const context = kind === "course"
        ? { kind: "course", course: state.selectedCourse || state.courses.find(x => String(x.id) === String(m.courseId.value)) }
        : { kind: "tutor", tutor: state.selectedTutor || state.tutors.find(x => String(x.id) === String(m.tutorId.value)) };

      if (kind === "course" && !context.course) return showAlert("Не выбран курс.", "warning");
      if (kind === "tutor" && !context.tutor) return showAlert("Не выбран репетитор.", "warning");

      // basic validation
      if (!m.date.value || !m.time.value) return showAlert("Заполни дату и время.", "warning");

      // course: validate date is in start_dates
      if (kind === "course") {
        const dateMap = buildCourseDateMap(context.course);
        if (!dateMap.has(m.date.value)) return showAlert("Выбрана дата, которой нет в списке стартов из API.", "warning", 6000);
      }

      // duration constraints
      const dur = Number(m.duration.value || 0);
      if (kind === "tutor" && (dur < 1 || dur > 40)) return showAlert("Для репетитора продолжительность должна быть 1–40 часов.", "warning", 6000);

      const persons = Number(m.persons.value || 1);
      if (persons < 1 || persons > 20) return showAlert("Количество студентов должно быть от 1 до 20.", "warning", 6000);

      // compute price one last time
      const computed = computeAndRenderPrice(context);

      const payload = {
        tutor_id: kind === "tutor" ? Number(m.tutorId.value) : null,
        course_id: kind === "course" ? Number(m.courseId.value) : null,
        date_start: m.date.value,
        time_start: m.time.value,
        duration: Number(m.duration.value),
        persons,
        price: Number(computed.total),
        ...computed.opts,
      };

      try {
        m.submit.disabled = true;
        m.submit.textContent = "Отправляем…";
        const res = await API.post("/api/orders", payload);
        showAlert(`Заявка создана (ID: ${res?.id ?? "—"}). Смотри в личном кабинете.`, "success", 7000);
        bootstrap.Modal.getOrCreateInstance($("#orderModal")).hide();
      } catch (e) {
        showAlert(`Не удалось создать заявку: ${e.message || e}`, "danger", 8000);
      } finally {
        m.submit.disabled = false;
        m.submit.textContent = "Отправить";
      }
    });
  };

  const openOrderForCourse = (course) => {
    state.selectedCourse = course;
    const m = modalEls();
    configureModalForCourse(course);
    orderModal = bootstrap.Modal.getOrCreateInstance($("#orderModal"));
    orderModal.show();
  };

  const openOrderForTutor = (tutor) => {
    state.selectedTutor = tutor;
    const m = modalEls();
    configureModalForTutor(tutor);
    orderModal = bootstrap.Modal.getOrCreateInstance($("#orderModal"));
    orderModal.show();
  };

  // --- init ---
  const init = async () => {
    setYear();
    wireModalEvents();

    // course filters
    $("#courseSearch")?.addEventListener("input", debounce(applyCourseFilters, 200));
    $("#courseLevel")?.addEventListener("change", applyCourseFilters);

    // tutor filters
    $("#tutorLanguage")?.addEventListener("change", renderTutors);
    $("#tutorLevel")?.addEventListener("change", renderTutors);
    $("#tutorExperience")?.addEventListener("input", debounce(renderTutors, 150));

    try {
      const [courses, tutors] = await Promise.all([
        API.get("/api/courses"),
        API.get("/api/tutors"),
      ]);

      state.courses = Array.isArray(courses) ? courses : [];
      state.tutors = Array.isArray(tutors) ? tutors : [];

      // default filters state
      state.courseFiltered = state.courses.slice();

      fillTutorFilters();
      renderCourses();
      renderTutors();

      // cache for account page
      try {
        localStorage.setItem("LM_CACHE_COURSES", JSON.stringify(state.courses));
        localStorage.setItem("LM_CACHE_TUTORS", JSON.stringify(state.tutors));
      } catch (_) {}

      showAlert("Данные из API загружены.", "success", 2500);
    } catch (e) {
      console.error(e);
      showAlert("Не удалось загрузить данные из API. Проверь ключ и доступность сервера.", "danger", 8000);

      // fallback cache
      try {
        const c = JSON.parse(localStorage.getItem("LM_CACHE_COURSES") || "[]");
        const t = JSON.parse(localStorage.getItem("LM_CACHE_TUTORS") || "[]");
        state.courses = Array.isArray(c) ? c : [];
        state.tutors = Array.isArray(t) ? t : [];
        state.courseFiltered = state.courses.slice();
        fillTutorFilters();
        renderCourses();
        renderTutors();
      } catch (_) {}
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
