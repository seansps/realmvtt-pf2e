// Here we need to determine if it was a hit or miss and display in the chat.
const tags = [
  {
    name: "Healing",
    tooltip: "Healing Roll",
  },
];

const mods = data.roll?.metadata?.modifiers || [];

mods.forEach((mod) => {
  if (mod.value > 0) {
    tags.push({
      name: mod.name,
      tooltip: `Modifier for ${
        mod.name.charAt(0).toUpperCase() + mod.name.slice(1)
      }`,
    });
  }
});

// Separate roll by temp healing and regular healing
const tempHealing = data.roll.types.reduce(
  (acc, type) => (type.type == "temp" ? acc + type.value : acc),
  0
);
const regularHealing = data.roll.types.reduce(
  (acc, type) => (type.type != "temp" ? acc + type.value : acc),
  0
);

let message = "";

// Treat Wounds' healing also ends the wounded condition (dying.js)
const treatWounds = data.roll?.metadata?.treatWounds === true;
// Treat Wounds or Battle Medicine: who healed, for the patient's immunity
// (healing-tools.js)
const medicine = data.roll?.metadata?.medicine || null;

const tempMacro = tempHealing
  ? `
  \`\`\`Apply_Temporary_HP
  const tempHp = ${tempHealing};
  
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
  
  targets.forEach(target => {
    const oldTempHp = parseInt(target.data?.tempHp || '0', 10);
    // Temp HP always overrides existing temp HP, if it is higher. The kept
    // ones' source is noted, so Rage's aren't taken for these (class-extras.js)
    const tempHpValues = getActionTempHpValues(target, tempHp, "Healing");
    api.setValuesOnTokenById(target._id, target.recordType, tempHpValues);
    // An eidolon and its summoner share the HP (eidolons.js)
    shareHitPoints(target, tempHpValues);
    const unIdentified = target.identified === false;
    let targetName = !unIdentified ? target.name || target.record.name : target.unidentifiedName || target.record.unidentifiedName;
    targetName = targetName.replace(/'/g, ''); // Just remove the single quotes
  
    const macro = \`\\\`\\\`\\\`Undo\\n if (isGM) { api.setValuesOnTokenById('\$\{target._id\}', '\$\{target.recordType\}', { 'data.tempHp': \$\{oldTempHp\}, 'data.tempHpSource': null }); api.editMessage(null, '~\$\{targetName\} received \$\{tempHp\} Temporary Hit Points.~'); } else { api.showNotification('Only the GM can undo healing.', 'yellow', 'Notice'); } \\n\\\`\\\`\\\`\`;
  
    api.sendMessage(\`\$\{targetName\} received \$\{tempHp\} Temporary Hit Points.\\n\$\{macro\}\`, undefined, undefined, undefined, target);
  
    // If healing > 0, float text
    if (tempHp > 0) {
      api.floatText(target, \`+\${tempHp}\`, "#1165ed");
    }
  });
  \`\`\`
  `
  : "";

const healingMacro = regularHealing
  ? `
  \`\`\`Apply_Healing
  const healing = ${regularHealing};
  
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
  
  targets.forEach(target => {
    // Hit Points, dying and unconscious, and wounded for Treat Wounds
    applyHealingToToken(target?.token || target, healing, { treatWounds: ${treatWounds}, medicine: ${JSON.stringify(medicine)}, action: ${JSON.stringify(medicine?.label || "")}, isSpell: ${data.roll?.metadata?.isSpell === true}, source: ${JSON.stringify(String(data.roll?.metadata?.rollName || ""))}, damageSource: ${JSON.stringify(data.roll?.metadata?.damageSource || null)} });
  });
  \`\`\`
  `
  : "";

message = `${message}
  ${healingMacro}
  ${tempMacro}
  `;

// Here you would check targets and apply damage, etc.
api.sendMessage(message, data.roll, [], tags);
