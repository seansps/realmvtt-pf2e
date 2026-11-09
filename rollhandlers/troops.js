// Troops (roadmap B15; NPC Core pg. 7, Battlecry! pg. 159-161). A troop loses
// a segment as it drops below a Hit Point threshold, and that threshold
// becomes its maximum Hit Points, so the maximum is the only state there is.
// Rout checks and a leader's five actions are the GM's to call for: chat
// buttons and the GM Tools panel.

const TROOP_ROUT_TRAITS = ["emotion", "fear", "mental"];

function isTroop(creature) {
  return (creature?.data?.traits || []).some((trait) => `${trait}`.toLowerCase() === "troop");
}

// The printed thresholds, highest first: [{ hp: 60, segments: 3 }, ...]. They
// are in the HP entry, or in the troop defenses ability.
function getTroopThresholds(creature) {
  const defenses = (creature?.data?.actions || []).find((action) => `${action.name}`.toLowerCase() === "troop defenses");
  const read = (text) =>
    [...`${text ?? ""}`.matchAll(/(\d+)\s*\((\d+)\s+segments?\)/gi)].map((match) => ({
      hp: parseInt(match[1], 10),
      segments: parseInt(match[2], 10),
    }));
  const printed = read(creature?.data?.hpDetails);
  return (printed.length ? printed : read(defenses?.data?.description)).sort((a, b) => b.hp - a.hp);
}

// What a troop now at this many Hit Points has lost: { lost, segments, max },
// or null. At 0 it disperses instead, so there's nothing left to count.
function getTroopSegmentLoss(creature, curhp) {
  if (!isTroop(creature) || curhp <= 0) return null;
  const max = parseInt(creature.data?.hitpoints, 10) || 0;
  const crossed = getTroopThresholds(creature).filter((threshold) => max > threshold.hp && curhp < threshold.hp);
  if (!crossed.length) return null;
  const lowest = crossed[crossed.length - 1];
  return { lost: crossed.length, segments: lowest.segments, max: lowest.hp };
}

const getTroopLossText = (creature, loss) =>
  `**${getCreatureName(creature)} loses ${loss.lost === 1 ? "a segment" : `${loss.lost} segments`}: ${loss.segments} left.** Whoever caused it chooses which, or the GM.`;

// The line for the damage message; null when nothing happened to the troop
function getTroopDamageLine(creature, curhp, loss) {
  if (!isTroop(creature)) return null;
  if (curhp <= 0) return `**${getCreatureName(creature)} disperses,** its last members surrendering, fleeing or easily dispatched, as the GM decides.`;
  return loss ? getTroopLossText(creature, loss) : null;
}

// A mindless troop, or one immune to the check's traits, never rolls
function isTroopUnroutable(creature) {
  const traits = (creature?.data?.traits || []).map((trait) => `${trait}`.toLowerCase());
  const immunities = (creature?.data?.immunities || []).map((row) => `${row.data?.type}`.toLowerCase());
  return traits.includes("mindless") || TROOP_ROUT_TRAITS.some((trait) => immunities.includes(trait));
}

function getTroopRoutButtons(creature) {
  return isTroopUnroutable(creature) ? [] : [getChatButton("Rout_Check", creature, "promptTroopRout(token)")];
}

// A rout check: Will against the standard DC of the enemy's level (Battlecry!
// pg. 160). A troop with a leader gets a result one degree better.
function promptTroopRout(token) {
  const levels = [];
  for (let level = -1; level <= 25; level += 1) levels.push({ label: `Level ${level}`, value: `${level}` });
  api.showPrompt("Rout Check", "The level of the enemy that damaged it?", "Select...", levels, null, (levelChoice) => {
    const level = parseInt(pick(levelChoice), 10);
    if (!Number.isFinite(level)) return;
    const options = [
      { label: "No leader", value: "no" },
      { label: "Has a leader (one degree better)", value: "yes" },
    ];
    api.showPrompt("Rout Check", "Does it have a leader?", "Select...", options, null, (leaderChoice) => {
      const led = pick(leaderChoice);
      if (!led) return;
      rollSave(token, "will", getDCForLevel(level), false, false, {
        traits: TROOP_ROUT_TRAITS,
        troopRout: { tokenId: token._id, name: getCreatureName(token), led: led === "yes" },
      });
    });
  });
}

