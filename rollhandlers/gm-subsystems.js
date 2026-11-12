// Duels (GM Core pg. 202-203), leadership (GM Core pg. 204-205) and naval
// chase obstacles (High Seas pg. 37), on the GM Tools panel.

// ------------------------------------------------------------------ Duels

// A combat duel rolls initiative every round with Deception, Intimidation or
// Perception; trained in it, the duelist gets that round's dueling reaction.
// A spellcasting duel rolls Arcana, Nature, Occultism or Religion (once, or
// every round when mixed with a combat duel); trained, it sets the tradition
// focus and gives Dueling Counter and Change Tradition Focus.
const DUEL_SKILLS = {
  combat: { deception: "Deceptive Sidestep", intimidation: "Bullying Press", perception: "Sense Weakness" },
  spellcasting: { arcana: "arcane", nature: "primal", occultism: "occult", religion: "divine" },
};

function isTrainedForDuel(creature, skill) {
  if (skill === "perception") return true;
  if (creature?.recordType === "characters" || creature?.data?.[skill] !== undefined) {
    return (parseInt(creature?.data?.[skill] || "0", 10) || 0) >= 1;
  }
  return (creature?.data?.skills || []).some((row) => `${row?.name}`.toLowerCase() === skill);
}

function getDuelMetadata(creature, skill, kind) {
  const trained = isTrainedForDuel(creature, skill);
  const gained = DUEL_SKILLS[kind]?.[skill];
  return { duel: { kind, skill, trained, gained: gained || null } };
}

function rollDuelInitiative(token, skill, kind) {
  rollSkill(token, skill, null, false, 0, 1, "int", true, true, undefined, getDuelMetadata(token, skill, kind));
}

// One card per selected duelist, with a button per initiative skill
function postDuelInitiative(kind) {
  const tokens = (api.getSelectedTokens() || []).map((t) => t?.token || t).filter((token) => token?._id);
  if (tokens.length === 0) {
    api.showNotification("Select the duelists' tokens.", "yellow", "Duel");
    return;
  }
  const skills = Object.keys(DUEL_SKILLS[kind]);
  tokens.forEach((token) => {
    const buttons = skills.map((skill) =>
      getChatButton(`${capitalize(skill)}`, token, `rollDuelInitiative(token, ${JSON.stringify(skill)}, ${JSON.stringify(kind)})`),
    );
    const lead = kind === "combat"
      ? `**${getCreatureName(token)}: duel initiative** (this round). Neither duelist knows which the other picked.`
      : `**${getCreatureName(token)}: spellcasting duel initiative.**`;
    api.sendMessage(`${lead}\n${buttons.join("\n")}`, undefined, [], [], token);
  });
}

// The initiative card's line, for skill.js
function getDuelResultLines(metadata) {
  const duel = metadata?.duel;
  if (!duel) return [];
  if (!duel.trained) return [`**Duel:** not trained in ${capitalize(duel.skill)}, so no dueling reaction this round.`];
  if (duel.kind === "combat") return [`**Duel:** ${duel.gained} is this round's dueling reaction.`];
  return [`**Duel:** tradition focus ${duel.gained}, with Dueling Counter and Change Tradition Focus.`];
}

// ------------------------------------------------------------- Leadership

// Table 3-3: Organization Statistics by Level: [followers from, max follower
// level, lieutenants "from-to", lieutenant levels]
const ORGANIZATION_LEVELS = [
  [1, 0, "", ""], [3, 0, "", ""], [5, 0, "1", "1"], [7, 0, "1", "1"], [10, 0, "1", "1"],
  [14, 1, "2", "2"], [19, 1, "2", "2"], [28, 1, "3", "2-3"], [37, 1, "4-5", "2-3"], [54, 2, "6-7", "3-4"],
  [76, 2, "8-10", "3-4"], [100, 2, "11-15", "3-5"], [151, 2, "16-22", "3-5"], [216, 3, "23-30", "4-6"],
  [301, 3, "31-42", "4-6"], [426, 3, "43-60", "4-7"], [601, 3, "61-85", "4-7"], [851, 4, "86-120", "5-8"],
  [1201, 4, "121-170", "5-8"], [1701, 4, "171-240", "5-9"],
];

const LEADERSHIP_VARS = { followers: "leadershipFollowers", meter: "leadershipMeter" };

// The organization a number of followers makes: level 0 with none
function getOrganizationStats(followers) {
  const count = Math.max(0, parseInt(followers, 10) || 0);
  let level = 0;
  ORGANIZATION_LEVELS.forEach((row, index) => {
    if (count >= row[0]) level = index + 1;
  });
  if (level === 0) return { level: 0, followers: count };
  const [, maxFollower, lieutenants, lieutenantLevels] = ORGANIZATION_LEVELS[level - 1];
  const next = ORGANIZATION_LEVELS[level]?.[0];
  return { level, followers: count, maxFollower, lieutenants, lieutenantLevels, next };
}

