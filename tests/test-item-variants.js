// Tests for the small rules in item-variants.js and their hooks: shoddy items,
// dawnsilver as silver, apex items, cursed items, High-Quality armor, doubling
// rings, voluntary flaws, Simplified Ancestries and Skill Feats, and a
// rescaled troop's thresholds.

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const settings = {};
ctx.api.getSetting = (key) => settings[key];

const pc = (extra = {}) => ({
  _id: "c1",
  name: "Kyra",
  recordType: "characters",
  data: { level: 5, inventory: [], ...extra },
});

section("shoddy");
{
  const sword = { name: "Shoddy Longsword", data: { type: "weapon", traits: [] } };
  const plain = { name: "Longsword", data: { type: "weapon", traits: [] } };
  assert("by name", ctx.isShoddyItem(sword), true);
  assert("by trait", ctx.isShoddyItem({ name: "Club", data: { traits: ["Shoddy"] } }), true);
  assert("a normal item", ctx.isShoddyItem(plain), false);
  const mod = ctx.getShoddyModifier(sword);
  assert("-2 item penalty", [mod.name, mod.type, mod.value], ["Shoddy", "item", -2]);
  assert("none for a normal item", ctx.getShoddyModifier(plain), null);
  assert("armor check penalty 2 worse", ctx.getShoddyCheckPenalty({ name: "Shoddy Chain Mail", data: {} }, -2), 4);
  assert("normal armor unchanged", ctx.getShoddyCheckPenalty({ name: "Chain Mail", data: {} }, -2), 2);
  const armor = { name: "Shoddy Chain Mail", data: { type: "armor", acBonus: 4, traits: [] } };
  assert("shoddy armor's AC is 2 lower", ctx.getACForArmor(armor, pc()), 2);
}

section("precious materials");
{
  // GM Core pg. 253: silver only "for the purpose of damaging creatures with
  // weakness to silver"
  assert("not a silver material for predicates", ctx.getWeaponMaterials({ data: { material: { type: "dawnsilver" } } }), ["dawnsilver"]);
  assert("silver where weaknesses are matched", ctx.addSilverMaterial(["dawnsilver"]), ["dawnsilver", "silver"]);
  assert("so is legacy mithral", ctx.addSilverMaterial(["mithral"]).includes("silver"), true);
  assert("cold iron isn't", ctx.addSilverMaterial(["cold-iron"]), ["cold-iron"]);
  const target = (data) => ({ _id: "target", recordType: "npcs", name: "Target", record: { name: "Target" }, identified: true, effects: [], data: { curhp: 1000, hitpoints: 1000, ...data } });
  const hit = { types: [{ die: 6, value: 10, type: "slashing" }], dice: [{ type: 6, value: 10 }], total: 10, metadata: { traits: [], damageCategories: ["dawnsilver"], damageType: "slashing", damageSource: { type: "weapon", materials: ctx.getWeaponMaterials({ data: { material: { type: "dawnsilver" } } }) } } };
  const dealt = (creature) => {
    ctx.__state.lastSet = null;
    ctx.applyDamage(creature, hit, false, null, false);
    return 1000 - ((ctx.__state.lastSet || {})["data.curhp"] ?? 1000);
  };
  assert("a dawnsilver blade hits a silver weakness (10 -> 15)", dealt(target({ weaknesses: [{ data: { type: "silver", value: 5 } }] })), 15);
  assert("but not past physical 5 except silver (10 -> 5)", dealt(target({ resistances: [{ data: { type: "physical", value: 5, exceptions: ["silver"] } }] })), 5);
}

