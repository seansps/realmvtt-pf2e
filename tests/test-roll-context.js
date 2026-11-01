// Engine group G4: roll checks and roll context. Degree adjustments that read
// the rolled die (Keen Flair), roll options that depend on the action
// (Panache), encounter atoms (Stylish Combatant, Surprise Attack), the target's
// distance, granter atoms (Crossblooded Evolution), the spell slot rank
// (Sorcerous Potency) and skill substitution (Chirurgeon).
// Run: node tests/test-roll-context.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
new vm.Script(fs.readFileSync(`${__dirname}/../rollhandlers/spells.js`, "utf8"), { filename: "spells.js" }).runInContext(ctx);

// --- helpers ----------------------------------------------------------------

const feat = (name, modifiers, extra = {}) => ({
  _id: `feat-${name}`,
  name,
  recordType: "feats",
  data: { type: "general", level: 1, modifiers: modifiers.map((data) => ({ data })), ...extra },
});

function pc({ feats = [], inventory = [], ...data } = {}) {
  return {
    _id: "pc",
    recordType: "characters",
    effects: [],
    effectIds: [],
    fields: {},
    data: {
      level: 5,
      str: 2,
      dex: 3,
      con: 1,
      int: 1,
      wis: 1,
      speed: "25 feet",
      ancestries: [{ name: "Human", data: { speed: "25 feet", hp: 8 } }],
      classes: [{ name: "Fighter", data: { hp: 10, features: [] } }],
      feats,
      bonusFeats: [],
      inventory,
      ...data,
    },
  };
}

const weapon = (name, extra = {}) => ({
  _id: `w-${name}`,
  name,
  recordType: "items",
  data: {
    type: "weapon",
    carried: "equipped",
    itemCategory: "martial",
    group: "sword",
    traits: [],
    usage: "held-in-one-hand",
    range: 0,
    damage: { dice: 1, die: "d8", damageType: "slashing" },
    runes: { potency: 0, striking: 0, property: [] },
    ...extra,
  },
});

function capturePrompt(run) {
  const saved = ctx.api.promptRoll;
  let captured = { modifiers: [], metadata: {}, dice: "" };
  ctx.api.promptRoll = (name, dice, modifiers, metadata) => {
    captured = { modifiers: modifiers || [], metadata: metadata || {}, dice };
  };
  try {
    run();
  } finally {
    ctx.api.promptRoll = saved;
  }
  return captured;
}

// Runs a roll handler file the way Realm does, with `data` in scope
function runHandler(file, data) {
  ctx.__state.messages = [];
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
  return ctx.__state.messages.join("\n");
}

const lookup = (record, types, field, context = {}) =>
  ctx.getEffectsAndModifiersForToken(record, types, field, undefined, undefined, context);
const traitsFor = (record, context = {}) => [...ctx.collectTraitsAndProperties(record, context)];
const findMod = (mods, prefix) => mods.find((m) => m.name.startsWith(prefix));

// The campaign variable the encounter hooks keep
let campaignVariables = {};
ctx.api.getCampaignVariable = (name) => campaignVariables[name];
ctx.api.setCampaignVariable = (name, value) => {
  campaignVariables[name] = value;
};

// --- G4.1 natural die result (Keen Flair) ------------------------------------

