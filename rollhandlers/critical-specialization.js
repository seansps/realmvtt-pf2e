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
// With a grievous rune (GM Core pg. 238) the buttons give its stronger
// version, as its line on the card says (property-runes.js): sword off-guard
// until the end of your next turn, spear clumsy for 2 rounds, dart 2d6
// bleed, pick 4 per die, brawling and firearm a -4 penalty to the save
// (rolled against the DC + 4, the same degrees of success), crossbow the
// bow's immobilized, bow a DC 20 check to pull free.
// "Until the end of your next turn" is worked out when the button is
// clicked (getEndOfNextTurnValue), so a reaction's critical hit lasts as
// long as one on the attacker's own turn.

// The bow's surface condition and the check to pull free (DC 20 with
// grievous)
function getStuckNote(dc) {
  return `If the target is adjacent to a surface, it's stuck to it by the missile: immobilized until it pulls the missile free with an Interact action and a DC ${dc} Athletics check (not if it's incorporeal, liquid, or could escape without effort).`;
}

const CRIT_SPEC_EFFECTS = {
  spear: {
    effect: { name: "Clumsy", value: 1, unit: "start_applier_turn", duration: 1 },
    grievous: { effect: { name: "Clumsy", value: 1, unit: "start_applier_turn", duration: 2 } },
  },
  sword: {
    effect: { name: "Off-Guard", unit: "start_applier_turn", duration: 1 },
    grievous: { effect: { name: "Off-Guard", unit: "end_applier_turn", endOfNextTurn: true } },
  },
  brawling: { save: "fortitude", effect: { name: "Slowed", value: 1, unit: "end_applier_turn", endOfNextTurn: true }, grievous: { savePenalty: 4 } },
  firearm: { save: "fortitude", effect: { name: "Stunned", value: 1 }, grievous: { savePenalty: 4 } },
  sling: { save: "fortitude", effect: { name: "Stunned", value: 1 }, grievous: { note: "On a failure it also takes a -10-foot status penalty to its Speed for 1 round (grievous)." } },
  flail: { save: "reflex", effect: { name: "Prone" } },
  hammer: { save: "fortitude", effect: { name: "Prone" } },
  bow: { effect: { name: "Immobilized" }, note: getStuckNote(10), grievous: { note: getStuckNote(20) } },
  crossbow: { bleed: "1d8", grievous: { effect: { name: "Immobilized" }, note: getStuckNote(10) } },
  dart: { bleed: "1d6", grievous: { bleed: "2d6" } },
  knife: { bleed: "1d6", grievous: { note: "It takes a -5-foot status penalty to its Speed while it has the persistent bleed damage (grievous)." } },
  // Its extra damage is worked out from the attack's dice: 2 per die, 4
  // with grievous
  pick: { perDie: 2, grievous: { perDie: 4 } },
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
// Whether the attack's weapon has a grievous rune (its runes, as the card's
// grievous line reads them)
function hasGrievousRune(runes) {
  return (runes || []).some((rune) => getPropertyRuneKey(rune) === "grievous");
}

// The group's effect, with grievous's stronger version over it
function getCritSpecEffects(weaponGroup, grievous) {
  const base = CRIT_SPEC_EFFECTS[String(weaponGroup || "").toLowerCase()];
  if (!base) return null;
  const { grievous: stronger, ...spec } = base;
  return grievous && stronger ? { ...spec, ...stronger } : spec;
}

function getCritSpecEffectButton(label, target, effect, applier) {
  return getRiderButton(label, target.id, target.name, `applyCriticalSpecializationEffect(token, ${JSON.stringify(effect)}, ${JSON.stringify(applier)})`);
}

// The buttons and lines for a critical hit's specialization effect, from the
// attack's metadata (targetId, targetName, tokenId, tokenName, runes,
// critSpec)
function getCriticalSpecializationButtons(weaponGroup, metadata = {}) {
  const spec = getCritSpecEffects(weaponGroup, hasGrievousRune(metadata.runes));
  if (!spec) return [];
  const context = metadata.critSpec || {};
  const target = { id: metadata.targetId, name: metadata.targetName };
  const applier = { id: metadata.tokenId || "", name: metadata.tokenName || "the attacker" };
  const lines = [];
  if (spec.save) {
    const save = capitalize(spec.save);
    const dc = context.classDC;
    // Grievous's -4 circumstance penalty to the save: rolled against the DC
    // + 4, the same degrees of success
    const penalty = parseInt(spec.savePenalty, 10) || 0;
    const rolledDC = dc && penalty ? dc + penalty : dc;
    const against = dc ? `class DC ${dc}` : "your class DC";
    const withPenalty = penalty ? ` with a -${penalty} circumstance penalty (grievous)${dc ? `, rolled against DC ${rolledDC}` : ""}` : "";
    lines.push(`**Critical specialization:** ${target.name || "the target"} attempts a ${save} save against ${against}${withPenalty}; on a failure, ${getCritSpecEffectLabel(spec.effect).toLowerCase()}.`);
    const label = `${save}_Save${rolledDC ? `_(DC_${rolledDC}${penalty ? ",_grievous_-4" : ""})` : penalty ? "_(grievous_-4)" : ""}`;
    lines.push(getRiderButton(label, target.id, target.name, `rollSave(token, ${JSON.stringify(spec.save)}, ${rolledDC || "null"}, false, true)`));
    lines.push(getCritSpecEffectButton(`On_a_Failure:_${getCritSpecEffectLabel(spec.effect).replace(/\s+/g, "_")}`, target, spec.effect, applier));
  } else if (spec.effect) {
    lines.push(getCritSpecEffectButton(`Apply_${getCritSpecEffectLabel(spec.effect).replace(/\s+/g, "_")}`, target, spec.effect, applier));
  }
  if (spec.bleed) {
    const bonus = parseInt(context.itemBonus, 10) || 0;
    const bleed = `${spec.bleed}${bonus > 0 ? `+${bonus}` : ""} bleed`;
    lines.push(getRiderButton(`Apply_${bleed.replace(/\s+/g, "_")}_Persistent_Damage`, target.id, target.name, `applyPersistentDamageToToken(token, ${JSON.stringify(bleed)}, ${JSON.stringify(applier.id)}, ${JSON.stringify(applier.name)})`));
  }
  if (spec.perDie) {
    const dice = parseInt(context.dice, 10) || 1;
    lines.push(`**Critical specialization:** ${spec.perDie * dice} additional damage (${spec.perDie} per weapon damage die, ${dice} ${dice === 1 ? "die" : "dice"}).`);
  }
  if (spec.note) lines.push(`**Critical specialization:** ${spec.note}`);
  return lines;
}

// A specialization's condition on the target: its value, its duration (from
// the attacker's turns) and the attacker as its applier
function applyCriticalSpecializationEffect(token, effect, applier = {}) {
  if (!token || !effect?.name) return;
  // "Until the end of your next turn": 2 of the attacker's turn ends on its
  // own turn, 1 on another's (a reaction), as Debilitating Strike
  const value = effect.endOfNextTurn ? getEndOfNextTurnValue({ _id: applier.id }) : effect.duration || 1;
  const duration = effect.unit ? { value, unit: effect.unit } : undefined;
  api.addEffect(effect.name, token, duration, { ...(effect.value ? { value: effect.value } : {}), _id: applier.id, name: applier.name });
}
