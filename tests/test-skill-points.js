// Tests for the Skill Points variant (skill-points.js, Gamemastery Guide
// pg. 199): Tables 4-19 and 4-20, spending, retraining and Level Up.

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let setting = "yes";
ctx.api.getSetting = (key) => (key === "skillPoints" ? setting : undefined);

const pc = (extra = {}, className = "Fighter") => ({
  _id: "c1",
  recordType: "characters",
  data: { level: 5, classes: [{ name: className, data: { skillIncreaseLevels: [3, 5, 7] } }], athletics: "1", stealth: "0", ...extra },
});

section("Table 4-19");
{
  assert("points by level", [1, 2, 5, 6, 13, 14, 20].map((level) => ctx.getSkillPointsForLevel(level)), [0, 1, 1, 2, 2, 4, 4]);
  assert("rogues double", ctx.getSkillPointsForLevel(6, true), 4);
  assert("earned by 5th: 4", ctx.getSkillPointsEarned(pc()), 4);
  assert("earned by 14th: 4 + 16 + 4", ctx.getSkillPointsEarned(pc({ level: 14 })), 24);
  assert("a rogue by 5th: 8", ctx.getSkillPointsEarned(pc({}, "Rogue")), 8);
  assert("available after spending", ctx.getSkillPointsAvailable(pc({ skillPointsSpent: 3 })), 1);
}

section("Table 4-20");
{
  const options = ctx.getSkillPointOptions(pc({ skillPointsSpent: 2 }));
  const athletics = options.find((o) => o.value === "athletics");
  assert("trained to expert at 3rd: 2 points", athletics.label, "Athletics: Expert (2 points)");
  assert("untrained to trained: 1 point", options.find((o) => o.value === "stealth").label, "Stealth: Trained (1 point)");
  assert("master needs level 7", ctx.getSkillPointOptions(pc({ athletics: "2" })).some((o) => o.value === "athletics"), false);
  assert("too few points: not offered", ctx.getSkillPointOptions(pc({ skillPointsSpent: 3 })).some((o) => o.value === "athletics"), false);
  assert("spending writes rank and points", ctx.getSkillPointSpendValues(pc({ skillPointsSpent: 1 }), "athletics"), { "data.athletics": "2", "data.skillPointsSpent": 3 });
  assert("retraining gives the step back", ctx.getSkillPointRetrainValues(pc({ athletics: "2", skillPointsSpent: 3 }), "athletics"), { "data.athletics": "1", "data.skillPointsSpent": 1 });
  assert("legendary can't go higher", ctx.getSkillPointSpendValues(pc({ athletics: "4" }), "athletics"), null);

  const scholar = pc({ loreSkills: [{ _id: "l1", name: "Sailing Lore", data: { rank: "1" } }] });
  const lore = ctx.getSkillPointOptions(scholar).find((o) => o.value === "lore:0");
  assert("a Lore can go up too", lore.label, "Sailing Lore: Expert (2 points)");
  assert("its rank on its entry", ctx.getSkillPointSpendValues(scholar, "lore:0"), { "data.loreSkills.0.data.rank": "2", "data.skillPointsSpent": 2 });
  assert("and back", ctx.getSkillPointRetrainValues(pc({ skillPointsSpent: 2, loreSkills: [{ name: "Sailing Lore", data: { rank: "2" } }] }), "lore:0"), { "data.loreSkills.0.data.rank": "1", "data.skillPointsSpent": 0 });
  assert("a Lore that isn't there", ctx.getSkillPointSpendValues(scholar, "lore:3"), null);
}

section("Level Up");
{
  const gains = ctx.getLevelUpGains(pc(), 6);
  assert("points in place of the increase", [gains.skillIncrease, gains.skillPoints], [false, 2]);
  assertIncludes("the summary says so", ctx.getLevelUpSummary(gains), "+2 Skill Points to spend on the Skills tab");
  setting = "no";
  const off = ctx.getLevelUpGains(pc(), 7);
  assert("off: the usual increase", [off.skillIncrease, off.skillPoints], [true, 0]);
  setting = "yes";
}

section("the Skills tab");
{
  assert("shows with its line", ctx.getSkillPointFieldValues(pc({ skillPointsSpent: 1 })), {
    "fields.skillPointsBox.hidden": false,
    "data.skillPointsLabel": "3 Skill Points to spend (4 earned, 1 spent)",
  });
  setting = "no";
  assert("off, never shown: no write", ctx.getSkillPointFieldValues(pc()), {});
  setting = "yes";
}

process.exitCode = summary() > 0 ? 1 : 0;
