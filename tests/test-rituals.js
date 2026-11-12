// Tests for ritual cards (rituals.js, Player Core pg. 389), and the snare and
// spellgun lines on an item's Use card (item-variants.js).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const ritual = (extra = {}) => ({
  name: "Create Undead",
  data: {
    type: "ritual",
    level: 2,
    traits: ["Uncommon", "Necromancy"],
    ritual: { primary: { check: "Religion (expert)" }, secondary: { check: "Arcana, Occultism", casters: 2 } },
    ...extra,
  },
});

section("which spells are rituals");
{
  assert("the ritual type", ctx.isRitualSpell(ritual()), true);
  assert("or the trait", ctx.isRitualSpell({ data: { traits: ["Ritual"] } }), true);
  assert("a spell isn't", ctx.isRitualSpell({ data: { type: "spell", traits: [] } }), false);
}

section("DCs: very hard and standard for twice the rank");
{
  const dcs = ctx.getRitualDCs(2);
  assert("level 4", dcs.level, 4);
  assert("primary very hard", dcs.primary, ctx.getDCForLevel(4) + 5);
  assert("secondary standard", dcs.secondary, ctx.getDCForLevel(4));
}

section("skills from the check text");
{
  assert("one with its rank", ctx.getRitualSkills("Religion (expert)"), ["religion"]);
  assert("a list", ctx.getRitualSkills("Arcana, Occultism"), ["arcana", "occultism"]);
  assert("a Lore", ctx.getRitualSkills("Underworld Lore; Society"), ["Underworld Lore", "society"]);
  assert("nothing", ctx.getRitualSkills(""), []);
}

section("the cast card");
{
  const text = ctx.getRitualCastText(ritual());
  const dcs = ctx.getRitualDCs(2);
  assertIncludes("the DCs", text, `primary check DC ${dcs.primary} (very hard for level 4), secondary checks DC ${dcs.secondary}, 2 secondary casters`);
  assertIncludes("the secondary results explained", text, "critical success +2 to the primary check");
  assertIncludes("a secondary button per skill", text, "Secondary_Arcana");
  assertIncludes("the other", text, "Secondary_Occultism");
  assertIncludes("the primary button", text, "Primary_Religion");
  assertIncludes("no fortune", text, '"noFortune":true');
  assertIncludes("the primary's opt-ins", text, "Secondary check critical success");
  assert("other spells: nothing", ctx.getRitualCastText({ data: { type: "spell" } }), "");
}

section("a secondary check's result");
{
  assertIncludes("critical success", ctx.getRitualResultLines({ ritual: "secondary" }, 2)[0], "+2 circumstance bonus");
  assertIncludes("failure", ctx.getRitualResultLines({ ritual: "secondary" }, 0)[0], "-4 circumstance penalty");
  assertIncludes("critical failure", ctx.getRitualResultLines({ ritual: "secondary" }, -1)[0], "one step worse");
  assert("a primary check: nothing", ctx.getRitualResultLines({ ritual: "primary" }, 2), []);
  assert("no DC: nothing", ctx.getRitualResultLines({ ritual: "secondary" }, null), []);
}

section("no fortune on a ritual check");
{
  const prompts = [];
  ctx.api.promptRollForToken = (record, title, formula, modifiers, metadata) => prompts.push({ modifiers, metadata });
  const saved = ctx.getRollTwiceModifiers;
  ctx.getRollTwiceModifiers = () => [{ name: "Lucky (Fortune)", value: "advantage", valueType: "string", type: "", active: true }];
  const caster = { _id: "c1", recordType: "characters", data: { level: 5, religion: 2, religionMod: 9 } };
  ctx.rollSkill(caster, "religion", 20, false, 0, 1, "int", true, false, undefined, { ritual: "primary", noFortune: true });
  ctx.rollSkill(caster, "religion", 20, false, 0, 1, "int", true, false, undefined, {});
  ctx.getRollTwiceModifiers = saved;
  const names = (i) => prompts[i].modifiers.map((m) => m.name);
  assertNotIncludes("the ritual check drops it", names(0).join(","), "Lucky");
  assertIncludes("a normal check keeps it", names(1).join(","), "Lucky");
}

section("snares");
{
  const snare = { name: "Alarm Snare", data: { traits: ["Snare", "Consumable"] } };
  assertIncludes("the creator's Crafting DC", ctx.getSnareUseText(snare, { data: { craftingMod: 9, crafting: 1 } }), "Stealth DC 19 to find");
  assertIncludes("expert: only active searching", ctx.getSnareUseText(snare, { data: { craftingMod: 11, crafting: 2 } }), "only by creatures actively searching");
  assert("not a snare", ctx.getSnareUseText({ data: { traits: [] } }, { data: {} }), "");
}

section("spellguns");
{
  const gun = { name: "Flame Tongue Spellgun", data: { traits: ["Spellgun", "Fire"], range: "30 feet" } };
  const caster = { data: { level: 5, dex: 3, attackProficiencies: { simple: 1 }, spells: [{ data: { mod: 11 } }, { data: { type: "item", mod: 15 } }] } };
  const text = ctx.getSpellgunUseText(gun, caster);
  assertIncludes("both options", text, "spell attack +11 or simple firearms +10");
  assertIncludes("the range", text, "range increment 30 feet");
  assertIncludes("not a firearm", text, "It isn't a firearm");
  assertIncludes("no caster: firearms only", ctx.getSpellgunUseText(gun, { data: { level: 1, dex: 2, attackProficiencies: { simple: 1 } } }), "attack with simple firearms +5");
}

process.exitCode = summary() > 0 ? 1 : 0;
