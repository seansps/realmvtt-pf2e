// Inventory tools: effects on Use, selling, investiture, handwraps of mighty
// blows and Bulk limits.
//
//   - Effects on Use: a consumable's linked effects (the module's "Effect:
//     Bestial Mutagen (Lesser)" record links in its description, and the
//     item's own useEffects) get Apply buttons on its Use card, as an action's
//     effects do (useInventoryItem)
//   - Selling (Player Core): an item sells for half its Price, treasure (gems,
//     art objects, raw materials) for its full Price (sellInventoryItem)
//   - Investiture (Player Core): up to 10 invested items. The sheet shows the
//     count, and the 11th or a Use while uninvested gets a warning; nothing
//     is blocked
//   - Handwraps of mighty blows: their runes apply to every unarmed attack
//     while they're worn and invested, as in Foundry (getAlteredWeapon,
//     getEffectsAndModifiersForToken)
//   - Bulk (Player Core): encumbered above 5 + Str, and no more than 10 + Str;
//     fractions of Bulk are dropped (updateTotalBulk)

// ---------------------------------------------------------------- Effects on Use

// The effects a description links to (<record-link> to an effects record),
// as the JSON getEffectMacrosFor reads
function getItemEffectLinks(description = "") {
  const effects = [];
  const pattern = /recordlink="([^"]*)"/g;
  let match;
  while ((match = pattern.exec(`${description}`)) !== null) {
    try {
      const link = JSON.parse(
        match[1]
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&"),
      );
      const value = link?.value || {};
      const isEffect = link?.type === "effects" || value.recordType === "effects";
      if (isEffect && value._id) {
        effects.push(JSON.stringify({ _id: value._id, name: value.name || link.tooltip || "" }));
      }
    } catch (e) {
      // Not a record link we can read
    }
  }
  return effects;
}

// An item's effects on Use: its own (useEffects), then the ones its
// description links to, each once
function getItemUseEffects(item) {
  const seen = new Set();
  return [...(item?.data?.useEffects || []), ...getItemEffectLinks(item?.data?.description)].filter(
    (effectJson) => {
      let id = "";
      try {
        id = JSON.parse(effectJson)?._id || "";
      } catch (e) {
        return false;
      }
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    },
  );
}

// ---------------------------------------------------------------- Investiture

const INVESTMENT_LIMIT = 10;

// Whether a character must invest the item for it to work: the invested
// trait, or armor with runes (as getEffectsAndModifiersForToken reads it)
function itemRequiresInvestment(item) {
  const runes = item?.data?.runes || {};
  if (
    item?.data?.type === "armor" &&
    ((runes.property || []).length > 0 || !!runes.potency || !!runes.resilient)
  ) {
    return true;
  }
  return itemHasTrait(item, "invested");
}

// How many items the character has invested (magical tattoos and grafts
// have the invested trait too). overrides: { [itemId]: "true" | "false" }
// for a change not written yet.
function getInvestedCount(record, overrides = {}) {
  return (record?.data?.inventory || []).filter((item) => {
    if (!itemRequiresInvestment(item)) return false;
    const invested = overrides[item._id] ?? item.data?.invested;
    return invested === "true";
  }).length;
}

// A warning when investing an item goes over the limit, or ""
function getInvestmentWarning(record, item, invested) {
  if (invested !== "true" || !item) return "";
  const count = getInvestedCount(record, { [item._id]: "true" });
  if (count <= INVESTMENT_LIMIT) return "";
  return `${item.name || "This item"} is invested item ${count}. A character can invest only ${INVESTMENT_LIMIT} items; past that, investing one has no effect.`;
}

// A warning when using an item that needs investing and isn't, or ""
function getUninvestedUseWarning(item) {
  if (!item || !itemRequiresInvestment(item) || item.data?.invested === "true") return "";
  return `${item.name || "This item"} isn't invested, so its magic doesn't work until you invest it.`;
}

// ---------------------------------------------------------------- Selling

// What one unit sells for, in copper: half its Price, or its full Price for
// treasure. The Price is for a bundle (arrows come in 10s).
function getSellValueCp(item) {
  const unitCp = getItemPriceCp(item) / getItemBundleSize(item);
  const isTreasure = item?.data?.type === "treasure";
  return isTreasure ? unitCp : unitCp / 2;
}

// What selling `count` of the item brings, in cp: the total is rounded down,
// not each unit (10 arrows at 1 sp for 10 sell for 5 cp)
function getSellTotalCp(item, count) {
  return Math.floor(getSellValueCp(item) * count + 1e-9);
}

// The campaign setting "Allow Selling from the Sheet" (off by default): many
// GMs run selling through a merchant or downtime
function isSellingAllowed() {
  const value = typeof api?.getSetting === "function" ? api.getSetting("sellFromSheet") : null;
  return value === "yes";
}

