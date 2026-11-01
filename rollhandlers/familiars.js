// Familiars (Player Core pg. 212-215, roadmap H15), following Foundry PF2e's
// familiar abilities and its system.attributes.familiarAbilities rules. A
// familiar is an NPC of type familiar; its master is picked on its sheet (or
// the familiar on the master's Notes tab), and the two link each other.
//
//   - Sync with the master (getFamiliarSyncValues): level, 5 HP per level
//     plus hitpoints and hitPointsBonus modifiers (Tough's "2 * @actor.level"
//     at the new level), AC, saves, Perception and skills, as before
//   - Speeds from the abilities: Amphibious (swim, land and swim each the
//     higher), Burrower (burrow 5), Climber (climb 25), Flier (fly 25) and
//     Fast Movement (one Speed to 40, picked when it's added)
//   - The daily allowance of familiar and master abilities, from the master's
//     feats and class features (getFamiliarAbilityAllowance). A typed number
//     overrides it. Picking more than that shows a note; nothing is refused
//   - Familiar Focus: a button on the familiar gives its master 1 Focus Point
//   - Removing an ability (the action row's remove button) rewrites the
//     Speeds and the Familiar Focus button from the abilities left
//   - The master's level up resyncs the familiar, and Rest says the abilities
//     can be picked again (and the Spell Battery slot)

// Abilities that give a Speed, by name: the Speed and its feet
const FAMILIAR_SPEED_ABILITIES = {
  amphibious: { type: "swim", value: 25 },
  burrower: { type: "burrow", value: 5 },
  climber: { type: "climb", value: 25 },
  flier: { type: "fly", value: 25 },
};
const FAMILIAR_LAND_SPEED = 25;
const FAST_MOVEMENT_SPEED = 40;

// Feats that set the number of abilities (the highest counts), as Foundry's
// "upgrade" rules: Pet and the Familiar feat 2, Familiar Master Dedication 2,
// Basic Witchcraft 3, Enhanced Familiar 4, Incredible Familiar 6. A
// necromancer's undead familiar and a runesmith's glyph familiar start with
// fewer (Impossible Magic pg. 32-34, 48): Undead Familiar 1, Enhanced Undead
// Familiar 3, Glyph Familiar 1, Enhanced Glyph Familiar 2.
const FAMILIAR_ABILITY_BASES = {
  pet: 2,
  familiar: 2,
  "familiar master dedication": 2,
  "basic witchcraft": 3,
  "enhanced familiar": 4,
  "incredible familiar": 6,
  "incredible familiar (familiar master)": 6,
  "undead familiar": 1,
  "enhanced undead familiar": 3,
  "glyph familiar": 1,
  "enhanced glyph familiar": 2,
};

// Abilities a master's feat gives the familiar on top of its daily picks, by
// feat: a glyph familiar "always has three additional familiar abilities:
// construct, flier, and tough" (Impossible Magic pg. 48). Undead Familiar
// gives none. They don't count against the allowance.
const FAMILIAR_FREE_ABILITIES = {
  "glyph familiar": ["construct", "flier", "tough"],
};

const familiarName = (entry) => String(entry?.name || "").trim().toLowerCase();

// The familiar's familiar and master abilities (the ones its picker adds)
function getFamiliarAbilities(familiar) {
  return (familiar?.data?.actions || []).filter((action) => action?.data?.actionCategory === "familiar");
}

// A familiar ability's row shows its remove button (npc-actions-list.html);
// other NPCs' actions keep the list's own delete. Unchanged when it shows.
function showFamiliarRemoveButton(action) {
  if (action?.data?.actionCategory !== "familiar" || action?.fields?.removeBtn?.hidden === false) return action;
  return { ...action, fields: { ...(action.fields || {}), removeBtn: { hidden: false } } };
}

function hasFamiliarAbility(familiar, name) {
  return getFamiliarAbilities(familiar).some((ability) => familiarName(ability) === name);
}

