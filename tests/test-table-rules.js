// Tests for the rules some tables use (table-rules.js): Earn Income, Subsist
// and the cost of living, mounts, and aquatic combat and drowning.
// Run: node tests/test-table-rules.js   (or via tests/run-all.js)

const fs = require("fs");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let calls = [];
let prompts = [];
let notifications = [];
let rolls = [];
// Each prompt answers with the next queued answer, or skips when none is
// queued
let answers = [];
const reset = (queued = []) => {
  calls = [];
  prompts = [];
  notifications = [];
  rolls = [];
  answers = queued;
  state.messages = [];
  state.effects = [];
};
ctx.api.showNotification = (text) => notifications.push(text);
ctx.api.showPrompt = (title, text, placeholder, options, query, callback) => {
  prompts.push({ title, text, options });
  const answer = answers.shift();
  callback(answer === undefined ? [] : answer);
};
ctx.api.setValuesOnRecord = (record, values, cb) => {
  calls.push(["set", record?._id, values]);
  if (cb) cb({ ...record });
};
ctx.api.addEffect = (name, token, duration, appliedBy) => calls.push(["add", token?._id, name, appliedBy]);
ctx.api.addEffects = (names, token) => calls.push(["adds", token?._id, names]);
ctx.api.removeEffectById = (id, token, cb, options) => {
  calls.push(["remove", token?._id, id, options]);
  if (cb) cb();
};
let stored = {};
ctx.api.getRecord = (type, id, cb) => cb(stored[id]);
ctx.rollSkill = (...args) => rolls.push(args);
let saves = [];
ctx.rollSave = (...args) => saves.push(args);

const character = (data = {}, { id = "pc", name = "Ezren" } = {}) => ({
  _id: id,
  recordType: "characters",
  name,
  data: { level: 5, feats: [], bonusFeats: [], loreSkills: [], ...data },
});
// A token with effects: { name: stacks }
const token = (id, name, data = {}, effects = {}, effectValues = {}) => {
  const list = Object.keys(effects).map((effectName) => ({ _id: `e-${effectName}`, name: effectName }));
  return {
    _id: id,
    name,
    data,
    effects: list,
    effectIds: list.flatMap((effect) => Array(effects[effect.name]).fill(effect._id)),
    effectValues,
  };
};

section("Earn Income (Q19)");
{
  assert("success: the level and rank's income", ctx.getEarnIncomePerDayCp(3, 1, 1), 50);
  assert("critical success: level + 1", ctx.getEarnIncomePerDayCp(3, 1, 2), 70);
  assert("failure: the failure column", ctx.getEarnIncomePerDayCp(3, 1, 0), 8);
  assert("critical failure: nothing", ctx.getEarnIncomePerDayCp(3, 1, -1), 0);
  assert("Experienced Professional, trained Lore: a failure isn't doubled", ctx.getEarnIncomePerDayCp(3, 1, 0, true), 8);
  assert("... expert Lore: a failure doubles", ctx.getEarnIncomePerDayCp(3, 2, 0, true), 16);
  assert("... a critical failure is a failure, never doubled", [ctx.getEarnIncomePerDayCp(3, 1, -1, true), ctx.getEarnIncomePerDayCp(3, 3, -1, true)], [8, 8]);
  assert("legendary at 20, critical success: the 20 (critical) row", ctx.getEarnIncomePerDayCp(20, 4, 2), 30000);
  assert("untrained: nothing", ctx.getEarnIncomePerDayCp(3, 0, 1), 0);
  assert("the task level's DC", ctx.getEarnIncomeDC(5, { proficiencyWithoutLevel: false }), 20);
  assert("... less the level without level", ctx.getEarnIncomeDC(5, { proficiencyWithoutLevel: true }), 15);

  const ezren = character({
    crafting: "2",
    performance: "0",
    loreSkills: [{ name: "Scribing Lore", data: { rank: "1", mod: "9", ability: "int" } }, { name: "Farming Lore", data: { rank: "0" } }],
    feats: [{ name: "Experienced Professional", data: { type: "general" } }],
  });
  assert(
    "skill choices: trained skills and Lores",
    ctx.getEarnIncomeSkillOptions(ezren).map((option) => option.label),
    ["Crafting (Expert)", "Scribing Lore (Trained)"],
  );

  reset([["crafting"], ["4"], ["7"]]);
  ctx.promptEarnIncome(ezren);
  assert("asks the skill, the task level, then the days", prompts.map((prompt) => prompt.text.split(" ")[0]), ["Which", "The", "Days"]);
  assert("... levels up to the character's, highest first", prompts[1].options[0].label, "Level 5 (DC 20)");
  assert("... rolls the skill against the task level's DC", [rolls[0][1], rolls[0][2]], ["crafting", 19]);
  assert("... with what the card needs", rolls[0][10].earnIncome, {
    level: 4,
    days: 7,
    rank: 2,
    experienced: false,
    recordId: "pc",
    recordType: "characters",
    name: "Ezren",
  });
  assert("... as a downtime check", rolls[0][10].traits, ["downtime"]);

  reset([["lore:0"], ["2"], ["1"]]);
  ctx.promptEarnIncome(ezren);
  assert("a Lore: its modifier, rank and attribute", rolls[0].slice(1, 7), ["Scribing Lore", 16, true, 9, 1, "int"]);
  assert("... Experienced Professional counts for a Lore", rolls[0][10].earnIncome.experienced, true);

  reset([["2"], ["1"]]);
  ctx.performSkillAction(ezren, "crafting", "Earn Income");
  assert("from the Roll as menu: the skill is known", [prompts.length, rolls[0]?.[1]], [2, "crafting"]);

  reset();
  ctx.promptEarnIncome(character());
  assert("no trained skill: a notice", notifications, ["Earn Income needs a trained skill."]);

  const earned = { level: 3, days: 4, rank: 1, experienced: false, recordId: "pc", recordType: "characters" };
  const lines = ctx.getEarnIncomeLines(earned, 1);
  assert("the card: per day and in all", lines[0], "**Earn Income:** 5 sp a day for 4 days: **2 gp**.");
  assertIncludes("... and the Collect button", lines[1], 'collectIncome("characters", "pc", 200);');
  assert("a critical failure: nothing", ctx.getEarnIncomeLines(earned, -1), ["**Earn Income:** nothing earned."]);

  stored = { pc: character({ gp: 3, sp: 9 }) };
  const edits = [];
  ctx.api.editMessage = (id, text) => edits.push([id, text]);
  reset();
  ctx.collectIncome("characters", "pc", 215);
  assert("Collect: strikes out its card first", edits, [[null, "~**Earn Income:** 2 gp, 1 sp, 5 cp~ Collected."]]);
  assert("... added to the fresh read's coins", calls[0], ["set", "pc", { "data.gp": 5, "data.sp": 10, "data.cp": 5 }]);
  assertIncludes("... with a card", state.messages[0], "**Ezren collects 2 gp, 1 sp, 5 cp.**");
}

