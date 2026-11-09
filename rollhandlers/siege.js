// Siege weapons (roadmap B10): crewing a mounted siege weapon (Guns & Gears
// pg. 72-73, 172).
//
//   - A siege weapon is an NPC with Aim, Load and Launch among its actions,
//     their text as the stat block prints it. Nothing is added to its sheet.
//   - Siege Card (GM Tools panel) posts a card for the selected token: the
//     crew and the three activities, with a button for each. The DCs are in
//     the buttons and a [gm] line only.
//   - A crew member selects their token and clicks. Load counts on the chat
//     cards: each Load's message has the button for the next, and the last
//     one's has Launch. Nothing is kept, and nothing is enforced: Launch is
//     on the card whatever has been Loaded.
//   - Launch is a basic save at the printed DC, or the crew member's class DC
//     if they're trained in the weapon's proficiency and it's higher, with
//     the range increment's penalty and the multiple attack penalty on the
//     DC. It counts as an attack on the attack log.
//   - Misfire Check (black powder only) is the DC 5 flat check for a weapon
//     not maintained today.

const SIEGE_ACTION_COSTS = {
  free: "free",
  oneAction: "1 action",
  twoActions: "2 actions",
  threeActions: "3 actions",
};

const SIEGE_WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5 };

// Range increments are at most six; each past the first is -2
const SIEGE_MAX_INCREMENTS = 6;

// ---------------------------------------------------------------- The weapon

function findSiegeAction(data, pattern) {
  return (Array.isArray(data?.actions) ? data.actions : []).find((action) => pattern.test(`${action?.name || ""}`.trim()));
}

function isSiegeToken(token) {
  return !!findSiegeAction(token?.data, /^aim\b/i) && !!findSiegeAction(token?.data, /^(launch|fire)\b/i);
}