// The names of a character's feats and the class features it has at its
// level, lowercase
function getMasterFeatNames(master) {
  const level = parseInt(master?.data?.level, 10) || 0;
  const feats = [...(master?.data?.feats || []), ...(master?.data?.bonusFeats || [])].filter(
    (feat) => feat?.data?.type !== "slot",
  );
  const features = [...(master?.data?.features || [])];
  for (const source of [...(master?.data?.ancestries || []), ...(master?.data?.heritages || [])]) {
    features.push(...(source?.data?.features || []));
  }
  for (const classObj of master?.data?.classes || []) {
    features.push(...(classObj?.data?.features || []).filter((feature) => (parseInt(feature?.data?.level, 10) || 0) <= level));
  }
  return [...feats, ...features].map(familiarName).filter(Boolean);
}

// The familiar and master abilities a master's familiar can have each day
// (Player Core pg. 212): 2, or the highest a feat sets (Enhanced Familiar 4,
// Incredible Familiar 6), plus a witch's extra ones (2, and 1 more at 6th,
// 12th and 18th) and Improved Familiar Attunement's (1, and 1 more at 6th,
// 12th and 18th). A feat that sets fewer than 2 (Undead Familiar, Glyph
// Familiar) replaces the 2, so the highest feat counts alone. Returns
// { value, sources }.
function getFamiliarAbilityAllowance(master) {
  const names = getMasterFeatNames(master);
  const level = parseInt(master?.data?.level, 10) || 0;
  let value = names.some((name) => FAMILIAR_ABILITY_BASES[name] < 2) ? 0 : 2;
  const sources = [];
  for (const name of names) {
    const base = FAMILIAR_ABILITY_BASES[name];
    if (base > value) {
      value = base;
      sources.length = 0;
      sources.push(`${name.replace(/\b\w/g, (c) => c.toUpperCase())} ${base}`);
    }
  }
  const extraEvery6 = 1 + Math.min(3, Math.floor(level / 6));
  if (names.includes("familiar (witch)")) {
    value += 1 + extraEvery6;
    sources.push(`Witch +${1 + extraEvery6}`);
  }
  if (names.includes("improved familiar attunement")) {
    value += extraEvery6;
    sources.push(`Improved Familiar Attunement +${extraEvery6}`);
  }
  return { value, sources };
}

// The allowance the familiar's sheet shows: a typed override, or the master's
function getFamiliarAbilityLimit(familiar, master) {
  const override = parseInt(familiar?.data?.numAbilitiesOverride, 10);
  if (override >= 0) return override;
  return master ? getFamiliarAbilityAllowance(master).value : parseInt(familiar?.data?.numAbilities, 10) || 0;
}

// The abilities a master's feats give their familiar for free, lowercase
function getFreeFamiliarAbilityNames(master) {
  return [...new Set(getMasterFeatNames(master).flatMap((name) => FAMILIAR_FREE_ABILITIES[name] || []))];
}

// The familiar's abilities that count against the allowance: all of them but
// one of each its master's feats give for free (none without the master)
function getCountedFamiliarAbilities(familiar, master) {
  const free = new Set(master ? getFreeFamiliarAbilityNames(master) : []);
  return getFamiliarAbilities(familiar).filter((ability) => !free.delete(familiarName(ability)));
}

// A note when the familiar has more abilities than it can have, or "". With
// the master, the abilities their feats give for free aren't counted.
function getFamiliarAbilityExcessNote(familiar, limit, master = null) {
  const count = getCountedFamiliarAbilities(familiar, master).length;
  if (!(limit > 0) || count <= limit) return "";
  const freeCount = getFamiliarAbilities(familiar).length - count;
  const freeText = freeCount > 0 ? ` (not counting the ${freeCount} its master's feats give)` : "";
  return `${familiar?.name || "The familiar"} has ${count} familiar and master abilities${freeText}; its master can pick ${limit} a day.`;
}

