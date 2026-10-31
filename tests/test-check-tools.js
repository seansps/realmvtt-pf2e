// Tests for the check tools (check-tools.js): Assurance, incapacitation,
// signature spells, counteract checks, and the flat checks and riders of
// stupefied, grabbed, deafened, sickened and confused.
// Run: node tests/test-check-tools.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
new vm.Script(fs.readFileSync(`${__dirname}/../rollhandlers/spells.js`, "utf8"), { filename: "spells.js" }).runInContext(ctx);
const state = ctx.__state;

// The API calls the tools make. Callbacks run right away.
let calls = [];
const log = (call) => calls.push(call);
let prompts = [];
ctx.api.showPrompt = (title, text, placeholder, options, value, cb) => prompts.push({ title, text, options, cb });
let valuePrompts = [];
ctx.api.showValuePrompt = (title, text, cb) => valuePrompts.push({ title, cb });
ctx.api.roll = (formula, metadata, type) => log(["roll", formula, metadata, type]);
ctx.api.promptRoll = (name, formula, modifiers, metadata, type) => log(["promptRoll", formula, metadata, type, modifiers]);
ctx.api.promptRollForToken = (token, name, formula, modifiers, metadata, type) => log(["promptRoll", formula, metadata, type, modifiers]);
ctx.api.removeEffectById = (effectId, token, cb) => {
  log(["remove", effectId, token?._id]);
  if (cb) cb();
};
ctx.api.deductEffectById = (effectId, token, cb) => {
  log(["deduct", effectId, token?._id]);
  if (cb) cb();
};
ctx.api.setValuesOnRecord = (target, values) => log(["setRecord", values]);
ctx.api.setValuesOnTokenById = (id, recordType, values, cb) => {
  log(["set", id, values]);
  if (cb) cb();
};
ctx.api.richTextToMarkdown = (text) => `${text || ""}`;
ctx.api.getValueOnRecord = (target, path) => path.split(".").reduce((value, key) => value?.[key], target);
ctx.getNearestParentDataPath = (path) => `${path}`.replace(/\.data\.[^.]+\.\d+$/, "");
let notices = [];
ctx.api.showNotification = (message) => notices.push(message);
const reset = () => {
  calls = [];
  prompts = [];
  valuePrompts = [];
  notices = [];
  state.messages = [];
};

function runHandler(file, data) {
  state.messages = [];
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
  return state.messages.join("\n");
}

// A token: data, effects as [[effect, stacks]]
function token(data = {}, { id = "pc", name = "Valeros", recordType = "characters", effects = [] } = {}) {
  const t = { _id: id, recordType, name, identified: true, record: { _id: id, name }, effects: [], effectIds: [], effectValues: {}, data: { curhp: 20, hitpoints: 30, ...data } };
  for (const [e, stacks] of effects) {
    t.effects.push(e);
    for (let i = 0; i < (stacks || 1); i++) t.effectIds.push(e._id);
  }
  return t;
}
const condition = (name) => ({ _id: name.toLowerCase(), name, rules: [] });
const promptPick = (index, value) => prompts[index].cb(value);

