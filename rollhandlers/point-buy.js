// Variant: Point Buy (Gamemastery Guide pg. 182, a campaign setting). Ability
// Points replace all the ability boosts a character would get.
// - 1st level: scores from 8 to 18 (Table 4-1) replace the ancestry,
//   background, class and free boosts and the ancestry flaws. The budget is
//   shown, not enforced: dedicated points are the GM's to check.
// - Later levels: Ability Points by level (Table 4-2), saved or spent to raise
//   a score by 1 at a time (Table 4-3), up to 22. The raises are kept apart
//   from the 1st-level scores (data.pointBuyRaises), since the cost of a raise
//   depends on the score it starts from. The boosts at 5th, 10th, 15th and
//   20th level are not used.
// The sheet keeps remaster modifiers: a score becomes floor((score - 10) / 2),
// and an odd score above 18 shows the partial boost.

const POINT_BUY_ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];
const POINT_BUY_MAX_SCORE = 22;
const POINT_BUY_ATTRIBUTE_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

// Table 4-1: points spent from 10 for each score (below 10 gives points back)
const POINT_BUY_COST = { 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 };

function isPointBuyOn(record) {
  return !!getVariantRules().pointBuy && record?.recordType === "characters";
}

// A score not set yet is where it starts: 10, or 8 for an ancestry flaw
function getPointBuyScore(record, attribute) {
  const score = parseInt(record?.data?.pointBuy?.[attribute], 10);
  if (score >= 8 && score <= 18) return score;
  return getPointBuyFlawed(record).includes(attribute) ? 8 : 10;
}

// The ancestry's flawed attributes, which start at 8 (none with the
// alternate selection of two free boosts)
function getPointBuyFlawed(record) {
  if (record?.data?.alternateAncestryBoosts) return [];
  const ancestry = record?.data?.ancestries?.[0];
  return Object.values(ancestry?.data?.flaws || {})
    .filter((flaw) => Array.isArray(flaw) && flaw.length === 1)
    .map((flaw) => flaw[0]);
}

// What a score costs: from 10 per Table 4-1, or from 8 for a flawed attribute,
// where "Raising a score costs 2 points more than the listed value"
function getPointBuyCost(score, flawed) {
  if (!flawed) return POINT_BUY_COST[score] ?? 0;
  return score <= 8 ? 0 : (POINT_BUY_COST[score] ?? 0) + 2;
}

// The budget: 15 flexible, 2 dedicated for each fixed ancestry boost (2 more
// flexible for two free ones instead, or the alternate selection), 2 for the
// background, 2 for the class
function getPointBuyBudget(record) {
  const ancestry = record?.data?.ancestries?.[0];
  const boosts = Object.values(ancestry?.data?.boosts || {}).filter((boost) => Array.isArray(boost));
  const fixed = boosts.filter((boost) => boost.length === 1).length;
  const free = boosts.filter((boost) => boost.length > 1).length;
  const twoFree = !!record?.data?.alternateAncestryBoosts || (free >= 2 && fixed === 0);
  const ancestryPoints = ancestry ? (twoFree ? 2 : 2 * fixed) : 0;
  return 15 + ancestryPoints + 2 + 2;
}

function getPointBuySpent(record) {
  const flawed = getPointBuyFlawed(record);
  return POINT_BUY_ATTRIBUTES.reduce(
    (sum, attribute) => sum + getPointBuyCost(getPointBuyScore(record, attribute), flawed.includes(attribute)),
    0,
  );
}

// Table 4-2: Ability Points gained on reaching a level
function getPointBuyLevelPoints(level) {
  if (level >= 16) return 5;
  if (level >= 11) return 4;
  if (level >= 6) return 3;
  if (level >= 2) return 2;
  return 0;
}

function getPointBuyLevelPointsEarned(record) {
  const level = Math.min(20, parseInt(record?.data?.level || "0", 10) || 0);
  let total = 0;
  for (let at = 2; at <= level; at += 1) total += getPointBuyLevelPoints(at);
  return total;
}

// Table 4-3: the cost to raise a score by 1 from its current value
function getPointBuyRaiseCost(score) {
  if (score <= 12) return 1;
  if (score <= 14) return 2;
  if (score <= 16) return 3;
  return score - 13;
}

function getPointBuyRaises(record, attribute) {
  return Math.max(0, parseInt(record?.data?.pointBuyRaises?.[attribute], 10) || 0);
}

function getPointBuyFinalScore(record, attribute) {
  return Math.min(POINT_BUY_MAX_SCORE, getPointBuyScore(record, attribute) + getPointBuyRaises(record, attribute));
}

// The level-up points spent: each raise priced from the score it started at
function getPointBuyRaiseSpent(record) {
  return POINT_BUY_ATTRIBUTES.reduce((sum, attribute) => {
    const target = getPointBuyFinalScore(record, attribute);
    for (let score = getPointBuyScore(record, attribute); score < target; score += 1) sum += getPointBuyRaiseCost(score);
    return sum;
  }, 0);
}

