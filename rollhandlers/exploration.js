// Exploration activities (Player Core pg. 438, roadmap H20): each character
// picks what they're doing while exploring (the Exploration section on the
// Skills tab, also a party sheet column), and the encounter's start uses it:
//   - Avoid Notice: picking it sets the initiative skill to Stealth (the
//     player can change it back); at the encounter's start the GM gets a card
//     of the Sneak result against each foe's Perception DC: undetected if it
//     met it, hidden if it missed by 1 to 9, observed by 10 or more (each only
//     with cover or concealment: the GM's call)
//   - Defend: the shield is raised when the encounter starts, if one is
//     equipped and not broken (it lowers at the start of their turn as usual)
//   - Scout: the scout and their allies get a +1 circumstance bonus to
//     initiative
//   - Follow the Expert, Hustle: picking one posts what it gives (Hustle's
//     minutes from Constitution)
// The encounter's start card lists everyone's activity for the GM. Nothing
// is enforced: the GM still decides what applies.

// Picking an activity: the initiative skill to write, if it changes (the
// dropdown saves the activity itself). Avoid Notice rolls Stealth for
// initiative; any other choice puts a Stealth initiative back to Perception.
function getExplorationActivityValues(record, activity) {
  const initiativeSkill = record?.data?.initiativeSkill || "Perception";
  if (activity === "Avoid Notice") {
    return initiativeSkill === "Stealth" ? {} : { "data.initiativeSkill": "Stealth" };
  }
  return initiativeSkill === "Stealth" ? { "data.initiativeSkill": "Perception" } : {};
}

// What the activity gives, as a line for its card (none for the others)
function getExplorationActivityNote(record, activity) {
  if (activity === "Avoid Notice") {
    return "Rolls Stealth for initiative; a foe whose Perception DC it meets doesn't notice them (if they have cover or concealment).";
  }
  if (activity === "Defend") return "Starts an encounter with their shield raised.";
  if (activity === "Scout") return "They and their allies get a +1 circumstance bonus to initiative.";
  if (activity === "Follow the Expert") {
    return "Following an ally at least expert in the skill: a +2 circumstance bonus to checks with it (+3 master, +4 legendary), and their level as a proficiency bonus if untrained.";
  }
  if (activity === "Hustle") {
    const con = parseInt(record?.data?.con, 10) || 0;
    return `Travels at double their travel speed for up to ${Math.max(10, con * 10)} minutes (Constitution modifier x 10, minimum 10); a group hustling together uses its lowest Constitution modifier.`;
  }
  return "";
}

// The Exploration dropdown's onchange (the field has saved the activity): the
// initiative skill, written only if it changes, and a card when the activity
// has a note
function setExplorationActivity(record, activity) {
  if (!record) return;
  const picked = activity === "none" ? "" : activity || "";
  const values = getExplorationActivityValues(record, picked);
  if (Object.keys(values).length) api.setValues(values);
  const note = picked ? getExplorationActivityNote(record, picked) : "";
  if (!note) return;
  api.sendMessage(`**${record.name || "They"}: ${picked}**\n${note}`, undefined, [], [], api.getToken?.() || undefined);
}

// The activity picked ("none", the dropdown's None, is no activity)
function getExplorationActivity(creature) {
  const activity = creature?.data?.explorationActivity || "";
  return activity === "none" ? "" : activity;
}

// The side a creature is on: enemies against everyone else
function isEnemyToken(token) {
  return token?.faction === "enemy";
}

// Scout's +1 circumstance bonus to initiative, for the roller when a scout on
// their side is on the scene (a scout counts for themself)
function getScoutInitiativeModifiers(token, sceneTokens = []) {
  if (!token) return [];
  const scout = [token, ...sceneTokens].find(
    (other) => other && getExplorationActivity(other) === "Scout" && isEnemyToken(other) === isEnemyToken(token),
  );
  if (!scout) return [];
  return [{ name: `Scout (${scout.name || scout.record?.name || "an ally"})`, type: "circumstance", value: 1, active: true }];
}