function getSiegeText(html) {
  return `${html || ""}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getSiegeActionInfo(action) {
  return { cost: SIEGE_ACTION_COSTS[action?.data?.actions] || "", text: getSiegeText(action?.data?.description) };
}

// "(manipulate) 2 times, requires a successful DC 20 Athletics check", or
// the hwacha's "requires three Load actions"
function parseSiegeLoad(text) {
  const times = `${text || ""}`.match(/(\d+)\s+times?\b/i) || `${text || ""}`.match(/requires\s+(\w+)\s+Load\b/i);
  const check = `${text || ""}`.match(/DC\s*(\d+)\s+([A-Z][a-z]+(?:\s+Lore)?)\s+check/);
  return {
    times: Math.max(1, parseInt(times?.[1], 10) || SIEGE_WORD_NUMBERS[`${times?.[1] || ""}`.toLowerCase()] || 1),
    dc: check ? parseInt(check[1], 10) : 0,
    skill: check ? check[2] : "",
  };
}

// "(attack, manipulate, range increment 120 feet) 4d12 piercing, single
// target, DC 19 Reflex", and whatever the entry says after that
function parseSiegeLaunch(text) {
  const launch = `${text || ""}`;
  const save = launch.match(/DC\s*(\d+)\s+(Reflex|Fortitude|Will)\b\.?/i);
  const area = launch.match(/(\d+)-foot\s+(burst|cone|line)/i);
  return {
    increment: parseInt(launch.match(/range increment\s+(\d+)/i)?.[1], 10) || 0,
    damage: launch.match(/\d+d\d+(?:\s*[+-]\s*\d+)?(?:\s+[a-z]+)?/i)?.[0] || "",
    area: area ? `${area[1]}-foot ${area[2].toLowerCase()}` : "single target",
    shape: area ? area[2].toLowerCase() : "single",
    dc: save ? parseInt(save[1], 10) : 0,
    save: save ? save[2].toLowerCase() : "",
    extra: save ? launch.slice(save.index + save[0].length).trim() : "",
  };
}

// The stat block's text as players see it: the DCs are the GM's
function hideSiegeDcs(text) {
  return `${text || ""}`.replace(/\bDC\s*\d+\s*/gi, "");
}

// What the card and its buttons need from the siege weapon's token. The
// Proficiency and black powder are printed text: the crew line ("2-4;
// Proficiency martial"), the description or the traits.
function getSiegeInfo(token) {
  const data = token?.data || {};
  const printed = `${data.crew || ""} ${getSiegeText(data.description)} ${(data.traits || []).join(" ")}`;
  const aim = getSiegeActionInfo(findSiegeAction(data, /^aim\b/i));
  const load = getSiegeActionInfo(findSiegeAction(data, /^load\b/i));
  const launch = getSiegeActionInfo(findSiegeAction(data, /^(launch|fire)\b/i));
  const vehicle = getVehicleInfo(token);
  return {
    name: vehicle.name,
    level: parseInt(data.level, 10),
    broken: vehicle.broken,
    crew: `${data.crew || ""}`.replace(/;?\s*proficiency.*$/i, "").trim(),
    proficiency: printed.match(/proficiency\s+(simple|martial|advanced)/i)?.[1]?.toLowerCase() || "",
    blackPowder: /black powder/i.test(printed),
    speed: getVehicleSpeed(data),
    ac: vehicle.ac,
    fort: data.fortitudeMod,
    ref: data.reflexMod,
    hardness: data.hardness,
    aim,
    load: { ...load, ...parseSiegeLoad(load.text) },
    launch: { ...launch, ...parseSiegeLaunch(launch.text) },
  };
}

// ---------------------------------------------------------------- The card

// Printed text as a sentence: it may or may not end in a period
function getSiegeSentence(text) {
  return `${text || ""}`.trim().replace(/\.*$/, ".");
}

function getSiegeActionLine(label, action, after = "") {
  return `**${label}**${action.cost ? ` (${action.cost})` : ""}: ${getSiegeSentence(hideSiegeDcs(action.text))}${after}`;
}

function getSiegeCardMessage(weapon) {
  const arg = JSON.stringify(weapon);
  const lines = [
    `**Siege Weapon: ${weapon.name}**${weapon.broken ? " (broken)" : ""}`,
    `Crew${weapon.crew ? ` ${weapon.crew}` : ""}, adjacent to it${weapon.proficiency ? `; Proficiency ${weapon.proficiency}` : ""}. Select a crew member's token, then click an activity.`,
    ...(weapon.broken ? ["A broken object can't be used normally until it's Repaired."] : []),
    getSiegeActionLine("Aim", weapon.aim),
    getSiegeActionLine("Load", weapon.load),
    getSiegeActionLine("Launch", weapon.launch, " At most once per round; then it must be Loaded fully again."),
    ...(weapon.speed
      ? [`**Move Siege Weapon** (2 actions): with the rest of the crew Readied to Stride, you all Stride up to the slowest crew member's Speed, at most ${weapon.speed} feet. The aim moves with it.`]
      : []),
    `[gm]${weapon.launch.dc ? `Launch DC ${weapon.launch.dc}. ` : ""}${weapon.load.dc ? `Load: DC ${weapon.load.dc} ${weapon.load.skill}. ` : ""}AC ${weapon.ac}, Fort ${weapon.fort ?? "-"}, Ref ${weapon.ref ?? "-"}, Hardness ${weapon.hardness ?? "-"}.[/gm]`,
    getVehicleButton("Aim", `aimSiege(${arg});`),
    getVehicleButton("Load", `loadSiege(${arg}, 0);`),
    getVehicleButton("Launch", `launchSiege(${arg});`),
  ];
  if (weapon.blackPowder) {
    lines.push("Black powder: if it hasn't been cleaned and maintained since it was last used or assembled before today, make the Misfire Check before Launching.");
    lines.push(getVehicleButton("Misfire Check", `rollSiegeMisfire(${arg});`));
  }
  return lines.join("\n");
}

