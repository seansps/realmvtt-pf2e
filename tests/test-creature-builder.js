// Tests for the creature builder (creature-builder.js, roadmap B17): the GM
// Core tables, Rescale, Build, Reset and the panel (GM Core pg. 112 onward).

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const CREATURE_TABLES = vm.runInContext("CREATURE_TABLES", ctx);
const CREATURE_ROAD_MAPS = vm.runInContext("CREATURE_ROAD_MAPS", ctx);
const CREATURE_TIER_ORDER = vm.runInContext("CREATURE_TIER_ORDER", ctx);

const attack = (name, bonus, formula, type, traits = []) => ({
  _id: `attack-${name}`,
  name,
  recordType: "npc_attacks",
  data: { bonus, traits, damageRolls: [{ _id: `roll-${name}`, data: { formula, type, category: "" } }] },
});

const link = (code, name) =>
  `<record-link recordlink="{&quot;value&quot;:{&quot;type&quot;:&quot;macro&quot;,&quot;code&quot;:&quot;${code}&quot;,&quot;name&quot;:&quot;${name}&quot;},&quot;tooltip&quot;:&quot;${name}&quot;,&quot;type&quot;:&quot;macro&quot;}">${name}</record-link>`;

const troll = (extra = {}) => ({
  _id: "token-1",
  name: "Forest Troll",
  recordType: "npcs",
  recordId: "npc-1",
  data: {
    type: "npc",
    level: 5,
    str: 5,
    dex: 2,
    con: 6,
    int: -2,
    wis: 0,
    cha: -2,
    ac: 20,
    hitpoints: 125,
    curhp: 100,
    fortitudeMod: 17,
    reflexMod: 11,
    willMod: 7,
    perceptionMod: 11,
    initiativeSkill: "Perception",
    initiativeMod: 11,
    skills: [{ _id: "skill-1", name: "Athletics", data: { mod: 12, skillWithMod: "Athletics +12" } }],
    attacks: [attack("Jaws", 14, "2d10+5", "piercing"), attack("Claw", 14, "2d8+5", "slashing", ["Agile"])],
    weaknesses: [
      { _id: "w1", data: { type: "fire", value: 10 } },
      { _id: "w2", data: { type: "electricity", value: 10 } },
    ],
    weaknessesLabel: "fire 10, electricity 10",
    actions: [],
    ...extra,
  },
});

section("The tables (GM Core Tables 2-1 to 2-12)");
{
  const value = ctx.getCreatureTableValue;
  assert("AC 5 moderate", value("ac", 5, "moderate"), 21);
  assert("save 20 terrible", value("save", 20, "terrible"), 27);
  assert("level -1 is the first row", value("strike", -1, "high"), 8);
  assert("level 24 is the last row", value("spellDc", 24, "extreme"), 52);
  assert("HP is the middle of its range", value("hp", 5, "high"), 94);
  assert("damage is its average", value("damage", 10, "high"), 26);
  assert("no extreme attribute at level 0", value("attribute", 0, "extreme"), null);
  Object.entries(CREATURE_TABLES).forEach(([name, columns]) => {
    Object.entries(columns).forEach(([column, rows]) => assert(`${name} ${column} has 26 levels`, rows.length, 26));
  });
}

section("Finding a column");
{
  assert("exactly on one", ctx.getCreatureTier("save", 5, 17).tier, "extreme");
  assert("a tie goes to the higher", ctx.getCreatureTier("ac", 5, 20).tier, "moderate");
  assert("past the top is still the top", ctx.getCreatureTier("strike", 5, 40).tier, "extreme");
}

