// Tests for feat automation support: degree-of-success worsening, math with
// min()/max(), number-valued resistances, AC and HP modifier fixes, persistent
// damage that honors its predicate, critical-hit-only damage riders, Foundry
// predicate atoms (item:base, target:*, skill ranks, armor), Foundry selectors
// as modifier fields, situational opt-in modifiers, weapon die and trait
// alterations, weapon dice tokens, other movement Speeds, senses, Dex caps,
// dying maximum and recovery DC modifiers, and save macro source traits.
// Engine group G2: flat persistent damage, damage source atoms, persistent
// recovery DC, Nine Lives recovery DC, rest healing, magical item healing,
// maximized healing dice, roll notes and Devastator's partial ignore.
// Engine group G3: weapon die-size, thrown-melee, material and deity
// favored-weapon atoms, weapon proficiency in item:proficiency:rank, and
// damage type and material changes for Strikes and spells.
// Engine group G5: size, languages and trait removal from a heritage, shared
// toggle groups, all-Speeds modifiers, AC against the attacker (Outwit),
// forced movement, climbing, reactions to movement (Blessed Swiftness), and
// Rage temporary HP with Superstition Instinct.
// Run: node tests/test-feat-automation.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
new vm.Script(fs.readFileSync(`${__dirname}/../rollhandlers/spells.js`, "utf8"), { filename: "spells.js" }).runInContext(ctx);

// --- helpers ----------------------------------------------------------------

// A feat carrying the given modifier data entries
const feat = (name, modifiers, extra = {}) => ({
  _id: `feat-${name}`,
  name,
  recordType: "feats",
  data: { type: "general", level: 1, modifiers: modifiers.map((data) => ({ data })), ...extra },
});

// A level 5 character with the given feats and inventory
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

const lookup = (record, types, field, context = {}) =>
  ctx.getEffectsAndModifiersForToken(record, types, field, undefined, undefined, context);
const traitsFor = (record, context = {}) => [...ctx.collectTraitsAndProperties(record, context)];
const names = (mods) => mods.map((m) => m.name);

// --- degree of success ------------------------------------------------------

section("degree of success adjustments");
{
  const adjust = (degree, mods) => {
    const record = pc({ feats: [feat("Adjuster", mods)] });
    const adjustments = ctx.getDegreeOfSuccessAdjustments(record, ["will"]);
    return ctx.applyDegreeOfSuccessAdjustment(degree, adjustments).degree;
  };
  const ads = (adjustment) => ({ type: "adjustDegreeOfSuccess", field: "will", adjustment });
  assert("one-degree-better still turns a success into a critical success", adjust(1, [ads({ success: "one-degree-better" })]), 2);
  assert("one-degree-worse now applies: failure -> critical failure", adjust(0, [ads({ failure: "one-degree-worse" })]), -1);
  assert("two-degrees-worse applies to all", adjust(1, [ads({ all: "two-degrees-worse" })]), -1);
  assert("to-success applies: failure -> success", adjust(0, [ads({ failure: "to-success" })]), 1);
  assert("to-success applies: critical failure -> success", adjust(-1, [ads({ criticalFailure: "to-success" })]), 1);
  assert("to-failure applies: critical failure -> failure", adjust(-1, [ads({ criticalFailure: "to-failure" })]), 0);
  assert("to-critical-failure applies", adjust(1, [ads({ success: "to-critical-failure" })]), -1);
  assert(
    "an improvement and a worsening both apply (net 0)",
    adjust(1, [ads({ success: "one-degree-better" }), ads({ success: "one-degree-worse" })]),
    1,
  );
  assert(
    "the specific degree wins over all",
    adjust(0, [ads({ all: "one-degree-better", failure: "two-degrees-better" })]),
    2,
  );
  assert("no adjustments leaves the degree", adjust(0, []), 0);
  // Old metadata (from rolls made before this change) only has value
  assert(
    "older metadata without worse still works",
    ctx.applyDegreeOfSuccessAdjustment(1, { all: { value: "none" }, success: { value: "one-degree-better", modifierName: "X" }, failure: { value: "none" }, criticalFailure: { value: "none" } }).degree,
    2,
  );
}

// --- math -----------------------------------------------------------------------

section("evaluateMath");
{
  assert("max with two arguments", ctx.evaluateMath("max(1,floor(ceil(3/2)/2))"), 1);
  assert("min with two arguments", ctx.evaluateMath("min(4, 2+3)"), 4);
  assert("plain arithmetic unchanged", ctx.evaluateMath("2*3+1"), 7);
  assert("letters are still rejected", ctx.evaluateMath("alert(1)"), 0);
  assert("braces with min() in a replacement", ctx.checkForReplacements("{min(5,@actor.level)}", {}, pc({ level: 8 })), "5");
}

// --- IWR, AC and HP --------------------------------------------------------------

section("resistance with a number value");
{
  const record = pc({ feats: [feat("Plant Shape", [{ type: "resistance", modifierType: "none", field: "poison", active: true, valueType: "number", value: "5" }])] });
  const iwr = ctx.getIWR(record);
  assert("a number value takes its type from the field", iwr.resistances?.poison?.value, 5);
  const stringRecord = pc({ feats: [feat("Elemental", [{ type: "resistance", modifierType: "none", field: "", active: true, valueType: "string", value: "fire 5" }])] });
  assert("a string value still works", ctx.getIWR(stringRecord).resistances?.fire?.value, 5);
}

section("AC modifier values");
{
  const acWith = (mods) => {
    const record = pc({ feats: [feat("Hide", mods)] });
    const written = {};
    ctx.updateAttribute({ record, attribute: "dex", value: 3, moreValuesToSet: written });
    return written["data.ac"];
  };
  const base = acWith([]);
  assert("a numeric AC bonus adds", acWith([{ type: "armorClassBonus", modifierType: "item", field: "", active: true, valueType: "number", value: "2" }]), base + 2);
  assert("a string AC bonus adds instead of concatenating", acWith([{ type: "armorClassBonus", modifierType: "item", field: "", active: true, valueType: "string", value: "{3}" }]), base + 3);
  assert("an AC bonus whose predicate fails adds nothing", acWith([{ type: "armorClassBonus", modifierType: "circumstance", field: "", valueType: "number", value: "2", predicate: '["never-set"]' }]), base);
  assert(
    "a dexCap modifier caps Dex to AC",
    acWith([{ type: "dexCap", active: true, valueType: "number", value: "1" }]),
    base - 2,
  );
}

section("HP modifiers honor their predicate");
{
  const hpWith = (mods) => {
    const record = pc({ feats: [feat("Hardy", mods)] });
    const written = {};
    ctx.updateAttribute({ record, attribute: "con", value: 1, moreValuesToSet: written });
    return written["data.hitpoints"];
  };
  const base = hpWith([]);
  assert("an always-on HP modifier adds", hpWith([{ type: "hitpoints", valueType: "string", value: "@actor.level", active: true }]), base + 5);
  assert("a failed predicate adds nothing", hpWith([{ type: "hitpoints", valueType: "string", value: "@actor.level", predicate: '["self:condition:drained"]' }]), base);
  assert("an opted-out modifier adds nothing", hpWith([{ type: "hitpoints", valueType: "number", value: "5", active: false }]), base);
}

// --- damage categories and critical riders -------------------------------------

section("persistent and splash damage honor active");
{
  const processed = ctx.processDamageModifierCategories([
    { name: "On", value: "1d4 fire-persistent", active: true },
    { name: "Off", value: "1d6 bleed-persistent", active: false },
    { name: "Crit", value: "1d4 mental-persistent", active: true, criticalOnly: true },
    { name: "Splash Off", value: "1d4 acid-splash", active: false },
  ]);
  assert("only the active persistent damage applies", processed.persistentDamage, "1d4 fire");
  assert("critical-only persistent damage is kept apart", processed.criticalPersistentDamage, "1d4 mental");
  assert("inactive splash is not applied", processed.splashDamage, "");
}

section("critical-hit-only damage riders");
{
  assert("dice for 2d6 fire", JSON.stringify(ctx.getCriticalOnlyDiceForValue("2d6 fire", "slashing")), JSON.stringify([{ dieType: 6, damageType: "fire" }, { dieType: 6, damageType: "fire" }]));
  assert("untyped dice take the weapon's type", ctx.getCriticalOnlyDiceForValue("1d8", "Slashing")[0].damageType, "slashing");

  const claws = weapon("Claw", { itemCategory: "unarmed", group: "brawling", traits: ["agile", "finesse", "unarmed"], damage: { dice: 1, die: "d6", damageType: "slashing" } });
  const accursed = feat("Accursed Claws", [{ type: "damageBonus", modifierType: "none", field: "", valueType: "string", value: "1d4 mental-persistent", critical: true, predicate: '["item:slug:claw"]' }]);
  const brutal = feat("Brutal Critical", [{ type: "damageBonus", modifierType: "none", field: "", valueType: "string", value: "1d@weaponDie", predicate: '["check:outcome:critical-success"]' }]);
  const record = pc({ feats: [accursed, brutal], inventory: [claws] });
  const attack = capturePrompt(() => ctx.performAttackRoll(record, claws, "data.inventory.0", 1)).metadata;
  const riders = (attack.damageModifiers || []).filter((m) => m.criticalOnly);
  assert("the check:outcome rider is carried as critical-only", names(riders).join(","), "Brutal Critical");
  assert("and active (the attack handler drops it on a non-crit)", riders[0]?.active, true);
  assert("its die resolved from the weapon", riders[0]?.value, "1d6");
  assert("the critical persistent damage is in the metadata", attack.criticalPersistentDamage, "1d4 mental");
  assert("and not in the normal persistent damage", attack.persistentDamage || "", "");

  const normal = capturePrompt(() => ctx.performDamageRoll(record, claws, "data.inventory.0", false));
  assertNotIncludes("a normal damage roll has no critical rider", names(normal.modifiers), "Brutal Critical");
  assert("and no critical persistent damage", normal.metadata.criticalPersistentDamage, "");
  const crit = capturePrompt(() => ctx.performDamageRoll(record, claws, "data.inventory.0", true));
  assertIncludes("a critical damage roll adds the rider", names(crit.modifiers), "Brutal Critical");
  assert("and the critical persistent damage", crit.metadata.criticalPersistentDamage, "1d4 mental");
  assert("the rider's die is critical-only (not doubled)", crit.metadata.criticalOnlyDice.some((d) => d.dieType === 6), true);

  // Unfailing Bow: damage on every hit but a critical one
  const unfailing = feat("Unfailing Bow", [{ type: "damageBonus", modifierType: "none", field: "", valueType: "string", value: "2", predicate: '[{"not":"check:outcome:critical-success"}]' }]);
  const bowRecord = pc({ feats: [unfailing], inventory: [claws] });
  const bowAttack = capturePrompt(() => ctx.performAttackRoll(bowRecord, claws, "data.inventory.0", 1)).metadata;
  const bowMod = (bowAttack.damageModifiers || []).find((m) => m.name === "Unfailing Bow");
  assert("a negated critical atom is not a critical rider", bowMod?.criticalOnly, undefined);
  assert("it is marked for every hit but a critical one", bowMod?.notOnCritical, true);
  assertIncludes("a normal damage roll adds it", names(capturePrompt(() => ctx.performDamageRoll(bowRecord, claws, "data.inventory.0", false)).modifiers), "Unfailing Bow");
  assertNotIncludes("a critical damage roll leaves it out", names(capturePrompt(() => ctx.performDamageRoll(bowRecord, claws, "data.inventory.0", true)).modifiers), "Unfailing Bow");
  assert("polarity: positive", JSON.stringify(ctx.getPredicateAtomPolarity('["check:outcome:failure"]', "check:outcome:failure")), '{"positive":true,"negated":false}');
  assert("polarity: under nor", JSON.stringify(ctx.getPredicateAtomPolarity({ nor: ["check:outcome:failure"] }, "check:outcome:failure")), '{"positive":false,"negated":true}');
  assert("polarity: not of not", JSON.stringify(ctx.getPredicateAtomPolarity({ not: { not: "x" } }, "x")), '{"positive":true,"negated":false}');
}

section("Foundry formula functions in converted macro code");
{
  // Stasian Smash's button: `${ternary(gte(level,18),2,1)}d4`
  assert("below 18th: 1d4", vm.runInContext("(level => `${ternary(gte(level,18),2,1)}d4`)(10)", ctx), "1d4");
  assert("at 18th: 2d4", vm.runInContext("(level => `${ternary(gte(level,18),2,1)}d4`)(18)", ctx), "2d4");
  assert("floor, ceil, max", vm.runInContext("[floor(7/2), ceil(7/2), max(1, '4', 2)].join()", ctx), "3,4,4");
}

section("adjustModifier keeps a damage value's type");
{
  assert("upgrade 2 precision to 3", ctx.adjustValueByMode("2 precision", "3 precision", "upgrade"), "3 precision");
  assert("upgrade with a bare number keeps the type", ctx.adjustValueByMode("2 precision", 3, "upgrade"), "3 precision");
  assert("a lower upgrade leaves it", ctx.adjustValueByMode("2 precision", "1", "upgrade"), "2 precision");
  assert("downgrade", ctx.adjustValueByMode(4, 2, "downgrade"), 2);
  assert("add keeps the type", ctx.adjustValueByMode("1 fire", 2, "add"), "3 fire");
  assert("override with a typed value", ctx.adjustValueByMode("1d6", "2d6 fire", "override"), "2d6 fire");
  assert("numbers stay numbers", ctx.adjustValueByMode(2, "3", "upgrade"), 3);
  const slinger = feat("Slinger's Precision", [
    { type: "damageBonus", modifierType: "", field: "", valueType: "string", value: "2 precision", slug: "slingers-precision-crossbow" },
    { type: "adjustModifier", targetSlug: "slingers-precision-crossbow", value: "3 precision", valueType: "string", adjustMode: "upgrade" },
  ]);
  const mod = ctx.getEffectsAndModifiersForToken(pc({ feats: [slinger] }), ["damageBonus"], "").find((m) => m.slug === "slingers-precision-crossbow");
  assert("a feature's adjustModifier upgrade keeps precision", mod?.value, "3 precision");
}

section("penalties whose tokens resolve to negative numbers");
{
  const realGet = ctx.api.getValueOnRecord;
  ctx.api.getValueOnRecord = (rec, path) => path.split(".").reduce((o, k) => o?.[k], rec);
  try {
    const dread = feat("Dread", [{ type: "savePenalty", modifierType: "status", field: "will", valueType: "number", value: "@record.data.effects.dread" }]);
    const record = pc({ feats: [dread], effects: { dread: -2 } });
    const mod = ctx.getEffectsAndModifiersForToken(record, ["savePenalty"], "will").find((m) => m.name === "Dread");
    assert("a token resolving to -2 is a 2 penalty, not 0", String(mod?.value), "-2");
    const plain = pc({ feats: [dread], effects: { dread: 3 } });
    assert("a positive token is still a penalty", String(ctx.getEffectsAndModifiersForToken(plain, ["savePenalty"], "will").find((m) => m.name === "Dread")?.value), "-3");
    const token = { ...pc({ effects: { chill: -1 } }), effects: [{ _id: "e-chill", name: "Arctic", rules: [{ type: "skillPenalty-circumstance", field: "acrobatics", valueType: "number", value: "@record.data.effects.chill" }] }] };
    assert("an effect rule does the same", String(ctx.getEffectsAndModifiersForToken(token, ["skillPenalty"], "acrobatics").find((m) => m.name === "Arctic")?.value), "-1");
    assert("asPenaltyValue keeps a formula", ctx.asPenaltyValue("1d4"), "-1d4");
  } finally {
    ctx.api.getValueOnRecord = realGet;
  }
}

section("roll options from choices feed rollOption modifiers");
{
  const gate = feat("Fire Gate", [{ type: "rollOption", option: "fire-gate-junction", predicate: '["junction:fire:skill"]' }], {
    choices: [{ data: { rollOption: "junction:fire", choices: [JSON.stringify({ _id: "x", name: "Skill", selectedRollOption: "junction:fire:skill" })] } }],
  });
  const values = {};
  ctx.updateRollOptions(pc({ feats: [gate] }), values);
  assertIncludes("the choice's own roll option is stored", values["data.rollOptions"] || [], "junction:fire:skill");
  assertIncludes("a rollOption modifier gated on it fires", values["data.rollOptions"] || [], "fire-gate-junction");
}

section("Elemental Blast (Rage of Elements pg. 15)");
{
  const blastAt = (level, attackType, actions) => {
    const record = pc({ level, str: 3, con: 4, classDC: 20, flags: { element: "fire" } });
    const answers = [attackType, actions];
    const saved = { getToken: ctx.api.getToken, showPrompt: ctx.api.showPrompt, roll: ctx.performAttackRoll };
    let weapon = null;
    ctx.api.getToken = () => record;
    ctx.api.showPrompt = (title, text, placeholder, options, value, callback) => callback([answers.length ? answers.shift() : options[0].value]);
    ctx.performAttackRoll = (rec, w) => (weapon = w);
    try {
      ctx.elementalBlast();
    } finally {
      ctx.api.getToken = saved.getToken;
      ctx.api.showPrompt = saved.showPrompt;
      ctx.performAttackRoll = saved.roll;
    }
    return weapon;
  };
  const extra = (w, name) => (w.data.extraDamageModifiers || []).find((m) => m.name === name);
  assert("1 die at 4th level", blastAt(4, "ranged", "1").data.damageRolls[0].data.formula, "1d6");
  assert("2 dice at 5th level", blastAt(5, "ranged", "1").data.damageRolls[0].data.formula, "2d6");
  assert("5 dice at 17th level", blastAt(17, "ranged", "1").data.damageRolls[0].data.formula, "5d6");
  const melee = blastAt(5, "melee", "2");
  assert("melee: Strength is not added to the attack", melee.data.bonus, 10);
  assert("melee: Strength adds to damage (strengthToDamage)", melee.data.strengthToDamage, true);
  assert("2 actions: Constitution as a status bonus to damage", [extra(melee, "Elemental Blast (2 actions)")?.value, extra(melee, "Elemental Blast (2 actions)")?.type], [4, "status"]);
  assert("no flat modifier left on the damage roll", melee.data.damageRolls[0].data.modifier, undefined);
  const ranged = blastAt(5, "ranged", "1");
  assert("ranged 1-action: no Strength or Constitution", [ranged.data.strengthToDamage, (ranged.data.extraDamageModifiers || []).length], [false, 0]);
  // The attack's damage rows: one ticked Strength for melee, none for ranged
  const rows = (w) => (capturePrompt(() => saved_performAttackRoll(pc({ level: 5, str: 3, con: 4, classDC: 20 }), w, null)).metadata.damageModifiers || []).filter((m) => /Strength/.test(m.name));
  const saved_performAttackRoll = ctx.performAttackRoll;
  assert("melee blast: one ticked Strength row", rows(melee).map((m) => `${m.value}:${m.active}`).join(), "3:true");
  assert("ranged blast: no Strength row", rows(ranged).length, 0);
}

