// Spellcasting entries made from the character's class: the Spells per Day
// tables, the class specs, building and syncing the entries the sheet
// manages, and the helpers they share with spells.js. Loaded as one of the
// ruleset's scripts (ruleset.config.json, otherSettings.scripts), so it
// shares the global scope with common.js at runtime.

// The character's own rank for an entry's statistic: spell attacks and DCs,
// or the class DC
function getCharacterSpellcastingRank(record, proficiency, valuesToSet = {}) {
  const rank =
    (proficiency || "spell") === "spell"
      ? valuesToSet["data.spellcasting"] ?? record.data?.spellcasting
      : valuesToSet["data.classDCProficiency"] ??
        record.data?.classDCProficiency;
  return parseInt(rank || "0", 10) || 0;
}

// Proficiency rank for an entry's spell attacks and DCs: the higher of the
// character's rank and the entry's own. A managed entry's own rank is the one
// picked in its training dropdown (or the one it had above the character's
// when it was taken over), and its source's (auto.training, 0 for the class).
// It isn't read back from data.training, so the entry follows the character's
// rank down as well as up and the sync never undoes itself.
function getSpellcastingEntryTraining(
  record,
  spellcastingEntry,
  valuesToSet = {},
) {
  const rank = getCharacterSpellcastingRank(
    record,
    spellcastingEntry.data?.proficiency,
    valuesToSet,
  );
  const toRank = (value) => parseInt(value || "0", 10) || 0;

  if (isManagedSpellcastingEntry(spellcastingEntry)) {
    const auto = spellcastingEntry.data.auto;
    return Math.max(rank, toRank(auto.training), toRank(auto.ownTraining));
  }
  return Math.max(rank, toRank(spellcastingEntry.data?.training));
}

// Writes the spellcasting entries. Adding or removing an entry or a spell row
// writes the whole list (never the list and its fields in one payload);
// otherwise only the fields that changed are written, so a run that changes
// nothing (onTurnStart) writes nothing and can't undo a cast made meanwhile.
function setSpellcastingEntryValues(record, entries, valuesToSet) {
  syncFocusPool(record, entries, valuesToSet);
  const oldEntries = record.data?.spells || [];
  const rowsChanged = (entry, oldEntry) =>
    SPELL_RANK_LISTS.some(
      (list) =>
        JSON.stringify(entry.data?.[list]) !==
        JSON.stringify(oldEntry?.data?.[list]),
    );
  const structural =
    entries.length !== oldEntries.length ||
    entries.some(
      (entry, index) =>
        entry._id !== oldEntries[index]?._id ||
        rowsChanged(entry, oldEntries[index]),
    );

  if (structural) {
    valuesToSet["data.spells"] = entries;
    return;
  }
  entries.forEach((entry, index) => {
    setChangedValues(oldEntries[index], entry, `data.spells.${index}`, valuesToSet);
  });
}

// Copies record data (plain JSON) so it can be changed before writing
function cloneRecordData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// Adds every field that differs between two versions of an object to
// valuesToSet. Lists, and objects that are new, are written whole.
function setChangedValues(before, after, path, valuesToSet) {
  const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  if (isObject(before) && isObject(after)) {
    for (const key of Object.keys(after)) {
      setChangedValues(before[key], after[key], `${path}.${key}`, valuesToSet);
    }
  } else if (JSON.stringify(before) !== JSON.stringify(after)) {
    valuesToSet[path] = after;
  }
}

// ---------------------------------------------------------------------------
// Spellcasting entries from the class
//
// A caster class's spellcasting entries are made when the class is added to
// a character (dropped on the sheet, or picked in the creation wizard, which
// drops it), sized from the class's Spells per Day table at the character's
// level, and follow the level from then on. Characters whose class was added
// before keep their entries as they are; the player can check "Set slots
// from level" on one of their own entries to have it follow the class (see
// optInSpellcastingEntry). The entries the sheet manages carry data.auto:
//   source     "class:wizard", "class:cleric:font", "class:animist:apparition"
//   version    SPELLCASTING_SYNC_VERSION when last synced
//   base       the table counts last written (numCantrips, numSpells1-10, and
//              repCantrips, rep1-10 for repertoire rows). A count above or
//              below its base is the player's own change, kept on top of the
//              table at later levels.
//   offCounts  the counts when "Set slots from level" was turned off, to tell
//              the ones the player changed meanwhile when it's turned back on
//   type, tradition, attribute   the values last written; once the player
//              picks something else, theirs is kept
//   training   the source's own rank (0 for class entries)
//   ownTraining  the rank picked in the entry's training dropdown, or the
//              rank it had over the character's when the player opted it in
//              (or, for a Divine Font or apparition entry the sheet made, the
//              class's entry's then)
//   shown      the spell lists the sheet last showed
//   adopted    the player made the entry and opted it in
//   raisedFrom the counts opting in raised to the class's, as they were (the
//              notice names them)
//   spellFilter  the Divine Font's spell (heal or harm). Not read yet: the
//              spell picker (phase C) will offer only these.
//   orphaned   the source is gone; the entry is kept but no longer managed
// data.autoSlots (the "Set slots from level" checkbox) turns the counts and
// rows off for one entry, or opts in an entry the player made.
// data.autoSpellcasting is set when the class is added: the class's entries
// are made only on those characters. data.autoFocusSpellcasting, set with it,
// does the same for the class's focus entry (source "class:cleric:focus"),
// which came in later, so characters from before don't get one. A
// spellcasting archetype's entry is made
// when its dedication is taken: data.spellcastingSources keeps the sources
// the character had at the last sync. Deleting an entry the sheet made adds
// its source to data.spellcastingDismissed so it isn't made again until the
// player clicks Restore Automatic Entries.
// ---------------------------------------------------------------------------

// The version of the sync that last wrote a managed entry (data.auto.version)
const SPELLCASTING_SYNC_VERSION = 1;

// An entry's spell lists, indexed by rank
const SPELL_RANK_LISTS = [
  "cantrips",
  "spells1",
  "spells2",
  "spells3",
  "spells4",
  "spells5",
  "spells6",
  "spells7",
  "spells8",
  "spells9",
  "spells10",
];

// Animist apparition slots (War of Immortals pg. 10), by rank and level
const APPARITION_SPELL_SLOTS = {
  1: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  2: [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  3: [0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  4: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  5: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2],
  6: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
  7: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2],
  8: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2],
  9: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
  // Supreme Incarnation
  10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
};

// Attuned apparitions by level (Third Apparition at 7th, Fourth at 15th)
const ATTUNED_APPARITIONS = [
  2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4,
];

// Spell slots of a rank at a level for a Spells per Day table (Archives of
// Nethys class tables). A new rank r arrives at level 2r - 1.
//   FULL3      2 slots of a new rank, then 3 (bard, cleric, druid, witch,
//              wizard, Advanced Player's Guide oracle)
//   FULL4      3, then 4 (sorcerer, Player Core 2 oracle)
//   TWO        1, then 2 (psychic, necromancer)
//   TWO_NO10   as TWO with no 10th rank (animist, Impossible Magic magus and
//              summoner)
//   BOUNDED    only the two highest ranks, 2 slots each (Secrets of Magic
//              magus and summoner)
//   FLEXIBLE   2 of each rank (Flexible Spellcaster class archetype)
//   APPARITION the animist's apparition slots
// The 10th-rank slot comes at 19th level.
function getSpellSlotCount(table, rank, level) {
  level = Math.min(20, parseInt(level, 10) || 0);
  if (!(rank >= 1 && rank <= 10) || level < 1) {
    return 0;
  }
  if (table === "APPARITION") {
    return APPARITION_SPELL_SLOTS[rank]?.[level - 1] || 0;
  }
  if (rank === 10) {
    return ["FULL3", "FULL4", "TWO", "FLEXIBLE"].includes(table) && level >= 19
      ? 1
      : 0;
  }
  if (table === "BOUNDED") {
    if (level <= 4) {
      return ({ 1: [1, 2, 2, 2], 2: [0, 0, 1, 2] }[rank] || [])[level - 1] || 0;
    }
    const top = Math.min(9, Math.ceil(level / 2));
    return rank === top || rank === top - 1 ? 2 : 0;
  }
  const counts = {
    FULL3: [2, 3],
    FULL4: [3, 4],
    TWO: [1, 2],
    TWO_NO10: [1, 2],
    FLEXIBLE: [2, 2],
  }[table];
  const firstLevel = 2 * rank - 1;
  if (!counts || level < firstLevel) {
    return 0;
  }
  return level === firstLevel ? counts[0] : counts[1];
}