section("Assurance (Q7)");
{
  const pc = (feats, data = {}) => token({ level: 3, athletics: 1, medicine: 2, feats, ...data });
  assert("named for its skill", ctx.getAssuranceSkills(pc([{ name: "Assurance (Athletics)" }])), { skills: ["athletics"], unassigned: [] });
  const chosen = { name: "Assurance", data: { choices: [{ data: { choices: [JSON.stringify({ name: "Medicine", slug: "medicine" })] } }] } };
  assert("or by the feat's choice", ctx.getAssuranceSkills(pc([chosen])).skills, ["medicine"]);
  assert("no skill recorded: unassigned, with its row", ctx.getAssuranceSkills(pc([{ name: "Power Attack" }, { name: "Assurance" }])).unassigned.map((u) => u.path), ["data.feats.1"]);
  assert("taken twice", ctx.getAssuranceSkills(pc([{ name: "Assurance (Athletics)" }, chosen])).skills, ["athletics", "medicine"]);
  assert("an empty feat slot doesn't count", ctx.getAssuranceSkills(pc([{ name: "Assurance (Athletics)", data: { type: "slot" } }])).skills, []);
  assert("not untrained", ctx.hasAssurance(pc([{ name: "Assurance" }]), "stealth", 0), false);
  assert("10 + proficiency: trained at 3rd is 15", ctx.getAssuranceResult(pc([]), 1), 15);
  assert("... expert at 5th is 19", ctx.getAssuranceResult(token({ level: 5 }), 2), 19);

  // rollSkill: the prompt, then a fixed result through the skill handler
  reset();
  const athlete = pc([{ name: "Assurance (Athletics)" }]);
  ctx.rollSkill(athlete, "Athletics", 15);
  assert("a skill with Assurance: asks first", [prompts.length, calls.length, prompts[0]?.options.map((o) => o.label)], [1, 0, ["Roll the check", "Use Assurance (15)"]]);
  promptPick(0, "assurance");
  assert("Assurance: a result of 15 to the skill handler", [calls[0][0], calls[0][1], calls[0][3], calls[0][2].dc, calls[0][2].assurance], ["roll", "15", "skill", 15, true]);
  assertIncludes("... named so", calls[0][2].rollName, "(Assurance)");
  reset();
  ctx.rollSkill(athlete, "Athletics", 15);
  promptPick(0, ["roll"]);
  assert("Roll: the usual roll", [calls[0][0], calls[0][1]], ["promptRoll", "1d20"]);
  reset();
  ctx.rollSkill(athlete, "Medicine", 15);
  assert("another skill: no prompt", [prompts.length, calls[0][0]], [0, "promptRoll"]);
  reset();
  ctx.rollSkill(athlete, "Athletics", 15, false, 0, 1, "int", false, true);
  assert("initiative: no prompt", prompts.length, 0);

  // An Assurance with no skill: asked once, kept in the feat's choice
  reset();
  const unsure = pc([{ name: "Assurance", data: {} }]);
  ctx.rollSkill(unsure, "Medicine", 15);
  assert("asks which skill, this one first, then the other trained ones", [prompts[0].text, prompts[0].options.map((o) => o.value)], ["Which skill is your Assurance for? You're asked once.", ["medicine", "athletics", "later"]]);
  promptPick(0, "medicine");
  assert("kept as the feat's choice", calls[0], ["setRecord", { "data.feats.0.data.choices": [{ name: "Assurance Skill", data: { choices: ['{"name":"Medicine","slug":"medicine"}'] } }] }]);
  assert("... then this check offers it", prompts[1].title, "Assurance");
  const kept = pc([{ name: "Assurance", data: { choices: [{ data: { choices: ['{"name":"Medicine","slug":"medicine"}'] } }] } }]);
  assert("read back: Medicine", ctx.getAssuranceSkills(kept), { skills: ["medicine"], unassigned: [] });
  reset();
  ctx.rollSkill(unsure, "Athletics", 15);
  promptPick(0, "medicine");
  assert("another skill chosen: this check just rolls", [prompts.length, calls[1][0]], [1, "promptRoll"]);
  reset();
  ctx.rollSkill(unsure, "Athletics", 15);
  promptPick(0, "later");
  assert("Not now: rolls, nothing kept", calls.map((c) => c[0]), ["promptRoll"]);
  const unpicked = { feat: { data: { choices: [{ name: "Skill", data: { choices: [] } }] } }, path: "data.feats.2" };
  assert("a feat with its own empty choice: picked there", ctx.getAssuranceSkillValues(unpicked, "medicine", "Medicine"), { "data.feats.2.data.choices.0.data.choices": ['{"name":"Medicine","slug":"medicine"}'] });

  // The skill handler grades the fixed result: no die, so no natural 20 or 1
  const card = runHandler("skill.js", { roll: { dice: [], total: 15, metadata: { rollName: "Athletics (Assurance)", skillName: "athletics", dc: 15, assurance: true } } });
  assertIncludes("graded against the DC", card, "SUCCESS");
}

