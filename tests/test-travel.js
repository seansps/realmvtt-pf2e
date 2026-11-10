// Tests for travel and the environment (travel.js, roadmap B5 and B6):
// hexploration, travel time, weather, environmental damage and falling.

const fs = require("fs");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let vars = {};
ctx.api.getCampaignVariable = (name) => vars[name];
ctx.api.setCampaignVariable = (name, value) => {
  vars[name] = value;
};

const state = (extra = {}) => ({ day: 0, speed: 25, left: 0, region: "plains", road: false, flying: false, forcedMarch: false, task: null, last: "", ...extra });

section("Hexploration: activities per day (Table 3-6)");
{
  assert("by Speed", [10, 15, 25, 30, 40, 45, 55, 60].map(ctx.getHexActivitiesPerDay), [0.5, 1, 1, 2, 2, 3, 3, 4]);
  assert("the wording", [0, 0.5, 1, 1.5, 2].map(ctx.formatActivities), ["0 activities", "½ activity", "1 activity", "1½ activities", "2 activities"]);
  assert("Speed from a character or an NPC", [ctx.getCreatureSpeed({ data: { speed: 25 } }), ctx.getCreatureSpeed({ data: { speed: { value: 30 } } })], [25, 30]);
}

section("Hexploration: the encounter check (Tables 3-7, 3-8)");
{
  const check = (extra, d20, d10s = [3, 9]) => ctx.getHexEncounterCheck(state(extra), d20, d10s);
  assert("plains DC 12: 11 none, 12 one", [check({}, 11).count, check({}, 12).count], [0, 1]);
  assert("a natural 1: none even past the DC", check({ road: true }, 1).count, 0);
  assert("a natural 20 one step better", check({ region: "arctic" }, 20).count, 2);
  assert("road -2, flying +3", [check({ road: true }).dc, check({ region: "forest", flying: true }).dc], [10, 17]);
  assertIncludes("the types", check({}, 20).line, "Two random encounters: Harmless (3), Creature (9).");
  assertIncludes("none", check({ region: "desert" }, 5).line, "Encounter check DC 17: 5. No random encounter.");
}

section("Hexploration: Start Day");
{
  const start = ctx.getStartDayValues(state({ speed: 30 }), { d20: 5 });
  assert("day 1, two activities", [start.state.day, start.state.left], [1, 2]);
  assertIncludes("posted", start.line, "**Day 1** of travel: 2 activities.");
  const forced = ctx.getStartDayValues(state({ speed: 30, day: 1 }), {
    forced: true,
    d20: 5,
    party: [{ name: "Amiri", data: { con: 3 } }, { name: "Ezren", data: { con: 1 } }, { name: "Seelah", data: { con: 0 } }],
  });
  assert("forced march: one more Travel", [forced.state.left, forced.state.forcedMarch], [3, true]);
  assertIncludes("each PC's safe days, minimum 1", forced.gmLines[1], "Safe days (Con modifier, minimum 1): Amiri 3, Ezren 1, Seelah 1.");
  assertIncludes("... and the rule for the GM", forced.gmLines[1], "no forced march while anyone is fatigued");
  assert("no day count kept", "forcedDays" in forced.state, false);
  assert("slow: a full Travel when forced", ctx.getStartDayValues(state({ speed: 10 }), { forced: true, d20: 5 }).state.left, 1);
}

