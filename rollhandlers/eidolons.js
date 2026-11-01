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
//     other (shareHitPoints), and its maximum HP is the summoner's.
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
      if (levelChanged) onAddEditFeature(current, undefined, true);
      done(current);
    });
  });
}
