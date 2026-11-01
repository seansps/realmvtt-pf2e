// Animal companions as characters (Player Core pg. 206-211, roadmap H14), as
// Foundry's PF2e Companion Compendia builds them: the companion's ancestry is
// its type (bear, wolf...), its class is "Animal Companion", and its stages
// (Mature, Nimble, Savage, Specialized) are feats, all in a data module. The
// ruleset's part is here and where common.js calls it:
//   - a character whose class is Animal Companion gets no Automatic Bonus
//     Progression (isAbpCharacter; not a printed rule but Foundry's
//     convention, its companion class sets flags.system.disableABP) and no
//     attribute boosts at levels 5, 10, 15 and 20 (getLevelUpGains, and the
//     free boost fields stay hidden: getFreeBoostFieldsForLevel);
//   - the only item bonuses it benefits from are to AC and Speed, and its
//     item bonus to AC is at most +3 all told, its armor's (barding's) and
//     any other's (Player Core pg. 206; getEffectsAndModifiersForToken,
//     getACForArmor);
//   - its level is its master's, set from the Notes tab's Master field and
//     its Match Master's Level button (there's no level-up hook).
// The extra damage dice of mature and specialized companions are the
// weaponDiceCount modifier (getAlteredWeapon).

// Whether a creature is an animal companion: its class is Animal Companion
// (by name, or data.animalCompanion on the class record)
function isAnimalCompanionCharacter(creature) {
  const classes = creature?.data?.classes || creature?.record?.data?.classes || [];
  return classes.some(
    (classObj) => toSlug(String(classObj?.name || "")) === "animal-companion" || classObj?.data?.animalCompanion === true,
  );
}

// Whether an ancestry is an animal companion type: flagged animalCompanion
// (the module's), or an animal rather than a humanoid. Such an ancestry has
// no heritages, so dropping it doesn't ask for one.
function isAnimalCompanionAncestry(ancestry) {
  if (ancestry?.data?.animalCompanion === true) return true;
  const traits = (ancestry?.data?.traits || []).map((trait) => String(trait?.name || trait).toLowerCase());
  return traits.includes("animal") && !traits.includes("humanoid");
}

// Whether a picture is one of Realm's placeholders (or none)
const isDefaultImage = (path) => !path || /default-icons|\/icons\/fantasy\/default/.test(String(path));

// The portrait and token image an animal companion takes from its type's
// ancestry when dropped: the ancestry's picture, and its data.tokenImage for
// the token if it has one (creature art comes with its own token), for
// whichever of the two is still empty or a placeholder (a picture of the
// player's own stays)
function getCompanionImageValues(character, ancestry) {
  if (!isAnimalCompanionAncestry(ancestry)) return {};
  const portrait = ancestry?.portrait;
  const token = isDefaultImage(ancestry?.data?.tokenImage) ? portrait : ancestry.data.tokenImage;
  const values = {};
  if (!isDefaultImage(portrait) && isDefaultImage(character?.portrait)) values.portrait = portrait;
  if (!isDefaultImage(token) && isDefaultImage(character?.token?.imageUrl)) values["token.imageUrl"] = token;
  return values;
}

// The modifier kinds an animal companion's item bonuses still count for
const ANIMAL_COMPANION_ITEM_BONUS_TYPES = ["armorClassBonus", "speedBonus", "speed"];

// An animal companion's modifiers without the item bonuses it can't benefit
// from (all but AC and Speed); item penalties still apply. An effect rule's
// modifierType keeps its bonus type as a suffix ("perceptionBonus-item"),
// so that's stripped first. Its item bonus to AC is at most +3 all told:
// armorItemBonus is what its armor already gives (getACForArmor), and an
// item bonus to AC from anything else gets only the rest of the +3.
function withoutAnimalCompanionItemBonuses(results, armorItemBonus = 0) {
  const kind = (r) => `${r.modifierType || ""}`.replace(/-(item|status|circumstance)$/, "");
  const roomForAc = Math.max(0, ANIMAL_COMPANION_MAX_ARMOR_AC - Math.max(0, armorItemBonus));
  return results
    .filter(
      (r) =>
        !(
          r.type === "item" &&
          kind(r).endsWith("Bonus") &&
          !ANIMAL_COMPANION_ITEM_BONUS_TYPES.includes(kind(r)) &&
          !(parseFloat(r.value) < 0)
        ),
    )
    .map((r) =>
      r.type === "item" && kind(r) === "armorClassBonus" && parseFloat(r.value) > roomForAc
        ? { ...r, value: roomForAc }
        : r,
    );
}

// The most an animal companion's armor (barding) adds to its AC as an item
// bonus, potency included
const ANIMAL_COMPANION_MAX_ARMOR_AC = 3;

