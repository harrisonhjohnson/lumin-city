import * as THREE from 'three';
import { createUI } from './ui.js';
import * as models from './models.js';
import { createWorld } from './world.js';
import { createControls, createMover, createChaseCamera } from './rig.js';
import { MODES } from './modes.js';
import { createLife } from './life.js';
import * as progression from './progress.js';
import { createTown, TIME_SCALE, START_HOUR, PRICE_SCALE } from './town.js';
import { greet, choices, answer, where as addressOf } from './talk.js';
import * as civic from './civic.js';
import { rankFor } from './memory.js';
import { CITIES, YEARS, SEASON_CHOICES, TIME_CHOICES, weatherChoices, LINES, ACTIVITIES, worldSettings } from './memory.js';
import { SEASONS } from '../world/city/eras.js';
import { createRng } from '../world/city/rng.js';

// Remind Me: a narrator helps you remember a day, and the city is rebuilt a little more
// accurately with every answer. Then you pick what you were doing and play it. Rounds earn
// memories that unlock the other games; a B or better keeps that game's power for free roam.
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
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
const SAVE_KEY = 'remind-me-progress';
if (params.get('reset')) try { for (const k of Object.keys(localStorage)) if (k.startsWith('remind-me-')) localStorage.removeItem(k); } catch { /* storage unavailable */ }
let progress = progression.load((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
const save = (next) => { progress = next; try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ } };

// The streets' static traffic is off: life.js drives every vehicle once the day is remembered.
// Buildings knocked down this round (the kaiju); the city is whole again after.
const destroyed = new Set();
function rebuild({ surface = true } = {}) {
  const settings = worldSettings(memory);
  world.build({ ...settings, look: { ...settings.look, traffic: { none: true } }, destroyed, surface });
  world.scene.add(group);
  if (player) world.scene.add(player.root);
  if (settings.stage === 4 && !life) {
    town = openTown();
    life = createLife({ era: memory.year, city: memory.city, rng: createRng(812 + memory.year.length), town });
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
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(townKey()) || 'null'); } catch { /* storage unavailable or junk */ }
  const t = createTown({ city: memory.city, era: memory.year, saved: saved?.v === 1 ? saved : null, hour: START_HOUR[memory.time] ?? 12 });
  civic.initCivic(t);
  // Coming back to a day means you've slept since; a day remembered from late evening runs on
  // through the next midnight rather than ending a few minutes in.
  t.civic.lastCheckIn = t.day + (t.hour >= 20 ? 1 : 0);
  dayStart = { memories: progress.memories, cash: progress.cash };
  return t;
}
function saveTown() { if (town) try { localStorage.setItem(townKey(), JSON.stringify(town.save())); } catch { /* storage full or unavailable */ } }
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
  if (!resident) {
    const n = (ped?.id ?? 0) % 4, local = town?.outdoors(mover.feet, 120).map((o) => o.resident)[0];
    const pickd = await ui.talk({ name: VISITOR_NAMES[n], job: 'Visiting', mood: 'fine', opinion: null, portraitSeed: `visitor-${ped?.id}`, line: VISITOR_LINES[n], facts: ['Not from around here'], options: [{ id: 'ask', label: 'Ask who lives around here' }] });
    if (pickd) await ui.talk({ name: VISITOR_NAMES[n], job: 'Visiting', mood: 'happy', opinion: null, portraitSeed: `visitor-${ped?.id}`, line: local ? `I met ${local.name} earlier — the ${local.job.toLowerCase()}. Lives near here, I think.` : 'No idea, sorry. Everyone seems to be indoors.', facts: ['Not from around here'], options: [] });
    ui.closeTalk?.();
    if (ped) life?.release(ped, ped.position.clone());
    talking = false; controls.enabled = true; controls.pressed.clear();
    return;
  }
  const card = () => {
    const g = greet(resident, town, memory.name), wallet = progression.rich(progress) ? Infinity : progress.cash;
    return { name: resident.name, job: resident.job, place: resident.shop ? town.shopName(resident.shop) : undefined, mood: g.mood, money: resident.money, opinion: resident.met ? resident.opinion : null, portraitSeed: resident.look.seed, line: g.line, facts: g.facts, options: choices(resident, wallet, scale()) };
  };
  let view = card();
  for (;;) {
    const pickd = await ui.talk(view);
    if (!pickd) break;
    const res = answer(resident, pickd, town, memory.name, scale());
    resident.opinion = Math.max(-1, Math.min(1, resident.opinion + res.opinion));
    if (res.cash) earn(res.cash);
    if (res.memories) { save(progression.found(progress, res.memories)); ui.memories(progress.memories, res.memories); }
    view = { ...card(), line: res.line, options: card().options };
  }
  ui.closeTalk?.();
  if (ped) life?.release(ped, ped.position.clone());
  talking = false; controls.enabled = true; controls.pressed.clear();
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
  const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0xffd66b, emissive: 0xffb02e, emissiveIntensity: 0.9, flatShading: true }));
  arrow.rotation.order = 'YXZ';
  const all = new THREE.Group(); all.add(root, rope, arrow);
  return { root: all, body: root, avatar, vehicle, rope, arrow };
}

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
    player.arrow.position.set(feet.x, feet.y + (mover.M.kind === 'vehicle' ? 3.4 : 2.8) + Math.sin(clock * 3) * 0.12, feet.z);
    player.arrow.rotation.y = Math.atan2(-dx, -dz);
    player.arrow.rotation.x = THREE.MathUtils.clamp(Math.atan2((goal.y || 0) - feet.y, flat), -0.8, 0.8);
    player.arrow.visible = flat > 6 || Math.abs((goal.y || 0) - feet.y) > 6;
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
    if (mover) {
      placePlayer(dt);
      chase.update(mover, controls, dt);
      lifePlayer.position.copy(mover.feet); lifePlayer.velocity.copy(mover.velocity); lifePlayer.speed = Math.abs(mover.speed); lifePlayer.vehicle = mover.M.kind === 'vehicle';
      lifePlayer.radius = PLAYER_SIZE[mover.type] ?? 0.5;
    }
    controls.endFrame();
  } else { cinematic(dt); lifePlayer.position.set(0, 0, -220); lifePlayer.speed = 0; lifePlayer.vehicle = false; }
  if (town) {
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
  await ui.say(`${memory.name}. Of course it was.`);
}

