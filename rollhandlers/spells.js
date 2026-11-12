// typeChanged: the Spellcasting Type setting is the one that changed;
// trainingChanged: the entry's training dropdown is. changed: { path, value }
// of the setting that changed, from its onchange, since the record doesn't
// hold the new value yet: it is applied to the entry first and written in
// the same setValues, so the change shows at once (not on the next edit).
function updateSpellcastingEntry(
  record,
  spellcastingEntry,
  spellcastingEntryDataPath,
  typeChanged = false,
  trainingChanged = false,
  changed = null
) {
  spellcastingEntry = getEntryWithChangedValue(
    spellcastingEntry,
    spellcastingEntryDataPath,
    changed
  );
  // Reclaculate the DC and Modifier based on the new values
  const tradition = spellcastingEntry.data?.tradition || "Arcane";
  const type = spellcastingEntry.data?.type || "prepared";

  const attribute = spellcastingEntry.data?.attribute || "int";

  const name = `${tradition} ${capitalize(type)} Spells`;
  const isFocus = type === "focus";
  const isItem = type === "item";

  const isNPC = record.recordType === "npcs" || record.recordType === "tokens";

  // A rank picked for an entry made from the class is kept as its own, so
  // the sheet doesn't set it back to the character's rank
  let pickedTraining = null;
  let entryForTraining = spellcastingEntry;
  if (
    trainingChanged &&
    !isNPC &&
    !isItem &&
    isManagedSpellcastingEntry(spellcastingEntry)
  ) {
    pickedTraining =
      parseInt(spellcastingEntry.data?.training || "0", 10) || 0;
    entryForTraining = {
      ...spellcastingEntry,
      data: {
        ...spellcastingEntry.data,
        auto: { ...spellcastingEntry.data.auto, ownTraining: pickedTraining },
      },
    };
  }

  // Get current spellcasting training level if not NPC and not Item type
  let newTraining = undefined;
  if (!isNPC && !isItem) {
    newTraining = getSpellcastingEntryTraining(record, entryForTraining);
  }

  const valuesToSet = {
    // If not in shownSpells, hide them
    [`${spellcastingEntryDataPath}.fields.cantripsBox.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells1Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells2Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells3Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells4Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells5Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells6Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells7Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells8Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells9Box.hidden`]: true,
    [`${spellcastingEntryDataPath}.fields.spells10Box.hidden`]: true,
    // For focus spells
    [`${spellcastingEntryDataPath}.fields.focusPoolLabel.hidden`]: !isFocus,
    [`${spellcastingEntryDataPath}.fields.focusPool.hidden`]: !isFocus,
    [`${spellcastingEntryDataPath}.fields.focusPoolMax.hidden`]: !isFocus,
    // For items we hide the training field / label
    [`${spellcastingEntryDataPath}.fields.tradition.hidden`]: isItem,
    [`${spellcastingEntryDataPath}.fields.training.hidden`]: isItem,
  };

  // Only a name the sheet gave follows the settings
  if (isDefaultSpellcastingEntryName(spellcastingEntry.name)) {
    valuesToSet[`${spellcastingEntryDataPath}.name`] = name;
  }

  if (pickedTraining !== null) {
    valuesToSet[`${spellcastingEntryDataPath}.data.auto.ownTraining`] =
      pickedTraining;
  }

  if (newTraining) {
    valuesToSet[`${spellcastingEntryDataPath}.data.training`] = newTraining;
  }

  if (!isNPC) {
    // Update dc and mod if not npc
    const proficiencyBonus = calculateProficiencyBonus(record, newTraining);
    const attributeScore = record.data?.[`${attribute}`] || 0;

    // Set the DC and Modifier based on the proficiency
    const mod = attributeScore + proficiencyBonus;
    const dc = 10 + mod;
    valuesToSet[`${spellcastingEntryDataPath}.data.dc`] = dc;
    valuesToSet[`${spellcastingEntryDataPath}.data.mod`] = mod;
  }

  // Determine type-based field visibility
  const isSpontaneous = type === "spontaneous";
  const isInnate = type === "innate" || type === "item";
  const isSpontaneousOrFocus = isSpontaneous || isFocus;
  const isPrepared =
    type !== "spontaneous" &&
    type !== "focus" &&
    type !== "innate" &&
    type !== "item";

  // Set field visibility based on spellcasting type
  valuesToSet[`${spellcastingEntryDataPath}.fields.spontaneousBox.hidden`] =
    !isSpontaneous;
  valuesToSet[`${spellcastingEntryDataPath}.fields.preparedBox.hidden`] =
    !isPrepared;
  valuesToSet[`${spellcastingEntryDataPath}.fields.addBtn.hidden`] =
    !isSpontaneous && !isFocus && !isInnate;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numCantrips.hidden`] =
    isSpontaneous || isFocus || isInnate;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells1.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells2.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells3.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells4.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells5.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells6.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells7.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells8.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells9.hidden`] =
    isInnate || isFocus;
  valuesToSet[`${spellcastingEntryDataPath}.fields.numSpells10.hidden`] =
    isInnate || isFocus;
  valuesToSet[
    `${spellcastingEntryDataPath}.fields.numCantripSpontaneousLabel.hidden`
  ] = !isSpontaneous && !isInnate && !isFocus;

  // Go through all spell lists to update field visibility and manage slots
  const allSpellLists = [
    { name: "cantrips", level: 0 },
    { name: "spells1", level: 1 },
    { name: "spells2", level: 2 },
    { name: "spells3", level: 3 },
    { name: "spells4", level: 4 },
    { name: "spells5", level: 5 },
    { name: "spells6", level: 6 },
    { name: "spells7", level: 7 },
    { name: "spells8", level: 8 },
    { name: "spells9", level: 9 },
    { name: "spells10", level: 10 },
  ];

  for (const field of allSpellLists) {
    const fieldName = field.name;
    const rank = field.level;
    const isCantrip = rank === 0;
    const currentSpells = spellcastingEntry.data?.[fieldName] || [];

    if (isPrepared) {
      // For prepared spellcasting: manage slots and keep spells
      // Keep all spells that are NOT empty slots (type !== "slot")
      const filledSpells = currentSpells.filter(
        (spell) => spell.data?.type !== "slot"
      );

      // Update field visibility for existing spells
      filledSpells.forEach((spell) => {
        if (spell.data?.type === "spell") {
          // Initialize fields if they don't exist
          if (!spell.fields) {
            spell.fields = {};
          }
          if (!spell.data) {
            spell.data = {};
          }

          // Reset used state when changing type
          if (typeChanged) {
            spell.data.used = false;
            spell.fields.nameBox = { hidden: false };
            spell.fields.nameUsedBox = { hidden: true };
          }

          // Update field visibility
          spell.fields.innateBox = { hidden: !isInnate || isCantrip };
          spell.fields.signatureBox = { hidden: !isSpontaneous || isCantrip };
          spell.fields.used = {
            hidden: isCantrip || isSpontaneousOrFocus || isInnate,
          };
          spell.fields.deleteBtn = {
            hidden: !isSpontaneous && !isFocus && !isInnate && !isItem,
          };
        }
      });

      // Create new empty spell slots for prepared spellcasting
      const numSpells = parseInt(
        spellcastingEntry.data?.[`num${capitalize(fieldName)}`] || "0",
        10
      );
      const slotsNeeded = Math.max(0, numSpells - filledSpells.length);
      const newSlots = [];

      for (let i = 0; i < slotsNeeded; i++) {
        newSlots.push(buildSpellRow("prepared", rank, filledSpells.length + i));
      }

      // Combine filled spells with new empty slots
      valuesToSet[`${spellcastingEntryDataPath}.data.${fieldName}`] = [
        ...filledSpells,
        ...newSlots,
      ];
    } else {
      // For non-prepared spellcasting: just update field visibility on existing spells
      // Don't recreate the list - spells are added manually and should persist
      const updatedSpells = currentSpells.map((spell) => {
        if (spell.data?.type === "spell") {
          // Initialize fields if they don't exist
          if (!spell.fields) {
            spell.fields = {};
          }
          if (!spell.data) {
            spell.data = {};
          }

          // Reset used state when changing type
          if (typeChanged) {
            spell.data.used = false;
            spell.fields.nameBox = { hidden: false };
            spell.fields.nameUsedBox = { hidden: true };
          }

          // Update field visibility
          spell.fields.innateBox = { hidden: !isInnate || isCantrip };
          spell.fields.signatureBox = { hidden: !isSpontaneous || isCantrip };
          spell.fields.used = {
            hidden: isCantrip || isSpontaneousOrFocus || isInnate,
          };
          spell.fields.deleteBtn = {
            hidden: !isSpontaneous && !isFocus && !isInnate && !isItem,
          };
        } else {
          spell.fields.deleteBtn = {
            hidden: !isSpontaneous && !isFocus && !isInnate && !isItem,
          };
        }
        return spell;
      });

      // Only update if we actually modified something
      if (currentSpells.length > 0) {
        valuesToSet[`${spellcastingEntryDataPath}.data.${fieldName}`] =
          updatedSpells;
      }
    }
  }

  // Get which ones are shown, if none are set, we always show cantrips and spells1
  const shownSpells =
    spellcastingEntry.data?.shownSpells === undefined
      ? ["cantrips", "spells1"]
      : spellcastingEntry.data?.shownSpells;
  for (const spell of shownSpells) {
    valuesToSet[
      `${spellcastingEntryDataPath}.fields.${spell}Box.hidden`
    ] = false;
  }

  if (changed?.path && !(changed.path in valuesToSet)) {
    valuesToSet[changed.path] = changed.value;
  }
  api.setValues(valuesToSet);
}

