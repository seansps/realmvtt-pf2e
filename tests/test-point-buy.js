// Tests for the Point Buy variant (point-buy.js, Gamemastery Guide pg. 182):
// Table 4-1's costs and the budget at 1st level, Tables 4-2 and 4-3 after it,
// and scores becoming modifiers in place of every boost.

const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let setting = "yes";
ctx.api.getSetting = (key) => (key === "pointBuy" ? setting : undefined);

const elf = { data: { boosts: { a: ["dex"], b: ["int"], c: ["str", "dex", "con", "int", "wis", "cha"] }, flaws: { a: ["con"] } } };
const human = { data: { boosts: { a: ["str", "dex", "con", "int", "wis", "cha"], b: ["str", "dex", "con", "int", "wis", "cha"] }, flaws: {} } };
const pc = (pointBuy, extra = {}) => ({
  _id: "c1",
  recordType: "characters",
  data: { level: 1, ancestries: [elf], pointBuy, ...extra },
});

section("Table 4-1");
{
  assert("from 10", [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((score) => ctx.getPointBuyCost(score, false)), [-2, -1, 0, 1, 2, 3, 5, 7, 10, 13, 17]);
  assert("from a flaw's 8: 2 more", [8, 10, 12, 18].map((score) => ctx.getPointBuyCost(score, true)), [0, 2, 4, 19]);
}

section("the budget");
{
  assert("elf: 15 + 2 x 2 fixed boosts + 2 + 2", ctx.getPointBuyBudget(pc({})), 23);
  assert("human, two free boosts: 15 + 2 + 2 + 2", ctx.getPointBuyBudget(pc({}, { ancestries: [human] })), 21);
  const spent = ctx.getPointBuySpent(pc({ dex: 16, int: 14, con: 8, str: 10, wis: 12, cha: 10 }));
  assert("spent: 10 + 5 + 0 (flawed) + 0 + 2 + 0", spent, 17);
  assert("an unset score counts as 10", ctx.getPointBuyScore(pc({}), "str"), 10);
  assert("an unset flawed score starts at 8", ctx.getPointBuyScore(pc({}), "con"), 8);
  const alternate = pc({}, { alternateAncestryBoosts: true });
  assert("the alternate selection: no flaw", [ctx.getPointBuyFlawed(alternate), ctx.getPointBuyScore(alternate, "con")], [[], 10]);
  assert("and two free boosts' budget", ctx.getPointBuyBudget(alternate), 21);
}

section("Tables 4-2 and 4-3");
{
  assert("points by level", [1, 2, 5, 6, 10, 11, 15, 16, 20].map((level) => ctx.getPointBuyLevelPoints(level)), [0, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert("earned by 5th: 4 x 2", ctx.getPointBuyLevelPointsEarned(pc({}, { level: 5 })), 8);
  assert("earned by 20th", ctx.getPointBuyLevelPointsEarned(pc({}, { level: 20 })), 8 + 15 + 20 + 25);
  assert("raise costs", [8, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((score) => ctx.getPointBuyRaiseCost(score)), [1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8]);
  const raised = pc({ dex: 16, int: 12 }, { level: 5, pointBuyRaises: { dex: 2, int: 1 } });
  assert("each raise priced from where it started: 3 + 4 + 1", ctx.getPointBuyRaiseSpent(raised), 8);
  assert("and nothing left", ctx.getPointBuyRaiseAvailable(raised), 0);
  assert("final scores", [ctx.getPointBuyFinalScore(raised, "dex"), ctx.getPointBuyFinalScore(raised, "int")], [18, 13]);
  assert("no option without points", ctx.getPointBuyRaiseOptions(raised), []);
  const options = ctx.getPointBuyRaiseOptions(pc({ dex: 18 }, { level: 6, pointBuyRaises: { dex: 1 } }));
  assert("an option says the cost", options.find((o) => o.value === "dex").label, "Dexterity 19 to 20 (6 points)");
  assert("22 is the most", ctx.getPointBuyRaiseOptions(pc({ dex: 18 }, { level: 20, pointBuyRaises: { dex: 4 } })).some((o) => o.value === "dex"), false);
}

section("scores to modifiers");
{
  const record = pc({ str: 10, dex: 18, con: 8, int: 15, wis: 9, cha: 12 });
  const counts = ctx.getPointBuyBoostCounts(record);
  assert("floor((score - 10) / 2)", [counts.str, counts.dex, counts.con, counts.int, counts.wis, counts.cha], [0, 4, -1, 2, -1, 1]);
  const boosts = ctx.calculateAbilityBoosts(record);
  assert("they replace the 1st-level boosts", [boosts.dex.modifier, boosts.con.modifier, boosts.int.modifier], [4, -1, 2]);
  const leveled = ctx.calculateAbilityBoosts(pc({ dex: 18, int: 12 }, { level: 5, freeBoostsLevel5: ["dex", "int"], freeBoosts: ["str"] }));
  assert("no boosts at all, 1st level or later", [leveled.dex.modifier, leveled.dex.partialBoost, leveled.int.modifier, leveled.str.modifier], [4, false, 1, 0]);
  const scores = (dex) => ctx.calculateAbilityBoosts(pc({ dex: 18 }, { level: 20, pointBuyRaises: { dex: dex - 18 } })).dex;
  assert("19, 20, 21, 22 as modifiers", [19, 20, 21, 22].map((s) => [scores(s).modifier, scores(s).partialBoost]), [[4, true], [5, false], [5, true], [6, false]]);
  const gains = ctx.getLevelUpGains(pc({}, { level: 4, classes: [{ name: "Fighter", data: {} }] }), 5);
  assert("Level Up: Ability Points, no boosts", [gains.attributeBoosts, gains.abilityPoints], [false, 2]);
  assert("and says so", ctx.getLevelUpSummary(gains).includes("+2 Ability Points to raise scores in the attribute editor (Point Buy)"), true);
  setting = "no";
  const off = ctx.calculateAbilityBoosts(pc({ dex: 18 }, { freeBoosts: ["str"] }));
  assert("off: the usual boosts", [off.str.modifier, off.dex.modifier], [1, 1]);
  setting = "yes";
}

section("the editor");
{
  assert("shows with its lines, hiding the standard pickers", ctx.getPointBuyFieldValues(pc({ dex: 16 }, { level: 2, pointBuyRaises: { dex: 1 } })), {
    "fields.pointBuyBox.hidden": false,
    "fields.standardBoostsBox.hidden": true,
    "fields.freeBoosts.hidden": true,
    "data.pointBuySummary": "10 of 23 Ability Points spent (scores 8 to 18)",
    "data.pointBuyRaiseSummary": "Level-up points: -1 to spend (2 earned); raised DEX 17",
  });
  assert("the later boost sets hide too", ctx.getFreeBoostFieldsForLevel(pc({}, { level: 10 }), 10)["fields.freeBoostsLevel5.hidden"], true);
  setting = "no";
  assert("off, never shown: no write", ctx.getPointBuyFieldValues(pc({})), {});
  assert("off after on: the pickers come back", ctx.getPointBuyFieldValues({ ...pc({}), fields: { pointBuyBox: { hidden: false }, standardBoostsBox: { hidden: true }, freeBoosts: { hidden: true } } }), {
    "fields.pointBuyBox.hidden": true,
    "fields.standardBoostsBox.hidden": false,
    "fields.freeBoosts.hidden": false,
  });
  setting = "yes";
}

process.exitCode = summary() > 0 ? 1 : 0;
