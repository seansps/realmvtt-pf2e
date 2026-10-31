// Tests for weapon traits, hands in use and firearm loading (weapon-traits.js):
// kickback, jousting, concussive, parry, versatile with any damage type,
// hands-free roll options, and capacity, double barrel and repeating weapons.
// Run: node tests/test-weapon-traits.js   (or via tests/run-all.js)

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

let notifications = [];
ctx.api.showNotification = (text) => notifications.push(text);

// A level 5 character with the given inventory
function pc(inventory = [], data = {}) {
  return {
    _id: "pc",
    recordType: "characters",
    name: "Lem",
    effects: [],
    effectIds: [],
    fields: {},
    data: {
      level: 5,
      str: 1,
      dex: 4,
      ancestries: [{ name: "Halfling", data: { speed: "25 feet", hp: 6 } }],
      classes: [{ name: "Gunslinger", data: { hp: 8, features: [] } }],
      feats: [],
      bonusFeats: [],
      inventory,
      ...data,
    },
  };
}
const pcToken = (record) => ({ _id: "tok", recordType: "characters", recordId: "pc", record, data: record.data });

const weapon = (name, traits = [], extra = {}) => ({
  _id: `w-${name}`,
  name,
  recordType: "items",
  data: {
    type: "weapon",
    carried: "equipped",
    itemCategory: "martial",
    group: "firearm",
    traits,
    usage: "held-in-one-hand",
    range: 0,
    damage: { dice: 1, die: "d6", damageType: "piercing" },
    runes: { potency: 0, striking: 0, property: [] },
    ...extra,
  },
});

// A firearm loaded from the given round count
const gun = (name, traits, extra = {}) =>
  weapon(name, traits, { range: 60, reload: "1", ammo: 10, ammoSelect: "rounds", ...extra });
const rounds = { _id: "rounds", name: "Rounds", recordType: "items", data: { type: "consumable", itemCategory: "ammo", count: 10 } };

// Runs performAttackRoll; returns its prompt and the values it writes
function strike(record, item) {
  const saved = { getToken: ctx.api.getToken, promptRoll: ctx.api.promptRoll, setValues: ctx.api.setValues };
  let captured = null;
  let written = {};
  ctx.api.getToken = () => pcToken(record);
  ctx.api.promptRoll = (name, dice, modifiers, metadata) => (captured = { modifiers: modifiers || [], metadata: metadata || {} });
  ctx.api.setValues = (values) => Object.assign(written, values);
  try {
    ctx.performAttackRoll(record, item, "data.inventory.0", 1);
  } finally {
    Object.assign(ctx.api, saved);
  }
  return { ...(captured || { modifiers: [], metadata: {} }), rolled: !!captured, written };
}
const named = (mods, name) => (mods || []).filter((mod) => mod.name === name);

section("Kickback (Q32)");
{
  const arquebus = gun("Arquebus", ["Concussive", "Fatal-D12", "Kickback"], { loadedAmmo: true });
  let result = strike(pc([arquebus, rounds]), arquebus);
  assert("the attack: -2 circumstance, ticked", named(result.modifiers, "Kickback").map((m) => [m.value, m.type, m.active]), [[-2, "circumstance", true]]);
  assert("the damage: +1", named(result.metadata.damageModifiers, "Kickback").map((m) => m.value), [1]);
  result = strike(pc([arquebus, rounds], { str: 2 }), arquebus);
  assert("Strength +2: the penalty is unticked", named(result.modifiers, "Kickback (ignored: Strength +2)").map((m) => m.active), [false]);
  assert("an NPC's attack: nothing (its damage has it)", ctx.getWeaponTraitModifiers(pc(), arquebus, { isNPCAttack: true }), { attack: [], damage: [] });
}

section("Jousting (Q32)");
{
  const lance = weapon("Lance", ["Deadly-D8", "Jousting-D6", "Reach"], {
    group: "spear",
    usage: "held-in-two-hands",
    damage: { dice: 1, die: "d8", damageType: "piercing" },
    runes: { potency: 1, striking: 1, property: [] },
  });
  assert("the die: d6", ctx.getJoustingDie(lance), "d6");
  const result = strike(pc([lance], { str: 4 }), lance);
  assert(
    "a circumstance bonus equal to the dice (2 with striking), unticked",
    named(result.metadata.damageModifiers, "Jousting (mounted, moved 10+ feet)").map((m) => [m.value, m.active]),
    [[2, false]],
  );
}

