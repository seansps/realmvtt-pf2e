// Tests for afflictions (afflictions.js, roadmap B4, Sean's design on #64):
// data.affliction on the source, the affliction as a stackable effect whose
// stacks are the stage, the hidden state, saves, conditions per stage, the
// turn end and treatment.

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
// spells.js shares the sheet's scope with common.js at runtime
new vm.Script(fs.readFileSync(`${__dirname}/../rollhandlers/spells.js`, "utf8"), { filename: "spells.js" }).runInContext(ctx);

// Curare as the data script writes it (Treasure Vault)
const CURARE = {
  name: "Curare",
  kind: "poison",
  virulent: false,
  level: 8,
  save: "fortitude",
  dc: 25,
  onset: null,
  maxDuration: { value: 6, unit: "round" },
  stages: [
    { text: "2d6 poison damage, clumsy 1, and enfeebled 1 (1 round)", damage: ["2d6 poison"], conditions: [{ name: "Clumsy", value: 1 }, { name: "Enfeebled", value: 1 }], interval: { value: 1, unit: "round" } },
    { text: "3d6 poison damage, clumsy 2, enfeebled 2, and slowed 1 (1 minute)", damage: ["3d6 poison"], conditions: [{ name: "Clumsy", value: 2 }, { name: "Enfeebled", value: 2 }, { name: "Slowed", value: 1 }], interval: { value: 1, unit: "minute" } },
    { text: "4d6 poison damage, clumsy 2, enfeebled 2, and slowed 1 (1 round)", note: "If the victim fails while at Stage 3, the poison ends and it is paralyzed.", damage: ["4d6 poison"], conditions: [{ name: "Clumsy", value: 2 }, { name: "Enfeebled", value: 2 }, { name: "Slowed", value: 1 }], interval: { value: 1, unit: "round" } },
  ],
  effectId: "eff-curare",
};
const FEVER = {
  name: "Filth Fever",
  kind: "disease",
  virulent: true,
  save: "fortitude",
  dc: 20,
  onset: { value: 1, unit: "day" },
  maxDuration: null,
  stages: [
    { text: "carrier (1 day)", damage: [], conditions: [], interval: { value: 1, unit: "day" } },
    { text: "enfeebled 1 (1 day)", damage: [], conditions: [{ name: "Enfeebled", value: 1 }], interval: { value: 1, unit: "day" } },
    { text: "enfeebled 2 and drained 1 (1 day)", damage: [], conditions: [{ name: "Enfeebled", value: 2 }, { name: "Drained", value: 1 }], interval: { value: 1, unit: "day" } },
  ],
};
const GOBLIN_POX = { name: "Goblin Pox", kind: "disease", save: "fortitude", dc: "spell", stages: [{ text: "sickened 1 (1 round)", damage: [], conditions: [{ name: "Sickened", value: 1 }], interval: { value: 1, unit: "round" } }] };

// A token with effects: [[name, stacks]], and its affliction state
function token(effects = [], states = [], extra = {}) {
  const t = { _id: "pc", name: "Valeros", recordType: "characters", effects: [], effectIds: [], effectDurations: {}, effectDurationUnits: {}, data: { afflictionState: states }, ...extra };
  effects.forEach(([name, stacks]) => {
    const effect = { _id: `e-${name}`, name };
    t.effects.push(effect);
    for (let i = 0; i < stacks; i++) t.effectIds.push(effect._id);
  });
  return t;
}

