// Tests for Dual-Class PCs (dual-class.js, roadmap B18): the second class line,
// the higher proficiency and Hit Points, both classes' features, feat slots,
// spellcasting and Level Up (Gamemastery Guide pg. 192-193).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let setting = "yes";
ctx.api.getSetting = (key) => (key === "dualClass" ? setting : undefined);

const cleric = {
  _id: "c1",
  name: "Cleric",
  data: {
    hp: 8,
    classDC: "1",
    perception: "1",
    spellcasting: "1",
    savingThrows: { fortitude: "1", reflex: "1", will: "2" },
    defenses: { unarmored: "1", light: "1", medium: "1", heavy: "0" },
    attacks: { unarmed: "1", simple: "1", martial: "0", advanced: "0" },
    trainedSkills: ["Religion"],
    trainedSkillsAdditional: 2,
    ancestryFeatLevels: [1, 5],
    classFeatLevels: [2, 4],
    generalFeatLevels: [3],
    skillFeatLevels: [2, 4],
    skillIncreaseLevels: [3, 5],
    traits: ["Cleric"],
    features: [{ _id: "f1", name: "Divine Font", data: { level: 1 } }],
  },
};
const ranger = {
  _id: "c2",
  name: "Ranger",
  data: {
    hp: 10,
    classDC: "1",
    perception: "2",
    savingThrows: { fortitude: "2", reflex: "2", will: "1" },
    defenses: { unarmored: "1", light: "1", medium: "1", heavy: "0" },
    attacks: { unarmed: "1", simple: "1", martial: "1", advanced: "0" },
    trainedSkills: ["Nature", "Survival"],
    trainedSkillsAdditional: 4,
    ancestryFeatLevels: [1, 5],
    classFeatLevels: [1, 2, 4],
    generalFeatLevels: [3],
    skillFeatLevels: [2, 4, 5],
    skillIncreaseLevels: [3, 6],
    traits: ["Ranger", "Uncommon"],
    features: [
      { _id: "f2", name: "Hunt Prey", data: { level: 1 } },
      { _id: "f3", name: "Ranger Expertise", data: { level: 4 } },
    ],
  },
};

const pc = (classes = [cleric, ranger], extra = {}, recordExtra = {}) => ({
  _id: "char-1",
  name: "Kyra",
  recordType: "characters",
  ...recordExtra,
  data: { level: 3, classes, traits: ["Human"], traitsList: [], feats: [], ...extra },
});

section("the higher of the two");
{
  assert("Hit Points: the higher", ctx.getClassHitPoints(pc()), 10);
  assert("one class", ctx.getClassHitPoints(pc([cleric])), 8);
  assert("no class", ctx.getClassHitPoints(pc([])), 0);

  const prof = { classDC: 1, perception: 1, spellcasting: 1, reflex: 1, fortitude: 1, will: 2, martial: 0, simple: 1 };
  ctx.applySecondClassProficiencies(prof, ranger);
  assert("each save at its higher rank", [prof.fortitude, prof.reflex, prof.will], [2, 2, 2]);
  assert("Perception and martial up", [prof.perception, prof.martial], [2, 1]);
  assert("spellcasting stays", prof.spellcasting, 1);

  const other = { otherRank: 0 };
  ctx.applySecondClassProficiencies(other, { data: { attacks: { other: { name: "Bombs", rank: "1" } } } });
  assert("an other weapon proficiency", [other.otherName, other.otherRank], ["Bombs", 1]);
  const none = { will: 2 };
  ctx.applySecondClassProficiencies(none, null);
  assert("no second class changes nothing", none, { will: 2 });
}

section("feat slots");
{
  const variants = { ...ctx.getVariantRules() };
  const levels = ctx.getFeatSlotLevels(pc(), variants);
  assert("class feats from both", [...levels.class].sort((a, b) => a - b), [1, 2, 2, 4, 4]);
  assert("general once per level", levels.general, [3]);
  assert("skill feats at either class's levels", levels.skill, [2, 4, 5]);
  assert("one class is unchanged", ctx.getFeatSlotLevels(pc([cleric]), variants).class, [2, 4]);

  const query = ctx.getFeatSlotQuery(pc(), "class", 2).query;
  assertIncludes("the picker offers either class", JSON.stringify(query), "Cleric|Ranger|Archetype");
}