// Spellcasting of each caster class, keyed by the slug of the class name.
// `legacy` holds what the pre-remaster book does differently. A tradition
// given as { flag } comes from the class choice stored in that flag.
const CLASS_SPELLCASTING = {
  // The muse adds a 1st-rank spell to the repertoire
  bard: {
    type: "spontaneous",
    tradition: "Occult",
    attribute: "cha",
    cantrips: 5,
    table: "FULL3",
    repertoireExtra: { 1: 1 },
  },
  // Divine Font: 4 extra slots at the highest rank, 5 from 5th level, 6 from
  // 15th; 1 + Charisma modifier in the Core Rulebook
  cleric: {
    type: "prepared",
    tradition: "Divine",
    attribute: "wis",
    cantrips: 5,
    table: "FULL3",
    font: [4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
    legacy: { font: "1+cha" },
  },
  druid: {
    type: "prepared",
    tradition: "Primal",
    attribute: "wis",
    cantrips: 5,
    table: "FULL3",
  },
  witch: {
    type: "prepared",
    tradition: { flag: "patron" },
    attribute: "int",
    cantrips: 5,
    table: "FULL3",
  },
  // An arcane school adds a cantrip and a slot at each rank 1-9 (curriculum
  // or school spells); Unified Magical Theory and the Core Rulebook's
  // Universalist don't. The Realm data has no Core Rulebook wizard yet, so
  // the Universalist matches whatever its option is named ("Universalist",
  // "Universalist Wizard").
  wizard: {
    type: "prepared",
    tradition: "Arcane",
    attribute: "int",
    cantrips: 5,
    table: "FULL3",
    schoolSlot: {
      flag: "arcaneSchool",
      none: /unified-magical-theory|universalist/,
    },
  },
  // Draconic's tradition comes from the dragon chosen with it
  sorcerer: {
    type: "spontaneous",
    tradition: { flag: "bloodline", nested: "dragonBloodline" },
    attribute: "cha",
    cantrips: 5,
    table: "FULL4",
  },
  // A remastered oracle's mystery adds its granted spells to the repertoire
  // (ORACLE_MYSTERY_SPELL_RANKS). The Advanced Player's Guide oracle had 2/3
  // slots and only its mystery's granted cantrip, on top of 5.
  oracle: {
    type: "spontaneous",
    tradition: "Divine",
    attribute: "cha",
    cantrips: 5,
    table: "FULL4",
    mysterySpells: true,
    legacy: { table: "FULL3", cantrips: 6, mysterySpells: false },
  },
  // Secrets of Magic: bounded casting, plus 2 studious spell slots of 2nd
  // rank at 7th level, 3rd at 11th and 4th at 13th
  magus: {
    type: "prepared",
    tradition: "Arcane",
    attribute: "int",
    cantrips: 5,
    table: "TWO_NO10",
    legacy: {
      table: "BOUNDED",
      studious: [0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4],
    },
  },
  // Secrets of Magic: bounded casting. The repertoire starts with two 1st-rank
  // spells and reaches its maximum of 5 at 4th level, which it keeps as low
  // ranks are lost; the spell over the slot count sits at the lowest rank.
  summoner: {
    type: "spontaneous",
    tradition: { flag: "eidolon" },
    attribute: "cha",
    cantrips: 5,
    table: "TWO_NO10",
    legacy: { table: "BOUNDED", repertoireExtraLowest: 1 },
  },
  // Intelligence or Charisma by subconscious mind (the key attribute). The
  // conscious mind adds a spell of each rank to the repertoire, and psi
  // cantrips on top of the 3: 2 standard and the surface one, the deeper one
  // at 6th level and the deepest at 10th.
  psychic: {
    type: "spontaneous",
    tradition: "Occult",
    attribute: "key",
    cantrips: 3,
    table: "TWO",
    repertoireExtraPerRank: 1,
    psiCantrips: [3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  },
  // Apparition spellcasting is a second, spontaneous entry. Each attuned
  // apparition adds a cantrip and a spell of each rank to its repertoire.
  animist: {
    type: "prepared",
    tradition: "Divine",
    attribute: "wis",
    cantrips: 2,
    table: "TWO_NO10",
    extraEntries: [
      {
        suffix: "apparition",
        name: "Apparition Spells",
        type: "spontaneous",
        cantrips: ATTUNED_APPARITIONS,
        table: "APPARITION",
        attunedRepertoire: true,
      },
    ],
  },
  necromancer: {
    type: "prepared",
    tradition: "Occult",
    attribute: "int",
    cantrips: 5,
    table: "TWO",
  },
};

// The ranks of the spells a remastered oracle mystery grants after its
// cantrip and 1st-rank spell (Player Core 2, Divine Mysteries and Dark
// Archive (Remastered), on Archives of Nethys). Each joins the repertoire
// once the oracle can cast spells of its rank.
const ORACLE_MYSTERY_SPELL_RANKS = {
  ancestors: [2, 5],
  ash: [2, 6],
  ashes: [2, 6],
  battle: [2, 4],
  blight: [2, 5],
  bones: [2, 3],
  cosmos: [2, 5],
  flames: [2, 3],
  life: [2, 5],
  lore: [3, 6],
  tempest: [4, 6],
  time: [3, 7],
};

// The ranks of the spells the character's mystery adds to the repertoire:
// 1st for every mystery, and the mystery's others once it's chosen
function getOracleMysterySpellRanks(record) {
  const mystery = `${record?.data?.flags?.mystery || ""}`
    .toLowerCase()
    .replace(/^mystery-/, "")
    .replace(/-mystery$/, "");
  return [1, ...(ORACLE_MYSTERY_SPELL_RANKS[mystery] || [])];
}

// Flexible Spellcaster class archetype (Secrets of Magic pg. 209), from the
// class feature Flexible Spell Preparation or its dedication: 2 slots of each
// rank and 2 fewer class cantrips, back to 4 with the dedication at 2nd level
// and 5 from 4th. Only for classes that prepare the standard 2-then-3 slots;
// restricted extra slots (school spells, Divine Font) don't change.
const FLEXIBLE_CANTRIPS = [
  3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
];

function hasFlexibleSpellcasting(record) {
  return (
    hasFeatNamed(record, "Flexible Spell Preparation") ||
    hasFeatNamed(record, "Flexible Spellcaster Dedication")
  );
}

// Draconic bloodline (Player Core 2 pg. 150): the tradition of the chosen
// dragon, as Archives of Nethys gives it from the dragon's Monster Core,
// Monster Core 2 or Draconic Codex entry (Foundry's dragonBloodline choice
// maps most of these to arcane instead). The chromatic and metallic dragons
// were never remastered and stay arcane, as in the Core Rulebook; a dragon not
// listed here also defaults to arcane, and the player can change it on the
// entry.
const DRAGON_TRADITIONS = {
  "arcane-dragon": "Arcane",
  "divine-dragon": "Divine",
  "occult-dragon": "Occult",
  "primal-dragon": "Primal",
  // Monster Core and Monster Core 2
  "adamantine-dragon": "Primal",
  "cinder-dragon": "Primal",
  "conspirator-dragon": "Occult",
  "coral-dragon": "Primal",
  "despair-dragon": "Occult",
  "diabolic-dragon": "Divine",
  "empyreal-dragon": "Divine",
  "fortune-dragon": "Arcane",
  "horned-dragon": "Primal",
  "mirage-dragon": "Arcane",
  "omen-dragon": "Occult",
  "phase-dragon": "Arcane",
  "requiem-dragon": "Divine",
  "resurrection-dragon": "Divine",
  "rune-dragon": "Arcane",
  "whisper-dragon": "Occult",
  // Draconic Codex, including the remastered imperial and primal dragons
  "barrage-dragon": "Arcane",
  "bog-dragon": "Primal",
  "brine-dragon": "Primal",
  "cloud-dragon": "Primal",
  "crystal-dragon": "Primal",
  "delight-dragon": "Divine",
  "executor-dragon": "Divine",
  "forest-dragon": "Primal",
  "magma-dragon": "Primal",
  "mocking-dragon": "Occult",
  "oath-dragon": "Divine",
  "rime-dragon": "Primal",
  "sage-dragon": "Occult",
  "sea-dragon": "Arcane",
  "sky-dragon": "Divine",
  "sovereign-dragon": "Occult",
  "stormcrown-dragon": "Primal",
  "time-dragon": "Arcane",
  "umbral-dragon": "Occult",
  "underworld-dragon": "Arcane",
  "vizier-dragon": "Occult",
  "vorpal-dragon": "Arcane",
  "wailing-dragon": "Arcane",
  "wish-dragon": "Arcane",
};

// Traditions of bloodlines, patrons and eidolons by name, for when the chosen
// feature isn't on the character or doesn't say. Draconic and the remaster
// dragon eidolon have no fixed tradition. A tradition given as { legacy }
// holds for that edition of the class only.
const SUBCLASS_TRADITIONS = {
  bloodline: {
    aberrant: "Occult",
    aesir: "Divine",
    angelic: "Divine",
    demonic: "Divine",
    diabolic: "Divine",
    elemental: "Primal",
    fey: "Primal",
    genie: "Arcane",
    hag: "Occult",
    harrow: "Occult",
    imperial: "Arcane",
    nymph: "Primal",
    phoenix: "Primal",
    psychopomp: "Divine",
    shadow: "Occult",
    undead: "Divine",
    wyrmblessed: "Divine",
  },
  patron: {
    "baba-yaga": "Occult",
    "choir-politic": "Divine",
    cobyslarni: "Occult",
    curse: "Occult",
    "devourer-of-decay": "Primal",
    "faiths-flamekeeper": "Divine",
    fate: "Occult",
    fervor: "Divine",
    "mosquito-witch": "Primal",
    night: "Occult",
    pacts: "Occult",
    "paradox-of-opposites": "Divine",
    "ripple-in-the-deep": "Primal",
    rune: "Arcane",
    "silence-in-snow": "Primal",
    "spinner-of-threads": "Occult",
    "starless-shadow": "Occult",
    "the-inscribed-one": "Arcane",
    "the-resentment": "Occult",
    "the-unseen-broker": "Occult",
    "whisper-of-wings": "Primal",
    wild: "Primal",
    "wilding-steward": "Primal",
    winter: "Primal",
  },
  eidolon: {
    aberrant: "Occult",
    angel: "Divine",
    "anger-phantom": "Occult",
    beast: "Primal",
    construct: "Arcane",
    demon: "Divine",
    "devotion-phantom": "Occult",
    // Secrets of Magic; the remaster's takes its dragon's tradition
    dragon: { legacy: "Arcane" },
    elemental: "Primal",
    fey: "Primal",
    ooze: "Arcane",
    plant: "Primal",
    psychopomp: "Divine",
    swarm: "Primal",
    undead: "Divine",
  },
};

const SPELL_TRADITIONS = ["Arcane", "Divine", "Occult", "Primal"];

// Which book a class or feat follows: legacy (Core Rulebook era) or remaster.
// Without a remaster flag, the book's title decides.
function getSpellcastingEdition(source) {
  const publication = source?.data?.publication;
  if (publication?.remaster === false) return "legacy";
  if (publication?.remaster === true) return "remaster";
  return /Secrets of Magic|Core Rulebook|Advanced Player|Dark Archive$/i.test(
    publication?.title || "",
  )
    ? "legacy"
    : "remaster";
}

// The class's spellcasting for its edition, or null for classes without
// spell slots
function getClassSpellcasting(classObj) {
  const name = `${classObj?.name || ""}`.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const slug = toSlug(name);
  if (!Object.prototype.hasOwnProperty.call(CLASS_SPELLCASTING, slug)) {
    return null;
  }
  const casting = CLASS_SPELLCASTING[slug];
  const edition = getSpellcastingEdition(classObj);
  return { ...casting, ...(casting[edition] || {}), slug, name, edition };
}

// The class feature (or feat) chosen for a choice whose flag holds `slug`
function findChosenFeature(record, slug) {
  const classFeatures = (record.data?.classes || []).flatMap(
    (classObj) => classObj?.data?.features || [],
  );
  return (
    [
      ...classFeatures,
      ...(record.data?.feats || []),
      ...(record.data?.bonusFeats || []),
    ].find(
      (feature) => feature?.data?.type !== "slot" && toSlug(feature?.name) === slug,
    ) || null
  );
}

// A bloodline, patron or eidolon's tradition, from its roll option
// (feature:bloodline:tradition:occult) or its "Tradition" / "Spell List"
// line. "variable" when it depends on another choice.
function getFeatureTradition(feature) {
  for (const modifier of feature?.data?.modifiers || []) {
    const match = `${modifier.data?.option || ""}`.match(
      /^feature:bloodline:tradition:(arcane|divine|occult|primal)$/i,
    );
    if (modifier.data?.type === "rollOption" && match) {
      return capitalize(match[1].toLowerCase());
    }
  }
  const match = `${feature?.data?.description || ""}`.match(
    /<strong>\s*(?:Tradition|Spell List)\s*<\/strong>\s*(arcane|divine|occult|primal|variable)/i,
  );
  return match ? capitalize(match[1].toLowerCase()) : null;
}

// The tradition set by a class choice (bloodline, patron, eidolon), or null
// while it is unmade or unknown. `edition` is the class's.
function getSubclassTradition(record, flag, nestedFlag, edition = "remaster") {
  const flags = record.data?.flags || {};
  const value = flags[flag];
  if (!value) {
    return null;
  }
  const chosen = findChosenFeature(record, value);
  const lookUp = (table, key) =>
    table && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
  let tradition = chosen ? getFeatureTradition(chosen) : null;
  if (!tradition) {
    const name = `${value}`
      .replace(/^bloodline-/, "")
      .replace(/-(bloodline|eidolon|patron)$/, "");
    tradition = lookUp(SUBCLASS_TRADITIONS[flag], name);
    if (tradition && typeof tradition === "object") {
      tradition = tradition[edition] || null;
    }
  }
  if ((!tradition || tradition === "Variable") && nestedFlag && flags[nestedFlag]) {
    tradition = lookUp(DRAGON_TRADITIONS, flags[nestedFlag]) || "Arcane";
  }
  return SPELL_TRADITIONS.includes(tradition) ? tradition : null;
}

// A psychic casts with Intelligence or Charisma, the attribute their
// subconscious mind names (also their key attribute). Without a mind, the key
// attribute; the higher of the two until either is chosen.
function getKeySpellcastingAttribute(record, valuesToSet = {}) {
  const key = record.data?.keyAbility;
  const mindFlag = record.data?.flags?.subconsciousMind;
  const mind = mindFlag ? findChosenFeature(record, mindFlag) : null;
  const mindOptions = (mind?.data?.keyOptions || []).filter(
    (ability) => ability === "int" || ability === "cha",
  );
  if (mindOptions.length > 0) {
    return mindOptions.includes(key) ? key : mindOptions[0];
  }
  if (key === "int" || key === "cha") {
    return key;
  }
  const int = parseInt(valuesToSet["data.int"] ?? record.data?.int ?? 0, 10) || 0;
  const cha = parseInt(valuesToSet["data.cha"] ?? record.data?.cha ?? 0, 10) || 0;
  return cha > int ? "cha" : "int";
}

// Counts for one class entry at a level: numCantrips (prepared) and
// numSpells1-10, plus repertoire rows (repCantrips, rep1-10) for spontaneous
// casters
function getClassSpellcastingSpec(record, config, level, spec) {
  const cantrips = Array.isArray(config.cantrips)
    ? config.cantrips[level - 1]
    : config.cantrips || 0;
  const slots = {};
  for (let rank = 1; rank <= 10; rank++) {
    slots[rank] = getSpellSlotCount(config.table, rank, level);
  }

  // Bonus slots added to the entry: a wizard's school slots, and a legacy
  // magus's studious spell slots (`bonus` says which)
  let numCantrips = cantrips;
  let bonus = null;
  const school = config.schoolSlot && record.data?.flags?.[config.schoolSlot.flag];
  if (school && !config.schoolSlot.none.test(school)) {
    bonus = "school";
    numCantrips += 1;
    for (let rank = 1; rank <= 9; rank++) {
      if (slots[rank] > 0) {
        slots[rank] += 1;
      }
    }
  }
  const studiousRank = config.studious?.[level - 1];
  if (studiousRank) {
    bonus = "studious";
    slots[studiousRank] += 2;
  }

  const counts = {};
  if (config.type === "prepared") {
    counts.numCantrips = numCantrips;
  }
  for (let rank = 1; rank <= 10; rank++) {
    counts[`numSpells${rank}`] = slots[rank];
  }

  // A spontaneous caster learns a spell for each slot. The 10th-rank class
  // feature adds 2 spells for its 1 slot.
  let repertoire = null;
  if (config.type === "spontaneous") {
    const lowestRank = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((rank) => slots[rank] > 0);
    // A remastered oracle's mystery adds a cantrip and a spell at each rank
    // it grants
    const mysteryRanks = config.mysterySpells ? getOracleMysterySpellRanks(record) : [];
    repertoire = {
      repCantrips:
        numCantrips +
        (config.psiCantrips?.[level - 1] || 0) +
        (config.mysterySpells ? 1 : 0),
    };
    for (let rank = 1; rank <= 10; rank++) {
      let known = 0;
      if (slots[rank] > 0 && config.attunedRepertoire) {
        known = rank === 10 ? slots[rank] : cantrips;
      } else if (slots[rank] > 0 && rank === 10) {
        known = 2;
      } else if (slots[rank] > 0) {
        known =
          slots[rank] +
          (config.repertoireExtra?.[rank] || 0) +
          (config.repertoireExtraPerRank || 0) +
          (rank === lowestRank ? config.repertoireExtraLowest || 0 : 0) +
          (mysteryRanks.includes(rank) ? 1 : 0);
      }
      repertoire[`rep${rank}`] = known;
    }
  }

  return { ...spec, type: config.type, counts, repertoire, training: 0, bonus };
}

// Divine Font: its own prepared entry, as its slots only take heal or harm.
// They sit at the highest rank of cleric slots, staying at 9th once the
// 10th-rank slot arrives (10th-rank slots can't be used with abilities that
// give more slots).
function getDivineFontSpec(record, casting, level, valuesToSet) {
  let highestRank = 0;
  for (let rank = 1; rank <= 10; rank++) {
    if (getSpellSlotCount(casting.table, rank, level) > 0) {
      highestRank = rank;
    }
  }
  const fontRank = Math.min(9, highestRank);
  const cha = parseInt(valuesToSet["data.cha"] ?? record.data?.cha ?? 0, 10) || 0;
  const count = Array.isArray(casting.font)
    ? casting.font[level - 1]
    : Math.max(0, 1 + cha);

  const counts = { numCantrips: 0 };
  for (let rank = 1; rank <= 10; rank++) {
    counts[`numSpells${rank}`] = rank === fontRank ? count : 0;
  }
  const font = `${record.data?.flags?.divineFont || ""}`;
  return {
    source: `class:${casting.slug}:font`,
    name: "Divine Font",
    type: "prepared",
    tradition: typeof casting.tradition === "string" ? casting.tradition : null,
    attribute: casting.attribute,
    counts,
    repertoire: null,
    training: 0,
    fontRank,
    spellFilter: font.includes("harm") ? ["harm"] : font.includes("heal") ? ["heal"] : null,
  };
}

// The spellcasting entries a character's class and spellcasting archetypes
// give at a level, as specs: { source, name, level, type, tradition (null
// while the choice that sets it is unmade), attribute, counts, repertoire,
// training, bonus ("school" or "studious" when the counts hold those bonus
// slots), fontRank and spellFilter for the Divine Font, and archetype for an
// archetype's }. Empty for NPCs and level 0 characters.
function getWantedSpellcastingEntries(record, level, valuesToSet = {}) {
  level = Math.min(20, parseInt(level, 10) || 0);
  if (record?.recordType !== "characters" || isLevelZeroCharacter(record) || level < 1) {
    return [];
  }
  const casting = getClassSpellcasting(record.data?.classes?.[0]);
  const specs = casting ? getClassSpellcastingSpecs(record, casting, level, valuesToSet) : [];
  specs.push(...getArchetypeSpellcastingSpecs(record, level, valuesToSet, casting?.slug));
  specs.push(...getFocusSpellcastingSpecs(record));
  return specs.map((spec) => ({ ...spec, level }));
}

// The entries a caster class gives at a level (see getWantedSpellcastingEntries)
function getClassSpellcastingSpecs(record, classCasting, level, valuesToSet) {
  let casting = classCasting;
  if (
    casting.type === "prepared" &&
    casting.table === "FULL3" &&
    hasFlexibleSpellcasting(record)
  ) {
    casting = { ...casting, table: "FLEXIBLE", cantrips: FLEXIBLE_CANTRIPS };
  }

  const tradition =
    typeof casting.tradition === "string"
      ? casting.tradition
      : getSubclassTradition(
          record,
          casting.tradition.flag,
          casting.tradition.nested,
          casting.edition,
        );
  const attribute =
    casting.attribute === "key"
      ? getKeySpellcastingAttribute(record, valuesToSet)
      : casting.attribute;

  const specs = [
    getClassSpellcastingSpec(record, casting, level, {
      source: `class:${casting.slug}`,
      name: `${casting.name} Spells`,
      tradition,
      attribute,
    }),
  ];
  for (const extra of casting.extraEntries || []) {
    specs.push(
      getClassSpellcastingSpec(record, extra, level, {
        source: `class:${casting.slug}:${extra.suffix}`,
        name: extra.name,
        tradition,
        attribute,
      }),
    );
  }
  if (casting.font) {
    specs.push(getDivineFontSpec(record, casting, level, valuesToSet));
  }
  return specs;
}

// Spellcasting archetypes (Player Core pg. 215, Core Rulebook pg. 219): the
// dedication gives cantrips, the basic, expert and master spellcasting feats
// give slots as the character levels up, and a breadth feat 1 more of each
// rank but the two highest. Each casts like its class (type, tradition and
// attribute in CLASS_SPELLCASTING), with these differences:
//   cantrips    the dedication's: 2, the witch's 1 (prepared from their
//               familiar) and the psychic's 1 psi cantrip
//   breadth     the breadth feat
//   startsWith  the feat that gives the spellcasting when the dedication
//               doesn't (the summoner's basic spellcasting)
//   master      the master spellcasting feat's name when it isn't
//               "Master <Class> Spellcasting" (Master Summoning Spellcasting)
//   attribute   "intOrCha": the psychic casts with the attribute they
//               qualified with, taken as the higher of the two
const ARCHETYPE_SPELLCASTING = {
  animist: {},
  bard: { breadth: "Occult Breadth" },
  cleric: { breadth: "Divine Breadth" },
  druid: { breadth: "Primal Breadth" },
  magus: {},
  necromancer: {},
  oracle: { breadth: "Mysterious Breadth" },
  psychic: { cantrips: 1, attribute: "intOrCha" },
  sorcerer: { breadth: "Bloodline Breadth" },
  summoner: {
    startsWith: "Basic Summoner Spellcasting",
    master: "Master Summoning Spellcasting",
  },
  witch: { cantrips: 1, breadth: "Patron's Breadth" },
  wizard: { breadth: "Arcane Breadth" },
};

// The ranks archetype spellcasting feats give a slot of at a level: basic
// 1st at 4th level, 2nd at 6th and 3rd at 8th; expert 4th at 12th, 5th at
// 14th and 6th at 16th; master 7th at 18th and 8th at 20th
function getArchetypeSlotRanks(level, { basic = false, expert = false, master = false }) {
  const ranks = [];
  const add = (granted, steps) => {
    if (!granted) return;
    for (const [rank, at] of steps) {
      if (level >= at) ranks.push(rank);
    }
  };
  add(basic, [[1, 4], [2, 6], [3, 8]]);
  add(expert, [[4, 12], [5, 14], [6, 16]]);
  add(master, [[7, 18], [8, 20]]);
  return ranks;
}

// The feat or feature a character has under a name, or null (hasFeatNamed)
function findFeatNamed(record, featName) {
  const baseName = (name) =>
    `${name || ""}`.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim();
  const wanted = baseName(featName);
  const features = [
    ...(record.data?.classes || []),
    ...(record.data?.ancestries || []),
    ...(record.data?.heritages || []),
  ].flatMap((source) => source?.data?.features || []);
  return (
    [...(record.data?.feats || []), ...(record.data?.bonusFeats || []), ...features].find(
      (entry) => entry?.data?.type !== "slot" && baseName(entry?.name) === wanted,
    ) || null
  );
}

// The entries a character's spellcasting archetypes give at a level, as specs
// with the source "archetype:wizard": none for the character's own class
function getArchetypeSpellcastingSpecs(record, level, valuesToSet = {}, classSlug = null) {
  const specs = [];
  for (const [slug, archetype] of Object.entries(ARCHETYPE_SPELLCASTING)) {
    const name = capitalize(slug);
    const start = slug !== classSlug && findFeatNamed(record, archetype.startsWith || `${name} Dedication`);
    if (!start) continue;
    const casting = CLASS_SPELLCASTING[slug];
    const has = (feat) => hasFeatNamed(record, feat);
    const masterFeat = archetype.master || `Master ${name} Spellcasting`;
    const ranks = getArchetypeSlotRanks(level, {
      basic: has(`Basic ${name} Spellcasting`),
      expert: has(`Expert ${name} Spellcasting`),
      master: has(masterFeat),
    });
    const breadth = !!archetype.breadth && has(archetype.breadth);
    const cantrips = archetype.cantrips ?? 2;
    const counts = {};
    if (casting.type === "prepared") {
      counts.numCantrips = cantrips;
    }
    for (let rank = 1; rank <= 10; rank++) {
      counts[`numSpells${rank}`] = 0;
    }
    ranks.forEach((rank, index) => {
      counts[`numSpells${rank}`] = breadth && index < ranks.length - 2 ? 2 : 1;
    });
    // A spontaneous archetype learns a spell for each slot
    let repertoire = null;
    if (casting.type === "spontaneous") {
      repertoire = { repCantrips: cantrips };
      for (let rank = 1; rank <= 10; rank++) {
        repertoire[`rep${rank}`] = counts[`numSpells${rank}`];
      }
    }
    const tradition =
      typeof casting.tradition === "string"
        ? casting.tradition
        : getSubclassTradition(
            record,
            casting.tradition.flag,
            casting.tradition.nested,
            getSpellcastingEdition(start),
          );
    const score = (attribute) =>
      parseInt(valuesToSet[`data.${attribute}`] ?? record.data?.[attribute] ?? 0, 10) || 0;
    const attribute =
      archetype.attribute === "intOrCha"
        ? score("cha") > score("int")
          ? "cha"
          : "int"
        : casting.attribute;
    specs.push({
      source: `archetype:${slug}`,
      name: `${name} Archetype Spells`,
      type: casting.type,
      tradition,
      attribute,
      counts,
      repertoire,
      training: has(masterFeat)
        ? 3
        : has(`Expert ${name} Spellcasting`)
          ? 2
          : 1,
      bonus: null,
      archetype: true,
    });
  }
  return specs;
}

// Focus spells from the class (Player Core pg. 300): an empty focus entry for
// the spells the class gives, which the player drops in (the module's
// features name them only in their descriptions). Most classes give them at
// 1st level; `feats` lists the feats that give them otherwise. Tradition and
// attribute come from the class's spellcasting unless given here; a monk
// picks divine or occult, so theirs is left for the player.
// Left out: the psychic, whose psi cantrips are in its class entry's
// repertoire, and focus spells from archetype feats.
const FOCUS_SPELLCASTING = {
  animist: { name: "Vessel Spells" },
  bard: { name: "Composition Spells" },
  champion: { name: "Devotion Spells", tradition: "Divine", attribute: "cha" },
  cleric: { name: "Domain Spells", feats: ["Domain Initiate"] },
  druid: { name: "Order Spells" },
  magus: { name: "Conflux Spells" },
  monk: {
    name: "Qi Spells",
    legacyName: "Ki Spells",
    tradition: null,
    attribute: "wis",
    feats: ["Qi Spells", "Ki Rush", "Ki Strike"],
  },
  oracle: { name: "Revelation Spells" },
  ranger: { name: "Warden Spells", tradition: "Primal", attribute: "wis", feats: ["Initiate Warden"] },
  sorcerer: { name: "Bloodline Spells" },
  summoner: { name: "Link Spells" },
  witch: { name: "Hex Spells" },
  // Once a school with school spells is chosen
  wizard: { name: "School Spells", school: true },
};

// The focus entry a character's class gives, as a spec with the source
// "class:cleric:focus" (see getWantedSpellcastingEntries)
function getFocusSpellcastingSpecs(record) {
  const classObj = record.data?.classes?.[0];
  const slug = toSlug(`${classObj?.name || ""}`.replace(/\s*\([^)]*\)\s*$/, "").trim());
  if (!Object.prototype.hasOwnProperty.call(FOCUS_SPELLCASTING, slug)) {
    return [];
  }
  const focus = FOCUS_SPELLCASTING[slug];
  if (focus.feats && !focus.feats.some((feat) => hasFeatNamed(record, feat))) {
    return [];
  }
  const casting = getClassSpellcasting(classObj);
  if (focus.school) {
    const school = record.data?.flags?.[casting.schoolSlot.flag];
    if (!school || casting.schoolSlot.none.test(school)) {
      return [];
    }
  }
  const edition = getSpellcastingEdition(classObj);
  let tradition = focus.tradition;
  if (tradition === undefined) {
    tradition =
      typeof casting.tradition === "string"
        ? casting.tradition
        : getSubclassTradition(record, casting.tradition.flag, casting.tradition.nested, edition);
  }
  return [
    {
      source: `class:${slug}:focus`,
      name: (edition === "legacy" && focus.legacyName) || focus.name,
      type: "focus",
      tradition: tradition || null,
      attribute: focus.attribute || casting.attribute,
      counts: {},
      repertoire: null,
      training: 0,
      bonus: null,
      focus: true,
    },
  ];
}

function isManagedSpellcastingEntry(spellcastingEntry) {
  const auto = spellcastingEntry?.data?.auto;
  return !!auto?.source && !auto.orphaned;
}

// Which settings and buttons an entry shows for its type
function getSpellcastingEntryTypeFields(type) {
  const isFocus = type === "focus";
  const isSpontaneous = type === "spontaneous";
  const isInnate = type === "innate" || type === "item";
  const isPrepared = !isInnate && !isFocus && !isSpontaneous;
  const fields = {
    autoSlots: { hidden: !isPrepared && !isSpontaneous },
    preparedBox: { hidden: !isPrepared },
    spontaneousBox: { hidden: !isSpontaneous },
    addBtn: { hidden: !isSpontaneous && !isFocus && !isInnate },
    focusPoolLabel: { hidden: !isFocus },
    focusPool: { hidden: !isFocus },
    focusPoolMax: { hidden: !isFocus },
    numCantrips: { hidden: isSpontaneous || isFocus || isInnate },
    numCantripSpontaneousLabel: {
      hidden: !isSpontaneous && !isInnate && !isFocus,
    },
  };
  for (let rank = 1; rank <= 10; rank++) {
    fields[`numSpells${rank}`] = { hidden: isInnate || isFocus };
  }
  return fields;
}

// A new spellcasting entry, from the Add Spellcasting Entry popover or made
// from the class
function buildSpellcastingEntry({
  name = "",
  type = "prepared",
  proficiency = "spell",
  tradition = "Arcane",
  attribute = "int",
  training = 0,
  dc = 0,
  mod = 0,
  shownSpells = ["cantrips", "spells1"],
  isFirst = false,
} = {}) {
  const isItem = type === "item";
  const fields = {
    ...getSpellcastingEntryTypeFields(type),
    // Item type casting will always be manually setting DC/Mod
    training: { hidden: isItem },
    tradition: { hidden: isItem },
    moveUpBtn: { hidden: isFirst },
  };
  for (const list of shownSpells) {
    fields[`${list}Box`] = { hidden: false };
  }
  return {
    _id: generateUuid(),
    name: name || `${tradition} ${capitalize(type)} Spells`,
    unidentifiedName: "Spellcasting Entry",
    identified: true,
    data: {
      type,
      proficiency,
      tradition,
      attribute,
      training,
      dc,
      mod,
      shownSpells: [...shownSpells],
      focusPoolMax: 1,
    },
    fields,
  };
}

// An empty row in a spell list: a prepared slot ("Rank 2 Spell Slot"), or a
// spontaneous caster's repertoire placeholder ("New Rank 2 Spell"), which can
// be deleted
function buildSpellRow(kind, rank, order) {
  const isCantrip = rank === 0;
  const isPrepared = kind === "prepared";
  let name = isCantrip ? "Cantrip Slot" : `Rank ${rank} Spell Slot`;
  if (!isPrepared) {
    name = isCantrip ? "New Cantrip" : `New Rank ${rank} Spell`;
  }
  return {
    _id: generateUuid(),
    name,
    recordType: "spells",
    unidentifiedName: name,
    data: {
      type: "slot",
      description: "",
      level: rank,
      slotOrder: order,
    },
    fields: {
      spellDetails: { hidden: true },
      innateBox: { hidden: true },
      signatureBox: { hidden: true },
      spellSlot: { hidden: false },
      used: { hidden: !isPrepared || isCantrip },
      deleteBtn: { hidden: isPrepared },
    },
  };
}

const isFilledSpellRow = (row) => row?.data?.type !== "slot";

// Adds empty rows to reach wantRows, or removes empty rows from the end.
// Chosen spells are never removed. Returns the same list when nothing changed.
function resizeSpellRows(rows, wantRows, kind, rank) {
  const resized = [...rows];
  for (let i = resized.length - 1; i >= 0 && resized.length > wantRows; i--) {
    if (!isFilledSpellRow(resized[i])) {
      resized.splice(i, 1);
    }
  }
  while (resized.length < wantRows) {
    resized.push(buildSpellRow(kind, rank, resized.length));
  }
  if (resized.length === rows.length && resized.every((row, i) => row === rows[i])) {
    return rows;
  }
  resized.forEach((row, index) => {
    row.data = { ...row.data, slotOrder: index };
  });
  return resized;
}

// Marks an entry the player made as opted in, keeping a training rank they
// set above the character's as the entry's own
function adoptSpellcastingEntry(record, entry, valuesToSet) {
  entry.data = entry.data || {};
  const auto = (entry.data.auto = { ...(entry.data.auto || {}), adopted: true });
  const training = parseInt(entry.data.training || "0", 10) || 0;
  const characterRank = getCharacterSpellcastingRank(
    record,
    entry.data.proficiency,
    valuesToSet,
  );
  if (training > characterRank) {
    auto.ownTraining = training;
  }
}

// Brings one managed entry in line with its spec. The player's changes are
// kept: a count they raised or lowered stays that far from the table, and a
// tradition, attribute or type they picked stays theirs.
function applySpellcastingSpec(spellcastingEntry, spec) {
  const entry = spellcastingEntry;
  entry.data = entry.data || {};
  entry.fields = entry.fields || {};
  if (!entry._id) {
    entry._id = generateUuid();
  }
  const auto = (entry.data.auto = entry.data.auto || {});
  auto.source = spec.source;
  auto.version = SPELLCASTING_SYNC_VERSION;
  if (auto.orphaned) {
    auto.orphaned = false;
  }
  if (entry.data.autoSlots === undefined) {
    entry.data.autoSlots = true;
  }
  entry.fields.autoSlots = { hidden: false };

  // Settings follow the class until the player changes them
  for (const key of ["type", "tradition", "attribute"]) {
    if (!spec[key]) continue;
    if (!entry.data[key] || entry.data[key] === auto[key]) {
      entry.data[key] = spec[key];
    }
    auto[key] = spec[key];
  }
  auto.training = spec.training || 0;
  if (spec.fontRank) {
    // Not read yet: the spell picker (phase C) will offer only these
    auto.spellFilter = spec.spellFilter;
  }
  const type = entry.data.type || "prepared";
  Object.assign(entry.fields, getSpellcastingEntryTypeFields(type));

  const countOf = (key) => parseInt(entry.data[key] || 0, 10) || 0;
  // Repertoire targets count the rows of a list
  const rowsOf = (key) =>
    (entry.data[key === "repCantrips" ? "cantrips" : `spells${key.slice(3)}`] || [])
      .length;
  const valueOf = (key) => (key.startsWith("rep") ? rowsOf(key) : countOf(key));

  if (entry.data.autoSlots === false || (type !== "prepared" && type !== "spontaneous")) {
    // The counts stop following the table here. The last table counts stay,
    // and the counts as they are now are noted, so turning it back on can
    // tell the counts the player changed meanwhile from the ones they left.
    if (auto.base && !auto.offCounts) {
      auto.offCounts = {};
      for (const key of Object.keys(auto.base)) {
        auto.offCounts[key] = valueOf(key);
      }
    }
    return;
  }

  // Counts. A new or adopted entry (no base yet) never loses slots.
  const base = auto.base || {};
  const offCounts = auto.offCounts || null;
  // The table count a count's offset is measured from: the last one written,
  // or this level's for a count the player changed while "Set slots from
  // level" was off, which stays as they typed it
  const baseOf = (key, target) =>
    offCounts && offCounts[key] !== undefined && offCounts[key] !== valueOf(key)
      ? target
      : base[key];
  // A rank the table had slots in when the counts were last written and no
  // longer has (the level went down, even while "Set slots from level" was
  // off): what the player added or typed there doesn't carry down
  const rankGone = (key, target) => target === 0 && base[key] > 0 && !/Cantrips$/.test(key);
  const nextBase = {};
  const spellKeys = Object.keys(spec.counts).filter((key) => key !== "numCantrips");
  const sum = (getValue) => spellKeys.reduce((total, key) => total + getValue(key), 0);
  // The font's extra slots are one number that moves with its rank, so they
  // are measured over all ranks: from the last table counts, or from this
  // level's when the player changed the font's count while "Set slots from
  // level" was off (its rank may have moved meanwhile), so it stays as typed
  const fontTyped =
    !!offCounts && sum((key) => offCounts[key] ?? countOf(key)) !== sum(countOf);
  const fontExtra = !spec.fontRank
    ? 0
    : auto.base
      ? sum(countOf) - sum((key) => (fontTyped ? spec.counts[key] : base[key]) || 0)
      : Math.max(0, sum(countOf) - sum((key) => spec.counts[key]));
  const before = {};
  for (const key of Object.keys(spec.counts)) {
    const target = spec.counts[key] || 0;
    const current = countOf(key);
    const last = baseOf(key, target);
    let next;
    if (spec.fontRank && key !== "numCantrips") {
      next = key === `numSpells${spec.fontRank}` ? Math.max(0, target + fontExtra) : 0;
    } else if (last === undefined) {
      next = Math.max(current, target);
      // A count the takeover raised, for the takeover notice
      if (auto.adopted && next > current) {
        auto.raisedFrom = { ...auto.raisedFrom, [key]: current };
      }
    } else if (rankGone(key, target)) {
      next = 0;
    } else {
      next = Math.max(0, target + current - last);
    }
    before[key] = current;
    if (next !== current) {
      entry.data[key] = next;
    }
    nextBase[key] = target;
  }

  // Spontaneous: slots remaining rise and fall with the slot count
  if (type === "spontaneous") {
    for (let rank = 1; rank <= 10; rank++) {
      const count = countOf(`numSpells${rank}`);
      const usedKey = `usedSpells${rank}`;
      const remaining = entry.data[usedKey];
      if (remaining === undefined || remaining === null || remaining === "") {
        if (count > 0) {
          entry.data[usedKey] = count;
        }
      } else if (count !== (before[`numSpells${rank}`] ?? count)) {
        entry.data[usedKey] = Math.min(
          count,
          Math.max(0, (parseInt(remaining, 10) || 0) + count - before[`numSpells${rank}`]),
        );
      }
    }
  }

  // Divine Font: the prepared heal or harm spells move up with its rank.
  // Anything else prepared there stays where it is.
  if (spec.fontRank) {
    const fontList = `spells${spec.fontRank}`;
    const fontSpell = new RegExp(`^(${(spec.spellFilter || ["heal", "harm"]).join("|")})$`, "i");
    const isFontSpell = (row) =>
      isFilledSpellRow(row) && fontSpell.test(`${row.name || ""}`.trim());
    const moved = [];
    for (let rank = 1; rank <= 10; rank++) {
      const list = `spells${rank}`;
      if (list === fontList || !(entry.data[list] || []).some(isFontSpell)) continue;
      moved.push(...entry.data[list].filter(isFontSpell));
      entry.data[list] = entry.data[list].filter((row) => !isFontSpell(row));
    }
    if (moved.length > 0) {
      const fontRows = entry.data[fontList] || [];
      entry.data[fontList] = [
        ...fontRows.filter(isFilledSpellRow),
        ...moved,
        ...fontRows.filter((row) => !isFilledSpellRow(row)),
      ];
    }
  }

  // Rows: empty prepared slots to match the counts, or repertoire placeholders
  // (kept the same way as counts, so a placeholder the player deleted stays
  // deleted). Spells already chosen stay, even in a rank that has no slots
  // left.
  SPELL_RANK_LISTS.forEach((list, rank) => {
    const rows = entry.data[list] || [];
    let wantRows;
    if (type === "prepared") {
      wantRows = countOf(rank === 0 ? "numCantrips" : `numSpells${rank}`);
    } else {
      const key = rank === 0 ? "repCantrips" : `rep${rank}`;
      const target = spec.repertoire?.[key];
      if (target === undefined) return;
      const last = baseOf(key, target);
      if (last === undefined) {
        wantRows = Math.max(rows.length, target);
      } else if (rankGone(key, target)) {
        wantRows = 0;
      } else {
        wantRows = Math.max(0, target + rows.length - last);
      }
      nextBase[key] = target;
    }
    const resized = resizeSpellRows(rows, wantRows, type, rank);
    if (resized !== rows) {
      entry.data[list] = resized;
    }
  });
  auto.base = nextBase;
  if (auto.offCounts) {
    auto.offCounts = null;
  }

  // Show the lists that have slots or spells. Lists the player showed or hid
  // themselves stay that way.
  const wanted = SPELL_RANK_LISTS.filter((list, rank) => {
    let count = countOf(`numSpells${rank}`);
    if (rank === 0) {
      count = type === "prepared" ? countOf("numCantrips") : 0;
    }
    return count > 0 || (entry.data[list] || []).length > 0;
  });
  const previous = auto.shown || [];
  const current =
    entry.data.shownSpells === undefined
      ? ["cantrips", "spells1"]
      : entry.data.shownSpells || [];
  const shown = SPELL_RANK_LISTS.filter((list) =>
    wanted.includes(list)
      ? !previous.includes(list) || current.includes(list)
      : current.includes(list) && !previous.includes(list),
  );
  const sameLists =
    shown.length === current.length && shown.every((list) => current.includes(list));
  if (!sameLists || entry.data.shownSpells === undefined) {
    entry.data.shownSpells = shown;
  }
  for (const list of SPELL_RANK_LISTS) {
    entry.fields[`${list}Box`] = { hidden: !entry.data.shownSpells.includes(list) };
  }
  auto.shown = wanted;
}

// Makes and sizes the class's spellcasting entries for the character's level
// and returns the entry list to write. Entries the sheet manages follow the
// level. The class's entries are made only on a character whose class was
// added since they're made automatically (data.autoSpellcasting), and not
// again once deleted (data.spellcastingDismissed) until restored. Entries the
// player made are left as they are unless they opt one in with "Set slots
// from level" (optInSpellcastingEntry).
function syncSpellcastingEntries(record, valuesToSet) {
  if (record.recordType !== "characters") {
    return null;
  }
  // Restore Automatic Entries shows once an entry the class made was deleted
  const dismissed = record.data?.spellcastingDismissed || [];
  const hideRestore = dismissed.length === 0;
  if (record.fields?.restoreSpellcastingBtn?.hidden !== hideRestore) {
    valuesToSet["fields.restoreSpellcastingBtn.hidden"] = hideRestore;
  }

  const entries = cloneRecordData(record.data?.spells || []);
  const level = parseInt(valuesToSet["data.level"] ?? record.data?.level ?? 0, 10) || 0;
  // Level 0 characters have no spellcasting until they take a class at 1st
  // level, so their entries are left alone
  if (isLevelZeroCharacter(record) || level < 1) {
    return entries;
  }

  const specs = getWantedSpellcastingEntries(record, level, valuesToSet);
  const makeEntries = !!(valuesToSet["data.autoSpellcasting"] ?? record.data?.autoSpellcasting);
  // The sources the character had at the last sync: an archetype's entry is
  // made when its spellcasting first appears (a dedication taken), not for
  // one the character had before this came in, whose entry the player made
  const seenBefore = Array.isArray(record.data?.spellcastingSources)
    ? record.data.spellcastingSources
    : null;
  // The class's focus entry is made only on a character whose class was added
  // since it's made automatically (data.autoFocusSpellcasting), and not next
  // to a focus entry the player made
  const makeFocusEntries = !!(
    valuesToSet["data.autoFocusSpellcasting"] ?? record.data?.autoFocusSpellcasting
  );
  const ownFocusEntry = entries.some(
    (e) => isFocusEntry(e) && !isManagedSpellcastingEntry(e),
  );
  for (const spec of specs) {
    if (dismissed.includes(spec.source)) continue;
    let entry = entries.find((e) => e.data?.auto?.source === spec.source);
    if (!entry) {
      const make = spec.focus
        ? makeFocusEntries && !ownFocusEntry
        : spec.archetype
          ? !!seenBefore && !seenBefore.includes(spec.source)
          : makeEntries;
      if (!make) continue;
      entry = buildSpellcastingEntry({
        name: spec.name,
        type: spec.type,
        tradition: spec.tradition || "",
        attribute: spec.attribute,
        training: spec.training,
        shownSpells: spec.focus ? ["cantrips", "spells1"] : [],
        isFirst: spec.focus || entries.length === 0,
      });
      // The class's other entries (Divine Font, apparitions) cast with its
      // spell DC, so they start at the rank its entry keeps as its own
      const classSource = spec.source.split(":").slice(0, 2).join(":");
      const classEntry = entries.find((e) => e.data?.auto?.source === classSource);
      const ownTraining = parseInt(classEntry?.data?.auto?.ownTraining || "0", 10) || 0;
      if (ownTraining > 0) {
        entry.data.auto = { ownTraining };
      }
      if (spec.focus) {
        // The focus entry goes first, above the class's spells
        if (entries.length > 0) {
          entries[0].fields = { ...entries[0].fields, moveUpBtn: { hidden: false } };
        }
        entries.unshift(entry);
      } else {
        entries.push(entry);
      }
    }
    applySpellcastingSpec(entry, spec);
  }

  const sources = specs.map((spec) => spec.source);
  if (JSON.stringify(sources) !== JSON.stringify(seenBefore)) {
    valuesToSet["data.spellcastingSources"] = sources;
  }

  // Entries whose class or feature is gone: removed while they hold no
  // spells, otherwise kept and no longer managed
  const wantedSources = specs.map((spec) => spec.source);
  const firstId = entries[0]?._id;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!isManagedSpellcastingEntry(entry) || wantedSources.includes(entry.data.auto.source)) {
      continue;
    }
    const hasSpells =
      SPELL_RANK_LISTS.some((list) => (entry.data[list] || []).some(isFilledSpellRow)) ||
      (entry.data.knownSpells || []).length > 0;
    if (hasSpells) {
      entry.data.auto.orphaned = true;
      entry.fields = { ...entry.fields, autoSlots: { hidden: true } };
    } else {
      entries.splice(i, 1);
    }
  }
  if (entries.length > 0 && entries[0]._id !== firstId) {
    entries[0].fields = { ...entries[0].fields, moveUpBtn: { hidden: true } };
  }
  return entries;
}

