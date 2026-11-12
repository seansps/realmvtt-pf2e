// Variant: Skill Points (Gamemastery Guide pg. 199, a campaign setting).
// Initial proficiencies are as usual; from 2nd level, skill increases are
// replaced by Skill Points (Table 4-19, double for rogues), spent to raise a
// skill a rank at Table 4-20's cost and minimum level, and saved between
// levels. Spent points are kept in data.skillPointsSpent, earned ones come
// from the level, and the Skills tab shows both. Retraining (a week of
// downtime) lowers a rank and gives its cost back; it's the GM's to allow.

// Table 4-20: the rank a step reaches, its minimum level and its cost
const SKILL_POINT_STEPS = { 1: { level: 1, cost: 1 }, 2: { level: 3, cost: 2 }, 3: { level: 7, cost: 4 }, 4: { level: 15, cost: 8 } };
const SKILL_RANK_NAMES = ["Untrained", "Trained", "Expert", "Master", "Legendary"];

function isSkillPointsOn(record) {
  return !!getVariantRules().skillPoints && record?.recordType === "characters";
}

function isRogueCharacter(record) {
  return (record?.data?.classes || []).some((entry) => /^rogue\b/i.test(entry?.name || ""));
}

// Table 4-19: points gained on reaching a level
function getSkillPointsForLevel(level, rogue = false) {
  const value = level >= 14 ? 4 : level >= 6 ? 2 : level >= 2 ? 1 : 0;
  return rogue ? value * 2 : value;
}

function getSkillPointsEarned(record) {
  const level = Math.min(20, parseInt(record?.data?.level || "0", 10) || 0);
  const rogue = isRogueCharacter(record);
  let total = 0;
  for (let at = 2; at <= level; at += 1) total += getSkillPointsForLevel(at, rogue);
  return total;
}

function getSkillPointsAvailable(record) {
  return getSkillPointsEarned(record) - (parseInt(record?.data?.skillPointsSpent || "0", 10) || 0);
}

// Skills that can go up a rank now, with what it costs
function getSkillPointOptions(record) {
  const level = parseInt(record?.data?.level || "0", 10) || 0;
  const available = getSkillPointsAvailable(record);
  return Object.keys(getPathfinderSkills())
    .map((skill) => {
      const rank = parseInt(record?.data?.[skill] || "0", 10) || 0;
      const step = SKILL_POINT_STEPS[rank + 1];
      if (!step || step.level > level || step.cost > available) return null;
      return { label: `${capitalize(skill)}: ${SKILL_RANK_NAMES[rank + 1]} (${step.cost} point${step.cost === 1 ? "" : "s"})`, value: skill };
    })
    .filter(Boolean);
}

function getSkillPointSpendValues(record, skill) {
  const rank = parseInt(record?.data?.[skill] || "0", 10) || 0;
  const step = SKILL_POINT_STEPS[rank + 1];
  if (!step) return null;
  return {
    [`data.${skill}`]: `${rank + 1}`,
    "data.skillPointsSpent": (parseInt(record?.data?.skillPointsSpent || "0", 10) || 0) + step.cost,
  };
}

function getSkillPointRetrainValues(record, skill) {
  const rank = parseInt(record?.data?.[skill] || "0", 10) || 0;
  const step = SKILL_POINT_STEPS[rank];
  if (!step) return null;
  return {
    [`data.${skill}`]: `${rank - 1}`,
    "data.skillPointsSpent": Math.max(0, (parseInt(record?.data?.skillPointsSpent || "0", 10) || 0) - step.cost),
  };
}

// The Skills tab's section and its line, each written only on a change
function getSkillPointFieldValues(record, variants = getVariantRules()) {
  const values = {};
  const show = !!variants.skillPoints;
  const hidden = record?.fields?.skillPointsBox?.hidden ?? true;
  if (hidden !== !show) values["fields.skillPointsBox.hidden"] = !show;
  if (show) {
    const spent = parseInt(record?.data?.skillPointsSpent || "0", 10) || 0;
    const label = `${getSkillPointsAvailable(record)} Skill Points to spend (${getSkillPointsEarned(record)} earned, ${spent} spent)`;
    if (record?.data?.skillPointsLabel !== label) values["data.skillPointsLabel"] = label;
  }
  return values;
}

function spendSkillPoints(record) {
  const options = getSkillPointOptions(record);
  if (!options.length) {
    api.showNotification("No skill can go up a rank with the points and level this character has.", "yellow", "Skill Points");
    return;
  }
  api.showPrompt("Skill Points", "Raise which skill?", "Select...", options, null, (choice) => {
    const values = getSkillPointSpendValues(record, pick(choice));
    if (values) api.setValues(values, (updatedRecord) => onAddEditFeature(updatedRecord));
  });
}

function retrainSkillPoint(record) {
  const options = Object.keys(getPathfinderSkills())
    .filter((skill) => (parseInt(record?.data?.[skill] || "0", 10) || 0) >= 1)
    .map((skill) => {
      const rank = parseInt(record.data[skill], 10);
      return { label: `${capitalize(skill)}: back to ${SKILL_RANK_NAMES[rank - 1]} (${SKILL_POINT_STEPS[rank].cost} back)`, value: skill };
    });
  if (!options.length) return;
  api.showPrompt("Retrain Skill Points", "A week of downtime lowers one rank (only ranks bought with points)", "Select...", options, null, (choice) => {
    const values = getSkillPointRetrainValues(record, pick(choice));
    if (values) api.setValues(values, (updatedRecord) => onAddEditFeature(updatedRecord));
  });
}
