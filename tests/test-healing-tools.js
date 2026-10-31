// Tests for the healing tools (healing-tools.js): Treat Wounds and Battle
// Medicine immunity, persistent damage, rest options and watches, and fast
// healing, regeneration and ferocity.
// Run: node tests/test-healing-tools.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

// The API calls the tools make. Callbacks run right away.
let calls = [];
const log = (call) => calls.push(call);
ctx.api.removeEffectById = (effectId, token, cb, options) => {
  log(["remove", effectId, token?._id, options?.instanceIndex]);
  if (cb) cb();
};
ctx.api.addEffect = (name, token, duration, value) => log(["add", name, token?._id, value]);
ctx.api.addEffects = (names, token) => log(["add", ...names, token?._id]);
ctx.api.setValuesOnTokenById = (id, recordType, values, cb) => {
  log(["set", id, values]);
  if (cb) cb();
};
let notices = [];
ctx.api.showNotification = (message) => notices.push(message);
let selected = [];
ctx.api.getSelectedOrDroppedToken = () => selected;
const reset = () => {
  calls = [];
  notices = [];
  state.messages = [];
};

const TW = { _id: "tw", name: "Treat Wounds Immunity", rules: [] };
const BM = { _id: "bm", name: "Battle Medicine Immunity", rules: [] };
const PD = { _id: "pd", name: "Persistent Damage", rules: [{ type: "persistentDamage" }] };

// A token: data, effects as [[effect, value-or-values]]
function token(data = {}, { id = "pc", name = "Valeros", recordType = "characters", effects = [] } = {}) {
  const t = { _id: id, recordType, name, identified: true, record: { name }, effects: [], effectIds: [], effectValues: {}, data: { curhp: 10, hitpoints: 30, ...data } };
  for (const [e, values] of effects) {
    t.effects.push(e);
    const list = Array.isArray(values) ? values : [values];
    list.forEach(() => t.effectIds.push(e._id));
    if (values !== undefined) t.effectValues[e._id] = list.length > 1 ? list : list[0];
  }
  return t;
}

