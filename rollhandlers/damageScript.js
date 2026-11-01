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
  // A linked eidolon's 0 HP is its summoner's (eidolons.js)
  const linkedEidolon = !!getEidolonSummonerId(record);
  if (curhp <= 0) {
    curhp = 0;
    if (record.recordType !== "npcs" && !linkedEidolon) {
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
    if (curhp <= 0 && linkedEidolon) {
      // Its summoner gains dying, and it unmanifests (eidolons.js)
      api.sendMessage(applyEidolonZeroHitPoints(token).lines.join("\n"), undefined, [], [], token);
    } else if (curhp <= 0) {
      const unmanifest = getEidolonUnmanifestLine(record);
      if (unmanifest) api.sendMessage(unmanifest, undefined, [], [], token);
      if (token.recordType === "npcs" || diesNow) {
        api.addEffect("Dead", token);
      } else if (!getTokenCondition(token, "unconscious")) {
        api.addEffects(["Unconscious", "Prone"], token);
      }
    }
    api.floatText(token, `-${value}`, "#FF0000");
  }
}
