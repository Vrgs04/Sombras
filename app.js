/* Sombras — MVP (1 dispositivo, sin pistas en pantalla)
   - 1 o 2 Sombras reciben palabra distorsionada
   - Rondas = ciclos de discusión con timer
   - Votación por turnos, al terminar aparece "Confirmar votos"
*/

const $ = (sel) => document.querySelector(sel);

const screens = {
  setup: $("#screen-setup"),
  players: $("#screen-players"),
  reveal: $("#screen-reveal"),
  discussion: $("#screen-discussion"),
  vote: $("#screen-vote"),
  results: $("#screen-results"),
};

const phasePill = $("#phasePill");

const state = {
  players: [],

  // config
  roundCount: 3,
  discussionSeconds: 180,
  impostorCount: 1,
  hintEnabled: true,

  // setup names
  setupNames: [],
  draftNames: [],

  // deck + chosen
  deck: [],
  chosenPair: null,
  shadowIds: [],

  // flow
  phase: "setup",
  revealIndex: 0,
  currentRound: 1,

  discussionLeft: 0,
  timerHandle: null,

  voteTurnIndex: 0,
  votes: [], // { voterId, targetId }
};

const DECK = [
  { correct: "Pizza", distorted: "Hamburguesa" },
  { correct: "Playa", distorted: "Alberca" },
  { correct: "Lluvia", distorted: "Niebla" },
  { correct: "Cine", distorted: "Teatro" },
  { correct: "Bicicleta", distorted: "Patineta" },
  { correct: "Fuego", distorted: "Electricidad" },
  { correct: "Doctor", distorted: "Veterinario" },
  { correct: "Escuela", distorted: "Oficina" },
  { correct: "Café", distorted: "Té" },
  { correct: "Navidad", distorted: "Año Nuevo" },
  { correct: "Concierto", distorted: "Fiesta" },
  { correct: "Aeropuerto", distorted: "Terminal de autobuses" },
  { correct: "Desierto", distorted: "Selva" },
  { correct: "Montaña", distorted: "Bosque" },
  { correct: "Fútbol", distorted: "Básquetbol" },
  { correct: "Videojuego", distorted: "Juego de mesa" },
  { correct: "Robot", distorted: "Dron" },
  { correct: "Streaming", distorted: "Televisión" },
  { correct: "Mecánico", distorted: "Ingeniero" },
  { correct: "TikTok LIVE", distorted: "YouTube LIVE" },
];

init();

function init() {
  state.deck = [...DECK];

  // Defaults
  const n = clamp(parseInt($("#playerCount").value || "5", 10), 3, 12);
  state.setupNames = Array.from({ length: n }, (_, i) => defaultName(i));

  // menu UI
  $("#btnStart").addEventListener("click", startGame);
  $("#rowPlayers").addEventListener("click", openPlayers);
  $("#rowImpostors").addEventListener("click", editImpostors);
  $("#rowDuration").addEventListener("click", editDuration);
  $("#rowRounds").addEventListener("click", editRounds);
  $("#hintToggle").addEventListener("change", (e) => state.hintEnabled = !!e.target.checked);

  $("#btnSettings").addEventListener("click", () => alert("Ajustes: próximamente 😄"));
  $("#btnHelp").addEventListener("click", () =>
    alert("Modo clásico: pistas en persona. Usa el cronómetro para cada ronda, luego voten.")
  );

  // players screen
  $("#btnPlayersBack").addEventListener("click", closePlayers);
  $("#btnPlayersCancel").addEventListener("click", closePlayers);
  $("#btnPlayersSave").addEventListener("click", savePlayers);
  $("#btnPCountMinus").addEventListener("click", () => changeCount(-1));
  $("#btnPCountPlus").addEventListener("click", () => changeCount(+1));

  // reveal
  $("#revealMask").addEventListener("click", () => $("#revealMask").classList.add("hidden"));
  $("#btnConfirmSeen").addEventListener("click", nextReveal);

  // discussion
  $("#btnAddTime").addEventListener("click", () => addTime(30));
  $("#btnToVote").addEventListener("click", goVote);
  $("#btnNextRound").addEventListener("click", nextRound);

  // vote
  $("#btnCastVote").addEventListener("click", castVote);
  $("#btnConfirmVotes").addEventListener("click", confirmVotes);

  // results
  $("#btnNewGame").addEventListener("click", () => location.reload());

  refreshMenuLabels();
  goto("setup");
}