// The result lines save.js adds to a rout check
function getTroopRoutLines(metadata, degree) {
  const rout = metadata?.troopRout;
  if (!rout || !Number.isFinite(degree)) return [];
  const result = rout.led ? Math.min(degree + 1, 2) : degree;
  const led = rout.led && result !== degree ? " (one degree better, for its leader)" : "";
  const frightened = (value) => [
    `**Rout:** The troop is frightened ${value}${led}.`,
    getChatButton(`Apply_Frightened_${value}`, { _id: rout.tokenId, name: rout.name }, `api.addEffects(${JSON.stringify(Array(value).fill("Frightened"))}, token)`),
  ];
  if (result >= 2) return [`**Rout:** The troop is unaffected${led}.`];
  if (result === 1) return frightened(1);
  if (result === 0) return frightened(2);
  return ["**Rout:** The troop breaks formation and runs away, and is removed from the battle."];
}

// ----------------------------------------------------------- The GM panel

function getSelectedTroops() {
  const troops = (api.getSelectedTokens() || []).map((selected) => selected?.token || selected).filter(isTroop);
  if (!troops.length) api.showNotification("Select a troop's token first.", "yellow", "Troops");
  return troops;
}

function rollSelectedTroopRouts() {
  const [troop] = getSelectedTroops();
  if (troop) promptTroopRout(troop);
}

// A non-damaging effect that takes a segment out of the fight costs the HP
// that brings the troop to its next threshold (troop defenses)
function getTroopRemovalValues(token) {
  const max = parseInt(token.data?.hitpoints, 10) || 0;
  const next = getTroopThresholds(token).find((threshold) => max > threshold.hp);
  if (!next) return null;
  const current = parseInt(token.data?.curhp, 10) || 0;
  return { values: { "data.hitpoints": next.hp, "data.curhp": Math.min(current, next.hp) }, segments: next.segments };
}

function removeSelectedTroopSegments() {
  getSelectedTroops().forEach((troop) => {
    const removal = getTroopRemovalValues(troop);
    if (!removal) {
      api.showNotification(`${getCreatureName(troop)} has no threshold left to fall to.`, "yellow", "Troops");
      return;
    }
    api.setValuesOnTokenById(troop._id, troop.recordType, removal.values);
    const buttons = getTroopRoutButtons(troop).map((button) => `\n${button}`).join("");
    api.sendMessage(`${getTroopLossText(troop, { lost: 1, segments: removal.segments })}${buttons}`);
  });
}

// A leader's five actions for the round (Battlecry! pg. 159)
function getTroopActionsMessage(leader, own, troop) {
  return `**${getCreatureName(leader)} leads their troop:** ${own} actions for themself and ${troop} for the troop. Each regains 1 reaction. Either goes first, but they can't alternate. Slowed and quickened count separately.`;
}

function postTroopLeaderActions() {
  const leader = (api.getSelectedTokens() || []).map((selected) => selected?.token || selected)[0];
  if (!leader) {
    api.showNotification("Select the leader's token first.", "yellow", "Troops");
    return;
  }
  const options = [
    { label: "3 for the leader, 2 for the troop", value: "3" },
    { label: "2 for the leader, 3 for the troop", value: "2" },
  ];
  api.showPrompt("Five Actions", "How are they split?", "Select...", options, null, (choice) => {
    const own = parseInt(pick(choice), 10);
    if (Number.isFinite(own)) api.sendMessage(getTroopActionsMessage(leader, own, 5 - own));
  });
}
