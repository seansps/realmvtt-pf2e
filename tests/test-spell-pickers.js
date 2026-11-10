// Tests for the spell pickers (rollhandlers/spell-pickers.js): the empty rows
// of the managed spellcasting entries, the prompts that fill them at Level Up
// and in the creation wizard, a wizard's spellbook (Available Spells), the
// Divine Font's heal or harm, and the row and query the spell list shares
// with them.
// Run: node tests/test-spell-pickers.js (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
new vm.Script(fs.readFileSync(`${__dirname}/../rollhandlers/spells.js`, "utf8"), { filename: "spells.js" }).runInContext(ctx);

const classRecord = (name) => ({
  _id: `class-${name}`,
  name,
  recordType: "class",
  data: { publication: { remaster: true, title: "Pathfinder Player Core" }, features: [] },
});
const character = (className, level, data = {}) => ({
  _id: "pc",
  name: "Ezren",
  recordType: "characters",
  data: { level, classes: [classRecord(className)], spellcasting: "1", int: 4, wis: 4, cha: 4, autoSpellcasting: true, ...data },
  fields: {},
});
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
function synced(record) {
  const values = {};
  const entries = ctx.syncSpellcastingEntries(record, values);
  ctx.updateSpellcastingEntries(record, values, entries);
  return apply(record, values);
}
// A sorcerer whose tradition is set (the bloodline's choice)
const sorcerer = (level = 1) => {
  const record = synced(character("Sorcerer", level));
  record.data.spells[0].data.tradition = "Arcane";
  return record;
};
const spell = (name, level = 1, traits = []) => ({
  _id: `spell-${name}`,
  name,
  recordType: "spells",
  data: { type: "spell", level, traits: ["Arcane", ...traits], traditions: ["arcane"], defense: { save: { statistic: "reflex", basic: true } } },
  fields: { spellBox: { hidden: false } },
});
const emptyCount = (entry, list) => (entry.data[list] || []).filter((row) => row.data?.type === "slot").length;

// Runs promptSpellPicks against a record held here: getRecord reads it,
// setValues writes into it, and answer(prompt) picks for each prompt
function runPicks(record, answer, fontSpells = [], levelUp = false) {
  const state = { record, prompts: [], writes: 0, nextCalls: 0 };
  const saved = { ...ctx.api };
  ctx.api.getRecord = (type, id, cb) => cb(JSON.parse(JSON.stringify(state.record)));
  ctx.api.setValues = (values, cb) => {
    state.writes++;
    state.record = apply(state.record, values);
    if (cb) cb(state.record);
  };
  ctx.api.getRecordsByQuery = (type, query, cb) =>
    cb(fontSpells.filter((s) => (query.name?.$in || []).includes(s.name)));
  ctx.api.showPrompt = (title, text, placeholder, options, query, cb, ok, skip, count, repeats) => {
    const prompt = { title, text, options, query, count, repeats };
    state.prompts.push(prompt);
    cb(answer(prompt));
  };
  try {
    ctx.promptSpellPicks(record._id, () => state.nextCalls++, levelUp);
  } finally {
    Object.assign(ctx.api, saved);
  }
  return state;
}

section("The empty rows");
{
  const record = sorcerer();
  const entry = record.data.spells[0];
  const groups = ctx.getOpenSpellRowGroups(record);
  assert("a group per rank with empty rows", groups.map((g) => g.list), ["cantrips", "spells1"]);
  assert("cantrips: every empty row", groups[0].rowIndexes.length, emptyCount(entry, "cantrips"));
  assert("1st rank: every empty row", groups[1].rowIndexes.length, emptyCount(entry, "spells1"));
  assert("the entry's type and tradition", [groups[1].entryType, groups[1].tradition, groups[1].rank], ["spontaneous", "Arcane", 1]);

  const noTradition = synced(character("Sorcerer", 1));
  assert("no tradition yet (no bloodline): nothing to pick", ctx.getOpenSpellRowGroups(noTradition), []);

  const off = sorcerer();
  off.data.spells[0].data.autoSlots = false;
  assert("slots turned off: left alone", ctx.getOpenSpellRowGroups(off), []);
  const orphaned = sorcerer();
  orphaned.data.spells[0].data.auto.orphaned = true;
  assert("the class is gone: left alone", ctx.getOpenSpellRowGroups(orphaned), []);
  const mine = sorcerer();
  delete mine.data.spells[0].data.auto;
  assert("an entry the player made: left alone", ctx.getOpenSpellRowGroups(mine), []);

  assert(
    "the wizard's summary",
    ctx.getOpenSpellRowsSummary(record),
    [`Sorcerer Spells: ${emptyCount(entry, "cantrips")} cantrips and ${emptyCount(entry, "spells1")} 1st-rank spells`],
  );
}