section("Concussive (Q32)");
{
  const iwr = (immunities, resistances) => ({ immunities, resistances, weaknesses: {} });
  const traits = ["Concussive"];
  assert("resists piercing 5, not bludgeoning: bludgeoning's", ctx.getConcussiveProtectionType(iwr({}, { piercing: { value: 5 } }), "piercing", traits), "bludgeoning");
  assert("immune to piercing: bludgeoning's", ctx.getConcussiveProtectionType(iwr({ piercing: {} }, {}), "piercing", traits), "bludgeoning");
  assert("the weaker of two resistances", ctx.getConcussiveProtectionType(iwr({}, { piercing: { value: 5 }, bludgeoning: { value: 2 } }), "piercing", traits), "bludgeoning");
  assert("bludgeoning weaker already: its own", ctx.getConcussiveProtectionType(iwr({}, { piercing: { value: 5 } }), "bludgeoning", traits), "bludgeoning");
  assert("not concussive: its own", ctx.getConcussiveProtectionType(iwr({}, { piercing: { value: 5 } }), "piercing", []), "piercing");
  assert("fire: its own", ctx.getConcussiveProtectionType(iwr({}, {}), "fire", traits), "fire");

  // applyDamage
  const START = 1000;
  const target = (data) => ({ _id: "t", recordType: "npcs", name: "T", record: { name: "T" }, identified: true, effects: [], data: { curhp: START, hitpoints: START, ...data } });
  const dealt = (t, roll) => {
    state.lastSet = null;
    ctx.applyDamage(t, roll, false, null, false);
    const set = state.lastSet || {};
    return START - ("data.curhp" in set ? set["data.curhp"] : START);
  };
  const shot = (rollTraits) => ({ types: [{ die: 6, value: 10, type: "piercing" }], dice: [{ type: 6, value: 10 }], total: 10, metadata: { traits: rollTraits, damageCategories: [], damageType: "piercing" } });
  const skeleton = target({ resistances: [{ data: { type: "piercing", value: 5 } }, { data: { type: "slashing", value: 5 } }] });
  assert("a skeleton (resists piercing 5): a concussive shot deals 10", dealt(skeleton, shot(["Concussive"])), 10);
  assert("... a plain shot deals 5", dealt(skeleton, shot([])), 5);
  const ooze = target({ immunities: [{ data: { type: "piercing" } }], resistances: [{ data: { type: "bludgeoning", value: 3 } }] });
  assert("immune to piercing, resists bludgeoning 3: 7", dealt(ooze, shot(["Concussive"])), 7);
  const golem = target({ resistances: [{ data: { type: "physical", value: 5 } }] });
  assert("physical resistance applies as normal: 5", dealt(golem, shot(["Concussive"])), 5);
}

section("Parry (Q32)");
{
  const mainGauche = weapon("Main-gauche", ["Agile", "Disarm", "Finesse", "Parry", "Versatile-S"], { group: "knife", itemCategory: "simple" });
  assert("the button shows for a parry weapon", ctx.getItemFields(mainGauche).parryBtn, { hidden: false });
  assert("... not without the trait", ctx.getItemFields(weapon("Rapier", ["Deadly-D8"])).parryBtn, { hidden: true });
  state.effects = [];
  state.messages = [];
  const record = pc([mainGauche]);
  ctx.api.getToken = () => pcToken(record);
  ctx.parryWithWeapon(record, mainGauche);
  assert("the module's Parry effect", state.effects, ["Parry"]);
  assertIncludes("the card", state.messages[0], "+1 circumstance bonus to AC until the start of your next turn.");
  assertIncludes("untrained: a note for the GM", state.messages[0], "[gm]Parry needs trained proficiency with the weapon.[/gm]");
  ctx.api.getToken = () => null;
}

