// Vehicles (roadmap B9): piloting a vehicle NPC (GM Core pg. 210-213).
//
//   - Vehicle Card (GM Tools panel) posts a card for the selected vehicle
//     token: its Speed, the skills that pilot it, and buttons for the
//     piloting actions. The DCs are in the buttons and a [gm] line only.
//   - The pilot selects their token and clicks Drive, Run Over or Take
//     Control: a piloting check with the vehicle in the roll's metadata, and
//     skill.js adds what the vehicle does for the result. Stop and Board
//     (a moving vehicle: Acrobatics or Athletics against its AC) too.
//   - The card is for the vehicle as it is when posted: the terrain the GM
//     picks, and broken (HP at or below its Broken Threshold) with its
//     penalties. Nothing is kept: the GM moves the token, applies damage and
//     reposts the card when the terrain or the vehicle changes.
//   - Collision (GM Tools panel) posts the collision save and damage for a
//     crash.

const VEHICLE_TERRAIN = {
  normal: { label: "Normal terrain", adjust: 0 },
  // GM Core pg. 212: a hard DC for difficult terrain, incredibly hard for
  // greater difficult terrain (the DC adjustments' +2 and +10)
  difficult: { label: "Difficult terrain", adjust: 2 },
  greater: { label: "Greater difficult terrain", adjust: 10 },
};

// The piloting actions with a check. multiple: Speed times this, in feet.
const VEHICLE_ACTIONS = {
  drive1: { label: "Drive", actions: 1, multiple: 1, traits: ["move"] },
  drive2: { label: "Drive (2 actions)", actions: 2, multiple: 2, traits: ["move", "reckless"] },
  drive3: { label: "Drive (3 actions)", actions: 3, multiple: 3, traits: ["move", "reckless"], penalty: -5 },
  runOver: { label: "Run Over", actions: 3, multiple: 2, traits: ["move", "reckless"] },
  takeControl: { label: "Take Control", actions: 1, traits: ["manipulate"] },
};

// ---------------------------------------------------------------- The vehicle

// A vehicle's piloting check as the stat blocks print it: "Arcana (DC 32),
// Crafting (DC 32), Nature (DC 32), or Piloting Lore (DC 30)"
function parsePilotingChecks(text) {
  return parseChallengeChecks(`${text || ""}`.replace(/[()]/g, " "));
}

// The first Speed in the stat block's text ("fly 50 feet (alchemical)"),
// in feet
function getVehicleSpeed(data) {
  const text = typeof data?.speed === "object" ? data.speed?.details || data.speed?.value : data?.speed;
  const match = `${text ?? ""}`.match(/(\d+)\s*(?:feet|ft)/i) || `${text ?? ""}`.match(/\d+/);
  return match ? parseInt(match[1] ?? match[0], 10) || 0 : 0;
}

// What the card and the checks need from the vehicle token, with the
// terrain's DC and broken's penalties (GM Core pg. 213: piloting DCs +5,
// collision DC -2, Speeds halved; AC and saves -2 too, for the GM)
function getVehicleInfo(token, terrain = "normal") {
  const data = token?.data || {};
  const maxHp = parseInt(data.hitpoints, 10) || 0;
  const hp = parseInt(data.curhp ?? maxHp, 10) || 0;
  const threshold = parseInt(data.brokenThreshold, 10) || Math.floor(maxHp / 2);
  const broken = threshold > 0 && hp <= threshold;
  const adjust = (VEHICLE_TERRAIN[terrain] || VEHICLE_TERRAIN.normal).adjust + (broken ? 5 : 0);
  const speed = getVehicleSpeed(data);
  const collisionDC = parseInt(data.collisionDC, 10) || 0;
  return {
    name: getCreatureName(token),
    speed: broken ? Math.floor(speed / 2) : speed,
    speedText: (typeof data.speed === "object" ? data.speed?.details : data.speed) || "",
    broken,
    terrain: VEHICLE_TERRAIN[terrain] ? terrain : "normal",
    checks: parsePilotingChecks(data.pilotingCheck).map((check) => ({ skill: check.skill, dc: check.dc + adjust })),
    ac: (parseInt(data.ac, 10) || 0) - (broken ? 2 : 0),
    collisionDC: collisionDC ? collisionDC - (broken ? 2 : 0) : 0,
    collisionDamage: `${data.collisionDamage || ""}`.trim(),
    size: CREATURE_SIZES.includes(`${data.size || ""}`.toLowerCase()) ? `${data.size}`.toLowerCase() : "large",
  };
}

function isVehicleToken(token) {
  return token?.data?.type === "vehicle";
}

// "9d10" is bludgeoning (GM Core pg. 213: typically); a type it names stays
function getCollisionFormula(damage) {
  return /[a-z]{3,}/i.test(damage) ? damage : `${damage} bludgeoning`;
}

