/* Cierre de unidades por maestro (lo usan index.html y panel-maestro.html).
   Desde la fecha indicada (inclusive, hora de México) la unidad aparece con
   candado para los alumnos y ya no se puede contestar; en el panel, los
   intentos hechos desde esa fecha no cuentan para "Cumplimiento".
   Para cerrar otra unidad, agrega una línea  'id-de-la-unidad': 'AAAA-MM-DD',
   (o 'AAAA-MM-DDTHH:MM' para cerrarla a una hora exacta).
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
    'diag-5': '2026-11-12',
    // Unidades 5 y 6 — se cierran el jueves 26 nov 2026 a las 10:00 p.m.
    'unit5-ingles5': '2026-11-26T22:00',
    'unit6-ingles5': '2026-11-26T22:00'
  },
  esposa: {}
};

/* Fecha límite (opcional) de las unidades abiertas, por maestro. Sale en el
   aviso "Te falta…" que ven los alumnos al entrar. Formato 'AAAA-MM-DD'
   o 'AAAA-MM-DDTHH:MM' si vence a una hora exacta. */
window.UNIT_DEADLINES = {
  jorge: { 'unit5-ingles5': '2026-11-26T22:00', 'unit6-ingles5': '2026-11-26T22:00' },
  esposa: {}
};

// 'AAAA-MM-DD' (00:00 locales) o 'AAAA-MM-DDTHH:MM' → Date.
window.parseUnitDate = function(s){
  if (!s) return null;
  return new Date(s.includes('T') ? (s.length === 16 ? s + ':00' : s) : s + 'T00:00:00');
};
window.unitDateHasTime = function(s){ return !!s && s.includes('T'); };

// Fecha de cierre (Date) o null si la unidad sigue abierta.
window.unitClosingDate = function(teacherId, unitId){
  const day = ((window.UNIT_CLOSINGS || {})[teacherId] || {})[unitId];
  return window.parseUnitDate(day);
};

window.isUnitClosed = function(teacherId, unitId, when){
  const d = window.unitClosingDate(teacherId, unitId);
  return !!d && (when || new Date()) >= d;
};