// The rows' Sell buttons shown or hidden to match the setting: only the
// fields that differ, for the Inventory tab's one write when it loads
function getSellButtonValues(record) {
  const hidden = !isSellingAllowed();
  const valuesToSet = {};
  (record?.data?.inventory || []).forEach((item, index) => {
    if (item?.fields?.sellBtn?.hidden !== hidden) {
      valuesToSet[`data.inventory.${index}.fields.sellBtn.hidden`] = hidden;
    }
  });
  return valuesToSet;
}

// Why an item usually can't be sold (Player Core: shoddy items; temporary
// and infused items don't last), or ""
function getSellNote(item) {
  if (itemHasTrait(item, "shoddy") || /\bshoddy\b/i.test(item?.name || "")) {
    return "Shoddy items usually can't be sold.";
  }
  if (itemHasTrait(item, "temporary") || itemHasTrait(item, "infused")) {
    return "Temporary and infused items usually can't be sold.";
  }
  return "";
}

// The coin and count changes for selling `count` of the item at index, and
// whether the row goes
function getSellValues(record, index, count) {
  const item = record?.data?.inventory?.[index];
  const have = parseFloat(item?.data?.count || "0") || 0;
  const sold = Math.max(0, Math.min(have, count));
  const totalCp = getSellTotalCp(item, sold);
  const valuesToSet = getCoinRefund(record, totalCp);
  const removeRow = sold >= have;
  if (!removeRow) {
    valuesToSet[`data.inventory.${index}.data.count`] = have - sold;
  }
  return { valuesToSet, removeRow, sold, totalCp };
}

// Sells an inventory item from the sheet: asks how many and confirms the
// price, adds the coins, and takes the item off (or lowers its count)
function sellInventoryItem(itemDataPath) {
  if (!isSellingAllowed()) return;
  const index = parseInt(`${itemDataPath}`.split(".").pop(), 10);
  const item = record?.data?.inventory?.[index];
  if (!item) return;
  const have = parseFloat(item.data?.count || "0") || 0;
  if (have <= 0) return;
  const confirmSale = (count) => {
    const rule = item.data?.type === "treasure" ? "full Price (treasure)" : "half Price";
    const note = getSellNote(item);
    api.showConfirm(
      `Sell ${item.name}`,
      `Sell ${count > 1 ? `${count} ` : ""}${item.name} for ${formatCp(getSellTotalCp(item, count))} (${rule})?${note ? `\n\n${note}` : ""}`,
      "Sell",
      "Cancel",
      () => finishSale(item._id, count),
    );
  };
  if (have > 1) {
    api.showPrompt(
      `Sell ${item.name}`,
      `You have ${have}. How many do you sell?`,
      "Select...",
      [
        { label: "1", value: "1" },
        { label: `All ${have}`, value: `${have}` },
      ],
      null,
      (choice) => {
        const value = parseInt(Array.isArray(choice) ? choice[0] : choice, 10);
        if (value > 0) confirmSale(value);
      },
      "OK",
      "Cancel",
      1,
    );
  } else {
    confirmSale(1);
  }
}

// Reads the record again, then writes the sale: coins and count in one
// write, then the row removed by its id, then bulk and the character's
// numbers worked out again
function finishSale(itemId, count) {
  api.getRecord(record.recordType, record._id, (fresh) => {
    const current = fresh || record;
    const index = (current.data?.inventory || []).findIndex((i) => i?._id === itemId);
    if (index < 0) return;
    const item = current.data.inventory[index];
    const wasEquipped = item.data?.carried === "equipped";
    const { valuesToSet, removeRow, sold, totalCp } = getSellValues(current, index, count);
    if (sold <= 0) return;
    const recalc = () =>
      api.getRecord(current.recordType, current._id, (after) => {
        const updated = after || current;
        // The sale changed the Bulk carried: a card if it crossed a limit
        const encumbrance = getEncumbranceMessage(updated, current.data?.totalBulk, updateTotalBulk(updated, false));
        if (encumbrance) {
          api.sendMessage(encumbrance);
        }
        if (wasEquipped && removeRow) {
          onAddEditFeature(updated, undefined, true);
        } else {
          updateTotalBulk(updated, true);
        }
      });
    api.setValues(valuesToSet, (afterCoins) => {
      api.sendMessage(`Sold ${sold > 1 ? `${sold} ` : ""}${item.name} for ${formatCp(totalCp)}.`);
      if (!removeRow) return recalc();
      const base = afterCoins || current;
      const at = (base.data?.inventory || []).findIndex((i) => i?._id === itemId);
      if (at < 0) return recalc();
      api.removeValueFromRecord(base, "data.inventory", at, recalc);
    });
  });
}

// ---------------------------------------------------------------- Handwraps

