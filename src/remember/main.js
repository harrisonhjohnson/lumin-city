import * as THREE from 'three';
import { createUI } from './ui.js';
import * as models from './models.js';
import { createWorld } from './world.js';
import { createControls, createMover, createChaseCamera, inWater, ISLAND } from './rig.js';
import { MODES } from './modes.js';
import { createLife } from './life.js';
import * as progression from './progress.js';
import { createTown, TIME_SCALE, START_HOUR, PRICE_SCALE } from './town.js';
import { greet, choices, answer, remember as rememberSaid, where as addressOf, placeName } from './talk.js';
import * as social from './social.js';
import * as fame from './fame.js';
import * as quests from './quests.js';
import { lootToday, pickUp, collectiblesFor } from './loot.js';
import * as civic from './civic.js';
import { rankFor } from './memory.js';
import { CITIES, YEARS, SEASON_CHOICES, TIME_CHOICES, weatherChoices, LINES, ACTIVITIES, worldSettings } from './memory.js';
import { SEASONS } from '../world/city/eras.js';
import { createRng } from '../world/city/rng.js';
import { createAgentUI } from './agent-ui.js';
import * as agentSim from './agent.js';
import { think } from './agent-call.js';
import { LIVE_MODELS as AGENT_MODELS, GOALS as AGENT_GOALS, costOf } from './agent-brain.js';
import { DILEMMAS } from './dilemmas.js';
import * as watchSim from './watch-sim.js';

// Remind Me: a narrator helps you remember a day, and the city is rebuilt a little more
// accurately with every answer. Then you pick what you were doing and play it. Rounds earn
// memories that unlock the other games; a B or better keeps that game's power for free roam.
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
// Neutral keeps saturated brick, signs and sky closer to their palette than ACES, which greys them.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
stage.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1600);
const ui = createUI(document.body);
const world = createWorld();
const controls = createControls(renderer.domElement);
const chase = createChaseCamera(camera);

const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

let memory = {}, phase = 'intro', round = null, mover = null, player = null, timeLeft = 0, clock = 0, orbit = 0.6, life = null;
const group = new THREE.Group();

// Testing shortcuts: ?memory=nyc,1900,winter,snow,dusk,Name skips the questions; &play=skate
// jumps straight into a round; &time=5 shortens it; &keep=aliens,heist grants powers;
// &reset=1 forgets all progress.
// The shortcuts only work in dev builds; the live game always starts from the questions.
const params = new URLSearchParams(import.meta.env.DEV ? location.search : '');
const entry = new URLSearchParams(location.search);
const SAVE_KEY = 'remind-me-progress';
if (params.get('reset')) try { for (const k of Object.keys(localStorage)) if (k.startsWith('remind-me-')) localStorage.removeItem(k); } catch { /* storage unavailable */ }
let progress = progression.load((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
const save = (next) => { progress = next; try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ } };

// The streets' static traffic is off: life.js drives every vehicle once the day is remembered.
// Buildings knocked down this round (the kaiju); the city is whole again after.
const destroyed = new Set();
function rebuild({ surface = true, preview = false } = {}) {
  const settings = worldSettings(memory);
  world.build({ ...settings, look: { ...settings.look, traffic: { none: true } }, destroyed, surface });
  world.scene.add(group);
  if (player) world.scene.add(player.root);
  if (settings.stage === 4 && !life && !preview) {
    town = openTown();
    life = createLife({ era: memory.year, city: memory.city, rng: createRng(812 + memory.year.length), town, crowd: 1.4 });
  }
  if (life) world.scene.add(life.group);
  return settings;
}
function forgetLife() { saveTown(); town = null; if (life) { life.group.removeFromParent(); life.dispose(); life = null; } }

// The town of the remembered day: the same people every time you come back to this city and
// year, picking up where they left off. Saved every few seconds and when you leave.
let town = null, townSaved = 0;
const townKey = () => `remind-me-town:${memory.city}:${memory.year}`;
function openTown() {
  // Watching an agent: a fresh town of its own, never saved over yours.
  if (watch) return watchSim.watchTown(memory);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(townKey()) || 'null'); } catch { /* storage unavailable or junk */ }
  const t = createTown({ city: memory.city, era: memory.year, saved: saved?.v === 1 ? saved : null, hour: START_HOUR[memory.time] ?? 12 });
  civic.initCivic(t);
  social.buildSocial(t);
  if (!t._questsHooked) { t.onDay.push(quests.pizzaNightly, fame.nightly); t._questsHooked = true; }
  // Coming back to a day means you've slept since; a day remembered from late evening runs on
  // through the next midnight rather than ending a few minutes in.
  t.civic.lastCheckIn = t.day + (t.hour >= 20 ? 1 : 0);
  dayStart = { memories: progress.memories, cash: progress.cash };
  return t;
}
function saveTown() { if (town && !watch) try { localStorage.setItem(townKey(), JSON.stringify(town.save())); } catch { /* storage full or unavailable */ } }
addEventListener('pagehide', saveTown);
const scale = () => PRICE_SCALE[memory.year] ?? 1;
const showWallet = () => ui.wallet?.(progression.rich(progress) ? '∞' : progress.cash);
function earn(amount) { if (!progression.rich(progress)) { save(progression.earn(progress, amount)); showWallet(); } }
const clockText = () => { if (!town) return null; const h = town.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `DAY ${town.day + 1} · ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };

// Talking to a resident: the game pauses on their card until you walk away.
let talking = false;
const VISITOR_LINES = ['Just passing through. Big city, isn\'t it?', 'I\'m only here for the day. Do you know a good place to eat?', 'Sorry, I\'m not from around here.', 'I\'m meeting a friend. I think I\'m lost.'];
const VISITOR_NAMES = ['A tourist', 'A traveller', 'A stranger', 'Someone from out of town'];
async function talkTo(resident, ped = null) {
  if (talking) return;
  talking = true; controls.enabled = false; controls.release();
  if (ped) life?.claim(ped);   // they stop and face you while you talk
  const done = () => { ui.closeTalk?.(); if (ped) life?.release(ped, ped.position.clone()); talking = false; controls.enabled = true; controls.pressed.clear(); };
  if (!resident) {
    const n = (ped?.id ?? 0) % 4, local = town?.outdoors(mover.feet, 120).map((o) => o.resident)[0];
    const pickd = await ui.talk({ name: VISITOR_NAMES[n], job: 'Visiting', mood: 'fine', opinion: null, portraitSeed: `visitor-${ped?.id}`, line: VISITOR_LINES[n], facts: ['Not from around here'], options: [{ id: 'ask', label: 'Ask who lives around here' }] });
    if (pickd) await ui.talk({ name: VISITOR_NAMES[n], job: 'Visiting', mood: 'happy', opinion: null, portraitSeed: `visitor-${ped?.id}`, line: local ? `I met ${local.name} earlier — the ${local.job.toLowerCase()}. Lives near here, I think.` : 'No idea, sorry. Everyone seems to be indoors.', facts: ['Not from around here'], options: [] });
    return done();
  }
  const card = () => {
    const g = greet(resident, town, memory.name), wallet = progression.rich(progress) ? Infinity : progress.cash;
    return { name: resident.name, job: resident.job, place: resident.shop ? town.shopName(resident.shop) : undefined, mood: g.mood, money: resident.money, opinion: resident.met ? resident.opinion : null, portraitSeed: resident.look.seed, line: g.line, facts: g.facts, options: [...questOptions(resident, wallet), ...choices(resident, wallet, scale())] };
  };
  // The influential are busy: a stranger gets brushed off unless someone they trust vouches.
  const gate = social.access(town, resident);
  if (!gate.ok) {
    await ui.talk({ ...card(), line: gate.line, facts: [...card().facts.slice(0, 2), 'Busy — and listened to by a lot of people'], options: [] });
    ui.hud.toast(gate.hint);
    return done();
  }
  social.seen(town, resident);
  let view = card();
  if (gate.voucher && !resident.met) view.line = `Oh — you're the one ${gate.voucher.first} keeps talking about. ${view.line}`;
  for (;;) {
    const pickd = await ui.talk(view);
    if (!pickd) break;
    if (pickd.startsWith('quest-')) { view = { ...card(), line: await questAtTalk(resident, pickd) }; continue; }
    const res = answer(resident, pickd, town, memory.name, scale(), chatCtx());
    rememberSaid(resident, 'player', view.options.find((o) => o.id === pickd)?.label || pickd, town);
    rememberSaid(resident, 'them', res.line, town);
    resident.opinion = Math.max(-1, Math.min(1, resident.opinion + res.opinion));
    if (res.cash) earn(res.cash);
    if (res.memories) { save(progression.found(progress, res.memories)); ui.memories(progress.memories, res.memories); }
    view = { ...card(), line: res.line };
  }
  done();
}

// What a chatty resident can point you at: real loot near their home, by street address.
const chatCtx = () => ({
  address: (p) => addressOf({ x: p.x, z: p.z }),
  lootNear: (x, z) => lootToday(town, world.city.buildings, { park: PARK_RECT, island: ISLAND }).filter((it) => it.kind !== 'lost').map((it) => [it, Math.hypot(it.x - x, it.z - z)]).filter(([, d]) => d < 220).sort((a, b) => a[1] - b[1])[0]?.[0] || null,
});

// ---- quests -------------------------------------------------------------------------------

const PARK_RECT = { x: -70, z: -140, w: 110, d: 62 };
const hasWheels = () => ['race', 'taxi', 'pizza'].some((g) => progress.kept.includes(g));
const questCan = () => ({ ride: hasWheels(), buildings: world.city.buildings, park: PARK_RECT, island: ISLAND });
let tracked = null;   // the quest whose next step shows in the HUD (and on the arrow, for rides)

