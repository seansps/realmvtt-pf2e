// Tests for cover (rollhandlers/cover.js), detected with api.getCover's
// center line: the map gives standard, greater or total cover; a creature on
// the line gives lesser cover (+1 AC), or standard (+2) when it's two sizes
// larger than both. Only the best applies. Strike and spell attack prompts
// get it as an unticked modifier, which doesn't stack with circumstance
// bonuses the target already has. A Cover effect on the target skips it, and
// the Cover Notice setting floats it over the target.
// Run: node tests/test-cover.js (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
new vm.Script(fs.readFileSync(`${__dirname}/../rollhandlers/spells.js`, "utf8"), { filename: "spells.js" }).runInContext(ctx);

const creature = (id, { size = "medium", conditions = [], recordType = "npcs", effects = [] } = {}) => {
  const all = [
    ...conditions.map((name, i) => ({ _id: `${id}-fx-${i}`, name: name[0].toUpperCase() + name.slice(1) })),
    ...effects.map((name, i) => ({ _id: `${id}-ef-${i}`, name })),
  ];
  return {
    _id: id,
    name: id,
    recordType,
    position: { x: 0, y: 0 },
    effects: all,
    effectIds: all.map((e) => e._id),
    record: { name: id, recordType },
    data: { ac: 18, level: 3, size, traits: [] },
  };
};
// What getCover returns: the map's degree and the creatures it lists
const measured = (degree, creatures = []) => ({
  degree,
  method: "center",
  creatures: creatures.map((c) => ({ tokenId: c._id, name: c.name, size: c.data.size, centerLine: true, blockedFraction: 0.5, ...(c.extra || {}) })),
});
let lastCall = null;
let floated = [];
let notice = null;
ctx.api.getSetting = (key) => (key === "coverNotice" ? notice : null);
ctx.api.floatText = (token, text, color) => floated.push(`${token.name}: ${text} ${color}`);
const cover = (result, target, attacker, others = []) => {
  ctx.api.getCover = (a, t, options) => {
    lastCall = options;
    return result;
  };
  floated = [];
  return ctx.getCoverModifiers(target, attacker, others, { attackRange: "ranged" });
};
const archer = creature("Archer");
const orc = creature("Orc");
const goblin = creature("Goblin");

section("Cover from the map");
{
  assert("standard: +2", cover(measured("standard"), orc, archer), [
    { name: "Target AC +2 (Standard Cover)", type: "", value: -2, active: false, isPenalty: true },
  ]);
  assert("measured along the center line", lastCall, { method: "center" });
  assert("greater: +4", cover(measured("greater"), orc, archer)[0].name, "Target AC +4 (Greater Cover)");
  assert("none: nothing", cover(measured("none"), orc, archer), []);
  assert("total: no modifier", cover(measured("full"), orc, archer), []);
  assert("total: floated in red", floated, ["Orc: Total Cover #e03131"]);
  assert("can't be measured (null): nothing", cover(null, orc, archer), []);
  assert("can't be measured: nothing floated", floated, []);
}

section("Creatures in the way");
{
  assert("a creature on the line: lesser", cover(measured("none", [goblin]), orc, archer, [goblin])[0].name, "Target AC +1 (Lesser Cover: Goblin in the way)");
  assert("listed by getCover but off the center line: none", cover(measured("none", [{ ...goblin, extra: { centerLine: false } }]), orc, archer, [goblin]), []);
  assert("a dead creature: none", cover(measured("none", [goblin]), orc, archer, [creature("Goblin", { conditions: ["dead"] })]), []);
  assert("a hazard: none", cover(measured("none", [goblin]), orc, archer, [creature("Goblin", { recordType: "hazards" })]), []);
  assert("hidden from the players: none", cover(measured("none", [goblin]), orc, archer, [{ ...goblin, visible: false }]), []);
  assert("a token not in the list still counts", cover(measured("none", [goblin]), orc, archer, [])[0].value, -1);
  const wolf = creature("Wolf");
  assert("several: named once each", cover(measured("none", [goblin, wolf, goblin]), orc, archer, [goblin, wolf])[0].name, "Target AC +1 (Lesser Cover: Goblin, Wolf in the way)");
}