section("Incapacitation (Q11)");
{
  const opts = (extra) => ({ traits: ["incapacitation", "mental"], ...extra });
  assert("level 5 against a rank 2 spell: better", ctx.isIncapacitationResisted(token({ level: 5 }), opts({ rank: 2 })), true);
  assert("level 4 against rank 2: not", ctx.isIncapacitationResisted(token({ level: 4 }), opts({ rank: 2 })), false);
  assert("no incapacitation trait: not", ctx.isIncapacitationResisted(token({ level: 9 }), { traits: ["mental"], rank: 1 }), false);
  assert("not a spell: a higher level than the effect", ctx.isIncapacitationResisted(token({ level: 5 }), opts({ level: 4 })), true);
  assert("... the same level isn't", ctx.isIncapacitationResisted(token({ level: 4 }), opts({ level: 4 })), false);

  assertIncludes("the spell's save button carries its rank", ctx.getSaveMacro("will", 20, true, true, ["incapacitation"], false, 2), '"rank":2');
  assertNotIncludes("... only for incapacitation", ctx.getSaveMacro("will", 20, true, true, ["mental"], false), '"rank"');

  reset();
  ctx.rollSave(token({ level: 5, willMod: 8 }, { recordType: "npcs" }), "will", 20, true, true, opts({ rank: 2 }));
  assert("the save knows", calls[0][2].incapacitation, true);
  const save = (natural, total, metadata = {}) => runHandler("save.js", { roll: { dice: [{ type: 20, value: natural }], total, metadata: { rollName: "Will Save", saveType: "will", dc: 20, ...metadata } } });
  assertIncludes("a failure becomes a success", save(10, 15, { incapacitation: true }), "SUCCESS [Incapacitation]");
  assertIncludes("a success a critical success", save(10, 22, { incapacitation: true }), "CRITICAL SUCCESS [Incapacitation]");
  assertIncludes("without it: a failure", save(10, 15), "FAILURE");
  assert("a spell attack: one degree worse", [ctx.applyIncapacitationToAttack(1, { incapacitation: true }).degree, ctx.applyIncapacitationToAttack(-1, { incapacitation: true }).degree], [0, -1]);
  const attack = runHandler("attack.js", { roll: { dice: [{ type: 20, value: 10 }], total: 25, metadata: { rollName: "Spell Attack", dc: 20, incapacitation: true, traits: [] } } });
  assertIncludes("... the card: a hit becomes a miss", attack, "MISS [Incapacitation]");
}

section("Signature spells (Q14)");
{
  const spell = (extra = {}) => ({ _id: "s1", name: "Fear", data: { level: 2, traits: ["Mental"], description: "", ...extra } });
  const caster = (type = "spontaneous", spells2 = [spell({ signature: true })]) => ({
    _id: "sorc",
    name: "Seoni",
    recordType: "characters",
    data: { level: 7, spells: [{ data: { type, mod: 12, usedSpells2: 1, usedSpells3: 0, usedSpells4: 2, spells2 } }] },
    fields: {},
  });
  const path = "data.spells.0.data.spells2.0";
  assert("from its rank up, where a slot is left", ctx.getSignatureRanks(caster(), spell({ signature: true }), path), [2, 4]);
  assert("not a signature spell: none", ctx.getSignatureRanks(caster(), spell(), path), []);
  assert("not spontaneous: none", ctx.getSignatureRanks(caster("prepared"), spell({ signature: true }), path), []);
  assert("a chosen rank wins over the list's", ctx.getCastingRank(caster(), { ...spell(), castRank: 4 }, path), 4);

  reset();
  ctx.castSpell(caster(), spell({ signature: true }), path);
  assert("asks for the rank, the list's own first", [prompts.length, prompts[0].options.map((o) => o.value), calls.length], [1, ["2", "4"], 0]);
  promptPick(0, "4");
  const written = calls.find((c) => c[0] === "setRecord")?.[1] || {};
  assert("cast at rank 4: a rank 4 slot spent", [written["data.spells.0.data.usedSpells4"], "data.spells.0.data.usedSpells2" in written], [1, false]);
  // Only another rank left: still asked, so it isn't cast at the empty one
  const rank1 = { _id: "s2", name: "Command", data: { level: 1, traits: [], description: "", signature: true } };
  const low = { _id: "o", name: "Kyra", recordType: "characters", data: { level: 3, spells: [{ data: { type: "spontaneous", mod: 9, usedSpells1: 0, usedSpells2: 1, spells1: [rank1] } }] }, fields: {} };
  reset();
  ctx.castSpell(low, rank1, "data.spells.0.data.spells1.0");
  assert("rank 1 used up, rank 2 left: the prompt offers rank 2", prompts[0]?.options.map((o) => o.value), ["2"]);
  reset();
  const one = { ...low, data: { ...low.data, spells: [{ data: { ...low.data.spells[0].data, usedSpells1: 2, usedSpells2: 0 } }] } };
  ctx.castSpell(one, rank1, "data.spells.0.data.spells1.0");
  assert("only its own rank: no prompt", prompts.length, 0);

  // The box: only spontaneous rows, not cantrips, only what differs
  const sheet = {
    data: {
      spells: [
        { data: { type: "spontaneous", spells2: [spell(), { data: { type: "slot" } }], cantrips: [{ data: { type: "spell", traits: ["Cantrip"] } }] } },
        { data: { type: "prepared", spells1: [{ data: { type: "spell" }, fields: { signatureBox: { hidden: true } } }, { data: { type: "spell" } }] } },
      ],
    },
  };
  sheet.data.spells[0].data.spells2[0] = { ...spell(), data: { ...spell().data, type: "spell" } };
  assert("the Signature box: shown on spontaneous rows, hidden on the rest, unchanged ones left", ctx.getSignatureBoxValues(sheet), {
    "data.spells.0.data.spells2.0.fields.signatureBox.hidden": false,
    "data.spells.0.data.cantrips.0.fields.signatureBox.hidden": true,
    "data.spells.1.data.spells1.1.fields.signatureBox.hidden": true,
  });

  reset();
  ctx.castSpell(caster(), spell(), path);
  assert("not a signature spell: cast right away", [prompts.length, (calls.find((c) => c[0] === "setRecord")?.[1] || {})["data.spells.0.data.usedSpells2"]], [0, 0]);
}

