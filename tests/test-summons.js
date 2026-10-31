// Tests for summons and minions (summons.js).
// Run: node tests/test-summons.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

function runHook(file, data) {
  ctx.__state.messages.length = 0;
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
}

// The Player Core module's texts
const spell = (name, description) => ({ name, data: { traits: ["Common", "Concentrate", "Manipulate", "Summon"], description } });
const summonAnimal = spell("Summon Animal", "<p>You summon a creature that has the animal trait and whose level is –1 to fight for you.</p>");
const summonPlant = spell("Summon Plant or Fungus", "<p>You summon a creature that has the plant or fungus trait and whose level is -1 to fight for you.</p>");
const servitor = spell(
  "Summon Lesser Servitor",
  "<p>You summon a common celestial, fiend, or monitor of level –1. You can choose to instead summon a common animal of level –1 that hails from the Outer Sphere; you can choose for this animal to gain the celestial and holy traits, the fiend and unholy traits, or the monitor trait.</p>"
);
const phantasmal = spell("Phantasmal Minion", "<p>You summon a Phantasmal Minion . The minion is roughly the shape of a humanoid.</p>");

const token = (id, data = {}, extra = {}) => ({ _id: id, name: id, recordType: "npcs", recordId: `rec-${id}`, data, effects: [], effectIds: [], ...extra });

section("Summon spells");
{
  assert("the summon trait", [ctx.isSummonSpell(summonAnimal), ctx.isSummonSpell({ data: { traits: ["Fire"] } })], [true, false]);
  assert("level caps by rank", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rank) => ctx.getSummonLevelCap(rank)), [-1, 1, 2, 3, 5, 7, 9, 11, 13, 15]);
  assert("Summon Animal: the animal trait", ctx.getSummonFilter(summonAnimal), { traits: ["animal"], names: [] });
  assert("Summon Plant or Fungus: both", ctx.getSummonFilter(summonPlant).traits, ["plant", "fungus"]);
  assert("Lesser Servitor: celestial, fiend, monitor, or an animal", ctx.getSummonFilter(servitor).traits, ["celestial", "fiend", "monitor", "animal"]);
  assert("Phantasmal Minion: the creature it names", ctx.getSummonFilter(phantasmal), { traits: [], names: ["phantasmal minion"] });
  assert(
    "the query: level cap and trait",
    ctx.getSummonQuery({ traits: ["plant", "fungus"], names: [] }, 2),
    { "data.level": { $lte: 2 }, "data.traits": { $regex: "^(plant|fungus)$", $options: "i" } }
  );
  assert("the prompt's wording", [ctx.joinWithOr(["plant", "fungus"]), ctx.joinWithOr(["celestial", "fiend", "monitor"])], ["plant or fungus", "celestial, fiend, or monitor"]);
  assert("... or the name", ctx.getSummonQuery({ traits: [], names: ["phantasmal minion"] }, -1).name, { $regex: "^(phantasmal minion)$", $options: "i" });

  const creature = (id, name, level, traits = ["Common", "Animal"]) => ({ _id: id, name, data: { level, traits } });
  const options = ctx.getSummonOptions([
    creature("b", "Badger", 0),
    creature("c", "Compsognathus", -1),
    creature("b2", "Badger", 0),
    creature("w", "Wolf", 1, ["Uncommon", "Animal"]),
  ]);
  assert("the picker: one per creature, highest level first, rarity shown", options.map((o) => o.label), ["Wolf (level 1), uncommon", "Badger (level 0)", "Compsognathus (level -1)"]);
}