section("G4.1 degree adjustments that read the rolled die (Keen Flair)");
{
  const keenFlair = feat("Keen Flair", [
    {
      type: "adjustDegreeOfSuccess",
      adjustment: { all: "none", success: "to-critical-success", failure: "none", criticalFailure: "none" },
      field: "strike-attack-roll",
      predicate: '["check:roll:total:natural:19","item:proficiency:rank:3"]',
    },
  ]);
  const master = feat("Weapon Mastery", [{ type: "weaponProficiency", modifierType: "none", field: "", active: true, valueType: "number", value: "3" }]);
  const expert = feat("Weapon Expertise", [{ type: "weaponProficiency", modifierType: "none", field: "", active: true, valueType: "number", value: "2" }]);
  const rapier = weapon("Rapier", { traits: ["deadly-d8", "disarm", "finesse"], damage: { dice: 1, die: "d6", damageType: "piercing" } });

  const swash = pc({ feats: [keenFlair, master], inventory: [rapier] });
  const adjustments = capturePrompt(() => ctx.performAttackRoll(swash, rapier, "data.inventory.0", 1)).metadata.degreeOfSuccessAdjustments;
  assert("the adjustment waits for the roll (postRoll)", adjustments.postRoll?.length, 1);
  assert("its known part is settled before the roll", JSON.stringify(adjustments.postRoll[0].predicate), '["check:roll:total:natural:19",true]');
  assert("and it isn't applied before the roll", adjustments.success.value, "none");

  const strike = (d20, total, adj = adjustments) =>
    runHandler("attack.js", { roll: { dice: [{ type: 20, value: d20 }], total, metadata: { dc: 20, attack: "Rapier", traits: [], damage: "1d6 piercing", degreeOfSuccessAdjustments: adj } } });
  assert("natural 19 success becomes a critical hit", strike(19, 25).includes("CRITICAL HIT [Keen Flair]"), true);
  assert("natural 18 success stays a hit", strike(18, 25).includes("CRITICAL HIT"), false);
  assert("natural 19 failure stays a miss", strike(19, 15).includes("MISS"), true);
  assert("natural 19 failure is not a hit", strike(19, 15).includes("HIT"), false);

  const notMaster = pc({ feats: [keenFlair, expert], inventory: [rapier] });
  const expertAdjustments = capturePrompt(() => ctx.performAttackRoll(notMaster, rapier, "data.inventory.0", 1)).metadata.degreeOfSuccessAdjustments;
  assert("without master proficiency nothing waits for the roll", expertAdjustments.postRoll, undefined);
  assert("and a natural 19 success stays a hit", strike(19, 25, expertAdjustments).includes("CRITICAL"), false);

  // Unchanged: ordinary adjustments, and metadata without postRoll
  const plain = feat("Plain Adjust", [{ type: "adjustDegreeOfSuccess", adjustment: { all: "none", success: "one-degree-better", failure: "none", criticalFailure: "none" }, field: "strike-attack-roll" }]);
  const plainAdjustments = capturePrompt(() => ctx.performAttackRoll(pc({ feats: [plain], inventory: [rapier] }), rapier, "data.inventory.0", 1)).metadata.degreeOfSuccessAdjustments;
  assert("an ordinary adjustment is unchanged", plainAdjustments.success.value, "one-degree-better");
  assert("and adds no postRoll entry", "postRoll" in plainAdjustments, false);
  assert("applyDegreeOfSuccessAdjustment without a roll still works", ctx.applyDegreeOfSuccessAdjustment(1, plainAdjustments).degree, 2);
  assert("old metadata without postRoll ignores the roll", ctx.applyDegreeOfSuccessAdjustment(1, plainAdjustments, { natural: 19, total: 25, dc: 20 }).degree, 2);

  // Post-roll atoms and comparisons, skill and save handlers
  assert("post-roll atoms", JSON.stringify(ctx.getPostRollAtoms({ natural: 19, total: 25, dc: 20 })), JSON.stringify(["check:total:25", "check:total:natural:19", "check:roll:total:natural:19", "check:total:delta:5"]));
  const byMargin = { all: { value: "none", worse: "none" }, success: { value: "none", worse: "none" }, failure: { value: "none", worse: "none" }, criticalFailure: { value: "none", worse: "none" }, postRoll: [{ name: "Margin", adjustment: { failure: "to-success" }, predicate: [{ gte: ["check:total:delta", -2] }] }] };
  assert("a comparison on the margin: failure by 2 becomes a success", ctx.applyDegreeOfSuccessAdjustment(0, byMargin, { natural: 10, total: 18, dc: 20 }).degree, 1);
  assert("failure by 3 doesn't", ctx.applyDegreeOfSuccessAdjustment(0, byMargin, { natural: 10, total: 17, dc: 20 }).degree, 0);
  const nested = ctx.reducePredicateBeforeRoll([{ or: ["check:total:natural:20", "self:type:character"] }, { not: "self:type:npc" }], ctx.collectTraitsAndProperties(swash, {}), swash, {});
  assert("nested parts are settled, post-roll atoms kept", JSON.stringify(nested), '[{"or":["check:total:natural:20",true]},{"not":false}]');
  const skillAdj = { ...byMargin, postRoll: [{ name: "Nat 19", adjustment: { success: "to-critical-success" }, predicate: ["check:total:natural:19"] }] };
  const skillCard = (d20) => runHandler("skill.js", { roll: { dice: [{ type: 20, value: d20 }], total: 25, metadata: { dc: 20, degreeOfSuccessAdjustments: skillAdj } } });
  assert("skill.js reads the natural die", skillCard(19).includes("CRITICAL SUCCESS"), true);
  assert("skill.js: other dice unchanged", skillCard(17).includes("CRITICAL SUCCESS"), false);
  const saveCard = (d20) => runHandler("save.js", { roll: { dice: [{ type: 20, value: d20 }], total: 25, metadata: { dc: 20, degreeOfSuccessAdjustments: skillAdj } } });
  assert("save.js reads the natural die", saveCard(19).includes("CRITICAL SUCCESS"), true);
  assert("save.js: other dice unchanged", saveCard(17).includes("CRITICAL SUCCESS"), false);
}

