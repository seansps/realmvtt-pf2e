// Challenges (roadmap B1, B2): Victory Points and the subsystems built on
// them (GM Core pg. 184), on a Challenges record the GM keeps.
//
//   - Types: victory (Victory Points), chase (Chase Points), infiltration
//     (Infiltration, Awareness and Edge Points), research (Research Points)
//     and influence (Influence Points, with Discover)
//   - The GM posts an obstacle's checks (or an NPC's Influence and Discover
//     checks) to chat; each button rolls for the selected tokens with the
//     challenge in the roll's metadata
//   - skill.js adds the result's points and a Score button only the GM can
//     use: it reads the record, adds the points and posts what changed and
//     any threshold reached. Nothing is scored on its own: the GM decides
//     what counts (automatic help, a reroll, a check that doesn't apply)
//   - Next Round counts rounds (infiltration's Awareness goes up 1 each
//     round); Complete awards XP

// ---------------------------------------------------------------- Types

const CHALLENGE_TYPES = {
  victory: { label: "Victory Points", points: "Victory Points", short: "VP" },
  chase: { label: "Chase", points: "Chase Points", short: "CP" },
  infiltration: { label: "Infiltration", points: "Infiltration Points", short: "IP" },
  research: { label: "Research", points: "Research Points", short: "RP" },
  influence: { label: "Influence", points: "Influence Points", short: "IP" },
};

function getChallengeType(data) {
  return CHALLENGE_TYPES[data?.challengeType] ? data.challengeType : "victory";
}

// The points a degree of success brings (2 critical success, 1 success, 0
// failure, -1 critical failure) and the Awareness it adds. Accumulating
// (GM Core pg. 184), Chase Points, Research Points and Influence Points:
// 2/1/0/-1. Diminishing Victory Points: +1/0/-1/-2. Infiltration: 2/1 IP, and
// a failure adds 1 Awareness Point, a critical failure 2 (GM Core pg. 196).
function getChallengePointChange(type, degree, diminishing = false) {
  const d = parseInt(degree, 10);
  if (type === "infiltration") {
    return { points: d === 2 ? 2 : d === 1 ? 1 : 0, awareness: d === 0 ? 1 : d === -1 ? 2 : 0 };
  }
  if (type === "victory" && diminishing) {
    return { points: d === 2 ? 1 : d === 1 ? 0 : d === 0 ? -1 : -2, awareness: 0 };
  }
  return { points: d === 2 ? 2 : d === 1 ? 1 : d === -1 ? -1 : 0, awareness: 0 };
}

// "+2 CP", "-1 VP", "+1 Awareness"
function describeChallengeChange(type, change) {
  const parts = [];
  if (change.points) parts.push(`${change.points > 0 ? "+" : ""}${change.points} ${CHALLENGE_TYPES[type].short}`);
  if (change.awareness) parts.push(`+${change.awareness} Awareness`);
  return parts.join(", ");
}

// ---------------------------------------------------------------- Checks

