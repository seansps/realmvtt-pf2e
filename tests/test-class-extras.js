// Tests for the class extras (class-extras.js): Hero Points, Rage's
// temporary Hit Points, panache from bravado checks, and cursebound.
// Run: node tests/test-class-extras.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let calls = [];
let notifications = [];
const reset = () => {
  calls = [];
  notifications = [];
  state.messages = [];
};
ctx.api.showNotification = (text) => notifications.push(text);
ctx.api.setValuesOnTokenById = (id, recordType, values, cb) => {
  calls.push(["set", id, values]);
  if (cb) cb();
};
ctx.api.setValuesOnRecord = (record, values) => calls.push(["record", record?._id, values]);
ctx.api.addEffect = (name, token, duration, applier) => calls.push(["add", name, token?._id, duration, applier]);
ctx.api.removeEffectById = (id, token, cb, options) => {
  calls.push(["remove", id, token?._id, ...(options ? [options] : [])]);
  if (cb) cb();
};

const character = (data = {}, { id = "pc", name = "Merisiel", effects = [], effectIds = [], extra = {} } = {}) => ({
  _id: id,
  recordId: id,
  recordType: "characters",
  name,
  effects,
  effectIds,
  fields: {},
  data: { level: 5, feats: [], bonusFeats: [], classes: [], inventory: [], ...data },
  ...extra,
});

function runHandler(file, data) {
  state.messages = [];
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  return new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
}

section("Hero Points (Q5)");
{
  reset();
  const valeros = character({ heroPoints: 0 }, { id: "v", name: "Valeros" });
  const ezren = character({ heroPoints: 3 }, { id: "e", name: "Ezren" });
  ctx.api.getParty = (cb) => cb([valeros, ezren, { _id: "pet", recordType: "npcs", data: {} }]);
  ctx.startHeroPointSession();
  assert("a new session: each character has 1", calls, [["record", "v", { "data.heroPoints": 1 }], ["record", "e", { "data.heroPoints": 1 }]]);
  assertIncludes("the chat line", state.messages[0], "Valeros, Ezren each start with 1 Hero Point");
  reset();
  ctx.api.getParty = (cb) => cb([]);
  ctx.startHeroPointSession();
  assert("no party: a note", notifications.length, 1);

  assert("award: one more", ctx.getHeroPointAwardValues(valeros), { "data.heroPoints": 1 });
  assert("... none past 3", ctx.getHeroPointAwardValues(ezren), null);
  reset();
  ctx.api.getSelectedTokens = () => [{ token: valeros }, { token: ezren }];
  ctx.awardHeroPoint();
  assert("award to the selected: Valeros gains one", calls, [["set", "v", { "data.heroPoints": 1 }]]);
  assertIncludes("... Ezren is at the most", state.messages.join("\n"), "Ezren already has 3 Hero Points");
  ctx.api.getSelectedTokens = () => [];

  // A familiar's reroll needs its own Hero Point (Foundry: characters only)
  const familiar = { _id: "fam", recordType: "npcs", name: "Familiar", data: { heroPoints: 0, master: JSON.stringify({ _id: "ezren", name: "Ezren" }) } };
  reset();
  const result = runHandler("onReroll.js", { roll: { metadata: { recordId: "fam", recordType: "npcs" } }, record: familiar });
  assert("a familiar with none: no reroll, as before", [result?.success, calls, notifications], [false, [], ["You do not have any hero points."]]);
}