// --- Foundry atoms ----------------------------------------------------------------

section("Foundry item atoms");
{
  const bow = weapon("+1 Striking Flaming Longbow", { group: "bow", range: 100, usage: "held-in-one-plus-hands", runes: { potency: 1, striking: 1, property: ["Flaming"] } });
  const traits = traitsFor(pc(), { weapon: bow });
  assertIncludes("item:base strips runes", traits, "item:base:longbow");
  assertIncludes("item:slug is the full name", traits, "item:slug:1-striking-flaming-longbow");
  assertIncludes("item:type:weapon", traits, "item:type:weapon");
  assertIncludes("item:hands-held from usage", traits, "item:hands-held:1");
  const staff = weapon("Staff", { group: "club", usage: "held-in-one-plus-hands", carried: "equipped", handBtn: "two" });
  assertIncludes("item:hands-held:2 for a 1+ weapon gripped in two hands", traitsFor(pc(), { weapon: staff }), "item:hands-held:2");
  assertIncludes("its usage atom stays 1", traitsFor(pc(), { weapon: staff }), "item:usage:hands:1");
  assertNotIncludes("a stowed weapon holds no hands", traitsFor(pc(), { weapon: { ...staff, data: { ...staff.data, carried: "carried" } } }), "item:hands-held:1");
  assertIncludes("item:magical with runes", traits, "item:magical");
  const greataxe = traitsFor(pc(), { weapon: weapon("Greataxe", { usage: "held-in-two-hands" }) });
  assertIncludes("two-handed usage", greataxe, "item:usage:hands:2");
  assert("getBaseItemSlug", ctx.getBaseItemSlug({ name: "+2 Greater Striking Shortsword", data: {} }), "shortsword");
}

section("skill rank and armor atoms");
{
  const record = pc({ athletics: "3", medicine: "1", loreSkills: [{ name: "Sailing Lore", data: { rank: "2" } }] });
  const traits = traitsFor(record, { statistic: "athletics" });
  assertIncludes("skill:athletics:rank:3", traits, "skill:athletics:rank:3");
  assertIncludes("lore skill ranks", traits, "skill:sailing-lore:rank:2");
  assertIncludes("the statistic rolled", traits, "check:statistic:athletics");
  assertIncludes("proficiency of the statistic", traits, "proficiency:master");
  const set = ctx.collectTraitsAndProperties(record, {});
  assert("gte skill rank resolves", ctx.evaluateEffectPredicate({ gte: ["skill:athletics:rank", 2] }, set, record, {}), true);
  assert("gte skill rank fails below", ctx.evaluateEffectPredicate({ gte: ["skill:medicine:rank", 2] }, set, record, {}), false);
  assertIncludes("unarmored", traits, "self:armor:category:unarmored");
  const armored = pc({ inventory: [{ _id: "a", name: "Chain Mail", data: { type: "armor", carried: "equipped", acBonus: 4, dexCap: 1, itemCategory: "Medium" } }] });
  const armoredTraits = traitsFor(armored);
  assertIncludes("self:armored in armor", armoredTraits, "self:armored");
  assertIncludes("armor category", armoredTraits, "self:armor:category:medium");
}

section("target atoms");
{
  const undead = { token: { _id: "t", recordType: "npcs", effects: [{ name: "Off-Guard" }], data: { level: 3, traits: ["Undead", "Zombie"] } }, distance: 5 };
  const traits = traitsFor(pc(), { weapon: weapon("Longsword"), targets: [undead] });
  assertIncludes("target trait", traits, "target:trait:undead");
  assertIncludes("target condition", traits, "target:condition:off-guard");
  assertIncludes("target level", traits, "target:level:3");
  assertIncludes("melee range increment 1", traits, "target:range-increment:1");
  const two = traitsFor(pc(), { weapon: weapon("Longsword"), targets: [undead, undead] });
  assertNotIncludes("with two targets no per-target trait", two, "target:trait:undead");
}

// --- selectors and situational opt-ins ------------------------------------------

section("Foundry selectors as fields");
{
  const record = pc({
    feats: [
      feat("Iron Will", [{ type: "saveBonus", modifierType: "circumstance", field: "saving-throw", active: true, valueType: "number", value: "1" }]),
      feat("Skilled", [{ type: "skillBonus", modifierType: "circumstance", field: "skill-check", active: true, valueType: "number", value: "1" }]),
    ],
  });
  assertIncludes("saving-throw applies to a Will save", names(capturePrompt(() => ctx.rollSave(record, "will")).modifiers), "Iron Will");
  assertIncludes("skill-check applies to Athletics", names(capturePrompt(() => ctx.rollSkill(record, "athletics")).modifiers), "Skilled");
  assertNotIncludes("skill-check does not apply to Perception", names(capturePrompt(() => ctx.rollSkill(record, "perception")).modifiers), "Skilled");

  const fist = weapon("Fist", { itemCategory: "unarmed", group: "brawling", traits: ["agile", "finesse", "nonlethal", "unarmed"], damage: { dice: 1, die: "d4", damageType: "bludgeoning" } });
  const brawler = pc({
    feats: [
      feat("Brawler", [{ type: "damageBonus", modifierType: "none", field: "unarmed", active: true, valueType: "number", value: "2" }]),
      feat("Aim", [{ type: "attackBonus", modifierType: "circumstance", field: "attack-roll", active: true, valueType: "number", value: "1" }]),
    ],
    inventory: [fist],
  });
  const attack = capturePrompt(() => ctx.performAttackRoll(brawler, fist, "data.inventory.0", 1));
  assertIncludes("damage field unarmed now applies to unarmed Strikes", names(attack.metadata.damageModifiers || []), "Brawler");
  assertIncludes("attack-roll applies to Strikes", names(attack.modifiers), "Aim");
}

section("situational modifiers become opt-ins");
{
  const glare = feat("Intimidating Glare", [{ type: "skillBonus", modifierType: "circumstance", field: "intimidation", valueType: "number", value: "1", predicate: '["action:demoralize"]' }]);
  const record = pc({ feats: [glare] });
  const plain = capturePrompt(() => ctx.rollSkill(record, "intimidation")).modifiers.find((m) => m.name.startsWith("Intimidating Glare"));
  assert("offered without an action, labelled with it", plain?.name, "Intimidating Glare (Demoralize)");
  assert("but not ticked", plain?.active, false);
  const withAction = capturePrompt(() => ctx.rollSkill(record, "intimidation", null, false, 0, 1, "int", false, false, undefined, { action: "Demoralize" })).modifiers.find((m) => m.name.startsWith("Intimidating Glare"));
  assert("with the action it applies", withAction?.active, true);
  const otherAction = capturePrompt(() => ctx.rollSkill(record, "intimidation", null, false, 0, 1, "int", false, false, undefined, { action: "Coerce" })).modifiers.find((m) => m.name.startsWith("Intimidating Glare"));
  assert("with a different action: unticked and not relabelled", `${otherAction?.name}|${otherAction?.active}`, "Intimidating Glare|false");

  const bravery = feat("Bravery", [{ type: "saveBonus", modifierType: "circumstance", field: "will", valueType: "number", value: "1", predicate: '["fear"]' }]);
  const brave = pc({ feats: [bravery] });
  const unknown = capturePrompt(() => ctx.rollSave(brave, "will")).modifiers.find((m) => m.name.startsWith("Bravery"));
  assert("a save with no source: opt-in vs fear", `${unknown?.name}|${unknown?.active}`, "Bravery (vs fear)|false");
  const fear = capturePrompt(() => ctx.rollSave(brave, "will", 20, true, false, { traits: ["Emotion", "Fear", "Mental"] })).modifiers.find((m) => m.name.startsWith("Bravery"));
  assert("a fear spell's save applies it", fear?.active, true);
  const fire = capturePrompt(() => ctx.rollSave(brave, "will", 20, true, false, { traits: ["Fire"] })).modifiers.find((m) => m.name.startsWith("Bravery"));
  assert("a non-fear source: unticked and not relabelled", `${fire?.name}|${fire?.active}`, "Bravery|false");
  // An older spell save button passes no traits: still offered as an opt-in
  const oldButton = capturePrompt(() => ctx.rollSave(brave, "will", 20, true, false)).modifiers.find((m) => m.name.startsWith("Bravery"));
  assert("an old spell save button keeps the opt-in", oldButton?.active, false);

  const slayer = feat("Undead Slayer", [{ type: "damageBonus", modifierType: "none", field: "", valueType: "string", value: "1d6 vitality", predicate: '["target:trait:undead"]' }]);
  const swordsman = pc({ feats: [slayer], inventory: [weapon("Longsword")] });
  const noTarget = capturePrompt(() => ctx.performAttackRoll(swordsman, swordsman.data.inventory[0], "data.inventory.0", 1)).metadata.damageModifiers || [];
  assert("no target: opt-in vs undead", noTarget.find((m) => m.name.startsWith("Undead Slayer"))?.name, "Undead Slayer (vs undead)");
  const realTargets = ctx.api.getTargets;
  ctx.api.getTargets = () => [{ token: { _id: "z", recordType: "npcs", effects: [], data: { ac: 15, level: 1, traits: ["Undead"] } }, distance: 5 }];
  const undeadTarget = capturePrompt(() => ctx.performAttackRoll(swordsman, swordsman.data.inventory[0], "data.inventory.0", 1)).metadata.damageModifiers || [];
  assert("an undead target applies it", undeadTarget.find((m) => m.name === "Undead Slayer")?.active, true);
  ctx.api.getTargets = () => [{ token: { _id: "g", recordType: "npcs", effects: [], data: { ac: 15, level: 1, traits: ["Humanoid"] } }, distance: 5 }];
  const livingTarget = capturePrompt(() => ctx.performAttackRoll(swordsman, swordsman.data.inventory[0], "data.inventory.0", 1)).metadata.damageModifiers || [];
  const living = livingTarget.find((m) => m.name.startsWith("Undead Slayer"));
  assert("a living target: unticked and not relabelled", `${living?.name}|${living?.active}`, "Undead Slayer|false");
  ctx.api.getTargets = realTargets;

  // Sheet values (HP, AC) don't become opt-ins
  const hp = lookup(pc({ feats: [feat("X", [{ type: "hitpoints", valueType: "number", value: "5", predicate: '["action:rest"]' }])] }), ["hitpoints"]);
  assert("HP modifiers are not relabelled", hp[0]?.situational, undefined);
}

// --- weapon alterations and tokens ---------------------------------------------

section("weapon die size and trait modifiers");
{
  const jaws = weapon("Jaws", { itemCategory: "unarmed", group: "brawling", traits: ["unarmed"], damage: { dice: 1, die: "d4", damageType: "piercing" } });
  const fist = weapon("Fist", { itemCategory: "unarmed", group: "brawling", traits: ["agile", "unarmed"], damage: { dice: 1, die: "d4", damageType: "bludgeoning" } });
  const incisors = feat("Vicious Incisors", [
    { type: "weaponDieSize", value: "d6", predicate: '["item:slug:jaws"]' },
    { type: "weaponTrait", value: "backstabber", predicate: '["item:slug:jaws"]' },
  ]);
  const record = pc({ feats: [incisors], inventory: [jaws, fist] });
  const alteredJaws = ctx.getAlteredWeapon(record, jaws);
  assert("Jaws die becomes d6", alteredJaws.data.damage.die, "d6");
  assertIncludes("Jaws gains backstabber", alteredJaws.data.traits, "backstabber");
  assert("the stored weapon is untouched", jaws.data.damage.die, "d4");
  assert("Fist is unchanged", ctx.getAlteredWeapon(record, fist).data.damage.die, "d4");
  const damage = capturePrompt(() => ctx.performDamageRoll(record, jaws, "data.inventory.0", false)).dice;
  assert("the damage roll uses d6", /1d6/.test(damage), true);

  const stepper = pc({ feats: [feat("Crunch", [{ type: "weaponDieSize", value: "upgrade", predicate: '["item:slug:jaws"]' }])] });
  assert("upgrade steps d4 -> d6", ctx.getAlteredWeapon(stepper, jaws).data.damage.die, "d6");
  const remover = pc({ feats: [feat("Lethal", [{ type: "weaponTrait", value: "-agile" }])] });
  assertNotIncludes("a trait can be removed", ctx.getAlteredWeapon(remover, fist).data.traits, "agile");
}

section("weapon dice tokens");
{
  const sword = weapon("Longsword", { runes: { potency: 1, striking: 2, property: [] } });
  const record = pc();
  assert("@weaponDiceCount counts striking runes", ctx.checkForReplacements("@weaponDiceCount", {}, record, null, { weapon: sword }), "3");
  assert("@weapon.system.damage.dice", ctx.checkForReplacements("@weapon.system.damage.dice", {}, record, null, { weapon: sword }), "3");
  assert("1@weaponDie means one die", ctx.checkForReplacements("1@weaponDie", {}, record, null, { weapon: sword }), "1d8");
  assert("1d@weaponDie unchanged", ctx.checkForReplacements("1d@weaponDie", {}, record, null, { weapon: sword }), "1d8");
  assert(
    "ternary(...)@weaponDie means that many dice",
    ctx.checkForReplacements("ternary(gte(@actor.level,4),2,1)@weaponDie", {}, record, null, { weapon: sword }),
    "2d8",
  );
}

// --- speeds, senses, dying --------------------------------------------------------

section("other movement Speeds");
{
  const speedWith = (mods) => {
    const record = pc({ feats: [feat("Mover", mods)] });
    const written = {};
    ctx.updateAttribute({ record, attribute: "str", value: 2, moreValuesToSet: written });
    return written["data.speed"] ?? record.data.speed;
  };
  assert("a climb Speed is listed", speedWith([{ type: "speed", field: "climb", value: "20" }]), "25 feet, climb 20 feet");
  assert("equal to land Speed", speedWith([{ type: "speed", field: "swim", value: "land" }]), "25 feet, swim 25 feet");
  assert(
    "a speedBonus with a fly field does not raise land Speed",
    speedWith([{ type: "speedBonus", modifierType: "status", field: "fly", active: true, valueType: "number", value: "10" }]),
    "25 feet",
  );
  assert(
    "a speedBonus with no field still raises land Speed",
    speedWith([{ type: "speedBonus", modifierType: "status", field: "", active: true, valueType: "number", value: "5" }]),
    "30 feet",
  );
  assert(
    "a speedBonus adds to a granted climb Speed",
    speedWith([{ type: "speed", field: "climb", value: "20" }, { type: "speedBonus", modifierType: "circumstance", field: "climb", active: true, valueType: "number", value: "5" }]),
    "25 feet, climb 25 feet",
  );
  assert("a failed predicate grants no Speed", speedWith([{ type: "speed", field: "fly", value: "20", predicate: '["self:effect:wings"]' }]), "25 feet");
}

section("senses follow their predicate");
{
  const sensesFor = (record) => {
    const saved = ctx.api.setValuesOnRecord;
    let written = {};
    ctx.api.setValuesOnRecord = (rec, values) => Object.assign(written, values);
    try {
      ctx.onAddEditFeature(record, undefined, true);
    } finally {
      ctx.api.setValuesOnRecord = saved;
    }
    return written;
  };
  const vision = (predicate) => feat("Acute Vision", [{ type: "sense", value: "Darkvision", ...(predicate ? { predicate } : {}) }]);
  const always = sensesFor(pc({ senses: "Low-Light Vision", feats: [vision()] }));
  assert("an always-on sense is added (Darkvision replaces Low-Light)", always["data.senses"], "Darkvision");
  const raging = sensesFor(pc({ senses: "", feats: [vision('["self:effect:rage"]')] }));
  assert("a sense whose predicate fails is not added", raging["data.senses"] ?? "", "");
  // Removing the feat later takes the sense away again
  const computed = pc({ senses: "Darkvision", baseSenses: "", computedSenses: "Darkvision", feats: [] });
  assert("a computed sense goes away with its feat", sensesFor(computed)["data.senses"], "");
  const handEdited = pc({ senses: "Scent (imprecise) 30 feet", baseSenses: "", computedSenses: "Darkvision", feats: [] });
  assert("a hand-edited senses value is kept", sensesFor(handEdited)["data.senses"] ?? handEdited.data.senses, "Scent (imprecise) 30 feet");
}

section("dying maximum and recovery DC modifiers");
{
  const creature = (feats) => ({ ...pc({ feats }), data: { ...pc({ feats }).data, dying: 2 } });
  assert("default death threshold 4", ctx.getDeathThreshold(creature([])), 4);
  assert("Diehard by name still works", ctx.getDeathThreshold(creature([feat("Diehard", [])])), 5);
  assert("a dyingMax modifier raises it", ctx.getDeathThreshold(creature([feat("Undying", [{ type: "dyingMax", value: "5" }])])), 5);
  assert("recovery DC 10 + dying", ctx.getRecoveryCheckDC(creature([])), 12);
  assert("Toughness by name still works", ctx.getRecoveryCheckDC(creature([feat("Toughness", [])])), 11);
  assert("a recoveryDC modifier lowers it", ctx.getRecoveryCheckDC(creature([feat("Mountain's Stoutness", [{ type: "recoveryDC", value: "-1" }])])), 11);
  assert("the strongest reduction applies, not both", ctx.getRecoveryCheckDC(creature([feat("Toughness", []), feat("Mountain's Stoutness", [{ type: "recoveryDC", value: "-1" }])])), 11);
}

// --- save macros ------------------------------------------------------------------