section("The query and the row");
{
  const query = ctx.getSpellSlotQuery("Occult", 0).query;
  assert("cantrips: up to 1st", query.$or[0], { "data.level": { $lte: 1 } });
  assert("cantrips: the cantrip trait", query.$and[1], { "data.traits": { $elemMatch: { $regex: "^cantrip$", $options: "i" } } });
  assert("the tradition by trait or tradition", query.$and[0].$or.length, 2);
  const third = ctx.getSpellSlotQuery("Divine", 3, ["Heal"]).query;
  assert("a rank: up to it", third.$or[0], { "data.level": { $lte: 3 } });
  assert("a rank: no cantrips", Object.keys(third.$and[1]["data.traits"]), ["$not"]);
  assert("spells it has are left out", third.$and[2], { name: { $nin: ["Heal"] } });

  const slot = ctx.buildSpellRow("spontaneous", 1, 2);
  const row = ctx.buildFilledSpellRow(slot, spell("Breathe Fire"), "spontaneous");
  assert("keeps the row's id and order", [row._id, row.data.slotOrder], [slot._id, 2]);
  assert("the spell's own data", [row.name, row.data.type, row.data.level, row.data.defenseString], ["Breathe Fire", "spell", 1, "Basic Reflex"]);
  assert(
    "spontaneous: Signature shown, no used box",
    [row.fields.signatureBox.hidden, row.fields.used.hidden, row.fields.spellSlot.hidden, row.fields.spellDetails.hidden],
    [false, true, true, false],
  );
  const prepared = ctx.buildFilledSpellRow(ctx.buildSpellRow("prepared", 1, 0), spell("Breathe Fire"), "prepared");
  assert("prepared: a used box, no Signature", [prepared.fields.used.hidden, prepared.fields.signatureBox.hidden], [false, true]);
  const cantrip = ctx.buildFilledSpellRow(ctx.buildSpellRow("prepared", 0, 0), spell("Shield", 1, ["Cantrip"]), "prepared");
  assert("a cantrip: no used box", cantrip.fields.used.hidden, true);
  const innate = ctx.buildFilledSpellRow(slot, spell("Darkness", 2), "innate");
  assert("innate: its box", [innate.fields.innateBox.hidden, innate.fields.used.hidden], [false, true]);
}

section("Picking at Level Up");
{
  const record = sorcerer();
  const cantrips = ["Shield", "Detect Magic", "Light", "Prestidigitation", "Ignition", "Telekinetic Hand"].map((n) =>
    spell(n, 1, ["Cantrip"]),
  );
  const state = runPicks(
    record,
    (prompt) =>
      prompt.title.endsWith("Cantrips") ? cantrips : [spell("Force Barrage"), spell("Fear"), spell("Sleep"), spell("Grease")],
    [],
    true,
  );
  const entry = state.record.data.spells[0];
  assert("a prompt per rank", state.prompts.map((p) => p.title), ["Sorcerer Spells: Cantrips", "Sorcerer Spells: 1st-Rank Spells"]);
  assert("as many picks as empty rows", state.prompts.map((p) => p.count), [
    emptyCount(record.data.spells[0], "cantrips"),
    emptyCount(record.data.spells[0], "spells1"),
  ]);
  assert("the repertoire text", state.prompts[1].text, `Add up to ${state.prompts[1].count} 1st-rank spells to your repertoire. Skip to choose later: the wand on an empty row picks one.`);
  assert("one write per prompt", state.writes, 2);
  assert("then the next step, once", state.nextCalls, 1);
  assert("no empty rows left", ctx.getOpenSpellRowGroups(state.record), []);
  assert("the spells in order", entry.data.spells1.map((r) => r.name), ["Force Barrage", "Fear", "Sleep", "Grease"].slice(0, state.prompts[1].count));
  assert("extra picks are left out", entry.data.cantrips.map((r) => r.name).includes("Telekinetic Hand"), false);

  // A repertoire can hold a spell at more than one rank (Player Core pg. 297)
  const third = sorcerer(3);
  third.data.spells[0].data.spells1[0] = ctx.buildFilledSpellRow(third.data.spells[0].data.spells1[0], spell("Fear"), "spontaneous");
  const prompts = runPicks(third, () => [], [], true).prompts;
  const excluded = (title) => prompts.find((p) => p.title.endsWith(title)).query.query.$and[2];
  assert("the rank's own spells are left out", excluded("1st-Rank Spells"), { name: { $nin: ["Fear"] } });
  assert("other ranks' aren't: Fear again at 2nd", excluded("2nd-Rank Spells"), undefined);

  const skipped = runPicks(sorcerer(), () => []);
  assert("skipping: every group asked once, nothing written", [skipped.prompts.length, skipped.writes, skipped.nextCalls], [2, 0, 1]);
  const partly = runPicks(sorcerer(), (p) => (p.title.endsWith("Cantrips") ? [] : [spell("Fear")]));
  assert("fewer picks than rows: asked once", partly.prompts.length, 2);
  assert("the rest stay empty", emptyCount(partly.record.data.spells[0], "spells1"), emptyCount(sorcerer().data.spells[0], "spells1") - 1);

  const none = runPicks(synced(character("Fighter", 2)), () => []);
  assert("not a caster: straight on", [none.prompts.length, none.nextCalls], [0, 1]);
}