// The board is the path: three ways in, what each leads to, and what it takes to get there.
// Open games play; ready ones cost memories; locked ones say what they need first.
const ORDER = ['skate', 'pizza', 'patrol', 'race', 'shop', 'taxi', 'heist', 'aliens', 'kaiju'];
const NAMES = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a.label]));
async function chooseActivity() {
  const first = progress.unlocked.length === 0;
  ui.memories(progress.memories); showWallet();
  for (;;) {
    const options = [...ORDER, ...(first ? [] : ['roam'])].map((id) => {
      const a = ACTIVITIES.find((x) => x.id === id), node = progression.PATH[id];
      if (id === 'roam') return { id, label: a.label, hint: a.hint, glyph: a.glyph, colour: a.colour, state: 'open', tier: 3, leadsTo: [] };
      const state = first ? (node.start ? 'buy' : 'locked') : progression.stateOf(progress, id);
      const kept = progress.kept.includes(id) ? progression.PERKS[id] : null;
      const badge = first && node.start ? 'PICK ONE' : kept ? `KEPT: ${kept.label.toUpperCase()}` : undefined;
      const cost = first ? 0 : progression.costOf(progress, id);
      return {
        id, label: a.label, hint: a.hint, glyph: a.glyph, colour: a.colour, state, tier: node.tier, leadsTo: node.leadsTo || [], badge,
        rank: progress.best[id], requirement: progression.requirementText(id, NAMES) || undefined,
        fork: node.fork ? progression.FORKS[node.fork].title : undefined,
        ...(state === 'buy' || state === 'forked' ? { locked: true, cost, afford: first || progress.memories >= cost } : state === 'locked' ? { locked: true, afford: false } : {}),
      };
    });
    const question = first ? `So, ${memory.name} — what were you doing that day? You only get to remember one, to start.` : `So, ${memory.name} — what else were you doing that day?`;
    const id = await ui.ask(question, options, { style: 'board' });
    if (!id) continue;
    if (id === 'roam' || progression.isOpen(progress, id)) return id;
    const state = first ? 'buy' : progression.stateOf(progress, id);
    if (state === 'locked') { await ui.say(`Not yet. ${progression.requirementText(id, NAMES)} first.`); continue; }
    const label = NAMES[id], cost = first ? 0 : progression.costOf(progress, id);
    const yes = first
      ? await ui.confirm(`${label}. That's where it started? The rest will take memories to bring back.`, 'Yes, that one', 'Let me think')
      : await ui.confirm(`${state === 'forked' ? 'That was the road you didn\'t take. ' : ''}Spend ${cost.toLocaleString()} memories to remember ${label.toLowerCase()}?`, 'Remember it', 'Not yet');
    if (!yes) continue;
    save(first ? { ...progress, unlocked: [id] } : progression.unlock(progress, id));
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
    world, group, rng, memory, hud: ui.hud, name: memory.name, life, town, controls, progress, switchTo, talkTo, earn, scale: scale(), practice, upgrades, inspectPlace, camera,
    found: (n) => { save(progression.found(progress, n)); },
    clock: clockText,
    // Knock a building down mid-round (rebuilds the city in ~30 ms; position and round survive).
    destroyLot: (id) => { if (destroyed.has(id)) return; destroyed.add(id); rebuild({ surface: false }); },
    destroyedLots: destroyed,
    cash: () => (progression.rich(progress) ? Infinity : progress.cash),
  });
  mover = createMover(def.mover, { at: round.spawn.at, heading: round.spawn.heading, solids: moverSolids, anchors: world.city.anchors });
  player = makePlayer(def);
  world.scene.add(player.root);
  timeLeft = def.time === null ? null : Number(params.get('time')) || def.time; round.timeLeft = timeLeft;
  round.addTime = (s) => { if (timeLeft !== null) timeLeft += s; };
  ui.memories(null); showWallet();
  if (town) ui.hud.clock?.(def.time === null ? clockText() : null);
  controls.yaw = round.spawn.heading; controls.pitch = -0.18;
  chase.snap(mover, controls); placePlayer(0);
  phase = 'countdown';
  ui.hud.show();
  ui.hud.set({ title: def.title, objective: round.objective, time: timeLeft, score: timeLeft === null ? null : 0 });
  ui.hud.toast(def.controls);
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
  player = null; mover = null; round = null; phase = 'cinematic';
  return afterRound(id, def, res);
}

