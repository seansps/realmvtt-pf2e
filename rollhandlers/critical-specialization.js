// Critical specialization effects as buttons (Player Core pg. 283, roadmap
// H19). A critical hit with critical specialization gets the weapon group's
// effect on its card (attack.js): the description stays in the card's tag,
// and here are the buttons for the GM or the target's player:
//   - spear: clumsy 1, sword: off-guard, until the start of your next turn
//   - brawling: a Fortitude save against your class DC, slowed 1 until the
//     end of your next turn on a failure; firearm and sling: a Fortitude
//     save, stunned 1; flail: a Reflex save, hammer: a Fortitude save,
//     prone. The save is rolled by its button, and the condition applied by
//     its own button, as the GM reads the result.
//   - crossbow (1d8), dart and knife (1d6): persistent bleed, plus the
//     weapon's item bonus to attack rolls
//   - bow: immobilized until it pulls the missile free (Interact, DC 10
//     Athletics)
//   - pick: the extra damage worked out (2 per weapon damage die); axe, club,
//     polearm, shield and bomb: a line saying what to do (forced movement,
//     the axe's second target, the bomb's splash)
// Grievous runes still add their text (property-runes.js).

const CRIT_SPEC_EFFECTS = {
  spear: { effect: { name: "Clumsy", value: 1, unit: "start_applier_turn", duration: 1 } },
  sword: { effect: { name: "Off-Guard", unit: "start_applier_turn", duration: 1 } },
  brawling: { save: "fortitude", effect: { name: "Slowed", value: 1, unit: "end_applier_turn", duration: 2 } },
  firearm: { save: "fortitude", effect: { name: "Stunned", value: 1 } },
  sling: { save: "fortitude", effect: { name: "Stunned", value: 1 } },
  flail: { save: "reflex", effect: { name: "Prone" } },
  hammer: { save: "fortitude", effect: { name: "Prone" } },
  bow: { effect: { name: "Immobilized" }, note: "It's stuck until it pulls the missile free: an Interact action and a DC 10 Athletics check (not if it's incorporeal, liquid, or could escape without effort)." },
  crossbow: { bleed: "1d8" },
  dart: { bleed: "1d6" },
  knife: { bleed: "1d6" },
  // Its extra damage is worked out from the attack's dice
  pick: {},
  axe: { note: "Choose a creature adjacent to the target and within reach: if its AC is lower than this attack roll, it takes the weapon damage dice you rolled, not doubled." },
  club: { note: "Knock the target up to 10 feet away from you (forced movement)." },
  polearm: { note: "Move the target 5 feet in a direction of your choice (forced movement)." },
  shield: { note: "Knock the target 5 feet back from you (forced movement)." },
  bomb: { note: "The bomb's splash damage, if any, has a 10-foot radius." },
};

// What the attack's card needs about the weapon and its wielder: their
// class DC, the weapon's item bonus to attack rolls (its potency rune, or
// attack potency with Automatic Bonus Progression) and its damage dice
function getCriticalSpecializationContext(record, weapon) {
  const abp = getAbpBonuses(record);
  const itemBonus = abp ? abp.attack : parseInt(weapon?.data?.runes?.potency || "0", 10) || 0;
  const classDC = parseInt(record?.data?.classDC, 10);
  return {
    classDC: Number.isFinite(classDC) && classDC > 0 ? classDC : null,
    itemBonus,
    dice: countWeaponDamageDice(weapon, getStrikingRuneForRecord(record, weapon)) || 1,
  };
}

function getCritSpecEffectLabel(effect) {
  return `${effect.name}${effect.value ? ` ${effect.value}` : ""}`;
}

// The buttons and lines for a critical hit's specialization effect, from the
// attack's metadata (targetId, targetName, tokenId, tokenName, critSpec)
function getCriticalSpecializationButtons(weaponGroup, metadata = {}) {
  const spec = CRIT_SPEC_EFFECTS[String(weaponGroup || "").toLowerCase()];
  if (!spec) return [];
  const context = metadata.critSpec || {};
  const target = { id: metadata.targetId, name: metadata.targetName };
  const applier = { id: metadata.tokenId || "", name: metadata.tokenName || "the attacker" };
  const lines = [];
  if (spec.save) {
    const save = capitalize(spec.save);
    const dc = context.classDC;
    lines.push(`**Critical specialization:** ${target.name || "the target"} attempts a ${save} save against ${dc ? `class DC ${dc}` : "your class DC"}; on a failure, ${getCritSpecEffectLabel(spec.effect).toLowerCase()}.`);
    lines.push(getRiderButton(`${save}_Save${dc ? `_(DC_${dc})` : ""}`, target.id, target.name, `rollSave(token, ${JSON.stringify(spec.save)}, ${dc || "null"}, false, true)`));
    lines.push(getRiderButton(`On_a_Failure:_${getCritSpecEffectLabel(spec.effect).replace(/\s+/g, "_")}`, target.id, target.name, `applyCriticalSpecializationEffect(token, ${JSON.stringify(spec.effect)}, ${JSON.stringify(applier)})`));
  } else if (spec.effect) {
    lines.push(getRiderButton(`Apply_${getCritSpecEffectLabel(spec.effect).replace(/\s+/g, "_")}`, target.id, target.name, `applyCriticalSpecializationEffect(token, ${JSON.stringify(spec.effect)}, ${JSON.stringify(applier)})`));
  }
  if (spec.bleed) {
    const bonus = parseInt(context.itemBonus, 10) || 0;
    const bleed = `${spec.bleed}${bonus > 0 ? `+${bonus}` : ""} bleed`;
    lines.push(getRiderButton(`Apply_${bleed.replace(/\s+/g, "_")}_Persistent_Damage`, target.id, target.name, `applyPersistentDamageToToken(token, ${JSON.stringify(bleed)}, ${JSON.stringify(applier.id)}, ${JSON.stringify(applier.name)})`));
  }
  if (String(weaponGroup || "").toLowerCase() === "pick") {
    const dice = parseInt(context.dice, 10) || 1;
    lines.push(`**Critical specialization:** ${2 * dice} additional damage (2 per weapon damage die, ${dice} ${dice === 1 ? "die" : "dice"}).`);
  }
  if (spec.note) lines.push(`**Critical specialization:** ${spec.note}`);
  return lines;
}

// A specialization's condition on the target: its value, its duration (from
// the attacker's turns) and the attacker as its applier
function applyCriticalSpecializationEffect(token, effect, applier = {}) {
  if (!token || !effect?.name) return;
  const duration = effect.unit ? { value: effect.duration || 1, unit: effect.unit } : undefined;
  api.addEffect(effect.name, token, duration, { ...(effect.value ? { value: effect.value } : {}), _id: applier.id, name: applier.name });
}