section("A wizard's spellbook at 1st level");
{
  const book = (record) => record.data.spells.find((e) => e.data.auto?.source === "class:wizard");
  const record = synced(character("Wizard", 1));
  const cantrips = Array.from({ length: 11 }, (_, i) => spell(`Cantrip ${i}`, 1, ["Cantrip"]));
  const firsts = ["Fear", "Force Barrage", "Grease", "Sleep", "Mystic Armor", "Runic Weapon"].map((n) => spell(n));
  const state = runPicks(record, (prompt) => {
    if (prompt.title === "Wizard Spells: Spellbook") return prompt.count === 10 ? cantrips : firsts;
    return prompt.options ? prompt.options.slice(0, prompt.count).map((o) => o.value) : [];
  });
  const titles = state.prompts.map((p) => p.title);
  assert("the book first: 10 cantrips, then five 1st-rank spells", state.prompts.slice(0, 2).map((p) => [p.title, p.count, p.rank]), [
    ["Wizard Spells: Spellbook", 10, undefined],
    ["Wizard Spells: Spellbook", 5, undefined],
  ]);
  assert("the book's text", state.prompts[0].text, "Add up to 10 cantrips to your spellbook. Skip to choose later: drag spells into Available Spells.");
  assert("from the compendium", state.prompts.slice(0, 2).every((p) => p.query && !p.options), true);
  const entry = book(state.record);
  assert("the book holds 10 cantrips and five spells", [entry.data.knownSpells.filter((s) => s.name.startsWith("Cantrip")).length, entry.data.knownSpells.length], [10, 15]);
  assert("each a copy with its own id", entry.data.knownSpells.every((s) => s._id && !s._id.startsWith("spell-")), true);
  assert("then the slots", titles.slice(2).every((t) => /Cantrips|Rank Spells/.test(t)), true);
  const slots = state.prompts.filter((p) => p.title.endsWith("1st-Rank Spells"));
  assert("prepared from the book", slots[0].options.map((o) => o.label), ["Fear", "Force Barrage", "Grease", "Sleep", "Mystic Armor"]);
  assert("no compendium query then", slots[0].query, null);
  assert("the text says prepare", slots[0].text.startsWith("Prepare up to"), true);
  assert("the picked spells are prepared", entry.data.spells1.filter((r) => r.data?.type !== "slot").map((r) => r.name)[0], "Fear");

  // Some already in the book
  const started = synced(character("Wizard", 1));
  book(started).data.knownSpells = [spell("Fear"), spell("Force Barrage"), spell("Shield", 1, ["Cantrip"]), spell("Darkness", 2)];
  const rest = runPicks(started, () => []).prompts.filter((p) => p.title === "Wizard Spells: Spellbook");
  assert("only what's missing", rest.map((p) => p.count), [9, 2]);
  assert("the book's spells are left out", rest[1].query.query.$and[2], { name: { $nin: ["Fear", "Force Barrage", "Shield", "Darkness"] } });

  // Skipped: the slots wait for the wand, never the compendium
  const skipped = runPicks(synced(character("Wizard", 1)), () => []);
  assert("an empty book: its slots aren't offered", skipped.prompts.map((p) => p.title), ["Wizard Spells: Spellbook", "Wizard Spells: Spellbook"]);

  const summary = ctx.getOpenSpellRowsSummary(synced(character("Wizard", 1)));
  assert("the wizard step's line", summary, ["Wizard Spells: 10 cantrips and 5 1st-rank spells for your spellbook"]);
}