/* ========= MENU ========= */

function refreshMenuLabels() {
  $("#playerCount").value = String(state.setupNames.length);
  $("#playersLabel").textContent = String(state.setupNames.length);

  $("#impostorCount").value = String(state.impostorCount);
  $("#impostorsLabel").textContent = String(state.impostorCount);

  $("#discussionSeconds").value = String(state.discussionSeconds);
  const mins = Math.max(1, Math.round(state.discussionSeconds / 60));
  $("#durationLabel").textContent = `${mins} minutos`;

  $("#roundCount").value = String(state.roundCount);
  $("#roundsLabel").textContent = String(state.roundCount);

  $("#hintToggle").checked = state.hintEnabled;
}

function editImpostors() {
  const v = prompt("Impostores (1 o 2)", String(state.impostorCount));
  if (v === null) return;
  state.impostorCount = clamp(parseInt(v, 10) || state.impostorCount, 1, 2);
  refreshMenuLabels();
}

function editDuration() {
  const v = prompt("Tiempo por ronda (segundos) 15–600", String(state.discussionSeconds));
  if (v === null) return;
  state.discussionSeconds = clamp(parseInt(v, 10) || state.discussionSeconds, 15, 600);
  refreshMenuLabels();
}

function editRounds() {
  const v = prompt("Rondas (2–6)", String(state.roundCount));
  if (v === null) return;
  state.roundCount = clamp(parseInt(v, 10) || state.roundCount, 2, 6);
  refreshMenuLabels();
}

/* ========= JUGADORES ========= */

function openPlayers() {
  state.draftNames = [...state.setupNames];
  renderPlayersEditor();
  goto("players");
}

function closePlayers() {
  goto("setup");
  refreshMenuLabels();
}

function savePlayers() {
  state.setupNames = state.draftNames.map((n, i) => (n || "").trim() || defaultName(i));
  closePlayers();
}

function changeCount(delta) {
  let n = state.draftNames.length;
  n = clamp(n + delta, 3, 12);
  const cur = [...state.draftNames];
  state.draftNames = Array.from({ length: n }, (_, i) => cur[i] ?? defaultName(i));
  renderPlayersEditor();
}

function renderPlayersEditor() {
  $("#pCountLabel").textContent = String(state.draftNames.length);

  const list = $("#playersList");
  list.innerHTML = "";

  for (let i = 0; i < state.draftNames.length; i++) {
    const row = document.createElement("div");
    row.className = "pRow";
    row.innerHTML = `
      <div class="pIdx">${i + 1}</div>
      <input type="text" data-pname="${i}" value="${escapeHtml(state.draftNames[i] || defaultName(i))}" placeholder="Nombre..." />
    `;
    list.appendChild(row);
  }

  list.querySelectorAll("[data-pname]").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = parseInt(inp.getAttribute("data-pname"), 10);
      state.draftNames[idx] = inp.value;
    });
  });

  $("#btnPCountMinus").disabled = (state.draftNames.length <= 3);
  $("#btnPCountPlus").disabled = (state.draftNames.length >= 12);
}

/* ========= JUEGO ========= */

function startGame() {
  const n = clamp(parseInt($("#playerCount").value || "5", 10), 3, 12);
  state.roundCount = clamp(parseInt($("#roundCount").value || "3", 10), 2, 6);
  state.discussionSeconds = clamp(parseInt($("#discussionSeconds").value || "180", 10), 15, 600);
  state.impostorCount = clamp(parseInt($("#impostorCount").value || "1", 10), 1, 2);

  const names = getSetupNames(n);

  state.chosenPair = state.deck[Math.floor(Math.random() * state.deck.length)];
  const shuffledIds = Array.from({ length: n }, (_, id) => id).sort(() => Math.random() - 0.5);
  const impostors = Math.min(state.impostorCount, Math.max(1, n - 1));
  state.shadowIds = shuffledIds.slice(0, impostors);
  const shadowSet = new Set(state.shadowIds);

  state.players = Array.from({ length: n }, (_, id) => ({
    id,
    name: names[id],
    role: shadowSet.has(id) ? "Sombra" : "Luz",
    word: shadowSet.has(id) ? state.chosenPair.distorted : state.chosenPair.correct,
  }));

  state.revealIndex = 0;
  state.currentRound = 1;

  state.votes = [];
  state.voteTurnIndex = 0;

  goto("reveal");
  renderReveal();
}