section("Hexploration: Travel and Reconnoiter");
{
  const one = ctx.getHexActivityValues(state({ left: 2 }), "travel", "open");
  assert("open: one activity, done", [one.state.left, one.state.task], [1, null]);
  assertIncludes("posted", one.line, "Travels into the next hex. 1 activity left today.");
  const road = ctx.getHexActivityValues(state({ left: 2 }), "travel", "greater", true);
  assert("greater difficult on a road: 2", [road.state.left, road.state.task], [0, null]);
  const part = ctx.getHexActivityValues(state({ left: 1 }), "reconnoiter", "difficult");
  assert("difficult with 1 left: carried over", [part.state.task.spent, part.state.task.cost, part.state.left], [1, 2, 0]);
  assertIncludes("... says so", part.line, "Reconnoiter: 1 of 2 activities; it continues with the next activity.");
  const done = ctx.getHexActivityValues({ ...part.state, left: 2 }, "reconnoiter", "open");
  assert("next day: the same task finished", [done.state.task, done.state.left], [null, 1]);
  assertIncludes("Map the Area", done.line, "they can Map the Area");
  const slow = ctx.getHexActivityValues(state({ left: 0.5 }), "travel", "open");
  assert("½ a day at Speed 10: half done", [slow.state.task.spent, slow.state.left], [0.5, 0]);
  assertIncludes("no activities", ctx.getHexActivityValues(state({ left: 0 }), "travel", "open").line, "No activities left today");
  const march = ctx.getHexActivityValues(state({ left: 3, forcedMarch: true }), "reconnoiter", "open");
  assert("forced march: no Reconnoiter", [march.state.left, march.line], [3, "Forced march: Travel is the only activity today."]);
  assert("... Travel still runs", ctx.getHexActivityValues(state({ left: 3, forcedMarch: true }), "travel", "open").state.left, 2);
  const switched = ctx.getHexActivityValues(state({ left: 2, task: { kind: "travel", terrain: "greater", road: false, cost: 3, spent: 1 } }), "reconnoiter", "open");
  assertIncludes("switching drops the Travel, and says so", switched.line, "The unfinished Travel (1 of 3 activities) is dropped.");
  assertIncludes("half progress as ½", slow.line, "Travel: ½ of 1 activity;");
}

section("Hexploration: the meter");
{
  const meter = ctx.getHexMeter(state({ day: 3, left: 1, speed: 25, region: "forest", road: true, task: { kind: "travel", terrain: "difficult", road: false, cost: 2, spent: 1 } }));
  assert("labels", [meter.dayLabel, meter.activitiesLabel], ["Day 3", "1 activity left"]);
  assert("detail", meter.detail, "Speed 25 ft (1 activity a day) · Forest, road or river");
  assert("task", meter.task, "Travel (difficult): 1 of 2 activities");
  assert("half a task as ½", ctx.getHexMeter(state({ task: { kind: "travel", terrain: "open", road: false, cost: 1, spent: 0.5 } })).task, "Travel (open): ½ of 1 activity");
  assert("before a day", ctx.getHexMeter(state()).dayLabel, "No day started");
}

section("Travel time");
{
  const time = ctx.getTravelTime(60, 30);
  assert("24 miles a day at Speed 30", time.perDay, 24);
  assert("by terrain", time.lines, ["Open: 2 days 4 hours", "Difficult: 5 days", "Greater difficult: 7 days 4 hours"]);
  assert("no Speed: nothing", ctx.getTravelTime(10, 0), null);
}

section("Weather");
{
  const meter = ctx.getWeatherMeter({ temperature: "severe-cold", precipitation: "heavy", fog: "none", wind: "moderate" });
  assert("summary", meter.summary, "Severe cold (-21°F to 12°F), heavy precipitation, moderate wind");
  assert("fatigue: 4 hours", meter.fatigue, "Overland travel: fatigued after 4 hours.");
  assertIncludes("damage", meter.damage, "Minor cold damage (1d6–2d6) every hour; cold-weather gear negates it.");
  assertIncludes("precipitation", meter.effects[0], "-3 circumstance penalty to visual Perception");
  assertIncludes("... soaked in the cold", meter.effects[0], "one step colder");
  assertIncludes("wind", meter.effects[1], "-2 circumstance penalty to auditory Perception and physical ranged attacks");
  assertIncludes("... fliers, as the GM judges", meter.effects[1], "flying in it can be difficult or greater difficult terrain");
  assert("third line empty", meter.effects[2], "");
  const calm = ctx.getWeatherMeter({ temperature: "normal", precipitation: "light", fog: "heavy", wind: "none" });
  assert("light rain: 8 hours", calm.fatigue, "Overland travel: fatigued after 8 hours.");
  assertIncludes("fog: can conceal", calm.effects[1], "it can conceal creatures seen through it");
  assert("normal: no damage", calm.damage, "");
  assertIncludes("incredible heat", ctx.getWeatherMeter({ temperature: "incredible-heat", precipitation: "none", fog: "none", wind: "none" }).damage, "Moderate fire damage (4d6–6d6) every minute.");
}

