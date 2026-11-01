// Eidolons as characters (Impossible Magic pg. 63-77), as Foundry's PF2e
// Companion Compendia builds them and the Eidolons module (modules/eidolons)
// ships them: the eidolon's ancestry is its type (angel, beast...), its class
// is "Eidolon". The ruleset's part is here and where the sheets and damage
// and healing call it:
//   - an eidolon type asks for no heritage when it's dropped
//     (isEidolonAncestry);
//   - the Notes tab's master field (the animal companion's) links an eidolon
//     to its summoner, and the summoner back to it (data.eidolon, as a
//     familiar's master links its familiar);
//   - the eidolon's level and Hit Points are its summoner's: one pool of HP
//     and temporary HP, so damage or healing to either is copied to the
//     other (shareHitPoints), and its maximum HP is the summoner's;
//   - it takes item bonuses from its summoner's gear: armor potency and
//     resilient runes or bands of force, and handwraps' runes on its
//     unarmed attacks (getSummonerGear, data.summonerGear).
// It isn't a minion, but it acts on its summoner's turn (shared actions), so
// it goes just after the summoner in initiative (summons.js).

// The HP values an eidolon and its summoner share
const SHARED_HIT_POINT_KEYS = ["data.hitpoints", "data.curhp", "data.tempHp"];

function getEidolonCreatureData(creature, key) {
  return creature?.data?.[key] ?? creature?.record?.data?.[key];
}

// Whether a creature is an eidolon: its class is Eidolon (by name, or
// data.eidolon on the class record)
function isEidolonCharacter(creature) {
  const classes = getEidolonCreatureData(creature, "classes") || [];
  return classes.some((classObj) => toSlug(String(classObj?.name || "")) === "eidolon" || classObj?.data?.eidolon === true);
}

// Whether an ancestry is an eidolon type (the module's flag); it has no
// heritages
function isEidolonAncestry(ancestry) {
  return ancestry?.data?.eidolon === true;
}

// An eidolon's summoner (the Notes tab's master field), or null
function getEidolonSummonerId(creature) {
  if (!isEidolonCharacter(creature)) return null;
  return getRecordIdFromValue(getEidolonCreatureData(creature, "companionMaster"));
}

// A summoner's eidolon (data.eidolon, written when the eidolon's summoner is
// set), or null
function getSummonerEidolonId(creature) {
  if (isEidolonCharacter(creature)) return null;
  return getRecordIdFromValue(getEidolonCreatureData(creature, "eidolon"));
}

// The creature's partner in the shared HP pool: an eidolon's summoner, or a
// summoner's eidolon
function getSharedHitPointPartnerId(creature) {
  return getEidolonSummonerId(creature) || getSummonerEidolonId(creature);
}

// The shared HP values among values written (or a creature's data), as
// numbers
function getSharedHitPointValues(values) {
  const shared = {};
  SHARED_HIT_POINT_KEYS.forEach((key) => {
    if (values?.[key] === undefined || values[key] === null) return;
    const value = parseInt(values[key], 10);
    if (!isNaN(value)) shared[key] = value;
  });
  return shared;
}

// The partner's writes for HP just written to a creature: the shared values
// that differ from the partner's, or null
function getSharedHitPointWrites(partner, values) {
  const shared = getSharedHitPointValues(values);
  const writes = {};
  Object.entries(shared).forEach(([key, value]) => {
    const current = parseInt(partner?.data?.[key.slice(5)], 10);
    if (current !== value) writes[key] = value;
  });
  return Object.keys(writes).length ? writes : null;
}

// After HP is written to an eidolon or its summoner (values: what was
// written), the other gets the same HP, temporary HP and maximum: one pool
// (Impossible Magic pg. 63). Reads the partner fresh and writes only what
// differs, so a second call writes nothing.
function shareHitPoints(creature, values, callback) {
  const done = () => {
    if (callback) callback();
  };
  const partnerId = getSharedHitPointPartnerId(creature);
  if (!partnerId || !Object.keys(getSharedHitPointValues(values)).length) return done();
  api.getRecord("characters", partnerId, (partner) => {
    const writes = partner ? getSharedHitPointWrites(partner, values) : null;
    if (!writes) return done();
    api.setValuesOnRecord(partner, writes, () => done());
  });
}

