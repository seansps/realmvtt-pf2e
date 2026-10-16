// Tests for limited uses (rollhandlers/limited-uses.js): actions and feats
// with a frequency keep their uses on the sheet, Use and Send to Chat spend
// one, and uses come back at turn start, encounter end, Refocus, when an hour
// passes and at daily preparations. Orc Ferocity (dying.js) spends its feat's
// uses once the sheet keeps them.
// Run: node tests/test-limited-uses.js   (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();
const state = ctx.__state;

// The API calls the code makes. Callbacks run right away.
let calls = [];
let notices = [];
ctx.api.setValues = (values, cb) => {
  calls.push(["setValues", values]);
  if (typeof cb === "function") cb();
};
ctx.api.setValuesOnTokenById = (id, recordType, values, cb) => {
  calls.push(["set", id, values]);
  if (cb) cb();
};
ctx.api.removeEffectById = (effectId, token, cb) => {
  calls.push(["remove", effectId, token?._id]);
  if (cb) cb();
};
ctx.api.addEffect = (name, token) => calls.push(["add", name, token?._id]);
ctx.api.addEffects = (names, token) => calls.push(["add", ...names, token?._id]);
ctx.api.deductEffectById = (effectId, record, cb) => {
  if (cb) cb();
};
ctx.api.richTextToMarkdown = (text) => text;
ctx.api.showNotification = (message) => notices.push(message);
ctx.api.getSetting = () => "no";
ctx.api.getCombatTracker = (cb) => cb({ round: 2 });
const reset = () => {
  calls = [];
  notices = [];
  state.messages = [];
};

// The module's texts (Player Core)
const ORC_FEROCITY_TEXT =
  "<p><strong>Frequency</strong> once per day</p>\n<p><strong>Trigger</strong> You would be reduced to 0 Hit Points but not immediately killed.</p>\n<hr />\n<p>Fierceness in battle runs through your blood.</p>";
const INCREDIBLE_FEROCITY_TEXT =
  "<p>Given time to collect yourself after a near-death scrape, you can rebuild your ferocity and withstand additional finishing blows. You can use Orc Ferocity with a frequency of once per hour, rather than once per day.</p>";
const CLUE_IN_TEXT =
  "<p><strong>Frequency</strong> once per 10 minutes</p>\n<p><strong>Trigger</strong> Another creature attempts a check that could help get you closer to answering the question at the heart of one of your active investigations.</p>";
const frequencyText = (text) => `<p><strong>Frequency</strong> ${text}</p>\n<p>Effect text.</p>`;

const feat = (name, description = "<p>A feat.</p>", data = {}) => ({
  _id: `feat-${name}`,
  name,
  data: { type: "general", description, ...data },
});
const action = (name, frequency, description = "<p>An action.</p>") => ({
  _id: `action-${name}`,
  name,
  data: { actionType: "action", actions: "reaction", frequency, description },
});
// A row with the uses a sync keeps on it
const withUses = (item, left, max, per, label = "") => ({
  ...item,
  data: { ...item.data, usesMax: max, usesLeft: left, usesPeriod: per, usesLabel: label },
  fields: { usesLeft: { hidden: false }, usesLabel: { hidden: false } },
});
const orcFerocity = () => feat("Orc Ferocity", ORC_FEROCITY_TEXT, { type: "ancestry" });
const clueIn = () => action("Clue In", { max: 1, per: "PT10M" }, CLUE_IN_TEXT);

// A character record or token
function pc(data = {}, { id = "pc", feats = [], actions = [], bonusFeats = [] } = {}) {
  return {
    _id: id,
    recordId: `${id}-record`,
    recordType: "characters",
    name: "Grek",
    record: { name: "Grek", ownerId: "player" },
    identified: true,
    faction: "friend",
    effects: [],
    effectIds: [],
    data: { curhp: 20, hitpoints: 20, level: 13, dying: 0, wounded: 0, feats, actions, bonusFeats, ...data },
  };
}

// A copy of a record with values set by path, as Realm sets them
function apply(record, values) {
  const copy = JSON.parse(JSON.stringify(record));
  for (const [path, value] of Object.entries(values)) {
    const keys = path.split(".");
    let target = copy;
    for (const key of keys.slice(0, -1)) target = target[key] = target[key] ?? {};
    target[keys[keys.length - 1]] = value;
  }
  return copy;
}

