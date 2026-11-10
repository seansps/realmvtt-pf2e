// Mythic rules (War of Immortals pg. 76-79, a campaign setting). A character
// is mythic when the setting is on and it has a Calling. Nothing is stored
// beyond what the sheet shows:
//   - Mythic Points: the sheet's Hero Points counter holds them, labeled
//     Mythic Points. A mythic character doesn't use Hero Points, and both
//     stop at 3.
//   - Mythic proficiency: an opt-in on skill, Perception, save and Strike
//     prompts, for abilities that say to use it (10 + level).
//   - Rewrite Fate: a button on a skill check's or save's result.
//   - Mythic dying: at the dying value that would kill it, the character
//     gains doomed and stabilizes instead.
//   - Mythic feat slots at even levels (setFeatSlots).
//   - Recovering points: the GM Tools panel.

const MYTHIC_DOOMED_DEATH = 4;

function isMythicCreature(creature) {
  return getVariantRules().mythic && hasMythicCalling(creature);
}

// A Calling: a feature of the Calling type, or anything with the Calling
// trait. A dropped feature can sit on the character or on its first class.
function hasMythicCalling(creature) {
  const asList = (value) => (Array.isArray(value) ? value : []);
  const data = creature?.data || {};
  if (creature?.recordType === "npcs") return false;
  return [
    ...asList(data.features),
    ...asList(data.feats),
    ...asList(data.classes).flatMap((entry) => asList(entry?.data?.features)),
  ].some(
    (entry) =>
      entry?.data?.type === "calling" ||
      asList(entry?.data?.traits).some((trait) => `${trait}`.toLowerCase() === "calling"),
  );
}

function getMythicPointName(creature) {
  return isMythicCreature(creature) ? "Mythic Point" : "Hero Point";
}

// The sheet's label on the Hero Points counter
function getHeroPointsLabel(creature) {
  return `${getMythicPointName(creature)}s`;
}

// Heroic Recovery spends Hero Points, which a mythic character doesn't use
function canSpendHeroPoint(creature) {
  return getHeroPoints(creature) > 0 && !isMythicCreature(creature);
}

// A new session: 3 Mythic Points, or 1 Hero Point
function getSessionStartValues(member) {
  const mythic = isMythicCreature(member);
  const values = { "data.heroPoints": mythic ? HERO_POINTS_MAX : 1 };
  const label = getHeroPointsLabel(member);
  if ((member?.data?.heroPtsLabel || "Hero Points") !== label) {
    values["data.heroPtsLabel"] = label;
  }
  return values;
}

// 10 + level. With Proficiency without Level the level isn't added, so it's
// the next step above legendary's +8.
function getMythicProficiencyBonus(level, variants = getVariantRules()) {
  return variants.proficiencyWithoutLevel ? 10 : 10 + (parseInt(level, 10) || 0);
}

// The opt-in for a roll's prompt: the difference from the rank's bonus, as
// the rank's bonus is already part of the roll. Null for anyone not mythic.
function getMythicProficiencyModifier(creature, rank, active = false) {
  if (!isMythicCreature(creature)) return null;
  const level = parseInt(creature?.data?.level || "0", 10) || 0;
  return {
    name: "Mythic Proficiency",
    type: "",
    value: getMythicProficiencyBonus(level) - getProficiencyBonusForRank(rank || 0, level),
    active: !!active,
  };
}

// ------------------------------------------------------------- Rewrite Fate

// What a skill check's or save's metadata carries for the Rewrite Fate
// button: how to make the same roll again. Null when there is no button: not
// mythic, out of Mythic Points, no token, or already rewritten (it's a
// fortune effect, so only one applies to a check).
function getRewriteFateMetadata(creature, call, alreadyRewritten) {
  if (alreadyRewritten || !isMythicCreature(creature) || getHeroPoints(creature) < 1) {
    return null;
  }
  const token = creature?.recordId ? creature : api.getToken();
  if (!token?._id) return null;
  return {
    tokenId: token._id,
    tokenName: getCreatureName(token),
    call: encodeURIComponent(JSON.stringify(call)),
  };
}

// Rewrite Fate (War of Immortals pg. 78): spend a Mythic Point and reroll
// with mythic proficiency, taking the new result. The point is spent when the
// new result comes in, so closing the roll prompt costs nothing.
function rewriteFate(token, encodedCall) {
  if (!token?.data) return;
  if (!canChangeToken(token)) {
    api.showNotification("Only the GM or the character's owner can use Rewrite Fate.", "yellow", "Notice");
    return;
  }
  const points = getHeroPoints(token);
  if (points < 1) {
    api.showNotification(`${getCreatureName(token)} has no Mythic Points.`, "yellow", "Notice");
    return;
  }
  let call;
  try {
    call = JSON.parse(decodeURIComponent(encodedCall));
  } catch (e) {
    return;
  }
  const rewriteFateSpend = { tokenId: token._id, recordType: token.recordType, points: points - 1 };
  if (call.kind === "skill") {
    rollSkill(
      token,
      call.skillName,
      call.dc,
      call.isLore,
      call.loreSkillMod,
      call.loreSkillTraining,
      call.loreSkillStat,
      true,
      false,
      undefined,
      { ...call.metadata, mythicProficiency: true, rewriteFateSpend },
    );
  } else if (call.kind === "save") {
    rollSave(token, call.saveType, call.dc, call.isSpell, true, {
      ...call.options,
      mythicProficiency: true,
      rewriteFateSpend,
    });
  }
}