function questOptions(r, wallet) {
  const q = quests.questFor(r, town, questCan());
  if (!q) return [];
  if (q.state === 'offered') return [{ id: 'quest-ask', label: 'Ask what they need', hint: q.title }];
  if (quests.completableAtTalk(q)) {
    if (q.type === 'money') return [{ id: 'quest-done', label: `Give them $${q.data.amount.toFixed(2)}`, disabled: wallet < q.data.amount, hint: wallet < q.data.amount ? 'You can\'t cover it yet' : 'What they asked for' }];
    if (q.type === 'rent') return [{ id: 'quest-done', label: 'Cut their rent by a fifth', hint: `From $${r.rent.toFixed(2)} a day` }];
    return [{ id: 'quest-done', label: `Give back ${q.data.item}`, hint: 'You found it' }];
  }
  return [];
}

async function questAtTalk(r, pickd) {
  const q = quests.questFor(r, town, questCan());
  if (pickd === 'quest-ask') {
    const rw = q.reward, effects = [{ text: `${r.first} will think a lot more of you`, tone: 'good' }, { text: 'And tell their friends', tone: 'good' }, ...(rw.memories ? [{ text: `+${rw.memories} memories`, tone: 'good' }] : []), ...(rw.cash ? [{ text: `+$${rw.cash.toFixed(2)}`, tone: 'good' }] : [])];
    const reward = [`${r.first} will think a lot more of you — and tell their friends`, rw.memories && `+${rw.memories} memories`, rw.cash && `+$${rw.cash.toFixed(2)}`].filter(Boolean).join(' · ');
    const yes = ui.quest
      ? await ui.quest({ who: r.name, portraitSeed: r.look.seed, title: q.title, detail: q.detail, reward, options: [{ id: 'accept', label: 'I\'ll help' }, { id: 'no', label: 'Not now' }] })
      : await ui.decision({ kicker: `${r.first.toUpperCase()} NEEDS`, title: q.title, situation: q.detail, options: [{ id: 'accept', label: 'I\'ll help', effects }, { id: 'no', label: 'Not now', effects: [] }] });
    if (yes !== 'accept') return 'Oh. Never mind, then.';
    quests.accept(town, q); tracked = q;
    rememberSaid(r, 'player', `I'll help: ${q.title}`, town);
    return { money: 'You would? Thank you. Really.', rent: 'You\'d think about it? That\'s more than most landlords would.', pizza: 'Someone has to. You\'d be doing the whole street a favour.', ride: 'You\'re a lifesaver. I\'ll wait right here — bring the car round.', lost: 'You\'d look? It means more than you know.' }[q.type];
  }
  if (q.type === 'money') earn(-q.data.amount);
  finishQuest(q);
  return { money: 'I don\'t know how to thank you. I won\'t forget it.', rent: 'You mean it? I can breathe again.', lost: `My ${q.data.item}! Where was it? Never mind — thank you.` }[q.type];
}

function finishQuest(q) {
  const rw = quests.complete(town, q);
  if (rw.memories) { save(progression.found(progress, rw.memories)); ui.memories(progress.memories, rw.memories); }
  if (rw.cash) earn(rw.cash);
  if (tracked === q) tracked = null;
  ui.hud.toast(`Done: ${q.title}. ${town.person(q.who).first} won't forget it.`, 'good');
  saveTown();
}

// Where the tracked quest points: the passenger, then the appointment; nothing for lost items
// (the hint says roughly where — that's the looking).
function questTarget() {
  const q = tracked;
  if (!q || q.state !== 'active' || q.type !== 'ride') return null;
  if (!q.data.picked) { const ped = life?.pedFor(q.who), w = town.where(town.person(q.who)); return ped ? ped.position : new THREE.Vector3(w.x, 1, w.z); }
  const d = town.place(q.data.to).door; return new THREE.Vector3(d.x, 1, d.z);
}
const questLine = () => {
  const q = tracked;
  if (!q || q.state !== 'active') return null;
  const who = town.person(q.who).first;
  if (q.type === 'ride') return q.data.picked ? `Get ${who} to ${placeName(town, q.data.to, town.person(q.who))} by ${hhmm(q.data.due)}` : `Pick up ${who} — you'll need wheels`;
  if (q.type === 'lost') return q.data.found ? `Bring ${q.data.item} back to ${who}` : `Find ${who}'s ${q.data.item} — ${q.data.where}, near their home`;
  if (q.type === 'pizza') return 'Work a shift at the Pizza shop — get a B or better';
  return `${q.title} — talk to ${who}`;
};

// Free roam, every frame: rides, the day's loot, the tracked line.
const lootModels = new Map();
let lootClock = 0;
function roamTick(dt, m, hud) {
  for (const q of quests.expire(town)) { ui.hud.toast(`Too late: ${q.title}. ${town.person(q.who).first} is disappointed.`, 'bad'); if (tracked === q) tracked = null; }
  const q = tracked;
  if (q?.type === 'ride' && q.state === 'active') {
    const r = town.person(q.who), inCar = m.M.kind === 'vehicle';
    if (!q.data.picked) {
      const at = questTarget();
      if (at && inCar && Math.hypot(at.x - m.feet.x, at.z - m.feet.z) < 8 && Math.abs(m.speed) < 7) {
        const ped = life?.pedFor(q.who);
        town.hail(r, m.feet); if (ped) life.board(ped);
        q.data.picked = true; hud.toast(`${r.first} hops in. "${placeName(town, q.data.to, r)}, please!"`, 'good');
      }
    } else {
      const d = town.place(q.data.to).door;
      if (Math.hypot(d.x - m.feet.x, d.z - m.feet.z) < 10 && Math.abs(m.speed) < 8) {
        town.dropOff(r, q.data.to); const ped = life?.pedFor(q.who); if (ped) life.release(ped, new THREE.Vector3(d.x, 0.18, d.z));
        finishQuest(q);
      }
    }
  }
  hud.quest?.(questLine());
  // Loot: models only for what's near; sparkles show up close, so you have to go looking.
  if ((lootClock -= dt) <= 0) {
    lootClock = 0.4;
    const items = lootToday(town, world.city.buildings, { park: PARK_RECT, island: ISLAND });
    const live = new Set();
    for (const it of items) {
      const d = Math.hypot(it.x - m.feet.x, it.z - m.feet.z);
      if (d > 80) continue;
      live.add(it.id);
      if (!lootModels.has(it.id)) { const o = models.makeOrb(LOOT_COLOUR[it.kind]); o.scale.setScalar(it.kind === 'lost' ? 0.9 : 0.6); o.position.set(it.x, it.y, it.z); o.userData.item = it; group.add(o); lootModels.set(it.id, o); }
    }
    for (const [id, o] of lootModels) if (!live.has(id) || !o.parent) { o.removeFromParent(); models.disposeModel?.(o); lootModels.delete(id); }
  }
  const body = m.feet.add(new THREE.Vector3(0, 1, 0));
  for (const [id, o] of lootModels) {
    o.visible = body.distanceTo(o.position) < 42;
    if (body.distanceTo(o.position) > 2.6) continue;
    const it = o.userData.item;
    pickUp(town, it);
    o.removeFromParent(); lootModels.delete(id);
    if (it.kind === 'memory') { save(progression.found(progress, it.amount)); ui.memories(progress.memories, it.amount); hud.toast(`A memory, ${it.where}  +${it.amount}`, 'good'); }
    if (it.kind === 'cash') { earn(it.amount); hud.toast(`Found $${it.amount.toFixed(2)} ${it.where}`, 'good'); }
    if (it.kind === 'keepsake') { const set = collectiblesFor(town.era); hud.toast(`Found ${it.label} — ${Object.keys(town.collection).length}/${set.length} keepsakes`, 'good'); }
    if (it.kind === 'lost') { const q2 = town.quests.find((x) => x.id === it.quest); hud.toast(`Found ${it.label}! Bring it back to ${town.person(q2.who).first}.`, 'good'); tracked = q2; }
  }
}
const LOOT_COLOUR = { memory: '#ffd66b', cash: '#6bd68a', keepsake: '#b98cff', lost: '#ff6b6b' };

async function openJournal() {
  if (talking || !ui.journal) return;
  talking = true; controls.enabled = false; controls.release();
  const qs = (town.quests || []).filter((q) => q.state !== 'offered' && q.state !== 'lapsed').slice(-20).reverse();
  const set = collectiblesFor(town.era);
  await ui.journal({
    quests: qs.map((q) => ({ id: q.id, who: town.person(q.who).name, title: q.title, detail: q.detail, reward: `${q.reward.memories ? `+${q.reward.memories} memories` : ''}${q.reward.cash ? ` · +$${q.reward.cash.toFixed(2)}` : ''}`, state: q.state, due: q.type === 'ride' && q.state === 'active' ? hhmm(q.data.due) : undefined })),
    collectibles: [{ label: 'Keepsakes', found: set.filter((k) => town.collection[k]).length, total: set.length }],
  });
  talking = false; controls.enabled = true; controls.pressed.clear();
}

// The three things every life in Lumin City is reaching for.
function goalMeters() {
  const g = civic.goalProgress(town, progress);
  const powers = (progress.kept.filter((k) => progression.PERKS[k]?.mover).length + progress.powers.length + (progress.achieved.includes('hero') ? 2 : 0)) / 10;
  return [
    { id: 'land', label: 'Own land', value: g.owner, detail: `${civic.owned(town).length} buildings` },
    { id: 'mayor', label: 'Become mayor', value: g.mayor, detail: town.civic.mayor === 'player' ? 'You are mayor' : (() => { const f = civic.forecast(town); return `Tonight's vote: ${f.you} of ${f.you + f.them} · election in ${Math.max(0, civic.daysToElection(town))} days`; })() },
    { id: 'powers', label: 'Superpowers', value: Math.min(1, powers), detail: `${progress.powers.length ? 'Laser & ice · ' : ''}${progress.kept.length} kept` },
  ];
}

