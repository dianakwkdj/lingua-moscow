// LinguaMoscow — account page logic (orders CRUD)

(function () {
  const {
    $, escapeHtml, formatMoneyRU, formatDateRU,
    calcBaseCourseCost, applyOptions, showAlert, debounce, toDateOnly
  } = window.LM;

  const API = window.LM_API;

  const state = {
    orders: [],
    page: 1,
    courses: [],
    tutors: [],
    deleteId: null,
    edit: {
      order: null,
      ctx: null,
      computed: null,
      bound: false,
    },
  };

  const editEls = () => ({
    modal: $("#editModal"),
    orderId: $("#editOrderId"),
    courseId: $("#editCourseId"),
    tutorId: $("#editTutorId"),
    title: $("#editTitle"),
    hint: $("#editHint"),
    date: $("#editDate"),
    time: $("#editTime"),
    duration: $("#editDuration"),
    durationHelp: $("#editDurationHelp"),
    persons: $("#editPersons"),
    eEarly: $("#eEarly"),
    eGroup: $("#eGroup"),
    eIntensive: $("#eIntensive"),
    supplementary: $("#eSupplementary"),
    personalized: $("#ePersonalized"),
    excursions: $("#eExcursions"),
    assessment: $("#eAssessment"),
    interactive: $("#eInteractive"),
    price: $("#editPrice"),
    breakdown: $("#editBreakdown"),
    save: $("#saveEdit"),
  });

  const loadCache = () => {
    try { state.courses = JSON.parse(localStorage.getItem("LM_CACHE_COURSES") || "[]") || []; } catch (_) {}
    try { state.tutors = JSON.parse(localStorage.getItem("LM_CACHE_TUTORS") || "[]") || []; } catch (_) {}
  };

  const byId = (arr, id) => (arr || []).find(x => String(x.id) === String(id));

  const orderLabel = (o) => {
    if (o.course_id) {
      const c = byId(state.courses, o.course_id);
      return c ? `Курс: ${c.name}` : `Курс #${o.course_id}`;
    }
    if (o.tutor_id) {
      const t = byId(state.tutors, o.tutor_id);
      return t ? `Репетитор: ${t.name}` : `Репетитор #${o.tutor_id}`;
    }
    return "—";
  };

  const orderHint = (o) => {
    const dt = `${formatDateRU(o.date_start)} ${escapeHtml(o.time_start || "")}`;
    return dt.trim();
  };

  const getOrderContext = (o) => {
    if (o.course_id) {
      const course = byId(state.courses, o.course_id);
      return { kind: "course", course };
    }
    if (o.tutor_id) {
      const tutor = byId(state.tutors, o.tutor_id);
      return { kind: "tutor", tutor };
    }
    return { kind: "unknown" };
  };

  const computePriceForOrder = (ctx, fields) => {
    const persons = Number(fields.persons || 1);
    const durationHours = Number(fields.duration || 0);
    const dateStart = fields.date_start;
    const timeStart = fields.time_start;

    const feePerHour = ctx.kind === "course"
      ? Number(ctx.course?.course_fee_per_hour || 0)
      : Number(ctx.tutor?.price_per_hour || 0);

    const weeks = ctx.kind === "course"
      ? Number(ctx.course?.total_length || 1)
      : Math.max(1, Math.ceil(durationHours / 4));

    const baseRes = calcBaseCourseCost({ feePerHour, durationHours, dateStart, timeStart, persons });

    // auto options rules
    const today = new Date();
    const in30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    const start = dateStart ? new Date(dateStart) : null;

    const autoEarly = !!(start && start.getTime() >= in30.getTime());
    const autoGroup = persons >= 5;
    const autoIntensive = ctx.kind === "course"
      ? Number(ctx.course?.week_length || 0) >= 5
      : durationHours >= 5;

    const opts = {
      early_registration: autoEarly,
      group_enrollment: autoGroup,
      intensive_course: autoIntensive,
      supplementary: !!fields.supplementary,
      personalized: !!fields.personalized,
      excursions: !!fields.excursions,
      assessment: !!fields.assessment,
      interactive: !!fields.interactive,
    };

    const optRes = applyOptions({ baseCost: baseRes.base, persons, weeks, opts });

    const breakdown = [
      `База: ((${formatMoneyRU(baseRes.parts.fee)}×${baseRes.parts.dur}×${baseRes.parts.weekendFactor}) + ${baseRes.parts.morning} + ${baseRes.parts.evening}) × ${baseRes.parts.persons}`,
      ...(optRes.breakdown.length ? [`Опции: ${optRes.breakdown.join(", ")}`] : []),
    ].join(" • ");

    return { total: optRes.total, opts, breakdown };
  };

  const renderOrders = () => {
    const tbody = $("#ordersTbody");
    const pager = $("#ordersPager");
    const meta = $("#ordersMeta");
    if (!tbody || !pager || !meta) return;

    const pageSize = window.LM_CONFIG?.PAGE_SIZE || 5;
    const pages = Math.max(1, Math.ceil(state.orders.length / pageSize));
    state.page = Math.min(state.page, pages);

    const slice = state.orders.slice((state.page - 1) * pageSize, state.page * pageSize);

    tbody.innerHTML = "";
    if (!state.orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-4">Заявок пока нет. Создай первую на главной странице.</td></tr>`;
    } else {
      for (const o of slice) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="fw-semibold">#${escapeHtml(o.id)}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(orderLabel(o))}</div>
            <div class="text-secondary small">${o.course_id ? "Тип: курс" : (o.tutor_id ? "Тип: репетитор" : "Тип: —")}</div>
          </td>
          <td>
            <div class="fw-semibold">${formatDateRU(o.date_start)} ${escapeHtml(o.time_start || "")}</div>
            <div class="text-secondary small">Длительность: ${escapeHtml(o.duration)} ч</div>
          </td>
          <td class="text-center">${escapeHtml(o.persons)}</td>
          <td class="text-end fw-semibold">${formatMoneyRU(o.price)} ₽</td>
          <td class="text-end">
            <button class="btn btn-outline-secondary btn-sm me-2 btnDetails">Подробнее</button>
            <button class="btn btn-primary btn-sm me-2 btnEdit">Изменить</button>
            <button class="btn btn-outline-danger btn-sm btnDelete">Удалить</button>
          </td>
        `;

        tr.querySelector(".btnDetails").addEventListener("click", () => openDetails(o.id));
        tr.querySelector(".btnEdit").addEventListener("click", () => openEdit(o.id));
        tr.querySelector(".btnDelete").addEventListener("click", () => openDelete(o.id));

        tbody.appendChild(tr);
      }
    }

    meta.textContent = `Всего заявок: ${state.orders.length}. Страница ${state.page} из ${pages}.`;
    window.LM.renderPager({
      ul: pager,
      page: state.page,
      pages,
      onPage: (p) => {
        state.page = p;
        renderOrders();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const openDetails = async (id) => {
    try {
      const o = await API.get(`/api/orders/${id}`);
      const ctx = getOrderContext(o);

      // fetch course/tutor info if not in cache
      if (ctx.kind === "course" && !ctx.course) {
        try { state.courses = await API.get("/api/courses"); } catch (_) {}
      }
      if (ctx.kind === "tutor" && !ctx.tutor) {
        try { state.tutors = await API.get("/api/tutors"); } catch (_) {}
      }

      const ctx2 = getOrderContext(o);
      const computed = computePriceForOrder(ctx2, o);

      $("#detailsSub").textContent = `#${o.id} • ${orderLabel(o)}`;
      $("#detailsBody").innerHTML = `
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <div class="p-3 bg-body-tertiary rounded-3 border h-100">
              <div class="text-secondary small">Дата/время</div>
              <div class="fw-semibold">${formatDateRU(o.date_start)} ${escapeHtml(o.time_start || "")}</div>
              <div class="text-secondary small mt-2">Студентов</div>
              <div class="fw-semibold">${escapeHtml(o.persons)}</div>
              <div class="text-secondary small mt-2">Длительность</div>
              <div class="fw-semibold">${escapeHtml(o.duration)} ч</div>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <div class="p-3 bg-body-tertiary rounded-3 border h-100">
              <div class="text-secondary small">Стоимость (в заявке)</div>
              <div class="fw-semibold">${formatMoneyRU(o.price)} ₽</div>
              <div class="text-secondary small mt-2">Расчёт (по формуле + опции)</div>
              <div class="fw-semibold">${formatMoneyRU(computed.total)} ₽</div>
              <div class="text-secondary small mt-2">${escapeHtml(computed.breakdown)}</div>
            </div>
          </div>

          <div class="col-12">
            <div class="p-3 bg-white rounded-3 border">
              <div class="fw-semibold mb-2">Опции</div>
              <div class="d-flex flex-wrap gap-2">
                ${Object.entries({
                  early_registration: "Ранняя регистрация",
                  group_enrollment: "Групповая запись",
                  intensive_course: "Интенсив",
                  supplementary: "Материалы",
                  personalized: "Индивидуальные",
                  excursions: "Экскурсии",
                  assessment: "Оценка",
                  interactive: "Платформа",
                }).map(([k, label]) => {
                  const on = !!o[k];
                  return `<span class="badge ${on ? "text-bg-primary" : "text-bg-light border"}">${escapeHtml(label)}${on ? "" : " (нет)"}</span>`;
                }).join("")}
              </div>
            </div>
          </div>
        </div>
      `;

      bootstrap.Modal.getOrCreateInstance($("#detailsModal")).show();
    } catch (e) {
      showAlert(`Не удалось загрузить заявку: ${e.message || e}`, "danger", 8000);
    }
  };

  // NOTE: populate once, do not overwrite user edits on every recalculation.
  const populateEditForm = (o, ctx) => {
    const e = editEls();
    e.orderId.value = o.id;
    e.courseId.value = o.course_id || "";
    e.tutorId.value = o.tutor_id || "";

    e.title.value = orderLabel(o);
    e.hint.textContent = `#${o.id} • ${o.course_id ? "курс" : "репетитор"}`;

    e.date.value = o.date_start || "";
    e.time.value = (o.time_start || "").slice(0, 5);

    if (ctx.kind === "course" && ctx.course) {
      const dur = Number(ctx.course.total_length || 0) * Number(ctx.course.week_length || 0);
      e.duration.value = String(dur);
      e.duration.disabled = true;
      e.durationHelp.textContent = `Курс: длительность фиксирована (${dur} ч).`;
    } else {
      e.duration.value = String(o.duration || 1);
      e.duration.disabled = false;
      e.durationHelp.textContent = "Репетитор: 1–40 ч.";
    }

    e.persons.value = String(o.persons || 1);

    // user-controlled options
    e.supplementary.checked = !!o.supplementary;
    e.personalized.checked = !!o.personalized;
    e.excursions.checked = !!o.excursions;
    e.assessment.checked = !!o.assessment;
    e.interactive.checked = !!o.interactive;
  };

  const recalcEdit = () => {
    const o = state.edit.order;
    const ctx = state.edit.ctx;
    if (!o || !ctx) return;
    const e = editEls();

    const computed = computePriceForOrder(ctx, {
      ...o,
      date_start: e.date.value,
      time_start: e.time.value,
      duration: e.duration.value,
      persons: e.persons.value,
      supplementary: e.supplementary.checked,
      personalized: e.personalized.checked,
      excursions: e.excursions.checked,
      assessment: e.assessment.checked,
      interactive: e.interactive.checked,
    });

    // auto options display
    e.eEarly.checked = computed.opts.early_registration;
    e.eGroup.checked = computed.opts.group_enrollment;
    e.eIntensive.checked = computed.opts.intensive_course;

    e.price.textContent = formatMoneyRU(computed.total);
    e.breakdown.textContent = computed.breakdown;

    state.edit.computed = computed;
  };

  const openEdit = async (id) => {
    const o = state.orders.find(x => String(x.id) === String(id));
    if (!o) return;

    // Ensure ctx has course/tutor object
    let ctx = getOrderContext(o);

    if (ctx.kind === "course" && !ctx.course) {
      try { state.courses = await API.get("/api/courses"); } catch (_) {}
      ctx = getOrderContext(o);
    }
    if (ctx.kind === "tutor" && !ctx.tutor) {
      try { state.tutors = await API.get("/api/tutors"); } catch (_) {}
      ctx = getOrderContext(o);
    }

    state.edit.order = o;
    state.edit.ctx = ctx;
    populateEditForm(o, ctx);
    recalcEdit();

    // bind once
    if (!state.edit.bound) {
      state.edit.bound = true;
      const recalc = debounce(recalcEdit, 120);
      const e = editEls();
      [e.date, e.time, e.duration, e.persons, e.supplementary, e.personalized, e.excursions, e.assessment, e.interactive]
        .forEach(el => {
          if (!el) return;
          el.addEventListener("input", recalc);
          el.addEventListener("change", recalc);
        });
    }

    bootstrap.Modal.getOrCreateInstance($("#editModal")).show();

    editEls().save.onclick = async () => {
      try {
        const computed = state.edit.computed || { total: Number(o.price || 0), opts: {} };
        const e = editEls();
        const payload = {
          tutor_id: o.tutor_id ?? null,
          course_id: o.course_id ?? null,
          date_start: e.date.value,
          time_start: e.time.value,
          duration: Number(e.duration.value),
          persons: Number(e.persons.value),
          price: Number(computed.total),

          // IMPORTANT: always send booleans to avoid reset to false
          early_registration: !!computed.opts.early_registration,
          group_enrollment: !!computed.opts.group_enrollment,
          intensive_course: !!computed.opts.intensive_course,
          supplementary: !!e.supplementary.checked,
          personalized: !!e.personalized.checked,
          excursions: !!e.excursions.checked,
          assessment: !!e.assessment.checked,
          interactive: !!e.interactive.checked,
        };

        e.save.disabled = true;
        e.save.textContent = "Сохраняем…";
        await API.put(`/api/orders/${id}`, payload);

        showAlert("Заявка обновлена.", "success", 3500);
        bootstrap.Modal.getOrCreateInstance($("#editModal")).hide();
        await refreshOrders();
      } catch (e) {
        showAlert(`Не удалось обновить: ${e.message || e}`, "danger", 8000);
      } finally {
        const e = editEls();
        e.save.disabled = false;
        e.save.textContent = "Сохранить";
      }
    };
  };

  const openDelete = (id) => {
    state.deleteId = id;
    $("#deleteText").textContent = `Удалить заявку #${id}? Это действие нельзя отменить.`;
    bootstrap.Modal.getOrCreateInstance($("#deleteModal")).show();
  };

  const bindDelete = () => {
    $("#confirmDelete").addEventListener("click", async () => {
      const id = state.deleteId;
      if (!id) return;
      try {
        $("#confirmDelete").disabled = true;
        $("#confirmDelete").textContent = "Удаляем…";
        await API.del(`/api/orders/${id}`);
        showAlert("Заявка удалена.", "success", 3000);
        bootstrap.Modal.getOrCreateInstance($("#deleteModal")).hide();
        await refreshOrders();
      } catch (e) {
        showAlert(`Не удалось удалить: ${e.message || e}`, "danger", 8000);
      } finally {
        $("#confirmDelete").disabled = false;
        $("#confirmDelete").textContent = "Да, удалить";
      }
    });
  };

  const refreshOrders = async () => {
    const orders = await API.get("/api/orders");
    state.orders = Array.isArray(orders) ? orders.sort((a,b) => (b.id||0)-(a.id||0)) : [];
    state.page = 1;
    renderOrders();
  };

  const init = async () => {
    loadCache();
    bindDelete();

    $("#refreshOrders")?.addEventListener("click", refreshOrders);

    try {
      await refreshOrders();
      showAlert("Заявки загружены.", "success", 2000);
    } catch (e) {
      showAlert("Не удалось загрузить заявки. Проверь API Key и доступность сервера.", "danger", 8000);
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
