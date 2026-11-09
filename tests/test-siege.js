// Tests for siege weapons (siege.js, roadmap B10): the card, Aim, Load's
// count, Launch's DC and the misfire check (Guns & Gears pg. 72-73, 172).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const action = (name, actions, description) => ({ name, recordType: "actions", data: { actions, description: `<p>${description}</p>` } });

const siegeToken = (extra = {}, actions = null) => ({
  name: "Catapult",
  recordType: "npcs",
  data: {
    type: "vehicle",
    level: 7,
    hitpoints: 60,
    curhp: 60,
    brokenThreshold: 30,
    ac: 20,
    hardness: 10,
    fortitudeMod: 15,
    reflexMod: 8,
    crew: "2-4; Proficiency martial",
    speed: { details: "15 feet (pushed or pulled)" },
    size: "large",
    actions: actions || [
      action("Aim", "twoActions", "50 feet, minimum distance 50 feet"),
      action("Load", "twoActions", "(manipulate) 2 times, requires a successful DC 20 Athletics check"),
      action("Launch", "oneAction", "(attack, manipulate, range increment 150 feet) 5d10 bludgeoning, 10-foot burst, DC 22 Reflex"),
    ],
    ...extra,
  },
});

const ballista = () =>
  ctx.getSiegeInfo(
    siegeToken({ crew: "2; Proficiency martial" }, [
      action("Aim", "oneAction", "35 feet, minimum distance 25 feet"),
      action("Load", "twoActions", "(manipulate) 2 times"),
      action("Launch", "oneAction", "(attack, manipulate, range increment 120 feet) 4d12 piercing, single target, DC 19 Reflex"),
    ]),
  );

section("The weapon");
{
  assert("Load: times and check", [ctx.parseSiegeLoad("(manipulate) 2 times, requires a successful DC 20 Athletics check").times, ctx.parseSiegeLoad("(manipulate) 2 times, requires a successful DC 20 Athletics check").dc, ctx.parseSiegeLoad("(manipulate) 2 times, requires a successful DC 20 Athletics check").skill], [2, 20, "Athletics"]);
  assert("Load: 1 time, no check", [ctx.parseSiegeLoad("(manipulate) 1 time").times, ctx.parseSiegeLoad("(manipulate) 1 time").dc], [1, 0]);
  assert("Load: the hwacha's three", ctx.parseSiegeLoad("(manipulate) Each Load action loads 10 hwacha arrows. Taking the Launch action requires three Load actions to load 30 hwacha arrows").times, 3);
  const burst = ctx.parseSiegeLaunch("(attack, manipulate, range increment 150 feet) 5d10 bludgeoning, 10-foot burst, DC 22 Reflex");
  assert("Launch: burst", [burst.increment, burst.damage, burst.area, burst.shape, burst.dc, burst.save, burst.extra], [150, "5d10 bludgeoning", "10-foot burst", "burst", 22, "reflex", ""]);
  const single = ctx.parseSiegeLaunch("(attack, manipulate, range increment 120 feet) 4d12 piercing, single target, DC 19 Reflex");
  assert("Launch: single target", [single.area, single.shape, single.damage], ["single target", "single", "4d12 piercing"]);
  const extra = ctx.parseSiegeLaunch("(manipulate, range increment 300 feet) 4d8 piercing, 20-foot burst, DC 18 Reflex. If you loaded at least 70 hwacha arrows, the area increases.");
  assert("Launch: what it says after", extra.extra, "If you loaded at least 70 hwacha arrows, the area increases.");
  assert("a siege weapon has Aim and Launch", [ctx.isSiegeToken(siegeToken()), ctx.isSiegeToken({ data: { actions: [action("Strike", "oneAction", "")] } }), ctx.isSiegeToken({ data: {} })], [true, false, false]);
  const info = ctx.getSiegeInfo(siegeToken());
  assert("crew and proficiency", [info.crew, info.proficiency, info.speed], ["2-4", "martial", 15]);
  assert("action costs", [info.aim.cost, info.load.cost, info.launch.cost], ["2 actions", "2 actions", "1 action"]);
  assert("not black powder", info.blackPowder, false);
  assert("black powder from its description", ctx.getSiegeInfo(siegeToken({ description: "<p>Usage mounted (black powder)</p>" })).blackPowder, true);
  assert("broken at its BT", ctx.getSiegeInfo(siegeToken({ curhp: 30 })).broken, true);
}