section("The same spell in more than one slot");
{
  // A wizard's book, then its slots: picking Fear twice fills two 1st-rank slots
  const book = (record) => record.data.spells.find((e) => e.data.auto?.source === "class:wizard");
  const cantrips = Array.from({ length: 10 }, (_, i) => spell(`Cantrip ${i}`, 1, ["Cantrip"]));
  const firsts = ["Fear", "Force Barrage", "Grease", "Sleep", "Mystic Armor"].map((n) => spell(n));
  const state = runPicks(synced(character("Wizard", 1)), (prompt) => {
    if (prompt.title === "Wizard Spells: Spellbook") return prompt.count === 10 ? cantrips : firsts;
    if (prompt.title.endsWith("1st-Rank Spells")) {
      const fear = prompt.options.find((o) => o.label === "Fear").value;
      return Array.from({ length: prompt.count }, () => fear);
    }
    return [];
  });
  const byTitle = (end) => state.prompts.find((p) => p.title.endsWith(end));
  const slots = byTitle("1st-Rank Spells");
  assert("prepared slots allow repeats", slots.repeats, true);
  assert("the text says so", slots.text.includes("Pick a spell again to prepare it in another slot."), true);
  assert("the book doesn't", state.prompts.filter((p) => p.title === "Wizard Spells: Spellbook").map((p) => p.repeats), [false, false]);
  assert("nor cantrips", byTitle("Cantrips").repeats, false);
  const prepared = book(state.record).data.spells1.filter((r) => r.data?.type !== "slot");
  assert("every slot holds Fear", [prepared.length, prepared.every((r) => r.name === "Fear")], [slots.count, true]);
  assert("each row keeps its own id", new Set(prepared.map((r) => r._id)).size, prepared.length);

  // A druid prepares from the compendium: the same record twice
  const druid = synced(character("Druid", 1));
  druid.data.spells[0].data.tradition = druid.data.spells[0].data.tradition || "Primal";
  const druidRun = runPicks(druid, (prompt) =>
    prompt.title.endsWith("1st-Rank Spells") ? Array.from({ length: prompt.count }, () => spell("Heal")) : [],
  );
  const druidSlots = druidRun.prompts.find((p) => p.title.endsWith("1st-Rank Spells"));
  assert("a druid's slots allow repeats", druidSlots.repeats, true);
  const druidRows = druidRun.record.data.spells[0].data.spells1.filter((r) => r.data?.type !== "slot");
  assert("a druid's slots all hold it", druidRows.map((r) => r.name), Array(druidSlots.count).fill("Heal"));

  // A repertoire holds a spell once
  const repertoire = runPicks(sorcerer(), () => []).prompts.find((p) => p.title.endsWith("1st-Rank Spells"));
  assert("a repertoire doesn't", [repertoire.repeats, repertoire.text.includes("again")], [false, false]);
}

