// Optional header — when the damage roll came from an attack/spell, render
// the source's portrait (or icon) + name above the damage breakdown.
const damageAttackName = data.roll?.metadata?.attack || "";
const damageIcon = data.roll?.metadata?.icon;
const damagePortrait = data.roll?.metadata?.portrait;
const damageIconStr = damagePortrait
  ? `![](${assetUrl}${encodeURI(damagePortrait)}?width=30&height=30)`
  : damageIcon
    ? `:${damageIcon}:`
    : "";
const damageHeader =
  damageAttackName || damageIconStr
    ? `[center]${damageIconStr} ${damageAttackName}[/center]`
    : "";

// Here we need to determine if it was a hit or miss and display in the chat.
const traits = data.roll?.metadata?.traits || [];
const splashDamage = data.roll?.metadata?.splashDamage || 0;
const splashDamageType = data.roll?.metadata?.splashDamageType;
const damageType = data.roll?.metadata?.damageType || "untyped";
const tokenId = data.roll?.metadata?.tokenId || "";
const tokenName = data.roll?.metadata?.tokenName || "";
const isPersistant = data.roll?.metadata?.isPersistant === true;
const persistentPartIndex = data.roll?.metadata?.persistentPartIndex || 0;
const showShieldDamage = data.roll?.metadata?.showShieldDamage;
const isSpell = data.roll?.metadata?.isSpell === true;
const isVitalityDual = data.roll?.metadata?.isVitalityDual;

let persistentDamage = data.roll?.metadata?.persistentDamage || "";

const tags = [
  {
    name: isPersistant ? "Persistent Damage" : "Damage",
    tooltip: isPersistant ? "Persistent Damage Roll" : "Damage Roll",
  },
];

traits.forEach((trait) => {
  // Ignore rarity traits
  if (getIsTraitRarity(trait)) {
    return;
  }
  tags.push({
    name: trait,
    tooltip: getTraitToolTip(trait),
  });
});

// We'll always show half damage, even if the damage was a normal attack, in case the GM
// needs to apply half damage
const showHalf = true;

// Check if this is a critical hit and calculate the critical damage formula
const isCritical = data.roll?.metadata?.critical === true;
const criticalOnlyDice = data.roll?.metadata?.criticalOnlyDice || [];
let criticalDamageInfo = "";

// If it's critical and there is persistent damage, we double the persistent damage
if (isCritical && persistentDamage && persistentDamage !== "") {
  persistentDamage = doubleDamageDice(persistentDamage);
}

// Set up the roll so we can color deadly/fatal dice
let roll = {
  ...data.roll,
  dice: [...(data?.roll?.dice || [])],
  types: [...(data?.roll?.types || [])],
  total: data?.roll?.total !== undefined ? data?.roll?.total : 0,
};

if (isCritical && roll?.types && roll?.dice) {
  // Calculate what the damage will be after critical doubling
  // We need to replicate the logic from applyDamage to show accurate numbers

  const damageByType = {};
  let totalNormalDamage = 0;
  let totalCritOnlyDamage = 0;

  // First, identify which types values are critical-only by matching them from the end
  const critOnlyTypeIndices = new Set();

  if (criticalOnlyDice.length > 0) {
    const remainingCriticalDice = [...criticalOnlyDice];

    // Process types from the end (deadly/fatal/splash are added last)
    for (
      let i = roll.types.length - 1;
      i >= 0 && remainingCriticalDice.length > 0;
      i--
    ) {
      const rollType = roll.types[i];

      // Find a matching critical-only die
      const matchIndex = remainingCriticalDice.findIndex(
        (critDie) => critDie.dieType === rollType.die
      );

      if (matchIndex >= 0) {
        critOnlyTypeIndices.add(i);
        // Color this type orange to indicate it's not doubled
        roll.types[i] = {
          ...roll.types[i],
          customColor: "orange",
        };
        remainingCriticalDice.splice(matchIndex, 1);
      }
    }
  }

  // Also color the corresponding dice entries for visual consistency
  // Map types indices to dice indices
  if (roll.dice) {
    let diceIndex = 0;
    roll.types.forEach((rollType, typeIndex) => {
      if (rollType.die && diceIndex < roll.dice.length) {
        if (critOnlyTypeIndices.has(typeIndex)) {
          roll.dice[diceIndex] = {
            ...roll.dice[diceIndex],
            customColor: "orange",
          };
        }
        diceIndex++;
      }
    });
  }

  // Process damage by type, separating normal (doubled) and critical-only damage
  roll.types.forEach((rollType, index) => {
    const damageType = rollType.type || "untyped";

    damageByType[damageType] = damageByType[damageType] || {
      doubled: 0,
      critOnly: 0,
    };

    if (critOnlyTypeIndices.has(index)) {
      // This is critical-only damage (deadly, fatal, splash)
      damageByType[damageType].critOnly += rollType.value;
      totalCritOnlyDamage += rollType.value;
    } else {
      // This is normal damage that gets doubled
      damageByType[damageType].doubled += rollType.value * 2;
      totalNormalDamage += rollType.value;
    }
  });

  // Calculate total damage
  let totalCriticalDamage = 0;
  Object.keys(damageByType).forEach((type) => {
    totalCriticalDamage +=
      damageByType[type].doubled + damageByType[type].critOnly;
  });

  // Build the formula string
  let formulaParts = [];
  Object.keys(damageByType).forEach((type) => {
    const { doubled, critOnly } = damageByType[type];
    const total = doubled + critOnly;

    if (total > 0) {
      formulaParts.push(`${total} :${type}:`);
    }
  });

  // Build the breakdown line
  let breakdown = `Doubled: ${totalNormalDamage * 2}`;
  if (totalCritOnlyDamage > 0) {
    breakdown += `, Additional Damage: ${totalCritOnlyDamage}`;
  }

  criticalDamageInfo = `
**Critical Hit Damage:** ${totalCriticalDamage} (${formulaParts.join(" + ")})
_${breakdown}_
`;
}