// Whether the person viewing a record can save changes to it: the GM, or the
// player who owns it. Anyone else (a player looking at a party member's
// sheet) can't, so updates made when a sheet opens wait for one of them.
// When Realm doesn't say who owns the record or who is viewing, it's assumed
// they can.
function canEditRecord(record) {
  if (typeof isGM !== "undefined" && isGM) {
    return true;
  }
  const viewer = typeof userId !== "undefined" ? userId : null;
  if (!viewer || !record?.ownerId) {
    return true;
  }
  return `${record.ownerId}` === `${viewer}`;
}

// The notice after Restore Automatic Entries: the entries the class made again
function describeAddedSpellcastingEntries(oldEntries, record) {
  const oldSources = new Set(
    (oldEntries || []).map((entry) => entry?.data?.auto?.source).filter(Boolean),
  );
  const names = (record?.data?.spells || [])
    .filter(
      (entry) => isManagedSpellcastingEntry(entry) && !oldSources.has(entry.data.auto.source),
    )
    .map((entry) => entry.name);
  if (names.length === 0) {
    return "";
  }
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Added from your class: ${list}.`;
}

// "Set slots from level" checked on an entry the player made: it becomes the
// entry the sheet manages for one of the class's spellcasting entries that no
// entry follows yet, picked from a prompt when there are several (a cleric's
// Divine Font, an animist's apparitions). Counts below the class's are
// raised and higher ones kept as the player's own, as are its type,
// tradition and attribute. With nothing to follow, the box is unchecked.
function optInSpellcastingEntry(record, entryPath) {
  const index = parseInt(`${entryPath}`.split(".").pop(), 10);
  const entries = record?.data?.spells || [];
  const entry = entries[index];
  const uncheck = (message) => {
    api.setValues({ [`${entryPath}.data.autoSlots`]: false });
    if (message) {
      api.showNotification(message, "yellow", "Spellcasting");
    }
  };
  if (!entry || record.recordType !== "characters") {
    uncheck();
    return;
  }
  const type = entry.data?.type || "prepared";
  if (type !== "prepared" && type !== "spontaneous") {
    uncheck("Only prepared and spontaneous entries can follow your level.");
    return;
  }
  const level = parseInt(record.data?.level || 0, 10) || 0;
  // A focus entry has no slots to follow
  const specs = getWantedSpellcastingEntries(record, level).filter((spec) => !spec.focus);
  const followed = entries
    .filter(isManagedSpellcastingEntry)
    .map((other) => other.data.auto.source);
  const open = specs.filter((spec) => !followed.includes(spec.source));
  if (open.length === 0) {
    uncheck(
      specs.length === 0
        ? "Your class has no spell slots for this entry to follow."
        : "Each of your class's spellcasting entries already has an entry that follows your level.",
    );
    return;
  }

  const follow = (spec) => {
    const next = cloneRecordData([entry])[0];
    next.data = next.data || {};
    next.data.autoSlots = true;
    const valuesToSet = {};
    adoptSpellcastingEntry(record, next, valuesToSet);
    applySpellcastingSpec(next, spec);
    valuesToSet[entryPath] = next;
    const dismissed = record.data?.spellcastingDismissed || [];
    if (dismissed.includes(spec.source)) {
      valuesToSet["data.spellcastingDismissed"] = dismissed.filter(
        (source) => source !== spec.source,
      );
    }
    api.setValues(valuesToSet, (updatedRecord) => {
      onAddEditFeature(
        updatedRecord,
        () => {
          api.showNotification(
            describeOptedInSpellcastingEntry(next, spec),
            "blue",
            "Spellcasting",
          );
        },
        true,
      );
    });
  };
  if (open.length === 1) {
    follow(open[0]);
    return;
  }
  api.showPrompt(
    "Set Slots from Level",
    `Which of your class's spellcasting entries should ${entry.name || "this entry"} follow?`,
    "Select Entry...",
    open.map((spec) => ({ label: spec.name, value: spec.source })),
    null,
    (selected) => {
      const picked = Array.isArray(selected) ? selected[0] : selected;
      const source = picked && typeof picked === "object" ? picked.value : picked;
      const spec = open.find((option) => option.source === source);
      if (spec) {
        follow(spec);
      } else {
        uncheck();
      }
    },
  );
}