// An eidolon's level and HP from its summoner, in one write, and the
// summoner's link back to it when it's missing; then the eidolon's sheet is
// worked out again at the new level. callback(record) gets the eidolon after.
function syncEidolonWithSummoner(record, summonerId = getEidolonSummonerId(record), callback) {
  const done = (updated) => {
    if (callback) callback(updated);
  };
  if (!record || !summonerId) return done(record);
  api.getRecord("characters", summonerId, (summoner) => {
    if (!summoner) return done(record);
    const values = getSharedHitPointWrites(record, {
      "data.hitpoints": summoner.data?.hitpoints,
      "data.curhp": summoner.data?.curhp,
      "data.tempHp": summoner.data?.tempHp || 0,
    }) || {};
    const level = parseInt(summoner.data?.level, 10);
    const levelChanged = level >= 0 && parseInt(record.data?.level, 10) !== level;
    if (levelChanged) values["data.level"] = level;
    const gear = getSummonerGear(summoner);
    if (!isSameSummonerGear(record.data?.summonerGear, gear)) values["data.summonerGear"] = gear;
    const ranks = getSummonerRanks(summoner);
    const ranksChanged = JSON.stringify(record.data?.summonerRanks || null) !== JSON.stringify(ranks);
    if (ranksChanged) values["data.summonerRanks"] = ranks;
    const linkBack = () => {
      if (getRecordIdFromValue(summoner.data?.eidolon) === record._id) return;
      api.setValuesOnRecord(summoner, { "data.eidolon": JSON.stringify({ _id: record._id, name: record.name, recordType: record.recordType || "characters" }) });
    };
    if (!Object.keys(values).length) {
      linkBack();
      return done(record);
    }
    api.setValuesOnRecord(record, values, (updated) => {
      const current = updated || { ...record, data: { ...(record.data || {}), ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k.slice(5), v])) } };
      linkBack();
      // A new level or new ranks: the sheet is worked out again
      if (levelChanged || ranksChanged) onAddEditFeature(current, undefined, true);
      done(current);
    });
  });
}

// ---------------------------------------------------------------- Gear

// Bands of force (Impossible Magic and Player Core): an item bonus to AC and
// saves, +1, greater +2, major +3
function getBandsOfForceBonus(item) {
  const name = String(item?.name || "").toLowerCase();
  if (!name.includes("bands of force")) return 0;
  if (name.includes("major")) return 3;
  if (name.includes("greater")) return 2;
  return 1;
}

// What an eidolon takes from its summoner's gear (Impossible Magic pg. 70):
// the item bonus to AC of the summoner's armor potency rune or bands of
// force, the item bonus to saves of its resilient rune or bands of force, and
// its worn, invested handwraps of mighty blows' runes. With Automatic Bonus
// Progression runes give nothing (the eidolon has its own potency).
function getSummonerGear(summoner) {
  const gear = { armorPotency: 0, resilient: 0, handwraps: null, perception: 0, skills: {} };
  if (getVariantRules().automaticBonusProgression) return gear;
  // Item bonuses to Perception and skills from its invested magic items
  const itemBonuses = getSummonerItemBonuses(summoner);
  gear.perception = itemBonuses.perception;
  gear.skills = itemBonuses.skills;
  const invested = (summoner?.data?.inventory || []).filter(
    (item) => item?.data?.carried === "equipped" && item?.data?.invested === "true",
  );
  invested.forEach((item) => {
    const bands = getBandsOfForceBonus(item);
    if (bands) {
      gear.armorPotency = Math.max(gear.armorPotency, bands);
      gear.resilient = Math.max(gear.resilient, bands);
    }
    if (item.data?.type === "armor") {
      gear.armorPotency = Math.max(gear.armorPotency, parseInt(item.data?.runes?.potency || 0, 10) || 0);
      gear.resilient = Math.max(gear.resilient, parseInt(item.data?.runes?.resilient || 0, 10) || 0);
    }
  });
  const handwraps = getWornHandwraps(summoner);
  if (handwraps) {
    gear.handwraps = { _id: handwraps._id, name: handwraps.name, data: { handwraps: true, carried: "equipped", invested: "true", runes: handwraps.data?.runes || {} } };
  }
  return gear;
}

// Whether two gear snapshots give the same; none is the same as no gear
function isSameSummonerGear(a, b) {
  const key = (gear) =>
    JSON.stringify({
      armorPotency: gear?.armorPotency || 0,
      resilient: gear?.resilient || 0,
      handwraps: gear?.handwraps || null,
      perception: gear?.perception || 0,
      skills: gear?.skills || {},
    });
  return key(a) === key(b);
}

// The eidolon's modifiers from its summoner's gear (getEffectsAndModifiersForToken)
function getEidolonGearModifiers(record) {
  if (!isEidolonCharacter(record)) return [];
  const gear = getEidolonCreatureData(record, "summonerGear");
  if (!gear) return [];
  const modifier = (name, value, modifierType, type) => ({ value, isPenalty: false, valueType: "number", name, type, modifierType, field: "all", active: true });
  const results = [];
  // Increases the eidolon's item bonus to AC (its key attribute's), so it
  // adds to it rather than competing with it
  if (gear.armorPotency > 0) results.push(modifier(`Summoner's Armor Potency +${gear.armorPotency}`, gear.armorPotency, "armorClassBonus", ""));
  if (gear.resilient > 0) results.push(modifier(`Summoner's Resilient +${gear.resilient}`, gear.resilient, "saveBonus", "item"));
  if (gear.perception > 0) results.push(modifier(`Summoner's Item +${gear.perception}`, gear.perception, "perceptionBonus", "item"));
  Object.entries(gear.skills || {}).forEach(([skill, value]) => {
    if (value > 0) results.push({ ...modifier(`Summoner's Item +${value}`, value, "skillBonus", "item"), field: skill });
  });
  return results;
}