section("save macros carry the source's traits");
{
  const oldStyle = ctx.getSaveMacro("will", 20, true, true);
  assert("without traits the macro is unchanged", /rollSave\(token, 'will', 20, true, true\);/.test(oldStyle), true);
  const withTraits = ctx.getSaveMacro("will", 20, true, true, ["Common", "Emotion", "Fear"]);
  assert("with traits they are passed (rarity dropped)", withTraits.includes('rollSave(token, \'will\', 20, true, true, {"traits":["Emotion","Fear"]});'), true);
  // The generated macro code runs
  let rolled = null;
  const savedRollSave = ctx.rollSave;
  ctx.rollSave = (...args) => {
    rolled = args;
  };
  ctx.api.getSelectedOrDroppedToken = () => [{ _id: "x" }];
  const code = withTraits.split("\n").slice(1, -1).join("\n");
  new vm.Script(code).runInContext(ctx);
  ctx.rollSave = savedRollSave;
  ctx.api.getSelectedOrDroppedToken = () => [];
  assert("the macro passes the traits to rollSave", JSON.stringify(rolled?.[5]), JSON.stringify({ traits: ["Emotion", "Fear"] }));
}

section("smaller engine fixes");
{
  // Foundry's ability/proficiency types stay dropped: imported values of
  // those types (e.g. "@actor.level + clamp(...)") would break rolls
  const kept = ctx.keepStrongestPerType([
    { name: "A", type: "proficiency", value: 3 },
    { name: "C", type: "ability", value: 2 },
    { name: "D", type: "", value: 1 },
  ]);
  assert("proficiency and ability types are left out", kept.map((m) => m.name).join(","), "D");

  // A critical specialization predicate written as an object now evaluates
  const sword = weapon("Longsword");
  const critSpec = (predicate) => ctx.hasCriticalSpecializationEffect(pc({ feats: [feat("Spec", [{ type: "criticalSpecialization", predicate }])] }), sword, false);
  assert("object predicate that matches", critSpec('{"or":["item:group:sword","item:group:axe"]}'), true);
  assert("object predicate that does not match", critSpec('{"or":["item:group:bow","item:group:axe"]}'), false);

  // Toggles on bonus feats are listed
  const toggleFeat = { ...feat("Rage Toggle", []), data: { type: "class", level: 1, toggleable: true, predicateValue: "rage-toggle" } };
  const written = {};
  ctx.updateTogglesList({ ...pc(), data: { ...pc().data, bonusFeats: [toggleFeat] } }, written);
  assert("a bonus feat's toggle is listed", (written["data.toggles"] || []).some((t) => t.data?.predicateValue === "rage-toggle"), true);

  // MAP reduction "1/2": second attack -1, third -2
  const agile = weapon("Shortsword", { traits: ["agile", "finesse"] });
  const grace = pc({ feats: [feat("Agile Grace", [{ type: "mapReduction", field: "attack", active: true, valueType: "string", value: "1/2", predicate: '["item:trait:agile"]' }])], inventory: [agile] });
  const reduce = (n) => capturePrompt(() => ctx.performAttackRoll(grace, agile, "data.inventory.0", n)).modifiers.find((m) => m.name.includes("Reduce MAP"))?.value;
  assert("second attack reduced by 1", reduce(2), 1);
  assert("third attack reduced by 2", reduce(3), 2);
}

section("off-guard targets: backstabber and off-guard predicates");
{
  const dagger = weapon("Dagger", { traits: ["agile", "finesse", "backstabber"], group: "knife", damage: { dice: 1, die: "d4", damageType: "piercing" } });
  const ambush = feat("Ambush", [{ type: "damageBonus", modifierType: "circumstance", field: "", valueType: "number", value: "2", predicate: '["target:condition:off-guard"]' }]);
  const rogue = pc({ feats: [ambush], inventory: [dagger] });
  const realTargets = ctx.api.getTargets;
  const realOther = ctx.api.getOtherTokens;
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [{ name: "Off-Guard", rules: [] }], data: { ac: 15, level: 1, traits: [] } }, distance: 5 }];
  ctx.api.getOtherTokens = () => [];
  const mods = capturePrompt(() => ctx.performAttackRoll(rogue, dagger, "data.inventory.0", 1)).metadata.damageModifiers || [];
  const backstab = mods.find((m) => m.name === "Backstabber");
  assert("backstabber adds 1 precision vs an off-guard target", `${backstab?.value}|${backstab?.precisionDamage}`, "1|true");
  assert("an off-guard predicate applies", mods.find((m) => m.name.startsWith("Ambush"))?.active, true);
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [], data: { ac: 15, level: 1, traits: [] } }, distance: 5 }];
  const calm = capturePrompt(() => ctx.performAttackRoll(rogue, dagger, "data.inventory.0", 1)).metadata.damageModifiers || [];
  assert("no backstabber vs a target that isn't off-guard", calm.some((m) => m.name === "Backstabber"), false);
  ctx.api.getTargets = realTargets;
  ctx.api.getOtherTokens = realOther;
}

section("Treat Wounds and First Aid pass their action");
{
  const surgeon = pc({
    medicine: "2",
    feats: [
      feat("Risky Surgery", [{ type: "adjustDegreeOfSuccess", field: "medicine", adjustment: { success: "one-degree-better" }, predicate: '["action:treat-wounds"]' }]),
      feat("Steady Hands", [{ type: "skillBonus", modifierType: "circumstance", field: "medicine", valueType: "number", value: "1", predicate: '["action:administer-first-aid"]' }]),
    ],
  });
  const firstAid = ctx.getMedicineCheckModifiers(surgeon).modifiers.find((m) => m.name.startsWith("Steady Hands"));
  assert("a First Aid bonus applies on First Aid", firstAid?.active, true);
  const context = ctx.getRollSourceContext({ action: "Treat Wounds" }, "medicine");
  const adjustments = ctx.getDegreeOfSuccessAdjustments(surgeon, ["medicine", "skill-check", "wis"], undefined, undefined, context);
  assert("a Treat Wounds degree adjustment applies with the action", adjustments.success.value, "one-degree-better");
}

section("lore ranks and resolved labels");
{
  const sailor = pc({ loreSkills: [{ name: "Sailing Lore", data: { rank: "2" } }] });
  const traits = traitsFor(sailor, { statistic: "Sailing Lore" });
  assertIncludes("a Lore roll's proficiency comes from its entry", traits, "proficiency:expert");
  const guide = pc({
    flags: { terrain: "Aquatic" },
    feats: [feat("Terrain Expertise", [{ type: "skillBonus", modifierType: "circumstance", field: "survival", valueType: "number", value: "1", predicate: '["terrain:@record.data.flags.terrain"]' }])],
  });
  const realGet = ctx.api.getValueOnRecord;
  ctx.api.getValueOnRecord = (rec, path) => path.split(".").reduce((o, k) => o?.[k], rec);
  const mod = capturePrompt(() => ctx.rollSkill(guide, "survival")).modifiers.find((m) => m.name.startsWith("Terrain Expertise"));
  ctx.api.getValueOnRecord = realGet;
  assert("the label shows the chosen terrain", mod?.name, "Terrain Expertise (aquatic terrain)");
}

section("engine gaps closed: backstabber slug, half Speed, condition values, range, off-guard, runes");
{
  const realTargets = ctx.api.getTargets;
  const realOther = ctx.api.getOtherTokens;
  ctx.api.getOtherTokens = () => [];
  const frightened2 = { _id: "f", name: "Frightened", rules: [] };
  const scaredTarget = { token: { _id: "t", recordType: "npcs", effects: [frightened2], effectIds: ["f", "f"], data: { ac: 15, level: 1, traits: ["Incorporeal"] } }, distance: 5 };

  // Expert Backstabber: adjustModifier on the backstabber slug
  const dagger = weapon("Dagger", { traits: ["agile", "finesse", "backstabber"], group: "knife", damage: { dice: 1, die: "d4", damageType: "piercing" } });
  const expert = pc({ feats: [feat("Expert Backstabber", [{ type: "adjustModifier", targetSlug: "backstabber", adjustMode: "override", value: "2", valueType: "number", active: true, field: "" }])], inventory: [dagger] });
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [{ _id: "og", name: "Off-Guard", rules: [] }], effectIds: ["og"], data: { ac: 15, level: 1, traits: [] } }, distance: 5 }];
  const stab = (capturePrompt(() => ctx.performAttackRoll(expert, dagger, "data.inventory.0", 1)).metadata.damageModifiers || []).find((m) => m.name === "Backstabber");
  assert("Expert Backstabber raises backstabber to 2", stab?.value, "2");

  // Fearsome Brute: double the target's frightened value
  ctx.api.getTargets = () => [scaredTarget];
  const brute = pc({ feats: [feat("Fearsome Brute", [{ type: "damageBonus", modifierType: "circumstance", field: "strike-damage", valueType: "string", value: "{2*@target.condition.frightened}", predicate: '["target:condition:frightened"]' }])], inventory: [weapon("Longsword")] });
  const fb = (capturePrompt(() => ctx.performAttackRoll(brute, brute.data.inventory[0], "data.inventory.0", 1)).metadata.damageModifiers || []).find((m) => m.name === "Fearsome Brute");
  assert("Fearsome Brute: 2 x frightened 2 = 4", `${fb?.value}|${fb?.active}`, "4|true");
  assertIncludes("frightened value atom", traitsFor(brute, { targets: [scaredTarget] }), "target:condition:frightened:2");

  // Dread Striker: a frightened target is off-guard to you (AC -2)
  const striker = pc({ feats: [feat("Dread Striker", [{ type: "offGuardTarget", active: true, predicate: '["target:condition:frightened"]' }])], inventory: [weapon("Longsword")] });
  const dread = capturePrompt(() => ctx.performAttackRoll(striker, striker.data.inventory[0], "data.inventory.0", 1)).metadata;
  const plain = capturePrompt(() => ctx.performAttackRoll(pc({ inventory: [weapon("Longsword")] }), weapon("Longsword"), "data.inventory.0", 1)).metadata;
  assert("Dread Striker: the target is off-guard", dread.isOffGuard, true);
  assert("and its AC is 2 lower", plain.dc - dread.dc, 2);

  // Ghost Hunter: ghost touch vs an incorporeal target
  const hunter = pc({ feats: [feat("Ghost Hunter", [{ type: "weaponRune", value: "Ghost Touch", predicate: '["target:trait:incorporeal","item:magical"]' }])] });
  const magicSword = weapon("+1 Longsword", { runes: { potency: 1, striking: 0, property: [] } });
  assertIncludes("Ghost Hunter adds ghost touch vs incorporeal", ctx.getAlteredWeapon(hunter, magicSword).data.runes.property, "Ghost Touch");
  ctx.api.getTargets = () => [];
  assertNotIncludes("not without that target", ctx.getAlteredWeapon(hunter, magicSword).data.runes.property, "Ghost Touch");

  // Far Shot / Far Lobber: range increments
  const bow = weapon("Longbow", { range: 100, group: "bow" });
  const farShot = pc({ feats: [feat("Far Shot", [{ type: "weaponRange", value: "x2" }])] });
  assert("Far Shot doubles the range increment", ctx.getAlteredWeapon(farShot, bow).data.range, 200);
  const bomb = weapon("Alchemist's Fire", { range: 20, traits: ["bomb", "alchemical"] });
  const lobber = pc({ feats: [feat("Far Lobber", [{ type: "weaponRange", value: "30", predicate: '["item:trait:bomb"]' }])] });
  assert("Far Lobber sets bombs to 30", ctx.getAlteredWeapon(lobber, bomb).data.range, 30);
  assert("melee weapons keep range 0", ctx.getAlteredWeapon(farShot, weapon("Longsword")).data.range, 0);

  // Far Throw: -1 per extra increment with thrown weapons
  const javelin = weapon("Javelin", { range: 30, traits: ["Thrown"], group: "dart", reload: "-", ammo: 5 });
  const thrower = pc({ feats: [feat("Far Throw", [{ type: "rangeIncrementPenalty", value: "1", active: true, predicate: '["item:trait:thrown"]' }])], inventory: [javelin] });
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [], data: { ac: 15, level: 1, traits: [] } }, distance: 90 }];
  const rangeMod = capturePrompt(() => ctx.performAttackRoll(thrower, javelin, "data.inventory.0", 1)).modifiers.find((m) => m.name.startsWith("Range Increment"));
  assert("Far Throw: third increment is -2, not -4", rangeMod?.value, -2);

  // Flamboyant Athlete: climb and swim equal to half land Speed
  const athlete = pc({ speed: "30 feet", ancestries: [{ name: "Elf", data: { speed: "30 feet", hp: 6 } }], feats: [feat("Flamboyant Athlete", [{ type: "speed", field: "climb", value: "half" }, { type: "speed", field: "swim", value: "half" }])] });
  const written = {};
  ctx.updateAttribute({ record: athlete, attribute: "str", value: 2, moreValuesToSet: written });
  assert("half land Speed (30 -> 15)", written["data.speed"], "30 feet, climb 15 feet, swim 15 feet");

  ctx.api.getTargets = realTargets;
  ctx.api.getOtherTokens = realOther;
}

section("imported Foundry data for the closed gaps works as-is");
{
  const realTargets = ctx.api.getTargets;
  const realOther = ctx.api.getOtherTokens;
  ctx.api.getOtherTokens = () => [];
  // Expert Backstabber as imported: adjustModifier multiply 2 on backstabber
  const dagger = weapon("+3 Dagger", { traits: ["agile", "finesse", "backstabber"], group: "knife", damage: { dice: 1, die: "d4", damageType: "piercing" }, runes: { potency: 3, striking: 0, property: [] } });
  const expert = pc({ feats: [feat("Expert Backstabber", [{ type: "adjustModifier", targetSlug: "backstabber", value: "2", valueType: "number", adjustMode: "multiply", active: true, field: "" }])], inventory: [dagger] });
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [{ _id: "og", name: "Off-Guard", rules: [] }], effectIds: ["og"], data: { ac: 15, level: 1, traits: [] } }, distance: 5 }];
  const stab = (capturePrompt(() => ctx.performAttackRoll(expert, dagger, "data.inventory.0", 1)).metadata.damageModifiers || []).find((m) => m.name === "Backstabber");
  assert("imported Expert Backstabber: 4 with a +3 weapon", stab?.value, "4");
  // Far Throw as imported: adjustModifier add 1 on range-penalty
  const javelin = weapon("Javelin", { range: 30, traits: ["Thrown"], group: "dart", reload: "-", ammo: 5 });
  const thrower = pc({ feats: [feat("Far Throw", [{ type: "adjustModifier", targetSlug: "range-penalty", value: "1", valueType: "number", adjustMode: "add", active: true, field: "", predicate: '["item:trait:thrown"]' }])], inventory: [javelin] });
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [], data: { ac: 15, level: 1, traits: [] } }, distance: 90 }];
  const rangeMod = capturePrompt(() => ctx.performAttackRoll(thrower, javelin, "data.inventory.0", 1)).modifiers.find((m) => m.name.startsWith("Range Increment"));
  assert("imported Far Throw: third increment is -2", rangeMod?.value, -2);
  // Fearsome Brute's Foundry token
  const scared = { token: { _id: "t", recordType: "npcs", effects: [{ _id: "f", name: "Frightened", rules: [] }], effectIds: ["f", "f", "f"], data: { ac: 15, level: 1, traits: [] } }, distance: 5 };
  assert("@target.conditions.frightened.badge.value", ctx.checkForReplacements("{2*@target.conditions.frightened.badge.value}", {}, pc(), null, { targets: [scared] }), "6");
  ctx.api.getTargets = realTargets;
  ctx.api.getOtherTokens = realOther;
}

section("roll twice: fortune and misfortune");
{
  const lucky = pc({ feats: [feat("Incredible Luck", [{ type: "rollTwice", field: "saving-throw", value: "keep-higher", active: true }])] });
  const save = capturePrompt(() => ctx.rollSave(lucky, "will")).modifiers.find((m) => m.name.startsWith("Incredible Luck"));
  assert("a fortune save offers advantage, ticked", `${save?.value}|${save?.active}`, "advantage|true");
  const cursed = pc({ feats: [feat("Hexed", [{ type: "rollTwice", field: "", value: "keep-lower", active: true }])], inventory: [weapon("Longsword")] });
  const strike = capturePrompt(() => ctx.performAttackRoll(cursed, cursed.data.inventory[0], "data.inventory.0", 1)).modifiers.find((m) => m.name.startsWith("Hexed"));
  assert("misfortune on a Strike", strike?.value, "disadvantage");
  const daring = pc({ feats: [feat("Derring-Do", [{ type: "rollTwice", field: "acrobatics", value: "keep-higher", predicate: '["action:tumble-through"]' }])] });
  const opt = capturePrompt(() => ctx.rollSkill(daring, "acrobatics")).modifiers.find((m) => m.name.startsWith("Derring-Do"));
  assert("a situational fortune is offered unticked", `${opt?.name}|${opt?.active}`, "Derring-Do (Tumble Through) (Fortune)|false");
}

section("skill actions: roll as an action");
{
  const realTargets = ctx.api.getTargets;
  const glare = feat("Intimidating Glare", [{ type: "skillBonus", modifierType: "circumstance", field: "intimidation", valueType: "number", value: "1", predicate: '["action:demoralize"]' }]);
  const record = pc({ intimidation: "2", feats: [glare] });
  ctx.api.getTargets = () => [{ token: { _id: "t", recordType: "npcs", effects: [], data: { level: 2, willMod: 6, traits: [] } } }];
  const rolled = capturePrompt(() => ctx.performSkillAction(record, "intimidation", "Demoralize"));
  assert("the bonus applies when rolled as Demoralize", rolled.modifiers.find((m) => m.name === "Intimidating Glare")?.active, true);
  assert("rolled against the target's Will DC", rolled.metadata.dc, 16);
  assert("the roll is named after the action", rolled.metadata.rollName, "Intimidation: Demoralize");
  const trip = capturePrompt(() => ctx.performSkillAction(pc(), "athletics", "Trip"));
  assert("an attack-trait action offers MAP opt-ins", trip.modifiers.filter((m) => m.name.startsWith("Multiple Attack Penalty") && m.active === false).length, 2);
  ctx.api.getTargets = () => [];
  assert("no target: no DC", capturePrompt(() => ctx.performSkillAction(record, "intimidation", "Demoralize")).metadata.dc, undefined);
  ctx.api.getTargets = realTargets;
  assert("an action card gets a roll button", ctx.getSkillActionMacros({ name: "Demoralize" }).includes('performSkillActionForSelected("intimidation", "Demoralize")'), true);
  assert("Recall Knowledge lists every knowledge skill", ctx.getSkillsForAction("Recall Knowledge").length, 7);
  assert("non-skill actions get no button", ctx.getSkillActionMacros({ name: "Stride" }), "");
}

