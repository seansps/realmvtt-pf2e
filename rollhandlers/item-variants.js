// Item rules that change how gear works: shoddy items (Player Core pg. 270),
// precious materials that count as silver (GM Core pg. 252), apex items (GM
// Core pg. 270), cursed items (GM Core pg. 306), the High-Quality items
// variant (Gamemastery Guide pg. 197) and doubling rings (GM Core pg. 289).

// ---------------------------------------------------------------- Shoddy

// An item with the Shoddy trait, or named shoddy (as selling already reads it)
function isShoddyItem(item) {
  return itemHasTrait(item, "shoddy") || /\bshoddy\b/i.test(item?.name || "");
}

// "Attacks and checks involving a shoddy item take a -2 item penalty. This
// penalty also applies to any DCs that a shoddy item applies to (such as the
// AC provided when wearing shoddy armor)."
function getShoddyModifier(item) {
  if (!isShoddyItem(item)) return null;
  return { name: "Shoddy", type: "item", value: -2, isPenalty: true, active: true, valueType: "number" };
}

// "A shoddy suit of armor also worsens the armor's check penalty by 2"
function getShoddyCheckPenalty(armorItem, checkPenalty) {
  const penalty = Math.abs(parseInt(checkPenalty, 10) || 0);
  return isShoddyItem(armorItem) ? penalty + 2 : penalty;
}

// --------------------------------------------------------- Precious materials

// Dawnsilver (mithral before the remaster) is "treated as silver for the
// purpose of damaging creatures with weakness to silver"
const SILVER_MATERIALS = ["dawnsilver", "mithral"];

// Simplified Skill Feats (Gamemastery Guide pg. 194): characters "don't
// receive any skill feats, even from their backgrounds"
function isSkillFeatItem(item) {
  return item?.recordType === "feats" && itemHasTrait(item, "skill");
}

// GM Core pg. 253: dawnsilver is treated as silver "for the purpose of
// damaging creatures with weakness to silver", so this is used only where
// weaknesses are matched, never for resistance exceptions or predicates
function addSilverMaterial(materials) {
  return materials.some((material) => SILVER_MATERIALS.includes(material)) && !materials.includes("silver")
    ? [...materials, "silver"]
    : materials;
}

// ------------------------------------------------------------------ Apex

const ATTRIBUTE_NAMES = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