section("Rescale");
{
  const values = ctx.getCreatureRescaleValues(troll(), 10);
  assert("level", values["data.level"], 10);
  assert("AC keeps its distance: moderate 29 - 1", values["data.ac"], 28);
  assert("extreme Fortitude stays extreme", values["data.fortitudeMod"], 24);
  assert("terrible Will stays terrible", values["data.willMod"], 14);
  assert("Perception", values["data.perceptionMod"], 18);
  assert("initiative follows Perception", values["data.initiativeMod"], 18);
  assert("HP keeps its proportion: 219 * 125 / 94", values["data.hitpoints"], 291);
  assert("damage taken stays", values["data.curhp"], 266);
  assert("attribute", values["data.str"], 7);
  assert("skill", values["data.skills.0.data.mod"], 19);
  assert("skill label", values["data.skills.0.data.skillWithMod"], "Athletics +19");
  assert("Strike bonus", values["data.attacks.0.data.bonus"], 22);
  assert("Strike label", values["data.attacks.0.data.strike1"], "Strike +22");
  assert("MAP", values["data.attacks.0.data.strike2"], "+17 (MAP -5)");
  assert("agile MAP", values["data.attacks.1.data.strike3"], "+14 (MAP -8)");
  assert("own die, the table's count", values["data.attacks.0.data.damageRolls.0.data.formula"], "2d10+15");
  assert("damage label", values["data.attacks.1.data.damage"], "2d8+14 slashing");
  assert("tooltip", values["data.attacks.1.data.criticalTooltip"], "Roll 2 * (2d8+14 slashing) damage");
  assert("weakness", values["data.weaknesses.0.data.value"], 15);
  assert("weakness label", values["data.weaknessesLabel"], "fire 15, electricity 15");

  assert("the same level changes no dice", ctx.rescaleCreatureDamage("3d6+4", 5, 5), "3d6+4");
  assert("down keeps a die", ctx.rescaleCreatureDamage("2d10+5", 5, 1), "1d10+1");
  assert("not a plain formula: left alone", ctx.rescaleCreatureDamage("1d6+@str", 5, 9), "1d6+@str");
  assert("a level off the tables: left alone", ctx.rescaleCreatureValue("ac", 60, 30, 5), 60);
  assert("... and its dice", ctx.scaleCreatureDice("2d6", Infinity), "2d6");

  const skillInit = ctx.getCreatureRescaleValues(troll({ initiativeSkill: "Athletics" }), 10);
  assert("initiative follows its skill", skillInit["data.initiativeMod"], 19);

  const caster = ctx.getCreatureRescaleValues(troll({ spells: [{ _id: "s1", data: { dc: 22, mod: 14 } }] }), 10);
  assert("spell DC", caster["data.spells.0.data.dc"], 29);
  assert("spell attack", caster["data.spells.0.data.mod"], 21);

  const noDc = ctx.getCreatureRescaleValues(troll({ spells: [{ _id: "s1", data: {} }] }), 10);
  assert("an empty entry stays empty", noDc["data.spells.0.data.dc"], undefined);
}

section("Ability text");
{
  const will = link("rollSavingThrow('will', 26);", "Will Save (DC 26)");
  const out = ctx.rescaleCreatureDescription(`<p>90 feet ${will}</p>`, 9, 12);
  assertIncludes("the save's code", out, "rollSavingThrow('will', 30);");
  assertIncludes("its name", out, "&quot;name&quot;:&quot;Will Save (DC 30)&quot;");
  assertIncludes("what it shows", out, ">Will Save (DC 30)</record-link>");
  assert("no old DC left", out.includes("26"), false);

  const breath = link("executeDamageMacro('8d8 bludgeoning', 'standard', '8d8 bludgeoning Damage')", "8d8 bludgeoning Damage");
  assertIncludes("dice in proportion", ctx.rescaleCreatureDescription(breath, 9, 12), "executeDamageMacro('11d8 bludgeoning', 'standard', '11d8 bludgeoning Damage')");

  const swallow = link("executeDamageMacro('2d12+4 bludgeoning', 'standard', '2d12 + 4 bludgeoning Damage')", "2d12 + 4 bludgeoning Damage");
  const swallowed = ctx.rescaleCreatureDescription(swallow, 9, 12);
  assertIncludes("a bonus too", swallowed, "executeDamageMacro('3d12+5 bludgeoning'");
  assertIncludes("the spaced label", swallowed, ">3d12 + 5 bludgeoning Damage</record-link>");

  const flat = link("api.promptRoll(\\&quot;Flat Check (DC 17)\\&quot;, \\&quot;1d20\\&quot;, [], {dc: 17}, 'flatCheck');", "Flat Check (DC 17)");
  assert("a flat check keeps its DC", ctx.rescaleCreatureDescription(flat, 9, 12), flat);
  assert("plain text is left alone", ctx.rescaleCreatureDescription("<p>DC 26 and 2d6</p>", 9, 12), "<p>DC 26 and 2d6</p>");

  const token = troll({ actions: [{ _id: "a1", name: "Howl", data: { description: `<p>${will}</p>` } }, { _id: "a2", name: "Bite", data: { description: "<p>no numbers</p>" } }] });
  const values = ctx.getCreatureRescaleValues(token, 12);
  assert("a changed ability is written", values["data.actions.0.data.description"].includes("rollSavingThrow"), true);
  assert("an unchanged one isn't", values["data.actions.1.data.description"], undefined);

  const checks = ctx.getCreatureHandChecks(troll({ actions: [
    { name: "Link Only", data: { description: `<p>${will}</p>` } },
    { name: "Plain DC", data: { description: "<p>a DC 20 Reflex save</p>" } },
    { name: "Regeneration 20", data: { description: "" } },
    { name: "Nothing", data: { description: "<p>Strides</p>" } },
  ] }));
  assert("the hand checks", Array.from(checks), ["Plain DC", "Regeneration 20"]);
}

