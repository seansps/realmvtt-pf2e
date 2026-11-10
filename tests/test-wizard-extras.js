// Tests for the wizard's extras (class-extras.js): Drain Bonded Item casting a
// spent prepared spell, and Spell Blending's trades at daily preparations.
// Run: node tests/test-wizard-extras.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let prompts = [];
let answers = [];
let sets = [];
let casts = [];
let records = {};
const reset = (queued = []) => {
  prompts = [];
  answers = queued;
  sets = [];
  casts = [];
  state.messages = [];
};
const getPath = (target, path) => path.split(".").reduce((value, key) => value?.[key], target);
ctx.api.showPrompt = (title, text, placeholder, options, query, callback) => {
  prompts.push({ title, text, options });
  const answer = answers.shift();
  if (answer !== undefined) callback(answer);
};
ctx.api.getRecord = (type, id, cb) => cb(records[id]);
ctx.api.getValueOnRecord = (target, path) => getPath(target, path);
ctx.api.setValuesOnRecord = (record, values, cb) => {
  sets.push(values);
  if (cb) cb(record);
};
ctx.castSpell = (record, spell, path) => casts.push([spell?.name, path]);

const wizardEntry = (data = {}) => ({
  _id: "entry-wizard",
  name: "Arcane Prepared Spells",
  data: { type: "prepared", tradition: "Arcane", auto: { source: "class:wizard" }, numCantrips: 5, numSpells1: 3, numSpells2: 3, numSpells3: 2, ...data },
  fields: {},
});
const wizard = (entry = wizardEntry(), data = {}) => ({
  _id: "pc",
  name: "Ezren",
  recordType: "characters",
  data: { level: 5, flags: { arcaneThesis: "spell-blending" }, classes: [], feats: [], bonusFeats: [], spells: [entry], ...data },
});

section("Drain Bonded Item");
{
  const used = wizardEntry({
    spells1: [{ name: "Force Barrage", data: { used: true } }, { name: "Grease", data: { used: false } }],
    spells3: [{ name: "Fireball", data: { used: true } }],
  });
  const pc = wizard(used);
  records.pc = pc;
  assert(
    "the spells prepared today and already cast",
    ctx.getSpentPreparedSpells(pc).map((spell) => spell.label),
    ["Force Barrage (1st rank, Arcane Prepared Spells)", "Fireball (3rd rank, Arcane Prepared Spells)"],
  );
  const card = ctx.getDrainBondedItemUse({ name: "Drain Bonded Item" }, pc);
  assertIncludes("the card", card, "cast one spell you prepared today and already cast, without spending a spell slot");
  assertIncludes("its button, by the character's id", card, 'castSpentPreparedSpell("characters", "pc");');
  assert("other actions: nothing", ctx.getDrainBondedItemUse({ name: "Arcane Bond" }, pc), "");

  reset([["data.spells.0.data.spells3.0"]]);
  ctx.castSpentPreparedSpell("characters", "pc");
  assert("the button casts the one picked", casts, [["Fireball", "data.spells.0.data.spells3.0"]]);
  records.fresh = wizard(wizardEntry(), { _id: "fresh" });
  records.fresh._id = "fresh";
  reset();
  const notices = [];
  ctx.api.showNotification = (text) => notices.push(text);
  ctx.castSpentPreparedSpell("characters", "fresh");
  assert("nothing cast yet: a notice, no prompt", [prompts.length, notices.length], [0, 1]);
}

section("Spell Blending: the trades");
{
  assert("by the thesis flag", ctx.hasSpellBlending(wizard()), true);
  assert("or the feature's name", ctx.hasSpellBlending(wizard(undefined, { flags: {}, classes: [{ name: "Wizard", data: { features: [{ name: "Spell Blending" }] } }] })), true);
  assert("another thesis", ctx.hasSpellBlending(wizard(undefined, { flags: { arcaneThesis: "staff-nexus" } })), false);

  const counts = ctx.getSlotCounts(wizardEntry());
  const options = ctx.getSpellBlendingOptions(counts, 3, { trades: [], cantrips: null }).map((option) => option.value);
  assert(
    "two slots for one up to 2 ranks higher, never past the highest; a slot for cantrips",
    options,
    ["trade:1:2", "trade:1:3", "trade:2:3", "cantrips:1", "cantrips:2", "cantrips:3"],
  );
  let made = ctx.applySpellBlendingChoice(counts, { trades: [], cantrips: null }, "trade:1:3");
  assert("traded: two 1st for a 3rd", [made.counts.numSpells1, made.counts.numSpells3], [1, 3]);
  assert(
    "a rank already traded for isn't offered again",
    ctx.getSpellBlendingOptions(made.counts, 3, made.blending).filter((option) => option.value.startsWith("trade")).map((option) => option.value),
    [],
  );
  made = ctx.applySpellBlendingChoice(made.counts, made.blending, "cantrips:2");
  assert("a slot for two cantrips", [made.counts.numSpells2, made.counts.numCantrips], [2, 7]);
  assert("once", ctx.getSpellBlendingOptions(made.counts, 3, made.blending).some((option) => option.value.startsWith("cantrips")), false);
  assert("undone", ctx.undoSpellBlending(made.counts, made.blending), counts);
  assert("described", ctx.describeSpellBlending(made.blending), "two 1st-rank slots for a 3rd-rank slot; a 2nd-rank slot for two cantrips");
}

section("Spell Blending: at daily preparations");
{
  records.pc = wizard();
  reset([["trade:1:3"], ["done"]]);
  let next = 0;
  ctx.promptSpellBlending("pc", () => {
    next += 1;
  });
  assert("asked until Done", prompts.length, 2);
  assert(
    "one write: the counts and the day's trades",
    sets,
    [{ "data.spells.0.data.numSpells1": 1, "data.spells.0.data.numSpells3": 3, "data.spells.0.data.spellBlending": { trades: [{ from: 1, to: 3 }], cantrips: null } }],
  );
  assertIncludes("a card", state.messages[0], "Spell Blending:** two 1st-rank slots for a 3rd-rank slot");
  assert("then the next step", next, 1);

  // The next day: yesterday's trades undone first
  records.pc = wizard(wizardEntry({ numSpells1: 1, numSpells3: 3, spellBlending: { trades: [{ from: 1, to: 3 }], cantrips: null } }));
  reset([["done"]]);
  ctx.promptSpellBlending("pc");
  assert(
    "no trades today: back to the slots before",
    sets,
    [{ "data.spells.0.data.numSpells1": 3, "data.spells.0.data.numSpells3": 2, "data.spells.0.data.spellBlending": null }],
  );

  records.pc = wizard(undefined, { flags: { arcaneThesis: "staff-nexus" } });
  reset();
  next = 0;
  ctx.promptSpellBlending("pc", () => {
    next += 1;
  });
  assert("another thesis: no prompt, straight on", [prompts.length, sets.length, next], [0, 0, 1]);
}

process.exitCode = summary() > 0 ? 1 : 0;