// The notice after an entry the player made is opted in: what it follows, the
// counts raised to the class's, and a tradition other than the class's
function describeOptedInSpellcastingEntry(entry, spec) {
  const auto = entry.data?.auto || {};
  const name = entry.name || spec.name;
  const verb = /s$/i.test(name) ? "follow" : "follows";
  const messages = [
    `${name} now ${verb} your level as your class's ${spec.name} (higher counts kept). To stop this, uncheck "Set slots from level" in its settings.`,
  ];
  const raised = Object.entries(auto.raisedFrom || {}).map(([key, from]) => {
    const label =
      key === "numCantrips"
        ? "cantrips"
        : `${getOrdinal(parseInt(key.replace("numSpells", ""), 10))}-rank slots`;
    return `${label} ${from} to ${parseInt(entry.data[key] || 0, 10) || 0}`;
  });
  if (raised.length > 0) {
    messages.push(`Its counts were raised to your class's (${raised.join(", ")}).`);
  }
  const tradition = `${entry.data?.tradition || ""}`;
  const classTradition = `${spec.tradition || ""}`;
  if (classTradition && tradition && tradition.toLowerCase() !== classTradition.toLowerCase()) {
    messages.push(
      `It kept its ${tradition} tradition. Your class casts ${classTradition.toLowerCase()} spells, so change it in its settings if that was a mistake.`,
    );
  }
  return messages.join(" ");
}

