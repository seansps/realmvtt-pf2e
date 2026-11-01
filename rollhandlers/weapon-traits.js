// Weapon traits, hands in use and firearm loading.
//
//   - Kickback: 1 more damage, and a -2 circumstance penalty to the attack
//     roll unless the wielder's Strength modifier is +2 or more (a stabilizer
//     can lower it: the penalty is a modifier the player can untick)
//   - Jousting: while mounted, after moving at least 10 feet on the action
//     before the attack, a circumstance bonus to damage equal to the number of
//     damage dice. Offered unticked in the damage roll
//   - Concussive: resistance and immunity use the weaker of the target's to
//     piercing or to bludgeoning (applyDamage)
//   - Parry: a button on the attack row for +1 circumstance bonus to AC
//     until the start of the next turn (the module's Parry effect)
//   - Versatile with any damage type (versatile fire, versatile vitality...):
//     a dropdown on the attack row. Versatile B, P and S keep their checkboxes
//   - Hands: equipped held items use hands (Foundry's handsHeld). The Actions
//     tab shows "Hands n/2"; holding more than 2 is a note, never a block.
//     Roll options hands-free:<n> (shields and free-hand weapons don't count)
//     and hands-free:but-really:<n> (they do), as Foundry's. The held
//     weapons: self:weapon:melee|ranged and self:weapon:hands-held:<n>
//     (getHeldWeaponAtoms)
//   - Capacity N and double barrel: the weapon holds N (or 2) loaded shots.
//     Each Reload loads one; each shot uses one. Firing both barrels of a
//     double barrel weapon uses two and steps the damage and fatal dice up
//   - Repeating: when a shot empties the magazine, the card notes that a new
//     one takes 3 Interact actions and a free hand

// ---------------------------------------------------------------- Strike modifiers

// Kickback and jousting, for a PC's Strike (an NPC's damage already has
// kickback's 1, as Foundry's)
function getWeaponTraitModifiers(record, weapon, { isNPCAttack = false, damageDice = 0 } = {}) {
  const result = { attack: [], damage: [] };
  if (!weapon || isNPCAttack) return result;
  const traits = getTraitNameList(weapon.data?.traits);
  if (traits.includes("kickback")) {
    const str = parseInt(record?.data?.str || "0", 10) || 0;
    result.attack.push({
      name: str >= 2 ? "Kickback (ignored: Strength +2)" : "Kickback",
      type: "circumstance",
      value: -2,
      isPenalty: true,
      active: str < 2,
    });
    result.damage.push({ name: "Kickback", type: "", value: 1, active: true });
  }
  if (getJoustingDie(weapon) && damageDice > 0) {
    result.damage.push({
      name: "Jousting (mounted, moved 10+ feet)",
      type: "circumstance",
      value: damageDice,
      active: false,
    });
  }
  return result;
}

// "Jousting-D6" -> "d6", or ""
function getJoustingDie(weapon) {
  const trait = getTraitNameList(weapon?.data?.traits).find((name) => /^jousting[\s-]*d\d+$/.test(name));
  return trait ? trait.match(/d\d+$/)[0] : "";
}

// ---------------------------------------------------------------- Concussive

// The type whose immunity and resistance apply to this damage: for
// concussive piercing or bludgeoning, the one the target is less protected
// against (immunity counts as the most)
function getConcussiveProtectionType(IWR, type, traits) {
  const lower = String(type || "").toLowerCase();
  if (lower !== "piercing" && lower !== "bludgeoning") return lower;
  if (!getTraitNameList(traits).includes("concussive")) return lower;
  const other = lower === "piercing" ? "bludgeoning" : "piercing";
  const protection = (damageType) =>
    IWR?.immunities?.[damageType] ? Infinity : parseInt(IWR?.resistances?.[damageType]?.value, 10) || 0;
  return protection(other) < protection(lower) ? other : lower;
}

// ---------------------------------------------------------------- Parry

function hasParryTrait(weapon) {
  return getTraitNameList(weapon?.data?.traits).includes("parry");
}

// The attack row's Parry button: the module's Parry effect on the wielder
function parryWithWeapon(record, weapon) {
  const token = api.getToken();
  if (!token || !weapon) return;
  api.addEffect("Parry", token);
  const category = (weapon.data?.itemCategory || "simple").toLowerCase();
  const trained = getProfiencyForWeapon(record, category, weapon.data?.group || "", weapon) >= 1;
  api.sendMessage(
    `**:one-action: Parry: ${weapon.name}**\n+1 circumstance bonus to AC until the start of your next turn.${
      trained ? "" : "\n\n[gm]Parry needs trained proficiency with the weapon.[/gm]"
    }`,
    undefined,
    [],
    [],
    token,
  );
}

// ---------------------------------------------------------------- Versatile

const VERSATILE_LETTERS = { b: "bludgeoning", p: "piercing", s: "slashing" };