// The picker's note (npcs-main.html): reads the master, when there is one, so
// the abilities their feats give aren't counted
function notifyFamiliarAbilityExcess(familiar) {
  const notify = (master) => {
    const note = getFamiliarAbilityExcessNote(familiar, getFamiliarAbilityLimit(familiar, null), master);
    if (note) api.showNotification(note, "yellow", "Familiar Abilities");
  };
  const masterId = getRecordIdFromValue(familiar?.data?.master);
  if (!masterId) return notify(null);
  api.getRecord("characters", masterId, (master) => notify(master || null));
}

// The Speeds the familiar's abilities give: { land, other: { swim: 25 } }.
// Fast Movement raises the Speed stored on it (data.fastMovementSpeed,
// default land) to 40; Amphibious makes land and swim each the higher.
function getFamiliarAbilitySpeeds(familiar) {
  let land = FAMILIAR_LAND_SPEED;
  const other = {};
  for (const ability of getFamiliarAbilities(familiar)) {
    const speed = FAMILIAR_SPEED_ABILITIES[familiarName(ability)];
    if (speed) other[speed.type] = Math.max(other[speed.type] || 0, speed.value);
  }
  const fast = getFamiliarAbilities(familiar).find((ability) => familiarName(ability) === "fast movement");
  if (fast) {
    const type = fast.data?.fastMovementSpeed || "land";
    if (type === "land" || !other[type]) land = FAST_MOVEMENT_SPEED;
    else other[type] = Math.max(other[type], FAST_MOVEMENT_SPEED);
  }
  if (hasFamiliarAbility(familiar, "amphibious")) {
    const higher = Math.max(land, other.swim || 0);
    land = higher;
    other.swim = higher;
  }
  return { land, other };
}

// The Speeds Fast Movement can raise, for its prompt: land and each other
// Speed the familiar's abilities give
function getFastMovementChoices(familiar) {
  const choices = ["land", ...Object.keys(getFamiliarAbilitySpeeds(familiar).other)];
  return [...new Set(choices)];
}

// The familiar's speed values: the land Speed, and a row for each Speed an
// ability gives (rows it made before are replaced; rows typed by hand stay,
// unless an ability gives that Speed)
function getFamiliarSpeedValues(familiar) {
  const { land, other } = getFamiliarAbilitySpeeds(familiar);
  const kept = (familiar?.data?.speeds || []).filter(
    (row) => !row?.data?.fromFamiliarAbility && !other[String(row?.data?.type || "").toLowerCase()],
  );
  const rows = Object.entries(other).map(([type, value]) => ({
    _id: generateUuid(),
    name: "Speed",
    unidentifiedName: "Speed",
    identified: true,
    data: { type, value, fromFamiliarAbility: true },
  }));
  return { "data.speed.value": land, "data.speeds": [...kept, ...rows] };
}

// The familiar's max HP at a level: 5 per level, plus its hitpoints and
// hitPointsBonus modifiers worked out at that level (Tough)
function getFamiliarHitPoints(familiar, level) {
  const atLevel = { ...familiar, data: { ...(familiar?.data || {}), level } };
  const bonus = getEffectsAndModifiersForToken(atLevel, ["hitpoints", "hitPointsBonus"]).reduce((total, mod) => {
    if (mod.active === false) return total;
    return total + (parseInt(mod.value || 0, 10) || 0);
  }, 0);
  return Math.max(5 * level + bonus, 1);
}

// The record link the familiar keeps for its master, and the master for its
// familiar
function getFamiliarLink(record) {
  return JSON.stringify({ _id: record?._id, name: record?.name, recordType: record?.recordType });
}