function getPointBuyRaiseAvailable(record) {
  return getPointBuyLevelPointsEarned(record) - getPointBuyRaiseSpent(record);
}

// The boost counts the scores are worth, for calculateAbilityBoosts: the
// modifier up to 18, then one count per point (19 is +4 with a partial boost,
// 20 is +5, 22 is +6)
function getPointBuyBoostCounts(record) {
  const counts = {};
  POINT_BUY_ATTRIBUTES.forEach((attribute) => {
    const score = getPointBuyFinalScore(record, attribute);
    counts[attribute] = score > 18 ? score - 14 : Math.floor((score - 10) / 2);
  });
  return counts;
}

// The scores that can go up by 1 now, with what it costs
function getPointBuyRaiseOptions(record) {
  const available = getPointBuyRaiseAvailable(record);
  return POINT_BUY_ATTRIBUTES.map((attribute) => {
    const score = getPointBuyFinalScore(record, attribute);
    const cost = getPointBuyRaiseCost(score);
    if (score >= POINT_BUY_MAX_SCORE || cost > available) return null;
    return { label: `${POINT_BUY_ATTRIBUTE_NAMES[attribute]} ${score} to ${score + 1} (${cost} point${cost === 1 ? "" : "s"})`, value: attribute };
  }).filter(Boolean);
}

// The editor's section, its lines, and the standard boost pickers it replaces
// (the class's key attribute stays: it still picks the key attribute), each
// written only on a change
function getPointBuyFieldValues(record, variants = getVariantRules()) {
  const values = {};
  const show = !!variants.pointBuy;
  const hidden = record?.fields?.pointBuyBox?.hidden ?? true;
  if (hidden !== !show) values["fields.pointBuyBox.hidden"] = !show;
  ["standardBoostsBox", "freeBoosts"].forEach((field) => {
    if ((record?.fields?.[field]?.hidden ?? false) !== show) values[`fields.${field}.hidden`] = show;
  });
  if (show) {
    const summary = `${getPointBuySpent(record)} of ${getPointBuyBudget(record)} Ability Points spent (scores 8 to 18)`;
    if (record?.data?.pointBuySummary !== summary) values["data.pointBuySummary"] = summary;
    const raised = POINT_BUY_ATTRIBUTES.filter((attribute) => getPointBuyRaises(record, attribute) > 0)
      .map((attribute) => `${attribute.toUpperCase()} ${getPointBuyFinalScore(record, attribute)}`);
    const raiseSummary = `Level-up points: ${getPointBuyRaiseAvailable(record)} to spend (${getPointBuyLevelPointsEarned(record)} earned)${raised.length ? `; raised ${raised.join(", ")}` : ""}`;
    if (record?.data?.pointBuyRaiseSummary !== raiseSummary) values["data.pointBuyRaiseSummary"] = raiseSummary;
  }
  return values;
}

function onPointBuyChange(attribute, value) {
  const score = Math.min(18, Math.max(8, parseInt(value, 10) || 10));
  api.setValues({ [`data.pointBuy.${attribute}`]: score }, (updatedRecord) => {
    onAddEditFeature(updatedRecord);
  });
}

function raisePointBuyScore(record) {
  const options = getPointBuyRaiseOptions(record);
  if (!options.length) {
    api.showNotification("No score can go up with the level-up points this character has.", "yellow", "Point Buy");
    return;
  }
  api.showPrompt("Point Buy", "Raise which score by 1?", "Select...", options, null, (choice) => {
    const attribute = pick(choice);
    if (!POINT_BUY_ATTRIBUTES.includes(attribute)) return;
    api.setValues({ [`data.pointBuyRaises.${attribute}`]: getPointBuyRaises(record, attribute) + 1 }, (updatedRecord) => {
      onAddEditFeature(updatedRecord);
    });
  });
}

function undoPointBuyRaise(record) {
  const options = POINT_BUY_ATTRIBUTES.filter((attribute) => getPointBuyRaises(record, attribute) > 0).map((attribute) => {
    const score = getPointBuyFinalScore(record, attribute);
    return { label: `${POINT_BUY_ATTRIBUTE_NAMES[attribute]} ${score} back to ${score - 1}`, value: attribute };
  });
  if (!options.length) return;
  api.showPrompt("Point Buy", "Undo a raise", "Select...", options, null, (choice) => {
    const attribute = pick(choice);
    if (!POINT_BUY_ATTRIBUTES.includes(attribute)) return;
    api.setValues({ [`data.pointBuyRaises.${attribute}`]: getPointBuyRaises(record, attribute) - 1 }, (updatedRecord) => {
      onAddEditFeature(updatedRecord);
    });
  });
}
