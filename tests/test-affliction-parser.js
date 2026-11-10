// Tests for the data script's affliction parser (tools/afflictions/parse.js):
// each description shape the modules print.

const { parseRecordAffliction, describeAffliction, decodeEntities } = require("../tools/afflictions/parse");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const attr = (obj) => JSON.stringify(obj).replace(/"/g, "&quot;");
const macro = (code, text) => `<record-link recordlink="${attr({ value: { type: "macro", code, name: text }, tooltip: text, type: "macro" })}">${text}</record-link>`;
const effect = (name) => `<record-link recordlink="${attr({ value: { _id: `e-${name}`, name, recordType: "effects" }, tooltip: name, type: "effects" })}">${name}</record-link>`;

section("Paragraph per line (GM Core, Monster Core)");
{
  const record = {
    name: "Giant Centipede Venom",
    recordType: "actions",
    data: {
      traits: ["Common", "Poison"],
      description: [
        `<p><strong>Saving Throw</strong> ${macro("rollSavingThrow('fortitude', 14);", "Fortitude Save (DC 14)")}</p>`,
        "<hr />",
        "<p><strong>Maximum Duration</strong> 6 rounds</p>",
        `<p><strong>Stage 1</strong> ${macro("executeDamageMacro('1d4 poison', 'standard', '1d4 poison Damage')", "1d4 poison Damage")} damage (1 round)</p>`,
        `<p><strong>Stage 2</strong> ${macro("executeDamageMacro('1d4 poison', 'standard', '1d4 poison Damage')", "1d4 poison Damage")} damage and ${effect("Off-Guard")} (1 round)</p>`,
      ].join("\n"),
    },
  };
  const { affliction, problems } = parseRecordAffliction(record);
  assert("save and DC", [affliction.save, affliction.dc, affliction.kind], ["fortitude", 14, "poison"]);
  assert("maximum duration", affliction.maxDuration, { value: 6, unit: "round" });
  assert("stage 2", [affliction.stages[1].damage, affliction.stages[1].conditions, affliction.stages[1].interval], [["1d4 poison"], [{ name: "Off-Guard", value: 1 }], { value: 1, unit: "round" }]);
  assert("no problems", problems, []);
}

section("One paragraph with semicolons (Treasure Vault)");
{
  const save = `<record-link recordlink="{&quot;value&quot;: {&quot;type&quot;: &quot;macro&quot;, &quot;code&quot;: &quot;rollSavingThrow(&#x27;fortitude&#x27;, 25);&quot;, &quot;name&quot;: &quot;DC 25 Fortitude&quot;}, &quot;type&quot;: &quot;macro&quot;}">DC 25 Fortitude</record-link>`;
  const record = {
    name: "Curare",
    recordType: "items",
    data: {
      level: 8,
      traits: ["Alchemical", "Injury", "Poison"],
      description: `<p>Hunters favor curare.</p><p><strong>Saving Throw</strong> ${save}; <strong>Maximum Duration</strong> 6 rounds (but see stage 3); <strong>Stage 1</strong> 2d6 poison damage, clumsy 1, and enfeebled 1 (1 round); <strong>Stage 2</strong> 3d6 poison damage, clumsy 2, enfeebled 2, and slowed 1 (1 minute); <strong>Stage 3</strong> 4d6 poison damage, clumsy 2, enfeebled 2, and slowed 1 (1 round). If the victim fails the saving throw while at Stage 3, the poison ends and the victim is paralyzed for 2d6 minutes.</p>`,
    },
  };
  const { affliction, problems } = parseRecordAffliction(record);
  assert("the &#x27; macro", [affliction.save, affliction.dc], ["fortitude", 25]);
  assert("maximum duration despite its note", affliction.maxDuration, { value: 6, unit: "round" });
  assert("three stages", affliction.stages.length, 3);
  assert("stage 1 from text", [affliction.stages[0].damage, affliction.stages[0].conditions], [["2d6 poison"], [{ name: "Clumsy", value: 1 }, { name: "Enfeebled", value: 1 }]]);
  assert("stage 2: a minute", affliction.stages[1].interval, { value: 1, unit: "minute" });
  assert("stage 3: the trailing sentence isn't the stage's", affliction.stages[2].conditions.map((c) => c.name), ["Clumsy", "Enfeebled", "Slowed"]);
  assertIncludes("... it's a note", affliction.stages[2].note, "paralyzed for 2d6 minutes");
  assert("no problems", problems, []);
  assert("&#x27; and friends", decodeEntities("&#x27;a&#39; &amp; &quot;b&quot;"), `'a' & "b"`);
}

section("A spell: the caster's DC");
{
  const record = {
    name: "Goblin Pox",
    recordType: "spells",
    data: {
      level: 1,
      traits: ["Concentrate", "Disease", "Manipulate"],
      defense: { save: { statistic: "fortitude", basic: false } },
      description: [
        "<p>Your touch afflicts the target with goblin pox.</p>",
        "<hr />",
        "<p><strong>Goblin Pox</strong> (disease) <strong>Level</strong> 1; Creatures that have the goblin trait are immune</p>",
        `<p><strong>Stage 1</strong> ${effect("Sickened 1")} (1 round)</p>`,
        `<p><strong>Stage 2</strong> ${effect("Sickened 1")} and ${effect("Slowed 1")} (1 round)</p>`,
        `<p><strong>Stage 3</strong> ${effect("Sickened 1")} and the creature can't reduce its Sickened value below 1 (1 day)</p>`,
        "<hr />",
        `<p><strong>Success</strong> The target is ${effect("Sickened 1")}.</p>`,
      ].join("\n"),
    },
  };
  const { affliction, problems } = parseRecordAffliction(record);
  assert("the spell's save, the caster's DC", [affliction.save, affliction.dc], ["fortitude", "spell"]);
  assert("kind and level from its line", [affliction.kind, affliction.level], ["disease", 1]);
  assert("the spell's own results aren't stages", affliction.stages.length, 3);
  assert("stage 3: a day", affliction.stages[2].interval, { value: 1, unit: "day" });
  assert("no problems", problems, []);
  assert("named by its header", affliction.name, "Goblin Pox");
}

section("A spell whose affliction has its own name (Blood Chestnuts)");
{
  const record = {
    name: "Blood Chestnuts",
    recordType: "spells",
    data: {
      traits: ["Disease", "Manipulate", "Wood"],
      defense: { save: { statistic: "fortitude", basic: true } },
      description: [
        "<p>Chestnuts burst from the ground and pierce the creatures in the area.</p>",
        "<p><strong>Draining Growth</strong> (disease)</p>",
        `<p><strong>Stage 1</strong> ${effect("Drained 1")} (1 day)</p>`,
        `<p><strong>Stage 2</strong> ${effect("Drained 2")} (1 day)</p>`,
      ].join("\n"),
    },
  };
  const { affliction } = parseRecordAffliction(record);
  assert("the affliction's name, not the spell's", affliction.name, "Draining Growth");
  const plain = parseRecordAffliction({ ...record, data: { ...record.data, description: record.data.description.replace("<p><strong>Draining Growth</strong> (disease)</p>\n", "") } });
  assert("no header: the record's name", plain.affliction.name, "Blood Chestnuts");
  const item = parseRecordAffliction({ ...record, name: "Some Item", recordType: "items", data: { ...record.data, defense: undefined, description: `<p><strong>Saving Throw</strong> DC 20 Fortitude</p>
${record.data.description}` } });
  assert("an item keeps its own name", item.affliction.name, "Some Item");
}

section("A save with no DC, a final stage with no interval (Graveknight's Curse)");
{
  const record = {
    name: "(Graveknight) Graveknight's Curse",
    recordType: "actions",
    data: {
      traits: ["Arcane", "Curse"],
      description: [
        "<p>This curse affects anyone who wears a graveknight's armor for at least 1 hour</p>",
        `<p><strong>Saving Throw</strong> ${macro("rollSavingThrow('will');", "Will Save")} save</p>`,
        "<p><strong>Onset</strong> 1 hour</p>",
        `<p><strong>Stage 1</strong> ${effect("Doomed 1")} and can't remove armor (1 day)</p>`,
        `<p><strong>Stage 2</strong> ${effect("Doomed 2")}, –10-foot status penalty to Speeds, and can't remove armor (1 day)</p>`,
        "<p><strong>Stage 3</strong> dies and transforms into the armor's graveknight.</p>",
      ].join("\n"),
    },
  };
  const { affliction, problems } = parseRecordAffliction(record);
  assert("Will, no DC", [affliction.save, affliction.dc, affliction.kind], ["will", null, "curse"]);
  assert("onset", affliction.onset, { value: 1, unit: "hour" });
  assert("reported", problems, ["no DC: the GM sets it", "stage 3: no interval (a final stage?)"]);
  assertIncludes("the report line", describeAffliction(affliction), "will (no DC); curse; onset 1 hour; max —; 3 stages");
  assertIncludes("... its stages", describeAffliction(affliction), "  2. no damage; Doomed 2; 1 day");
}

section("Not an affliction");
{
  assert("no stages", parseRecordAffliction({ name: "Rope", data: { description: "<p>Rope.</p>" } }), { affliction: null, problems: ["no Stage lines"] });
  const noSave = parseRecordAffliction({ name: "X", recordType: "items", data: { description: "<p><strong>Stage 1</strong> sickened 1 (1 round)</p>" } });
  assert("stages but no save", noSave, { affliction: null, problems: ["no save"] });
  const kindless = parseRecordAffliction({ name: "Viper's Fang", recordType: "items", data: { traits: ["Magical"], description: `<p><strong>Saving Throw</strong> DC 22 Fortitude</p><p><strong>Stage 1</strong> 1d6 poison damage</p>` } });
  assert("text save; kind unknown and no interval reported", [kindless.affliction.dc, kindless.problems], [22, ["kind unknown (no poison, disease or curse trait)", "stage 1: no interval (a final stage?)"]]);
}

section("The report");
{
  const { getReport, formatReport } = require("../tools/afflictions/report");
  const records = [
    { name: "Black Adder Venom", recordType: "items", category: "Pathfinder GM Core", data: { traits: ["Poison"], description: "<p><strong>Saving Throw</strong> DC 18 Fortitude</p><p><strong>Stage 1</strong> 1d4 poison damage (1 round)</p>" } },
    { name: "Viper's Fang", recordType: "items", category: "Pathfinder GM Core", data: { traits: ["Magical"], description: "<p><strong>Saving Throw</strong> DC 22 Fortitude</p><p><strong>Stage 1</strong> 1d6 poison damage</p>" } },
    { name: "Odd", recordType: "items", category: "Homebrew", data: { description: "<p><strong>Stage 1</strong> sickened 1 (1 round)</p>" } },
    { name: "Rope", recordType: "items", category: "Pathfinder GM Core", data: { description: "<p>Rope.</p>" } },
  ];
  const report = getReport(records);
  assert("only records with stages", report.rows.length, 3);
  assert("by source", report.bySource, { "Pathfinder GM Core": { clean: 1, partial: 1, "not parsed": 0 }, Homebrew: { clean: 0, partial: 0, "not parsed": 1 } });
  const text = formatReport(report);
  assertIncludes("the totals", text, "# Afflictions: 3 records, 1 clean, 1 partial, 1 not parsed");
  assertIncludes("a problem listed", text, "Problems: kind unknown (no poison, disease or curse trait); stage 1: no interval (a final stage?)");
  assertIncludes("a parse listed", text, "fortitude DC 18; poison; onset —; max —; 1 stage");
}

section("Treasure Vault cases from the dry run");
{
  const tv = (name, traits, body) => parseRecordAffliction({ name, recordType: "items", data: { traits, description: `<p>${body}</p>` } });
  const stupor = tv("Stupor Poison", ["Uncommon", "Alchemical-Consumable-Incapacitation-Injury-Poison-Sleep"],
    "<strong>Saving Throw</strong> DC 20 Fortitude; <strong>Maximum Duration</strong> 6 hours; <strong>Stage 1</strong> slowed 1 and off-guard (1 round); <strong>Stage 4</strong> unconscious with no Perception check to wake up (1d6 hours)");
  assert("hyphen-joined traits: still a poison", stupor.affliction.kind, "poison");
  assert("a dice interval kept for the GM", stupor.affliction.stages[1].interval, { dice: "1d6", unit: "hour" });
  const bower = tv("Bower Fruit", ["Rare", "Consumable", "Cursed", "Primal"],
    "<strong>Curse of Decadence</strong> (curse) <strong>Saving Throw</strong> DC 30 Fortitude; <strong>Stage 1</strong> You become fatigued. (1 week); <strong>Stage 2</strong> As stage 1, plus you're sickened 1; <strong>Stage 3</strong> As stage 1, plus you're drained 1 and sickened 1");
  assert("kind from its (curse) line", bower.affliction.kind, "curse");
  assert("As stage 1: its interval", [bower.affliction.stages[1].interval, bower.affliction.stages[2].interval], [{ value: 1, unit: "week" }, { value: 1, unit: "week" }]);
  assert("nothing left to report", bower.problems, []);
  const blister = tv("Blisterwort", ["Poison"],
    "<strong>Saving Throw</strong> DC 30 Fortitude; <strong>Maximum Duration</strong> 6 rounds; <strong>Stage 1</strong> 4d6 poison damage and weakness 2 to physical and force damage; <strong>Stage 2</strong> 5d6 poison damage and weakness 4 to physical and force damage");
  assert("no interval in the data: reported, not guessed", [blister.affliction.stages[0].interval, blister.problems], [null, ["stage 1: no interval", "stage 2: no interval (a final stage?)"]]);
}

section("Records: items, NPC abilities, the data to write");
{
  const { getRecordAfflictions, getAfflictionData, getAfflictionEffect, isWritableAffliction } = require("../tools/afflictions/parse");
  const venom = `<p><strong>Saving Throw</strong> DC 14 Fortitude</p><p><strong>Maximum Duration</strong> 6 rounds</p><p><strong>Stage 1</strong> 1d4 poison damage (1 round)</p>`;
  const npc = {
    _id: "n1",
    name: "Giant Centipede",
    recordType: "npcs",
    data: {
      level: -1,
      actions: [
        { name: "Swarming Bites", data: { description: "<p>Bites.</p>" } },
        { name: "Giant Centipede Venom", data: { traits: ["Poison"], description: venom } },
      ],
    },
  };
  const found = getRecordAfflictions(npc);
  assert("an NPC's ability, by index", [found.length, found[0].index, found[0].name, found[0].affliction.dc], [1, 1, "Giant Centipede Venom", 14]);
  const next = getAfflictionData(npc, found, { "Giant Centipede Venom": "eff1" });
  assert("written on the ability, the rest kept", [next.level, next.actions[0], next.actions[1].data.affliction.effectId], [-1, npc.data.actions[0], "eff1"]);
  assert("the description untouched", next.actions[1].data.description, venom);
  const written = { ...npc, data: next };
  assert("a second run: nothing", getAfflictionData(written, getRecordAfflictions(written), { "Giant Centipede Venom": "eff1" }), null);

  const item = { _id: "i1", name: "Black Adder Venom", recordType: "items", data: { price: 6, traits: ["Poison"], description: venom } };
  const itemNext = getAfflictionData(item, getRecordAfflictions(item), { "Black Adder Venom": "eff2" });
  assert("an item: data.affliction, the rest kept", [itemNext.price, itemNext.affliction.save, itemNext.affliction.effectId], [6, "fortitude", "eff2"]);

  const noDc = { _id: "a1", name: "(Graveknight) Graveknight's Curse", recordType: "actions", data: { traits: ["Curse"], description: "<p><strong>Saving Throw</strong> Will</p><p><strong>Stage 1</strong> doomed 1 (1 day)</p>" } };
  const noDcFound = getRecordAfflictions(noDc);
  assert("no DC: not written", [isWritableAffliction(noDcFound[0]), getAfflictionData(noDc, noDcFound, {})], [false, null]);

  const effect = getAfflictionEffect({ ...noDcFound[0].affliction, dc: 30 }, { campaignId: "c1", portrait: "/x.webp" });
  assert("the effect: named without the prefix, stackable", [effect.name, effect.stackable, effect.durationUnit, effect.portrait], ["Graveknight's Curse", true, "indefinite", "/x.webp"]);
  assertIncludes("... says the stacks are the stage", effect.description, "Curse: the stacks are the stage (1 stage).");
  assert("... no category unless given", effect.category, undefined);
  const categorized = getAfflictionEffect({ ...noDcFound[0].affliction, dc: 30 }, { campaignId: "c1", category: "Pathfinder GM Core" });
  assert("... the delivering record's category", categorized.category, "Pathfinder GM Core");

  // The effect's description: the affliction's own lines, links kept
  const { getAfflictionEffectDescription, PLACEHOLDER_EFFECT_DESCRIPTION, parseRecordAffliction } = require("../tools/afflictions/parse");
  const tvHtml = "<p>Hunters favor curare.</p><p><strong>Saving Throw</strong> <record-link recordlink=\"{}\">DC 25 Fortitude</record-link>; <strong>Maximum Duration</strong> 6 rounds; <strong>Stage 1</strong> 2d6 poison damage (1 round); <strong>Stage 2</strong> 3d6 poison damage (1 round)</p>";
  const tvDescription = getAfflictionEffectDescription(tvHtml, parseRecordAffliction({ name: "Curare", recordType: "items", data: { description: tvHtml, traits: ["Poison"] } }).affliction);
  assert("effect description: the affliction's lines, one paragraph each, flavor left out", tvDescription,
    "<p><strong>Saving Throw</strong> <record-link recordlink=\"{}\">DC 25 Fortitude</record-link></p><p><strong>Maximum Duration</strong> 6 rounds</p><p><strong>Stage 1</strong> 2d6 poison damage (1 round)</p><p><strong>Stage 2</strong> 3d6 poison damage (1 round)</p><p><em>The stacks are the stage (2 stages).</em></p>");
  const spellHtml = "<p>Seeds.</p><hr /><p><strong>Draining Growth</strong> (disease) Can't reduce drained.</p><p><strong>Stage 1</strong> drained 1 (1 round)</p>";
  assertIncludes("... a spell's affliction header kept", getAfflictionEffectDescription(spellHtml, null), "<p><strong>Draining Growth</strong> (disease) Can't reduce drained.</p><p><strong>Stage 1</strong>");
  assert("... none without affliction lines", getAfflictionEffectDescription("<p>Nothing.</p>", null), "");
  assert("... used for the effect", getAfflictionEffect({ ...noDcFound[0].affliction, dc: 30 }, { description: tvDescription }).description, tvDescription);
  assert("placeholder: only the first runs' text is replaced",
    [PLACEHOLDER_EFFECT_DESCRIPTION.test("<p>Poison: the stacks are the stage (3 stages).</p>"), PLACEHOLDER_EFFECT_DESCRIPTION.test("<p>Curse: the stacks are the stage (1 stage).</p>"), PLACEHOLDER_EFFECT_DESCRIPTION.test(tvDescription)],
    [true, true, false]);
}

process.exitCode = summary() > 0 ? 1 : 0;
