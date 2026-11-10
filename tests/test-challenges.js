// Tests for challenges (challenges.js, roadmap B1 and B2): Victory Points,
// chases, infiltration, research and Influence on a Challenges record.

const fs = require("fs");
const vm = require("vm");
const { createSandbox } = require("./sandbox");
const { assert, assertIncludes, section, summary } = require("./test-helpers");

const ctx = createSandbox();

const obstacle = (id, name, checks, points, goal) => ({ _id: id, name, data: { checks, points, goal } });
const threshold = (points, outcome, track = "points") => ({ _id: `t${points}${track}`, name: "", data: { points, outcome, track } });
const challenge = (data, name = "Test Challenge") => ({ _id: "c1", name, recordType: "challenges", data });

section("Points per degree");
{
  const change = (type, diminishing) => [2, 1, 0, -1].map((d) => ctx.getChallengePointChange(type, d, diminishing));
  assert("Victory Points: 2/1/0/-1", change("victory").map((c) => c.points), [2, 1, 0, -1]);
  assert("diminishing: +1/0/-1/-2", change("victory", true).map((c) => c.points), [1, 0, -1, -2]);
  assert("diminishing only for Victory Points", change("chase", true).map((c) => c.points), [2, 1, 0, -1]);
  assert("research and influence: 2/1/0/-1", [change("research"), change("influence")].map((l) => l.map((c) => c.points)), [[2, 1, 0, -1], [2, 1, 0, -1]]);
  assert("infiltration: 2/1 IP, no IP lost", change("infiltration").map((c) => c.points), [2, 1, 0, 0]);
  assert("infiltration: +1 Awareness on a failure, +2 on a critical failure", change("infiltration").map((c) => c.awareness), [0, 0, 1, 2]);
}

section("Reading checks as stat blocks print them");
{
  const parse = (text) => ctx.parseChallengeChecks(text).map((c) => `${c.skill} ${c.dc}`);
  assert("DC first, two skills", parse("DC 23 Diplomacy or Society; DC 28 Athletics"), ["Diplomacy 23", "Society 23", "Athletics 28"]);
  assert("DC after each", parse("Athletics DC 20 or Acrobatics DC 18"), ["Athletics 20", "Acrobatics 18"]);
  assert("skills before a shared DC", parse("Diplomacy or Society DC 23"), ["Diplomacy 23", "Society 23"]);
  assert("bare numbers and Lores", parse("Library Lore 18, Occultism 23"), ["Library Lore 18", "Occultism 23"]);
  assert("Lore and Performance aren't split on 'or'", parse("DC 18 Academia Lore or Library Lore; DC 21 Performance"), ["Academia Lore 18", "Library Lore 18", "Performance 21"]);
  assert("nothing to read", parse("ask the GM"), []);
}