section("The card");
{
  const card = ctx.getSiegeCardMessage(ctx.getSiegeInfo(siegeToken()));
  assertIncludes("name", card, "**Siege Weapon: Catapult**\n");
  assertIncludes("crew", card, "Crew 2-4, adjacent to it; Proficiency martial.");
  assertIncludes("Aim", card, "**Aim** (2 actions): 50 feet, minimum distance 50 feet");
  assertIncludes("Load, no DC", card, "**Load** (2 actions): (manipulate) 2 times, requires a successful Athletics check");
  assertIncludes("Launch, no DC", card, "5d10 bludgeoning, 10-foot burst, Reflex. At most once per round");
  assertIncludes("Move Siege Weapon", card, "at most 15 feet");
  assertIncludes("the DCs for the GM", card, "[gm]Launch DC 22. Load: DC 20 Athletics. AC 20, Fort 15, Ref 8, Hardness 10.[/gm]");
  ["```Aim\n", "```Load\n", "```Launch\n"].forEach((button) => assertIncludes(`button ${button.trim()}`, card, button));
  assert("no misfire without black powder", card.includes("Misfire"), false);
  assertIncludes("black powder: the misfire button", ctx.getSiegeCardMessage(ctx.getSiegeInfo(siegeToken({ traits: ["Black Powder"] }))), "```Misfire_Check\n");
  assertIncludes("broken", ctx.getSiegeCardMessage(ctx.getSiegeInfo(siegeToken({ curhp: 10 }))), "**Siege Weapon: Catapult** (broken)\n");
  assert("no Speed: no Move", ctx.getSiegeCardMessage(ctx.getSiegeInfo(siegeToken({ speed: { details: "" } }))).includes("Move Siege Weapon"), false);
}

section("Aim and Load");
{
  const crew = { name: "Lini", recordType: "characters", data: {} };
  ctx.api.getSelectedOrDroppedToken = () => [crew];
  ctx.__state.messages.length = 0;
  ctx.aimSiege(ballista());
  assertIncludes("Aim", ctx.__state.messages[0], "**Aim:** Lini moves the Catapult's aim: 35 feet, minimum distance 25 feet. Aimed at one square.");
  ctx.__state.messages.length = 0;
  ctx.loadSiege(ballista(), 0);
  assertIncludes("the first of two", ctx.__state.messages[0], "**Load:** 1 of 2 on the Catapult.");
  assertIncludes("... with the next", ctx.__state.messages[0], ", 1);");
  ctx.loadSiege(ballista(), 1);
  assertIncludes("the last: Loaded", ctx.__state.messages[1], "the Catapult is Loaded (2 of 2).");
  assertIncludes("... with Launch", ctx.__state.messages[1], "```Launch\n");

  const rolls = [];
  ctx.api.promptRollForToken = (token, name, dice, modifiers, metadata) => rolls.push({ token, modifiers, metadata });
  const weapon = ctx.getSiegeInfo(siegeToken());
  ctx.loadSiege(weapon, 1);
  assert("a Load check", [rolls[0].metadata.dc, rolls[0].metadata.skillName, rolls[0].metadata.siege.done], [20, "athletics", 1]);
  const success = ctx.getSiegeResultLines({ action: "load", weapon, done: 1 }, 1).join("\n");
  assertIncludes("success counts", success, "is Loaded (2 of 2)");
  const failure = ctx.getSiegeResultLines({ action: "load", weapon, done: 1 }, 0).join("\n");
  assertIncludes("failure doesn't", failure, "this one doesn't count (1 of 2 on the Catapult)");
  assertIncludes("... with the same Load", failure, ", 1);");
  assert("not a siege roll: nothing", ctx.getSiegeResultLines(undefined, 1), []);
  let notice = null;
  ctx.api.showNotification = (message) => (notice = message);
  ctx.api.getSelectedOrDroppedToken = () => [];
  ctx.loadSiege(weapon, 0);
  assertIncludes("a check needs a crew member", notice, "Select the crew member's token");
  ctx.__state.messages.length = 0;
  ctx.aimSiege(ctx.getSiegeInfo(siegeToken()));
  assertIncludes("no token: the crew; a burst's corner", ctx.__state.messages[0], "**Aim:** The crew moves the Catapult's aim: 50 feet, minimum distance 50 feet. Aimed at one grid corner");
}

