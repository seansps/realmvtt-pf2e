// Basic saves applied per target: area spells and monster abilities roll
// damage once, and each target takes none, half, full or double by its own
// save (Player Core pg. 405, Basic Saving Throws).
//   - save.js keeps each save's result on the saver's token (data.lastSave),
//     whichever order the saves and the damage are rolled in;
//   - the damage card of a spell with a basic save, or of the damage button
//     of an ability whose save button is basic, has an Apply by Saves
//     button: for each selected creature it applies the damage by that
//     creature's last save and says what each took. Nothing stops the GM
//     applying it again (another damage part, or redoing it): a save is
//     never marked used, and there is no time limit, only the creature's
//     most recent save.
// Loaded as one of the ruleset's scripts (ruleset.config.json,
// otherSettings.scripts), so it shares common.js's scope at runtime.

const BASIC_SAVE_RESULTS = {
  2: { name: "critical success", label: "no damage", multiplier: 0 },
  1: { name: "success", label: "half damage", multiplier: 0.5 },
  0: { name: "failure", label: "full damage", multiplier: 1 },
  "-1": { name: "critical failure", label: "double damage", multiplier: 2 },
};

// The token a save is rolled for, for save.js to keep its result on: the
// token itself, or a character sheet's token. { id, recordType } or null.
function getSaverTokenRef(record) {
  if (!record?._id) return null;
  // A token (from the selection or the tracker) links to its record
  if (record.recordId) return { id: record._id, recordType: record.recordType };
  const token = typeof api?.getToken === "function" ? api.getToken() : null;
  if (token?._id && token.recordId === record._id) {
    return { id: token._id, recordType: token.recordType };
  }
  return null;
}

// The values that keep a save's result on the saver's token, or null
function getLastSaveValues(metadata, degree) {
  if (!metadata?.saverTokenId || !Number.isFinite(degree)) return null;
  return {
    "data.lastSave": {
      degree,
      saveType: metadata.saveType || "",
      dc: parseInt(metadata.dc, 10) || 0,
    },
  };
}

// The basic save a description's damage buttons are against: a spell's
// Basic box, or the description's save button with basic: true (the module
// converter writes rollSavingThrow('reflex', 28, { basic: true }) for
// Foundry's @Check[reflex|dc:28|basic], and undefined for the DC of one
// without a DC, like @Check[fortitude|against:spell|basic]). { saveType }
// or null; older imports without the flag have none.
function getDescriptionBasicSave(description, item) {
  const save = item?.data?.defense?.save;
  if (item?.recordType === "spells" && save?.statistic && (save.basic === true || save.basic === "true")) {
    return { saveType: String(save.statistic).toLowerCase() };
  }
  const match = String(description || "").match(
    /rollSavingThrow\(\s*\\?['"](fortitude|reflex|will)\\?['"]\s*,\s*(?:\d+|undefined)\s*,\s*\{[^}]*?\bbasic\\?['"]?\s*:\s*true/i,
  );
  return match ? { saveType: match[1].toLowerCase() } : null;
}

// The save card's line for a basic save, or ""
function getBasicSaveLine(metadata, degree) {
  if (!metadata?.basicSave || !Number.isFinite(degree)) return "";
  const result = BASIC_SAVE_RESULTS[degree];
  return result ? `**Basic save:** ${result.label}.` : "";
}

// A creature's most recent save, or null. No time limit and no save-type
// check: the GM decides which save applies, and the card says which it used.
function getLastSave(creature) {
  const save = creature?.data?.lastSave || creature?.record?.data?.lastSave;
  if (!save || !Number.isFinite(save.degree)) return null;
  return save;
}

// The damage card's Apply by Saves button. The roll's metadata.basicSave
// ({ saveType }) names the save.
function getApplyBySavesButton(roll) {
  const fence = "```";
  return `${fence}Apply_by_Saves\napplyDamageBySaves(${JSON.stringify(roll)});\n${fence}`;
}

// Applies damage to each selected creature by its last save. A creature
// that takes damage gets one card: its damage card, headed by one bold line
// ("Fireball: applied by Reflex failure, full damage"). Those that take none
// (a critical success, or no save to use) share one card, a line each.
function applyDamageBySaves(roll) {
  const saveType = roll?.metadata?.basicSave?.saveType || "";
  const creatures = (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t).filter(Boolean);
  if (creatures.length === 0) {
    api.showNotification("Select the creatures that saved, then click again.", "yellow", "Notice");
    return;
  }
  // The spell or ability by name (an ability's damage roll is only named
  // by its formula, "8d8 bludgeoning Damage")
  const source =
    roll?.metadata?.basicSave?.source || roll?.metadata?.attack || roll?.metadata?.rollName || "Damage";
  const lines = [];
  // An eidolon and its summoner on the same card take the greater amount
  // once (eidolons.js): one pool for the card, and all its creatures
  const pool = { sharedPools: {}, poolCreatures: creatures };
  creatures.forEach((creature) => {
    const name = getTokenDisplayName(creature);
    const save = getLastSave(creature);
    if (!save) {
      lines.push(`**${source}: not applied, no ${saveType ? `${capitalize(saveType)} ` : ""}save rolled** (${name})`);
      return;
    }
    const result = BASIC_SAVE_RESULTS[save.degree];
    // One bold line (Sean): "Fireball: applied by Reflex critical success,
    // no damage"
    const saveLine = `**${source}: applied by ${capitalize(save.saveType || "save")} ${result.name}, ${result.label}**`;
    const header = { header: saveLine, ...pool };
    if (result.multiplier === 0) {
      lines.push(`${saveLine} (${name})`);
    } else if (result.multiplier === 0.5) {
      applyDamage(creature, roll, true, null, false, header);
    } else if (result.multiplier === 1) {
      applyDamage(creature, roll, false, null, false, header);
    } else if (result.multiplier === 2) {
      applyDamage(
        creature,
        { ...roll, metadata: { ...(roll?.metadata || {}), critical: true } },
        false,
        null,
        false,
        { ...header, criticalLabel: "critical failure on a save" },
      );
    }
  });
  if (lines.length > 0) {
    api.sendMessage(lines.join("\n"));
  }
}
