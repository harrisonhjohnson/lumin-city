# Lumin City

**Remind Me** — a city built from what you remember. A narrator asks where, when, what season and what time; the city rebuilds from white clay into the day you described. Then you pick what you were doing and play it. Live at [lumin.city](https://lumin.city).

```
npm install
npm run dev      # http://127.0.0.1:5190
npm test
npm run build    # → dist/ (Vercel builds this on push)
```

## Layout
- `src/remember/` — the game: question flow (`main.js`, `memory.js`), minigames and free roam (`modes.js`), movement and cameras (`rig.js`), memories/unlocks/kept powers (`progress.js`), the persistent town of residents (`town.js`, `talk.js`), moving traffic and pedestrians (`life.js`, `life-graph.js`), models and UI (`models.js`, `ui.js`).
- Watch an AI play (title screen): Claude moves into its own unsaved copy of the town and plays it one tool call at a time while you watch it think. `agent.js` writes each turn's report and applies the action (talk, help, a job board where pay trades against likability, pizzas it must eat daily or lose, gifts and deliveries); Head to head runs two models in twin copies of the same seeded town on one shared clock that waits for both; `dilemmas.js` drops six hard choices on both at the same hours about the same residents, and the end card compares choices and reasons. Batch it without a browser: `OPENROUTER_API_KEY=… npm run duel -- --a haiku --b sonnet --goal rich --runs 5` (writes runs/*.json, prints choice tallies). `agent-brain.js` holds the prompt, tools and models; `api/agent.js` streams the model through OpenRouter (`OPENROUTER_API_KEY`); `agent-ui.js` is the setup card, the thinking panel and the end card. In dev, start Vite with the key in the environment: `OPENROUTER_API_KEY=… npm run dev`.
- `src/world/city/` — the procedural city (bible → lots → zoning → build → scene), with looks, eras, seasons and conditions.
- `src/room/swing-physics.js` — web-swing movement.
- `public/city/kit.glb` — the Blender kit of parts (`blender/build_kit.py` rebuilds it).

## Dev shortcuts (dev builds only)
`/?memory=nyc,1900,winter,snow,dusk,Name&play=roam&keep=aliens,heist&time=30` skips the questions, starts a round, grants powers. `&reset=1` forgets all progress and towns. `window.__rm` exposes the running game.

Preview pages: `/src/remember/ui-preview.html`, `models-preview.html`, `life-preview.html`.

Split out of harrison-build (branch `game/remind-me`, commit 5e89e89) on 2026-10-01; the city code began as harrison.build's swing city.
