// Tests for PF2e Immunities / Weaknesses / Resistances (IWR) damage application
// Exercises rollhandlers/common.js applyDamage() end-to-end.
// Run: node tests/test-iwr.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

// --- helpers --------------------------------------------------------------

const START_HP = 1000; // large so HP never hits 0 (avoids dying/death branches)

// Build an NPC target with the given IWR data. recordType "npcs" skips the
// character-only armor path in applyDamage.
function makeTarget(data) {
  return {
    _id: "target",
    recordType: "npcs",
    name: "Target",
    record: { name: "Target" },
    identified: true,
    effects: [],
    data: Object.assign({ curhp: START_HP, hitpoints: START_HP }, data),
  };
}

// Apply a roll and return how much damage was actually dealt (HP lost).
function damageDealt(target, roll, { half = false } = {}) {
  ctx.__state.lastSet = null;
  ctx.applyDamage(target, roll, half, null, false);
  const set = ctx.__state.lastSet || {};
  const newHp = "data.curhp" in set ? set["data.curhp"] : START_HP;
  return START_HP - newHp;
}

// A single-type damage roll, e.g. roll("fire", 10) -> 10 fire damage.
function roll(type, value, { traits = [], categories = [], critical = false } = {}) {
  return {
    types: [{ die: 6, value, type }],
    dice: [{ type: 6, value }],
    total: value,
    metadata: { traits, damageCategories: categories, damageType: type, critical },
  };
}

// A multi-type damage roll from [type, value] pairs.
function multiRoll(pairs, { traits = [], categories = [], damageType, critical = false } = {}) {
  return {
    types: pairs.map(([type, value]) => ({ die: 6, value, type })),
    dice: pairs.map(([, value]) => ({ type: 6, value })),
    total: pairs.reduce((s, [, v]) => s + v, 0),
    metadata: {
      traits,
      damageCategories: categories,
      damageType: damageType || pairs[0][0],
      critical,
    },
  };
}

const res = (type, value, extra = {}) => ({ data: { type, value, ...extra } });
const weak = (type, value, extra = {}) => ({ data: { type, value, ...extra } });
const imm = (type, extra = {}) => ({ data: { type, ...extra } });

// --- Resistances ----------------------------------------------------------

section("Resistances — specific type");
{
  const t = makeTarget({ resistances: [res("fire", 5)] });
  assert("fire 10 vs fire-resist-5 -> 5", damageDealt(t, roll("fire", 10)), 5);
  assert("cold 10 vs fire-resist-5 -> 10 (other type unaffected)", damageDealt(t, roll("cold", 10)), 10);
  assert("fire 3 vs fire-resist-5 -> 0 (cannot go negative)", damageDealt(t, roll("fire", 3)), 0);
}

section("Resistances — all damage");
{
  const t = makeTarget({ resistances: [res("all damage", 5)] });
  assert("fire 10 vs all-damage-5 -> 5", damageDealt(t, roll("fire", 10)), 5);
  assert("slashing 10 vs all-damage-5 -> 5", damageDealt(t, roll("slashing", 10)), 5);
  // hyphenated spelling resolves the same way
  const t2 = makeTarget({ resistances: [res("all-damage", 5)] });
  assert("fire 10 vs all-damage(hyphen)-5 -> 5", damageDealt(t2, roll("fire", 10)), 5);
}

section("Resistances — all damage with exception (the reported bug)");
{
  const t = makeTarget({ resistances: [res("all damage", 5, { exceptions: ["force"] })] });
  assert("force 10 vs all-damage-5-except-force -> 10 (excepted, full damage)", damageDealt(t, roll("force", 10)), 10);
  assert("fire 10 vs all-damage-5-except-force -> 5 (still resisted)", damageDealt(t, roll("fire", 10)), 5);

  const t2 = makeTarget({
    resistances: [res("all-damage", 5, { exceptions: ["force", "ghost-touch"] })],
  });
  assert("force excepted (multi-exception) -> 10", damageDealt(t2, roll("force", 10)), 10);
  assert("ghost-touch category excepted -> 10", damageDealt(t2, roll("slashing", 10, { categories: ["ghost-touch"] })), 10);
  assert("cold not excepted -> 5", damageDealt(t2, roll("cold", 10)), 5);
}