section("defense DCs and healing received");
{
  const stance = feat("Disarming Stance", [{ type: "saveDCBonus", modifierType: "circumstance", field: "reflex", valueType: "number", value: "2", predicate: '["action:disarm"]' }]);
  const defender = pc({ reflexMod: 9, feats: [stance] });
  assert("Reflex DC 19 normally", ctx.getDefenseDCForToken(defender, "reflex", {}), 19);
  assert("Reflex DC 21 against Disarm", ctx.getDefenseDCForToken(defender, "reflex", { action: { name: "Disarm" } }), 21);
  const detector = pc({ perceptionMod: 8, feats: [feat("Lie Detector", [{ type: "saveDCBonus", modifierType: "circumstance", field: "perception", valueType: "number", value: "1", predicate: '["action:lie"]' }])] });
  assert("Perception DC 18", ctx.getDefenseDCForToken(detector, "perception", {}), 18);
  assert("Perception DC 19 against Lie", ctx.getDefenseDCForToken(detector, "perception", { action: { name: "Lie" } }), 19);

  const robust = pc({ curhp: 10, hitpoints: 100, feats: [feat("Robust Health", [{ type: "healingReceivedBonus", modifierType: "none", field: "", valueType: "string", value: "@actor.level", predicate: '["action:treat-wounds"]' }])] });
  ctx.__state.lastSet = null;
  ctx.applyHealingToToken(robust, 8, { treatWounds: true });
  assert("Treat Wounds heals 8 + level 5", ctx.__state.lastSet?.["data.curhp"], 23);
  ctx.__state.lastSet = null;
  ctx.applyHealingToToken(robust, 8, {});
  assert("other healing is unchanged", ctx.__state.lastSet?.["data.curhp"], 18);
}

section("more than one toggle per feat");
{
  const punch = { ...feat("One-Inch Punch", []), data: { type: "class", level: 1, toggleable: true, predicateValue: "one-inch-punch", toggleOptions: [
    { name: "Two Actions", data: { predicateValue: "one-inch-punch:two", group: "actions" } },
    { name: "Three Actions", data: { predicateValue: "one-inch-punch:three", group: "actions" } },
  ] } };
  const written = {};
  ctx.updateTogglesList(pc({ feats: [punch] }), written);
  const toggles = written["data.toggles"] || [];
  assert("the main toggle and both options are listed", toggles.map((t) => t.name).join(" | "), "One-Inch Punch | One-Inch Punch: Two Actions | One-Inch Punch: Three Actions");
  assert("options carry their group", toggles[1]?.data?.group, "One-Inch Punch|actions");
  const on = pc({ feats: [punch], toggles: [{ name: "One-Inch Punch: Three Actions", data: { predicateValue: "one-inch-punch:three", toggled: true } }] });
  assertIncludes("a toggled option is a predicate atom", traitsFor(on), "one-inch-punch:three");

  // The sheet's toggle checkbox turns off the rest of its group, then recalculates
  const listCtx = createSandbox();
  const html = fs.readFileSync(`${__dirname}/../toggle-list.html`, "utf8");
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]).runInContext(listCtx);
  let set = null;
  let recalculated = false;
  listCtx.dataPath = "data.toggles.1.data.toggled";
  listCtx.getNearestParentDataPath = () => "data.toggles.1";
  listCtx.record = { _id: "pc", recordType: "characters", data: { toggles: [
    { _id: "a", name: "A", data: { group: "g", toggled: true } },
    { _id: "b", name: "B", data: { group: "g", toggled: false } },
    { _id: "c", name: "C", data: { group: "", toggled: true } },
  ] } };
  listCtx.api.getValue = () => listCtx.record.data.toggles[1];
  listCtx.api.setValues = (values, cb) => { set = values; if (cb) cb(); };
  listCtx.api.getRecord = (type, id, cb) => cb(listCtx.record);
  listCtx.onAddEditFeature = () => { recalculated = true; };
  listCtx.onToggleChanged(true);
  assert("turning B on turns A off, leaves C", JSON.stringify(set), JSON.stringify({ "data.toggles.1.data.toggled": true, "data.toggles.0.data.toggled": false }));
  assert("and the sheet recalculates", recalculated, true);
}

section("bulk limit, check penalty, spell dice, damage on a miss");
{
  const hauler = pc({ str: 3, feats: [feat("Hefty Hauler", [{ type: "bulkLimit", value: "2", active: true }])] });
  const written = {};
  ctx.updateAttribute({ record: hauler, attribute: "str", value: 3, moreValuesToSet: written });
  assert("Hefty Hauler: 5 + 3 + 2", written["data.bulk"], 10);

  const plate = { _id: "a", name: "Full Plate", data: { type: "armor", carried: "equipped", acBonus: 6, checkPenalty: -3, strength: 4, itemCategory: "Heavy" } };
  const sneaky = pc({ str: 1, inventory: [plate], feats: [feat("Armored Stealth", [{ type: "adjustModifier", targetSlug: "armor-check-penalty", adjustMode: "add", value: "1", valueType: "number", active: true, field: "", predicate: '["check:statistic:stealth"]' }])] });
  const penalty = (skill) => capturePrompt(() => ctx.rollSkill(sneaky, skill)).modifiers.find((m) => m.name === "Check Penalty")?.value;
  assert("Armored Stealth: Stealth check penalty -2", penalty("stealth"), -2);
  assert("other skills keep -3", penalty("athletics"), -3);

  const heal = { _id: "s", name: "Heal", recordType: "spells", data: { level: 1, traits: ["Healing", "Vitality"], damage: [] } };
  const healer = pc({ feats: [feat("Healing Hands", [{ type: "spellDieSize", value: "d10", predicate: '["item:slug:heal"]' }])] });
  assert("Healing Hands: heal rolls d10s", ctx.applySpellDieSize(healer, heal, "2d8", "healing"), "2d10");
  assert("other spells keep their dice", ctx.applySpellDieSize(healer, { ...heal, name: "Harm" }, "2d8", "damage"), "2d8");

  const sword = weapon("Longsword");
  const finisher = pc({ feats: [feat("Brutal Finish", [{ type: "damageBonus", modifierType: "none", field: "", valueType: "string", value: "1d@weaponDie", failureOnly: true }])], inventory: [sword] });
  const meta = capturePrompt(() => ctx.performAttackRoll(finisher, sword, "data.inventory.0", 1)).metadata;
  assert("miss damage is carried for the miss button", meta.failureDamage, "1d8 slashing");
  assert("and kept out of the normal damage", (meta.damageModifiers || []).some((m) => m.name === "Brutal Finish"), false);
  const outcomePredicate = pc({ feats: [feat("Glancing", [{ type: "damageBonus", modifierType: "none", field: "", valueType: "string", value: "2", predicate: '["check:outcome:failure"]' }])], inventory: [sword] });
  assert("a check:outcome:failure predicate works too", capturePrompt(() => ctx.performAttackRoll(outcomePredicate, sword, "data.inventory.0", 1)).metadata.failureDamage, "2 slashing");
}

section("raised shield: atom and the raised-shield slug");
{
  const buckler = { _id: "b", name: "Buckler", data: { type: "shield", carried: "equipped", acBonus: 1, hardness: 3, hp: { value: 6, max: 6 } } };
  const elegant = { ...feat("Elegant Buckler", [{ type: "adjustModifier", targetSlug: "raised-shield", adjustMode: "upgrade", value: "2", valueType: "number", active: true, field: "", predicate: '["elegant-buckler"]' }]), data: { type: "class", level: 1, toggleable: true, predicateValue: "elegant-buckler", modifiers: [{ data: { type: "adjustModifier", targetSlug: "raised-shield", adjustMode: "upgrade", value: "2", valueType: "number", active: true, field: "", predicate: '["elegant-buckler"]' } }] } };
  const acFor = (extra) => {
    const record = pc({ inventory: [buckler], feats: [elegant], ...extra });
    const written = {};
    ctx.updateAttribute({ record, attribute: "dex", value: 3, moreValuesToSet: written });
    return written["data.ac"];
  };
  const lowered = acFor({ shieldRaised: "false", toggles: [{ name: "Elegant Buckler", data: { predicateValue: "elegant-buckler", toggled: false } }] });
  // On a sheet the feat's toggle is always listed (untoggled here), which
  // keeps its bare name from satisfying its own predicate
  const untoggled = [{ name: "Elegant Buckler", data: { predicateValue: "elegant-buckler", toggled: false } }];
  assert("raised buckler: +1", acFor({ shieldRaised: "true", toggles: untoggled }) - lowered, 1);
  assert("raised buckler with Elegant Buckler on: +2", acFor({ shieldRaised: "true", toggles: [{ name: "Elegant Buckler", data: { predicateValue: "elegant-buckler", toggled: true } }] }) - lowered, 2);
  const traits = traitsFor(pc({ inventory: [buckler], shieldRaised: "true" }));
  assertIncludes("self:shield:raised", traits, "self:shield:raised");
  assertIncludes("self:shield:base:buckler", traits, "self:shield:base:buckler");
  assertNotIncludes("not raised: no atom", traitsFor(pc({ inventory: [buckler], shieldRaised: "false" })), "self:shield:raised");
}

// --- engine group G2: damage, IWR, healing, recovery ---------------------------

// Runs a roll handler file the way Realm does, with `data` in scope
function runHandler(file, data) {
  ctx.__state.messages = [];
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
  return ctx.__state.messages.join("\n");
}

section("flat persistent damage (Relentless Reaction)");
{
  const split = (values, existing = "") =>
    ctx.processDamageModifierCategories(values.map((value) => ({ name: "M", value, active: true })), existing);
  const flat = split(["4 spirit-persistent"]);
  assert("'4 spirit-persistent' is persistent damage", [flat.persistentDamage, flat.modifiers.length], ["4 spirit", 0]);
  assert("arithmetic is worked out", split(["2+3 fire-persistent"]).persistentDamage, "5 fire");
  const none = split(["0 spirit-persistent"]);
  assert("0 deals nothing and isn't a modifier either", [none.persistentDamage, none.modifiers.length], ["", 0]);
  assert("dice persistent unchanged", split(["1d6 fire-persistent"]).persistentDamage, "1d6 fire");
  assert("joins the weapon's own persistent damage", split(["4 spirit-persistent"], "1d6 bleed").persistentDamage, "1d6 bleed, 4 spirit");
  assert("a plain number stays an ordinary modifier", split(["4"]).modifiers.length, 1);
  const splash = split(["3 fire-splash"]);
  assert("flat splash too", splash.splashDamage, "3 fire");
  // The feature as the record has it: a formula that becomes a number
  const relentless = feat("Relentless Reaction", [
    { type: "damageBonus", modifierType: "", field: "strike-damage", valueType: "string", value: "@actor.abilities.cha.mod spirit-persistent" },
  ]);
  const champion = pc({ cha: 4, feats: [relentless] });
  const mods = lookup(champion, ["damageBonus"], "strike-damage");
  assert("Relentless Reaction: cha 4 -> 4 spirit persistent", ctx.processDamageModifierCategories(mods).persistentDamage, "4 spirit");
  assert("cha 0 -> nothing", ctx.processDamageModifierCategories(lookup(pc({ cha: 0, feats: [relentless] }), ["damageBonus"], "strike-damage")).persistentDamage, "");
  assert("a critical hit doubles flat persistent damage too", ctx.doublePersistentDamage("1d6 fire, 4 spirit"), "2d6 fire, 8 spirit");
  assert("dice only, as before", ctx.doublePersistentDamage("2d4 bleed"), "4d4 bleed");
}

section("damage source (damageSource metadata and atoms)");
{
  const sword = weapon("Longsword");
  const source = ctx.getDamageSource(pc({ traits: ["Human", "Humanoid"] }), sword);
  assert("a weapon: type, category, range, slug, origin traits", [source.type, source.category, source.range, source.slug, source.originTraits], ["weapon", "martial", "melee", "longsword", ["human", "humanoid"]]);
  const fist = ctx.getDamageSource(null, weapon("Fist", { itemCategory: "unarmed" }));
  assert("unarmed category, no creature", [fist.category, fist.originTraits], ["unarmed", undefined]);
  const claw = ctx.getDamageSource({ data: { traits: ["Undead"] } }, { name: "Claw", recordType: "npc_attacks", data: { weaponType: "melee", traits: ["unarmed"] } });
  assert("an NPC Strike is a melee item; unarmed by trait", [claw.type, claw.category], ["melee", "unarmed"]);
  const fireball = ctx.getDamageSource(null, { name: "Fireball", recordType: "spells", data: { traits: ["Fire"], traditions: ["arcane", "primal"] } }, "Arcane");
  assert("a spell: its casting tradition", [fireball.type, fireball.traditions], ["spell", ["arcane"]]);
  const potion = ctx.getDamageSource(null, { name: "Minor Healing Potion", recordType: "items", data: { type: "consumable", traits: ["Consumable", "Healing", "Magical", "Potion"] } });
  assert("a potion is magical", potion.magical, true);
  const elixir = ctx.getDamageSource(null, { name: "Elixir of Life (Minor)", recordType: "items", data: { type: "consumable", traits: ["Alchemical", "Elixir", "Healing"] } });
  assert("an alchemical elixir is not", elixir.magical, undefined);
  const atoms = [...ctx.getDamageSourceAtoms({ types: [{ type: "slashing" }], metadata: { traits: ["Versatile P"], damageSource: claw } })];
  ["item:type:melee", "item:category:unarmed", "item:unarmed", "item:melee", "item:slug:claw", "item:trait:unarmed", "item:damage:type:slashing", "origin:trait:undead", "origin:mode:undead"].forEach((atom) =>
    assertIncludes(`atom ${atom}`, atoms, atom),
  );
  assertIncludes("a spell roll without a source is still item:type:spell", [...ctx.getDamageSourceAtoms({ metadata: { isSpell: true } })], "item:type:spell");
  assertIncludes("a living creature: origin:mode:living", [...ctx.getDamageSourceAtoms({ metadata: { damageSource: source } })], "origin:mode:living");
  assertNotIncludes("no creature: no origin mode", [...ctx.getDamageSourceAtoms({ metadata: { damageSource: fist } })], "origin:mode:living");
  // The weapon Strike and its damage carry the source
  const attack = capturePrompt(() => ctx.performDamageRoll(pc({ inventory: [sword] }), sword, "data.inventory.0", false));
  assert("weapon damage roll metadata carries damageSource", attack.metadata.damageSource?.type, "weapon");
  // Devastator: melee Strikes ignore up to 10 physical resistance
  const devastator = feat("Devastator", [{ type: "damageBonus", modifierType: "none", field: "melee", valueType: "string", value: "ignore up to 10 physical resistance" }]);
  const melee = capturePrompt(() => ctx.performDamageRoll(pc({ feats: [devastator], inventory: [sword] }), sword, "data.inventory.0", false));
  assert("Devastator: a melee Strike's damage carries physical:10", melee.metadata.damageIgnoresResistances, "physical:10");
  assert("... and it isn't a damage modifier", melee.modifiers.some((m) => String(m.value).includes("ignore")), false);
  const bow = weapon("Longbow", { range: 100, group: "bow" });
  const ranged = capturePrompt(() => ctx.performDamageRoll(pc({ feats: [devastator], inventory: [bow] }), bow, "data.inventory.0", false));
  assert("... a ranged Strike's doesn't", ranged.metadata.damageIgnoresResistances, "");
}

section("persistent damage recovery DC (Charhide Goblin)");
{
  const charhide = (mods) => pc({ feats: [feat("Charhide Goblin", mods)] });
  assert("no modifiers: DC 15", ctx.getPersistentRecoveryDC(pc(), "1d6 fire"), 15);
  const byField = charhide([{ type: "persistentRecoveryDC", modifierType: "none", field: "Fire", valueType: "number", value: "10" }]);
  assert("field Fire, value 10: fire DC 10", ctx.getPersistentRecoveryDC(byField, "1d6 fire"), 10);
  assert("... cold still DC 15", ctx.getPersistentRecoveryDC(byField, "2 cold"), 15);
  const byPredicate = charhide([{ type: "persistentRecoveryDC", modifierType: "none", field: "", valueType: "number", value: "10", predicate: '["item:damage:type:fire"]' }]);
  assert("Foundry predicate item:damage:type:fire: fire DC 10", ctx.getPersistentRecoveryDC(byPredicate, "3 fire"), 10);
  assert("... bleed DC 15", ctx.getPersistentRecoveryDC(byPredicate, "1d4 bleed"), 15);
  const lower = charhide([{ type: "persistentRecoveryDC", modifierType: "none", field: "", valueType: "string", value: "-5" }]);
  assert("a signed value changes the DC: 15 - 5", ctx.getPersistentRecoveryDC(lower, "1d6 acid"), 10);
  const both = charhide([
    { type: "persistentRecoveryDC", modifierType: "none", field: "fire", valueType: "number", value: "10" },
    { type: "persistentRecoveryDC", modifierType: "none", field: "fire", valueType: "number", value: "12" },
  ]);
  assert("two DCs: the lowest", ctx.getPersistentRecoveryDC(both, "1d6 fire"), 10);
  assertIncludes("the button rolls against that DC", [ctx.getPersistentRecoveryButton(10, 1)], ctx.getPersistentRecoveryButton(10, 1));
  assert("button text", ctx.getPersistentRecoveryButton(10, 1).includes('{ dc: 10, rollName: "Persistent Damage Flat Check"') && ctx.getPersistentRecoveryButton(10, 1).includes("persistentPartIndex: 1 }"), true);
  assert("no DC given: 15", ctx.getPersistentRecoveryButton(undefined, 0).includes("{ dc: 15,"), true);
  const card = runHandler("damage.js", { roll: { types: [{ type: "fire", value: 3 }], dice: [], total: 3, metadata: { isPersistant: true, persistentPartIndex: 0, recoveryDC: 10 } } });
  assert("damage.js: the persistent damage card's recovery check uses it", card.includes("{ dc: 10, rollName"), true);
  const oldCard = runHandler("damage.js", { roll: { types: [{ type: "fire", value: 3 }], dice: [], total: 3, metadata: { isPersistant: true, persistentPartIndex: 0 } } });
  assert("damage.js: without one, DC 15 as before", oldCard.includes("{ dc: 15, rollName"), true);
  const crit = runHandler("damage.js", { roll: { types: [{ type: "slashing", value: 8 }], dice: [], total: 8, metadata: { critical: true, persistentDamage: "4 spirit" } } });
  assert("damage.js: a critical hit doubles flat persistent damage", crit.includes('applyPersistentDamage("8 spirit"'), true);
}

