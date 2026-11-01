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
  assert("one write: the summoner's level, maximum, current and temporary HP", writes[0], ["eid", { "data.hitpoints": 60, "data.curhp": 55, "data.tempHp": 4, "data.level": 5 }]);
  assert("then the summoner links back to it", [writes[1][0], JSON.parse(writes[1][1]["data.eidolon"])._id], ["sum", "eid"]);
  assert("the eidolon after", [synced.data.level, synced.data.curhp], [5, 55]);
  useStore(summoner(), eidolon({ level: 5, hitpoints: 60, curhp: 60 }));
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
  assert("the summoner's new maximum goes to its eidolon: 8 + (10 + 2) x 5", writes.filter(([id]) => id === "eid"), [["eid", { "data.hitpoints": 68 }]]);
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

section("Initiative");
{
  const scene = [
    { _id: "t-sum", recordId: "sum", data: { initiative: 14 } },
    { _id: "t-eid", recordId: "eid", data: { companionMaster: link("sum", "Ezren") } },
  ];
  assert("the eidolon goes just after its summoner (summons.js)", ctx.getMinionInitiativeValue(scene[1], scene, ["t-sum", "t-eid"]), 13.99);
}

process.exitCode = summary() > 0 ? 1 : 0;