// --- G4.2 action roll options (Panache) --------------------------------------

section("G4.2 roll options that depend on the action (Panache bravado)");
{
  const panache = feat("Panache", [{ type: "rollOption", option: "item:trait:bravado", active: true, predicate: '["action:tumble-through"]' }]);
  const braggart = feat("Braggart", [{ type: "rollOption", option: "item:trait:bravado", active: true, predicate: '["action:demoralize"]' }]);
  const stylish = feat("Stylish Combatant", [{ type: "skillBonus", modifierType: "circumstance", field: "", active: true, valueType: "number", value: "1", predicate: '["item:trait:bravado"]' }]);
  const swash = pc({ feats: [panache, braggart, stylish] });
  const roll = (skill, action) =>
    findMod(capturePrompt(() => ctx.rollSkill(swash, skill, null, false, 0, 1, "int", false, false, undefined, action ? { action } : {})).modifiers, "Stylish Combatant");

  assert("Tumble Through gains bravado: the bonus applies", roll("acrobatics", "Tumble Through")?.active, true);
  assert("Demoralize (Braggart) gains bravado too", roll("intimidation", "Demoralize")?.active, true);
  assert("Balance doesn't: the bonus is only offered", roll("acrobatics", "Balance")?.active, false);
  assert("as an opt-in", !!roll("acrobatics", "Balance")?.situational, true);
  assert("no action: unchanged opt-in", [roll("acrobatics")?.active, !!roll("acrobatics")?.situational].join(","), "false,true");
  assertIncludes("the atom is in the roll's traits", traitsFor(swash, { action: { name: "Tumble Through" } }), "item:trait:bravado");
  assertNotIncludes("not for another action", traitsFor(swash, { action: { name: "Balance" } }), "item:trait:bravado");
  const values = {};
  ctx.updateRollOptions(swash, values);
  assert("stored roll options don't take it (no action at recalculation)", (values["data.rollOptions"] || []).includes("item:trait:bravado"), false);
  // Unchanged: a roll option that doesn't name an action isn't added per roll
  const other = pc({ feats: [feat("Other", [{ type: "rollOption", option: "other-option", active: true, predicate: '["self:effect:nope"]' }])] });
  assertNotIncludes("roll options without an action predicate aren't read per roll", traitsFor(other, { action: { name: "Balance" } }), "other-option");
}

// --- G4.3 encounter atoms ------------------------------------------------------