section("Prepared casters at Level Up");
{
  const record = synced(character("Wizard", 3));
  const wizard = record.data.spells.findIndex((e) => e.data.auto?.source === "class:wizard");
  record.data.spells[wizard].data.knownSpells = [spell("Fear")];
  const state = runPicks(record, () => [spell("Darkness", 2), spell("Grease"), spell("Sleep")], [], true);
  assert("only the book is asked", state.prompts.map((p) => [p.title, p.count]), [["Wizard Spells: Spellbook", 2]]);
  assert("the book's Level Up text", state.prompts[0].text, "Add 2 spells of any rank you can cast to your spellbook. Skip to choose later: drag spells into Available Spells.");
  assert("any rank with slots", state.prompts[0].query.query.$or[0], { "data.level": { $lte: 2 } });
  assert("not the book's own spells", state.prompts[0].query.query.$and[2], { name: { $nin: ["Fear"] } });
  assert("two added, in one write", [state.record.data.spells[wizard].data.knownSpells.map((s) => s.name), state.writes], [["Fear", "Darkness", "Grease"], 1]);
  assert("no slot prepared", ctx.getOpenSpellRowGroups(state.record).length, ctx.getOpenSpellRowGroups(record).length);

  const druid = synced(character("Druid", 3));
  druid.data.spells[0].data.tradition = druid.data.spells[0].data.tradition || "Primal";
  const druidUp = runPicks(druid, () => [spell("Fear")], [], true);
  assert("a druid has no book: nothing at Level Up", [druidUp.prompts.length, druidUp.writes, druidUp.nextCalls], [0, 0, 1]);
  const druidNew = runPicks(synced(character("Druid", 1)), () => []);
  assert("a druid at 1st level: slots from the compendium", druidNew.prompts.length > 0 && druidNew.prompts.every((p) => p.query && !p.options), true);

  const witch = synced(character("Witch", 3));
  const witchEntry = witch.data.spells.find((e) => e.data.auto?.source === "class:witch");
  witchEntry.data.tradition = "Occult";
  const witchUp = runPicks(witch, () => [], [], true);
  assert("a witch's familiar", witchUp.prompts.map((p) => [p.title, p.count]), [[`${witchEntry.name}: Familiar`, 2]]);
  assert("the familiar's text", witchUp.prompts[0].text.startsWith("Add 2 spells of any rank you can cast to your familiar."), true);
}

section("A magus's spellbook, per edition");
{
  const bookOf = (record) => record.data.spells.find((e) => e.data.auto?.source === "class:magus");
  const first = runPicks(synced(character("Magus", 1)), () => []).prompts.filter((p) => p.title.endsWith(": Spellbook"));
  assert("Impossible Magic: 8 cantrips and five 1st-rank spells", first.map((p) => p.count), [8, 5]);
  assert("named for the entry", first[0].title, `${bookOf(synced(character("Magus", 1))).name}: Spellbook`);

  const legacyMagus = character("Magus", 1);
  legacyMagus.data.classes[0].data.publication = { remaster: false, title: "Pathfinder Secrets of Magic" };
  const legacy = runPicks(synced(legacyMagus), () => []).prompts.filter((p) => p.title.endsWith(": Spellbook"));
  assert("Secrets of Magic: 8 cantrips and four 1st-level spells", legacy.map((p) => p.count), [8, 4]);

  const leveled = runPicks(synced(character("Magus", 3)), () => [], [], true);
  assert("Level Up: two for the book, no slots", leveled.prompts.map((p) => [p.title.endsWith(": Spellbook"), p.count]), [[true, 2]]);
}

section("A school wizard's curriculum");
{
  const school = { flags: { arcaneSchool: "school-of-battle-magic" } };
  const prompts = runPicks(synced(character("Wizard", 1, school)), () => []).prompts;
  assert("the cantrips' text has no curriculum line", prompts[0].text.includes("curriculum"), false);
  assert(
    "the 1st-rank text says to drag the curriculum in",
    prompts[1].text,
    "Add up to 5 1st-rank spells to your spellbook. Also drag your school's two 1st-rank curriculum spells into Available Spells. Skip to choose later: drag spells into Available Spells.",
  );
  assert("still five picked", prompts[1].count, 5);

  // The book has room for the two: after two curriculum spells, still five
  const dragged = synced(character("Wizard", 1, school));
  const wizardBook = dragged.data.spells.find((e) => e.data.auto?.source === "class:wizard");
  wizardBook.data.knownSpells = [spell("Force Barrage"), spell("Mystic Armor")];
  assert("two dragged in first: five still asked", runPicks(dragged, () => []).prompts.filter((p) => p.title.endsWith(": Spellbook")).pop().count, 5);
  wizardBook.data.knownSpells.push(...["Fear", "Grease", "Sleep", "Runic Weapon"].map((n) => spell(n)));
  assert("six in the book: one more", runPicks(dragged, () => []).prompts.filter((p) => p.title.endsWith(": Spellbook")).pop().count, 1);

  const unified = runPicks(synced(character("Wizard", 1, { flags: { arcaneSchool: "unified-magical-theory" } })), () => []).prompts;
  assert("Unified Magical Theory: no curriculum", [unified[1].text.includes("curriculum"), unified[1].count], [false, 5]);

  const newRank = runPicks(synced(character("Wizard", 3, school)), () => [], [], true).prompts[0];
  assert("Level Up to a new rank: one curriculum spell", newRank.text.includes("Also drag a spell from your school's curriculum"), true);
  const sameRank = runPicks(synced(character("Wizard", 4, school)), () => [], [], true).prompts[0];
  assert("no new rank: no line", sameRank.text.includes("curriculum"), false);
  const tenth = runPicks(synced(character("Wizard", 19, school)), () => [], [], true).prompts[0];
  assert("10th rank: no curriculum", tenth.text.includes("curriculum"), false);
}

