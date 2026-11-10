// Tests for gear rules (item-gear.js): broken items and Repair, talismans
// and spellhearts affixed to gear, and runes (the property rune limit,
// etching a rune item, transferring a rune).
// Run: node tests/test-item-gear.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let notifications = [];
let prompts = [];
let answers = [];
let sets = [];
let records = {};
let rolls = [];
let recalcs = 0;
const reset = (queued = []) => {
  notifications = [];
  prompts = [];
  answers = queued;
  sets = [];
  rolls = [];
  recalcs = 0;
  state.messages = [];
};
ctx.api.showNotification = (text, color, title) => notifications.push({ text, title });
ctx.api.showPrompt = (title, text, placeholder, options, query, callback) => {
  prompts.push({ title, text, options });
  const answer = answers.shift();
  callback(answer === undefined ? [] : answer);
};
ctx.api.setValues = (values, cb) => {
  sets.push(values);
  if (cb) cb();
};
ctx.api.setValuesOnRecord = (record, values, cb) => {
  sets.push(values);
  if (cb) cb(record);
};
ctx.api.getRecord = (type, id, cb) => cb(records[id]);
ctx.rollSkill = (...args) => rolls.push(args);
ctx.onAddEditFeature = () => {
  recalcs += 1;
};
ctx.api.getToken = () => ({ _id: "pc-token", data: {} });

const character = (inventory = [], data = {}) => ({
  _id: "pc",
  recordType: "characters",
  name: "Valeros",
  effects: [],
  effectIds: [],
  fields: {},
  data: {
    level: 5,
    str: 2,
    dex: 3,
    crafting: "2",
    ancestries: [{ name: "Human", data: { speed: "25 feet", hp: 8 } }],
    classes: [{ name: "Fighter", data: { hp: 10, features: [] } }],
    feats: [],
    bonusFeats: [],
    inventory,
    ...data,
  },
});
const armor = (name, data = {}) => ({
  _id: `armor-${name}`,
  name,
  recordType: "items",
  fields: {},
  data: { type: "armor", carried: "equipped", invested: "true", itemCategory: "Medium", acBonus: 4, traits: [], runes: { potency: 1, resilient: 1, property: [] }, ...data },
});
const weapon = (name, data = {}) => ({
  _id: `weapon-${name}`,
  name,
  recordType: "items",
  fields: {},
  data: { type: "weapon", carried: "equipped", itemCategory: "martial", group: "sword", traits: [], range: 0, runes: { potency: 1, striking: "", property: [] }, ...data },
});
const gear = (name, data = {}) => ({ _id: name, name, recordType: "items", fields: {}, data: { type: "equipment", count: 1, ...data } });
const lookup = (record, types, field = "all") => ctx.getEffectsAndModifiersForToken(record, types, field);
const names = (mods) => mods.filter((mod) => mod.active).map((mod) => mod.name);