// A copy of an entry with the value its onchange passed set at its path
// (data.shownSpells, data.numSpells3...), or the entry as it is
function getEntryWithChangedValue(entry, entryPath, changed) {
  if (!changed?.path || !entry || !`${changed.path}`.startsWith(`${entryPath}.`)) {
    return entry;
  }
  const copy = JSON.parse(JSON.stringify(entry));
  const keys = `${changed.path}`.slice(entryPath.length + 1).split(".");
  let target = copy;
  for (const key of keys.slice(0, -1)) {
    if (target[key] === undefined || target[key] === null) target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = changed.value;
  return copy;
}

function moveUpSpellcastingEntry(dataPath) {
  const spellcastingEntryDataPath = getNearestParentDataPath(dataPath);
  const spellcastingEntry = api.getValue(spellcastingEntryDataPath);
  const allSpellcastingEntries = [...(record.data?.spells || [])];

  const index = parseInt(spellcastingEntryDataPath.split(".").pop(), 10);
  if (index > 0) {
    // Swap the current entry with the one above it
    allSpellcastingEntries[index] = allSpellcastingEntries[index - 1];
    allSpellcastingEntries[index - 1] = spellcastingEntry;

    // Update button visibility: entry at position 0 should have hidden up button
    allSpellcastingEntries[0].fields = allSpellcastingEntries[0].fields || {};
    allSpellcastingEntries[0].fields.moveUpBtn =
      allSpellcastingEntries[0].fields.moveUpBtn || {};
    allSpellcastingEntries[0].fields.moveUpBtn.hidden = true;

    // Entry that moved from position 0 should now show its up button
    if (allSpellcastingEntries.length > 1) {
      allSpellcastingEntries[1].fields = allSpellcastingEntries[1].fields || {};
      allSpellcastingEntries[1].fields.moveUpBtn =
        allSpellcastingEntries[1].fields.moveUpBtn || {};
      allSpellcastingEntries[1].fields.moveUpBtn.hidden = false;
    }

    api.setValues({
      "data.spells": allSpellcastingEntries,
    });
  }
}

// Function for Focus and Spontanteous entries to add a spell the the given list
// spellListDataPath should be like: data.spells.0.spells1 or data.spells.1.cantrips
function addSpell(spellListDataPath) {
  const spellList = api.getValue(spellListDataPath) || [];

  // Extract the spell list type from the path (e.g., "spells1", "cantrips")
  const pathParts = spellListDataPath.split(".");
  const spellListType = pathParts[pathParts.length - 1];

  let rank = 0;
  let isCantrip = false;

  if (spellListType === "cantrips") {
    rank = 0;
    isCantrip = true;
  } else {
    const rankMatch = spellListType.match(/spells(\d+)/);
    if (rankMatch) {
      rank = parseInt(rankMatch[1], 10);
    }
  }

  api.addValue(
    spellListDataPath,
    buildSpellRow("spontaneous", rank, spellList.length)
  );
}

// Function for Focus and Spontanteous entries to remove a spell "slot"
function removeSpell(record, dataPathToSpell) {
  // Extract the index (last part of the path)
  const pathParts = dataPathToSpell.split(".");
  const indexValue = parseInt(pathParts.pop(), 10);

  if (isNaN(indexValue) || indexValue < 0) {
    return;
  }

  // Join remaining parts to get the spell list path (keeps .data. intact)
  const spellListDataPath = pathParts.join(".");

  api.removeValue(spellListDataPath, indexValue);
}

function addSpellcastingEntry(record) {
  // Add a new spellcasting entry to the list
  // First requery to get selected values for the new entry
  api.getRecord(record.recordType, record._id, (updatedRecord) => {
    // Set name based on the first spellcasting entry
    const tradition = updatedRecord.data?.addTradition || "Arcane";
    const proficiency = updatedRecord.data?.addProficiency || "spell";
    const attribute = updatedRecord.data?.addAttribute || "int";
    const type = updatedRecord.data?.addType || "prepared";

    let mod = 0;
    let dc = 0;
    let training = 0;

    if (record.recordType === "characters") {
      // Get current spellcasting training level
      training =
        parseInt(
          proficiency === "spell"
            ? updatedRecord.data?.spellcasting || "0"
            : updatedRecord.data?.classDCProficiency || "0",
          10
        ) || 0;

      const proficiencyBonus = calculateProficiencyBonus(record, training);
      const attributeScore = updatedRecord.data?.[`${attribute}`] || 0;
      // Set the DC and Modifier based on the proficiency
      mod = attributeScore + proficiencyBonus;
      dc = 10 + mod;
    }

    const index = (updatedRecord.data?.spells || []).length || 0;

    api.addValue(
      "data.spells",
      buildSpellcastingEntry({
        type,
        proficiency,
        tradition,
        attribute,
        training,
        dc,
        mod,
        isFirst: index === 0,
      }),
      () => {
        // Reset the values
        api.setValues({
          "data.addTradition": "",
          "data.addProficiency": "",
          "data.addAttribute": "",
          "data.addType": "",
        });
      }
    );
  });
}

function getCastingRank(record, spell, dataPathToSpell) {
  // A signature spell cast at a chosen rank (check-tools.js)
  const chosenRank = parseInt(spell?.castRank, 10);
  if (chosenRank > 0) return chosenRank;

  const pathParts = dataPathToSpell.split(".");

  // Find which spell list this is in (cantrips, spells1, spells2, etc.)
  // Path structure is like: data.spells.1.spells4.4
  // We need the LAST occurrence of cantrips/spells# in the path
  let spellListType = "";
  for (let i = pathParts.length - 1; i >= 0; i--) {
    if (pathParts[i] === "cantrips" || pathParts[i].startsWith("spells")) {
      spellListType = pathParts[i];
      break;
    }
  }

  // Determine the rank we're casting at
  let castingRank = spell?.data?.level || 1;
  const spellCastingEntryDataPath = getNearestParentDataPath(dataPathToSpell);
  const spellCastingEntry = api.getValueOnRecord(
    record,
    spellCastingEntryDataPath
  );
  const isFocus = spellCastingEntry?.data?.type === "focus";

  // Cantrips and Focus spells are automatically heightened to half character level (rounded up)
  if (spellListType === "cantrips" || isFocus) {
    castingRank = Math.max(1, Math.ceil((record.data?.level || 1) / 2));
  } else if (spellListType && spellListType.startsWith("spells")) {
    // Extract rank from spellListType (e.g., "spells1" -> 1, "spells10" -> 10)
    const rankMatch = spellListType.match(/spells(\d+)/);
    if (rankMatch) {
      castingRank = parseInt(rankMatch[1], 10);
    }
  }

  return castingRank;
}

// The rank a spell is cast at and whether it is cast from a spell slot (a
// prepared or spontaneous spell, not a cantrip), as the predicate context of
// its damage and healing rolls: Foundry's @spell.level and item:spell-slot
// (Sorcerous Potency)
function getSpellCastContext(record, spell, dataPathToSpell) {
  const path = String(dataPathToSpell || "");
  if (!path) return {};
  let entryPath = getNearestParentDataPath(path);
  // An overlay's parent is its spell; the entry is one more up
  if (/\.data\.overlays\.\d+$/.test(path)) {
    entryPath = getNearestParentDataPath(entryPath);
  }
  const entry = api.getValueOnRecord(record, entryPath);
  const isCantrip =
    /\.cantrips\.\d+/.test(path) ||
    (spell?.data?.traits || []).some(
      (trait) => String(trait).toLowerCase() === "cantrip"
    );
  const type = entry?.data?.type;
  return {
    castRank: getCastingRank(record, spell, path),
    spellSlot: (type === "prepared" || type === "spontaneous") && !isCantrip,
  };
}

// A spell's target, range or duration as text: the sheet's text, or the
// { value } object the converter copies from Foundry's fixed heightening
function getHeightenedText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return getHeightenedText(value.value);
  return String(value).trim();
}

