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