// The collision's basic Reflex save and its damage, as buttons. The DC is
// the GM's, as the piloting DCs are: in the button's code and a [gm] line.
function getCollisionLines(vehicle) {
  if (!vehicle.collisionDC || !vehicle.collisionDamage) {
    return ["The vehicle has no collision DC or damage."];
  }
  const formula = getCollisionFormula(vehicle.collisionDamage);
  return [
    `**Collision:** ${formula} damage, basic Reflex save.`,
    `[gm]Collision DC ${vehicle.collisionDC}.[/gm]`,
    getSaveMacro("reflex", vehicle.collisionDC, false, false, [], true),
    getDamageRollButton(formula, `${vehicle.name}: collision`),
  ];
}

// ---------------------------------------------------------------- The card

function getVehicleButton(label, call) {
  return `\`\`\`${label.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "")}\n${call}\n\`\`\``;
}

function getVehicleCardMessage(vehicle) {
  const arg = JSON.stringify(vehicle);
  const skills = vehicle.checks.map((check) => check.skill);
  const where = vehicle.terrain === "normal" ? "" : ` (${VEHICLE_TERRAIN[vehicle.terrain].label.toLowerCase()})`;
  const lines = [
    `**Vehicle: ${vehicle.name}**${vehicle.broken ? " (broken)" : ""}`,
    `Speed ${vehicle.speed} feet${vehicle.broken ? " (halved: broken)" : ""}${vehicle.speedText ? `: ${vehicle.speedText}` : ""}.`,
    skills.length
      ? `Piloting: ${skills.join(", ")}${where}. Select the pilot's token, then click an action.`
      : "The vehicle has no piloting check.",
    "A vehicle that moved last round must Drive, Run Over or Stop this round, or it's uncontrolled: at its last pilot's initiative it moves 10 feet less than the round before, in a straight line, until it stops or crashes.",
    `[gm]Piloting DCs: ${vehicle.checks.map((check) => `${check.skill} ${check.dc}`).join(", ") || "none"}${where}${vehicle.broken ? ", +5 broken" : ""}. AC ${vehicle.ac}${vehicle.collisionDC ? `, collision DC ${vehicle.collisionDC} (${getCollisionFormula(vehicle.collisionDamage)})` : ""}${vehicle.broken ? "; broken: AC, saves and collision DC -2 (included)" : ""}.[/gm]`,
  ];
  if (skills.length) {
    Object.entries(VEHICLE_ACTIONS).forEach(([key, action]) => {
      lines.push(getVehicleButton(action.label, `pilotVehicle(${JSON.stringify(key)}, ${arg});`));
    });
  }
  lines.push(getVehicleButton("Stop", `stopVehicle(${JSON.stringify(vehicle.name)});`));
  lines.push(getVehicleButton("Board", `boardVehicle(${arg});`));
  return lines.join("\n");
}

// Vehicle Card: for the selected vehicle token, on the terrain the GM picks
function postVehicleCard() {
  const vehicle = (api.getSelectedTokens() || []).map((t) => t?.token || t).find(isVehicleToken);
  if (!vehicle) {
    api.showNotification("Select a vehicle's token (an NPC of type Vehicle), then click Vehicle Card.", "yellow", "Vehicles");
    return;
  }
  const options = Object.entries(VEHICLE_TERRAIN).map(([value, terrain]) => ({ label: terrain.label, value }));
  api.showPrompt("Vehicle Card", "What is it moving through?", "Select...", options, null, (choice) => {
    const terrain = pick(choice);
    if (terrain) api.sendMessage(getVehicleCardMessage(getVehicleInfo(vehicle, terrain)));
  }, "OK", "Cancel", 1);
}

// Collision: a crash's save and damage, for the selected vehicle token
function postVehicleCollision() {
  const vehicle = (api.getSelectedTokens() || []).map((t) => t?.token || t).find(isVehicleToken);
  if (!vehicle) {
    api.showNotification("Select a vehicle's token (an NPC of type Vehicle), then click Collision.", "yellow", "Vehicles");
    return;
  }
  api.sendMessage(getCollisionLines(getVehicleInfo(vehicle)).join("\n"));
}

// ---------------------------------------------------------------- Piloting

// The metadata a piloting check carries to skill.js
function getPilotingMetadata(key, vehicle) {
  const action = VEHICLE_ACTIONS[key];
  return {
    action: action.label,
    traits: action.traits,
    ...(action.penalty ? { extraModifiers: [{ name: action.label, type: "", value: action.penalty, active: true }] } : {}),
    vehicle: {
      action: key,
      name: vehicle.name,
      speed: vehicle.speed,
      size: vehicle.size,
      collisionDC: vehicle.collisionDC,
      collisionDamage: vehicle.collisionDamage,
    },
  };
}