section("apex items");
{
  const belt = { name: "Belt of Giant Strength", data: { traits: ["Apex", "Invested"], invested: "true", description: "<p>When you invest the belt, you either increase your Strength modifier by 1 or increase it to +4, whichever would give you a higher value.</p>" } };
  assert("the attribute from its text", ctx.getApexItemAttribute(belt), "str");
  assert("or its own field", ctx.getApexItemAttribute({ data: { apexAttribute: "wis" } }), "wis");
  assert("invested: it counts", ctx.getApexItemAttributeForRecord(pc({ inventory: [belt] })), "str");
  assert("not invested: no", ctx.getApexItemAttributeForRecord(pc({ inventory: [{ ...belt, data: { ...belt.data, invested: "false" } }] })), "");
  const diadem = { name: "Diadem of Intellect", data: { traits: ["Apex"], invested: "true", description: "increase your Intelligence modifier by 1" } };
  assert("only one: the first", ctx.getApexItemAttributeForRecord(pc({ inventory: [belt, diadem] })), "str");
  const boosts = ctx.calculateAbilityBoosts(pc({ inventory: [belt], freeBoosts: ["str"] }));
  assert("+1 to +4: a +1 becomes +4", boosts.str.modifier, 4);
}

section("cursed items");
{
  assertIncludes("a GM-only line", ctx.getCursedUseText({ data: { traits: ["Cursed"] } }), "[gm]**Cursed item:**");
  assert("nothing otherwise", ctx.getCursedUseText({ data: { traits: [] } }), "");
}

section("High-Quality armor");
{
  const armor = { name: "High-Quality Chain Mail", data: { type: "armor", acBonus: 4, traits: [], runes: { potency: 1 }, invested: "false" } };
  settings.highQualityItems = "no";
  assert("off: a potency rune needs investing", ctx.getACForArmor(armor, pc()), 4);
  settings.highQualityItems = "yes";
  assert("on: marked quality works uninvested", ctx.getACForArmor(armor, pc()), 5);
  assert("unmarked runed armor still needs investing", ctx.getACForArmor({ ...armor, name: "Chain Mail" }, pc()), 4);
  assert("a magical rune still needs it", ctx.getACForArmor({ ...armor, data: { ...armor.data, traits: ["Magical"] } }, pc()), 4);
  settings.highQualityItems = "no";
}

section("doubling rings");
{
  const rings = { name: "Doubling Rings", data: { carried: "worn", invested: "true", traits: ["Invested", "Magical"] } };
  const gold = { _id: "w1", name: "+2 Striking Longsword", data: { type: "weapon", carried: "equipped", runes: { potency: 2, striking: 1 } } };
  const iron = { _id: "w2", name: "Shortsword", data: { type: "weapon", carried: "equipped", runes: {} } };
  const record = pc({ inventory: [rings, gold, iron] });
  assert("the other weapon gets the better runes", ctx.getDoublingRingRunes(record, iron), { potency: 2, striking: 1, from: "+2 Striking Longsword" });
  assert("the better weapon keeps its own", ctx.getDoublingRingRunes(record, gold), null);
  assert("no rings: nothing", ctx.getDoublingRingRunes(pc({ inventory: [gold, iron] }), iron), null);
  assert("a ranged weapon: nothing", ctx.getDoublingRingRunes(record, { ...iron, data: { ...iron.data, range: "60" } }), null);
  assert("striking dice follow", ctx.getStrikingRuneForRecord(record, iron), 1);
}

section("voluntary flaws");
{
  settings.voluntaryFlaws = "yes";
  const elf = (extra) => pc({ ancestries: [{ data: { boosts: {}, flaws: { a: ["con"] } } }], ...extra });
  assert("chosen flaws", ctx.getVoluntaryFlaws(elf({ voluntaryFlaws: ["str", "cha"] })), ["str", "cha"]);
  assert("not on an attribute the ancestry flaws", ctx.getVoluntaryFlaws(elf({ voluntaryFlaws: ["con", "str"] })), ["str"]);
  assert("lowers the attribute", ctx.calculateAbilityBoosts(elf({ voluntaryFlaws: ["str"] })).str.modifier, -1);
  settings.voluntaryFlaws = "no";
  assert("off: none apply", ctx.getVoluntaryFlaws(elf({ voluntaryFlaws: ["str"] })), []);
  assert("off, none chosen: no write", ctx.getVoluntaryFlawFieldValues(pc()), {});
  settings.voluntaryFlaws = "yes";
  assert("on: the picker shows", ctx.getVoluntaryFlawFieldValues(pc()), { "fields.voluntaryFlaws.hidden": false });
  settings.voluntaryFlaws = "no";
}

