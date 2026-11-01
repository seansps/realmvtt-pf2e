// Tests for the focus entry a class makes (rollhandlers/spell-entries.js):
// which classes and feats give one, its tradition and attribute, where it
// goes, and that characters from before and entries the player made are left
// alone. Run: node tests/test-focus-entries.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
// spells.js shares the sheet's scope with common.js at runtime
new vm.Script(fs.readFileSync(__dirname + "/../rollhandlers/spells.js", "utf8"), {
  filename: "spells.js",
}).runInContext(ctx);

const classRecord = (name, remaster = true) => ({
  _id: `class-${name}`,
  name,
  recordType: "class",
  data: {
    publication: { remaster, title: remaster ? "Pathfinder Player Core" : "Pathfinder Core Rulebook" },
    features: [],
  },
});
const feat = (name) => ({ _id: `feat-${name}`, name, data: { type: "class" } });
// A character whose class was added since the focus entry is made
function character(className, level, data = {}, feats = []) {
  return {
    _id: "pc",
    name: "Kyra",
    recordType: "characters",
    data: {
      level,
      classes: [classRecord(className)],
      spellcasting: "1",
      int: 4,
      wis: 4,
      cha: 4,
      autoSpellcasting: true,
      autoFocusSpellcasting: true,
      feats: feats.map(feat),
      ...data,
    },
    fields: {},
  };
}

// Writes a valuesToSet payload into a copy of the record, as Realm does
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
// The spellcasting part of one onAddEditFeature run
function syncValues(record) {
  const values = {};
  const entries = ctx.syncSpellcastingEntries(record, values);
  ctx.updateSpellcastingEntries(record, values, entries);
  return values;
}
const synced = (record) => apply(record, syncValues(record));
const spellKeys = (values) =>
  Object.keys(values).filter((key) => key === "data.spells" || key.startsWith("data.spells."));
const names = (record) => (record.data.spells || []).map((entry) => entry.name);
const focusEntry = (record) =>
  (record.data.spells || []).find((entry) => entry.data?.auto?.source?.endsWith(":focus"));
const spell = (name) => ({
  _id: `spell-${name}`,
  name,
  recordType: "spells",
  data: { type: "spell", level: 1, traits: ["Focus"] },
  fields: {},
});
// An entry the player made with the Add Spellcasting Entry popover
const playerEntry = (name, data) => ({
  _id: `entry-${name}`,
  name,
  data: { tradition: "Divine", attribute: "wis", training: 1, ...data },
  fields: {},
});

section("Which classes make one");
{
  const champion = synced(character("Champion", 1));
  assert("a champion: Devotion Spells", names(champion), ["Devotion Spells"]);
  const entry = focusEntry(champion);
  assert(
    "a focus entry, divine with Charisma",
    [entry.data.type, entry.data.tradition, entry.data.attribute],
    ["focus", "Divine", "cha"],
  );
  assert("it shows its cantrip and 1st-rank lists", entry.data.shownSpells, ["cantrips", "spells1"]);
  for (const [className, entryName, tradition, attribute] of [
    ["Bard", "Composition Spells", "Occult", "cha"],
    ["Druid", "Order Spells", "Primal", "wis"],
    ["Oracle", "Revelation Spells", "Divine", "cha"],
    ["Magus", "Conflux Spells", "Arcane", "int"],
    ["Animist", "Vessel Spells", "Divine", "wis"],
    ["Necromancer", "Grave Spells", "Occult", "int"],
  ]) {
    const made = focusEntry(synced(character(className, 1)));
    assert(
      `a ${className.toLowerCase()}: ${entryName}`,
      [made?.name, made?.data.tradition, made?.data.attribute],
      [entryName, tradition, attribute],
    );
  }
  for (const className of ["Fighter", "Psychic", "Rogue"]) {
    assert(`a ${className.toLowerCase()}: none`, focusEntry(synced(character(className, 1))), undefined);
  }
}

