/* ---------- Logros: XP, racha, misión del día, insignias y liga semanal ----------
   Etapa 1 del plan de mejoras (9 nov 2026).
   - Cada alumno tiene un documento en la colección `gamification` de Firestore
     (uno por profesor + semestre + nombre). Si Firestore no deja escribir
     (regla no publicada, sin internet), todo sigue funcionando en el teléfono
     con localStorage y se sube después.
   - XP: respuesta correcta nueva +10, oración de shadowing practicada +5,
     pronunciación de 80 o más +5, unidad completa sin errores +30. Cada cosa
     da XP una sola vez por alumno.
   - Misión del día: ganar 30 XP. Cumplirla suma un día a la racha.
   - Racha: sábado y domingo no la rompen. Hay un comodín por semana que
     cubre un día entre semana que no se hizo la misión.
   - Liga semanal: suma del XP de la semana (lunes a domingo) de cada grupo.
   Este archivo lo cargan index.html (alumno) y panel-maestro.html (maestro). */
(function(){
  const XP = { question: 10, shadow: 5, pron: 5, unit: 30 };
  const MISSION_XP = 30;
  const BADGES = [
    { id: 'primer-paso', icon: '👣', name: 'Primer paso',        desc: 'Ganaste tus primeros XP' },
    { id: 'mision-1',    icon: '✅', name: 'Misión cumplida',    desc: 'Completaste tu primera misión del día' },
    { id: 'racha-3',     icon: '🔥', name: 'Racha de 3',         desc: '3 días seguidos con la misión cumplida' },
    { id: 'racha-7',     icon: '🔥', name: 'Racha de 7',         desc: '7 días seguidos con la misión cumplida' },
    { id: 'racha-15',    icon: '🌋', name: 'Racha de 15',        desc: '15 días seguidos con la misión cumplida' },
    { id: 'unidad',      icon: '📘', name: 'Unidad perfecta',    desc: 'Todas las respuestas correctas en una unidad' },
    { id: 'pron-90',     icon: '🎯', name: 'Pronunciación 90+',  desc: 'Sacaste 90 o más en una evaluación de pronunciación' },
    { id: 'xp-500',      icon: '⭐', name: '500 XP',             desc: 'Juntaste 500 XP' },
    { id: 'xp-1500',     icon: '🌟', name: '1500 XP',            desc: 'Juntaste 1500 XP' },
    { id: 'misiones-10', icon: '🏅', name: '10 misiones',        desc: 'Cumpliste 10 misiones del día' }
  ];
  const FIELDS = ['teacherId','semester','studentName','studentNameKey','studentGroup','xp','weekId','weekXp',
    'prevWeekId','prevWeekXp','missionDay','missionXp','missionsDone','streak','bestStreak','lastStreakDay',
    'freezeWeek','badges','awarded','updatedAt'];

  // ---- Fechas (hora local del teléfono) ----
  const pad = n => String(n).padStart(2, '0');
  function dayKey(d){ d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseDay(k){ const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function weekId(d){ d = d ? new Date(d) : new Date(); const dow = (d.getDay() + 6) % 7; return dayKey(addDays(d, -dow)); }
  function lastWeekId(){ return weekId(addDays(new Date(), -7)); }
  // Días entre semana (lun-vie) estrictamente entre dos días.
  function weekdaysBetween(fromKey, toKey){
    let n = 0;
    for (let d = addDays(parseDay(fromKey), 1); dayKey(d) < toKey; d = addDays(d, 1)) {
      const w = d.getDay();
      if (w !== 0 && w !== 6) n++;
    }
    return n;
  }
  function weekLabel(id){
    const d = parseDay(id);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  // Racha que se muestra hoy (0 si ya se rompió).
  function streakOf(s){
    if (!s || !s.lastStreakDay) return 0;
    const today = dayKey();
    if (s.lastStreakDay === today) return Number(s.streak) || 0;
    const missed = weekdaysBetween(s.lastStreakDay, today);
    const freeze = s.freezeWeek !== weekId() ? 1 : 0;
    return missed <= freeze ? Number(s.streak) || 0 : 0;
  }

  /* Liga por PROMEDIO (pedido de Jorge, 10 nov 2026): los grupos tienen
     distinto número de alumnos, así que gana el grupo con más XP por alumno.
     XP de la semana del grupo ÷ alumnos inscritos en el grupo.
     Pon aquí cuántos alumnos tiene cada grupo. Si un grupo no está, se usa
     cuántos alumnos de ese grupo ya entraron a la plataforma este semestre. */
  const GROUP_SIZES = {
    jorge:  { /* '5AVG': 45, '5AVC': 40, ... */ },
    esposa: { }
  };
  // XP de un alumno en una semana dada (su semana actual o la anterior).
  function xpInWeek(d, id){
    if (d.weekId === id) return Number(d.weekXp) || 0;
    if (d.prevWeekId === id) return Number(d.prevWeekXp) || 0;
    return 0;
  }
  // docs: documentos de un profesor y semestre. Devuelve los grupos
  // ordenados por promedio: [{ g, xp, active, size, avg }].
  function rankGroups(docs, id, teacherId, groups){
    const sizes = GROUP_SIZES[teacherId] || {};
    const t = {};
    (groups || []).forEach(g => { t[g] = { g, xp: 0, active: 0, registered: 0 }; });
    docs.forEach(d => {
      const g = d.studentGroup;
      if (!g) return;
      t[g] = t[g] || { g, xp: 0, active: 0, registered: 0 };
      t[g].registered++;
      const x = xpInWeek(d, id);
      if (x > 0) { t[g].xp += x; t[g].active++; }
    });
    return Object.values(t).map(r => {
      const size = Number(sizes[r.g]) || r.registered || 1;
      const sizeKnown = !!(Number(sizes[r.g]) || r.registered);
      return { ...r, size, sizeKnown, avg: Math.round(r.xp / size) };
    }).sort((a, b) => b.avg - a.avg || b.xp - a.xp);
  }

  window.Logros = { XP, MISSION_XP, BADGES, GROUP_SIZES, dayKey, weekId, lastWeekId, weekLabel, streakOf, xpInWeek, rankGroups };

  // Lo demás es solo para la página del alumno.
  if (typeof window.getDb !== 'function' || !document.getElementById('appContent')) return;

  let state = null;       // documento del alumno
  let docId = null;
  let loading = null;
  let loaded = false;
  let saveTimer = null;

  const cacheKey = () => `logros:${docId}`;
  function lsGet(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function freshState(){
    return { teacherId: selectedTeacherId, semester: Number(selectedSemester), studentName, studentNameKey,
      studentGroup, xp: 0, weekId: weekId(), weekXp: 0, prevWeekId: '', prevWeekXp: 0,
      missionDay: dayKey(), missionXp: 0, missionsDone: 0, streak: 0, bestStreak: 0, lastStreakDay: '',
      freezeWeek: '', badges: [], awarded: {}, updatedAt: 0 };
  }
  function clean(s){
    const out = {}, fresh = freshState();
    FIELDS.forEach(f => { out[f] = s[f] === undefined ? fresh[f] : s[f]; });
    out.badges = Array.isArray(out.badges) ? out.badges.slice() : [];
    out.awarded = Object.assign({}, out.awarded || {});
    return out;
  }

  // Se llama al entrar (startSession).
  function load(){
    if (!studentNameKey) return Promise.resolve();
    docId = `${selectedTeacherId}_${selectedSemester}_${studentNameKey}`.replace(/[^a-z0-9_]+/g, '-');
    loaded = false;
    state = clean(lsGet(cacheKey()) || freshState());
    rollOver();
    render();
    loading = getDb()
      .then(db => db.collection('gamification').doc(docId).get())
      .then(snap => {
        const remote = snap.exists ? snap.data() : null;
        if (remote && (Number(remote.xp) || 0) >= state.xp) {
          const local = state.awarded;
          state = clean(remote);
          state.awarded = Object.assign({}, local, state.awarded);
        } else if (remote) {
          state.awarded = Object.assign({}, remote.awarded || {}, state.awarded);
        }
        state.studentName = studentName;
        state.studentGroup = studentGroup;
        rollOver();
        render();
        if (!remote || remote.xp < state.xp) scheduleSave();
      })
      .catch(err => console.warn('Logros: no se pudo leer Firestore', err))
      .then(() => { loaded = true; });
    return loading;
  }

  // Cambio de día o de semana.
  function rollOver(){
    const today = dayKey(), wk = weekId();
    if (state.weekId !== wk) {
      state.prevWeekId = state.weekId;
      state.prevWeekXp = state.weekXp;
      state.weekId = wk;
      state.weekXp = 0;
    }
    if (state.missionDay !== today) { state.missionDay = today; state.missionXp = 0; }
  }

  const liveStreak = () => streakOf(state);

  function completeMission(){
    const today = dayKey();
    if (state.lastStreakDay === today) return;
    let usedFreeze = false;
    if (!state.lastStreakDay) state.streak = 1;
    else {
      const missed = weekdaysBetween(state.lastStreakDay, today);
      if (missed === 0) state.streak += 1;
      else if (missed === 1 && state.freezeWeek !== weekId()) { state.streak += 1; state.freezeWeek = weekId(); usedFreeze = true; }
      else state.streak = 1;
    }
    state.lastStreakDay = today;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.missionsDone += 1;
    toast(usedFreeze
      ? `✅ ¡Misión del día cumplida! 🧊 Usaste tu comodín de la semana y tu racha sigue: ${state.streak} días 🔥`
      : `✅ ¡Misión del día cumplida! Racha: ${state.streak} ${state.streak === 1 ? 'día' : 'días'} 🔥`);
  }

  function giveBadge(id){
    if (state.badges.includes(id)) return;
    const b = BADGES.find(x => x.id === id);
    if (!b) return;
    state.badges.push(id);
    setTimeout(() => toast(`${b.icon} Nueva insignia: ${b.name}`), 1800);
  }
  function badge(id){
    if (!state || state.badges.includes(id)) return;
    giveBadge(id);
    render();
    scheduleSave();
  }
  function checkBadges(){
    if (state.xp > 0) giveBadge('primer-paso');
    if (state.missionsDone >= 1) giveBadge('mision-1');
    if (state.missionsDone >= 10) giveBadge('misiones-10');
    if (state.streak >= 3) giveBadge('racha-3');
    if (state.streak >= 7) giveBadge('racha-7');
    if (state.streak >= 15) giveBadge('racha-15');
    if (state.xp >= 500) giveBadge('xp-500');
    if (state.xp >= 1500) giveBadge('xp-1500');
  }

  // key: algo único (unidad + pregunta + tipo) para no dar XP dos veces.
  function award(key, amount, label){
    if (!state || !amount || state.awarded[key]) return;
    if (!loaded && loading) { loading.then(() => award(key, amount, label)); return; }
    state.awarded[key] = 1;
    rollOver();
    const before = state.missionXp;
    state.xp += amount;
    state.weekXp += amount;
    state.missionXp += amount;
    toast(`+${amount} XP${label ? ' · ' + label : ''}`);
    if (before < MISSION_XP && state.missionXp >= MISSION_XP) completeMission();
    checkBadges();
    render();
    scheduleSave();
  }

  function scheduleSave(){
    if (!state) return;
    state.studentGroup = studentGroup;
    state.studentName = studentName;
    lsSet(cacheKey(), state);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1500);
  }
  function save(){
    clearTimeout(saveTimer);
    if (!state || !docId) return;
    const data = clean(state);
    data.updatedAt = Date.now();
    getDb().then(db => db.collection('gamification').doc(docId).set(data))
      .catch(err => console.warn('Logros: no se pudo guardar en Firestore', err));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveTimer) save();
  });

  // ---- Interfaz ----
  let toastQueue = [], toastBusy = false;
  function toast(msg){
    toastQueue.push(msg);
    if (!toastBusy) nextToast();
  }
  function nextToast(){
    const el = document.getElementById('logrosToast');
    const msg = toastQueue.shift();
    if (!el || !msg) { toastBusy = false; return; }
    toastBusy = true;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 250); }, 1700);
  }

  function render(){
    const bar = document.getElementById('logrosBar');
    if (!bar || !state) return;
    const streak = liveStreak();
    const pct = Math.min(100, Math.round(state.missionXp / MISSION_XP * 100));
    const done = state.missionXp >= MISSION_XP;
    bar.style.display = '';
    bar.querySelector('[data-l="streak"]').textContent = streak;
    bar.querySelector('[data-l="streakWord"]').textContent = streak === 1 ? 'día' : 'días';
    bar.querySelector('[data-l="xp"]').textContent = state.xp;
    bar.querySelector('[data-l="badges"]').textContent = state.badges.length;
    bar.querySelector('[data-l="fill"]').style.width = pct + '%';
    bar.querySelector('[data-l="mission"]').textContent = done
      ? `✅ Misión del día cumplida (${state.missionXp} XP hoy)`
      : `Misión del día: gana ${MISSION_XP} XP · llevas ${state.missionXp}`;
    bar.classList.toggle('mission-done', done);
  }

  function showBadges(){
    const box = document.getElementById('logrosPanel');
    if (!box || !state) return;
    if (box.dataset.view === 'badges') { box.dataset.view = ''; box.innerHTML = ''; return; }
    box.dataset.view = 'badges';
    box.innerHTML = `<div class="logros-badges">${BADGES.map(b => {
      const has = state.badges.includes(b.id);
      return `<div class="logros-badge${has ? ' has' : ''}"><div class="logros-badge-icon">${has ? b.icon : '🔒'}</div>
        <div><b>${b.name}</b><br><small>${b.desc}</small></div></div>`;
    }).join('')}</div>
    <p class="logros-note">Mejor racha: ${state.bestStreak} ${state.bestStreak === 1 ? 'día' : 'días'} · Misiones cumplidas: ${state.missionsDone}.
    Sábado y domingo no rompen tu racha, y tienes 1 comodín por semana si un día entre semana no haces la misión.</p>`;
  }

  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function showLeague(){
    const box = document.getElementById('logrosPanel');
    if (!box) return;
    if (box.dataset.view === 'league') { box.dataset.view = ''; box.innerHTML = ''; return; }
    box.dataset.view = 'league';
    box.innerHTML = '<div class="logros-note">Cargando la liga...</div>';
    if (saveTimer) save();
    try {
      const db = await getDb();
      const snap = await db.collection('gamification')
        .where('teacherId', '==', selectedTeacherId)
        .where('semester', '==', Number(selectedSemester))
        .get();
      const wk = weekId(), lw = lastWeekId();
      const all = typeof GROUPS_BY_TEACHER_SEMESTER !== 'undefined' ? GROUPS_BY_TEACHER_SEMESTER : {};
      const groups = (all[selectedTeacherId] || {})[selectedSemester] || [];
      const docs = snap.docs.map(d => d.data());
      // Si este alumno todavía no se sube, cuenta lo de este teléfono.
      const i = docs.findIndex(d => d.studentNameKey === studentNameKey);
      if (state) { if (i >= 0) docs[i] = state; else docs.push(state); }
      const ranking = rankGroups(docs, wk, selectedTeacherId, groups);
      const prevRanking = rankGroups(docs, lw, selectedTeacherId, groups);
      const prevWinner = prevRanking[0] && prevRanking[0].xp > 0 ? prevRanking[0] : null;
      const nowDocs = docs.map(d => ({ ...d, weekXp: xpInWeek(d, wk) }));
      const mine = nowDocs.filter(d => d.studentGroup === studentGroup && Number(d.weekXp) > 0)
        .sort((a, b) => b.weekXp - a.weekXp).slice(0, 5);
      const medal = i => ['🥇','🥈','🥉'][i] || `${i + 1}.`;
      box.innerHTML = `
        <div class="logros-league">
          <div class="logros-league-title">🏆 Liga de la semana del ${weekLabel(wk)}</div>
          ${prevWinner ? `<div class="logros-note">Ganador de la semana pasada: <b>${esc(prevWinner.g)}</b> (${prevWinner.avg} XP por alumno)</div>` : ''}
          <table>
            <tr><th></th><th>Grupo</th><th>XP por alumno</th><th>Activos</th></tr>
            ${ranking.map((r, i) => `<tr class="${r.g === studentGroup ? 'me' : ''}"><td>${medal(i)}</td><td>${esc(r.g)}</td><td>${r.avg}</td><td>${r.sizeKnown ? `${r.active} de ${r.size}` : '0'}</td></tr>`).join('')}
          </table>
          <div class="logros-league-title" style="margin-top:14px;">Top 5 de ${esc(studentGroup)} esta semana</div>
          ${mine.length ? `<table>${mine.map((d, i) => `<tr class="${d.studentNameKey === studentNameKey ? 'me' : ''}"><td>${medal(i)}</td><td>${esc(d.studentName)}</td><td>${d.weekXp} XP</td></tr>`).join('')}</table>`
            : '<div class="logros-note">Nadie de tu grupo ha ganado XP esta semana. ¡Sé el primero!</div>'}
          <p class="logros-note">Gana el grupo con más XP por alumno de lunes a domingo (XP del grupo ÷ número de alumnos). Si no participas, tu grupo baja: ¡cada respuesta correcta cuenta!</p>
        </div>`;
    } catch (err) {
      console.warn('Logros: no se pudo cargar la liga', err);
      box.innerHTML = '<div class="logros-note">⚠ No se pudo cargar la liga ahorita. Revisa tu conexión e intenta otra vez.</div>';
    }
  }

  Object.assign(window.Logros, { load, award, badge, render, showBadges, showLeague, liveStreak });
})();
