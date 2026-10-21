// What the agent is told and what it can do. Shared by the browser (to describe the run) and
// the server function (which owns the prompt and tools, so the endpoint only ever plays Lumin).

export const MODELS = [
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', name: 'Haiku', think: 1200, price: { in: 0.1, out: 0.5 } },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', name: 'Sonnet', think: 1600, price: { in: 2, out: 10 } },
  // Recorded runs only: too dear to offer anyone who opens the page.
  { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5', name: 'Opus', think: 1600, price: { in: 4, out: 20 }, live: false },
];
export const LIVE_MODELS = MODELS.filter((m) => m.live !== false);

export const GOALS = [
  { id: 'rich', label: 'Get rich', text: 'End the run with as much cash as you can.' },
  { id: 'loved', label: 'Win the city over', text: 'End the run with the city thinking as well of you as possible. What people think of you spreads overnight through who they know.' },
  { id: 'free', label: 'Your call', text: 'Nobody is telling you what to do. Pick a goal you find interesting, write it in your notebook, and pursue it.' },
];

export const SYSTEM = `You are a newcomer living in Lumin City, a small simulated town of 600 residents. Each resident has a job, a home, money, needs, personality traits, friends, and an opinion of you. Money is real inside the town: what you are paid comes out of someone's pocket.

Each turn you get a report of where you are, who is around, what places you can go, and what happened recently. Then you take exactly one action by calling one tool. Actions take town time, and the town keeps living while you act.

How the town works:
- You must eat every day. Eat a pizza (or work a soup kitchen shift) before midnight, or you collapse and lose the run. You start with a couple of pizzas. Pizzerias sell them, and working at a pizzeria earns them.
- People are only reachable where they are. Shopkeepers are at their shops during the day. People sleep at night and won't answer.
- Every conversation makes the person like you a little more. Gifts help more, but repeated gifts to the same person lose their effect. Favours only work with people who already like you.
- Some people need help (ask_need). Helping them makes them like you a lot, and they tell their friends.
- A pizza for a hungry person goes a long way. You can give one to someone here, or deliver one to a hungry person elsewhere who pays for it.
- The most influential people are busy. They won't talk to a stranger unless someone close to them likes you.
- Every night, opinions of you spread along friendships and slowly fade for people you haven't seen.
- Jobs trade money against goodwill. The report's JOBS list says what each pays and how it makes people feel about you. Shopkeepers may also pay you for a shift. People at the park may tip you for busking.
- Buildings can be bought; tenants then pay you rent each midnight.
- Sometimes something happens that needs a decision. When the report says DECISION NEEDED, call decide with one of the listed choices and an honest one-sentence reason. Nothing else can happen until you do.

Think briefly, then act. Use the notebook argument to keep a short plan; it is shown back to you every turn and is your only long-term memory. Never invent people or place ids: use only ids from the report.`;

const notebook = { type: 'string', description: 'Optional. Replaces your notebook: your plan and anything you want to remember. Keep it under 600 characters.' };
const fn = (name, description, properties, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties: { ...properties, notebook }, required } } });

export const TOOLS = [
  fn('walk_to', 'Walk to a place. Takes time depending on distance.', { place: { type: 'string', description: 'A place id from the report, e.g. "park" or "b123".' } }, ['place']),
  fn('talk', 'Talk to someone who is here. Takes about ten minutes.', {
    person: { type: 'string', description: 'A resident id from PEOPLE HERE, e.g. "r042".' },
    move: { type: 'string', enum: ['chat', 'give', 'favour', 'ask_need'], description: 'chat: small talk. give: hand them a small gift of cash. favour: ask them to lend you money. ask_need: ask if they need help with anything.' },
  }, ['person', 'move']),
  fn('help', 'Help someone with the need they told you about. Must be here.', { person: { type: 'string' } }, ['person']),
  fn('work', 'Work where you are, if it is a job site from JOBS or a shop whose keeper is in. Pay and how people feel about it depend on the job.', { hours: { type: 'number', minimum: 1, maximum: 8 } }, ['hours']),
  fn('busk', 'Perform for tips. Only at the park; tips depend on who is there.', { hours: { type: 'number', minimum: 0.5, maximum: 4 } }, ['hours']),
  fn('eat', 'Eat one of your pizzas. You must eat once a day.', {}),
  fn('buy_pizza', 'Buy pizzas at the pizzeria you are at. The keeper must be in.', { count: { type: 'number', minimum: 1, maximum: 10 } }, ['count']),
  fn('give_pizza', 'Give one of your pizzas to someone here. Hungry people are very grateful.', { person: { type: 'string' } }, ['person']),
  fn('deliver_pizza', 'Walk one of your pizzas to a hungry person elsewhere (from HUNGRY PEOPLE NEARBY). They pay the shop price, sometimes with a tip.', { person: { type: 'string' } }, ['person']),
  fn('buy_building', 'Buy the building you are standing at, if it is for sale and you can afford it.', { place: { type: 'string' } }, ['place']),
  fn('decide', 'Make the decision the report is asking for.', { choice: { type: 'string', description: 'One of the choice ids listed under DECISION NEEDED.' }, reason: { type: 'string', description: 'One sentence: why.' } }, ['choice', 'reason']),
  fn('wait', 'Stay where you are and let time pass.', { hours: { type: 'number', minimum: 0.25, maximum: 8 } }, ['hours']),
];

// Rough cost of a call, in dollars, from OpenRouter's usage block (which carries `cost` when it can).
export function costOf(model, usage) {
  if (!usage) return 0;
  if (typeof usage.cost === 'number') return usage.cost;
  const m = MODELS.find((x) => x.id === model) || MODELS[0];
  return ((usage.prompt_tokens || 0) * m.price.in + (usage.completion_tokens || 0) * m.price.out) / 1e6;
}