section("Build");
{
  const values = ctx.getCreatureBuildValues(troll(), 5, CREATURE_ROAD_MAPS.Brute);
  assert("low Perception", values["data.perceptionMod"], 9);
  assert("high Str", values["data.str"], 5);
  assert("an unlisted attribute is moderate", values["data.wis"], 2);
  assert("an unlisted AC is moderate", values["data.ac"], 21);
  assert("high Fortitude", values["data.fortitudeMod"], 15);
  assert("low Reflex", values["data.reflexMod"], 9);
  assert("high HP", values["data.hitpoints"], 94);
  assert("high attack", values["data.attacks.0.data.bonus"], 15);
  assert("high damage is the table's", values["data.attacks.0.data.damageRolls.0.data.formula"], "2d8+7");
  assert("its label keeps its type", values["data.attacks.0.data.damage"], "2d8+7 piercing");
  assert("skills are moderate", values["data.skills.0.data.mod"], 12);
  assert("initiative follows", values["data.initiativeMod"], 9);
  assert("existing Strikes aren't replaced", values["data.attacks"], undefined);

  const blank = ctx.getCreatureBuildValues(troll({ attacks: undefined, skills: undefined }), 1, CREATURE_ROAD_MAPS.Sniper, true);
  assert("a Strike when there's none", blank["data.attacks"].length, 1);
  assert("... ranged for a sniper", blank["data.attacks"][0].data.weaponType, "Ranged");
  assert("... at the road map's numbers", [blank["data.attacks"][0].data.bonus, blank["data.attacks"][0].data.damage], [9, "1d6+3 bludgeoning"]);

  const low = ctx.getCreatureBuildValues(troll(), 0, { str: "extreme" });
  assert("no extreme attribute at level 0: the next one down", low["data.str"], 3);

  const will = link("rollSavingThrow('will', 26);", "Will Save (DC 26)");
  const old = troll({
    level: 9,
    attacks: [{ ...attack("Bite", 10, "1d6", "piercing"), data: { ...attack("Bite", 10, "1d6", "piercing").data, damageRolls: [{ data: { formula: "1d6", type: "piercing" } }, { data: { formula: "2d6", type: "fire" } }] } }],
    actions: [{ _id: "a1", name: "Howl", data: { description: `<p>${will}</p>` } }],
  });
  const moved = ctx.getCreatureBuildValues(old, 12, {});
  assertIncludes("its abilities' buttons move from the old level", moved["data.actions.0.data.description"], "rollSavingThrow('will', 30);");
  assert("a Strike's other dice move too", moved["data.attacks.0.data.damageRolls.1.data.formula"], "3d6");
  assertIncludes("... in its label", moved["data.attacks.0.data.damage"], "+ 3d6 fire");

  const caster = ctx.getCreatureBuildValues(troll({ spells: [{ _id: "s1", data: { dc: 1, mod: 1 } }] }), 5, CREATURE_ROAD_MAPS.Spellcaster);
  assert("high spell DC", caster["data.spells.0.data.dc"], 22);
  assert("high spell attack", caster["data.spells.0.data.mod"], 14);
  assert("low HP", caster["data.hitpoints"], 56);

  Object.keys(CREATURE_ROAD_MAPS).forEach((map) => {
    Object.entries(CREATURE_ROAD_MAPS[map]).forEach(([stat, tier]) => {
      assert(`${map}: ${stat} is a tier`, CREATURE_TIER_ORDER.includes(tier), true);
    });
  });
}

