// Sustained spells (Player Core pg. 304, Sustain pg. 419, roadmap H17): a
// spell with a sustained duration lasts until the end of the caster's turn
// unless they Sustain it that turn, up to its own limit ("sustained up to 1
// minute"), or 10 minutes when it lists none.
//
//   - Casting one records it on the caster's token (data.sustaining: the
//     spell and the rounds it was cast and last Sustained), and its card gets
//     a Sustain button
//   - Sustain marks it Sustained this round; past the spell's limit the card
//     says it can't be Sustained any longer (nothing is refused)
//   - At the start of the caster's turn, a card lists what they're
//     sustaining, each with a Sustain and a Stop button
//   - At the end of their turn, a spell neither cast nor Sustained that turn
//     ends: a card says so, with a GM button that removes the caster's
//     effects named for it ("Bless", "Aura: Bless") from the scene's tokens
//     (spells don't record which effects they put on whom, so the GM applies
//     them; an effect that records its applier is only removed for this
//     caster)
//   - The encounter's end clears the lists
// Outside an encounter there are no rounds: the card's Sustain button only
// posts that it's Sustained.

// Sustain (pg. 419): 10 minutes when an ability doesn't list how long
const SUSTAIN_DEFAULT_LIMIT = { rounds: 100, label: "10 minutes" };
const SUSTAIN_UNIT_ROUNDS = { round: 1, minute: 10, hour: 600, day: 14400 };

// How long a spell can be Sustained, from its duration: the "up to" part
// ("1 round or sustained up to 1 minute"), or the duration itself ("1
// minute", "4 rounds"). { rounds, label }
function getSustainLimit(spell) {
  const duration = spell?.data?.duration;
  const text = String((duration && typeof duration === "object" ? duration.value : duration) || "").toLowerCase();
  const match = text.match(/up to (\d+)\s*(round|minute|hour|day)s?/) || text.match(/(\d+)\s*(round|minute|hour|day)s?/);
  if (!match) return { ...SUSTAIN_DEFAULT_LIMIT };
  const amount = parseInt(match[1], 10);
  return { rounds: amount * SUSTAIN_UNIT_ROUNDS[match[2]], label: `${amount} ${match[2]}${amount === 1 ? "" : "s"}` };
}

function getEntryLimit(entry) {
  return Number.isFinite(entry?.limitRounds) ? { rounds: entry.limitRounds, label: entry.limitLabel || `${entry.limitRounds} rounds` } : { ...SUSTAIN_DEFAULT_LIMIT };
}

function isSustainedSpell(spell) {
  const duration = spell?.data?.duration;
  return !!(duration && typeof duration === "object" && duration.sustained);
}

function getSustainedSpells(token) {
  const list = token?.data?.sustaining;
  return Array.isArray(list) ? list : [];
}

function findSustainToken(tokenId) {
  if (!tokenId) return null;
  const current = api.getToken ? api.getToken() : null;
  if (current?._id === tokenId) return current;
  return ((api.getOtherTokens ? api.getOtherTokens() : []) || []).map((t) => t?.token || t).find((t) => t?._id === tokenId) || null;
}

function writeSustainedSpells(token, list, callback) {
  api.setValuesOnTokenById(token._id, "tokens", { "data.sustaining": list }, callback);
}

// The list with this spell (re)cast this round: casting it again starts it
// over
function getSustainedSpellsAfterCast(token, spellName, round, limit = SUSTAIN_DEFAULT_LIMIT) {
  const others = getSustainedSpells(token).filter((entry) => entry.name !== spellName);
  return [...others, { name: spellName, castRound: round, sustainedRound: round, limitRounds: limit.rounds, limitLabel: limit.label }];
}

// The cast card's Sustain button
function getSustainButton(token, spellName) {
  const fence = "```";
  return `${fence}Sustain\nsustainSpell(${JSON.stringify(token?._id || null)}, ${JSON.stringify(spellName)});\n${fence}`;
}

// Casting a sustained spell: recorded on the caster's token with the round
// and its limit (castSpell, spells.js)
function startSustainingSpell(token, spellName, spell = null) {
  if (!token?._id) return;
  const limit = getSustainLimit(spell);
  getCombatRound((round) => {
    writeSustainedSpells(token, getSustainedSpellsAfterCast(token, spellName, round, limit));
  });
}