function renderReveal() {
  const p = state.players[state.revealIndex];
  $("#revealPrompt").textContent = `Turno de: ${p.name}. Pasa el dispositivo.`;

  $("#revealMask").classList.remove("hidden");
  $("#playerWord").textContent = p.word;
  $("#playerRole").textContent = (p.role === "Sombra")
    ? "Rol: SOMBRA (tu realidad está distorsionada)"
    : "Rol: LUZ (tienes la palabra correcta)";

  const hintEl = $("#shadowHint");
  if (p.role === "Sombra" && state.hintEnabled) {
    hintEl.style.display = "block";
    hintEl.textContent = `Pista: La palabra real está cerca de “${p.word}”. Mantente coherente.`;
  } else {
    hintEl.style.display = "none";
    hintEl.textContent = "";
  }
}

function nextReveal() {
  $("#revealMask").classList.remove("hidden");

  state.revealIndex++;
  if (state.revealIndex >= state.players.length) {
    goto("discussion");
    renderDiscussion();
    startTimer(state.discussionSeconds);
    return;
  }
  renderReveal();
}

function renderDiscussion() {
  $("#discTitle").textContent = `Discusión — Ronda ${state.currentRound} de ${state.roundCount}`;
  $("#discText").textContent = "Hablen en persona. Usen el cronómetro para cerrar cada ronda.";

  $("#btnNextRound").disabled = (state.currentRound >= state.roundCount);
}

function nextRound() {
  if (state.currentRound >= state.roundCount) return;
  stopTimer();
  state.currentRound++;
  renderDiscussion();
  startTimer(state.discussionSeconds);
}

/* ========= VOTACIÓN (mejorada) ========= */

function goVote() {
  stopTimer();
  goto("vote");

  state.voteTurnIndex = 0;
  state.votes = [];

  $("#btnConfirmVotes").classList.add("hidden");

  $("#voteNeed").textContent = String(state.players.length);
  updateVoteProgress();

  renderVoteTurn();
}

function renderVoteTurn() {
  const voter = state.players[state.voteTurnIndex];

  $("#voteTurnTag").textContent = `Vota: ${voter.name}`;
  $("#voteTurnIdx").textContent = String(state.voteTurnIndex + 1);
  $("#voteTurnTotal").textContent = String(state.players.length);

  const sel = $("#voteSelect");
  sel.innerHTML = "";

  // solo votar por otro
  const opts = state.players.filter(p => p.id !== voter.id);
  for (const p of opts) {
    const o = document.createElement("option");
    o.value = String(p.id);
    o.textContent = p.name;
    sel.appendChild(o);
  }
}

function castVote() {
  const voter = state.players[state.voteTurnIndex];
  const targetId = parseInt($("#voteSelect").value, 10);

  // guarda voto
  state.votes.push({ voterId: voter.id, targetId });

  state.voteTurnIndex++;

  updateVoteProgress();

  if (state.voteTurnIndex >= state.players.length) {
    // Ya votaron todos → mostrar Confirmar
    $("#voteTurnTag").textContent = "Votación completa";
    $("#btnCastVote").disabled = true;
    $("#btnConfirmVotes").classList.remove("hidden");
    return;
  }

  renderVoteTurn();
}

function updateVoteProgress() {
  $("#voteDone").textContent = String(state.votes.length);
  const need = state.players.length;
  const pct = need === 0 ? 0 : Math.round((state.votes.length / need) * 100);
  $("#voteBar").style.width = `${pct}%`;
  $("#btnCastVote").disabled = false;
}

function confirmVotes() {
  // aquí ya todo está guardado, solo pasamos a resultados
  showResults();
}

/* ========= RESULTADOS ========= */

