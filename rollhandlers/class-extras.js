// Class extras: Hero Points, Rage's temporary Hit Points, panache and an
// oracle's cursebound.
//
//   - Hero Points (Player Core pg. 413; GM Core): a GM chat macro starts a
//     session (each party member has 1, unspent ones are lost) and another
//     awards 1 to the selected characters, up to 3
//   - Rage (Player Core 2): its temporary Hit Points are noted where they came
//     from, and when the encounter ends Rage, the ones left go with it
//   - Temporary Hit Points at turn start: turnStartTempHp modifiers and
//     effect rules (Inexorable Iron) are gained at the start of the
//     creature's turn, once per round
//   - Panache (Player Core 2): a check with the bravado trait (Tumble Through,
//     and the actions a swashbuckler's style gives it, as module roll
//     options) shows Gain Panache on a success, and Panache until the end of
//     your next turn on a failure. A finisher's card has a Lose Panache button
//   - Cursebound (Player Core 2): using an ability with the cursebound trait
//     raises the condition by 1, up to the maximum (2, 3 with Major Curse, 4
//     with Extreme Curse); at the maximum the card says so and leaves it to
//     the GM. Refocus reduces it by 1
//   - Devise a Stratagem (Player Core 2 pg. 103): using it rolls the d20,
//     kept on the investigator until the start of their next turn; the first
//     Strike against the creature they mark takes it as its attack roll
//   - Overdrive (Guns & Gears pg. 16): using it rolls Crafting against the
//     standard DC for your level, with the module's effect for the result to
//     apply, and on a critical failure the fire damage and a 1d4-round
//     recharge
//   - Unstable (Guns & Gears): using an unstable action rolls the DC 15 flat
//     check (13 if legendary in Crafting) and says what happens
//   - Exploit Vulnerability (Dark Archive pg. 32, the Dark Archive module's
//     records): using it rolls Esoteric Lore against the standard DC for the
//     target's level, with what it learns for the GM and the exploit
//     buttons; the module's effect goes on the target (the last exploit's
//     comes off) and the action's toggle is set; a mortal weakness adds the
//     target's highest weakness as the Strike's damage category
//   - Unleash Psyche (Dark Archive pg. 12): using it adds the effect, unless
//     stupefied or still recharging; when it ends, a card for the stupefied
//     and the wait
//   - Drain Bonded Item (Player Core pg. 197): its card's button casts a
//     spell prepared today and already cast, without a slot
//   - Spell Blending (Player Core pg. 195): at daily preparations, a wizard
//     trades slots for a higher bonus slot or two cantrips
//
// The ruleset assists the GM and doesn't police the action economy (#27): no
// warnings for concentrate actions while raging or attacks after a finisher.

// ---------------------------------------------------------------- Hero Points

const HERO_POINTS_MAX = 3;