section("Versatile with any damage type (Q32)");
{
  const spellgun = weapon("Spellgun", ["Versatile-Fire", "Versatile-Cold"], { damage: { dice: 1, die: "d6", damageType: "force" } });
  assert("the types", ctx.getVersatileTypes(spellgun), ["fire", "cold"]);
  assert("the dropdown's options: the weapon's type first", ctx.getVersatileOptions(spellgun).map((o) => o.value), ["force", "fire", "cold"]);
  const fields = ctx.getItemFields(spellgun);
  assert("the dropdown, not the checkboxes", [fields.versatileType, fields.versatilePiercing, fields.versatileSlashing], [{ hidden: false }, { hidden: true }, { hidden: true }]);
  const rapier = weapon("Rapier", ["Versatile-S"], { damage: { dice: 1, die: "d6", damageType: "piercing" } });
  assert("Versatile S keeps its checkboxes", [ctx.getItemFields(rapier).versatileType, ctx.getItemFields(rapier).versatileSlashing], [{ hidden: true }, { hidden: false }]);
  assert("the S letter reads as slashing", ctx.getVersatileTypes(rapier), ["slashing"]);
  const chosen = { ...spellgun, data: { ...spellgun.data, versatileType: "fire" } };
  assert("the chosen type is the damage type", ctx.getWeaponDamageInfo(pc(), chosen).damageType, "fire");
  assert("a type the weapon hasn't: its own", ctx.getWeaponDamageInfo(pc(), { ...spellgun, data: { ...spellgun.data, versatileType: "acid" } }).damageType, "force");
}

section("Hands in use (Q34)");
{
  const longsword = weapon("Longsword", ["Versatile-P"], { group: "sword" });
  const shield = { _id: "shield", name: "Steel Shield", data: { type: "shield", carried: "equipped", usage: "held-in-one-hand" } };
  const greatsword = weapon("Greatsword", [], { usage: "held-in-two-hands" });
  const bastard = weapon("Bastard Sword", ["Two-Hand-D12"], { usage: "held-in-one-plus-hands" });
  const armor = { _id: "armor", name: "Chain Mail", data: { type: "armor", carried: "equipped", usage: "worn" } };
  const fist = weapon("Fist", ["Agile", "Nonlethal"], { itemCategory: "unarmed" });
  const stowed = weapon("Dagger", [], { carried: "carried" });
  const gauntlet = weapon("Gauntlet", ["Free-Hand"]);

  assert("a sword and shield: 2 held, 1 free (the shield doesn't count)", ctx.getHandsInUse(pc([longsword, shield, armor, fist, stowed])), { held: 2, free: 1, reallyFree: 0 });
  assert("a greatsword: 2", ctx.getHandsInUse(pc([greatsword])).held, 2);
  // TestRogue: a longsword and a shield, with the pepperbox's rounds Equipped
  const roundsEquipped = { _id: "rounds", name: "Rounds (Pepperbox)", data: { type: "consumable", itemCategory: "Ammo", carried: "equipped", usage: "held-in-one-hand" } };
  const torch = { _id: "torch", name: "Torch", data: { type: "equipment", carried: "equipped", usage: "held-in-one-hand" } };
  const rope = { _id: "rope", name: "Rope", data: { type: "equipment", carried: "equipped", usage: "held-in-two-hands" } };
  const bombs = weapon("Alchemist's Fire (Lesser)", ["Bomb", "Splash"], { group: "bomb", usage: "held-in-one-hand" });
  const shieldNoUsage = { _id: "shield2", name: "Steel Shield", data: { type: "shield", carried: "equipped" } };
  assert("Equipped gear (ammunition, a torch, rope) isn't held", ctx.getHandsInUse(pc([longsword, shieldNoUsage, roundsEquipped, torch, rope])).held, 2);
  assert("... so drawing the sword next to a shield shows no label", ctx.getHandsValues(pc([longsword, shieldNoUsage, roundsEquipped])), {});
  assert("ammunition typed as a weapon isn't held either", ctx.getHandsInUse(pc([longsword, weapon("Bolts", [], { itemCategory: "Ammo", usage: "held-in-one-hand" })])).held, 1);
  assert("Equipped bombs aren't held", ctx.getHandsInUse(pc([longsword, bombs])).held, 1);
  assert("a worn weapon (handwraps) isn't held", ctx.getHandsInUse(pc([weapon("Handwraps", [], { usage: "worngloves" })])).held, 0);

  assert("a bastard sword in one hand: 1", ctx.getHandsInUse(pc([bastard])).held, 1);
  assert("... in two (its hand button): 2", ctx.getHandsInUse(pc([{ ...bastard, data: { ...bastard.data, handBtn: "two" } }])).held, 2);
  assert("a free-hand weapon: held, but the hand counts as free", ctx.getHandsInUse(pc([gauntlet])), { held: 1, free: 2, reallyFree: 1 });
  assert("changes not written yet: the sword stowed", ctx.getHandsInUse(pc([longsword, shield]), { "w-Longsword": { carried: "carried" } }).held, 1);
  assert("the roll options, as Foundry's", ctx.getHandsFreeAtoms(pc([longsword, shield])), ["hands-free:1", "hands-free:but-really:0"]);
  assert("an NPC: none", ctx.getHandsFreeAtoms({ ...pc([longsword]), recordType: "npcs" }), []);

  assert("2 hands: the label stays hidden, no write", ctx.getHandsValues(pc([greatsword])), {});
  assert("3: the Actions tab's label shows", ctx.getHandsValues(pc([greatsword, shield])), { "data.handsLabel": "Hands 3/2", "fields.handsLabel.hidden": false });
  const showing = { ...pc([greatsword, shield], { handsLabel: "Hands 3/2" }), fields: { handsLabel: { hidden: false } } };
  assert("... unchanged: no write", ctx.getHandsValues(showing), {});
  assert("back to 2: hidden again", ctx.getHandsValues({ ...showing, data: { ...showing.data, inventory: [greatsword] } }), { "fields.handsLabel.hidden": true });
  notifications = [];
  ctx.noteHandsInUse(pc([greatsword, shield]));
  assert("more than 2: a note, nothing blocked", notifications, ["3 hands in use: a creature normally has 2."]);
  notifications = [];
  ctx.noteHandsInUse(pc([longsword, shield]));
  assert("2: no note", notifications, []);
}