// An obstacle's checks as the stat blocks print them: "DC 23 Diplomacy or
// Society; DC 28 Athletics", "Athletics DC 20 or Acrobatics DC 18",
// "Library Lore 18, Occultism 23". A skill without its own DC takes the next
// DC in its part (up to a semicolon), else the one before it.
function parseChallengeChecks(text) {
  const checks = [];
  `${text || ""}`.split(";").forEach((chunk) => {
    const parts = chunk
      .split(/,|\bor\b|\//i)
      .map((part) => {
        const dc = part.match(/\d+/);
        const skill = part
          .replace(/\bDC\b/gi, "")
          .replace(/[+-]?\d+/g, "")
          .replace(/\s+/g, " ")
          .trim();
        return { skill, dc: dc ? parseInt(dc[0], 10) : null };
      })
      .filter((part) => part.skill);
    parts.forEach((part, index) => {
      if (part.dc !== null) return;
      const next = parts.slice(index + 1).find((p) => p.dc !== null);
      const previous = parts.slice(0, index).reverse().find((p) => p.dc !== null);
      part.dc = (next || previous)?.dc ?? null;
    });
    parts.filter((part) => part.dc !== null).forEach((part) => checks.push(part));
  });
  return checks;
}

// A roll button for a check, carrying the challenge (the record and
// obstacle) to skill.js. The label has no DC, as getCallForCheckMessage's
// (gm-tools.js): players see the skill, the GM the DC.
function getChallengeCheckButton(check, challenge) {
  const label = `Roll_${check.skill.replace(/[^\w]+/g, "_")}`;
  return `\`\`\`${label}\nrollChallengeCheck(${JSON.stringify(check.skill)}, ${check.dc}, ${JSON.stringify(challenge)});\n\`\`\``;
}

// A creature's Lore by name ("Library Lore"), or null
function findLoreSkill(creature, skill) {
  const name = `${skill || ""}`.trim().toLowerCase();
  return (creature?.data?.loreSkills || []).find((lore) => `${lore?.name || ""}`.trim().toLowerCase() === name) || null;
}

// A challenge check for each selected (or dropped-on) token. A Lore is the
// creature's own, by name; one it doesn't have rolls untrained, with its
// Intelligence modifier. Discover is rolled as its action, which has the
// secret trait (GM Core pg. 187; SECRET_ACTIONS, check-tools.js).
function rollChallengeCheck(skill, dc, challenge) {
  const tokens = api.getSelectedOrDroppedToken() || [];
  if (!tokens.length) {
    api.showNotification("Select the tokens that make the check.", "yellow", "Challenge");
    return;
  }
  const metadata = challenge?.discover ? { challenge, action: "Discover" } : { challenge };
  tokens.forEach((token) => rollNamedSkill(token, skill, dc, metadata));
}

// A check with a skill as a stat block names it ("Arcana", "Piloting
// Lore"), for one token, with rollSkill's metadata (vehicles.js uses it too)
function rollNamedSkill(token, skill, dc, metadata) {
  if (/\blore\b/i.test(skill)) {
    const lore = findLoreSkill(token, skill);
    const mod = lore ? parseInt(lore.data?.mod, 10) || 0 : parseInt(token?.data?.intMod ?? 0, 10) || 0;
    const rank = lore ? parseInt(lore.data?.rank, 10) || 0 : 0;
    rollSkill(token, lore?.name || skill, dc, true, mod, rank, lore?.data?.ability || "int", true, false, undefined, metadata);
  } else {
    rollSkill(token, skill.toLowerCase(), dc, false, 0, 1, "int", true, false, undefined, metadata);
  }
}

// The chat card for an obstacle's checks: the DCs are in the buttons only,
// and in [gm] lines
function getChallengeObstacleMessage(record, obstacle) {
  const data = record?.data || {};
  const type = getChallengeType(data);
  const checks = parseChallengeChecks(obstacle?.data?.checks);
  const challenge = {
    recordId: record._id,
    obstacleId: obstacle?._id || null,
    type,
    name: record.name || CHALLENGE_TYPES[type].label,
    obstacle: obstacle?.name || "",
    diminishing: data.scoring === "diminishing",
  };
  const lines = [`**[center]${challenge.name}: ${challenge.obstacle}[/center]**`];
  const goal = parseInt(obstacle?.data?.goal, 10) || 0;
  if (goal > 0) {
    const have = parseInt(obstacle?.data?.points, 10) || 0;
    lines.push(`[center]${type === "research" ? `${have} of ${goal} RP found here` : `${have} of ${goal} ${CHALLENGE_TYPES[type].short}`}[/center]`);
  }
  if (!checks.length) {
    lines.push("[gm]No checks to post: write them like \"Athletics DC 20 or Acrobatics DC 18\".[/gm]");
    return lines.join("\n");
  }
  lines.push(`[gm]${checks.map((c) => `${c.skill} DC ${c.dc}`).join(", ")}[/gm]`);
  checks.forEach((check) => lines.push(getChallengeCheckButton(check, challenge)));
  return lines.join("\n");
}

// The obstacle row's Call button
function postChallengeObstacle(recordId, obstacleId) {
  api.getRecord("challenges", recordId, (record) => {
    const obstacle = (record?.data?.obstacles || []).find((o) => o._id === obstacleId);
    if (!obstacle) return;
    api.sendMessage(getChallengeObstacleMessage(record, obstacle));
  });
}

// An Influence encounter's checks: Influence (the influence skills) or
// Discover (Perception and the discovery skills), GM Core pg. 187
function getInfluenceMessage(record, kind) {
  const data = record?.data || {};
  const discover = kind === "discover";
  const checks = parseChallengeChecks(discover ? data.discovery : data.influenceSkills);
  const challenge = {
    recordId: record._id,
    obstacleId: null,
    type: "influence",
    name: record.name || "Influence",
    obstacle: discover ? "Discover" : "Influence",
    discover,
  };
  const lines = [`**[center]${challenge.name}: ${challenge.obstacle}[/center]**`];
  if (!checks.length) {
    lines.push(`[gm]No ${discover ? "discovery" : "influence"} checks: write them like "Perception DC 20, Society DC 18".[/gm]`);
    return lines.join("\n");
  }
  lines.push(`[gm]${checks.map((c) => `${c.skill} DC ${c.dc}`).join(", ")}[/gm]`);
  [data.resistances && `Resistances: ${data.resistances}`, data.weaknesses && `Weaknesses: ${data.weaknesses}`]
    .filter(Boolean)
    .forEach((line) => lines.push(`[gm]${line}[/gm]`));
  checks.forEach((check) => lines.push(getChallengeCheckButton(check, challenge)));
  return lines.join("\n");
}

function postInfluenceChecks(recordId, kind) {
  api.getRecord("challenges", recordId, (record) => {
    if (record) api.sendMessage(getInfluenceMessage(record, kind));
  });
}

// ---------------------------------------------------------------- Results

const DISCOVER_RESULTS = {
  2: "Learns two: the lowest-DC Influence skill not yet known, a bias, a resistance or a weakness (the same one twice allowed).",
  1: "Learns one: the lowest-DC Influence skill not yet known, a bias, a resistance or a weakness.",
  0: "Learns nothing.",
  "-1": "Learns one, but it's wrong.",
};

// The lines skill.js adds for a challenge check: the points, and a Score
// button for the GM. An infiltration failure can also spend an Edge Point
// to succeed instead.
function getChallengeResultLines(challenge, degree) {
  if (!challenge?.recordId || degree === null || degree === undefined) return [];
  const type = CHALLENGE_TYPES[challenge.type] ? challenge.type : "victory";
  if (challenge.discover) return [`[gm]**Discover:** ${DISCOVER_RESULTS[degree] || ""}[/gm]`];
  const change = getChallengePointChange(type, degree, challenge.diminishing);
  const where = challenge.obstacle ? ` (${challenge.obstacle})` : "";
  const args = `${JSON.stringify(challenge.recordId)}, ${JSON.stringify(challenge.obstacleId || null)}`;
  const lines = [];
  const described = describeChallengeChange(type, change);
  if (!described) {
    lines.push(`**${CHALLENGE_TYPES[type].label}:** no points${where}.`);
  } else {
    lines.push(`**${CHALLENGE_TYPES[type].label}:** ${described}${where}.`);
    // GM Core pg. 184: only if regaining ground is possible
    if (type === "victory" && challenge.diminishing && degree === 2) {
      lines.push("[gm]Only if regaining ground is possible; otherwise it counts as a success.[/gm]");
    }
    lines.push(`\`\`\`Score_${described.replace(/[^\w+-]+/g, "_")}\nscoreChallenge(${args}, ${degree});\n\`\`\``);
  }
  if (type === "infiltration" && degree <= 0) {
    lines.push(`\`\`\`Spend_Edge_Point\nscoreChallenge(${args}, 1, true);\n\`\`\``);
  }
  return lines;
}

// The thresholds a total passed going from before to after, in the order
// passed: up, lowest first; down (a diminishing subsystem), highest first.
// track: "points" or "awareness".
function getReachedThresholds(thresholds, track, before, after) {
  if (after === before) return [];
  const up = after > before;
  return (thresholds || [])
    .filter((t) => (t?.data?.track || "points") === track)
    .map((t) => ({ points: parseInt(t?.data?.points, 10) || 0, outcome: t?.data?.outcome || t?.name || "" }))
    .filter((t) => (up ? t.points > before && t.points <= after : t.points < before && t.points >= after))
    .sort((a, b) => (up ? a.points - b.points : b.points - a.points));
}

// One line for the sheet and the cards: "5 VP", "2 of 6 obstacles
// overcome", "4 IP, 3 Awareness, 1 Edge", with the round
function getChallengeSummary(data) {
  const type = getChallengeType(data);
  const points = parseInt(data?.points, 10) || 0;
  const obstacles = data?.obstacles || [];
  const overcome = obstacles.filter((o) => {
    const goal = parseInt(o?.data?.goal, 10) || 0;
    return goal > 0 && (parseInt(o?.data?.points, 10) || 0) >= goal;
  }).length;
  let summary = `${points} ${CHALLENGE_TYPES[type].short}`;
  if (type === "chase") summary = `${overcome} of ${obstacles.length} obstacles overcome`;
  if (type === "infiltration") {
    summary += `, ${parseInt(data?.awareness, 10) || 0} Awareness, ${parseInt(data?.edge, 10) || 0} Edge`;
  }
  const round = parseInt(data?.round, 10) || 0;
  const limit = parseInt(data?.roundLimit, 10) || 0;
  if (round > 0) summary += `; round ${round}${limit ? ` of ${limit}` : ""}`;
  return summary;
}

// What scoring a degree does to the record: { values, lines }. The points go
// on the obstacle, up to what it needs (Chase Points don't carry over;
// a section's Research Points stop at its maximum), and the same change on
// the total. Nothing goes below 0. useEdge: an infiltration failure
// spends an Edge Point to count as a success.
function getChallengeScoreValues(record, obstacleId, degree, useEdge = false) {
  const data = record?.data || {};
  const type = getChallengeType(data);
  const values = {};
  const lines = [];
  const edge = parseInt(data.edge, 10) || 0;
  if (useEdge) {
    if (edge <= 0) return { values, lines: ["No Edge Points left."], refused: true };
    values["data.edge"] = edge - 1;
    lines.push("An Edge Point turns the failure into a success.");
  }
  const change = getChallengePointChange(type, useEdge ? 1 : degree, data.scoring === "diminishing");
  let applied = change.points;
  const obstacles = data.obstacles || [];
  const index = obstacles.findIndex((o) => o._id === obstacleId);
  const obstacle = index >= 0 ? obstacles[index] : null;
  if (obstacle) {
    const before = parseInt(obstacle.data?.points, 10) || 0;
    const goal = parseInt(obstacle.data?.goal, 10) || 0;
    let after = Math.max(0, before + change.points);
    if (goal > 0) after = Math.min(goal, after);
    applied = after - before;
    if (after !== before) values[`data.obstacles.${index}.data.points`] = after;
    if (goal > 0 && after >= goal && before < goal) {
      lines.push(type === "research" ? `${obstacle.name}: nothing more to find here.` : `${obstacle.name} is overcome.`);
      const next = obstacles.slice(index + 1).find((o) => (parseInt(o.data?.points, 10) || 0) < (parseInt(o.data?.goal, 10) || 0));
      if (type === "chase" && next) lines.push(`Next obstacle: ${next.name}.`);
    }
  }
  const points = parseInt(data.points, 10) || 0;
  const total = Math.max(0, points + applied);
  if (total !== points) values["data.points"] = total;
  // Diminishing Victory Points: the thresholds are drawbacks, reached as the
  // points fall, and losing them all is a negative event (GM Core pg. 184-185)
  const diminishing = type === "victory" && data.scoring === "diminishing";
  if (diminishing ? total < points : total > points) {
    getReachedThresholds(data.thresholds, "points", points, total).forEach((t) => {
      lines.push(`[gm]Threshold ${t.points} ${CHALLENGE_TYPES[type].short}: ${t.outcome}[/gm]`);
    });
  }
  if (diminishing && total === 0 && points > 0) {
    lines.push("[gm]No Victory Points left: a negative event occurs.[/gm]");
  }
  if (change.awareness) {
    const awareness = parseInt(data.awareness, 10) || 0;
    values["data.awareness"] = awareness + change.awareness;
    getReachedThresholds(data.thresholds, "awareness", awareness, awareness + change.awareness).forEach((t) => {
      lines.push(`[gm]Awareness ${t.points}: ${t.outcome}[/gm]`);
    });
  }
  const after = { ...data, points: total, awareness: values["data.awareness"] ?? data.awareness, edge: values["data.edge"] ?? data.edge };
  if (obstacle && values[`data.obstacles.${index}.data.points`] !== undefined) {
    after.obstacles = obstacles.map((o, i) => (i === index ? { ...o, data: { ...o.data, points: values[`data.obstacles.${index}.data.points`] } } : o));
  }
  values["data.summary"] = getChallengeSummary(after);
  return { values, lines, summary: values["data.summary"] };
}

// The result card's Score button (GM only): reads the record, writes the
// change once and posts it
function scoreChallenge(recordId, obstacleId, degree, useEdge = false) {
  if (typeof isGM !== "undefined" && !isGM) {
    api.showNotification("Only the GM scores a challenge.", "yellow", "Challenge");
    return;
  }
  api.getRecord("challenges", recordId, (record) => {
    if (!record) return;
    const { values, lines, summary, refused } = getChallengeScoreValues(record, obstacleId, degree, useEdge);
    if (refused) {
      api.showNotification(lines[0], "yellow", record.name || "Challenge");
      return;
    }
    api.setValuesOnRecord(record, values, () => {
      api.sendMessage([`**${record.name || "Challenge"}:** ${summary}`, ...lines].join("\n"));
    });
  });
}

// ---------------------------------------------------------------- Rounds

// Next Round: the round goes up 1; an infiltration's Awareness too (GM Core
// pg. 196). Says when the round passes the limit.
function getChallengeRoundValues(record) {
  const data = record?.data || {};
  const type = getChallengeType(data);
  const round = (parseInt(data.round, 10) || 0) + 1;
  const limit = parseInt(data.roundLimit, 10) || 0;
  const values = { "data.round": round };
  const lines = [];
  if (type === "infiltration") {
    const awareness = parseInt(data.awareness, 10) || 0;
    values["data.awareness"] = awareness + 1;
    lines.push("Awareness +1 for the round.");
    getReachedThresholds(data.thresholds, "awareness", awareness, awareness + 1).forEach((t) => {
      lines.push(`[gm]Awareness ${t.points}: ${t.outcome}[/gm]`);
    });
  }
  if (limit && round > limit) lines.push(`[gm]Past the ${limit}-round limit.[/gm]`);
  values["data.summary"] = getChallengeSummary({ ...data, round, awareness: values["data.awareness"] ?? data.awareness });
  return { values, lines, summary: values["data.summary"] };
}

function advanceChallengeRound(recordId) {
  api.getRecord("challenges", recordId, (record) => {
    if (!record) return;
    const { values, lines, summary } = getChallengeRoundValues(record);
    api.setValuesOnRecord(record, values, () => {
      api.sendMessage([`**${record.name || "Challenge"}:** ${summary}`, ...lines].join("\n"));
    });
  });
}

// ---------------------------------------------------------------- XP

// Complete: accomplishment XP (GM Core pg. 57), or an encounter's when the
// challenge was as demanding as one (pg. 184)
const CHALLENGE_XP_OPTIONS = [
  { label: "Minor accomplishment (10 XP)", value: "10" },
  { label: "Moderate accomplishment (30 XP)", value: "30" },
  { label: "Major accomplishment (80 XP)", value: "80" },
  { label: "As a moderate encounter (80 XP)", value: "80e" },
  { label: "As a severe encounter (120 XP)", value: "120e" },
  { label: "No XP", value: "0" },
];

function completeChallenge(recordId, name) {
  api.showPrompt(
    name || "Challenge",
    "Award XP for the challenge?",
    "Select...",
    CHALLENGE_XP_OPTIONS,
    null,
    (choice) => {
      const xp = parseInt(Array.isArray(choice) ? choice[0] : choice, 10) || 0;
      if (!xp) return;
      api.awardExp(xp, `${name || "Challenge"} completed.`);
      api.sendMessage(`Awarded ${xp} XP to the Party for ${name || "the challenge"}.`);
    },
    "Award",
    "Cancel",
    1,
  );
}
