// Class extras: Hero Points, Rage's temporary Hit Points, panache and an
// oracle's cursebound.
//
//   - Hero Points (Player Core pg. 413; GM Core): a GM chat macro starts a
//     session (each party member has 1, unspent ones are lost) and another
//     awards 1 to the selected characters, up to 3
//   - Rage (Player Core 2): its temporary Hit Points are noted where they came
//     from, and when the encounter ends Rage, the ones left go with it
//   - Panache (Player Core 2): a check with the bravado trait (Tumble Through,
//     and the actions a swashbuckler's style gives it, as module roll
//     options) shows Gain Panache on a success, and Panache until the end of
//     your next turn on a failure. A finisher's card has a Lose Panache button
//   - Cursebound (Player Core 2): using an ability with the cursebound trait
//     raises the condition by 1, up to the maximum (2, 3 with Major Curse, 4
//     with Extreme Curse); at the maximum the card says so and leaves it to
//     the GM. Refocus reduces it by 1
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
    members.forEach((member) => api.setValuesOnRecord(member, { "data.heroPoints": 1 }));
    api.sendMessage(
      `**New session:** ${members.map((member) => getCreatureName(member)).join(", ")} each start with 1 Hero Point. Unspent ones from last session are lost.`,
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
      api.sendMessage(`${name} already has ${HERO_POINTS_MAX} Hero Points, the most a character can have.`, undefined, [], [], token);
      return;
    }
    api.setValuesOnTokenById(token._id, token.recordType, values);
    api.sendMessage(`${name} gains a Hero Point (${values["data.heroPoints"]}).`, undefined, [], [], token);
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
