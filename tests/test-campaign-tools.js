// Tests for the campaign tools (campaign-tools.js, roadmap B16, B3, B7):
// treasure by level, faction reputation, downtime days.

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let settings = {};
ctx.api.getSetting = (key) => settings[key] ?? null;
let vars = {};
ctx.api.getCampaignVariable = (name) => vars[name];
ctx.api.setCampaignVariable = (name, value) => {
  vars[name] = value;
};
let valuePrompt = null;
ctx.api.showValuePrompt = (title, text, cb) => {
  valuePrompt = cb;
};
let prompts = [];
ctx.api.showPrompt = (...args) => prompts.push(args);

section("Treasure: the budget by level and party size");
{
  const level3 = ctx.getTreasureBudget(3, 4);
  assert("level 3, four PCs: 500 gp", level3.total, 500);
  assert("its currency", level3.currency, 120);
  assert("five PCs: +30 gp", ctx.getTreasureBudget(3, 5).total, 530);
  assert("three PCs: -30 gp", [ctx.getTreasureBudget(3, 3).total, ctx.getTreasureBudget(3, 3).currency], [470, 90]);
  assert("four PCs: the table's items", [ctx.getTreasureBudget(3, 4).extraPermanent, ctx.getTreasureBudget(3, 4).sizeNote], [null, ""]);
  const five = ctx.getTreasureBudget(3, 5);
  assert("five PCs: a permanent item of 3rd or 4th", five.extraPermanent, { count: 1, levels: [3, 4] });
  assert("... and two consumables, 3rd and 4th", five.consumables, [[4, 3], [3, 3], [2, 2]]);
  const six = ctx.getTreasureBudget(1, 6);
  assert("six PCs at level 1", [six.extraPermanent.count, six.consumables], [2, [[2, 4], [1, 5]]]);
  const two = ctx.getTreasureBudget(3, 2);
  assert("two PCs: items taken away", [two.extraPermanent.count, two.consumables], [-2, [[2, 2]]]);
  assert("level 20: no 21st", [ctx.getTreasureBudget(20, 5).extraPermanent.levels, ctx.getTreasureBudget(20, 5).consumables], [[20], [[20, 6], [19, 2]]]);
  assert("level 20", ctx.getTreasureBudget(20, 4).total, 490000);
  assert("past 20: 20's row", ctx.getTreasureBudget(25, 4).total, 490000);
  assert("below 1: 1's row", ctx.getTreasureBudget(0, 4).total, 175);
}

section("Treasure: the meter");
{
  settings = {};
  const meter = ctx.getTreasureMeter({ level: 3, size: 4, awarded: 420 });
  assert("awarded", [meter.awarded, meter.awardedLabel], [420, "420 gp awarded"]);
  assert("the budget", [meter.max, meter.budgetLabel], [500, "of 500 gp for level 3, 4 PCs"]);
  assert("what's left", meter.left, "80 gp left");
  assert("the items, for the PERMANENT heading", meter.permanent, "2 × 4th, 2 × 3rd");
  assert("consumables", meter.consumables, "2 × 4th, 2 × 3rd, 2 × 2nd");
  assert("currency", meter.currency, "120 gp");
  assert("no ABP note", meter.abp, "");
  assert("over the budget", ctx.getTreasureMeter({ level: 1, size: 4, awarded: 200 }).left, "25 gp over");
  settings = { automaticBonusProgression: "yes" };
  assertIncludes("ABP: leave out fundamental runes", ctx.getTreasureMeter({ level: 3, size: 4, awarded: 0 }).abp, "potency, striking and resilient");
  settings = {};
  assert("thousands", ctx.getTreasureMeter({ level: 12, size: 4, awarded: 1500 }).budgetLabel, "of 16,500 gp for level 12, 4 PCs");
  const fiveMeter = ctx.getTreasureMeter({ level: 3, size: 5, awarded: 0 });
  assert("five PCs: the extra item", fiveMeter.permanent, "2 × 4th, 2 × 3rd, plus 1 × 3rd or 4th");
  assert("... consumables", fiveMeter.consumables, "3 × 4th, 3 × 3rd, 2 × 2nd");
  assert("... the total says it's currency only", fiveMeter.budgetLabel, "of 530 gp for level 3, 5 PCs (the party's size changes only its currency)");
  assert("three PCs: less", ctx.getTreasureMeter({ level: 3, size: 3, awarded: 0 }).permanent, "2 × 4th, 2 × 3rd, less 1 × 3rd or 4th");
  assert("ordinals", [1, 2, 3, 11, 12, 13, 21].map((n) => ctx.getOrdinal(n)), ["1st", "2nd", "3rd", "11th", "12th", "13th", "21st"]);
}