section("recovery DC without the dying value (Nine Lives Catfolk)");
{
  const nineLives = feat("Nine Lives Catfolk", [{ type: "recoveryDC", modifierType: "none", field: "", valueType: "string", value: "-@actor.conditions.dying.value" }]);
  const dying = (value, feats) => ({ ...pc({ feats }), data: { ...pc({ feats }).data, dying: value } });
  assert("@actor.conditions.dying.value reads the sheet's dying", ctx.checkForReplacements("@actor.conditions.dying.value", {}, dying(3, [])), "3");
  assert("dying 2 without it: DC 12", ctx.getRecoveryCheckDC(dying(2, [])), 12);
  assert("Nine Lives, dying 2: DC 10", ctx.getRecoveryCheckDC(dying(2, [nineLives])), 10);
  assert("Nine Lives, dying 3: DC 10", ctx.getRecoveryCheckDC(dying(3, [nineLives])), 10);
  assert("... worked out at the dying value asked for", ctx.getRecoveryCheckDC(dying(1, [nineLives]), 3), 10);
  assert("with Toughness too: DC 9 (they add up, as in Foundry)", ctx.getRecoveryCheckDC(dying(2, [nineLives, feat("Toughness", [])])), 9);
  assertIncludes("self:condition:dying from the sheet", traitsFor(dying(2, [])), "self:condition:dying:2");
  assertNotIncludes("not dying: no atom", traitsFor(dying(0, [])), "self:condition:dying");
  const gated = feat("Nine Lives Catfolk", [{ type: "recoveryDC", modifierType: "none", field: "", valueType: "string", value: "-@actor.conditions.dying.value", predicate: '["self:condition:dying"]' }]);
  assert("Foundry's self:condition:dying predicate passes while dying", ctx.getRecoveryCheckDC(dying(2, [gated])), 10);
}

section("overnight rest healing (Hillock Halfling)");
{
  const hillock = feat("Hillock Halfling", [{ type: "restHealing", modifierType: "none", field: "", valueType: "string", value: "@actor.level" }]);
  assert("Con 1 x level 5", ctx.getRestHealing(pc()).amount, 5);
  assert("Con 0 counts as 1", ctx.getRestHealing(pc({ con: 0 })).amount, 5);
  const halfling = ctx.getRestHealing(pc({ feats: [hillock] }));
  assert("Hillock Halfling adds the level: 10", [halfling.amount, halfling.names], [10, ["+5 Hillock Halfling"]]);
  const gated = feat("Gated", [{ type: "restHealing", modifierType: "none", field: "", valueType: "number", value: "3", predicate: '["self:effect:never"]' }]);
  assert("a failing predicate adds nothing", ctx.getRestHealing(pc({ feats: [gated] })).amount, 5);
}

section("healing received from a magical item (Curse of Outpouring Life)");
{
  const CURSEBOUND = { _id: "cursebound", name: "Cursebound", stackable: true, rules: [] };
  const outpouring = feat("Curse of Outpouring Life", [
    { type: "healingReceivedBonus", modifierType: "status", field: "", valueType: "number", value: "-@actor.level*@actor.conditions.cursebound.value", predicate: '["self:condition:cursebound","item:magical"]' },
  ]);
  const oracle = { ...pc({ curhp: 10, hitpoints: 100, feats: [outpouring] }), effects: [CURSEBOUND], effectIds: ["cursebound", "cursebound"] };
  const heal = (options) => {
    ctx.__state.lastSet = null;
    ctx.applyHealingToToken(oracle, 30, options);
    return ctx.__state.lastSet?.["data.curhp"];
  };
  const potion = ctx.getDamageSource(null, { name: "Moderate Healing Potion", recordType: "items", data: { type: "consumable", traits: ["Consumable", "Healing", "Magical", "Potion"] } });
  const elixir = ctx.getDamageSource(null, { name: "Elixir of Life (Minor)", recordType: "items", data: { type: "consumable", traits: ["Alchemical", "Elixir", "Healing"] } });
  assert("a healing potion: 30 - level 5 x cursebound 2", heal({ damageSource: potion }), 30);
  assert("an alchemical elixir isn't magical: 30", heal({ damageSource: elixir }), 40);
  assert("a spell still counts as magical", heal({ isSpell: true }), 30);
  assert("unknown source: no penalty", heal({}), 40);
  const bare = feat("Bare", [{ type: "healingReceivedBonus", modifierType: "status", field: "", valueType: "number", value: "-3", predicate: '["magical"]' }]);
  ctx.__state.lastSet = null;
  ctx.applyHealingToToken(pc({ curhp: 10, hitpoints: 100, feats: [bare] }), 30, { damageSource: potion });
  assert("the bare 'magical' atom works too", ctx.__state.lastSet?.["data.curhp"], 37);
  const healCard = runHandler("healing.js", { roll: { types: [{ type: "healing", value: 7 }], total: 7, metadata: { rollName: "Potion", damageSource: potion } } });
  assert("healing.js passes the source to applyHealingToToken", healCard.includes('"magical":true'), true);
}

section("maximized healing dice (Greater Field Discovery)");
{
  const discovery = feat("Greater Field Discovery (Chirurgeon)", [
    { type: "maximizeHealing", modifierType: "none", field: "", valueType: "string", value: "", predicate: '[{"or":["item:slug:elixir-of-life-minor","item:slug:elixir-of-life-lesser"]}]' },
  ]);
  const alchemist = pc({ feats: [discovery] });
  const minor = { _id: "eol", name: "Elixir of Life (Minor)", recordType: "items", data: { type: "consumable", level: 1, traits: ["Alchemical", "Elixir", "Healing"], description: "" } };
  const potion = { _id: "pot", name: "Minor Healing Potion", recordType: "items", data: { type: "consumable", level: 1, traits: ["Magical"] } };
  assert("maximizeDice", ctx.maximizeDice("3d6+6"), "18+6");
  assert("an elixir of life: maximized", ctx.hasMaximizeHealing(alchemist, minor), true);
  assert("another item: not", ctx.hasMaximizeHealing(alchemist, potion), false);
  assert("without the feature: not", ctx.hasMaximizeHealing(pc(), minor), false);
  const text = "Heals replaceWithDamageMacro('1d6', 'healing')";
  const rendered = ctx.updateDamageMacros(text, { item: minor, creature: alchemist });
  assert("the item's healing button carries maximizeHealing", rendered.includes('"maximizeHealing":true'), true);
  assert("... and where it comes from", rendered.includes('"damageSource":{'), true);
  assert("another creature's button doesn't", ctx.updateDamageMacros(text, { item: minor, creature: pc() }).includes("maximizeHealing"), false);
  const rolled = capturePrompt(() => ctx.executeDamageMacro("1d6", "healing", null, { _id: "eol", recordType: "items", maximizeHealing: true }));
  assert("executeDamageMacro: 1d6 healing rolls 6", rolled.dice, "6");
  const normal = capturePrompt(() => ctx.executeDamageMacro("1d6", "healing", null, { _id: "eol", recordType: "items" }));
  assert("without it: 1d6", normal.dice, "1d6");
  const damage = capturePrompt(() => ctx.executeDamageMacro("1d6 fire", "standard", null, { _id: "eol", recordType: "items", maximizeHealing: true }));
  assert("damage is never maximized", damage.dice, "1d6 fire");
}

section("roll notes (Third Path to Perfection)");
{
  const note = (field, outcome, predicate) => ({
    type: "rollNote", modifierType: "none", field, valueType: "string",
    value: "You take half damage from this effect. Use Apply Half Damage.",
    ...(outcome !== undefined ? { outcome } : {}),
    ...(predicate ? { predicate } : {}),
  });
  const monk = (mods, extra = {}) => pc({ feats: [feat("Third Path to Perfection", mods)], ...extra });
  const notes = ctx.getRollNotes(monk([note("reflex", "failure")]), ["reflex", "dex", "saving-throw"]);
  assert("collected with its outcome", [notes.length, notes[0]?.name, notes[0]?.outcome], [1, "Third Path to Perfection", [0]]);
  assert("text kept as written (no level replacement)", ctx.getRollNotes(monk([{ ...note("will"), value: "Add your level." }]), ["will"])[0]?.text, "Add your level.");
  assert("another save: none", ctx.getRollNotes(monk([note("reflex", "failure")]), ["will", "wis", "saving-throw"]).length, 0);
  assert("array outcomes", ctx.getRollNotes(monk([note("reflex", ["failure", "criticalFailure"])]), ["reflex"])[0]?.outcome, [0, -1]);
  assert("predicate gate off: none", ctx.getRollNotes(monk([note("reflex", "failure", '["third-path-to-perfection:reflex"]')]), ["reflex"]).length, 0);
  const toggled = monk([note("reflex", "failure", '["third-path-to-perfection:reflex"]')], { toggles: [{ name: "Third Path", data: { predicateValue: "third-path-to-perfection:reflex", toggled: true } }] });
  assert("predicate gate on: shown", ctx.getRollNotes(toggled, ["reflex"]).length, 1);
  assert("a rollNote's 'failure' outcome doesn't make it a miss-only damage rider", lookup(monk([note("reflex", "failure")]), ["rollNote"], "reflex")[0]?.failureOnly, undefined);
  const text = (degree) => ctx.getRollNotesText(notes, degree);
  assert("failure: shown", text(0), "\n\n**Third Path to Perfection:** You take half damage from this effect. Use Apply Half Damage.");
  assert("success: not shown", text(1), "");
  assert("no DC: shown", text(null), text(0));
  // rollSave passes them, save.js shows them on the final degree
  const save = capturePrompt(() => ctx.rollSave(monk([note("reflex", "failure")], { reflexMod: 5 }), "reflex", 20));
  assert("rollSave puts the notes in the metadata", save.metadata.notes?.length, 1);
  const saveRoll = (d20, metadata) => runHandler("save.js", { roll: { dice: [{ type: 20, value: d20 }], total: d20 + 5, metadata: { dc: 20, ...metadata } } });
  assert("save.js: failure shows the note", saveRoll(8, save.metadata).includes("**Third Path to Perfection:**"), true);
  assert("save.js: success doesn't", saveRoll(16, save.metadata).includes("Third Path"), false);
  // Third Path also turns a critical failure into a failure: the note reads the final degree
  const adjusted = capturePrompt(() => ctx.rollSave(monk([note("reflex", "failure"), { type: "adjustDegreeOfSuccess", field: "reflex", adjustment: { criticalFailure: "one-degree-better" } }], { reflexMod: 5 }), "reflex", 20));
  const critFail = saveRoll(2, adjusted.metadata);
  assert("save.js: critical failure made a failure shows the note", [critFail.includes("FAILURE"), critFail.includes("CRITICAL FAILURE"), critFail.includes("Third Path")], [true, false, true]);
  assert("save.js: without notes, unchanged", saveRoll(8, {}).includes("**"), true);
  const skill = capturePrompt(() => ctx.rollSkill(monk([note("athletics", "")], { athleticsMod: 5 }), "athletics"));
  assert("rollSkill collects notes too", skill.metadata.notes?.length, 1);
  const skillCard = runHandler("skill.js", { roll: { dice: [{ type: 20, value: 10 }], total: 15, metadata: { dc: 10, ...skill.metadata } } });
  assert("skill.js: a note with no outcome shows on any result", skillCard.includes("**Third Path to Perfection:**"), true);
  // Strikes: the attack card shows them, and passes damageSource on to the damage roll
  ctx.assetUrl = "";
  const strike = (d20) => runHandler("attack.js", { roll: { dice: [{ type: 20, value: d20 }], total: d20 + 5, metadata: { dc: 18, attack: "Longsword", traits: [], damage: "1d8 slashing", damageSource: { type: "weapon" }, notes: [{ name: "Note Feat", text: "On a hit, push.", outcome: [1, 2] }] } } });
  assert("attack.js: a hit shows the note", strike(15).includes("**Note Feat:** On a hit, push."), true);
  assert("attack.js: a miss doesn't", strike(5).includes("Note Feat"), false);
  assert("attack.js: the damage button carries damageSource", strike(15).includes('"damageSource":{"type":"weapon"}'), true);
  const sword = weapon("Longsword");
  const attackPrompt = capturePrompt(() => ctx.performAttackRoll(monk([note("attack-roll", "success")], { inventory: [sword] }), sword, "data.inventory.0"));
  assert("performAttackRoll collects attack-roll notes", attackPrompt.metadata.notes?.length, 1);
}

// --- engine group G3: weapons and Strikes --------------------------------------

section("damage die size atom (Ruffian, Deific Weapon)");
{
  const sword = weapon("Longsword");
  assertIncludes("d8 longsword: item:damage:die:faces:8", traitsFor(pc(), { weapon: sword }), "item:damage:die:faces:8");
  assertNotIncludes("... not :6", traitsFor(pc(), { weapon: sword }), "item:damage:die:faces:6");
  const bastard = weapon("Bastard Sword", { traits: ["Two-Hand d12"], handBtn: "two" });
  assertIncludes("two-hand weapon held in two hands: its two-hand die", traitsFor(pc(), { weapon: bastard }), "item:damage:die:faces:12");
  assertIncludes("held in one hand: its own die", traitsFor(pc(), { weapon: { ...bastard, data: { ...bastard.data, handBtn: "one" } } }), "item:damage:die:faces:8");
  assert("a spell has no die-faces atom", traitsFor(pc(), { spell: { name: "Fireball", recordType: "spells", data: { damage: [{ data: { formula: "6d6", type: "fire" } }] } } }).some((t) => t.startsWith("item:damage:die:faces")), false);
  // Ruffian: martial/advanced weapons with a d6 or smaller die (after die changes)
  const ruffianPredicate = '[{"or":[{"and":["item:category:simple",{"lte":["item:damage:die:faces",8]}]},{"and":[{"or":["item:category:martial","item:category:advanced"]},{"lte":["item:damage:die:faces",6]}]}]}]';
  const ruffian = (w, extra = []) => pc({ feats: [feat("Ruffian Test", [{ type: "damageBonus", modifierType: "none", field: "strike-damage", valueType: "string", value: "1d6 precision", predicate: ruffianPredicate }]), ...extra], inventory: [w] });
  const active = (record, w) => lookup(record, ["damageBonus"], "strike-damage", { weapon: w })[0]?.active;
  const shortsword = weapon("Shortsword", { damage: { dice: 1, die: "d6", damageType: "piercing" } });
  assert("martial d6 passes", active(ruffian(shortsword), shortsword), true);
  assert("martial d8 fails", active(ruffian(sword), sword), false);
  const club = weapon("Club", { itemCategory: "simple", group: "club", damage: { dice: 1, die: "d6", damageType: "bludgeoning" } });
  assert("simple d6 passes", active(ruffian(club), club), true);
  const ogre = feat("Bigger Die", [{ type: "weaponDieSize", value: "d10", predicate: '["item:slug:shortsword"]' }]);
  const altered = ctx.getAlteredWeapon(ruffian(shortsword, [ogre]), shortsword);
  assert("a die changed to d10 first: martial fails", active(ruffian(shortsword, [ogre]), altered), false);
}