section("Weather: Set Weather and Announce");
{
  vars = {};
  const prompts = [];
  ctx.api.showPrompt = (...args) => prompts.push(args);
  ctx.promptWeather();
  prompts[0][5]("extreme-heat");
  prompts[1][5]("none");
  prompts[2][5]("light");
  prompts[3][5]("severe");
  assert("the state", vars.weatherState, { temperature: "extreme-heat", precipitation: "none", fog: "light", wind: "severe" });
  assertIncludes("the meter", vars.weatherMeter.summary, "Extreme heat");
  ctx.__state.messages.length = 0;
  ctx.announceWeather();
  assertIncludes("announced", ctx.__state.messages[0], "**Weather:** Extreme heat (115°F to 139°F), light fog, severe wind.");
  ctx.postTemperatureDamage();
  assertIncludes("temperature damage", ctx.__state.messages[1], 'executeDamageMacro("1d6 fire"');
  assertIncludes("... the high end", ctx.__state.messages[1], 'executeDamageMacro("2d6 fire"');
}

section("Environmental damage");
{
  const message = ctx.getEnvironmentalDamageMessage("major", "bludgeoning", "Rockslide");
  assertIncludes("the range", message, "**Rockslide:** major bludgeoning damage (8d6–12d6, GM Core Table 10-11).");
  assertIncludes("buttons", message, "```Roll_12d6_bludgeoning");
}

section("Falling");
{
  assert("half the distance", ctx.getFallDamage(60), 30);
  assert("5 feet or less: none", [ctx.getFallDamage(5), ctx.getFallDamage(10)], [0, 5]);
  assert("up to 1,500 feet", ctx.getFallDamage(5000), 750);
  assert("water: 20 less, diving 30", [ctx.getFallDamage(60, { soft: 20 }), ctx.getFallDamage(30, { soft: 30 })], [20, 0]);
  const message = ctx.getFallMessage(40);
  assertIncludes("the card", message, "**Falling 40 feet:** 20 bludgeoning damage, and lands prone.");
  assertIncludes("Apply_Prone", message, "applyEffect('Prone', 1);");
  assertIncludes("landing on a creature", message, "success 5, failure 10, critical failure 20");
  assert("no damage: no buttons", ctx.getFallMessage(5), "**Falling 5 feet:** no damage.");
}

section("The panel's onload writes only when needed");
{
  vars = {};
  let writes = 0;
  ctx.api.setCampaignVariable = (name, value) => {
    writes++;
    vars[name] = value;
  };
  ctx.loadTravelMeters();
  assert("both meters written", [writes, vars.hexMeter.dayLabel, vars.weatherMeter.summary], [2, "No day started", "Normal (33°F to 94°F)"]);
  ctx.loadTravelMeters();
  assert("again: nothing", writes, 2);
}

section("The panel");
{
  const html = fs.readFileSync(`${__dirname}/../gm-tools-panel.html`, "utf8");
  ["startHexDay(false)", "promptHexActivity('travel')", "promptWeather()", "promptFalling()", 'onload="loadTravelMeters()"'].forEach((call) =>
    assertIncludes(call, html, call),
  );
}

process.exitCode = summary() > 0 ? 1 : 0;