section("Reset");
{
  const source = troll();
  source.data.curhp = 125;
  source.data.actions = [{ _id: "a1", name: "Howl", data: { description: "old" } }, { _id: "a2", name: "Bite", data: { description: "same" } }];
  source.data.spells = [{ _id: "s1", data: { dc: 22, mod: 14 } }];
  const rescaled = troll({
    level: 10,
    ac: 28,
    hitpoints: 291,
    curhp: 266,
    actions: [
      { _id: "a1", name: "Howl", data: { description: "new", uses: 1 } },
      { _id: "a2", name: "Bite", data: { description: "same" } },
      { _id: "a3", name: "Added on the token", data: { description: "mine" } },
    ],
    spells: [{ _id: "s1", data: { dc: 29, mod: 21, slots: 1 } }],
  });
  const values = ctx.getCreatureResetValues(rescaled, source);
  assert("level", values["data.level"], 5);
  assert("AC", values["data.ac"], 20);
  assert("HP", values["data.hitpoints"], 125);
  assert("damage taken stays", values["data.curhp"], 100);
  assert("Strikes come back whole", values["data.attacks"][0].data.bonus, 14);
  assert("... as a copy", values["data.attacks"] === source.data.attacks, false);
  assert("weakness label", values["data.weaknessesLabel"], "fire 10, electricity 10");
  assert("a changed ability returns", values["data.actions.0.data.description"], "old");
  assert("an unchanged one isn't written", values["data.actions.1.data.description"], undefined);
  assert("one added on the token is left", values["data.actions.2.data.description"], undefined);
  assert("spell DC returns", values["data.spells.0.data.dc"], 22);
  assert("nothing touches its slots", Object.keys(values).some((key) => key.includes("slots")), false);

  const added = ctx.getCreatureResetValues(troll({ attacks: [attack("Strike", 9, "1d6", "bludgeoning")] }), troll({ attacks: undefined }));
  assert("a Strike Build added goes", added["data.attacks"].length, 0);
}

