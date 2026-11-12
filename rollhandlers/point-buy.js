// Variant: Point Buy (Gamemastery Guide pg. 182, a campaign setting). The
// 1st-level boosts and flaws (ancestry, background, class, free) are replaced
// by Ability Points spent on scores from 8 to 18 (Table 4-1). The sheet keeps
// remaster modifiers, so a score becomes floor((score - 10) / 2): an odd
// score is worth the even one below it, which is also how legacy boosts
// behaved below 18. Boosts at 5th level and later add on top as usual. The
// budget is shown, not enforced: dedicated points are the GM's to check.

const POINT_BUY_ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];

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

// The ancestry's flawed attributes, which start at 8
function getPointBuyFlawed(record) {
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
// flexible for two free ones instead), 2 for the background, 2 for the class
function getPointBuyBudget(record) {
  const ancestry = record?.data?.ancestries?.[0];
  const boosts = Object.values(ancestry?.data?.boosts || {}).filter((boost) => Array.isArray(boost));
  const fixed = boosts.filter((boost) => boost.length === 1).length;
  const free = boosts.filter((boost) => boost.length > 1).length;
  const ancestryPoints = ancestry ? (free >= 2 && fixed === 0 ? 2 : 2 * fixed) : 0;
  return 15 + ancestryPoints + 2 + 2;
}

function getPointBuySpent(record) {
  const flawed = getPointBuyFlawed(record);
  return POINT_BUY_ATTRIBUTES.reduce(
    (sum, attribute) => sum + getPointBuyCost(getPointBuyScore(record, attribute), flawed.includes(attribute)),
    0,
  );
}

// The boost counts point buy gives at 1st level, for calculateAbilityBoosts:
// the modifier each score is worth
function getPointBuyBoostCounts(record) {
  const counts = {};
  POINT_BUY_ATTRIBUTES.forEach((attribute) => {
    counts[attribute] = Math.floor((getPointBuyScore(record, attribute) - 10) / 2);
  });
  return counts;
}

// The editor's section and its summary line, each written only on a change
function getPointBuyFieldValues(record, variants = getVariantRules()) {
  const values = {};
  const show = !!variants.pointBuy;
  const hidden = record?.fields?.pointBuyBox?.hidden ?? true;
  if (hidden !== !show) values["fields.pointBuyBox.hidden"] = !show;
  if (show) {
    const summary = `${getPointBuySpent(record)} of ${getPointBuyBudget(record)} Ability Points spent (scores 8 to 18)`;
    if (record?.data?.pointBuySummary !== summary) values["data.pointBuySummary"] = summary;
  }
  return values;
}

function onPointBuyChange(attribute, value) {
  const score = Math.min(18, Math.max(8, parseInt(value, 10) || 10));
  api.setValues({ [`data.pointBuy.${attribute}`]: score }, (updatedRecord) => {
    onAddEditFeature(updatedRecord);
  });
}