section("Times");
{
  assert("rounds counted: rounds, minutes", [ctx.getAfflictionRounds({ value: 1, unit: "round" }), ctx.getAfflictionRounds({ value: 2, unit: "minute" })], [1, 20]);
  assert("hours, days, dice: the GM's", [ctx.getAfflictionRounds({ value: 1, unit: "hour" }), ctx.getAfflictionRounds({ dice: "1d6", unit: "hour" })], [0, 0]);
  assert("the effect's duration", [ctx.getAfflictionEffectDuration({ value: 6, unit: "round" }), ctx.getAfflictionEffectDuration({ value: 5, unit: "day" }), ctx.getAfflictionEffectDuration({ value: 2, unit: "week" })], [{ value: 6, unit: "rounds" }, { value: 5, unit: "days" }, { value: 14, unit: "days" }]);
  assert("none for dice or nothing", [ctx.getAfflictionEffectDuration({ dice: "1d4", unit: "hour" }), ctx.getAfflictionEffectDuration(null)], [undefined, undefined]);
  assert("described", [ctx.describeAfflictionTime({ value: 1, unit: "round" }), ctx.describeAfflictionTime({ dice: "1d6", unit: "hour" })], ["1 round", "1d6 hours"]);
}

section("The source: data.affliction only");
{
  assert("an item's", ctx.getRecordAffliction({ name: "Curare", data: { affliction: CURARE } }).dc, 25);
  assert("the prefix off an ability's name", ctx.getRecordAffliction({ name: "x", data: { affliction: { ...CURARE, name: "(Graveknight) Graveknight's Curse" } } }).name, "Graveknight's Curse");
  assert("no data.affliction: none (nothing is parsed)", ctx.getRecordAffliction({ name: "Curare", data: { description: "<p><strong>Stage 1</strong> 1d6 poison (1 round)</p>" } }), null);
  assert("no DC: none", ctx.getRecordAffliction({ data: { affliction: { ...CURARE, dc: null } } }), null);
}

section("Expose");
{
  const button = ctx.getAfflictionExposeButton({ name: "Curare", data: { affliction: CURARE } });
  assertIncludes("an item's button", button, "```Expose_to_Curare\nexposeToAffliction(");
  assertIncludes("... with its DC", button, "}, 25);");
  assert("a spell: none (its own save carries it)", ctx.getAfflictionExposeButton({ name: "Goblin Pox", data: { affliction: GOBLIN_POX } }), "");
  assert("none without data.affliction", ctx.getAfflictionExposeButton({ name: "Rope", data: {} }), "");
  let args = null;
  const original = ctx.rollSavingThrow;
  ctx.rollSavingThrow = (...a) => (args = a);
  ctx.exposeToAffliction(CURARE, 25);
  assert("rolls the save with its traits", [args[0], args[1], args[2].traits, args[2].affliction.mode], ["fortitude", 25, ["poison"], "initial"]);
  ctx.rollSavingThrow = original;
}

section("The initial save's result");
{
  const lines = (affliction, degree, dc = 25) => ctx.getAfflictionSaveLines({ saverTokenId: "pc", dc, affliction: { mode: "initial", affliction, tokenName: "Valeros" } }, degree);
  assert("success: not afflicted", lines(CURARE, 1), ["**Curare:** not afflicted."]);
  assertIncludes("a spell: its own success", lines(GOBLIN_POX, 1, 19)[0], "the spell says what a success does");
  assertIncludes("failure: stage 1", lines(CURARE, 0)[0], "stage 1.");
  assertIncludes("... Apply on the saver's token", lines(CURARE, 0)[1], 'withChatButtonToken("pc", "Valeros"');
  assertIncludes("critical failure: stage 2", lines(CURARE, -1)[0], "stage 2.");
  assertIncludes("onset: after it", lines(FEVER, 0)[0], "stage 1 after its onset (1 day)");
  assertIncludes("a spell's DC kept for its stage saves", lines(GOBLIN_POX, 0, 19)[1], '"castDC":19');
}

section("Exposure: new, onset, a poison again, a disease again");
{
  const first = ctx.getAfflictionExposure([], 0, CURARE, 1);
  assert("new: applied at stage 1", [first.states.length, first.stage, first.apply, first.states[0].appliedStage], [1, 1, true, 0]);
  const again = ctx.getAfflictionExposure(first.states, 1, CURARE, 2);
  assert("a poison again: +2, capped", [again.stage, again.apply, again.states.length], [3, true, 1]);
  const sick = ctx.getAfflictionExposure([], 0, FEVER, 1);
  assert("an onset in days: not applied, not counted", [sick.apply, sick.states[0].onsetLeft], [false, 0]);
  assert("a disease again: no effect", ctx.getAfflictionExposure(sick.states, 1, FEVER, 2).line, "Already has Filth Fever: no effect.");
  const timed = ctx.getAfflictionExposure([], 0, { ...CURARE, onset: { value: 1, unit: "minute" } }, 1);
  assert("an onset in minutes: counted in rounds", timed.states[0].onsetLeft, 10);
}