section("Rage's temporary Hit Points (Q21)");
{
  const amar = character({ tempHp: 0 }, { id: "amar", name: "Amiri" });
  assert("Rage's: kept with the source", ctx.getActionTempHpValues(amar, 8, "Rage"), { "data.tempHp": 8, "data.tempHpSource": { name: "Rage", amount: 8 } });
  assert("lower than what it has: no change to the source", ctx.getActionTempHpValues(character({ tempHp: 10 }), 8, "Rage"), { "data.tempHp": 10 });

  const raging = (tempHp, source) =>
    character({ tempHp, tempHpSource: source }, { id: "amar", name: "Amiri", effects: [{ _id: "rage", name: "Rage" }], effectIds: ["rage"] });
  assert("Rage ends: what's left of it goes", ctx.getRageEndTempHpValues(raging(5, { name: "Rage", amount: 8 })), { "data.tempHp": 0, "data.tempHpSource": null });
  assert("more than Rage gave: from something else, kept", ctx.getRageEndTempHpValues(raging(12, { name: "Rage", amount: 8 })), null);
  assert("from something else: kept", ctx.getRageEndTempHpValues(raging(5, { name: "False Life", amount: 6 })), null);
  assert("none left: nothing", ctx.getRageEndTempHpValues(raging(0, { name: "Rage", amount: 8 })), null);
  assert("a spell's after Rage's were used up: kept", ctx.getRageEndTempHpValues(raging(6, { name: "Healing", amount: 6 })), null);

  // The healing card's Apply Temporary HP notes its source
  runHandler("healing.js", { roll: { types: [{ type: "temp", value: 6 }], total: 6, metadata: { rollName: "False Life" } } });
  const card = state.messages.join(String.fromCharCode(10));
  const start = card.indexOf("```Apply_Temporary_HP");
  const macro = card.slice(card.indexOf(String.fromCharCode(10), start) + 1, card.lastIndexOf("```"));
  reset();
  ctx.record = character({ tempHp: 0, tempHpSource: { name: "Rage", amount: 8 } }, { id: "amar", name: "Amiri" });
  ctx.isGM = true;
  ctx.api.getSelectedOrDroppedToken = () => [];
  ctx.api.floatText = () => {};
  new vm.Script(`(function () {${String.fromCharCode(10)}${macro}${String.fromCharCode(10)}})();`).runInContext(ctx);
  assert("the healing macro: the spell's are the source now", calls[0], ["set", "amar", { "data.tempHp": 6, "data.tempHpSource": { name: "Healing", amount: 6 } }]);
  assertIncludes("... its Undo clears the source", state.messages[0], "'data.tempHpSource': null");
  ctx.record = undefined;
  reset();
  const lines = ctx.clearRageTempHp([raging(5, { name: "Rage", amount: 8 }), character({ tempHp: 5, tempHpSource: { name: "Rage", amount: 8 } }, { id: "calm" })]);
  assert("the encounter's end: only the raging one", calls, [["set", "amar", { "data.tempHp": 0, "data.tempHpSource": null }]]);
  assert("... the GM line", lines, ["Amiri loses 5 temporary Hit Points from Rage."]);
}