section("Level Up");
{
  const gains = ctx.getLevelUpGains(pc(), 4);
  assert("two class feats at a level both give", gains.featTypes.filter((type) => type === "class").length, 2);
  assert("one skill feat", gains.featTypes.filter((type) => type === "skill").length, 1);
  assert("features from both", gains.classFeatures, ["Ranger Expertise"]);
  assert("Hit Points from the higher class", gains.hp, 10);
  assert("a skill increase at either class's level", [ctx.getLevelUpGains(pc(), 6).skillIncrease, ctx.getLevelUpGains(pc(), 3).skillIncrease, ctx.getLevelUpGains(pc(), 4).skillIncrease], [true, true, false]);
}

section("class feature paths and choices");
{
  assert("the first", ctx.isClassFeaturePath("data.classes.0.data.features"), true);
  assert("the second", ctx.isClassFeaturePath("data.classes.1.data.features"), true);
  assert("not a feat path", ctx.isClassFeaturePath("data.feats"), false);
  assert("finds the second class", ctx.getClassForFeaturePath(pc(), "data.classes.1.data.features").name, "Ranger");
}

section("spellcasting");
{
  const wizard = { name: "Wizard", data: { spellcasting: "1", features: [] } };
  const sorcerer = { name: "Sorcerer", data: { spellcasting: "1", features: [] } };
  const specs = ctx.getWantedSpellcastingEntries(pc([wizard, sorcerer], { level: 1 }), 1);
  const sources = specs.map((spec) => spec.source);
  assert("an entry from each class", [sources.some((s) => s.startsWith("class:wizard")), sources.some((s) => s.startsWith("class:sorcerer"))], [true, true]);
  const one = ctx.getWantedSpellcastingEntries(pc([wizard], { level: 1 }), 1).map((spec) => spec.source);
  assert("one class: only its own", one.some((s) => s.startsWith("class:sorcerer")), false);
}

section("the second class line");
{
  setting = "yes";
  assert("the setting on shows it", ctx.getDualClassFieldValues(pc([cleric])), { "fields.secondClassBox.hidden": false });
  assert("already shown: no write", ctx.getDualClassFieldValues(pc([cleric], {}, { fields: { secondClassBox: { hidden: false } } })), {});
  setting = "no";
  assert("off, never shown: no write", ctx.getDualClassFieldValues(pc([cleric])), {});
  assert("off, shown: hides", ctx.getDualClassFieldValues(pc([cleric], {}, { fields: { secondClassBox: { hidden: false } } })), { "fields.secondClassBox.hidden": true });
  assert("off with a second class: stays, with the trash button", ctx.getDualClassFieldValues(pc(), ctx.getVariantRules()), {
    "fields.secondClassBox.hidden": false,
    "fields.pickSecondClassBtn.hidden": true,
    "fields.clearSecondClassBtn.hidden": false,
  });
  setting = "yes";

  assert("the first line's list shows the first class", ctx.getFirstClassFilters(pc()), [{ field: "classSlot", operator: "equals", value: "first" }]);
  assert("no filter with one class", ctx.getFirstClassFilters(pc([cleric])), []);
}