section("Counteract checks (Q26)");
{
  assert("critical success: up to 3 ranks higher", [ctx.getCounteractOutcome(2, 3, 6), ctx.getCounteractOutcome(2, 3, 7)], [true, false]);
  assert("success: up to 1 higher", [ctx.getCounteractOutcome(1, 3, 4), ctx.getCounteractOutcome(1, 3, 5)], [true, false]);
  assert("failure: only lower", [ctx.getCounteractOutcome(0, 3, 2), ctx.getCounteractOutcome(0, 3, 3)], [true, false]);
  assert("critical failure: never", ctx.getCounteractOutcome(-1, 3, 0), false);
  assert("a creature's rank: half its level, rounded up", [ctx.getCounteractRankForLevel(7), ctx.getCounteractRankForLevel(0)], [4, 0]);

  const check = (total, targetRank) => runHandler("counteract.js", { roll: { dice: [{ type: 20, value: 10 }], total, metadata: { rollName: "Dispel Magic: Counteract", dc: 20, counteractRank: 3, targetRank } } });
  assertIncludes("a success against rank 4: counteracted", check(22, 4), "Counteracted!");
  assertIncludes("... against rank 5: not", check(22, 5), "Not counteracted.");

  // The button: DC, then rank, then the roll
  reset();
  ctx.api.getTargets = () => [{ token: token({ level: 7 }, { id: "orc", name: "Orc", recordType: "npcs" }) }];
  ctx.counteract("Dispel Magic", 3, 12);
  valuePrompts[0].cb("22");
  assertIncludes("the targeted creature's rank first", prompts[0].options[0].label, "Rank 4 (Orc, half its level)");
  promptPick(0, "4");
  assert("then the check", [calls[0][0], calls[0][3], calls[0][2].dc, calls[0][2].counteractRank, calls[0][2].targetRank, calls[0][4][0].value], ["promptRoll", "counteract", 22, 3, 4, 12]);
  ctx.api.getTargets = () => [];

  const dispel = { _id: "d", name: "Dispel Magic", data: { level: 2, traits: [], description: "You attempt to counteract a spell." } };
  const prepared = { _id: "wiz", name: "Ezren", recordType: "characters", data: { level: 5, spells: [{ data: { type: "prepared", mod: 11, spells2: [dispel] } }] }, fields: {} };
  reset();
  ctx.api.getToken = () => ({ _id: "wiz-token", name: "Ezren", effects: [], effectIds: [], data: {} });
  ctx.castSpell(prepared, dispel, "data.spells.0.data.spells2.0");
  ctx.api.getToken = () => null;
  assertIncludes("a spell that counteracts gets the button", state.messages[0], 'counteract("Dispel Magic", 2, 11, {"tokenId":"wiz-token","recordType":"characters","recordId":"wiz","dataPath":"data.spells.0.data.spells2.0","attribute":"int"});');
  const mods = ctx.getCounteractModifiers(null, null, "int", 11);
  assert("without the caster: the base modifier", mods.map((m) => m.value), [11]);
  const lookups = [];
  const original = ctx.getEffectsAndModifiersForToken;
  ctx.getEffectsAndModifiersForToken = (creature, types, field, ...rest) => {
    lookups.push([creature?._id, types, field]);
    return types.includes("allPenalty") && creature?.effects?.length ? [{ name: "Frightened", type: "status", value: -2, active: true }] : [];
  };
  const frightenedNpc = token({}, { id: "npc-tok", recordType: "npcs", effects: [[condition("Frightened"), 2]] });
  assert("with it: checks of the casting attribute and counteract checks (frightened)", ctx.getCounteractModifiers(frightenedNpc, null, "cha", 11).map((m) => [m.name, m.value]), [["Spell Attack Modifier", 11], ["Frightened", -2]]);
  assert("... no spell attack roll lookup", lookups.map((l) => [l[1], l[2]]), [[["allBonus", "allPenalty"], ["cha", "counteract"]]]);

  // On click: the caster's token (an unlinked NPC's conditions), else the record
  reset();
  lookups.length = 0;
  ctx.api.getOtherTokens = () => [{ token: frightenedNpc }];
  let fetched = 0;
  ctx.api.getRecord = () => fetched++;
  ctx.counteract("Dispel Magic", 3, 12, { tokenId: "npc-tok", recordType: "npcs", recordId: "npc", attribute: "cha" });
  valuePrompts[0].cb("20");
  promptPick(0, "3");
  assert("the token is read, not the record", [lookups[0][0], fetched, calls[0][4].map((m) => m.value)], ["npc-tok", 0, [12, -2]]);
  reset();
  ctx.api.getOtherTokens = () => [];
  ctx.counteract("Dispel Magic", 3, 12, { tokenId: "gone", recordType: "npcs", recordId: "npc", attribute: "cha" });
  valuePrompts[0].cb("20");
  promptPick(0, "3");
  assert("no token on the scene: the record", fetched, 1);
  ctx.getEffectsAndModifiersForToken = original;
  ctx.api.getRecord = () => {};
}

