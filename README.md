# Trainer App — Portfolio Project 2

Workout program browser + session log. Pure HTML/CSS/JS, no build step.

## Why this project
- Closes the JSON/CSV gap named in the 2026-10-08 LinkedIn triage: programs are
  data, not hard-coded HTML; the log exports real CSV.
- Doubles as a personal workout log: save a session in the browser
  (localStorage), export `trainer-log.csv` when needed.

## Stack
- `data/workouts.json` — program data (fetch, with an embedded fallback for file://)
- `js/app.js` — render, focus/level filters, log form, CSV export
- `css/style.css` — dark single-theme layout

## Run locally
```bash
cd trainer-app
python3 -m http.server 8000
# open http://localhost:8000
```

## Done 2026-10-11
- [x] Session timer per exercise: per-card "Start timer" builds a WORK/REST
  interval queue from `workSec`/`restSec`, with Start/Pause/Skip/Stop,
  3-2-1 countdown beeps + phase-change tones (WebAudio, no audio files),
  big clock, progress counter; finished sessions auto-log to the session log.
- [x] Boxing round presets: Boxing Rounds 3×3, 5×3, 10×2 (data-driven,
  rendered by the same timer).
- [x] Program data expanded to 7 programs (boxing, strength, mobility,
  conditioning) in `data/workouts.json`.

## Next steps (by the owner's word)
1. Publish to GitHub + GitHub Pages (same flow as Papa Le).
3. Publish next to Papa Le on GitHub Pages once Project 1 is live.