// What Sustaining does to the list: { list, rounds, tooLong, limit }.
// rounds: how many rounds it has lasted (null outside an encounter)
function getSustainedSpellsAfterSustain(token, spellName, round) {
  let rounds = null;
  let limit = { ...SUSTAIN_DEFAULT_LIMIT };
  let found = false;
  const list = getSustainedSpells(token).map((entry) => {
    if (entry.name !== spellName) return entry;
    found = true;
    limit = getEntryLimit(entry);
    if (Number.isFinite(round) && Number.isFinite(entry.castRound)) rounds = round - entry.castRound;
    return { ...entry, sustainedRound: round };
  });
  if (!found) list.push({ name: spellName, castRound: round, sustainedRound: round, limitRounds: limit.rounds, limitLabel: limit.label });
  return { list, rounds, tooLong: rounds !== null && rounds >= limit.rounds, limit };
}

// Sustain (1 action): the spell lasts through this turn
function sustainSpell(tokenId, spellName) {
  const token = findSustainToken(tokenId) || (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t)[0];
  if (!token) {
    api.showNotification(`Select the caster's token to Sustain ${spellName}.`, "yellow", "Sustain");
    return;
  }
  getCombatRound((round) => {
    const { list, rounds, tooLong, limit } = getSustainedSpellsAfterSustain(token, spellName, round);
    writeSustainedSpells(token, list);
    const when = rounds !== null ? ` (round ${rounds + 1} of it)` : "";
    const note = tooLong ? `\n[gm]${spellName} has lasted ${limit.label}, the most it can be Sustained: it ends at the end of this turn.[/gm]` : "";
    api.sendMessage(`:one-action: **${getTokenDisplayName(token)} Sustains ${spellName}**${when}.${note}`, undefined, [], [], token);
  });
}

// Stop sustaining: off the list (the spell ends at the end of the turn, or
// now if the caster Dismisses it)
function stopSustainingSpell(tokenId, spellName) {
  const token = findSustainToken(tokenId);
  if (!token) return;
  writeSustainedSpells(token, getSustainedSpells(token).filter((entry) => entry.name !== spellName));
  api.sendMessage(`**${getTokenDisplayName(token)} stops sustaining ${spellName}**: it ends.\n${getRemoveSpellEffectsButton(spellName, token._id)}`, undefined, [], [], token);
}

// The spells that end at the end of the caster's turn: not cast or
// Sustained this round, or Sustained to their limit. { ended, kept }
function getUnsustainedSpells(token, round) {
  const ended = [];
  const kept = [];
  getSustainedSpells(token).forEach((entry) => {
    const sustainedNow = entry.sustainedRound === round || entry.castRound === round;
    const tooLong = Number.isFinite(entry.castRound) && round - entry.castRound >= getEntryLimit(entry).rounds;
    if (Number.isFinite(round) && (!sustainedNow || tooLong)) ended.push({ ...entry, tooLong });
    else kept.push(entry);
  });
  return { ended, kept };
}

function getRemoveSpellEffectsButton(spellName, casterTokenId = null) {
  const fence = "```";
  return `${fence}Remove_${spellName.replace(/[^A-Za-z0-9]+/g, "_")}_Effects\nremoveSpellEffects(${JSON.stringify(spellName)}, ${JSON.stringify(casterTokenId)});\n${fence}`;
}

// onTurnEnd: the spells the caster didn't Sustain end
function endUnsustainedSpells(token) {
  if (!token?._id || getSustainedSpells(token).length === 0) return;
  getCombatRound((round) => {
    if (!Number.isFinite(round)) return;
    const { ended, kept } = getUnsustainedSpells(token, round);
    if (ended.length === 0) return;
    writeSustainedSpells(token, kept);
    const lines = ended.map(
      (entry) =>
        `**${entry.name} ends**: ${getTokenDisplayName(token)} ${entry.tooLong ? `has Sustained it for ${getEntryLimit(entry).label}, the most it can be` : "didn't Sustain it this turn"}.\n${getRemoveSpellEffectsButton(entry.name, token._id)}`,
    );
    api.sendMessage(lines.join("\n"), undefined, [], [], token);
  });
}

