// Summons and minions (Player Core pg. 299-300, roadmap H16): a creature
// picker for summon spells, and initiative just below the master for
// minions.
//
//   - Casting a spell with the summon trait posts a Pick Creature button: a
//     list of the creatures with the spell's trait (read from its text) at or
//     below the rank's level cap (the summon trait's table). The pick opens
//     the creature's record to drag onto the map, and posts a Mark Summoned
//     button to drop on its token
//   - Mark Summoned links the token to its caster (data.summonedBy, and the
//     Summoned effect where the campaign has one) and puts it just below the
//     caster in initiative
//   - Minions act on their master's turn: a token added to the combat
//     tracker whose master is in it (a summon's caster, a familiar's or
//     animal companion's master, a mount's rider) goes just below the master,
//     and minions follow when the master rolls initiative
//
// Nothing is refused: uncommon and rare creatures are listed with their
// rarity, and the GM can still move anyone in the tracker.

// The highest creature level a summon spell can summon, by spell rank (the
// summon trait)
const SUMMON_LEVEL_BY_RANK = [null, -1, 1, 2, 3, 5, 7, 9, 11, 13, 15];

// How far below its master a minion sits in initiative
const MINION_INITIATIVE_STEP = 0.01;

const SUMMON_TRAIT_STOPWORDS = ["creature", "common", "a", "an", "the"];

function isSummonSpell(spell) {
  return (spell?.data?.traits || []).some((trait) => `${trait || ""}`.trim().toLowerCase() === "summon");
}

function getSummonLevelCap(rank) {
  const value = Math.min(Math.max(parseInt(rank, 10) || 1, 1), 10);
  return SUMMON_LEVEL_BY_RANK[value];
}

function getSummonSpellText(spell) {
  return `${spell?.data?.description || ""}`
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .toLowerCase();
}

