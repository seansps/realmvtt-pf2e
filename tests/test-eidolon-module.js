// Tests for the Eidolons module's records (modules/eidolons): eidolon
// characters built from the generated ancestries and class, worked out by the
// ruleset's own recalculation and Strike, against stat blocks worked by hand
// from Impossible Magic pg. 63-77.
// Run: node tests/test-eidolon-module.js (or via tests/run-all.js)

const path = require("path");
const fs = require("fs");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const moduleDir = path.join(__dirname, "..", "modules", "eidolons");
const RECORDS = JSON.parse(fs.readFileSync(path.join(moduleDir, "records.json"), "utf8"));
const { build } = require(path.join(moduleDir, "build.js"));

const copy = (value) => JSON.parse(JSON.stringify(value));
const setPath = (target, dotted, value) => {
  const keys = dotted.split(".");
  let at = target;
  for (const key of keys.slice(0, -1)) at = at[key] = at[key] ?? {};
  at[keys[keys.length - 1]] = value;
};

// The options a player picks, added as the choice prompt adds them: features
// to the ancestry's or class's features, items to the inventory
function pick(record, owner, choiceStart, optionName) {
  const holder = owner.data.features.find((f) => (f.data.choices || []).some((c) => c.name.startsWith(choiceStart)));
  const choiceObj = holder.data.choices.find((c) => c.name.startsWith(choiceStart));
  const option = choiceObj.data.options.find((o) => o.name === optionName);
  choiceObj.data.choices = [JSON.stringify({ _id: option._id, name: option.name })];
  option.data.value.forEach((item) => {
    if (item.recordType === "features") owner.data.features.push(copy(item));
    if (item.recordType === "items") record.data.inventory.push({ ...copy(item), data: { ...copy(item.data), carried: "equipped", count: 1 } });
  });
}

// An eidolon character from the module's records: its type's ancestry and the
// Eidolon class, with its choices, worked out as the sheet does
// (onAddEditFeature, run until it settles)
function eidolon(type, level, { key, primary = "1d8, Trip", tradition } = {}) {
  const ancestry = copy(RECORDS.ancestry.find((a) => a.name === type));
  const eidolonClass = copy(RECORDS.class[0]);
  const record = {
    _id: `e-${type}-${level}`,
    recordType: "characters",
    name: type,
    effects: [],
    effectIds: [],
    fields: {},
    data: {
      level,
      classes: [eidolonClass],
      ancestries: [ancestry],
      heritages: [],
      feats: [],
      bonusFeats: [],
      features: [],
      inventory: [],
      actions: [],
      size: ancestry.data.size,
      speed: ancestry.data.speed,
      traits: [...(ancestry.data.traits || [])],
      toggles: [],
    },
  };
  if (key) pick(record, ancestry, "Choose your", key);
  if (tradition) pick(record, ancestry, "Choose your dragon", tradition);
  pick(record, eidolonClass, "Choose your eidolon's primary", primary);
  const write = (values, cb) => {
    Object.entries(values).forEach(([path, value]) => setPath(record, path, value));
    if (cb) cb(record);
  };
  ctx.api.setValuesOnRecord = (r, values, cb) => write(values, cb);
  ctx.api.setValues = (values, cb) => write(values, cb);
  for (let i = 0; i < 3; i++) ctx.onAddEditFeature(record, undefined, true);
  return record;
}

// A Strike with the named unarmed attack: its bonus and damage
function strike(record, weaponName) {
  const index = record.data.inventory.findIndex((item) => item.name === weaponName);
  let captured = { mods: [], meta: {} };
  const saved = ctx.api.promptRoll;
  ctx.api.promptRoll = (name, dice, mods, meta) => (captured = { mods: mods || [], meta: meta || {} });
  try {
    ctx.performAttackRoll(record, record.data.inventory[index], `data.inventory.${index}`, 1);
  } finally {
    ctx.api.promptRoll = saved;
  }
  const active = (list) => list.filter((m) => m.active !== false);
  const damageBonus = active(captured.meta.damageModifiers || []).reduce((sum, m) => sum + (parseInt(m.value, 10) || 0), 0);
  return {
    bonus: active(captured.mods).reduce((sum, m) => sum + (parseInt(m.value, 10) || 0), 0),
    damage: `${captured.meta.damage}`.replace(/ (\w+)$/, `+${damageBonus} $1`),
    traits: captured.meta.traits || [],
  };
}