section("Resistances — doubleVs and material/category");
{
  const t = makeTarget({ resistances: [res("fire", 5, { doubleVs: ["non-magical"] })] });
  assert("non-magical fire 10 vs fire-resist-5 doubleVs non-magical -> 0 (10-10)", damageDealt(t, roll("fire", 10, { categories: ["non-magical"] })), 0);
  assert("magical fire 10 (no category) -> 5 (single resistance)", damageDealt(t, roll("fire", 10)), 5);

  const tMat = makeTarget({ resistances: [res("silver", 5)] });
  assert("silver-tagged slashing 10 vs silver-resist-5 -> 5", damageDealt(tMat, roll("slashing", 10, { categories: ["silver"] })), 5);
  assert("plain slashing 10 vs silver-resist-5 -> 10 (no material tag)", damageDealt(tMat, roll("slashing", 10)), 10);
}

// --- Immunities -----------------------------------------------------------

section("Immunities — specific type");
{
  const t = makeTarget({ immunities: [imm("fire")] });
  assert("fire 10 vs fire-immunity -> 0", damageDealt(t, roll("fire", 10)), 0);
  assert("cold 10 vs fire-immunity -> 10 (other type unaffected)", damageDealt(t, roll("cold", 10)), 10);
}

section("Immunities — all damage");
{
  const t = makeTarget({ immunities: [imm("all damage")] });
  assert("fire 10 vs all-damage-immunity -> 0", damageDealt(t, roll("fire", 10)), 0);
  const t2 = makeTarget({ immunities: [imm("all-damage")] });
  assert("fire 10 vs all-damage(hyphen)-immunity -> 0", damageDealt(t2, roll("fire", 10)), 0);
}

section("Immunities — with exception");
{
  const t = makeTarget({ immunities: [imm("all damage", { exceptions: ["force"] })] });
  assert("force 10 vs all-damage-immunity-except-force -> 10", damageDealt(t, roll("force", 10)), 10);
  assert("fire 10 vs all-damage-immunity-except-force -> 0", damageDealt(t, roll("fire", 10)), 0);
}

// --- Weaknesses -----------------------------------------------------------

section("Weaknesses");
{
  const t = makeTarget({ weaknesses: [weak("fire", 5)] });
  assert("fire 10 vs fire-weakness-5 -> 15", damageDealt(t, roll("fire", 10)), 15);
  assert("cold 10 vs fire-weakness-5 -> 10 (other type unaffected)", damageDealt(t, roll("cold", 10)), 10);

  const tAll = makeTarget({ weaknesses: [weak("all damage", 5)] });
  assert("acid 10 vs all-damage-weakness-5 -> 15", damageDealt(tAll, roll("acid", 10)), 15);

  const tExc = makeTarget({ weaknesses: [weak("all damage", 5, { exceptions: ["fire"] })] });
  assert("fire 10 vs all-damage-weakness-5-except-fire -> 10 (excepted)", damageDealt(tExc, roll("fire", 10)), 10);
  assert("cold 10 vs all-damage-weakness-5-except-fire -> 15", damageDealt(tExc, roll("cold", 10)), 15);
}

// --- Combined / interactions ---------------------------------------------

section("Weakness + Resistance same type (weakness then resistance)");
{
  const t = makeTarget({ weaknesses: [weak("fire", 5)], resistances: [res("fire", 2)] });
  // 10 + 5 (weakness) - 2 (resistance) = 13
  assert("fire 10, weak 5, resist 2 -> 13", damageDealt(t, roll("fire", 10)), 13);
}

section("Half damage (basic save success) applies before IWR");
{
  const t = makeTarget({ resistances: [res("fire", 3)] });
  // 10 halved -> 5, then -3 resistance -> 2
  assert("fire 10 halved then fire-resist-3 -> 2", damageDealt(t, roll("fire", 10), { half: true }), 2);
}

