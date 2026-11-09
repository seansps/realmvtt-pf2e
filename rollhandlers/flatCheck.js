const rollName = data?.roll?.metadata?.rollName;
const tooltip = data?.roll?.metadata?.tooltip;
const isPersistent = data?.roll?.metadata?.isPersistent === true;
const persistentPartIndex = data?.roll?.metadata?.persistentPartIndex;

const roll = {
  ...data.roll,
  dice: [...(data?.roll?.dice || [])],
  total: data?.roll?.total !== undefined ? data?.roll?.total : 0,
};

let message = "";

let dc = 0;
dc = parseInt(data?.roll?.metadata?.dc || "0", 10);
if (isNaN(dc)) {
  dc = 0;
}

// Flat checks auto-succeed on DC 1 or lower, auto-fail on DC 21 or higher
if (dc <= 1) {
  message = `**[center][color=green]AUTOMATIC SUCCESS[/color] [gm](DC ${dc})[/gm][/center]**`;
} else if (dc >= 21) {
  message = `**[center][color=red]AUTOMATIC FAILURE[/color] [gm](DC ${dc})[/gm][/center]**`;
} else if (dc > 0) {
  const total = roll.total || 0;

  // Find the d20 roll (flat checks are just d20, no modifiers)
  let naturalRoll = 0;
  if (roll.dice) {
    const d20 = roll.dice.find((d) => d.type === 20 && d.reason !== "dropped");
    if (d20) {
      naturalRoll = parseInt(d20.value, 10);
    }
  }

  // Flat checks are simple: meet or beat the DC to succeed
  const success = total >= dc;

  if (success) {
    message = `**[center][color=lime]SUCCESS[/color] [gm]vs DC ${dc}[/gm][/center]**`;

    // Handle persistent damage recovery
    if (isPersistent && persistentPartIndex !== undefined) {
      // The card's token, or the one an automatic roll names
      // (healing-tools.js)
      const token = getPersistentRecoveryToken(data?.roll?.metadata?.tokenId);
      if (token) {
        const effects = token?.effects || [];
        const persistentDamageEffect = effects.find(
          (effect) => effect.name === "Persistent Damage"
        );

        if (persistentDamageEffect) {
          // Remove the specific instance
          api.removeEffectById(persistentDamageEffect?._id, token, undefined, {
            instanceIndex: persistentPartIndex,
          });
          message += `\n\n**Recovered from persistent damage!**`;
        }
      }
    }
    // A recovery check that ends a condition (confused; check-tools.js)
    message += endConditionOnSuccess(data?.roll?.metadata);
  } else {
    message = `**[center][color=pink]FAILURE[/color] [gm]vs DC ${dc}[/gm][/center]**`;
    // What a failure means (a disrupted spell; check-tools.js)
    if (data?.roll?.metadata?.failureNote) {
      message += `\n\n${data.roll.metadata.failureNote}`;
    }
    // A critical failure's extra (an unstable action's fire damage;
    // class-extras.js; a misfire's explosion, siege.js). A natural 1 is a
    // degree worse on a flat check too, so it's always a critical failure.
    const criticalFailure = total <= dc - 10 || naturalRoll === 1;
    if (criticalFailure && data?.roll?.metadata?.criticalFailureNote) {
      message += ` ${data.roll.metadata.criticalFailureNote}`;
    }
  }
}

// Devise a Stratagem's d20, kept on the investigator (class-extras.js)
if (data?.roll?.metadata?.stratagem) {
  message = keepStratagemRoll(data.roll.metadata.stratagem, roll);
}

api.sendMessage(
  message,
  roll,
  [],
  [
    {
      name: rollName || "Flat Check",
      tooltip: tooltip || `${rollName || ""} Flat Check`,
    },
  ]
);
