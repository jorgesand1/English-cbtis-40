/* Cierre de unidades por maestro (lo usan index.html y panel-maestro.html).
   Desde la fecha indicada (inclusive, hora de México) la unidad aparece con
   candado para los alumnos y ya no se puede contestar; en el panel, los
   intentos hechos desde esa fecha no cuentan para "Cumplimiento".
   Para cerrar otra unidad, agrega una línea  'id-de-la-unidad': 'AAAA-MM-DD',
   Para volver a abrirla, borra su línea. */
window.UNIT_CLOSINGS = {
  jorge: {
    // 1.er parcial (P1–P4) — cerrado el 27 oct 2026
    'unit1-ingles5': '2026-10-27',
    'unit2-ingles5': '2026-10-27',
    'unit3-ingles5': '2026-10-27',
    'unit4-ingles5': '2026-10-27',
    // Prácticas del 1.er parcial — cerradas el 12 nov 2026
    'pron-j-5': '2026-11-12',
    'shadowing-5': '2026-11-12',
    'diag-5': '2026-11-12'
  },
  esposa: {}
};

/* Fecha límite (opcional) de las unidades abiertas, por maestro. Sale en el
   aviso "Te falta…" que ven los alumnos al entrar. Formato 'AAAA-MM-DD'. */
window.UNIT_DEADLINES = {
  jorge: {},
  esposa: {}
};

// Fecha de cierre (Date a las 00:00 locales) o null si la unidad sigue abierta.
window.unitClosingDate = function(teacherId, unitId){
  const day = ((window.UNIT_CLOSINGS || {})[teacherId] || {})[unitId];
  return day ? new Date(day + 'T00:00:00') : null;
};

window.isUnitClosed = function(teacherId, unitId, when){
  const d = window.unitClosingDate(teacherId, unitId);
  return !!d && (when || new Date()) >= d;
};
