// Tests for armor check penalty exceptions and armor traits (armor-traits.js).
// Run: node tests/test-armor-traits.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

// The roll a check or save would prompt
function capturePrompt(run) {
  const saved = ctx.api.promptRoll;
  let captured = { modifiers: [], metadata: {} };
  ctx.api.promptRoll = (name, dice, modifiers, metadata) => {
    captured = { modifiers: modifiers || [], metadata: metadata || {} };
  };
  try {
    run();
  } finally {
    ctx.api.promptRoll = saved;
  }
  return captured;
}

const armor = (traits = [], extra = {}) => ({
  _id: "armor",
  name: "Test Armor",
  data: { type: "armor", carried: "equipped", acBonus: 5, checkPenalty: -2, strength: 3, itemCategory: "Medium", traits, ...extra },
});
const pc = (inventory = [], data = {}) => ({
  _id: "pc",
  recordType: "characters",
  name: "Valeros",
  effects: [],
  effectIds: [],
  fields: {},
  data: { level: 5, str: 1, dex: 2, con: 2, athletics: "1", acrobatics: "1", stealth: "1", thievery: "1", inventory, feats: [], ...data },
});
const penalty = (record, skill, action) =>
  capturePrompt(() => ctx.rollSkill(record, skill, null, false, 0, 1, "int", false, false, undefined, action ? { action } : {}))
    .modifiers.find((m) => m.name === "Check Penalty")?.value;

section("Check penalty exceptions");
{
  const weak = pc([armor()]);
  assert("Strength short: Athletics takes it", penalty(weak, "athletics"), -2);
  assert("... Thievery too", penalty(weak, "thievery"), -2);
  assert("... but not Grapple (attack trait)", penalty(weak, "athletics", "Grapple"), undefined);
  assert("... nor Trip, Shove, Disarm or Escape", ["Trip", "Shove", "Disarm", "Escape"].map((action) => penalty(weak, "athletics", action)), [undefined, undefined, undefined, undefined]);
  assert("... a non-attack action keeps it (Climb)", penalty(weak, "athletics", "Climb"), -2);

  const flexible = pc([armor(["Flexible"])]);
  assert("flexible: no penalty on Acrobatics or Athletics", [penalty(flexible, "acrobatics"), penalty(flexible, "athletics")], [undefined, undefined]);
  assert("... Stealth and Thievery keep it", [penalty(flexible, "stealth"), penalty(flexible, "thievery")], [-2, -2]);

  const strong = pc([armor(["Noisy"])], { str: 3 });
  assert("Strength met: no penalty", penalty(strong, "athletics"), undefined);
  assert("... except Stealth in noisy armor", penalty(strong, "stealth"), -2);
  assert("noisy, Strength short: Stealth once", capturePrompt(() => ctx.rollSkill(pc([armor(["noisy"])]), "stealth")).modifiers.filter((m) => m.name === "Check Penalty").length, 1);

  assert("armor without a Strength value: no penalty, even noisy", penalty(pc([armor(["Noisy"], { strength: null })], { str: 0 }), "stealth"), undefined);
  assert("a source with the attack trait", ctx.isAttackTraitCheck({ origin: { data: { traits: ["Attack"] } } }), true);
}

section("Bulwark");
{
  const plate = pc([armor(["Bulwark"], { checkPenalty: -3, strength: 4 })], { dex: 0 });
  const save = (record, basic) =>
    capturePrompt(() => ctx.rollSave(record, "reflex", 20, false, false, basic ? { basic: true } : {})).modifiers.find((m) => m.name.startsWith("Bulwark"));
  assert("a basic Reflex save: +3 instead of Dex 0, on", [save(plate, true)?.value, save(plate, true)?.active], [3, true]);
  assert("another Reflex save: offered unticked", [save(plate, false)?.value, save(plate, false)?.active], [3, false]);
  assert("Dex +1: +2 more", ctx.getBulwarkModifier(pc([armor(["Bulwark"])], { dex: 1 }), "reflex", true).value, 2);
  assert("Dex +3: nothing to change", ctx.getBulwarkModifier(pc([armor(["Bulwark"])], { dex: 3 }), "reflex", true), null);
  assert("Fortitude: none", ctx.getBulwarkModifier(plate, "fortitude", true), null);
  assert("no bulwark: none", ctx.getBulwarkModifier(pc([armor()], { dex: 0 }), "reflex", true), null);
}

section("Ponderous");
{
  const initiative = (record) =>
    capturePrompt(() => ctx.rollSkill(record, "perception", null, false, 0, 1, "int", false, true)).modifiers.find((m) => m.name === "Ponderous");
  const met = pc([armor(["Ponderous"], { checkPenalty: -3 })], { str: 3 });
  assert("Strength met: -1 untyped penalty to initiative", [initiative(met)?.value, initiative(met)?.type], [-1, ""]);
  // Untyped, so it stacks with an item penalty to initiative
  const shoddy = { type: "initiativePenalty", modifierType: "item", valueType: "number", value: "2", field: "", active: true };
  const withItemPenalty = { ...met, data: { ...met.data, feats: [{ name: "Shoddy", data: { type: "general", modifiers: [{ data: shoddy }] } }] } };
  const rolled = capturePrompt(() => ctx.rollSkill(withItemPenalty, "perception", null, false, 0, 1, "int", false, true)).modifiers;
  assert(
    "... and stacks with an item penalty in the initiative roll",
    rolled.filter((m) => m.name === "Ponderous" || m.name === "Shoddy").map((m) => [m.name, m.value]),
    [["Shoddy", -2], ["Ponderous", -1]],
  );
  assert("Strength short: the check penalty", initiative(pc([armor(["Ponderous"], { checkPenalty: -3 })]))?.value, -3);
  assert("not on other checks", capturePrompt(() => ctx.rollSkill(met, "perception")).modifiers.some((m) => m.name === "Ponderous"), false);
  assert("no ponderous: none", initiative(pc([armor()], { str: 3 })), undefined);
}

process.exitCode = summary() > 0 ? 1 : 0;
