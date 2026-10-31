// Tests for character growth (character-growth.js): the skill and language
// from an Intelligence increase, Multilingual's languages, and retraining.
// Run: node tests/test-character-growth.js   (or via tests/run-all.js)

const fs = require("fs");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let calls = [];
let prompts = [];
let notifications = [];
// Each prompt answers with the next queued answer (a list of option values,
// or a feat), or skips when none is queued
let answers = [];
const reset = (queued = []) => {
  calls = [];
  prompts = [];
  notifications = [];
  answers = queued;
  state.messages = [];
};
ctx.api.showNotification = (text) => notifications.push(text);
ctx.api.showPrompt = (title, text, placeholder, options, query, callback) => {
  prompts.push({ title, text, options, query });
  const answer = answers.shift();
  callback(answer === undefined ? [] : answer);
};
ctx.api.setValuesOnRecord = (record, values, cb) => {
  calls.push(["set", record?._id, values]);
  const updated = { ...record, data: { ...record.data } };
  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith("data.") && !key.slice(5).includes(".")) updated.data[key.slice(5)] = value;
  });
  if (cb) cb(updated);
};
ctx.api.getValueOnRecord = (record, path) => path.split(".").reduce((value, key) => value?.[key], record);
ctx.onAddEditFeature = () => calls.push(["recalculate"]);
// The fresh read returns the record the test passes, by id
let stored = {};
ctx.api.getRecord = (type, id, cb) => cb(stored[id]);

const character = (data = {}, { id = "pc", name = "Ezren" } = {}) => ({
  _id: id,
  recordId: id,
  recordType: "characters",
  name,
  fields: {},
  data: { level: 5, feats: [], bonusFeats: [], classes: [], ancestries: [], languagesList: [], ...data },
});
const languages = (...names) => names.map((name) => ({ _id: name, name, identified: true, data: {} }));
const feat = (name, data = {}) => ({ _id: name, name, data: { type: "general", traits: [], prerequisites: "", ...data } });

section("Languages");
{
  const ezren = character({ languagesList: languages("Common", "Elven") });
  assert("known languages", ctx.getKnownLanguages(ezren), ["Common", "Elven"]);
  const options = ctx.getNewLanguageOptions(ezren).map((option) => option.value);
  assert("new ones: common languages not known", [options.includes("Draconic"), options.includes("Elven"), options.includes("Common")], [true, false, false]);
  const values = ctx.getAddLanguagesValues(ezren, ["Draconic", "Elven (Common)"]);
  assert("added at the end, known ones skipped", values["data.languagesList"].map((language) => language.name), ["Common", "Elven", "Draconic"]);
  assert("nothing new: no write", ctx.getAddLanguagesValues(ezren, ["Elven"]), null);
}

section("Intelligence increase (Q20)");
{
  const before = character({ freeBoostsLevel5: ["str", "dex", "con", "wis"] });
  const after = character({ freeBoostsLevel5: ["str", "dex", "con", "int"] });
  assert("a boost to Intelligence: +1", ctx.getIntModGain(before, after), 1);
  assert("no Intelligence boost: 0", ctx.getIntModGain(before, before), 0);
  // At +4 or more a boost is partial: one alone doesn't raise the modifier
  const high = { freeBoosts: ["int", "dex", "con", "wis"], ancestryBoost1: "int", backgroundBoost1: "int", keyAbility: "int" };
  const partial = character({ ...high, freeBoostsLevel5: ["str", "dex", "con", "int"] });
  assert("a partial boost: no gain", ctx.getIntModGain(character(high), partial), 0);

  reset([["arcana"], ["Draconic"]]);
  let done = false;
  ctx.promptIntIncreaseGains(before, after, () => (done = true));
  assert("asks for a skill, then a language", prompts.map((prompt) => prompt.title), ["Intelligence Increase: Skill", "Intelligence Increase: Language"]);
  assert("... trains the skill", calls[0], ["set", "pc", { "data.arcana": "1" }]);
  assert("... adds the language", calls[1][2]["data.languagesList"].map((language) => language.name), ["Draconic"]);
  assert("... then the level up goes on", done, true);

  reset();
  done = false;
  ctx.promptIntIncreaseGains(before, before, () => (done = true));
  assert("no gain: no prompts", [prompts.length, done], [0, true]);

  reset([[], []]);
  done = false;
  ctx.promptIntIncreaseGains(before, after, () => (done = true));
  assert("both skipped: nothing written, the level up goes on", [calls, done], [[], true]);
}