section("Launch");
{
  const weapon = ctx.getSiegeInfo(siegeToken());
  const npc = { _id: "n", name: "Goblin", recordType: "npcs", data: {} };
  const trained = (classDC) => ({ _id: "p", name: "Lini", recordType: "characters", data: { classDC, attackProficiencies: { martial: 1 } } });
  assert("the printed DC", ctx.getSiegeLaunchDc(weapon, npc).dc, 22);
  assert("class DC when trained and higher", [ctx.getSiegeLaunchDc(weapon, trained(25)).dc, ctx.getSiegeLaunchDc(weapon, trained(25)).usedClassDc], [25, true]);
  assert("not when lower", [ctx.getSiegeLaunchDc(weapon, trained(18)).dc, ctx.getSiegeLaunchDc(weapon, trained(18)).usedClassDc], [22, false]);
  assert("not when untrained", ctx.getSiegeLaunchDc(weapon, { ...trained(25), data: { classDC: 25, attackProficiencies: { martial: 0 } } }).dc, 22);
  assert("range: -2 per increment past the first", [ctx.getSiegeLaunchDc(weapon, npc, 2).dc, ctx.getSiegeLaunchDc(weapon, npc, 6).dc], [20, 12]);
  assert("no token: the printed DC", ctx.getSiegeLaunchDc(weapon, null, 1).dc, 22);

  const message = ctx.getSiegeLaunchMessage(weapon, npc, 2);
  assertIncludes("the launch", message, "**Launch:** Goblin launches the Catapult: 5d10 bludgeoning, 10-foot burst, basic Reflex save, where it's Aimed.");
  assertIncludes("the DC for the GM", message, "[gm]Launch DC 20: 22, -2 range.");
  assertIncludes("the save", message, "```Roll_Reflex_Save\n");
  assertIncludes("... in its code", message, "rollSave(token, 'reflex', 20");
  assert("... not in its label", message.includes("Save_DC"), false);
  assertIncludes("... basic", message, '"basic":true');
  assertIncludes("the damage", message, 'executeDamageMacro("5d10 bludgeoning", "standard", "Catapult: Launch")');
  assertIncludes("then Load again", message, ", 0);");

  // The multiple attack penalty, off the log
  ctx.api.getCampaignVariable = (name) => (name === "pf2eTurn" ? { key: "k", tokenId: "n", round: 1 } : null);
  ctx.getEncounterState = () => ({ round: 1 });
  const logged = { ...npc, data: { turnAttacks: { turnKey: "k", attacks: [{ id: "a" }] } } };
  assert("the second attack: -5", ctx.getSiegeLaunchDc(weapon, logged).dc, 17);
  assertIncludes("... for the GM", ctx.getSiegeLaunchMessage(weapon, logged, 1), "[gm]Launch DC 17: 22, -5 multiple attack.");
  assert("the third: -10", ctx.getSiegeLaunchDc(weapon, { ...npc, data: { turnAttacks: { turnKey: "k", attacks: [{ id: "a" }, { id: "b" }] } } }).dc, 12);

  // Launching: the prompt, the card and the log
  const writes = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push({ id, values });
  ctx.api.getSelectedOrDroppedToken = () => [npc];
  let prompted = null;
  ctx.api.showPrompt = (title, label, placeholder, options, value, cb) => {
    prompted = options;
    cb("3");
  };
  ctx.__state.messages.length = 0;
  ctx.launchSiege(weapon);
  assert("the range prompt", [prompted.length, prompted[0].label, prompted[2].label], [6, "Up to 150 feet", "Up to 450 feet (-4)"]);
  assertIncludes("the card", ctx.__state.messages[0], "[gm]Launch DC 18: 22, -4 range.");
  assert("it counts as an attack", [writes.length, writes[0].id, writes[0].values["data.turnAttacks"].attacks[0].kind], [1, "n", "siege"]);
  prompted = null;
  ctx.__state.messages.length = 0;
  ctx.launchSiege({ ...weapon, launch: { ...weapon.launch, increment: 0 } });
  assert("no range increment: no prompt", [prompted, ctx.__state.messages.length], [null, 1]);
}