section("Subsist and cost of living (Q38)");
{
  const options = ctx.getSubsistOptions();
  assert("the sample environments by simple DC, then the GM's", [options.length, options[1].label, options[5].value], [
    6,
    "Trained: a typical hillside or village (DC 15)",
    "gm",
  ]);

  const ezren = character({ survival: "1" });
  reset([["1"]]);
  ctx.performSkillAction(ezren, "survival", "Subsist");
  assert("Subsist asks the environment, then rolls at its DC", [prompts[0].title, rolls[0][1], rolls[0][2]], ["Subsist", "survival", 15]);
  assert(
    "... with the two penalties unticked",
    rolls[0][10].extraModifiers.map((mod) => [mod.value, mod.active]),
    [[-5, false], [-2, false]],
  );
  reset([["gm"]]);
  ctx.promptSubsist(ezren, "society");
  assert("the GM's DC: none set", rolls[0][2], null);

  const subsist = { actorId: "pc", actorName: "Ezren" };
  assert("success: subsistence living", ctx.getSubsistLines(subsist, 1).length, 1);
  assertIncludes("failure: a Fatigued button", ctx.getSubsistLines(subsist, 0)[1], "```Apply_Fatigued");
  assertIncludes("critical failure: the week's penalty", ctx.getSubsistLines(subsist, -1)[1], 'api.addEffect("Adverse Subsist Situation", token)');

  assert("cost of living: fine for a month", ctx.getCostOfLivingPayment(character({ gp: 200 }), "fine:month").values, { "data.gp": 70 });
  assert("can't pay: no values", ctx.getCostOfLivingPayment(character({ gp: 1 }), "fine:week").values, null);
  stored = { pc: character({ gp: 2 }) };
  reset([["comfortable:week"]]);
  ctx.payCostOfLiving(character());
  assert("paid in one write from the fresh read", calls, [["set", "pc", { "data.gp": 1 }]]);
  assertIncludes("... with a card", state.messages[0], "**Ezren pays 1 gp** for a comfortable living (1 week).");
  stored = { pc: character() };
  reset([["fine:year"]]);
  ctx.payCostOfLiving(character());
  assert("not enough coins: a notice, no write", [notifications, calls], [["Not enough coins for 1600 gp."], []]);
}