let damageName = "Damage";
if (isVitalityDual) {
  damageName = "Damage_or_Healing";
}

const damageMacro = `
\`\`\`Apply_${damageName}
applyDamage(null, ${JSON.stringify(data.roll)}, false);
\`\`\`
`;

const halfDamageMacro = showHalf
  ? `
\`\`\`Apply_Half_${damageName}
applyDamage(null, ${JSON.stringify(data.roll)}, true);
\`\`\`
`
  : "";

// For spells we allow double damage as some spells do this such as with a Basic Save
const spellDoubleDamageRoll = {
  ...(data?.roll || {}),
  metadata: {
    ...(data?.roll?.metadata || {}),
    isSpell: true,
    critical: true,
  },
};
const doubleDamageMacro = isSpell
  ? `
\`\`\`Apply_Double_${damageName}
applyDamage(null, ${JSON.stringify(spellDoubleDamageRoll)}, false);
\`\`\`
`
  : "";

const splashDamageMacro =
  splashDamage &&
  splashDamage !== 0 &&
  splashDamage !== "0" &&
  splashDamage !== ""
    ? `
\`\`\`Apply_Splash_Damage
const roll = ${JSON.stringify(data.roll)};
let splashTotal = ${JSON.stringify(splashDamage)};

// If splash was a dice formula, it was rolled and we need to extract the value from the roll
if (typeof splashTotal !== 'number') {
  const criticalOnlyDice = roll.metadata?.criticalOnlyDice || [];
  const rollTypes = roll.types || [];

  // Find splash damage dice in criticalOnlyDice
  const splashDice = criticalOnlyDice.filter(dice =>
    dice.damageType === ${JSON.stringify(
      (splashDamageType || damageType).toLowerCase()
    )}
  );

  // Calculate total splash damage from the rolled values
  splashTotal = 0;
  if (splashDice.length > 0 && rollTypes.length > 0) {
    // Match splash dice from the end of the roll (splash is added last)
    const splashDiceToFind = [...splashDice];
    for (let i = rollTypes.length - 1; i >= 0 && splashDiceToFind.length > 0; i--) {
      const rollType = rollTypes[i];
      const matchIndex = splashDiceToFind.findIndex(dice => dice.dieType === rollType.die);

      if (matchIndex >= 0) {
        splashTotal += rollType.value;
        splashDiceToFind.splice(matchIndex, 1);
      }
    }
  }
}

const splashMetadata = {
  value: splashTotal,
  damageType: ${JSON.stringify(splashDamageType || damageType)},
};

applyDamage(null, roll, false, splashMetadata);
\`\`\`
`
    : "";

const persistentDamageMacroName = persistentDamage
  ? persistentDamage
      .split(" ")
      .map((word) => capitalize(word))
      .join("_")
  : "Persistent_Damage";
const persistentDamageMacro =
  persistentDamage && persistentDamage !== ""
    ? `
\`\`\`${persistentDamageMacroName}_Persistent_Damage
applyPersistentDamage("${persistentDamage}", "${tokenId}", "${tokenName}");
\`\`\`
`
    : "";

let doublePersistentDamage = persistentDamage
  ? doubleDamageDice(persistentDamage)
  : "";
const doublePersistentDamageMacroName = doublePersistentDamage
  ? doublePersistentDamage
      .split(" ")
      .map((word) => capitalize(word))
      .join("_")
  : "Double_Persistent_Damage";
const doublePersistentDamageMacro =
  doublePersistentDamage && isSpell
    ? `
\`\`\`${doublePersistentDamageMacroName}_Persistent_Damage
applyPersistentDamage("${doublePersistentDamage}", "${tokenId}", "${tokenName}");
\`\`\`
`
    : "";

// Flat Check for Persistent Damage Recovery DC 15
// After you take persistent damage, roll a DC 15 flat check to see if you recover from the persistent damage. If you succeed, the condition ends.
const persistentRecoveryMacro =
  isPersistant && persistentPartIndex >= 0
    ? `
\`\`\`Roll_Recovery
api.promptRoll("Recovery", "1d20", [], { dc: 15, rollName: "Persistent Damage Flat Check", tooltip: "Flat Check to Recover from Persistent Damage", isPersistent: true, persistentPartIndex: ${persistentPartIndex} }, "flatCheck");
\`\`\`
`
    : "";

const shieldDamageMacro = showShieldDamage
  ? `
\`\`\`Apply_Damage_to_Shield
applyDamage(null, ${JSON.stringify(data.roll)}, false, undefined, true);
\`\`\`
`
  : "";

const message = `
${damageHeader}
${criticalDamageInfo}
${damageMacro}
${halfDamageMacro}
${doubleDamageMacro}
${splashDamageMacro}
${persistentDamageMacro}
${doublePersistentDamageMacro}
${persistentRecoveryMacro}
${shieldDamageMacro}
`;

// Use the modified roll with colored dice if we modified it, otherwise use original
const displayRoll = isCritical ? roll : data.roll;
api.sendMessage(message, displayRoll, [], tags);