// The companion's master's id, from the Notes tab's Master field (a record
// link, stored as JSON or as an object), or null
function getCompanionMasterId(record) {
  const master = record?.data?.companionMaster;
  if (!master) return null;
  if (typeof master === "object") return master._id || master.value?._id || null;
  try {
    const parsed = JSON.parse(master);
    return parsed?._id || parsed?.value?._id || null;
  } catch (error) {
    return null;
  }
}

// Brings an animal companion's level to its master's: reads the master and,
// when the levels differ, writes the level and works the sheet out again
// (onAddEditFeature). masterId may be passed in (the Master field's
// onchange value); callback(record) gets the record after.
function syncCompanionLevel(record, masterId = getCompanionMasterId(record), callback) {
  const done = (updated) => {
    if (callback) callback(updated);
  };
  if (!record || !masterId) return done(record);
  api.getRecord("characters", masterId, (master) => {
    const level = parseInt(master?.data?.level, 10);
    if (!(level >= 0)) return done(record);
    if (parseInt(record.data?.level, 10) === level) return done(record);
    api.setValuesOnRecord(record, { "data.level": level }, (updated) => {
      const current = updated || { ...record, data: { ...(record.data || {}), level } };
      onAddEditFeature(current, undefined, true);
      done(current);
    });
  });
}

// The record id in a record-picker field's value (a record link, stored as
// JSON or as an object), or null
function getRecordIdFromValue(value) {
  if (!value) return null;
  if (typeof value === "object") return value._id || value.value?._id || null;
  try {
    const parsed = JSON.parse(value);
    return parsed?._id || parsed?.value?._id || null;
  } catch (error) {
    return null;
  }
}

// The Notes tab's Master field changed: the companion takes its master's
// level (value is the field's new record link)
function onCompanionMasterChange(value) {
  const masterId = getRecordIdFromValue(value);
  if (!masterId) return;
  // An eidolon takes its summoner's level and Hit Points (eidolons.js)
  if (isEidolonCharacter(record)) {
    syncEidolonWithSummoner(record, masterId, (updated) => {
      api.showNotification(`${record?.name || "The eidolon"} is level ${updated?.data?.level}, and shares its summoner's Hit Points.`, "green", "Eidolon");
    });
    return;
  }
  syncCompanionLevel(record, masterId, (updated) => {
    const level = updated?.data?.level;
    if (level !== undefined) {
      api.showNotification(`${record?.name || "The companion"} is now level ${level}, as its master is.`, "green", "Animal Companion");
    }
  });
}

// The values that give a companion a creature's art: its portrait, and its
// token image (or its portrait when it has no separate token). {} when the
// creature has no real picture.
function getCreatureArtValues(creature) {
  const portrait = creature?.portrait;
  const token = isDefaultImage(creature?.token?.imageUrl) ? portrait : creature.token.imageUrl;
  const values = {};
  if (!isDefaultImage(portrait)) values.portrait = portrait;
  if (!isDefaultImage(token)) values["token.imageUrl"] = token;
  return values;
}

// The Notes tab's "Use art from creature" field changed: the companion takes
// that NPC's portrait and token, so a table whose books include creature
// art (Monster Core's Grizzly Bear...) can use it; the module ships none.
// Picking one replaces the companion's pictures; the choice is the player's.
function onCompanionArtChange(value) {
  const creatureId = getRecordIdFromValue(value);
  if (!creatureId) return;
  api.getRecord("npcs", creatureId, (creature) => {
    const values = getCreatureArtValues(creature);
    if (Object.keys(values).length === 0) {
      api.showNotification(`${creature?.name || "That creature"} has no art to use.`, "yellow", "Animal Companion");
      return;
    }
    api.setValues(values, () => {
      api.showNotification(`${record?.name || "The companion"} now uses ${creature.name}'s art.`, "green", "Animal Companion");
    });
  });
}

// The Notes tab's Match Master's Level button
function onCompanionMatchLevel() {
  if (!getCompanionMasterId(record)) {
    api.showNotification("Choose the companion's master first.", "yellow", "Animal Companion");
    return;
  }
  if (isEidolonCharacter(record)) {
    syncEidolonWithSummoner(record, getCompanionMasterId(record), (updated) => {
      api.showNotification(`${record?.name || "The eidolon"} is level ${updated?.data?.level}, and shares its summoner's Hit Points.`, "green", "Eidolon");
    });
    return;
  }
  syncCompanionLevel(record, getCompanionMasterId(record), (updated) => {
    api.showNotification(`${record?.name || "The companion"} is level ${updated?.data?.level}, as its master is.`, "green", "Animal Companion");
  });
}