section("The module's records");
{
  assert("15 eidolon types and the Eidolon class", [RECORDS.ancestry.length, RECORDS.class.length], [15, 1]);
  assert("records.json is what build.js makes (rebuild after changing it)", JSON.stringify(RECORDS), JSON.stringify(build()));
  assert("eidolon types have no boosts or flaws", RECORDS.ancestry.every((a) => Object.keys(a.data.boosts).length === 0 && Object.keys(a.data.flaws).length === 0), true);
  assert("every type asks for its attributes", RECORDS.ancestry.every((a) => a.data.features[0].data.choices[0].data.options.length === 2), true);
  assert("Elemental and Swarm pick a named array", ["Elemental Eidolon", "Swarm Eidolon"].map((n) => RECORDS.ancestry.find((a) => a.name === n).data.features[0].data.choices[0].data.options.map((o) => o.name)), [["Adaptable Elemental", "Primordial Elemental"], ["Brazen Swarm", "Slinking Swarm"]]);
  assert("every type has its three abilities, at 1st, 7th and 17th", RECORDS.ancestry.every((a) => a.data.features.slice(1).map((f) => f.data.level).join() === "1,7,17"), true);
  assert("the class's features by level", RECORDS.class[0].data.features.map((f) => f.data.level), [1, 3, 5, 7, 7, 9, 11, 11, 13, 15, 15, 17, 19]);
  assert("seven primary attacks to pick from", RECORDS.class[0].data.features[0].data.choices[0].data.options.length, 7);
}

section("An angel eidolon, Strength, at 1st level (Impossible Magic pg. 69-71)");
{
  const angel = eidolon("Angel Eidolon", 1, { key: "Strength" });
  const d = angel.data;
  assert("Str +4, Dex +2, Con +1, Int -1, Wis +1, Cha +2", [d.strMod, d.dexMod, d.conMod, d.intMod, d.wisMod, d.chaMod], [4, 2, 1, -1, 1, 2]);
  assert("AC 17: 10 + 3 trained + Dex 2 + 2 item", d.ac, 17);
  assert("expert Fortitude and Will, trained Reflex and Perception: 6, 5, 6, 4", [d.fortitudeMod, d.reflexMod, d.willMod, d.perceptionMod], [6, 5, 6, 4]);
  assert("Diplomacy 5, Religion 4", [d.diplomacyMod, d.religionMod], [5, 4]);
  assert("primary (trip) +7 for 1d8+4", [strike(angel, "Primary Attack").bonus, strike(angel, "Primary Attack").damage], [7, "1d8+4 bludgeoning"]);
  assert("... with the trip trait", strike(angel, "Primary Attack").traits.includes("Trip"), true);
  assert("secondary +7 for 1d6+4, agile and finesse", [strike(angel, "Secondary Attack").bonus, strike(angel, "Secondary Attack").damage], [7, "1d6+4 bludgeoning"]);
  assert("darkvision (copied from the ancestry when it's dropped)", RECORDS.ancestry.find((a) => a.name === "Angel Eidolon").data.vision, "Darkvision");
}

section("A Dexterity eidolon at 7th level");
{
  const angel = eidolon("Angel Eidolon", 7, { key: "Dexterity" });
  const d = angel.data;
  assert("Str +2, Dex +4", [d.strMod, d.dexMod], [2, 4]);
  assert("AC 24: 10 + 9 trained + Dex 4 (cap 4) + 1 item", d.ac, 24);
  assert("expert Perception from Shared Vigilance: 7 + 4 + 1", d.perceptionMod, 12);
  assert("expert unarmed and weapon specialization: secondary +15 for 1d6+4", [strike(angel, "Secondary Attack").bonus, strike(angel, "Secondary Attack").damage], [15, "1d6+4 bludgeoning"]);
}

section("Named arrays and the dragon's tradition");
{
  const elemental = eidolon("Elemental Eidolon", 1, { key: "Primordial Elemental" });
  assert("primordial elemental: Str +4, Dex +2, Con +3, Int -1, Wis +1, Cha +0", ["str", "dex", "con", "int", "wis", "cha"].map((a) => elemental.data[`${a}Mod`]), [4, 2, 3, -1, 1, 0]);
  const dragon = eidolon("Dragon Eidolon", 1, { key: "Strength", tradition: "Arcane" });
  assert("arcane dragon: Intimidation and Arcana trained", [dragon.data.intimidation, dragon.data.arcana], ["1", "1"]);
}

process.exitCode = summary() > 0 ? 1 : 0;
