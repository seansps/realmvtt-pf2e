// Tests for critical specialization effects (critical-specialization.js).
// Run: node tests/test-critical-specialization.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

function runHandler(file, data) {
  ctx.__state.messages = [];
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
  return ctx.__state.messages.join("\n");
}

const metadata = (critSpec = {}) => ({ targetId: "orc", targetName: "Orc", tokenId: "ez", tokenName: "Ezren", critSpec: { classDC: 21, itemBonus: 1, dice: 2, ...critSpec } });
const buttons = (group, critSpec) => ctx.getCriticalSpecializationButtons(group, metadata(critSpec)).join("\n");

section("What the card needs");
{
  const record = { _id: "pc", recordType: "characters", data: { level: 7, classDC: 23 } };
  const weapon = { _id: "w", name: "Longsword", data: { damage: { dice: 1, die: "d8" }, runes: { potency: "1", striking: "1" } } };
  assert("class DC, the potency rune and the dice with striking", ctx.getCriticalSpecializationContext(record, weapon), { classDC: 23, itemBonus: 1, dice: 2 });
  assert("no class DC: none", ctx.getCriticalSpecializationContext({ data: {} }, weapon).classDC, null);
}

section("Conditions until the start of your next turn (Player Core pg. 283)");
{
  const spear = buttons("spear");
  assert("spear: Apply Clumsy 1 on the target", [spear.includes("Apply_Clumsy_1"), spear.includes('"orc"'), spear.includes("start_applier_turn")], [true, true, true]);
  assert("sword: Apply Off-Guard", buttons("sword").includes("Apply_Off-Guard"), true);
  const applied = [];
  ctx.api.addEffect = (...args) => applied.push(args);
  ctx.applyCriticalSpecializationEffect({ _id: "orc" }, { name: "Clumsy", value: 1, unit: "start_applier_turn", duration: 1 }, { id: "ez", name: "Ezren" });
  assert("clumsy 1 until the start of the attacker's next turn, the attacker its applier", applied[0].slice(0, 1).concat([applied[0][2], applied[0][3]]), ["Clumsy", { value: 1, unit: "start_applier_turn" }, { value: 1, _id: "ez", name: "Ezren" }]);
  applied.length = 0;
  ctx.applyCriticalSpecializationEffect({ _id: "orc" }, { name: "Stunned", value: 1 }, { id: "ez", name: "Ezren" });
  assert("stunned 1: no duration (it counts actions)", [applied[0][0], applied[0][2], applied[0][3].value], ["Stunned", undefined, 1]);
}

section("Saves against your class DC");
{
  const brawling = buttons("brawling");
  assert("brawling: the save, at the class DC", [brawling.includes("Fortitude_Save_(DC_21)"), brawling.includes('rollSave(token, "fortitude", 21, false, true)')], [true, true]);
  assert("... and slowed 1 until the end of your next turn on a failure", [brawling.includes("On_a_Failure:_Slowed_1"), brawling.includes('"end_applier_turn"'), brawling.includes('"endOfNextTurn":true')], [true, true, true]);
  assert("flail: Reflex, prone", [buttons("flail").includes("Reflex_Save_(DC_21)"), buttons("flail").includes("On_a_Failure:_Prone")], [true, true]);
  assert("hammer: Fortitude, prone", buttons("hammer").includes("Fortitude_Save_(DC_21)"), true);
  assert("firearm and sling: stunned 1", [buttons("firearm").includes("On_a_Failure:_Stunned_1"), buttons("sling").includes("On_a_Failure:_Stunned_1")], [true, true]);
  assert("no class DC: the save still, without one", buttons("brawling", { classDC: null }).includes('rollSave(token, "fortitude", null, false, true)'), true);
}

section("Persistent bleed, the bow, the notes");
{
  assert("knife: 1d6 plus the item bonus", buttons("knife", { itemBonus: 2 }).includes('applyPersistentDamageToToken(token, "1d6+2 bleed", "ez", "Ezren")'), true);
  assert("crossbow: 1d8", buttons("crossbow", { itemBonus: 0 }).includes('"1d8 bleed"'), true);
  assert("dart: 1d6+1", buttons("dart").includes("Apply_1d6+1_bleed_Persistent_Damage"), true);
  assert("bow: immobilized, and how to pull free", [buttons("bow").includes("Apply_Immobilized"), buttons("bow").includes("DC 10 Athletics")], [true, true]);
  assert("bow: the note starts with the surface", buttons("bow").includes("**Critical specialization:** If the target is adjacent to a surface"), true);
  assert("pick: 2 per weapon damage die, worked out", buttons("pick", { dice: 3 }).includes("6 additional damage (2 per weapon damage die, 3 dice)"), true);
  assert("club, polearm, shield: forced movement", ["club", "polearm", "shield"].map((g) => buttons(g).includes("forced movement")), [true, true, true]);
  assert("an unknown group: nothing", ctx.getCriticalSpecializationButtons("whip", metadata()), []);

  const added = [];
  ctx.api.addEffect = (...args) => added.push(args);
  ctx.api.sendMessage = () => {};
  ctx.applyPersistentDamageToToken({ _id: "orc", name: "Orc", effects: [], effectIds: [], data: {} }, "1d6+1 bleed", "ez", "Ezren");
  assert("the bleed on its target, the attacker its applier", [added[0][0], added[0][3]], ["Persistent Damage", { value: "1d6+1 bleed", _id: "ez", name: "Ezren" }]);
}