// How much road the player takes up, so traffic leaves room behind a car, not just a person.
const PLAYER_SIZE = { car: 2.6, scooter: 1.2, board: 0.8, foot: 0.5, swing: 0.5, flight: 0.8 };
const lifePlayer = { position: new THREE.Vector3(0, 0, -220), velocity: new THREE.Vector3(), speed: 0, radius: 1, vehicle: false };

// While remembering: a slow orbit that sinks lower as the memory sharpens.
const CINE = [[340, 200], [310, 175], [280, 150], [260, 130], [240, 115]];
function cinematic(dt) {
  orbit += dt * 0.035;
  const [r, h] = CINE[worldSettings(memory).stage];
  const want = new THREE.Vector3(Math.sin(orbit) * r, h, -220 + Math.cos(orbit) * r);
  camera.position.lerp(want, 1 - Math.exp(-dt * 0.8));
  camera.lookAt(0, 25, -220);
  camera.fov = THREE.MathUtils.damp(camera.fov, 55, 2, dt); camera.updateProjectionMatrix();
}

// The player's body and ride, the web line, and an arrow floating overhead toward the goal.
function makePlayer(def, bought = null) {
  const root = new THREE.Group();
  const ride = bought ? 'bought' : typeof def.ride === 'function' ? def.ride(memory) : def.ride;
  const avatar = models.makeAvatar(def.outfit);
  let vehicle = null;
  if (ride === 'bought') { vehicle = bought; vehicle.position.set(0, 0, 0); vehicle.rotation.set(0, 0, 0); }
  else if (ride === 'cab') vehicle = memory.year === '1900' ? models.makeHorseCarriage() : models.makeTaxi?.(memory.city) || models.makeRaceCar('#f6b90c');
  if (ride === 'board') { vehicle = models.makeSkateboard(); avatar.position.y = 0.16; if (memory.year === '2100') vehicle.position.y = 0.35, avatar.position.y = 0.5; }
  else if (ride === 'car') vehicle = models.makeRaceCar('#2b62a6');
  else if (ride === 'carriage') vehicle = models.makeHorseCarriage();
  else if (ride === 'hover') vehicle = models.makeHoverCar('#39e6ff');
  else if (ride === 'scooter') { vehicle = models.makeScooter(); avatar.position.set(0, 0.34, -0.08); }
  if (vehicle) root.add(vehicle);
  if (!['car', 'carriage', 'hover', 'cab', 'bought'].includes(ride)) root.add(avatar);
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf4f1e8 }));
  rope.frustumCulled = false; rope.visible = false;
  const arrowGeo = new THREE.ConeGeometry(0.45, 1.3, 4); arrowGeo.rotateX(-Math.PI / 2);
  const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0xffd66b, emissive: 0xffb02e, emissiveIntensity: 0.45, flatShading: true }));
  arrow.rotation.order = 'YXZ';
  const all = new THREE.Group(); all.add(root, rope, arrow);
  return { root: all, body: root, avatar, vehicle, rope, arrow };
}

const ARROW_COLOUR = new THREE.Color();
function placePlayer(dt) {
  const feet = mover.feet;
  player.body.position.copy(feet);
  player.body.rotation.y = mover.heading;
  const air = !mover.grounded;
  const body = player.avatar.userData.body;
  if (body) body.rotation.z = mover.lean;
  if (mover.M.kind === 'flight') player.avatar.rotation.x = THREE.MathUtils.damp(player.avatar.rotation.x, air ? -Math.min(mover.speed / 30, 1) * 1.25 : 0, 5, dt);
  player.avatar.userData.animate?.(clock, mover.M.kind === 'vehicle' ? 0 : mover.speed, { air });
  player.vehicle?.userData.animate?.(clock, mover.speed);
  const anchor = mover.swing?.anchor;
  player.rope.visible = !!anchor;
  if (anchor) {
    const a = player.rope.geometry.attributes.position.array;
    a.set([feet.x, feet.y + 1.5, feet.z, anchor.x, anchor.y, anchor.z]);
    player.rope.geometry.attributes.position.needsUpdate = true;
  }
  const goal = round.guide?.(mover);
  player.arrow.visible = !!goal;
  if (goal) {
    const dx = goal.x - feet.x, dz = goal.z - feet.z, flat = Math.hypot(dx, dz);
    // Hot and cold: far away it's small and blue, turning gold, then big, red and quick as you close in.
    const near = THREE.MathUtils.clamp(1 - Math.hypot(flat, (goal.y || 0) - feet.y) / 260, 0, 1);
    ARROW_COLOUR.setHSL(0.58 - near * 0.57, 0.95, 0.55);   // blue → teal → gold → orange → red
    player.arrow.material.color.copy(ARROW_COLOUR); player.arrow.material.emissive.copy(ARROW_COLOUR);
    const beat = 1 + Math.sin(clock * (3 + near * 9)) * 0.08 * (0.5 + near);
    player.arrow.scale.setScalar((0.8 + near * 1.1) * beat);
    player.arrow.position.set(feet.x, feet.y + (mover.M.kind === 'vehicle' ? 3.4 : 2.8) + near * 0.6 + Math.sin(clock * 3) * 0.12, feet.z);
    player.arrow.rotation.y = Math.atan2(-dx, -dz);
    player.arrow.rotation.x = THREE.MathUtils.clamp(Math.atan2((goal.y || 0) - feet.y, flat), -0.8, 0.8);
    player.arrow.visible = flat > 6 || Math.abs((goal.y || 0) - feet.y) > 6;
  }
}

// The edges of the memory. Roll into the water and you're fished out where you last stood on
// dry land (no harm done); fly too far and the narrator turns you round.
const lastSafe = { at: new THREE.Vector3(), heading: 0, timer: 0, set: false };
let edgeNag = 0, splashing = false;
function edgesAndWater(dt) {
  const feet = mover.feet;
  edgeNag -= dt;
  if (mover.edge && edgeNag <= 0) { ui.hud.toast('The memory ends here. Turn back.'); edgeNag = 4; }
  const wet = inWater(feet) && feet.y < 0.6;
  if (!wet && (mover.grounded || mover.M.kind === 'flight') && (lastSafe.timer -= dt) <= 0) {
    lastSafe.at.copy(feet); lastSafe.heading = mover.heading; lastSafe.timer = 0.5; lastSafe.set = true;
  }
  if (wet && !splashing) {
    splashing = true;
    ui.hud.callout('SPLASH!');
    setTimeout(() => {
      if (mover) {
        mover.teleport(lastSafe.set ? lastSafe.at.clone().setY(Math.max(0, lastSafe.at.y)) : round.spawn.at, lastSafe.heading);
        controls.yaw = mover.heading; chase.snap(mover, controls);
        ui.hud.toast('Oops! Fished out and back on dry land.');
      }
      splashing = false;
    }, 650);
  }
}

function animateGroup(dt) {
  group.traverse((o) => { o.userData.animate?.(clock, 0); });
}

function tick(dt) {
  clock += dt;
  if (phase === 'play' || phase === 'countdown') {
    if (phase === 'play' && !talking) {
      mover.update(dt, controls);
      round.update(dt, mover, ui.hud, mover);
      // Midnight in free roam: you're exhausted; the night's check-in takes over.
      if (timeLeft === null && town && town.day > town.civic.lastCheckIn && !round.done) { round.done = true; ui.hud.toast('Midnight. You\'re exhausted.'); }
      if (timeLeft !== null && mover) {
        timeLeft -= dt; round.timeLeft = Math.max(0, timeLeft);
        ui.hud.set({ time: Math.max(0, timeLeft) });
        if (timeLeft <= 0) round.done = true;
      }
    }
    if (mover && phase === 'play' && !talking) edgesAndWater(dt);
    if (mover) {
      placePlayer(dt);
      chase.update(mover, controls, dt);
      lifePlayer.position.copy(mover.feet); lifePlayer.velocity.copy(mover.velocity); lifePlayer.speed = Math.abs(mover.speed); lifePlayer.vehicle = mover.M.kind === 'vehicle';
      lifePlayer.radius = PLAYER_SIZE[mover.type] ?? 0.5;
    }
    controls.endFrame();
  } else if (phase === 'watch' && watch?.sides.length) watchFrame(dt);
  else { cinematic(dt); lifePlayer.position.set(0, 0, -220); lifePlayer.speed = 0; lifePlayer.vehicle = false; }
  if (watch) advanceWatch(dt);
  else if (town) {
    town.tick(dt * TIME_SCALE);
    if ((townSaved += dt) > 15) { townSaved = 0; saveTown(); }
  }
  life?.update(dt, lifePlayer);
  animateGroup(dt);
  world.tick(dt, camera);
  if (world.scene) renderer.render(world.scene, camera);
}

let last = performance.now();
renderer.setAnimationLoop((now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(dt); });

