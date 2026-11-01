// Tests for eidolons (eidolons.js): the summoner link, level and the shared
// Hit Point pool.
// Run: node tests/test-eidolons.js   (or via tests/run-all.js)

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const RECORDS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "modules", "eidolons", "records.json"), "utf8"));

function runHook(file, vars) {
  Object.assign(ctx, vars);
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
}

const link = (id, name) => JSON.stringify({ _id: id, name, recordType: "characters" });
const summoner = (data = {}) => ({
  _id: "sum",
  name: "Ezren",
  recordType: "characters",
  data: { level: 5, hitpoints: 60, curhp: 60, tempHp: 0, classes: [{ name: "Summoner", data: {} }], eidolon: link("eid", "Lumen"), ...data },
});
const eidolon = (data = {}) => ({
  _id: "eid",
  name: "Lumen",
  recordType: "characters",
  data: { level: 1, hitpoints: 3, curhp: 3, tempHp: 0, classes: [RECORDS.class[0]], ancestries: [RECORDS.ancestry[1]], companionMaster: link("sum", "Ezren"), ...data },
});

// Records by id, and the writes made to them
let store = {};
let writes = [];
function useStore(...records) {
  store = Object.fromEntries(records.map((r) => [r._id, r]));
  writes = [];
  ctx.api.getRecord = (type, id, cb) => cb(store[id] || null);
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    writes.push([record._id, values]);
    if (cb) cb({ ...record, data: { ...record.data, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k.slice(5), v])) } });
  };
}

section("Eidolons and their types");
{
  assert("the Eidolon class makes an eidolon", [ctx.isEidolonCharacter(eidolon()), ctx.isEidolonCharacter(summoner())], [true, false]);
  assert("... read from a token's record too", ctx.isEidolonCharacter({ record: eidolon() }), true);
  assert("an eidolon type asks for no heritage", [ctx.isEidolonAncestry(RECORDS.ancestry[0]), ctx.isEidolonAncestry({ data: {} })], [true, false]);
  assert("partners: the eidolon's summoner, the summoner's eidolon", [ctx.getSharedHitPointPartnerId(eidolon()), ctx.getSharedHitPointPartnerId(summoner())], ["sum", "eid"]);
  assert("a character with no eidolon has none", ctx.getSharedHitPointPartnerId({ data: { classes: [] } }), null);
}

section("One pool of Hit Points (Impossible Magic pg. 63)");
{
  useStore(summoner(), eidolon({ hitpoints: 60, curhp: 60 }));
  ctx.shareHitPoints(store.eid, { "data.curhp": 48, "data.tempHp": 0, "data.dying": 0 });
  assert("damage to the eidolon: the summoner's HP too (only HP, not dying)", writes, [["sum", { "data.curhp": 48 }]]);
  writes = [];
  ctx.shareHitPoints(store.sum, { "data.curhp": 52, "data.tempHp": 5 });
  assert("damage or temporary HP on the summoner: the eidolon's too", writes, [["eid", { "data.curhp": 52, "data.tempHp": 5 }]]);
  useStore(summoner({ curhp: 40 }), eidolon({ hitpoints: 60, curhp: 40 }));
  ctx.shareHitPoints(store.eid, { "data.curhp": 40 });
  assert("already the same: nothing written", writes, []);
  ctx.shareHitPoints({ _id: "x", data: { classes: [] } }, { "data.curhp": 1 });
  assert("anyone else: nothing", writes, []);
}

section("The summoner link and level");
{
  useStore(summoner({ eidolon: undefined, curhp: 55, tempHp: 4 }), eidolon());
  let synced = null;
  ctx.onAddEditFeature = () => {};
  ctx.syncEidolonWithSummoner(store.eid, "sum", (updated) => (synced = updated));
  assert("one write: the summoner's level, maximum, current and temporary HP, and ranks", writes[0], ["eid", { "data.hitpoints": 60, "data.curhp": 55, "data.tempHp": 4, "data.level": 5, "data.summonerRanks": ctx.getSummonerRanks(store.sum) }]);
  assert("then the summoner links back to it", [writes[1][0], JSON.parse(writes[1][1]["data.eidolon"])._id], ["sum", "eid"]);
  assert("the eidolon after", [synced.data.level, synced.data.curhp], [5, 55]);
  useStore(summoner(), eidolon({ level: 5, hitpoints: 60, curhp: 60, summonerRanks: ctx.getSummonerRanks(summoner()) }));
  ctx.syncEidolonWithSummoner(store.eid, "sum");
  assert("in step and linked: nothing written", writes, []);
}

section("Maximum HP");
{
  useStore(summoner(), eidolon({ hitpoints: 60, curhp: 60, level: 5 }));
  const linked = { ...store.eid, data: { ...store.eid.data, ancestries: [{ data: { hp: 0 } }] } };
  let set = null;
  ctx.api.setValues = (values) => (set = values);
  ctx.updateAttribute({ record: linked, attribute: "con", value: 3 });
  assert("a linked eidolon keeps its summoner's maximum", set?.["data.hitpoints"], undefined);
  writes = [];
  const sum = { ...store.sum, data: { ...store.sum.data, ancestries: [{ data: { hp: 8 } }], classes: [{ name: "Summoner", data: { hp: 10 } }] } };
  ctx.updateAttribute({ record: sum, attribute: "con", value: 2 });
  assert("the summoner's new maximum goes to its eidolon: 8 + (10 + 2) x 5", writes.filter(([id, values]) => id === "eid" && values["data.hitpoints"]), [["eid", { "data.hitpoints": 68 }]]);
}

