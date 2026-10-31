const initiativeSkill = data.roll?.metadata?.initiativeSkill || "Perception";
// An adversary that ties a PC goes first (gm-tools.js)
const adversaries = data.roll?.metadata?.initiativeAdversaries || [];
const initiativeFor = (isAdversary) =>
  getInitiativeValue(data.roll.total, { faction: isAdversary ? "enemy" : "party" });
if (data.roll?.metadata?.group && data.roll?.metadata?.group.length > 0) {
  const rolled = {};
  data.roll?.metadata?.group.forEach((tokenId) => {
    rolled[tokenId] = initiativeFor(adversaries.includes(tokenId));
    // The statistic rolled, for self:participant:initiative:stat:<statistic>
    api.setValuesOnTokenById(tokenId, "tokens", {
      "data.initiative": rolled[tokenId],
      "data.initiativeStatistic": initiativeSkill.toLowerCase(),
    });
  });
  // Their minions act just after them (summons.js)
  placeMinionsOf(rolled);
  api.sendMessage(
    "",
    data.roll,
    [],
    [
      {
        name: `Group Initiative (${initiativeSkill})`,
        tooltip: `Group Initiative Roll with ${initiativeSkill}`,
      },
    ]
  );
} else {
  // The statistic rolled, for self:participant:initiative:stat:<statistic>
  const initiative = initiativeFor(!!data.roll?.metadata?.initiativeAdversary);
  api.setValues({
    "data.initiative": initiative,
    "data.initiativeStatistic": initiativeSkill.toLowerCase(),
  });
  // Its minions act just after it (summons.js)
  const roller = api.getToken();
  if (roller?._id) placeMinionsOf({ [roller._id]: initiative });
  api.sendMessage(
    "",
    data.roll,
    [],
    [
      {
        name: `Initiative (${initiativeSkill})`,
        tooltip: `Initiative Roll with ${initiativeSkill}`,
      },
    ]
  );
}
