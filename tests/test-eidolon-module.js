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
  const holder = owner.data.choices ? owner : owner.data.features.find((f) => (f.data.choices || []).some((c) => c.name.startsWith(choiceStart)));
  const choiceObj = holder.data.choices.find((c) => c.name.startsWith(choiceStart));
  const option = choiceObj.data.options.find((o) => o.name === optionName);
  const optionSlug = option.data.slug || option.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const prefix = choiceObj.data.rollOption;
  choiceObj.data.choices = [JSON.stringify({ _id: option._id, name: option.name, slug: optionSlug, ...(prefix ? { selectedRollOption: `${prefix}:${optionSlug}` } : {}) })];
  option.data.value.forEach((item) => {
    // A feat's choice adds its features to the class's (as the prompt does)
    if (item.recordType === "features") (owner.data.features || record.data.classes[0].data.features).push(copy(item));
    if (item.recordType === "items") record.data.inventory.push({ ...copy(item), data: { ...copy(item.data), carried: "equipped", count: 1 } });
  });
}

// An eidolon character from the module's records: its type's ancestry and the
// Eidolon class, with its choices, worked out as the sheet does
// (onAddEditFeature, run until it settles)
function eidolon(type, level, { key, primary = "1d8, Trip", tradition, feats = [], featPicks = [], summonerGear, summonerRanks } = {}) {
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
      feats: feats.map((name) => copy(RECORDS.feats.find((f) => f.name === name))),
      bonusFeats: [],
      features: [],
      inventory: [],
      actions: [],
      size: ancestry.data.size,
      senses: ancestry.data.vision,
      speed: ancestry.data.speed,
      traits: [...(ancestry.data.traits || [])],
      toggles: [],
      ...(summonerGear ? { summonerGear } : {}),
      ...(summonerRanks ? { summonerRanks } : {}),
    },
  };
  if (key) pick(record, ancestry, "Choose your", key);
  if (tradition) pick(record, ancestry, "Choose your dragon", tradition);
  pick(record, eidolonClass, "Choose your eidolon's primary", primary);
  featPicks.forEach(([featName, choiceStart, optionName]) => pick(record, record.data.feats.find((f) => f.name === featName), choiceStart, optionName));
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
function strike(record, weaponName, attackNumber = 1) {
  const index = record.data.inventory.findIndex((item) => item.name === weaponName);
  let captured = { mods: [], meta: {} };
  const saved = ctx.api.promptRoll;
  ctx.api.promptRoll = (name, dice, mods, meta) => (captured = { mods: mods || [], meta: meta || {} });
  try {
    ctx.performAttackRoll(record, record.data.inventory[index], `data.inventory.${index}`, attackNumber);
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

section("Evolution feats (Impossible Magic pg. 79-86)");
{
  assert("40 evolution feats and the dedication's, named for the eidolon", [RECORDS.feats.length, RECORDS.feats.every((f) => / \(Eidolon\)$/.test(f.name))], [41, true]);
  // Physical resistance is listed as bludgeoning, piercing and slashing
  const resistance = (record, type) => ctx.getIWR(record).resistances?.[type === "physical" ? "bludgeoning" : type]?.value || 0;
  const heart = (level, feats = ["Energy Heart (Eidolon)"]) =>
    eidolon("Angel Eidolon", level, { key: "Strength", feats, featPicks: [["Energy Heart (Eidolon)", "Choose Energy Heart", "Fire"]] });
  assert("Energy Heart: fire resistance half the level, minimum 1", [resistance(heart(1), "fire"), resistance(heart(7), "fire"), resistance(heart(20), "fire")], [1, 3, 10]);
  assert("... none to the other energies", resistance(heart(7), "cold"), 0);
  assert("Energy Resistance: the level", resistance(heart(8, ["Energy Heart (Eidolon)", "Energy Resistance (Eidolon)"]), "fire"), 8);
  const senses = eidolon("Beast Eidolon", 1, { key: "Strength", feats: ["Expanded Senses (Eidolon)"] });
  assert("Expanded Senses: darkvision and scent", [/darkvision/i.test(senses.data.senses), /scent/i.test(senses.data.senses)], [true, true]);
  const fast = eidolon("Angel Eidolon", 2, { key: "Strength", feats: ["Alacritous Action (Eidolon)"] });
  assert("Alacritous Action: Speed 35", parseInt(fast.data.speed, 10), 35);
  const hulk = eidolon("Angel Eidolon", 8, { key: "Strength", feats: ["Hulking Size (Eidolon)"] });
  assert("Hulking Size: Large", String(hulk.data.size).toLowerCase(), "large");
  const ranged = eidolon("Angel Eidolon", 2, { key: "Dexterity", feats: ["Ranged Combatant (Eidolon)"], featPicks: [["Ranged Combatant (Eidolon)", "Choose your eidolon's ranged", "Fire"]] });
  assert("Ranged Combatant: 1d4 fire, +8 at 2nd (2 + 2 trained + Dex 4)", [strike(ranged, "Ranged Attack").bonus, strike(ranged, "Ranged Attack").damage.split("+")[0]], [8, "1d4"]);
  const nimble = eidolon("Angel Eidolon", 10, { key: "Dexterity", feats: ["Nimble Form (Eidolon)"] });
  const plain = eidolon("Angel Eidolon", 10, { key: "Dexterity" });
  assert("Nimble Form: the agile attack's second Strike at -3, not -4", strike(nimble, "Secondary Attack", 2).bonus - strike(plain, "Secondary Attack", 2).bonus, 1);
  const shell = (level) => resistance(eidolon("Angel Eidolon", level, { key: "Strength", feats: ["Resilient Shell (Eidolon)"] }), "physical");
  assert("Resilient Shell: physical 5, 6 at 17th", [shell(14), shell(17)], [5, 6]);
  const dedication = (level, key) => eidolon("Angel Eidolon", level, { key, feats: ["Summoner Dedication (Eidolon)"] });
  assert("Summoner Dedication: key attribute +3 until 5th, then +4", [dedication(2, "Strength").data.strMod, dedication(2, "Dexterity").data.dexMod, dedication(5, "Strength").data.strMod], [3, 3, 4]);
  assert("... the other stays +2", dedication(2, "Strength").data.dexMod, 2);
}

section("Item bonuses from the summoner's gear");
{
  const handwraps = { _id: "hw", name: "Handwraps of Mighty Blows", data: { handwraps: true, carried: "equipped", invested: "true", runes: { potency: "1", striking: "1" } } };
  const geared = eidolon("Angel Eidolon", 5, { key: "Strength", summonerGear: { armorPotency: 1, resilient: 1, handwraps } });
  const bare = eidolon("Angel Eidolon", 5, { key: "Strength" });
  assert("+1 armor potency raises its AC by 1", geared.data.ac - bare.data.ac, 1);
  // The sheet's save totals show attribute and proficiency only; a save roll
  // adds the item bonus
  const saveMods = (record) => ctx.getEffectsAndModifiersForToken(record, ["saveBonus", "savePenalty"], ["fortitude", "saving-throw"]).map((m) => [m.name, m.value]);
  assert("+1 resilient: +1 item bonus on its save rolls", [saveMods(geared), saveMods(bare)], [[["Summoner's Resilient +1", 1]], []]);
  const primary = geared.data.inventory.find((item) => item.name === "Primary Attack");
  assert("+1 striking handwraps: +1 to hit and a striking rune on its attacks", [strike(geared, "Primary Attack").bonus - strike(bare, "Primary Attack").bonus, ctx.getStrikingRuneForRecord(geared, ctx.getAlteredWeapon(geared, primary))], [1, 1]);
}

section("Ranks shared with the summoner (pg. 69)");
{
  const skills = { acrobatics: 0, arcana: 2, athletics: 3, crafting: 0, deception: 0, diplomacy: 1, intimidation: 0, medicine: 0, nature: 0, occultism: 0, performance: 0, religion: 1, society: 0, stealth: 1, survival: 0, thievery: 0 };
  const ranks = { perception: 1, fortitude: 1, reflex: 2, will: 3, skills };
  const shared = eidolon("Angel Eidolon", 5, { key: "Strength", summonerRanks: ranks });
  assert("its skills are the summoner's: master Athletics, expert Arcana", [shared.data.athletics, shared.data.arcana, shared.data.stealth], ["3", "2", "1"]);
  assert("Athletics 5 + 6 master + Str 4", shared.data.athleticsMod, 15);
  assert("its Perception and saves stay its own (expert Perception from Shared Vigilance at 3rd)", [shared.data.perception, shared.data.fortitude, shared.data.will], ["2", "2", "2"]);

  const dedication = eidolon("Angel Eidolon", 7, { key: "Strength", summonerRanks: ranks, feats: ["Summoner Dedication (Eidolon)"] });
  assert("Summoner Dedication: the summoner's Perception and save ranks, even below the class's", [dedication.data.perception, dedication.data.fortitude, dedication.data.reflex, dedication.data.will], ["1", "1", "2", "3"]);
  const full = eidolon("Angel Eidolon", 7, { key: "Strength", summonerRanks: ranks });
  assert("... and none of the class features: trained unarmed at 7th (2 lower than expert)", strike(full, "Primary Attack").bonus - strike(dedication, "Primary Attack").bonus, 2);
  const unarmedSpecialization = (record) => strike(record, "Primary Attack").damage;
  assert("... no weapon specialization", [unarmedSpecialization(full), unarmedSpecialization(dedication)], ["1d8+6 bludgeoning", "1d8+4 bludgeoning"]);
}

section("Item bonuses to Perception and skills from the summoner's invested items (pg. 70)");
{
  const item = (name, mods, invested = "true") => ({ _id: name, name, data: { type: "equipment", carried: "equipped", invested, traits: ["Invested", "Magical"], modifiers: mods.map((m) => ({ data: { active: true, modifierType: "item", valueType: "number", ...m } })) } });
  const summonerRecord = {
    _id: "s",
    recordType: "characters",
    effects: [],
    effectIds: [],
    data: { level: 5, inventory: [item("Goggles", [{ type: "perceptionBonus", field: "", value: "1" }]), item("Climbing Kit", [{ type: "skillBonus", field: "athletics", value: "2" }]), item("Cloak", [{ type: "skillBonus", field: "stealth", value: "1" }], "false")] },
  };
  const gear = ctx.getSummonerGear(summonerRecord);
  assert("the best invested item bonus to Perception and each skill; uninvested ones don't count", [gear.perception, gear.skills], [1, { athletics: 2 }]);
  const notInvested = (name, mods) => ({ ...item(name, mods), data: { ...item(name, mods).data, invested: undefined, traits: ["Magical"] } });
  const elixir = { _id: "elixir", name: "Eagle-Eye Elixir", data: { modifiers: [{ data: { active: true, modifierType: "item", valueType: "number", type: "perceptionBonus", field: "", value: "2" } }] } };
  const feat = { _id: "feat", name: "Some Feat", data: { modifiers: [{ data: { active: true, modifierType: "item", valueType: "number", type: "skillBonus", field: "arcana", value: "1" } }] } };
  const others = ctx.getSummonerGear({
    ...summonerRecord,
    effects: [elixir],
    effectIds: ["elixir"],
    data: { ...summonerRecord.data, feats: [feat], inventory: [...summonerRecord.data.inventory, notInvested("Toolkit", [{ type: "skillBonus", field: "thievery", value: "1" }]), item("Circlet", [{ type: "skillBonus", field: "all", value: "1" }])] },
  });
  assert("not an elixir's, a feat's or an item that isn't invested; an invested item's bonus to all skills counts for each", [others.perception, others.skills.thievery, others.skills.arcana, others.skills.athletics, others.skills.stealth], [1, 1, 1, 2, 1]);
  const geared = eidolon("Angel Eidolon", 5, { key: "Strength", summonerGear: gear });
  const mods = (types, field) => ctx.getEffectsAndModifiersForToken(geared, types, field).map((m) => [m.name, m.value]);
  assert("its Perception and Athletics take them", [mods(["perceptionBonus"], "perception"), mods(["skillBonus"], "athletics"), mods(["skillBonus"], "stealth")], [[["Summoner's Item +1", 1]], [["Summoner's Item +2", 2]], []]);
}

process.exitCode = summary() > 0 ? 1 : 0;