section("Multilingual");
{
  assert("two languages", ctx.getMultilingualCount(character({ society: "1" })), 2);
  assert("master in Society: three", ctx.getMultilingualCount(character({ society: "3" })), 3);
  assert("legendary: four", ctx.getMultilingualCount(character({ society: "4" })), 4);

  reset([["Draconic", "Dwarven"]]);
  let done = false;
  ctx.promptFeatLanguages(character({ society: "1" }), feat("Multilingual"), () => (done = true));
  assert("taking it: asks for its languages", [prompts[0]?.title, done], ["Multilingual", true]);
  assert("... adds them", calls[0][2]["data.languagesList"].map((language) => language.name), ["Draconic", "Dwarven"]);

  reset();
  done = false;
  ctx.promptFeatLanguages(character(), feat("Toughness"), () => (done = true));
  assert("another feat: nothing", [prompts.length, done], [0, true]);
}

section("Retraining a feat (Q29)");
{
  const oldFeat = feat("Dragon Disciple Dedication", { traits: ["Archetype", "Dedication"], level: 2, featSlotType: "class", slotOrder: 1 });
  const followUp = feat("Scales of the Dragon", { prerequisites: "Dragon Disciple Dedication", traits: ["Archetype"] });
  const sorcerer = character({ feats: [oldFeat, followUp] });
  const notes = ctx.getRetrainFeatNotes(sorcerer, oldFeat);
  assert("feats that list it as a prerequisite", notes[0], "Scales of the Dragon lists Dragon Disciple Dedication as a prerequisite.");
  assert("... and the dedication rule", notes[1], "A dedication feat can't be retrained while you have other feats from its archetype.");
  assert("a lineage feat: a note", ctx.getRetrainFeatNotes(character(), feat("Draconic Sycophant", { traits: ["Lineage"] })), ["Lineage feats can't be retrained into or out of."]);
  assert("... into one too", ctx.getRetrainFeatNotes(character(), feat("Toughness"), feat("Draconic Sycophant", { traits: ["Lineage"] })), ["Lineage feats can't be retrained into or out of."]);
  assert("nothing to check: no notes", ctx.getRetrainFeatNotes(character(), feat("Toughness")), []);
  assert("Multilingual: its languages stay, a note", ctx.getRetrainFeatNotes(character(), feat("Multilingual")), ["Remove the languages Multilingual gave from the Languages list."]);
  assert("the card", ctx.getRetrainCard("Ezren", "A into B", ["Note."]), "**Ezren retrains:** A into B (1 week of downtime).\n[gm]Note.[/gm]");

  const newFeat = feat("Fleet", { level: 1 });
  const toughness = feat("Toughness", { level: 3, featSlotType: "general", slotOrder: 2 });
  const ezren = character({ feats: [toughness] });
  reset([newFeat]);
  ctx.retrainFeatAt(ezren, "data.feats.0");
  assert("the slot's query", prompts[0].title, "Retrain Toughness");
  assert("one write: the new feat in the old one's slot", calls[0], ["set", "pc", { "data.feats.0": ctx.buildFilledFeatSlot(toughness, newFeat) }]);
  assert("... keeping the slot's level", calls[0][2]["data.feats.0"].data.level, 3);
  assert("... then the recalculation", calls[1], ["recalculate"]);
  assertIncludes("... and the card", state.messages[0], "**Ezren retrains:** Toughness into Fleet (1 week of downtime).");

  let queried = null;
  const query = ctx.getFeatSlotQuery;
  ctx.getFeatSlotQuery = (record, type, level) => (queried = [type, level]);
  reset();
  ctx.retrainFeatAt(character({ feats: [feat("Assurance", { type: "skill", level: 1 })] }), "data.feats.0");
  assert("no slot type: the feat's own type", queried, ["skill", 1]);
  ctx.getFeatSlotQuery = query;

  reset([toughness]);
  ctx.retrainFeatAt(ezren, "data.feats.0");
  assert("the same feat: nothing", calls, []);
  reset();
  ctx.retrainFeatAt(character({ feats: [{ name: "General Feat Slot", data: { type: "slot" } }] }), "data.feats.0");
  assert("an empty slot: nothing", prompts.length, 0);
}