section("The tracker's damage and healing");
{
  useStore(summoner(), eidolon({ hitpoints: 60, curhp: 60, level: 5 }));
  ctx.api.getToken = () => null;
  runHook("damageScript.js", { record: store.eid, value: 7 });
  assert("damage on the eidolon: both at 53", writes.map(([id, v]) => [id, v["data.curhp"]]), [["eid", 53], ["sum", 53]]);
  useStore(summoner({ curhp: 30 }), eidolon({ hitpoints: 60, curhp: 30, level: 5 }));
  runHook("healingScript.js", { record: store.sum, value: 10 });
  assert("healing the summoner: both at 40", writes.map(([id, v]) => [id, v["data.curhp"]]), [["sum", 40], ["eid", 40]]);
}

section("Temporary Hit Points");
{
  useStore(summoner(), eidolon({ hitpoints: 60, curhp: 60, level: 5 }));
  ctx.api.getSelectedOrDroppedToken = () => [store.sum];
  ctx.api.setValuesOnTokenById = () => {};
  ctx.applyActionTemporaryHitPoints(6, "Rage");
  assert("temporary HP from an action on the summoner: the eidolon's too", writes, [["eid", { "data.tempHp": 6 }]]);
}

section("Gear from the summoner (Impossible Magic pg. 70)");
{
  const item = (name, data) => ({ _id: name, name, data: { carried: "equipped", invested: "true", ...data } });
  const armored = summoner({ inventory: [item("+2 Resilient Chain Shirt", { type: "armor", runes: { potency: "2", resilient: "1" } }), item("Handwraps of Mighty Blows", { type: "weapon", runes: { potency: "1", striking: "1" } })] });
  const gear = ctx.getSummonerGear(armored);
  assert("armor potency, resilient rune, and the handwraps", [gear.armorPotency, gear.resilient, gear.handwraps?.data?.runes?.striking], [2, 1, "1"]);
  assert("greater bands of force: +2 to both", [ctx.getSummonerGear(summoner({ inventory: [item("Greater Bands of Force", { type: "equipment" })] }))].map((g) => [g.armorPotency, g.resilient])[0], [2, 2]);
  assert("gear that isn't worn and invested: nothing", ctx.getSummonerGear(summoner({ inventory: [item("+1 Leather", { type: "armor", invested: "false", runes: { potency: "1" } })] })).armorPotency, 0);
  const saved = ctx.api.getSetting;
  ctx.api.getSetting = (key) => (key === "automaticBonusProgression" ? "yes" : null);
  assert("Automatic Bonus Progression: runes give nothing", ctx.getSummonerGear(armored).armorPotency, 0);
  ctx.api.getSetting = saved;
  const mods = ctx.getEidolonGearModifiers(eidolon({ summonerGear: gear }));
  assert("the eidolon: AC and saves", mods.map((m) => [m.modifierType, m.value]), [["armorClassBonus", 2], ["saveBonus", 1]]);
  assert("its handwraps are the summoner's", ctx.getWornHandwraps(eidolon({ summonerGear: gear }))?.name, "Handwraps of Mighty Blows");
  useStore(armored, eidolon({ level: 5, hitpoints: 60, curhp: 60 }));
  ctx.shareSummonerGear(store.sum);
  assert("the summoner's gear goes to its eidolon", writes.map(([id, v]) => [id, v["data.summonerGear"]?.armorPotency]), [["eid", 2]]);
}

// An eidolon's and its summoner's tokens on the scene, and applyDamage's
// writes and cards
function damageScene({ eidHp = 60, sumHp = 60, sumData = {} } = {}) {
  const eidToken = { _id: "t-eid", recordId: "eid", recordType: "characters", name: "Lumen", identified: true, effects: [], effectIds: [], data: { ...eidolon().data, curhp: eidHp, hitpoints: 60, tempHp: 0, level: 5 } };
  const sumToken = { _id: "t-sum", recordId: "sum", recordType: "characters", name: "Ezren", identified: true, effects: [], effectIds: [], data: { ...summoner().data, curhp: sumHp, hitpoints: 60, tempHp: 0, ...sumData } };
  useStore(summoner({ curhp: sumHp }), eidolon({ curhp: eidHp, hitpoints: 60, level: 5 }));
  const tokenWrites = [];
  const effects = [];
  ctx.api.setValuesOnTokenById = (id, type, values, cb) => {
    tokenWrites.push([id, values]);
    if (cb) cb();
  };
  ctx.api.addEffects = (names, target) => effects.push([target._id, ...names]);
  ctx.api.addEffect = (name, target) => effects.push([target._id, name]);
  ctx.api.getOtherTokens = () => [eidToken, sumToken];
  ctx.api.getToken = () => null;
  ctx.api.getCombatTracker = () => {};
  ctx.__state.messages = [];
  return { eidToken, sumToken, tokenWrites, effects };
}
const fire = (total, metadata = {}) => ({ total, types: [{ type: "fire", value: total }], metadata: { damageType: "fire", ...metadata } });
const hpOf = (tokenWrites, id) => tokenWrites.filter(([wid, v]) => wid === id && v["data.curhp"] !== undefined).map(([, v]) => v["data.curhp"]);