section("Capacity and double barrel (Q35)");
{
  const pepperbox = gun("Pepperbox", ["Uncommon", "Capacity-3", "Concussive", "Fatal-D8"], { damage: { dice: 1, die: "d4", damageType: "piercing" } });
  assert("capacity 3", ctx.getLoadCapacity(pepperbox), 3);
  assert("double barrel: 2", ctx.getLoadCapacity(gun("Double-Barreled Musket", ["Concussive", "Double-Barrel"])), 2);
  assert("a musket: 1", ctx.getLoadCapacity(gun("Arquebus", ["Kickback"])), 1);
  assert("repeating: 1 (the magazine)", ctx.getLoadCapacity(gun("Repeating Crossbow", ["Repeating", "Capacity-3"])), 1);
  assert("ammo with uses (a magazine, a battery): 1", ctx.getLoadCapacity(gun("Pepperbox", ["Capacity-3"], { uses: { max: 5, value: 5 } })), 1);
  assert("not counted yet but loaded: 1", ctx.getLoadedCount({ ...pepperbox, data: { ...pepperbox.data, loadedAmmo: true } }), 1);

  // Reload: one shot at a time, up to the capacity
  const at = (count) => ({ ...pepperbox, data: { ...pepperbox.data, loadedCount: count, loadedAmmo: count > 0 } });
  assert(
    "a reload: one more",
    ctx.getReloadValues(at(1), "data.inventory.0"),
    { values: { "data.inventory.0.data.loadedCount": 2, "data.inventory.0.data.loadedMax": 3, "data.inventory.0.data.loadedAmmo": true }, message: "Reloading Pepperbox (2/3 loaded)" },
  );
  assert("full: nothing", ctx.getReloadValues(at(3), "data.inventory.0"), null);
  assert("a musket: loaded, as before", ctx.getReloadValues(gun("Arquebus", []), "p").values, { "p.data.loadedAmmo": true });
  const fields = ctx.getItemFields(pepperbox);
  assert("the counter instead of the checkbox", [fields.loadedCount, fields.loadedAmmo], [{ hidden: false }, { hidden: true }]);

  // Firing: one chamber used, a note to select the next
  let result = strike(pc([at(2), rounds]), at(2));
  assert("fired with 2 loaded", result.rolled, true);
  assert("one left", [result.written["data.inventory.0.data.loadedCount"], result.written["data.inventory.0.data.loadedAmmo"]], [1, true]);
  assertIncludes("the card's note", result.metadata.reloadNote, "1/3 loaded: selecting the next loaded barrel is an Interact action");
  result = strike(pc([at(1), rounds]), at(1));
  assert("the last one: not loaded", [result.written["data.inventory.0.data.loadedCount"], result.written["data.inventory.0.data.loadedAmmo"]], [0, false]);
  notifications = [];
  result = strike(pc([at(0), rounds]), at(0));
  assert("none loaded: reload first (as before)", [result.rolled, notifications], [false, ["You need to reload first!"]]);

  // Both barrels
  const musket = gun("Double-Barreled Musket", ["Concussive", "Double-Barrel", "Fatal-D10"], { damage: { dice: 1, die: "d6", damageType: "piercing" }, loadedCount: 2, loadedAmmo: true, doubleBarrel: true });
  const info = ctx.getWeaponDamageInfo(pc(), musket);
  assert("both barrels: d6 -> d8, fatal d10 -> d12", [info.damageString, info.fatalDie], ["1d8 piercing", "d12"]);
  assert("d12 stays d12", ctx.stepUpDie("d12"), "d12");
  result = strike(pc([musket, rounds]), musket);
  assert("both fired: 2 rounds and 2 loaded shots used", [result.written["data.inventory.1.data.count"], result.written["data.inventory.0.data.loadedCount"]], [8, 0]);
  const heavy = { ...musket, data: { ...musket.data, expend: 3 } };
  result = strike(pc([heavy, rounds]), heavy);
  assert("expend 3 with both barrels: 3, not 6 (Foundry's max)", result.written["data.inventory.1.data.count"], 7);
  notifications = [];
  result = strike(pc([{ ...musket, data: { ...musket.data, loadedCount: 1 } }, rounds]), { ...musket, data: { ...musket.data, loadedCount: 1 } });
  assert("one loaded: a note, one barrel fires", [notifications, result.written["data.inventory.1.data.count"], result.written["data.inventory.0.data.loadedCount"]], [["Only one barrel is loaded: firing one."], 9, 0]);
  assert("... at the normal die", result.metadata.damage, "1d6 piercing");
  assert("the toggle shows for a double barrel weapon", ctx.getItemFields(musket).doubleBarrel, { hidden: false });
}