section("Until the end of your next turn, worked out on the click");
{
  const applied = [];
  ctx.api.addEffect = (...args) => applied.push(args);
  const slowed = { name: "Slowed", value: 1, unit: "end_applier_turn", endOfNextTurn: true };
  const turnOf = (tokenId) => (name) => (name === "pf2eTurn" ? { key: tokenId, tokenId } : { round: 1 });
  ctx.api.getCampaignVariable = turnOf("ez");
  ctx.applyCriticalSpecializationEffect({ _id: "orc" }, slowed, { id: "ez", name: "Ezren" });
  ctx.api.getCampaignVariable = turnOf("orc");
  ctx.applyCriticalSpecializationEffect({ _id: "orc" }, slowed, { id: "ez", name: "Ezren" });
  ctx.api.getCampaignVariable = () => null;
  ctx.applyCriticalSpecializationEffect({ _id: "orc" }, slowed, { id: "ez", name: "Ezren" });
  assert("2 on the attacker's own turn, 1 on a reaction, 2 out of combat", applied.map((args) => args[2].value), [2, 1, 2]);
}

section("Grievous runes (GM Core pg. 238)");
{
  const grievous = (group, critSpec) => ctx.getCriticalSpecializationButtons(group, { ...metadata(critSpec), runes: ["grievous"] }).join("\n");
  assert("sword: off-guard until the end of your next turn", [grievous("sword").includes('"end_applier_turn"'), grievous("sword").includes('"endOfNextTurn":true')], [true, true]);
  assert("spear: clumsy 1 for 2 of your turns", grievous("spear").includes('"duration":2'), true);
  assert("brawling: -4 to the save, rolled against DC 25", [grievous("brawling").includes("Fortitude_Save_(DC_25,_grievous_-4)"), grievous("brawling").includes('rollSave(token, "fortitude", 25, false, true)'), grievous("brawling").includes("-4 circumstance penalty")], [true, true, true]);
  assert("firearm: -4 too; flail: no change", [grievous("firearm").includes("DC_25"), grievous("flail").includes("Reflex_Save_(DC_21)")], [true, true]);
  assert("dart: 2d6 bleed", grievous("dart").includes('"2d6+1 bleed"'), true);
  assert("pick: 4 per die", grievous("pick", { dice: 3 }).includes("12 additional damage (4 per weapon damage die, 3 dice)"), true);
  assert("crossbow: its bleed, and the bow's immobilized", [grievous("crossbow").includes('"1d8+1 bleed"'), grievous("crossbow").includes("Apply_Immobilized"), grievous("crossbow").includes("DC 10 Athletics")], [true, true, true]);
  assert("bow: DC 20 to pull free", [grievous("bow").includes("DC 20 Athletics"), grievous("bow").includes("DC 10")], [true, false]);
  assert("knife and sling: their speed penalties as notes", [grievous("knife").includes("-5-foot status penalty"), grievous("sling").includes("-10-foot status penalty")], [true, true]);
  assert("without the rune: the plain effect", [buttons("dart").includes("1d6+1"), buttons("crossbow").includes("Immobilized")], [true, false]);
}

section("A critical hit's card (attack.js)");
{
  ctx.api.sendMessage = (message) => ctx.__state.messages.push(message);
  const card = runHandler("attack.js", {
    roll: {
      dice: [{ type: 20, value: 20 }],
      total: 35,
      metadata: { dc: 18, attack: "Longsword", traits: [], damage: "2d8 slashing", weaponGroup: "sword", hasCriticalSpecialization: true, ...metadata() },
    },
  });
  assert("the sword's Apply Off-Guard button on the card", [card.includes("Critical Specialization Effect can be Applied"), card.includes("Apply_Off-Guard")], [true, true]);
  const hit = runHandler("attack.js", {
    roll: {
      dice: [{ type: 20, value: 12 }],
      total: 22,
      metadata: { dc: 18, attack: "Longsword", traits: [], damage: "2d8 slashing", weaponGroup: "sword", hasCriticalSpecialization: true, ...metadata() },
    },
  });
  assert("a hit that isn't critical: none", hit.includes("Apply_Off-Guard"), false);
}

process.exitCode = summary() > 0 ? 1 : 0;
