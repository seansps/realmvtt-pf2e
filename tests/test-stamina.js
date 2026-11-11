// Tests for the stamina variant (stamina.js, roadmap B19): Table 4-21's
// split, the maximums, damage order, Take a Breather and rest (Gamemastery
// Guide pg. 200-201).

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let setting = "yes";
ctx.api.getSetting = (key) => (key === "staminaVariant" ? setting : undefined);

const fighter = (extra = {}) => ({
  _id: "tok-1",
  recordId: "char-1",
  name: "Valeros",
  recordType: "characters",
  identified: true,
  record: { name: "Valeros" },
  effects: [],
  data: {
    level: 3,
    con: 2,
    str: 4,
    keyAbility: "str",
    classes: [{ name: "Fighter", data: { hp: 10 } }],
    ancestries: [{ data: { hp: 10 } }],
    ...extra,
  },
});

section("Table 4-21");
{
  assert("6: 3 and 3", ctx.getStaminaClassSplit(6), { hp: 3, stamina: 3 });
  assert("8: 4 and 4", ctx.getStaminaClassSplit(8), { hp: 4, stamina: 4 });
  assert("10: 5 and 5", ctx.getStaminaClassSplit(10), { hp: 5, stamina: 5 });
  assert("12: 6 and 6", ctx.getStaminaClassSplit(12), { hp: 6, stamina: 6 });
  assert("an odd one rounds Stamina up", ctx.getStaminaClassSplit(9), { hp: 4, stamina: 5 });
}

section("who uses it");
{
  setting = "yes";
  assert("a character with a class", ctx.usesStamina(fighter()), true);
  assert("no class", ctx.usesStamina(fighter({ classes: [] })), false);
  assert("an NPC", ctx.usesStamina({ ...fighter(), recordType: "npcs" }), false);
  setting = "no";
  assert("the setting off", ctx.usesStamina(fighter()), false);
  setting = "yes";
}

section("maximums and Hit Points");
{
  assert("Stamina (5 + Con 2) x 3, Resolve = Strength 4", ctx.getStaminaMaximums(fighter()), { stamina: 21, resolve: 4 });
  assert("a negative key attribute gives 0 Resolve", ctx.getStaminaMaximums(fighter({ str: -1 })).resolve, 0);
  const values = {};
  ctx.updateAttribute({ record: fighter(), attribute: "con", value: 2, moreValuesToSet: values });
  assert("Hit Points: ancestry 10 + class 5 x 3", values["data.hitpoints"], 25);
  assert("the maximums written, current full", [values["data.staminaMax"], values["data.stamina"], values["data.resolveMax"], values["data.resolve"]], [21, 21, 4, 4]);
  assert("the row shows", values["fields.staminaBox.hidden"], false);
  const again = {};
  ctx.updateAttribute({ record: { ...fighter({ stamina: 21, staminaMax: 21, resolve: 4, resolveMax: 4 }), fields: { staminaBox: { hidden: false } } }, attribute: "con", value: 2, moreValuesToSet: again });
  assert("already shown and full: no Stamina writes", Object.keys(again).filter((key) => /stamina|resolve/i.test(key)), []);

  const lower = {};
  ctx.updateAttribute({ record: fighter({ stamina: 30, resolve: 2 }), attribute: "con", value: 2, moreValuesToSet: lower });
  assert("current kept within the maximum", [lower["data.stamina"], lower["data.resolve"]], [21, undefined]);

  setting = "no";
  const off = {};
  ctx.updateAttribute({ record: { ...fighter(), fields: { staminaBox: { hidden: false } } }, attribute: "con", value: 2, moreValuesToSet: off });
  assert("off: the usual Hit Points", off["data.hitpoints"], 10 + (10 + 2) * 3);
  assert("off: a shown row hides, no Stamina", [off["fields.staminaBox.hidden"], off["data.staminaMax"]], [true, undefined]);
  const never = {};
  ctx.updateAttribute({ record: fighter(), attribute: "con", value: 2, moreValuesToSet: never });
  assert("off, never shown: no write at all", "fields.staminaBox.hidden" in never, false);
  const hiddenAlready = {};
  ctx.updateAttribute({ record: { ...fighter(), fields: { staminaBox: { hidden: true } } }, attribute: "con", value: 2, moreValuesToSet: hiddenAlready });
  assert("off, already hidden: no write", "fields.staminaBox.hidden" in hiddenAlready, false);
  setting = "yes";

  const gains = ctx.getLevelUpGains(fighter(), 4);
  assert("Level Up: +5 HP, +7 Stamina", [gains.hp, gains.stamina], [5, 7]);
  assertIncludes("and says so", ctx.getLevelUpSummary(gains), "+7 maximum Stamina Points");
}