section("Misfire");
{
  const rolls = [];
  ctx.api.roll = (dice, metadata, type) => rolls.push({ dice, metadata, type });
  ctx.rollSiegeMisfire(ctx.getSiegeInfo(siegeToken({ traits: ["Black Powder"] })));
  const roll = rolls[0];
  assert("a DC 5 flat check", [roll.dice, roll.metadata.dc, roll.type], ["1d20", 5, "flatCheck"]);
  assertIncludes("a jam", roll.metadata.failureNote, "jams and the attack is a critical failure. To clear the jam the crew uses 2 Interact actions");
  assertIncludes("a natural 1 explodes", roll.metadata.criticalFailureNote, "**The Catapult explodes and is destroyed!** 5d10 bludgeoning damage to all creatures in a 30-foot emanation, basic Reflex save.");
  assertIncludes("... the standard DC of its level, for the GM", roll.metadata.criticalFailureNote, "[gm]DC 23.[/gm]");
  assertIncludes("... on the save", roll.metadata.criticalFailureNote, "rollSave(token, 'reflex', 23");
  rolls.length = 0;
  ctx.rollSiegeMisfire(ctx.getSiegeInfo(siegeToken({ traits: ["Black Powder"], level: undefined })));
  assert("no level: no save button", rolls[0].metadata.criticalFailureNote.includes("Roll_Reflex_Save"), false);
  assertIncludes("... its damage", roll.metadata.criticalFailureNote, 'executeDamageMacro("5d10 bludgeoning", "standard", "Catapult: explosion")');
}

section("The panel");
{
  let notice = null;
  ctx.api.showNotification = (message) => (notice = message);
  ctx.api.getSelectedTokens = () => [{ token: { name: "Goblin", data: { type: "npc" } } }];
  ctx.postSiegeCard();
  assertIncludes("not a siege weapon", notice, "Select a siege weapon's token");
  ctx.__state.messages.length = 0;
  ctx.api.getSelectedTokens = () => [{ token: siegeToken() }];
  ctx.postSiegeCard();
  assertIncludes("the card", ctx.__state.messages[0], "**Siege Weapon: Catapult**");
  const fs = require("fs");
  assertIncludes("panel", fs.readFileSync(__dirname + "/../gm-tools-panel.html", "utf8"), "postSiegeCard()");
  assertIncludes("skill.js", fs.readFileSync(__dirname + "/../rollhandlers/skill.js", "utf8"), "getSiegeResultLines(");
  assertIncludes("flatCheck.js: a natural 1 is a critical failure", fs.readFileSync(__dirname + "/../rollhandlers/flatCheck.js", "utf8"), "total <= dc - 10 || naturalRoll === 1");
  assert("not a vehicle, though typed Vehicle", [ctx.isVehicleToken(siegeToken()), ctx.isVehicleToken({ data: { type: "vehicle", actions: [] } })], [false, true]);
  notice = null;
  ctx.postVehicleCard();
  assertIncludes("the Vehicle Card doesn't take it", notice, "Select a vehicle's token");
}

summary();