section("Broken items");
{
  assert("threshold: half the max", ctx.getItemBrokenThreshold(armor("Hide", { hp: { value: 20, max: 36 } })), 18);
  assert("at the threshold: broken", ctx.isItemBroken(armor("Hide", { hp: { value: 18, max: 36 } })), true);
  assert("above it: not", ctx.isItemBroken(armor("Hide", { hp: { value: 19, max: 36 } })), false);
  assert("no HP filled in: never", ctx.isItemBroken(armor("Hide")), false);
  assert("0 HP: destroyed", ctx.isItemDestroyed(armor("Hide", { hp: { value: 0, max: 36 } })), true);

  const broken = (category, traits = []) => armor("Plate", { itemCategory: category, traits, hp: { value: 2, max: 36 } });
  assert("light: -1", ctx.getBrokenArmorPenalty(broken("Light")), 1);
  assert("medium: -2", ctx.getBrokenArmorPenalty(broken("Medium")), 2);
  assert("heavy: -3", ctx.getBrokenArmorPenalty(broken("Heavy")), 3);
  assert("laminar heavy: -2", ctx.getBrokenArmorPenalty(broken("Heavy", ["Laminar"])), 2);
  assert("laminar light: none", ctx.getBrokenArmorPenalty(broken("Light", ["Laminar"])), 0);

  const pc = character([broken("Heavy")]);
  const ac = lookup(pc, ["armorClassPenalty"]).filter((mod) => mod.active);
  assert("the AC penalty is a status penalty", ac.map((mod) => [mod.name, mod.type, mod.value]), [["Broken Armor (Plate)", "status", -3]]);
  assert("the armor's item bonus to AC stays", ctx.getACForArmor(pc.data.inventory[0], pc), 5);
  assert("its resilient rune doesn't", names(lookup(pc, ["saveBonus"])).filter((name) => /Resilient/.test(name)), []);
  assert("unbroken, the resilient rune works", names(lookup(character([armor("Plate")]), ["saveBonus"])).filter((name) => /Resilient/.test(name)), ["Armor Resilient Rune"]);

  const cloak = gear("Cloak of Elvenkind", {
    carried: "equipped",
    hp: { value: 1, max: 10 },
    modifiers: [{ data: { type: "skillBonus", modifierType: "item", value: 1, valueType: "number", field: "stealth" } }],
  });
  assert("a broken item's modifiers don't apply", names(lookup(character([cloak]), ["skillBonus"], "stealth")), []);
  assert(
    "repaired, they do",
    names(lookup(character([{ ...cloak, data: { ...cloak.data, hp: { value: 6, max: 10 } } }]), ["skillBonus"], "stealth")),
    ["Cloak of Elvenkind"],
  );
  const cursed = gear("Cursed Cloak", {
    carried: "equipped",
    hp: { value: 1, max: 10 },
    modifiers: [
      { data: { type: "skillBonus", modifierType: "item", value: 1, valueType: "number", field: "stealth" } },
      { data: { type: "skillPenalty", modifierType: "status", value: 2, valueType: "number", field: "stealth" } },
    ],
  });
  assert("a broken item still imposes its penalties", names(lookup(character([cursed]), ["skillBonus", "skillPenalty"], "stealth")), ["Cursed Cloak"]);
  assert(
    "... only the penalty",
    lookup(character([cursed]), ["skillBonus", "skillPenalty"], "stealth").filter((mod) => mod.active).map((mod) => mod.value),
    [-2],
  );
  assert("a negative number counts as a penalty", ctx.isPenaltyModifier({ data: { type: "skillBonus", value: -1, valueType: "number" } }), true);
  assert("ignoreRangePenalty isn't one", ctx.isPenaltyModifier({ data: { type: "ignoreRangePenalty", value: "", valueType: "string" } }), false);
  const flaming = weapon("Longsword", { runes: { potency: 1, property: ["flaming"] }, hp: { value: 2, max: 20 } });
  assert("nor its property runes", ctx.getFeaturesFromRunes(ctx.getUnbrokenItems([flaming])).length, 0);
  assert("a broken weapon can't Strike", ctx.getBrokenStrikeWarning(flaming), "Longsword is broken: it can't be used to Strike.");
  assert("an unbroken one can", ctx.getBrokenStrikeWarning(weapon("Longsword")), "");
}

section("Repair");
{
  assert("the Repair button: an inventory item with HP", ctx.isRepairButtonHidden(armor("Hide", { hp: { value: 1, max: 36 } }), "data.inventory.0"), false);
  assert("... hidden with no HP", ctx.isRepairButtonHidden(armor("Hide"), "data.inventory.0"), true);
  assert("... and outside an inventory", ctx.isRepairButtonHidden(armor("Hide", { hp: { value: 1, max: 36 } }), ""), true);
  assert("success, trained: 10", ctx.getRepairHp(1, 1), 10);
  assert("success, master: 20", ctx.getRepairHp(3, 1), 20);
  assert("critical success, expert: 30", ctx.getRepairHp(2, 2), 30);
  assert("critical success, legendary: 50", ctx.getRepairHp(4, 2), 50);
  assert("failure: nothing", ctx.getRepairHp(2, 0), 0);
  assertIncludes("no HP filled in", ctx.getRepairProblem(armor("Hide")), "no Hit Points");
  assertIncludes("destroyed", ctx.getRepairProblem(armor("Hide", { hp: { value: 0, max: 36 } })), "can't be Repaired");
  assertIncludes("full HP", ctx.getRepairProblem(armor("Hide", { hp: { value: 36, max: 36 } })), "full Hit Points");

  const hide = armor("Hide", { level: 1, hp: { value: 10, max: 36 }, hardness: 4 });
  const pc = character([hide]);
  records.pc = pc;
  reset();
  ctx.api.getValue = () => hide;
  ctx.repairInventoryItem(pc, "data.inventory.0");
  assert("rolls Crafting against the item's Craft DC", [rolls[0]?.[1], rolls[0]?.[2]], ["crafting", 15]);
  assert("with the repair on the roll", rolls[0]?.[10]?.repair, { recordId: "pc", recordType: "characters", itemId: "armor-Hide", itemName: "Hide", rank: 2 });
  reset();
  ctx.repairInventoryItem(pc, "");
  assert("not in an inventory: a notice", [rolls.length, notifications.length], [0, 1]);

  const repair = { recordId: "pc", recordType: "characters", itemId: "armor-Hide", itemName: "Hide", rank: 2 };
  assertIncludes("success: the HP button", ctx.getRepairLines(repair, 1).join("\n"), 'restoreItemHp("characters", "pc", "armor-Hide", 15)');
  assertIncludes("critical failure: the damage button", ctx.getRepairLines(repair, -1).join("\n"), "damageRepairedItem(");
  assertIncludes("failure", ctx.getRepairLines(repair, 0).join("\n"), "isn't repaired");

  reset();
  ctx.restoreItemHp("characters", "pc", "armor-Hide", 30);
  assert("restored, up to the max", sets, [{ "data.inventory.0.data.hp.value": 36 }]);
  assert("then the sheet recalculates", recalcs, 1);
  assertIncludes("and says so", state.messages[0], "now 36/36 HP");

  reset();
  ctx.api.rollInstant = () => ({ total: 9 });
  ctx.damageRepairedItem("characters", "pc", "armor-Hide");
  assert("2d6 less Hardness", sets, [{ "data.inventory.0.data.hp.value": 5 }]);
  assertIncludes("broken now", state.messages[0], "now 5/36 HP, broken");
}

