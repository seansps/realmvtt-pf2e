const token = data?.token;

// Helper to check if a value contains dice notation (e.g., "1d6", "2d8")
const hasDiceRoll = (value) => {
  if (typeof value !== "string") return false;
  return /\d*d\d+/i.test(value);
};

// Helper to process a single persistent damage value
const processPersistentDamage = (value, partIndex = 0) => {
  if (!value) return;

  if (hasDiceRoll(value)) {
    // Has dice - roll it
    api.roll(
      value,
      {
        isPersistant: true,
        persistentPartIndex: partIndex,
        tokenId: token?._id,
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
    api.sendMessage(macro, undefined, undefined, undefined, token);
  }
};

// Check for persistant damage effects like On Fire
const modifiers = getEffectsAndModifiersForToken(
  token,
  ["persistentDamage"],
  ""
);

// This gets rolled immediately
if (modifiers.length > 0) {
  const effects = token?.effects || [];
  const effectValues = token?.effectValues || {};

  // Find all persistent damage effects
  const persistentDamageEffects = effects.filter((effect) => {
    const rules = effect?.rules || [];
    return rules.some((rule) => rule.type === "persistentDamage");
  });

  // Process each persistent damage effect
  persistentDamageEffects.forEach((effect) => {
    const existingValue = effectValues[effect?._id];

    if (!existingValue) {
      return;
    }

    // Get the value of the persistent damage effect
    // Handle both object with .value property and direct values
    const persistentDamageValue =
      typeof existingValue === "object" && existingValue.value !== undefined
        ? existingValue.value
        : existingValue;

    if (!persistentDamageValue) {
      return;
    }

    // Handle string or array values
    if (typeof persistentDamageValue === "string") {
      // String: process once with index 0
      processPersistentDamage(persistentDamageValue, 0);
    } else if (Array.isArray(persistentDamageValue)) {
      // Array: process each value with index as partIndex
      // Each element is an object with a value property
      persistentDamageValue.forEach((item, index) => {
        const value = item?.value || item;
        processPersistentDamage(value, index);
      });
    }
  });
}