// The damage types a versatile trait adds: "Versatile-S" -> slashing,
// "Versatile-Fire" -> fire
function getVersatileTypes(weapon) {
  return getTraitNameList(weapon?.data?.traits)
    .map((name) => name.match(/^versatile[\s-]+([a-z]+)$/))
    .filter(Boolean)
    .map((match) => VERSATILE_LETTERS[match[1]] || match[1]);
}

// A versatile type other than bludgeoning, piercing or slashing: the
// dropdown replaces the checkboxes
function hasOtherVersatileType(weapon) {
  return getVersatileTypes(weapon).some((type) => !Object.values(VERSATILE_LETTERS).includes(type));
}

function getVersatileOptions(weapon) {
  const base = String(weapon?.data?.damage?.damageType || "").toLowerCase();
  const types = [...new Set([base, ...getVersatileTypes(weapon)].filter(Boolean))];
  return types.map((type) => ({ label: type.charAt(0).toUpperCase() + type.slice(1), value: type }));
}

// The dropdown's choice, if it's one of the weapon's types
function getVersatileDamageType(weapon) {
  if (!hasOtherVersatileType(weapon)) return "";
  const chosen = String(weapon?.data?.versatileType || "").toLowerCase();
  return getVersatileOptions(weapon).some((option) => option.value === chosen) ? chosen : "";
}

// ---------------------------------------------------------------- Hands

// The hands an equipped weapon or shield is held in: 2 for two hands (or a
// 1+ weapon held in two), 1 for one, 0 when worn, carried, unarmed or a bomb
function getHandsHeld(item) {
  if (item?.data?.carried !== "equipped") return 0;
  // Only weapons and shields: on other gear (ammunition, a torch, a toolkit)
  // Equipped means ready on the character, not in hand
  if (!["weapon", "shield"].includes(item.data?.type)) return 0;
  // Ammunition is never held, whatever its type or usage says
  if (String(item.data?.itemCategory || "").toLowerCase() === "ammo") return 0;
  if (String(item.data?.itemCategory || "").toLowerCase() === "unarmed") return 0;
  // A stack of bombs is carried ready, not held
  if (String(item.data?.group || "").toLowerCase() === "bomb") return 0;
  // Worn weapons (handwraps, a gauntlet bow) take no hand
  const usage = String(item.data?.usage || "").toLowerCase();
  if (usage && !usage.startsWith("held-in")) return 0;
  if (usage.includes("two-hands")) return 2;
  return item.data?.handBtn === "two" ? 2 : 1;
}

// Hands in use: held (every held item) and the free count for roll options
// (shields and free-hand weapons don't take one, as Foundry's). changes:
// { [itemId]: { carried, handBtn } } not written yet
function getHandsInUse(record, changes = {}) {
  let held = 0;
  let counted = 0;
  (record?.data?.inventory || []).forEach((item) => {
    const change = changes[item?._id];
    const current = change ? { ...item, data: { ...item.data, ...change } } : item;
    const hands = getHandsHeld(current);
    if (!hands) return;
    held += hands;
    if (current.data?.type !== "shield" && !getTraitNameList(current.data?.traits).includes("free-hand")) {
      counted += hands;
    }
  });
  return { held, free: Math.max(0, 2 - counted), reallyFree: Math.max(0, 2 - held) };
}

function getHandsFreeAtoms(record) {
  if (record?.recordType !== "characters") return [];
  const hands = getHandsInUse(record);
  return [`hands-free:${hands.free}`, `hands-free:but-really:${hands.reallyFree}`];
}

// The weapons a character holds, as Foundry's self:weapon roll options:
// self:weapon:melee or self:weapon:ranged, and self:weapon:hands-held:<n>,
// for each held weapon (Inexorable Iron: a melee weapon in two hands).
// Unarmed attacks, shields and worn weapons aren't held (getHandsHeld).
function getHeldWeaponAtoms(record) {
  if (record?.recordType !== "characters") return [];
  const atoms = new Set();
  (record?.data?.inventory || []).forEach((item) => {
    if (item?.data?.type !== "weapon") return;
    const hands = getHandsHeld(item);
    if (!hands) return;
    const ranged = (parseInt(item.data.range, 10) || 0) > 0;
    atoms.add(ranged ? "self:weapon:ranged" : "self:weapon:melee");
    atoms.add(`self:weapon:hands-held:${hands}`);
  });
  return [...atoms];
}

// The Actions tab's label, shown only past 2 hands; written only when it
// changes
function getHandsValues(record, changes = {}) {
  if (record?.recordType !== "characters") return {};
  const { held } = getHandsInUse(record, changes);
  const hidden = held <= 2;
  const label = `Hands ${held}/2`;
  const values = {};
  if (!hidden && record.data?.handsLabel !== label) values["data.handsLabel"] = label;
  if ((record.fields?.handsLabel?.hidden ?? true) !== hidden) values["fields.handsLabel.hidden"] = hidden;
  return values;
}

