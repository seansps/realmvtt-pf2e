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
  assert("casting again starts it over this round", lastList(), [{ name: "Bless", castRound: 3, sustainedRound: 3, limitRounds: 100, limitLabel: "10 minutes" }]);
  ctx.startSustainingSpell(caster([{ name: "Bless", castRound: 1, sustainedRound: 1 }]), "Light");
  assert("another spell joins the list", lastList().map((e) => e.name), ["Bless", "Light"]);
  assert("written on the caster's token", writes[0].slice(0, 2), ["t-ez", "tokens"]);
  assert("the cast card's button", ctx.getSustainButton(token, "Bless").includes('sustainSpell("t-ez", "Bless")'), true);
}

section("Each spell's own limit (Sustain, pg. 419)");
{
  const limit = (value) => ctx.getSustainLimit({ data: { duration: { value, sustained: true } } });
  assert("1 minute: 10 rounds", limit("1 minute"), { rounds: 10, label: "1 minute" });
  assert("4 rounds, 10 minutes, 1 hour", [limit("4 rounds").rounds, limit("10 minutes").rounds, limit("1 hour").rounds], [4, 100, 600]);
  assert("the \"up to\" part: 1 round or sustained up to 1 minute", limit("1 round or sustained up to 1 minute"), { rounds: 10, label: "1 minute" });
  assert("none listed: 10 minutes", limit(""), { rounds: 100, label: "10 minutes" });
  const token = caster();
  setup(token);
  round = 1;
  ctx.startSustainingSpell(token, "Fear", { data: { duration: { value: "1 minute", sustained: true } } });
  assert("the cast records it", lastList(), [{ name: "Fear", castRound: 1, sustainedRound: 1, limitRounds: 10, limitLabel: "1 minute" }]);
  const minute = caster([{ name: "Fear", castRound: 1, sustainedRound: 11, limitRounds: 10, limitLabel: "1 minute" }]);
  setup(minute);
  round = 11;
  ctx.sustainSpell("t-ez", "Fear");
  assert("Sustained at its limit: the GM note names it", ctx.__state.messages[0].includes("has lasted 1 minute, the most it can be Sustained"), true);
  setup(minute);
  ctx.endUnsustainedSpells(minute);
  assert("and it ends at the end of that turn, 90 rounds before 10 minutes", [lastList(), ctx.__state.messages[0].includes("has Sustained it for 1 minute, the most it can be")], [[], true]);
  const before = caster([{ name: "Fear", castRound: 1, sustainedRound: 10, limitRounds: 10, limitLabel: "1 minute" }]);
  setup(before);
  round = 10;
  ctx.endUnsustainedSpells(before);
  assert("a round before its limit: kept", writes, []);
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
  assert("no limit listed: 10 minutes, then a GM note that it ends this turn (nothing refused)", [ctx.__state.messages[0].includes("has lasted 10 minutes, the most it can be Sustained"), lastList()[0].sustainedRound], [true, 101]);
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
  assert("not Sustained: it ends, with the GM's button", [ctx.__state.messages[0].includes("**Light ends**: Ezren didn't Sustain it this turn."), ctx.__state.messages[0].includes('removeSpellEffects("Light", "t-ez")')], [true, true]);

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

section("Only this caster's effects, named for the spell");
{
  const blessEffect = { _id: "bl", name: "Aura: Bless" };
  const ally = {
    _id: "t-al",
    name: "Kyra",
    identified: true,
    effects: [blessEffect, { _id: "bw", name: "Blessed Ward" }],
    effectIds: ["bl", "bl", "bw"],
    effectValues: { bl: [{ tokenId: "t-other" }, { tokenId: "t-ez" }] },
    data: {},
  };
  const other = { _id: "t-ot", name: "Valeros", identified: true, effects: [blessEffect], effectIds: ["bl"], effectValues: { bl: [{ tokenId: "t-other" }] }, data: {} };
  const removed = [];
  ctx.api.getOtherTokens = () => [ally, other];
  ctx.api.removeEffectById = (id, token, cb, options) => {
    removed.push([token._id, id, options?.instanceIndex ?? "all"]);
    if (cb) cb();
  };
  ctx.__state.messages.length = 0;
  ctx.removeSpellEffects("Bless", "t-ez");
  assert("this caster's instance only; another caster's Bless stays; Blessed Ward isn't Bless", removed, [["t-al", "bl", 1]]);
  assert("the line says where", ctx.__state.messages[0], "Bless's effects removed from Kyra (Aura: Bless).");
  // As Realm stores two casters' Bless on one token: two instances, only the
  // latest applier kept
  const stacked = { _id: "t-st", name: "Merisiel", identified: true, effects: [blessEffect], effectIds: ["bl", "bl"], effectValues: { bl: { tokenId: "t-ez" } }, data: {} };
  removed.length = 0;
  ctx.api.getOtherTokens = () => [stacked];
  ctx.removeSpellEffects("Bless", "t-ez");
  assert("two instances, one applier stored (this caster): only one instance goes", removed, [["t-st", "bl", 1]]);
  removed.length = 0;
  ctx.removeSpellEffects("Bless", "t-other");
  assert("... the stored applier is another caster: nothing goes", removed, []);
  assert("the names that match", [ctx.isSpellEffectName("Bless", "Bless"), ctx.isSpellEffectName("Aura: Bless", "bless"), ctx.isSpellEffectName("Blessed Ward", "Bless")], [true, true, false]);
}

section("The encounter's end");
{
  const token = caster([{ name: "Bless", castRound: 1, sustainedRound: 3 }]);
  setup(token);
  ctx.clearSustainedSpells([token, caster()]);
  assert("the lists are cleared", writes.map((w) => [w[0], w[2]["data.sustaining"]]), [["t-ez", []]]);
}

process.exitCode = summary() > 0 ? 1 : 0;