// Names the Add Spellcasting Entry popover gives ("Arcane Prepared Spells").
// These follow the entry's settings; any other name is the player's own.
function isDefaultSpellcastingEntryName(name) {
  return (
    !name ||
    /^(Arcane|Divine|Occult|Primal) (Prepared|Spontaneous|Innate|Focus|Item) Spells$/.test(
      name,
    )
  );
}

// "1st", "2nd", "3rd", "4th" ...
function getOrdinal(number) {
  const suffixes = { 1: "st", 2: "nd", 3: "rd" };
  const lastTwo = number % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : suffixes[number % 10] || "th";
  return `${number}${suffix}`;
}

// Level Up summary lines for the class's spell slots, e.g. "Wizard Spells:
// 2nd-rank spells (3 slots)" or "Divine Font moves to 3rd rank (5 slots)"
function getSpellcastingLevelUpChanges(record, newLevel) {
  const dismissed = record.data?.spellcastingDismissed || [];
  const entries = record.data?.spells || [];
  const before = getWantedSpellcastingEntries(record, newLevel - 1);
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const lines = [];

  for (const spec of getWantedSpellcastingEntries(record, newLevel)) {
    const entry = entries.find((e) => e.data?.auto?.source === spec.source);
    if (spec.focus || dismissed.includes(spec.source) || entry?.data?.autoSlots === false) continue;
    const old = before.find((s) => s.source === spec.source);
    const name = entry?.name || spec.name;

    if (spec.fontRank) {
      const count = spec.counts[`numSpells${spec.fontRank}`];
      if (old?.fontRank !== spec.fontRank) {
        lines.push(`${name} moves to ${getOrdinal(spec.fontRank)} rank (${plural(count, "slot")})`);
      } else if (old.counts[`numSpells${spec.fontRank}`] !== count) {
        lines.push(`${name}: ${plural(count, "slot")}`);
      }
      continue;
    }

    const parts = [];
    const cantrips = (spec.counts.numCantrips || 0) - (old?.counts.numCantrips || 0);
    if (cantrips > 0) {
      parts.push(`+${plural(cantrips, "cantrip")}`);
    }
    for (let rank = 1; rank <= 10; rank++) {
      const was = old?.counts[`numSpells${rank}`] || 0;
      const now = spec.counts[`numSpells${rank}`] || 0;
      const label = `${getOrdinal(rank)}-rank`;
      if (now > was && was === 0) {
        parts.push(`${label} spells (${plural(now, "slot")})`);
      } else if (now > was) {
        parts.push(`+${now - was} ${label} slot${now - was === 1 ? "" : "s"}`);
      } else if (now < was && now === 0) {
        parts.push(`no more ${label} slots`);
      } else if (now < was) {
        parts.push(`-${was - now} ${label} slot${was - now === 1 ? "" : "s"}`);
      }
    }
    if (spec.repertoire) {
      let spells = 0;
      for (let rank = 1; rank <= 10; rank++) {
        spells += Math.max(
          0,
          spec.repertoire[`rep${rank}`] - (old?.repertoire?.[`rep${rank}`] || 0),
        );
      }
      const newCantrips = spec.repertoire.repCantrips - (old?.repertoire?.repCantrips || 0);
      if (spells > 0) {
        parts.push(`learn ${plural(spells, "spell")}`);
      }
      if (newCantrips > 0) {
        parts.push(`learn ${plural(newCantrips, "cantrip")}`);
      }
    }
    if (parts.length > 0) {
      lines.push(`${name}: ${parts.join(", ")}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// The focus pool (Player Core pg. 300)
//
// A character has one focus pool, whatever gives them focus spells. It holds
// 1 Focus Point for each focus spell that isn't a cantrip, up to 3, as
// Foundry PF2e counts it; a psychic's Psi Cantrips and Amps adds 2, and
// Clarity of Focus and Psi Development 1 each. A Focus Pool Max typed on a
// focus entry (data.focusPoolMaxManual) raises it, for focus spells the
// entries don't list. data.focusPool keeps the points spent and
// data.focusPoolMax the pool's size, and every focus entry shows them. NPCs
// keep a pool on each focus entry, as their stat blocks give it.
// ---------------------------------------------------------------------------

const FOCUS_POOL_CAP = 3;

// Features that add Focus Points beyond the character's focus spells
const FOCUS_POOL_FEATURES = {
  "Psi Cantrips and Amps": 2,
  "Clarity of Focus": 1,
  "Psi Development": 1,
  // A pool of 1, or 1 more if the character has one (Dark Archive)
  "Psychic Dedication": 1,
};

function isFocusEntry(entry) {
  return entry?.data?.type === "focus";
}

// The focus spells in a character's focus entries that cost Focus Points:
// those that aren't cantrips
function getFocusSpellCount(entries) {
  const isCantrip = (row) =>
    (row?.data?.traits || []).some((trait) => `${trait || ""}`.trim().toLowerCase() === "cantrip");
  let count = 0;
  for (const entry of (entries || []).filter(isFocusEntry)) {
    for (const list of SPELL_RANK_LISTS.filter((name) => name !== "cantrips")) {
      count += (entry.data?.[list] || []).filter((row) => isFilledSpellRow(row) && !isCantrip(row)).length;
    }
  }
  return count;
}

// Whether a character is from before the pool was shared: nothing kept on
// the character yet
function isLegacyFocusPool(record) {
  const stored = record?.data?.focusPool;
  return stored === undefined || stored === null || stored === "";
}

// The Focus Pool Max set by hand: data.focusPoolMaxManual, or, for a
// character from before the pool was shared, what their focus entries'
// own maximums added up to, so no one loses Focus Points they had
function getFocusPoolManualMax(record, entries = record?.data?.spells || []) {
  const stored = record?.data?.focusPoolMaxManual;
  if (stored !== undefined && stored !== null && stored !== "") {
    return parseInt(stored, 10) || 0;
  }
  if (!isLegacyFocusPool(record)) {
    return 0;
  }
  return entries
    .filter(isFocusEntry)
    .reduce((sum, entry) => sum + (parseInt(entry.data?.focusPoolMax || "1", 10) || 1), 0);
}

// The size of a character's focus pool: from their focus spells, or the
// Focus Pool Max set by hand when that's higher
function getFocusPoolMax(record, entries = record?.data?.spells || []) {
  const extra = Object.entries(FOCUS_POOL_FEATURES).reduce(
    (sum, [name, points]) => sum + (hasFeatNamed(record, name) ? points : 0),
    0,
  );
  const fromSpells = getFocusSpellCount(entries) + extra;
  return Math.min(FOCUS_POOL_CAP, Math.max(fromSpells, getFocusPoolManualMax(record, entries)));
}

// The Focus Points a character has spent: data.focusPool, or, for a
// character from before the pool was shared, what their focus entries had
// spent between them
function getFocusPointsSpent(record, entries = record?.data?.spells || []) {
  const spent = isLegacyFocusPool(record)
    ? entries
        .filter(isFocusEntry)
        .reduce((sum, entry) => sum + (parseInt(entry.data?.focusPool || "0", 10) || 0), 0)
    : parseInt(record.data.focusPool, 10) || 0;
  return Math.max(0, Math.min(spent, getFocusPoolMax(record, entries)));
}

// The values that set the Focus Points a character has spent, on the
// character and on every focus entry
function getFocusPoolValues(record, spent, entries = record?.data?.spells || []) {
  const max = getFocusPoolMax(record, entries);
  const value = Math.max(0, Math.min(spent, max));
  const values = { "data.focusPool": value, "data.focusPoolMax": max };
  // A character from before the pool was shared keeps their entries' maximums
  if (isLegacyFocusPool(record) && record?.data?.focusPoolMaxManual === undefined) {
    values["data.focusPoolMaxManual"] = getFocusPoolManualMax(record, entries);
  }
  entries.forEach((entry, index) => {
    if (isFocusEntry(entry)) {
      values[`data.spells.${index}.data.focusPool`] = value;
      values[`data.spells.${index}.data.focusPoolMax`] = max;
    }
  });
  return values;
}

// The Focus Points Refocus gives back (Player Core pg. 300): 1. Class
// abilities that change it (an oracle's cursebound, a necromancer's thralls)
// belong here.
function getRefocusPoints(record) {
  return 1;
}

// The values for a Focus Pool Max typed on one of a character's focus
// entries: it's kept on the character and every focus entry shows the pool
// it gives
function getFocusPoolManualMaxValues(record, manualMax) {
  const manual = Math.max(0, Math.min(parseInt(manualMax, 10) || 0, FOCUS_POOL_CAP));
  const updated = { ...record, data: { ...record.data, focusPoolMaxManual: manual } };
  return {
    ...getFocusPoolValues(updated, getFocusPointsSpent(updated)),
    "data.focusPoolMaxManual": manual,
  };
}

// Keeps a character's focus entries showing their one pool when the sheet
// writes its entries (setSpellcastingEntryValues)
function syncFocusPool(record, entries, valuesToSet) {
  if (record?.recordType !== "characters") {
    return;
  }
  const max = getFocusPoolMax(record, entries);
  const spent = getFocusPointsSpent(record, entries);
  if (isLegacyFocusPool(record) && record.data?.focusPoolMaxManual === undefined) {
    valuesToSet["data.focusPoolMaxManual"] = getFocusPoolManualMax(record, entries);
  }
  for (const entry of entries.filter(isFocusEntry)) {
    entry.data.focusPool = spent;
    entry.data.focusPoolMax = max;
  }
  const stored = (key) => record.data?.[key];
  if (stored("focusPool") === undefined || (parseInt(stored("focusPool"), 10) || 0) !== spent) {
    valuesToSet["data.focusPool"] = spent;
  }
  if (stored("focusPoolMax") === undefined || (parseInt(stored("focusPoolMax"), 10) || 0) !== max) {
    valuesToSet["data.focusPoolMax"] = max;
  }
}