// Siege Card: for the selected siege weapon's token
function postSiegeCard() {
  const weapon = (api.getSelectedTokens() || []).map((t) => t?.token || t).find(isSiegeToken);
  if (!weapon) {
    api.showNotification("Select a siege weapon's token (an NPC with Aim, Load and Launch actions), then click Siege Card.", "yellow", "Siege Weapons");
    return;
  }
  api.sendMessage(getSiegeCardMessage(getSiegeInfo(weapon)));
}

// ---------------------------------------------------------------- Aim and Load

function getSiegeCrewToken() {
  return (api.getSelectedOrDroppedToken() || [])[0] || null;
}

function getSiegeCrewName(token) {
  return token ? getCreatureName(token) : "The crew";
}

function aimSiege(weapon) {
  const where = {
    single: "Aimed at one square.",
    burst: "Aimed at one grid corner, the center of the burst.",
    cone: "Aimed in a direction, to the nearest 45 degrees.",
    line: "Aimed in a direction, to the nearest 45 degrees.",
  }[weapon.launch.shape];
  api.sendMessage(`**Aim:** ${getSiegeCrewName(getSiegeCrewToken())} moves the ${weapon.name}'s aim: ${getSiegeSentence(weapon.aim.text)} ${where}`);
}

// After a Load: how far along it is, with the next button
function getSiegeLoadLines(weapon, done) {
  if (done >= weapon.load.times) {
    return [
      `**Load:** the ${weapon.name} is Loaded (${weapon.load.times} of ${weapon.load.times}).`,
      getVehicleButton("Launch", `launchSiege(${JSON.stringify(weapon)});`),
    ];
  }
  return [
    `**Load:** ${done} of ${weapon.load.times} on the ${weapon.name}.`,
    getVehicleButton("Load", `loadSiege(${JSON.stringify(weapon)}, ${done});`),
  ];
}

// One Load activity; done is how many have been finished. A Load that
// requires a check rolls it, and skill.js takes it from there.
function loadSiege(weapon, done) {
  const token = getSiegeCrewToken();
  if (!weapon.load.dc) {
    api.sendMessage(getSiegeLoadLines(weapon, done + 1).join("\n"));
    return;
  }
  if (!token) {
    api.showNotification("Select the crew member's token, then click Load again.", "yellow", "Siege Weapons");
    return;
  }
  rollNamedSkill(token, weapon.load.skill, weapon.load.dc, {
    action: "Load",
    traits: ["manipulate"],
    siege: { action: "load", weapon, done },
  });
}

// What a Load's check does, for skill.js
function getSiegeResultLines(siege, degree) {
  if (siege?.action !== "load" || degree === null || degree === undefined) return [];
  if (parseInt(degree, 10) >= 1) return getSiegeLoadLines(siege.weapon, siege.done + 1);
  return [
    `**Load:** this one doesn't count (${siege.done} of ${siege.weapon.load.times} on the ${siege.weapon.name}).`,
    getVehicleButton("Load", `loadSiege(${JSON.stringify(siege.weapon)}, ${siege.done});`),
  ];
}

// ---------------------------------------------------------------- Launch

// The Launch DC for this crew member (Guns & Gears pg. 73): the higher of
// the weapon's and, trained in its proficiency, their class DC; the range
// increment's penalty and the multiple attack penalty apply to it.
function getSiegeLaunchDc(weapon, token, increments = 1) {
  const trained = !!token && !!weapon.proficiency && getProfiencyForWeapon(token, weapon.proficiency, null) > 0;
  const classDc = trained ? parseInt(token.data?.classDC, 10) || 0 : 0;
  const base = Math.max(weapon.launch.dc, classDc);
  const range = -2 * Math.max(0, increments - 1);
  const attackNumber = token ? getNextAttackNumber(token) : null;
  const map = attackNumber === 2 ? -5 : attackNumber === 3 ? -10 : 0;
  return { base, usedClassDc: classDc > weapon.launch.dc, range, map, dc: base + range + map };
}

