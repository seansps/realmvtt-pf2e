// Tests for relics (relics.js, roadmap B14): the relic's level, the gift DC
// and the gifts table on its Use card (GM Core pg. 308-309).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const relic = { name: "Sleuth's Pipe", data: { level: 3, traits: ["Unique", "Magical", "Relic"] } };
const owner = (extra = {}) => ({
  _id: "char-1",
  recordType: "characters",
  name: "Ezren",
  data: { level: 9, classDC: 25, spells: [], ...extra },
});

section("which items are relics");
{
  assert("the Relic trait", ctx.isRelicItem(relic), true);
  assert("any case", ctx.isRelicItem({ data: { traits: ["relic"] } }), true);
  assert("anything else", ctx.isRelicItem({ data: { traits: ["Magical"] } }), false);
  assert("no traits", ctx.isRelicItem({}), false);
}

section("Table 2-22: gifts by level");
{
  assert("none before 1st", ctx.getRelicGiftGuide(0), { count: 0, type: null });
  assert("1st: 1 minor", ctx.getRelicGiftGuide(1), { count: 1, type: "minor" });
  assert("5th: 2 minor", ctx.getRelicGiftGuide(5), { count: 2, type: "minor" });
  assert("9th: 3, major", ctx.getRelicGiftGuide(9), { count: 3, type: "major" });
  assert("16th: 4, major", ctx.getRelicGiftGuide(16), { count: 4, type: "major" });
  assert("17th: 5, grand", ctx.getRelicGiftGuide(17), { count: 5, type: "grand" });
}

section("the gift DC: the higher of class DC or spell DC");
{
  assert("class DC alone", ctx.getRelicGiftDC(owner()), { dc: 25, source: "class DC", attack: 15 });
  assert(
    "a higher spell DC",
    ctx.getRelicGiftDC(owner({ spells: [{ data: { dc: 27 } }, { data: { dc: 22 } }] })),
    { dc: 27, source: "spell DC", attack: 17 },
  );
  assert(
    "a lower spell DC",
    ctx.getRelicGiftDC(owner({ spells: [{ data: { dc: 23 } }] })),
    { dc: 25, source: "class DC", attack: 15 },
  );
  assert(
    "an item's entry (a staff) doesn't count",
    ctx.getRelicGiftDC(owner({ spells: [{ data: { type: "item", dc: 30 } }] })).dc,
    25,
  );
  assert("neither", ctx.getRelicGiftDC(owner({ classDC: 0 })), null);
}

section("the Use card");
{
  const text = ctx.getRelicUseText(relic, owner({ spells: [{ data: { dc: 27 } }] }));
  assertIncludes("the owner's level", text, "level 9, the same as its owner's");
  assertIncludes("the gift DC", text, "**Gift DC 27** (spell DC)");
  assertIncludes("attack and counteract", text, "counteract modifier +17");
  assertIncludes("the gifts table", text, "3 gifts by this level, major at most");
  assertIncludes("a Fortitude button", text, "Fortitude_Save");
  assertIncludes("a Will button at the DC", text, "Roll_Will_Save_DC27");
  assert("nothing for other items", ctx.getRelicUseText({ data: { traits: [] } }, owner()), "");
  assert("nothing without an owner", ctx.getRelicUseText(relic, null), "");
  const noDC = ctx.getRelicUseText(relic, owner({ classDC: 0 }));
  assert("no DC line or buttons without a DC", [noDC.includes("Gift DC"), noDC.includes("_Save")], [false, false]);
}

section("wiring");
{
  const fs = require("fs");
  const common = fs.readFileSync(`${__dirname}/../rollhandlers/common.js`, "utf8");
  assertIncludes("the Use card adds it", common, "getRelicUseText(");
}

process.exitCode = summary() > 0 ? 1 : 0;