section("Treasure: awards");
{
  assert("plain gp", ctx.parseGpValue("120"), 120);
  assert("coins", Math.round(ctx.parseGpValue("3 gp 5 sp") * 100) / 100, 3.5);
  assert("platinum", ctx.parseGpValue("2 pp"), 20);
  assert("taking back", ctx.parseGpValue("-20"), -20);
  assert("nothing", ctx.parseGpValue("lots"), null);

  vars = { encounterPartyLevel: 3, encounterPartySize: 4, treasureAwarded: 100 };
  ctx.addTreasureAward();
  valuePrompt("3 gp 5 sp");
  assert("added to the tally", vars.treasureAwarded, 103.5);
  assert("the meter written", vars.treasureMeter.awardedLabel, "103.5 gp awarded");
  ctx.addTreasureAward();
  valuePrompt("-500");
  assert("never below 0", vars.treasureAwarded, 0);

  vars.treasureAwarded = 480;
  ctx.__state.messages.length = 0;
  ctx.startTreasureLevel();
  assertIncludes("New Level posts the tally for the GM", ctx.__state.messages[0], "[gm]**Treasure:** 480 gp of 500 gp awarded at level 3.[/gm]");
  assert("... and starts again", [vars.treasureAwarded, vars.treasureMeter.awarded], [0, 0]);

  ctx.refreshTreasureMeter({ level: 5 });
  assert("a new party level: the meter follows", vars.treasureMeter.max, 1350);
}

section("Treasure: the panel's onload");
{
  vars = {};
  let writes = 0;
  const set = ctx.api.setCampaignVariable;
  ctx.api.setCampaignVariable = (name, value) => {
    writes++;
    set(name, value);
  };
  ctx.loadTreasureMeter();
  assert("no meter yet: written, level 1 and four PCs", [writes, vars.treasureMeter.max], [1, 175]);
  ctx.loadTreasureMeter();
  assert("up to date: nothing written", writes, 1);
  settings = { automaticBonusProgression: "yes" };
  ctx.loadTreasureMeter();
  assert("a setting changed: written again", [writes, !!vars.treasureMeter.abp], [2, true]);
  settings = {};
  ctx.api.setCampaignVariable = set;
}

section("Treasure: Use the Party updates it too");
{
  vars = {};
  ctx.api.getParty = (cb) => cb([
    { recordType: "characters", data: { level: 4 } },
    { recordType: "characters", data: { level: 4 } },
    { recordType: "characters", data: { level: 4 } },
  ]);
  ctx.setEncounterBuilderFromParty();
  assert("the encounter builder's party", [vars.encounterPartyLevel, vars.encounterPartySize], [4, 3]);
  assert("the treasure budget for it", vars.treasureMeter.max, 800);
}

section("Reputation: tiers");
{
  const tier = (p) => ctx.getReputationTier(p);
  assert("the tiers' edges", [50, 30, 29, 15, 14, 5, 4, 0, -4, -5, -14, -15, -29, -30, -50].map(tier), [
    "Revered", "Revered", "Admired", "Admired", "Liked", "Liked", "Ignored", "Ignored", "Ignored",
    "Disliked", "Disliked", "Hated", "Hated", "Hunted", "Hunted",
  ]);
  assert("kept within -50 and 50", [ctx.clampReputation(55), ctx.clampReputation(-60)], [50, -50]);
}