section("Talismans and spellhearts");
{
  const fang = gear("Wolf Fang", { type: "consumable", traits: ["Consumable", "Magical", "Talisman"], usage: "affixed-to-armor" });
  const plate = gear("Ablative Armor Plating", { usage: "affixed-to-armor-or-travelers-clothing" });
  assert("talismans are affixed", [ctx.isTalismanLike(fang), ctx.isAffixableItem(fang)], [true, true]);
  assert("so is ablative plating, but it isn't a talisman", [ctx.isTalismanLike(plate), ctx.isAffixableItem(plate)], [false, true]);
  assert("hosts by usage", [ctx.getAffixHostTypes("affixed-to-armor"), ctx.getAffixHostTypes("affixed-to-a-shield"), ctx.getAffixHostTypes("affixed-to-armor-or-a-weapon")], [["armor"], ["shield"], ["armor", "weapon"]]);

  const breastplate = armor("Breastplate");
  const sword = weapon("Longsword");
  const pc = character([breastplate, sword, fang]);
  assert("armor only", ctx.getAffixHosts(pc, fang).map((item) => item.name), ["Breastplate"]);

  assert(
    "affixing: the talisman, and the host's line",
    ctx.getAffixValues(pc, fang, "armor-Breastplate"),
    {
      "data.inventory.2.data.affixedTo": "armor-Breastplate",
      "data.inventory.0.data.affixedLabel": "Wolf Fang",
      "data.inventory.0.fields.affixedBox.hidden": false,
    },
  );
  const affixed = { ...fang, data: { ...fang.data, affixedTo: "armor-Breastplate" } };
  const shown = { ...breastplate, data: { ...breastplate.data, affixedLabel: "Wolf Fang" }, fields: { affixedBox: { hidden: false } } };
  assert(
    "removing it",
    ctx.getAffixValues(character([shown, sword, affixed]), affixed, null),
    {
      "data.inventory.2.data.affixedTo": null,
      "data.inventory.0.data.affixedLabel": "",
      "data.inventory.0.fields.affixedBox.hidden": true,
    },
  );

  const charm = gear("Amnemonic Charm", { type: "consumable", traits: ["Talisman"], usage: "affixed-to-armor", affixedTo: "armor-Breastplate" });
  assertIncludes("a second one deactivates both", ctx.getAffixWarning(character([shown, affixed, charm]), fang, "armor-Breastplate"), "deactivates them all");
  assert("ablative plating doesn't count", ctx.getAffixWarning(character([shown, affixed]), plate, "armor-Breastplate"), "");
  assertIncludes("use: not affixed", ctx.getAffixedUseWarning(pc, fang), "isn't affixed");
  assert("use: affixed alone", ctx.getAffixedUseWarning(character([shown, affixed]), affixed), "");
  assertIncludes("use: with another", ctx.getAffixedUseWarning(character([shown, affixed, charm]), affixed), "deactivates them all");
  assert(
    "used, the rest of the stack isn't affixed",
    ctx.getUsedTalismanValues(character([shown, sword, affixed]), affixed, "data.inventory.2"),
    {
      "data.inventory.2.data.affixedTo": null,
      "data.inventory.0.data.affixedLabel": "",
      "data.inventory.0.fields.affixedBox.hidden": true,
    },
  );

  // The Affix button picks a host, then writes once
  reset([["armor-Breastplate"]]);
  ctx.api.getValue = () => fang;
  ctx.promptAffixItem(pc, "data.inventory.2");
  assert("the prompt lists the hosts", prompts[0]?.options.map((option) => option.label), ["Breastplate"]);
  assert("one write", sets.length, 1);
  assertIncludes("a card", state.messages[0], "affixes Wolf Fang to Breastplate");

  const sigil = gear("Beastmaster's Sigil", {
    traits: ["Magical", "Spellheart"],
    usage: "affixed-to-armor-or-a-weapon",
    modifiers: [{ data: { type: "skillBonus", modifierType: "item", value: 1, valueType: "number", field: "nature" } }],
  });
  const onArmor = { ...sigil, data: { ...sigil.data, affixedTo: "armor-Breastplate" } };
  const nature = (inventory) => names(lookup(character(inventory), ["skillBonus"], "nature"));
  assert("a spellheart works affixed to worn armor", nature([breastplate, onArmor]), ["Beastmaster's Sigil"]);
  assert("not unaffixed", nature([breastplate, sigil]), []);
  assert("not on armor that isn't worn", nature([{ ...breastplate, data: { ...breastplate.data, carried: "carried" } }, onArmor]), []);
  assert("not with a talisman beside it", nature([breastplate, onArmor, charm]), []);
}