function getSpellHeighteningInfo(spell, castingRank) {
  const heightening = spell?.data?.heightening || [];
  const baseRank = spell?.data?.level || 1;

  // Return object with heightening changes
  const result = {
    damage: null, // Will be set if fixed heightening applies
    area: null,
    target: null,
    duration: null,
    range: null,
    intervalDamageIncrease: [], // For interval heightening
    intervalAreaIncrease: 0, // Total area increase from all interval heightenings
  };

  if (castingRank <= baseRank || heightening.length === 0) {
    return result;
  }

  // Process interval heightening (all stack)
  heightening.forEach((heightenEntry) => {
    const heightenData = heightenEntry?.data;
    if (!heightenData || heightenData.type !== "interval") return;

    const interval = heightenData.interval || 1;
    const ranksAboveBase = castingRank - baseRank;
    const numIntervals = Math.floor(ranksAboveBase / interval);

    if (numIntervals > 0) {
      // Add damage increase
      if (heightenData.damage) {
        result.intervalDamageIncrease.push({
          numIntervals,
          damage: heightenData.damage,
        });
      }

      // Add area increase (number that adds to base area value, stored as
      // a number or text)
      const areaIncrease = parseFloat(heightenData.area);
      if (areaIncrease > 0) {
        result.intervalAreaIncrease += areaIncrease * numIntervals;
      }
    }
  });

  // Every fixed rank up to the casting rank applies, lowest first, each over
  // the last (Foundry's heightening.levels): Telekinetic Hand at 5th keeps
  // 3rd's target and takes 5th's range
  const fixedLevels = [];
  heightening.forEach((heightenEntry) => {
    const heightenData = heightenEntry?.data;
    if (!heightenData || heightenData.type !== "fixed") return;
    (heightenData.levels || []).forEach((levelEntry) => {
      const levelRank = levelEntry?.data?.rank || 0;
      if (levelRank <= castingRank) fixedLevels.push(levelEntry);
    });
  });
  fixedLevels
    .sort((a, b) => (a?.data?.rank || 0) - (b?.data?.rank || 0))
    .forEach((levelEntry) => {
      const levelData = levelEntry.data || {};
      if (Array.isArray(levelData.damage) && levelData.damage.length > 0) {
        result.damage = levelData.damage;
      }
      if (levelData.area && (levelData.area.type || levelData.area.value)) {
        result.area = levelData.area;
      }
      const target = getHeightenedText(levelData.target);
      if (target) result.target = target;
      const range = getHeightenedText(levelData.range);
      if (range) result.range = range;
      // A duration keeps its object, which says whether it's sustained
      if (getHeightenedText(levelData.duration)) {
        result.duration = levelData.duration;
      }
    });

  return result;
}

function calculateSpellDamage(record, spell, dataPathToSpell) {
  // Determine the spell rank we're casting at
  const castingRank = getCastingRank(record, spell, dataPathToSpell);

  // Get the spellcasting entry to determine attribute modifier
  // Navigate up from spell path (e.g., data.spells.0.cantrips.0) to get spellcasting entry
  const spellListPath = getNearestParentDataPath(dataPathToSpell); // e.g., data.spells.0.cantrips
  const spellcastingEntryPath = getNearestParentDataPath(spellListPath); // e.g., data.spells.0
  const spellcastingEntry = api.getValue(spellcastingEntryPath);

  let attributeMod = 0;
  if (spellcastingEntry) {
    const attribute = spellcastingEntry?.data?.attribute || "int";
    attributeMod = record.data?.[attribute] || 0;
  }

  const baseDamage = spell?.data?.damage || [];

  // Get the primary damage type from the first base damage entry to use as fallback for heightening
  const primaryDamageType = baseDamage[0]?.data?.type || "untyped";

  let damageString = "";
  let healingString = "";
  let persistentDamage = "";
  const damageComponents = [];
  const precisionDamageComponents = []; // Separate array for precision damage
  const healingComponents = [];
  const persistentComponents = [];
  // Rows that apply only against some targets (data.predicate), worked out
  // when the damage is rolled (getSpellTargetDamage)
  const targetDamage = [];
  let splashDamageValue = 0;
  let splashDamageType = "untyped";

  let hasDamage = false;
  let hasHealing = false;

  // Get heightening info
  const heighteningInfo = getSpellHeighteningInfo(spell, castingRank);

  // The rows to roll: a fixed heightening's own, or the base rows with each
  // interval step added to the row of the same index, so a persistent row
  // heightens its persistent damage (Blood Vendetta)
  let rows;
  if (heighteningInfo.damage) {
    rows = heighteningInfo.damage.map((entry) =>
      getSpellDamageRow(entry, primaryDamageType)
    );
  } else {
    rows = baseDamage.map((entry) => getSpellDamageRow(entry, "untyped"));
    heighteningInfo.intervalDamageIncrease.forEach(({ numIntervals, damage }) => {
      (damage || []).forEach((heightenDmg, index) => {
        const formula = String(heightenDmg?.data?.formula || "").trim();
        if (!formula) return;
        const [first, ...rest] = multiplyDamageFormula(formula, numIntervals);
        const type =
          heightenDmg?.data?.type ||
          baseDamage[index]?.data?.type ||
          primaryDamageType;
        if (!rows[index]) {
          // A step with no base row is direct damage of its own
          rows[index] = getSpellDamageRow(
            { data: { formula: first, type } },
            primaryDamageType
          );
        } else {
          addSpellDamageTerm(rows[index], first, type);
        }
        rest.forEach((increase) => addSpellDamageTerm(rows[index], increase, type));
      });
    });
  }

  rows.forEach((row) => {
    const { category, isDamage, isHealing, applyMod } = row;
    if (isDamage) hasDamage = true;
    if (isHealing) hasHealing = true;
    if (!row.formula) return;
    // For healing, use "heal" instead of "untyped"
    const typeOf = (type) => (isHealing && type === "untyped" ? "heal" : type);
    const terms = [{ formula: row.formula, type: row.type }, ...row.terms];

    if (row.predicate && isDamage && !isHealing && category !== "splash") {
      terms.forEach((term) => {
        targetDamage.push({
          value: `${term.formula} ${category === "precision" ? "precision" : term.type}`,
          category: category === "persistent" ? "persistent" : "",
          predicate: row.predicate,
        });
      });
      return;
    }

    if (category === "persistent") {
      if (isDamage) {
        terms.forEach((term) =>
          persistentComponents.push(`${term.formula} ${term.type}`)
        );
      }
    } else if (category === "splash") {
      // Splash damage is tracked separately and not added to the main damage string
      if (isDamage) {
        // Check if it's a pure number or a dice formula
        const splashNumber = Number(row.formula);
        // A pure number like "3", or a dice formula like "1d4"
        splashDamageValue = !isNaN(splashNumber) ? splashNumber : row.formula;
        splashDamageType = row.type;
      }
    } else if (category === "precision") {
      // Precision damage goes into separate array
      if (isDamage) {
        // Apply attribute modifier if applyMod is true
        const effectFormula =
          applyMod && attributeMod > 0
            ? `${row.formula} + ${attributeMod} precision`.trim()
            : `${row.formula} precision`.trim();
        precisionDamageComponents.push(
          [effectFormula, ...row.terms.map((t) => `${t.formula} precision`)].join(" + ")
        );
      }
    } else {
      // Apply attribute modifier if applyMod is true
      const effectFormula = [
        applyMod && attributeMod > 0
          ? `${row.formula} + ${attributeMod} ${typeOf(row.type)}`.trim()
          : `${row.formula} ${typeOf(row.type)}`.trim(),
        ...row.terms.map((t) => `${t.formula} ${typeOf(t.type)}`),
      ].join(" + ");

      if (isDamage) {
        damageComponents.push(effectFormula);
      }
      // Both damage and healing: added to both
      if (isHealing) {
        healingComponents.push(effectFormula);
      }
    }
  });

  // Build final strings
  // Combine regular damage components first, then precision damage components
  const allDamageComponents = [
    ...damageComponents,
    ...precisionDamageComponents,
  ];
  damageString = allDamageComponents.join(" + ");
  healingString = healingComponents.join(" + ");
  persistentDamage = persistentComponents.join(" + ");

  // spellDieSize modifiers change the spell's dice (Healing Hands: heal rolls
  // d10s instead of d8s). Field "healing" or "damage" limits which.
  damageString = applySpellDieSize(record, spell, damageString, "damage");
  healingString = applySpellDieSize(record, spell, healingString, "healing");
  targetDamage.forEach((entry) => {
    entry.value = applySpellDieSize(record, spell, entry.value, "damage");
  });

  return {
    damageString,
    healingString,
    persistentDamage,
    splashDamageValue,
    splashDamageType,
    hasDamage,
    hasHealing,
    castingRank,
    targetDamage,
  };
}