section("Temporary Hit Points at turn start (Inexorable Iron)");
{
  // The campaign's Inexorable Iron (Impossible Magic pg. 13): entering
  // Arcane Cascade (actionTempHp) and the start of each turn in it
  // (turnStartTempHp), wielding a melee weapon in two hands
  const hands = '"self:weapon:melee","self:weapon:hands-held:2"';
  const modifier = (type, predicate) => ({
    name: "Inexorable Iron",
    data: { active: true, type, modifierType: "none", valueType: "string", value: "{max(floor(@actor.level/2),1)}", predicate },
  });
  const iron = {
    _id: "f-iron",
    name: "Inexorable Iron",
    recordType: "features",
    data: {
      level: 1,
      modifiers: [
        modifier("actionTempHp", `["action:arcane-cascade",${hands}]`),
        modifier("turnStartTempHp", `["self:effect:stance-arcane-cascade",${hands}]`),
      ],
    },
  };
  const item = (name, data) => ({ _id: `w-${name}`, name, recordType: "items", data: { type: "weapon", carried: "equipped", range: 0, traits: [], ...data } });
  const greatsword = item("Greatsword", { usage: "held-in-two-hands" });
  const longsword = item("Longsword", { usage: "held-in-one-hand" });
  const bastard = item("Bastard Sword", { usage: "held-in-one-plus-hands", handBtn: "two" });
  const longbow = item("Longbow", { usage: "held-in-one-plus-hands", range: 100 });
  const stance = { _id: "e-cascade", name: "Stance: Arcane Cascade", rules: [] };
  const magus = ({ level = 7, inventory = [greatsword], inStance = true, tempHp = 0, extra = {} } = {}) =>
    character(
      { level, tempHp, classes: [{ name: "Magus", data: { features: [iron] } }], inventory, ...extra },
      { id: "magus", name: "Sora", effects: inStance ? [stance] : [], effectIds: inStance ? ["e-cascade"] : [] },
    );

  assertIncludes("a greatsword held: self:weapon:melee", [...ctx.collectTraitsAndProperties(magus())], "self:weapon:melee");
  assertIncludes("... in two hands", [...ctx.collectTraitsAndProperties(magus())], "self:weapon:hands-held:2");
  assertIncludes("a longbow: self:weapon:ranged", ctx.getHeldWeaponAtoms(magus({ inventory: [longbow] })), "self:weapon:ranged");
  assert("a stowed weapon isn't held", ctx.getHeldWeaponAtoms(magus({ inventory: [{ ...greatsword, data: { ...greatsword.data, carried: "carried" } }] })), []);

  assert("in the stance with a greatsword: half level", ctx.getTurnStartTempHp(magus()), { amount: 3, source: "Inexorable Iron" });
  assert("level 1: at least 1", ctx.getTurnStartTempHp(magus({ level: 1 }))?.amount, 1);
  assert("a bastard sword in two hands counts", ctx.getTurnStartTempHp(magus({ inventory: [bastard] }))?.amount, 3);
  assert("a longsword in one hand: none", ctx.getTurnStartTempHp(magus({ inventory: [longsword] })), null);
  assert("a longbow in two hands: none", ctx.getTurnStartTempHp(magus({ inventory: [longbow] })), null);
  assert("out of the stance: none", ctx.getTurnStartTempHp(magus({ inStance: false })), null);

  // Entering the stance: the Arcane Cascade card's Apply button, only with
  // the weapon in two hands
  ctx.record = magus({ inStance: false });
  assertIncludes("entering the stance: Apply 3", ctx.getActionHealingMacros({ name: "Arcane Cascade" }), "Apply_Temporary_HP_3");
  ctx.record = magus({ inStance: false, inventory: [longsword] });
  assert("... not with a one-handed weapon", ctx.getActionHealingMacros({ name: "Arcane Cascade" }), "");
  ctx.record = undefined;

  // The start of each turn in the stance
  reset();
  const token = magus({ tempHp: 1 });
  ctx.runTurnStartTempHp(token, 2);
  assert(
    "turn start: gained, with the source and the round",
    calls,
    [["set", "magus", { "data.tempHp": 3, "data.tempHpSource": { name: "Inexorable Iron", amount: 3 }, "data.turnStartTempHpRound": 2 }]],
  );
  assertIncludes("... the chat line", state.messages[0], "Sora gains 3 temporary Hit Points from Inexorable Iron.");
  reset();
  ctx.runTurnStartTempHp(magus({ extra: { turnStartTempHpRound: 2 } }), 2);
  assert("the same turn again (Next after Previous): nothing", calls, []);
  reset();
  ctx.runTurnStartTempHp(magus({ tempHp: 5 }), 3);
  assert("more temporary HP already: kept, nothing written", [calls, state.messages], [[], []]);
  reset();
  ctx.runTurnStartTempHp(magus({ inventory: [longsword] }), 3);
  assert("a one-handed weapon: nothing", calls, []);

  // The onTurnStart hook
  reset();
  ctx.api.getCombatTracker = (cb) => cb({ round: 4 });
  runHandler("onTurnStart.js", { token: magus(), tokens: [], round: 4 });
  assert("onTurnStart grants them", calls.find((call) => call[2]?.["data.turnStartTempHpRound"] === 4)?.[2]?.["data.tempHp"], 3);
  reset();
  runHandler("onTurnStart.js", { token: magus({ inStance: false }), tokens: [], round: 4 });
  assert("... not out of the stance", calls.some((call) => call[2]?.["data.tempHp"] !== undefined), false);
  ctx.api.getCombatTracker = () => {};
}