section("G4.3 encounter atoms (Stylish Combatant, Surprise Attack)");
{
  const stylish = feat("Stylish Combatant", [
    { type: "skillBonus", modifierType: "circumstance", field: "", active: true, valueType: "number", value: "1", predicate: '["item:trait:bravado",{"or":["encounter","feature:continuous-flair"]}]' },
  ]);
  const panache = feat("Panache", [{ type: "rollOption", option: "item:trait:bravado", active: true, predicate: '["action:tumble-through"]' }]);
  const swash = pc({ feats: [panache, stylish], initiativeSkill: "Perception" });
  const tumble = () =>
    findMod(capturePrompt(() => ctx.rollSkill(swash, "acrobatics", null, false, 0, 1, "int", false, false, undefined, { action: "Tumble Through" })).modifiers, "Stylish Combatant");

  campaignVariables = {};
  assertNotIncludes("never recorded: no encounter atom", traitsFor(swash), "encounter");
  assert("never recorded: the bonus is an opt-in", [tumble()?.active, tumble()?.name].join("|"), "false|Stylish Combatant (in an encounter)");

  campaignVariables = { pf2eEncounter: { round: 2, participants: [{ id: "tok-pc", recordId: "pc" }, { id: "tok-orc", recordId: null }] } };
  assertIncludes("in an encounter: encounter", traitsFor(swash), "encounter");
  assertIncludes("and its round", traitsFor(swash), "encounter:round:2");
  assertIncludes("and the initiative statistic (the sheet's choice)", traitsFor(swash), "self:participant:initiative:stat:perception");
  assert("the bravado bonus applies in an encounter", tumble()?.active, true);

  campaignVariables = { pf2eEncounter: { round: 0, participants: [] } };
  assertNotIncludes("no encounter running: no atom", traitsFor(swash), "encounter");
  assert("and the bonus is neither applied nor offered", [tumble()?.active, !!tumble()?.situational].join(","), "false,false");

  campaignVariables = { pf2eEncounter: { round: 1, participants: [{ id: "tok-orc", recordId: null }] } };
  assertNotIncludes("not one of the encounter's creatures: no atom", traitsFor(swash), "encounter");

  // Surprise Attack: Foundry's predicate on an offGuardTarget modifier
  const surprise = feat("Surprise Attack", [
    { type: "offGuardTarget", modifierType: "none", field: "", active: true, valueType: "string", value: "", predicate: '["encounter:round:1",{"lt":["self:participant:initiative:rank","target:participant:initiative:rank"]},{"or":["self:participant:initiative:stat:deception","self:participant:initiative:stat:stealth"]}]' },
  ]);
  const sword = weapon("Shortsword", { itemCategory: "simple", traits: ["agile", "finesse"], damage: { dice: 1, die: "d6", damageType: "piercing" } });
  const rogue = (data = {}) => pc({ feats: [surprise], inventory: [sword], initiative: 25, initiativeStatistic: "stealth", ...data });
  const orc = (initiative) => ({ token: { _id: "tok-orc", recordType: "npcs", effects: [], data: { ac: 15, level: 1, traits: [], initiative } }, distance: 5 });
  const offGuard = (record, target, round = 1) => {
    campaignVariables = { pf2eEncounter: { round, participants: [{ id: "tok-pc", recordId: "pc" }, { id: "tok-orc", recordId: null }] } };
    ctx.api.getTargets = () => [target];
    try {
      return capturePrompt(() => ctx.performAttackRoll(record, sword, "data.inventory.0", 1)).metadata.isOffGuard;
    } finally {
      ctx.api.getTargets = () => [];
    }
  };
  assert("round 1, Stealth, before the orc: off-guard", offGuard(rogue(), orc(10)), true);
  assert("Deception works too", offGuard(rogue({ initiativeStatistic: "deception" }), orc(10)), true);
  assert("the orc acted first: not off-guard", offGuard(rogue(), orc(30)), false);
  assert("round 2: not off-guard", offGuard(rogue(), orc(10), 2), false);
  assert("Perception for initiative: not off-guard", offGuard(rogue({ initiativeStatistic: "perception" }), orc(10)), false);
  campaignVariables = {};
  ctx.api.getTargets = () => [orc(10)];
  assert("no encounter: not off-guard", capturePrompt(() => ctx.performAttackRoll(rogue(), sword, "data.inventory.0", 1)).metadata.isOffGuard, false);
  ctx.api.getTargets = () => [];

  // Ranks count the other creatures on the scene in the encounter
  campaignVariables = { pf2eEncounter: { round: 1, participants: [{ id: "tok-pc", recordId: "pc" }, { id: "a" }, { id: "b" }, { id: "c" }] } };
  const savedOthers = ctx.api.getOtherTokens;
  ctx.api.getOtherTokens = () => [
    { _id: "a", data: { initiative: 30 } },
    { _id: "b", data: { initiative: 20 } },
    { _id: "c", data: { initiative: 5 } },
    { _id: "x", data: { initiative: 40 } },
  ];
  assert("rank: one creature in the encounter is ahead", ctx.getInitiativeRank(rogue()), 2);
  assert("a creature not in the encounter doesn't count", ctx.getInitiativeRank({ _id: "c", data: { initiative: 5 } }, rogue()), 4);
  ctx.api.getOtherTokens = savedOthers;
  campaignVariables = {};
  assert("no encounter: no rank", Number.isNaN(ctx.getInitiativeRank(rogue())), true);

  // The hooks keep the campaign variable
  runHandler("onRoundStart.js", { round: 0, tokens: [{ _id: "tok-pc", recordId: "pc" }, { _id: "tok-orc" }] });
  assert("onRoundStart at the encounter's start: round 1", JSON.stringify(campaignVariables.pf2eEncounter), JSON.stringify({ round: 1, participants: [{ id: "tok-pc", recordId: "pc" }, { id: "tok-orc", recordId: null }] }));
  runHandler("onRoundStart.js", { round: 3, tokens: [{ _id: "tok-pc", recordId: "pc" }] });
  assert("later rounds", campaignVariables.pf2eEncounter.round, 3);
  runHandler("onEncounterEnd.js", { tokens: [] });
  assert("onEncounterEnd ends it", JSON.stringify(campaignVariables.pf2eEncounter), JSON.stringify({ round: 0, participants: [] }));

  // initiative.js stores the statistic rolled
  let stored = null;
  const savedSetValues = ctx.api.setValues;
  ctx.api.setValues = (values) => {
    stored = values;
  };
  runHandler("initiative.js", { roll: { total: 21, dice: [], metadata: { initiativeSkill: "Stealth" } } });
  ctx.api.setValues = savedSetValues;
  assert("initiative.js stores the initiative and its statistic", JSON.stringify(stored), JSON.stringify({ "data.initiative": 21, "data.initiativeStatistic": "stealth" }));
}