section("Divine Font");
{
  const heal = spell("Heal");
  const harm = spell("Harm");
  const fontOf = (record) => record.data.spells.find((e) => /:font$/.test(e.data.auto?.source || ""));
  const healer = synced(character("Cleric", 1, { flags: { divineFont: "heal" } }));
  const state = runPicks(healer, () => [], [heal, harm]);
  const font = fontOf(state.record);
  assert("the chosen font fills every slot", font.data.spells1.map((r) => r.name), fontOf(healer).data.spells1.map(() => "Heal"));
  assert("without asking", state.prompts.some((p) => p.title === "Divine Font"), false);

  const unchosen = synced(character("Cleric", 1));
  const asked = runPicks(unchosen, (p) => (p.title === "Divine Font" ? [harm._id] : []), [heal, harm]);
  const prompt = asked.prompts.find((p) => p.title === "Divine Font");
  assert("no font yet: heal or harm", prompt.options.map((o) => o.label), ["Heal", "Harm"]);
  assert("the pick fills every slot", fontOf(asked.record).data.spells1.every((r) => r.name === "Harm"), true);
  const missing = runPicks(synced(character("Cleric", 1, { flags: { divineFont: "heal" } })), () => [], []);
  assert("the spell isn't in the campaign: left empty", missing.writes, 0);

  // A legacy and a remastered record of each
  const legacy = (name) => ({ ...spell(name), _id: `legacy-${name}`, data: { ...spell(name).data, publication: { remaster: false } } });
  const remaster = (name) => ({ ...spell(name), _id: `remaster-${name}`, data: { ...spell(name).data, publication: { remaster: true } } });
  const both = [legacy("Heal"), remaster("Heal"), remaster("Harm"), legacy("Harm")];
  const dupes = runPicks(synced(character("Cleric", 1)), (p) => (p.title === "Divine Font" ? [p.options[0].value] : []), both);
  const dupePrompt = dupes.prompts.find((p) => p.title === "Divine Font");
  assert("both in the compendium: each name once", dupePrompt.options.map((o) => o.label), ["Heal", "Harm"]);
  assert("the remastered record", dupePrompt.options.map((o) => o.value), ["remaster-Heal", "remaster-Harm"]);
  const chosen = runPicks(synced(character("Cleric", 1, { flags: { divineFont: "heal" } })), () => [], both);
  assert("a chosen font takes the remastered one", fontOf(chosen.record).data.spells1[0].data.publication.remaster, true);

  // At Level Up the font's slots are still filled: heal or harm only
  const leveled = runPicks(synced(character("Cleric", 3, { flags: { divineFont: "heal" } })), () => [], [heal, harm], true);
  assert("Level Up: the font, no other prepared slots", [leveled.prompts.length, fontOf(leveled.record).data.spells2.every((r) => r.name === "Heal")], [0, true]);
}

section("The sheet and the wizard use them");
{
  const read = (file) => fs.readFileSync(`${__dirname}/../${file}`, "utf8");
  const sheet = read("characters-main.html");
  assert("Level Up ends with the pickers", /promptSpellPicks\(record\._id, next, true\)\);\s*runLevelUpSteps\(steps, 0, newLevel\)/.test(sheet), true);
  assert("1st level from level 0 too", /promptSpellPicks\(record\._id, next\)\);\s*runLevelUpSteps\(steps, 0, 1\)/.test(sheet), true);
  const list = read("spell-list.html");
  assert("a dropped spell's row", list.includes("buildFilledSpellRow("), true);
  assert("the wand's query", list.includes("getSpellSlotQuery(tradition, spellSlotLevel)"), true);
  const config = JSON.parse(read("ruleset.config.json"));
  const steps = JSON.stringify(config).includes('"file":"wizards/characters/spells.html"');
  assert("the wizard's Spells step", steps, true);
  assert("the script is loaded", JSON.stringify(config).includes('"file":"rollhandlers/spell-pickers.js"'), true);
}

process.exitCode = summary() > 0 ? 1 : 0;
