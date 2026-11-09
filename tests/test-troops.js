// Tests for troops (troops.js, roadmap B15): segments and thresholds, rout
// checks, removing a segment and a leader's actions (NPC Core pg. 7,
// Battlecry! pg. 159-161).

const fs = require("fs");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const troop = (extra = {}) => ({
  _id: "troop-1",
  name: "Hobgoblin Battalion",
  recordType: "npcs",
  data: {
    type: "npc",
    level: 5,
    traits: ["Gargantuan", "Troop"],
    hitpoints: 90,
    curhp: 90,
    hpDetails: "Thresholds 60 (3 segments), 30 (2 segments)",
    ...extra,
  },
});

section("Thresholds");
{
  assert("from the HP entry, highest first", JSON.parse(JSON.stringify(ctx.getTroopThresholds(troop()))), [{ hp: 60, segments: 3 }, { hp: 30, segments: 2 }]);
  const fromAbility = troop({ hpDetails: "void healing", actions: [{ name: "Troop Defenses", data: { description: "<p><strong>Thresholds</strong> 40 (3 segments), 20 (2 segments)</p><p>leaving three segments (12 squares)</p>" } }] });
  assert("or from troop defenses", ctx.getTroopThresholds(fromAbility).map((t) => t.hp), [40, 20]);
  assert("none printed", ctx.getTroopThresholds(troop({ hpDetails: "" })).length, 0);
  assert("a troop", ctx.isTroop(troop()), true);
  assert("not a troop", ctx.isTroop({ data: { traits: ["Humanoid"] } }), false);
}

section("Losing segments");
{
  const loss = (hp, extra) => ctx.getTroopSegmentLoss(troop(extra), hp);
  assert("above the threshold", loss(61), null);
  assert("exactly on it: not below it", loss(60), null);
  assert("below it", JSON.parse(JSON.stringify(loss(59))), { lost: 1, segments: 3, max: 60 });
  assert("past both at once", JSON.parse(JSON.stringify(loss(25))), { lost: 2, segments: 2, max: 30 });
  assert("the first is already gone", JSON.parse(JSON.stringify(loss(25, { hitpoints: 60, curhp: 50 }))), { lost: 1, segments: 2, max: 30 });
  assert("nothing left to lose", loss(10, { hitpoints: 30, curhp: 20 }), null);
  assert("at 0 it disperses instead", loss(0), null);
  assert("not a troop", ctx.getTroopSegmentLoss({ data: { traits: [], hitpoints: 90 } }, 10), null);
  assert("no thresholds printed", loss(10, { hpDetails: "" }), null);

  assertIncludes("one segment", ctx.getTroopDamageLine(troop(), 59, loss(59)), "loses a segment: 3 left.");
  assertIncludes("two", ctx.getTroopDamageLine(troop(), 25, loss(25)), "loses 2 segments: 2 left.");
  assert("no HP numbers shown", ctx.getTroopDamageLine(troop(), 59, loss(59)).includes("60"), false);
  assert("no backticks (the Undo button repeats the message)", ctx.getTroopDamageLine(troop(), 59, loss(59)).includes("`"), false);
  assertIncludes("0 HP", ctx.getTroopDamageLine(troop(), 0, null), "disperses");
  assert("nothing crossed", ctx.getTroopDamageLine(troop(), 70, null), null);
  assert("not a troop: no line", ctx.getTroopDamageLine({ data: { traits: [] } }, 0, null), null);
}

section("Rout checks");
{
  assert("a routable troop has the button", ctx.getTroopRoutButtons(troop())[0].includes("promptTroopRout(token)"), true);
  assert("mindless", ctx.getTroopRoutButtons(troop({ traits: ["Troop", "Mindless"] })).length, 0);
  assert("immune to mental", ctx.isTroopUnroutable(troop({ immunities: [{ data: { type: "mental" } }] })), true);
  assert("immune to fire isn't", ctx.isTroopUnroutable(troop({ immunities: [{ data: { type: "fire" } }] })), false);

  const rout = (led) => ({ troopRout: { tokenId: "troop-1", name: "Battalion", led } });
  assertIncludes("critical success", ctx.getTroopRoutLines(rout(false), 2)[0], "unaffected");
  assertIncludes("success", ctx.getTroopRoutLines(rout(false), 1)[0], "frightened 1");
  assertIncludes("... its button", ctx.getTroopRoutLines(rout(false), 1)[1], 'api.addEffects(["Frightened"], token)');
  assertIncludes("failure", ctx.getTroopRoutLines(rout(false), 0)[0], "frightened 2");
  assertIncludes("... two stacks", ctx.getTroopRoutLines(rout(false), 0)[1], '["Frightened","Frightened"]');
  assertIncludes("critical failure", ctx.getTroopRoutLines(rout(false), -1)[0], "removed from the battle");

  assertIncludes("led: a critical failure is a failure", ctx.getTroopRoutLines(rout(true), -1)[0], "frightened 2");
  assertIncludes("led: a failure is a success", ctx.getTroopRoutLines(rout(true), 0)[0], "frightened 1");
  assertIncludes("led: says why", ctx.getTroopRoutLines(rout(true), 0)[0], "for its leader");
  assertIncludes("led: a success is a critical success", ctx.getTroopRoutLines(rout(true), 1)[0], "unaffected");
  assert("led: a critical success has nowhere to go", ctx.getTroopRoutLines(rout(true), 2)[0].includes("for its leader"), false);
  assert("not a rout check", ctx.getTroopRoutLines({}, 1).length, 0);
  assert("no DC", ctx.getTroopRoutLines(rout(false), null).length, 0);
}