// A piloting action's check for each selected token, with the skill the
// player picks when the vehicle has more than one
function pilotVehicle(key, vehicle) {
  if (!VEHICLE_ACTIONS[key]) return;
  const tokens = api.getSelectedOrDroppedToken() || [];
  if (!tokens.length) {
    api.showNotification("Select the pilot's token, then click the action again.", "yellow", "Vehicles");
    return;
  }
  const roll = (check) => tokens.forEach((token) => rollNamedSkill(token, check.skill, check.dc, getPilotingMetadata(key, vehicle)));
  const checks = vehicle?.checks || [];
  if (checks.length === 1) {
    roll(checks[0]);
    return;
  }
  const options = checks.map((check, i) => ({ label: check.skill, value: `${i}` }));
  api.showPrompt(VEHICLE_ACTIONS[key].label, "Which skill?", "Select...", options, null, (choice) => {
    const check = checks[parseInt(pick(choice), 10)];
    if (check) roll(check);
  }, "OK", "Cancel", 1);
}

function stopVehicle(name) {
  const token = (api.getSelectedOrDroppedToken() || [])[0];
  api.sendMessage(`**Stop:** ${token ? getCreatureName(token) : "The pilot"} brings the ${name} to a stop.`);
}

// Board: into or out of the vehicle; a moving one takes Acrobatics or
// Athletics against its AC (GM Core pg. 212)
function boardVehicle(vehicle) {
  const tokens = api.getSelectedOrDroppedToken() || [];
  if (!tokens.length) {
    api.showNotification("Select the boarding creature's token, then click Board again.", "yellow", "Vehicles");
    return;
  }
  const options = [
    { label: "It isn't moving", value: "still" },
    { label: "Moving: Acrobatics", value: "acrobatics" },
    { label: "Moving: Athletics", value: "athletics" },
  ];
  api.showPrompt("Board", `Board or leave the ${vehicle.name}`, "Select...", options, null, (choice) => {
    const how = pick(choice);
    if (how === "still") {
      tokens.forEach((token) => api.sendMessage(`**Board:** ${getCreatureName(token)} boards or leaves the ${vehicle.name}.`));
    } else if (how) {
      tokens.forEach((token) => rollNamedSkill(token, how, vehicle.ac, { action: "Board", traits: ["move"], vehicle: { action: "board", name: vehicle.name } }));
    }
  }, "OK", "Cancel", 1);
}

// ---------------------------------------------------------------- Results

// What a piloting check does, by degree (2 critical success, 1 success, 0
// failure, -1 critical failure), for skill.js
function getVehicleResultLines(vehicle, degree) {
  if (!vehicle?.action || degree === null || degree === undefined) return [];
  const d = parseInt(degree, 10);
  const name = vehicle.name;
  if (vehicle.action === "board") {
    return [d >= 1 ? `**Board:** gets onto (or off) the moving ${name}.` : `**Board:** doesn't make it onto the moving ${name}.`];
  }
  if (vehicle.action === "takeControl") {
    return [d >= 1 ? `**Take Control:** is now piloting the ${name}, and it's under control.` : `**Take Control:** doesn't take control of the ${name}.`];
  }
  const action = VEHICLE_ACTIONS[vehicle.action];
  if (!action) return [];
  const speed = vehicle.speed || 0;
  const reckless = action.traits.includes("reckless");
  const lines = [];
  let uncontrolled = false;
  if (reckless && d < 1) {
    // Reckless piloting (GM Core pg. 212): the action fails
    uncontrolled = true;
    lines.push(`**${action.label}:** the ${name} moves ${speed} feet in a straight line along its heading (the GM can drift it up to 45 degrees) and is uncontrolled.`);
  } else if (vehicle.action === "drive1") {
    if (d >= 1) lines.push(`**Drive:** the ${name} moves up to ${speed} feet, turning normally.`);
    else if (d === 0) lines.push(`**Drive:** the ${name} moves ${speed} feet in a straight line.`);
    else {
      uncontrolled = true;
      lines.push(`**Drive:** the ${name} moves ${speed} feet in a straight line and is uncontrolled.`);
    }
  } else if (vehicle.action === "runOver") {
    const size = CREATURE_SIZES.indexOf(vehicle.size);
    const over = CREATURE_SIZES[Math.max(0, size - 2)];
    const ram = CREATURE_SIZES[Math.max(0, size - 1)];
    lines.push(`**Run Over:** the ${name} moves up to ${speed * action.multiple} feet in a straight line through ${over} and smaller creatures, and can ram one ${ram} or larger target. If the rammed target takes damage, the move ends and the pilot and the vehicle take collision damage, no save. A rammed vehicle's pilot can make a piloting check instead of the save.`);
  } else {
    lines.push(`**${action.label}:** the ${name} moves up to ${speed * action.multiple} feet in a straight line.`);
  }
  // Creatures in its path (Run Over, or an uncontrolled vehicle, GM Core
  // pg. 212)
  if (vehicle.action === "runOver" || uncontrolled) {
    lines.push(...getCollisionLines(vehicle));
  }
  // GM Core pg. 213
  lines.push(`Attacks from the ${name} until its next move: ${reckless || uncontrolled ? "-4 (reckless or uncontrolled)" : "-2"}.`);
  return lines;
}
