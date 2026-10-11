const FALLBACK = { programs: [
  { id: "boxing-base", title: "Boxing Base", focus: "boxing", level: "beginner", durationMin: 45, equipment: ["bag"], exercises: [{ name: "Shadow boxing", sets: 3, reps: "3 min", restSec: 60, workSec: 180 }] }
]};

const state = { programs: [], log: JSON.parse(localStorage.getItem("trainerLog") || "[]") };

/* ---------------- programs ---------------- */

async function loadPrograms() {
  try {
    const res = await fetch("data/workouts.json");
    if (!res.ok) throw new Error("fetch failed");
    state.programs = (await res.json()).programs;
  } catch {
    state.programs = FALLBACK.programs;
  }
  fillFilters();
  render();
}

function fillFilters() {
  const focuses = [...new Set(state.programs.map(p => p.focus))];
  const levels = [...new Set(state.programs.map(p => p.level))];
  const f = document.getElementById("focusFilter");
  const l = document.getElementById("levelFilter");
  focuses.forEach(v => f.insertAdjacentHTML("beforeend", `<option>${v}</option>`));
  levels.forEach(v => l.insertAdjacentHTML("beforeend", `<option>${v}</option>`));
  f.onchange = l.onchange = render;
}

function render() {
  const focus = document.getElementById("focusFilter").value;
  const level = document.getElementById("levelFilter").value;
  const list = state.programs.filter(p =>
    (focus === "all" || p.focus === focus) && (level === "all" || p.level === level));
  document.getElementById("programs").innerHTML = list.map(p => `
    <article class="card">
      <h3>${p.title}</h3>
      <p class="meta">${p.focus} · ${p.level} · ${p.durationMin} min · ${p.equipment.join(", ")}</p>
      <ul>${p.exercises.map(e => `<li>${e.name} — ${e.sets}×${e.reps} (rest ${e.restSec}s)</li>`).join("")}</ul>
      <button type="button" class="start-timer" data-id="${p.id}">Start timer</button>
    </article>`).join("") || "<p>No programs match.</p>";
  renderLog();
  document.querySelectorAll(".start-timer").forEach(b =>
    b.addEventListener("click", () => startTimer(state.programs.find(p => p.id === b.dataset.id))));
}

/* ---------------- session log ---------------- */

function renderLog() {
  document.getElementById("logList").innerHTML =
    state.log.map(s => `<li>${s.date} — ${s.program} (${s.duration} min) ${s.notes || ""}</li>`).join("");
}

function saveLog() {
  localStorage.setItem("trainerLog", JSON.stringify(state.log));
}

document.getElementById("logForm").addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  state.log.push({ date: new Date().toISOString().slice(0, 10), ...data });
  saveLog();
  e.target.reset();
  renderLog();
});

document.getElementById("exportCsv").addEventListener("click", () => {
  const rows = [["date", "program", "duration", "notes"],
    ...state.log.map(s => [s.date, s.program, s.duration, s.notes || ""])];
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "trainer-log.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------------- workout timer ---------------- */

let audioCtx;
function beep(freq = 880, dur = 0.15, delay = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + delay;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  } catch { /* audio unavailable — timer still works */ }
}

const timer = {
  queue: [], idx: 0, remaining: 0,
  running: false, started: false,
  intervalId: null, last: 0, lastSec: null,
  program: null, startedAt: 0
};

// Flatten a program into alternating WORK / REST intervals.
function buildQueue(program) {
  const works = [];
  program.exercises.forEach(e => {
    const sets = e.sets || 1;
    for (let s = 1; s <= sets; s++) {
      works.push({
        phase: "WORK",
        label: sets > 1 ? `${e.name} · ${s}/${sets}` : e.name,
        sec: e.workSec || 60,
        restSec: e.restSec || 60
      });
    }
  });
  const q = [];
  works.forEach((w, i) => {
    q.push(w);
    if (i < works.length - 1) q.push({ phase: "REST", label: "Rest", sec: w.restSec });
  });
  return q;
}

function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}

function updateTimerUI() {
  const cur = timer.queue[timer.idx];
  const phaseEl = document.getElementById("timerPhase");
  document.getElementById("timerProgram").textContent = timer.program ? timer.program.title : "Workout";
  phaseEl.textContent = cur ? cur.phase : "DONE";
  phaseEl.className = "timer-phase " + (cur && cur.phase === "REST" ? "rest" : "work");
  document.getElementById("timerLabel").textContent = cur ? cur.label : "Workout complete — logged ✓";
  document.getElementById("timerClock").textContent = fmt(timer.remaining);
  document.getElementById("timerProgress").textContent = cur ? `${timer.idx + 1} / ${timer.queue.length}` : "";
  document.getElementById("timerStartPause").textContent =
    timer.running ? "Pause" : (timer.started ? "Resume" : "Start");
}

function tick() {
  const now = performance.now();
  timer.remaining -= (now - timer.last) / 1000;
  timer.last = now;
  const s = Math.ceil(timer.remaining);
  if (s !== timer.lastSec) {
    timer.lastSec = s;
    if (s <= 3 && s >= 1) beep(990, 0.08); // 3-2-1 countdown
  }
  if (timer.remaining <= 0) {
    timer.idx++;
    timer.lastSec = null;
    if (timer.idx >= timer.queue.length) { finishTimer(); return; }
    timer.remaining = timer.queue[timer.idx].sec;
    beep(timer.queue[timer.idx].phase === "REST" ? 520 : 880, 0.25); // phase change
  }
  updateTimerUI();
}

function startTimer(program) {
  stopTimer(false);
  timer.program = program;
  timer.queue = buildQueue(program);
  timer.idx = 0;
  timer.remaining = timer.queue.length ? timer.queue[0].sec : 0;
  timer.started = false;
  timer.startedAt = Date.now();
  document.getElementById("timerPanel").classList.remove("hidden");
  updateTimerUI();
  document.getElementById("timerPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resumeTimer() {
  if (timer.running || timer.idx >= timer.queue.length) return;
  timer.running = true;
  timer.started = true;
  timer.last = performance.now();
  timer.intervalId = setInterval(tick, 200);
  updateTimerUI();
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timer.intervalId);
  updateTimerUI();
}

function stopTimer(hide = true) {
  timer.running = false;
  clearInterval(timer.intervalId);
  if (hide) document.getElementById("timerPanel").classList.add("hidden");
}

function finishTimer() {
  clearInterval(timer.intervalId);
  timer.running = false;
  timer.idx = timer.queue.length;
  timer.remaining = 0;
  beep(880, 0.2); beep(880, 0.2, 0.3); beep(1320, 0.45, 0.6); // done fanfare
  updateTimerUI();
  const mins = Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000));
  state.log.push({
    date: new Date().toISOString().slice(0, 10),
    program: timer.program.title,
    duration: String(mins),
    notes: "timer"
  });
  saveLog();
  renderLog();
}

document.getElementById("timerStartPause").addEventListener("click", () =>
  timer.running ? pauseTimer() : resumeTimer());
document.getElementById("timerSkip").addEventListener("click", () => {
  if (timer.idx >= timer.queue.length) return;
  timer.idx++;
  timer.lastSec = null;
  if (timer.idx >= timer.queue.length) { finishTimer(); return; }
  timer.remaining = timer.queue[timer.idx].sec;
  updateTimerUI();
});
document.getElementById("timerStop").addEventListener("click", () => stopTimer(true));

loadPrograms();