// The summoner's gear and proficiency ranks written to its eidolon when
// they changed, in one write; new ranks work the eidolon's sheet out again
function shareSummonerGear(summoner, callback) {
  const done = () => {
    if (callback) callback();
  };
  const eidolonId = getSummonerEidolonId(summoner);
  if (!eidolonId) return done();
  const gear = getSummonerGear(summoner);
  const ranks = getSummonerRanks(summoner);
  api.getRecord("characters", eidolonId, (eidolon) => {
    if (!eidolon) return done();
    const values = {};
    if (!isSameSummonerGear(eidolon.data?.summonerGear, gear)) values["data.summonerGear"] = gear;
    const ranksChanged = JSON.stringify(eidolon.data?.summonerRanks || null) !== JSON.stringify(ranks);
    if (ranksChanged) values["data.summonerRanks"] = ranks;
    if (!Object.keys(values).length) return done();
    api.setValuesOnRecord(eidolon, values, (updated) => {
      if (ranksChanged) onAddEditFeature(updated || { ...eidolon, data: { ...eidolon.data, summonerRanks: ranks } }, undefined, true);
      done();
    });
  });
}

// ---------------------------------------------------------------- 0 HP, Undo, one effect on both

// A creature's record id (a token's recordId, or a record's own id)
function getEidolonRecordId(creature) {
  return creature?.recordId || creature?.record?._id || creature?._id || null;
}

// The summoner's token on the scene, for a linked eidolon, or null
function getEidolonSummonerToken(eidolon) {
  const summonerId = getEidolonSummonerId(eidolon);
  if (!summonerId) return null;
  return getMinionSceneTokens().find((token) => getEidolonRecordId(token) === summonerId && token._id !== eidolon?._id) || null;
}

// The name in a record link (the summoner's data.eidolon), or ""
function getLinkedName(value) {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  try {
    return JSON.parse(value)?.name || "";
  } catch (error) {
    return "";
  }
}

// A linked eidolon brought to 0 HP: its summoner is (Manifest Eidolon,
// Impossible Magic pg. 64), so the summoner gains dying (2 on a crit) and
// the conditions, and the eidolon unmanifests. The eidolon gets no dying of
// its own. Returns { lines, buttons, undo }: the card's lines, the
// summoner's buttons (Heroic Recovery, Orc Ferocity), and the summoner's
// values before, for the card's Undo.
function applyEidolonZeroHitPoints(eidolon, options = {}) {
  const name = getCreatureName(eidolon);
  const summoner = getEidolonSummonerToken(eidolon);
  if (!summoner) {
    return {
      lines: [`${name} unmanifests: its summoner drops to 0 HP. Their token isn't on this scene, so give them dying on their sheet.`],
      buttons: [],
      undo: null,
    };
  }
  const valuesToSet = {};
  const oldValues = {};
  const { lines, buttons } = getZeroHitPointsChanges(summoner, { ...options, valuesToSet, oldValues });
  if (Object.keys(valuesToSet).length) api.setValuesOnTokenById(summoner._id, summoner.recordType, valuesToSet);
  return {
    lines: [`${name} unmanifests: its summoner drops to 0 HP.`, ...lines],
    buttons,
    undo: Object.keys(oldValues).length ? { tokenId: summoner._id, recordType: summoner.recordType, values: oldValues } : null,
  };
}

// The line for a summoner brought to 0 HP: its eidolon unmanifests
function getEidolonUnmanifestLine(summoner) {
  if (!getSummonerEidolonId(summoner)) return "";
  const eidolonName = getLinkedName(getEidolonCreatureData(summoner, "eidolon")) || "Their eidolon";
  return `${eidolonName} unmanifests.`;
}

// The Undo button's code for the partner's shared HP (and the summoner's
// dying when the eidolon's 0 HP went to it): the values before, written
// back. "" when the creature shares no HP.
function getSharedHitPointUndo(creature, oldValues, zeroUndo = null) {
  const partnerId = getSharedHitPointPartnerId(creature);
  const shared = getSharedHitPointValues(oldValues);
  const parts = [];
  if (partnerId && Object.keys(shared).length) parts.push(`restoreSharedHitPoints(${JSON.stringify(partnerId)}, ${JSON.stringify(shared)});`);
  if (zeroUndo) parts.push(`api.setValuesOnTokenById(${JSON.stringify(zeroUndo.tokenId)}, ${JSON.stringify(zeroUndo.recordType)}, ${JSON.stringify(zeroUndo.values)});`);
  return parts.join(" ");
}