// What the spell summons, from its text: the traits ("a creature that has the
// animal trait", "a common celestial, fiend, or monitor of level -1"), or, when
// it names one creature ("You summon a Phantasmal Minion."), that name
function getSummonFilter(spell) {
  const text = getSummonSpellText(spell);
  const traits = [];
  const add = (phrase) => {
    phrase
      .split(/,|\bor\b|\band\b/)
      .map((word) => word.trim())
      .filter((word) => /^[a-z-]+$/.test(word) && !SUMMON_TRAIT_STOPWORDS.includes(word))
      .forEach((word) => {
        if (!traits.includes(word)) traits.push(word);
      });
  };
  for (const match of text.matchAll(/\b(?:has|with) the ([a-z ,-]+?) traits?\b/g)) add(match[1]);
  for (const match of text.matchAll(/\bsummon an? (?:common )?([a-z ,-]+?) (?:of level|whose level)/g)) add(match[1]);
  if (traits.length) return { traits, names: [] };
  const named = text.match(/\byou summon an? ([a-z][a-z' -]*?)\s*\./);
  return { traits: [], names: named ? [named[1].trim()] : [] };
}

// "plant or fungus", "celestial, fiend, or monitor"
function joinWithOr(words) {
  if (words.length < 3) return words.join(" or ");
  return `${words.slice(0, -1).join(", ")}, or ${words[words.length - 1]}`;
}

function escapeSummonRegex(text) {
  return `${text}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The records query for the picker
function getSummonQuery(filter, maxLevel) {
  const query = { "data.level": { $lte: maxLevel } };
  if (filter.traits.length) {
    query["data.traits"] = { $regex: `^(${filter.traits.map(escapeSummonRegex).join("|")})$`, $options: "i" };
  } else if (filter.names.length) {
    query.name = { $regex: `^(${filter.names.map(escapeSummonRegex).join("|")})$`, $options: "i" };
  }
  return query;
}

function getCreatureRarity(creature) {
  const traits = (creature?.data?.traits || []).map((trait) => `${trait || ""}`.toLowerCase());
  return ["unique", "rare", "uncommon"].find((rarity) => traits.includes(rarity)) || "common";
}

// The picker's options: one per creature (the same creature in two sources
// once), highest level first, with its rarity when it isn't common
function getSummonOptions(creatures) {
  const seen = new Set();
  return (creatures || [])
    .filter((creature) => {
      const key = `${`${creature?.name || ""}`.toLowerCase()}|${creature?.data?.level}`;
      if (!creature?._id || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (parseInt(b?.data?.level, 10) || 0) - (parseInt(a?.data?.level, 10) || 0) || `${a.name}`.localeCompare(`${b.name}`))
    .map((creature) => {
      const rarity = getCreatureRarity(creature);
      const level = parseInt(creature?.data?.level, 10) || 0;
      return {
        label: `${creature.name} (level ${level})${rarity === "common" ? "" : `, ${rarity}`}`,
        value: creature._id,
      };
    });
}

// The cast card's button
function getSummonButton(record, token, spell, rank) {
  const info = {
    spellName: spell?.name || "Summon",
    rank: parseInt(rank, 10) || 1,
    filter: getSummonFilter(spell),
    casterTokenId: token?._id || null,
    casterName: (token ? getTokenDisplayName(token) : record?.name) || "The caster",
  };
  const fence = "```";
  return `${fence}Pick_Creature\nshowSummonPicker(${JSON.stringify(info)});\n${fence}`;
}

// Pick Creature: the creatures the spell can summon at its rank; the pick
// opens to drag onto the map, with a Mark Summoned button to drop on it
function showSummonPicker(info) {
  const maxLevel = getSummonLevelCap(info?.rank);
  const filter = info?.filter || { traits: [], names: [] };
  if (!filter.traits.length && !filter.names.length) {
    api.showNotification(`${info?.spellName || "This spell"} doesn't say what it summons; pick a creature of level ${maxLevel} or lower.`, "yellow", "Summon");
    return;
  }
  api.getRecordsByQuery("npcs", getSummonQuery(filter, maxLevel), (creatures) => {
    const options = getSummonOptions(creatures);
    const what = joinWithOr(filter.traits.length ? filter.traits : filter.names);
    if (!options.length) {
      api.showNotification(`No ${what} creature of level ${maxLevel} or lower in this campaign.`, "yellow", "Summon");
      return;
    }
    api.showPrompt(
      info.spellName,
      `A ${what} creature of level ${maxLevel} or lower.`,
      "Choose a creature...",
      options,
      null,
      (selected) => {
        const id = getPromptSelections(selected)[0];
        const creature = (creatures || []).find((entry) => entry?._id === id);
        if (!creature) return;
        api.openRecord(creature);
        api.sendMessage(getSummonPickedMessage(info, creature), undefined, [], []);
      },
    );
  });
}

function getSummonPickedMessage(info, creature) {
  const caster = { tokenId: info?.casterTokenId || null, name: info?.casterName || "The caster", spellName: info?.spellName || "" };
  const fence = "```";
  return [
    `**${info?.spellName || "Summon"}: ${creature.name}**`,
    `Drag ${creature.name} onto the map, then drop Mark Summoned on its token. It's a minion of ${caster.name}: it acts on ${caster.name}'s turn, when the spell is Sustained.`,
    `${fence}Mark_Summoned\nmarkSummoned(${JSON.stringify(caster)});\n${fence}`,
  ].join("\n");
}

// Mark Summoned, dropped on (or with) the summoned tokens: each links to its
// caster and goes just below it in initiative, in one write per token
function markSummoned(caster) {
  const tokens = (api.getSelectedOrDroppedToken() || []).map((entry) => entry?.token || entry).filter(Boolean);
  if (!tokens.length) {
    api.showNotification("Drop Mark Summoned on the summoned creature's token.", "yellow", "Summon");
    return;
  }
  const summonedBy = { tokenId: caster?.tokenId || null, name: caster?.name || "" };
  api.getCombatTracker((tracker) => {
    const scene = getMinionSceneTokens();
    tokens.forEach((token) => {
      if (token._id === summonedBy.tokenId) return;
      const linked = { ...token, data: { ...(token.data || {}), summonedBy } };
      const values = { "data.summonedBy": summonedBy };
      const initiative = getMinionInitiativeValue(linked, scene, tracker?.tokenIds || []);
      if (initiative !== null) values["data.initiative"] = initiative;
      api.setValuesOnTokenById(token._id, "tokens", values);
      if (summonedBy.tokenId) api.addEffect("Summoned", token, undefined, { _id: summonedBy.tokenId, name: summonedBy.name });
      api.sendMessage(
        `**${getTokenDisplayName(token)}** is summoned by ${summonedBy.name || "its caster"}${caster?.spellName ? ` (${caster.spellName})` : ""}${initiative !== null ? `, and acts just after ${summonedBy.name} in initiative` : ""}.`,
        undefined,
        [],
        [],
      );
    });
  });
}

// ---------------------------------------------------------------- Minions

function getMinionSceneTokens() {
  const current = api.getToken ? api.getToken() : null;
  const others = (api.getOtherTokens ? api.getOtherTokens() : []) || [];
  const tokens = others.map((entry) => entry?.token || entry).filter(Boolean);
  if (current?._id && !tokens.some((token) => token._id === current._id)) tokens.push(current);
  return tokens;
}

function getMinionData(token, key) {
  return token?.data?.[key] ?? token?.record?.data?.[key];
}

// The token a minion acts with, among the scene's tokens: a summon's caster,
// a familiar's or animal companion's master, or the rider of a mount
function getMinionMaster(token, tokens) {
  if (!token?._id) return null;
  const others = (tokens || []).filter((other) => other?._id && other._id !== token._id);
  const summonedBy = getMinionData(token, "summonedBy");
  if (summonedBy?.tokenId) {
    const caster = others.find((other) => other._id === summonedBy.tokenId);
    if (caster) return caster;
  }
  const masterRecordId =
    (getMinionData(token, "type") === "familiar" ? getRecordIdFromValue(getMinionData(token, "master")) : null) ||
    getCompanionMasterId({ data: { companionMaster: getMinionData(token, "companionMaster") } });
  if (masterRecordId) {
    const master = others.find((other) => other.recordId === masterRecordId || other.record?._id === masterRecordId);
    if (master) return master;
  }
  return others.find((other) => getMountId(other) === token._id) || null;
}

// Just below the master, when the master is in the combat tracker with an
// initiative (initiatives: the master's new one, by token id, when it's just
// been rolled); otherwise null
function getMinionInitiativeValue(token, tokens, trackerIds, initiatives = {}) {
  const master = getMinionMaster(token, tokens);
  if (!master || !(trackerIds || []).includes(master._id)) return null;
  const initiative = parseFloat(initiatives[master._id] ?? master.data?.initiative);
  if (!Number.isFinite(initiative)) return null;
  return Math.round((initiative - MINION_INITIATIVE_STEP) * 100) / 100;
}

// The combat tracker's onTokenAdd: a minion whose master is in the tracker
// goes just below it
function placeMinionInitiative(token) {
  if (!token?._id) return;
  api.getCombatTracker((tracker) => {
    const scene = getMinionSceneTokens();
    if (!scene.some((other) => other._id === token._id)) scene.push(token);
    const initiative = getMinionInitiativeValue(token, scene, tracker?.tokenIds || []);
    if (initiative === null) return;
    api.setValuesOnTokenById(token._id, "tokens", { "data.initiative": initiative });
  });
}

// After masters roll initiative (initiatives: their new values by token id),
// their minions in the tracker follow, one write per minion
function placeMinionsOf(initiatives) {
  const masterIds = Object.keys(initiatives || {});
  if (!masterIds.length) return;
  api.getCombatTracker((tracker) => {
    const trackerIds = tracker?.tokenIds || [];
    const scene = getMinionSceneTokens();
    scene
      .filter((token) => trackerIds.includes(token._id) && !masterIds.includes(token._id))
      .forEach((token) => {
        const master = getMinionMaster(token, scene);
        if (!master || !masterIds.includes(master._id)) return;
        const initiative = getMinionInitiativeValue(token, scene, trackerIds, initiatives);
        if (initiative === null) return;
        api.setValuesOnTokenById(token._id, "tokens", { "data.initiative": initiative });
      });
  });
}