section("Retraining a skill increase (Q29)");
{
  const ezren = character({ level: 5, arcana: "2", society: "1", stealth: "0", nature: "1" });
  const lower = ctx.getRetrainSkillLowerOptions(ezren).map((option) => option.label);
  assert("trained or better can go down", [lower.includes("Arcana: Expert to Trained"), lower.some((label) => label.startsWith("Stealth"))], [true, false]);
  assert("lower one, raise another", ctx.getRetrainSkillValues(ezren, "arcana", "stealth"), { "data.arcana": "1", "data.stealth": "1" });
  assert("not past the level's cap (expert at 5th)", ctx.getRetrainSkillValues(ezren, "society", "arcana"), null);
  assert("the same skill: nothing", ctx.getRetrainSkillValues(ezren, "arcana", "arcana"), null);
  assert("an untrained skill can't go down", ctx.getRetrainSkillValues(ezren, "stealth", "arcana"), null);

  const scholar = character({ level: 5, arcana: "2", society: "1", feats: [feat("Multilingual", { prerequisites: "trained in Society" })] });
  // The sheet's record can be stale: the prompts use the fresh read
  stored = { pc: scholar };
  reset([["society"], ["arcana"]]);
  ctx.retrainSkillIncrease(character({ level: 5 }));
  assert("asks for the skill to lower, then the one to raise", prompts.map((prompt) => prompt.text.slice(0, 22)), ["Choose the skill that ", "Choose the skill that "]);
  assert("... the raise list leaves out the lowered skill", prompts[1].options.some((option) => option.value === "society"), false);
  reset([["society"], ["nature"]]);
  ctx.retrainSkillIncrease(scholar);
  assert("one write, then the recalculation", calls, [["set", "pc", { "data.society": "0", "data.nature": "1" }], ["recalculate"]]);
  assertIncludes("... the card", state.messages[0], "**Ezren retrains:** Society to Untrained, Nature to Trained (1 week of downtime).");
  assertIncludes("... with the GM note", state.messages[0], "[gm]Multilingual lists Society as a prerequisite.[/gm]");

  stored = { pc: character() };
  reset();
  ctx.retrainSkillIncrease(character());
  assert("no trained skills: a notice", notifications, ["No trained skills to retrain."]);
}

section("Sheet hooks");
{
  const main = fs.readFileSync(`${__dirname}/../characters-main.html`, "utf8");
  const skills = fs.readFileSync(`${__dirname}/../characters-skills.html`, "utf8");
  const feats = fs.readFileSync(`${__dirname}/../feats-list.html`, "utf8");
  assert("the boost steps check Intelligence", (main.match(/promptIntIncreaseGains\(latestRecord/g) || []).length, 2);
  assertIncludes("the level up's feat step: Multilingual", main, "promptFeatLanguages(updated || latestRecord, feat, next)");
  assert("Retrain a Skill Increase: on the Skills tab, not the header", [skills.includes('onclick="retrainSkillIncrease(record)"'), main.includes("retrainSkillIncrease")], [true, false]);
  // In a box hidden when locked (Sean's Downtime section)
  const beforeRetrain = skills.slice(0, skills.indexOf('label="Retrain a Skill Increase"'));
  assertIncludes("... hidden when locked", beforeRetrain.slice(beforeRetrain.lastIndexOf("<box")), 'hideonlocked="true"');
  assertIncludes("a feat placed in a slot: Multilingual", feats, "promptFeatLanguages(updatedRecord2 || updatedRecord, feat)");
  assertIncludes("the feat row's Retrain button", feats, 'onclick="retrainFeat()"');
}

process.exitCode = summary() > 0 ? 1 : 0;
