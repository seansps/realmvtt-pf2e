// Tests for duels, leadership and naval chase obstacles (gm-subsystems.js).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

section("duels");
{
  const pc = { _id: "t1", name: "Seelah", recordType: "characters", data: { intimidation: 1, deception: 0, arcana: 2 } };
  const npc = { _id: "t2", name: "Duelist", recordType: "npcs", data: { skills: [{ name: "Deception", data: { mod: 9 } }] } };
  assert("a trained character", ctx.isTrainedForDuel(pc, "intimidation"), true);
  assert("an untrained one", ctx.isTrainedForDuel(pc, "deception"), false);
  assert("everyone has Perception", ctx.isTrainedForDuel(pc, "perception"), true);
  assert("an NPC with the skill listed", ctx.isTrainedForDuel(npc, "deception"), true);
  assert("an NPC without it", ctx.isTrainedForDuel(npc, "intimidation"), false);

  assert("Intimidation: Bullying Press", ctx.getDuelMetadata(pc, "intimidation", "combat").duel, { kind: "combat", skill: "intimidation", trained: true, gained: "Bullying Press" });
  assertIncludes("the card says so", ctx.getDuelResultLines(ctx.getDuelMetadata(pc, "intimidation", "combat"))[0], "Bullying Press is this round's dueling reaction");
  assertIncludes("untrained: no reaction", ctx.getDuelResultLines(ctx.getDuelMetadata(pc, "deception", "combat"))[0], "not trained in Deception");
  assertIncludes("a spellcasting duel's focus", ctx.getDuelResultLines(ctx.getDuelMetadata(pc, "arcana", "spellcasting"))[0], "tradition focus arcane, with Dueling Counter");
  assert("other rolls: nothing", ctx.getDuelResultLines({}), []);

  const prompts = [];
  ctx.api.promptRollForToken = (record, title, formula, modifiers, metadata, type) => prompts.push({ metadata, type });
  ctx.rollDuelInitiative(pc, "intimidation", "combat");
  assert("rolled as initiative", [prompts[0].type, prompts[0].metadata.duel.gained], ["initiative", "Bullying Press"]);

  const sent = [];
  ctx.api.sendMessage = (text) => sent.push(text);
  ctx.api.getSelectedTokens = () => [{ token: pc }, { token: npc }];
  ctx.postDuelInitiative("combat");
  assert("a card per duelist", sent.length, 2);
  assertIncludes("with a button per skill", sent[0], 'rollDuelInitiative(token, "deception", "combat")');
}

section("leadership");
{
  assert("no followers: no organization", ctx.getOrganizationStats(0).level, 0);
  assert("1 follower: level 1", ctx.getOrganizationStats(1).level, 1);
  assert("13: level 5", ctx.getOrganizationStats(13).level, 5);
  const ten = ctx.getOrganizationStats(54);
  assert("54: level 10", [ten.level, ten.maxFollower, ten.lieutenants, ten.lieutenantLevels, ten.next], [10, 2, "6-7", "3-4", 76]);
  assert("2,400: level 20", ctx.getOrganizationStats(2400).level, 20);
  const meter = ctx.getLeadershipMeter(54);
  assert("the panel's label", meter.label, "Organization level 10");
  assertIncludes("and details", meter.details, "54 followers (up to level 2), 6-7 lieutenants of level 3-4. Level 11 at 76 followers.");

  const vars = { leadershipFollowers: 12 };
  const sent = [];
  ctx.api.getCampaignVariable = (name) => vars[name];
  ctx.api.setCampaignVariable = (name, value) => { vars[name] = value; };
  ctx.api.sendMessage = (text) => sent.push(text);
  ctx.api.showValuePrompt = (title, label, callback) => callback("+2");
  ctx.setLeadershipFollowers();
  assert("+2 adds", vars.leadershipFollowers, 14);
  assertIncludes("a new level is announced", sent[0], "now level 6");
  ctx.api.showValuePrompt = (title, label, callback) => callback("x");
  ctx.setLeadershipFollowers();
  assert("nonsense changes nothing", vars.leadershipFollowers, 14);
}

section("naval chase obstacles");
{
  const rows = ctx.getNavalChaseObstacleRows(["Squall (2nd)", "Lurking Kraken (12th)"]);
  assert("the picked rows", rows.map((row) => [row.name, row.data.checks]), [
    ["Squall (2nd)", "DC 14 Nature or Survival, DC 16 Sailing Lore"],
    ["Lurking Kraken (12th)", "DC 28 Nature, DC 32 Stealth"],
  ]);
  assert("goal and points start at 0", [rows[0].data.goal, rows[0].data.points], [0, 0]);
  assert("all 16 without a pick", ctx.getNavalChaseObstacleRows().length, 16);

  let written = null;
  ctx.api.setValues = (values) => { written = values; };
  ctx.api.showPrompt = (title, label, placeholder, options, query, callback) => callback("Doldrums (3rd)");
  ctx.addNavalChaseObstacles({ data: { obstacles: [{ name: "Existing" }] } });
  assert("added after what's there", written["data.obstacles"].map((o) => o.name), ["Existing", "Doldrums (3rd)"]);
}

process.exitCode = summary() > 0 ? 1 : 0;