section("Treat Wounds and Battle Medicine immunity (Q6)");
{
  const healer = token({}, { id: "kyra", name: "Kyra" });
  const patient = token({}, { id: "val" });
  assert("no immunity yet", ctx.findMedicineImmunity(patient, "treatWounds", "kyra"), null);
  const treated = token({}, { id: "val", effects: [[TW, { value: 1, tokenId: "other", tokenName: "Ezren" }]] });
  assert("Treat Wounds immunity counts from any healer", ctx.findMedicineImmunity(treated, "treatWounds", "kyra")?._id, "tw");
  const fromEzren = token({}, { id: "val", effects: [[BM, { value: 1, tokenId: "ezren", tokenName: "Ezren" }]] });
  assert("Battle Medicine immunity from Ezren doesn't stop Kyra", ctx.findMedicineImmunity(fromEzren, "battleMedicine", "kyra"), null);
  assert("... but stops Ezren", ctx.findMedicineImmunity(fromEzren, "battleMedicine", "ezren")?._id, "bm");
  const both = token({}, { id: "val", effects: [[BM, [{ value: 1, tokenId: "ezren" }, { value: 1, tokenId: "kyra" }]]] });
  assert("two instances, as the platform stores them: Kyra's is found", ctx.findMedicineImmunity(both, "battleMedicine", "kyra")?._id, "bm");
  const unknown = token({}, { id: "val", effects: [[BM, undefined]] });
  assert("an instance with no applier counts (added by hand)", ctx.findMedicineImmunity(unknown, "battleMedicine", "kyra")?._id, "bm");

  assertIncludes("the warning names the patient and the healer", ctx.getMedicineImmunityWarning([{ token: both }], "battleMedicine", healer), "Valeros is still immune to Kyra's Battle Medicine (1 day)");
  assert("no warning when not immune", ctx.getMedicineImmunityWarning([patient], "treatWounds", healer), "");

  reset();
  const medicine = { kind: "battleMedicine", label: "Battle Medicine", healerId: "kyra", healerName: "Kyra" };
  assert("the immunity is added", ctx.applyMedicineImmunity(patient, medicine), true);
  assert("... with Kyra as applier", calls[0], ["add", "Battle Medicine Immunity", "val", { value: 1, _id: "kyra", name: "Kyra" }]);
  reset();
  assert("not twice (the healing and the card's button both call it)", ctx.applyMedicineImmunity(both, medicine), false);
  assert("... nothing added", calls, []);

  // The healing adds it, and Battle Medicine's healing keeps wounded
  reset();
  ctx.applyHealingToToken(token({ curhp: 10, wounded: 2 }, { id: "val" }), 8, { medicine, action: "Battle Medicine" });
  assert("Battle Medicine healing: HP, wounded stays", calls[0], ["set", "val", { "data.curhp": 18 }]);
  assert("then the immunity", calls[1][1], "Battle Medicine Immunity");
  reset();
  ctx.applyHealingToToken(token({ curhp: 10, wounded: 2 }, { id: "val" }), 8, { treatWounds: true, medicine: { kind: "treatWounds", healerId: "kyra" } });
  assert("Treat Wounds healing ends wounded", calls[0][2]["data.wounded"], 0);
  assert("and adds its 1-hour immunity", calls[1][1], "Treat Wounds Immunity");

  const card = ctx.getMedicineImmunityButton(medicine);
  assertIncludes("the result card's button", card, "```Apply_Battle_Medicine_Immunity");
  assertIncludes("... for the selected or dropped patient", card, 'applyMedicineImmunityToSelected({"kind":"battleMedicine"');

  const featCard = ctx.getSkillActionMacros({ name: "Battle Medicine", data: { description: "" } });
  assertIncludes("the Battle Medicine feat's card gets a button", featCard, "battleMedicine();");
}