section("Stage saves");
{
  const change = (state, degree) => ctx.getAfflictionSaveChange({ max: 3, successes: 0, virulent: false, ...state }, degree);
  assert("success -1, critical success -2", [change({ stage: 2 }, 1).stage, change({ stage: 1 }, 2).stage], [1, -1]);
  assert("failure +1, critical failure +2 capped", [change({ stage: 1 }, 0).stage, change({ stage: 2 }, -1).stage, change({ stage: 2 }, -1).over], [2, 3, true]);
  assert("virulent: the second success -1", [change({ stage: 2, virulent: true }, 1).stage, change({ stage: 2, virulent: true, successes: 1 }, 1).stage], [2, 1]);
  assert("virulent: a critical success -1", change({ stage: 2, virulent: true }, 2).stage, 1);
  const lines = ctx.getAfflictionSaveLines({ saverTokenId: "pc", affliction: { mode: "stage", name: "Filth Fever", stage: 2, max: 3, virulent: true, successes: 0, tokenName: "Valeros" } }, 1);
  assertIncludes("virulent: what's left", lines[0], "stays at stage 2 (virulent: 1 of 2 successes)");
  assertIncludes("the Apply button by name", lines[1], 'resolveAfflictionSave(token, "Filth Fever", 1)');
}

section("Conditions per stage");
{
  const changes = ctx.getAfflictionConditionChanges(CURARE.stages[0].conditions, CURARE.stages[1].conditions);
  assert("clumsy and enfeebled +1, slowed new", [changes.add, changes.gain], [[{ name: "Clumsy", value: 1 }, { name: "Enfeebled", value: 1 }], [{ name: "Slowed", value: 1 }]]);
  const cured = ctx.getAfflictionConditionChanges(FEVER.stages[2].conditions, []);
  assert("cured: enfeebled goes, drained kept", [cured.remove, cured.kept], [[{ name: "Enfeebled", value: 2 }], ["Drained"]]);
  assert("stunned kept", ctx.getAfflictionConditionChanges([{ name: "Stunned", value: 1 }], []).kept, ["Stunned"]);
}

section("Moving to a stage: the values");
{
  const pc = token([["Curare", 1]]);
  const states = ctx.getAfflictionExposure([], 0, CURARE, 1).states;
  const two = ctx.getAfflictionStageValues(pc, states, "Curare", 1, 2);
  assert("stacks 1 to 2, applied, its interval in rounds", [two.stacks, two.states[0].appliedStage, two.states[0].roundsLeft], [{ name: "Curare", from: 1, to: 2 }, 2, 10]);
  assertIncludes("the card", two.message, "**Valeros: Curare, stage 2**");
  assertIncludes("its damage", two.message, 'executeDamageMacro("3d6 poison", "standard", "Curare: 3d6 poison")');
  const three = ctx.getAfflictionStageValues(pc, two.states, "Curare", 2, 5);
  assertIncludes("past the highest: again", three.message, "stage 3 (the highest, again)");
  assertIncludes("the stage's note for the GM", three.message, "[gm]If the victim fails while at Stage 3");
  const gone = ctx.getAfflictionStageValues(pc, two.states, "Curare", 2, 0);
  assert("cured: the state and the effect go", [gone.states, gone.stacks], [[], { name: "Curare", from: 2, to: 0 }]);
  assertIncludes("... posted", gone.message, "**Valeros** recovers from **Curare**.");
}

