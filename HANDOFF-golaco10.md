# Golaço 10 — Handoff

Single-file HTML5 canvas soccer game (pt-BR UI). No build step, no dependencies besides Google Fonts.

## Files
| File / Pasta | Destination |
|---|---|
| `index.html` | Arquivo principal modularizado (abre direto no navegador ou servidor local). |
| `golaco10.html` | Mantido na raiz para compatibilidade direta. |
| `css/style.css` | Folha de estilos completa, organizada e indentada. |
| `js/game.js` | Código JavaScript completo (física, áudio, regras, renderização e interface). |
| `html/index.html` | Entrada alternativa localizada dentro da pasta `html/`. |
| `golaco10_backup.html` | Cópia de segurança da versão original monolítica (arquivo único). |

## Modes
- `solo` — 6-phase campaign vs CPU (P1 + CPU keeper).
- `coop` — same campaign, P1 + P2 on the same team; CPU gets +1 outfield player. Short tap of shoot toward partner = assisted pass.
- `versus` — P1 (home, attacks right) vs P2 (away, attacks left), CPU keepers, first to 5 / 3:00.
- `demo` — CPU vs CPU running behind the menu.

## Code map (inside the single `<script>`)
- **Constants**: world is 1280×720; field rect `F`, goal mouth `GT..GB`.
- **`PHASES`**: per-phase tuning — rival name/kit, outfield count `n`, CPU speed, `tackle` success, `shootRange`, `acc`, keeper `k {spd, react, err, catchV}`, `goals` to win, `time`.
- **`HOME_K`, `VERSUS`, `DEMO`**: keeper/CPU params for the other contexts.
- **Input**: `KEYMAP` (keyboard, `event.code`), touch joystick/buttons (`.zone`, `.tbtn`), gamepads (`pollGamepads`). All merged in `readInput(slot)`.
- **Sim**: fixed 60 Hz `step()` → `world()` → `updateHuman` / `updateCPU` / `updateKeeper` → `integrate` → `separate` → `updateBall` (4 substeps) → `checkCapture`.
- **Rules/score**: `onGoal`, `afterGoal`, `endMatch`, `showResult`. Points: goal 100×phase, long-range +150, full power +50, dribble+goal +75, assist +50, steal +20, dribble +25; win bonus 250×phase + goal diff ×50 + seconds left ×5.
- **Render**: `buildStatic()` caches stands/pitch per resize; `render()` draws goals, players (y-sorted), ball, particles, floaters.
- **Persistence**: `localStorage` keys `golaco10:*` (names, mode, mute, records), wrapped in try/catch. Hot-reload snapshot via `window.claude.hot` when present.

## Testing
Open with `#debug` to expose `window.__golaco` (G, ball, world, setupMatch, kickRaw…). Keeper calibration (on-target corner shots, power .75–1, 200–470 px): goal rate ≈ 81% phase 1 → 50% phase 6.

## Ideas not done
Local high-score table with names, penalty shootout tiebreak, online multiplayer, character select.