section("Classes whose focus spells come from a feat or choice");
{
  assert("a cleric without Domain Initiate: none", focusEntry(synced(character("Cleric", 1))), undefined);
  const cleric = synced(character("Cleric", 1, { flags: { divineFont: "healing" } }, ["Domain Initiate"]));
  assert("with Domain Initiate: Domain Spells", focusEntry(cleric)?.name, "Domain Spells");

  assert("a monk without a qi spell feat: none", focusEntry(synced(character("Monk", 1))), undefined);
  const monk = focusEntry(synced(character("Monk", 1, {}, ["Qi Spells"])));
  assert(
    "with Qi Spells: Qi Spells, Wisdom, the tradition left to the player",
    [monk?.name, monk?.data.attribute, monk?.data.tradition],
    ["Qi Spells", "wis", ""],
  );
  const ranger = focusEntry(synced(character("Ranger", 1, {}, ["Initiate Warden"])));
  assert("a ranger with Initiate Warden: primal, Wisdom", [ranger?.name, ranger?.data.tradition, ranger?.data.attribute], ["Warden Spells", "Primal", "wis"]);

  assert("a wizard before choosing a school: none", focusEntry(synced(character("Wizard", 1))), undefined);
  const school = synced(character("Wizard", 1, { flags: { arcaneSchool: "school-of-battle-magic" } }));
  assert("with a school: School Spells", focusEntry(school)?.name, "School Spells");
  const unified = synced(character("Wizard", 1, { flags: { arcaneSchool: "unified-magical-theory" } }));
  assert("with Unified Magical Theory: none", focusEntry(unified), undefined);
}

section("Tradition from the class's choice");
{
  let witch = synced(character("Witch", 1));
  assert("a witch's entry is made before the patron is chosen", focusEntry(witch)?.name, "Hex Spells");
  assert("with no tradition yet", focusEntry(witch).data.tradition, "");
  witch = synced(apply(witch, { "data.flags": { patron: "night-patron" } }));
  assert("the patron sets it", focusEntry(witch).data.tradition, "Occult");
  witch = synced(apply(witch, { "data.flags": { patron: "faiths-flamekeeper-patron" } }));
  assert("and a new patron changes it", focusEntry(witch).data.tradition, "Divine");
  const sorcerer = synced(character("Sorcerer", 1, { flags: { bloodline: "bloodline-fey" } }));
  assert("a sorcerer's bloodline sets theirs", focusEntry(sorcerer)?.data.tradition, "Primal");
}

section("Where it goes");
{
  const oracle = synced(character("Oracle", 1));
  assert("first, above the class's spells", names(oracle), ["Revelation Spells", "Oracle Spells"]);
  assert(
    "the class's entry can move up again, the focus entry can't",
    [oracle.data.spells[0].fields.moveUpBtn, oracle.data.spells[1].fields.moveUpBtn],
    [{ hidden: true }, { hidden: false }],
  );
  const cleric = synced(character("Cleric", 1, { flags: { divineFont: "healing" } }));
  const domain = synced(apply(cleric, { "data.feats": [feat("Domain Initiate")] }));
  assert(
    "a feat taken later puts it first too",
    names(domain),
    ["Domain Spells", "Cleric Spells", "Divine Font"],
  );
  for (const record of [oracle, domain, synced(character("Champion", 5))]) {
    assert(`a second sync writes nothing (${names(record)[0]})`, spellKeys(syncValues(record)), []);
  }
}

section("Characters from before and entries the player made");
{
  // Their class was added before the focus entry came in
  const before = character("Champion", 3, { autoFocusSpellcasting: undefined });
  assert("a character from before gets none", names(synced(before)), []);
  const oldOracle = character("Oracle", 3, {
    autoFocusSpellcasting: undefined,
    spells: [playerEntry("My Revelations", { type: "focus", spells1: [spell("Cosmic Tether")] })],
  });
  const values = syncValues(oldOracle);
  assert("their own focus entry is kept as it was", apply(oldOracle, values).data.spells[0].name, "My Revelations");
  assert("and isn't taken over", apply(oldOracle, values).data.spells[0].data.auto, undefined);
  const noFlags = character("Cleric", 3, { autoSpellcasting: undefined, autoFocusSpellcasting: undefined }, ["Domain Initiate"]);
  assert("a character from before automatic entries gets none", spellKeys(syncValues(noFlags)), []);

  const own = character("Champion", 1, {
    spells: [playerEntry("Lay on Hands", { type: "focus", spells1: [spell("Lay on Hands")] })],
  });
  assert("a new character with their own focus entry gets no second one", names(synced(own)), ["Lay on Hands"]);
}

