// Sustained spells (Player Core pg. 304, Sustain pg. 419, roadmap H17): a
// spell with a sustained duration lasts until the end of the caster's turn
// unless they Sustain it that turn, up to 10 minutes.
//
//   - Casting one records it on the caster's token (data.sustaining: the
//     spell and the rounds it was cast and last Sustained), and its card gets
//     a Sustain button
//   - Sustain marks it Sustained this round; past 10 minutes (100 rounds) the
//     card says it can't be Sustained any longer (nothing is refused)
//   - At the start of the caster's turn, a card lists what they're
//     sustaining, each with a Sustain and a Stop button
//   - At the end of their turn, a spell neither cast nor Sustained that turn
//     ends: a card says so, with a GM button that removes the effects named
//     for it from the scene's tokens (spells don't record which effects they
//     put on whom, so the GM applies and removes them)
//   - The encounter's end clears the lists
// Outside an encounter there are no rounds: the card's Sustain button only
// posts that it's Sustained.

const SUSTAIN_MAX_ROUNDS = 100;

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
function getSustainedSpellsAfterCast(token, spellName, round) {
  const others = getSustainedSpells(token).filter((entry) => entry.name !== spellName);
  return [...others, { name: spellName, castRound: round, sustainedRound: round }];
}

// The cast card's Sustain button
function getSustainButton(token, spellName) {
  const fence = "```";
  return `${fence}Sustain\nsustainSpell(${JSON.stringify(token?._id || null)}, ${JSON.stringify(spellName)});\n${fence}`;
}

// Casting a sustained spell: recorded on the caster's token with the round
// (castSpell, spells.js)
function startSustainingSpell(token, spellName) {
  if (!token?._id) return;
  getCombatRound((round) => {
    writeSustainedSpells(token, getSustainedSpellsAfterCast(token, spellName, round));
  });
}

// What Sustaining does to the list: { list, rounds, tooLong }. rounds: how
// many rounds it has lasted (null outside an encounter)
function getSustainedSpellsAfterSustain(token, spellName, round) {
  let rounds = null;
  let found = false;
  const list = getSustainedSpells(token).map((entry) => {
    if (entry.name !== spellName) return entry;
    found = true;
    if (Number.isFinite(round) && Number.isFinite(entry.castRound)) rounds = round - entry.castRound;
    return { ...entry, sustainedRound: round };
  });
  if (!found) list.push({ name: spellName, castRound: round, sustainedRound: round });
  return { list, rounds, tooLong: rounds !== null && rounds >= SUSTAIN_MAX_ROUNDS };
}

// Sustain (1 action): the spell lasts through this turn
function sustainSpell(tokenId, spellName) {
  const token = findSustainToken(tokenId) || (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t)[0];
  if (!token) {
    api.showNotification(`Select the caster's token to Sustain ${spellName}.`, "yellow", "Sustain");
    return;
  }
  getCombatRound((round) => {
    const { list, rounds, tooLong } = getSustainedSpellsAfterSustain(token, spellName, round);
    writeSustainedSpells(token, list);
    const when = rounds !== null ? ` (round ${rounds + 1} of it)` : "";
    const note = tooLong ? `\n[gm]${spellName} has lasted 10 minutes, the most a spell can be Sustained: it ends at the end of this turn.[/gm]` : "";
    api.sendMessage(`:one-action: **${getTokenDisplayName(token)} Sustains ${spellName}**${when}.${note}`, undefined, [], [], token);
  });
}

// Stop sustaining: off the list (the spell ends at the end of the turn, or
// now if the caster Dismisses it)
function stopSustainingSpell(tokenId, spellName) {
  const token = findSustainToken(tokenId);
  if (!token) return;
  writeSustainedSpells(token, getSustainedSpells(token).filter((entry) => entry.name !== spellName));
  api.sendMessage(`**${getTokenDisplayName(token)} stops sustaining ${spellName}**: it ends.\n${getRemoveSpellEffectsButton(spellName)}`, undefined, [], [], token);
}

// The spells that end at the end of the caster's turn: not cast or
// Sustained this round, or Sustained to 10 minutes. { ended, kept }
function getUnsustainedSpells(token, round) {
  const ended = [];
  const kept = [];
  getSustainedSpells(token).forEach((entry) => {
    const sustainedNow = entry.sustainedRound === round || entry.castRound === round;
    const tooLong = Number.isFinite(entry.castRound) && round - entry.castRound >= SUSTAIN_MAX_ROUNDS;
    if (Number.isFinite(round) && (!sustainedNow || tooLong)) ended.push({ ...entry, tooLong });
    else kept.push(entry);
  });
  return { ended, kept };
}

function getRemoveSpellEffectsButton(spellName) {
  const fence = "```";
  return `${fence}Remove_${spellName.replace(/[^A-Za-z0-9]+/g, "_")}_Effects\nremoveSpellEffects(${JSON.stringify(spellName)});\n${fence}`;
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
      (entry) => `**${entry.name} ends**: ${getTokenDisplayName(token)} ${entry.tooLong ? "has Sustained it for 10 minutes, the most it can be" : "didn't Sustain it this turn"}.\n${getRemoveSpellEffectsButton(entry.name)}`,
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

// The GM's button on an ended spell's card: the effects named for the spell
// (its name in theirs, "Bless" in "Aura: Bless"), off every token on the
// scene
function removeSpellEffects(spellName) {
  if (typeof isGM !== "undefined" && !isGM) {
    api.showNotification("Only the GM can remove a spell's effects.", "yellow", "Sustain");
    return;
  }
  const wanted = String(spellName || "").trim().toLowerCase();
  if (!wanted) return;
  const tokens = ((api.getOtherTokens ? api.getOtherTokens() : []) || []).map((t) => t?.token || t);
  const current = api.getToken ? api.getToken() : null;
  if (current?._id && !tokens.some((t) => t._id === current._id)) tokens.push(current);
  const removed = [];
  tokens.forEach((token) => {
    const effects = (token?.effects || []).filter((effect) => String(effect?.name || "").toLowerCase().includes(wanted));
    const next = (i) => {
      if (i >= effects.length) return;
      api.removeEffectById(effects[i]._id, token, () => next(i + 1));
    };
    if (effects.length) {
      removed.push(`${getTokenDisplayName(token)} (${effects.map((e) => e.name).join(", ")})`);
      next(0);
    }
  });
  api.sendMessage(removed.length ? `${spellName}'s effects removed from ${removed.join("; ")}.` : `No effect named for ${spellName} on this scene.`);
}

// onEncounterEnd: the lists are cleared (rounds start over)
function clearSustainedSpells(tokens) {
  (tokens || [])
    .map((t) => t?.token || t)
    .filter((token) => token?._id && getSustainedSpells(token).length > 0)
    .forEach((token) => writeSustainedSpells(token, []));
}
