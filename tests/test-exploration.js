// Tests for exploration activities (exploration.js).
// Run: node tests/test-exploration.js   (or via tests/run-all.js)

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

const pc = (name, activity, data = {}) => ({ _id: `t-${name}`, recordType: "characters", recordId: name, name, faction: "friend", effects: [], effectIds: [], data: { explorationActivity: activity, ...data } });
const foe = (name, perceptionMod) => ({ _id: `t-${name}`, recordType: "npcs", name, faction: "enemy", effects: [], effectIds: [], data: { perceptionMod, level: 1 } });
const shield = { name: "Steel Shield", data: { type: "shield", carried: "equipped", acBonus: 2 } };

section("Picking an activity (one write)");
{
  // The record is already saved with the new activity when onchange runs
  assert("Avoid Notice: Stealth for initiative", ctx.getExplorationActivityValues({ data: { explorationActivity: "Avoid Notice", initiativeSkill: "Perception" } }, "Avoid Notice"), { "data.initiativeSkill": "Stealth" });
  assert("... already Stealth: no write", ctx.getExplorationActivityValues({ data: { explorationActivity: "Avoid Notice", initiativeSkill: "Stealth" } }, "Avoid Notice"), {});
  assert("another choice: a Stealth initiative goes back to Perception", ctx.getExplorationActivityValues({ data: { explorationActivity: "Scout", initiativeSkill: "Stealth" } }, "Scout"), { "data.initiativeSkill": "Perception" });
  assert("... another skill stays", ctx.getExplorationActivityValues({ data: { explorationActivity: "None", initiativeSkill: "Athletics" } }, ""), {});
  assert("None is no activity", ctx.getExplorationActivity({ data: { explorationActivity: "None" } }), "");
  assert("Hustle: Constitution x 10 minutes, minimum 10", [ctx.getExplorationActivityNote({ data: { con: 3 } }, "Hustle").includes("30 minutes"), ctx.getExplorationActivityNote({ data: { con: 0 } }, "Hustle").includes("10 minutes")], [true, true]);
  assert("Hustle: travel speed, the group's lowest Constitution", [ctx.getExplorationActivityNote({}, "Hustle").includes("double their travel speed"), ctx.getExplorationActivityNote({}, "Hustle").includes("lowest Constitution")], [true, true]);
  assert("Follow the Expert: its bonuses", ctx.getExplorationActivityNote({}, "Follow the Expert").includes("+2 circumstance"), true);

  const writes = [];
  ctx.api.setValues = (values) => writes.push(values);
  ctx.api.getToken = () => null;
  const pick = (data, value) => {
    writes.length = 0;
    ctx.__state.messages.length = 0;
    ctx.setExplorationActivity({ name: "Amiri", data }, value);
    return [writes, ctx.__state.messages.join("")];
  };
  const [defendWrites, defendCard] = pick({ explorationActivity: "Defend" }, "Defend");
  assert("Defend: no write, a card", [defendWrites.length, defendCard.includes("Amiri: Defend")], [0, true]);
  assert("leaving Avoid Notice: Perception, no card for Search", pick({ explorationActivity: "Search", initiativeSkill: "Stealth" }, "Search"), [[{ "data.initiativeSkill": "Perception" }], ""]);
  assert("None: no write, no card", pick({ explorationActivity: "None" }, "None"), [[], ""]);
}

section("Scout: +1 circumstance to initiative for its side");
{
  const scout = pc("Kyra", "Scout");
  const amiri = pc("Amiri", "Defend");
  const goblin = foe("Goblin", 5);
  assert("an ally of the scout", ctx.getScoutInitiativeModifiers(amiri, [scout, goblin]), [{ name: "Scout (Kyra)", type: "circumstance", value: 1, active: true }]);
  assert("the scout too", ctx.getScoutInitiativeModifiers(scout, [goblin]).length, 1);
  assert("not the other side", ctx.getScoutInitiativeModifiers(goblin, [scout, amiri]), []);
  assert("no scout: nothing", ctx.getScoutInitiativeModifiers(amiri, [goblin]), []);
}

section("The encounter's start");
{
  const goblin = foe("Goblin", 5); // DC 15
  const boss = foe("Boss", 12); // DC 22
  const dragon = foe("Dragon", 20); // DC 30
  const sneak = pc("Ezren", "Avoid Notice", { initiative: 18, initiativeStatistic: "stealth" });
  const card = ctx.getExplorationStartCard([sneak, goblin, boss, dragon]);
  assert("Avoid Notice: undetected, hidden (missed by 1-9), observed (by 10+)", [card.includes("undetected by Goblin (DC 15)"), card.includes("hidden from Boss (DC 22)"), card.includes("observed by Dragon (DC 30)"), card.includes("[gm]Stealth 18")], [true, true, true, true]);
  assert("... each only with cover or concealment", card.includes("without it, observed"), true);
  const states = (initiative, foes) => ctx.getAvoidNoticeResults(pc("A", "Avoid Notice", { initiative }), foes).map((r) => r.state);
  assert("the Sneak boundaries: meet, miss by 9, miss by 10", [states(15, [goblin]), states(6, [goblin]), states(5, [goblin])], [["undetected"], ["hidden"], ["observed"]]);
  const perception = ctx.getExplorationStartCard([pc("Ezren", "Avoid Notice", { initiative: 18, initiativeStatistic: "perception" }), goblin]);
  assert("didn't roll Stealth: said so", perception.includes("didn't roll Stealth"), true);
  assert("no activities: no card", ctx.getExplorationStartCard([pc("A", ""), pc("B", "None"), goblin]), "");

  const recordWrites = [];
  ctx.api.getRecord = (type, id, cb) => cb({ _id: id, recordType: type, data: {} });
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    recordWrites.push([record._id, values]);
    if (cb) cb(record);
  };
  const recalcs = [];
  ctx.onAddEditFeature = (record) => recalcs.push(record._id);
  const defender = pc("Valeros", "Defend", { inventory: [shield] });
  const unarmed = pc("Seoni", "Defend", { inventory: [] });
  const broken = pc("Kyra", "Defend", { inventory: [shield], shieldBroken: true });
  runHook("onEncounterStart.js", { tokens: [defender, unarmed, broken, sneak, goblin, boss] });
  const posted = ctx.__state.messages.join("\n");
  assert("Defend: the equipped shield raised and the AC recalculated", [recordWrites, recalcs], [[["Valeros", { "data.shieldRaised": "true" }]], ["Valeros"]]);
  assert("... none to raise, or broken: noted", [posted.includes("Valeros:** Defend (shield raised)"), posted.includes("Seoni:** Defend (no shield to raise)"), posted.includes("Kyra:** Defend (no shield to raise)")], [true, true, true]);
}

process.exitCode = summary() > 0 ? 1 : 0;
