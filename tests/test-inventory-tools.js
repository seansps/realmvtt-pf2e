// Tests for the inventory tools (inventory-tools.js): effects on Use,
// selling, investiture, handwraps of mighty blows and Bulk limits.

const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, assertNotIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

// The Player Core 2 module's Bestial Mutagen (Lesser) description, as stored
const MUTAGEN_DESCRIPTION =
  '<p><strong>Duration</strong> 1 minute.</p>\n<p><record-link recordlink="{&quot;value&quot;:{&quot;_id&quot;:&quot;6ace89f1494b20873365b333&quot;,&quot;name&quot;:&quot;Effect: Bestial Mutagen (Lesser)&quot;,&quot;recordType&quot;:&quot;effects&quot;,&quot;identified&quot;:true},&quot;tooltip&quot;:&quot;Effect: Bestial Mutagen (Lesser)&quot;,&quot;type&quot;:&quot;effects&quot;}">Effect: Bestial Mutagen (Lesser)</record-link></p>';
const SPELL_LINK =
  '<record-link recordlink="{&quot;value&quot;:{&quot;_id&quot;:&quot;sp1&quot;,&quot;name&quot;:&quot;Heal&quot;,&quot;recordType&quot;:&quot;spells&quot;},&quot;type&quot;:&quot;spells&quot;}">Heal</record-link>';

const item = (name, data = {}, extra = {}) => ({ _id: name.toLowerCase().replace(/\W+/g, "-"), name, data: { count: 1, ...data }, ...extra });
const character = (inventory, data = {}) => ({ _id: "pc", name: "Valeros", recordType: "characters", data: { inventory, ...data } });

section("Effects on Use (Q4)");
{
  const links = ctx.getItemEffectLinks(MUTAGEN_DESCRIPTION).map((e) => JSON.parse(e));
  assert("the module's effect link is read", links, [{ _id: "6ace89f1494b20873365b333", name: "Effect: Bestial Mutagen (Lesser)" }]);
  assert("a spell link isn't an effect", ctx.getItemEffectLinks(SPELL_LINK), []);
  assert("no description: none", ctx.getItemEffectLinks(undefined), []);
  const own = JSON.stringify({ _id: "e2", name: "Effect: Homebrew Tonic" });
  const twice = JSON.stringify({ _id: "6ace89f1494b20873365b333", name: "Effect: Bestial Mutagen (Lesser)" });
  const mutagen = item("Bestial Mutagen (Lesser)", { description: MUTAGEN_DESCRIPTION, useEffects: [own, twice] });
  assert("its own effects first, then the linked ones, each once", ctx.getItemUseEffects(mutagen).map((e) => JSON.parse(e)._id), ["e2", "6ace89f1494b20873365b333"]);

  ctx.api.getToken = () => ({ _id: "tok", name: "Valeros" });
  const macros = ctx.getEffectMacrosFor(ctx.getItemUseEffects(item("Mutagen", { description: MUTAGEN_DESCRIPTION })), "");
  assertIncludes("the Use card gets an Apply button", macros, "Apply_Effect:_Bestial_Mutagen_(Lesser)");
  assertIncludes("... that applies the linked effect", macros, "applyEffectButton('6ace89f1494b20873365b333'");
  ctx.api.getToken = () => null;
}

