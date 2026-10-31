const rollName = data?.roll?.metadata?.rollName;
const tooltip = data?.roll?.metadata?.tooltip;
const minRoll = data?.roll?.metadata?.minRoll;
const successMessage = data?.roll?.metadata?.successMessage;
const failureMessage = data?.roll?.metadata?.failureMessage;
const criticalSuccessMessage = data?.roll?.metadata?.criticalSuccessMessage;
const criticalFailureMessage = data?.roll?.metadata?.criticalFailureMessage;
const degreeOfSuccessAdjustments =
  data?.roll?.metadata?.degreeOfSuccessAdjustments;

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

let message = "";

let dc = 0;
dc = parseInt(data?.roll?.metadata?.dc || "0", 10);
if (isNaN(dc)) {
  dc = 0;
}

// The degree of success the roll's notes are shown for (null: no DC)
let noteDegree = null;

if (dc > 0) {
  const total = roll.total || 0;

  // Find the natural d20 roll (not dropped)
  let naturalRoll = 0;
  if (roll.dice) {
    const d20 = roll.dice.find((d) => d.type === 20 && d.reason !== "dropped");
    if (d20) {
      naturalRoll = parseInt(d20.value, 10);
    }
  }

  // Calculate the degree of success or failure
  // PF2e Critical Success/Failure rules:
  // - Critical Success: Beat DC by 10+ OR natural 20 (upgrades success to crit success)
  // - Success: Meet or beat DC
  // - Failure: Miss DC
  // - Critical Failure: Miss DC by 10+ OR natural 1 (downgrades failure to crit failure)

  let degreeOfSuccess = 0; // 0 = failure, 1 = success, 2 = critical success, -1 = critical failure

  // First, determine base degree of success
  if (total >= dc + 10) {
    degreeOfSuccess = 2; // Critical Success
  } else if (total >= dc) {
    degreeOfSuccess = 1; // Success
  } else if (total <= dc - 10) {
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

  // Apply degree of success adjustments from effects/modifiers
  const adjustmentResult = applyDegreeOfSuccessAdjustment(
    degreeOfSuccess,
    degreeOfSuccessAdjustments,
    { natural: naturalRoll, total, dc }
  );
  degreeOfSuccess = adjustmentResult.degree;
  noteDegree = degreeOfSuccess;
  const adjustmentModifierName = adjustmentResult.modifierName;

  // Calculate margin of success/failure
  const margin = total - dc;
  const marginText = margin >= 0 ? `+${margin}` : `${margin}`;

  // Generate appropriate message based on final degree of success
  let outcomeMessage = "";
  const degreeNames = {
    2: "CRITICAL SUCCESS",
    1: "SUCCESS",
    0: "FAILURE",
    "-1": "CRITICAL FAILURE",
  };
  const degreeColors = {
    2: "green",
    1: "lime",
    0: "pink",
    "-1": "red",
  };

  const degreeName = degreeNames[degreeOfSuccess];
  const degreeColor = degreeColors[degreeOfSuccess];
  const modifierText = adjustmentModifierName
    ? ` [${adjustmentModifierName}]`
    : "";

  switch (degreeOfSuccess) {
    case 2:
      message = `**[center][color=${degreeColor}]${degreeName}${modifierText}[/color] [gm]vs DC ${dc} (${marginText})[/gm][/center]**`;
      outcomeMessage = criticalSuccessMessage || "";
      break;
    case 1:
      message = `**[center][color=${degreeColor}]${degreeName}${modifierText}[/color] [gm]vs DC ${dc} (${marginText})[/gm][/center]**`;
      outcomeMessage = successMessage || "";
      break;
    case 0:
      message = `**[center][color=${degreeColor}]${degreeName}${modifierText}[/color] [gm]vs DC ${dc} (${marginText})[/gm][/center]**`;
      outcomeMessage = failureMessage || "";
      break;
    case -1:
      message = `**[center][color=${degreeColor}]${degreeName}${modifierText}[/color] [gm]vs DC ${dc} (${marginText})[/gm][/center]**`;
      outcomeMessage = criticalFailureMessage || "";
      break;
  }

  // Append outcome message if it exists
  if (outcomeMessage) {
    message += `\n\n${outcomeMessage}`;
  }

  // Handle Treat Wounds results (and Battle Medicine's, which keep wounded):
  // who healed, for the patient's immunity (healing-tools.js)
  const treatWoundsData = data?.roll?.metadata?.treatWounds;
  const medicineKind = getMedicineKind(treatWoundsData?.kind);
  const medicine = treatWoundsData
    ? {
        kind: medicineKind.kind,
        label: medicineKind.label,
        healerId: treatWoundsData.healerId || null,
        healerName: treatWoundsData.healerName || "",
      }
    : null;
  const woundedText = medicineKind.endsWounded ? " and loses the wounded condition" : "";
  if (
    treatWoundsData &&
    (degreeOfSuccess === 1 || degreeOfSuccess === 2 || degreeOfSuccess === -1)
  ) {
    let healingFormula = "";
    let damageFormula = "";

    if (degreeOfSuccess === 2) {
      // Critical Success: 4d8 HP (+ bonus) and remove wounded condition
      healingFormula = treatWoundsData.critSuccessHealing;
      message += `\n\n**The target regains ${healingFormula} Hit Points${woundedText}.**`;
    } else if (degreeOfSuccess === 1) {
      // Success: 2d8 HP (+ bonus) and remove wounded condition
      healingFormula = treatWoundsData.successHealing;
      message += `\n\n**The target regains ${healingFormula} Hit Points${woundedText}.**`;
    } else if (degreeOfSuccess === -1) {
      // Critical Failure: 1d8 damage
      damageFormula = "1d8";
      message += `\n\n**The target takes ${damageFormula} damage.**`;
    }

    // Create healing or damage macro
    if (healingFormula) {
      const healingMacro = `\`\`\`Roll_Treat_Wounds_Healing
let targets = api.getSelectedOrDroppedToken();

// If record is not null, check if we're the GM or owner and use it
if (record) {
  if (isGM || record?.record?.ownerId === userId) {
    targets = [record];
  }
}

// If we're a player and we did not drop on a record, get our owned tokens
if (!isGM && targets.length === 0) {
  targets = api.getSelectedOwnedTokens().map(target => target.token);
}

if (targets.length === 0) {
  api.showNotification("No targets selected for healing", "error");
} else {
  // Roll healing for the first target
  api.roll("${healingFormula}", { rollName: "${medicineKind.label} Healing", targets: targets, treatWounds: ${medicineKind.endsWounded}, medicine: ${JSON.stringify(medicine)} }, "healing");
}
\`\`\``;
      message += `\n\n${healingMacro}`;
    } else if (damageFormula) {
      const damageMacro = `\`\`\`Roll_Treat_Wounds_Damage
let targets = api.getSelectedOrDroppedToken();

// If record is not null, check if we're the GM or owner and use it
if (record) {
  if (isGM || record?.record?.ownerId === userId) {
    targets = [record];
  }
}

// If we're a player and we did not drop on a record, get our owned tokens
if (!isGM && targets.length === 0) {
  targets = api.getSelectedOwnedTokens().map(target => target.token);
}

if (targets.length === 0) {
  api.showNotification("No targets selected for damage", "error");
} else {
  // Roll damage for the first target
  api.roll("${damageFormula}", { rollName: "${medicineKind.label} Critical Failure", targets: targets }, "damage");
}
\`\`\``;
      message += `\n\n${damageMacro}`;
    }
  }

  // Whatever the result, the patient is then immune: added with the healing,
  // or with this button (healing-tools.js)
  if (medicine) {
    message += `\n\nThe target is now immune to ${medicineKind.perHealer ? `${medicine.healerName}'s ` : ""}${medicineKind.label} for ${medicineKind.duration}.\n${getMedicineImmunityButton(medicine)}`;
  }

  // Administer First Aid: the result and the button that applies it
  // (dying.js)
  const firstAidData = data?.roll?.metadata?.administerFirstAid;
  if (firstAidData) {
    const firstAidLines = getFirstAidResultLines(firstAidData, degreeOfSuccess);
    if (firstAidLines.length > 0) {
      message += `\n\n${firstAidLines.join("\n")}`;
    }
  }

  // A maneuver against a target: what the outcome does, with buttons for
  // its conditions (maneuvers.js)
  const maneuverData = data?.roll?.metadata?.maneuver;
  if (maneuverData) {
    const maneuverLines = getManeuverResultLines(maneuverData, degreeOfSuccess);
    if (maneuverLines.length > 0) {
      message += `\n\n${maneuverLines.join("\n")}`;
    }
  }

  // Crafting activities (Craft, Grow, Deconstruct, rushed finishing) update
  // the character's crafting projects and say what happened
  if (data?.roll?.metadata?.craftingAction) {
    message += handleCraftingRollOutcome(
      record,
      data.roll.metadata,
      degreeOfSuccess,
    );
  }
}

// Earn Income and Subsist: the outcome, with Collect, Fatigued and penalty
// buttons (table-rules.js)
const downtimeLines = [
  ...getEarnIncomeLines(data?.roll?.metadata?.earnIncome, noteDegree),
  ...getSubsistLines(data?.roll?.metadata?.subsist, noteDegree),
];
if (downtimeLines.length > 0) message += `\n\n${downtimeLines.join("\n")}`;

// Notes from the creature's features for this result (rollNote)
message += getRollNotesText(data?.roll?.metadata?.notes, noteDegree);

// A bravado check: panache by the result (class-extras.js)
const bravadoLines = getBravadoLines(data?.roll?.metadata?.bravado, noteDegree);
if (bravadoLines.length > 0) message += `\n\n${bravadoLines.join("\n")}`;

// An attack-trait action (Grapple, Trip...) goes in the creature's log for
// this turn (attack-log.js)
logTurnAttack(data?.roll?.metadata?.turnAttack, noteDegree);

api.sendMessage(
  message,
  roll,
  [],
  [
    {
      name: rollName || "Skill",
      tooltip: tooltip || `${rollName || ""} Skill Check`,
    },
  ]
);