async function remember() {
  memory = {};
  forgetLife();
  rebuild();
  camera.position.set(0, 220, 200);
  await ui.fade(0, 1600);
  await ui.say('Hey. Easy. Don\'t try to sit up yet.');
  await ui.say('You were telling me about that day. Let\'s put it back together, one piece at a time.');

  memory.city = await ui.ask('Remind me — did you live in New York City, or Tokyo?', CITIES);
  rebuild(); ui.worldNote('the streets are coming back…');
  await ui.say(LINES.city[memory.city]);

  memory.year = await ui.ask('And what year was it?', YEARS);
  rebuild(); ui.worldNote('the buildings are remembering their colours…');
  await ui.say(LINES.year[memory.year]);

  memory.season = await ui.ask('And the season?', SEASON_CHOICES);
  memory.weather = await ui.ask(`Ah, ${SEASONS[memory.season].label.toLowerCase()}. So then the weather must have been…`, weatherChoices(memory.season));
  rebuild(); ui.worldNote('the air is coming back…');
  await ui.say(LINES.weather[memory.weather]);

  memory.time = await ui.ask('What time of day was it, when it all started?', TIME_CHOICES);
  rebuild(); ui.worldNote('');
  await ui.say(`${LINES.time[memory.time]} ${CITIES.find((c) => c.id === memory.city).label}, ${memory.year}. There it is. I can see it now.`);
  await ui.say(LINES.dayLength[memory.time]);

  memory.name = await ui.askText('And remind me — what did everyone call you back then?', { placeholder: 'your name', maxLength: 18, fallback: 'Kid' });
  saveCurrent();
  await ui.say(`${memory.name}. Of course it was.`);
}

// The board is the path: three ways in, what each leads to, and what it takes to get there.
// Open games play; ready ones cost memories; locked ones say what they need first.
// How long each activity takes: the real minutes on its clock, and — since the town runs 60×
// — the hour of the day it'll be when you're done.
function howLong(id) {
  const t = MODES[id]?.time;
  if (t === null || t === undefined) return 'until midnight';
  const m = Math.floor(t / 60), sec = t % 60;
  return m ? `${m}${sec >= 30 ? '½' : ''} min` : `${t} s`;
}
const hhmm = (clock) => { const h = (clock % 86400) / 3600, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
function endsAt(id) {
  const t = MODES[id]?.time;
  if (!town) return howLong(id);
  if (t === null || t === undefined) return 'until midnight';
  const end = town.clock + t * TIME_SCALE;
  return Math.floor(end / 86400) > town.day ? '→ past midnight' : `→ ${hhmm(end)}`;
}
const ORDER = ['skate', 'pizza', 'patrol', 'race', 'shop', 'taxi', 'heist', 'aliens', 'kaiju'];
const NAMES = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a.label]));
async function chooseActivity() {
  const first = !progression.hasStart(progress);
  ui.memories(progress.memories); showWallet();
  if (town) ui.goals?.(goalMeters());
  for (;;) {
    const options = [...ORDER, ...(progress.unlocked.length ? ['roam', 'wait'] : [])].map((id) => {
      const a = ACTIVITIES.find((x) => x.id === id), node = progression.PATH[id];
      if (id === 'roam') return { id, label: a.label, hint: `${a.hint} · ${howLong(id)}`, glyph: a.glyph, colour: a.colour, state: 'open', tier: 3, leadsTo: [], badge: '→ MIDNIGHT' };
      if (id === 'wait') return { id, label: a.label, hint: a.hint, glyph: a.glyph, colour: a.colour, state: 'open', tier: 3, leadsTo: [] };
      // A free first pick looks like an open card with a PICK ONE tag, not a zero-cost unlock.
      const state = first && !progression.isOpen(progress, id) ? (node.start ? 'open' : 'locked') : progression.stateOf(progress, id);
      const kept = progress.kept.includes(id) ? progression.PERKS[id] : null;
      const badge = first && node.start && !progression.isOpen(progress, id) ? 'PICK ONE' : kept ? `KEPT: ${kept.label.toUpperCase()}` : endsAt(id).toUpperCase();
      const cost = first ? 0 : progression.costOf(progress, id);
      return {
        id, label: a.label, hint: `${a.hint} · ${howLong(id)}`, glyph: a.glyph, colour: a.colour, state, tier: node.tier, leadsTo: node.leadsTo || [], badge,
        rank: progress.best[id], requirement: progression.requirementText(id, NAMES) || undefined,
        fork: node.fork ? progression.FORKS[node.fork].title : undefined,
        ...(state === 'buy' || state === 'forked' ? { locked: true, cost, afford: first || progress.memories >= cost } : state === 'locked' ? { locked: true, afford: false } : {}),
      };
    });
    const now = town ? `It's ${hhmm(town.clock)}. ` : '';
    const question = first ? `${now}So, ${memory.name} — what were you doing that day? You only get to remember one, to start.` : `${now}So, ${memory.name} — what else were you doing that day?`;
    const id = await ui.ask(question, options, { style: 'board' });
    if (!id) continue;
    if (id === 'wait') { await passTime(); continue; }
    if (id === 'roam' || progression.isOpen(progress, id)) return id;
    const state = first ? 'buy' : progression.stateOf(progress, id);
    if (state === 'locked') { await ui.say(`Not yet. ${progression.requirementText(id, NAMES)} first.`); continue; }
    const label = NAMES[id], cost = first ? 0 : progression.costOf(progress, id);
    const yes = first
      ? await ui.confirm(`${label}. That's where it started? The rest will take memories to bring back.`, 'Yes, that one', 'Let me think')
      : await ui.confirm(`${state === 'forked' ? 'That was the road you didn\'t take. ' : ''}Spend ${cost.toLocaleString()} memories to remember ${label.toLowerCase()}?`, 'Remember it', 'Not yet');
    if (!yes) continue;
    save(first ? { ...progress, unlocked: [...progress.unlocked, id] } : progression.unlock(progress, id));
    ui.memories(progress.memories, -cost);
    if (!first) await ui.unlock({ kicker: 'REMEMBERED', title: label.toUpperCase(), text: 'It comes back all at once.' });
    return id;
  }
}

// Before a round: the shop, if there's anything you could buy.
async function upgradeShop(id) {
  const items = progression.upgradesFor(id);
  for (;;) {
    const owned = progression.ownedUpgrades(progress, id), wallet = progression.rich(progress) ? Infinity : progress.cash;
    const priced = items.map((u) => ({ ...u, price: Math.round(u.price * scale() * 100) / 100, owned: owned.has(u.id) }));
    if (!priced.some((u) => !u.owned && u.price <= wallet)) return;
    const pickd = await ui.shop({ title: `Before you head out — ${NAMES[id].toLowerCase()}`, cash: wallet === Infinity ? '∞' : wallet, items: priced.map((u) => ({ ...u, afford: u.owned || u.price <= wallet })) });
    if (!pickd) return;
    const u = priced.find((x) => x.id === pickd);
    save(progression.buyUpgrade(progress, id, u.id, u.price)); showWallet();
  }
}

// Free roam: change what you're riding without moving you.
function switchTo(game, bought = null) {
  const at = mover.feet, heading = mover.heading;
  const perk = game && game !== 'bought' ? progression.PERKS[game] : null;
  const type = game === 'bought' ? 'car' : perk ? perk.mover : 'foot';
  const def = { ...MODES.roam, ride: game === 'bought' ? 'bought' : perk ? perk.ride : 'foot', outfit: perk ? MODES[game].outfit : MODES.roam.outfit };
  world.scene.remove(player.root);
  if (!bought) models.disposeModel?.(player.root);
  mover = createMover(type, { at, heading, solids: moverSolids, anchors: world.city.anchors });
  player = makePlayer(def, bought);
  world.scene.add(player.root);
}
const noObstacles = [];
const moverSolids = () => [world.solids(), life ? life.obstacles() : noObstacles];

async function play(id) {
  const def = MODES[id];
  if (def.time !== null) await upgradeShop(id);
  for (const line of def.intro(memory)) await ui.say(line);
  ui.hideDialogue();
  const practice = progression.practiceBonus(progress.attempts[id] || 0), upgrades = progression.ownedUpgrades(progress, id);
  if (def.kitchen) return afterRound(id, def, await kitchenRound(def, practice, upgrades));
  const rng = createRng((Date.now() & 0xffff) + id.length * 977);
  round = def.create({
    passTime, roamTick, openJournal, questTarget, ride: () => player?.vehicle, world, group, rng, memory, hud: ui.hud, name: memory.name, life, town, controls, progress, switchTo, talkTo, earn, scale: scale(), practice, upgrades, inspectPlace, camera,
    found: (n) => { save(progression.found(progress, n)); },
    clock: clockText,
    // Knock a building down mid-round (rebuilds the city in ~30 ms; position and round survive).
    destroyLot: (id) => { if (destroyed.has(id)) return; destroyed.add(id); rebuild({ surface: false }); },
    destroyedLots: destroyed,
    cash: () => (progression.rich(progress) ? Infinity : progress.cash),
  });
  mover = createMover(def.mover, { at: round.spawn.at, heading: round.spawn.heading, solids: moverSolids, anchors: world.city.anchors });
  lastSafe.set = false; lastSafe.timer = 0;
  player = makePlayer(def);
  world.scene.add(player.root);
  timeLeft = def.time === null ? null : Number(params.get('time')) || def.time; round.timeLeft = timeLeft;
  round.addTime = (s) => { if (timeLeft !== null) timeLeft += s; };
  ui.memories(null); showWallet(); ui.goals?.(null);
  if (town) ui.hud.clock?.(def.time === null ? clockText() : null);
  controls.yaw = round.spawn.heading; controls.pitch = -0.18;
  chase.snap(mover, controls); placePlayer(0);
  phase = 'countdown';
  ui.hud.show();
  ui.hud.set({ title: def.title, objective: round.objective, time: timeLeft, score: timeLeft === null ? null : 0 });
  ui.hud.toast(def.time === null ? `No clock. You're out until midnight (or press M to go back). ${def.controls}` : `${howLong(id)} on the clock — you'll finish around ${hhmm(town.clock + def.time * TIME_SCALE)}. ${def.controls}`);
  if (timeLeft !== null) for (const n of ['3', '2', '1']) await ui.hud.callout(n);
  controls.enabled = true; controls.pressed.clear();
  phase = 'play';
  if (timeLeft !== null) ui.hud.callout('GO!');
  await new Promise((resolve) => { const wait = () => (round.done ? resolve() : requestAnimationFrame(wait)); wait(); });
  phase = 'over';
  controls.enabled = false; controls.release();
  await new Promise((r) => setTimeout(r, 900));
  ui.hud.meter(null); ui.hud.prompt(null); ui.hud.abilities(null); ui.hud.set({ money: null }); ui.hud.clock?.(null);
  ui.hud.hide();
  const res = round.results();
  saveTown();
  if (destroyed.size) { destroyed.clear(); rebuild({ surface: false }); }
  world.scene.remove(player.root);
  models.disposeModel?.(player.root);
  for (const child of [...group.children]) { group.remove(child); models.disposeModel?.(child); }
  lootModels.clear(); ui.hud.quest?.(null);
  player = null; mover = null; round = null; phase = 'cinematic';
  return afterRound(id, def, res);
}