// One of a spell's damage rows, with what interval heightening adds to it in
// terms
function getSpellDamageRow(entry, fallbackType) {
  const data = entry?.data || {};
  const kinds = data.kinds || [];
  return {
    formula: String(data.formula || "").trim(),
    type: data.type || fallbackType,
    category: data.category || "",
    // If no kinds specified, assume damage
    isDamage: kinds.length === 0 || kinds.includes("damage"),
    isHealing: kinds.includes("healing"),
    applyMod: data.applyMod || false,
    predicate: isNonEmptyPredicate(parseModifierPredicate(data.predicate || ""))
      ? data.predicate
      : "",
    terms: [],
  };
}

// A heightening step taken n times, as the terms to add: "2d6" 3 times is
// ["6d6"], "1" twice ["2"], and "1d4+1" twice ["1d4+1", "1d4+1"], each typed
// on its own
function multiplyDamageFormula(formula, times) {
  const dice = formula.match(/^(\d*)d(\d+)$/i);
  if (dice) return [`${(parseInt(dice[1], 10) || 1) * times}d${dice[2]}`];
  if (/^\d+$/.test(formula)) return [String(parseInt(formula, 10) * times)];
  return Array(times).fill(formula);
}

// Two formulas of the same dice or both flat added up ("2d6" and "2d6" is
// "4d6"), or null when they can't be
function addDamageFormulas(a, b) {
  const diceA = String(a).match(/^(\d*)d(\d+)$/i);
  const diceB = String(b).match(/^(\d*)d(\d+)$/i);
  if (diceA && diceB && diceA[2] === diceB[2]) {
    return `${(parseInt(diceA[1], 10) || 1) + (parseInt(diceB[1], 10) || 1)}d${diceA[2]}`;
  }
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    return String(parseInt(a, 10) + parseInt(b, 10));
  }
  return null;
}

// Adds a heightening increase to a row: into its formula or a term of the
// same type when they add up, else as a term of its own
function addSpellDamageTerm(row, formula, type) {
  const sameType = [row, ...row.terms].filter((term) => term.type === type);
  for (const term of sameType) {
    const sum = addDamageFormulas(term.formula, formula);
    if (sum !== null) {
      term.formula = sum;
      return;
    }
  }
  row.terms.push({ formula, type });
}

// The damage rows that apply only against some targets (calculateSpellDamage's
// targetDamage) for one roll against these targets: a damage modifier, on
// when the predicate passes against the one target and offered unticked when
// that can't be known (no target or several), as weapon damage against a
// target's trait is (Chilling Darkness's spirit damage against holy
// creatures). Persistent damage can't be ticked in the roll prompt, so it's
// added only when the predicate passes. { modifiers, persistent }
function getSpellTargetDamage(record, rows, targets, context = {}, name = "") {
  const result = { modifiers: [], persistent: [] };
  if (!Array.isArray(rows) || rows.length === 0 || !record) return result;
  const lookup = {
    ...context,
    targets: Array.isArray(targets) ? targets : [],
  };
  const traits = collectTraitsAndProperties(record, lookup);
  rows.forEach((row) => {
    const predicate = parseModifierPredicate(row.predicate);
    const passes = evaluateEffectPredicate(predicate, traits, record, lookup);
    const situational =
      !passes &&
      evaluateEffectPredicate(predicate, traits, record, {
        ...lookup,
        __assumeSituational: true,
      });
    if (!passes && !situational) return;
    if (row.category === "persistent") {
      if (passes) result.persistent.push(row.value);
      return;
    }
    // Named for what it's against ("vs holy"), with or without a target
    const label = getSituationalLabel(predicate, new Set(), {}, record);
    const modifier = {
      name: label ? `${name || "Spell"} (${label})` : name || "Spell",
      value: row.value,
      active: passes,
      type: "",
      valueType: "string",
      modifierType: "spellDamageBonus",
      isPenalty: false,
    };
    if (situational) modifier.situational = label || true;
    result.modifiers.push(modifier);
  });
  return result;
}

// Where a spell's damage or healing comes from (getDamageSource), with the
// rank it's cast at. An overlay goes by its spell's name, as Foundry's slug
// does: Heal (vs. Living) is heal.
function getSpellDamageSource(record, spell, dataPathToSpell, tradition = "", castRank = null) {
  const source = getDamageSource(record, spell, tradition);
  const overlay = String(dataPathToSpell || "").match(/^(.*)\.data\.overlays\.\d+$/);
  if (overlay) {
    const baseSpell = api.getValueOnRecord(record, overlay[1]);
    const slug = toSlug(String(baseSpell?.name || ""));
    if (slug) source.slug = slug;
  }
  const rank = parseInt(castRank, 10);
  if (rank > 0) source.castRank = rank;
  return source;
}

function isVitalityDualKindSpell(spell) {
  // Check if spell has vitality or void trait
  const traits = spell?.data?.traits || [];
  const hasVitalityOrVoid = traits.some((trait) => {
    const lowerTrait = trait?.toLowerCase();
    return lowerTrait === "vitality" || lowerTrait === "void";
  });

  if (!hasVitalityOrVoid) {
    return false;
  }

  // Check if any damage entry has both damage and healing kinds
  const damageList = spell?.data?.damage || [];
  const hasDualKind = damageList.some((dmg) => {
    const kinds = dmg?.data?.kinds || [];
    return kinds.includes("damage") && kinds.includes("healing");
  });

  return hasDualKind;
}

function getSpellDamageMacro(record, spell, dataPathToSpell, tradition = "") {
  const spellName = spell?.name || "Unknown Spell";
  const spellDamage = calculateSpellDamage(record, spell, dataPathToSpell);

  if (!spellDamage.hasDamage) {
    return null; // No damage to roll
  }

  // Special case: if there's no main damage but there is persistent damage,
  // just return a macro that applies the persistent damage directly
  if (
    (!spellDamage.damageString || spellDamage.damageString.trim() === "") &&
    spellDamage.persistentDamage &&
    spellDamage.persistentDamage.trim() !== "" &&
    !(spellDamage.targetDamage || []).length
  ) {
    const persistentMacroName = spellDamage.persistentDamage
      .split(" ")
      .map((word) => capitalize(word))
      .join("_");
    const token = api.getToken();
    const tokenId = token?._id;
    const tokenName =
      token?.identified === false
        ? token?.record?.unidentifiedName
        : token?.record?.name;
    return `\`\`\`${persistentMacroName}_Persistent_Damage
applyPersistentDamage("${spellDamage.persistentDamage}", "${tokenId}", "${tokenName}");
\`\`\``;
  }

  const isCantrip = (spell?.data?.traits || []).some(
    (trait) => trait?.toLowerCase() === "cantrip"
  );

  // Check if this is a vitality spell with dual damage/healing
  const isVitalityDual = isVitalityDualKindSpell(spell);

  // Determine primary damage type for the macro name
  const firstDamage = spell?.data?.damage?.[0];
  const primaryDamageType = firstDamage?.data?.type || "";
  const damageTypeName = primaryDamageType
    ? capitalize(primaryDamageType)
    : "Damage";

  // Use special name for vitality dual-kind spells
  const macroName = isVitalityDual
    ? "Roll_Damage_or_Healing"
    : `Roll_${damageTypeName}_Damage`;

  // Get damage modifiers based on spell type
  const damageModifierTypes = isCantrip
    ? ["cantripDamageBonus", "cantripDamagePenalty"]
    : ["spellDamageBonus", "spellDamagePenalty"];

  const traits = spell?.data?.traits || [];
  // A basic save: the damage card applies it to each target by its save
  // (basic-saves.js)
  const save = spell?.data?.defense?.save;
  const basicSave =
    save?.statistic && (save.basic === true || save.basic === "true")
      ? { saveType: String(save.statistic).toLowerCase() }
      : null;
  const castContext = getSpellCastContext(record, spell, dataPathToSpell);

  return `\`\`\`${macroName}
// Lookup the record and then prompt the roll
api.getRecord('${record.recordType}', '${record._id}', (record) => {
  // Get the spell for context
  const spell = api.getValueOnRecord(record, '${dataPathToSpell}');

  // Get damage modifiers based on spell type
  const damageModifierTypes = ${JSON.stringify(damageModifierTypes)};
  const damageModifiers = getEffectsAndModifiersForToken(
    record,
    damageModifierTypes,
    "",
    undefined,
    undefined,
    { spell, ...${JSON.stringify(castContext)} }
  );
  // Damage only against some targets (getSpellTargetDamage)
  const targetDamage = getSpellTargetDamage(
    record,
    ${JSON.stringify(spellDamage.targetDamage || [])},
    api.getTargets(),
    { spell, ...${JSON.stringify(castContext)} },
    ${JSON.stringify(spellName)}
  );
  damageModifiers.push(...targetDamage.modifiers);

  let damage = "${spellDamage.damageString}";
  const persistentDamage = ["${spellDamage.persistentDamage}", ...targetDamage.persistent].filter(Boolean).join(" + ");
  const splashDamageValue = ${
    typeof spellDamage.splashDamageValue === "number"
      ? spellDamage.splashDamageValue
      : `"${spellDamage.splashDamageValue}"`
  };
  const splashDamageType = "${spellDamage.splashDamageType}";

  // Build criticalOnlyDice array to track splash damage (so it doesn't get doubled)
  const criticalOnlyDice = [];
  if (splashDamageValue && splashDamageValue !== 0 && splashDamageValue !== "0") {
    // Add splash damage to the damage string
    damage = damage + " + " + splashDamageValue + " " + splashDamageType;

    // Also track it in criticalOnlyDice so it doesn't get doubled on crits
    // Parse the splash damage to determine die type
    let splashDieType = 0;
    let splashFlatDamage = 0;

    // Check if it's a dice formula first (e.g., "1d4", "2d6", "d6")
    const diceMatch = String(splashDamageValue).match(/\\d*d(\\d+)/);
    if (diceMatch) {
      // It's a dice formula
      splashDieType = parseInt(diceMatch[1], 10);
    } else if (typeof splashDamageValue === 'number') {
      // It's already a number
      splashFlatDamage = splashDamageValue;
    } else {
      // Try to parse as a number string
      const numValue = Number(splashDamageValue);
      if (!isNaN(numValue)) {
        splashFlatDamage = numValue;
      }
    }

    criticalOnlyDice.push({
      dieType: splashDieType,
      damageType: splashDamageType.toLowerCase(),
      flatDamage: splashFlatDamage,
    });
  }

  api.promptRoll(
    "${spellName}",
    damage,
    damageModifiers,
    {
      persistentDamage: persistentDamage,
      splashDamage: splashDamageValue,
      splashDamageType: splashDamageType,
      damageType: "${primaryDamageType}",
      isSpell: true,
      rollName: "${spellName} Damage",
      traits: ${JSON.stringify(traits)},
      isVitalityDual: ${isVitalityDual},
      criticalOnlyDice: criticalOnlyDice,
      attack: "${spellName}",
      icon: "IconWand",
      portrait: ${JSON.stringify(spell?.portrait || "")},
      // The spell and its casting tradition, for resistances to spells
      damageSource: getSpellDamageSource(record, spell, '${dataPathToSpell}', ${JSON.stringify(tradition)}, ${castContext.castRank || "null"}),
      basicSave: ${JSON.stringify(basicSave)},
    },
    "damage"
  );
});
\`\`\``;
}