section("The effect's duration across stacks");
{
  assert("a new effect: the maximum duration", ctx.getAfflictionStackDuration(token(), "Curare", CURARE), { value: 6, unit: "rounds" });
  const ticking = token([["Curare", 1]]);
  ticking.effectDurations["e-Curare"] = 4;
  ticking.effectDurationUnits["e-Curare"] = "rounds";
  assert("on the creature: what's left, with its unit", ctx.getAfflictionStackDuration(ticking, "Curare", CURARE), { value: 4, unit: "rounds" });
  assert("on it with no duration: none", ctx.getAfflictionStackDuration(token([["Curare", 1]]), "Curare", CURARE), undefined);
}

section("Applying: removals first, then conditions, then the stacks one at a time");
{
  const calls = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => calls.push(["write", Object.keys(values)]);
  ctx.api.deductEffectById = (effectId, t, cb) => {
    calls.push(["deduct", effectId]);
    cb();
  };
  ctx.api.addEffects = (names) => calls.push(["addEffects", names]);
  ctx.api.addEffect = (name, t, duration) => calls.push(["addEffect", name, duration]);
  ctx.__state.messages.length = 0;
  const up = token([["Curare", 1], ["Clumsy", 1], ["Enfeebled", 1]], ctx.getAfflictionExposure([], 0, CURARE, 1).states.map((s) => ({ ...s, appliedStage: 1 })));
  up.effectDurations["e-Curare"] = 5;
  up.effectDurationUnits["e-Curare"] = "rounds";
  ctx.setAfflictionStage(up, "Curare", 3);
  assert("one state write, the conditions in one call, then two stacks keeping the duration", calls, [
    ["write", ["data.afflictionState"]],
    ["addEffects", ["Clumsy", "Enfeebled", "Slowed"]],
    ["addEffect", "Curare", { value: 5, unit: "rounds" }],
    ["addEffect", "Curare", { value: 5, unit: "rounds" }],
  ]);
  calls.length = 0;
  const down = token([["Curare", 3], ["Clumsy", 2], ["Enfeebled", 2], ["Slowed", 1]], ctx.getAfflictionExposure([], 0, CURARE, 1).states.map((s) => ({ ...s, appliedStage: 3 })));
  ctx.setAfflictionStage(down, "Curare", 0);
  assert("cured: the effect's stacks, then each condition, off", calls, [
    ["write", ["data.afflictionState"]],
    ["deduct", "e-Curare"], ["deduct", "e-Curare"], ["deduct", "e-Curare"],
    ["deduct", "e-Clumsy"], ["deduct", "e-Clumsy"],
    ["deduct", "e-Enfeebled"], ["deduct", "e-Enfeebled"],
    ["deduct", "e-Slowed"],
  ]);
}

section("Afflicted with an onset: the stage on the effect, conditions later");
{
  const calls = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => calls.push(["write", values["data.afflictionState"].map((s) => [s.name, s.data.appliedStage])]);
  ctx.api.addEffect = (name, t, duration) => calls.push(["addEffect", name, duration]);
  ctx.api.getToken = () => null;
  ctx.api.getOtherTokens = () => [];
  ctx.__state.messages.length = 0;
  ctx.afflictCreature(token(), FEVER, 2);
  assert("state, then two stacks, no conditions", calls, [["write", [["Filth Fever", 0]]], ["addEffect", "Filth Fever", undefined], ["addEffect", "Filth Fever", undefined]]);
  assertIncludes("posted", ctx.__state.messages[0], "Filth Fever: stage 2 after its onset (1 day).");
}