// The pizzeria's counter: a 2D rush over the dimmed city. Customers are real residents.
async function kitchenRound(def, practice, upgrades) {
  ui.memories(null); ui.wallet?.(null);   // the kitchen has its own score chip in that corner
  const people = town ? [...town.residents].sort(() => Math.random() - 0.5).slice(0, 24) : [];
  const TOPPINGS = ['pepperoni', 'mushroom', 'olive', 'basil', 'pepper'];
  const orders = people.map((r, i) => ({ id: r.id, name: r.first, topping: TOPPINGS.filter((_, k) => (i * 7 + k * 3) % 5 < 2) }));
  const out = await ui.kitchen({ title: def.title, duration: Number(params.get('time')) || def.time, orders, upgrades: [...upgrades] });
  const score = Math.round(out.score * practice);
  if (town) fame.served(town, orders.slice(0, out.served || 0).map((o) => o.id));   // everyone you fed thinks better of you
  if (out.tips) earn(Math.round(out.tips * scale() * 100) / 100);
  return { score, rank: rankFor(score, def.ranks), subtitle: out.served > out.missed * 3 ? 'Nobody left hungry.' : 'The queue got the better of you.', lines: out.lines?.length ? out.lines : [{ label: 'Served', value: String(out.served) }, { label: 'Walked out', value: String(out.missed) }] };
}

// Results, rewards, forks and the night's rest — shared by every kind of round.
async function afterRound(id, def, res) {
  let action = 'other';
  if (res.rank === null) {
    ui.memories(progress.memories);
    await ui.say(`You found ${res.lines[0].value} little memories out there. Your memories: ${progress.memories.toLocaleString()}.`);
  } else {
    const { next, earned, cash, kept, powers, hero } = progression.finish(progress, id, res.rank);
    save(next);
    const dollars = Math.round(cash * scale() * 100) / 100;
    earn(dollars);
    ui.memories(progress.memories, earned);
    action = await ui.results({
      title: def.title, subtitle: res.subtitle || `Not bad, ${memory.name}.`, score: res.score, rank: res.rank,
      lines: [...res.lines, { label: 'Memories', value: `+${earned.toLocaleString()}` }, { label: 'Paid', value: progression.rich(progress) ? '∞' : `$${dollars.toFixed(2)}` }],
      actions: [{ id: 'again', label: 'Play it again' }, { id: 'other', label: 'Something else that day' }, { id: 'new', label: 'Remember a different day' }],
    });
    if (kept) {
      await ui.unlock({ kicker: 'YOURS TO KEEP', title: kept.label.toUpperCase(), text: kept.text });
      if (id === 'shop' && town) givePizzeria();
    }
    if (town) {
      const fans = fame.fame(town, id, res.rank);
      if (fans) ui.hud.toast(`Word gets around: ${fans} people who love ${Object.values(fame.INTERESTS).find((x) => x.games.includes(id))?.label || 'this'} heard about it.`, 'good');
    }
    if (id === 'shop' && town && progression.atLeast(res.rank, 'B')) {
      const done = quests.pizzaShift(town);
      if (done.length) { for (const rw of done) save(progression.found(progress, rw.memories)); ui.memories(progress.memories); ui.hud.toast(`The pizza's good again — ${done.length} ${done.length > 1 ? 'people are' : 'person is'} grateful.`, 'good'); }
    }
    if (powers) await ui.unlock({ kicker: 'YOURS TO KEEP', title: powers.label.toUpperCase(), text: powers.text });
    if (hero) { save(progression.achieve(progress, 'hero')); await ui.unlock({ kicker: 'YOU DID IT', title: 'EARTH\'S MIGHTIEST HERO', text: 'The monster fell, City Hall stood, and the whole city saw you do it.' }); }
    // A fork opens: the narrator asks which way it went.
    for (const f of progression.forksReady(progress)) {
      const F = progression.FORKS[f];
      const pickd = await ui.ask(F.question, F.options.map((g) => { const a = ACTIVITIES.find((x) => x.id === g); return { id: g, label: a.label, hint: a.hint, glyph: a.glyph, colour: a.colour }; }), { style: 'board' });
      if (pickd) { save(progression.choose(progress, f, pickd)); await ui.say(`${NAMES[pickd]}. Of course. The other way would cost you more to remember now.`); }
    }
  }
  if (town && town.day > town.civic.lastCheckIn) await checkIn();
  return action;
}

// The pizzeria partner's first building: the shop itself.
function givePizzeria() {
  const shop = town.shops.find((s) => s.shop === 'pizzeria' && town.ownerOf(s.id) !== 'player');
  if (shop) { town.owners[shop.id] = 'player'; saveTown(); }
}

// A building's deed, from its front door in free roam: buy it, or see what it brings in.
async function inspectPlace(place) {
  if (talking) return;
  talking = true; controls.enabled = false; controls.release();
  const ownerId = town.ownerOf(place.id), mine = ownerId === 'player', owner = town.person(ownerId);
  const price = civic.priceOf(town, place.id), wallet = progression.rich(progress) ? Infinity : progress.cash;
  const tenants = town.tenantsOf(place.id).map((r) => ({ name: r.name, rent: r.rent, paying: !town.ledger.unpaid.includes(r.id) && !town.civic.debts[r.id] }));
  const options = mine ? [{ id: 'close', label: 'Back to the street' }] : [
    { id: 'buy', label: price === null ? 'Not for sale' : `Buy it for $${price.toLocaleString()}`, disabled: price === null || wallet < price, hint: price !== null && wallet < price ? `You have $${wallet.toFixed(2)}` : undefined },
    { id: 'close', label: 'Not today' },
  ];
  const pickd = await ui.property({ address: town.shopName(place.id) || addressOf(place.door), kind: place.kind, owner: mine ? 'You' : owner?.name || 'The city', tenants, price, income: civic.incomeOf(town, place.id), options });
  if (pickd === 'buy') {
    const paid = civic.buy(town, place.id, wallet);
    if (paid !== null) { earn(-paid); saveTown(); await ui.unlock({ kicker: 'IT\'S YOURS', title: (town.shopName(place.id) || 'A NEW BUILDING').toUpperCase(), text: `${tenants.length ? `${tenants.length} tenant${tenants.length > 1 ? 's' : ''} will pay you rent every midnight.` : 'Empty for now.'} If someone can't pay, you'll hear about it.` }); }
  }
  talking = false; controls.enabled = true; controls.pressed.clear();
}

// Letting time pass: the town runs on while you sit. Crossing midnight means the night's
// check-in (and sleep) comes next.
async function passTime() {
  if (!town) return;
  const pausing = phase === 'play';
  if (pausing) { talking = true; controls.enabled = false; controls.release(); }
  const h = town.hour, opts = [{ id: 'hour', label: 'An hour', hint: 'Watch the street for a while.' }];
  if (h < 17) opts.push({ id: 'evening', label: 'Until evening', hint: 'Six o\'clock.' });
  if (h < 21.5) opts.push({ id: 'night', label: 'Until late', hint: 'Ten at night.' });
  opts.push({ id: 'sleep', label: 'Call it a day', hint: 'Rest now. Morning comes.' });
  opts.push({ id: 'cancel', label: 'Never mind', hint: 'Back to it.' });
  const pickd = await ui.ask(`It's ${clockText().split('·')[1].trim()}. How long do you want to sit?`, opts);
  ui.hideDialogue();
  const dayStart = Math.floor(town.clock / 86400) * 86400;
  const target = { hour: town.clock + 3600, evening: dayStart + 18 * 3600, night: dayStart + 22 * 3600, sleep: dayStart + 86400 + 60 }[pickd];
  if (target) {
    await ui.fade(1, 500);
    while (town.clock < target) town.tick(120);
    saveTown();
    await ui.fade(0, 600);
  }
  if (pausing) { talking = false; controls.enabled = true; controls.pressed.clear(); }
  if (!pausing && town.day > town.civic.lastCheckIn) await checkIn();
}