section("One effect on both applies once, the greater (pg. 63)");
{
  const { eidToken, sumToken, tokenWrites } = damageScene();
  ctx.api.getSelectedOrDroppedToken = () => [eidToken, sumToken];
  ctx.applyDamage(null, fire(10));
  assert("a fireball on both: the pool loses 10 once, not 20", [hpOf(tokenWrites, "t-eid"), hpOf(tokenWrites, "t-sum")], [[50], [50]]);
  assert("the second card says so", ctx.__state.messages[1].includes("Shares Hit Points with Lumen: one effect on both applies once, the greater (10)."), true);

  const second = damageScene();
  const pool = { sharedPools: {}, poolCreatures: [second.eidToken, second.sumToken] };
  ctx.applyDamage(second.eidToken, fire(10), true, null, false, pool);
  ctx.applyDamage(second.sumToken, fire(10), false, null, false, pool);
  assert("Apply by Saves: half (5) then full (10) takes 10 in all", [hpOf(second.tokenWrites, "t-eid"), hpOf(second.tokenWrites, "t-sum")], [[55], [50]]);
  const third = damageScene();
  const pool3 = { sharedPools: {}, poolCreatures: [third.eidToken, third.sumToken] };
  ctx.applyDamage(third.sumToken, fire(10), false, null, false, pool3);
  ctx.applyDamage(third.eidToken, fire(10), true, null, false, pool3);
  assert("... full then half: the half adds nothing", [hpOf(third.tokenWrites, "t-sum"), hpOf(third.tokenWrites, "t-eid")], [[50], [50]]);
  assert("the pool's arithmetic: damage and healing", [ctx.getSharedPoolDamage(8, 12), ctx.getSharedPoolDamage(12, 8), ctx.getSharedPoolDamage(-5, -3), ctx.getSharedPoolDamage(-3, -5)], [0, 4, -2, 0]);
}

section("0 Hit Points (Manifest Eidolon, pg. 64)");
{
  const { eidToken, tokenWrites, effects } = damageScene({ eidHp: 5, sumHp: 5 });
  ctx.applyDamage(eidToken, fire(10));
  const eidWrite = tokenWrites.find(([id]) => id === "t-eid")[1];
  const sumWrite = tokenWrites.find(([id]) => id === "t-sum")?.[1];
  assert("the eidolon: 0 HP, no dying of its own", [eidWrite["data.curhp"], eidWrite["data.dying"]], [0, undefined]);
  assert("the summoner gains dying 1", sumWrite?.["data.dying"], 1);
  assert("... and the conditions, on the summoner", effects, [["t-sum", "Unconscious", "Prone"]]);
  assert("the card: the eidolon unmanifests", ctx.__state.messages[0].includes("Lumen unmanifests: its summoner drops to 0 HP."), true);
  assert("the Undo restores the summoner's HP and dying too", [ctx.__state.messages[0].includes('restoreSharedHitPoints("sum", {"data.curhp":5,"data.tempHp":0})'), ctx.__state.messages[0].includes('api.setValuesOnTokenById("t-sum", "characters", {"data.dying":0})')], [true, true]);

  const crit = damageScene({ eidHp: 5, sumHp: 5 });
  ctx.applyDamage(crit.eidToken, fire(10, { critical: true }));
  assert("a critical hit: dying 2", crit.tokenWrites.find(([id]) => id === "t-sum")?.[1]["data.dying"], 2);

  const summonerDown = damageScene({ eidHp: 5, sumHp: 5 });
  ctx.applyDamage(summonerDown.sumToken, fire(10));
  assert("the summoner at 0: it gains dying, and its eidolon unmanifests", [summonerDown.tokenWrites.find(([id]) => id === "t-sum")[1]["data.dying"], ctx.__state.messages[0].includes("Lumen unmanifests.")], [1, true]);

  damageScene({ eidHp: 5, sumHp: 5 });
  ctx.api.getOtherTokens = () => [];
  const offScene = ctx.applyEidolonZeroHitPoints({ ...eidolon(), _id: "t-eid" });
  assert("its summoner not on the scene: a note to set dying by hand", offScene.lines[0].includes("give them dying on their sheet"), true);
}

section("Initiative");
{
  const scene = [
    { _id: "t-sum", recordId: "sum", data: { initiative: 14 } },
    { _id: "t-eid", recordId: "eid", data: { companionMaster: link("sum", "Ezren") } },
  ];
  assert("the eidolon goes just after its summoner (summons.js)", ctx.getMinionInitiativeValue(scene[1], scene, ["t-sum", "t-eid"]), 13.99);
}

process.exitCode = summary() > 0 ? 1 : 0;
