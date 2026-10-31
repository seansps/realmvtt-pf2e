// Tests for familiars (familiars.js).
// Run: node tests/test-familiars.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const ability = (name, data = {}) => ({
  _id: name,
  name,
  recordType: "actions",
  data: { actionType: "passive", actionCategory: "familiar", ...data },
});
// Tough, as the Player Core module has it
const tough = ability("Tough", {
  modifiers: [{ data: { type: "hitPointsBonus", field: "hp", modifierType: "untyped", valueType: "string", value: "2 * @actor.level", active: true } }],
});
const familiar = (actions = [], data = {}) => ({
  _id: "fam",
  name: "Nibbles",
  recordType: "npcs",
  effects: [],
  effectIds: [],
  fields: {},
  data: { type: "familiar", level: 1, curhp: 5, hitpoints: 5, actions, skills: [], speeds: [], speed: { value: 25 }, ...data },
});
const feat = (name) => ({ name, data: { type: "class" } });
const master = (data = {}) => ({
  _id: "wiz",
  name: "Ezren",
  recordType: "characters",
  effects: [],
  data: { level: 5, ac: 21, fortitudeMod: 9, reflexMod: 11, willMod: 13, int: 4, feats: [feat("Familiar")], features: [], classes: [], ...data },
});

section("Sync with the master");
{
  const values = ctx.getFamiliarSyncValues(familiar(), master());
  assert("level, AC and saves are the master's", [values["data.level"], values["data.ac"], values["data.fortitudeMod"], values["data.willMod"]], [5, 21, 9, 13]);
  assert("5 HP per level", values["data.hitpoints"], 25);
  assert("Perception 3 + level", values["data.perceptionMod"], 8);
  const withInt = ctx.getFamiliarSyncValues(familiar([], { masterAttribute: "int" }), master({ int: 5 }));
  assert("... or the master's spellcasting attribute + level, if higher", withInt["data.perceptionMod"], 10);
  const skills = values["data.skills"];
  assert("Acrobatics and Stealth 3 + level, others the level", [skills.find((s) => s.name === "Stealth").data.mod, skills.find((s) => s.name === "Arcana").data.mod], [8, 5]);
  assert("Tough: +2 HP per level, at the master's level", ctx.getFamiliarSyncValues(familiar([tough]), master())["data.hitpoints"], 35);
  assert("... worked out at the new level, not the old one", ctx.getFamiliarSyncValues(familiar([tough], { level: 1 }), master({ level: 9 }))["data.hitpoints"], 63);
  assert("current HP above the new max comes down", ctx.getFamiliarSyncValues(familiar([], { curhp: 40 }), master())["data.curhp"], 25);
  assert("land Speed 25", values["data.speed.value"], 25);
}

section("Speeds from abilities");
{
  const speeds = (actions, data) => ctx.getFamiliarSpeedValues(familiar(actions, data));
  const rows = (values) => values["data.speeds"].map((row) => [row.data.type, row.data.value]);
  assert("Flier: fly 25", rows(speeds([ability("Flier")])), [["fly", 25]]);
  assert("Climber and Burrower", rows(speeds([ability("Climber"), ability("Burrower")])), [["climb", 25], ["burrow", 5]]);
  assert("Fast Movement: land 40 by default", speeds([ability("Fast Movement")])["data.speed.value"], 40);
  const fastFly = speeds([ability("Flier"), ability("Fast Movement", { fastMovementSpeed: "fly" })]);
  assert("... or the Speed picked for it", [fastFly["data.speed.value"], rows(fastFly)], [25, [["fly", 40]]]);
  const amphibious = speeds([ability("Amphibious"), ability("Fast Movement")]);
  assert("Amphibious: land and swim each the higher", [amphibious["data.speed.value"], rows(amphibious)], [40, [["swim", 40]]]);
  const typed = { data: { type: "climb", value: 10 } };
  const handRows = speeds([ability("Flier")], { speeds: [typed, { data: { type: "swim", value: 15 } }] });
  assert("a hand-typed row stays, unless an ability gives that Speed", rows(handRows), [["climb", 10], ["swim", 15], ["fly", 25]]);
  const old = { data: { type: "fly", value: 25, fromFamiliarAbility: true } };
  assert("a row from an ability no longer picked goes", rows(speeds([], { speeds: [old] })), []);
  assert("Fast Movement's choices: land and the ability Speeds", ctx.getFastMovementChoices(familiar([ability("Flier"), ability("Climber")])), ["land", "fly", "climb"]);
}

section("Ability allowance");
{
  const allowance = (data) => ctx.getFamiliarAbilityAllowance(master(data)).value;
  assert("the Familiar feat: 2", allowance({}), 2);
  assert("Enhanced Familiar: 4", allowance({ feats: [feat("Familiar"), feat("Enhanced Familiar")] }), 4);
  assert("Incredible Familiar: 6, not 4 + 6", allowance({ feats: [feat("Enhanced Familiar"), feat("Incredible Familiar")] }), 6);
  assert("Basic Witchcraft: 3", allowance({ feats: [feat("Basic Witchcraft")] }), 3);
  const witch = (level, feats = []) => ({ level, feats, classes: [{ name: "Witch", data: { features: [{ name: "Familiar (Witch)", data: { level: 1 } }] } }] });
  assert("a witch: 2 + 2 at 1st", allowance(witch(1)), 4);
  assert("... + 3 at 6th, + 5 at 18th", [allowance(witch(6)), allowance(witch(18))], [5, 7]);
  assert("... adding to Enhanced Familiar", allowance(witch(2, [feat("Enhanced Familiar")])), 6);
  const thesis = (level) => ({ level, classes: [{ name: "Wizard", data: { features: [{ name: "Improved Familiar Attunement", data: { level: 1 } }] } }] });
  assert("Improved Familiar Attunement: +1, +2 at 6th, +4 at 18th", [allowance(thesis(1)), allowance(thesis(6)), allowance(thesis(18))], [3, 4, 6]);
  const later = { level: 4, classes: [{ name: "Wizard", data: { features: [{ name: "Improved Familiar Attunement", data: { level: 5 } }] } }] };
  assert("a class feature above the level doesn't count", allowance(later), 2);
  assert("the sync writes it", ctx.getFamiliarSyncValues(familiar(), master({ feats: [feat("Enhanced Familiar")] }))["data.numAbilities"], 4);
  assert("... unless a number was typed", ctx.getFamiliarSyncValues(familiar([], { numAbilitiesOverride: 5 }), master())["data.numAbilities"], 5);
  const three = familiar([ability("Flier"), ability("Climber"), tough]);
  assert("a note when there are more abilities than that", ctx.getFamiliarAbilityExcessNote(three, 2), "Nibbles has 3 familiar and master abilities; its master can pick 2 a day.");
  assert("... none within it", ctx.getFamiliarAbilityExcessNote(three, 4), "");
}