section("deity favored weapon (item:deity-favored)");
{
  const sword = weapon("Longsword");
  const dagger = weapon("Dagger", { itemCategory: "simple", group: "knife", traits: ["agile", "finesse"], damage: { dice: 1, die: "d4", damageType: "piercing" } });
  const iomedae = (extra = {}) => pc({ deity: "Iomedae", ...extra });
  assertIncludes("Iomedae: longsword is favored", traitsFor(iomedae(), { weapon: sword }), "item:deity-favored");
  assertNotIncludes("... dagger is not", traitsFor(iomedae(), { weapon: dagger }), "item:deity-favored");
  assertIncludes("runes don't hide the base weapon", traitsFor(iomedae(), { weapon: weapon("+1 Striking Longsword", { runes: { potency: 1, striking: 1, property: [] } }) }), "item:deity-favored");
  assertIncludes("deity with an epithet", traitsFor(pc({ deity: "Iomedae (The Inheritor)" }), { weapon: sword }), "item:deity-favored");
  assertIncludes("case and spacing don't matter", traitsFor(pc({ deity: "  iomedae " }), { weapon: sword }), "item:deity-favored");
  assertIncludes("data.favoredWeapon overrides the deity", traitsFor(iomedae({ favoredWeapon: "Dagger" }), { weapon: dagger }), "item:deity-favored");
  assertNotIncludes("... and replaces it", traitsFor(iomedae({ favoredWeapon: "Dagger" }), { weapon: sword }), "item:deity-favored");
  assertNotIncludes("an unknown deity: none", traitsFor(pc({ deity: "My Homebrew God" }), { weapon: sword }), "item:deity-favored");
  assertNotIncludes("no deity: none", traitsFor(pc(), { weapon: sword }), "item:deity-favored");
  assertIncludes("the creature carries deity:favored-weapon:<slug>", traitsFor(iomedae()), "deity:favored-weapon:longsword");
  assertIncludes("Irori: fist", traitsFor(pc({ deity: "Irori" })), "deity:favored-weapon:fist");
  assert("no deity: no deity atoms", traitsFor(pc()).some((t) => t.startsWith("deity:")), false);

  // Cleric: attacks.other "Deity's favored weapon" (trained)
  const cleric = (deity) => pc({ deity, attackProficiencies: { simple: "1", martial: "0", other: { name: "Deity's favored weapon", rank: "1" } } });
  assert("Cleric of Iomedae: trained in the longsword", ctx.getProfiencyForWeapon(cleric("Iomedae"), "martial", "sword", sword), 1);
  assert("... untrained in other martial weapons", ctx.getProfiencyForWeapon(cleric("Iomedae"), "martial", "axe", weapon("Battle Axe", { group: "axe" })), 0);
  assert("no deity: untrained", ctx.getProfiencyForWeapon(cleric(""), "martial", "sword", sword), 0);
  // Warpriest Third Doctrine: expert + critical specialization with the favored weapon
  const doctrine = feat("Third Doctrine (Warpriest)", [
    { type: "weaponProficiency", valueType: "number", value: "2", predicate: '["item:deity-favored"]' },
    { type: "criticalSpecialization", predicate: '["item:deity-favored"]' },
  ]);
  const warpriest = pc({ deity: "Iomedae", feats: [doctrine], attackProficiencies: { simple: "2", martial: "1" } });
  assert("Third Doctrine: expert with the longsword", ctx.getProfiencyForWeapon(warpriest, "martial", "sword", sword), 2);
  assert("... martial rank elsewhere", ctx.getProfiencyForWeapon(warpriest, "martial", "axe", weapon("Battle Axe", { group: "axe" })), 1);
  assert("... critical specialization with the longsword", ctx.hasCriticalSpecializationEffect(warpriest, sword), true);
  assert("... not with a dagger", ctx.hasCriticalSpecializationEffect(warpriest, dagger), false);
  // Deific Weapon: advanced favored weapon as martial; d4 unarmed or simple: die up one step
  const deific = feat("Deific Weapon", [
    { type: "weaponProficiency", valueType: "string", value: "data.attackProficiencies.martial", predicate: '["item:category:advanced","item:deity-favored"]' },
    { type: "weaponDieSize", modifierType: "none", valueType: "string", value: "upgrade", predicate: '["item:deity-favored",{"or":["item:category:simple",{"and":["item:category:unarmed","item:damage:die:faces:4"]}]}]' },
  ]);
  const champion = (deity) => pc({ deity, feats: [deific], attackProficiencies: { simple: "1", martial: "1", advanced: "0", unarmed: "1" } });
  const saber = weapon("Sawtooth Saber", { itemCategory: "advanced", group: "sword", damage: { dice: 1, die: "d6", damageType: "slashing" } });
  // The sandbox api reads no record paths; read them as Realm does
  const realGetValueOnRecord = ctx.api.getValueOnRecord;
  ctx.api.getValueOnRecord = (rec, path) => path.split(".").reduce((o, k) => o?.[k], rec);
  assert("Achaekek: the advanced sawtooth saber uses the martial rank", ctx.getProfiencyForWeapon(champion("Achaekek"), "advanced", "sword", saber), 1);
  assert("... not for another deity", ctx.getProfiencyForWeapon(champion("Iomedae"), "advanced", "sword", saber), 0);
  ctx.api.getValueOnRecord = realGetValueOnRecord;
  assert("Pharasma: the simple dagger d4 -> d6", ctx.getAlteredWeapon(champion("Pharasma"), dagger).data.damage.die, "d6");
  const fist = weapon("Fist", { itemCategory: "unarmed", group: "brawling", traits: ["agile", "finesse", "unarmed"], damage: { dice: 1, die: "d4", damageType: "bludgeoning" } });
  assert("Irori: the d4 fist -> d6", ctx.getAlteredWeapon(champion("Irori"), fist).data.damage.die, "d6");
  assert("Iomedae: the martial longsword stays d8", ctx.getAlteredWeapon(champion("Iomedae"), sword).data.damage.die, "d8");
  assert("Pharasma: a fist isn't favored, stays d4", ctx.getAlteredWeapon(champion("Pharasma"), fist).data.damage.die, "d4");
}

section("item:proficiency:rank counts weaponProficiency modifiers (alchemical bombs)");
{
  const bomb = weapon("Alchemist's Fire", { itemCategory: "martial", group: "bomb", range: 20, traits: ["bomb", "alchemical", "fire", "splash"], damage: { dice: 1, die: "d8", damageType: "fire" } });
  const specialization = feat("Weapon Specialization", [{ type: "damageBonus", modifierType: "", field: "", valueType: "number", value: "2", slug: "weapon-specialization", predicate: '[{"gte":["item:proficiency:rank",2]}]' }]);
  const expertise = feat("Alchemical Weapon Expertise", [{ type: "weaponProficiency", valueType: "number", value: "2", slug: "alchemical-bombs", predicate: '["item:group:bomb"]' }]);
  const alchemist = (feats) => pc({ feats, attackProficiencies: { simple: "2", martial: "0", unarmed: "2", other: { name: "Alchemical Bombs", rank: "1" } } });
  assertIncludes("with Alchemical Weapon Expertise: bomb rank 2", traitsFor(alchemist([expertise, specialization]), { weapon: bomb }), "item:proficiency:rank:2");
  const specActive = (record) => lookup(record, ["damageBonus"], "damage", { weapon: bomb }).find((m) => m.slug === "weapon-specialization")?.active;
  assert("... so weapon specialization applies to the bomb", specActive(alchemist([expertise, specialization])), true);
  assert("without it: rank 1, no specialization", [traitsFor(alchemist([specialization]), { weapon: bomb }).includes("item:proficiency:rank:1"), specActive(alchemist([specialization]))], [true, false]);
  assert("comparison resolves the same rank", ctx.resolvePredicateValue("item:proficiency:rank", alchemist([expertise]), { weapon: bomb }, new Set()), 2);
  const sword = weapon("Longsword");
  assertIncludes("unchanged: a longsword reads the martial rank", traitsFor(pc({ attackProficiencies: { martial: "3" } }), { weapon: sword }), "item:proficiency:rank:3");
  // A weaponProficiency predicate that itself reads the rank doesn't loop
  const circular = feat("Circular", [{ type: "weaponProficiency", valueType: "number", value: "3", predicate: '[{"gte":["item:proficiency:rank",2]}]' }]);
  assert("a rank-gated weaponProficiency reads the base rank", ctx.getProfiencyForWeapon(pc({ feats: [circular], attackProficiencies: { martial: "2" } }), "martial", "sword", sword), 3);
}

section("thrown melee Strike atom (Sneak Attack)");
{
  const dagger = (toggle) => weapon("Dagger", { itemCategory: "simple", group: "knife", traits: ["agile", "finesse", "thrown-10"], rangeToggleBtn: toggle, damage: { dice: 1, die: "d4", damageType: "piercing" } });
  const thrown = traitsFor(pc(), { weapon: dagger("ranged") });
  assert("thrown dagger: item:thrown-melee, item:melee kept", ["item:thrown-melee", "item:melee"].every((a) => thrown.includes(a)), true);
  assertNotIncludes("... and not item:ranged (unchanged)", thrown, "item:ranged");
  assertNotIncludes("dagger used in melee: no thrown-melee", traitsFor(pc(), { weapon: dagger("melee") }), "item:thrown-melee");
  const javelin = weapon("Javelin", { itemCategory: "simple", range: 30, traits: ["thrown"], rangeToggleBtn: "ranged" });
  assertNotIncludes("a javelin (ranged weapon) is not a thrown melee weapon", traitsFor(pc(), { weapon: javelin }), "item:thrown-melee");
  const foundry = feat("Sneak Test", [{ type: "damageBonus", modifierType: "none", field: "strike-damage", valueType: "string", value: "1d6 precision", predicate: '[{"or":["item:trait:agile","item:trait:finesse",{"and":["item:ranged",{"not":"item:thrown-melee"}]}]}]' }]);
  const spear = weapon("Spear", { itemCategory: "simple", group: "spear", traits: ["thrown-20"], rangeToggleBtn: "ranged", damage: { dice: 1, die: "d6", damageType: "piercing" } });
  assert("Foundry's predicate: a thrown spear (no agile/finesse) gets no sneak attack", lookup(pc({ feats: [foundry] }), ["damageBonus"], "strike-damage", { weapon: spear })[0]?.active, false);
  assert("... a javelin does", lookup(pc({ feats: [foundry] }), ["damageBonus"], "strike-damage", { weapon: javelin })[0]?.active, true);
}

section("damage type changes: rage, versatile vials, spells");
{
  const rage = { _id: "rage", name: "Rage", rules: [] };
  const rageFeature = feat("Rage", [{ type: "damageBonus", field: "all", modifierType: "", valueType: "number", value: "2", slug: "rage", predicate: '["self:effect:rage"]' }]);
  const spirit = feat("Spirit Instinct", [
    { type: "adjustModifier", targetSlug: "rage", value: "3", valueType: "number", adjustMode: "upgrade", field: "", damageType: "spirit", predicate: '["spirit-rage"]' },
    { type: "weaponRune", modifierType: "none", valueType: "string", value: "Ghost Touch", predicate: '["spirit-rage","self:effect:rage"]' },
  ], { toggleable: true, predicateValue: "spirit-rage" });
  const sword = weapon("Longsword");
  // Effects sit on the record, not its data
  const raging = (record, on = true) => Object.assign(record, on ? { effects: [rage], effectIds: ["rage"] } : {});
  const barbarian = (on, isRaging = true) => raging(pc({ feats: [rageFeature, spirit], inventory: [sword], toggles: on ? [{ name: "Spirit Instinct", data: { predicateValue: "spirit-rage", toggled: true } }] : [] }), isRaging);
  const rageMod = (record) => capturePrompt(() => ctx.performDamageRoll(record, sword, "data.inventory.0", false)).modifiers.find((m) => m.name === "Rage");
  const spiritRage = rageMod(barbarian(true));
  assert("spirit rage: 3 spirit damage", [spiritRage?.value, spiritRage?.type, spiritRage?.active], [3, "spirit", true]);
  const plainRage = rageMod(barbarian(false));
  assert("rage without spirit rage: 2 of the weapon's type", [plainRage?.value, plainRage?.type, plainRage?.active], [2, "slashing", true]);
  const attackRage = (capturePrompt(() => ctx.performAttackRoll(barbarian(true), sword, "data.inventory.0", 1)).metadata.damageModifiers || []).find((m) => m.name === "Rage");
  assert("the attack card's damage carries it too", attackRage?.type, "spirit");
  const dragon = feat("Dragon Option", [{ type: "adjustModifier", targetSlug: "rage", value: "4", valueType: "number", adjustMode: "upgrade", field: "", damageType: "Fire", predicate: '["draconic-rage"]' }]);
  const levelSeven = feat("Dragon Instinct", [{ type: "adjustModifier", targetSlug: "rage", value: "8", valueType: "number", adjustMode: "upgrade", field: "", predicate: '["draconic-rage"]' }]);
  const draconic = raging(pc({ feats: [rageFeature, dragon, levelSeven], inventory: [sword], toggles: [{ name: "Dragon Instinct", data: { predicateValue: "draconic-rage", toggled: true } }] }));
  const dragonRage = rageMod(draconic);
  assert("draconic rage: a higher upgrade without a type keeps the chosen type (8 fire)", [dragonRage?.value, dragonRage?.type], [8, "fire"]);
  const noType = raging(pc({ feats: [rageFeature, levelSeven], inventory: [sword], toggles: [{ name: "Dragon Instinct", data: { predicateValue: "draconic-rage", toggled: true } }] }));
  assert("unchanged: an adjustModifier without damageType keeps the weapon's type", rageMod(noType)?.type, "slashing");

  // Spirit rage: ghost touch (existing weaponRune)
  const categories = (record) => capturePrompt(() => ctx.performDamageRoll(record, sword, "data.inventory.0", false)).metadata.damageCategories;
  assertIncludes("spirit rage: the Strike has ghost touch", categories(barbarian(true)), "ghost-touch");
  assertNotIncludes("not without spirit rage", categories(barbarian(false)), "ghost-touch");
  assertNotIncludes("not while not raging", categories(barbarian(true, false)), "ghost-touch");

  // Bomber's field vials: the versatile vial deals cold, electricity or fire
  const vial = weapon("Versatile Vial", { itemCategory: "simple", group: "bomb", range: 30, traits: ["acid", "alchemical", "bomb", "splash"], splashDamage: 1, damage: { dice: 1, die: "d6", damageType: "acid" } });
  const bomber = feat("Bomber", [
    { type: "weaponDamageType", modifierType: "none", valueType: "string", value: "cold", predicate: '["bomber-field-vials:cold","item:slug:versatile-vial"]' },
    { type: "weaponDamageType", modifierType: "none", valueType: "string", value: "fire", predicate: '["bomber-field-vials:fire","item:slug:versatile-vial"]' },
  ]);
  const alchemist = (option, w = vial) => pc({ feats: [bomber], inventory: [w], toggles: option ? [{ name: `Bomber: ${option}`, data: { predicateValue: `bomber-field-vials:${option}`, toggled: true } }] : [] });
  const fireVial = capturePrompt(() => ctx.performDamageRoll(alchemist("fire"), vial, "data.inventory.0", false));
  assert("Bomber, fire chosen: the vial and its splash deal fire", [fireVial.dice.startsWith("1d6 fire"), fireVial.metadata.damageType, fireVial.metadata.splashDamage], [true, "fire", "1 fire"]);
  assert("nothing chosen: acid", capturePrompt(() => ctx.performDamageRoll(alchemist(""), vial, "data.inventory.0", false)).metadata.damageType, "acid");
  const otherBomb = weapon("Alchemist's Fire", { group: "bomb", range: 20, traits: ["bomb", "fire", "splash"], damage: { dice: 1, die: "d8", damageType: "fire" } });
  assert("another bomb keeps its type", ctx.getAlteredWeapon(alchemist("cold", otherBomb), otherBomb).data.damage.damageType, "fire");
  // Toxicologist: poison damage and trait instead of acid
  const toxicologist = pc({ feats: [feat("Toxicologist", [
    { type: "weaponDamageType", modifierType: "none", valueType: "string", value: "poison", predicate: '["item:slug:versatile-vial"]' },
    { type: "weaponTrait", modifierType: "none", valueType: "string", value: "poison", predicate: '["item:slug:versatile-vial"]' },
    { type: "weaponTrait", modifierType: "none", valueType: "string", value: "-acid", predicate: '["item:slug:versatile-vial"]' },
  ])] });
  const toxic = ctx.getAlteredWeapon(toxicologist, vial);
  assert("Toxicologist: poison damage, poison trait, no acid trait", [toxic.data.damage.damageType, toxic.data.traits.includes("poison"), toxic.data.traits.includes("acid")], ["poison", true, false]);
  assert("the vial record itself is untouched", vial.data.damage.damageType, "acid");

  // Elemental bloodline: Elemental Toss deals the element's damage type
  const toss = { _id: "toss", name: "Elemental Toss", recordType: "spells", data: { level: 1, traits: ["attack", "focus"], damage: [{ data: { formula: "1d8", type: "bludgeoning" } }, { data: { formula: "1", type: "bleed", category: "persistent" } }], heightening: [{ data: { type: "interval", interval: 1, damage: [{ data: { formula: "1d8", type: "bludgeoning" } }] } }] } };
  const air = pc({ feats: [feat("Air", [{ type: "spellDamageType", modifierType: "none", valueType: "string", value: "slashing", predicate: '[{"or":["item:slug:elemental-toss","item:slug:elemental-blast"]}]' }])] });
  const airToss = ctx.getAlteredSpell(air, toss);
  assert("air: Elemental Toss deals slashing (base and heightened)", [airToss.data.damage[0].data.type, airToss.data.heightening[0].data.damage[0].data.type], ["slashing", "slashing"]);
  assert("persistent damage keeps its type", airToss.data.damage[1].data.type, "bleed");
  assert("the spell record itself is untouched", toss.data.damage[0].data.type, "bludgeoning");
  const fireball = { _id: "fb", name: "Fireball", recordType: "spells", data: { level: 3, damage: [{ data: { formula: "6d6", type: "fire" } }] } };
  assert("another spell is returned unchanged", ctx.getAlteredSpell(air, fireball), fireball);
  assert("no modifier: unchanged", ctx.getAlteredSpell(pc(), toss), toss);
  assert("calculateSpellDamage reads the new type", ctx.calculateSpellDamage(air, airToss, "data.spells.0.data.focus.0").damageString, "1d8 slashing");
}

section("Strike materials (Metal Strikes, Adamantine Strikes, Advanced Vials)");
{
  const fist = weapon("Fist", { itemCategory: "unarmed", group: "brawling", traits: ["agile", "finesse", "unarmed"], damage: { dice: 1, die: "d4", damageType: "bludgeoning" } });
  const sword = weapon("Longsword");
  const metal = feat("Metal Strikes", [{ type: "weaponMaterial", modifierType: "none", valueType: "string", value: "cold-iron,silver", predicate: '["item:category:unarmed"]' }]);
  const adamantine = feat("Adamantine Strikes", [{ type: "weaponMaterial", modifierType: "none", valueType: "string", value: "Adamantine", predicate: '["item:category:unarmed"]' }]);
  const monk = pc({ feats: [metal, adamantine], inventory: [fist, sword] });
  const punch = capturePrompt(() => ctx.performDamageRoll(monk, fist, "data.inventory.0", false)).metadata;
  assert("unarmed Strike: cold iron, silver and adamantine damage categories", ["cold-iron", "silver", "adamantine"].every((m) => punch.damageCategories.includes(m)), true);
  assert("... and in damageSource", punch.damageSource.materials, ["cold-iron", "silver", "adamantine"]);
  assertIncludes("... as item:material:* damage atoms", [...ctx.getDamageSourceAtoms({ metadata: punch })], "item:material:silver");
  const swing = capturePrompt(() => ctx.performDamageRoll(monk, sword, "data.inventory.1", false)).metadata;
  assert("a longsword gets none", [swing.damageCategories.includes("silver"), swing.damageSource.materials], [false, undefined]);
  const silverSword = weapon("Silver Longsword", { material: { type: "Silver" } });
  const own = capturePrompt(() => ctx.performDamageRoll(pc({ inventory: [silverSword] }), silverSword, "data.inventory.0", false)).metadata;
  assert("unchanged: a weapon's own material still counts, once", [own.damageCategories.filter((c) => c === "silver").length, own.damageSource.materials], [1, ["silver"]]);
  assertIncludes("its own material is an item atom too", traitsFor(pc(), { weapon: silverSword }), "item:material:silver");
  // The attack card carries the categories to its damage button
  const attack = capturePrompt(() => ctx.performAttackRoll(monk, fist, "data.inventory.0", 1)).metadata;
  assertIncludes("attack card: silver", attack.damageCategories, "silver");
  // Advanced Vials (Bomber): one chosen material
  const vial = weapon("Versatile Vial", { itemCategory: "simple", group: "bomb", range: 30, traits: ["acid", "bomb"], damage: { dice: 1, die: "d6", damageType: "acid" } });
  const vials = feat("Advanced Vials (Bomber)", [{ type: "weaponMaterial", modifierType: "none", valueType: "string", value: "cold-iron", predicate: '["bomber-advanced-vials:cold-iron","item:slug:versatile-vial"]' }]);
  const chosen = pc({ feats: [vials], toggles: [{ name: "Advanced Vials (Bomber): Cold Iron", data: { predicateValue: "bomber-advanced-vials:cold-iron", toggled: true } }] });
  assert("Advanced Vials, cold iron chosen", ctx.getAlteredWeapon(chosen, vial).data.materials, ["cold-iron"]);
  assert("not chosen: no material", ctx.getAlteredWeapon(pc({ feats: [vials] }), vial).data.materials, undefined);
}