section("Simplified Ancestries and Skill Feats");
{
  const fighter = pc({ classes: [{ name: "Fighter", data: { ancestryFeatLevels: [1, 5, 9], generalFeatLevels: [3, 7], skillFeatLevels: [2, 4, 6], classFeatLevels: [1, 2] } }] });
  settings.simplifiedAncestries = "yes";
  let levels = ctx.getFeatSlotLevels(fighter);
  assert("only the 1st-level ancestry feat", [levels.ancestry, levels.general], [[1], [3, 7]]);
  settings.simplifiedAncestries = "general";
  levels = ctx.getFeatSlotLevels(fighter);
  assert("general feats instead of the rest", [levels.ancestry, levels.general], [[1], [3, 5, 7, 9]]);
  settings.simplifiedAncestries = "no";
  settings.simplifiedSkillFeats = "yes";
  assert("no skill feats", ctx.getFeatSlotLevels(fighter).skill, []);
  const rogue = pc({ classes: [{ name: "Rogue", data: { skillFeatLevels: [1, 2, 3, 4, 5, 6] } }] });
  assert("a rogue keeps the even levels", ctx.getFeatSlotLevels(rogue).skill, [2, 4, 6]);

  // "don't receive any skill feats, even from their backgrounds"
  const assurance = { _id: "f-assurance", name: "Assurance", recordType: "feats", data: { traits: ["General", "Skill"] } };
  const dagger = { _id: "i-dagger", name: "Dagger", recordType: "items", data: { type: "weapon" } };
  const scholar = pc({ level: 1, feats: [], bonusFeats: [], backgrounds: [{ _id: "b1", name: "Scholar", data: { providesItems: [assurance, dagger] } }] });
  const granted = () => {
    let written = null;
    const saved = ctx.api.setValuesOnRecord;
    ctx.api.setValuesOnRecord = (record, values) => { written = values; };
    ctx.setProvidedItems(scholar);
    ctx.api.setValuesOnRecord = saved;
    return [...(written?.["data.bonusFeats"] || []), ...(written?.["data.inventory"] || [])].map((entry) => entry.name);
  };
  assert("on: the background's skill feat isn't granted, its item is", granted(), ["Dagger"]);
  settings.simplifiedSkillFeats = "no";
  assert("off: both", granted(), ["Assurance", "Dagger"]);
}

section("a rescaled troop's thresholds");
{
  const troop = (hpDetails, actions = []) => ({ traits: ["Troop"], hitpoints: 90, hpDetails, actions });
  assert("counted thresholds scale", ctx.getRescaledTroopHpDetails(troop("Thresholds 60 (3 segments), 30 (2 segments)"), 90, 120), "Thresholds 80 (3 segments), 40 (2 segments)");
  assert("bare thresholds scale", ctx.getRescaledTroopHpDetails(troop("Thresholds: 90, 45"), 135, 90), "Thresholds: 60, 30");
  const defenses = [{ name: "Troop Defenses", data: { description: "Thresholds 60 (3 segments), 30 (2 segments)" } }];
  assert("from the ability: written into the HP details", ctx.getRescaledTroopHpDetails(troop("", defenses), 90, 45), "thresholds 30 (3 segments), 15 (2 segments)");
  assert("not a troop: nothing", ctx.getRescaledTroopHpDetails({ traits: [], hpDetails: "Thresholds 60 (3 segments)" }, 90, 120), null);
  const values = {};
  ctx.setCreatureHp(values, troop("Thresholds 60 (3 segments), 30 (2 segments)"), 120);
  assert("the creature builder writes it with the HP", [values["data.hitpoints"], values["data.hpDetails"]], [120, "Thresholds 80 (3 segments), 40 (2 segments)"]);
}

process.exitCode = summary() > 0 ? 1 : 0;
