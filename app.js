/* Calendario 12×48 con 3 grupos (A, B, C)
   - Lunes a viernes: 1 jornada nocturna 17:00–06:00 (un grupo)
   - Sábado: 2 jornadas → 08:00–15:30 (grupo X), 17:00–06:00 (grupo X+1)
   - Domingo: 1 jornada 08:00–15:30 (siguiente grupo)
   - Festivos entre semana (L–V): se tratan como sábado (2 jornadas)
   - Se parte de una fecha inicial (primer día de trabajo de la secuencia),
     que se asume como grupo A en la primera jornada.
*/

(() => {
  const $ = (sel) => document.querySelector(sel);

  const LS_KEY_START = "cal12x48_startDateISO";
  const LS_KEY_FESTIVOS = "cal12x48_festivos_v1";
  const GROUPS = ["A", "B", "C"];

  let festivos = new Set();

  // ==== Helpers de formato ====
  const fmtDate = (d) =>
    new Intl.DateTimeFormat("es-GT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);

  const fmtMonthTitle = (y, m) =>
    new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric",
    })
      .format(new Date(y, m, 1))
      .replace(/^\w/, (c) => c.toUpperCase());

  const toYMD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  // ==== Festivos ====
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

  // ==== Storage de fecha inicial ====
  const storageStart = {
    get() {
      try {
        const v = localStorage.getItem(LS_KEY_START);
        if (v) return v;
      } catch {}
      const m = document.cookie.match(
        new RegExp("(^| )" + LS_KEY_START + "=([^;]+)"),
      );
      return m ? decodeURIComponent(m[2]) : null;
    },
    set(iso) {
      localStorage.setItem(LS_KEY_START, iso);
      const exp = new Date();
      exp.setFullYear(exp.getFullYear() + 1);
      document.cookie = `${LS_KEY_START}=${encodeURIComponent(
        iso,
      )}; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
    },
  };

  // ==== Elementos de la UI ====
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

  // Tabs
  const tabBtnConfig = $("#tabBtnConfig");
  const tabBtnCalendar = $("#tabBtnCalendar");
  const tabConfig = $("#tab-config");
  const tabCalendar = $("#tab-calendar");

  // ==== Estado ====
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let startDateMidnight = null;
  let startDateTime = null;

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
  tabBtnCalendar.addEventListener("click", () => setActiveTab("calendar"));

  // ==== Fecha inicial ====
  function setStartFromYMD(yyyy_mm_dd) {
    const iso = `${yyyy_mm_dd}T00:00:00`;
    storageStart.set(iso);
    const d0 = new Date(iso);
    d0.setHours(0, 0, 0, 0);
    startDateMidnight = d0;
    const d17 = new Date(d0);
    d17.setHours(17, 0, 0, 0);
    startDateTime = d17;
  }

  function loadStartFromStorage() {
    const iso = storageStart.get();
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    startDateInput.value = toYMD(d);
    d.setHours(0, 0, 0, 0);
    startDateMidnight = new Date(d);
    startDateTime = new Date(d);
    startDateTime.setHours(17, 0, 0, 0);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    return true;
  }

  // ==== Generar horario del mes ====
  function buildScheduleMapForMonth(year, month) {
    const schedule = new Map();
    if (!startDateMidnight) return schedule;

    const lastOfMonth = new Date(year, month + 1, 0);
    lastOfMonth.setHours(0, 0, 0, 0);

    if (startDateMidnight.getTime() > lastOfMonth.getTime()) return schedule;

    let currentDate = new Date(startDateMidnight);
    currentDate.setHours(0, 0, 0, 0);
    let groupIndex = 0;

    while (currentDate.getTime() <= lastOfMonth.getTime()) {
      const key = toYMD(currentDate);
      const dow = currentDate.getDay(); // 0 Dom .. 6 Sáb
      const isFestivo = festivos.has(key);
      const isWeekday = dow >= 1 && dow <= 5;
      const isSaturday = dow === 6;
      const isSunday = dow === 0;
      const isFestivoWeekday = isFestivo && isWeekday;
      const shifts = [];

      if (currentDate.getTime() >= startDateMidnight.getTime()) {
        if (isSaturday || isFestivoWeekday) {
          // Día tipo sábado (o festivo L–V): dos jornadas
          const g1 = GROUPS[groupIndex % 3];
          groupIndex++;
          const g2 = GROUPS[groupIndex % 3];
          groupIndex++;
          shifts.push({ group: g1, hours: "08:00–15:30" });
          shifts.push({ group: g2, hours: "17:00–06:00" });
        } else if (isSunday) {
          // Domingo: una jornada 08:00–15:30
          const g = GROUPS[groupIndex % 3];
          groupIndex++;
          shifts.push({ group: g, hours: "08:00–15:30" });
        } else {
          // L–V normal: una jornada nocturna
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

  // ==== UI de festivos ====
  function renderFestivosUI() {
    holidayList.innerHTML = "";
    if (festivos.size === 0) {
      const span = document.createElement("span");
      span.textContent = "Sin festivos guardados";
      span.className = "text-muted";
      holidayList.appendChild(span);
      return;
    }

    [...festivos]
      .sort()
      .forEach((ymd) => {
        const d = new Date(`${ymd}T00:00:00`);
        const b = document.createElement("button");
        b.dataset.date = ymd;
        b.type = "button";
        b.className =
          "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-muted border border-line hover:bg-slate-200";
        b.innerHTML = `<span>${fmtDate(d)}</span><span class='text-[10px]'>&times;</span>`;
        holidayList.appendChild(b);
      });
  }

  // ==== Render calendario ====
  function render() {
    monthTitle.textContent = fmtMonthTitle(viewYear, viewMonth);
    calendar.innerHTML = "";

    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const scheduleMap = buildScheduleMapForMonth(viewYear, viewMonth);

    const jsDow = first.getDay(); // 0 Dom .. 6 Sáb
    const mondayBased = (jsDow + 6) % 7;
    for (let i = 0; i < mondayBased; i++) {
      const e = document.createElement("div");
      e.className = "h-12 sm:h-16";
      calendar.appendChild(e);
    }

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
        "relative h-12 sm:h-16 rounded-lg border text-xs sm:text-sm",
        "flex flex-col items-center justify-center",
        "text-slate-900",
      ];

      // Borde y ring según grupo principal (primer turno del día)
      if (shifts.length > 0) {
        const mainGroup = shifts[0].group;
        if (mainGroup === "A") {
          classes.push("ring-2 ring-blue-500 border-blue-500");
        } else if (mainGroup === "B") {
          classes.push("ring-2 ring-green-500 border-green-500");
        } else if (mainGroup === "C") {
          classes.push("ring-2 ring-red-500 border-red-500");
        } else {
          classes.push("ring-2 ring-accent border-accent");
        }
      } else {
        classes.push("border-line bg-white");
      }

      if (isYellow) {
        classes.push("bg-amber-200");
      } else if (shifts.length === 0) {
        classes.push("bg-white");
      }

      if (isToday) {
        classes.push("outline outline-1 outline-accent/40");
      }

      const cell = document.createElement("div");
      cell.className = classes.join(" ");

      const label = document.createElement("div");
      label.textContent = String(day);
      label.className = "font-semibold leading-tight";
      cell.appendChild(label);

      const sub = document.createElement("div");
      sub.className =
        "mt-0.5 text-[9px] sm:text-[10px] leading-tight text-center";

      if (!shifts.length) {
        sub.innerHTML = "&nbsp;";
      } else if (shifts.length === 1) {
        const s = shifts[0];
        sub.innerHTML = `<span class="font-semibold">Grupo ${s.group}</span> (${s.hours})`;
      } else if (shifts.length === 2) {
        const s1 = shifts[0];
        const s2 = shifts[1];
        sub.innerHTML =
          `Mañana <span class="font-semibold">Grupo ${s1.group}</span> (${s1.hours})` +
          "<br>" +
          `Tarde <span class="font-semibold">Grupo ${s2.group}</span> (${s2.hours})`;
      }

      cell.appendChild(sub);

      if (shifts.length) {
        const resumen = shifts
          .map((s) => `Grupo ${s.group} (${s.hours})`)
          .join(" · ");
        cell.title = `${fmtDate(date)} · ${resumen}`;
      } else {
        cell.title = fmtDate(date);
      }

      calendar.appendChild(cell);
    }
  }

  // ==== Eventos ====
  buildBtn.addEventListener("click", () => {
    if (!startDateInput.value) {
      alert("Selecciona la fecha inicial");
      return;
    }
    setStartFromYMD(startDateInput.value);
    viewYear = startDateMidnight.getFullYear();
    viewMonth = startDateMidnight.getMonth();
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
    render();
    setActiveTab("calendar");
  });

  prevBtn.addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  });

  nextBtn.addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  });

  addHolidayBtn.addEventListener("click", () => {
    const v = holidayDateInput.value;
    if (!v) {
      alert("Selecciona una fecha festiva");
      return;
    }
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

  // ==== Inicialización ====
  loadFestivos();
  renderFestivosUI();

  if (!loadStartFromStorage()) {
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
  }

  setActiveTab("config");
  render();
})();