section("picking and clearing");
{
  const values = ctx.getSecondClassValues(pc([cleric]), ranger);
  assert("both classes, tagged", values["data.classes"].map((c) => [c.name, c.data.classSlot]), [["Cleric", "first"], ["Ranger", "second"]]);
  assert("the name on the line", values["data.secondClassName"], "Ranger");
  assert("its traits, without rarity", values["data.traits"], ["Human", "Ranger"]);
  assert("the pick writes no button flags (they follow the classes)", "fields.pickSecondClassBtn.hidden" in values, false);
  setting = "yes";
  assert("with a second class: trash, not +", ctx.getDualClassFieldValues(pc([cleric, ranger], {}, { fields: { secondClassBox: { hidden: false } } })), {
    "fields.pickSecondClassBtn.hidden": true,
    "fields.clearSecondClassBtn.hidden": false,
  });
  assert("already right: no write", ctx.getDualClassFieldValues(pc([cleric, ranger], {}, { fields: { secondClassBox: { hidden: false }, pickSecondClassBtn: { hidden: true }, clearSecondClassBtn: { hidden: false } } })), {});
  assert("back to one class: + again", ctx.getDualClassFieldValues(pc([cleric], {}, { fields: { secondClassBox: { hidden: false }, pickSecondClassBtn: { hidden: true }, clearSecondClassBtn: { hidden: false } } })), {
    "fields.pickSecondClassBtn.hidden": false,
    "fields.clearSecondClassBtn.hidden": true,
  });
  assert("no first class: nothing", ctx.getSecondClassValues(pc([]), ranger), null);
  assert("the larger number of additional skills", ctx.getSecondClassExtraSkills(cleric, ranger), 2);
  assert("no extra when the first has more", ctx.getSecondClassExtraSkills(ranger, cleric), 0);

  const slot = { data: { type: "slot" } };
  const chosen = { name: "A Feat", data: { featSlotType: "class" } };
  const cleared = ctx.getClearSecondClassValues(pc([cleric, ranger], { feats: [slot, chosen] }));
  assert("clearing keeps the first", cleared["data.classes"].map((c) => c.name), ["Cleric"]);
  assert("and chosen feats, dropping empty slots", cleared["data.feats"], [chosen]);
  assert("the class-given ranks reset, to be rebuilt", [cleared["data.fortitude"], cleared["data.reflex"], cleared["data.will"], cleared["data.perception"], cleared["data.defenses"], cleared["data.attackProficiencies"]], ["0", "0", "0", "0", {}, {}]);
  assert("class DC and spellcasting ranks reset too", [cleared["data.classDCProficiency"], cleared["data.spellcasting"]], [0, 0]);

  const replaced = ctx.getClassesWithFirst(pc(), { name: "Bard", data: {} });
  assert("dropping a first class keeps the second", replaced.map((c) => c.name), ["Bard", "Ranger"]);
  assert("with one class it just replaces", ctx.getClassesWithFirst(pc([cleric]), { name: "Bard", data: {} }).map((c) => c.name), ["Bard"]);

  const left = { ...ranger, data: { ...ranger.data, classSlot: "second" } };
  assert("deleting the first takes the second too", ctx.getDeleteFirstClassValues(pc([left]))["data.classes"], []);
  assert("a single class: nothing extra", ctx.getDeleteFirstClassValues(pc([])), {});
}

section("the second line's name");
{
  assert("typing puts the class's name back", ctx.getSecondClassNameValues(pc(), "Druid"), { "data.secondClassName": "Ranger" });
  assert("the class's name: no write", ctx.getSecondClassNameValues(pc(), "Ranger"), null);
  assert("no second class: empty", ctx.getSecondClassNameValues(pc([cleric]), "x"), { "data.secondClassName": "" });
}

section("the second line's class link");
{
  assert("its list shows the second class", ctx.getSecondClassFilters(pc()), [{ field: "classSlot", operator: "equals", value: "second" }]);
  const cleared = [];
  const saved = ctx.clearSecondClass;
  ctx.clearSecondClass = (record) => cleared.push(record._id);
  ctx.onSecondClassListChange(pc([cleric], { secondClassName: "Ranger" }));
  assert("deleting it there clears the same way", cleared, ["char-1"]);
  ctx.onSecondClassListChange(pc([cleric, ranger], { secondClassName: "Ranger" }));
  ctx.onSecondClassListChange(pc([cleric], { secondClassName: "" }));
  assert("anything else changes nothing", cleared, ["char-1"]);
  ctx.clearSecondClass = saved;
}

section("a second class's choice stays on it");
{
  const option = { _id: "opt-aberrant", name: "Aberrant", data: { value: [{ _id: "f-aberrant", name: "Bloodline: Aberrant", recordType: "features", data: { level: 1, type: "classfeature" } }] } };
  const choice = { _id: "ch1", name: "Bloodline", data: { options: [option], choices: [] } };
  const bloodline = { _id: "f-bl", name: "Bloodline", recordType: "features", data: { level: 1, choices: [choice] } };
  const sorcerer = { name: "Sorcerer", data: { hp: 6, features: [bloodline], classSlot: "second" } };
  const fighter = { name: "Fighter", data: { hp: 10, features: [{ _id: "f-rs", name: "Reactive Strike", data: { level: 1 } }], classSlot: "first" } };
  const record = pc([fighter, sorcerer]);
  let written = null;
  const saved = { showPrompt: ctx.api.showPrompt, setValues: ctx.api.setValues };
  ctx.api.showPrompt = (title, description, placeholder, options, query, callback) => callback(["opt-aberrant"]);
  ctx.api.setValues = (values) => {
    written = values;
  };
  ctx.promptForChoices(record, [{ feature: bloodline, group: { name: "Class", dataPath: "data.classes.1.data.features" }, choiceObj: choice }], 0);
  Object.assign(ctx.api, saved);
  const names = (path) => (written?.[path] || []).map((f) => f.name);
  assert("the granted feature goes on the second class", names("data.classes.1.data.features").includes("Bloodline: Aberrant"), true);
  assert("and not on the first", "data.classes.0.data.features" in (written || {}), false);
}

process.exitCode = summary() > 0 ? 1 : 0;