function getSiegeLaunchMessage(weapon, token, increments = 1) {
  const launch = weapon.launch;
  const dc = getSiegeLaunchDc(weapon, token, increments);
  const basic = !!launch.damage;
  const lines = [
    `**Launch:** ${getSiegeCrewName(token)} launches the ${weapon.name}: ${[launch.damage, launch.area].filter(Boolean).join(", ")}${launch.save ? `, ${basic ? "basic " : ""}${capitalize(launch.save)} save` : ""}, where it's Aimed.`,
    ...(launch.extra ? [hideSiegeDcs(launch.extra)] : []),
  ];
  if (launch.dc) {
    const parts = [`${dc.base}${dc.usedClassDc ? " (class DC)" : ""}`];
    if (dc.range) parts.push(`${dc.range} range`);
    if (dc.map) parts.push(`${dc.map} multiple attack`);
    lines.push(`[gm]Launch DC ${dc.dc}${parts.length > 1 || dc.usedClassDc ? `: ${parts.join(", ")}` : ""}. On a vehicle, its attack penalty (-2, or -4) applies too.[/gm]`);
    lines.push(getSaveMacro(launch.save, dc.dc, false, false, [], basic));
  }
  if (launch.damage) lines.push(getDamageRollButton(launch.damage, `${weapon.name}: Launch`));
  lines.push(`It must be Loaded fully before it can Launch again, and it can't Launch again this round.`);
  lines.push(getVehicleButton("Load", `loadSiege(${JSON.stringify(weapon)}, 0);`));
  return lines.join("\n");
}

// Launch: the range increment the player picks, then the card. It counts as
// an attack for the multiple attack penalty, though nothing is rolled.
function launchSiege(weapon) {
  const token = getSiegeCrewToken();
  const launch = (increments) => {
    const message = getSiegeLaunchMessage(weapon, token, increments);
    logTurnAttack(getTurnAttackMetadata(token, token, { kind: "siege", name: weapon.name }));
    api.sendMessage(message);
  };
  const increment = weapon.launch.increment;
  if (!increment) {
    launch(1);
    return;
  }
  const options = Array.from({ length: SIEGE_MAX_INCREMENTS }, (_, i) => ({
    label: `Up to ${increment * (i + 1)} feet${i ? ` (-${i * 2})` : ""}`,
    value: `${i + 1}`,
  }));
  api.showPrompt("Launch", "How far is it Aimed?", "Select...", options, null, (choice) => {
    const increments = parseInt(pick(choice), 10);
    if (increments) launch(increments);
  }, "OK", "Cancel", 1);
}

// ---------------------------------------------------------------- Misfire

// A black powder weapon's DC 5 flat check (Guns & Gears pg. 172). A natural
// 1 is the critical failure: it explodes, with the save at the standard DC
// of its level, and is destroyed.
function rollSiegeMisfire(weapon) {
  const launch = weapon.launch;
  const explosionDc = Number.isFinite(weapon.level) ? getDCForLevel(weapon.level) : 0;
  const interacts = parseInt(weapon.load.cost, 10);
  const explosion = [
    "",
    "",
    `**The ${weapon.name} explodes and is destroyed!** ${launch.damage ? `${launch.damage} damage` : "Its Launch damage"} to all creatures in a 30-foot emanation, basic Reflex save.`,
    ...(explosionDc ? [`[gm]DC ${explosionDc}.[/gm]`, getSaveMacro("reflex", explosionDc, false, false, [], true)] : []),
    ...(launch.damage ? [getDamageRollButton(launch.damage, `${weapon.name}: explosion`)] : []),
  ].join("\n");
  api.roll(
    "1d20",
    {
      dc: 5,
      rollName: `${weapon.name}: Misfire Check`,
      tooltip: `Flat check before Launching ${weapon.name}, not maintained today`,
      failureNote: `**Misfire:** the ${weapon.name} jams and the attack is a critical failure. To clear the jam the crew uses ${interacts ? `${interacts} Interact action${interacts === 1 ? "" : "s"}` : "as many Interact actions as one Load takes"}, then it can be reloaded.`,
      criticalFailureNote: explosion,
    },
    "flatCheck",
  );
}