section("Deleted, and the feat removed");
{
  const dismissed = synced(character("Champion", 1, { spellcastingDismissed: ["class:champion:focus"] }));
  assert("a deleted focus entry isn't made again", names(dismissed), []);

  let cleric = synced(character("Cleric", 1, { flags: { divineFont: "healing" } }, ["Domain Initiate"]));
  const dropped = synced(apply(cleric, { "data.feats": [] }));
  assert("removing the feat removes the empty entry", names(dropped), ["Cleric Spells", "Divine Font"]);
  cleric = apply(cleric, { "data.spells.0.data.spells1": [spell("Healer's Blessing")] });
  const kept = synced(apply(cleric, { "data.feats": [] }));
  assert("one with spells is kept, no longer managed", [names(kept)[0], kept.data.spells[0].data.auto.orphaned], ["Domain Spells", true]);
}

section("The focus pool");
{
  let champion = synced(character("Champion", 1));
  assert("the new entry shows a pool of 1", [champion.data.focusPoolMax, focusEntry(champion).data.focusPoolMax], [1, 1]);
  champion = synced(apply(champion, { "data.spells.0.data.spells1": [spell("Lay on Hands"), spell("Shield of the Spirit")] }));
  assert("two focus spells dropped in: 2", [champion.data.focusPoolMax, focusEntry(champion).data.focusPoolMax], [2, 2]);
  // Necrotic bomb and the grim fascination's grave spell (Impossible Magic pg. 27)
  let necromancer = synced(character("Necromancer", 1));
  assert("a necromancer's Grave Spells entry comes first", names(necromancer), ["Grave Spells", "Necromancer Spells"]);
  necromancer = synced(apply(necromancer, { "data.spells.0.data.spells1": [spell("Necrotic Bomb"), spell("Muscle Barrier")] }));
  assert("its two grave spells: a pool of 2", [necromancer.data.focusPoolMax, focusEntry(necromancer).data.focusPoolMax], [2, 2]);
}

section("Slots and the Level Up summary skip it");
{
  const champion = synced(character("Champion", 5));
  assert("no Level Up lines for a focus entry", ctx.getSpellcastingLevelUpChanges(champion, 6), []);
  // Set slots from level on a prepared entry the player made
  const record = apply(champion, { "data.spells": [...champion.data.spells, playerEntry("Scrolls", { type: "prepared", numSpells1: 1 })] });
  const notices = [];
  let written = {};
  const { setValues, showNotification } = ctx.api;
  ctx.api.setValues = (values) => Object.assign(written, values);
  ctx.api.showNotification = (message) => notices.push(message);
  try {
    ctx.optInSpellcastingEntry(record, "data.spells.1");
  } finally {
    Object.assign(ctx.api, { setValues, showNotification });
  }
  assert("a prepared entry can't follow the focus entry", [written["data.spells.1.data.autoSlots"], notices], [false, ["Your class has no spell slots for this entry to follow."]]);
}

section("Settles after one sync: nothing written on later loads");
{
  for (const [label, record] of [
    ["a new champion", character("Champion", 1)],
    ["a new monk with Qi Spells", character("Monk", 1, {}, ["Qi Spells"])],
    ["a new witch before the patron", character("Witch", 1)],
    ["a new necromancer", character("Necromancer", 1)],
    ["a new cleric with Domain Initiate", character("Cleric", 1, { flags: { divineFont: "healing" } }, ["Domain Initiate"])],
    ["a champion from before", character("Champion", 3, { autoSpellcasting: undefined, autoFocusSpellcasting: undefined })],
    ["a deleted focus entry", character("Champion", 1, { spellcastingDismissed: ["class:champion:focus"] })],
    [
      "an oracle from before with their own focus entry",
      character("Oracle", 3, {
        autoFocusSpellcasting: undefined,
        spells: [playerEntry("Mine", { type: "focus", focusPool: 1, focusPoolMax: 2, spells1: [spell("Cosmic Tether")] })],
      }),
    ],
  ]) {
    const once = synced(record);
    assert(`${label}: the second sync writes nothing at all`, Object.keys(syncValues(once)), []);
  }
}

process.exitCode = summary();
