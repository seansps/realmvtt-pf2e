// Tests for the Point Buy variant (point-buy.js, Gamemastery Guide pg. 182):
// Table 4-1's costs, the budget, and scores becoming modifiers with later
// boosts on top.

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
}

section("scores to modifiers");
{
  const record = pc({ str: 10, dex: 18, con: 8, int: 15, wis: 9, cha: 12 });
  const counts = ctx.getPointBuyBoostCounts(record);
  assert("floor((score - 10) / 2)", [counts.str, counts.dex, counts.con, counts.int, counts.wis, counts.cha], [0, 4, -1, 2, -1, 1]);
  const boosts = ctx.calculateAbilityBoosts(record);
  assert("they replace the 1st-level boosts", [boosts.dex.modifier, boosts.con.modifier, boosts.int.modifier], [4, -1, 2]);
  const leveled = ctx.calculateAbilityBoosts(pc({ dex: 18, int: 12 }, { level: 5, freeBoostsLevel5: ["dex", "int"], freeBoosts: ["str"] }));
  assert("later boosts add on top; 1st-level free boosts don't", [leveled.dex.modifier, leveled.dex.partialBoost, leveled.int.modifier, leveled.str.modifier], [4, true, 2, 0]);
  setting = "no";
  const off = ctx.calculateAbilityBoosts(pc({ dex: 18 }, { freeBoosts: ["str"] }));
  assert("off: the usual boosts", [off.str.modifier, off.dex.modifier], [1, 1]);
  setting = "yes";
}

section("the editor");
{
  assert("shows with its summary", ctx.getPointBuyFieldValues(pc({ dex: 16 })), {
    "fields.pointBuyBox.hidden": false,
    "data.pointBuySummary": "10 of 23 Ability Points spent (scores 8 to 18)",
  });
  setting = "no";
  assert("off, never shown: no write", ctx.getPointBuyFieldValues(pc({})), {});
  setting = "yes";
}

process.exitCode = summary() > 0 ? 1 : 0;