section("Panache from bravado (Q22)");
{
  const swash = character({}, { id: "sw", name: "Ta'lir" });
  const tumble = { _id: "f", name: "Panache", data: { modifiers: [{ name: "Roll Option", data: { type: "rollOption", option: "item:trait:bravado", active: true, predicate: '["action:tumble-through"]' } }] } };
  const withFeature = { ...swash, data: { ...swash.data, classes: [{ name: "Swashbuckler", data: { features: [tumble] } }] } };
  assert("Tumble Through: a bravado check (the module's roll option)", ctx.isBravadoCheck(withFeature, { action: { name: "Tumble Through" } }), true);
  assert("... Balance isn't", ctx.isBravadoCheck(withFeature, { action: { name: "Balance" } }), false);
  assert("no action: no", ctx.isBravadoCheck(withFeature, {}), false);

  const bravado = { tokenId: "sw", tokenName: "Ta'lir" };
  const success = ctx.getBravadoLines(bravado, 1).join("\n");
  assertIncludes("a success: Gain Panache", success, "```Gain_Panache\n");
  assertNotIncludes("... not the short one", success, "until_end_of_next_turn");
  const failure = ctx.getBravadoLines(bravado, 0).join("\n");
  assertIncludes("a failure: until the end of your next turn", failure, "Gain_Panache_(until_end_of_next_turn)");
  assert("a critical failure: nothing", ctx.getBravadoLines(bravado, -1), []);
  const unknown = ctx.getBravadoLines(bravado, null).join("\n");
  assert("no DC: both", [unknown.includes("```Gain_Panache\n"), unknown.includes("until_end_of_next_turn")], [true, true]);
  assert("not bravado: nothing", ctx.getBravadoLines(undefined, 1), []);

  reset();
  ctx.getCurrentTurn = () => null;
  ctx.gainPanache(swash, true);
  assert("until the end of its next turn (out of combat: 2)", calls[0], ["add", "Panache", "sw", { value: 2, unit: "end_applier_turn" }, { value: 1, _id: "sw", name: "Talir" }]);
  reset();
  ctx.gainPanache(swash, false);
  assert("a success: Panache as it is", calls[0].slice(0, 3), ["add", "Panache", "sw"]);
  reset();
  ctx.gainPanache(character({}, { id: "sw", effects: [{ _id: "p", name: "Panache" }], effectIds: ["p"] }), false);
  assert("already has it: a note", [calls, notifications.length], [[], 1]);

  // The skill card
  state.messages = [];
  ctx.data = { roll: { total: 20, dice: [{ type: 20, value: 12 }], metadata: { rollName: "Acrobatics: Tumble Through", skillName: "acrobatics", dc: 18, bravado } } };
  new vm.Script(`(function () {\n${fs.readFileSync(`${__dirname}/../rollhandlers/skill.js`, "utf8")}\n})();`).runInContext(ctx);
  assertIncludes("Tumble Through beats the DC: the card offers panache", state.messages.join("\n"), "```Gain_Panache\n");

  // A finisher's card
  ctx.api.getToken = () => swash;
  assertIncludes("a finisher: Lose Panache", ctx.getFinisherButton({ data: { traits: ["Finisher", "Swashbuckler"] } }), "Lose_Panache");
  assert("... other actions: nothing", ctx.getFinisherButton({ data: { traits: ["Flourish"] } }), "");
  reset();
  ctx.losePanache(character({}, { id: "sw", effects: [{ _id: "p", name: "Panache" }], effectIds: ["p"] }));
  assert("losing it removes the effect", calls, [["remove", "p", "sw"]]);
  ctx.api.getToken = () => null;
}

section("Cursebound (Q23)");
{
  assert("maximum 2", ctx.getCurseboundMax(character({ level: 5 })), 2);
  assert("17th level without the features (Oracle Dedication): still 2", ctx.getCurseboundMax(character({ level: 17 })), 2);
  assert("Major Curse: 3", ctx.getCurseboundMax(character({ level: 11, feats: [{ name: "Major Curse" }] })), 3);
  assert("Extreme Curse: 4", ctx.getCurseboundMax(character({ level: 17, feats: [{ name: "Major Curse" }, { name: "Extreme Curse" }] })), 4);
  const ability = { name: "Spray of Stars", data: { traits: ["Cursebound", "Oracle"] } };
  reset();
  let line = ctx.applyCursebound(ability, character({}, { id: "or", name: "Korakai" }));
  assert("used: cursebound 1", [calls, line], [[["add", "Cursebound", "or", undefined, undefined]], "\nCursebound 1 (maximum 2)."]);
  reset();
  const bound = (n) => character({}, { id: "or", name: "Korakai", effects: [{ _id: "cb", name: "Cursebound" }], effectIds: Array(n).fill("cb") });
  line = ctx.applyCursebound(ability, bound(1));
  assert("cursebound 1: now 2", line, "\nCursebound 2 (maximum 2).");
  reset();
  line = ctx.applyCursebound(ability, bound(2));
  assert("at the maximum: no more, a GM note", [calls, line], [[], "\n[gm]Korakai is already at their maximum cursebound 2: a cursebound ability can't be used.[/gm]"]);
  assert("not cursebound: nothing", ctx.applyCursebound({ data: { traits: ["Concentrate"] } }, bound(1)), "");
  reset();
  let text = ctx.removeCursebound(bound(2));
  assert("Refocus reduces it by 1: the last instance", [calls, text], [[["remove", "cb", "or", { instanceIndex: 1 }]], " Cursebound 1."]);
  reset();
  text = ctx.removeCursebound(bound(1));
  assert("... from 1: gone", [calls, text], [[["remove", "cb", "or", { instanceIndex: 0 }]], " No longer cursebound."]);
  reset();
  assert("none: nothing", [ctx.removeCursebound(character()), calls], ["", []]);
}

process.exitCode = summary() > 0 ? 1 : 0;
