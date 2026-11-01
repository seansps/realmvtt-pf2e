// Tests for the focus pool (rollhandlers/spell-entries.js): one pool for a
// character, sized by their focus spells, spent by any focus entry and
// refilled 1 point by Refocus. Run: node tests/test-focus-pool.js
// (or via tests/run-all.js)

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();
// spells.js shares the sheet's scope with common.js at runtime
new vm.Script(fs.readFileSync(__dirname + "/../rollhandlers/spells.js", "utf8"), {
  filename: "spells.js",
}).runInContext(ctx);

const spell = (name, traits = ["Focus"]) => ({
  _id: `spell-${name}`,
  name,
  recordType: "spells",
  data: { type: "spell", level: 1, traits, description: "" },
  fields: {},
});
const focusEntry = (name, spells, data = {}) => ({
  _id: `entry-${name}`,
  name,
  data: {
    type: "focus",
    tradition: "Divine",
    attribute: "wis",
    training: 1,
    focusPool: 0,
    focusPoolMax: 1,
    spells1: spells,
    cantrips: [],
    ...data,
  },
  fields: {},
});
const character = (spells, data = {}, feats = []) => ({
  _id: "pc",
  name: "Kyra",
  recordType: "characters",
  data: { level: 3, wis: 4, spellcasting: "1", spells, feats: feats.map((name) => ({ name, data: { type: "class" } })), ...data },
  fields: {},
});

section("The pool's size");
{
  const domain = focusEntry("Domain Spells", [spell("Fire Ray")]);
  assert("one focus spell: 1 point", ctx.getFocusPoolMax(character([domain])), 1);
  const school = focusEntry("School Spells", [spell("Force Bolt")]);
  assert("two entries with one each: 2 points in one pool", ctx.getFocusPoolMax(character([domain, school])), 2);
  const many = focusEntry("Devotion Spells", [spell("Lay on Hands"), spell("Shield of Faith"), spell("Litany"), spell("Champion's Sacrifice")]);
  assert("four focus spells: 3 at most", ctx.getFocusPoolMax(character([many])), 3);
  const compositions = focusEntry("Compositions", [spell("Courageous Anthem", ["Cantrip", "Composition", "Focus"])], {
    cantrips: [spell("Song of Strength", ["Cantrip", "Focus"])],
  });
  assert("focus cantrips don't count", ctx.getFocusPoolMax(character([compositions], { focusPool: 0 })), 0);
  const prepared = { ...focusEntry("Arcane Prepared Spells", [spell("Fireball", [])]), data: { type: "prepared", spells1: [spell("Fireball", [])] } };
  assert("spells in other entries don't count", ctx.getFocusPoolMax(character([prepared, domain])), 1);
  const slots = focusEntry("Domain Spells", [ctx.buildSpellRow("prepared", 1, 0)]);
  assert("empty rows don't count", ctx.getFocusPoolMax(character([slots], { focusPool: 0 })), 0);
  const psi = focusEntry("Psi Cantrips", [], { cantrips: [spell("Daze", ["Cantrip", "Psyche"])] });
  assert("Psi Cantrips and Amps: 2 points", ctx.getFocusPoolMax(character([psi], {}, ["Psi Cantrips and Amps"])), 2);
  assert("and Clarity of Focus 1 more", ctx.getFocusPoolMax(character([psi], {}, ["Psi Cantrips and Amps", "Clarity of Focus"])), 3);
  assert("Psychic Dedication: a pool of 1 for its psi cantrip", ctx.getFocusPoolMax(character([psi], {}, ["Psychic Dedication"])), 1);
  assert("up to 3", ctx.getFocusPoolMax(character([psi], {}, ["Psi Cantrips and Amps", "Clarity of Focus", "Psi Development"])), 3);
}

section("Focus Pool Max set by hand");
{
  const unlisted = focusEntry("Domain Spells", []);
  assert("raises a pool the entries list no spells for", ctx.getFocusPoolMax(character([unlisted], { focusPool: 0, focusPoolMaxManual: 2 })), 2);
  const domain = focusEntry("Domain Spells", [spell("Fire Ray"), spell("Healer's Blessing")]);
  assert("never lowers the pool the focus spells give", ctx.getFocusPoolMax(character([domain], { focusPool: 0, focusPoolMaxManual: 1 })), 2);
  assert("up to 3", ctx.getFocusPoolMax(character([unlisted], { focusPool: 0, focusPoolMaxManual: 5 })), 3);
  const legacy = focusEntry("Domain Spells", [], { focusPoolMax: 2 });
  assert("a character from before keeps their entry's maximum", ctx.getFocusPoolMax(character([legacy])), 2);
  assert("and it's written with the pool", ctx.getFocusPoolValues(character([legacy]), 0)["data.focusPoolMaxManual"], 2);
  assert("but not once the pool is kept on the character", ctx.getFocusPoolMax(character([legacy], { focusPool: 0 })), 0);
  const two = [focusEntry("Domain Spells", []), focusEntry("School Spells", [])];
  const values = ctx.getFocusPoolManualMaxValues(character(two, { focusPool: 1, focusPoolMax: 0 }), "2");
  assert(
    "typed on an entry, it's kept on the character and every entry shows the pool",
    [values["data.focusPoolMaxManual"], values["data.focusPoolMax"], values["data.spells.0.data.focusPoolMax"], values["data.spells.1.data.focusPoolMax"], values["data.spells.1.data.focusPool"]],
    [2, 2, 2, 2, 1],
  );
}