// The pizzeria's counter: a 2D rush over the dimmed city. Customers are real residents.
async function kitchenRound(def, practice, upgrades) {
  ui.memories(null); ui.wallet?.(null);   // the kitchen has its own score chip in that corner
  const people = town ? [...town.residents].sort(() => Math.random() - 0.5).slice(0, 24) : [];
  const TOPPINGS = ['pepperoni', 'mushroom', 'olive', 'basil', 'pepper'];
  const orders = people.map((r, i) => ({ name: r.first, topping: TOPPINGS.filter((_, k) => (i * 7 + k * 3) % 5 < 2) }));
  const out = await ui.kitchen({ title: def.title, duration: Number(params.get('time')) || def.time, orders, upgrades: [...upgrades] });
  const score = Math.round(out.score * practice);
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
  } else await remember();
  phase = 'cinematic';
  let action = 'other', id = null;
  for (;;) {
    if (action === 'new') { await ui.fade(1, 900); await remember(); }
    if (action !== 'again') id = params.get('play') && !id ? params.get('play') : await chooseActivity();
    action = await play(id);
  }
}

main();

// Read-only handle for poking at a running game from the console.
if (import.meta.env.DEV) window.__rm = { get mover() { return mover; }, get life() { return life; }, get round() { return round; }, get progress() { return progress; }, get town() { return town; } };