section("Investiture (Q31)");
{
  const ring = (n, invested = "true") => item(`Ring ${n}`, { traits: ["Invested", "Magical"], invested, carried: "equipped" });
  const nine = Array.from({ length: 9 }, (_, i) => ring(i + 1));
  const runeArmor = item("Chain Mail +1", { type: "armor", runes: { potency: 1 }, invested: "true" });
  const rope = item("Rope", {});
  const pc = character([...nine, runeArmor, rope, ring(11, "false")]);
  assert("9 invested rings + rune armor: 10", ctx.getInvestedCount(pc), 10);
  assert("rope and an uninvested ring don't count", ctx.getInvestedCount(character([rope, ring(1, "false")])), 0);
  const eleventh = pc.data.inventory[11];
  assertIncludes("investing an 11th warns", ctx.getInvestmentWarning(pc, eleventh, "true"), "invested item 11");
  assert("divesting doesn't", ctx.getInvestmentWarning(pc, eleventh, "false"), "");
  assert("re-investing one already counted doesn't", ctx.getInvestmentWarning(pc, nine[0], "true"), "");
  assertIncludes("using an uninvested invested-trait item warns", ctx.getUninvestedUseWarning(eleventh), "isn't invested");
  assert("... an invested one doesn't", ctx.getUninvestedUseWarning(nine[0]), "");
  assert("... nor a potion", ctx.getUninvestedUseWarning(item("Healing Potion", { type: "consumable", traits: ["Consumable"] })), "");
}

section("Selling (Q30)");
{
  const sword = item("Longsword", { type: "weapon", price: { value: { gp: 1 } } });
  assert("half Price: 1 gp sells for 5 sp", ctx.getSellValueCp(sword), 50);
  const gem = item("Jade", { type: "treasure", price: { value: { gp: 10 } } });
  assert("treasure sells for its full Price", ctx.getSellValueCp(gem), 1000);
  const arrows = item("Arrows", { type: "weapon", bundleSize: 10, price: { value: { sp: 1 } }, count: 30 });
  assert("a bundle's Price is shared: an arrow is worth half of 1 cp", ctx.getSellValueCp(arrows), 0.5);
  assert("the total is rounded down, not each arrow: 10 sell for 5 cp", ctx.getSellTotalCp(arrows, 10), 5);
  assert("... 1 sells for 0 cp", ctx.getSellTotalCp(arrows, 1), 0);
  assert("... 3 sell for 1 cp", ctx.getSellTotalCp(arrows, 3), 1);
  const quiver = character([arrows], { cp: 0 });
  assert("selling 10 of 30 arrows: +5 cp, 20 left", ctx.getSellValues(quiver, 0, 10).valuesToSet, { "data.cp": 5, "data.inventory.0.data.count": 20 });
  assertIncludes("shoddy: a note", ctx.getSellNote(item("Shoddy Longsword", {})), "Shoddy");
  assertIncludes("infused: a note", ctx.getSellNote(item("Elixir", { traits: ["Infused"] })), "infused");
  assert("an ordinary item: none", ctx.getSellNote(sword), "");

  const pc = character([sword, { ...gem, data: { ...gem.data, count: 3 } }], { gp: 2, sp: 9 });
  const all = ctx.getSellValues(pc, 0, 1);
  assert("selling the only sword: +5 sp (9 + 5 = 14 sp), and the row goes", [all.valuesToSet, all.removeRow], [{ "data.sp": 14 }, true]);
  const some = ctx.getSellValues(pc, 1, 2);
  assert("selling 2 of 3 gems: +20 gp, 1 left", [some.valuesToSet, some.removeRow], [{ "data.gp": 22, "data.inventory.1.data.count": 1 }, false]);
  assert("can't sell more than you have", ctx.getSellValues(pc, 1, 9).sold, 3);

  // The setting "Allow Selling from the Sheet" is off by default
  assert("selling is off by default", ctx.isSellingAllowed(), false);
  const shown = character([sword, { ...gem, fields: { sellBtn: { hidden: true } } }]);
  assert("off: the tab's load hides only the rows not hidden yet", ctx.getSellButtonValues(shown), { "data.inventory.0.fields.sellBtn.hidden": true });
  const offValues = {};
  ctx.setItemFields(sword, "data.inventory.0", offValues);
  assert("off: setItemFields hides a new row's Sell button", offValues["data.inventory.0.fields.sellBtn.hidden"], true);
  const offCalls = [];
  ctx.record = pc;
  ctx.api.showConfirm = () => offCalls.push("confirm");
  ctx.api.showPrompt = () => offCalls.push("prompt");
  ctx.sellInventoryItem("data.inventory.1");
  assert("off: sellInventoryItem does nothing", offCalls, []);

  ctx.api.getSetting = (key) => (key === "sellFromSheet" ? "yes" : null);
  assert("on: selling is allowed", ctx.isSellingAllowed(), true);
  assert("on: the tab's load shows the hidden rows", ctx.getSellButtonValues(shown), {
    "data.inventory.0.fields.sellBtn.hidden": false,
    "data.inventory.1.fields.sellBtn.hidden": false,
  });
  assert("... and writes nothing once they match", ctx.getSellButtonValues(character([{ ...sword, fields: { sellBtn: { hidden: false } } }])), {});

  // The sheet flow: confirm, write the coins, then remove the row by its id
  const calls = [];
  ctx.record = pc;
  ctx.api.showConfirm = (title, text, ok, cancel, callback) => {
    calls.push(["confirm", text]);
    callback();
  };
  ctx.api.getRecord = (type, id, callback) => callback(pc);
  ctx.api.setValues = (values, callback) => {
    calls.push(["set", values]);
    callback(pc);
  };
  ctx.api.removeValueFromRecord = (rec, path, index, callback) => {
    calls.push(["remove", path, index]);
    callback && callback();
  };
  ctx.api.setValuesOnRecord = () => {};
  ctx.__state.messages.length = 0;
  ctx.sellInventoryItem("data.inventory.0");
  assertIncludes("the confirm names the price and the rule", calls[0][1], "for 5 sp (half Price)");
  assert("coins first, then the row by its index", calls.slice(1).map((c) => c[0]), ["set", "remove"]);
  assert("... the sword's row", calls[2].slice(1), ["data.inventory", 0]);
  assertIncludes("a chat line says what sold", ctx.__state.messages[0], "Sold Longsword for 5 sp");
  ctx.api.setValues = () => {};
  ctx.api.getSetting = () => null;
}