// Runs a hook script as Realm does, with its data
function runHook(file, data) {
  reset();
  ctx.data = data;
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/${file}`, "utf8");
  new vm.Script(`(function () {\n${code}\n})();`, { filename: file }).runInContext(ctx);
}

// Runs an HTML file's scripts, as Realm does for a sheet or a list row
function runScripts(file) {
  const html = fs.readFileSync(`${__dirname}/../${file}`, "utf8");
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1], { filename: file }).runInContext(ctx);
  }
}

section("Reading a frequency");
{
  const parse = (text) => ctx.parseFrequencyText(text);
  assert("Orc Ferocity: once per day", parse(ORC_FEROCITY_TEXT), { max: 1, per: "day" });
  assert("Clue In: once per 10 minutes", parse(CLUE_IN_TEXT), { max: 1, per: "PT10M" });
  assert("once every 10 minutes", parse(frequencyText("once every 10 minutes")), { max: 1, per: "PT10M" });
  assert("once per turn", parse(frequencyText("once per turn")), { max: 1, per: "turn" });
  assert("once per round", parse(frequencyText("once per round")), { max: 1, per: "round" });
  assert("once per minute", parse(frequencyText("once per minute")), { max: 1, per: "PT1M" });
  assert("once per hour", parse(frequencyText("once per hour")), { max: 1, per: "PT1H" });
  assert("once per 24 hours", parse(frequencyText("once per 24 hours")), { max: 1, per: "PT24H" });
  assert("twice per week", parse(frequencyText("twice per week")), { max: 2, per: "P1W" });
  assert("three times per day", parse(frequencyText("three times per day")), { max: 3, per: "day" });
  assert("Incredible Ferocity's own text isn't one", parse(INCREDIBLE_FEROCITY_TEXT), null);
  assert("no frequency", parse("<p>You can patch up wounds, even in combat.</p>"), null);
  assert("no description", parse(undefined), null);

  const character = pc();
  assert("an action's data.frequency", ctx.getItemFrequency(character, clueIn()), { max: 1, per: "PT10M" });
  assert(
    "wins over its text",
    ctx.getItemFrequency(character, action("Clue In", { max: 2, per: "round" }, CLUE_IN_TEXT)),
    { max: 2, per: "round" },
  );
  assert(
    "a period Foundry doesn't have falls back to the text",
    ctx.getItemFrequency(character, action("Clue In", { max: 1, per: "PT5M" }, CLUE_IN_TEXT)),
    { max: 1, per: "PT10M" },
  );
  assert("a feat's text", ctx.getItemFrequency(pc({}, { feats: [orcFerocity()] }), orcFerocity()), { max: 1, per: "day" });
  assert(
    "Incredible Ferocity makes Orc Ferocity once per hour",
    ctx.getItemFrequency(pc({}, { feats: [orcFerocity(), feat("Incredible Ferocity", INCREDIBLE_FEROCITY_TEXT)] }), orcFerocity()),
    { max: 1, per: "PT1H" },
  );
  assert(
    "names match without a trailing tag, as hasFeatNamed does",
    ctx.getItemFrequency(pc({}, { feats: [feat("Incredible Ferocity (Orc)")] }), { ...orcFerocity(), name: "Orc Ferocity (Orc)" }),
    { max: 1, per: "PT1H" },
  );
}

section("Keeping the uses on the sheet");
{
  const slot = { _id: "slot", name: "", data: { type: "slot", level: 13 } };
  const character = pc({}, { feats: [feat("Toughness"), orcFerocity(), slot], actions: [clueIn()] });
  let values = {};
  ctx.syncLimitedUses(character, values);
  assert(
    "Orc Ferocity: 1 use per day, full, and shown",
    Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith("data.feats."))),
    {
      "data.feats.1.data.usesMax": 1,
      "data.feats.1.data.usesLeft": 1,
      "data.feats.1.data.usesPeriod": "day",
      "data.feats.1.data.usesLabel": "per day",
      "data.feats.1.fields.usesLeft.hidden": false,
      "data.feats.1.fields.usesLabel.hidden": false,
    },
  );
  assert(
    "Clue In: per 10 minutes",
    [values["data.actions.0.data.usesPeriod"], values["data.actions.0.data.usesLabel"]],
    ["PT10M", "per 10 minutes"],
  );
  const synced = apply(character, values);
  values = {};
  ctx.syncLimitedUses(synced, values);
  assert("a second sync writes nothing", values, {});

  const spent = apply(synced, { "data.feats.1.data.usesLeft": 0 });
  values = {};
  ctx.syncLimitedUses(spent, values);
  assert("a spent use stays spent", values, {});
  values = {};
  ctx.syncLimitedUses(apply(synced, { "data.feats.1.data.usesLeft": 5 }), values);
  assert("more than the most comes down to it", values, { "data.feats.1.data.usesLeft": 1 });

  const later = apply(spent, {});
  later.data.feats.push(feat("Incredible Ferocity", INCREDIBLE_FEROCITY_TEXT));
  values = {};
  ctx.syncLimitedUses(later, values);
  assert(
    "Incredible Ferocity taken later: per hour, the spent use kept",
    values,
    { "data.feats.1.data.usesPeriod": "PT1H", "data.feats.1.data.usesLabel": "per hour" },
  );

  const edited = apply(synced, { "data.feats.1.data.description": "<p>Edited.</p>" });
  values = {};
  ctx.syncLimitedUses(edited, values);
  assert(
    "the frequency taken out of the text: the counter hides",
    values,
    {
      "data.feats.1.data.usesMax": 0,
      "data.feats.1.fields.usesLeft.hidden": true,
      "data.feats.1.fields.usesLabel.hidden": true,
    },
  );
  assert("and the row keeps no uses", ctx.getLimitedUses(apply(edited, values).data.feats[1]), null);

  values = {};
  ctx.syncLimitedUses(pc({ orcFerocityUsed: true }, { feats: [orcFerocity()] }), values);
  assert("Orc Ferocity used today before the sheet kept its uses: none left", values["data.feats.0.data.usesLeft"], 0);
  values = {};
  ctx.syncLimitedUses(pc({}, { bonusFeats: [orcFerocity()] }), values);
  assert("bonus feats too", values["data.bonusFeats.0.data.usesMax"], 1);
  values = {};
  ctx.syncLimitedUses({ ...pc({}, { feats: [orcFerocity()] }), recordType: "npcs" }, values);
  assert("not NPCs", values, {});

  assert("uses read off a row", ctx.getLimitedUses(withUses(clueIn(), 0, 1, "PT10M", "per 10 minutes")), { left: 0, max: 1, per: "PT10M", label: "per 10 minutes" });
  assert("a counter never set reads full", ctx.getLimitedUses({ data: { usesMax: 2, usesPeriod: "day" } }).left, 2);
}

section("A list the same update rewrites whole");
{
  // setFeatSlots writes data.feats whole when it adds slots
  const character = pc({}, { feats: [orcFerocity()] });
  const slot = { _id: "slot", name: "", data: { type: "slot", level: 13 } };
  const values = { "data.feats": [...character.data.feats, slot] };
  ctx.syncLimitedUses(character, values);
  assert("no paths into the list", Object.keys(values), ["data.feats"]);
  const row = values["data.feats"][0];
  assert("its row has the uses", [row.data.usesLeft, row.data.usesLabel, row.fields.usesLeft.hidden], [1, "per day", false]);
  assert("the new slot is left alone", values["data.feats"][1], slot);
  assert("the record's own row isn't changed", character.data.feats[0].data.usesMax, undefined);
}

section("onAddEditFeature");
{
  let written = null;
  const original = ctx.api.setValuesOnRecord;
  ctx.api.setValuesOnRecord = (record, values) => {
    written = values;
  };
  ctx.onAddEditFeature(pc({ level: 1 }, { feats: [orcFerocity()], actions: [clueIn()] }), undefined, true);
  assert(
    "the uses go in the sheet's update",
    [written["data.feats.0.data.usesMax"], written["data.actions.0.data.usesPeriod"]],
    [1, "PT10M"],
  );
  ctx.api.setValuesOnRecord = original;
}

section("Spending a use");
{
  const clue = withUses(clueIn(), 1, 1, "PT10M", "per 10 minutes");
  reset();
  ctx.useAction(clue, "data.actions.0");
  assert("Use spends one", calls, [["setValues", { "data.actions.0.data.usesLeft": 0 }]]);
  assertIncludes("the chat message says what's left", state.messages[0], "#### Clue In&nbsp;:reaction:\n*0 of 1 use left per 10 minutes*\n\n---");
  reset();
  ctx.useAction(withUses(clueIn(), 0, 1, "PT10M", "per 10 minutes"), "data.actions.0");
  assert("none left: nothing spent", calls, []);
  assert("a warning", notices, ["Clue In has no uses left (1 per 10 minutes)."]);
  assertIncludes("it still posts, as in Foundry, with the warning in chat", state.messages[0], "**No uses left** (1 per 10 minutes)\n\n---");
  reset();
  ctx.useAction(withUses(feat("Twice Daily", frequencyText("twice per day")), 2, 2, "day", "per day"), "data.feats.0");
  assertIncludes("more than one", state.messages[0], "*1 of 2 uses left per day*");
  reset();
  ctx.useAction(clue);
  assert("no path, as from an NPC's actions: nothing spent", calls, []);
  assert("and no uses line", state.messages[0].includes("use left"), false);
  reset();
  ctx.useAction(feat("Toughness"), "data.feats.0");
  assert("a feat without uses: nothing spent", calls, []);
  assertIncludes("and its message is as before", state.messages[0], "#### Toughness\n\n---");

  // The rows pass where the action or feat is
  runScripts("character-action-list.html");
  ctx.dataPath = "data.actions.3.data.useBtn";
  ctx.api.getValue = (path) => (path === "data.actions.3" ? clue : null);
  reset();
  ctx.onUseAction();
  assert("an action row's Use spends that row's", calls, [["setValues", { "data.actions.3.data.usesLeft": 0 }]]);
  ctx.dataPath = "data.feats.2.data.sendToChat";
  ctx.api.getValue = (path) => (path === "data.feats.2" ? withUses(orcFerocity(), 1, 1, "day", "per day") : null);
  reset();
  ctx.useFeat();
  assert("a feat row's Send to Chat spends the feat's", calls, [["setValues", { "data.feats.2.data.usesLeft": 0 }]]);
  ctx.dataPath = "";
  ctx.api.getValue = () => null;

  for (const file of ["character-action-list.html", "feats-list.html", "bonus-feats-list.html"]) {
    const html = fs.readFileSync(`${__dirname}/../${file}`, "utf8").replace(/\r/g, "");
    assert(
      `${file}: a uses counter, hidden until the row has uses`,
      /<counter\s+field="usesLeft"\s+maxvaluefield="usesMax"[^>]*editable="true"\s+hidden="true"/.test(html),
      true,
    );
    assert(`${file}: and the period`, html.includes('<label field="usesLabel" size="xs" hidden="true"></label>'), true);
  }
}

section("Uses coming back");
{
  const periods = ["turn", "round", "PT1M", "PT10M", "PT1H", "PT24H", "day", "P1W"];
  const allSpent = pc({}, { feats: periods.map((per) => withUses(feat(per), 0, 1, per)) });
  const back = (point) =>
    Object.keys(ctx.getLimitedUseRecharges(allSpent, point)).map((path) => allSpent.data.feats[path.split(".")[2]].name);
  assert("turn start: per turn and per round", back("turnStart"), ["turn", "round"]);
  assert("encounter end: and per minute", back("encounterEnd"), ["turn", "round", "PT1M"]);
  assert("Refocus: and per 10 minutes", back("refocus"), ["turn", "round", "PT1M", "PT10M"]);
  assert("an hour: and per hour", back("hour"), ["turn", "round", "PT1M", "PT10M", "PT1H"]);
  assert(
    "daily preparations: and per day, but not per 24 hours or per week (the GM's, as in Foundry)",
    back("dailyPreparations"),
    ["turn", "round", "PT1M", "PT10M", "PT1H", "day"],
  );
  assert(
    "back to the most",
    ctx.getLimitedUseRecharges(pc({}, { feats: [withUses(feat("Thrice"), 1, 3, "day")] }), "dailyPreparations"),
    { "data.feats.0.data.usesLeft": 3 },
  );
  assert(
    "a full counter isn't written",
    ctx.getLimitedUseRecharges(pc({}, { feats: [withUses(feat("Full"), 1, 1, "round")] }), "turnStart"),
    {},
  );
  assert(
    "actions and bonus feats too",
    Object.keys(
      ctx.getLimitedUseRecharges(
        pc({}, { actions: [withUses(clueIn(), 0, 1, "round")], bonusFeats: [withUses(feat("Bonus"), 0, 1, "round")] }),
        "turnStart",
      ),
    ),
    ["data.actions.0.data.usesLeft", "data.bonusFeats.0.data.usesLeft"],
  );
  const three = pc(
    {},
    {
      feats: [withUses(orcFerocity(), 0, 1, "day"), withUses(feat("Toughness"), 1, 1, "day"), withUses(feat("Per Hour"), 0, 1, "PT1H")],
      actions: [withUses(clueIn(), 0, 1, "PT10M")],
    },
  );
  assert(
    "the message names them",
    ctx.describeLimitedUseRecharges(three, ctx.getLimitedUseRecharges(three, "dailyPreparations")),
    " Uses back: Clue In, Orc Ferocity and Per Hour.",
  );
  assert("one", ctx.describeLimitedUseRecharges(three, ctx.getLimitedUseRecharges(three, "refocus")), " Uses back: Clue In.");
  assert("none", ctx.describeLimitedUseRecharges(three, {}), "");
}

section("When a turn starts");
{
  const token = pc({}, { feats: [withUses(feat("Reactive Strike"), 0, 1, "round"), withUses(orcFerocity(), 0, 1, "day")] });
  runHook("onTurnStart.js", { token });
  assert("the character's own turn: per round comes back, per day doesn't", calls, [["set", "pc", { "data.feats.0.data.usesLeft": 1 }]]);
  runHook("onTurnStart.js", { token: pc({}, { feats: [withUses(feat("Reactive Strike"), 1, 1, "round")] }) });
  assert("nothing spent: nothing written", calls, []);
  runHook("onTurnStart.js", { token: { ...token, recordType: "npcs" } });
  assert("not NPCs", calls, []);

  // Everyone in the combat tracker (data.tokens)
  const spent = (id) =>
    ({ ...pc({}, { id, feats: [withUses(feat("Per Turn"), 0, 1, "turn"), withUses(feat("Per Round"), 0, 1, "round")] }), linked: true });
  const mover = spent("mover");
  const other = spent("other");
  const goblin = { ...spent("goblin"), recordType: "npcs", faction: "enemy", linked: false };
  runHook("onTurnStart.js", { token: mover, tokens: [mover, other, { ...other, _id: "other-copy" }, goblin] });
  assert(
    "every other character's per-turn uses come back, once each, not per round",
    calls,
    [
      ["set", "mover", { "data.feats.0.data.usesLeft": 1, "data.feats.1.data.usesLeft": 1 }],
      ["set", "other", { "data.feats.0.data.usesLeft": 1 }],
    ],
  );
  runHook("onTurnStart.js", { token: goblin, tokens: [mover, goblin] });
  assert("on an NPC's turn too", calls, [["set", "mover", { "data.feats.0.data.usesLeft": 1 }]]);
  runHook("onTurnStart.js", { token: mover, tokens: [mover, { ...mover, _id: "mover-copy" }] });
  assert("a second token of the same character isn't another creature", calls.length, 1);
}

section("When the encounter ends");
{
  const fighter = pc({}, { id: "t1", feats: [withUses(feat("Per Minute"), 0, 1, "PT1M"), withUses(feat("Per Hour"), 0, 1, "PT1H")] });
  const foe = { ...pc({}, { id: "t2", feats: [withUses(feat("Per Minute"), 0, 1, "PT1M")] }), recordType: "npcs", faction: "enemy" };
  runHook("onEncounterEnd.js", { tokens: [fighter, foe] });
  const sets = () => calls.filter((call) => call[0] === "set");
  assert("per minute comes back for the character, per hour doesn't", sets(), [["set", "t1", { "data.feats.0.data.usesLeft": 1 }]]);
  const linked = { ...fighter, linked: true };
  runHook("onEncounterEnd.js", { tokens: [linked, { ...linked, _id: "t3" }, foe] });
  assert("once for a character with two linked tokens", sets().length, 1);
}

section("Refocus, an hour passing and rest");
{
  runScripts("characters-main.html");
  const spent = () =>
    pc(
      {},
      {
        feats: [withUses(orcFerocity(), 0, 1, "day", "per day"), withUses(feat("Per Hour"), 0, 1, "PT1H", "per hour")],
        actions: [withUses(clueIn(), 0, 1, "PT10M", "per 10 minutes")],
      },
    );
  ctx.record = spent();
  reset();
  ctx.shortRest();
  const refocused = calls.find((call) => call[0] === "setValues")?.[1] || {};
  assert(
    "Refocus: per 10 minutes comes back, not per hour or per day",
    [refocused["data.actions.0.data.usesLeft"], refocused["data.feats.0.data.usesLeft"], refocused["data.feats.1.data.usesLeft"]],
    [1, undefined, undefined],
  );
  assertIncludes("the message says so", state.messages[0], "Uses back: Clue In.");
  reset();
  ctx.passHour();
  assert("an hour: per hour and less", calls, [["setValues", { "data.actions.0.data.usesLeft": 1, "data.feats.1.data.usesLeft": 1 }]]);
  assert("the message", state.messages[0], "An hour passes. Uses back: Clue In and Per Hour.");
  ctx.record = pc();
  reset();
  ctx.passHour();
  assert("nothing to bring back: nothing written", [calls, state.messages[0]], [[], "An hour passes. No uses to bring back."]);
  ctx.record = spent();
  reset();
  ctx.rest();
  const rested = calls.find((call) => call[0] === "setValues")?.[1] || {};
  assert(
    "rest: per day and everything shorter",
    [rested["data.feats.0.data.usesLeft"], rested["data.feats.1.data.usesLeft"], rested["data.actions.0.data.usesLeft"]],
    [1, 1, 1],
  );
  assertIncludes("the message says so", state.messages[0], "Uses back: Clue In, Orc Ferocity and Per Hour.");
  ctx.record = apply(spent(), { "data.orcFerocityUsed": true });
  reset();
  ctx.rest();
  const flagged = calls.find((call) => call[0] === "setValues")?.[1] || {};
  assert("and the old Orc Ferocity flag is cleared", [flagged["data.feats.0.data.usesLeft"], flagged["data.orcFerocityUsed"]], [1, false]);
  ctx.record = { data: {}, fields: {}, type: "characters", _id: "test" };
}

section("Orc Ferocity spends its feat's uses");
{
  const orc = (left, { per = "day", label = "per day", extra = [], data = {} } = {}) =>
    pc({ curhp: 0, dying: 1, ...data }, { feats: [withUses(orcFerocity(), left, 1, per, label), ...extra] });
  assert("a use left: it can be used", ctx.canUseOrcFerocity(orc(1)), true);
  assert("none left: it can't", ctx.canUseOrcFerocity(orc(0)), false);
  assert("the old flag doesn't count once the sheet keeps the uses", ctx.canUseOrcFerocity(orc(1, { data: { orcFerocityUsed: true } })), true);
  const hourly = orc(0, { per: "PT1H", label: "per hour", extra: [feat("Incredible Ferocity", INCREDIBLE_FEROCITY_TEXT)] });
  assert("Incredible Ferocity, none left this hour: it can't", ctx.canUseOrcFerocity(hourly), false);
  assert(
    "before the sheet keeps them: the flag, as before",
    [
      ctx.canUseOrcFerocity(pc({}, { feats: [orcFerocity()] })),
      ctx.canUseOrcFerocity(pc({ orcFerocityUsed: true }, { feats: [orcFerocity()] })),
    ],
    [true, false],
  );

  reset();
  ctx.useOrcFerocity(orc(1), { dying: 0 });
  assert(
    "using it spends the feat's use, not the flag",
    calls[0],
    ["set", "pc", { "data.curhp": 1, "data.dying": 0, "data.wounded": 1, "data.feats.0.data.usesLeft": 0 }],
  );
  assertIncludes("the message says what's left", state.messages[0], "0 of 1 use left per day");
  reset();
  ctx.useOrcFerocity(hourly, { dying: 0 });
  assert("none left: nothing changes", calls, []);
  assert("and the notice gives the frequency", notices, ["Grek has no uses of Orc Ferocity left (1 per hour)."]);

  const zero = (target) =>
    ctx.getZeroHitPointsChanges(apply(target, { "data.dying": 0 }), { valuesToSet: {}, oldValues: {} }).buttons;
  assert("at 0 Hit Points with a use left: the button", zero(orc(1)).some((button) => button.includes("useOrcFerocity")), true);
  assert("none left: no button", zero(orc(0)).some((button) => button.includes("useOrcFerocity")), false);
}

process.exitCode = summary();