// --- G4.4 target distance --------------------------------------------------------

section("G4.4 target:distance");
{
  const keen = feat("Longsnout", [{ type: "attackBonus", modifierType: "circumstance", field: "", active: true, valueType: "number", value: "1", predicate: '[{"lte":["target:distance",30]}]' }]);
  const record = pc({ feats: [keen] });
  const target = (distance) => ({ token: { _id: "t", recordType: "npcs", effects: [], data: { level: 1, traits: [] } }, distance });
  assertIncludes("the target's distance is an atom", traitsFor(record, { targets: [target(25)] }), "target:distance:25");
  assert("within 30 feet: applies", lookup(record, ["attackBonus"], "", { targets: [target(25)] })[0]?.active, true);
  assert("40 feet away: doesn't", lookup(record, ["attackBonus"], "", { targets: [target(40)] })[0]?.active, false);
  assert("no target: unchanged (the comparison passes)", lookup(record, ["attackBonus"], "", {})[0]?.active, true);
  const savedToken = ctx.api.getToken;
  const savedDistance = ctx.api.getDistance;
  ctx.api.getToken = () => ({ _id: "me" });
  ctx.api.getDistance = () => 35;
  assertIncludes("a target without a distance is measured with api.getDistance", traitsFor(record, { target: { _id: "t", effects: [], data: {} } }), "target:distance:35");
  ctx.api.getToken = savedToken;
  ctx.api.getDistance = savedDistance;
}

// --- G4.5 granter atoms ------------------------------------------------------------

