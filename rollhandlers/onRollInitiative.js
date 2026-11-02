const token = data?.token;
const tokenName = token.name || token.record?.name;

const initiativeSkill = getInitiativeSkill(token);

rollSkill(
  token,
  initiativeSkill.toLowerCase(),
  null,
  false,
  0,
  1,
  "int",
  true,
  true,
  undefined,
  {
    initiativeSkill: initiativeSkill,
    // Who rolled, for the tie rule (initiative.js)
    initiativeAdversary: isInitiativeAdversary(token),
    // Scout's +1 circumstance bonus for its side (exploration.js)
    extraModifiers: getScoutInitiativeModifiers(token, getOtherSceneTokens()),
  }
);
