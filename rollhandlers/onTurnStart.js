const token = data?.token;

// Check if the target's shield is up and is a character
const shieldUp = token?.data?.shieldRaised === "true";
const isCharacter = token?.recordType === "characters";
if (shieldUp && token?.recordId) {
  if (isCharacter) {
    api.getRecord("characters", token?.recordId, (record) => {
      if (record) {
        const valuesToSet = {
          "data.shieldRaised": "false",
        };
        api.setValuesOnRecord(record, valuesToSet, (updatedRecord) => {
          // If update was successful, then recalc AC and  bonuses
          onAddEditFeature(updatedRecord, undefined, true);
        });
      }
    });
  } else if (token?.recordType === "npcs" && token?.recordId) {
    // NPCs don't use onAddEditFeature, so we need to set the values directly

    // Check for a shield in the inventory and use this AC, else default to 2
    const inventory = token?.data?.inventory || [];
    const shield = inventory.find((item) => item.data?.type === "shield");
    const equippedShield = inventory.find(
      (item) =>
        item.data?.carried === "equipped" && item.data?.type === "shield"
    );
    let shieldAc = 2;
    if (equippedShield || shield) {
      // Use equipped shield first, else the other one we find
      shieldAc = equippedShield?.data?.acBonus || shield?.data?.acBonus || 0;
    }

    // If raising, add to AC, else subtract
    const newAC = token?.data?.ac - shieldAc;

    api.setValuesOnTokenById(token?._id, token?.recordType, {
      "data.shieldRaised": "false",
      "data.ac": newAC,
    });
  }
}

// A dying character attempts a recovery check at the start of each of their
// turns (Player Core pg. 411): a chat line with a button to roll it, and one
// for Heroic Recovery with Hero Points (dying.js). Once per round, as Next
// after Previous starts the same turn again.
if (isCharacter && getDyingValue(token) > 0 && !isTokenDead(token)) {
  getCombatRound((round) => {
    if (round !== null && token.data?.recoveryPromptRound === round) return;
    api.sendMessage(getRecoveryCheckPrompt(token), undefined, [], [], token);
    if (round !== null) {
      api.setValuesOnTokenById(token._id, token.recordType, {
        "data.recoveryPromptRound": round,
      });
    }
  });
}

// Fast healing and regeneration: a card with Apply Healing buttons at the
// start of the monster's turn, for the GM to apply (healing-tools.js). Once
// per round.
if (token && token.recordType === "npcs") {
  const selfHealing = getSelfHealing(token);
  if (selfHealing.fastHealing || selfHealing.regeneration) {
    getCombatRound((round) => runTurnStartSelfHealing(token, round));
  }
}

// Recharging abilities ready again this round: the GM is told
// (combat-riders.js)
if (token && Array.isArray(token.data?.recharges) && token.data.recharges.length > 0) {
  getCombatRound((round) => runTurnStartRecharges(token, round));
}

// Whose turn it is, for the attack log: the multiple attack penalty and the
// momentum weapon traits count this turn's attacks (attack-log.js). The round
// keeps the turn's log when Next after Previous starts the same turn again.
setCurrentTurn(token, data?.round);

// Uses per turn and per round come back at the creature's own turn, and
// per turn at every other creature's turn, as in Foundry (limited-uses.js).
// data.tokens is every token in the combat tracker.
getTurnStartRecharges(token, data?.tokens).forEach((recharge) => {
  api.setValuesOnTokenById(recharge.token._id, recharge.token.recordType, recharge.values);
});

// Condition upkeep: the actions the creature has this turn after stunned,
// slowed and quickened, and the stunned it used up. Not again when Next after
// Previous starts the same turn a second time.
if (token && isConditionUpkeepOn() && !isTokenDead(token)) {
  getCombatRound((round) => {
    if (isTurnStartUpkeepDone(token, round)) return;
    const turnActions = getTurnStartActions(token);
    const actionsMessage = getTurnStartActionsMessage(turnActions);
    if (actionsMessage) {
      api.sendMessage(actionsMessage, undefined, [], [], token);
    }
    takeUsedStunned(turnActions, token, () =>
      markTurnStartUpkeep(token, round),
    );
  });
}

// What the creature is sustaining, with Sustain buttons (sustain.js)
remindSustainedSpells(token);