// After equipping or drawing: a note when more than 2 hands are in use
function noteHandsInUse(record, changes = {}) {
  const { held } = getHandsInUse(record, changes);
  if (held > 2) {
    api.showNotification(`${held} hands in use: a creature normally has 2.`, "yellow", "Hands");
  }
}

// ---------------------------------------------------------------- Loading

// How many loads the weapon holds, as Foundry's ammo.capacity: 1 for a
// weapon fed by a magazine (repeating, or ammo with uses: a magazine, or in
// Starfinder a battery or chem tank, whose rounds are its uses), else
// capacity N, 2 for double barrel, else 1. The one place that says it.
function getLoadCapacity(weapon) {
  const traits = getTraitNameList(weapon?.data?.traits);
  if (traits.includes("repeating") || (parseInt(weapon?.data?.uses?.max, 10) || 0) > 1) return 1;
  const capacity = traits.map((name) => name.match(/^capacity[\s-]*(\d+)$/)).find(Boolean);
  if (capacity) return parseInt(capacity[1], 10) || 1;
  return hasDoubleBarrelTrait(weapon) ? 2 : 1;
}

function hasDoubleBarrelTrait(weapon) {
  const traits = getTraitNameList(weapon?.data?.traits);
  return traits.includes("double-barrel") || traits.includes("double barrel");
}

function getLoadedCount(weapon) {
  const capacity = getLoadCapacity(weapon);
  const count = weapon?.data?.loadedCount;
  // One shot when loaded, as before (and for a capacity weapon not counted yet)
  if (capacity <= 1 || count === undefined || count === null || count === "") {
    return weapon?.data?.loadedAmmo ? 1 : 0;
  }
  return Math.min(capacity, Math.max(0, parseInt(weapon?.data?.loadedCount, 10) || 0));
}

// Firing both barrels of a double barrel weapon (its toggle)
function isFiringBothBarrels(weapon) {
  return hasDoubleBarrelTrait(weapon) && weapon?.data?.doubleBarrel === true;
}

const DIE_STEPS = ["d4", "d6", "d8", "d10", "d12"];

// One die size up (d12 stays d12)
function stepUpDie(die) {
  const index = DIE_STEPS.indexOf(String(die || "").toLowerCase());
  return index < 0 ? die : DIE_STEPS[Math.min(index + 1, DIE_STEPS.length - 1)];
}

// The Reload button: one more shot loaded, up to the capacity. Returns the
// values to write and the chat line, or null when it's full
function getReloadValues(weapon, weaponDataPath) {
  const capacity = getLoadCapacity(weapon);
  if (capacity <= 1) {
    return { values: { [`${weaponDataPath}.data.loadedAmmo`]: true }, message: `Reloading ${weapon.name}` };
  }
  const loaded = getLoadedCount(weapon);
  if (loaded >= capacity) return null;
  return {
    values: {
      [`${weaponDataPath}.data.loadedCount`]: loaded + 1,
      [`${weaponDataPath}.data.loadedMax`]: capacity,
      [`${weaponDataPath}.data.loadedAmmo`]: true,
    },
    message: `Reloading ${weapon.name} (${loaded + 1}/${capacity} loaded)`,
  };
}

function reloadWeapon(weapon, weaponDataPath) {
  if (!weapon) return;
  const reload = getReloadValues(weapon, weaponDataPath);
  if (!reload) {
    api.showNotification(`${weapon.name} is fully loaded.`, "yellow", "Reload");
    return;
  }
  api.setValues(reload.values);
  api.sendMessage(`**[center]${reload.message}[/center]**`);
}

// After a shot from a capacity or double barrel weapon: the loaded shots
// left, and the card's note
function getShotValues(weapon, weaponDataPath, shots) {
  const capacity = getLoadCapacity(weapon);
  if (capacity <= 1) return { values: {}, note: "" };
  const left = Math.max(0, getLoadedCount(weapon) - shots);
  return {
    values: {
      [`${weaponDataPath}.data.loadedCount`]: left,
      [`${weaponDataPath}.data.loadedMax`]: capacity,
      [`${weaponDataPath}.data.loadedAmmo`]: left > 0,
    },
    note:
      left > 0 && getTraitNameList(weapon.data?.traits).some((name) => name.startsWith("capacity"))
        ? `${left}/${capacity} loaded: selecting the next loaded barrel is an Interact action (no free hand needed).`
        : `${left}/${capacity} loaded.`,
  };
}

// A repeating weapon whose shot used up its magazine
function getMagazineNote(weapon, usedUpMagazine) {
  if (!usedUpMagazine || !getTraitNameList(weapon?.data?.traits).includes("repeating")) return "";
  return "The magazine is empty: loading a new one takes a free hand and 3 Interact actions (remove, retrieve, slot).";
}
