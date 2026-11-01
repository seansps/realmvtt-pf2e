// Apply damage
// Ignore negative healing as that is what damage is for
// This script ignores tempHp, as it is not a factor in healing
// Healing from 0 Hit Points ends dying and unconscious (dying.js)
if (value > 0) {
  const oldHp = parseInt(record.data?.curhp || "0", 10) || 0;
  var curhp = oldHp + value;
  if (curhp < 0) {
    curhp = 0;
  }
  if (curhp > record.data?.hitpoints) {
    curhp = record.data?.hitpoints;
  }
  const { values, wake } = getHealingChanges(record, oldHp, curhp);
  api.setValuesOnRecord(record, { "data.curhp": curhp, ...values });
  // An eidolon and its summoner share the HP (eidolons.js)
  shareHitPoints(record, { "data.curhp": curhp });
  const healedToken = api.getToken();
  if (wake && healedToken) {
    wakeCreature(healedToken);
  }
}

// If healing > 0, float text
const token = api.getToken();
if (value > 0 && token) {
  api.floatText(token, `+${value}`, "#1bc91b");
}
