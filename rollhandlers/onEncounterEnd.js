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

  // XP lookup tables
  const creatureXP = {
    "-4": 10,
    "-3": 15,
    "-2": 20,
    "-1": 30,
    0: 40,
    1: 60,
    2: 80,
    3: 120,
    4: 160,
  };

  const simpleHazardXP = {
    "-4": 2,
    "-3": 3,
    "-2": 4,
    "-1": 6,
    0: 8,
    1: 12,
    2: 16,
    3: 24,
    4: 32,
  };

  const complexHazardXP = {
    "-4": 10,
    "-3": 15,
    "-2": 20,
    "-1": 30,
    0: 40,
    1: 60,
    2: 80,
    3: 120,
    4: 160,
  };

  // Filter enemy tokens
  const enemies = (data?.tokens || []).filter((t) => t?.faction === "enemy");

  // Calculate XP for each enemy
  let totalXP = 0;
  const xpBreakdown = [];

  enemies.forEach((token) => {
    const tokenLevel = token?.data?.level || 0;
    const tokenType = token?.data?.type;
    const levelDiff = tokenLevel - avgPartyLevel;

    let xp = 0;
    let typeLabel = "";

    // Creatures more than 4 levels below the party grant 0 XP
    if (levelDiff < -4) {
      xp = 0;
      typeLabel =
        tokenType === "hazard" ? "Trivial Hazard" : "Trivial Creature";
    } else {
      // Clamp level difference to -4 to +4 for XP lookup
      const clampedDiff = Math.max(-4, Math.min(4, levelDiff));
      const diffKey = clampedDiff.toString();

      // Determine if it's a hazard or creature
      if (tokenType === "hazard") {
        const isComplex = token?.data?.isComplex || false;
        if (isComplex) {
          xp = complexHazardXP[diffKey];
          typeLabel = "Complex Hazard";
        } else {
          xp = simpleHazardXP[diffKey];
          typeLabel = "Simple Hazard";
        }
      } else {
        // null, undefined, or "npc" are treated as creatures
        xp = creatureXP[diffKey];
        typeLabel = "Creature";
      }
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