section("damage: temporary Hit Points, Stamina, then Hit Points");
{
  assert("Stamina takes it all", ctx.getStaminaDamage(fighter({ stamina: 10 }), 6), { old: 10, stamina: 4, absorbed: 6, damage: 0 });
  assert("the rest goes on", ctx.getStaminaDamage(fighter({ stamina: 4 }), 6), { old: 4, stamina: 0, absorbed: 4, damage: 2 });
  assert("none left", ctx.getStaminaDamage(fighter({ stamina: 0 }), 6), null);
  assert("healing doesn't touch it", ctx.getStaminaDamage(fighter({ stamina: 4 }), -6), null);

  const writes = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push(values);
  ctx.__state.messages = [];
  const target = fighter({ curhp: 25, hitpoints: 25, tempHp: 3, stamina: 5, staminaMax: 21 });
  ctx.applyDamage(target, { total: 10, types: [{ type: "slashing", value: 10 }], metadata: { damageType: "slashing" } }, false);
  const all = Object.assign({}, ...writes);
  assert("3 temporary, 5 Stamina, 2 Hit Points", [all["data.tempHp"], all["data.stamina"], all["data.curhp"]], [0, 0, 23]);
  assertIncludes("the card says Stamina took some", ctx.__state.messages[0], "**Stamina took 5** (0/21 left).");
  assertIncludes("the Undo puts Stamina back", ctx.__state.messages[0], '"data.stamina":5');

  setting = "no";
  writes.length = 0;
  ctx.applyDamage(fighter({ curhp: 25, hitpoints: 25, stamina: 5 }), { total: 4, types: [{ type: "slashing", value: 4 }], metadata: { damageType: "slashing" } }, false);
  const plain = Object.assign({}, ...writes);
  assert("off: straight to Hit Points", [plain["data.curhp"], plain["data.stamina"]], [21, undefined]);
  setting = "yes";
}

section("massive damage: against Hit Points and Stamina together");
{
  // Sean's example: a level 1 elf wizard, 9 HP and 4 Stamina (13 without the variant)
  const wizard = (extra = {}) =>
    fighter({ level: 1, con: 1, keyAbility: "int", int: 4, classes: [{ name: "Wizard", data: { hp: 6 } }], ancestries: [{ data: { hp: 6 } }], ...extra });
  assert("the threshold's maximum is 13, as without the variant", ctx.getMassiveDamageMaximum(wizard({ staminaMax: 4 }), 9), 13);
  setting = "no";
  assert("off: just Hit Points", ctx.getMassiveDamageMaximum(wizard({ staminaMax: 4 }), 13), 13);
  setting = "yes";

  const writes = [];
  const effects = [];
  ctx.api.setValuesOnTokenById = (id, type, values) => writes.push(values);
  ctx.api.addEffects = (list) => effects.push(...list);
  ctx.api.addEffect = (name) => effects.push(name);
  ctx.__state.messages = [];
  ctx.applyDamage(wizard({ curhp: 9, hitpoints: 9, stamina: 4, staminaMax: 4 }), { total: 18, types: [{ type: "slashing", value: 18 }], metadata: { damageType: "slashing" } }, false);
  assert("18 isn't massive damage", ctx.__state.messages.join(" ").includes("MASSIVE"), false);
  ctx.__state.messages = [];
  ctx.applyDamage(wizard({ curhp: 9, hitpoints: 9, stamina: 4, staminaMax: 4 }), { total: 26, types: [{ type: "slashing", value: 26 }], metadata: { damageType: "slashing" } }, false);
  assertIncludes("26 is, as without the variant", ctx.__state.messages.join(" "), "MASSIVE DAMAGE");
}

section("Take a Breather and rest");
{
  assert("1 Resolve for full Stamina", ctx.getBreatherValues(fighter({ stamina: 3, resolve: 2 })), { "data.stamina": 21, "data.resolve": 1 });
  assert("not without Resolve", ctx.getBreatherValues(fighter({ stamina: 3, resolve: 0 })), null);

  const records = [];
  const notes = [];
  ctx.api.setValuesOnRecord = (record, values) => records.push(values);
  ctx.api.showNotification = (text) => notes.push(text);
  ctx.__state.messages = [];
  ctx.takeABreather(fighter({ stamina: 3, resolve: 2 }));
  assert("the button writes once", records, [{ "data.stamina": 21, "data.resolve": 1 }]);
  assertIncludes("and says so", ctx.__state.messages[0], "Stamina back to 21, spending 1 Resolve Point (1 left)");
  ctx.takeABreather(fighter({ resolve: 0 }));
  assert("refused at 0", notes[0], "Valeros has no Resolve Points left.");

  const rest = ctx.getLimitedUseRecharges(fighter({ stamina: 0, resolve: 0 }), "dailyPreparations");
  assert("a night's rest refills both", [rest["data.stamina"], rest["data.resolve"]], [21, 4]);
  assertIncludes("the rest message says so", ctx.describeLimitedUseRecharges(fighter(), rest), "Stamina and Resolve back to full");
  assert("Refocus doesn't", ctx.getLimitedUseRecharges(fighter({ stamina: 0 }), "refocus")["data.stamina"], undefined);
}

process.exitCode = summary() > 0 ? 1 : 0;