section("Mount and Dismount (Q37)");
{
  const rider = token("rider", "Valeros", { size: "medium" });
  const horse = token("horse", "Horse", { size: "large" });
  const pony = token("pony", "Pony", { size: "medium" });
  assertIncludes("the mount card", ctx.getMountMessage(rider, horse), "**Valeros mounts Horse.**");
  assertIncludes("... with Ride's minion turn and skipped turn", ctx.getMountMessage(rider, horse).split("\n")[2], "mounted in the middle of an encounter, it skips its next turn");
  assert("a mount that isn't larger: a GM note", ctx.getMountMessage(rider, pony).split("\n")[3], "[gm]Pony isn't at least one size larger than Valeros.[/gm]");

  ctx.api.getSelectedOrDroppedToken = () => [rider];
  ctx.api.getTargets = () => [{ token: horse }];
  reset();
  ctx.mountTarget();
  assert("Mount: Mounted on the rider, the mount as its applier", calls[0], ["add", "rider", "Mounted", { _id: "horse", name: "Horse" }]);

  const mounted = token("rider", "Valeros", {}, { Mounted: 1 }, { "e-Mounted": { value: 1, tokenId: "horse", tokenName: "Horse" } });
  assert("the rider's mount", ctx.getMountId(mounted), "horse");
  const valeros = character({ nature: "1", feats: [{ name: "Ride", data: { type: "general" } }] }, { id: "rider", name: "Valeros" });
  assert("Ride: commanding the rider's own mount", ctx.isRideCommand(valeros, mounted, horse), true);
  assert("... not another creature", ctx.isRideCommand(valeros, mounted, pony), false);
  assert("... nor without Ride", ctx.isRideCommand(character({}, { id: "rider" }), mounted, horse), false);
  assertIncludes("the success card", ctx.getRideCommandMessage(mounted, horse), "commanding your mount to take a move action succeeds automatically");

  ctx.api.getToken = () => mounted;
  ctx.api.getTargets = () => [{ token: horse }];
  reset([["move"]]);
  ctx.performSkillAction(valeros, "nature", "Command an Animal");
  assert("Ride asks whether it's a move action", prompts[0]?.title, "Ride");
  assert("... yes: the success card, no roll", [rolls.length, state.messages.length], [0, 1]);
  reset([["roll"]]);
  ctx.performSkillAction(valeros, "nature", "Command an Animal");
  assert("... no (a Strike, say): rolled as usual, asked once", [rolls.length, rolls[0]?.[1], prompts.length], [1, "nature", 1]);
  reset();
  ctx.performSkillAction(character({ nature: "1" }, { id: "rider" }), "nature", "Command an Animal");
  assert("without Ride: no question, rolled", [prompts.length, rolls.length], [0, 1]);
  ctx.api.getToken = () => null;

  ctx.api.getSelectedOrDroppedToken = () => [mounted];
  ctx.api.getOtherTokens = () => [horse];
  reset();
  ctx.dismountSelected();
  assert("Dismount: Mounted removed", calls[0], ["remove", "rider", "e-Mounted", undefined]);
  assertIncludes("... with a card", state.messages[0], "**Valeros dismounts Horse**");
  ctx.api.getOtherTokens = () => [];

  assertIncludes("the Mount action card's buttons", ctx.getSkillActionMacros({ name: "Mount" }), "mountTarget();");
}