// The attribute an apex item raises, from the item's own field or its text
// ("increase your Strength modifier by 1 or increase it to +4")
function getApexItemAttribute(item) {
  const own = `${item?.data?.apexAttribute || ""}`.toLowerCase();
  if (Object.values(ATTRIBUTE_NAMES).includes(own)) return own;
  const text = `${item?.data?.description || ""}`.replace(/<[^>]+>/g, " ");
  const match = text.match(/increase (?:your|the wearer's) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i);
  return match ? ATTRIBUTE_NAMES[match[1].toLowerCase()] : "";
}

// "you can benefit from only one apex item at a time": the first invested one
function getApexItemAttributeForRecord(record) {
  const item = (record?.data?.inventory || []).find(
    (entry) => itemHasTrait(entry, "apex") && entry.data?.invested === "true" && getApexItemAttribute(entry),
  );
  return item ? getApexItemAttribute(item) : "";
}

// ------------------------------------------------------------------ Cursed

// Its Use card gets a line only the GM sees: "Unless you roll a critical
// success when attempting to Identify Magic on a cursed item, it simply
// appears as something helpful or benign", and many can't be discarded.
function getCursedUseText(item) {
  if (!itemHasTrait(item, "cursed")) return "";
  return "\n\n[gm]**Cursed item:** only a critical success to Identify Magic reveals the curse, and many can't be discarded (GM Core pg. 306).[/gm]";
}

// ------------------------------------------------------------------ Snares

// Player Core 2 pg. 297: "Creatures can detect snares ... using the creator's
// Crafting DC as the snare's Stealth DC. If your proficiency rank is expert or
// better in Crafting, only creatures actively searching can find your snares."
function getSnareUseText(item, creature) {
  if (!itemHasTrait(item, "snare") || !creature) return "";
  const dc = 10 + (parseInt(creature.data?.craftingMod || "0", 10) || 0);
  const expert = (parseInt(creature.data?.crafting || "0", 10) || 0) >= 2;
  return `\n\n**Snare:** Stealth DC ${dc} to find (the creator's Crafting DC)${
    expert ? ", and only by creatures actively searching" : ""
  }.`;
}

// --------------------------------------------------------------- Spellguns

// Treasure Vault pg. 96: "You can make either a spell attack roll with a
// spellgun or a ranged attack roll using your proficiency with simple
// firearms." The card gives both numbers; it isn't a firearm otherwise.
function getSpellgunUseText(item, creature) {
  if (!itemHasTrait(item, "spellgun") || !creature) return "";
  const entries = (creature.data?.spells || []).filter((entry) => entry?.data?.type !== "item");
  const spellAttack = entries.length ? Math.max(...entries.map((entry) => parseInt(entry?.data?.mod || "0", 10) || 0)) : null;
  const dex = parseInt(creature.data?.dex || "0", 10) || 0;
  const rank = parseInt(creature.data?.attackProficiencies?.simple || "0", 10) || 0;
  const firearm = dex + getProficiencyBonusForRank(rank, creature.data?.level || 0);
  const sign = (value) => (value >= 0 ? `+${value}` : `${value}`);
  const options = [spellAttack !== null ? `spell attack ${sign(spellAttack)}` : null, `simple firearms ${sign(firearm)}`].filter(Boolean);
  return `\n\n**Spellgun:** attack with ${options.join(" or ")}${
    item.data?.range ? `, range increment ${item.data.range}` : ""
  }. It isn't a firearm: no firearm damage, critical specialization, reloading or attachments.`;
}

// ------------------------------------------------------------ High-Quality

// With the High-Quality variant, the potency on armor the GM marks as
// high-quality ("High-Quality" in its name, and not magical) is its quality,
// not a rune, so it works without investing. Unmarked runed armor still needs
// investing, since the variant allows runes alongside quality.
function isHighQualityArmor(item) {
  return !!getVariantRules().highQuality && /\bhigh[- ]quality\b/i.test(item?.name || "") && !itemHasTrait(item, "magical");
}

// --------------------------------------------------------- Voluntary flaws

// Player Core pg. 23: "You can elect to take additional attribute flaws ...
// You can't apply more than one flaw to any single attribute modifier." So a
// voluntary flaw on an attribute the ancestry already flaws doesn't count.
// They're kept with the setting off, but only apply with it on.
function getVoluntaryFlaws(record) {
  if (!getVariantRules().voluntaryFlaws) return [];
  const ancestry = record?.data?.alternateAncestryBoosts ? null : record?.data?.ancestries?.[0];
  const ancestryFlaws = Object.values(ancestry?.data?.flaws || {})
    .filter((flaw) => Array.isArray(flaw) && flaw.length === 1)
    .map((flaw) => flaw[0]);
  const chosen = Array.isArray(record?.data?.voluntaryFlaws) ? record.data.voluntaryFlaws : [];
  return [...new Set(chosen)].filter((ability) => !ancestryFlaws.includes(ability));
}

// The picker on the attribute editor shows with the setting on, or while it
// still holds flaws. Written only on a change; hidden is the HTML's default.
function getVoluntaryFlawFieldValues(record, variants = getVariantRules()) {
  const show = !!variants.voluntaryFlaws || (record?.data?.voluntaryFlaws || []).length > 0;
  const hidden = record?.fields?.voluntaryFlaws?.hidden ?? true;
  return hidden === !show ? {} : { "fields.voluntaryFlaws.hidden": !show };
}

function onVoluntaryFlawsChange(value) {
  api.setValues({ "data.voluntaryFlaws": Array.isArray(value) ? value : [] }, (updatedRecord) => {
    onAddEditFeature(updatedRecord);
  });
}

// ---------------------------------------------------------- Doubling rings

// Both rings worn: a melee weapon wielded in the other hand gets the better
// fundamental runes of the two. Which hand wears which ring isn't tracked, so
// it's the better weapon's runes on both.
function hasDoublingRings(record) {
  return (record?.data?.inventory || []).some(
    (item) => /^doubling rings\b/i.test(item?.name || "") && ["equipped", "worn"].includes(item?.data?.carried) &&
      (item.data?.invested === "true" || !itemRequiresInvestment(item)),
  );
}

function isMeleeWeaponItem(item) {
  return item?.data?.type === "weapon" && !`${item?.data?.range || ""}`.trim();
}

// The doubled fundamental runes for a weapon, or null when they don't apply
function getDoublingRingRunes(record, weapon) {
  if (!isMeleeWeaponItem(weapon) || weapon?.data?.carried !== "equipped" || !hasDoublingRings(record)) return null;
  const wielded = (record.data?.inventory || []).filter(
    (item) => isMeleeWeaponItem(item) && item.data?.carried === "equipped",
  );
  if (wielded.length < 2) return null;
  const rune = (item, key) => parseInt(item?.data?.runes?.[key] || "0", 10) || 0;
  const best = wielded.reduce((a, b) => (rune(b, "potency") * 10 + rune(b, "striking") > rune(a, "potency") * 10 + rune(a, "striking") ? b : a));
  if (best._id === weapon._id) return null;
  return { potency: rune(best, "potency"), striking: rune(best, "striking"), from: best.name };
}
