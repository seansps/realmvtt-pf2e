// Relics (GM Core pg. 308-309): an item with the Relic trait. Using it adds
// what its gifts need to its chat card: the relic's level, which matches its
// owner's; the gift DC, the higher of the owner's class DC or spell DC; the
// spell attack and counteract modifiers, 10 lower; how many gifts a relic
// usually has at that level (Table 2-22); and save buttons at the gift DC.
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
// lower than that DC." The spell DC is the best of the owner's own
// spellcasting (not an item's, like a staff). Null without either.
function getRelicGiftDC(creature) {
  const classDC = parseInt(creature?.data?.classDC || "0", 10) || 0;
  const spellDC = Math.max(
    0,
    ...(Array.isArray(creature?.data?.spells) ? creature.data.spells : [])
      .filter((entry) => entry?.data?.type !== "item")
      .map((entry) => parseInt(entry?.data?.dc || "0", 10) || 0),
  );
  const dc = Math.max(classDC, spellDC);
  if (dc <= 0) return null;
  return { dc, source: spellDC > classDC ? "spell DC" : "class DC", attack: dc - 10 };
}

// The text a relic's Use card gets, or "" for anything else
function getRelicUseText(item, creature) {
  if (!isRelicItem(item) || !creature) return "";
  const level = parseInt(creature.data?.level || "0", 10) || 0;
  const guide = getRelicGiftGuide(level);
  const lines = [`**Relic:** level ${level}, the same as its owner's.`];
  const gift = getRelicGiftDC(creature);
  if (gift) {
    lines.push(
      `**Gift DC ${gift.dc}** (${gift.source}), gift spell attack and counteract modifier +${gift.attack}.`,
    );
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
