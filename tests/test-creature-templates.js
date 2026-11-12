// Tests for the undead creature adjustments (creature-templates.js, Book of
// the Dead pg. 72-73) and Reset undoing them (creature-builder.js).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const troll = (extra = {}) => ({
  _id: "tok-1",
  name: "Forest Troll",
  recordType: "npcs",
  recordId: "npc-1",
  linked: false,
  data: {
    level: 5,
    hitpoints: 125,
    curhp: 125,
    fortitudeMod: 17,
    reflexMod: 11,
    willMod: 7,
    senses: "",
    traits: ["Large", "Giant"],
    traitsList: [],
    languages: ["Common", "Jotun"],
    immunities: [],
    weaknesses: [{ _id: "w1", data: { type: "fire", value: 10 } }],
    weaknessesLabel: "fire 10",
    resistances: [],
    skills: [{ _id: "s1", name: "Athletics", data: { mod: 12 } }],
    attacks: [{ _id: "a1", name: "Jaws", data: { traits: ["Unarmed"], damage: "2d10+5 piercing", damageRolls: [{ data: { formula: "2d10+5", type: "piercing" } }] } }],
    actions: [{ _id: "x1", name: "Rend", data: { description: "<p>Claw</p>" } }],
    ...extra,
  },
});

section("the level tables");
{
  const existing = ctx.getCreatureTemplateValues(troll({ level: 3 }), "mummy").values["data.weaknesses"];
  assert("an existing higher weakness stays (fire 10 over the template's 3)", existing.map((r) => [r.data.type, r.data.value]), [["fire", 10]]);
  const mummy = (level) => ctx.getCreatureTemplateValues(troll({ level, weaknesses: [] }), "mummy").values["data.weaknesses"][0].data.value;
  assert("mummy fire weakness by level", [mummy(3), mummy(4), mummy(9), mummy(14)], [3, 5, 10, 15]);
}

section("a skeleton");
{
  const { values, lines } = ctx.getCreatureTemplateValues(troll(), "skeletonMindless");
  assert("traits added", values["data.traits"], ["Large", "Giant", "Skeleton", "Undead", "Mindless"]);
  assert("mindless: no Necril", values["data.languages"], undefined);
  assert("HP 10 lower at 5th", [values["data.hitpoints"], values["data.curhp"]], [115, 115]);
  assert("immunities, mental for mindless", values["data.immunities"].map((r) => r.data.type), ["death effects", "disease", "paralyzed", "poison", "unconscious", "mental"]);
  assert("resistance 3", values["data.resistancesLabel"], "cold 3, electricity 3, fire 3, piercing 3, slashing 3");
  assert("darkvision", values["data.senses"], "Darkvision");
  assert("void healing added", values["data.actions"].map((a) => a.name), ["Rend", "Void Healing"]);
  assertIncludes("the card says what changed", lines.join(" "), "Hit Points 10 lower");
}

section("a ghost");
{
  const { values } = ctx.getCreatureTemplateValues(troll(), "ghost");
  assert("Necril", values["data.languages"], ["Common", "Jotun", "Necril"]);
  assert("weaknesses 5, keeping fire", values["data.weaknessesLabel"], "fire 10, force 5, ghost touch 5, vitality 5");
  assert("physical Strikes deal void", [values["data.attacks.0.data.damageRolls.0.data.type"], values["data.attacks.0.data.damage"]], ["void", "2d10+5 void"]);
  assert("and are magical", values["data.attacks.0.data.traits"], ["Unarmed", "Magical"]);
  assert("Ghostly Passage", values["data.actions"].some((a) => a.name === "Ghostly Passage"), true);
}

section("a ghoul, a shadow, a vampire");
{
  const ghoul = ctx.getCreatureTemplateValues(troll(), "ghoul").values;
  assert("ghoul saves 1 lower", [ghoul["data.fortitudeMod"], ghoul["data.reflexMod"], ghoul["data.willMod"]], [16, 10, 6]);
  const shadow = ctx.getCreatureTemplateValues(troll(), "shadow").values;
  assert("shadow Stealth at its best skill", shadow["data.skills"].find((r) => r.name === "Stealth").data.mod, 12);
  const vampire = ctx.getCreatureTemplateValues(troll(), "vampireSilver");
  assert("vampire HP and resistance", [vampire.values["data.hitpoints"], vampire.values["data.resistancesLabel"]], [115, "physical 3 (except silver)"]);
  assert("vampire immune to sleep", vampire.values["data.immunities"].some((r) => r.data.type === "sleep"), true);
  assert("an unknown template", ctx.getCreatureTemplateValues(troll(), "lich"), null);
}

section("only once");
{
  assert("a living creature", ctx.isAlreadyUndead(troll()), false);
  assert("one with the Undead trait", ctx.isAlreadyUndead(troll({ traits: ["Large", "Undead"] })), true);
  const sent = [];
  const written = [];
  ctx.api.sendMessage = (text) => sent.push(text);
  ctx.api.setValuesOnTokenById = (id, type, values) => written.push(values);
  ctx.api.getSelectedTokens = () => [{ token: troll({ traits: ["Large", "Giant", "Skeleton", "Undead"], hitpoints: 115, curhp: 115 }) }];
  ctx.api.showPrompt = (title, label, placeholder, options, query, callback) => callback("skeleton");
  ctx.applySelectedCreatureTemplate();
  assert("a second template writes nothing (no second HP decrease)", written, []);
  assertIncludes("and says why", sent.join(" "), "already undead");
}

section("Reset undoes it");
{
  const original = troll();
  const templated = troll();
  Object.entries(ctx.getCreatureTemplateValues(templated, "ghost").values).forEach(([path, value]) => {
    const keys = path.split(".").slice(1);
    let node = templated.data;
    keys.slice(0, -1).forEach((key) => { node = node[key]; });
    node[keys[keys.length - 1]] = value;
  });
  const reset = ctx.getCreatureResetValues(templated, original);
  assert("traits back", reset["data.traits"], ["Large", "Giant"]);
  assert("languages back", reset["data.languages"], ["Common", "Jotun"]);
  assert("immunities and labels back", [reset["data.immunities"], reset["data.weaknessesLabel"]], [[], "fire 10"]);
  assert("abilities back", reset["data.actions"].map((a) => a.name), ["Rend"]);
  assert("attacks back", reset["data.attacks"][0].data.damageRolls[0].data.type, "piercing");
}

process.exitCode = summary() > 0 ? 1 : 0;
