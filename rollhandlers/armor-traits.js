// Armor check penalty exceptions and armor traits (Player Core pg. 272-275),
// following Foundry PF2e's character prepareSkills, prepareSaves and
// createPonderousPenalty.
//
//   - Check penalty: Strength- and Dexterity-based skill checks while the
//     wearer's Strength is below the armor's, never on a check with the attack
//     trait (Grapple, Trip, Shove, Disarm, Reposition, Escape)
//   - Flexible: no check penalty on Acrobatics or Athletics
//   - Noisy: the check penalty applies to Stealth even when the Strength is
//     met
//   - Bulwark: on a Reflex save against a damaging effect, +3 instead of the
//     Dexterity modifier. On by itself for a basic save; offered unticked on
//     other Reflex saves
//   - Ponderous: a -1 item penalty to initiative, or the check penalty when
//     the Strength isn't met and that's worse
//   - Hindering (the Speed calculation) and comfort (the Rest prompt) were
//     already in place

// The worn armor's traits, lowercase
function getArmorTraitNames(bestArmor) {
  return getTraitNameList(bestArmor?.armor?.traits || []);
}

function hasArmorTrait(bestArmor, trait) {
  return getArmorTraitNames(bestArmor).includes(trait);
}

// Whether the wearer's Strength modifier meets the armor's requirement (no
// requirement counts as met)
function meetsArmorStrength(record, bestArmor) {
  const required = getArmorStrengthRequirement(bestArmor?.armor?.strength);
  if (required === null) return true;
  const strength = parseInt(record?.data?.str ?? 0, 10) || 0;
  return strength >= required;
}

// Whether a check has the attack trait: a basic skill action marked attack
// (SKILL_ACTIONS), or a source that passed the trait
function isAttackTraitCheck(context = {}) {
  const traits = getTraitNameList(context.origin?.data?.traits || []);
  if (traits.includes("attack")) return true;
  const name = String(context.action?.name || "").trim().toLowerCase();
  if (!name) return false;
  return Object.values(SKILL_ACTIONS)
    .flat()
    .some((action) => action.attack && action.name.toLowerCase() === name);
}

// Whether the armor's check penalty applies to this check (Foundry's
// predicates): never with the attack trait; Acrobatics and Athletics unless
// the Strength is met or the armor is flexible; Stealth unless the Strength
// is met and the armor isn't noisy; any other check unless the Strength is
// met. Without a skill in the context, the plain Strength rule.
function isCheckPenaltyApplied(record, bestArmor, context = {}) {
  if (isAttackTraitCheck(context)) return false;
  const met = meetsArmorStrength(record, bestArmor);
  const skill = String(context.statistic || "").toLowerCase();
  if (skill === "acrobatics" || skill === "athletics") {
    return !met && !hasArmorTrait(bestArmor, "flexible");
  }
  if (skill === "stealth" && hasArmorTrait(bestArmor, "noisy")) return true;
  return !met;
}

// Bulwark: +3 instead of the Dexterity modifier on a Reflex save against a
// damaging effect. A basic save is one; any other Reflex save gets it
// unticked. Null without bulwark armor, or when it changes nothing.
function getBulwarkModifier(record, saveType, basic = false) {
  if (saveType !== "reflex" || record?.recordType !== "characters") return null;
  if (!hasArmorTrait(getBestEquippedArmor(record), "bulwark")) return null;
  const dex = parseInt(record.data?.dex ?? 0, 10) || 0;
  const value = 3 - dex;
  if (value === 0) return null;
  return {
    name: "Bulwark (+3 instead of Dex, damaging effects)",
    type: "",
    value,
    isPenalty: value < 0,
    valueType: "number",
    active: !!basic,
  };
}

// Ponderous: a -1 item penalty to initiative, or the check penalty when the
// Strength isn't met and it's worse. An initiativePenalty modifier, so the
// initiative roll picks it up. Null without ponderous armor.
function getPonderousModifier(record, bestArmor) {
  if (record?.recordType !== "characters" || !hasArmorTrait(bestArmor, "ponderous")) return null;
  const checkPenalty = Math.abs(parseInt(bestArmor?.armor?.checkPenalty, 10) || 0);
  const penalty = meetsArmorStrength(record, bestArmor) ? 1 : Math.max(1, checkPenalty);
  return {
    value: -penalty,
    isPenalty: true,
    valueType: "number",
    name: "Ponderous",
    type: "item",
    modifierType: "initiativePenalty",
    field: "",
    active: true,
    slug: "ponderous",
  };
}
