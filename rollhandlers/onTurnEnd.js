const token = data?.token;

// Helper to check if a value contains dice notation (e.g., "1d6", "2d8")
const hasDiceRoll = (value) => {
  if (typeof value !== "string") return false;
  return /\d*d\d+/i.test(value);
};

// Helper to process a single persistent damage value
const processPersistentDamage = (value, partIndex = 0) => {
  if (!value) return;
  // The recovery flat check's DC for this damage type (Charhide Goblin: 10
  // for fire)
  const recoveryDC = getPersistentRecoveryDC(token, value);

  if (hasDiceRoll(value)) {
    // Has dice - roll it
    api.roll(
      value,
      {
        isPersistant: true,
        persistentPartIndex: partIndex,
        tokenId: token?._id,
        recoveryDC,
      },
      "damage"
    );
  } else {
    // Flat damage - show as clickable macro to apply damage
    // Parse "5 fire" into value=5, type="fire"
    const parts = value.trim().split(/\s+/);
    let damageValue = 0;
    let damageType = "untyped";

    if (parts.length >= 2) {
      damageValue = parseInt(parts[0], 10) || 0;
      damageType = parts.slice(1).join(" ").toLowerCase();
    } else if (parts.length === 1) {
      damageValue = parseInt(parts[0], 10) || 0;
    }

    const macroName = `Apply_${value.replace(/\s+/g, "_")}_Persistent_Damage`;
    const macro = `\`\`\`${macroName}
const roll = {
  types: [{ type: "${damageType}", value: ${damageValue} }],
  dice: [],
  metadata: { rollName: "Persistent Damage", isPersistant: true }
};
applyDamage(null, roll, false);
\`\`\``;
    // The recovery flat check, as damage.js offers for rolled persistent
    // damage
    // (rolled now with the setting on), and the button for help
    // (healing-tools.js)
    const recovery =
      partIndex >= 0 ? `\n${getPersistentRecoveryOutput(recoveryDC, partIndex, token?._id)}` : "";
    api.sendMessage(`${macro}${recovery}`, undefined, undefined, undefined, token);
  }
};

// Persistent damage (On Fire and the like) gets rolled now: each instance of
// the creature's persistent damage effects
getTurnEndPersistentDamage(token).forEach(({ value, partIndex }) => {
  if (typeof value === "string") {
    processPersistentDamage(value, partIndex);
  }
});

// Holding breath or suffocating: the air left, or the Fortitude save, with
// buttons (table-rules.js)
const breathMessage = getBreathTurnEndMessage(token);
if (breathMessage) {
  api.sendMessage(breathMessage, undefined, [], [], token);
}

// Condition upkeep: frightened goes down by 1 at the end of each of the
// creature's turns, but not again when Next after Previous ends the same turn
// a second time
if (isConditionUpkeepOn() && !isTurnEndUpkeepDone(token)) {
  const frightened = getTurnEndFrightened(token);
  if (frightened) {
    api.deductEffectById(frightened._id, token, () =>
      markTurnEndUpkeep(token),
    );
  }
}