section("Persistent damage (Q12)");
{
  assert("2d6 fire", ctx.parsePersistentDamage("2d6 fire"), { formula: "2d6", type: "fire" });
  assert("average of 2d6+3 is 10", ctx.getFormulaAverage("2d6+3"), 10);
  assert("average of 5 is 5", ctx.getFormulaAverage("5"), 5);
  const burning = token({}, { effects: [[PD, [{ value: "1d6 fire", tokenId: "a" }, { value: "1d4 bleed", tokenId: "b" }]]] });
  assert("a lower fire doesn't add", ctx.getPersistentStackChange(burning, "1d4 fire"), { add: false, removeIndex: null, kept: "1d6 fire" });
  assert("an equal one doesn't either", ctx.getPersistentStackChange(burning, "1d6 fire").add, false);
  assert("a higher fire replaces the lower one", ctx.getPersistentStackChange(burning, "2d6 fire"), { add: true, removeIndex: 0, kept: null });
  assert("another type adds", ctx.getPersistentStackChange(burning, "1d6 acid"), { add: true, removeIndex: null, kept: null });
  assert("several types in one add as they are", ctx.getPersistentStackChange(burning, "1d6 fire, 1d4 acid").add, true);

  // applyPersistentDamage: the lower one is removed, then the higher added
  reset();
  selected = [burning];
  ctx.applyPersistentDamage("2d6 fire", "orc", "Orc");
  assert("remove the 1d6 fire instance, then add", calls.map((c) => c[0] + ":" + (c[0] === "remove" ? c[3] : c[1])), ["remove:0", "add:Persistent Damage"]);
  reset();
  ctx.applyPersistentDamage("1d4 fire", "orc", "Orc");
  assert("a lower one: nothing added", calls, []);
  assertIncludes("... and the chat says why", state.messages[0], "already takes 1d6 fire persistent damage");
  selected = [];

  assertIncludes("help is a flat DC 10", ctx.getPersistentAssistButton(1, "orc1"), '"dc":10');
  assertIncludes("... whatever the recovery DC", ctx.getPersistentRecoveryOutput(5, 1, "orc1"), "```Assisted_Recovery_(DC_10)");
  const output = ctx.getPersistentRecoveryOutput(15, 1, "orc1");
  assertIncludes("the recovery button", output, "```Roll_Recovery");
  assertIncludes("and the help button", output, "```Assisted_Recovery_(DC_10)");
  let rolled = null;
  ctx.api.roll = (formula, metadata, type) => (rolled = [formula, metadata.dc, metadata.tokenId, type]);
  ctx.api.getSetting = (key) => (key === "persistentRecoveryRoll" ? "auto" : null);
  const auto = ctx.getPersistentRecoveryOutput(15, 1, "orc1");
  assert("with the setting on: rolled now, for that token", rolled, ["1d20", 15, "orc1", "flatCheck"]);
  assertNotIncludes("... no recovery button", auto, "Roll_Recovery");
  assertIncludes("... the help button stays", auto, "Assisted_Recovery");
  ctx.api.getSetting = () => null;
  ctx.api.roll = () => {};

  // Bleed ends at full Hit Points
  const bleeding = token({ curhp: 25, hitpoints: 30 }, { effects: [[PD, [{ value: "1d4 bleed" }, { value: "1d6 fire" }, { value: "2 bleed" }]]] });
  assert("the bleed instances, highest index first", ctx.getPersistentBleedIndexes(bleeding), [2, 0]);
  reset();
  ctx.applyHealingToToken(bleeding, 10);
  assert("healed to full: both bleeds removed, the fire stays", calls.filter((c) => c[0] === "remove").map((c) => c[3]), [2, 0]);
  assertIncludes("the chat line says so", state.messages[0], "persistent bleed ends");
  reset();
  ctx.applyHealingToToken(bleeding, 2);
  assert("not at full: the bleed stays", calls.filter((c) => c[0] === "remove"), []);
}

section("Rest (Q28)");
{
  assert("a normal night: the full amount", ctx.getRestHealingAmount(12, {}), 12);
  assert("no shelter: half", ctx.getRestHealingAmount(12, { noShelter: true }), 6);
  assert("... at least 1", ctx.getRestHealingAmount(1, { noShelter: true }), 1);
  assert("3 days of long-term rest: double each day", ctx.getRestHealingAmount(12, { days: 3 }), 72);
  const plate = { data: { type: "armor", carried: "equipped", traits: ["Bulwark"] } };
  const comfy = { data: { type: "armor", carried: "equipped", traits: ["Comfort"] } };
  assert("slept in armor: fatigued", ctx.isRestFatiguing({ data: { inventory: [plate] } }, { armor: true }), true);
  assert("... not in comfort armor", ctx.isRestFatiguing({ data: { inventory: [comfy] } }, { armor: true }), false);
  assert("... not when the option isn't ticked", ctx.isRestFatiguing({ data: { inventory: [plate] } }, {}), false);
  // The prompt: one choice, normal first; the days only for long-term rest
  let prompts = [];
  ctx.api.showPrompt = (title, text, placeholder, options, value, cb, ok, cancel, max) => prompts.push({ title, options, cb, max });
  let rested = [];
  ctx.showRestOptions({}, (options) => rested.push(options));
  assert("one prompt, a single choice, a normal night first", [prompts.length, prompts[0].max, prompts[0].options[0].label], [1, 1, "Normal night's rest"]);
  prompts[0].cb("normal");
  assert("a normal night: no second prompt", [prompts.length, rested[0]], [1, { noShelter: false, armor: false, days: 0 }]);
  prompts[0].cb(["noShelterArmor"]);
  assert("no shelter, in armor", rested[1], { noShelter: true, armor: true, days: 0 });
  prompts[0].cb("longTerm");
  assert("long-term rest: then the days", [prompts.length, prompts[1].title, rested.length], [2, "Long-Term Rest", 2]);
  prompts[1].cb("3");
  assert("... 3 days", rested[2], { noShelter: false, armor: false, days: 3 });

  assertIncludes("the chat reminds the GM to advance the calendar", ctx.getRestOptionNotes({}, { days: 2 }).join(" "), "Long-term rest, 2 days: advance the calendar");

  assert("watches for 4: 10 hours 40 minutes, 2 hours 40 each", ctx.getWatchSchedule(4), { totalMinutes: 640, watchMinutes: 160 });
  assert("for 2: 16 hours, 8 each", ctx.getWatchSchedule(2), { totalMinutes: 960, watchMinutes: 480 });
  assert("for 6: 9 hours 36 minutes", ctx.getWatchSchedule(6).totalMinutes, 576);
  const party = ["Valeros", "Kyra", "Ezren", "Merisiel"].map((name, i) => token({ perceptionMod: i }, { id: name, name }));
  const watch = ctx.getWatchOrderMessage(party);
  assertIncludes("the watch order", watch, "4 on watch, 10 hours, 40 minutes in all, each watch 2 hours, 40 minutes");
  assertIncludes("... with each watch's start", watch, "3. Ezren (Perception +2), from 5 hours, 20 minutes");
  assertIncludes("... and who's on watch, at random", watch, "```Who_Is_on_Watch");
  assertIncludes("one alone can't keep watch", ctx.getWatchOrderMessage([party[0]]), "at least 2");
}