section("Large creatures: standard cover");
{
  const giant = creature("Giant", { size: "huge" });
  assert("two sizes larger than both: standard", cover(measured("none", [giant]), orc, archer, [giant])[0].name, "Target AC +2 (Standard Cover: Giant in the way)");
  assert("only one size larger than the target: lesser", cover(measured("none", [giant]), creature("Ogre", { size: "large" }), archer, [giant])[0].value, -1);
  const bear = creature("Bear", { size: "large" });
  assert("a large creature between mediums: lesser", cover(measured("none", [bear]), orc, archer, [bear])[0].value, -1);
  assert("size from getCover when the token isn't listed", cover(measured("none", [giant]), orc, archer, [])[0].value, -2);
  assert("standard names only the large ones", cover(measured("none", [goblin, giant]), orc, archer, [goblin, giant])[0].name, "Target AC +2 (Standard Cover: Giant in the way)");
}

section("Only the best applies");
{
  assert("a wall's standard beats a creature's lesser", cover(measured("standard", [goblin]), orc, archer, [goblin])[0].name, "Target AC +2 (Standard Cover)");
  assert("a wall's greater beats a giant", cover(measured("greater", [creature("Giant", { size: "huge" })]), orc, archer)[0].name, "Target AC +4 (Greater Cover)");
  assert("total stays total with creatures", cover(measured("full", [goblin]), orc, archer, [goblin]), []);
}

section("A Cover effect placed by hand");
{
  const covered = creature("Orc", { effects: ["Cover (Standard)"] });
  let called = false;
  ctx.api.getCover = () => {
    called = true;
    return measured("greater");
  };
  floated = [];
  assert("skipped", ctx.getCoverModifiers(covered, archer, [], {}), []);
  assert("getCover isn't called", called, false);
  assert("nothing floated", floated, []);
  assert("an effect that only mentions cover doesn't count", cover(measured("standard"), creature("Orc", { effects: ["Take Cover Bonus"] }), archer).length, 1);
}

section("Cover Notice setting");
{
  notice = null;
  cover(measured("standard"), orc, archer);
  assert("unset (Yes): floated", floated, ["Orc: Standard Cover #f59f00"]);
  notice = "yes";
  cover(measured("none", [goblin]), orc, archer, [goblin]);
  assert("Yes: floated", floated, ["Orc: Lesser Cover #f59f00"]);
  notice = "no";
  assert("No: still offered", cover(measured("standard"), orc, archer).length, 1);
  assert("No: nothing floated", floated, []);
  notice = null;
  cover(measured("none"), orc, archer);
  assert("no cover: nothing floated", floated, []);
}

section("Doesn't stack with the target's circumstance bonuses");
{
  const realShield = ctx.getRaisedShieldAcBonus;
  ctx.getRaisedShieldAcBonus = () => 2;
  assert("lesser behind a raised shield's +2: none", cover(measured("none", [goblin]), orc, archer, [goblin]), []);
  assert("standard behind it: none either", cover(measured("standard"), orc, archer), []);
  assert("still floated", floated, ["Orc: Standard Cover #f59f00"]);
  assert("greater over it: the difference", cover(measured("greater"), orc, archer)[0].name, "Target AC +2 (Greater Cover)");
  ctx.getRaisedShieldAcBonus = () => 1;
  assert("standard over a +1: the difference", cover(measured("standard"), orc, archer)[0].value, -1);
  ctx.getRaisedShieldAcBonus = realShield;
}