section("Reputation: favors and disservices");
{
  const change = ctx.getReputationChange({ name: "Pathfinder Society", points: 3 }, 2);
  assert("the points", change.faction.points, 5);
  assertIncludes("the tier change", change.message, "Pathfinder Society +2, now +5 (Ignored to Liked).");
  const same = ctx.getReputationChange({ name: "Aspis", points: -6 }, -2);
  assertIncludes("same tier", same.message, "Aspis -2, now -8 (Disliked).");

  // Table 3-2: what counts at each tier
  const counts = (points, change) => ctx.getReputationChange({ name: "F", points }, change).counted;
  assert("Revered: major favor, moderate or major disservice", [1, 2, 5, -1, -2, -5].map((c) => counts(30, c)), [false, false, true, false, true, true]);
  assert("Admired: major favor, any disservice", [1, 2, 5, -1].map((c) => counts(15, c)), [false, false, true, true]);
  assert("Liked: moderate or major favor, any disservice", [1, 2, -1].map((c) => counts(7, c)), [false, true, true]);
  assert("Ignored: anything", [1, -1].map((c) => counts(0, c)), [true, true]);
  assert("Disliked: any favor, moderate or major disservice", [1, -1, -2].map((c) => counts(-6, c)), [true, false, true]);
  assert("Hated: any favor, major disservice", [1, -2, -5].map((c) => counts(-20, c)), [true, false, true]);
  assert("Hunted: moderate or major favor, major disservice", [1, 2, -2, -5].map((c) => counts(-40, c)), [false, true, false, true]);
  const none = ctx.getReputationChange({ name: "Aspis", points: 7 }, 1);
  assert("too small: the points stay", none.faction.points, 7);
  assert("... and it says so", none.message, "**Reputation:** Aspis: a minor favor has no effect at Liked (+7).");

  vars = {};
  ctx.addReputationFaction();
  valuePrompt("Pathfinder Society");
  assert("a new faction at 0", vars.reputationFactions, [{ name: "Pathfinder Society", points: 0 }]);
  assert("its row", vars.reputationMeter.rows[0], { name: "Pathfinder Society", standing: "+0 Ignored" });

  prompts = [];
  ctx.__state.messages.length = 0;
  ctx.changeReputation();
  prompts[0][5]("0");
  prompts[1][5]("5");
  assert("a major favor", vars.reputationFactions[0].points, 5);
  assertIncludes("posted", ctx.__state.messages[0], "now +5 (Ignored to Liked)");

  prompts = [];
  ctx.__state.messages.length = 0;
  ctx.changeReputation();
  prompts[0][5]("0");
  prompts[1][5]("1");
  assert("a minor favor at Liked: not written", vars.reputationFactions[0].points, 5);
  assertIncludes("... posted", ctx.__state.messages[0], "has no effect at Liked");

  prompts = [];
  ctx.removeReputationFaction();
  prompts[0][5]("0");
  assert("removed", [vars.reputationFactions, vars.reputationMeter.empty], [[], "No factions yet"]);

  const many = Array.from({ length: 10 }, (_, i) => ({ name: `F${i}`, points: 0 }));
  const meter = ctx.getReputationMeter(many);
  assert("past 8 rows: the last says how many more", [meter.rows.length, meter.rows[7].name], [8, "+3 more"]);
}

section("Downtime: spending and granting days");
{
  const spent = ctx.getSpendDowntimeValues({ data: { downtimeDays: 10, downtimeLog: "<p>Granted 10 days</p>" } }, 7, "Retrain");
  assert("fewer days", spent.values["data.downtimeDays"], 3);
  assert("a log line, newest first", spent.values["data.downtimeLog"], "<p>Retrain: 7 days</p><p>Granted 10 days</p>");
  const over = ctx.getSpendDowntimeValues({ data: { downtimeDays: 2 } }, 5, "Craft");
  assert("more than available: allowed, noted", [over.over, over.values["data.downtimeDays"], over.values["data.downtimeLog"]], [true, -3, "<p>Craft: 5 days (3 more than available)</p>"]);
  const granted = ctx.getGrantDowntimeValues({ data: { downtimeDays: 3 } }, 1);
  assert("granting", granted, { "data.downtimeDays": 4, "data.downtimeLog": "<p>Granted 1 day</p>" });

  const writes = [];
  ctx.api.setValuesOnRecord = (record, values) => writes.push([record.name, values]);
  ctx.api.getParty = (cb) => cb([
    { name: "Amiri", recordType: "characters", data: { downtimeDays: 0 } },
    { name: "Ezren", recordType: "characters", data: { downtimeDays: 2 } },
    { name: "Wolf", recordType: "npcs", data: {} },
  ]);
  ctx.__state.messages.length = 0;
  ctx.grantDowntimeDays();
  valuePrompt("7");
  assert("each character, one write", writes.map(([name, v]) => [name, v["data.downtimeDays"]]), [["Amiri", 7], ["Ezren", 9]]);
  assertIncludes("posted", ctx.__state.messages[0], "Amiri, Ezren each have 7 more days.");

  writes.length = 0;
  prompts = [];
  ctx.api.getRecord = (type, id, cb) => cb({ _id: id, name: "Amiri", data: { downtimeDays: 7 } });
  ctx.spendDowntimeDays({ _id: "amiri" });
  valuePrompt("3");
  prompts[0][5]("Earn Income");
  assert("Spend Days: from a fresh read", writes[0][1]["data.downtimeDays"], 4);
}

process.exitCode = summary() > 0 ? 1 : 0;