section("Handwraps of mighty blows (Q33)");
{
  const fist = item("Fist", { type: "weapon", itemCategory: "unarmed", damage: { dice: 1, die: "d4" }, carried: "equipped" });
  const handwraps = item("Handwraps of Mighty Blows", {
    type: "weapon",
    itemCategory: "unarmed",
    usage: "worngloves",
    traits: ["Invested", "Magical"],
    runes: { potency: "2", striking: "1", property: ["flaming"] },
    carried: "equipped",
    invested: "true",
  });
  const sword = item("Longsword", { type: "weapon", itemCategory: "martial", carried: "equipped" });
  const pc = character([fist, handwraps, sword]);
  const runes = ctx.withHandwrapsRunes(pc, fist).data.runes;
  assert("a fist takes the handwraps' potency, striking and property runes", [runes.potency, runes.striking, runes.property], ["2", "1", ["flaming"]]);
  assert("a longsword doesn't", ctx.withHandwrapsRunes(pc, sword), sword);
  assert("the handwraps' own attack is unchanged", ctx.withHandwrapsRunes(pc, handwraps), handwraps);
  const uninvested = character([fist, { ...handwraps, data: { ...handwraps.data, invested: "false" } }]);
  assert("not invested: no runes", ctx.withHandwrapsRunes(uninvested, fist), fist);
  const carried = character([fist, { ...handwraps, data: { ...handwraps.data, carried: "carried" } }]);
  assert("not worn: no runes", ctx.withHandwrapsRunes(carried, fist), fist);
  const homebrew = character([fist, { ...handwraps, name: "Knuckle Wraps", data: { ...handwraps.data, handwraps: true } }]);
  assert("a renamed item with the Handwraps box ticked works too", ctx.withHandwrapsRunes(homebrew, fist).data.runes.potency, "2");
  assert("better runes on the fist itself are kept", ctx.withHandwrapsRunes(pc, { ...fist, data: { ...fist.data, runes: { potency: "3" } } }).data.runes.potency, "3");
  assert("the fist takes the handwraps' item-only modifiers", ctx.getHandwrapsItemIdFor(pc, fist._id), handwraps._id);
  assert("... a longsword doesn't", ctx.getHandwrapsItemIdFor(pc, sword._id), null);
  assert("getAlteredWeapon gives an unarmed attack the runes", ctx.getAlteredWeapon(pc, fist).data.runes.potency, "2");
  assert("an NPC's attacks are left alone", ctx.withHandwrapsRunes({ ...pc, recordType: "npcs" }, fist), fist);
}

