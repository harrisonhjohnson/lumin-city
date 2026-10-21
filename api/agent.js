import { LIVE_MODELS, SYSTEM, TOOLS } from '../src/remember/agent-brain.js';

// One agent turn: the browser sends the turn's report, this adds the Lumin prompt and tools,
// asks the model via OpenRouter, and streams the reply (thinking, then the tool call) straight
// back as server-sent events. The prompt and tools live here, not in the request, so the
// endpoint can only ever play Lumin. Needs OPENROUTER_API_KEY.

export const config = { maxDuration: 60 };

const MAX_REPORT = 16000;

// Only the game's own pages may call this: lumin.city, its Vercel previews, and local dev.
const ALLOWED = /^https?:\/\/((www\.)?lumin\.city|lumin-city[a-z0-9-]*\.vercel\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/;
const originOf = (req) => {
  const o = req.headers.origin || '';
  if (o) return o;
  try { return new URL(req.headers.referer || '').origin; } catch { return ''; }
};

// A turn every couple of seconds is a fast game; far more than that from one visitor is abuse.
// Best effort: each server instance keeps its own count.
const WINDOW = 60_000, PER_WINDOW = 40, seen = new Map();
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(), now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < WINDOW);
  hits.push(now); seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();
  return hits.length > PER_WINDOW;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > MAX_REPORT * 2) break; }
  return JSON.parse(raw || '{}');
}

function send(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, 'POST only');
  if (!ALLOWED.test(originOf(req))) return send(res, 403, 'Not from the game.');
  if (limited(req)) return send(res, 429, 'Too many turns at once. Slow down and try again in a minute.');
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return send(res, 503, 'The agent is offline: no model key on this server.');
  let body;
  try { body = await readJson(req); } catch { return send(res, 400, 'Bad JSON'); }
  const model = LIVE_MODELS.find((m) => m.id === body.model);
  if (!model) return send(res, 400, 'Unknown model');
  const report = String(body.report || '').slice(0, MAX_REPORT);
  if (!report) return send(res, 400, 'Empty report');

  let upstream;
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://lumin.city', 'X-Title': 'Lumin City' },
      body: JSON.stringify({
        model: model.id, stream: true, max_tokens: model.think + 800,
        reasoning: { max_tokens: model.think },
        usage: { include: true },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: report }],
        tools: TOOLS,
      }),
    });
  } catch { return send(res, 502, 'Could not reach the model.'); }
  // 402 is out of credit; 403 is the key's own spending limit. Either way live runs wait and the replays still play.
  if (upstream.status === 402 || upstream.status === 403) return send(res, 503, 'The agent is offline: live runs are out of credit for now. The replays on the front page still play.');
  if (!upstream.ok || !upstream.body) return send(res, 502, `The model said no (${upstream.status}): ${(await upstream.text()).slice(0, 200)}`);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  for await (const chunk of upstream.body) res.write(chunk);
  res.end();
}