section("Runes: the property rune limit");
{
  const plus1 = weapon("Longsword", { runes: { potency: 1, property: ["flaming", "frost"] } });
  assert("a +1 weapon uses one", ctx.getActivePropertyRunes(null, plus1), ["flaming"]);
  assert("the other is dormant", ctx.getDormantPropertyRunes(null, plus1), ["frost"]);
  assert("only the active one's modifiers", ctx.getFeaturesFromRunes([plus1]).map((feature) => feature.name).filter((name) => /Frost/.test(name)), []);
  assertIncludes("the notice", ctx.getDormantRuneWarning(null, plus1), "can use 1 property rune (its potency value), so Frost is dormant");
  assert("no potency: none work", ctx.getActivePropertyRunes(null, weapon("Club", { runes: { potency: "", property: ["flaming"] } })), []);
  const handwraps = gear("Handwraps of Mighty Blows", { handwraps: true, runes: { potency: 1, striking: "", property: { 0: "" } } });
  assert("runes kept as an object, with an empty one: none", ctx.getActivePropertyRunes(null, handwraps), []);
  assert("... and no features", ctx.getFeaturesFromRunes([handwraps]), []);
  assert("room for them all: no notice", ctx.getDormantRuneWarning(null, weapon("Longsword", { runes: { potency: "2", property: ["flaming", "frost"] } })), "");
}