section("Aquatic combat and drowning (Q39)");
{
  const sword = { name: "Longsword", data: { damageType: "slashing", traits: [] } };
  const spear = { name: "Spear", data: { damageType: "piercing", traits: [] } };
  const fist = { name: "Fist", data: { damageType: "bludgeoning", traits: ["unarmed"] } };
  const diver = token("diver", "Diver", {}, { Underwater: 1 });
  assert("underwater, slashing: -2 circumstance", ctx.getUnderwaterAttackModifiers(diver, sword).map((mod) => [mod.type, mod.value]), [["circumstance", -2]]);
  assert("... piercing: none", ctx.getUnderwaterAttackModifiers(diver, spear), []);
  assert("... the underwater property rune: none", ctx.getUnderwaterAttackModifiers(diver, { data: { damageType: "slashing", traits: [], runes: { property: [{ name: "Underwater" }] } } }), []);
  assert("... as a plain rune name too", ctx.getUnderwaterAttackModifiers(diver, { data: { damageType: "slashing", runes: { property: ["underwater"] } } }), []);
  assert("... another rune: still -2", ctx.getUnderwaterAttackModifiers(diver, { data: { damageType: "slashing", runes: { property: [{ name: "Flaming" }] } } }).length, 1);
  assert("... an aquatic creature's unarmed attack: none", ctx.getUnderwaterAttackModifiers(token("merfolk", "Merfolk", { traits: ["aquatic"] }, { Underwater: 1 }), fist), []);
  assert("... but a land creature's: -2", ctx.getUnderwaterAttackModifiers(diver, fist).length, 1);
  assert("not underwater: none", ctx.getUnderwaterAttackModifiers(token("dry", "Dry"), sword), []);
  assert("an NPC attack's damage rolls", ctx.getUnderwaterAttackModifiers(diver, { data: { damage: "1d6 slashing", damageRolls: [{ data: { formula: "1d6", type: "slashing" } }] } }).length, 1);
  assert("... or its damage text", ctx.getUnderwaterAttackModifiers(diver, { data: { damage: "2d8+4 bludgeoning" } }).length, 1);
  assert("... piercing text: none", ctx.getUnderwaterAttackModifiers(diver, { data: { damage: "1d6 piercing" } }), []);

  const walker = token("walker", "Walker", { speed: "25 feet" });
  const swimmer = token("swimmer", "Swimmer", { speed: "25 feet, swim 20 feet" });
  ctx.api.getSelectedOrDroppedToken = () => [walker, swimmer, diver];
  reset();
  ctx.toggleUnderwater();
  assert("Underwater: off-guard without a swim Speed", calls.slice(0, 2), [["adds", "walker", ["Underwater", "Off-Guard"]], ["adds", "swimmer", ["Underwater"]]]);
  assert("... and out of the water for one already in it", calls[2], ["remove", "diver", "e-Underwater", undefined]);
  assertIncludes("... with a Hold Breath button", state.messages[0], "holdBreathSelected();");

  assert("air: 5 + Constitution", ctx.getAirRounds(token("t", "T", { con: 3 })), 8);
  ctx.api.getSelectedOrDroppedToken = () => [token("t", "T", { con: 2 }, { "Holding Breath": 3 })];
  reset();
  ctx.holdBreathSelected();
  assert("Hold Breath: tops the stacks up to the air", calls[0], ["adds", "t", Array(4).fill("Holding Breath")]);

  const holding = token("h", "Hana", {}, { "Holding Breath": 3 });
  const card = ctx.getBreathTurnEndMessage(holding);
  assertIncludes("turn end: the air left", card, "**Hana is holding their breath:** 3 rounds of air.");
  assertIncludes("... with buttons that spend it", card, "loseAir(token, 2)");
  const suffocating = token("s", "Sam", {}, { Suffocating: 2 });
  assertIncludes("suffocating: the escalated save", ctx.getBreathTurnEndMessage(suffocating), "Fortitude DC 25. Failure: 2d10 damage.");
  assert("neither: no card", ctx.getBreathTurnEndMessage(token("n", "N")), "");

  reset();
  ctx.loseAir(token("h", "Hana", {}, { "Holding Breath": 2 }), 2);
  assert("out of air: both stacks spent, then unconscious and suffocating", calls.map((call) => call[0]), ["remove", "remove", "adds"]);
  assert("... one instance at a time", calls[0][3], { instanceIndex: 1 });
  assert("... adds the conditions", calls[2], ["adds", "h", ["Unconscious", "Suffocating"]]);

  // The removals don't update the token passed in (as live)
  reset();
  ctx.breatheAgain(token("b", "Bo", {}, { "Holding Breath": 2, Suffocating: 1 }));
  assert(
    "Breathes Again: each effect removed once",
    calls.map((call) => call[2]),
    ["e-Holding Breath", "e-Suffocating"],
  );
  assertIncludes("... then the card", state.messages[0], "**Bo can breathe again.**");

  saves = [];
  reset();
  ctx.rollSuffocationSave(suffocating);
  assert("the save at the count's DC, then one more counted", [saves[0][1], saves[0][2], calls[0]], ["fortitude", 25, ["add", "s", "Suffocating", undefined]]);
}

section("Sheet hooks");
{
  const skills = fs.readFileSync(`${__dirname}/../characters-skills.html`, "utf8");
  const skillHandler = fs.readFileSync(`${__dirname}/../rollhandlers/skill.js`, "utf8");
  const turnEnd = fs.readFileSync(`${__dirname}/../rollhandlers/onTurnEnd.js`, "utf8");
  assertIncludes("Skills tab: Earn Income", skills, 'onclick="promptEarnIncome(record)"');
  assertIncludes("... and Pay Cost of Living", skills, 'onclick="payCostOfLiving(record)"');
  assertIncludes("the skill card's downtime lines", skillHandler, "getEarnIncomeLines(data?.roll?.metadata?.earnIncome, noteDegree)");
  assertIncludes("the turn end's breath card", turnEnd, "getBreathTurnEndMessage(token)");
}

summary();