function restoreSharedHitPoints(partnerId, values) {
  api.getRecord("characters", partnerId, (partner) => {
    if (partner) api.setValuesOnRecord(partner, values);
  });
}

// One effect on both an eidolon and its summoner applies once, the greater
// (Impossible Magic pg. 63). The pool's key (the summoner's record id) when
// the creature's partner is among the creatures the effect is applied to,
// or null.
function getSharedPoolKey(creature, creatures) {
  const partnerId = getSharedHitPointPartnerId(creature);
  if (!partnerId) return null;
  const ownId = getEidolonRecordId(creature);
  if (!(creatures || []).some((other) => other && other._id !== creature._id && getEidolonRecordId(other) === partnerId)) return null;
  return isEidolonCharacter(creature) ? partnerId : ownId;
}

// What the second of the pair takes, once the first took `previous`: only
// what its amount adds to the greater (damage is positive, healing negative)
function getSharedPoolDamage(damage, previous) {
  if (damage >= 0 && previous >= 0) return Math.max(0, damage - previous);
  if (damage < 0 && previous < 0) return Math.min(0, damage - previous);
  return damage;
}

// ---------------------------------------------------------------- Shared ranks

const SUMMONER_DEDICATION_EIDOLON = "Summoner Dedication (Eidolon)";
const SHARED_SAVE_RANKS = ["perception", "fortitude", "reflex", "will"];

// The summoner's proficiency ranks the eidolon shares: its skills (Impossible
// Magic pg. 69, "They share your skill proficiencies"), and its Perception
// and saves for a Summoner Dedication eidolon
function getSummonerRanks(summoner) {
  const rank = (key) => parseInt(summoner?.data?.[key] || "0", 10) || 0;
  const ranks = { skills: {} };
  SHARED_SAVE_RANKS.forEach((key) => {
    ranks[key] = rank(key);
  });
  Object.keys(getPathfinderSkills()).forEach((skill) => {
    ranks.skills[skill] = rank(skill);
  });
  return ranks;
}

function hasSummonerDedicationEidolon(record) {
  return [...(record?.data?.feats || []), ...(record?.data?.bonusFeats || [])].some((feat) => feat?.name === SUMMONER_DEDICATION_EIDOLON);
}

// The ranks updateProficiencies takes from the summoner, as exact ranks:
// { skill: rank, ... } plus perception and the saves for a Summoner
// Dedication eidolon. {} for anyone else, or before the first sync.
function getEidolonSharedRanks(record) {
  if (!isEidolonCharacter(record)) return {};
  const ranks = getEidolonCreatureData(record, "summonerRanks");
  if (!ranks) return {};
  const shared = { ...(ranks.skills || {}) };
  if (hasSummonerDedicationEidolon(record)) {
    SHARED_SAVE_RANKS.forEach((key) => {
      shared[key] = parseInt(ranks[key] || 0, 10) || 0;
    });
  }
  return shared;
}

// The summoner's item bonuses to Perception and to each skill from its
// invested magic items (Impossible Magic pg. 70): the best of each. Only
// those items: not its effects (an elixir), feats, features or items that
// aren't invested. One pass; a modifier with no field or "all" counts for
// every skill, as getEffectsAndModifiersForToken's field filter does.
function getSummonerItemBonuses(summoner) {
  const inventory = (summoner?.data?.inventory || []).filter(
    (item) => item?.data?.carried === "equipped" && item?.data?.invested === "true",
  );
  const itemsOnly = {
    ...summoner,
    effects: [],
    effectIds: [],
    data: { ...(summoner?.data || {}), inventory, features: [], feats: [], bonusFeats: [], ancestries: [], heritages: [], classes: [], actions: [] },
  };
  const mods = getEffectsAndModifiersForToken(itemsOnly, ["perceptionBonus", "skillBonus"], "", undefined, undefined, { keepEveryModifier: true }).filter(
    (mod) => mod.active !== false && mod.type === "item",
  );
  const best = (modifierType, field) =>
    mods
      .filter((mod) => mod.modifierType === modifierType && (!mod.field || mod.field === "all" || mod.field === field))
      .reduce((top, mod) => Math.max(top, parseInt(mod.value, 10) || 0), 0);
  const bonuses = { perception: best("perceptionBonus", "perception"), skills: {} };
  Object.keys(getPathfinderSkills()).forEach((skill) => {
    const value = best("skillBonus", skill);
    if (value > 0) bonuses.skills[skill] = value;
  });
  return bonuses;
}
