// Tests for spellcasting archetypes (rollhandlers/spell-entries.js): the
// entry a dedication gives, its slots from the basic, expert and master
// spellcasting feats, breadth, and when the sheet makes it.
// Run: node tests/test-archetype-spellcasting.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
// spells.js shares the sheet's scope with common.js at runtime
new vm.Script(fs.readFileSync(__dirname + "/../rollhandlers/spells.js", "utf8"), {
  filename: "spells.js",
}).runInContext(ctx);

const classRecord = (name, remaster = true) => ({
  _id: `class-${name}`,
  name,
  recordType: "class",
  data: { publication: { remaster, title: remaster ? "Pathfinder Player Core" : "Pathfinder Core Rulebook" }, features: [] },
});
const feat = (name, remaster = true) => ({
  _id: `feat-${name}`,
  name,
  data: { type: "archetype", publication: { remaster, title: remaster ? "Pathfinder Player Core" : "Pathfinder Core Rulebook" } },
});
const character = (className, level, feats = [], data = {}) => ({
  _id: "pc",
  name: "Amiri",
  recordType: "characters",
  data: {
    level,
    classes: [classRecord(className)],
    spellcasting: "0",
    str: 4,
    int: 2,
    wis: 1,
    cha: 3,
    autoSpellcasting: true,
    feats: feats.map((name) => (typeof name === "string" ? feat(name) : name)),
    ...data,
  },
  fields: {},
});
const archetype = (record, slug) =>
  ctx.getWantedSpellcastingEntries(record, record.data.level).find((spec) => spec.source === `archetype:${slug}`);
