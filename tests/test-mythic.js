// Tests for the mythic rules (mythic.js, roadmap B8): who is mythic, Mythic
// Points, mythic proficiency, Rewrite Fate, mythic dying, feat slots and
// recovering points (War of Immortals pg. 76-79).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let setting = "yes";
ctx.api.getSetting = (key) => (key === "mythicRules" ? setting : undefined);

const calling = { name: "Hunter's Calling", data: { type: "calling" } };

const hero = (extra = {}, recordExtra = {}) => ({
  _id: "tok-1",
  recordId: "char-1",
  name: "Amiri",
  recordType: "characters",
  ...recordExtra,
  data: {
    level: 5,
    heroPoints: 3,
    features: [calling],
    athletics: 2,
    athleticsMod: 12,
    will: 3,
    willMod: 14,
    ...extra,
  },
});

const sent = [];
const writes = [];
const records = [];
const effects = [];
const notes = [];
const prompts = [];
function reset() {
  setting = "yes";
  sent.length = writes.length = records.length = effects.length = notes.length = prompts.length = 0;
  ctx.api.sendMessage = (text) => sent.push(text);
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push({ id, type, values });
  ctx.api.setValuesOnRecord = (record, values) => records.push({ id: record._id, values });
  ctx.api.addEffects = (list) => effects.push(...list);
  ctx.api.addEffect = (name) => effects.push(name);
  ctx.api.showNotification = (text) => notes.push(text);
  ctx.api.getToken = () => null;
  ctx.api.getSelectedTokens = () => [];
  ctx.api.promptRollForToken = (record, title, formula, modifiers, metadata, type) =>
    prompts.push({ title, modifiers, metadata, type });
  ctx.api.promptRoll = (title, formula, modifiers, metadata, type) =>
    prompts.push({ title, modifiers, metadata, type });
  ctx.isGM = true;
}

section("who is mythic");
{
  reset();
  assert("a Calling and the setting", ctx.isMythicCreature(hero()), true);
  assert("a feature with the Calling trait", ctx.isMythicCreature(hero({ features: [{ data: { traits: ["Calling"] } }] })), true);
  assert(
    "a Calling dropped on the class",
    ctx.isMythicCreature(hero({ features: [], classes: [{ data: { features: [calling] } }] })),
    true,
  );
  assert("no Calling", ctx.isMythicCreature(hero({ features: [] })), false);
  setting = "no";
  assert("the setting off", ctx.isMythicCreature(hero()), false);
  setting = "yes";
  assert("an NPC isn't", ctx.isMythicCreature(hero({}, { recordType: "npcs" })), false);
}

section("Mythic Points on the Hero Points counter");
{
  reset();
  assert("label", ctx.getHeroPointsLabel(hero()), "Mythic Points");
  assert("label, not mythic", ctx.getHeroPointsLabel(hero({ features: [] })), "Hero Points");
  assert("3 at session start, with the label", ctx.getSessionStartValues(hero()), {
    "data.heroPoints": 3,
    "data.heroPtsLabel": "Mythic Points",
  });
  assert("1 otherwise, no label write", ctx.getSessionStartValues(hero({ features: [] })), { "data.heroPoints": 1 });
  assert(
    "a Calling that's gone resets the label",
    ctx.getSessionStartValues(hero({ features: [], heroPtsLabel: "Mythic Points" })),
    { "data.heroPoints": 1, "data.heroPtsLabel": "Hero Points" },
  );
  assert("no Heroic Recovery for a mythic character", ctx.canSpendHeroPoint(hero()), false);
  assert("Heroic Recovery otherwise", ctx.canSpendHeroPoint(hero({ features: [] })), true);
}

section("mythic proficiency");
{
  reset();
  const expert = ctx.getMythicProficiencyModifier(hero(), 2);
  assert("expert at 5: 15 less 9", [expert.name, expert.value, expert.active], ["Mythic Proficiency", 6, false]);
  assert("untrained at 5: the full 15", ctx.getMythicProficiencyModifier(hero(), 0).value, 15);
  assert("legendary: +2", ctx.getMythicProficiencyModifier(hero(), 4).value, 2);
  assert("can be forced on", ctx.getMythicProficiencyModifier(hero(), 2, true).active, true);
  assert("not mythic: none", ctx.getMythicProficiencyModifier(hero({ features: [] }), 2), null);
  assert(
    "without level, one step above legendary",
    ctx.getMythicProficiencyBonus(5, { proficiencyWithoutLevel: true }),
    10,
  );

  ctx.rollSave(hero(), "will", 20, false, true);
  const toggle = prompts[0].modifiers.find((m) => m.name === "Mythic Proficiency");
  assert("a save's prompt offers it, off", [toggle.value, toggle.active], [4, false]);
}

