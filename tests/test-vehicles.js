// Tests for vehicles (vehicles.js, roadmap B9): the vehicle card, piloting
// checks and what they do, boarding and collisions (GM Core pg. 210-213).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

// GM Core's Airship, as the module has it
const airship = (extra = {}) => ({
  name: "Airship",
  recordType: "npcs",
  data: {
    type: "vehicle",
    hitpoints: 210,
    curhp: 210,
    brokenThreshold: 105,
    ac: 28,
    collisionDC: 30,
    collisionDamage: "9d10",
    speed: { details: "fly 50 feet (alchemical, magical)" },
    pilotingCheck: "Arcana (DC 32), Crafting (DC 32), Nature (DC 32), or Piloting Lore (DC 30)",
    size: "gargantuan",
    ...extra,
  },
});

section("The vehicle");
{
  assert(
    "the piloting check's skills and DCs",
    ctx.parsePilotingChecks(airship().data.pilotingCheck).map((c) => `${c.skill} ${c.dc}`),
    ["Arcana 32", "Crafting 32", "Nature 32", "Piloting Lore 30"],
  );
  assert("Speed from the text", [ctx.getVehicleSpeed(airship().data), ctx.getVehicleSpeed({ speed: { details: "30 feet (pulled by 2 Large animals)" } })], [50, 30]);
  const info = ctx.getVehicleInfo(airship());
  assert("as it is", [info.speed, info.broken, info.ac, info.collisionDC, info.checks[3].dc], [50, false, 28, 30, 30]);
  const hard = ctx.getVehicleInfo(airship(), "difficult");
  const harder = ctx.getVehicleInfo(airship(), "greater");
  assert("difficult terrain: hard (+2); greater: incredibly hard (+10)", [hard.checks[0].dc, harder.checks[0].dc], [34, 42]);
  const broken = ctx.getVehicleInfo(airship({ curhp: 105 }));
  assert("broken at its BT: DCs +5, Speed halved, AC and collision DC -2", [broken.broken, broken.checks[3].dc, broken.speed, broken.ac, broken.collisionDC], [true, 35, 25, 26, 28]);
  assert("BT from half the HP when missing", ctx.getVehicleInfo(airship({ brokenThreshold: undefined, curhp: 100 })).broken, true);
  assert("collision damage is bludgeoning unless it says", [ctx.getCollisionFormula("9d10"), ctx.getCollisionFormula("4d6 fire")], ["9d10 bludgeoning", "4d6 fire"]);
}

section("The card");
{
  const card = ctx.getVehicleCardMessage(ctx.getVehicleInfo(airship(), "difficult"));
  assertIncludes("name and Speed", card, "**Vehicle: Airship**\nSpeed 50 feet: fly 50 feet (alchemical, magical).");
  assertIncludes("the skills, no DCs", card, "Piloting: Arcana, Crafting, Nature, Piloting Lore (difficult terrain).");
  assertIncludes("the DCs for the GM", card, "[gm]Piloting DCs: Arcana 34, Crafting 34, Nature 34, Piloting Lore 32 (difficult terrain).");
  assertIncludes("momentum", card, "must Drive, Run Over or Stop this round, or it's uncontrolled");
  ["```Drive\n", "```Drive_2_actions\n", "```Drive_3_actions\n", "```Run_Over\n", "```Take_Control\n", "```Stop\n", "```Board\n"].forEach((button) =>
    assertIncludes(`button ${button.trim()}`, card, button),
  );
  assertIncludes("buttons carry the vehicle", card, 'pilotVehicle("drive3", {"name":"Airship"');
  const broken = ctx.getVehicleCardMessage(ctx.getVehicleInfo(airship({ curhp: 50 })));
  assertIncludes("broken", broken, "**Vehicle: Airship** (broken)\nSpeed 25 feet (halved: broken)");
  assertIncludes("broken for the GM", broken, ", +5 broken. AC 26, collision DC 28 (9d10 bludgeoning); broken: AC, saves and collision DC -2 (included).[/gm]");
  const none = ctx.getVehicleCardMessage(ctx.getVehicleInfo(airship({ pilotingCheck: "" })));
  assert("no piloting check: no action buttons", [none.includes("pilotVehicle"), none.includes("```Stop")], [false, true]);
}