section("G4.5 parent:granter atoms (Crossblooded Evolution)");
{
  const notCrossblooded = '[{"not":"parent:granter:slug:crossblooded-evolution"}]';
  const bloodline = (grantedBy) => ({
    _id: `bl-${grantedBy || "own"}`,
    name: "Bloodline: Aberrant",
    recordType: "features",
    data: {
      level: 1,
      ...(grantedBy ? { grantedBy } : {}),
      proficiencies: [{ data: { name: "intimidation", rank: "1", predicate: notCrossblooded } }],
      modifiers: [{ data: { type: "rollOption", option: "feature:bloodline:tradition:occult", active: true, predicate: notCrossblooded } }],
    },
  });
  const sorcerer = (feature) => pc({ classes: [{ name: "Sorcerer", data: { hp: 6, features: [feature] } }] });
  const trained = (feature) => {
    const values = {};
    ctx.updateProficiencies(sorcerer(feature), values);
    return values["data.intimidation"];
  };
  assert("the sorcerer's own bloodline trains its skill", trained(bloodline(null)), "1");
  assert("granted by the Bloodline class feature: trained", trained(bloodline(["bloodline"])), "1");
  assert("granted by Crossblooded Evolution: not trained", trained(bloodline(["crossblooded-evolution"])), undefined);
  assert("granted further down the chain: not trained", trained(bloodline(["bloodline-draconic", "crossblooded-evolution"])), undefined);
  const options = (feature) => {
    const values = {};
    ctx.updateRollOptions(sorcerer(feature), values);
    return values["data.rollOptions"] || [];
  };
  assertIncludes("its tradition roll option", options(bloodline(null)), "feature:bloodline:tradition:occult");
  assertNotIncludes("not from Crossblooded Evolution", options(bloodline(["crossblooded-evolution"])), "feature:bloodline:tradition:occult");
  const other = { _id: "other", name: "Other", recordType: "features", data: { level: 1, modifiers: [{ data: { type: "rollOption", option: "other", active: true, predicate: '["parent:granter:slug:crossblooded-evolution"]' } }] } };
  const both = pc({ classes: [{ name: "Sorcerer", data: { hp: 6, features: [bloodline(["crossblooded-evolution"]), other] } }] });
  const values = {};
  ctx.updateRollOptions(both, values);
  assertNotIncludes("another feature doesn't see that granter", values["data.rollOptions"] || [], "other");

  // A choice records what granted the features it adds
  const option = { _id: "opt-diabolic", name: "Diabolic", data: { value: [{ _id: "f-diabolic", name: "Diabolic", recordType: "features", data: { level: 1 } }] } };
  const choice = { _id: "c1", name: "Dragon", data: { options: [option], choices: [] } };
  const draconic = { _id: "bl-draconic", name: "Bloodline: Draconic", recordType: "features", data: { level: 1, grantedBy: ["crossblooded-evolution"], choices: [choice] } };
  const record = pc({ classes: [{ name: "Sorcerer", data: { hp: 6, features: [draconic] } }] });
  let written = null;
  const saved = { showPrompt: ctx.api.showPrompt, setValues: ctx.api.setValues };
  ctx.api.showPrompt = (title, description, placeholder, options, query, callback) => callback(["opt-diabolic"]);
  ctx.api.setValues = (values) => {
    written = values;
  };
  ctx.promptForChoices(record, [{ feature: draconic, group: { name: "Class", dataPath: "data.classes.0.data.features" }, choiceObj: choice }], 0);
  Object.assign(ctx.api, saved);
  const added = (written?.["data.classes.0.data.features"] || []).find((f) => f.name === "Diabolic");
  assert("the chosen feature records its granters, nearest first", JSON.stringify(added?.data?.grantedBy), JSON.stringify(["bloodline-draconic", "crossblooded-evolution"]));

  // A choice on a feat (Kineticist Dedication's gate) adds the class feature
  const gateOption = { _id: "opt-fire", name: "Fire Gate", data: { value: [{ _id: "f-fire-gate", name: "Fire Gate", recordType: "features", data: { level: 1, type: "classfeature" } }] } };
  const gateChoice = { _id: "c2", name: "Gate", data: { options: [gateOption], choices: [] } };
  const dedication = { _id: "feat-kin", name: "Kineticist Dedication", recordType: "feats", data: { level: 2, choices: [gateChoice] } };
  const fighter = pc({ feats: [dedication], classes: [{ name: "Fighter", data: { hp: 10, features: [{ _id: "f-rs", name: "Reactive Strike", recordType: "features", data: { level: 1 } }] } }] });
  written = null;
  ctx.api.showPrompt = (title, description, placeholder, options, query, callback) => callback(["opt-fire"]);
  ctx.api.setValues = (values) => {
    written = values;
  };
  ctx.promptForChoices(fighter, [{ feature: dedication, group: { name: "Feats", dataPath: "data.feats" }, choiceObj: gateChoice }], 0);
  Object.assign(ctx.api, saved);
  assert("a feat's choice adds the picked class feature", (written?.["data.classes.0.data.features"] || []).map((f) => f.name).join(","), "Reactive Strike,Fire Gate");
  assert("and still records the choice on the feat", JSON.parse(written?.["data.feats"]?.[0]?.data?.choices?.[0]?.data?.choices?.[0] || "{}").name, "Fire Gate");
}

// --- G4.6 spell slot rank (Sorcerous Potency) -----------------------------------