section("Bulk limits and Encumbered (Q16)");
{
  assert("Str +2: encumbered above 7, 12 at most", ctx.getBulkLimits(2), { encumberedAt: 7, max: 12 });
  assert("Hefty Hauler +2 raises both", ctx.getBulkLimits(2, 2), { encumberedAt: 9, max: 14 });
  assert("fractions dropped: 2.9 is 2", ctx.dropBulkFractions(2.9), 2);
  assert("12 light items (1.2) are 1", ctx.dropBulkFractions(0.1 * 12), 1);
  assert("9 light items are 0", ctx.dropBulkFractions(0.1 * 9), 0);
  const torches = item("Torch", { bulk: { value: 0.1 }, count: 12, carried: "carried" });
  const pack = item("Backpack", { bulk: { value: 1 }, count: 1, carried: "carried" });
  assert("total Bulk drops the fraction: 1 + 12 light = 2", ctx.updateTotalBulk(character([torches, pack]), false), 2);

  const pc = character([], { bulk: 7, maxBulk: 12 });
  assert("7 is not over 7", ctx.getEncumbranceMessage(pc, 6, 7), "");
  const over = ctx.getEncumbranceMessage(pc, 7, 8);
  assertIncludes("8 is: encumbered", over, "encumbered (clumsy 1, -10 feet to Speeds)");
  assertIncludes("... with an Apply button", over, "api.addEffect('Encumbered', token)");
  assert("still encumbered: no new card", ctx.getEncumbranceMessage(pc, 8, 9), "");
  assertIncludes("back to 7: no longer", ctx.getEncumbranceMessage(pc, 8, 7), "no longer encumbered");
  assertIncludes("over 12: can't carry that much", ctx.getEncumbranceMessage(pc, 10, 13), "more than the most they can carry (12)");

  // The card is posted only for changes the user made, never when the tab loads
  const heavy = character([item("Anvil", { bulk: { value: 8 }, count: 1, carried: "carried" })], { bulk: 7, maxBulk: 12, totalBulk: 6 });
  ctx.__state.messages.length = 0;
  ctx.updateTotalBulk(heavy, true);
  assert("a load's recalc (no announce) posts no card", ctx.__state.messages, []);
  ctx.updateTotalBulk(heavy, true, true);
  assert("a user's change (announce) posts it", ctx.__state.messages.length, 1);
  ctx.__state.messages.length = 0;

  // Speed penalties from effects (the Encumbered condition's -10 feet)
  const slowed = {
    ...character([]),
    effects: [{ _id: "enc", name: "Encumbered", rules: [{ type: "speedPenalty-status", value: "10", valueType: "number" }] }],
    effectIds: ["enc"],
  };
  const mods = ctx.getEffectsAndModifiersForToken(slowed, ["speedPenalty"]);
  assert("a speedPenalty-status effect reaches the Speed lookup", mods.map((m) => [m.value, m.type]), [[-10, "status"]]);
  const untyped = { ...slowed, effects: [{ _id: "enc", name: "Encumbered", rules: [{ type: "speedPenalty", value: "10", valueType: "number" }] }] };
  const untypedMods = ctx.getEffectsAndModifiersForToken(untyped, ["speedPenalty"]);
  assert("an untyped speedPenalty effect (Foundry's Encumbered) reaches it too", untypedMods.map((m) => m.value), [-10]);
}

process.exitCode = summary() > 0 ? 1 : 0;