section("Critical doubles damage before IWR");
{
  const t = makeTarget({ resistances: [res("slashing", 5)] });
  // 10 doubled -> 20, then -5 -> 15
  assert("slashing 10 crit vs slashing-resist-5 -> 15", damageDealt(t, roll("slashing", 10, { critical: true }), {}), 15);
}

// --- Precision IWR --------------------------------------------------------

section("Precision damage — precision immunity");
{
  // 3 piercing base + 10 piercing precision; immune to precision -> only 3 base
  const t = makeTarget({ immunities: [imm("precision")] });
  const r = multiRoll([["piercing", 3], ["precision", 10]], { damageType: "piercing" });
  assert("3 piercing + 10 precision vs precision-immunity -> 3", damageDealt(t, r), 3);
}

section("Precision damage — precision resistance / weakness");
{
  const tRes = makeTarget({ resistances: [res("precision", 4)] });
  const r = multiRoll([["piercing", 3], ["precision", 10]], { damageType: "piercing" });
  // precision 10 - 4 = 6 surviving; + 3 base = 9
  assert("3 piercing + 10 precision vs precision-resist-4 -> 9", damageDealt(tRes, r), 9);

  const tWeak = makeTarget({ weaknesses: [weak("precision", 5)] });
  const r2 = multiRoll([["piercing", 3], ["precision", 2]], { damageType: "piercing" });
  // precision 2 + 5 weakness = 7 surviving; + 3 base = 10
  assert("3 piercing + 2 precision vs precision-weakness-5 -> 10", damageDealt(tWeak, r2), 10);
}

section("Precision damage — type resistance applies once (no double-dip)");
{
  // 3 piercing + 10 precision(piercing) = 13 piercing total, resist piercing 5 -> 8
  const t = makeTarget({ resistances: [res("piercing", 5)] });
  const r = multiRoll([["piercing", 3], ["precision", 10]], { damageType: "piercing" });
  assert("3 piercing + 10 precision vs piercing-resist-5 -> 8", damageDealt(t, r), 8);
}

section("Precision damage — precision immunity + type resistance together");
{
  // precision removed by immunity first, then resistance applies to remaining base
  const t = makeTarget({ immunities: [imm("precision")], resistances: [res("piercing", 2)] });
  const r = multiRoll([["piercing", 3], ["precision", 5]], { damageType: "piercing" });
  // precision 5 removed -> 3 piercing; -2 resistance -> 1
  assert("3 piercing + 5 precision vs precision-immune + piercing-resist-2 -> 1", damageDealt(t, r), 1);
}

// --- Exact reported scenario ---------------------------------------------

section("Phantasmal Minion (reported bug): dagger 3 force + 1 precision");
{
  // Mirrors the user's macro roll and the Phantasmal Minion stat block:
  //   resistances: all-damage 5 (except force, ghost-touch)
  //   immunities:  precision (among others)
  // Sneak Attack die is typed "precision"; base die is typed "force".
  // Expected: force (3) is excepted from resistance; the 1 precision is removed
  // by precision immunity -> total 3.
  const minion = makeTarget({
    immunities: [imm("disease"), imm("poison"), imm("precision"), imm("spirit")],
    resistances: [res("all-damage", 5, { exceptions: ["force", "ghost-touch"] })],
    traits: ["Medium", "Common", "Force", "Mindless"],
  });
  const daggerRoll = {
    types: [
      { die: 4, value: 3, type: "force" },
      { die: 6, value: 1, type: "precision" },
    ],
    dice: [
      { type: 4, value: 3 },
      { type: 6, value: 1 },
    ],
    total: 4,
    metadata: {
      traits: ["Common", "Agile", "Finesse", "Thrown-10", "Versatile-S"],
      damageCategories: ["non-magical"],
      critical: false,
      damageType: "piercing",
      criticalOnlyDice: [],
      precisionModifierIndices: [],
    },
  };
  assert("full damage -> 3 (force unresisted, precision immune)", damageDealt(minion, daggerRoll), 3);

  // The half-damage button on the same macro: 4 halved is 2 distributed as
  // force 1 + precision 1; force survives (1), precision removed by immunity ->
  // total 1.
  assert("half damage -> 1", damageDealt(minion, daggerRoll, { half: true }), 1);
}

process.exit(summary());
