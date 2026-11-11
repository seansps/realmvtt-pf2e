// Variant: Stamina and Resolve (Gamemastery Guide pg. 200-201, a campaign
// setting). A character's class Hit Points split in two: half stays Hit
// Points, and half plus the Constitution modifier becomes Stamina Points
// (Table 4-21). Damage takes temporary Hit Points, then Stamina Points, then
// Hit Points. Resolve Points (up to the key attribute modifier) pay for Take a
// Breather, which refills Stamina. A night's rest refills both. Stamina and
// Resolve show on the Notes tab, so nothing is added to the Main tab.
// Not covered: Rally (a skill check the GM runs), the optional Stabilize
// rule, and monsters (GMG: usually not needed).

function isStaminaVariantOn() {
  return !!getVariantRules().stamina;
}

// Characters with a class, not level 0, and not an eidolon (its Hit Points
// are its summoner's)
function usesStamina(creature) {
  if (!isStaminaVariantOn() || creature?.recordType !== "characters") return false;
  if (!creature?.data?.classes?.[0] || isLevelZeroCharacter(creature)) return false;
  return !getEidolonSummonerId(creature);
}

// Table 4-21: class Hit Points 6/8/10/12 become 3/4/5/6 Hit Points and the
// same plus Constitution as Stamina. An odd number rounds Stamina up.
function getStaminaClassSplit(classHp) {
  const hp = parseInt(classHp, 10) || 0;
  return { hp: Math.floor(hp / 2), stamina: Math.ceil(hp / 2) };
}

// The maximums the sheet shows: Stamina from the class and Constitution per
// level, Resolve from the key attribute modifier (at least 0)
function getStaminaMaximums(creature, conMod = parseInt(creature?.data?.con || "0", 10) || 0) {
  const level = parseInt(creature?.data?.level || "0", 10) || 0;
  const split = getStaminaClassSplit(creature?.data?.classes?.[0]?.data?.hp);
  const key = creature?.data?.keyAbility;
  const keyMod = ["str", "dex", "con", "int", "wis", "cha"].includes(key)
    ? parseInt(creature?.data?.[key] || "0", 10) || 0
    : 0;
  return {
    stamina: Math.max(0, (split.stamina + conMod) * level),
    resolve: Math.max(0, keyMod),
  };
}

// What updateAttribute writes for the stamina variant: the maximums, the
// current values kept within them (full when first set), and whether the
// section shows
function getStaminaValues(creature, conMod) {
  const on = usesStamina(creature);
  const values = {};
  if (creature?.fields?.staminaBox?.hidden !== !on) {
    values["fields.staminaBox.hidden"] = !on;
  }
  if (!on) return values;
  const max = getStaminaMaximums(creature, conMod);
  const keep = (field, maximum) => {
    const current = creature?.data?.[field];
    const next = current === undefined || current === null ? maximum : Math.min(parseInt(current, 10) || 0, maximum);
    if (creature?.data?.[`${field}Max`] !== maximum) values[`data.${field}Max`] = maximum;
    if (creature?.data?.[`${field}MaxLabel`] !== `of ${maximum}`) values[`data.${field}MaxLabel`] = `of ${maximum}`;
    if (current !== next) values[`data.${field}`] = next;
  };
  keep("stamina", max.stamina);
  keep("resolve", max.resolve);
  return values;
}

// Damage left after temporary Hit Points: Stamina takes what it can. Null
// when there's no Stamina to take it.
function getStaminaDamage(creature, damage) {
  if (!(damage > 0) || !usesStamina(creature)) return null;
  const stamina = parseInt(creature?.data?.stamina || "0", 10) || 0;
  if (stamina <= 0) return null;
  const absorbed = Math.min(stamina, damage);
  return { old: stamina, stamina: stamina - absorbed, absorbed, damage: damage - absorbed };
}

function getStaminaDamageLine(loss, creature) {
  if (!loss) return "";
  return `\n**Stamina took ${loss.absorbed}** (${loss.stamina}/${parseInt(creature?.data?.staminaMax || "0", 10) || 0} left).`;
}

// Massive damage ("double your maximum Hit Points") with the variant: the
// GMG doesn't say, so it's against Hit Points and Stamina together, which for
// every class on Table 4-21 is the usual maximum. The threshold stays where
// it would be without the variant, however much Stamina is left.
function getMassiveDamageMaximum(creature, maxHp) {
  if (!usesStamina(creature)) return maxHp;
  return maxHp + (parseInt(creature?.data?.staminaMax || "0", 10) || 0);
}

// A night's rest: all Stamina and Resolve back
function getRestStaminaValues(creature) {
  if (!usesStamina(creature)) return {};
  const max = getStaminaMaximums(creature);
  return { "data.stamina": max.stamina, "data.resolve": max.resolve };
}

// Take a Breather (GMG pg. 200): 10 minutes and 1 Resolve Point for all
// Stamina Points. Null when it can't be done.
function getBreatherValues(creature) {
  if (!usesStamina(creature)) return null;
  const resolve = parseInt(creature?.data?.resolve || "0", 10) || 0;
  if (resolve < 1) return null;
  return { "data.stamina": getStaminaMaximums(creature).stamina, "data.resolve": resolve - 1 };
}

// The Notes tab's button
function takeABreather(creature) {
  const values = getBreatherValues(creature);
  const name = getCreatureName(creature);
  if (!values) {
    api.showNotification(`${name} has no Resolve Points left.`, "yellow", "Take a Breather");
    return;
  }
  api.setValuesOnRecord(creature, values);
  api.sendMessage(
    `**${name} takes a breather** (10 minutes): Stamina back to ${values["data.stamina"]}, spending 1 Resolve Point (${values["data.resolve"]} left).`,
  );
}
