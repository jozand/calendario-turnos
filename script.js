/* Calendario 12×48 – Vista mensual con navegación
 * - Ingresas la fecha de inicio (primer día que trabajas).
 * - Muestra 1 mes a la vez, con controles Anterior/Siguiente y selector de mes.
 * - TRABAJA = día de inicio y cada 3 días; DESCANSA = restantes (12×48).
 */

(function () {
  const form = document.getElementById("form");
  const startDateInput = document.getElementById("startDate");
  const setBtn = document.getElementById("setBtn");
  const todayBtn = document.getElementById("todayBtn");

  const navBar = document.getElementById("navBar");
  const monthTitle = document.getElementById("monthTitle");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const monthPicker = document.getElementById("monthPicker");

  const quickBar = document.getElementById("quickBar");
  const goStartBtn = document.getElementById("goStartBtn");
  const goTodayBtn = document.getElementById("goTodayBtn");
  const countsEl = document.getElementById("counts");

  const legend = document.getElementById("legend");
  const calendarEl = document.getElementById("calendar");

  // Estado
  let startDate = null;       // Date (primer día que trabaja)
  let viewYear = null;        // Año mostrado
  let viewMonth = null;       // Mes mostrado (0..11)

  // Rellenar con "hoy"
  todayBtn.addEventListener("click", () => {
    const t = new Date();
    startDateInput.value = toISODate(t);
  });

  // Establecer fecha de inicio y mostrar el mes correspondiente
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const startStr = startDateInput.value;
    if (!startStr) {
      alert("Ingresa la primera fecha que trabajas.");
      return;
    }
    startDate = parseISODate(startStr);
    if (!startDate) {
      alert("Fecha inválida.");
      return;
    }

    // Mes inicial = mes de la fecha de inicio
    viewYear = startDate.getFullYear();
    viewMonth = startDate.getMonth();

    // Mostrar controles y leyenda
    navBar.classList.remove("hidden");
    quickBar.classList.remove("hidden");
    legend.classList.remove("hidden");
    calendarEl.classList.remove("hidden");

    // Sincronizar selector month
    monthPicker.value = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;

    render();
  });

  // Navegación
  prevBtn.addEventListener("click", () => {
    if (viewMonth === 0) {
      viewYear -= 1; viewMonth = 11;
    } else {
      viewMonth -= 1;
    }
    monthPicker.value = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    render();
  });

  nextBtn.addEventListener("click", () => {
    if (viewMonth === 11) {
      viewYear += 1; viewMonth = 0;
    } else {
      viewMonth += 1;
    }
    monthPicker.value = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    render();
  });

  monthPicker.addEventListener("change", () => {
    if (!monthPicker.value) return;
    const [y, m] = monthPicker.value.split("-").map(Number);
    viewYear = y;
    viewMonth = m - 1;
    render();
  });

  goStartBtn.addEventListener("click", () => {
    if (!startDate) return;
    viewYear = startDate.getFullYear();
    viewMonth = startDate.getMonth();
    monthPicker.value = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    render();
  });

  goTodayBtn.addEventListener("click", () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    monthPicker.value = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    render();
  });

  // ---------- Render del mes ----------
  function render() {
    const title = `${monthNameEs(viewMonth)} de ${viewYear}`;
    monthTitle.textContent = title;

    // Construir grid 6x7
    const first = new Date(viewYear, viewMonth, 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay()); // domingo anterior (o igual)

    let workCount = 0, restCount = 0;

    const grid = document.createElement("div");
    grid.className = "grid";
    // Encabezados
    ["DO","LU","MA","MI","JU","VI","SA"].forEach(d => {
      const h = document.createElement("div");
      h.className = "dow";
      h.textContent = d;
      grid.appendChild(h);
    });

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);

      const inMonth = (cellDate.getMonth() === viewMonth);
      const day = document.createElement("div");
      day.className = "day" + (inMonth ? "" : " outside");

      if (inMonth) {
        // Número de día
        const dnum = document.createElement("div");
        dnum.className = "day-num";
        dnum.textContent = String(cellDate.getDate());
        day.appendChild(dnum);

        // Etiqueta según 12×48
        if (isSameOrAfter(cellDate, startDate)) {
          const diff = daysDiffUTC(startDate, cellDate);
          if (diff % 3 === 0) {
            const b = document.createElement("span");
            b.className = "badge work";
            b.textContent = "TRABAJA 17:00–06:00";
            day.appendChild(b);
            workCount++;
          } else {
            const b = document.createElement("span");
            b.className = "badge rest";
            b.textContent = "DESCANSA";
            day.appendChild(b);
            restCount++;
          }
        } else {
          day.classList.add("before");
          const b = document.createElement("span");
          b.className = "badge rest";
          b.textContent = "—";
          day.appendChild(b);
        }
      } else {
        // fuera del mes: celda suave
        const dnum = document.createElement("div");
        dnum.className = "day-num";
        dnum.textContent = "";
        day.appendChild(dnum);
      }

      grid.appendChild(day);
    }

    // Reemplazar contenido
    calendarEl.innerHTML = "";
    calendarEl.appendChild(grid);

    // Totales del mes
    countsEl.textContent = `Trabaja: ${workCount} · Descansa: ${restCount}`;
    calendarEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Utilidades ----------
  function monthNameEs(m) {
    return [
      "Enero","Febrero","Marzo","Abril","Mayo","Junio",
      "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
    ][m];
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseISODate(s) {
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function isSameOrAfter(a, b) {
    return (
      a.getFullYear() > b.getFullYear() ||
      (a.getFullYear() === b.getFullYear() && a.getMonth() > b.getMonth()) ||
      (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() >= b.getDate())
    );
  }

  function daysDiffUTC(a, b) {
    const AU = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const BU = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    const MS = 24 * 60 * 60 * 1000;
    return Math.floor((BU - AU) / MS);
  }
})();