function showResults() {
  goto("results");

  const counts = new Map();
  for (const p of state.players) counts.set(p.id, 0);
  for (const v of state.votes) counts.set(v.targetId, (counts.get(v.targetId) || 0) + 1);

  const sorted = [...counts.entries()].sort((a,b) => b[1]-a[1]);
  const topCount = sorted[0]?.[1] ?? 0;
  const tied = sorted.filter(([_, c]) => c === topCount).map(([id]) => id);

  const shadowSet = new Set(state.shadowIds);
  const totalShadows = state.shadowIds.length;

  let winner = "Sombra";
  let detail = "";

  if (tied.length > 1) {
    winner = "Sombra";
    detail = `Hubo empate en el primer lugar. La Sombra se salvó.`;
  } else {
    const topId = tied[0];
    if (shadowSet.has(topId)) {
      winner = "Grupo";
      const topP = state.players.find(p => p.id === topId);
      if (totalShadows === 1) {
        detail = `Identificaron correctamente a ${topP?.name || "la Sombra"}.`;
      } else {
        detail = `Identificaron correctamente a ${topP?.name || "una Sombra"}. (Acertaron 1 de ${totalShadows})`;
      }
    } else {
      const topP = state.players.find(p => p.id === topId);
      winner = "Sombra";
      detail = `Votaron principalmente por ${topP?.name || "otro jugador"}, así que la Sombra pasó desapercibida.`;
    }
  }

  $("#winnerText").textContent = (winner === "Grupo") ? "Gana el Grupo (Luz)" : "Gana la Sombra";
  $("#winnerDetail").textContent = detail;

  const vr = $("#voteResults");
  vr.innerHTML = "";
  for (const [id, c] of sorted) {
    const p = state.players.find(x => x.id === id);
    const meta = shadowSet.has(id) ? "SOMBRA" : "Luz";
    vr.appendChild(makeItem(p.name, `Votos: ${c}`, meta));
  }

  const ra = $("#revealAll");
  ra.innerHTML = "";
  for (const p of state.players) {
    const role = shadowSet.has(p.id) ? "SOMBRA" : "Luz";
    ra.appendChild(makeItem(p.name, `Palabra: ${p.word}`, role));
  }
}

/* ========= TIMER ========= */

function startTimer(seconds) {
  stopTimer();
  state.discussionLeft = seconds;
  tickTimer();
  state.timerHandle = setInterval(() => {
    state.discussionLeft--;
    tickTimer();
    if (state.discussionLeft <= 0) {
      stopTimer();
      $("#timerText").textContent = "00:00";
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerHandle) clearInterval(state.timerHandle);
  state.timerHandle = null;
}

function addTime(sec) {
  state.discussionLeft = clamp(state.discussionLeft + sec, 0, 9999);
  tickTimer();
}

function tickTimer() {
  $("#timerText").textContent = formatTime(state.discussionLeft);
}

/* ========= NAV ========= */

function goto(phase) {
  state.phase = phase;
  phasePill.textContent = labelPhase(phase);

  for (const k of Object.keys(screens)) screens[k].classList.add("hidden");
  screens[phase].classList.remove("hidden");

  if (phase !== "discussion") stopTimer();
}

function labelPhase(p) {
  switch(p){
    case "setup": return "Menú";
    case "players": return "Jugadores";
    case "reveal": return "Revelación";
    case "discussion": return "Discusión";
    case "vote": return "Votación";
    case "results": return "Resultados";
    default: return "—";
  }
}

/* ========= HELPERS ========= */

function defaultName(i) {
  const base = ["Ana","Luis","Dani","Sofi","Iván","Fer","Karla","Diego","Vale","Mau","Luna","Alex"];
  return base[i] || `Jugador ${i+1}`;
}

function getSetupNames(n){
  if (!state.setupNames || state.setupNames.length === 0){
    return Array.from({length:n}, (_,i)=> defaultName(i));
  }
  const arr = state.setupNames.slice(0, n);
  while (arr.length < n) arr.push(defaultName(arr.length));
  return arr.map((v,i)=> (v||"").trim() || defaultName(i));
}

function makeItem(who, text, meta) {
  const div = document.createElement("div");
  div.className = "item";
  div.innerHTML = `
    <div class="topline">
      <div class="who">${escapeHtml(who)}</div>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
    <div class="txt">${escapeHtml(text)}</div>
  `;
  return div;
}

function formatTime(sec) {
  const s = Math.max(0, sec|0);
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