function getSpellHealingMacro(record, spell, dataPathToSpell, tradition = "") {
  const spellName = spell?.name || "Unknown Spell";
  const spellEffect = calculateSpellDamage(record, spell, dataPathToSpell);

  if (!spellEffect.hasHealing) {
    return null; // No healing to roll
  }

  // Get healing modifiers based on spell type
  const healingModifierTypes = ["healingBonus", "healingPenalty"];
  const castContext = getSpellCastContext(record, spell, dataPathToSpell);

  return `\`\`\`Roll_Healing
// Lookup the record and then prompt the roll
api.getRecord('${record.recordType}', '${record._id}', (record) => {
  // Get the spell for context
  const spell = api.getValueOnRecord(record, '${dataPathToSpell}');

  // Get healing modifiers based on spell type
  const healingModifierTypes = ${JSON.stringify(healingModifierTypes)};
  const healingModifiers = getEffectsAndModifiersForToken(
    record,
    healingModifierTypes,
    "",
    undefined,
    undefined,
    { spell, ...${JSON.stringify(castContext)} }
  );

  const healing = "${spellEffect.healingString}";

  api.promptRoll(
    "${spellName}",
    healing,
    healingModifiers,
    {
      isSpell: true,
      rollName: "${spellName} Healing",
      // The spell and its rank, for healing the target receives from spells
      // (healingReceived: Angelic Halo)
      damageSource: getSpellDamageSource(record, spell, '${dataPathToSpell}', ${JSON.stringify(tradition)}, ${castContext.castRank || "null"}),
    },
    "healing"
  );
});
\`\`\``;
}

function getSpellSaveMacro(record, spell, spellCastingEntry, dataPathToSpell) {
  const saveType = spell?.data?.defense?.save?.statistic;
  // NPC spell DCs are stored numbers; Proficiency without Level subtracts the
  // creature's level (0 for characters, whose DC is already calculated)
  let saveDC =
    (spellCastingEntry?.data?.dc || 0) +
    getNpcProficiencyWithoutLevelAdjustment(record);
  const spellDCMods = getEffectsAndModifiersForToken(
    record,
    ["spellDCBonus", "spellDCPenalty"],
    saveType
  );
  // Bonuses and penalties to checks and DCs of the casting attribute
  // (stupefied, frightened) apply to the spell DC too
  const attributeMods = getEffectsAndModifiersForToken(
    record,
    ["allBonus", "allPenalty"],
    spellCastingEntry?.data?.attribute || "int",
    undefined,
    undefined,
    { spell }
  );
  mergeModifierLists(spellDCMods, attributeMods).forEach((mod) => {
    if (mod.active === false) return;
    saveDC += parseInt(mod.value || 0, 10) || 0;
  });
  // Pass the spell's traits and casting tradition so save modifiers against
  // emotion/fear/mental/arcane/... effects apply automatically
  const sourceTraits = [...(spell?.data?.traits || [])];
  const tradition = spellCastingEntry?.data?.tradition;
  if (tradition) sourceTraits.push(tradition);
  // A spell that forces the target to move (the spell's "Forces Movement"
  // box): saves against forced movement apply (Sky's Call, Rock Dwarf)
  const forcesMovement = spell?.data?.defense?.save?.forcedMovement;
  if (forcesMovement === true || forcesMovement === "true") {
    sourceTraits.push("forced-movement");
  }
  const basic = spell?.data?.defense?.save?.basic;
  // Incapacitation compares the saver's level with the spell's rank
  // (check-tools.js)
  const rank = sourceTraits.some((t) => `${t}`.toLowerCase() === "incapacitation")
    ? getCastingRank(record, spell, dataPathToSpell)
    : null;
  // An affliction spell (Goblin Pox): its save is the initial save, and the
  // result's Apply afflicts at this DC (afflictions.js)
  const affliction = getRecordAffliction(spell);
  return getSaveMacro(saveType, saveDC, true, true, sourceTraits, basic === true || basic === "true", rank,
    affliction ? { affliction: { mode: "initial", affliction } } : {});
}