section("Fast healing, regeneration and ferocity (Q10)");
{
  const troll = (data = {}, extra = {}) =>
    token({ curhp: 50, hitpoints: 125, hpDetails: "regeneration 20 (deactivated by electricity or fire)", ...data }, { id: "troll", name: "Forest Troll", recordType: "npcs", ...extra });
  assert("the Forest Troll's regeneration", ctx.getSelfHealing(troll()), { fastHealing: 0, regeneration: 20, deactivatedBy: ["electricity", "fire"] });
  const imp = token({ hpDetails: "fast healing 2" }, { recordType: "npcs" });
  assert("fast healing", ctx.getSelfHealing(imp).fastHealing, 2);
  const byAction = token({ actions: [{ name: "Regeneration 15 (Deactivated by Acid)" }] }, { recordType: "npcs" });
  assert("from an ability's name too", ctx.getSelfHealing(byAction), { fastHealing: 0, regeneration: 15, deactivatedBy: ["acid"] });
  assert("characters: none", ctx.getSelfHealing(token({ hpDetails: "fast healing 5" })).fastHealing, 0);

  // Turn start: a card for the GM, nothing healed on its own; once per round
  reset();
  ctx.runTurnStartSelfHealing(troll(), 3);
  assert("turn start: only the round is written", calls, [["set", "troll", { "data.selfHealRound": 3 }]]);
  assertIncludes("... the card says what deactivates it, to the GM only", state.messages[0], "Regeneration 20[gm] (deactivated by electricity or fire)[/gm], unless deactivated.");
  assertIncludes("... with an Apply Healing button", state.messages[0], "```Apply_Healing");
  assertIncludes("... that heals through applyHealingToToken", state.messages[0], 'applyHealingToToken(token, 20, {"source":"regeneration 20"})');
  reset();
  ctx.runTurnStartSelfHealing(troll({ selfHealRound: 3 }), 3);
  assert("not again in the same round", [calls, state.messages], [[], []]);
  reset();
  ctx.runTurnStartSelfHealing(troll({ curhp: 125 }), 4);
  assert("no card at full Hit Points", [calls, state.messages], [[], []]);
  reset();
  ctx.runTurnStartSelfHealing(token({ curhp: 3, hitpoints: 10, hpDetails: "fast healing 2" }, { id: "imp", name: "Imp", recordType: "npcs" }), 2);
  assertIncludes("fast healing works the same way", state.messages[0], "Fast healing 2.");
  reset();
  ctx.runTurnStartSelfHealing(token({ curhp: 3, hitpoints: 10, hpDetails: "fast healing 2, regeneration 5 (deactivated by acid)" }, { id: "both", name: "Both", recordType: "npcs" }), 2);
  assert("both: a button for each", ["Apply_Fast_Healing", "Apply_Regeneration"].every((label) => state.messages[0].includes("```" + label)), true);

  // Damage at 0 HP: dead as any NPC, with a Regeneration button for the GM
  const slash = (value, type = "slashing") => ({ types: [{ die: 6, value, type }], dice: [{ type: 6, value }], total: value, metadata: { traits: [], damageCategories: [], damageType: type } });
  const hit = (target, roll) => {
    reset();
    ctx.applyDamage(target, roll, false, null, false);
    return { set: calls.filter((c) => c[0] === "set")[0]?.[2] || {}, calls, message: state.messages[state.messages.length - 1] || "" };
  };
  let r = hit(troll({ curhp: 5 }), slash(9));
  assert("at 0 HP: dead, no dying", [r.set["data.curhp"], r.set["data.dying"], r.calls.some((c) => c[1] === "Dead")], [0, undefined, true]);
  assertIncludes("... with a Regeneration button, dying 1", r.message, "useRegeneration(token, 1)");
  r = hit(troll({ curhp: 5, dying: 3 }), slash(9));
  assertIncludes("dying stops at 3", r.message, "useRegeneration(token, 3)");
  r = hit(troll({ curhp: 50 }), slash(9, "fire"));
  assert("fire tracks nothing", Object.keys(r.set), ["data.curhp"]);
  const goblin = token({ curhp: 5, hitpoints: 10 }, { id: "gob", name: "Goblin", recordType: "npcs" });
  assertNotIncludes("no regeneration: no button", hit(goblin, slash(9)).message, "```Regeneration");

  reset();
  const deadTroll = troll({ curhp: 0 }, { effects: [[{ _id: "dead", name: "Dead", rules: [] }, undefined]] });
  ctx.useRegeneration(deadTroll, 2);
  assert("the button: dying 2, Dead off, then unconscious and prone", calls, [
    ["set", "troll", { "data.dying": 2 }],
    ["remove", "dead", "troll", undefined],
    ["add", "Unconscious", "Prone", "troll"],
  ]);
  assertIncludes("... the chat says so", state.messages[0], "Forest Troll's regeneration");

  // Ferocity
  const orc = (data = {}) => token({ curhp: 5, hitpoints: 30, ...data, actions: [{ name: "Ferocity" }] }, { id: "orc", name: "Orc Brute", recordType: "npcs" });
  r = hit(orc(), slash(9));
  assertIncludes("at 0 HP: a Ferocity button", r.message, "```Ferocity");
  assertIncludes("... that undoes Dead", r.message, 'useMonsterFerocity(token, {"dying":0,"addedUnconscious":false,"addedDead":true})');
  r = hit(orc({ wounded: 3 }), slash(9));
  assertNotIncludes("not at wounded 3", r.message, "```Ferocity");
  reset();
  const dead = token({ curhp: 0, hitpoints: 30, actions: [{ name: "Ferocity" }] }, { id: "orc", name: "Orc Brute", recordType: "npcs", effects: [[{ _id: "dead", name: "Dead", rules: [] }, undefined]] });
  ctx.useMonsterFerocity(dead, { dying: 0, addedDead: true });
  assert("Ferocity: 1 HP, wounded 1", calls[0], ["set", "orc", { "data.curhp": 1, "data.dying": 0, "data.wounded": 1 }]);
  assert("... and Dead comes off", calls[1], ["remove", "dead", "orc", undefined]);
  assertIncludes("... the chat says so", state.messages[0], "Orc Brute uses Ferocity");
}

process.exitCode = summary() > 0 ? 1 : 0;