section("G4.6 item:spell-slot and @spell.level (Sorcerous Potency)");
{
  const potency = feat("Sorcerous Potency", [
    { type: "spellDamageBonus", modifierType: "status", field: "", active: true, valueType: "number", value: "@spell.level", predicate: '["item:spell-slot"]' },
    { type: "healingBonus", modifierType: "status", field: "", active: true, valueType: "number", value: "@spell.level", predicate: '["item:spell-slot"]' },
  ]);
  const fireball = { _id: "s-fireball", name: "Fireball", recordType: "spells", data: { level: 3, traits: ["Fire"] } };
  const record = pc({
    feats: [potency],
    spells: [
      { _id: "e1", name: "Sorcerer", data: { type: "spontaneous", spells5: [fireball] } },
      { _id: "e2", name: "Focus", data: { type: "focus", spells3: [fireball] } },
      { _id: "e3", name: "Innate", data: { type: "innate", spells3: [fireball] } },
      { _id: "e4", name: "Wizard", data: { type: "prepared", cantrips: [{ ...fireball, data: { level: 1, traits: ["Cantrip"] } }] } },
    ],
  });
  const savedGet = ctx.api.getValueOnRecord;
  ctx.api.getValueOnRecord = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  assert("from a slot: rank cast at and spellSlot", JSON.stringify(ctx.getSpellCastContext(record, fireball, "data.spells.0.data.spells5.0")), JSON.stringify({ castRank: 5, spellSlot: true }));
  assert("a focus spell isn't from a slot", ctx.getSpellCastContext(record, fireball, "data.spells.1.data.spells3.0").spellSlot, false);
  assert("an innate spell isn't", ctx.getSpellCastContext(record, fireball, "data.spells.2.data.spells3.0").spellSlot, false);
  assert("a cantrip isn't", ctx.getSpellCastContext(record, fireball, "data.spells.3.data.cantrips.0").spellSlot, false);
  ctx.api.getValueOnRecord = savedGet;

  const fromSlot = lookup(record, ["spellDamageBonus"], "", { spell: fireball, castRank: 5, spellSlot: true })[0];
  assert("from a slot: status bonus equal to the rank cast at", `${fromSlot?.active}|${fromSlot?.value}|${fromSlot?.type}`, "true|5|status");
  const healing = lookup(record, ["healingBonus"], "", { spell: fireball, castRank: 4, spellSlot: true })[0];
  assert("healing too", `${healing?.active}|${healing?.value}`, "true|4");
  const focus = lookup(record, ["spellDamageBonus"], "", { spell: fireball, castRank: 3, spellSlot: false })[0];
  assert("not from a slot: doesn't apply", focus?.active, false);
  assert("and isn't offered", !!focus?.situational, false);
  assert("an old macro (no cast context): doesn't apply", lookup(record, ["spellDamageBonus"], "", { spell: fireball })[0]?.active, false);
  assert("@spell.level falls back to the spell's rank", ctx.checkForReplacements("@spell.level", {}, record, null, { spell: fireball }), "3");
  assert("@spell.rank is the same token", ctx.checkForReplacements("@spell.rank", {}, record, null, { spell: fireball, castRank: 6 }), "6");
  assert("no spell: left alone", ctx.checkForReplacements("@spell.level", {}, record, null, {}).includes("@spell"), true);
}

// --- G4.7 skill substitution (Chirurgeon) ------------------------------------------

section("G4.7 skill substitution (Chirurgeon: Crafting for Medicine)");
{
  const chirurgeon = { _id: "chir", name: "Chirurgeon", recordType: "features", data: { level: 1, proficiencies: [{ data: { name: "medicine", rank: "0", substituteSkill: "crafting" } }] } };
  const alchemist = (data = {}, features = [chirurgeon]) =>
    pc({ int: 4, wis: 1, crafting: "2", classes: [{ name: "Alchemist", data: { hp: 8, features } }], ...data });
  const recalc = (record) => {
    const values = {};
    ctx.updateProficiencies(record, values);
    return values;
  };
  const values = recalc(alchemist());
  assert("Medicine gets Crafting's rank", values["data.medicine"], "2");
  assert("and Crafting's modifier (Int 4 + expert 9)", values["data.medicineMod"], 13);
  assert("Crafting itself is unchanged", values["data.craftingMod"], 13);
  const wise = recalc(alchemist({ wis: 5 }));
  assert("a higher Medicine modifier is kept", wise["data.medicineMod"], 14);
  const trainedMedicine = recalc(alchemist({ medicine: "3" }));
  assert("a higher Medicine rank is kept", trainedMedicine["data.medicine"], undefined);
  const noFeature = recalc(alchemist({}, []));
  assert("without the feature Medicine is unchanged", `${noFeature["data.medicine"]}|${noFeature["data.medicineMod"]}`, "undefined|1");
}

process.exit(summary() > 0 ? 1 : 0);