section("Posting an obstacle's checks");
{
  const record = challenge({ challengeType: "chase", obstacles: [obstacle("o1", "Crowded Market", "Acrobatics DC 20 or Diplomacy DC 18", 1, 3)] }, "Rooftop Chase");
  const message = ctx.getChallengeObstacleMessage(record, record.data.obstacles[0]);
  assertIncludes("titled", message, "Rooftop Chase: Crowded Market");
  assertIncludes("progress", message, "1 of 3 CP");
  assertIncludes("the DCs for the GM", message, "[gm]Acrobatics DC 20, Diplomacy DC 18[/gm]");
  assertIncludes("a button per check, the DC in its code", message, "```Roll_Acrobatics\nrollChallengeCheck(\"Acrobatics\", 20, ");
  assert("no DC in the labels", /```\w*DC/.test(message), false);
  assertIncludes("the challenge in the button", message, '"recordId":"c1","obstacleId":"o1","type":"chase"');
  const empty = ctx.getChallengeObstacleMessage(record, obstacle("o2", "Fog", "", 0, 2));
  assertIncludes("no checks: a GM hint", empty, "No checks to post");
}

section("Rolling: a Lore is the creature's own");
{
  const calls = [];
  const rollSkill = ctx.rollSkill;
  ctx.rollSkill = (...args) => calls.push(args);
  ctx.api.getSelectedOrDroppedToken = () => [
    { _id: "pc", data: { intMod: 3, loreSkills: [{ name: "Library Lore", data: { mod: 9, rank: 2, ability: "int" } }] } },
    { _id: "pc2", data: { intMod: 1, loreSkills: [] } },
  ];
  ctx.rollChallengeCheck("Library Lore", 18, { recordId: "c1" });
  assert("known Lore: its modifier and rank", calls[0].slice(1, 7), ["Library Lore", 18, true, 9, 2, "int"]);
  assert("unknown Lore: untrained, Intelligence", calls[1].slice(1, 6), ["Library Lore", 18, true, 1, 0]);
  assert("the challenge in the metadata", calls[0][10], { challenge: { recordId: "c1" } });
  calls.length = 0;
  ctx.rollChallengeCheck("Athletics", 20, { recordId: "c1" });
  assert("a skill by name", calls[0].slice(1, 4), ["athletics", 20, false]);
  assert("no action for other checks", calls[0][10], { challenge: { recordId: "c1" } });
  calls.length = 0;
  ctx.rollChallengeCheck("Perception", 20, { recordId: "c1", discover: true });
  assert("Discover: rolled as the action", calls[0][10].action, "Discover");
  ctx.rollSkill = rollSkill;
  ctx.api.getSelectedOrDroppedToken = () => [];
}

section("The result card's lines");
{
  const base = { recordId: "c1", obstacleId: "o1", type: "victory", obstacle: "Convince the Council" };
  const success = ctx.getChallengeResultLines(base, 1);
  assertIncludes("the points", success[0], "+1 VP (Convince the Council)");
  assertIncludes("a Score button", success[1], '```Score_+1_VP\nscoreChallenge("c1", "o1", 1);');
  const failure = ctx.getChallengeResultLines(base, 0);
  assert("a failure: no points, no button", failure, ["**Victory Points:** no points (Convince the Council)."]);
  const lost = ctx.getChallengeResultLines(base, -1);
  assertIncludes("a critical failure loses one", lost[1], "Score_-1_VP");
  const infiltration = ctx.getChallengeResultLines({ ...base, type: "infiltration" }, 0);
  assertIncludes("infiltration failure: Awareness", infiltration[0], "+1 Awareness");
  assertIncludes("... and an Edge Point to spend", infiltration[2], 'scoreChallenge("c1", "o1", 1, true);');
  assert("infiltration success: no Edge button", ctx.getChallengeResultLines({ ...base, type: "infiltration" }, 1).length, 2);
  const discover = ctx.getChallengeResultLines({ recordId: "c1", type: "influence", discover: true }, 2);
  assertIncludes("Discover: what it learns", discover[0], "Learns two");
  assert("... for the GM only", [discover[0].startsWith("[gm]"), discover[0].endsWith("[/gm]")], [true, true]);
  const dimCrit = ctx.getChallengeResultLines({ ...base, diminishing: true }, 2);
  assertIncludes("diminishing critical success: only if regaining ground is possible", dimCrit[1], "regaining ground");
  assert("... still a Score button", dimCrit[2].startsWith("```Score_+1_VP"), true);
  assert("accumulating: no note", ctx.getChallengeResultLines(base, 2).length, 2);
  assert("no challenge: nothing", ctx.getChallengeResultLines(null, 1), []);
}

section("Scoring: Victory Points and thresholds");
{
  const record = challenge({ challengeType: "victory", points: 3, thresholds: [threshold(4, "The council listens"), threshold(8, "The vote passes")] });
  const crit = ctx.getChallengeScoreValues(record, null, 2);
  assert("the total", crit.values["data.points"], 5);
  assert("the summary", crit.values["data.summary"], "5 VP");
  assertIncludes("the threshold passed", crit.lines.join("\n"), "[gm]Threshold 4 VP: The council listens[/gm]");
  const down = ctx.getChallengeScoreValues(challenge({ points: 0 }), null, -1);
  assert("never below 0", down.values["data.points"], undefined);
  const diminishing = ctx.getChallengeScoreValues(challenge({ points: 3, scoring: "diminishing" }), null, -1);
  assert("diminishing: a critical failure loses 2", diminishing.values["data.points"], 1);

  const falling = challenge({
    points: 5,
    scoring: "diminishing",
    thresholds: [threshold(4, "The guards are alerted"), threshold(2, "The bridge collapses"), threshold(8, "Unused")],
  });
  const fell = ctx.getChallengeScoreValues(falling, null, -1);
  assertIncludes("diminishing: a threshold reached on the way down", fell.lines.join("\n"), "[gm]Threshold 4 VP: The guards are alerted[/gm]");
  assert("... only the ones passed", fell.lines.some((l) => l.includes("bridge")), false);
  const twoDown = ctx.getChallengeScoreValues({ ...falling, data: { ...falling.data, points: 4 } }, null, -1);
  assert("leaving a threshold doesn't fire it again", twoDown.lines.some((l) => l.includes("guards")), false);
  assertIncludes("... the next one does", twoDown.lines.join("\n"), "The bridge collapses");
  const rising = ctx.getChallengeScoreValues({ ...falling, data: { ...falling.data, points: 3 } }, null, 2);
  assert("diminishing: regaining ground fires nothing", rising.lines.some((l) => l.includes("Threshold")), false);
  const zero = ctx.getChallengeScoreValues({ ...falling, data: { ...falling.data, points: 1, thresholds: [] } }, null, -1);
  assertIncludes("diminishing: all lost, a negative event", zero.lines.join("\n"), "No Victory Points left: a negative event occurs.");
  const stillZero = ctx.getChallengeScoreValues({ ...falling, data: { ...falling.data, points: 0, thresholds: [] } }, null, -1);
  assert("... once", stillZero.lines.some((l) => l.includes("negative event")), false);
  const accDown = ctx.getChallengeScoreValues(challenge({ points: 5, thresholds: [threshold(4, "Listens")] }), null, -1);
  assert("accumulating: falling back fires nothing", accDown.lines.some((l) => l.includes("Threshold")), false);
}

section("Scoring: a chase's obstacles");
{
  const obstacles = [obstacle("o1", "Market", "", 2, 3), obstacle("o2", "Rooftops", "", 0, 2)];
  const record = challenge({ challengeType: "chase", obstacles });
  const crit = ctx.getChallengeScoreValues(record, "o1", 2);
  assert("capped at what it needs: points don't carry over", crit.values["data.obstacles.0.data.points"], 3);
  assertIncludes("overcome", crit.lines.join("\n"), "Market is overcome.");
  assertIncludes("the next obstacle", crit.lines.join("\n"), "Next obstacle: Rooftops.");
  assert("the summary counts obstacles", crit.summary, "1 of 2 obstacles overcome");
  const lost = ctx.getChallengeScoreValues(challenge({ challengeType: "chase", obstacles: [obstacle("o2", "Rooftops", "", 0, 2)] }), "o2", -1);
  assert("an obstacle never below 0", lost.values["data.obstacles.0.data.points"], undefined);
}

section("Scoring: research sections stop at their maximum");
{
  const record = challenge({
    challengeType: "research",
    points: 4,
    obstacles: [obstacle("s1", "Sprite Swarm", "", 4, 5)],
    thresholds: [threshold(5, "Basic details about hags")],
  });
  const crit = ctx.getChallengeScoreValues(record, "s1", 2);
  assert("the section: 5 of 5", crit.values["data.obstacles.0.data.points"], 5);
  assert("the total: only what the section gave", crit.values["data.points"], 5);
  assertIncludes("nothing more here", crit.lines.join("\n"), "Sprite Swarm: nothing more to find here.");
  assertIncludes("the threshold", crit.lines.join("\n"), "Threshold 5 RP: Basic details about hags");
}

section("Scoring: infiltration's Awareness and Edge");
{
  const record = challenge({
    challengeType: "infiltration",
    points: 2,
    awareness: 4,
    edge: 1,
    obstacles: [obstacle("o1", "Guard Post", "", 0, 2)],
    thresholds: [threshold(5, "DCs +1; a complication", "awareness"), threshold(5, "Halfway", "points")],
  });
  const crit = ctx.getChallengeScoreValues(record, "o1", -1);
  assert("a critical failure: +2 Awareness", crit.values["data.awareness"], 6);
  assert("... and no IP lost", crit.values["data.points"], undefined);
  assertIncludes("the Awareness threshold", crit.lines.join("\n"), "[gm]Awareness 5: DCs +1; a complication[/gm]");
  assert("the summary", crit.summary, "2 IP, 6 Awareness, 1 Edge");
  const edge = ctx.getChallengeScoreValues(record, "o1", 0, true);
  assert("Edge: one spent", edge.values["data.edge"], 0);
  assert("... scored as a success", [edge.values["data.points"], edge.values["data.awareness"]], [3, undefined]);
  const none = ctx.getChallengeScoreValues(challenge({ challengeType: "infiltration", edge: 0 }), null, 0, true);
  assert("no Edge left: refused, nothing written", [none.refused, Object.keys(none.values).length], [true, 0]);
}

section("Scoring writes once, from a fresh read");
{
  const written = [];
  ctx.api.getRecord = (type, id, cb) => cb(challenge({ challengeType: "victory", points: 1 }));
  ctx.api.setValuesOnRecord = (record, values, cb) => {
    written.push(values);
    cb && cb();
  };
  ctx.__state.messages.length = 0;
  ctx.scoreChallenge("c1", null, 1);
  assert("one write", written.length, 1);
  assert("the new total", written[0]["data.points"], 2);
  assertIncludes("posted", ctx.__state.messages[0], "**Test Challenge:** 2 VP");
  ctx.isGM = false;
  ctx.scoreChallenge("c1", null, 1);
  assert("a player can't score", written.length, 1);
  ctx.isGM = true;
}

section("Rounds");
{
  const record = challenge({
    challengeType: "infiltration",
    round: 2,
    roundLimit: 2,
    awareness: 9,
    thresholds: [threshold(10, "A complication", "awareness")],
  });
  const next = ctx.getChallengeRoundValues(record);
  assert("round + 1", next.values["data.round"], 3);
  assert("infiltration: Awareness + 1", next.values["data.awareness"], 10);
  assertIncludes("its threshold", next.lines.join("\n"), "Awareness 10: A complication");
  assertIncludes("past the limit", next.lines.join("\n"), "Past the 2-round limit.");
  const victory = ctx.getChallengeRoundValues(challenge({ round: 0 }));
  assert("other types: only the round", Object.keys(victory.values), ["data.round", "data.summary"]);
  assert("the summary has the round", victory.summary, "0 VP; round 1");
}

section("Complete: XP");
{
  let prompt = null;
  const awarded = [];
  ctx.api.showPrompt = (...args) => {
    prompt = args;
  };
  ctx.api.awardExp = (xp, reason) => awarded.push([xp, reason]);
  ctx.completeChallenge("c1", "Rooftop Chase");
  assertIncludes("accomplishment options", prompt[3].map((o) => o.label).join(", "), "Moderate accomplishment (30 XP)");
  prompt[5]("80e");
  assert("as an encounter: 80 XP", awarded[0], [80, "Rooftop Chase completed."]);
  prompt[5]("0");
  assert("no XP: nothing awarded", awarded.length, 1);
}

section("skill.js shows the lines");
{
  const code = fs.readFileSync(`${__dirname}/../rollhandlers/skill.js`, "utf8");
  assertIncludes("hooked in", code, "getChallengeResultLines(data?.roll?.metadata?.challenge, noteDegree)");
}

process.exitCode = summary() > 0 ? 1 : 0;