// Everything the familiar takes from its master, in one set of values
// (Player Core pg. 212): level, HP, AC, saves, Perception, Acrobatics and
// Stealth (3 + level, or the master's spellcasting attribute + level), other
// skills (level), Speeds and the ability allowance
function getFamiliarSyncValues(familiar, master) {
  const values = {};
  const level = parseInt(master?.data?.level || "0", 10) || 0;
  values["data.level"] = level;

  const hitpoints = getFamiliarHitPoints(familiar, level);
  values["data.hitpoints"] = hitpoints;
  if (!familiar?.data?.curhp || familiar.data.curhp > hitpoints) {
    values["data.curhp"] = hitpoints;
  }

  // AC and saves: the master's, before circumstance and status bonuses
  values["data.ac"] = parseInt(master?.data?.ac || "10", 10);
  values["data.fortitudeMod"] = parseInt(master?.data?.fortitudeMod || "0", 10);
  values["data.reflexMod"] = parseInt(master?.data?.reflexMod || "0", 10);
  values["data.willMod"] = parseInt(master?.data?.willMod || "0", 10);

  const masterAttribute = familiar?.data?.masterAttribute || "none";
  const spellcastingMod = masterAttribute !== "none" ? parseInt(master?.data?.[masterAttribute] || "0", 10) || 0 : 0;
  const specialSkillMod = Math.max(3 + level, spellcastingMod + level);
  values["data.perceptionMod"] = specialSkillMod;
  values["data.initiativeMod"] = specialSkillMod;

  const defaultSkills = [
    "Acrobatics", "Arcana", "Athletics", "Crafting", "Deception", "Diplomacy", "Intimidation", "Medicine",
    "Nature", "Occultism", "Performance", "Religion", "Society", "Stealth", "Survival", "Thievery",
  ];
  const isSpecial = (name) => ["acrobatics", "stealth"].includes(String(name || "").toLowerCase());
  const withMod = (name, mod) => `${name} ${mod >= 0 ? `+${mod}` : mod}`;
  const skills = (familiar?.data?.skills || []).map((skill) => {
    const mod = isSpecial(skill.name) ? specialSkillMod : level;
    return { ...skill, data: { ...skill.data, mod, skillWithMod: withMod(skill.name, mod) } };
  });
  const existing = skills.map((skill) => String(skill.name || "").toLowerCase());
  for (const name of defaultSkills) {
    if (existing.includes(name.toLowerCase())) continue;
    const mod = isSpecial(name) ? specialSkillMod : level;
    skills.push({
      _id: generateUuid(),
      name,
      unidentifiedName: name,
      identified: true,
      data: { mod, skillWithMod: withMod(name, mod), rollTooltip: `Roll ${name} Check`, note: "" },
    });
  }
  values["data.skills"] = skills;

  Object.assign(values, getFamiliarSpeedValues(familiar));
  values["data.numAbilities"] = getFamiliarAbilityLimit(familiar, master);
  values["fields.familiarFocusBtn.hidden"] = !hasFamiliarAbility(familiar, "familiar focus");
  // Abilities picked before the remove button existed show it now
  const actions = familiar?.data?.actions || [];
  const shown = actions.map(showFamiliarRemoveButton);
  if (shown.some((action, i) => action !== actions[i])) values["data.actions"] = shown;
  return values;
}

// Reads the master and writes the sync in one write, with the familiar's
// link to the master when it isn't that yet (the master's Notes tab picked
// it), then links the master back the same way. callback(updatedFamiliar).
function syncFamiliarWithMaster(familiar, masterId, callback) {
  const done = (updated) => {
    if (callback) callback(updated);
  };
  if (!familiar || !masterId) return done(familiar);
  api.getRecord("characters", masterId, (master) => {
    if (!master) return done(familiar);
    const values = getFamiliarSyncValues(familiar, master);
    if (getRecordIdFromValue(familiar.data?.master) !== master._id) {
      values["data.master"] = getFamiliarLink(master);
    }
    api.setValuesOnRecord(familiar, values, (updated) => {
      if (getRecordIdFromValue(master.data?.familiar) !== familiar._id) {
        api.setValuesOnRecord(master, { "data.familiar": getFamiliarLink(familiar) });
      }
      const note = getFamiliarAbilityExcessNote(familiar, values["data.numAbilities"], master);
      if (note) api.showNotification(note, "yellow", "Familiar Abilities");
      done(updated);
    });
  });
}