// --- engine group G5: character build and Tier 3 -----------------------------

// What onAddEditFeature writes for a record
function recalc(record) {
  const saved = ctx.api.setValuesOnRecord;
  const written = {};
  ctx.api.setValuesOnRecord = (rec, values) => Object.assign(written, values);
  try {
    ctx.onAddEditFeature(record, undefined, true);
  } finally {
    ctx.api.setValuesOnRecord = saved;
  }
  return written;
}
// A heritage whose nested feature carries the given modifiers
const heritage = (name, modifiers) => [
  { name, data: { features: [{ _id: `hf-${name}`, name: `${name} Features`, data: { level: 1, modifiers: modifiers.map((data) => ({ data })) } }] } },
];

section("size from a heritage (Ant Kholo)");
{
  const kholo = (extra = {}) =>
    pc({ size: "medium", ancestries: [{ name: "Kholo", data: { size: "medium", speed: "25 feet", hp: 8 } }], ...extra });
  const small = { type: "creatureSize", modifierType: "none", field: "", active: true, valueType: "string", value: "small" };
  const ant = recalc(kholo({ heritages: heritage("Ant Kholo", [small]) }));
  assert("Ant Kholo: Small", [ant["data.size"], ant["data.computedSize"]], ["small", "small"]);
  assert("Foundry's short spelling (sm) works", recalc(kholo({ heritages: heritage("Ant Kholo", [{ ...small, value: "sm" }]) }))["data.size"], "small");
  const failed = recalc(kholo({ heritages: heritage("Ant Kholo", [{ ...small, predicate: '["self:effect:shrink"]' }]) }));
  assert("a failed predicate leaves the size alone", failed["data.size"], undefined);
  const plain = recalc(kholo({ heritages: heritage("Dog Kholo", []) }));
  assert("unchanged: no size modifier, nothing written", [plain["data.size"], plain["data.computedSize"]], [undefined, undefined]);
  const back = recalc(kholo({ size: "small", computedSize: "small", heritages: heritage("Dog Kholo", []) }));
  assert("the modifier gone: back to the ancestry's size", [back["data.size"], back["data.computedSize"]], ["medium", ""]);
  const handEdited = recalc(kholo({ size: "large", computedSize: "small", heritages: [] }));
  assert("a size changed by hand is kept", handEdited["data.size"], undefined);
}

section("extra languages from a heritage (Nomadic Halfling)");
{
  const base = ctx.getWizardLanguages(pc()).extraCount;
  const nomadic = { type: "extraLanguages", modifierType: "none", field: "", active: true, valueType: "number", value: "2" };
  assert("Nomadic Halfling: 2 more", ctx.getWizardLanguages(pc({ heritages: heritage("Nomadic Halfling", [nomadic]) })).extraCount - base, 2);
  assert("a failed predicate adds none", ctx.getWizardLanguages(pc({ heritages: heritage("Nomadic Halfling", [{ ...nomadic, predicate: '["feat:nothing"]' }]) })).extraCount, base);
  assert("unchanged without one", ctx.getWizardLanguages(pc({ heritages: heritage("Gutsy Halfling", []) })).extraCount, base);
}

section("removing a trait (Fungus Leshy)");
{
  const leshy = (modifiers) =>
    pc({
      traits: ["Leshy", "Plant"],
      traitsList: [{ _id: "1", name: "Leshy", data: {} }, { _id: "2", name: "Plant", data: {} }],
      heritages: heritage("Fungus Leshy", modifiers),
    });
  const fungus = { type: "trait", modifierType: "none", field: "Fungus", active: true, valueType: "string", value: "" };
  const noPlant = { type: "trait", modifierType: "none", field: "", active: true, valueType: "string", value: "-plant" };
  const written = recalc(leshy([fungus, noPlant]));
  assert("Fungus Leshy: fungus added, plant removed", written["data.traits"], ["Leshy", "Fungus"]);
  assert("... from the traits list too", written["data.traitsList"].map((t) => t.name), ["Leshy", "Fungus"]);
  assert("a -trait in the field works too", recalc(leshy([{ ...noPlant, field: "-Plant", value: "" }]))["data.traits"], ["Leshy"]);
  assert("unchanged: adding only", recalc(leshy([fungus]))["data.traits"], ["Leshy", "Plant", "Fungus"]);
  assert("a removal whose predicate fails removes nothing", recalc(leshy([{ ...noPlant, predicate: '["self:effect:wilt"]' }]))["data.traits"], undefined);
}

section("toggles that turn each other off across features (Precision)");
{
  const precision = { ...feat("Precision", []), data: { type: "class", level: 1, toggleOptions: [{ name: "First hit", data: { predicateValue: "precision-hunters-edge", group: "shared:precision-hunters-edge" } }] } };
  const masterful = { ...feat("Masterful Hunter (Precision)", []), data: { type: "class", level: 1, toggleOptions: [
    { name: "Second hit", data: { predicateValue: "precision-hunters-edge:second-hit", group: "shared:precision-hunters-edge" } },
    { name: "Third hit", data: { predicateValue: "precision-hunters-edge:third-hit", group: "shared:precision-hunters-edge" } },
  ] } };
  const own = { ...feat("Bomber", []), data: { type: "class", level: 1, toggleOptions: [{ name: "Fire", data: { predicateValue: "bomber:fire", group: "vials" } }] } };
  const written = {};
  ctx.updateTogglesList(pc({ feats: [precision, masterful, own] }), written);
  const toggles = written["data.toggles"];
  assert("a shared group is the same on both features", toggles.filter((t) => t.data.group === "shared:precision-hunters-edge").length, 3);
  assert("unchanged: another group stays the feature's own", toggles.find((t) => t.name === "Bomber: Fire").data.group, "Bomber|vials");
  // Turning on the second hit turns off Precision's first hit (toggle-list.html)
  const html = fs.readFileSync(`${__dirname}/../toggle-list.html`, "utf8");
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]).runInContext(ctx);
  toggles.forEach((t) => (t.data.toggled = t.name === "Precision: First hit"));
  const savedRecord = ctx.record;
  const saved = { getValue: ctx.api.getValue, setValues: ctx.api.setValues, dataPath: ctx.dataPath };
  ctx.record = { ...pc(), data: { ...pc().data, toggles } };
  const second = toggles.findIndex((t) => t.name === "Masterful Hunter (Precision): Second hit");
  let set = {};
  ctx.dataPath = `data.toggles.${second}.data.toggled`;
  ctx.api.getValue = () => toggles[second];
  ctx.api.setValues = (values) => (set = values);
  ctx.onToggleChanged(true);
  const first = toggles.findIndex((t) => t.name === "Precision: First hit");
  assert("second hit on: Precision's first hit off", [set[`data.toggles.${second}.data.toggled`], set[`data.toggles.${first}.data.toggled`]], [true, false]);
  ctx.record = savedRecord;
  ctx.api.getValue = saved.getValue;
  ctx.api.setValues = saved.setValues;
  ctx.dataPath = saved.dataPath;
}

section("a Speed modifier to all Speeds (Curse of Inclement Headwinds)");
{
  const speedWith = (mods, extra = {}) => {
    const record = { ...pc({ feats: [feat("Mover", mods)] }), ...extra };
    const written = {};
    ctx.updateAttribute({ record, attribute: "str", value: 2, moreValuesToSet: written });
    return written["data.speed"] ?? record.data.speed;
  };
  const climb = { type: "speed", field: "climb", value: "20" };
  const headwinds = { type: "speedPenalty", modifierType: "status", field: "all-speeds", active: true, valueType: "number", value: "-10", predicate: '["self:condition:cursebound:4"]' };
  const cursebound = (n) => ({ effects: [{ _id: "cb", name: "Cursebound", rules: [] }], effectIds: Array(n).fill("cb") });
  assert("cursebound 4: -10 to land and climb Speed", speedWith([climb, headwinds], cursebound(4)), "15 feet, climb 10 feet");
  assert("cursebound 3: no penalty", speedWith([climb, headwinds], cursebound(3)), "25 feet, climb 20 feet");
  assert("not below 5 feet", speedWith([{ type: "speed", field: "fly", value: "10" }, headwinds], cursebound(4)), "15 feet, fly 5 feet");
  assert("unchanged: field '' is land Speed only", speedWith([climb, { ...headwinds, field: "" }], cursebound(4)), "15 feet, climb 20 feet");
  assert("a bonus to all Speeds adds to each", speedWith([climb, { ...headwinds, type: "speedBonus", value: "5", predicate: "" }]), "30 feet, climb 25 feet");
}

section("AC against the attacker (Outwit)");
{
  const outwit = feat("Outwit", [{ type: "armorClassBonus", modifierType: "circumstance", field: "", active: true, valueType: "number", value: "1", slug: "outwit", predicate: '["origin:mark:hunted-prey"]' }]);
  const masterful = feat("Masterful Hunter (Outwit)", [{ type: "adjustModifier", targetSlug: "outwit", value: "2", valueType: "number", adjustMode: "upgrade", active: true, field: "",
    predicate: '[{"or":[{"and":["self:armor:category:light",{"gte":["actor:armor:light:rank",3]}]},{"and":["self:armor:category:medium",{"gte":["actor:armor:medium:rank",3]}]},{"and":["self:armor:category:heavy",{"gte":["actor:armor:heavy:rank",3]}]},{"and":["self:armor:category:unarmored",{"gte":["actor:armor:unarmored:rank",3]}]}]}]' }]);
  const steelShield = { _id: "s", name: "Steel Shield", data: { type: "shield", carried: "equipped", acBonus: 2, hardness: 5, hp: { value: 20, max: 20 } } };
  const ranger = (extra = {}) => {
    const record = pc({ feats: [outwit], ...extra });
    const written = {};
    ctx.updateAttribute({ record, attribute: "dex", value: 3, moreValuesToSet: written });
    record.data.ac = written["data.ac"];
    return record;
  };
  const prey = (appliedBy = "pc") => ({ _id: "prey", recordType: "npcs", data: { level: 4, traits: ["Undead"] }, effects: [{ _id: "hp1", name: "Hunt Prey", rules: [{ type: "tokenMark", value: "hunted-prey" }] }], effectValues: { hp1: { tokenId: appliedBy } } });
  const stranger = { _id: "x", recordType: "npcs", data: { level: 4, traits: [] }, effects: [], effectValues: {} };
  const r = ranger();
  const base = ctx.getArmorClassForToken(r);
  assert("the sheet AC leaves Outwit out", ctx.getArmorClassForToken(r, false, stranger), base);
  const reasons = [];
  assert("the prey attacks: +1", ctx.getArmorClassForToken(r, false, prey(), reasons) - base, 1);
  assert("... named", reasons, ["Outwit"]);
  assert("a mark another ranger applied: no bonus", ctx.getArmorClassForToken(r, false, prey("someone-else")), base);
  assertIncludes("attacker atoms: the mark, traits, level, type", ctx.getOriginAtoms(r, prey()), "origin:trait:undead");
  const shielded = ranger({ inventory: [steelShield], shieldRaised: "true" });
  const shieldBase = ctx.getArmorClassForToken(shielded);
  assert("behind a raised steel shield (+2 circumstance): no change", ctx.getArmorClassForToken(shielded, false, prey()), shieldBase);
  const master = ranger({ feats: [outwit, masterful], defenses: { unarmored: 3 } });
  assert("Masterful Hunter, master unarmored defense: +2", ctx.getArmorClassForToken(master, false, prey()) - ctx.getArmorClassForToken(master), 2);
  const expert = ranger({ feats: [outwit, masterful], defenses: { unarmored: 2 } });
  assert("... expert only: +1", ctx.getArmorClassForToken(expert, false, prey()) - ctx.getArmorClassForToken(expert), 1);
  const flanked = ctx.getArmorClassForToken(r, true, prey());
  assert("flanked and the prey: -2 and +1", flanked - base, -1);
  // An NPC defender takes its own origin modifiers
  const npc = { _id: "n", recordType: "npcs", data: { attributes: { ac: { value: 20 } }, features: [{ name: "Ghost Ward", data: { modifiers: [{ data: { type: "armorClassBonus", modifierType: "status", field: "", valueType: "number", value: "2", predicate: '["origin:trait:undead"]' } }] } }] }, effects: [] };
  assert("NPC: +2 status vs undead attackers", [ctx.getArmorClassForToken(npc), ctx.getArmorClassForToken(npc, false, prey()), ctx.getArmorClassForToken(npc, false, stranger)], [20, 22, 20]);
  // The attack card: AC against us, with the reason
  const sword = weapon("Longsword");
  const realTargets = ctx.api.getTargets;
  const realToken = ctx.api.getToken;
  ctx.api.getTargets = () => [{ token: r, distance: 5 }];
  ctx.api.getToken = () => prey();
  const card = capturePrompt(() => ctx.performAttackRoll(pc({ inventory: [sword] }), sword, "data.inventory.0", 1)).metadata;
  assert("attack card: AC +1 and named", [card.dc - base, card.dcName], [1, "AC (Outwit)"]);
  ctx.api.getToken = () => stranger;
  const plainCard = capturePrompt(() => ctx.performAttackRoll(pc({ inventory: [sword] }), sword, "data.inventory.0", 1)).metadata;
  assert("unchanged: another attacker, plain AC", [plainCard.dc, plainCard.dcName], [base, undefined]);
  ctx.api.getTargets = realTargets;
  ctx.api.getToken = realToken;
  // A spell attack against the ranger, from the prey
  const ray = { name: "Ray", data: { defense: { passive: { statistic: "ac" } }, traits: [], damage: [] } };
  const spellCard = (attacker, target) => {
    const caster = { ...pc(), _id: "caster" };
    const macro = ctx.getSpellAttackMacro(caster, ray, { data: { dc: 20, attribute: "cha", attack: 10 } }, "data.spells.0", null);
    const body = String(macro).replace(/^```Roll_Attack\n/, "").replace(/```\s*$/, "");
    const saved = { ...ctx.api };
    let captured = null;
    ctx.api.getRecord = (type, id, cb) => cb(caster);
    ctx.api.getValueOnRecord = (r, path) => (path === "data.spells.0" ? ray : null);
    ctx.api.getTargets = () => [{ token: target, distance: 30 }];
    ctx.api.getToken = () => attacker;
    ctx.api.promptRoll = (name, dice, modifiers, metadata) => (captured = { modifiers, metadata });
    try {
      new vm.Script(body, { filename: "spell-attack-macro.js" }).runInContext(ctx);
    } finally {
      Object.assign(ctx.api, saved);
    }
    return captured;
  };
  const spellVsRanger = spellCard(prey(), r);
  assert("spell attack from the prey: AC +1, named", [spellVsRanger?.metadata.dc - base, spellVsRanger?.metadata.dcName], [1, "AC (Outwit)"]);
  const spellPlain = spellCard(stranger, r);
  assert("unchanged: from another caster", [spellPlain?.metadata.dc, spellPlain?.metadata.dcName], [base, "AC"]);
  const swiftAlly = { ...pc({ ac: 20 }), effects: [{ _id: "bs", name: "Blessed Swiftness", rules: [{ type: "armorClassBonus-status", field: "", valueType: "number", value: "2", data: { predicate: ["trigger:movement"] } }] }], effectIds: ["bs"] };
  const spellVsSwift = spellCard(stranger, swiftAlly);
  assert("spell attack vs Blessed Swiftness: the unticked -2", spellVsSwift?.modifiers.some((m) => m.name.startsWith("Target AC +2") && m.active === false && m.value === -2), true);
}