section("Turn end: the countdown, once a round; a gone effect gets Clear");
{
  const states = ctx.getAfflictionExposure([], 0, CURARE, 1).states.map((s) => ({ ...s, appliedStage: 1, roundsLeft: 1 }));
  const pc = token([["Curare", 1]], states);
  const r1 = ctx.getAfflictionTurnEnd(pc, states, 1);
  assertIncludes("the interval's over: Save", r1.messages[0], 'rollAfflictionSave(token, "Curare")');
  assert("the same round again: nothing", ctx.getAfflictionTurnEnd(pc, r1.states, 1).changed, false);
  const gone = token([], states);
  const g1 = ctx.getAfflictionTurnEnd(gone, states, 2);
  assertIncludes("the effect gone: Clear", g1.messages[0], 'clearAfflictionState(token, "Curare")');
  assert("... once", ctx.getAfflictionTurnEnd(gone, g1.states, 3).messages, []);
  const onset = ctx.getAfflictionExposure([], 0, { ...CURARE, onset: { value: 2, unit: "round" } }, 1).states;
  const o1 = ctx.getAfflictionTurnEnd(token([["Curare", 1]], onset), onset, 1);
  const o2 = ctx.getAfflictionTurnEnd(token([["Curare", 1]], onset), o1.states, 2);
  assertIncludes("the onset over: Apply", o2.messages[0], "onset is over: stage 1.");
}

section("Clear: the stage's conditions off, lasting ones kept");
{
  const calls = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => calls.push(["write", values["data.afflictionState"]]);
  ctx.api.deductEffectById = (effectId, t, cb) => {
    calls.push(["deduct", effectId]);
    cb();
  };
  ctx.api.addEffects = () => {};
  ctx.__state.messages.length = 0;
  const pc = token([["Enfeebled", 2], ["Drained", 1]], [{ ...ctx.getAfflictionExposure([], 0, FEVER, 1).states[0], appliedStage: 3 }]);
  ctx.api.getToken = () => pc;
  ctx.clearAfflictionState(pc, "Filth Fever");
  assert("state gone, enfeebled off", calls, [["write", []], ["deduct", "e-Enfeebled"], ["deduct", "e-Enfeebled"]]);
  assertIncludes("drained kept", ctx.__state.messages[0], "kept: Drained");
}

section("Rolling and resolving a stage save");
{
  let meta = null;
  ctx.api.promptRollForToken = (rec, name, dice, modifiers, metadata) => (meta = metadata);
  const states = ctx.getAfflictionExposure([], 0, CURARE, 1).states.map((s) => ({ ...s, appliedStage: 2 }));
  ctx.rollAfflictionSave(token([["Curare", 2]], states, { data: { afflictionState: states, fortitudeMod: 7 } }), "Curare");
  assert("the save's affliction from the effect's stacks", [meta.affliction.mode, meta.affliction.stage, meta.dc], ["stage", 2, 25]);
  const pox = ctx.getAfflictionExposure([], 0, { ...GOBLIN_POX, castDC: 19 }, 1).states;
  ctx.rollAfflictionSave(token([["Goblin Pox", 1]], pox, { data: { afflictionState: pox, fortitudeMod: 3 } }), "Goblin Pox");
  assert("a spell's: the caster's DC", meta.dc, 19);

  const calls = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => calls.push(values["data.afflictionState"]);
  ctx.api.removeEffectById = (effectId, t, cb) => {
    calls.push(["remove", effectId]);
    cb();
  };
  ctx.api.addEffect = () => {};
  ctx.api.addEffects = () => {};
  ctx.__state.messages.length = 0;
  const fever = [{ ...ctx.getAfflictionExposure([], 0, FEVER, 1).states[0], appliedStage: 2 }];
  const sick = token([["Filth Fever", 2], ["Enfeebled", 1], ["Treat Disease", 1]], fever);
  ctx.api.getToken = () => sick;
  ctx.resolveAfflictionSave(sick, "Filth Fever", 1);
  assert("the treatment used up first", calls[0], ["remove", "e-Treat Disease"]);
  assert("virulent lone success: the count and next interval only", [calls[1][0].data.successes, calls[1][0].data.roundsLeft], [1, 0]);
  assert("no stage card", ctx.__state.messages.some((m) => m.includes("stage 2**")), false);

  // A stage change waits for the treatment's removal: one effect write at a time
  const order = [];
  let pending = null;
  ctx.api.removeEffectById = (effectId, t, cb) => {
    order.push("remove");
    pending = cb;
  };
  ctx.api.setValuesOnTokenById = () => order.push("write");
  ctx.api.deductEffectById = (effectId, t, cb) => {
    order.push("deduct");
    cb();
  };
  const treated = token([["Filth Fever", 2], ["Enfeebled", 1], ["Treat Disease", 1]], fever);
  ctx.api.getToken = () => treated;
  ctx.resolveAfflictionSave(treated, "Filth Fever", 2);
  assert("nothing else before the removal finishes", order, ["remove"]);
  pending();
  assert("then the stage change", order[1], "write");
  assert("and its effects", order.includes("deduct"), true);
}

