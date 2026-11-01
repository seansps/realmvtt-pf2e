// Recharging abilities don't carry into the next encounter
// (combat-riders.js)
clearEncounterRecharges(data?.tokens);

// On Encounter End, calculate XP based on PF2e rules
// Find all non-enemy character tokens in the combat
const partyTokens = (data?.tokens || []).filter(
  (t) => t?.faction !== "enemy" && t?.recordType === "characters"
);

if (partyTokens.length > 0) {
  // Calculate average party level from characters in combat
  const partyLevels = partyTokens.map((token) => token.data.level || 1);
  const avgPartyLevel = Math.round(
    partyLevels.reduce((sum, level) => sum + level, 0) / partyLevels.length
  );
  const partySize = partyTokens.length;

  // Filter enemy tokens
  const enemies = (data?.tokens || []).filter((t) => t?.faction === "enemy");

  // Calculate XP for each enemy
  let totalXP = 0;
  const xpBreakdown = [];

  enemies.forEach((token) => {
    const tokenLevel = token?.data?.level || 0;
    const tokenType = token?.data?.type;
    const levelDiff = tokenLevel - avgPartyLevel;

    // Creatures too far below the party grant no XP; Proficiency without
    // Level uses its own table (gm-tools.js)
    const isHazard = tokenType === "hazard";
    const isComplex = !!token?.data?.isComplex;
    const xp = getEncounterXp(levelDiff, { hazard: isHazard, complex: isComplex });
    let typeLabel = isHazard ? (isComplex ? "Complex Hazard" : "Simple Hazard") : "Creature";
    if (xp === 0) {
      typeLabel = isHazard ? "Trivial Hazard" : "Trivial Creature";
    }

    totalXP += xp;
    xpBreakdown.push({
      name: token.name || "Unknown",
      level: tokenLevel,
      type: typeLabel,
      xp: xp,
    });
  });

  // Determine encounter severity based on XP budget adjusted for party size
  // Base budgets are for 4 characters, adjust for different party sizes
  const partyAdjustment = partySize - 4;

  const trivialBudget = 40 + partyAdjustment * 10;
  const lowBudget = 60 + partyAdjustment * 20;
  const moderateBudget = 80 + partyAdjustment * 20;
  const severeBudget = 120 + partyAdjustment * 30;
  const extremeBudget = 160 + partyAdjustment * 40;

  let adjustmentMessage = "";
  let adjustmentAsterix = "";
  if (partyAdjustment !== 0) {
    adjustmentAsterix = "*";
    adjustmentMessage = `[center](*After Party Size Adjustment: ${partyAdjustment})[/center]`;
  }

  let severity = `Trivial${adjustmentAsterix}`;
  if (totalXP > extremeBudget) {
    severity = `Beyond Extreme${adjustmentAsterix}`;
  } else if (totalXP >= extremeBudget) {
    severity = `Extreme${adjustmentAsterix}`;
  } else if (totalXP >= severeBudget) {
    severity = `Severe${adjustmentAsterix}`;
  } else if (totalXP >= moderateBudget) {
    severity = `Moderate${adjustmentAsterix}`;
  } else if (totalXP >= lowBudget) {
    severity = `Low${adjustmentAsterix}`;
  } else if (totalXP <= trivialBudget) {
    severity = `Trivial${adjustmentAsterix}`;
  }

  // Adjust XP awards based on party size
  // Formula: (Total XP × 4) ÷ Party Size = XP per character
  // This normalizes progression for non-standard party sizes
  const adjustedXP = Math.floor((totalXP * 4) / (partySize || 4));

  // Build party size adjustment message if not standard
  let partySizeMessage = "";
  if (partySize !== 4) {
    partySizeMessage = `[center]Party Size: ${partySize} | Base XP: ${totalXP} → Adjusted: ${adjustedXP}[/center]\n`;
  }

  // Build macro for awarding XP
  let macro = "";
  if (enemies.length > 0) {
    macro = `\`\`\`Award_XP
if (isGM) {
  api.awardExp(${adjustedXP}, 'Encounter with ${enemies.length} enemies (${severity}).');
  api.sendMessage('Awarded ${adjustedXP} XP to the Party.');
}
\`\`\`
`;

    // Build breakdown message
    let breakdownMsg = xpBreakdown
      .map((e) => `- ${e.name} (Lvl ${e.level} ${e.type}): ${e.xp} XP`)
      .join("\n");

    api.sendMessage(
      `**[center]Encounter Ended[/center]**
[center]Party Level: ${avgPartyLevel} | Severity: ${severity}[/center]
${partySizeMessage}${adjustmentMessage}**[center]${adjustedXP} XP awarded to each party member[/center]**

**Breakdown:**
${breakdownMsg}

${macro}`
    );
  }
}

// Rage ends with the encounter, and the temporary Hit Points left from it go
// (class-extras.js)
{
  const rageLines = clearRageTempHp(data?.tokens);
  if (rageLines.length > 0) api.sendMessage(rageLines.join("\n"));
}

// End the effects that last one encounter (stances, Panache, Rage and the
// like), as Foundry does when an encounter ends. Realm doesn't end them
// itself: ending an encounter only resets the combat tracker.
{
  const removals = getEncounterEndRemovals(data?.tokens);
  const removing = new Map(removals.map(({ token, effects }) => [token, effects]));
  // Then forget the turn rounds the condition upkeep kept on each token
  getEncounterTokens(data?.tokens).forEach((token) => {
    const effectIds = (removing.get(token) || []).map((effect) => effect._id);
    removeEffectsInOrder(effectIds, token, () =>
      clearConditionUpkeepRounds(token),
    );
  });
  const summary = getEncounterEndSummary(removals);
  if (summary) {
    api.sendMessage(summary);
  }
}

// Uses per minute, round and turn come back when the encounter ends
// (limited-uses.js)
getEncounterTokens(data?.tokens)
  .filter((token) => token?.recordType === "characters")
  .forEach((token) => {
    const recharges = getLimitedUseRecharges(token, "encounterEnd");
    if (Object.keys(recharges).length > 0) {
      api.setValuesOnTokenById(token._id, token.recordType, recharges);
    }
  });

// The encounter is over: encounter predicates no longer hold, and no one's
// turn is being taken (attack-log.js)
setEncounterState([], 0);
setCurrentTurn(null);

// Sustained spells' lists start over next encounter (sustain.js)
clearSustainedSpells(data?.tokens);
