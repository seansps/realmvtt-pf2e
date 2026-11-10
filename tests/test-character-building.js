// Tests for character building (character-growth.js): feat prerequisites and
// lineage warnings, Adopted Ancestry, and starting wealth above 1st level.
// Run: node tests/test-character-building.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let prompts = [];
let notifications = [];
let sets = [];
let answers = [];
const reset = (queued = []) => {
  prompts = [];
  notifications = [];
  sets = [];
  answers = queued;
  state.messages = [];
};
ctx.api.showNotification = (text, color, title) => notifications.push({ text, title });
ctx.api.showPrompt = (title, text, placeholder, options, query, callback) => {
  prompts.push({ title, text, options, query });
  const answer = answers.shift();
  callback(answer === undefined ? [] : answer);
};
// The confirm takes the next queued answer: true confirms
let confirms = [];
ctx.api.showConfirm = (title, text, yes, no, onYes) => {
  confirms.push(text);
  if (answers.shift() === true) onYes();
};
ctx.api.setValuesOnRecord = (record, values, cb) => {
  sets.push(values);
  if (cb) cb(record);
};

const character = (data = {}) => ({
  _id: "pc",
  recordType: "characters",
  name: "Valeros",
  fields: {},
  data: { level: 5, feats: [], bonusFeats: [], classes: [], ancestries: [], heritages: [], loreSkills: [], ...data },
});
const feat = (name, data = {}) => ({ _id: name, name, data: { type: "general", traits: [], prerequisites: "", ...data } });

section("Prerequisites: proficiency ranks");
{
  const pc = character({ athletics: "2", arcana: "1", perception: "3", loreSkills: [{ name: "Warfare Lore", data: { rank: "1" } }] });
  assert("trained in a skill met", ctx.isPrerequisiteMet(pc, "trained in Athletics"), true);
  assert("master in a skill unmet", ctx.isPrerequisiteMet(pc, "master in Athletics"), false);
  assert("untrained skill unmet", ctx.isPrerequisiteMet(pc, "trained in Stealth"), false);
  assert("perception", ctx.isPrerequisiteMet(pc, "master in Perception"), true);
  assert("one of a list met", ctx.isPrerequisiteMet(pc, "trained in Arcana, Nature, Occultism, or Religion"), true);
  assert("none of a list unmet", ctx.isPrerequisiteMet(pc, "expert in Arcana, Nature, Occultism, or Religion"), false);
  assert("a named Lore", ctx.isPrerequisiteMet(pc, "trained in Warfare Lore"), true);
  assert("a missing Lore", ctx.isPrerequisiteMet(pc, "trained in Sailing Lore"), false);
  assert("at least one skill", ctx.isPrerequisiteMet(pc, "expert in at least one skill"), true);
  assert("something it can't read", ctx.isPrerequisiteMet(pc, "trained in the spell attack modifier"), null);
}

section("Prerequisites: attributes and names");
{
  const pc = character({
    cha: 3,
    str: 1,
    feats: [feat("Power Attack", { type: "class" }), { _id: "slot", name: "Empty", data: { type: "slot" } }],
    classes: [{ name: "Fighter", data: { features: [{ name: "Shield Block" }] } }],
    ancestries: [{ name: "Elf", data: { features: [] } }],
  });
  assert("attribute met", ctx.isPrerequisiteMet(pc, "Charisma +3"), true);
  assert("attribute unmet", ctx.isPrerequisiteMet(pc, "Strength +2"), false);
  assert("a feat", ctx.isPrerequisiteMet(pc, "Power Attack"), true);
  assert("a class feature", ctx.isPrerequisiteMet(pc, "Shield Block"), true);
  assert("the ancestry", ctx.isPrerequisiteMet(pc, "Elf"), true);
  assert("a missing feat", ctx.isPrerequisiteMet(pc, "Sudden Charge"), false);
  assert("a name with small words", ctx.isPrerequisiteMet(pc, "Shield of Reckoning"), false);
  assert("one of two feats", ctx.isPrerequisiteMet(pc, "Reactive Shield or Shield Block"), true);
  assert("neither feat", ctx.isPrerequisiteMet(pc, "Reactive Shield or Sudden Charge"), false);
  assert("plain words are left to the GM", ctx.isPrerequisiteMet(pc, "you have a familiar"), null);
  assert("a heritage phrase is left to the GM", ctx.isPrerequisiteMet(pc, "Ancient Elf heritage"), null);
}

section("Prerequisites: the warning");
{
  assert("parts split on semicolons", ctx.splitPrerequisites("trained in Athletics; Power Attack"), ["trained in Athletics", "Power Attack"]);
  assert("a list keeps its commas", ctx.splitPrerequisites("trained in Arcana, Nature, or Religion"), ["trained in Arcana, Nature, or Religion"]);
  assert("None is nothing", ctx.splitPrerequisites("None"), []);
  const pc = character({ athletics: "1" });
  assert(
    "lists only what's unmet",
    ctx.getPrerequisiteWarning(pc, feat("Brutal Bully", { prerequisites: "trained in Athletics; Power Attack; member of a gang" })),
    "Brutal Bully lists prerequisites you don't seem to meet: Power Attack. Your GM may waive this.",
  );
  assert("met: no warning", ctx.getPrerequisiteWarning(pc, feat("Quick Jump", { prerequisites: "trained in Athletics" })), "");
}