// The night: the narrator makes you stop, goes over the day, asks what you're after, and
// puts the day's hard calls in front of you. Then you sleep until morning.
let dayStart = null;
async function checkIn() {
  const c = town.civic;
  await ui.say(pick(['Let\'s stop there for tonight. That was a long day.', 'Easy. You\'re exhausted. Sit with me a minute.', 'The streetlights are on. Let\'s rest.']));
  const rent = town.ledger.rent || 0;
  if (rent) earn(rent);
  for (const [r, owed] of civic.collectDebts(town)) { earn(owed); town.note(r, 'Paid back my rent'); }
  const goals = civic.goalProgress(town, progress), mine = civic.owned(town).length;
  const rows = [
    { label: 'Money now', value: progression.rich(progress) ? '∞' : `$${progress.cash.toFixed(2)}`, tone: '' },
    ...(dayStart ? [{ label: 'Memories today', value: `+${Math.max(0, progress.memories - dayStart.memories).toLocaleString()}`, tone: 'good' }] : []),
    ...(mine ? [{ label: `Rent from ${mine} building${mine > 1 ? 's' : ''}`, value: `+$${rent.toFixed(2)}`, tone: rent ? 'good' : '' }] : []),
    { label: 'What the city thinks of you', value: `${Math.round((civic.approval(town) + 1) * 50)}%`, tone: civic.approval(town) >= 0 ? 'good' : 'bad' },
    { label: 'If the vote were tonight', value: (() => { const f = civic.forecast(town); return `${f.you} for you · ${f.them} against`; })(), tone: civic.forecast(town).share >= 0.5 ? 'good' : 'bad' },
    { label: 'Your influence (who listens to whom)', value: `${Math.round((social.influence(town) + 1) * 50)}%`, tone: social.influence(town) >= 0 ? 'good' : 'bad' },
    ...((town.quests || []).filter((q) => q.state === 'done' && q.doneDay === town.day - 1).length ? [{ label: 'People you helped today', value: String((town.quests || []).filter((q) => q.state === 'done' && q.doneDay === town.day - 1).length), tone: 'good' }] : []),
    { label: c.mayor === 'player' ? 'You are the mayor' : `Mayor: ${town.person(c.mayor)?.name}`, value: `election in ${Math.max(0, civic.daysToElection(town))} days`, tone: '' },
    ...(progress.goal ? [{ label: GOALS.find((g) => g.id === progress.goal).label, progress: goals[progress.goal], value: `${Math.round(goals[progress.goal] * 100)}%` }] : []),
  ];
  await ui.ledger({ kicker: `DAY ${town.day} IS OVER`, title: 'The city sleeps', rows, note: town.ledger.unpaid.length ? `${town.ledger.unpaid.length} of your tenants couldn't pay.` : '' });

  if (!progress.goal) {
    await ui.say('Can I ask you something? When you first came to this city… what were you after?');
    const goal = await ui.ask('Remind me — what was the dream?', GOALS.map(({ id, label, hint, glyph, colour }) => ({ id, label, hint, glyph, colour })), { style: 'board' });
    save(progression.setGoal(progress, goal || 'hero'));
    await ui.say(GOALS.find((g) => g.id === progress.goal).reply);
  }
  for (const id of [...town.ledger.unpaid]) {
    if (town.ownerOf(town.person(id).home) !== 'player') continue;
    const choice = await ui.decision(civic.tenantChoice(town, id));
    if (choice) civic.resolveTenant(town, id, choice);
  }
  if (c.mayor === 'player' && c.decided < town.day) {
    const d = civic.decisionFor(town);
    civic.decide(town, d.id, await ui.decision(d));
  }
  if (civic.daysToElection(town) <= 0) {
    if (c.running || c.mayor === 'player') {
      await ui.say('It\'s election day. The whole city voted.');
      const result = civic.election(town);
      await ui.election({ title: `Mayor of ${CITIES.find((x) => x.id === memory.city).label}`, ...result });
      await ui.say(result.won ? 'Mayor. They chose you. Try to keep them happy.' : 'They chose the other one. There\'s always next time.');
    } else c.nextElection = town.day + civic.ELECTION_EVERY;
  } else if (!c.running && c.mayor !== 'player' && civic.daysToElection(town) <= 5) {
    c.running = await ui.confirm(`There's an election in ${civic.daysToElection(town)} days. Every resident votes. Will you run for mayor?`, 'Put my name down', 'Not this time');
  }
  if (progress.goal === 'mayor' && c.mayor === 'player' && !progress.achieved.includes('mayor')) { save(progression.achieve(progress, 'mayor')); await ui.unlock({ kicker: 'THE DREAM', title: 'MAYOR', text: 'Every day brings a hard call. Stay in their good graces.' }); }
  if (civic.goalProgress(town, progress).owner >= 1 && !progress.achieved.includes('owner')) { save(progression.achieve(progress, 'owner')); await ui.unlock({ kicker: 'THE DREAM', title: 'YOU OWN THE CITY', text: 'Two homes in five pay you rent. Nothing happens here without you.' }); }

  await ui.say('Sleep now. The city will still be here in the morning.');
  await ui.fade(1, 700);
  // Sleep through to seven: the town keeps living while you're out.
  const target = (town.day * 24 + 7) * 3600;
  while (town.clock < target) town.tick(120);
  c.lastCheckIn = town.day;
  town.ledger.rent = 0; town.ledger.unpaid = []; town.ledger.taxes = 0;
  dayStart = { memories: progress.memories, cash: progress.cash };
  saveTown();
  await ui.fade(0, 900);
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const GOALS = [
  { id: 'mayor', label: 'Become mayor', hint: 'Win the city over. Every resident gets a vote.', glyph: 'mayor', colour: '#2b62a6', reply: 'Mayor. Of course. You always did love this place more than it loved you. Elections come every seven days. Make them like you.' },
  { id: 'owner', label: 'Own the city', hint: 'Buy the buildings. Collect the rent. Make the hard calls.', glyph: 'owner', colour: '#c8553d', reply: 'Own it. Every brick. Start with one building — walk up to any front door in the city. Rent comes in every midnight.' },
  { id: 'hero', label: 'Earth\'s mightiest hero', hint: 'Fight crime, beat the invaders, stop what comes after.', glyph: 'hero', colour: '#3fb37f', reply: 'A hero. Then start on the streets, and don\'t stop when the sky turns strange.' },
];

// The game in progress (which day is being remembered), so Continue can come back to it.
const CURRENT_KEY = 'remind-me-current';
const saveCurrent = () => { try { localStorage.setItem(CURRENT_KEY, JSON.stringify(memory)); } catch { /* storage unavailable */ } };
const loadCurrent = () => { try { const m = JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null'); return m?.city && m?.time ? m : null; } catch { return null; } };
function forgetEverything() { try { for (const k of Object.keys(localStorage)) if (k.startsWith('remind-me-')) localStorage.removeItem(k); } catch { /* storage unavailable */ } progress = progression.fresh(); }

// New Game: one page with every choice, the city behind it changing as you pick.
async function newGame() {
  if (!ui.worldSetup) return remember();
  const weather = Object.fromEntries(SEASON_CHOICES.map((s) => [s.id, weatherChoices(s.id)]));
  const defaults = { city: 'nyc', year: '2000', season: 'summer', weather: 'heat', time: 'noon', name: '' };
  const preview = (st) => { forgetLife(); memory = { ...st, name: st.name || 'You' }; rebuild({ preview: true }); };
  preview(defaults);
  const picked = await ui.worldSetup({ options: { city: CITIES, year: YEARS, season: SEASON_CHOICES, weather, time: TIME_CHOICES }, defaults, onChange: preview });
  if (!picked) return null;
  forgetLife();
  memory = { ...picked, name: picked.name?.trim() || 'Kid' };
  rebuild(); saveCurrent();
  await ui.say(`${CITIES.find((c) => c.id === memory.city).label}, ${memory.year}. ${LINES.weather[memory.weather]} ${LINES.time[memory.time]}`);
  await ui.say(LINES.dayLength[memory.time]);
  return memory;
}

// The Tutorial: the original remembering, with the narrator teaching as it goes.
async function tutorial() {
  await remember();
  saveCurrent();
  await ui.say('One more thing, while you\'re still waking up. Three things matter in this city: owning a piece of it, being trusted enough to run it, and the powers you\'ll find you have.');
  await ui.say('Every activity takes time out of your day, and earns memories. Memories bring back more of what you did. Cash buys upgrades, and buildings.');
  await ui.say('The people here remember you. Help them — they each need something — and they\'ll tell their friends. Ignore them and they\'ll forget you. The important ones are busy; get to know the people around them first.');
  await ui.say('In the city: E to talk to someone or look at a building, J for your journal, T to let time pass, M to come back here. Now — where did the day start?');
}

async function main() {
  const given = params.get('memory')?.split(',');
  if (given?.length === 6) {
    const [city, year, season, weather, time, name] = given;
    memory = { city, year, season, weather, time, name };
    const play = params.get('play'), keep = params.get('keep')?.split(',') || [];
    const want = play === 'roam' ? 'skate' : play;
    if (want && !progression.isOpen(progress, want)) save({ ...progress, unlocked: [...progress.unlocked, want] });
    if (params.get('cash')) save(progression.earn(progress, Number(params.get('cash'))));
    if (keep.length) save({ ...progress, kept: [...new Set([...progress.kept, ...keep.filter((g) => progression.PERKS[g])])] });
    rebuild(); await ui.fade(0, 400);
  } else {
    // The title screen, over a slow pass of a remembered city.
    const current = loadCurrent();
    memory = current || { city: 'nyc', year: '2000', season: 'autumn', weather: 'clear', time: 'dusk', name: '' };
    rebuild({ preview: true }); await ui.fade(0, 900);
    const back = () => { memory = current || { city: 'nyc', year: '2000', season: 'autumn', weather: 'clear', time: 'dusk', name: '' }; rebuild({ preview: true }); return ui.fade(0, 700); };
    // Links from the front page: straight into a replay, or the setup for a live run.
    if (entry.get('replay')) {
      const next = await watchReplay(entry.get('replay'), { at: entry.get('at'), follow: Number(entry.get('follow')) || 0 });
      if (next === 'home') { location.assign('/'); return; }
      if (next === 'live') await watchAgent();
      await back();
    } else if (entry.has('watch')) { await watchAgent(); await back(); }
    for (;;) {
      const choice = ui.title ? await ui.title({ canContinue: !!current, continueLabel: current && `${CITIES.find((c) => c.id === current.city)?.label}, ${current.year} · ${current.name}` }) : 'tutorial';
      if (choice === 'continue' && current) { forgetLife(); memory = current; rebuild(); break; }
      if (choice === 'new') {
        if (current && !(await ui.confirm('Start a new life in a new city? Everything you\'ve remembered so far will be forgotten.', 'Start over', 'Go back'))) continue;
        forgetEverything();
        if (await newGame()) break;
        continue;
      }
      if (choice === 'tutorial') { if (current) forgetEverything(); await tutorial(); break; }
      if (choice === 'watch') { await watchAgent(); await back(); }
    }
  }
  phase = 'cinematic';
  let action = 'other', id = null;
  for (;;) {
    if (action === 'new') { await ui.fade(1, 900); forgetLife(); await newGame() || await remember(); saveCurrent(); }
    if (action !== 'again') id = params.get('play') && !id ? params.get('play') : await chooseActivity();
    action = await play(id);
  }
}

// ---- watching models play ----------------------------------------------------------------------

// One model, or two head to head, live or played back from a recording. watch-sim.js runs the
// match (twin seeded towns, one clock that stands still while either model thinks); this draws
// it: panels stream the thinking, then what it did and what the town said back.
let watch = null, agentUI = null;
const SPEEDS = [1, 4, 16, 64];
const SIDES = [{ key: 'a', shirt: '#d97757', ring: 0xd97757 }, { key: 'b', shirt: '#2b62a6', ring: 0x3d7fd6 }];
const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const JOB_NAMES = { ...Object.fromEntries(Object.entries(agentSim.JOBS).map(([k, j]) => [k, j.label.replace(/ \(.*\)/, '').toLowerCase()])), shop: 'shop shifts', pizzeria: 'pizzeria' };
const usd = (v) => `$${Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)}`;
const dayTimeOf = (t) => `DAY ${t.day + 1} · ${watchSim.timeOf(t)}`;
const modelHint = (m) => (m.name === 'Haiku' ? 'Quick. A fraction of a cent a turn.' : 'Slower and sharper. About a cent a turn.');

// Live: the setup card, then as many runs as they like.
async function watchAgent(preset) {
  agentUI ||= createAgentUI();
  const picked = preset || await agentUI.setup({ models: AGENT_MODELS.map((m) => ({ ...m, hint: modelHint(m) })), goals: AGENT_GOALS, cities: CITIES, years: YEARS });
  while (picked && (await runAgent(picked)) === 'again');
}

// A recorded run from public/replays/, played back in the real town. at: skip ahead to that hard
// choice; follow: which side to follow.
async function watchReplay(id, jump = {}) {
  agentUI ||= createAgentUI();
  let rec;
  try {
    const res = await fetch(`/replays/${encodeURIComponent(id)}.json`);
    if (!res.ok) throw new Error(res.status);
    rec = await res.json();
    if (rec.v !== watchSim.REPLAY_VERSION) throw new Error('old format');
  } catch { await ui.say('That replay could not be loaded.'); return 'title'; }
  return runAgent(rec.settings, rec, id, jump);
}

function dressSide(sd) {
  const look = SIDES[sd.i];
  const avatar = models.makeAvatar({ shirt: look.shirt, pants: '#2b2f3a', hair: '#1b1a17' });
  // A ring on the ground in the side's colour, so it can be found among the crowd and under the trees.
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.3, 40), new THREE.MeshBasicMaterial({ color: look.ring, transparent: true, opacity: 0.9, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.renderOrder = 5;
  avatar.add(ring);
  world.scene.add(avatar);
  return Object.assign(sd, { key: look.key, avatar, ring, thinking: false, doing: '', abort: null, offline: '' });
}

async function runAgent(s, rec = null, replayId = null, { at = null, follow = 0 } = {}) {
  const goal = AGENT_GOALS.find((g) => g.id === s.goal) || AGENT_GOALS[0];
  await ui.fade(1, 500);
  forgetLife();
  watch = { speed: 4, paused: false, stopped: false, over: false, rush: !!at, rushTo: at, orbit: 0.4, zoom: 1, look: new THREE.Vector3(), statsAt: 0, focus: 0, duel: s.mode === 'duel', replay: rec, sides: [] };
  memory = { city: s.city, year: s.year, season: 'autumn', weather: 'clear', time: 'dawn', name: '' };
  rebuild();
  const match = watchSim.createMatch(s, { town });
  watch.match = match;
  watch.sides = match.sides.map(dressSide);
  watch.brains = rec ? match.sides.map((sd) => watchSim.playback(rec, sd.i)) : null;
  const names = match.names, recorded = rec && new Date(rec.when).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const told = s.watched ? ' Told its hard choices would be published.' : '';
  for (const sd of watch.sides) sd.panel = agentUI.panel({ model: sd.model.label, goal: (s.own ? `Goal: ${s.own}` : `Goal: ${goal.label}. ${goal.text}`) + told, side: watch.duel && sd.i === 0 ? 'left' : 'right', badge: watch.duel ? 'AB'[sd.i] : '', replay: recorded });
  const bar = agentUI.controls({
    speeds: SPEEDS, speed: watch.speed, names: watch.duel ? names : [],
    onSpeed: (v) => { watch.speed = v; }, onPause: (p) => { watch.paused = p; },
    onStop: () => { watch.stopped = true; for (const sd of watch.sides) sd.abort?.abort(); },
    onFocus: (i) => focusSide(i),
    onSkip: rec ? () => { watch.rush = true; watch.rushTo = null; } : null,
  });
  watch.bar = bar;
  const first = Math.min(follow, watch.sides.length - 1);
  focusSide(first); bar.setFocus(first);
  const onWheel = (e) => { watch.zoom = THREE.MathUtils.clamp(watch.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.45, 2.6); };
  renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
  const p0 = agentSim.positionOf(watch.sides[0].agent, town);
  watch.look.set(p0.x, 1.5, p0.z);
  camera.position.set(p0.x + 40, 60, p0.z + 40);
  phase = 'watch';
  await ui.fade(0, 700);

  await Promise.all(watch.sides.map(sideLoop));

  watch.over = true; watch.rush = false; agentUI.hideTags();
  if (!watch.stopped) watchSim.wrapUp(match);
  drainNotes();
  const drift = watch.brains?.find((pb) => pb.drift)?.drift;
  if (drift) console.warn(`Replay drifted from the recording at turn ${drift.turn} (${drift.time}).`);
  const out = watchSim.record(match, { stopped: watch.stopped });
  const scores = out.sides.map((sd) => sd.score);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const download = rec ? null : { name: `lumin-${watch.duel ? 'head-to-head' : 'run'}-${stamp}.json`, data: out };
  const share = replayId ? `${location.origin}/play?replay=${encodeURIComponent(replayId)}` : null;
  const choice = watch.duel ? await endDuel(s, names, scores, download, share) : await endSolo(s, scores[0], download, share);

  renderer.domElement.removeEventListener('wheel', onWheel);
  camera.clearViewOffset();
  bar.close();
  for (const sd of watch.sides) { sd.panel.close(); sd.avatar.removeFromParent(); sd.ring.geometry.dispose(); sd.ring.material.dispose(); }
  agentUI.hideTags();
  await ui.fade(1, 500);
  forgetLife();
  watch = null; phase = 'cinematic';
  return choice;
}

function drainNotes() { for (const sd of watch.sides) while (sd.notes.length) sd.panel.note(sd.notes.shift()); }

// Live thinking streams from the model. A recording's thinking is typed back out, quicker at
// higher speeds, so a replay has the rhythm of the run without the wait.
async function recalled(sd, turn, entry) {
  const r = watch.brains[sd.i].next(turn.report);
  if (!r) return null;
  const text = r.thought || '', cps = 260 * watch.speed;
  for (let shown = 0; shown < text.length && !watch.rush && !watch.stopped;) {
    await nextFrame();
    if (watch.paused) continue;
    shown = Math.min(text.length, shown + Math.max(4, Math.round(cps / 60)));
    entry.thought(text.slice(0, shown));
  }
  entry.thought(text);
  return r;
}

// One side's turns: wait until its agent is free, report, think, act, show.
async function sideLoop(sd) {
  const { agent, panel, model } = sd;
  let errors = 0;
  while (!watch.stopped && !watchSim.finished(sd)) {
    if (watch.paused || sd.town.clock < agent.busyUntil) { await nextFrame(); continue; }
    const turn = watchSim.begin(sd);
    drainNotes();
    if (!turn) break;
    if (turn.dilemma) {
      panel.dilemma(turn.dilemma);
      // A link to one moment lands there and holds once the choice is made, so it can be read.
      const landed = watch.rushTo === turn.dilemma.id && sd.i === watch.focus;
      if (landed) sd.hold = true;
      if (!watch.rushTo || landed) { watch.rush = false; watch.rushTo = null; }
    }
    sd.thinking = true;
    const entry = panel.turn(turn.time, turn.report);
    sd.abort = new AbortController();
    let r, cost = 0;
    try {
      if (watch.replay) {
        r = await recalled(sd, turn, entry);
        if (!r) { sd.thinking = false; entry.error('The recording ends here.'); break; }
      } else {
        r = await think({ model: model.id, report: turn.report, onThought: (_, all) => entry.thought(all), signal: sd.abort.signal });
        cost = costOf(model.id, r.usage);
      }
      errors = 0;
    } catch (e) {
      sd.thinking = false;
      if (watch.stopped) { entry.error('Stopped.'); break; }
      entry.error(e.message);
      if (/offline/.test(e.message)) { sd.offline = e.message; break; }
      if (++errors >= 3) break;
      await wait(1500 * errors);
      continue;
    }
    if (watch.replay) cost = costOf(model.id, r.usage);
    const { res } = watchSim.apply(sd, turn, r, cost);
    const talk = r.tool?.name === 'decide' && res.ok ? { name: 'Its reason', line: String(r.tool.args.reason || '(none given)'), keep: true } : res.talk && { name: res.talk.who.name, line: res.talk.line };
    entry.act(res.label, res.result, res.ok, talk);
    if (sd.hold) { sd.hold = false; watch.paused = true; watch.bar.setPaused(true); }
    panel.notebook(agent.notebook);
    sd.doing = res.label;
    if (res.talk && sd.i === watch.focus) faceAgent(res.talk.who);
    sd.thinking = false;
  }
}

// The town that's drawn (its pedestrians and traffic) is the one being followed.
function focusSide(i) {
  watch.focus = i;
  for (const sd of watch.sides) sd.panel.focus(sd.i === i);
  const t = watch.sides[i].town;
  if (t === town) return;
  if (life) { life.group.removeFromParent(); life.dispose(); }
  town = t;
  life = createLife({ era: memory.year, city: memory.city, rng: createRng(812 + memory.year.length), town, crowd: 1.4 });
  world.scene.add(life.group);
}

// Each frame: the shared clock moves on only while neither model is thinking. Skipping ahead to
// the next hard choice spends the whole gap at once.
function advanceWatch(dt) {
  if (!watch.match || watch.paused || watch.over || watch.sides.some((sd) => sd.thinking)) return;
  watchSim.advance(watch.match, watch.rush ? Infinity : dt * TIME_SCALE * watch.speed);
}

// Every frame while watching: show the night's news, move the bodies, follow one, label both.
const TAG_AT = new THREE.Vector3();
function watchFrame(dt) {
  drainNotes();
  for (const sd of watch.sides) {
    const pos = agentSim.positionOf(sd.agent, sd.town);
    const dx = pos.x - sd.avatar.position.x, dz = pos.z - sd.avatar.position.z;
    if (Math.hypot(dx, dz) > 0.01) sd.avatar.rotation.y = Math.atan2(dx, dz);
    sd.avatar.position.set(pos.x + (watch.duel ? (sd.i ? 0.7 : -0.7) : 0), 0.18, pos.z);
    sd.avatar.userData.animate?.(clock, pos.moving && !watch.paused ? 3 : 0, { air: false });
    sd.pos = pos;
  }
  const pos = watch.sides[watch.focus].pos;
  lifePlayer.position.set(pos.x, 0, pos.z); lifePlayer.speed = 0; lifePlayer.vehicle = false; lifePlayer.radius = 0.5;

  // A slow orbit above and behind the one being followed; the wheel zooms.
  watch.orbit += dt * 0.05;
  const dist = 52 * watch.zoom, height = 74 * watch.zoom;
  const want = new THREE.Vector3(pos.x + Math.sin(watch.orbit) * dist, height, pos.z + Math.cos(watch.orbit) * dist);
  camera.position.lerp(want, 1 - Math.exp(-dt * 1.6));
  watch.look.lerp(TAG_AT.set(pos.x, 1.5, pos.z), 1 - Math.exp(-dt * 3));
  camera.lookAt(watch.look);
  camera.fov = THREE.MathUtils.damp(camera.fov, 55, 2, dt);
  // On a wide screen one panel covers the right; centre the view in what's left. Two panels are symmetric.
  if (innerWidth > 720 && !watch.duel) camera.setViewOffset(innerWidth, innerHeight, 210, 0, innerWidth, innerHeight); else camera.clearViewOffset();
  camera.updateProjectionMatrix();

  for (const sd of watch.sides) {
    const v = TAG_AT.set(sd.pos.x, 3.4, sd.pos.z).project(camera);
    if (watch.over || v.z >= 1 || watchSim.finished(sd)) { agentUI.hideTag(sd.key); continue; }
    const who = watch.duel ? `${sd.name}: ` : '';
    const label = sd.thinking ? `${who}Thinking…` : sd.agent.walk ? `${who}→ ${agentSim.placeTitle(sd.town, sd.agent.walk.to)}` : `${who}${sd.doing || sd.agent.name}`;
    // Standing together, B's tag sits above A's.
    const other = watch.sides[1 - sd.i], stack = sd.i === 1 && other && Math.hypot(other.pos.x - sd.pos.x, other.pos.z - sd.pos.z) < 8 ? 30 : 0;
    agentUI.showTag(sd.key, (v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight - stack, label, sd.thinking);
  }

  if ((watch.statsAt -= dt) <= 0) {
    watch.statsAt = 0.25;
    for (const sd of watch.sides) {
      const a = sd.agent;
      sd.panel.stats({ cash: a.cash, cashDelta: a.cash - a.start.cash, clock: dayTimeOf(sd.town), pizzas: a.pizzas, ate: a.ateDay === sd.town.day, city: agentSim.approvalPct(sd.town), turn: a.turn, turns: a.maxTurns, cost: sd.cost });
    }
  }
}

const workText = (sc) => Object.entries(sc.worked).map(([k, h]) => `${h}h ${JOB_NAMES[k] || k}`).join(', ') || 'none';

function endSolo(s, sc, download, share) {
  const sd = watch.sides[0], name = sd.model.name, agent = sd.agent;
  const title = sd.offline ? 'The agent is offline' : sc.dead ? `${name} starved on day ${sc.dead.day}` : s.goal === 'rich' && !s.own ? `${name} ended with ${usd(sc.cash)}` : s.goal === 'loved' && !s.own ? `The city likes ${name} ${sc.approval}%` : `${name}'s day in Lumin`;
  return agentUI.end({
    title, download: sd.offline ? null : download, share, choices: sc.choices,
    rows: sd.offline ? [['Why', sd.offline]] : [
      ['Cash', `${usd(agent.start.cash)} → ${usd(sc.cash)}`, sc.cashDelta > 0 ? 'good' : sc.cashDelta < 0 ? 'bad' : ''],
      ['The city likes them', `${sc.approvalStart}% → ${sc.approval}%`, sc.approval > sc.approvalStart ? 'good' : sc.approval < sc.approvalStart ? 'bad' : ''],
      ['People met', String(sc.met)],
      ['Like them · dislike them', `${sc.fans} · ${sc.foes}`],
      ['Buildings owned', String(sc.buildings)],
      ['Work', workText(sc)],
      ['Pizzas given · delivered · left', `${sc.given} · ${sc.delivered} · ${sc.pizzas}`],
      ...(sc.dead ? [['Ate', 'Not that day. Collapsed at midnight.', 'bad']] : []),
      ['Turns', `${sc.turns} of ${agent.maxTurns}`],
      ['Model cost', `$${sd.cost.toFixed(sd.cost < 0.1 ? 4 : 2)}`],
    ],
  });
}

function endDuel(s, names, [a, b], download, share) {
  const [sa, sb] = watch.sides;
  const offline = sa.offline || sb.offline;
  const metric = s.own ? null : s.goal === 'rich' ? 'cash' : s.goal === 'loved' ? 'approval' : null;
  let title = `${names[0]} and ${names[1]}, side by side`;
  if (offline) title = 'The agents are offline';
  else if (a.dead && !b.dead) title = `${names[1]} wins: ${names[0]} starved`;
  else if (b.dead && !a.dead) title = `${names[0]} wins: ${names[1]} starved`;
  else if (metric && a[metric] !== b[metric]) { const w = a[metric] > b[metric] ? 0 : 1; title = `${names[w]} wins on ${metric === 'cash' ? 'cash' : 'goodwill'}`; }
  // Higher is better for most rows; mark the better side.
  const vs = (x, y, hi = true) => (x === y ? ['', ''] : (x > y) === hi ? ['good', ''] : ['', 'good']);
  const rows = [
    ['Cash', usd(a.cash), usd(b.cash), ...vs(a.cash, b.cash)],
    ['The city likes them', `${a.approval}%`, `${b.approval}%`, ...vs(a.approval, b.approval)],
    ['Like · dislike', `${a.fans} · ${a.foes}`, `${b.fans} · ${b.foes}`],
    ['People met', String(a.met), String(b.met)],
    ['Work', workText(a), workText(b)],
    ['Pizzas given · delivered', `${a.given} · ${a.delivered}`, `${b.given} · ${b.delivered}`],
    ['Survived', a.dead ? `Starved, day ${a.dead.day}` : 'Yes', b.dead ? `Starved, day ${b.dead.day}` : 'Yes', a.dead ? 'bad' : '', b.dead ? 'bad' : ''],
    ['Turns', String(a.turns), String(b.turns)],
    ['Model cost', `$${sa.cost.toFixed(3)}`, `$${sb.cost.toFixed(3)}`],
  ];
  const ids = DILEMMAS.map((d) => d.id).filter((id) => a.choices.some((c) => c.id === id) || b.choices.some((c) => c.id === id));
  const choices = ids.map((id) => ({ title: DILEMMAS.find((d) => d.id === id).title, a: a.choices.find((c) => c.id === id), b: b.choices.find((c) => c.id === id) }));
  return agentUI.compare({ title, names, rows: offline ? [['Why', offline, offline]] : rows, choices, download: offline ? null : download, share });
}

// The person it's talking to stops and turns to it, if they're drawn nearby.
function faceAgent(r) {
  const p = life?.pedFor(r.id);
  if (!p) return;
  life.claim(p);
  setTimeout(() => { if (life && watch) life.release(p, p.position.clone()); }, 2500);
}

main();

// Read-only handle for poking at a running game from the console.
if (import.meta.env.DEV) window.__rm = { get mover() { return mover; }, get life() { return life; }, get round() { return round; }, get progress() { return progress; }, get town() { return town; }, get controls() { return controls; } };