section("Piloting checks");
{
  const rolls = [];
  ctx.api.promptRollForToken = (token, name, dice, modifiers, metadata) => rolls.push({ token, modifiers, metadata });
  const pilot = { name: "Lini", recordType: "characters", data: { intMod: 2, loreSkills: [{ name: "Piloting Lore", data: { mod: 9, rank: 1, ability: "int" } }] } };
  ctx.api.getSelectedOrDroppedToken = () => [pilot];
  let prompted = null;
  ctx.api.showPrompt = (title, label, placeholder, options, value, cb) => {
    prompted = options;
    cb("3");
  };
  const vehicle = ctx.getVehicleInfo(airship());
  ctx.pilotVehicle("drive3", vehicle);
  assert("the skill prompt", prompted.map((o) => o.label), ["Arcana", "Crafting", "Nature", "Piloting Lore"]);
  const roll = rolls[0];
  assert("the pilot's Lore, at the DC", [roll.metadata.dc, roll.modifiers.some((m) => m.value === 9)], [30, true]);
  assert("Drive 3: -5", roll.modifiers.some((m) => m.name === "Drive (3 actions)" && m.value === -5), true);
  assert("the action and its traits", [roll.metadata.rollName, roll.metadata.vehicle.action, roll.metadata.vehicle.speed], ["Piloting Lore: Drive (3 actions)", "drive3", 50]);
  rolls.length = 0;
  prompted = null;
  ctx.pilotVehicle("drive1", { ...vehicle, checks: [{ skill: "Athletics", dc: 15 }] });
  assert("one skill: no prompt", [prompted, rolls[0].metadata.dc, rolls[0].metadata.skillName], [null, 15, "athletics"]);
  assert("no -5 on Drive", rolls[0].modifiers.some((m) => m.value === -5), false);
  rolls.length = 0;
  ctx.api.showPrompt = (title, label, placeholder, options, value, cb) => cb("athletics");
  ctx.boardVehicle(vehicle);
  assert("Board a moving vehicle: Athletics against its AC", [rolls[0].metadata.dc, rolls[0].metadata.vehicle.action], [28, "board"]);
  ctx.__state.messages.length = 0;
  ctx.api.showPrompt = (title, label, placeholder, options, value, cb) => cb("still");
  ctx.boardVehicle(vehicle);
  assertIncludes("a vehicle that isn't moving: no check", ctx.__state.messages[0], "**Board:** Lini boards or leaves the Airship.");
  ctx.stopVehicle("Airship");
  assertIncludes("Stop", ctx.__state.messages[1], "**Stop:** Lini brings the Airship to a stop.");
  let notice = null;
  ctx.api.showNotification = (message) => (notice = message);
  ctx.api.getSelectedOrDroppedToken = () => [];
  ctx.pilotVehicle("drive1", vehicle);
  assertIncludes("no pilot selected", notice, "Select the pilot's token");
}

section("What the checks do");
{
  const vehicle = ctx.getPilotingMetadata("drive1", ctx.getVehicleInfo(airship())).vehicle;
  const lines = (action, degree) => ctx.getVehicleResultLines({ ...vehicle, action }, degree).join("\n");
  assertIncludes("Drive success", lines("drive1", 1), "**Drive:** the Airship moves up to 50 feet, turning normally.");
  assertIncludes("Drive failure", lines("drive1", 0), "moves 50 feet in a straight line.");
  assertIncludes("Drive critical failure", lines("drive1", -1), "in a straight line and is uncontrolled.");
  assertIncludes("... with the collision", lines("drive1", -1), "9d10 bludgeoning damage, basic Reflex save.\n[gm]Collision DC 30.[/gm]");
  assertIncludes("Drive: -2 to attacks", lines("drive1", 1), "Attacks from the Airship until its next move: -2.");
  assertIncludes("Drive 2", lines("drive2", 1), "moves up to 100 feet in a straight line.");
  assertIncludes("Drive 3", lines("drive3", 2), "moves up to 150 feet in a straight line.");
  assertIncludes("reckless failure", lines("drive2", 0), "moves 50 feet in a straight line along its heading (the GM can drift it up to 45 degrees) and is uncontrolled.");
  assertIncludes("reckless: -4 to attacks", lines("drive2", 1), "-4 (reckless or uncontrolled)");
  const run = lines("runOver", 1);
  assertIncludes("Run Over: twice Speed, sizes", run, "moves up to 100 feet in a straight line through large and smaller creatures, and can ram one huge or larger target.");
  assertIncludes("Run Over: a Large vehicle rams Medium or larger", ctx.getVehicleResultLines({ ...vehicle, size: "large", action: "runOver" }, 1).join(""), "can ram one medium or larger target.");
  assertIncludes("Run Over: the save", run, "```Roll_Reflex_Save\n");
  assertIncludes("... the DC in its code only", run, "rollSave(token, 'reflex', 30");
  assert("... not in the label", run.includes("Save_DC30"), false);
  assertIncludes("... basic", run, '"basic":true');
  assertIncludes("Run Over: the damage", run, 'executeDamageMacro("9d10 bludgeoning", "standard", "Airship: collision")');
  assertIncludes("Take Control", lines("takeControl", 1), "is now piloting the Airship, and it's under control.");
  assertIncludes("Take Control fails", lines("takeControl", 0), "doesn't take control of the Airship.");
  assertIncludes("Board", ctx.getVehicleResultLines({ action: "board", name: "Airship" }, 0).join(""), "doesn't make it onto the moving Airship.");
  assert("no vehicle: nothing", ctx.getVehicleResultLines(undefined, 1), []);
}

section("The panel");
{
  let notice = null;
  ctx.api.showNotification = (message) => (notice = message);
  ctx.api.getSelectedTokens = () => [{ token: { name: "Goblin", data: { type: "npc" } } }];
  ctx.postVehicleCard();
  assertIncludes("not a vehicle", notice, "Select a vehicle's token");
  ctx.__state.messages.length = 0;
  ctx.api.getSelectedTokens = () => [{ token: airship() }];
  ctx.api.showPrompt = (title, label, placeholder, options, value, cb) => cb("greater");
  ctx.postVehicleCard();
  assertIncludes("the card", ctx.__state.messages[0], "Piloting Lore 40 (greater difficult terrain)");
  ctx.postVehicleCollision();
  assertIncludes("Collision", ctx.__state.messages[1], "**Collision:** 9d10 bludgeoning damage, basic Reflex save.\n[gm]Collision DC 30.[/gm]");
  const panel = require("fs").readFileSync(__dirname + "/../gm-tools-panel.html", "utf8");
  ["postVehicleCard()", "postVehicleCollision()"].forEach((call) => assertIncludes(`panel: ${call}`, panel, call));
}

summary();