section("Treat Poison and Treat Disease");
{
  const lines = ctx.getAfflictionTreatmentLines({ action: "Treat Poison" }, 2);
  assertIncludes("critical success: +4", lines[0], "+4 to the patient's next save against its poison");
  assertIncludes("the Player Core effect", lines[1], '```Apply_Treat_Poison\napplyEffect("Treat Poison", 1);');
  assertIncludes("critical failure: -2", ctx.getAfflictionTreatmentLines({ action: "Treat Disease" }, -1)[0], "-2");
  assert("failure: no bonus", ctx.getAfflictionTreatmentLines({ action: "Treat Disease" }, 0), ["**Treat Disease:** no bonus."]);
  assert("another action: nothing", ctx.getAfflictionTreatmentLines({ action: "Treat Wounds" }, 1), []);
}

section("The hooks");
{
  const read = (f) => fs.readFileSync(`${__dirname}/../rollhandlers/${f}`, "utf8");
  assertIncludes("save.js", read("save.js"), "getAfflictionSaveLines(data?.roll?.metadata, noteDegree)");
  assertIncludes("skill.js", read("skill.js"), "getAfflictionTreatmentLines(data?.roll?.metadata, noteDegree)");
  assertIncludes("onTurnEnd.js", read("onTurnEnd.js"), "runAfflictionTurnEnd(token");
  assertIncludes("useInventoryItem", read("common.js"), "markdownDescription += getAfflictionExposeButton(item);");
  assertIncludes("useAction", read("common.js"), "${getAfflictionExposeButton(action)}");
  assert("a spell's card: no Expose button", read("spells.js").includes("getAfflictionExposeButton"), false);
}

