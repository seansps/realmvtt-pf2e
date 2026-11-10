// Recovery Check handler for PF2e (Player Core pg. 411)
// Recovery checks are flat checks with DC = 10 + current dying value (1 lower
// with Toughness)
// Critical Success: dying value reduced by 2
// Success: dying value reduced by 1
// Failure: dying value increased by 1
// Critical Failure: dying value increased by 2
// Losing dying adds 1 wounded. The character dies at the dying value they die
// at: 4, or 5 with Diehard, less their doomed value (dying.js).

const metadata = data?.roll?.metadata || {};
// The character: the one the turn-start button was for, or the sheet's
const recordId = metadata.recordId || record?.recordId || record?._id;
const minRoll = metadata.minRoll;

// Find the unddropped d20, and if minroll is set
// alter the actual roll to be the minroll if it's lower
const roll = {
  ...data.roll,
  dice: [...(data?.roll?.dice || [])],
  total: data?.roll?.total !== undefined ? data?.roll?.total : 0,
};

if (roll.dice) {
  roll.dice = roll.dice.map((d) => {
    let value = parseInt(d.value, 10);
    if (d.type === 20 && d.reason !== "dropped") {
      if (minRoll && value < minRoll) {
        roll.total += minRoll - value;
        value = minRoll;
      }
    }
    return {
      ...d,
      value: value,
    };
  });
}

// Requery the record in case of multiple recovery checks
api.getRecord("characters", recordId, (record) => {
  const currentDying = getDyingValue(record);
  const dc = getRecoveryCheckDC(record, currentDying);

  // Find the natural d20 roll (not dropped)
  let naturalRoll = 0;
  if (roll.dice) {
    const d20 = roll.dice.find((d) => d.type === 20 && d.reason !== "dropped");
    if (d20) {
      naturalRoll = parseInt(d20.value, 10);
    }
  }

  // Recovery checks are FLAT CHECKS - no modifiers applied
  // Use only the raw die roll for comparison
  const flatCheckTotal = naturalRoll;

  // Calculate the degree of success using PF2e rules
  let degreeOfSuccess = 0; // 0 = failure, 1 = success, 2 = critical success, -1 = critical failure

  // First, determine base degree of success
  if (flatCheckTotal >= dc + 10) {
    degreeOfSuccess = 2; // Critical Success
  } else if (flatCheckTotal >= dc) {
    degreeOfSuccess = 1; // Success
  } else if (flatCheckTotal <= dc - 10) {
    degreeOfSuccess = -1; // Critical Failure
  } else {
    degreeOfSuccess = 0; // Failure
  }

  // Apply natural 20/1 adjustments
  if (naturalRoll === 20 && degreeOfSuccess < 2) {
    degreeOfSuccess += 1; // Natural 20 improves degree by one step (max critical success)
  } else if (naturalRoll === 1 && degreeOfSuccess > -1) {
    degreeOfSuccess -= 1; // Natural 1 worsens degree by one step (min critical failure)
  }

  // Calculate margin for GM display
  const margin = flatCheckTotal - dc;
  const marginText = margin >= 0 ? `+${margin}` : `${margin}`;

  const tags = [
    {
      name: "Recovery Check",
      tooltip: "Recovery Check Roll",
    },
  ];

  if (currentDying === 0) {
    api.sendMessage(
      `${record?.name || "The character"} isn't dying, so there's no recovery check to make.`,
      roll,
      [],
      tags,
    );
    return;
  }

  const result = getRecoveryCheckResult(record, degreeOfSuccess);
  const newDying = result.dying;
  const lostDying = newDying === 0;
  const wounded = result.values["data.wounded"];
  const outcomes = {
    2: ["green", "CRITICAL SUCCESS", "reduced by 2"],
    1: ["lime", "SUCCESS", "reduced by 1"],
    0: ["pink", "FAILURE", "increased by 1"],
    "-1": ["red", "CRITICAL FAILURE", "increased by 2"],
  };
  const [color, label, change] = outcomes[degreeOfSuccess];
  let message = `**[center][color=${color}]${label}[/color] [gm]vs DC ${dc} (${marginText})[/gm][/center]**\n\n[center]Dying ${change}${
    lostDying ? `. Wounded ${wounded}.` : ` (${currentDying} → ${newDying}).`
  }[/center]`;
  if (result.dead) {
    message += `\n\n**[center][color=red]DEAD (Dying ${newDying})[/color][/center]**`;
  }

  // Heroic Recovery: when the dying value would increase
  const token = api.getToken();
  const tokenId = metadata.tokenId || token?._id;
  if (result.mythicDeath) {
    message += `\n\n${getMythicDeathLine(record?.name || "The character", result.mythicDeath)}`;
  }
  if (degreeOfSuccess <= 0 && tokenId && canSpendHeroPoint(record)) {
    message += `\n${getChatButton("Heroic_Recovery", { _id: tokenId, name: record?.name }, "heroicRecovery(token)")}`;
  }

  // Send the message
  api.sendMessage(message, roll, [], tags);

  // Apply the changes
  api.setValuesOnRecord(record, result.values);

  if (result.mythicDeath && token) {
    api.addEffect("Doomed", token);
  }

  if (result.dead && token) {
    api.addEffect("Dead", token);
    api.floatText(token, "DEAD", "#ff0000");
  }
});