section("Rewrite Fate");
{
  reset();
  ctx.rollSkill(hero(), "athletics", 20, false, 0, 1, "int", true, false, undefined, { action: "Force Open" });
  const first = prompts[0];
  assert("a skill check carries the button", !!first.metadata.rewriteFate, true);

  const lines = ctx.getRewriteFateLines(first.metadata, {});
  assert("the call has an id for this roll", JSON.parse(decodeURIComponent(first.metadata.rewriteFate.call)).rollId.length > 0, true);
  assertIncludes("the card's button", lines[0], "Rewrite_Fate");
  assertIncludes("the button's call", lines[0], "rewriteFate(token,");

  ctx.rewriteFate(hero(), first.metadata.rewriteFate.call);
  const again = prompts[1];
  const on = again.modifiers.find((m) => m.name === "Mythic Proficiency");
  assert("rerolled with mythic proficiency on", [on.value, on.active], [6, true]);
  assert("keeps the DC and the action", [again.metadata.dc, again.metadata.action], [20, "Force Open"]);
  assert("no point spent until the result", writes.length, 0);
  assert("no second button", again.metadata.rewriteFate, undefined);

  // The result reads the character as it is now
  let stored = hero({ heroPoints: 2 }, { _id: "char-1" });
  ctx.api.getRecord = (type, id, cb) => cb(id === "char-1" ? stored : null);
  const spent = ctx.getRewriteFateLines(again.metadata, {});
  const rollId = again.metadata.rewriteFateSpend.rollId;
  assert("the result spends one from what's there now", records[0], {
    id: "char-1",
    values: { "data.heroPoints": 1, "data.rewriteFateRollId": rollId },
  });
  assertIncludes("and says so", spent[0], "spending a Mythic Point");

  // Once per roll: the original button again, and a second prompt's result
  stored = hero({ heroPoints: 1, rewriteFateRollId: rollId }, { _id: "char-1" });
  const before = prompts.length;
  ctx.rewriteFate(hero({ heroPoints: 1, rewriteFateRollId: rollId }), first.metadata.rewriteFate.call);
  assert("the button again is refused", [prompts.length - before, notes.pop()], [0, "Rewrite Fate was already used on this check."]);
  records.length = 0;
  ctx.getRewriteFateLines(again.metadata, {});
  assert("a second prompt's result spends nothing", records.length, 0);
  assertIncludes("and says it doesn't count", sent.pop(), "doesn't count and no point is spent");
  stored = hero({ heroPoints: 0 }, { _id: "char-1" });
  ctx.getRewriteFateLines(again.metadata, {});
  assert("nor with no points left", records.length, 0);

  // A result rolled with a fortune effect already has its one
  const d20 = (kept, dropped) => ({ dice: [{ type: 20, value: kept }, { type: 20, value: dropped, reason: "dropped" }] });
  assert("no button after keep-higher", ctx.getRewriteFateLines(first.metadata, d20(15, 4)), []);
  assert("a button after keep-lower (misfortune)", ctx.getRewriteFateLines(first.metadata, d20(4, 15)).length, 1);
  assert("a tie goes by what was offered", ctx.getRewriteFateLines({ rewriteFate: { ...first.metadata.rewriteFate, fortune: true } }, d20(9, 9)), []);
  assert("a single die", ctx.getRewriteFateLines(first.metadata, { dice: [{ type: 20, value: 9 }] }).length, 1);

  reset();
  ctx.rollSave(hero(), "will", 20, false, true, { troopRout: { level: 3 } });
  const save = prompts[0];
  ctx.rewriteFate(hero(), save.metadata.rewriteFate.call);
  assert("a save keeps its options", prompts[1].metadata.troopRout, { level: 3 });
  assert("a save's reroll is on", prompts[1].modifiers.find((m) => m.name === "Mythic Proficiency").active, true);

  reset();
  ctx.rollSkill(hero({ perceptionMod: 5, perception: 2 }), "perception", 20, false, 0, 1, "int", true);
  assert("not Perception", prompts[0].metadata.rewriteFate, undefined);
  reset();
  ctx.rollSkill(hero(), "athletics", 20, false, 0, 1, "int", true, true);
  assert("not initiative", prompts[0].metadata.rewriteFate, undefined);
  reset();
  ctx.rollSkill(hero({ heroPoints: 0 }), "athletics", 20, false, 0, 1, "int", true);
  assert("no button at 0 points", prompts[0].metadata.rewriteFate, undefined);

  reset();
  ctx.rewriteFate(hero({ heroPoints: 0 }), "x");
  assert("refused with none", [prompts.length, notes[0]], [0, "Amiri has no Mythic Points."]);
}