section("Runes: etching");
{
  const rune = (name, usage) => gear(name, { usage });
  assert("weapon potency", ctx.parseRuneItem(rune("Weapon Potency (+2)", "etched-onto-a-weapon")), { kind: "potency", target: "weapon", value: 2, name: "Weapon Potency (+2)" });
  assert("armor potency", ctx.parseRuneItem(rune("Armor Potency (+1)", "etched-onto-armor")).target, "armor");
  assert("striking", ctx.parseRuneItem(rune("Striking", "etched-onto-a-weapon")).value, 1);
  assert("major striking", ctx.parseRuneItem(rune("Striking (Major)", "etched-onto-a-weapon")).value, 3);
  assert("greater resilient", ctx.parseRuneItem(rune("Resilient (Greater)", "etched-onto-armor")), { kind: "resilient", target: "armor", value: 2, name: "Resilient (Greater)" });
  assert("reinforcing", ctx.parseRuneItem(rune("Reinforcing Rune (Moderate)", "etched-onto-a-shield")).value, 3);
  assert("a property rune", ctx.parseRuneItem(rune("Flaming", "etched-onto-a-weapon")).value, "flaming");
  assert("a graded property rune", ctx.parseRuneItem(rune("Advancing (Greater)", "etched-onto-heavy-armor")).value, "greaterAdvancing");
  assert("an apostrophe", ctx.parseRuneItem(rune("Bolka's Blessing", "etched-onto-a-weapon")).value, "bolkasBlessing");
  assert("a hyphen", ctx.parseRuneItem(rune("Aim-Aiding", "etched-onto-armor")).value, "aimAiding");
  assert("energy-resistant asks for its energy", ctx.parseRuneItem(rune("Energy-Resistant (Greater)", "etched-onto-armor")).energy, true);
  assert("... greater fire", ctx.getEnergyResistantValue("Greater", "Fire"), "greaterFireResistant");
  assert("one the sheet doesn't have", ctx.parseRuneItem(rune("Forgefather's Seal", "etched-onto-armor")), null);
  assert("not a rune", ctx.parseRuneItem(gear("Rope", { usage: "held-in-one-hand" })), null);

  const heavy = armor("Full Plate", { itemCategory: "Heavy" });
  const light = armor("Leather", { itemCategory: "Light" });
  const bow = weapon("Longbow", { range: 100 });
  const sword = weapon("Longsword");
  const pc = character([heavy, light, bow, sword]);
  const hosts = (name, usage) => ctx.getEtchHosts(pc, rune(name, usage), ctx.parseRuneItem(rune(name, usage))).map((item) => item.name);
  assert("heavy armor only", hosts("Advancing", "etched-onto-heavy-armor"), ["Full Plate"]);
  assert("any armor", hosts("Aim-Aiding", "etched-onto-armor"), ["Full Plate", "Leather"]);
  assert("melee weapons only", hosts("Animated", "etched-onto-melee-weapon"), ["Longsword"]);
  assert("any weapon", hosts("Flaming", "etched-onto-a-weapon"), ["Longbow", "Longsword"]);

  const flaming = { ...rune("Flaming", "etched-onto-a-weapon"), _id: "rune-flaming" };
  const withRune = character([sword, flaming]);
  const etched = ctx.getEtchValues(withRune, flaming, ctx.parseRuneItem(flaming), "weapon-Longsword");
  assert("etched: the weapon's runes", etched.values["data.inventory"][0].data.runes.property, ["flaming"]);
  assert("the rune item is used", etched.values["data.inventory"].map((item) => item.name), ["Longsword"]);
  const stack = { ...flaming, data: { ...flaming.data, count: 2 } };
  assert("one of a stack", ctx.getEtchValues(character([sword, stack]), stack, ctx.parseRuneItem(stack), "weapon-Longsword").values["data.inventory"][1].data.count, 1);
  const already = weapon("Longsword", { runes: { potency: 1, property: ["flaming"] } });
  assertIncludes("already there", ctx.getEtchValues(character([already, flaming]), flaming, ctx.parseRuneItem(flaming), "weapon-Longsword").problem, "already has Flaming");
  const greater = rune("Striking (Greater)", "etched-onto-a-weapon");
  assert("striking upgraded", ctx.getEtchValues(character([sword, greater]), greater, ctx.parseRuneItem(greater), "weapon-Longsword").values["data.inventory"][0].data.runes.striking, "2");
  const lesser = rune("Striking", "etched-onto-a-weapon");
  const strong = weapon("Longsword", { runes: { potency: 1, striking: "2", property: [] } });
  assertIncludes("not downgraded", ctx.getEtchValues(character([strong, lesser]), lesser, ctx.parseRuneItem(lesser), "weapon-Longsword").problem, "equal or better");

  const shield = gear("Steel Shield", { type: "shield", hardness: 5, hp: { value: 20, max: 20 }, runes: {} });
  assert(
    "a reinforcing rune: Hardness and HP, capped",
    ctx.getReinforcingRuneData(shield, 1),
    { "runes.reinforcing": "1", hardness: 8, "hp.max": 64, "hp.value": 64, baseHardness: 5, baseHp: 20 },
  );
  const reinforced = { ...shield, data: { ...shield.data, hardness: 8, hp: { value: 50, max: 64 }, baseHardness: 5, baseHp: 20 } };
  assert(
    "removed: back to the shield's own",
    ctx.getReinforcingRuneData(reinforced, 0),
    { "runes.reinforcing": "", hardness: 5, "hp.max": 20, "hp.value": 6, baseHardness: null, baseHp: null },
  );

  reset([["weapon-Longsword"]]);
  ctx.api.getValue = () => flaming;
  ctx.promptEtchRune(withRune, "data.inventory.1");
  assert("the Etch button: one write", sets.length, 1);
  assertIncludes("a card", state.messages[0], "etches Flaming onto Longsword");
}