section("The panel's actions");
{
  let notice = null;
  let selected = [];
  let prompts = [];
  const prompted = [];
  const writes = [];
  const messages = [];
  const saves = [];
  ctx.api.showNotification = (message) => { notice = message; };
  ctx.api.getSelectedTokens = () => selected;
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push({ id, type, values });
  ctx.api.sendMessage = (message) => messages.push(message);
  ctx.api.showPrompt = (title, prompt, placeholder, options, value, callback) => {
    prompted.push({ prompt, options });
    callback(prompts.shift());
  };
  ctx.api.promptRoll = () => {};
  const realRollSave = ctx.rollSave;
  ctx.rollSave = (...args) => saves.push(args);
  const reset = () => { notice = null; prompted.length = 0; writes.length = 0; messages.length = 0; saves.length = 0; };

  ctx.removeSelectedTroopSegments();
  assertIncludes("nothing selected", notice, "Select a troop's token");

  reset();
  selected = [{ token: troop({ curhp: 75 }) }];
  ctx.removeSelectedTroopSegments();
  assert("to the next threshold", JSON.parse(JSON.stringify(writes[0].values)), { "data.hitpoints": 60, "data.curhp": 60 });
  assertIncludes("its card", messages[0], "loses a segment: 3 left.");
  assertIncludes("with a rout button", messages[0], "Rout_Check");

  reset();
  selected = [{ token: troop({ hitpoints: 60, curhp: 40 }) }];
  ctx.removeSelectedTroopSegments();
  assert("already below it keeps its HP", JSON.parse(JSON.stringify(writes[0].values)), { "data.hitpoints": 30, "data.curhp": 30 });

  reset();
  selected = [{ token: troop({ hitpoints: 30, curhp: 20 }) }];
  ctx.removeSelectedTroopSegments();
  assertIncludes("no threshold left", notice, "no threshold left");
  assert("nothing written", writes.length, 0);

  reset();
  selected = [{ token: troop() }];
  prompts = ["7", "yes"];
  ctx.rollSelectedTroopRouts();
  assert("levels -1 to 25", [prompted[0].options.length, prompted[0].options[26].value], [27, "25"]);
  const save = saves[0];
  assert("a Will save", save[1], "will");
  assert("at the enemy's level", save[2], 23);
  assert("its traits", Array.from(save[5].traits), ["emotion", "fear", "mental"]);
  assert("led", save[5].troopRout.led, true);

  reset();
  prompts = ["7", "no"];
  ctx.rollSelectedTroopRouts();
  assert("not led", saves[0][5].troopRout.led, false);

  reset();
  prompts = [null];
  ctx.rollSelectedTroopRouts();
  assert("no level, no roll", saves.length, 0);

  reset();
  prompts = ["7", null];
  ctx.rollSelectedTroopRouts();
  assert("no answer, no roll", saves.length, 0);

  ctx.rollSave = realRollSave;

  reset();
  selected = [];
  ctx.postTroopLeaderActions();
  assertIncludes("no leader selected", notice, "Select the leader's token");

  reset();
  selected = [{ token: { _id: "pc", name: "Valeros", data: {} } }];
  prompts = ["2"];
  ctx.postTroopLeaderActions();
  assertIncludes("the split", messages[0], "2 actions for themself and 3 for the troop");
  assertIncludes("the reactions", messages[0], "Each regains 1 reaction");
}

section("Wiring");
{
  const read = (file) => fs.readFileSync(`${__dirname}/../${file}`, "utf8");
  const common = read("rollhandlers/common.js");
  assertIncludes("applyDamage finds the loss", common, "getTroopSegmentLoss(target, curhp)");
  assertIncludes("the maximum is undoable", common, 'oldValues["data.hitpoints"] = maxHp;');
  assertIncludes("the threshold is the new maximum", common, 'valuesToSet["data.hitpoints"] = troopLoss.max;');
  assertIncludes("the message", common, "getTroopDamageLine(target, curhp, troopLoss)");
  assertIncludes("the button goes after the message", common, "dyingButtons.push(...getTroopRoutButtons(target))");
  assertIncludes("rollSave carries it", common, "metadata.troopRout = options.troopRout");
  assertIncludes("save.js shows it", read("rollhandlers/save.js"), "getTroopRoutLines(data?.roll?.metadata, noteDegree)");
  const panel = read("gm-tools-panel.html");
  ["removeSelectedTroopSegments()", "rollSelectedTroopRouts()", "postTroopLeaderActions()"].forEach((call) => assertIncludes(call, panel, call));
  assertIncludes("the global script", read("ruleset.config.json"), "rollhandlers/troops.js");
  assert("nothing on the NPC main tab", read("npcs-main.html").includes("Troop"), false);
}

summary();