section("Lineage feats");
{
  const lineage = (name) => feat(name, { type: "ancestry", traits: ["Elf", "Lineage"] });
  const pc = character({ level: 1, feats: [lineage("Ancient Elf Lineage")] });
  assertIncludes("a second lineage feat", ctx.getLineageWarning(pc, lineage("Other Lineage"), 1), "You already have a lineage feat (Ancient Elf Lineage)");
  assert("the same feat again", ctx.getLineageWarning(pc, lineage("Ancient Elf Lineage"), 1), "");
  assertIncludes("above 1st level", ctx.getLineageWarning(character(), lineage("Other Lineage"), 5), "only at 1st level");
  assert("at 1st level", ctx.getLineageWarning(character(), lineage("Other Lineage"), 1), "");
  assert("not a lineage feat", ctx.getLineageWarning(pc, feat("Elven Lore"), 5), "");
}

section("Every feat warning together");
{
  const pc = character({ level: 5, feats: [feat("Ancient Elf Lineage", { traits: ["Lineage"] })] });
  const warnings = ctx.getFeatWarnings(pc, feat("Other Lineage", { traits: ["Lineage"], prerequisites: "expert in Nature" }), 5);
  assert("titles", warnings.map((warning) => warning.title), ["Lineage Feat", "Feat Prerequisites"]);
  assert("nothing for a plain feat", ctx.getFeatWarnings(pc, feat("Toughness"), 3), []);
}

section("Adopted Ancestry");
{
  const adopted = feat("Adopted Ancestry", {
    choices: [{ _id: "c", data: { flag: "ancestry", query: '{"type": "features", "query": {}}', choices: [JSON.stringify({ _id: "a", name: "Dwarf" })] } }],
  });
  const pc = character({ ancestries: [{ name: "Human", data: {} }], feats: [adopted] });
  assert("the ancestry it picked", ctx.getAdoptedAncestries(pc), ["Dwarf"]);
  assert("none without the feat", ctx.getAdoptedAncestries(character()), []);
  const query = ctx.getFeatSlotQuery(pc, "ancestry", 5).query["data.traits"].$elemMatch.$regex;
  assertIncludes("the ancestry feat query", query, "Dwarf");
  assertIncludes("keeps the character's own", query, "Human");

  assert("its choice picks an ancestry", ctx.getAdoptedAncestryQuery(adopted, adopted.data.choices[0]), { type: "ancestry", query: {} });
  assert("other choices are left alone", ctx.getAdoptedAncestryQuery(feat("Natural Ambition"), { data: { flag: "ancestry" } }), null);

  // The choice prompt asks for an ancestry, not a feature
  reset();
  const unpicked = { ...adopted, data: { ...adopted.data, choices: [{ ...adopted.data.choices[0], data: { ...adopted.data.choices[0].data, choices: [] } }] } };
  ctx.promptForChoices(pc, [{ feature: unpicked, group: { name: "Feats", dataPath: "data.feats" }, choiceObj: unpicked.data.choices[0] }], 0);
  assert("the prompt's query", prompts[0]?.query, { type: "ancestry", query: {} });
}

section("Starting wealth");
{
  assert("level 1", ctx.getCharacterWealth(1), { items: [], currency: 15, lumpSum: 15 });
  assert("level 5", ctx.getCharacterWealth(5), { items: [[4, 1], [3, 2], [2, 1], [1, 2]], currency: 50, lumpSum: 270 });
  assert("level 20 lump sum", ctx.getCharacterWealth(20).lumpSum, 112000);
  assert("level 0", ctx.getCharacterWealth(0), null);
  assert("describes the items", ctx.describeWealthItems([[4, 1], [3, 2]]), "one 4th-level item, two 3rd-level items");

  const pc = character({ level: 5, gp: 3 });
  assert("two options", ctx.getStartingWealthOptions(pc).map((option) => option.value), ["items", "lumpSum"]);
  assert("level 1 has only the coins", ctx.getStartingWealthOptions(character({ level: 1 })).map((option) => option.value), ["lumpSum"]);
  assert("items: the currency added", ctx.getStartingWealthValues(pc, "items"), { "data.gp": 53, "data.startingWealth": { level: 5, option: "items" }, "fields.startingWealthBtn.hidden": true });
  assert("lump sum added", ctx.getStartingWealthValues(pc, "lumpSum")["data.gp"], 273);
  assert("an unknown option", ctx.getStartingWealthValues(pc, "other"), null);
  assertIncludes("lump sum card", ctx.getStartingWealthMessage(pc, "lumpSum"), "270 gp to buy common items of level 4 or lower");
  assertIncludes("items card", ctx.getStartingWealthMessage(pc, "items"), "50 gp and permanent items: one 4th-level item, two 3rd-level items, one 2nd-level item, two 1st-level items");
  assertIncludes("thousands", ctx.getStartingWealthOptions(character({ level: 10 }))[1].label, "2,300 gp");
  assertIncludes(
    "notes it was taken",
    ctx.getStartingWealthPromptText(character({ level: 5, startingWealth: { level: 5, option: "items" } })),
    "already taken at level 5",
  );

  confirms = [];
  reset([["lumpSum"], true]);
  ctx.takeStartingWealth(pc);
  assertIncludes("a confirm with the coins first", confirms[0], "Add 270 gp to");
  assert("one write", sets, [{ "data.gp": 273, "data.startingWealth": { level: 5, option: "lumpSum" }, "fields.startingWealthBtn.hidden": true }]);
  assert("one card", state.messages.length, 1);

  reset();
  ctx.takeStartingWealth(pc);
  assert("cancel: nothing written", sets, []);

  reset([["items"], false]);
  ctx.takeStartingWealth(pc);
  assert("the confirm cancelled: nothing written", sets, []);

  reset();
  ctx.takeStartingWealth(character({ level: 0 }));
  assert("level 0: a notice, no prompt", [prompts.length, notifications.length], [0, 1]);
}

process.exitCode = summary() > 0 ? 1 : 0;
