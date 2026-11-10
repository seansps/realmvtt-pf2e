// Relics (GM Core pg. 308-309): an item with the Relic trait. Using it adds
// what its gifts need to its chat card: the relic's level, which matches its
// owner's; the gift DC, the higher of the owner's class DC or spell DC; the
// spell attack modifier, 10 lower; the owner's counteract modifier; how many
// gifts a relic usually has at that level (Table 2-22); and save buttons at
// the gift DC.
// Which gifts a relic has is the GM's call, so they stay in the item's
// description.

// Table 2-22: Relic Gifts, the level each gift usually comes at and its type
const RELIC_GIFT_LEVELS = [
  { level: 1, type: "minor" },
  { level: 5, type: "minor" },
  { level: 9, type: "major" },
  { level: 13, type: "major" },
  { level: 17, type: "grand" },
];

function isRelicItem(item) {
  return (item?.data?.traits || []).some((trait) => `${trait}`.toLowerCase() === "relic");
}

// How many gifts a relic usually has at a level, and the best type by then
function getRelicGiftGuide(level) {
  const reached = RELIC_GIFT_LEVELS.filter((row) => (parseInt(level, 10) || 0) >= row.level);
  return { count: reached.length, type: reached.length ? reached[reached.length - 1].type : null };
}

// "The DC for any saving throw called for by a gift is the higher of its
// owner's class DC or spell DC. The spell attack modifier of a gift is 10
// lower than that DC. A relic's counteract modifier is equal to its owner's
// counteract modifier": their spell attack modifier (Player Core pg. 303),
// the best entry's data.mod, or with no spellcasting their class DC - 10.
// Only the owner's own spellcasting counts, not an item's (a staff). Null
// without a class DC or spell DC.
function getRelicGiftDC(creature) {
  const classDC = parseInt(creature?.data?.classDC || "0", 10) || 0;
  const entries = (Array.isArray(creature?.data?.spells) ? creature.data.spells : []).filter(
    (entry) => entry?.data?.type !== "item",
  );
  const spellDC = Math.max(0, ...entries.map((entry) => parseInt(entry?.data?.dc || "0", 10) || 0));
  const dc = Math.max(classDC, spellDC);
  if (dc <= 0) return null;
  const counteract = entries.length
    ? Math.max(...entries.map((entry) => parseInt(entry?.data?.mod || "0", 10) || 0))
    : classDC - 10;
  return { dc, source: spellDC > classDC ? "spell DC" : "class DC", attack: dc - 10, counteract };
}

// The text a relic's Use card gets, or "" for anything else
function getRelicUseText(item, creature) {
  if (!isRelicItem(item) || !creature) return "";
  const level = parseInt(creature.data?.level || "0", 10) || 0;
  const guide = getRelicGiftGuide(level);
  const lines = [`**Relic:** level ${level}, the same as its owner's.`];
  const gift = getRelicGiftDC(creature);
  if (gift) {
    lines.push(`**Gift DC ${gift.dc}** (${gift.source}), gift spell attack +${gift.attack}.`);
    lines.push(`**Counteract modifier +${gift.counteract}** (the owner's).`);
  }
  if (guide.count > 0) {
    lines.push(
      `*A relic usually has ${guide.count} gift${guide.count === 1 ? "" : "s"} by this level, ${guide.type} at most (GM Core Table 2-22).*`,
    );
  }
  const saves = gift
    ? ["fortitude", "reflex", "will"].map((save) => getSaveMacro(save, gift.dc, false, true)).join("\n")
    : "";
  return `\n\n${lines.join("\n")}${saves ? `\n${saves}` : ""}`;
}
