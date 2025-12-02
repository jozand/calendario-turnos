/* Calendario 12×48 con 3 grupos (A, B, C)
   - Lunes a viernes: 1 jornada nocturna 17:00–06:00
   - Sábado: 2 jornadas → 08:00–15:30 (grupo X), 17:00–06:00 (grupo X+1)
   - Domingo: 1 jornada 08:00–15:30
   - Festivos L–V: se tratan como sábado
*/

(() => {
  const $ = (sel) => document.querySelector(sel);

  // ==== CONSTANTES ====
  const LS_KEY_START = "cal12x48_startDateISO";
  const LS_KEY_FESTIVOS = "cal12x48_festivos_v1";
  const LS_KEY_GROUP = "cal12x48_startGroup";
  const GROUPS = ["A", "B", "C"];

  let festivos = new Set();

  // ==== Helpers ====
  const fmtDate = (d) =>
    new Intl.DateTimeFormat("es-GT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);

  const fmtDateLong = (d) =>
    new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
      .format(d)
      .replace(/^\w/, (c) => c.toUpperCase());

  const fmtMonthTitle = (y, m) =>
    new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric",
    })
      .format(new Date(y, m, 1))
      .replace(/^\w/, (c) => c.toUpperCase());

  const toYMD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  // ==== Feriados ====
  function loadFestivos() {
    try {
      const raw = localStorage.getItem(LS_KEY_FESTIVOS);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) festivos = new Set(arr);
    } catch {}
  }
  function saveFestivos() {
    localStorage.setItem(LS_KEY_FESTIVOS, JSON.stringify([...festivos]));
  }

  // ==== LocalStorage fecha inicial ====
  const storageStart = {
    get() {
      try {
        const v = localStorage.getItem(LS_KEY_START);
        if (v) return v;
      } catch {}
      return null;
    },
    set(iso) {
      localStorage.setItem(LS_KEY_START, iso);
    },
  };

  // ==== LocalStorage grupo ====
  const storageGroup = {
    get() {
      const g = localStorage.getItem(LS_KEY_GROUP);
      return g === "A" || g === "B" || g === "C" ? g : "A";
    },
    set(g) {
      if (["A", "B", "C"].includes(g)) {
        localStorage.setItem(LS_KEY_GROUP, g);
      }
    },
  };

  // ==== Elementos HTML ====
  const startDateInput = $("#startDate");
  const buildBtn = $("#build");
  const todayBtn = $("#today");
  const prevBtn = $("#prev");
  const nextBtn = $("#next");
  const monthTitle = $("#monthTitle");
  const calendar = $("#calendar");

  const holidayDateInput = $("#holidayDate");
  const addHolidayBtn = $("#addHoliday");
  const holidayList = $("#holidayList");

  const dayInfoText = $("#dayInfoText");

  const tabBtnConfig = $("#tabBtnConfig");
  const tabBtnCalendar = $("#tabBtnCalendar");
  const tabConfig = $("#tab-config");
  const tabCalendar = $("#tab-calendar");

  const groupARadio = $("#groupA");
  const groupBRadio = $("#groupB");
  const groupCRadio = $("#groupC");

  const legendA = $("#legendA");
  const legendB = $("#legendB");
  const legendC = $("#legendC");

  const exportBtn = $("#exportPDF");
  const printArea = $("#print-area");
  const calendarCard = $("#calendarCard");

  // ==== Estado ====
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let startDateMidnight = null;

  // ==== Tabs ====
  function setActiveTab(tab) {
    if (tab === "config") {
      tabConfig.classList.remove("hidden");
      tabCalendar.classList.add("hidden");
      tabBtnConfig.className =
        "flex-1 px-3 py-2 text-center border border-line border-b-0 rounded-t-xl bg-card font-medium";
      tabBtnCalendar.className =
        "flex-1 px-3 py-2 text-center border border-transparent rounded-t-xl text-muted hover:bg-slate-100";
    } else {
      tabConfig.classList.add("hidden");
      tabCalendar.classList.remove("hidden");
      tabBtnCalendar.className =
        "flex-1 px-3 py-2 text-center border border-line border-b-0 rounded-t-xl bg-card font-medium";
      tabBtnConfig.className =
        "flex-1 px-3 py-2 text-center border border-transparent rounded-t-xl text-muted hover:bg-slate-100";
    }
  }

  tabBtnConfig.addEventListener("click", () => setActiveTab("config"));

  tabBtnCalendar.addEventListener("click", () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    dayInfoText.textContent = "Toca un día del calendario para ver los detalles del turno.";
    render();
    setActiveTab("calendar");
  });

  // ==== Grupo ====
  function getSelectedGroupFromUI() {
    if (groupARadio.checked) return "A";
    if (groupBRadio.checked) return "B";
    if (groupCRadio.checked) return "C";
    return null;
  }

  function setSelectedGroupInUI(g) {
    groupARadio.checked = g === "A";
    groupBRadio.checked = g === "B";
    groupCRadio.checked = g === "C";
  }

  [groupARadio, groupBRadio, groupCRadio].forEach((i) =>
    i.addEventListener("change", () => {
      const g = getSelectedGroupFromUI();
      if (g) {
        storageGroup.set(g);
        if (startDateMidnight) render();
      }
    })
  );

  // ==== Fecha Inicial ====
  function setStartFromYMD(yyyy_mm_dd) {
    const iso = `${yyyy_mm_dd}T00:00:00`;
    storageStart.set(iso);
    const d0 = new Date(iso);
    d0.setHours(0, 0, 0, 0);
    startDateMidnight = d0;
  }

  function loadStartFromStorage() {
    const iso = storageStart.get();
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    startDateInput.value = toYMD(d);
    startDateMidnight = d;
    startDateMidnight.setHours(0, 0, 0, 0);
    setSelectedGroupInUI(storageGroup.get());
    return true;
  }

  // ==== Construir horarios del mes ====
  function buildScheduleMapForMonth(year, month) {
    const schedule = new Map();
    if (!startDateMidnight) return schedule;

    const lastOfMonth = new Date(year, month + 1, 0);
    lastOfMonth.setHours(0, 0, 0, 0);
    if (startDateMidnight.getTime() > lastOfMonth.getTime()) return schedule;

    let currentDate = new Date(startDateMidnight);
    currentDate.setHours(0, 0, 0, 0);

    const startGroup = storageGroup.get();
    let groupIndex = GROUPS.indexOf(startGroup);

    while (currentDate.getTime() <= lastOfMonth.getTime()) {
      const key = toYMD(currentDate);
      const dow = currentDate.getDay();
      const isFestivo = festivos.has(key);
      const isWeekday = dow >= 1 && dow <= 5;
      const isSaturday = dow === 6;
      const isSunday = dow === 0;
      const isFestivoWeekday = isFestivo && isWeekday;

      const shifts = [];

      if (currentDate.getTime() >= startDateMidnight.getTime()) {
        if (isSaturday || isFestivoWeekday) {
          const g1 = GROUPS[groupIndex % 3];
          groupIndex++;
          const g2 = GROUPS[groupIndex % 3];
          groupIndex++;
          shifts.push({ group: g1, hours: "08:00–15:30", label: "Mañana" });
          shifts.push({ group: g2, hours: "17:00–06:00", label: "Tarde" });
        } else if (isSunday) {
          const g = GROUPS[groupIndex % 3];
          groupIndex++;
          shifts.push({ group: g, hours: "08:00–15:30" });
        } else {
          const g = GROUPS[groupIndex % 3];
          groupIndex++;
          shifts.push({ group: g, hours: "17:00–06:00" });
        }
      }

      if (currentDate.getMonth() === month) {
        schedule.set(key, shifts);
      }

      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return schedule;
  }

  // ==== Festivos UI ====
  function renderFestivosUI() {
    holidayList.innerHTML = "";
    if (festivos.size === 0) {
      holidayList.innerHTML = `<span class="text-muted">Sin festivos guardados</span>`;
      return;
    }

    [...festivos].sort().forEach((ymd) => {
      const d = new Date(`${ymd}T00:00:00`);
      const btn = document.createElement("button");
      btn.dataset.date = ymd;
      btn.className =
        "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-muted border border-line hover:bg-slate-200";
      btn.innerHTML = `<span>${fmtDate(d)}</span><span class='text-[10px]'>&times;</span>`;
      holidayList.appendChild(btn);
    });
  }

  // ==== Panel de detalle ====
  function showDayInfo(date, shifts) {
    if (!shifts || shifts.length === 0) {
      dayInfoText.textContent = `${fmtDateLong(date)} · Sin turno asignado.`;
      return;
    }

    const lines = shifts.map((s) =>
      s.label ? `${s.label} – Grupo ${s.group} (${s.hours})` : `Grupo ${s.group} (${s.hours})`
    );

    dayInfoText.innerHTML =
      `<div class="font-semibold mb-1">${fmtDateLong(date)}</div>` +
      `<div class="space-y-0.5">${lines.map((l) => `<div>${l}</div>`).join("")}</div>`;
  }

  // ==== Actualizar conteo de turnos ====
  function updateTurnCounts(schedule) {
    let a = 0, b = 0, c = 0;

    schedule.forEach((shifts) => {
      shifts.forEach((s) => {
        if (s.group === "A") a++;
        if (s.group === "B") b++;
        if (s.group === "C") c++;
      });
    });

    legendA.textContent = `Grupo A (${a})`;
    legendB.textContent = `Grupo B (${b})`;
    legendC.textContent = `Grupo C (${c})`;
  }

  // ==== Render del calendario ====
  function render() {
    monthTitle.textContent = fmtMonthTitle(viewYear, viewMonth);
    calendar.innerHTML = "";

    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const scheduleMap = buildScheduleMapForMonth(viewYear, viewMonth);

    updateTurnCounts(scheduleMap);

    const jsDow = first.getDay();
    const mondayBased = (jsDow + 6) % 7;

    for (let i = 0; i < mondayBased; i++) {
      const empty = document.createElement("div");
      empty.className = "h-16 sm:h-20";
      calendar.appendChild(empty);
    }

    calendar.onclick = null;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day);
      date.setHours(0, 0, 0, 0);
      const ymd = toYMD(date);
      const shifts = scheduleMap.get(ymd) || [];
      const isToday = date.toDateString() === new Date().toDateString();
      const dow = date.getDay();
      const isFestivo = festivos.has(ymd);
      const isWeekend = dow === 6 || dow === 0;
      const isYellow = (isWeekend || isFestivo) && shifts.length > 0;

      const classes = [
        "relative flex flex-col items-center justify-center",
        "h-16 sm:h-20",
        "rounded-3xl text-[10px] sm:text-xs",
        "text-slate-900",
        "shadow-[0_0_0_1px_rgba(15,23,42,0.03)]",
        "px-1",
      ];

      if (shifts.length === 0) {
        classes.push("bg-white border border-line");
      } else if (isYellow) {
        classes.push("bg-amber-200");
      } else {
        const g = shifts[0].group;
        if (g === "A") classes.push("bg-blue-100");
        if (g === "B") classes.push("bg-green-100");
        if (g === "C") classes.push("bg-red-100");
      }

      if (isToday) classes.push("outline outline-1 outline-accent/40");

      const cell = document.createElement("div");
      cell.className = classes.join(" ");
      cell.dataset.date = ymd;

      const label = document.createElement("div");
      label.textContent = String(day);
      label.className = "font-semibold text-sm sm:text-base leading-tight mb-0.5";
      cell.appendChild(label);

      const sub = document.createElement("div");
      sub.className = "text-[9px] sm:text-[10px] leading-tight text-center";

      if (!shifts.length) {
        sub.innerHTML = "&nbsp;";
      } else if (shifts.length === 1) {
        sub.innerHTML = `<span class="font-semibold">Grupo ${shifts[0].group}</span>`;
      } else {
        sub.innerHTML = `<span class="font-semibold">${shifts[0].group} / ${shifts[1].group}</span>`;
      }

      cell.appendChild(sub);
      calendar.appendChild(cell);
    }

    calendar.onclick = (ev) => {
      const cell = ev.target.closest("[data-date]");
      if (!cell) return;
      const date = new Date(`${cell.dataset.date}T00:00:00`);
      const shifts = scheduleMap.get(cell.dataset.date) || [];
      showDayInfo(date, shifts);
    };
  }

  // ==== Eventos globales ====

  buildBtn.addEventListener("click", () => {
    if (!startDateInput.value) return alert("Selecciona la fecha inicial");

    let g = getSelectedGroupFromUI();
    if (!g) {
      g = "A";
      setSelectedGroupInUI(g);
    }
    storageGroup.set(g);

    setStartFromYMD(startDateInput.value);

    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();

    dayInfoText.textContent =
      "Toca un día del calendario para ver los detalles del turno.";

    render();
    setActiveTab("calendar");
  });

  todayBtn.addEventListener("click", () => {
    const t = new Date();
    const ymd = toYMD(t);
    startDateInput.value = ymd;
    setStartFromYMD(ymd);

    viewYear = t.getFullYear();
    viewMonth = t.getMonth();

    dayInfoText.textContent =
      "Toca un día del calendario para ver los detalles del turno.";

    render();
    setActiveTab("calendar");
  });

  prevBtn.addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    dayInfoText.textContent =
      "Toca un día del calendario para ver los detalles del turno.";
    render();
  });

  nextBtn.addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    dayInfoText.textContent =
      "Toca un día del calendario para ver los detalles del turno.";
    render();
  });

  addHolidayBtn.addEventListener("click", () => {
    const v = holidayDateInput.value;
    if (!v) return alert("Selecciona una fecha festiva");
    festivos.add(v);
    saveFestivos();
    renderFestivosUI();
    render();
  });

  holidayList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-date]");
    if (!btn) return;
    festivos.delete(btn.dataset.date);
    saveFestivos();
    renderFestivosUI();
    render();
  });

  // ============================================
  //    EXPORTAR PDF (Opción C — Todo el card)
  // ============================================
  exportBtn.addEventListener("click", () => {
    printArea.innerHTML = "";
    const clone = calendarCard.cloneNode(true);
    clone.id = "print-area-content";
    clone.classList.add("no-print-shadow");
    printArea.appendChild(clone);

    window.print();

    setTimeout(() => {
      printArea.innerHTML = "";
    }, 500);
  });

  // INIT
  loadFestivos();
  renderFestivosUI();

  if (!loadStartFromStorage()) {
    setSelectedGroupInUI("A");
  }

  setActiveTab("config");
  render();
})();