section("Repeating (Q35)");
{
  const magazine = { _id: "mag", name: "Magazine", recordType: "items", data: { type: "consumable", itemCategory: "ammo", count: 2, uses: { max: 5, value: 1 } } };
  const crossbow = weapon("Repeating Hand Crossbow", ["Repeating"], { range: 60, reload: "0", ammo: 2, ammoSelect: "mag", group: "crossbow" });
  let result = strike(pc([crossbow, magazine]), crossbow);
  assertIncludes("the shot that empties the magazine: the swap's cost", result.metadata.reloadNote, "loading a new one takes a free hand and 3 Interact actions");
  const full = { ...magazine, data: { ...magazine.data, uses: { max: 5, value: 4 } } };
  result = strike(pc([crossbow, full]), crossbow);
  assert("shots left in it: no note", result.metadata.reloadNote, "");
}

section("Switching off magazine ammo (attack-list.html)");
{
  // The row's ammo dropdown handler, run as Realm runs it on the sheet
  const fs = require("fs");
  const vm = require("vm");
  const html = fs.readFileSync(`${__dirname}/../attack-list.html`, "utf8");
  const handler = html.match(/  function onAmmoSelectChange\(value\) \{[\s\S]*?\n  \}\r?\n/);
  new vm.Script(handler[0], { filename: "attack-list.html" }).runInContext(ctx);
  const magazine = { _id: "mag", name: "Magazine", recordType: "items", data: { type: "consumable", itemCategory: "ammo", count: 2, uses: { max: 5, value: 5 } } };
  const select = (item, ammoId) => {
    const record = pc([item, rounds, magazine]);
    const saved = { getValue: ctx.api.getValue, setValues: ctx.api.setValues };
    let written = {};
    ctx.record = record;
    ctx.dataPath = "data.inventory.0.data.ammoSelect";
    ctx.api.getValue = (path) => (path === "data.inventory.0" ? record.data.inventory[0] : undefined);
    ctx.api.setValues = (values) => Object.assign(written, values);
    try {
      ctx.onAmmoSelectChange(ammoId);
    } finally {
      Object.assign(ctx.api, saved);
    }
    return written;
  };
  const pepperbox = gun("Pepperbox", ["Capacity-3"]);
  const onMagazine = gun("Pepperbox", ["Capacity-3"], { uses: { max: 5, value: 5 } });
  assert("a magazine: the weapon mirrors its size", select(pepperbox, "mag")["data.inventory.0.data.uses.max"], 5);
  const back = select(onMagazine, "rounds");
  assert("back to single rounds: the mirrored size is dropped", back["data.inventory.0.data.uses.max"], 0);
  assert("... so the capacity counts again", ctx.getLoadCapacity(gun("Pepperbox", ["Capacity-3"], { uses: { max: back["data.inventory.0.data.uses.max"], value: 5 } })), 3);
  assert("never on a magazine: nothing extra written", "data.inventory.0.data.uses.max" in select(pepperbox, "rounds"), false);
}

process.exitCode = summary() > 0 ? 1 : 0;