section("In the roll prompts");
{
  const shooter = {
    _id: "pc",
    recordType: "characters",
    name: "Kyra",
    effects: [],
    effectIds: [],
    fields: {},
    data: {
      level: 5, str: 1, dex: 4, size: "medium", ancestries: [{ name: "Human", data: { speed: "25 feet", hp: 8 } }],
      classes: [{ name: "Fighter", data: { hp: 10, features: [] } }], feats: [], bonusFeats: [],
      inventory: [{ _id: "w-javelin", name: "Javelin", recordType: "items", data: { type: "weapon", carried: "equipped", itemCategory: "simple", group: "dart", traits: ["Thrown-30"], usage: "held-in-one-hand", range: 30, ammo: 3, damage: { dice: 1, die: "d6", damageType: "piercing" }, runes: { potency: 0, striking: 0, property: [] } } }],
    },
  };
  const token = { _id: "tok", recordType: "characters", recordId: "pc", name: "Kyra", record: shooter, data: shooter.data, effects: [], effectIds: [], position: { x: 0, y: 0 } };
  const prompted = (run) => {
    const saved = { ...ctx.api };
    let captured = null;
    ctx.api.getTargets = () => [{ token: orc, distance: 20 }];
    ctx.api.getToken = () => token;
    ctx.api.getOtherTokens = () => [token, orc, goblin];
    ctx.api.getRecord = (type, id, cb) => cb(shooter);
    ctx.api.getCover = () => measured("none", [goblin]);
    ctx.api.promptRoll = (name, dice, modifiers) => {
      captured = modifiers;
    };
    try {
      run();
    } finally {
      Object.assign(ctx.api, saved);
    }
    return (captured || []).filter((m) => m.name.includes("Cover")).map((m) => `${m.name} ${m.value} ${m.active}`);
  };
  assert(
    "a Strike: offered unticked",
    prompted(() => ctx.performAttackRoll(shooter, shooter.data.inventory[0], "data.inventory.0", 1)),
    ["Target AC +1 (Lesser Cover: Goblin in the way) -1 false"],
  );

  const ray = { name: "Ray", data: { defense: { passive: { statistic: "ac" } }, traits: [], damage: [] } };
  const entry = { data: { dc: 20, attribute: "cha", attack: 10 } };
  const castRay = () => {
    const macro = ctx.getSpellAttackMacro(shooter, ray, entry, "data.spells.0", null);
    const body = String(macro).replace(/^```Roll_Attack\n/, "").replace(/```\s*$/, "");
    const getValue = ctx.api.getValueOnRecord;
    ctx.api.getValueOnRecord = (r, path) => (path === "data.spells.0" ? ray : getValue(r, path));
    new vm.Script(body, { filename: "spell-attack-macro.js" }).runInContext(ctx);
  };
  assert("a spell attack: offered unticked", prompted(castRay), ["Target AC +1 (Lesser Cover: Goblin in the way) -1 false"]);

  // Two targets: each prompt gets only its own target's modifiers
  {
    const troll = creature("Troll");
    const saved = { ...ctx.api };
    const realShieldBlock = ctx.canShieldBlock;
    const calls = [];
    ctx.api.getTargets = () => [
      { token: orc, distance: 20 },
      { token: troll, distance: 50 },
    ];
    ctx.api.getToken = () => token;
    ctx.api.getOtherTokens = () => [token, orc, troll, goblin];
    ctx.api.getRecord = (type, id, cb) => cb(shooter);
    ctx.api.getCover = (a, t) => (t._id === "Orc" ? measured("none", [goblin]) : measured("none"));
    ctx.canShieldBlock = (t) => t?._id === "Orc";
    ctx.api.promptRoll = (name, dice, modifiers, metadata) => calls.push({ modifiers, metadata });
    try {
      ctx.performAttackRoll(shooter, shooter.data.inventory[0], "data.inventory.0", 1);
    } finally {
      Object.assign(ctx.api, saved);
      ctx.canShieldBlock = realShieldBlock;
    }
    const names = (call) => call.modifiers.filter((m) => /Cover|Range/.test(m.name)).map((m) => `${m.name} ${m.value}`);
    assert("two targets: two prompts", calls.length, 2);
    assert("the first: its cover, no range penalty", names(calls[0]), ["Target AC +1 (Lesser Cover: Goblin in the way) -1"]);
    assert("the second: its range penalty, not the first's cover", names(calls[1]), ["Range Increment (2) -2"]);
    assert("the first can Shield Block", calls[0].metadata.showShieldDamage, true);
    assert("the second can't: the first's shield doesn't carry", calls[1].metadata.showShieldDamage, false);
  }
}

process.exitCode = summary() > 0 ? 1 : 0;