section("The Afflictions list: rows, and nothing left stuck");
{
  // Written as list rows, read back the same
  const writes = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push(values["data.afflictionState"]);
  const state = { ...ctx.getAfflictionExposure([], 0, CURARE, 1).states[0], appliedStage: 2, roundsLeft: 3 };
  ctx.writeAfflictionStates(token(), [state]);
  const row = writes[0][0];
  assert("a row: _id, name, data", [typeof row._id, row.name, row.data.appliedStage, row.data.affliction.name], ["string", "Curare", 2, "Curare"]);
  assert("its line", row.data.summary, "Poison · Fortitude DC 25 · stage 2 of 3 · save in 3 rounds");
  const back = ctx.getAfflictionStates({ data: { afflictionState: writes[0] } })[0];
  assert("read back", [back._id, back.name, back.appliedStage, back.roundsLeft], [row._id, "Curare", 2, 3]);
  ctx.writeAfflictionStates(token(), [back]);
  assert("the same _id when written again", writes[1][0]._id, row._id);
  const fever = { ...ctx.getAfflictionExposure([], 0, FEVER, 1).states[0], appliedStage: 1 };
  assert("a day interval: the GM's save", ctx.getAfflictionSummary(fever), "Disease (virulent) · Fortitude DC 20 · stage 1 of 3 · save every day");
  assert("an onset", ctx.getAfflictionSummary(ctx.getAfflictionExposure([], 0, FEVER, 1).states[0]), "Disease (virulent) · Fortitude DC 20 · onset (1 day)");
  assert("its effect gone", ctx.getAfflictionSummary({ ...fever, ended: true }), "Disease (virulent) · Fortitude DC 20 · its effect is gone; Remove takes off its conditions");

  // An entry whose effect is gone doesn't block a new exposure
  const old = { ...fever, appliedStage: 2, ended: true };
  const again = ctx.getAfflictionExposure([old], 0, FEVER, 1);
  assert("a disease again after its effect is gone: afflicted", [again.states.length, !!again.state, again.state.ended], [1, true, undefined]);
  assert("keeping the stage its conditions are from", again.state.appliedStage, 2);
  const stillHas = ctx.getAfflictionExposure([fever], 1, FEVER, 1);
  assert("a disease it still has: no effect", stillHas.apply, false);
  const stage = ctx.getAfflictionStageValues(token([["Curare", 1]]), [{ ...state, ended: true }], "Curare", 1, 2);
  assert("a stage change: no longer ended", stage.states[0].ended, false);

  // The GM puts the effect back: the countdown goes on
  const ended = [{ ...state, ended: true, roundsLeft: 2, tickRound: 3 }];
  const turn = ctx.getAfflictionTurnEnd(token([["Curare", 2]]), ended, 4);
  assert("the effect back: counted again", [turn.states[0].ended, turn.states[0].roundsLeft], [false, 1]);
  const gone = ctx.getAfflictionTurnEnd(token(), ended, 4);
  assert("still gone: no second Clear", [gone.changed, gone.messages.length], [false, 0]);

  // Remove: the effect's stacks, the stage's conditions, the row
  const calls = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => calls.push(["write", values["data.afflictionState"].length]);
  ctx.api.deductEffectById = (effectId, t, cb) => {
    calls.push(["deduct", effectId]);
    cb();
  };
  ctx.api.addEffects = () => {};
  ctx.__state.messages.length = 0;
  const sick = token([["Curare", 2], ["Clumsy", 2], ["Enfeebled", 2], ["Slowed", 1]], [state]);
  ctx.findSceneToken = () => sick;
  ctx.removeAffliction(sick, "Curare");
  assert("Remove: the row, the effect, then the conditions", calls.map((c) => c[1]), [0, "e-Curare", "e-Curare", "e-Clumsy", "e-Clumsy", "e-Enfeebled", "e-Enfeebled", "e-Slowed"]);
  assertIncludes("posted", ctx.__state.messages.join("\n"), "Curare removed");

  // The sheets
  const read = (f) => fs.readFileSync(`${__dirname}/../${f}`, "utf8");
  const config = JSON.parse(read("ruleset.config.json"));
  const list = config.lists?.find?.((l) => l.type === "affliction_list") || JSON.stringify(config).includes('"type":"affliction_list"');
  assert("the list type", !!list, true);
  assertIncludes("on the Notes tab", read("characters-notes.html"), 'listtype="affliction_list"');
  assertIncludes("on the NPC Description tab", read("npcs-description.html"), 'listtype="affliction_list"');
  assertIncludes("the row's buttons", read("affliction-list.html"), "removeAfflictionFromRow(");
}

section("An affliction spell: one save");
{
  const pox = { name: "Goblin Pox", recordType: "spells", data: { traits: ["Disease", "Manipulate"], defense: { save: { statistic: "fortitude" } }, affliction: GOBLIN_POX } };
  const macro = ctx.getSpellSaveMacro({ data: {} }, pox, { data: { dc: 19 } }, "");
  assert("one save button", (macro.match(/```/g) || []).length, 2);
  assertIncludes("at the caster's DC", macro, "rollSave(token, 'fortitude', 19");
  assertIncludes("carrying the affliction as the initial save", macro, '"affliction":{"mode":"initial","affliction":{');
  const plain = ctx.getSpellSaveMacro({ data: {} }, { name: "Fear", data: { traits: ["Fear"], defense: { save: { statistic: "will" } } } }, { data: { dc: 19 } }, "");
  assert("another spell: no affliction", plain.includes("affliction"), false);
}

process.exitCode = summary() > 0 ? 1 : 0;