section("forced movement (Sky's Call, Rock Dwarf)");
{
  assertIncludes("Shove is forced movement", traitsFor(pc(), { action: { name: "Shove" } }), "forced-movement");
  assertIncludes("Reposition is forced movement", traitsFor(pc(), { action: { name: "Reposition" } }), "forced-movement");
  assertNotIncludes("Trip is not", traitsFor(pc(), { action: { name: "Trip" } }), "forced-movement");
  const cursebound = { effects: [{ _id: "cb", name: "Cursebound", rules: [] }], effectIds: ["cb", "cb"] };
  const skysCall = feat("Curse of the Sky's Call", [
    { type: "saveBonus", modifierType: "status", field: "all", active: true, valueType: "number", value: "-@actor.conditions.cursebound.value", predicate: '["forced-movement","self:condition:cursebound"]' },
    { type: "saveDCPenalty", modifierType: "status", field: "saving-throw", active: true, valueType: "number", value: "@actor.conditions.cursebound.value", predicate: '["forced-movement","self:condition:cursebound"]' },
  ]);
  const oracle = { ...pc({ feats: [skysCall], fortitudeMod: 8 }), ...cursebound };
  const dc = (action) => ctx.getDefenseDCForToken(oracle, "fortitude", { action: { name: action } });
  assert("Sky's Call, cursebound 2: Shove DC -2", dc("Shove"), 16);
  assert("Reposition too", dc("Reposition"), 16);
  assert("Grapple: unchanged", dc("Grapple"), 18);
  const save = (options) => capturePrompt(() => ctx.rollSave(oracle, "fortitude", 20, true, false, options)).modifiers.find((m) => m.name.startsWith("Curse of the Sky's Call"));
  assert("a save against a forced-movement spell: -2 applied", [save({ traits: ["Air", "forced-movement"] })?.active, save({ traits: ["Air", "forced-movement"] })?.value], [true, "-2"]);
  const unknown = save({});
  assert("an unflagged save: offered unticked as vs forced movement", [unknown?.active, unknown?.name], [false, "Curse of the Sky's Call (vs forced movement)"]);
  // The spell's Forces Movement box passes the trait to its save button
  const gust = { _id: "g", name: "Gust of Wind", recordType: "spells", data: { traits: ["Air"], defense: { save: { statistic: "fortitude", forcedMovement: true } } } };
  assert("a spell with Forces Movement: its save button passes forced-movement", ctx.getSpellSaveMacro(pc(), gust, { data: { dc: 20 } }).includes('"forced-movement"'), true);
  const plainSpell = { ...gust, data: { ...gust.data, defense: { save: { statistic: "fortitude" } } } };
  assert("unchanged without it", ctx.getSpellSaveMacro(pc(), plainSpell, { data: { dc: 20 } }).includes("forced-movement"), false);
  // Rock Dwarf: half the distance, as a note on the Shove against it
  const rockNote = { type: "rollNote", modifierType: "none", field: "forced-movement", active: true, valueType: "string", value: "Moved only half the distance (5 feet).", outcome: "criticalSuccess" };
  const rockSave = { type: "saveBonus", modifierType: "circumstance", field: "all", active: true, valueType: "number", value: "2", predicate: '[{"or":["inflicts:prone","forced-movement"]}]' };
  const dwarf = { ...pc({ fortitudeMod: 7, heritages: heritage("Rock Dwarf", [rockNote, rockSave]) }), _id: "dwarf", name: "Torgga" };
  const realTargets = ctx.api.getTargets;
  ctx.api.getTargets = () => [{ token: dwarf, distance: 5 }];
  const shove = capturePrompt(() => ctx.performSkillAction(pc(), "athletics", "Shove")).metadata;
  const note = (shove.notes || []).find((n) => n.text.startsWith("Moved only half"));
  assert("Shove vs a Rock Dwarf: the note, for a critical success", [!!note, note?.outcome], [true, [2]]);
  assert("the note shows on a critical success only", [ctx.getRollNotesText([note], 2).includes("Moved only half"), ctx.getRollNotesText([note], 1)], [true, ""]);
  assert("Trip: no note", (capturePrompt(() => ctx.performSkillAction(pc(), "athletics", "Trip")).metadata.notes || []).length, 0);
  ctx.api.getTargets = realTargets;
  assert("the dwarf's own Athletics doesn't show it", (capturePrompt(() => ctx.rollSkill(dwarf, "athletics")).metadata.notes || []).length, 0);
  const dwarfSave = capturePrompt(() => ctx.rollSave(dwarf, "reflex", 20, true, false, { traits: ["forced-movement"] })).modifiers.find((m) => m.name.startsWith("Rock Dwarf"));
  assert("Rock Dwarf: +2 to a save against forced movement", dwarfSave?.active, true);
}

section("climbing (Shortshanks Hobgoblin)");
{
  const climbing = { _id: "cl", name: "Climbing", rules: [] };
  const offGuard = { _id: "og", name: "Off-Guard", rules: [{ type: "armorClassPenalty-circumstance", field: "", valueType: "number", value: "2" }] };
  const npc = (effects, data = {}) => ({ _id: "n", recordType: "npcs", data: { attributes: { ac: { value: 20 } }, ...data }, effects, effectIds: effects.map((e) => e._id) });
  assert("climbing without a climb Speed: off-guard, AC 18", [ctx.isOffGuard(npc([climbing])), ctx.getArmorClassForToken(npc([climbing]))], [true, 18]);
  assert("with a climb Speed: not", [ctx.isOffGuard(npc([climbing], { speeds: [{ data: { type: "climb", value: 20 } }] })), ctx.getArmorClassForToken(npc([climbing], { speeds: [{ data: { type: "climb", value: 20 } }] }))], [false, 20]);
  assert("a character's climb Speed counts", ctx.isOffGuard({ ...pc({ otherSpeeds: { climb: 25 } }), effects: [climbing] }), false);
  assert("climbing and flanked: still 18", ctx.getArmorClassForToken(npc([climbing]), true), 18);
  assert("climbing and Off-Guard: still 18", ctx.getArmorClassForToken(npc([climbing, offGuard])), 18);
  assert("unchanged: not climbing", [ctx.isOffGuard(npc([])), ctx.getArmorClassForToken(npc([]))], [false, 20]);
  const shortshanks = { type: "offGuardPrevention", modifierType: "none", field: "climbing", active: true, valueType: "string", value: "all" };
  const hobgoblin = (modifiers) => ({ ...pc({ ac: 20, heritages: heritage("Shortshanks Hobgoblin", modifiers) }), effects: [climbing], effectIds: ["cl"] });
  assert("Shortshanks: not off-guard while climbing", [ctx.isOffGuard(hobgoblin([shortshanks])), ctx.getArmorClassForToken(hobgoblin([shortshanks]))], [false, 20]);
  const denyAdvantage = { type: "offGuardPrevention", valueType: "string", value: "Character Level", active: true };
  assert("a prevention with no field (Deny Advantage) doesn't cover climbing", ctx.isOffGuard(hobgoblin([denyAdvantage])), true);
  // Sneak attack and the attack card see it
  const realTargets = ctx.api.getTargets;
  ctx.api.getTargets = () => [{ token: npc([climbing]), distance: 5 }];
  const card = capturePrompt(() => ctx.performAttackRoll(pc({ inventory: [weapon("Rapier")] }), weapon("Rapier"), "data.inventory.0", 1)).metadata;
  assert("attack card: off-guard, AC 18", [card.isOffGuard, card.dc], [true, 18]);
  ctx.api.getTargets = realTargets;
}

section("reactions to movement (Blessed Swiftness)");
{
  const aura = (predicate) => ({ _id: "bs", name: "Blessed Swiftness", rules: [
    { type: "armorClassBonus-status", field: "", valueType: "number", value: "2", data: { predicate } },
    { type: "saveBonus-status", field: "reflex", valueType: "number", value: "2", data: { predicate } },
  ] });
  const ally = (effects, feats = []) => ({ ...pc({ ac: 20, feats }), effects, effectIds: effects.map((e) => e._id) });
  const swift = ally([aura(["trigger:movement"])]);
  assert("the aura's +2 isn't in AC", ctx.getArmorClassForToken(swift), 20);
  assert("... it applies against a reaction to movement", ctx.getArmorClassForToken(swift, false, null, null, { trigger: "movement" }), 22);
  const options = ctx.getTargetSituationalAcModifiers(swift);
  assert("offered to the attacker unticked: -2", [options.length, options[0]?.value, options[0]?.active], [1, -2, false]);
  assert("... named for the aura", options[0]?.name, "Target AC +2 (Blessed Swiftness, vs reaction to movement)");
  assert("no aura: nothing offered", ctx.getTargetSituationalAcModifiers(ally([])), []);
  const statusBonus = { _id: "sb", name: "Bulwark", rules: [{ type: "armorClassBonus-status", field: "", valueType: "number", value: "1" }] };
  assert("a +1 status AC bonus already there: only +1 more", ctx.getTargetSituationalAcModifiers(ally([aura(["trigger:movement"]), statusBonus]))[0]?.value, -1);
  // The old predicate, the feat's own name, never applied (effect rules are
  // read before feature names become atoms), even against a reaction
  const sameFeature = [feat("Blessed Swiftness", [])];
  assert("old predicate: never on, even for an ally with the feature", ctx.getArmorClassForToken(ally([aura(["blessed-swiftness"])], sameFeature), false, null, null, { trigger: "movement" }), 20);
  assert("new predicate: an ally with the feature still gets it only vs movement", [ctx.getArmorClassForToken(ally([aura(["trigger:movement"])], sameFeature)), ctx.getTargetSituationalAcModifiers(ally([aura(["trigger:movement"])], sameFeature)).length], [20, 1]);
  const reflex = capturePrompt(() => ctx.rollSave(swift, "reflex")).modifiers.find((m) => m.name === "Blessed Swiftness");
  assert("saves: offered unticked", reflex?.active, false);
  // The attack prompt
  const realTargets = ctx.api.getTargets;
  ctx.api.getTargets = () => [{ token: swift, distance: 5 }];
  const sword = weapon("Longsword");
  const prompt = capturePrompt(() => ctx.performAttackRoll(pc({ inventory: [sword] }), sword, "data.inventory.0", 1));
  const line = prompt.modifiers.find((m) => m.name.startsWith("Target AC +2"));
  assert("Strike prompt: the unticked -2, AC as written", [line?.value, line?.active, prompt.metadata.dc], [-2, false, 20]);
  ctx.api.getTargets = () => [{ token: ally([]), distance: 5 }];
  assert("unchanged: no line without the aura", capturePrompt(() => ctx.performAttackRoll(pc({ inventory: [sword] }), sword, "data.inventory.0", 1)).modifiers.some((m) => m.name.startsWith("Target AC")), false);
  ctx.api.getTargets = realTargets;
  // Mounted: the champion's Speed bonus stops, by the toggle or the Mounted effect
  const speedFor = (extra) => {
    const blessed = { ...feat("Blessed Swiftness", [{ type: "speedBonus", modifierType: "status", field: "", active: true, valueType: "number", value: "5", slug: "blessed-swiftness", predicate: '[{"not":"self:mounted"},{"not":"self:effect:mounted"}]' }]), data: { type: "class", level: 1, toggleOptions: [{ name: "Mounted", data: { predicateValue: "self:mounted" } }], modifiers: [{ data: { type: "speedBonus", modifierType: "status", field: "", active: true, valueType: "number", value: "5", slug: "blessed-swiftness", predicate: '[{"not":"self:mounted"},{"not":"self:effect:mounted"}]' } }] } };
    const record = { ...pc({ feats: [blessed], toggles: extra.toggles || [] }), ...(extra.effects ? { effects: extra.effects, effectIds: extra.effectIds } : {}) };
    const written = {};
    ctx.updateAttribute({ record, attribute: "str", value: 2, moreValuesToSet: written });
    return written["data.speed"] ?? record.data.speed;
  };
  assert("on foot: +5", speedFor({}), "30 feet");
  assert("Mounted toggle on: no bonus", speedFor({ toggles: [{ name: "Blessed Swiftness: Mounted", data: { predicateValue: "self:mounted", toggled: true } }] }), "25 feet");
  assert("the Mounted effect: no bonus", speedFor({ effects: [{ _id: "m", name: "Mounted", rules: [] }], effectIds: ["m"] }), "25 feet");
}

section("Rage temporary HP and Superstition Instinct");
{
  const rage = { _id: "rage", name: "Rage", recordType: "actions", data: { actionType: "action", actions: "oneAction", traits: ["Barbarian", "Concentrate", "Emotion", "Mental"], level: 1, description: "<p>You rage.</p>",
    modifiers: [{ data: { type: "actionTempHp", modifierType: "none", field: "", active: true, valueType: "string", value: "@actor.level+@actor.abilities.con.mod", predicate: '["action:rage",{"not":"self:effect:rage-temporary-hit-points-immunity"}]' } }] } };
  const superstition = feat("Superstition Instinct", [
    { type: "actionHealing", modifierType: "none", field: "Superstitious Resilience (Used)", active: true, valueType: "string", value: "@tempHp", predicate: '["action:rage",{"not":"self:effect:superstitious-resilience-used"}]' },
    { type: "onMagicAccepted", modifierType: "none", field: "", active: true, valueType: "string", value: "frightened:1", predicate: '["self:effect:rage"]' },
  ]);
  const barbarian = (feats, effects = []) => ({ ...pc({ con: 3, feats, actions: [rage], curhp: 10, hitpoints: 60 }), effects, effectIds: effects.map((e) => e._id) });
  const macros = (creature, action = rage) => {
    const saved = ctx.record;
    ctx.record = creature;
    try {
      return ctx.getActionHealingMacros(action);
    } finally {
      ctx.record = saved;
    }
  };
  const both = macros(barbarian([superstition]));
  assert("Rage: temporary HP level + Con (8), and Superstition heals the same", [both.includes("applyActionTemporaryHitPoints(8, \"Rage\")"), both.includes("applyActionHealing(8, \"Superstition Instinct\", [\"Superstitious Resilience (Used)\"])")], [true, true]);
  const immune = macros(barbarian([superstition], [{ _id: "im", name: "Rage Temporary Hit Points Immunity", rules: [] }]));
  assert("no temporary HP from Rage: nothing to regain either", immune, "");
  const cooling = macros(barbarian([superstition], [{ _id: "cd", name: "Superstitious Resilience (Used)", rules: [] }]));
  assert("within 10 minutes: temporary HP only", [cooling.includes("Apply_Temporary_HP_8"), cooling.includes("Apply_Healing")], [true, false]);
  assert("another barbarian: temporary HP only", macros(barbarian([])).includes("Apply_Healing"), false);
  assert("another action: no buttons", macros(barbarian([superstition]), { _id: "s", name: "Stride", data: {} }), "");
  // useAction puts them on the card
  ctx.__state.messages = [];
  const savedRecord = ctx.record;
  ctx.record = barbarian([superstition]);
  ctx.api.richTextToMarkdown = (text) => text;
  ctx.useAction(rage);
  delete ctx.api.richTextToMarkdown;
  ctx.record = savedRecord;
  assert("the Rage card has both buttons", [ctx.__state.messages[0].includes("Apply_Temporary_HP_8"), ctx.__state.messages[0].includes("Apply_Healing_8")], [true, true]);
  // The buttons
  const token = { ...barbarian([superstition]), _id: "tok", recordType: "characters" };
  const saved = { sel: ctx.api.getSelectedOrDroppedToken, setOn: ctx.api.setValueOnToken, prompt: ctx.api.showPrompt, add: ctx.api.addEffect, addAll: ctx.api.addEffects, byId: ctx.api.addEffectById };
  const calls = [];
  ctx.api.getSelectedOrDroppedToken = () => [token];
  ctx.api.setValueOnToken = (t, path, value) => calls.push([path, value]);
  ctx.api.addEffect = (name) => calls.push(["effect", name]);
  ctx.api.addEffects = (names) => calls.push(["effects", names]);
  ctx.api.addEffectById = (id) => calls.push(["effectById", id]);
  ctx.applyActionTemporaryHitPoints(8, "Rage");
  // One write, with where they came from (class-extras.js)
  assert("Apply temporary HP", ctx.__state.lastSet, { "data.tempHp": 8, "data.tempHpSource": { name: "Rage", amount: 8 } });
  ctx.__state.lastSet = null;
  calls.length = 0;
  ctx.applyActionHealing(8, "Superstition Instinct", ["Superstitious Resilience (Used)"]);
  assert("Apply healing: 10 -> 18 HP, and the cooldown", [ctx.__state.lastSet?.["data.curhp"], calls[0]], [18, ["effect", "Superstitious Resilience (Used)"]]);
  // Accepting magic while raging
  let prompted = null;
  ctx.api.showPrompt = (title, message, placeholder, options, query, onSelect) => (prompted = { title, onSelect });
  const raging = { ...barbarian([superstition], [{ _id: "rg", name: "Rage", rules: [] }]), _id: "tok" };
  ctx.__state.lastSet = null;
  calls.length = 0;
  ctx.applyHealingToToken(raging, 5, { isSpell: true, source: "Heal" });
  assert("magical healing while raging: asked first, nothing applied yet", [prompted?.title, ctx.__state.lastSet], ["Accept the Magic?", null]);
  prompted.onSelect("decline");
  assert("declined: nothing", [ctx.__state.lastSet, calls.length], [null, 0]);
  prompted.onSelect("accept");
  assert("accepted: healed and frightened 1", [ctx.__state.lastSet?.["data.curhp"], calls[0]], [15, ["effects", ["Frightened"]]]);
  prompted = null;
  ctx.__state.lastSet = null;
  ctx.applyHealingToToken(raging, 5, { source: "Treat Wounds" });
  assert("non-magical healing: no question", [prompted, ctx.__state.lastSet?.["data.curhp"]], [null, 15]);
  ctx.__state.lastSet = null;
  ctx.applyHealingToToken({ ...barbarian([superstition]), _id: "tok" }, 5, { isSpell: true });
  assert("not raging: no question", [prompted, ctx.__state.lastSet?.["data.curhp"]], [null, 15]);
  // A lasting magical effect from an action's Apply button: frightened can't drop below 1 while it lasts
  calls.length = 0;
  ctx.applyEffectButton("bless", "Bless", raging, undefined, 1, true);
  prompted.onSelect("accept");
  assert("accepted effect: applied, frightened 1, floor while it lasts", calls, [["effectById", "bless"], ["effects", ["Frightened"]], ["data.frightenedFloors", [{ effectId: "bless", value: 1 }]]]);
  const withFloor = (effects) => ({ ...raging, effects, data: { ...raging.data, frightenedFloors: [{ effectId: "bless", value: 1 }] } });
  assert("the floor holds while the effect lasts", ctx.getFrightenedFloor(withFloor([{ _id: "bless", name: "Bless" }])), 1);
  assert("... and goes with it", ctx.getFrightenedFloor(withFloor([])), 0);
  prompted = null;
  calls.length = 0;
  ctx.applyEffectButton("bless", "Bless", raging, undefined, 1, false);
  assert("unchanged: a non-magical button applies at once", [prompted, calls[0]], [null, ["effectById", "bless"]]);
  assert("an action's magical traits mark its buttons", ctx.getEffectMacrosFor([JSON.stringify({ _id: "b", name: "Bless" })], "", true).includes(", 1, true);"), true);
  assert("unchanged: other actions' buttons", ctx.getEffectMacrosFor([JSON.stringify({ _id: "b", name: "Bless" })], "").includes(", 1);"), true);
  Object.assign(ctx.api, { getSelectedOrDroppedToken: saved.sel, setValueOnToken: saved.setOn, showPrompt: saved.prompt, addEffect: saved.add, addEffects: saved.addAll, addEffectById: saved.byId });
}

process.exitCode = summary();