section("The panel's actions");
{
  let notice = null;
  const writes = [];
  const messages = [];
  let selected = [];
  let prompts = [];
  const prompted = [];
  ctx.api.showNotification = (message) => { notice = message; };
  ctx.api.getSelectedTokens = () => selected;
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push({ id, type, values });
  ctx.api.sendMessage = (message) => messages.push(message);
  ctx.api.showPrompt = (title, prompt, placeholder, options, value, callback) => {
    prompted.push({ prompt, options });
    callback(prompts.shift());
  };
  const reset = () => { notice = null; writes.length = 0; messages.length = 0; prompted.length = 0; };

  ctx.rescaleSelectedCreatures();
  assertIncludes("nothing selected", notice, "Select an NPC's token");

  reset();
  selected = [{ token: troll({ type: "hazard" }) }];
  ctx.rescaleSelectedCreatures();
  assertIncludes("a hazard isn't a creature here", notice, "Select an NPC's token");

  reset();
  selected = [{ token: troll({ adjustment: "elite" }) }];
  ctx.rescaleSelectedCreatures();
  assertIncludes("Elite first", notice, "Remove Elite or Weak first: Forest Troll");
  assert("no prompt then", prompted.length, 0);

  reset();
  selected = [{ token: troll() }, { token: { ...troll(), _id: "token-2" } }];
  prompts = ["10"];
  ctx.rescaleSelectedCreatures();
  assert("levels -1 to 24", [prompted[0].options.length, prompted[0].options[0].value, prompted[0].options[25].value], [26, "-1", "24"]);
  assert("one write each", writes.map((write) => write.id), ["token-1", "token-2"]);
  assert("to the token", writes[0].type, "npcs");
  assert("a card each", messages.length, 2);
  assert("nothing about linked tokens now", messages[0].includes("linked"), false);
  assertIncludes("GM only", messages[0], "[gm]**Forest Troll: level 5 to 10.**[/gm]");
  assertIncludes("what changed", messages[0], "AC 20 to 28, HP 125 to 291");
  assert("every line is GM only", messages[0].split("\n").every((line) => line.startsWith("[gm]") && line.endsWith("[/gm]")), true);

  reset();
  selected = [{ token: { ...troll(), linked: true } }];
  ctx.rescaleSelectedCreatures();
  assertIncludes("a linked token is refused", notice, "Linked tokens share their NPC record, so they're left alone: Forest Troll");
  assert("no prompt then", prompted.length, 0);

  reset();
  ctx.buildSelectedCreatures();
  assertIncludes("Build refuses it too", notice, "Linked tokens share");
  assert("... before any prompt", prompted.length, 0);

  reset();
  selected = [{ token: { ...troll(), linked: true } }, { token: { ...troll(), _id: "token-2" } }];
  prompts = ["7"];
  ctx.rescaleSelectedCreatures();
  assert("the others still go", writes.map((write) => write.id), ["token-2"]);

  reset();
  selected = [{ token: troll() }];
  prompts = ["5", "Brute"];
  ctx.buildSelectedCreatures();
  assert("road map options", prompted[1].options.map((option) => option.value), Object.keys(CREATURE_ROAD_MAPS));
  assert("built", writes[0].values["data.perceptionMod"], 9);
  assertIncludes("its card", messages[0], "built as a level 5 Brute");

  reset();
  prompts = ["5", "Spellcaster", "wis"];
  ctx.buildSelectedCreatures();
  assert("a Spellcaster picks its attribute", prompted[2].options.map((option) => option.value), ["int", "wis", "cha"]);
  assert("that one is high", writes[0].values["data.wis"], 5);
  assert("the others stay moderate", writes[0].values["data.cha"], 4);

  reset();
  prompts = ["5", "Skill Paragon", "dex"];
  ctx.buildSelectedCreatures();
  assert("a Skill Paragon picks from all six", prompted[2].options.length, 6);
  assert("its attribute is high", writes[0].values["data.dex"], 5);

  reset();
  prompts = ["5", "Spellcaster", null];
  ctx.buildSelectedCreatures();
  assert("cancelling writes nothing", writes.length, 0);

  reset();
  selected = [{ token: troll({ actions: [{ name: "Plain DC", data: { description: "<p>a DC 20 save</p>" } }] }) }];
  prompts = ["5", "Brute"];
  ctx.buildSelectedCreatures();
  assertIncludes("Build names its hand checks", messages[0], "Check by hand, their text has numbers: Plain DC.");
  selected = [{ token: troll() }];

  reset();
  prompts = [null];
  ctx.rescaleSelectedCreatures();
  assert("no level, no write", writes.length, 0);

  reset();
  prompts = ["3"];
  ctx.postCreatureBenchmarks();
  assertIncludes("benchmarks", messages[0], "**Creature benchmarks, level 3**");
  assertIncludes("AC row", messages[0], "**AC:** Extreme 22, High 19, Moderate 18, Low 16");
  assertIncludes("HP ranges", messages[0], "**HP:** High 53-59, Moderate 42-48, Low 31-37");
  assertIncludes("damage row", messages[0], "**Strike damage:** Extreme 1d12+8 (15)");
  assertIncludes("no empty cells", ctx.getCreatureBenchmarkMessage(0), "**Attribute:** High +3, Moderate +2, Low +0");

  reset();
  let asked = null;
  ctx.api.getRecord = (type, id, callback) => { asked = [type, id]; callback(troll({ curhp: 125 })); };
  selected = [{ token: troll({ level: 10, ac: 28 }) }];
  ctx.resetSelectedCreatures();
  assert("reads its NPC record", asked, ["npcs", "npc-1"]);
  assert("restores the token", [writes[0].id, writes[0].values["data.ac"]], ["token-1", 20]);
  assertIncludes("says so", messages[0], "is back to its NPC record, level 5");

  reset();
  ctx.api.getRecord = (type, id, callback) => callback(null);
  ctx.resetSelectedCreatures();
  assertIncludes("the record is gone", notice, "has no NPC record to return to");
  assert("nothing written", writes.length, 0);

  reset();
  selected = [{ token: { ...troll(), linked: true } }];
  ctx.resetSelectedCreatures();
  assertIncludes("a linked token has no original", notice, "Linked tokens share");
}

section("Wiring");
{
  const panel = fs.readFileSync(__dirname + "/../gm-tools-panel.html", "utf8");
  ["postCreatureBenchmarks()", "rescaleSelectedCreatures()", "buildSelectedCreatures()", "resetSelectedCreatures()"].forEach((call) => assertIncludes(call, panel, call));
  const config = fs.readFileSync(__dirname + "/../ruleset.config.json", "utf8");
  assertIncludes("the global script", config, "rollhandlers/creature-builder.js");
  assert("nothing on the NPC main tab", fs.readFileSync(__dirname + "/../npcs-main.html", "utf8").includes("rescaleSelectedCreatures"), false);
}

summary();