// The lines a skill check's or save's card gets: the Rewrite Fate button, or
// on a rewritten roll, the note that the point was spent (which spends it)
function getRewriteFateLines(metadata) {
  const spend = metadata?.rewriteFateSpend;
  if (spend) {
    api.setValuesOnTokenById(spend.tokenId, spend.recordType, { "data.heroPoints": spend.points });
    return [`**Rewrite Fate:** rolled with mythic proficiency, taking this result (${spend.points} Mythic Point${spend.points === 1 ? "" : "s"} left).`];
  }
  const button = metadata?.rewriteFate;
  if (!button) return [];
  return [
    getChatButton(
      "Rewrite_Fate",
      { _id: button.tokenId, name: button.tokenName },
      `rewriteFate(token, ${JSON.stringify(button.call)})`,
    ),
  ];
}

// -------------------------------------------------------------- Mythic dying

// War of Immortals pg. 77. At the dying value that would kill it, a mythic
// character's doomed value goes up by 1 and it stabilizes at 0 Hit Points; it
// dies when doomed reaches 4. Losing dying adds wounded as usual. Null for
// anyone not mythic.
function getMythicDeathResult(creature) {
  if (!isMythicCreature(creature)) return null;
  const doomed = getDoomedValue(creature) + 1;
  return {
    doomed,
    dead: doomed >= MYTHIC_DOOMED_DEATH,
    wounded: Math.min(getWoundedValue(creature) + 1, getWoundedMax(creature)),
  };
}

function getMythicDeathLine(name, result) {
  return `${name} would die, but mythic power holds: Doomed ${result.doomed}, stable at 0 HP (Wounded ${result.wounded}).`;
}

// ------------------------------------------------------ Recovering points

function getMythicPointValues(member, gained) {
  return { "data.heroPoints": Math.min(getHeroPoints(member) + gained, HERO_POINTS_MAX) };
}

function withMythicParty(callback) {
  api.getParty((party) => {
    const members = (party || []).filter(isMythicCreature);
    if (members.length === 0) {
      api.showNotification("Add the mythic characters to the Party Sheet from the View menu. A character is mythic once it has a Calling.", "yellow", "Mythic");
      return;
    }
    callback(members);
  });
}

function getSelectedMythicCharacters() {
  const tokens = (api.getSelectedTokens() || []).map((t) => t?.token || t).filter(isMythicCreature);
  if (tokens.length === 0) {
    api.showNotification("Select a mythic character's token first.", "yellow", "Mythic");
  }
  return tokens;
}

function pointsText(member, values) {
  return `${getCreatureName(member)} (${values["data.heroPoints"]})`;
}

// Slaying a mythic opponent: 2 to whoever defeated it, 1 to the other mythic
// characters. Select the one who defeated it.
function awardMythicSlaying() {
  const [slayer] = getSelectedMythicCharacters();
  if (!slayer) return;
  withMythicParty((members) => {
    const texts = members.map((member) => {
      const isSlayer = member._id === (slayer.recordId || slayer._id);
      const values = getMythicPointValues(member, isSlayer ? 2 : 1);
      api.setValuesOnRecord(member, values);
      return `${isSlayer ? "+2" : "+1"} ${pointsText(member, values)}`;
    });
    api.sendMessage(`**A mythic opponent is slain:** ${texts.join(", ")}.`);
  });
}

// Completing a mythic deed: 3 to each mythic character in the party
function awardMythicDeed() {
  withMythicParty((members) => {
    members.forEach((member) => api.setValuesOnRecord(member, getMythicPointValues(member, 3)));
    api.sendMessage(`**Mythic deed complete:** ${members.map((member) => getCreatureName(member)).join(", ")} recover their Mythic Points.`);
  });
}

// Violating an anathema: all Mythic Points are lost
function loseMythicPoints() {
  getSelectedMythicCharacters().forEach((token) => {
    api.setValuesOnTokenById(token._id, token.recordType, { "data.heroPoints": 0 });
    api.sendMessage(`${getCreatureName(token)} violates an anathema and loses all Mythic Points.`, undefined, [], [], token);
  });
}