section("Pick Creature and Mark Summoned");
{
  const caster = token("caster", { initiative: 15 }, { recordType: "characters" });
  const button = ctx.getSummonButton({ name: "Ezren" }, caster, summonAnimal, 3);
  assert("the cast card's button", button.includes("Pick_Creature") && button.includes('"rank":3') && button.includes('"casterTokenId":"caster"'), true);
  assert("no token: the character's name", ctx.getSummonButton({ name: "Ezren" }, null, summonAnimal, 1).includes('"casterName":"Ezren"'), true);

  let query = null;
  let opened = null;
  const wolf = { _id: "wolf", name: "Wolf", data: { level: 1, traits: ["Common", "Animal"] } };
  ctx.api.getRecordsByQuery = (type, q, cb) => {
    query = q;
    cb([wolf]);
  };
  ctx.api.showPrompt = (title, text, placeholder, options, value, cb) => cb(options[0].value);
  ctx.api.openRecord = (record) => (opened = record);
  ctx.__state.messages.length = 0;
  ctx.showSummonPicker({ spellName: "Summon Animal", rank: 2, filter: { traits: ["animal"], names: [] }, casterTokenId: "caster", casterName: "Ezren" });
  assert("the picker asks for the rank's cap", query["data.level"], { $lte: 1 });
  assert("the pick opens to drag onto the map", opened?._id, "wolf");
  assert("... with a Mark Summoned button", ctx.__state.messages[0].includes("Mark_Summoned") && ctx.__state.messages[0].includes('"tokenId":"caster"'), true);

  const summoned = token("wolf-token");
  const writes = [];
  const effects = [];
  ctx.api.getSelectedOrDroppedToken = () => [summoned];
  ctx.api.getOtherTokens = () => [caster, summoned];
  ctx.api.getCombatTracker = (cb) => cb({ tokenIds: ["caster", "wolf-token"], initiative: 15 });
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push([id, values]);
  ctx.api.addEffect = (name, target, value, applier) => effects.push([name, target._id, applier]);
  ctx.__state.messages.length = 0;
  ctx.markSummoned({ tokenId: "caster", name: "Ezren", spellName: "Summon Animal" });
  assert("one write: linked to the caster, just below it", writes, [["wolf-token", { "data.summonedBy": { tokenId: "caster", name: "Ezren" }, "data.initiative": 14.99 }]]);
  assert("the Summoned effect, the caster as its applier", effects, [["Summoned", "wolf-token", { _id: "caster", name: "Ezren" }]]);
  assert("and a note", ctx.__state.messages[0].includes("acts just after Ezren"), true);
}

section("Minions in initiative");
{
  const pcToken = token("pc", { initiative: 18 }, { recordType: "characters", recordId: "pc-record" });
  const familiar = token("fam", { type: "familiar", master: JSON.stringify({ _id: "pc-record" }) });
  const companion = token("wolf", { companionMaster: { _id: "pc-record" } });
  const summon = token("sum", { summonedBy: { tokenId: "pc" } });
  const horse = token("horse");
  const mountedEffect = { _id: "mounted", name: "Mounted" };
  const rider = token("rider", { initiative: 12 }, { effects: [mountedEffect], effectIds: ["mounted"], effectValues: { mounted: [{ tokenId: "horse" }] } });
  const goblin = token("goblin", { initiative: 9 });
  const scene = [pcToken, familiar, companion, summon, horse, rider, goblin];
  const masterOf = (minion) => ctx.getMinionMaster(minion, scene)?._id || null;
  assert("masters: a familiar's, a companion's, a summon's, a mount's rider", [familiar, companion, summon, horse, goblin].map(masterOf), ["pc", "pc", "pc", "rider", null]);

  const all = scene.map((t) => t._id);
  assert("just below the master", ctx.getMinionInitiativeValue(familiar, scene, all), 17.99);
  assert("... its new roll, when it just rolled", ctx.getMinionInitiativeValue(familiar, scene, all, { pc: 21 }), 20.99);
  assert("a master not in the tracker: nothing", ctx.getMinionInitiativeValue(familiar, scene, ["fam"]), null);
  assert("a master without initiative yet: nothing", ctx.getMinionInitiativeValue(familiar, [{ ...pcToken, data: {} }, familiar], all), null);

  const writes = [];
  ctx.api.getOtherTokens = () => scene;
  ctx.api.getToken = () => null;
  ctx.api.getCombatTracker = (cb) => cb({ tokenIds: all });
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push([id, values["data.initiative"]]);
  runHook("onTokenAdd.js", { token: horse });
  assert("onTokenAdd: the mount goes just below its rider", writes, [["horse", 11.99]]);
  writes.length = 0;
  runHook("onTokenAdd.js", { token: goblin });
  assert("... a creature without a master is left alone", writes, []);

  writes.length = 0;
  ctx.placeMinionsOf({ pc: 22 });
  assert("the master rolls: its minions follow", writes.sort(), [["fam", 21.99], ["sum", 21.99], ["wolf", 21.99]]);

  writes.length = 0;
  ctx.api.getToken = () => pcToken;
  ctx.api.setValues = () => {};
  runHook("initiative.js", { roll: { total: 16, metadata: { initiativeSkill: "Perception", initiativeAdversary: false } } });
  assert("initiative.js: after a roll, the roller's minions follow", writes.map((w) => w[1]), [15.99, 15.99, 15.99]);
  writes.length = 0;
  runHook("initiative.js", { roll: { total: 10, metadata: { initiativeSkill: "Perception", group: ["rider", "goblin"], initiativeAdversaries: ["goblin"] } } });
  assert("... and after a group roll", writes.filter((w) => w[0] === "horse"), [["horse", 9.99]]);
}

process.exitCode = summary() > 0 ? 1 : 0;