// A new session: each party member starts with 1 Hero Point (a GM chat
// macro)
function startHeroPointSession() {
  api.getParty((party) => {
    const members = (party || []).filter((member) => member?.recordType === "characters");
    if (members.length === 0) {
      api.showNotification("Open the Party Sheet from the View menu and drag the characters onto it.", "yellow", "Hero Points");
      return;
    }
    // Mythic characters start with 3 Mythic Points instead (mythic.js)
    members.forEach((member) => api.setValuesOnRecord(member, getSessionStartValues(member)));
    const names = (list) => list.map((member) => getCreatureName(member)).join(", ");
    const mythic = members.filter(isMythicCreature);
    const others = members.filter((member) => !isMythicCreature(member));
    api.sendMessage(
      [
        others.length > 0
          ? `**New session:** ${names(others)} each start with 1 Hero Point. Unspent ones from last session are lost.`
          : "",
        mythic.length > 0 ? `**New session:** ${names(mythic)} each start with 3 Mythic Points.` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  });
}

// The values for one more Hero Point, or null at the maximum
function getHeroPointAwardValues(creature) {
  const points = getHeroPoints(creature);
  return points >= HERO_POINTS_MAX ? null : { "data.heroPoints": points + 1 };
}

// Awards a Hero Point to each selected character (a GM chat macro)
function awardHeroPoint() {
  const tokens = (api.getSelectedTokens() || [])
    .map((t) => t?.token || t)
    .filter((token) => token?.recordType === "characters");
  if (tokens.length === 0) {
    api.showNotification("Select the characters to award a Hero Point to.", "yellow", "Hero Points");
    return;
  }
  tokens.forEach((token) => {
    const values = getHeroPointAwardValues(token);
    const name = getCreatureName(token);
    if (!values) {
      api.sendMessage(`${name} already has ${HERO_POINTS_MAX} ${getMythicPointName(token)}s, the most a character can have.`, undefined, [], [], token);
      return;
    }
    api.setValuesOnTokenById(token._id, token.recordType, values);
    api.sendMessage(`${name} gains a ${getMythicPointName(token)} (${values["data.heroPoints"]}).`, undefined, [], [], token);
  });
}

// ---------------------------------------------------------------- Rage

// What a temporary Hit Points writer sets (applyActionTemporaryHitPoints,
// the healing card's macro, Undying Ferocity): the temporary Hit Points and,
// when they're the ones kept, where they came from
function getActionTempHpValues(target, amount, sourceName = "") {
  const oldTempHp = parseInt(target?.data?.tempHp || "0", 10) || 0;
  const values = { "data.tempHp": Math.max(amount, oldTempHp) };
  if (amount >= oldTempHp) values["data.tempHpSource"] = { name: sourceName, amount };
  return values;
}

// When Rage ends: the temporary Hit Points left from it go (Player Core 2).
// They're Rage's while the source says so and there aren't more than it gave
// (a higher amount from something else would have replaced them)
function getRageEndTempHpValues(token) {
  const source = token?.data?.tempHpSource;
  const tempHp = parseInt(token?.data?.tempHp || "0", 10) || 0;
  if (source?.name !== "Rage" || tempHp <= 0 || tempHp > (parseInt(source.amount, 10) || 0)) return null;
  return { "data.tempHp": 0, "data.tempHpSource": null };
}

// The encounter's end, which ends Rage (onEncounterEnd.js): the GM line for
// each creature that loses Rage's temporary Hit Points
function clearRageTempHp(tokens) {
  const lines = [];
  getEncounterTokens(tokens).forEach((token) => {
    if (!getTokenCondition(token, "Rage")) return;
    const values = getRageEndTempHpValues(token);
    if (!values) return;
    api.setValuesOnTokenById(token._id, token.recordType, values);
    // An eidolon and its summoner share the HP (eidolons.js)
    shareHitPoints(token, values);
    lines.push(`${getCreatureName(token)} loses ${token.data.tempHp} temporary Hit Points from Rage.`);
  });
  return lines;
}

// ---------------------------------------- Temporary Hit Points at turn start

// What a creature gains at the start of each of its turns: the highest of
// its turnStartTempHp modifiers and effect rules whose predicates hold
// (Inexorable Iron: in Arcane Cascade, wielding a melee weapon in two
// hands). { amount, source }, or null
function getTurnStartTempHp(creature) {
  if (!creature || isTokenDead(creature)) return null;
  let best = null;
  getEffectsAndModifiersForToken(creature, ["turnStartTempHp"])
    .filter((mod) => mod.active !== false)
    .forEach((mod) => {
      const amount = getHitPointAmount(mod.value);
      if (amount > 0 && (!best || amount > best.amount)) {
        best = { amount, source: mod.name || "" };
      }
    });
  return best;
}

// Turn start (onTurnStart.js): the temporary Hit Points, when they're more
// than the creature has (they don't add up). Once per round, as Next after
// Previous starts the same turn again.
function runTurnStartTempHp(token, round) {
  const gain = getTurnStartTempHp(token);
  if (!gain) return;
  const hasRound = round !== null && round !== undefined;
  if (hasRound && token.data?.turnStartTempHpRound === round) return;
  const oldTempHp = parseInt(token.data?.tempHp || "0", 10) || 0;
  if (gain.amount <= oldTempHp) return;
  const tempHpValues = getActionTempHpValues(token, gain.amount, gain.source);
  const values = hasRound
    ? { ...tempHpValues, "data.turnStartTempHpRound": round }
    : tempHpValues;
  api.setValuesOnTokenById(token._id, token.recordType, values);
  // An eidolon and its summoner share the HP (eidolons.js)
  shareHitPoints(token, tempHpValues);
  const from = gain.source ? ` from ${gain.source}` : "";
  api.sendMessage(
    `${getCreatureName(token)} gains ${gain.amount} temporary Hit Points${from}.`,
    undefined,
    [],
    [],
    token,
  );
  api.floatText(token, `+${gain.amount}`, "#1165ed");
}

// ---------------------------------------------------------------- Panache

// A check with the bravado trait: its own, or one a roll option gives it
// (the module's Panache: item:trait:bravado for action:tumble-through)
function isBravadoCheck(creature, context = {}) {
  if (!context?.action?.name) return false;
  const traits = collectTraitsAndProperties(creature, context);
  return traits.has("item:trait:bravado") || traits.has("bravado");
}

// The skill card's panache lines (skill.js): on a success, Gain Panache; on
// a failure, panache until the end of your next turn; without a DC, both
function getBravadoLines(bravado, degree) {
  if (!bravado?.tokenId) return [];
  const creature = { _id: bravado.tokenId, name: bravado.tokenName || "the swashbuckler" };
  const known = degree !== null && degree !== undefined;
  if (known && degree < 0) return [];
  const lines = ["**Bravado:**"];
  if (!known || degree >= 1) {
    lines.push(
      `${known ? "You gain panache." : "On a success, you gain panache."}`,
      getChatButton("Gain_Panache", creature, "gainPanache(token, false)"),
    );
  }
  if (!known || degree === 0) {
    lines.push(
      `${known ? "You" : "On a failure (not a critical failure), you"} gain panache until the end of your next turn.`,
      getChatButton("Gain_Panache_(until_end_of_next_turn)", creature, "gainPanache(token, true)"),
    );
  }
  return lines;
}

function gainPanache(token, untilNextTurnEnd = false) {
  if (!token) return;
  if (getTokenCondition(token, "Panache")) {
    api.showNotification(`${getCreatureName(token)} already has panache.`, "yellow", "Panache");
    return;
  }
  if (untilNextTurnEnd) {
    api.addEffect(
      "Panache",
      token,
      { value: getEndOfNextTurnValue(token), unit: "end_applier_turn" },
      { value: 1, _id: token._id, name: getCreatureName(token) },
    );
  } else {
    api.addEffect("Panache", token);
  }
}

// A finisher's card (useAction): a button to lose panache after it
function getFinisherButton(action) {
  const token = api.getToken();
  if (!token?._id || !getTraitNameList(action?.data?.traits).includes("finisher")) return "";
  return `\nYou lose your panache after a finisher.\n${getChatButton("Lose_Panache", token, "losePanache(token)")}`;
}

function losePanache(token) {
  const panache = getTokenCondition(token, "Panache");
  if (panache) api.removeEffectById(panache.effect._id, token);
}

// ---------------------------------------------------------------- Cursebound

// The highest cursebound an oracle can reach: 2, 3 with Major Curse, 4 with
// Extreme Curse (the class features, not the level: Oracle Dedication gets
// neither)
function getCurseboundMax(creature) {
  return hasFeatNamed(creature, "Extreme Curse") ? 4 : hasFeatNamed(creature, "Major Curse") ? 3 : 2;
}

function hasCurseboundTrait(item) {
  return getTraitNameList(item?.data?.traits).includes("cursebound");
}

// Using a cursebound ability (useAction, castSpell): cursebound 1 more, or
// the card's line at the maximum. Returns the line
function applyCursebound(item, token = api.getToken()) {
  if (!token || !hasCurseboundTrait(item)) return "";
  const current = getTokenConditionValue(token, "cursebound");
  const max = getCurseboundMax(token);
  if (current >= max) {
    return `\n[gm]${getCreatureName(token)} is already at their maximum cursebound ${max}: a cursebound ability can't be used.[/gm]`;
  }
  api.addEffect("Cursebound", token);
  return `\nCursebound ${current + 1} (maximum ${max}).`;
}

// Refocus reduces cursebound by 1 (Oracular Curse): one instance of the
// stack
function removeCursebound(token, callback) {
  const found = findTokenConditionBySlug(token, "cursebound");
  if (!found) {
    if (typeof callback === "function") callback();
    return "";
  }
  const current = getTokenConditionValue(token, "cursebound");
  // Without an instance index Realm removes every instance: the last one only
  api.removeEffectById(found.effect._id, token, callback, { instanceIndex: Math.max(current - 1, 0) });
  return current > 1 ? ` Cursebound ${current - 1}.` : " No longer cursebound.";
}

// ---------------------------------------------------------------- Investigator and inventor

function isActionNamed(action, name) {
  return String(action?.name || "").trim().toLowerCase() === name.toLowerCase();
}

// Devise a Stratagem: the d20 rolled when it's used, kept on the investigator
// (data.stratagem: { value, used }) for the first Strike against the
// creature they mark. The module's action and effect add the Intelligence
// modifier and Strategic Strike against the mark; a skill stratagem uses the
// effect's toggle, not the d20.
function getStratagemUse(action, token = api.getToken()) {
  if (!isActionNamed(action, "Devise a Stratagem") || !token?._id) return "";
  // A d20 everyone sees; flatCheck.js keeps it (keepStratagemRoll)
  api.roll("1d20", { rollName: "Devise a Stratagem", stratagem: { tokenId: token._id, recordType: token.recordType } }, "flatCheck");
  return "";
}

// flatCheck.js: the stratagem's d20, kept on the investigator, and the card's
// text for what it does
function keepStratagemRoll(stratagem, roll) {
  const d20 = (roll?.dice || []).find((d) => d.type === 20 && d.reason !== "dropped");
  const value = parseInt(d20?.value ?? roll?.total, 10) || 1;
  if (stratagem?.tokenId) {
    api.setValuesOnTokenById(stratagem.tokenId, stratagem.recordType, { "data.stratagem": { value, used: false } });
  }
  return `**Attack stratagem:** the first Strike against the creature you mark, before your next turn, uses ${value} for its attack roll (a natural 20 or 1 counts). Drop the Devise a Stratagem effect on it.\n\n**Skill stratagem:** you can't Strike it until your next turn, and get +1 to your next Intelligence-, Wisdom- or Charisma-based check or Perception check about it.`;
}

// Whether a creature carries a token mark this attacker applied (Devise a
// Stratagem, Hunt Prey), as the target:mark trait reads it
function hasOwnTokenMark(target, mark, attackerToken, record) {
  const token = target?.token || target;
  return (token?.effects || []).some((effect) =>
    (effect?.rules || []).some((rule) => {
      if (rule?.type !== "tokenMark" || toSlug(String(rule.value || "")) !== mark) return false;
      const appliedBy = token?.effectValues?.[effect._id]?.tokenId;
      return !appliedBy || appliedBy === attackerToken?._id || appliedBy === record?._id;
    }),
  );
}

// Whether a weapon can take the stratagem's d20: a melee weapon, unarmed
// attack or thrown weapon needs agile or finesse; another ranged weapon can
function isStratagemWeapon(weapon, isMelee, isThrown) {
  const traits = getTraitNameList(weapon?.data?.traits);
  return traits.includes("agile") || traits.includes("finesse") || (!isMelee && !isThrown);
}

// The d20 a Strike takes: the investigator's unused stratagem roll, when the
// target carries their Devise a Stratagem mark; else null
function getStratagemD20(record, target, attackerToken = api.getToken()) {
  const stratagem = record?.data?.stratagem ?? attackerToken?.data?.stratagem;
  const value = parseInt(stratagem?.value, 10);
  if (!stratagem || stratagem.used || !Number.isFinite(value)) return null;
  return hasOwnTokenMark(target, "devise-a-stratagem", attackerToken, record) ? value : null;
}

// The stratagem ends at the start of the investigator's next turn, and with
// the encounter
function clearStratagem(token) {
  if (token?._id && (token.data?.stratagem ?? token.record?.data?.stratagem)) {
    api.setValuesOnTokenById(token._id, token.recordType, { "data.stratagem": null });
  }
}

// Overdrive's results: the module's effect to apply for each, by degree
const OVERDRIVE_EFFECTS = { 2: "Overdrive (Critical Success)", 1: "Overdrive (Success)", 0: "Overdrive (Failure)" };

function getCreatureLevel(creature) {
  return parseInt((creature?.data || creature?.record?.data || {}).level, 10) || 1;
}

// The notes the Crafting check shows for each result, with the buttons
function getOverdriveNotes(token) {
  const fence = "```";
  const apply = (effect) =>
    `\n${getChatButton(`Apply_${effect.replace(/[^A-Za-z]+/g, "_").replace(/_+$/, "")}`, token, `api.addEffect(${JSON.stringify(effect)}, token)`)}`;
  const selfDamage = Math.max(1, Math.ceil(getCreatureLevel(token) / 2));
  const damage = `\n${fence}Take_${selfDamage}_Fire_Damage\napplyDamage(null, { total: ${selfDamage}, types: [{ type: "fire", value: ${selfDamage} }], dice: [], metadata: { rollName: "Overdrive", damageType: "fire" } }, false);\n${fence}`;
  const recharge = `\n${getChatButton("Start_Recharge_(1d4_rounds)", token, 'startRecharge(token, "Overdrive", "1d4")')}`;
  return [
    { name: "Critical overdrive", text: `your Strikes deal extra damage equal to your Intelligence modifier for 1 minute. When it ends, you can't use Overdrive for 1 minute.${apply(OVERDRIVE_EFFECTS[2])}`, outcome: [2] },
    { name: "Overdrive", text: `your Strikes deal extra damage equal to half your Intelligence modifier for 1 minute. When it ends, you can't use Overdrive for 1 minute.${apply(OVERDRIVE_EFFECTS[1])}`, outcome: [1] },
    { name: "Overdrive", text: `your Strikes deal 1 extra fire damage for 1 minute; it doesn't change an Overdrive already active.${apply(OVERDRIVE_EFFECTS[0])}`, outcome: [0] },
    { name: "Overdrive", text: `you take ${selfDamage} fire damage (half your level), an active Overdrive ends, and you can't use Overdrive for 1d4 rounds.${damage}${recharge}`, outcome: [-1] },
  ];
}

// Overdrive: the Crafting check against the standard DC for the inventor's
// level, rolled as it's used
function getOverdriveUse(action, token = api.getToken()) {
  if (!isActionNamed(action, "Overdrive") || !token?._id) return "";
  const level = getCreatureLevel(token);
  const dc = getDCForLevel(level);
  rollSkill(token, "crafting", dc, false, 0, 1, "int", true, false, undefined, {
    action: "Overdrive",
    targetNotes: getOverdriveNotes(token),
  });
  return `\nCrafting against DC ${dc}, the standard DC for level ${level}.`;
}

// The unstable flat check: DC 15, or 13 legendary in Crafting
function getUnstableDC(creature) {
  return (parseInt((creature?.data || creature?.record?.data || {}).crafting, 10) || 0) >= 4 ? 13 : 15;
}

// An unstable action: the flat check, a d20 everyone sees (flatCheck.js),
// with what a failure and a critical failure mean
function getUnstableUse(action, token = api.getToken()) {
  if (!getTraitNameList(action?.data?.traits).includes("unstable") || !token) return "";
  const dc = getUnstableDC(token);
  const damage = Math.max(1, Math.floor(getCreatureLevel(token) / 2));
  api.roll(
    "1d20",
    {
      rollName: "Unstable",
      dc,
      failureNote: "Your innovation malfunctions harmlessly (smoke, sparks) and can't be used for unstable actions until you spend 10 minutes retuning it.",
      criticalFailureNote: `You also take ${damage} fire damage (half your level; a minion innovation takes it instead).`,
    },
    "flatCheck",
  );
  return "";
}

// ---------------------------------------------------------------- Thaumaturge and psychic

// Exploit Vulnerability (Dark Archive pg. 32), with the Dark Archive module's
// records: the Exploit Vulnerability effect on the target carries the
// exploit-vulnerability token mark, and the action's two toggles (group
// exploit) pick what's exploited. Both are weaknesses the thaumaturge's
// Strikes trigger, added once after a critical hit's doubling: personal
// antithesis is 2 + half their level (the Strike's exploitWeakness), a
// mortal weakness the target's highest weakness (a damage category).
const EXPLOIT_EFFECT = "Exploit Vulnerability";
const EXPLOIT_TOGGLES = {
  antithesis: "exploit-vulnerability:personal-antithesis",
  mortal: "exploit-vulnerability:mortal-weakness",
};

// A creature's weaknesses, resistances and immunities, as the damage code
// reads them: { weaknesses: [{ type, value }], resistances, immunities }
function getExploitIWR(target) {
  const iwr = getIWR(target) || {};
  const list = (map) =>
    Object.values(map || {})
      .filter((entry) => entry?.type)
      .map((entry) => ({ type: entry.type, value: parseInt(entry.value, 10) || 0 }));
  return {
    weaknesses: list(iwr.weaknesses).sort((a, b) => b.value - a.value),
    resistances: list(iwr.resistances),
    immunities: list(iwr.immunities),
  };
}

// The creature's highest weakness, or null
function getHighestWeakness(target) {
  return getExploitIWR(target).weaknesses[0] || null;
}

function formatIWRList(entries, withValues = true) {
  return entries.length > 0 ? entries.map((e) => (withValues && e.value ? `${e.type} ${e.value}` : e.type)).join(", ") : "none";
}

// The button that exploits the target this way: the thaumaturge and the
// target by id, so nothing needs selecting
function getExploitButton(thaumaturge, target, mode) {
  const fence = "```";
  const label = mode === "mortal" ? "Exploit_Mortal_Weakness" : "Exploit_Personal_Antithesis";
  return `\n${fence}${label}\nexploitVulnerability(${JSON.stringify(thaumaturge._id)}, ${JSON.stringify(target._id)}, ${JSON.stringify(mode)});\n${fence}`;
}

// The notes the Esoteric Lore check shows for each result: what the
// thaumaturge learns (for the GM only), and the exploit buttons
function getExploitNotes(thaumaturge, target) {
  const iwr = getExploitIWR(target);
  const highest = iwr.weaknesses[0];
  const both = `${getExploitButton(thaumaturge, target, "mortal")}${getExploitButton(thaumaturge, target, "antithesis")}`;
  const fence = "```";
  // A critical failure is a new Exploit Vulnerability too: the last one ends
  const offGuard = `\n${fence}Off-Guard_Until_Next_Turn\nexploitVulnerability(${JSON.stringify(thaumaturge._id)});\napi.addEffect("Off-Guard", findSceneToken(${JSON.stringify(thaumaturge._id)}), { value: 1, unit: "start_turn" });\n${fence}`;
  return [
    {
      name: "Exploit Vulnerability",
      text: `you learn all its weaknesses, resistances and immunities. [gm]Weaknesses: ${formatIWRList(iwr.weaknesses)}. Resistances: ${formatIWRList(iwr.resistances)}. Immunities: ${formatIWRList(iwr.immunities, false)}.[/gm] Exploit its mortal weakness or its personal antithesis.${both}`,
      outcome: [2],
    },
    {
      name: "Exploit Vulnerability",
      text: `you learn its highest weakness. [gm]${highest ? `Highest weakness: ${highest.type} ${highest.value}.` : "It has no weaknesses: only personal antithesis does anything."}[/gm] Exploit its mortal weakness or its personal antithesis.${both}`,
      outcome: [1],
    },
    { name: "Exploit Vulnerability", text: `you can exploit only its personal antithesis.${getExploitButton(thaumaturge, target, "antithesis")}`, outcome: [0] },
    { name: "Exploit Vulnerability", text: `you're off-guard until the start of your next turn, and exploit nothing (your last exploit ends).${offGuard}`, outcome: [-1] },
  ];
}

// The thaumaturge's Esoteric Lore: its lore skill's rank, rolled with
// Charisma. When the lore skill has no attribute picked (the module's grant
// sets none, so the sheet works it out with Intelligence), the modifier is
// worked out again with Charisma.
function getEsotericLore(creature) {
  const data = creature?.data || creature?.record?.data || {};
  const lore = (data.loreSkills || []).find((entry) => /^esoteric\b/i.test(String(entry?.name || "")));
  const rank = parseInt(lore?.data?.rank || "1", 10) || 1;
  const ability = lore?.data?.ability || "cha";
  const mod = lore?.data?.ability
    ? parseInt(lore.data.mod || "0", 10) || 0
    : calculateProficiencyBonus(creature, rank) + (parseInt(data.cha || "0", 10) || 0);
  return { mod, rank, ability };
}

// Exploit Vulnerability: the Esoteric Lore check against the standard DC
// for the target's level, rolled as it's used
function getExploitVulnerabilityUse(action, token = api.getToken()) {
  if (!isActionNamed(action, "Exploit Vulnerability") || !token?._id) return "";
  const target = (api.getTargets() || [])[0]?.token;
  if (!target?._id) return "\nTarget the creature first: Exploit Vulnerability rolls against it.";
  const dc = getDCForLevel(getCreatureLevel(target));
  const lore = getEsotericLore(token);
  rollSkill(token, "Esoteric Lore", dc, true, lore.mod, lore.rank, lore.ability, true, false, undefined, {
    action: "Exploit Vulnerability",
    targetNotes: getExploitNotes(token, target),
  });
  return `\nEsoteric Lore against DC ${dc}, the standard DC for ${getCreatureName(target)}'s level.`;
}

// A creature's Exploit Vulnerability effects from this thaumaturge (or with
// no applier kept)
function getExploitEffects(creature, thaumaturgeId) {
  return (creature?.effects || []).filter((effect) => {
    if (effect?.name !== EXPLOIT_EFFECT) return false;
    const appliedBy = creature?.effectValues?.[effect._id]?.tokenId;
    return !appliedBy || appliedBy === thaumaturgeId;
  });
}

// Removes the effects one at a time, then calls back
function removeEffectsInTurn(creature, effects, callback) {
  if (!creature || effects.length === 0) {
    callback();
    return;
  }
  const [first, ...rest] = effects;
  api.removeEffectById(first._id, creature, () => removeEffectsInTurn(creature, rest, callback));
}

// The thaumaturge's toggles with this exploit's on and the other off (the
// action's exploit group; both off with no mode), or null when they have
// neither
function getExploitToggleValues(thaumaturge, mode) {
  const toggles = thaumaturge?.data?.toggles ?? thaumaturge?.record?.data?.toggles;
  if (!Array.isArray(toggles)) return null;
  const wanted = Object.values(EXPLOIT_TOGGLES);
  if (!toggles.some((toggle) => wanted.includes(toggle?.data?.predicateValue))) return null;
  return toggles.map((toggle) =>
    wanted.includes(toggle?.data?.predicateValue)
      ? { ...toggle, data: { ...toggle.data, toggled: toggle.data.predicateValue === EXPLOIT_TOGGLES[mode] } }
      : toggle,
  );
}

// From the result's buttons: the last exploit ends (its effect comes off its
// target), the module's effect goes on the target, and the thaumaturge's
// toggle for it is set, in one write with the target kept on them
// (data.exploit: { targetId, mode }). With no mode (a critical failure), the
// last exploit just ends: both toggles off and data.exploit null.
function exploitVulnerability(thaumaturgeId, targetId, mode) {
  const thaumaturge = findSceneToken(thaumaturgeId);
  const target = mode ? findSceneToken(targetId) : null;
  if (!thaumaturge || (mode && !target)) {
    api.showNotification("The thaumaturge and the target need to be on the scene.", "yellow", "Exploit Vulnerability");
    return;
  }
  const last = thaumaturge.data?.exploit ?? thaumaturge.record?.data?.exploit;
  const lastTarget = last?.targetId ? findSceneToken(last.targetId) : null;
  // The target's own exploit effect goes too, so exploiting it again replaces it
  const toRemove = [
    ...(lastTarget && lastTarget._id !== target?._id ? [[lastTarget, getExploitEffects(lastTarget, thaumaturgeId)]] : []),
    ...(target ? [[target, getExploitEffects(target, thaumaturgeId)]] : []),
  ];
  const apply = () => {
    if (target) api.addEffect(EXPLOIT_EFFECT, target, undefined, { tokenId: thaumaturgeId });
    const toggles = getExploitToggleValues(thaumaturge, mode);
    api.setValuesOnTokenById(thaumaturgeId, thaumaturge.recordType, {
      "data.exploit": target ? { targetId, mode } : null,
      ...(toggles ? { "data.toggles": toggles } : {}),
    });
    if (!target) return;
    const highest = getHighestWeakness(target);
    api.sendMessage(
      mode === "antithesis"
        ? `**${getCreatureName(thaumaturge)} exploits ${getCreatureName(target)}'s personal antithesis:** it has weakness ${getAntithesisWeakness(thaumaturge)} to their unarmed and weapon Strikes.`
        : `**${getCreatureName(thaumaturge)} exploits ${getCreatureName(target)}'s mortal weakness:** their unarmed and weapon Strikes trigger its highest weakness${highest ? "" : " (it has none)"}. Creatures of the exact same type are affected too; the GM applies that.`,
      undefined,
      [],
      [],
      thaumaturge,
    );
  };
  const run = (index) => {
    if (index >= toRemove.length) {
      apply();
      return;
    }
    const [creature, effects] = toRemove[index];
    removeEffectsInTurn(creature, effects, () => run(index + 1));
  };
  run(0);
}

// Personal antithesis: weakness 2 + half the thaumaturge's level
function getAntithesisWeakness(thaumaturge) {
  return 2 + Math.floor(getCreatureLevel(thaumaturge) / 2);
}

// Whether a creature has a toggle on (data.toggles' predicateValue)
function hasToggleOn(creature, predicateValue) {
  const toggles = creature?.data?.toggles ?? creature?.record?.data?.toggles;
  return (Array.isArray(toggles) ? toggles : []).some(
    (toggle) => toggle?.data?.toggled === true && toggle.data.predicateValue === predicateValue,
  );
}

// The damage categories a thaumaturge's Strike adds against the creature it
// exploits: magical, and with the Mortal Weakness toggle on, the target's
// highest weakness
function getExploitDamageCategories(target, attackerToken, record) {
  const token = target?.token || target;
  if (!token || !hasOwnTokenMark(token, "exploit-vulnerability", attackerToken, record)) return [];
  const categories = ["magical"];
  if (hasToggleOn(record || attackerToken, EXPLOIT_TOGGLES.mortal)) {
    const highest = getHighestWeakness(token);
    if (highest) categories.push(highest.type);
  }
  return categories;
}

// The personal antithesis weakness a thaumaturge's Strike triggers against
// the creature it exploits, with the Personal Antithesis toggle on (the
// Strike's metadata.exploitWeakness; applyDamage adds it once, as a
// weakness); else 0
function getExploitWeakness(target, attackerToken, record) {
  const token = target?.token || target;
  if (!token || !hasOwnTokenMark(token, "exploit-vulnerability", attackerToken, record)) return 0;
  if (!hasToggleOn(record || attackerToken, EXPLOIT_TOGGLES.antithesis)) return 0;
  return getAntithesisWeakness(record || attackerToken);
}

// Unleash Psyche (Dark Archive pg. 12): used at the start of the psychic's
// turn, it puts the module's Unleash Psyche effect on them (2 rounds: double
// the spell's rank to spell damage), unless they're stupefied or it's still
// recharging. When the effect ends, onEffectsChanged posts the subsiding
function getUnleashPsycheUse(action, token = api.getToken()) {
  if (!isActionNamed(action, "Unleash Psyche") || !token?._id) return "";
  if (getTokenConditionValue(token, "stupefied") > 0) {
    return "\nYou're stupefied: you can't Unleash Psyche.";
  }
  const round = getEncounterState()?.round || 0;
  const recharge = (token.data?.recharges || []).find((entry) => entry?.name === "Unleash Psyche");
  if (recharge && Number.isFinite(parseInt(recharge.readyRound, 10)) && round < parseInt(recharge.readyRound, 10)) {
    return `\nYou can't Unleash Psyche again until round ${recharge.readyRound}.`;
  }
  api.addEffect("Unleash Psyche", token);
  return "\nYour psyche is unleashed for 2 rounds: damaging psychic spells get a status bonus of double their rank. (It needs a spell cast on your last turn.)";
}

// onEffectsChanged: when Unleash Psyche ends, the stupefied and the wait,
// as buttons. The hook can't add effects to the same creature, so the card
// does it.
function getPsycheSubsidesMessage(creature, changes) {
  const ended = (changes || []).some((change) => change?.name === "Unleash Psyche" && (change.oldCount || 0) > 0 && (change.newCount || 0) === 0);
  if (!ended || !creature?._id) return "";
  const button = `\n${getChatButton("Stupefied_1_and_Wait_(2_rounds)", creature, 'api.addEffect("Stupefied", token, { value: 2, unit: "rounds" }); startRecharge(token, "Unleash Psyche", "2")')}`;
  return `**${getCreatureName(creature)}'s psyche subsides:** stupefied 1 for 2 rounds, and no Unleash Psyche for 2 rounds.${button}`;
}

// ---------------------------------------------------------------- Wizard

// Wizard extras (Player Core pg. 195-197; the school's curriculum slot is in
// spell-entries.js):
//   - Drain Bonded Item: the action's card has a button that casts one spell
//     prepared today and already cast, without a slot (castSpell marks a
//     prepared row used again; it never refuses). Once a day is the action's
//     frequency (limited-uses.js)
//   - Spell Blending: at daily preparations, trade two slots of a rank for a
//     bonus slot up to 2 ranks higher (a rank you can cast, each bonus slot a
//     different rank), or one slot for two cantrips (once). The trades are
//     kept on the entry (data.spellBlending) and undone first at the next
//     preparations; the counts they change are the player's own on top of
//     the table, so the sheet's sync keeps them

// The wizard's spells prepared today and already cast: [{ label, value }]
// with value the row's path
function getSpentPreparedSpells(record) {
  return getCastingEntries(record)
    .filter(({ entry }) => (entry?.data?.type || "prepared") === "prepared")
    .flatMap(({ entry, index }) =>
      SPELL_RANK_LISTS.slice(1).flatMap((list, listIndex) =>
        (entry.data?.[list] || [])
          .map((row, rowIndex) => ({ row, rowIndex }))
          .filter(({ row }) => row?.name && row.data?.used === true)
          .map(({ row, rowIndex }) => ({
            label: `${row.name} (${getOrdinal(listIndex + 1)} rank, ${entry.name})`,
            value: `data.spells.${index}.data.${list}.${rowIndex}`,
          })),
      ),
    );
}

// Drain Bonded Item's card: what it does, and the button that casts a spent
// spell (by the character's id, so nothing needs selecting)
function getDrainBondedItemUse(action, creature = typeof record !== "undefined" ? record : null) {
  if (!isActionNamed(action, "Drain Bonded Item") || !creature?._id) return "";
  const call = `castSpentPreparedSpell(${JSON.stringify(creature.recordType || "characters")}, ${JSON.stringify(creature._id)});`;
  return `\nDuring this turn, you can cast one spell you prepared today and already cast, without spending a spell slot.\n\`\`\`Cast_a_Spent_Spell\n${call}\n\`\`\``;
}

// The button: pick a spent spell, then cast it as its row does
function castSpentPreparedSpell(recordType, recordId) {
  api.getRecord(recordType || "characters", recordId, (record) => {
    const spent = record ? getSpentPreparedSpells(record) : [];
    if (spent.length === 0) {
      api.showNotification("No prepared spell has been cast yet today.", "yellow", "Drain Bonded Item");
      return;
    }
    api.showPrompt(
      "Drain Bonded Item",
      "Cast which spell again, without a slot?",
      "Select...",
      spent,
      null,
      (selected) => {
        const path = getPromptSelections(selected)[0];
        const spell = path ? api.getValueOnRecord(record, path) : null;
        if (spell) castSpell(record, spell, path);
      },
      "Cast",
      "Cancel",
      1,
    );
  });
}

function hasSpellBlending(record) {
  return (
    hasFeatNamed(record, "Spell Blending") ||
    /spell-?blending/i.test(String(record?.data?.flags?.arcaneThesis || ""))
  );
}

// The wizard's prepared entry: the one the class made, else an arcane
// prepared one. { entry, index } or null
function getSpellBlendingEntry(record) {
  const prepared = getCastingEntries(record).filter(
    ({ entry }) => (entry?.data?.type || "prepared") === "prepared",
  );
  return (
    prepared.find(({ entry }) => entry?.data?.auto?.source === "class:wizard") ||
    prepared.find(({ entry }) => String(entry?.data?.tradition || "").toLowerCase() === "arcane") ||
    null
  );
}

// An entry's slot counts: { numCantrips, numSpells1-10 }
function getSlotCounts(entry) {
  const counts = { numCantrips: parseInt(entry?.data?.numCantrips, 10) || 0 };
  for (let rank = 1; rank <= 10; rank++) {
    counts[`numSpells${rank}`] = parseInt(entry?.data?.[`numSpells${rank}`], 10) || 0;
  }
  return counts;
}

// The counts with a day's trades undone (blending: { trades: [{ from, to }],
// cantrips: the rank traded for cantrips, or null })
function undoSpellBlending(counts, blending) {
  const result = { ...counts };
  (blending?.trades || []).forEach(({ from, to }) => {
    result[`numSpells${from}`] += 2;
    result[`numSpells${to}`] = Math.max(0, result[`numSpells${to}`] - 1);
  });
  if (blending?.cantrips) {
    result[`numSpells${blending.cantrips}`] += 1;
    result.numCantrips = Math.max(0, result.numCantrips - 2);
  }
  return result;
}

// The highest rank the wizard can cast, before any trades
function getHighestCountRank(counts) {
  let highest = 0;
  for (let rank = 1; rank <= 10; rank++) {
    if (counts[`numSpells${rank}`] > 0) highest = rank;
  }
  return highest;
}

// The trades left to make: two slots of a rank for one up to 2 ranks
// higher (a rank you can cast, not one you already traded for), or a slot
// for two cantrips (once)
function getSpellBlendingOptions(counts, highest, blending) {
  const options = [];
  for (let from = 1; from <= 9; from++) {
    if (counts[`numSpells${from}`] < 2) continue;
    for (let to = from + 1; to <= Math.min(from + 2, highest); to++) {
      if ((blending.trades || []).some((trade) => trade.to === to)) continue;
      options.push({
        label: `Two ${getOrdinal(from)}-rank slots for a ${getOrdinal(to)}-rank slot`,
        value: `trade:${from}:${to}`,
      });
    }
  }
  if (!blending.cantrips) {
    for (let from = 1; from <= highest; from++) {
      if (counts[`numSpells${from}`] < 1) continue;
      options.push({ label: `A ${getOrdinal(from)}-rank slot for two cantrips`, value: `cantrips:${from}` });
    }
  }
  return options;
}

// One trade made: { counts, blending }
function applySpellBlendingChoice(counts, blending, choice) {
  const [kind, from, to] = String(choice).split(":");
  const next = { ...counts };
  const made = { trades: [...(blending.trades || [])], cantrips: blending.cantrips || null };
  if (kind === "trade") {
    next[`numSpells${from}`] -= 2;
    next[`numSpells${to}`] += 1;
    made.trades.push({ from: parseInt(from, 10), to: parseInt(to, 10) });
  } else if (kind === "cantrips") {
    next[`numSpells${from}`] -= 1;
    next.numCantrips += 2;
    made.cantrips = parseInt(from, 10);
  }
  return { counts: next, blending: made };
}

// "two 1st-rank slots for a 3rd-rank slot; a 2nd-rank slot for two
// cantrips"
function describeSpellBlending(blending) {
  return [
    ...(blending.trades || []).map(
      ({ from, to }) => `two ${getOrdinal(from)}-rank slots for a ${getOrdinal(to)}-rank slot`,
    ),
    ...(blending.cantrips ? [`a ${getOrdinal(blending.cantrips)}-rank slot for two cantrips`] : []),
  ].join("; ");
}

// The write: the counts that changed, and the day's trades
function getSpellBlendingValues(entry, entryIndex, counts, blending) {
  const values = {};
  const current = getSlotCounts(entry);
  Object.entries(counts).forEach(([key, value]) => {
    if (current[key] !== value) values[`data.spells.${entryIndex}.data.${key}`] = value;
  });
  const had = entry?.data?.spellBlending || null;
  const has = (blending.trades || []).length > 0 || blending.cantrips ? blending : null;
  if (JSON.stringify(had) !== JSON.stringify(has)) values[`data.spells.${entryIndex}.data.spellBlending`] = has;
  return values;
}

// Daily preparations: yesterday's trades undone, then trades picked one at a
// time until Done, then one write, then next()
function promptSpellBlending(recordId, next) {
  const finish = () => {
    if (next) next();
  };
  api.getRecord("characters", recordId, (record) => {
    if (!record || !hasSpellBlending(record)) return finish();
    const found = getSpellBlendingEntry(record);
    if (!found) return finish();
    const base = undoSpellBlending(getSlotCounts(found.entry), found.entry.data?.spellBlending);
    const highest = getHighestCountRank(base);
    const write = (counts, blending) => {
      const values = getSpellBlendingValues(found.entry, found.index, counts, blending);
      if (Object.keys(values).length === 0) return finish();
      api.setValuesOnRecord(record, values, () => {
        const made = describeSpellBlending(blending);
        if (made) {
          api.sendMessage(`**${getCreatureName(record)}'s Spell Blending:** ${made}. Prepare spells in the new slots.`);
        }
        finish();
      });
    };
    const ask = (counts, blending) => {
      const options = getSpellBlendingOptions(counts, highest, blending);
      if (options.length === 0) return write(counts, blending);
      const made = describeSpellBlending(blending);
      api.showPrompt(
        "Spell Blending",
        made ? `Traded so far: ${made}. Another?` : "Trade spell slots for today?",
        "Select...",
        [{ label: made ? "Done" : "No trades today", value: "done" }, ...options],
        null,
        (selected) => {
          const choice = getPromptSelections(selected)[0];
          if (!choice || choice === "done") return write(counts, blending);
          const result = applySpellBlendingChoice(counts, blending, choice);
          ask(result.counts, result.blending);
        },
        "OK",
        "Cancel",
        1,
      );
    };
    ask(base, { trades: [], cantrips: null });
  });
}