section("Points spent");
{
  const domain = focusEntry("Domain Spells", [spell("Fire Ray")], { focusPool: 1 });
  const school = focusEntry("School Spells", [spell("Force Bolt")], { focusPool: 1 });
  assert("kept on the character", ctx.getFocusPointsSpent(character([domain, school], { focusPool: 0 })), 0);
  assert("before the pool was shared: what the entries spent between them", ctx.getFocusPointsSpent(character([domain, school])), 2);
  assert("never more than the pool holds", ctx.getFocusPointsSpent(character([domain], { focusPool: 3 })), 1);

  const values = ctx.getFocusPoolValues(character([domain, { ...school, data: { ...school.data, type: "prepared" } }, school]), 1);
  assert("setting it writes the character and every focus entry", values, {
    "data.focusPool": 1,
    "data.focusPoolMax": 2,
    "data.focusPoolMaxManual": 2,
    "data.spells.0.data.focusPool": 1,
    "data.spells.0.data.focusPoolMax": 2,
    "data.spells.2.data.focusPool": 1,
    "data.spells.2.data.focusPoolMax": 2,
  });
  assert("never below 0", ctx.getFocusPoolValues(character([domain]), -2)["data.focusPool"], 0);
}

section("Casting a focus spell spends from the one pool");
{
  let written = null;
  let notices = [];
  ctx.getNearestParentDataPath = (path) => `${path}`.replace(/\.data\.[^.]+\.\d+$/, "");
  ctx.api.getValueOnRecord = (target, path) => path.split(".").reduce((value, key) => value?.[key], target);
  ctx.api.setValuesOnRecord = (target, values) => {
    written = values;
  };
  ctx.api.showNotification = (message) => notices.push(message);
  ctx.api.richTextToMarkdown = (text) => `${text || ""}`;
  const cast = (record, entryIndex) => {
    written = null;
    notices = [];
    const entry = record.data.spells[entryIndex];
    ctx.castSpell(record, entry.data.spells1[0], `data.spells.${entryIndex}.data.spells1.0`);
    return written;
  };
  const record = character([focusEntry("Domain Spells", [spell("Fire Ray")]), focusEntry("School Spells", [spell("Force Bolt")])], { focusPool: 0 });
  let values = cast(record, 1);
  assert("casting from the second entry spends 1 of the 2", [values["data.focusPool"], values["data.spells.0.data.focusPool"], values["data.spells.1.data.focusPool"]], [1, 1, 1]);
  values = cast({ ...record, data: { ...record.data, focusPool: 2 } }, 0);
  assert("with both spent, the first entry can't cast either", [values, notices.length], [null, 1]);

  const npc = {
    _id: "npc",
    name: "Priest",
    recordType: "npcs",
    data: { level: 3, spells: [focusEntry("Domain Spells", [spell("Fire Ray")], { focusPool: 0, focusPoolMax: 2 })] },
    fields: {},
  };
  values = cast(npc, 0);
  assert("an NPC spends from the entry's own pool", [values["data.spells.0.data.focusPool"], "data.focusPool" in values], [1, false]);
}

section("The sheet keeps every focus entry showing the pool");
{
  const domain = focusEntry("Domain Spells", [spell("Fire Ray")], { focusPool: 1, focusPoolMax: 1 });
  const school = focusEntry("School Spells", [spell("Force Bolt")], { focusPool: 0, focusPoolMax: 1 });
  const record = character([domain, school]);
  const values = {};
  ctx.updateSpellcastingEntries(record, values);
  assert("the character's pool is written: 1 of 2 spent", [values["data.focusPool"], values["data.focusPoolMax"]], [1, 2]);
  assert("both entries show it", [values["data.spells.0.data.focusPoolMax"], values["data.spells.1.data.focusPool"], values["data.spells.1.data.focusPoolMax"]], [2, 1, 2]);
  assert("keep their own Focus Pool Max setting shown", values["data.spells.1.fields.focusPoolMax"], undefined);
  assert("the entries' old maximums are kept as the one set by hand", values["data.focusPoolMaxManual"], 2);
  const synced = JSON.parse(JSON.stringify(record));
  for (const [path, value] of Object.entries(values)) {
    const keys = path.split(".");
    let target = synced;
    for (const key of keys.slice(0, -1)) target = target[key] = target[key] ?? {};
    target[keys[keys.length - 1]] = value;
  }
  const again = {};
  ctx.updateSpellcastingEntries(synced, again);
  assert("a second sync writes no focus values", Object.keys(again).filter((key) => /focusPool/.test(key)), []);
}

section("Refocus and rest");
{
  // The character sheet's script, as Realm runs it
  const sheet = fs.readFileSync(__dirname + "/../characters-main.html", "utf8");
  for (const match of sheet.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1], { filename: "characters-main.html" }).runInContext(ctx);
  }
  let written = null;
  ctx.api.setValues = (values, callback) => {
    written = values;
    if (typeof callback === "function") callback();
  };
  ctx.api.sendMessage = () => {};
  const two = [focusEntry("Domain Spells", [spell("Fire Ray")]), focusEntry("School Spells", [spell("Force Bolt")])];
  ctx.record = character(two, { focusPool: 2 });
  ctx.shortRest();
  assert("Refocus gives back 1 point, not 1 per entry", [written["data.focusPool"], written["data.spells.0.data.focusPool"], written["data.spells.1.data.focusPool"]], [1, 1, 1]);
  written = null;
  ctx.record = character(two, { focusPool: 0 });
  ctx.shortRest();
  assert("with nothing spent, nothing is written", written, null);
}

process.exitCode = summary();