function getSpellAttackMacro(
  record,
  spell,
  spellCastingEntry,
  dataPathToSpell,
  animation
) {
  const defense = spell?.data?.defense || null;
  if (!defense || !defense.passive || !defense.passive.statistic) {
    return "";
  }

  const spellName = spell?.name || "Spell";
  const defenseStatistic = defense.passive.statistic; // ac, fortitude-dc, reflex-dc, or will-dc
  const spellAttackMod =
    (spellCastingEntry?.data?.mod || 0) +
    getNpcProficiencyWithoutLevelAdjustment(record);
  const range = (spell?.data?.range || "").toLowerCase().trim();

  // Determine if spell is melee
  const isMelee =
    !range ||
    range === "0" ||
    range === "0 feet" ||
    range === "0 ft" ||
    range === "touch";

  // Determine save type and description based on the defense statistic
  let saveType = "";
  let dcDescription = "";
  let isAC = false;

  if (defenseStatistic === "ac") {
    isAC = true;
    dcDescription = "AC";
  } else if (defenseStatistic === "fortitude-dc") {
    saveType = "fortitude";
    dcDescription = "Fortitude DC";
  } else if (defenseStatistic === "reflex-dc") {
    saveType = "reflex";
    dcDescription = "Reflex DC";
  } else if (defenseStatistic === "will-dc") {
    saveType = "will";
    dcDescription = "Will DC";
  }

  const spellDamage = calculateSpellDamage(record, spell, dataPathToSpell);
  const isCantrip = (spell?.data?.traits || []).some(
    (trait) => trait?.toLowerCase() === "cantrip"
  );

  // Determine primary damage type for physical damage check
  const firstDamage = spell?.data?.damage?.[0];
  const primaryDamageType = firstDamage?.data?.type || "untyped";
  const damageIsPhysical = ["bludgeoning", "piercing", "slashing"].includes(
    primaryDamageType.toLowerCase()
  );

  const traits = spell?.data?.traits || [];
  const isVitalityDual = isVitalityDualKindSpell(spell);
  // Incapacitation: one degree worse against a target above twice the rank
  // (check-tools.js)
  const castingRank = getCastingRank(record, spell, dataPathToSpell);
  const castContext = getSpellCastContext(record, spell, dataPathToSpell);
  const tradition = spellCastingEntry?.data?.tradition || "";
  // Damage only against some targets, for one target or none
  // (getSpellTargetDamage)
  const targetDamage = (targets) => `getSpellTargetDamage(record, ${JSON.stringify(spellDamage.targetDamage || [])}, ${targets}, { spell, ...${JSON.stringify(castContext)} }, ${JSON.stringify(spellName)})`;

  return `\`\`\`Roll_Attack
// Lookup the record and then prompt the roll
api.getRecord('${record.recordType}', '${record._id}', (record) => {
  // Get the spell for context
  const spell = api.getValueOnRecord(record, '${dataPathToSpell}');

  const targets = api.getTargets();
  const ourToken = api.getToken();
  const tokenName = ourToken?.identified === false ? ourToken?.record?.unidentifiedName : ourToken?.record?.name;
  const recordId = record._id;
  const recordType = record.type;

  // Get spell attack modifiers for the caster
  const spellAttackMods = getEffectsAndModifiersForToken(
    record,
    ["spellAttackBonus", "spellAttackPenalty"],
    "",
    undefined,
    undefined,
    { spell }
  );
  // A spell attack is an attack roll and a check of the casting attribute, so
  // attack bonuses (bless) and attribute penalties (stupefied, frightened) apply
  const spellCheckMods = getEffectsAndModifiersForToken(
    record,
    ["attackBonus", "attackPenalty", "allBonus", "allPenalty"],
    "${spellCastingEntry?.data?.attribute || "int"}",
    undefined,
    undefined,
    { spell }
  );

  // Get damage modifiers based on spell type
  const damageModifierTypes = ${isCantrip}
    ? ["cantripDamageBonus", "cantripDamagePenalty"]
    : ["spellDamageBonus", "spellDamagePenalty"];

  const damageModifiers = getEffectsAndModifiersForToken(
    record,
    damageModifierTypes,
    "",
    undefined,
    undefined,
    { spell, ...${JSON.stringify(castContext)} }
  );
  
  const modifiers = [
    {
      name: "Spell Attack",
      type: "",
      value: ${spellAttackMod},
      active: true
    },
    // Only the strongest bonus and penalty of each type across both lookups
    ...mergeModifierLists(spellAttackMods, spellCheckMods),
    // Fortune / misfortune on spell attack rolls
    ...getRollTwiceModifiers(
      record,
      ["spell-attack-roll", "attack-roll", "${spellCastingEntry?.data?.attribute || "int"}"],
      undefined,
      { spell }
    ),
    // The multiple attack penalty from the caster's attacks this turn
    // (attack-log.js), ticked; it can be unticked in the prompt
    ...getTurnMapModifiers(getNextAttackNumber(record, ourToken))
  ];
  // What the result handler logs for this attack
  const getTurnAttack = (targetId) =>
    getTurnAttackMetadata(ourToken, record, { kind: "spell", name: ${JSON.stringify(spellName)}, targetId });

  // Build criticalOnlyDice array to track splash damage (so it doesn't get doubled)
  const splashDamageValue = ${
    typeof spellDamage.splashDamageValue === "number"
      ? spellDamage.splashDamageValue
      : `"${spellDamage.splashDamageValue}"`
  };
  const splashDamageType = "${spellDamage.splashDamageType}";
  const criticalOnlyDice = [];
  if (splashDamageValue && splashDamageValue !== 0 && splashDamageValue !== "0") {
    // Parse the splash damage to determine die type
    let splashDieType = 0;
    let splashFlatDamage = 0;

    // Check if it's a dice formula first (e.g., "1d4", "2d6", "d6")
    const diceMatch = String(splashDamageValue).match(/\\d*d(\\d+)/);
    if (diceMatch) {
      // It's a dice formula
      splashDieType = parseInt(diceMatch[1], 10);
    } else if (typeof splashDamageValue === 'number') {
      // It's already a number
      splashFlatDamage = splashDamageValue;
    } else {
      // Try to parse as a number string
      const numValue = Number(splashDamageValue);
      if (!isNaN(numValue)) {
        splashFlatDamage = numValue;
      }
    }

    criticalOnlyDice.push({
      dieType: splashDieType,
      damageType: splashDamageType.toLowerCase(),
      flatDamage: splashFlatDamage,
    });
  }

  if (targets.length === 0) {
    // No target - just roll without target-specific modifiers
    const targetDamage = ${targetDamage("[]")};
    const metadata = {
      attack: "${spellName}",
      icon: "IconWand",
      portrait: ${JSON.stringify(spell?.portrait || "")},
      rollName: "Spell Attack",
      tooltip: "Spell Attack vs ${dcDescription}",
      isSpell: true,
      isMelee: ${isMelee},
      isRanged: ${!isMelee},
      damage: "${spellDamage.damageString}",
      damageType: "${primaryDamageType}",
      persistentDamage: ["${spellDamage.persistentDamage}", ...targetDamage.persistent].filter(Boolean).join(" + "),
      splashDamage: splashDamageValue,
      splashDamageType: splashDamageType,
      tokenId: ourToken?._id,
      tokenName: tokenName,
      turnAttack: getTurnAttack(null),
      damageModifiers: [...damageModifiers, ...targetDamage.modifiers],
      traits: ${JSON.stringify(traits)},
      animation: ${JSON.stringify(animation)},
      isVitalityDual: ${isVitalityDual},
      criticalOnlyDice: criticalOnlyDice,
      damageSource: getSpellDamageSource(record, spell, '${dataPathToSpell}', ${JSON.stringify(tradition)}, ${castContext.castRank || "null"}),
    };
  
    api.promptRoll(
      "Spell Attack: ${spellName}",
      "1d20",
      modifiers,
      metadata,
      "attack"
    );
  } else {
    for (const target of targets) {
      const targetToken = target.token;
      const targetRecord = targetToken?.record;
      const targetDistance = target?.distance || 0;
  
      // Whether the target can Shield Block: shield raised and not broken, and
      // Shield Block (armor-traits.js)
      let targetShieldRaised = false;
      if (canShieldBlock(targetToken)) {
        targetShieldRaised = true;
      }
  
      // Check if target is off-guard
      let targetIsOffGuard = isOffGuard(targetToken);
  
      // Check for flanking if melee
      let targetIsOffGuardDueToFlanking = false;
      if (${isMelee} && !targetIsOffGuard) {
        targetIsOffGuardDueToFlanking = isOffGuardDueToFlanking({
          sourceToken: ourToken,
          sourceReach: record.data?.reach || 5,
          otherTokens: api.getOtherTokens(),
          target: target
        });
        targetIsOffGuard = targetIsOffGuardDueToFlanking;
      }
      // A hidden, invisible or undetected caster (concealment.js)
      if (!targetIsOffGuard && isUnseenAttacker(ourToken)) {
        targetIsOffGuard = true;
        targetIsOffGuardDueToFlanking = true;
      }
  
      // Calculate target DC using proper functions
      let targetDC = 10;
      // AC against us: modifiers that only apply against this attacker
      // (Outwit) are named on the card
      const acReasons = [];
      if (${isAC}) {
        // A melee or ranged spell attack, for AC against ranged attacks
        targetDC = getArmorClassForToken(targetToken, targetIsOffGuardDueToFlanking, ourToken, acReasons, { attackRange: "${isMelee ? "melee" : "ranged"}" });
      } else {
        targetDC = getSaveDCForToken(targetToken, "${saveType}");
      }
  
      // Get attack modifiers from effects on the target
      const targetEffects = getAttackModifiersForTarget(targetToken, targetDistance);
      // AC bonuses only against a reaction to the target's movement
      // (Blessed Swiftness): unticked
      const situationalAc = ${isAC}
        ? getTargetSituationalAcModifiers(targetToken, ourToken, targetIsOffGuardDueToFlanking, { attackRange: "${isMelee ? "melee" : "ranged"}" })
        : [];
      // Cover from the map and creatures in the way, unticked (cover.js)
      const creatureCover = ${isAC}
        ? getCoverModifiers(targetToken, ourToken, api.getOtherTokens(), { attackRange: "${isMelee ? "melee" : "ranged"}" })
        : [];
      const targetModifiers = [...modifiers, ...targetEffects, ...situationalAc, ...creatureCover];
  
      const targetName = targetToken?.identified === false ? targetRecord?.unidentifiedName : targetRecord?.name;
      const targetDamage = ${targetDamage("[target]")};
  
      const metadata = {
        attack: "${spellName}",
        icon: "IconWand",
        portrait: ${JSON.stringify(spell?.portrait || "")},
        rollName: "Spell Attack",
        tooltip: \`Spell Attack vs \${targetName}'s ${dcDescription}\`,
        isSpell: true,
        isMelee: ${isMelee},
        isRanged: ${!isMelee},
        dc: targetDC,
        dcName: acReasons.length > 0 ? "${dcDescription} (" + [...new Set(acReasons)].join(", ") + ")" : "${dcDescription}",
        targetName: targetName,
        isOffGuard: targetIsOffGuard,
        tokenId: ourToken?._id,
        tokenName: tokenName,
        targetId: targetToken?._id,
        turnAttack: getTurnAttack(targetToken?._id),
        // The flat check to target a concealed or hidden creature
        // (concealment.js)
        concealment: getConcealmentFlatCheck(ourToken, targetToken),
        // Fortification on the target's armor (property-runes.js)
        fortification: ${isAC} ? getFortification(targetToken) : null,
        incapacitation: isIncapacitationResisted(targetToken, { traits: ${JSON.stringify(traits)}, rank: ${castingRank} }),
        damage: "${spellDamage.damageString}",
        damageType: "${primaryDamageType}",
        persistentDamage: ["${spellDamage.persistentDamage}", ...targetDamage.persistent].filter(Boolean).join(" + "),
        splashDamage: splashDamageValue,
        splashDamageType: splashDamageType,
        damageModifiers: [...damageModifiers, ...targetDamage.modifiers],
        traits: ${JSON.stringify(traits)},
        showShieldDamage: targetShieldRaised && ${damageIsPhysical},
        animation: ${JSON.stringify(animation)},
        isVitalityDual: ${isVitalityDual},
        criticalOnlyDice: criticalOnlyDice,
        damageSource: getSpellDamageSource(record, spell, '${dataPathToSpell}', ${JSON.stringify(tradition)}, ${castContext.castRank || "null"}),
      };
  
      api.promptRoll(
        \`Spell Attack: ${spellName} vs \${targetName}\`,
        "1d20",
        targetModifiers,
        metadata,
        "attack"
      );
    }
  }
});
\`\`\``;
}