const slots = (spec) => {
  const out = {};
  for (let rank = 1; rank <= 10; rank++) {
    if (spec.counts[`numSpells${rank}`]) out[rank] = spec.counts[`numSpells${rank}`];
  }
  return out;
};
function apply(record, values) {
  const next = JSON.parse(JSON.stringify(record));
  for (const [path, value] of Object.entries(values)) {
    const parts = path.split(".");
    let target = next;
    for (const part of parts.slice(0, -1)) {
      if (target[part] === undefined || target[part] === null) target[part] = {};
      target = target[part];
    }
    target[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
  }
  return next;
}
const syncValues = (record) => {
  const values = {};
  const entries = ctx.syncSpellcastingEntries(record, values);
  ctx.updateSpellcastingEntries(record, values, entries);
  return values;
};
const synced = (record) => apply(record, syncValues(record));
const names = (record) => (record.data.spells || []).map((entry) => entry.name);

section("The slots archetype spellcasting gives");
{
  const ranks = (level, feats) => ctx.getArchetypeSlotRanks(level, feats);
  assert("the dedication alone: no slots", ranks(20, {}), []);
  assert("basic at 4th: 1st", ranks(4, { basic: true }), [1]);
  assert("basic at 6th: 1st and 2nd", ranks(6, { basic: true }), [1, 2]);
  assert("basic at 8th and beyond: up to 3rd", ranks(11, { basic: true }), [1, 2, 3]);
  assert("expert at 12th: 4th", ranks(12, { basic: true, expert: true }), [1, 2, 3, 4]);
  assert("expert at 16th: up to 6th", ranks(16, { basic: true, expert: true }), [1, 2, 3, 4, 5, 6]);
  assert("master at 20th: up to 8th", ranks(20, { basic: true, expert: true, master: true }), [1, 2, 3, 4, 5, 6, 7, 8]);
}

section("A fighter with the Wizard Dedication");
{
  let spec = archetype(character("Fighter", 2, ["Wizard Dedication"]), "wizard");
  assert("an entry from the dedication", [spec.name, spec.type, spec.tradition, spec.attribute], ["Wizard Archetype Spells", "prepared", "Arcane", "int"]);
  assert("2 cantrips, no slots yet", [spec.counts.numCantrips, slots(spec)], [2, {}]);
  assert("trained", spec.training, 1);
  spec = archetype(character("Fighter", 8, ["Wizard Dedication", "Basic Wizard Spellcasting"]), "wizard");
  assert("Basic Wizard Spellcasting at 8th: 1/1/1", slots(spec), { 1: 1, 2: 1, 3: 1 });
  spec = archetype(character("Fighter", 8, ["Wizard Dedication", "Basic Wizard Spellcasting", "Arcane Breadth"]), "wizard");
  assert("Arcane Breadth: 1 more but at the two highest ranks", slots(spec), { 1: 2, 2: 1, 3: 1 });
  spec = archetype(character("Fighter", 14, ["Wizard Dedication", "Basic Wizard Spellcasting", "Arcane Breadth", "Expert Wizard Spellcasting"]), "wizard");
  assert("Expert Wizard Spellcasting at 14th: up to 5th, expert", [slots(spec), spec.training], [{ 1: 2, 2: 2, 3: 2, 4: 1, 5: 1 }, 2]);
  spec = archetype(character("Fighter", 20, ["Wizard Dedication", "Basic Wizard Spellcasting", "Expert Wizard Spellcasting", "Master Wizard Spellcasting"]), "wizard");
  assert("Master Wizard Spellcasting at 20th: up to 8th, master", [slots(spec), spec.training], [{ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 }, 3]);
  assert("no entry for a class's own dedication", archetype(character("Wizard", 4, ["Wizard Dedication"]), "wizard"), undefined);
  assert("a caster class keeps its own entry beside it", ctx.getWantedSpellcastingEntries(character("Cleric", 4, ["Wizard Dedication"]), 4).map((spec) => spec.source), ["class:cleric", "class:cleric:font", "archetype:wizard"]);
}

section("Each archetype casts like its class");
{
  const at = (cls, level, feats, data) => character("Fighter", level, feats, data);
  let spec = archetype(at("Bard", 6, ["Bard Dedication", "Basic Bard Spellcasting", "Occult Breadth"]), "bard");
  assert("bard: spontaneous occult Charisma", [spec.type, spec.tradition, spec.attribute], ["spontaneous", "Occult", "cha"]);
  assert("a repertoire with 2 cantrips and a spell for each slot", [spec.repertoire.repCantrips, spec.repertoire.rep1, spec.repertoire.rep2], [2, 1, 1]);
  spec = archetype(at("Bard", 8, ["Bard Dedication", "Basic Bard Spellcasting", "Occult Breadth"]), "bard");
  assert("Occult Breadth adds to the repertoire too", [slots(spec), spec.repertoire.rep1], [{ 1: 2, 2: 1, 3: 1 }, 2]);
  spec = archetype(at("Cleric", 4, ["Cleric Dedication", "Basic Cleric Spellcasting"]), "cleric");
  assert("cleric: prepared divine Wisdom, no Divine Font", [spec.type, spec.tradition, spec.attribute, slots(spec)], ["prepared", "Divine", "wis", { 1: 1 }]);
  spec = archetype(at("Witch", 2, ["Witch Dedication"], { flags: { patron: "faiths-flamekeeper" } }), "witch");
  assert("witch: 1 cantrip a day", spec.counts.numCantrips, 1);
  spec = archetype(at("Psychic", 2, ["Psychic Dedication"]), "psychic");
  assert("psychic: 1 psi cantrip, with the higher of Int and Cha", [spec.repertoire.repCantrips, spec.attribute], [1, "cha"]);
  spec = archetype(at("Psychic", 2, ["Psychic Dedication"], { int: 4, cha: 1 }), "psychic");
  assert("or Intelligence when it's higher", spec.attribute, "int");
  assert("summoner: nothing from the dedication alone", archetype(at("Summoner", 2, ["Summoner Dedication"]), "summoner"), undefined);
  spec = archetype(at("Summoner", 4, ["Summoner Dedication", "Basic Summoner Spellcasting"]), "summoner");
  assert("summoner: spontaneous Charisma from Basic Summoner Spellcasting", [spec.type, spec.attribute, spec.repertoire.repCantrips, slots(spec)], ["spontaneous", "cha", 2, { 1: 1 }]);
  spec = archetype(at("Summoner", 20, ["Summoner Dedication", "Basic Summoner Spellcasting", "Expert Summoner Spellcasting", "Master Summoning Spellcasting"]), "summoner");
  assert("summoner: Master Summoning Spellcasting gives 7th and 8th, master", [slots(spec)[7], slots(spec)[8], spec.training], [1, 1, 3]);
  spec = archetype(at("Sorcerer", 2, ["Sorcerer Dedication"], { flags: { bloodline: "bloodline-aberrant" } }), "sorcerer");
  assert("sorcerer: the bloodline's tradition", spec.tradition, "Occult");
  spec = archetype(at("Sorcerer", 2, ["Sorcerer Dedication"]), "sorcerer");
  assert("unknown until the bloodline is chosen", spec.tradition, null);
  for (const slug of ["animist", "druid", "magus", "necromancer", "oracle"]) {
    const name = slug[0].toUpperCase() + slug.slice(1);
    spec = archetype(at(name, 4, [`${name} Dedication`, `Basic ${name} Spellcasting`]), slug);
    assert(`${slug}: an entry with a 1st-rank slot at 4th`, slots(spec), { 1: 1 });
  }
}

section("When the sheet makes the entry");
{
  // A character synced since this came in takes a dedication: it's made
  let record = synced(character("Fighter", 2));
  assert("the sources are remembered", record.data.spellcastingSources, []);
  record = synced(apply(record, { "data.feats": [feat("Wizard Dedication")] }));
  assert("taking the dedication makes its entry", names(record), ["Wizard Archetype Spells"]);
  assert("followed by the sheet", record.data.spells[0].data.auto.source, "archetype:wizard");
  assert("with 2 cantrips", record.data.spells[0].data.numCantrips, 2);
  assert("a second sync writes nothing", Object.keys(syncValues(record)).filter((key) => key.startsWith("data.spells")), []);
  record = synced(apply(record, { "data.level": 4, "data.feats": [feat("Wizard Dedication"), feat("Basic Wizard Spellcasting")] }));
  assert("Basic Wizard Spellcasting adds its slot", record.data.spells[0].data.numSpells1, 1);
  assertIncludes("and the Level Up summary names it", ctx.getSpellcastingLevelUpChanges(apply(record, { "data.level": 5 }), 6), "Wizard Archetype Spells: 2nd-rank spells (1 slot)");

  // Before this came in: a dedication with the player's own entry is left alone
  const own = { name: "Wizard Spells (mine)", data: { type: "prepared", tradition: "Arcane", attribute: "int", numCantrips: 2 }, fields: {} };
  let before = character("Fighter", 2, ["Wizard Dedication"], { autoSpellcasting: undefined, spells: [own] });
  before = synced(before);
  assert("a dedication from before gets no entry", names(before), ["Wizard Spells (mine)"]);
  assert("but its source is remembered", before.data.spellcastingSources, ["archetype:wizard"]);
  before = synced(apply(before, { "data.feats": [feat("Wizard Dedication"), feat("Cleric Dedication")] }));
  assert("a dedication taken afterwards does", names(before), ["Wizard Spells (mine)", "Cleric Archetype Spells"]);

  // Dropping the dedication: an empty entry goes, and taking it again makes it again
  let dropped = synced(apply(record, { "data.feats": [] }));
  assert("an empty archetype entry goes with its dedication", names(dropped), []);
  dropped = synced(apply(dropped, { "data.feats": [feat("Wizard Dedication")] }));
  assert("and comes back with it", names(dropped), ["Wizard Archetype Spells"]);

  // Deleted: not made again
  const deleted = synced(apply(record, { "data.spells": [], "data.spellcastingDismissed": ["archetype:wizard"] }));
  assert("a deleted archetype entry isn't made again", names(deleted), []);
  assert("Restore Automatic Entries shows", deleted.fields.restoreSpellcastingBtn.hidden, false);
}

section("Set slots from level offers the archetype's entry");
{
  let prompt = null;
  let written = null;
  ctx.api.showPrompt = (title, description, placeholder, options, query, callback) => {
    prompt = options;
    callback("archetype:wizard");
  };
  ctx.api.setValues = (values, callback) => {
    written = values;
    if (typeof callback === "function") callback(written);
  };
  const onAddEditFeature = ctx.onAddEditFeature;
  ctx.onAddEditFeature = (updated, callback) => typeof callback === "function" && callback();
  ctx.api.showNotification = () => {};
  const own = { name: "My Archetype Spells", data: { type: "prepared", tradition: "Arcane", attribute: "int", numCantrips: 2 }, fields: {} };
  const record = character("Cleric", 4, ["Wizard Dedication", "Basic Wizard Spellcasting"], { autoSpellcasting: undefined, spells: [own] });
  ctx.optInSpellcastingEntry(record, "data.spells.0");
  assert("the prompt lists it with the class's", prompt.map((option) => option.value), ["class:cleric", "class:cleric:font", "archetype:wizard"]);
  assert("picking it makes the player's entry follow it", [written["data.spells.0"].data.auto.source, written["data.spells.0"].data.numSpells1], ["archetype:wizard", 1]);
  ctx.onAddEditFeature = onAddEditFeature;
}

section("A legacy dedication");
{
  const legacy = character("Fighter", 2, [feat("Sorcerer Dedication", false)], { flags: { bloodline: "bloodline-angelic" } });
  assert("the bloodline's tradition, as the Core Rulebook gives it", archetype(legacy, "sorcerer").tradition, "Divine");
}

process.exitCode = summary();