// The scene's other tokens, as they're read in a hook
function getOtherSceneTokens() {
  return (api.getOtherTokens?.() || []).map((t) => t?.token || t).filter(Boolean);
}

// Avoid Notice at the encounter's start: each foe, with the Sneak result
// against its Perception DC: "undetected" if the Stealth initiative met it,
// "hidden" if it missed by 1 to 9, "observed" by 10 or more
function getAvoidNoticeResults(sneaker, enemies) {
  const result = Math.floor(parseFloat(sneaker?.data?.initiative));
  if (!Number.isFinite(result)) return null;
  return enemies.map((enemy) => {
    const dc = getPerceptionDCForToken(enemy);
    const state = result >= dc ? "undetected" : result > dc - 10 ? "hidden" : "observed";
    return { name: enemy.name || enemy.record?.name || "a foe", dc, state };
  });
}

// The encounter's start card for the GM: everyone's activity, Avoid Notice
// against each foe, and the shields Defend raised
function getExplorationStartCard(tokens, raised = []) {
  const party = tokens.filter((t) => !isEnemyToken(t) && getExplorationActivity(t));
  if (!party.length) return "";
  const enemies = tokens.filter(isEnemyToken);
  const lines = ["**[center]Exploration Activities[/center]**"];
  party.forEach((token) => {
    const activity = getExplorationActivity(token);
    const name = token.name || token.record?.name || "Someone";
    let line = `**${name}:** ${activity}`;
    if (activity === "Defend") {
      line += raised.includes(token._id) ? " (shield raised)" : " (no shield to raise)";
    }
    lines.push(line);
    if (activity === "Avoid Notice") {
      const stealth = token.data?.initiativeStatistic === "stealth";
      const results = stealth ? getAvoidNoticeResults(token, enemies) : null;
      if (!stealth) {
        lines.push(`[gm]${name} didn't roll Stealth for initiative.[/gm]`);
      } else if (results?.length) {
        const foes = (state) => results.filter((r) => r.state === state).map((r) => `${r.name} (DC ${r.dc})`);
        const parts = [
          ["undetected by", foes("undetected")],
          ["hidden from", foes("hidden")],
          ["observed by", foes("observed")],
        ]
          .filter(([, names]) => names.length)
          .map(([label, names]) => `${label} ${names.join(", ")}`);
        lines.push(
          `[gm]Stealth ${Math.floor(parseFloat(token.data.initiative))}: ${parts.join("; ")} (with cover or concealment; without it, observed).[/gm]`,
        );
      }
    }
  });
  return lines.join("\n");
}

// Defend: a character's shield is raised if they have one equipped and it
// isn't broken; the AC is recalculated as when it's raised on the sheet
function raiseShieldForDefend(token) {
  const inventory = Array.isArray(token?.data?.inventory) ? token.data.inventory : [];
  const shield = inventory.find((item) => item?.data?.type === "shield" && item?.data?.carried === "equipped");
  if (!shield || token.data?.shieldBroken === true || token.data?.shieldRaised === "true") return false;
  if (token.recordType !== "characters" || !token.recordId) return false;
  api.getRecord("characters", token.recordId, (record) => {
    if (!record) return;
    api.setValuesOnRecord(record, { "data.shieldRaised": "true" }, (updated) => {
      onAddEditFeature(updated, undefined, true);
    });
  });
  return true;
}

// onEncounterStart: Defend raises shields, then the GM's card
function startEncounterExploration(tokens) {
  const list = (tokens || []).map((t) => t?.token || t).filter(Boolean);
  const raised = list
    .filter((t) => !isEnemyToken(t) && getExplorationActivity(t) === "Defend")
    .filter((t) => raiseShieldForDefend(t))
    .map((t) => t._id);
  const card = getExplorationStartCard(list, raised);
  if (card) api.sendMessage(card);
}