// onTurnStart: what the caster is sustaining, with a Sustain and a Stop
// button for each
function remindSustainedSpells(token) {
  const list = getSustainedSpells(token);
  if (!token?._id || list.length === 0) return;
  const fence = "```";
  const lines = list.map(
    (entry) =>
      `${entry.name}\n${getSustainButton(token, entry.name)}\n${fence}Stop\nstopSustainingSpell(${JSON.stringify(token._id)}, ${JSON.stringify(entry.name)});\n${fence}`,
  );
  api.sendMessage(`**${getTokenDisplayName(token)} is sustaining:** Sustain each to keep it going this turn.\n${lines.join("\n")}`, undefined, [], [], token);
}

// Whether an effect is named for the spell: its name, or "Aura: <spell>"
function isSpellEffectName(effectName, spellName) {
  const name = String(effectName || "").trim().toLowerCase();
  const wanted = String(spellName || "").trim().toLowerCase();
  return !!wanted && (name === wanted || name === `aura: ${wanted}`);
}

// The removals for one effect on a token: [] (not this caster's), [null]
// (the whole effect: no applier recorded, or all of it this caster's), or
// this caster's instance indexes, highest first so the others keep theirs
function getSpellEffectRemovals(token, effect, casterTokenId) {
  const instances = getEffectInstances(token, effect);
  const recorded = instances.some((instance) => instance?.tokenId);
  if (!recorded || !casterTokenId) return [null];
  // A stacked effect can keep only its latest applier (seen live: two
  // casters' Bless on one token, one applier stored): then only one
  // instance is known to be this caster's, the latest
  const count = (token?.effectIds || []).filter((id) => id === effect._id).length || 1;
  if (instances.length < count) {
    return instances[instances.length - 1]?.tokenId === casterTokenId ? [count - 1] : [];
  }
  const own = instances.map((instance, index) => (instance?.tokenId === casterTokenId ? index : -1)).filter((index) => index >= 0);
  if (own.length === 0) return [];
  if (own.length === instances.length) return [null];
  return own.sort((a, b) => b - a);
}

// The GM's button on an ended spell's card: the caster's effects named for
// the spell ("Bless", "Aura: Bless"), off every token on the scene. An effect
// that records who applied it is only removed for this caster, so another
// caster's Bless stays.
function removeSpellEffects(spellName, casterTokenId = null) {
  if (typeof isGM !== "undefined" && !isGM) {
    api.showNotification("Only the GM can remove a spell's effects.", "yellow", "Sustain");
    return;
  }
  if (!String(spellName || "").trim()) return;
  const tokens = ((api.getOtherTokens ? api.getOtherTokens() : []) || []).map((t) => t?.token || t);
  const current = api.getToken ? api.getToken() : null;
  if (current?._id && !tokens.some((t) => t._id === current._id)) tokens.push(current);
  // Every removal, one after the other: the token held here isn't updated
  // by them, so the indexes are worked out first
  const steps = [];
  const removed = [];
  tokens.forEach((token) => {
    const names = [];
    (token?.effects || [])
      .filter((effect) => isSpellEffectName(effect?.name, spellName))
      .forEach((effect) => {
        const removals = getSpellEffectRemovals(token, effect, casterTokenId);
        if (removals.length === 0) return;
        names.push(effect.name);
        removals.forEach((index) => steps.push({ token, effect, index }));
      });
    if (names.length) removed.push(`${getTokenDisplayName(token)} (${names.join(", ")})`);
  });
  const next = (i) => {
    if (i >= steps.length) return;
    const { token, effect, index } = steps[i];
    if (index === null) api.removeEffectById(effect._id, token, () => next(i + 1));
    else api.removeEffectById(effect._id, token, () => next(i + 1), { instanceIndex: index });
  };
  next(0);
  api.sendMessage(removed.length ? `${spellName}'s effects removed from ${removed.join("; ")}.` : `No effect of ${spellName} from this caster on this scene.`);
}

// onEncounterEnd: the lists are cleared (rounds start over)
function clearSustainedSpells(tokens) {
  (tokens || [])
    .map((t) => t?.token || t)
    .filter((token) => token?._id && getSustainedSpells(token).length > 0)
    .forEach((token) => writeSustainedSpells(token, []));
}
