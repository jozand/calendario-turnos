/* Calendario 12×48 – limpio y móvil-first
   - Turno: 17:00–05:00 (12h) + 48h descanso → ciclo de 60h
   - Marca SOLO a partir de la fecha ingresada (no días anteriores)
   - Botón "Hoy": si no hay fecha, fija hoy como inicio y calcula; si hay fecha, solo navega al mes actual
*/

(() => {
  const $ = (sel) => document.querySelector(sel);

  // ==== Storage híbrido (localStorage con respaldo en cookie) ====
  const LS_KEY = "cal12x48_startDateISO";

  const storage = {
    get() {
      try {
        const v = localStorage.getItem(LS_KEY);
        if (v) return v;
      } catch {}
      // respaldo: cookie
      const m = document.cookie.match(new RegExp("(^| )" + LS_KEY + "=([^;]+)"));
      return m ? decodeURIComponent(m[2]) : null;
    },
    set(iso) {
      // localStorage
      try { localStorage.setItem(LS_KEY, iso); } catch {}
      // cookie (1 año)
      const exp = new Date();
      exp.setFullYear(exp.getFullYear() + 1);
      document.cookie = `${LS_KEY}=${encodeURIComponent(iso)}; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
    },
    clear() {
      try { localStorage.removeItem(LS_KEY); } catch {}
      document.cookie = `${LS_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    }
  };

  // ==== Elementos ====
  const startDateInput = $("#startDate");
  const buildBtn = $("#build");
  const todayBtn = $("#today");
  const prevBtn = $("#prev");
  const nextBtn = $("#next");
  const monthTitle = $("#monthTitle");
  const calendar = $("#calendar");

  // ==== Estado de vista ====
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0-11

  // Fecha base (inicio 17:00) y medianoche del mismo día
  let startDateTime = null;     // 17:00
  let startDateMidnight = null; // 00:00

  // ==== Helpers de formato ====
  const fmtDate = (d) =>
    new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

  const fmtMonthTitle = (y, m) =>
    new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
      .format(new Date(y, m, 1))
      .replace(/^\w/, (c) => c.toUpperCase());

  // ==== Core ====
  function setStartFromYMD(yyyy_mm_dd) {
    // yyyy-mm-dd -> guarda en storage (T00:00:00) y prepara 00:00 y 17:00 locales
    const iso = `${yyyy_mm_dd}T00:00:00`;
    storage.set(iso);

    const d0 = new Date(iso);
    d0.setHours(0, 0, 0, 0);
    startDateMidnight = d0;

    const d17 = new Date(d0);
    d17.setHours(17, 0, 0, 0);
    startDateTime = d17;
  }

  function loadStartFromStorage() {
    const iso = storage.get();
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;

    // input
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    startDateInput.value = `${y}-${m}-${da}`;

    // midnight + 17:00
    d.setHours(0, 0, 0, 0);
    startDateMidnight = new Date(d);
    startDateTime = new Date(d);
    startDateTime.setHours(17, 0, 0, 0);

    // vista al mes de la fecha guardada
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    return true;
  }

  function isShiftStartDay(dayDate) {
    if (!startDateTime || !startDateMidnight) return false;
    if (dayDate.getTime() < startDateMidnight.getTime()) return false;

    const begin = new Date(dayDate);
    begin.setHours(17, 0, 0, 0);

    const diffMs = begin.getTime() - startDateTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // ciclo 60h (12h turno + 48h descanso)
    const mod = ((diffHours % 60) + 60) % 60;
    return Math.abs(mod) < 0.0001;
  }

  function render() {
    monthTitle.textContent = fmtMonthTitle(viewYear, viewMonth);
    calendar.innerHTML = "";

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastOfMonth.getDate();

    // Lunes-based
    const jsDow = firstOfMonth.getDay();     // 0 Dom .. 6 Sáb
    const mondayBased = (jsDow + 6) % 7;     // 0 Lun .. 6 Dom
    const leadingBlanks = mondayBased;

    for (let i = 0; i < leadingBlanks; i++) {
      const empty = document.createElement("div");
      empty.className = "h-12 sm:h-14 rounded-lg";
      calendar.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(viewYear, viewMonth, day);
      cellDate.setHours(0, 0, 0, 0);

      const isToday = cellDate.toDateString() === new Date().toDateString();
      const shift = isShiftStartDay(cellDate);

      const cell = document.createElement("div");
      cell.className = [
        "relative h-12 sm:h-16 rounded-lg border text-xs sm:text-sm flex flex-col items-center justify-center",
        "border-line bg-white",
        shift ? "ring-2 ring-accent font-semibold" : "",
        isToday ? "outline outline-1 outline-accent/40" : ""
      ].join(" ").trim();

      const dayLabel = document.createElement("div");
      dayLabel.textContent = String(day);
      dayLabel.className = "leading-tight";

      const sub = document.createElement("div");
      sub.className = "mt-0.5 text-[10px] sm:text-[11px] text-muted";
      sub.textContent = shift ? "17:00–05:00" : "\u00A0";

      cell.title = fmtDate(cellDate);
      cell.appendChild(dayLabel);
      cell.appendChild(sub);
      calendar.appendChild(cell);
    }
  }

  // ==== Eventos ====
  buildBtn.addEventListener("click", () => {
    const value = startDateInput.value; // yyyy-mm-dd
    if (!value) {
      alert("Selecciona la fecha de inicio de turno.");
      return;
    }
    setStartFromYMD(value);
    viewYear = startDateMidnight.getFullYear();
    viewMonth = startDateMidnight.getMonth();
    render();
  });

  todayBtn.addEventListener("click", () => {
    // Obtener hoy en formato yyyy-mm-dd (local, sin UTC para evitar desfases)
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    const todayYMD = `${y}-${m}-${d}`;

    // 1) actualizar input
    startDateInput.value = todayYMD;

    // 2) guardar en storage (y cookie de respaldo) + preparar 00:00 y 17:00
    setStartFromYMD(todayYMD);

    // 3) ir al mes actual y renderizar
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    render();
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

  // ==== Inicialización ====
  if (!loadStartFromStorage()) {
    // Sin fecha guardada → vista al mes actual
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
  }
  render();
})();