function getLeadershipMeter(followers) {
  const stats = getOrganizationStats(followers);
  if (stats.level === 0) {
    return { label: "No organization yet", details: "Add followers as rewards to found one (level 1 at 1 follower)." };
  }
  return {
    label: `Organization level ${stats.level}`,
    details: `${stats.followers} followers (up to level ${stats.maxFollower})${
      stats.lieutenants ? `, ${stats.lieutenants} lieutenant${stats.lieutenants === "1" ? "" : "s"} of level ${stats.lieutenantLevels}` : ""
    }${stats.next ? `. Level ${stats.level + 1} at ${stats.next} followers.` : "."}`,
  };
}

function loadLeadershipMeter() {
  api.setCampaignVariable(LEADERSHIP_VARS.meter, getLeadershipMeter(api.getCampaignVariable?.(LEADERSHIP_VARS.followers)));
}

// Followers: a number, or +n / -n to add or take away
function setLeadershipFollowers() {
  api.showValuePrompt("Leadership", "Followers (a number, or +3 / -1 to change it)", (value) => {
    const text = `${value || ""}`.trim();
    if (!/^[+-]?\d+$/.test(text)) return;
    const current = parseInt(api.getCampaignVariable?.(LEADERSHIP_VARS.followers), 10) || 0;
    const followers = Math.max(0, /^[+-]/.test(text) ? current + parseInt(text, 10) : parseInt(text, 10));
    const before = getOrganizationStats(current).level;
    api.setCampaignVariable(LEADERSHIP_VARS.followers, followers);
    api.setCampaignVariable(LEADERSHIP_VARS.meter, getLeadershipMeter(followers));
    const after = getOrganizationStats(followers);
    if (after.level !== before) {
      api.sendMessage(`**The organization is now level ${after.level}** (${followers} followers). ${getLeadershipMeter(followers).details}`);
    }
  });
}

// A leadership event for the GM: opportunity, trouble or windfall
function rollLeadershipEvent() {
  const kinds = [
    ["Opportunity", "a consequential decision that shapes the organization"],
    ["Trouble", "something's gone wrong and needs the PCs"],
    ["Windfall", "an unexpected benefit, often access to something uncommon"],
  ];
  const roll = parseInt(api.rollInstant("1d3")?.total, 10) || 1;
  const [name, text] = kinds[roll - 1] || kinds[0];
  api.sendMessage(`[gm]**Leadership event:** ${name}, ${text} (GM Core pg. 205).[/gm]`);
}

// ------------------------------------------------------------ Naval chase

// High Seas pg. 37: obstacles for a naval chase, each with its level and the
// checks of the easier and harder version. Sailing Lore stands in for many
// shipboard tasks, and Nature for steering a wind-powered ship.
const NAVAL_CHASE_OBSTACLES = [
  ["Damaged Sail (1st)", "DC 13 Crafting, DC 15 Survival"],
  ["Damaged Steering (5th)", "DC 20 Crafting, DC 22 Survival"],
  ["Favorable Winds (1st)", "DC 13 Sailing Lore, DC 15 Athletics"],
  ["Powerful Tailwinds (4th)", "DC 18 Sailing Lore, DC 22 Athletics"],
  ["Squall (2nd)", "DC 14 Nature or Survival, DC 16 Sailing Lore"],
  ["Perfect Storm (8th)", "DC 22 Nature or Survival, DC 24 Sailing Lore"],
  ["Athamaru Outpost (3rd)", "DC 16 Diplomacy or Society, DC 18 Crafting"],
  ["Quatoid Colony (8th)", "DC 22 Diplomacy or Society, DC 24 Crafting"],
  ["Doldrums (3rd)", "DC 16 Medicine, DC 20 Arcana or Nature"],
  ["Magical Stagnation (7th)", "DC 21 Medicine, DC 25 Arcana or Nature"],
  ["Floating Debris (3rd)", "DC 16 Survival, DC 18 Sailing Lore"],
  ["Dangerous Rocks (6th)", "DC 20 Survival, DC 22 Sailing Lore"],
  ["Cannon on the Shore (4th)", "DC 17 Deception, DC 19 Intimidation"],
  ["Fort on the Shore (9th)", "DC 24 Deception, DC 26 Intimidation"],
  ["Lurking Sea Monster (6th)", "DC 20 Nature, DC 24 Stealth"],
  ["Lurking Kraken (12th)", "DC 28 Nature, DC 32 Stealth"],
];

// Obstacle rows to add to a chase challenge (the GM picks which, and sets
// each one's goal)
function getNavalChaseObstacleRows(names) {
  return NAVAL_CHASE_OBSTACLES.filter(([name]) => !names || names.includes(name)).map(([name, checks]) => ({
    _id: generateUuid(),
    name,
    data: { checks, goal: 0, points: 0 },
  }));
}

// The challenge sheet's button: pick obstacles, added to its list
function addNavalChaseObstacles(record) {
  api.showPrompt(
    "Naval Chase Obstacles",
    "Add",
    "Pick the obstacles",
    NAVAL_CHASE_OBSTACLES.map(([name, checks]) => ({ label: `${name}: ${checks}`, value: name })),
    null,
    (values) => {
      const names = (Array.isArray(values) ? values : [values]).filter(Boolean);
      const rows = getNavalChaseObstacleRows(names);
      if (!rows.length) return;
      api.setValues({ "data.obstacles": [...(record?.data?.obstacles || []), ...rows] });
    },
  );
}