section("the context-menu reroll");
{
  reset();
  const fs = require("fs");
  const vm = require("vm");
  const src = fs.readFileSync(`${__dirname}/../rollhandlers/onReroll.js`, "utf8");
  const run = (record) => {
    ctx.data = { roll: { metadata: { recordId: "char-1", recordType: "characters" } }, record };
    return vm.runInContext(`(function(){${src}})()`, ctx);
  };
  assert("a mythic character's is refused", [run(hero()).success, writes.length, records.length], [false, 0, 0]);
  assert("and it points to the button", notes[0].includes("Rewrite Fate"), true);
  const other = hero({ features: [] });
  assert("anyone else's still spends", [run(other).success, records[0].values], [true, { "data.heroPoints": 2 }]);
}

section("mythic dying");
{
  reset();
  const dying3 = hero({ dying: 3, wounded: 1, curhp: 0 });
  const result = ctx.getMythicDeathResult(dying3);
  assert("doomed 1, not dead, wounded up", result, { doomed: 1, dead: false, wounded: 2 });

  ctx.getDoomedValue = () => 3;
  assert("the fourth doomed kills", ctx.getMythicDeathResult(dying3).dead, true);
  ctx.getDoomedValue = () => 0;

  const values = {};
  const old = {};
  const changes = ctx.getZeroHitPointsChanges(dying3, { valuesToSet: values, oldValues: old });
  assert("damage: dying goes to 0", [values["data.dying"], values["data.wounded"]], [0, 2]);
  assert("the undo keeps wounded", old["data.wounded"], 1);
  assert("gains Doomed, not Dead", [effects.includes("Doomed"), effects.includes("Dead")], [true, false]);
  assertIncludes("says so", changes.lines.join(" "), "Doomed 1, stable at 0 HP");

  const check = ctx.getRecoveryCheckResult(dying3, 0);
  assert("a failed recovery check too", [check.dead, check.values["data.dying"], check.mythicDeath.doomed], [false, 0, 1]);

  reset();
  const plain = hero({ dying: 3, curhp: 0, features: [] });
  const plainValues = {};
  ctx.getZeroHitPointsChanges(plain, { valuesToSet: plainValues, oldValues: {} });
  assert("anyone else dies", [effects.includes("Dead"), effects.includes("Doomed")], [true, false]);
  assert("recovery check too", ctx.getRecoveryCheckResult(plain, 0).dead, true);
}

section("mythic feat slots");
{
  reset();
  const variants = { ...ctx.getVariantRules(), mythic: true };
  const character = hero({ classes: [{ data: { classFeatLevels: [1, 2] } }] });
  assert("even levels", ctx.getFeatSlotLevels(character, variants).mythic, [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  assert(
    "none without a Calling",
    ctx.getFeatSlotLevels(hero({ features: [], classes: character.data.classes }), variants).mythic,
    [],
  );
  assert("none with the setting off", ctx.getFeatSlotLevels(character, { ...variants, mythic: false }).mythic, []);
  ctx.api.getSetting = (key) => (key === "mythicRules" ? "yes" : undefined);
  assert("level up asks for it", ctx.getLevelUpGains(character, 4).featTypes.includes("mythic"), true);
  assert("not at an odd level", ctx.getLevelUpGains(character, 5).featTypes.includes("mythic"), false);
  const query = ctx.getFeatSlotQuery(character, "mythic", 4).query;
  assert("the picker asks for the Mythic trait", query["data.traits"].$elemMatch.$regex, "^Mythic$");
  assert("and no feat type", query["data.type"], undefined);
}

section("recovering points");
{
  reset();
  const slayer = hero({ heroPoints: 0 });
  slayer._id = "char-1";
  const other = hero({ heroPoints: 2 });
  other._id = "char-2";
  const token = hero();
  ctx.api.getSelectedTokens = () => [{ token }];
  ctx.api.getParty = (cb) => cb([slayer, other, hero({ features: [] })]);
  ctx.awardMythicSlaying();
  assert(
    "2 to the slayer, 1 to the others, mythic only",
    records.map((r) => [r.id, r.values["data.heroPoints"]]),
    [["char-1", 2], ["char-2", 3]],
  );

  reset();
  ctx.api.getParty = (cb) => cb([slayer, other]);
  ctx.awardMythicDeed();
  assert("a deed fills them, at most 3", records.map((r) => r.values["data.heroPoints"]), [3, 3]);

  reset();
  ctx.api.getSelectedTokens = () => [{ token }];
  ctx.loseMythicPoints();
  assert("an anathema empties them", writes[0].values, { "data.heroPoints": 0 });

  reset();
  ctx.api.getSelectedTokens = () => [{ token: hero({ heroPoints: 1 }) }];
  ctx.awardHeroPoint();
  assertIncludes("+1 says Mythic Point", sent[0], "gains a Mythic Point (2)");

  reset();
  ctx.api.getParty = (cb) => cb([slayer, hero({ features: [] })]);
  ctx.startHeroPointSession();
  assert("session start writes each", records.map((r) => r.values["data.heroPoints"]), [3, 1]);
  assertIncludes("session message", sent[0], "start with 3 Mythic Points");
  assertIncludes("session message, others", sent[0], "start with 1 Hero Point");
}

summary();
