// Apply damage
// First deduct from Temp HP
let damage = value;
// Ignore negative damage as that is what healing is for
if (damage > 0) {
  const oldTempHp = parseInt(record.data?.tempHp || "0", 10);
  const newTempHp = Math.max(oldTempHp - damage, 0);
  damage = Math.max(damage - oldTempHp, 0);

  const valuesToSet = {};

  if (newTempHp !== oldTempHp) {
    valuesToSet["data.tempHp"] = newTempHp;
  }

  let curhp = parseInt(record?.data?.curhp || "0", 10);
  if (curhp === undefined || isNaN(curhp)) {
    curhp = 0;
  }
  curhp -= damage;
  let diesNow = false;
  if (curhp <= 0) {
    curhp = 0;
    if (record.recordType !== "npcs") {
      // Dying 1 plus wounded, or 1 more while dying, up to the dying value
      // the character dies at (dying.js)
      const threshold = getDeathThreshold(record);
      const raised = getDyingAfterDamage(record, false);
      valuesToSet["data.dying"] = threshold > 0 ? Math.min(raised, threshold) : raised;
      diesNow = threshold <= 0 || valuesToSet["data.dying"] >= threshold;
    }
  }
  if (curhp > record.data?.hitpoints) {
    curhp = record.data?.hitpoints;
  }

  valuesToSet["data.curhp"] = curhp;

  api.setValuesOnRecord(record, valuesToSet);
  // An eidolon and its summoner share the HP (eidolons.js)
  shareHitPoints(record, valuesToSet);

  // If damage > 0, float text
  const token = api.getToken();
  if (value > 0 && token) {
    if (curhp <= 0) {
      if (token.recordType === "npcs" || diesNow) {
        api.addEffect("Dead", token);
      } else if (!getTokenCondition(token, "unconscious")) {
        api.addEffects(["Unconscious", "Prone"], token);
      }
    }
    api.floatText(token, `-${value}`, "#FF0000");
  }
}