function isHandwrapsOfMightyBlows(item) {
  return (
    item?.data?.handwraps === true ||
    item?.data?.handwraps === "true" ||
    /handwraps of mighty blows/i.test(item?.name || "")
  );
}

function isUnarmedWeapon(weapon) {
  return `${weapon?.data?.itemCategory || ""}`.toLowerCase() === "unarmed";
}

// The character's worn, invested handwraps of mighty blows, or null. NPCs
// have their runes in their stat blocks.
function getWornHandwraps(record) {
  if (record?.recordType === "npcs") return null;
  // An eidolon's are its summoner's (eidolons.js)
  if (isEidolonCharacter(record)) return getEidolonCreatureData(record, "summonerGear")?.handwraps || null;
  return (
    (record?.data?.inventory || []).find(
      (item) =>
        isHandwrapsOfMightyBlows(item) &&
        item.data?.carried === "equipped" &&
        item.data?.invested === "true",
    ) || null
  );
}

// An unarmed attack with the handwraps' runes (Foundry takes their potency,
// striking and property runes for every unarmed attack). The handwraps' own
// attack and other weapons are unchanged.
function withHandwrapsRunes(record, weapon) {
  if (!isUnarmedWeapon(weapon) || isHandwrapsOfMightyBlows(weapon)) return weapon;
  const handwraps = getWornHandwraps(record);
  if (!handwraps) return weapon;
  const own = weapon.data?.runes || {};
  const theirs = handwraps.data?.runes || {};
  const best = (a, b) => `${Math.max(parseInt(a || 0, 10) || 0, parseInt(b || 0, 10) || 0) || ""}`;
  const property = [...(Array.isArray(own.property) ? own.property : [])];
  (Array.isArray(theirs.property) ? theirs.property : []).forEach((rune) => {
    if (rune && !property.includes(rune)) property.push(rune);
  });
  return {
    ...weapon,
    data: {
      ...weapon.data,
      runes: { ...own, potency: best(own.potency, theirs.potency), striking: best(own.striking, theirs.striking), property },
    },
  };
}

// The handwraps' id when itemId is an unarmed attack, so their property
// runes' modifiers (kept on their id) apply to it
function getHandwrapsItemIdFor(record, itemId) {
  if (!itemId) return null;
  const weapon = (record?.data?.inventory || []).find((item) => item?._id === itemId);
  if (!weapon || !isUnarmedWeapon(weapon) || isHandwrapsOfMightyBlows(weapon)) return null;
  return getWornHandwraps(record)?._id || null;
}

// ---------------------------------------------------------------- Bulk

// Bulk limits (Player Core): encumbered above 5 + Str, and 10 + Str at most.
// bulkLimit modifiers (Hefty Hauler) raise both.
function getBulkLimits(strength, bulkLimitBonus = 0) {
  const str = parseInt(strength || 0, 10) || 0;
  const bonus = parseInt(bulkLimitBonus || 0, 10) || 0;
  return { encumberedAt: 5 + str + bonus, max: 10 + str + bonus };
}

// Total Bulk with fractions dropped: 10 light items are 1 Bulk, and 9 are
// none
function dropBulkFractions(total) {
  return Math.floor(Math.round((parseFloat(total) || 0) * 10) / 10);
}

// The sheet's encumbrance line: "", "Encumbered" or "Over the maximum"
function getEncumbranceStatus(totalBulk, encumberedAt, max) {
  const total = parseFloat(totalBulk) || 0;
  if (max > 0 && total > max) return "Over the maximum";
  if (encumberedAt > 0 && total > encumberedAt) return "Encumbered";
  return "";
}

// A chat card when a change takes a character over a Bulk limit: the
// Encumbered condition to apply (clumsy 1, -10 feet to its Speeds), or a
// note that it can't carry that much. "" when no limit was crossed.
function getEncumbranceMessage(record, oldTotal, newTotal) {
  const encumberedAt = parseInt(record?.data?.bulk, 10) || 0;
  const max = parseInt(record?.data?.maxBulk, 10) || 0;
  const before = getEncumbranceStatus(oldTotal, encumberedAt, max);
  const after = getEncumbranceStatus(newTotal, encumberedAt, max);
  if (before === after) return "";
  const name = record?.name || "The character";
  if (after === "Over the maximum") {
    return `**${name}** carries ${newTotal} Bulk, more than the most they can carry (${max}).`;
  }
  if (after === "Encumbered") {
    return `**${name}** carries ${newTotal} Bulk, over ${encumberedAt}: encumbered (clumsy 1, -10 feet to Speeds).
\`\`\`Apply_Encumbered
api.getSelectedOrDroppedToken().forEach((token) => {
  if (!getTokenCondition(token, 'Encumbered')) api.addEffect('Encumbered', token);
});
\`\`\``;
  }
  if (before === "Encumbered") {
    return `**${name}** carries ${newTotal} Bulk and is no longer encumbered.`;
  }
  return "";
}