section("Stupefied, grabbed, deafened (Q25)");
{
  const spell = (traits) => ({ name: "Fear", data: { traits } });
  const stupefied = token({}, { effects: [[condition("Stupefied"), 2]] });
  assert("stupefied 2: DC 7", ctx.getCastingFlatChecks(stupefied, spell(["Concentrate"])), [{ name: "Stupefied 2", dc: 7 }]);
  const grabbed = token({}, { effects: [[condition("Grabbed"), 1]] });
  assert("grabbed: a manipulate spell, DC 5", ctx.getCastingFlatChecks(grabbed, spell(["Manipulate"])), [{ name: "Grabbed", dc: 5 }]);
  assert("... not one without manipulate", ctx.getCastingFlatChecks(grabbed, spell(["Concentrate"])), []);
  const deafened = token({}, { effects: [[condition("Deafened"), 1]] });
  assert("deafened: an auditory spell", ctx.getCastingFlatChecks(deafened, spell(["Auditory"])), [{ name: "Deafened", dc: 5 }]);

  reset();
  ctx.rollCastingFlatChecks(stupefied, spell([]));
  assert("rolled as a flat check", [calls[0][1], calls[0][3], calls[0][2].dc], ["1d20", "flatCheck", 7]);
  const flat = (total, metadata) => runHandler("flatCheck.js", { roll: { dice: [{ type: 20, value: total }], total, metadata: { dc: 7, ...metadata } } });
  assertIncludes("a failure: the spell is disrupted", flat(4, { failureNote: "Fear is disrupted." }), "Fear is disrupted.");
  assertNotIncludes("a success says nothing of it", flat(12, { failureNote: "Fear is disrupted." }), "disrupted");

  // castSpell rolls it, for the sheet's token
  const fear = { _id: "f", name: "Fear", data: { level: 1, traits: ["Concentrate"], description: "" } };
  const oracle = { _id: "ora", name: "Kyra", recordType: "characters", data: { level: 3, spells: [{ data: { type: "spontaneous", mod: 9, usedSpells1: 2, spells1: [fear] } }] }, fields: {} };
  ctx.api.getToken = () => token({}, { id: "ora", effects: [[condition("Stupefied"), 1]] });
  reset();
  ctx.castSpell(oracle, fear, "data.spells.0.data.spells1.0");
  const rolled = calls.find((c) => c[0] === "roll");
  assert("casting while stupefied 1: the DC 6 flat check", [rolled?.[3], rolled?.[2].dc], ["flatCheck", 6]);
  ctx.api.getToken = () => null;

  const sheetToken = token({}, { id: "pc", effects: [[condition("Stupefied"), 1]] });
  assert("the sheet's own token counts", ctx.getCastingCreature({ _id: "pc" }, sheetToken), sheetToken);
  assert("someone else's token doesn't", ctx.getCastingCreature({ _id: "pc2", name: "x" }, sheetToken)._id, "pc2");
}

