// One turn over the wire: post the report, read the server-sent stream, hand thinking to
// onThought as it arrives, and return the tool call at the end. Works in the browser and node.

export async function think({ url = '/api/agent', model, report, onThought = () => {}, signal } = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, report }), signal });
  if (!res.ok) {
    let msg = `The agent couldn't think (${res.status}).`;
    try { msg = (await res.json()).error || msg; } catch { /* not json */ }
    throw new Error(msg);
  }
  const calls = [], out = { thought: '', text: '', tool: null, usage: null };
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let chunk;
      try { chunk = JSON.parse(data); } catch { continue; }
      if (chunk.error) throw new Error(chunk.error.message || 'The model stopped.');
      if (chunk.usage) out.usage = chunk.usage;
      const d = chunk.choices?.[0]?.delta;
      if (!d) continue;
      if (d.reasoning) { out.thought += d.reasoning; onThought(d.reasoning, out.thought); }
      if (d.content) out.text += d.content;
      for (const tc of d.tool_calls || []) {
        const c = (calls[tc.index ?? 0] ||= { name: '', args: '' });
        if (tc.function?.name) c.name = tc.function.name;
        if (tc.function?.arguments) c.args += tc.function.arguments;
      }
    }
  }
  if (calls[0]?.name) {
    let args = {};
    try { args = JSON.parse(calls[0].args || '{}'); } catch { /* leave empty; the action will say what's missing */ }
    out.tool = { name: calls[0].name, args };
  }
  return out;
}
