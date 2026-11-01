// Tests for sustained spells (sustain.js).
// Run: node tests/test-sustain.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

function runHook(file, data) {
  ctx.__state.messages.length = 0;
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
}

const caster = (sustaining = []) => ({ _id: "t-ez", recordType: "characters", recordId: "ez", name: "Ezren", identified: true, effects: [], effectIds: [], data: { sustaining } });
let round = 3;
let writes = [];
function setup(token) {
  writes = [];
  ctx.__state.messages.length = 0;
  ctx.api.getCombatTracker = (cb) => cb({ round, tokenIds: [token._id] });
  ctx.api.getOtherTokens = () => [token];
  ctx.api.getToken = () => null;
  ctx.api.setValuesOnTokenById = (id, type, values, cb) => {
    writes.push([id, type, values]);
    if (cb) cb();
  };
}
const lastList = () => writes[writes.length - 1]?.[2]["data.sustaining"];

section("Sustained spells");
{
  assert("a sustained duration", [ctx.isSustainedSpell({ data: { duration: { value: "1 minute", sustained: true } } }), ctx.isSustainedSpell({ data: { duration: { value: "1 minute" } } }), ctx.isSustainedSpell({ data: { duration: "1 minute" } })], [true, false, false]);
  const token = caster([{ name: "Bless", castRound: 1, sustainedRound: 1 }]);
  setup(token);
  round = 3;
  ctx.startSustainingSpell(token, "Bless");
  assert("casting again starts it over this round", lastList(), [{ name: "Bless", castRound: 3, sustainedRound: 3 }]);
  ctx.startSustainingSpell(caster([{ name: "Bless", castRound: 1, sustainedRound: 1 }]), "Light");
  assert("another spell joins the list", lastList().map((e) => e.name), ["Bless", "Light"]);
  assert("written on the caster's token", writes[0].slice(0, 2), ["t-ez", "tokens"]);
  assert("the cast card's button", ctx.getSustainButton(token, "Bless").includes('sustainSpell("t-ez", "Bless")'), true);
}

section("Sustain");
{
  const token = caster([{ name: "Bless", castRound: 2, sustainedRound: 2 }]);
  setup(token);
  round = 4;
  ctx.sustainSpell("t-ez", "Bless");
  assert("Sustained this round", lastList(), [{ name: "Bless", castRound: 2, sustainedRound: 4 }]);
  assert("the card", ctx.__state.messages[0].includes("Ezren Sustains Bless** (round 3 of it)"), true);
  const old = caster([{ name: "Bless", castRound: 1, sustainedRound: 100 }]);
  setup(old);
  round = 101;
  ctx.sustainSpell("t-ez", "Bless");
  assert("10 minutes: a GM note that it ends this turn (nothing refused)", [ctx.__state.messages[0].includes("the most a spell can be Sustained"), lastList()[0].sustainedRound], [true, 101]);
}

section("The end of the caster's turn");
{
  const token = caster([
    { name: "Bless", castRound: 1, sustainedRound: 3 },
    { name: "Light", castRound: 2, sustainedRound: 2 },
    { name: "Fear", castRound: 3, sustainedRound: 3 },
  ]);
  setup(token);
  round = 3;
  ctx.endUnsustainedSpells(token);
  assert("Sustained or cast this round: kept", lastList().map((e) => e.name), ["Bless", "Fear"]);
  assert("not Sustained: it ends, with the GM's button", [ctx.__state.messages[0].includes("**Light ends**: Ezren didn't Sustain it this turn."), ctx.__state.messages[0].includes('removeSpellEffects("Light")')], [true, true]);

  const tenMinutes = caster([{ name: "Bless", castRound: 1, sustainedRound: 101 }]);
  setup(tenMinutes);
  round = 101;
  ctx.endUnsustainedSpells(tenMinutes);
  assert("Sustained to 10 minutes: it ends anyway", [lastList(), ctx.__state.messages[0].includes("has Sustained it for 10 minutes")], [[], true]);

  const kept = caster([{ name: "Bless", castRound: 1, sustainedRound: 3 }]);
  setup(kept);
  round = 3;
  ctx.endUnsustainedSpells(kept);
  assert("all Sustained: nothing written", [writes, ctx.__state.messages], [[], []]);

  const outside = caster([{ name: "Bless", castRound: null, sustainedRound: null }]);
  setup(outside);
  ctx.api.getCombatTracker = (cb) => cb(null);
  ctx.endUnsustainedSpells(outside);
  assert("outside an encounter: nothing ends", writes, []);

  const hooked = caster([{ name: "Light", castRound: 2, sustainedRound: 2 }]);
  setup(hooked);
  round = 3;
  runHook("onTurnEnd.js", { token: hooked });
  assert("onTurnEnd.js ends it", lastList(), []);
}

section("The start of the caster's turn");
{
  const token = caster([{ name: "Bless", castRound: 1, sustainedRound: 2 }]);
  setup(token);
  ctx.remindSustainedSpells(token);
  const card = ctx.__state.messages[0];
  assert("a card: what it's sustaining, with Sustain and Stop", [card.includes("**Ezren is sustaining:**"), card.includes('sustainSpell("t-ez", "Bless")'), card.includes('stopSustainingSpell("t-ez", "Bless")')], [true, true, true]);
  setup(caster());
  ctx.remindSustainedSpells(caster());
  assert("nothing sustained: no card", ctx.__state.messages, []);
  ctx.stopSustainingSpell("t-ez", "Bless");
}

section("Removing a spell's effects (the GM's button)");
{
  const ally = { _id: "t-al", name: "Kyra", identified: true, effects: [{ _id: "e1", name: "Aura: Bless" }, { _id: "e2", name: "Frightened" }], effectIds: ["e1", "e2"], data: {} };
  const removed = [];
  ctx.api.getOtherTokens = () => [ally];
  ctx.api.removeEffectById = (id, token, cb) => {
    removed.push([token._id, id]);
    if (cb) cb();
  };
  ctx.__state.messages.length = 0;
  ctx.removeSpellEffects("Bless");
  assert("the effects named for it, and only those", removed, [["t-al", "e1"]]);
  assert("and a line saying where", ctx.__state.messages[0], "Bless's effects removed from Kyra (Aura: Bless).");
}

section("The encounter's end");
{
  const token = caster([{ name: "Bless", castRound: 1, sustainedRound: 3 }]);
  setup(token);
  ctx.clearSustainedSpells([token, caster()]);
  assert("the lists are cleared", writes.map((w) => [w[0], w[2]["data.sustaining"]]), [["t-ez", []]]);
}

process.exitCode = summary() > 0 ? 1 : 0;