section("Sickened and confused (Q25)");
{
  assertIncludes("Retch, a success: lower by 1", ctx.getRetchLine({ retch: true, saverTokenId: "pc" }, 1), "Reduce_Sickened_by_1");
  assertIncludes("... a critical success: by 2", ctx.getRetchLine({ retch: true, saverTokenId: "pc" }, 2), "reduceSickened(token, 2)");
  assert("a failure: nothing", ctx.getRetchLine({ retch: true }, 0), "");
  reset();
  const sick = token({}, { effects: [[condition("Sickened"), 3]] });
  ctx.reduceSickened(sick, 2);
  assert("two stacks off", calls.filter((c) => c[0] === "deduct").length, 2);
  assertIncludes("... sickened 1", state.messages[0], "sickened 1");
  reset();
  ctx.api.getSelectedOrDroppedToken = () => [sick];
  ctx.retch();
  valuePrompts[0].cb("18");
  assert("Retch rolls Fortitude against the DC", [calls[0][0], calls[0][2].dc, calls[0][2].retch], ["promptRoll", 18, true]);
  ctx.api.getSelectedOrDroppedToken = () => [];
  assertIncludes("the save card has the button", runHandler("save.js", { roll: { dice: [{ type: 20, value: 15 }], total: 20, metadata: { rollName: "Fortitude Save", saveType: "fortitude", dc: 18, retch: true, saverTokenId: "pc" } } }), "Reduce_Sickened_by_1");

  const potion = { name: "Healing Potion", data: { traits: ["Consumable", "Healing", "Potion"] } };
  assertIncludes("sickened: a reminder before a potion", ctx.getSickenedDrinkWarning(sick, potion), "can't willingly drink Healing Potion");
  assert("not sickened: none", ctx.getSickenedDrinkWarning(token(), potion), "");
  assert("not a drink: none", ctx.getSickenedDrinkWarning(sick, { name: "Rope", data: { traits: [] } }), "");

  const confused = token({ curhp: 20, hitpoints: 30 }, { id: "orc", name: "Orc", recordType: "npcs", effects: [[condition("Confused"), 1]] });
  reset();
  ctx.applyDamage(confused, { types: [{ die: 6, value: 5, type: "slashing" }], dice: [{ type: 6, value: 5 }], total: 5, metadata: { traits: [], damageCategories: [], damageType: "slashing" } }, false, null, false);
  assertIncludes("confused and damaged: the recovery button", state.messages[state.messages.length - 1], "Recover_from_Confused_(DC_11)");
  assert("not for persistent damage", ctx.getConfusedRecoveryButton(confused, { metadata: { isPersistant: true } }), "");
  ctx.api.getToken = () => confused;
  reset();
  const recovered = runHandler("flatCheck.js", { roll: { dice: [{ type: 20, value: 14 }], total: 14, metadata: { dc: 11, tokenId: "orc", endsCondition: "confused" } } });
  assert("a success ends it", calls[0], ["remove", "confused", "orc"]);
  assertIncludes("... and says so", recovered, "Orc is no longer confused");
  ctx.api.getToken = () => null;
}

process.exitCode = summary() > 0 ? 1 : 0;