// Whether a spell's range reaches past touch, for its cast animation
function isRangedSpell(range) {
  const text = getHeightenedText(range).toLowerCase();
  return !!text && text !== "self" && text !== "touch";
}

function castSpell(record, spell, dataPathToSpell, isOverlay = false) {
  // A signature spell asks for its rank first, then casts again with it
  // (check-tools.js)
  if (promptSignatureRank(record, spell, dataPathToSpell, isOverlay)) return;
  // A spontaneous caster pays for a staff's spell with charges, or 1 charge
  // and a slot: asked first, then cast again with it (item-spells.js)
  if (promptStaffPayment(record, spell, dataPathToSpell, isOverlay)) return;

  // spellDamageType modifiers can change the damage type for this casting
  spell = getAlteredSpell(record, spell);
  const isCantrip = (spell?.data?.traits || []).some(
    (trait) => trait?.toLowerCase() === "cantrip"
  );
  const spellName = spell?.name || "Unknown Spell";
  const actions = (spell?.data?.time || "").toLowerCase();
  let actionIcon = "";
  if (actions === "free") {
    actionIcon = ":free-action:";
  } else if (actions === "1") {
    actionIcon = ":one-action:";
  } else if (actions === "2") {
    actionIcon = ":two-actions:";
  } else if (actions === "3") {
    actionIcon = ":three-actions:";
  } else if (actions === "1 to 2") {
    actionIcon = ":1-to-2:";
  } else if (actions === "1 to 3") {
    actionIcon = ":1-to-3:";
  } else if (actions === "2 to 3") {
    actionIcon = ":2-to-3:";
  } else if (actions === "reaction") {
    actionIcon = ":reaction:";
  }

  const valuesToSet = {};

  const traits = spell?.data?.traits || [];
  const tags = [];

  // Get casting rank and heightening info to check for replacements
  const castingRank = getCastingRank(record, spell, dataPathToSpell);
  const heighteningInfo = getSpellHeighteningInfo(spell, castingRank);

  // Add other tags like range, duration, etc. (use heightened values if available)
  const range = heighteningInfo.range || getHeightenedText(spell?.data?.range);
  const duration = heighteningInfo.duration || spell?.data?.duration || null;
  const durationString =
    typeof duration === "string"
      ? duration
      : duration && duration.value
      ? `${duration.value} ${duration.sustained ? "Sustained" : ""}`
      : "";
  const targetString =
    heighteningInfo.target || getHeightenedText(spell?.data?.target);

  // Area can be replaced (fixed heightening) or increased (interval heightening)
  let area = heighteningInfo.area || spell?.data?.area || null;
  if (
    !heighteningInfo.area &&
    spell?.data?.area &&
    heighteningInfo.intervalAreaIncrease > 0
  ) {
    // Apply interval area increase to base area (stored as text or a number)
    area = {
      type: spell.data.area.type,
      value:
        (parseFloat(spell.data.area.value) || 0) +
        heighteningInfo.intervalAreaIncrease,
    };
  }

  const areaString =
    area && area.type && area.value
      ? `${capitalize(area.type)} ${area.value} ft`
      : "";
  // A casting time longer than actions (1 minute, 10 minutes) has no icon
  const castingTime = String(spell?.data?.time || "").trim();
  if (!actionIcon && castingTime) {
    tags.push({
      name: castingTime,
      tooltip: `Cast: ${castingTime}`,
    });
  }
  if (range) {
    tags.push({
      name: range,
      tooltip: `Range: ${range}`,
    });
  }
  if (durationString) {
    tags.push({
      name: durationString.trim(),
      tooltip: `Duration: ${durationString.trim()}`,
    });
  }
  if (targetString) {
    tags.push({
      name: targetString,
      tooltip: `Targets: ${targetString}`,
    });
  }
  if (areaString) {
    tags.push({
      name: areaString,
      tooltip: `Area: ${areaString}`,
    });
  }

  // Get all traits as tags
  traits.forEach((trait) => {
    // Ignore rarity traits
    if (getIsTraitRarity(trait)) {
      return;
    }
    tags.push({
      name: trait,
      tooltip: getTraitToolTip(trait),
    });
  });

  // We'll need to mark the spell as cast unless it was a catrip / focus / innate / or spontaneus spell
  let dataPathToSpellCastingEntry = getNearestParentDataPath(dataPathToSpell);

  // For overlay spells, we need to navigate up one more level to reach the spellcasting entry
  // Overlay path: data.spells.0.data.spells1.0.data.overlays.3 -> data.spells.0.data.spells1.0 -> data.spells.0
  // Regular spell path: data.spells.0.data.spells1.0 -> data.spells.0
  if (isOverlay) {
    dataPathToSpellCastingEntry = getNearestParentDataPath(
      dataPathToSpellCastingEntry
    );
  }

  let spellCastingEntry = api.getValueOnRecord(
    record,
    dataPathToSpellCastingEntry
  );

  // A row of the Scrolls and Wands entry spends its scroll or wand, with the
  // caster's numbers for this spell, in this cast's one write; it never runs
  // out (item-spells.js)
  const itemSpellCast = isItemSpellsEntry(spellCastingEntry)
    ? getItemSpellCast(
        record,
        spell,
        dataPathToSpell,
        dataPathToSpellCastingEntry,
        isOverlay
      )
    : null;
  if (itemSpellCast) {
    spellCastingEntry = itemSpellCast.entry;
    Object.assign(valuesToSet, itemSpellCast.values);
  }
  const type = spellCastingEntry.data?.type;

  const isSpontaneous = type === "spontaneous";
  const isFocus = type === "focus";
  const isInnate = type === "innate" || type === "item";

  if (!isSpontaneous && !isFocus && !isInnate && !isCantrip) {
    valuesToSet[`${dataPathToSpell}.data.used`] = true;
    valuesToSet[`${dataPathToSpell}.fields.nameUsedBox.hidden`] = false;
    valuesToSet[`${dataPathToSpell}.fields.nameBox.hidden`] = true;
  }

  if (spellCastingEntry.data?.type === "focus" && !isCantrip) {
    // A character spends from their one focus pool (spell-entries.js), an NPC
    // from the entry's own
    const isCharacter = record.recordType === "characters";
    const maxFocusPool = isCharacter
      ? getFocusPoolMax(record)
      : spellCastingEntry.data?.focusPoolMax || 1;
    const usedFocus = isCharacter
      ? getFocusPointsSpent(record)
      : spellCastingEntry.data?.focusPool || 0;

    if (usedFocus >= maxFocusPool) {
      api.showNotification(
        `You are out of Focus points and must first Refocus to cast this spell.`,
        "red",
        "Out of Focus Points"
      );
      return;
    }

    if (isCharacter) {
      Object.assign(valuesToSet, getFocusPoolValues(record, usedFocus + 1));
    } else {
      const newUsedFocus = Math.min(usedFocus + 1, maxFocusPool);
      valuesToSet[`${dataPathToSpellCastingEntry}.data.focusPool`] = newUsedFocus;
    }
  }

  if (isSpontaneous && !isCantrip) {
    // Spontaneous spells use the `useSpellsX` field to track
    const usedSpells =
      spellCastingEntry.data?.[`usedSpells${castingRank}`] || 0;
    if (usedSpells <= -0) {
      api.showNotification(
        `You are out of Spell Slots for Rank ${castingRank}`,
        "red",
        "Out of Spell Slots"
      );
      return;
    }
    const newUsedSpells = Math.max(usedSpells - 1, 0);
    valuesToSet[
      `${dataPathToSpellCastingEntry}.data.usedSpells${castingRank}`
    ] = newUsedSpells;
  }

  if (isInnate && !isCantrip && !itemSpellCast) {
    const spellUses = spell?.data?.uses || 0;

    if (spellUses <= 0) {
      api.showNotification(
        `You are out of Spell Uses for ${spellName}`,
        "red",
        "Out of Spell Uses"
      );
      return;
    }

    const newSpellUses = Math.max(spellUses - 1, 0);
    valuesToSet[`${dataPathToSpell}.data.uses`] = newSpellUses;
  }

  const spellDescription = updateDamageMacros(
    api.richTextToMarkdown(spell?.data?.description || ""),
    {
      item: spell,
      level: castingRank,
      creature: record,
      tradition: spellCastingEntry?.data?.tradition || "",
    }
  );

  let portrait = spell?.portrait
    ? `![${spellName}](${assetUrl}${encodeURI(
        spell?.portrait
      )}?width=40&height=40) `
    : "";

  if (
    (portrait.includes("Action") || portrait.includes("Reaction")) &&
    actionIcon !== ""
  ) {
    // If the portrait is also an action icon, don't show it
    portrait = "";
  }

  // Play animation if needed
  const ourToken = api.getToken();
  const targets = api.getTargets();
  const tokenId = ourToken?._id;
  const targetId = targets.length > 0 ? targets[0]?.token?._id : null;
  // Use the first instance of damage to determine animation if needed
  const damage1 =
    spell?.data?.damage && spell?.data?.damage.length > 0
      ? spell?.data?.damage[0]
      : null;
  const damageString = damage1
    ? `${damage1?.data?.formula || ""} ${damage1?.data?.type || "untyped"}`
    : "";
  const isHealing =
    damage1 &&
    damage1.data?.kinds &&
    damage1.data?.kinds.length > 0 &&
    damage1.data?.kinds.includes("healing");
  const animation =
    spell?.data?.animation ||
    getAnimationFor({
      abilityName: spellName,
      abilityDescription: spellDescription,
      damage: damageString.toLowerCase(),
      healing: isHealing,
      isRanged: isRangedSpell(range),
      isSpell: true,
    });

  let hasAttackMacro = false;
  const macros = [];
  const defense = spell?.data?.defense || null;

  if (defense) {
    // If the spell has a passive stat defense, we show a "Roll Attack" macro
    if (defense.passive && defense.passive.statistic) {
      const macro = getSpellAttackMacro(
        record,
        spell,
        spellCastingEntry,
        dataPathToSpell,
        animation
      );
      macros.push(macro);
      hasAttackMacro = true;
    }
    // If saving throws, show saves
    if (defense.save && defense.save.statistic) {
      const saveMacro = getSpellSaveMacro(
        record,
        spell,
        spellCastingEntry,
        dataPathToSpell
      );
      macros.push(saveMacro);

      // Add damage macro for saving throw spells
      const damageMacro = getSpellDamageMacro(
        record,
        spell,
        dataPathToSpell,
        spellCastingEntry?.data?.tradition || ""
      );
      if (damageMacro) {
        macros.push(damageMacro);
      }
    }
  }

  // Add damage/healing macros even if no defense (for spells that just do
  // damage/healing). A defense whose attack and save are both empty is none
  // (the converter's overlays with no defense: Heal (vs. Living)).
  if (!defense?.passive?.statistic && !defense?.save?.statistic) {
    const damageMacro = getSpellDamageMacro(
      record,
      spell,
      dataPathToSpell,
      spellCastingEntry?.data?.tradition || ""
    );
    if (damageMacro) {
      macros.push(damageMacro);
    }
  }

  // Only add healing macro if this is not a vitality/void dual-kind spell
  if (!isVitalityDualKindSpell(spell)) {
    const healingMacro = getSpellHealingMacro(
      record,
      spell,
      dataPathToSpell,
      spellCastingEntry?.data?.tradition || ""
    );
    if (healingMacro) {
      macros.push(healingMacro);
    }
  }

  // A spell that counteracts: the counteract check, at the casting rank with
  // the spell attack modifier (check-tools.js)
  if (mentionsCounteract(spell)) {
    macros.push(
      getCounteractButton(
        record,
        ourToken,
        spellName,
        castingRank,
        (spellCastingEntry?.data?.mod || 0) + getNpcProficiencyWithoutLevelAdjustment(record),
        dataPathToSpell,
        spellCastingEntry?.data?.attribute || "int"
      )
    );
  }

  // A sustained spell: recorded on the caster, with a Sustain button
  // (sustain.js)
  if (isSustainedSpell(spell) && ourToken?._id) {
    macros.push(getSustainButton(ourToken, spellName));
    startSustainingSpell(ourToken, spellName, spell);
  }

  // A summon spell: pick the creature, at the casting rank's level cap
  // (summons.js)
  if (isSummonSpell(spell)) {
    macros.push(getSummonButton(record, ourToken, spell, castingRank));
  }

  // Add overlay macros if this is not already an overlay
  const overlayMacros = [];
  if (!isOverlay) {
    const overlays = spell?.data?.overlays || [];
    if (overlays.length > 0) {
      overlays.forEach((overlay, index) => {
        const overlayName = overlay?.name || "Overlay";
        const overlayDataPath = `${dataPathToSpell}.data.overlays.${index}`;

        // Get action icon for overlay
        const overlayActions = (overlay?.data?.time || "").toLowerCase();
        let overlayActionIcon = "";
        if (overlayActions === "free") {
          overlayActionIcon = ":free-action:";
        } else if (overlayActions === "1") {
          overlayActionIcon = ":one-action:";
        } else if (overlayActions === "2") {
          overlayActionIcon = ":two-actions:";
        } else if (overlayActions === "3") {
          overlayActionIcon = ":three-actions:";
        } else if (overlayActions === "1 to 2") {
          overlayActionIcon = ":1-to-2:";
        } else if (overlayActions === "1 to 3") {
          overlayActionIcon = ":1-to-3:";
        } else if (overlayActions === "2 to 3") {
          overlayActionIcon = ":2-to-3:";
        } else if (overlayActions === "reaction") {
          overlayActionIcon = ":reaction:";
        }

        // Sanitize overlay name: replace spaces with underscores, remove special characters
        const overlayMacroName = overlayName
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "");
        const overlayMacro = `\`\`\`${overlayActionIcon}${overlayMacroName}
api.getRecord('${record.recordType}', '${record._id}', (updatedRecord) => {
  if (!updatedRecord) {
    console.warn('Record not found');
    return;
  }
  const overlaySpell = api.getValueOnRecord(updatedRecord, '${overlayDataPath}');
  if (!overlaySpell) {
    console.warn('Overlay spell not found');
  }
  else {
    castSpell(updatedRecord, overlaySpell, '${overlayDataPath}', true);
  }
});
\`\`\``;
        overlayMacros.push(overlayMacro);
      });
    }
  }

  const message = `
  #### ${portrait}${spellName}${actionIcon ? "&nbsp;" : ""}${actionIcon}

  ---
  ${itemSpellCast?.lines.length ? `${itemSpellCast.lines.join("\n")}\n\n` : ""}${spellDescription}${isOverlay ? "" : getRitualCastText(spell)}
  ${macros && macros.length > 0 ? `${macros.join("\n")}\n` : ""}${isOverlay ? "" : applyCursebound(spell)}
  ${overlayMacros.length > 0 ? `\n---\n${overlayMacros.join("\n")}\n` : ""}
  `;

  // Send the message
  api.sendMessage(message, undefined, [], tags);

  // Update values (then a used-up scroll goes; item-spells.js)
  api.setValuesOnRecord(
    record,
    valuesToSet,
    itemSpellCast?.use?.bulk
      ? () => finishItemSpellCast(record, itemSpellCast.use)
      : undefined
  );

  // Stupefied, grabbed (manipulate) and deafened (auditory): the flat check
  // to cast, rolled now; a failure is reported (check-tools.js)
  if (!isOverlay) {
    rollCastingFlatChecks(getCastingCreature(record, ourToken), spell);
  }

  // Play animation only if not using attack macro (macro handles animation)
  if (animation && tokenId && !hasAttackMacro) {
    api.playAnimation(animation, tokenId, targetId);
  }
}