// The master's level up (or its Notes tab's Familiar field): the familiar
// takes the master's new values
function resyncFamiliarOf(master, familiarId = getRecordIdFromValue(master?.data?.familiar), callback) {
  if (!familiarId) {
    if (callback) callback(null);
    return;
  }
  api.getRecord("npcs", familiarId, (familiar) => {
    if (!familiar || familiar.data?.type !== "familiar") {
      if (callback) callback(null);
      return;
    }
    syncFamiliarWithMaster(familiar, master._id, callback);
  });
}

// The familiar's Total # of Familiar Abilities was typed: a number other than
// the master's allowance overrides it; typing the allowance clears that
function onFamiliarAbilityLimitChange(familiar, value, callback) {
  const typed = parseInt(value, 10);
  const masterId = getRecordIdFromValue(familiar?.data?.master);
  const write = (computed) => {
    const override = isNaN(typed) || typed === computed ? null : typed;
    const values = { "data.numAbilitiesOverride": override };
    // A typed number is already saved by the field; a cleared one goes back
    // to the computed allowance
    if (isNaN(typed) && computed !== null) values["data.numAbilities"] = computed;
    api.setValuesOnRecord(familiar, values, callback);
  };
  if (!masterId) return write(null);
  api.getRecord("characters", masterId, (master) => write(master ? getFamiliarAbilityAllowance(master).value : null));
}

// Rest's note for a master with a familiar: the abilities can be picked
// again, and Spell Battery's extra slot
function getFamiliarRestNote(master, familiar) {
  if (!familiar) return "";
  const limit = getFamiliarAbilityLimit(familiar, master);
  let note = ` ${familiar.name || "The familiar"}'s ${limit} familiar and master abilities can be picked again (its sheet's Abilities).`;
  if (hasFamiliarAbility(familiar, "spell battery")) {
    note += " Spell Battery: one extra spell slot at least 3 ranks below your highest.";
  }
  return note;
}

// Removing an NPC action (the row's remove button; a list row's delete has no
// hook). On a familiar, the Speeds and the Familiar Focus button follow the
// abilities left, in the same write
function getActionRemovalValues(npc, actionId) {
  const actions = [...(npc?.data?.actions || [])];
  const index = actions.findIndex((action) => action?._id === actionId);
  if (index < 0) return null;
  actions.splice(index, 1);
  const values = { "data.actions": actions };
  if (npc?.data?.type !== "familiar") return values;
  const remaining = { ...npc, data: { ...npc.data, actions } };
  return {
    ...values,
    ...getFamiliarSpeedValues(remaining),
    "fields.familiarFocusBtn.hidden": !hasFamiliarAbility(remaining, "familiar focus"),
  };
}

// Reads the NPC fresh, so a row removed by an earlier click isn't written back
function removeNpcAction(npc, actionId, callback) {
  api.getRecord(npc?.recordType || "npcs", npc?._id, (fresh) => {
    const values = fresh ? getActionRemovalValues(fresh, actionId) : null;
    if (!values) return;
    api.setValuesOnRecord(fresh, values, callback);
  });
}

// Familiar Focus (once per day, 2 actions): the master gets 1 Focus Point
// back, up to their maximum (spell-entries.js)
function useFamiliarFocus(familiar) {
  const masterId = getRecordIdFromValue(familiar?.data?.master);
  if (!masterId) {
    api.showNotification("Pick the familiar's master first.", "yellow", "Familiar Focus");
    return;
  }
  api.getRecord("characters", masterId, (master) => {
    if (!master) return;
    const spent = getFocusPointsSpent(master);
    const who = master.name || "The master";
    if (spent <= 0) {
      api.sendMessage(`**Familiar Focus**\n${who}'s focus pool is already full.`, undefined, [], []);
      return;
    }
    api.setValuesOnRecord(master, getFocusPoolValues(master, spent - 1), () => {
      api.sendMessage(`**Familiar Focus**\n${familiar.name || "The familiar"} restores 1 Focus Point to ${who}.`, undefined, [], []);
    });
  });
}