section("Runes: transferring");
{
  const sword = weapon("Longsword", { level: 4, runes: { potency: "1", striking: "1", property: ["greaterFlaming"] } });
  assert(
    "the runes on an item, by their items' names",
    ctx.getItemRunes(sword).map((rune) => rune.name),
    ["Weapon Potency (+1)", "Striking", "Flaming (Greater)"],
  );
  assert("energy-resistant's name", ctx.getRuneItemName("Greater Acid Resistant"), "Energy-Resistant (Greater)");

  const axe = weapon("Battle Axe");
  const plate = armor("Full Plate");
  const pc = character([sword, axe, plate], { gp: 100 });
  const flaming = ctx.getItemRunes(sword)[2];
  assert("to another weapon", ctx.getTransferTargets(pc, sword, flaming).map((item) => item.name), ["Battle Axe"]);

  const runeRecord = gear("Flaming (Greater)", { level: 15, price: { value: { gp: 6500 } } });
  const project = ctx.buildRuneTransferProject(pc, sword, axe, flaming, runeRecord);
  assert("the project's name", project.name, "Transfer Flaming (Greater) to Battle Axe");
  assert("the rune's level DC", project.data.dc, 34);
  assert("10% of its Price", project.data.totalCp, 65000);
  assert("1 day", project.data.setupLabel, "1 day");
  assert("finishing moves it", project.data.output, "runeTransfer");

  const values = ctx.getRuneTransferValues(pc, project.data.transfer);
  assert("off the sword", values["data.inventory"][0].data.runes.property, []);
  assert("onto the axe", values["data.inventory"][1].data.runes.property, ["greaterFlaming"]);
  const club = weapon("Club", { runes: { potency: "", striking: "", property: [] } });
  const withClub = character([sword, club]);
  const potency = ctx.getRuneTransferValues(withClub, { sourceId: sword._id, targetId: club._id, kind: "potency", target: "weapon", value: 1 });
  assert("a potency rune", [potency["data.inventory"][0].data.runes.potency, potency["data.inventory"][1].data.runes.potency], ["", "1"]);
  const strong = weapon("Greatsword", { runes: { potency: "1", striking: "2", property: [] } });
  assert(
    "never a downgrade: Striking onto Greater Striking moves nothing",
    ctx.getRuneTransferValues(character([sword, strong]), { sourceId: sword._id, targetId: strong._id, kind: "striking", target: "weapon", value: 1 }),
    {},
  );
  assert(
    "nor a rune it already has",
    ctx.getRuneTransferValues(character([sword, weapon("Rapier", { runes: { potency: "1", property: ["greaterFlaming"] } })]), { ...project.data.transfer, targetId: "weapon-Rapier" }),
    {},
  );

  // A melee weapon rune only to a melee weapon (GM Core pg. 225: anything
  // else is an automatic critical failure)
  const animatedSword = weapon("Shortsword", { runes: { potency: "1", property: ["animated"] } });
  const bow = weapon("Longbow", { range: 100 });
  const animated = ctx.getItemRunes(animatedSword)[1];
  const animatedRecord = gear("Animated", { usage: "etched-onto-melee-weapon", level: 13 });
  const melee = character([animatedSword, bow, axe]);
  assert("by the rune item's usage: melee only", ctx.getTransferTargets(melee, animatedSword, animated, animatedRecord).map((item) => item.name), ["Battle Axe"]);
  assert("without the rune item: any weapon", ctx.getTransferTargets(melee, animatedSword, animated).map((item) => item.name), ["Longbow", "Battle Axe"]);

  // The prompt gives Etch's notice instead of starting the project
  reset([["weapon-Longsword"], ["1"], ["weapon-Greatsword"]]);
  ctx.api.getRecordsByQuery = (type, query, cb) => cb([gear("Striking", { usage: "etched-onto-a-weapon", level: 4, price: { value: { gp: 65 } } })]);
  ctx.promptRuneTransfer(character([sword, strong], { gp: 100 }));
  assert("a downgrade: the notice, no project", [notifications.map((n) => n.text), sets.length], [["Greatsword already has an equal or better striking rune."], 0]);
  assert("an item gone: nothing", ctx.getRuneTransferValues(pc, { sourceId: "x", targetId: axe._id, kind: "potency", value: 1 }), {});

  const withProject = character([sword, axe], { craftingProjects: [project] });
  const completion = ctx.getCraftProjectCompletion(withProject, 0);
  assert("completing: the project goes", completion["data.craftingProjects"], []);
  assert("and the rune moves", completion["data.inventory"][1].data.runes.property, ["greaterFlaming"]);
}

process.exitCode = summary() > 0 ? 1 : 0;