section("Master abilities and Rest");
{
  const values = ctx.getFamiliarSyncValues(familiar([ability("Familiar Focus")]), master());
  assert("Familiar Focus shows its button", values["fields.familiarFocusBtn.hidden"], false);
  assert("... hidden without it", ctx.getFamiliarSyncValues(familiar(), master())["fields.familiarFocusBtn.hidden"], true);

  const note = ctx.getFamiliarRestNote(master(), familiar([ability("Spell Battery")], { numAbilities: 2 }));
  assert("Rest: the abilities can be picked again", note.includes("Nibbles's 2 familiar and master abilities can be picked again"), true);
  assert("... and Spell Battery's slot", note.includes("Spell Battery: one extra spell slot"), true);
  assert("no familiar: no note", ctx.getFamiliarRestNote(master(), null), "");

  // Familiar Focus gives 1 Focus Point back to the master
  const focusMaster = master({ focusPool: 2, focusPoolMaxManual: 3, spells: [{ name: "Focus", data: { type: "focus", focusPool: 2, focusPoolMax: 3 } }] });
  let written = null;
  ctx.api.getRecord = (type, id, cb) => cb(focusMaster);
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    written = values;
    if (cb) cb();
  };
  ctx.useFamiliarFocus(familiar([ability("Familiar Focus")], { master: JSON.stringify({ _id: "wiz" }) }));
  assert("Familiar Focus: 1 Focus Point back", written?.["data.focusPool"], 1);
}

section("Sync writes once, and links the master back");
{
  const writes = [];
  ctx.api.getRecord = (type, id, cb) => cb(master());
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    writes.push([record._id, Object.keys(values)]);
    if (cb) cb();
  };
  ctx.syncFamiliarWithMaster(familiar(), "wiz");
  assert("one write to the familiar, with its link to the master", writes[0][0] === "fam" && writes[0][1].includes("data.master") && writes[0][1].includes("data.hitpoints"), true);
  assert("then one to the master, its Familiar link", writes[1], ["wiz", ["data.familiar"]]);
  writes.length = 0;
  ctx.api.getRecord = (type, id, cb) => cb(master({ familiar: JSON.stringify({ _id: "fam" }) }));
  ctx.syncFamiliarWithMaster(familiar([], { master: JSON.stringify({ _id: "wiz" }) }), "wiz");
  assert("links already in place aren't written again", [writes.length, writes[0][1].includes("data.master")], [1, false]);
}

section("Removing an ability");
{
  const flier = { ...ability("Flier"), _id: "flier" };
  const focus = { ...ability("Familiar Focus"), _id: "focus" };
  const withFly = familiar([flier, focus], { speeds: [{ data: { type: "fly", value: 25, fromFamiliarAbility: true } }] });
  const values = ctx.getActionRemovalValues(withFly, "flier");
  assert("the row goes", values["data.actions"].map((action) => action.name), ["Familiar Focus"]);
  assert("... and its Speed with it", values["data.speeds"], []);
  assert("Familiar Focus's button stays while it's picked", values["fields.familiarFocusBtn.hidden"], false);
  assert("... and hides once it's removed", ctx.getActionRemovalValues(withFly, "focus")["fields.familiarFocusBtn.hidden"], true);
  const monster = { ...familiar([flier]), data: { type: "creature", actions: [flier] } };
  assert("another NPC: only its actions change", Object.keys(ctx.getActionRemovalValues(monster, "flier")), ["data.actions"]);
  assert("an action that's already gone: no write", ctx.getActionRemovalValues(withFly, "gone"), null);

  let written = null;
  ctx.api.getRecord = (type, id, cb) => cb(withFly);
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    written = values;
    if (cb) cb();
  };
  ctx.removeNpcAction(withFly, "flier");
  assert("one write, from the record read fresh", Object.keys(written).sort(), ["data.actions", "data.speed.value", "data.speeds", "fields.familiarFocusBtn.hidden"]);
}

section("Typing the allowance");
{
  let written = null;
  ctx.api.getRecord = (type, id, cb) => cb(master());
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    written = values;
    if (cb) cb();
  };
  const linked = familiar([], { master: JSON.stringify({ _id: "wiz" }) });
  ctx.onFamiliarAbilityLimitChange(linked, 5);
  assert("a typed number is kept as the override, not written again", written, { "data.numAbilitiesOverride": 5 });
  ctx.onFamiliarAbilityLimitChange(linked, "");
  assert("cleared: back to the master's allowance", written, { "data.numAbilitiesOverride": null, "data.numAbilities": 2 });
}

process.exitCode = summary() > 0 ? 1 : 0;
