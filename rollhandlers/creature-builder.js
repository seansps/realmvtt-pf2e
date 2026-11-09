// Creature builder (roadmap B17, GM Core pg. 112 onward): the per-level benchmark
// tables, a Rescale that moves a token's numbers to another level at the same
// tier, a Build from a road map, and a Reset back to its NPC record. It writes
// to the token only, so the NPC record is the original and nothing is stored.

// Levels -1 to 24; each column has one entry per level, in that order.
const CREATURE_MIN_LEVEL = -1;
const CREATURE_MAX_LEVEL = 24;
const CREATURE_TIER_ORDER = ["extreme", "high", "moderate", "low", "terrible"];
const CREATURE_ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];

// GM Core Tables 2-1 to 2-12, without 2-4 (safe items)
const CREATURE_TABLES = {
  attribute: {
    extreme: [null,null,5,5,5,6,6,7,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,11,11,13],
    high: [3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,10,10,12],
    moderate: [2,2,3,3,3,3,4,4,4,4,4,5,5,5,5,5,6,6,6,6,6,7,7,8,8,9],
    low: [0,0,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,7],
  },
  perception: {
    extreme: [9,10,11,12,14,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,43,44,46],
    high: [8,9,10,11,12,14,15,17,18,19,21,22,24,25,26,28,29,30,32,33,35,36,38,39,40,42],
    moderate: [5,6,7,8,9,11,12,14,15,16,18,19,21,22,23,25,26,28,29,30,32,33,35,36,37,38],
    low: [2,3,4,5,6,8,9,11,12,13,15,16,18,19,20,22,23,25,26,27,29,30,32,33,34,36],
    terrible: [0,1,2,3,4,6,7,8,10,11,12,14,15,16,18,19,20,22,23,24,26,27,28,30,31,32],
  },
  skill: {
    extreme: [8,9,10,11,13,15,16,18,20,21,23,25,26,28,30,31,33,35,36,38,40,41,43,45,46,48],
    high: [5,6,7,8,10,12,13,15,17,18,20,22,23,25,27,28,30,32,33,35,37,38,40,42,43,45],
    moderate: [4,5,6,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,38,40],
    low: [2,3,4,5,7,8,10,11,13,14,16,17,19,20,22,23,25,26,28,29,31,32,34,35,36,38],
  },
  ac: {
    extreme: [18,19,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48,49,51,52,54],
    high: [15,16,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48,49,51],
    moderate: [14,15,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,42,44,45,47,48,50],
    low: [12,13,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48],
  },
  save: {
    extreme: [9,10,11,12,14,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,43,44,46],
    high: [8,9,10,11,12,14,15,17,18,19,21,22,24,25,26,28,29,30,32,33,35,36,38,39,40,42],
    moderate: [5,6,7,8,9,11,12,14,15,16,18,19,21,22,23,25,26,28,29,30,32,33,35,36,37,38],
    low: [2,3,4,5,6,8,9,11,12,13,15,16,18,19,20,22,23,25,26,27,29,30,32,33,34,36],
    terrible: [0,1,2,3,4,6,7,8,10,11,12,14,15,16,18,19,20,22,23,24,26,27,28,30,31,32],
  },
  hp: {
    high: [[9,9],[20,17],[26,24],[40,36],[59,53],[78,72],[97,91],[123,115],[148,140],[173,165],[198,190],[223,215],[248,240],[273,265],[298,290],[323,315],[348,340],[373,365],[398,390],[423,415],[448,440],[473,465],[505,495],[544,532],[581,569],[633,617]],
    moderate: [[8,7],[16,14],[21,19],[32,28],[48,42],[63,57],[78,72],[99,91],[119,111],[139,131],[159,151],[179,171],[199,191],[219,211],[239,231],[259,251],[279,271],[299,291],[319,311],[339,331],[359,351],[379,371],[405,395],[436,424],[466,454],[508,492]],
    low: [[6,5],[13,11],[16,14],[25,21],[37,31],[48,42],[59,53],[75,67],[90,82],[105,97],[120,112],[135,127],[150,142],[165,157],[180,172],[195,187],[210,202],[225,217],[240,232],[255,247],[270,262],[285,277],[305,295],[329,317],[351,339],[383,367]],
  },
  resistance: {
    high: [1,3,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,19,20,21,22,23,24,25,26],
    low: [1,1,2,2,3,4,4,5,5,6,6,7,7,8,8,9,9,9,10,10,11,11,12,12,13,13],
  },
  strike: {
    extreme: [10,10,11,13,14,16,17,19,20,22,23,25,27,28,29,31,32,34,35,37,38,40,41,43,44,46],
    high: [8,8,9,11,12,14,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,42,44],
    moderate: [6,6,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42],
    low: [4,4,5,7,8,9,11,12,13,15,16,17,19,20,21,23,24,25,27,28,29,31,32,33,35,36],
  },
  damage: {
    extreme: ["1d6+1 (4)","1d6+3 (6)","1d8+4 (8)","1d12+4 (11)","1d12+8 (15)","2d10+7 (18)","2d12+7 (20)","2d12+10 (23)","2d12+12 (25)","2d12+15 (28)","2d12+17 (30)","2d12+20 (33)","2d12+22 (35)","3d12+19 (38)","3d12+21 (40)","3d12+24 (43)","3d12+26 (45)","3d12+29 (48)","3d12+31 (50)","3d12+34 (53)","4d12+29 (55)","4d12+32 (58)","4d12+34 (60)","4d12+37 (63)","4d12+39 (65)","4d12+42 (68)"],
    high: ["1d4+1 (3)","1d6+2 (5)","1d6+3 (6)","1d10+4 (9)","1d10+6 (12)","2d8+5 (14)","2d8+7 (16)","2d8+9 (18)","2d10+9 (20)","2d10+11 (22)","2d10+13 (24)","2d12+13 (26)","2d12+15 (28)","3d10+14 (30)","3d10+16 (32)","3d10+18 (34)","3d12+17 (36)","3d12+18 (37)","3d12+19 (38)","3d12+20 (40)","4d10+20 (42)","4d10+22 (44)","4d10+24 (46)","4d10+26 (48)","4d12+24 (50)","4d12+26 (52)"],
    moderate: ["1d4 (3)","1d4+2 (4)","1d6+2 (5)","1d8+4 (8)","1d8+6 (10)","2d6+5 (12)","2d6+6 (13)","2d6+8 (15)","2d8+8 (17)","2d8+9 (18)","2d8+11 (20)","2d10+11 (22)","2d10+12 (23)","3d8+12 (25)","3d8+14 (27)","3d8+15 (28)","3d10+14 (30)","3d10+15 (31)","3d10+16 (32)","3d10+17 (33)","4d8+17 (35)","4d8+19 (37)","4d8+20 (38)","4d8+22 (40)","4d10+20 (42)","4d10+22 (44)"],
    low: ["1d4 (2)","1d4+1 (3)","1d4+2 (4)","1d6+3 (6)","1d6+5 (8)","2d4+4 (9)","2d4+6 (11)","2d4+7 (12)","2d6+6 (13)","2d6+8 (15)","2d6+9 (16)","2d6+10 (17)","2d8+10 (19)","3d6+10 (20)","3d6+11 (21)","3d6+13 (23)","3d6+14 (24)","3d6+15 (25)","3d6+16 (26)","3d6+17 (27)","4d6+14 (28)","4d6+15 (29)","4d6+17 (31)","4d6+18 (32)","4d6+19 (33)","4d6+21 (35)"],
  },
  spellDc: {
    extreme: [19,19,20,22,23,25,26,27,29,30,32,33,34,36,37,39,40,41,43,44,46,47,48,50,51,52],
    high: [16,16,17,18,20,21,22,24,25,26,28,29,30,32,33,34,36,37,38,40,41,42,44,45,46,48],
    moderate: [13,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31,33,34,35,37,38,39,41,42,43,45],
  },
  spellAttack: {
    extreme: [11,11,12,14,15,17,18,19,21,22,24,25,26,28,29,31,32,33,35,36,38,39,40,42,43,44],
    high: [8,8,9,10,12,13,14,16,17,18,20,21,22,24,25,26,28,29,30,32,33,34,36,37,38,40],
    moderate: [5,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23,25,26,27,29,30,31,33,34,35,37],
  },
  area: {
    unlimited: ["1d4 (2)","1d6 (4)","2d4 (5)","2d6 (7)","2d8 (9)","3d6 (11)","2d10 (12)","4d6 (14)","4d6 (15)","5d6 (17)","5d6 (18)","6d6 (20)","6d6 (21)","5d8 (23)","7d6 (24)","4d12 (26)","6d8 (27)","8d6 (28)","8d6 (29)","9d6 (30)","7d8 (32)","6d10 (33)","10d6 (35)","8d8 (36)","11d6 (38)","11d6 (39)"],
    limited: ["1d6 (4)","1d10 (6)","2d6 (7)","3d6 (11)","4d6 (14)","5d6 (18)","6d6 (21)","7d6 (25)","8d6 (28)","9d6 (32)","10d6 (35)","11d6 (39)","12d6 (42)","13d6 (46)","14d6 (49)","15d6 (53)","16d6 (56)","17d6 (60)","18d6 (63)","19d6 (67)","20d6 (70)","21d6 (74)","22d6 (77)","23d6 (81)","24d6 (84)","25d6 (88)"],
  },
};

const CREATURE_STAT_LABELS = {
  perception: "Perception",
  ac: "AC",
  fort: "Fortitude",
  ref: "Reflex",
  will: "Will",
  hp: "HP",
  strike: "Strike attack",
  damage: "Strike damage",
  spell: "Spell DC",
};

// The table each buildable statistic reads
const CREATURE_STAT_TABLES = {
  perception: "perception",
  ac: "ac",
  fort: "save",
  ref: "save",
  will: "save",
  hp: "hp",
  strike: "strike",
  damage: "damage",
  spell: "spellDc",
};

// The base road maps (GM Core, Building Creatures). Where the book gives a choice, this
// is the first one; anything not listed is moderate.
const CREATURE_ROAD_MAPS = {
  Brute: { perception: "low", str: "high", con: "high", dex: "low", int: "low", wis: "low", cha: "low", fort: "high", ref: "low", hp: "high", strike: "high", damage: "high" },
  "Magical Striker": { strike: "high", damage: "high" },
  "Skill Paragon": { ref: "high", fort: "low", skill: "high" },
  Skirmisher: { dex: "high", fort: "low", ref: "high" },
  Sniper: { perception: "high", dex: "high", fort: "low", ref: "high", strike: "high", damage: "high" },
  Soldier: { str: "high", ac: "high", fort: "high", strike: "high", damage: "high" },
  Spellcaster: { fort: "low", will: "high", hp: "low", strike: "low", spell: "high" },
  "All Moderate": {},
};

// ------------------------------------------------------------- The tables

const getCreatureDamageAverage = (entry) => parseInt(`${entry}`.match(/\((\d+)\)/)?.[1], 10);

// A column's number at a level, or null where the book has none. HP is a
// range, so its number is the middle of it; damage is its average.
function getCreatureTableValue(table, level, tier) {
  const entry = CREATURE_TABLES[table]?.[tier]?.[level - CREATURE_MIN_LEVEL];
  if (entry === null || entry === undefined) return null;
  if (Array.isArray(entry)) return Math.round((entry[0] + entry[1]) / 2);
  return typeof entry === "string" ? getCreatureDamageAverage(entry) : entry;
}

// The column a value sits closest to at a level; a tie goes to the higher one
function getCreatureTier(table, level, value) {
  let best = null;
  CREATURE_TIER_ORDER.forEach((tier) => {
    const base = getCreatureTableValue(table, level, tier);
    if (base === null) return;
    if (!best || Math.abs(value - base) < Math.abs(value - best.base)) best = { tier, base };
  });
  return best;
}

// The same column at the new level, or the closest lower one that exists
function getCreatureColumnValue(table, level, tier) {
  const tiers = CREATURE_TIER_ORDER.slice(CREATURE_TIER_ORDER.indexOf(tier));
  for (const candidate of tiers) {
    const value = getCreatureTableValue(table, level, candidate);
    if (value !== null) return value;
  }
  return null;
}

// A value moved to another level: the same column, the same distance from it.
// HP keeps its proportion instead, since a distance means little at 20th.
function rescaleCreatureValue(table, value, from, to) {
  const number = parseInt(value, 10);
  if (!Number.isFinite(number)) return value;
  const match = getCreatureTier(table, from, number);
  if (!match) return number;
  const target = getCreatureColumnValue(table, to, match.tier);
  if (target === null) return number;
  return table === "hp" && match.base > 0
    ? Math.max(1, Math.round((target * number) / match.base))
    : target + (number - match.base);
}

const parseCreatureDamage = (formula) => {
  const match = `${formula ?? ""}`.trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/);
  if (!match) return null;
  return { count: parseInt(match[1], 10), die: parseInt(match[2], 10), bonus: match[4] ? parseInt(`${match[3]}${match[4]}`, 10) : 0 };
};

const formatCreatureDamage = (count, die, bonus) => `${count}d${die}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ""}`;

// A Strike's first damage at another level: the table's number of dice, the
// creature's own die, and a bonus that reaches the same place in the column
function rescaleCreatureDamage(formula, from, to) {
  const parsed = parseCreatureDamage(formula);
  if (!parsed || from === to) return formula;
  const dieAverage = (parsed.die + 1) / 2;
  const average = parsed.count * dieAverage + parsed.bonus;
  const match = getCreatureTier("damage", from, average);
  if (!match) return formula;
  const row = CREATURE_TABLES.damage[match.tier][to - CREATURE_MIN_LEVEL];
  const target = getCreatureDamageAverage(row) + (average - match.base);
  let count = parseInt(row, 10);
  let bonus = Math.round(target - count * dieAverage);
  while (bonus < 0 && count > 1) {
    count -= 1;
    bonus = Math.round(target - count * dieAverage);
  }
  return formatCreatureDamage(count, parsed.die, Math.max(bonus, 0));
}

// Dice that aren't a Strike's first damage grow in proportion
function scaleCreatureDice(formula, factor) {
  const parsed = parseCreatureDamage(formula);
  if (!parsed || !Number.isFinite(factor)) return formula;
  return formatCreatureDamage(Math.max(1, Math.round(parsed.count * factor)), parsed.die, Math.round(parsed.bonus * factor));
}

// How much an ability's damage grows between levels, by the area damage
// column it's closest to (GM Core Table 2-12)
function getCreatureAreaFactor(formula, from, to) {
  const parsed = parseCreatureDamage(formula);
  if (!parsed) return 1;
  const average = parsed.count * ((parsed.die + 1) / 2) + parsed.bonus;
  const column = (tier, level) => getCreatureDamageAverage(CREATURE_TABLES.area[tier][level - CREATURE_MIN_LEVEL]);
  const tier = Math.abs(average - column("limited", from)) <= Math.abs(average - column("unlimited", from)) ? "limited" : "unlimited";
  return column(tier, to) / column(tier, from);
}

// An ability's description at another level. Only its save and damage
// buttons change, so a flat check's DC stays what it is. Numbers in plain
// text are the GM's to change (getCreatureHandChecks lists those abilities).
function rescaleCreatureDescription(description, from, to) {
  return `${description ?? ""}`.replace(/<record-link\b[^>]*>[\s\S]*?<\/record-link>/g, (link) => {
    const save = link.match(/rollSavingThrow\((?:'|&#39;)(\w+)(?:'|&#39;),\s*(\d+)/);
    if (save) {
      const dc = parseInt(save[2], 10);
      const newDc = rescaleCreatureValue("spellDc", dc, from, to);
      return link
        .replace(new RegExp(`(rollSavingThrow\\((?:'|&#39;)${save[1]}(?:'|&#39;),\\s*)${dc}\\b`), `$1${newDc}`)
        .replace(new RegExp(`DC ${dc}\\b`, "g"), `DC ${newDc}`);
    }
    const damage = link.match(/executeDamageMacro\((?:'|&#39;)(\d+d\d+(?:\s*[+-]\s*\d+)?)/);
    if (damage) {
      const formula = damage[1].replace(/\s+/g, "");
      const scaled = scaleCreatureDice(formula, getCreatureAreaFactor(formula, from, to));
      const spaced = (text) => text.replace(/([+-])/, " $1 ");
      return link.split(formula).join(scaled).split(spaced(formula)).join(spaced(scaled));
    }
    return link;
  });
}

// ------------------------------------------------------------- The writes

const getCreatureNumber = (value) => parseInt(value, 10) || 0;
const getSignedNumber = (value) => (value >= 0 ? `+${value}` : `${value}`);

// A Strike's labels for its bonus and damage rolls, as the NPC sheet sets them
function getCreatureStrikeFields(attack, bonus, damageRolls) {
  const agile = (attack.data?.traits || []).some((trait) => `${trait}`.toLowerCase() === "agile");
  const first = agile ? 4 : 5;
  const second = agile ? 8 : 10;
  const damage = damageRolls
    .map((roll) => (roll.data?.type ? `${roll.data?.formula || "0"} ${roll.data.type}` : roll.data?.formula || "0"))
    .join(" + ");
  return {
    bonus,
    strike1: `Strike ${getSignedNumber(bonus)}`,
    strike2: `${getSignedNumber(bonus - first)} (MAP -${first})`,
    strike3: `${getSignedNumber(bonus - second)} (MAP -${second})`,
    ...(damage
      ? { damage, damageTooltip: `Roll ${damage} damage`, criticalTooltip: `Roll 2 * (${damage}) damage` }
      : {}),
  };
}

function setCreatureAttack(values, attack, index, bonus, damageRolls) {
  const fields = getCreatureStrikeFields(attack, bonus, damageRolls);
  Object.entries(fields).forEach(([field, value]) => {
    values[`data.attacks.${index}.data.${field}`] = value;
  });
  damageRolls.forEach((roll, rollIndex) => {
    values[`data.attacks.${index}.data.damageRolls.${rollIndex}.data.formula`] = roll.data?.formula;
  });
}

function setCreatureSkill(values, skill, index, mod) {
  values[`data.skills.${index}.data.mod`] = mod;
  values[`data.skills.${index}.data.skillWithMod`] = `${skill.name} ${getSignedNumber(mod)}`;
}

// Max HP changes, and damage already taken stays taken (as Elite and Weak do)
function setCreatureHp(values, data, newMax) {
  const oldMax = getCreatureNumber(data.hitpoints);
  const current = data.curhp === undefined || data.curhp === null || data.curhp === "" ? oldMax : getCreatureNumber(data.curhp);
  values["data.hitpoints"] = newMax;
  values["data.curhp"] = Math.min(newMax, Math.max(0, current - oldMax + newMax));
}

// Initiative follows the Perception or skill it's rolled with
function getCreatureInitiative(data, values) {
  const skill = `${data.initiativeSkill || ""}`.toLowerCase();
  if (!skill) return null;
  if (skill === "perception") return values["data.perceptionMod"] ?? null;
  const index = (data.skills || []).findIndex((row) => `${row.name}`.toLowerCase() === skill);
  return index < 0 ? null : values[`data.skills.${index}.data.mod`] ?? null;
}

function setCreatureInitiative(values, data) {
  const initiative = getCreatureInitiative(data, values);
  if (initiative !== null) values["data.initiativeMod"] = initiative;
}

function setCreatureResistanceRows(values, data, field, from, to) {
  const rows = data[field] || [];
  let label = data[`${field}Label`];
  rows.forEach((row, index) => {
    const old = row.data?.value;
    if (old === undefined || old === null || old === "") return;
    const value = Math.max(1, rescaleCreatureValue("resistance", old, from, to));
    values[`data.${field}.${index}.data.value`] = value;
    if (label) label = label.replace(`${row.data?.type} ${old}`, `${row.data?.type} ${value}`);
  });
  if (label !== undefined && rows.length) values[`data.${field}Label`] = label;
}

// Every value a Rescale writes to the token (one write)
function getCreatureRescaleValues(token, to) {
  const data = token.data || {};
  const from = getCreatureNumber(data.level);
  const values = { "data.level": to };
  const move = (field, table) => {
    if (data[field] === undefined || data[field] === null || data[field] === "") return;
    values[`data.${field}`] = rescaleCreatureValue(table, data[field], from, to);
  };
  move("ac", "ac");
  move("fortitudeMod", "save");
  move("reflexMod", "save");
  move("willMod", "save");
  move("perceptionMod", "perception");
  CREATURE_ATTRIBUTES.forEach((attribute) => move(attribute, "attribute"));
  setCreatureHp(values, data, rescaleCreatureValue("hp", getCreatureNumber(data.hitpoints), from, to));
  (data.skills || []).forEach((skill, index) => {
    setCreatureSkill(values, skill, index, rescaleCreatureValue("skill", getCreatureNumber(skill.data?.mod), from, to));
  });
  setCreatureInitiative(values, data);
  (data.attacks || []).forEach((attack, index) => {
    const rolls = (attack.data?.damageRolls || []).map((roll, rollIndex) => ({
      ...roll,
      data: {
        ...roll.data,
        formula:
          rollIndex === 0
            ? rescaleCreatureDamage(roll.data?.formula, from, to)
            : scaleCreatureDice(roll.data?.formula, getCreatureTableValue("damage", to, "moderate") / getCreatureTableValue("damage", from, "moderate")),
      },
    }));
    setCreatureAttack(values, attack, index, rescaleCreatureValue("strike", getCreatureNumber(attack.data?.bonus), from, to), rolls);
  });
  (data.spells || []).forEach((entry, index) => {
    if (getCreatureNumber(entry.data?.dc)) values[`data.spells.${index}.data.dc`] = rescaleCreatureValue("spellDc", entry.data.dc, from, to);
    if (getCreatureNumber(entry.data?.mod)) values[`data.spells.${index}.data.mod`] = rescaleCreatureValue("spellAttack", entry.data.mod, from, to);
  });
  ["weaknesses", "resistances"].forEach((field) => setCreatureResistanceRows(values, data, field, from, to));
  (data.actions || []).forEach((action, index) => {
    const description = action.data?.description;
    if (!description) return;
    const rescaled = rescaleCreatureDescription(description, from, to);
    if (rescaled !== description) values[`data.actions.${index}.data.description`] = rescaled;
  });
  return values;
}

// A Strike row for a creature that has none
function getCreatureNewStrike(bonus, formula, ranged) {
  const damageRolls = [{ _id: generateUuid(), name: "Damage", recordType: "damageRolls", identified: true, data: { formula, type: "bludgeoning", category: "" } }];
  const attack = { _id: generateUuid(), name: "Strike", unidentifiedName: "Attack", recordType: "npc_attacks", identified: true, data: { weaponType: ranged ? "Ranged" : "Melee", traits: [], attackEffects: [], attackEffectsLabel: "", damageRolls, critical: "Critical" } };
  attack.data = { ...attack.data, ...getCreatureStrikeFields(attack, bonus, damageRolls) };
  return attack;
}

// Every value a Build writes to the token, from a map of tiers (one write).
// It sets the numbers; the creature's abilities and spells are the GM's.
function getCreatureBuildValues(token, level, tiers, ranged = false) {
  const data = token.data || {};
  const tierFor = (stat) => tiers[stat] || "moderate";
  const read = (stat) => getCreatureColumnValue(CREATURE_STAT_TABLES[stat], level, tierFor(stat));
  const values = {
    "data.level": level,
    "data.ac": read("ac"),
    "data.fortitudeMod": read("fort"),
    "data.reflexMod": read("ref"),
    "data.willMod": read("will"),
    "data.perceptionMod": read("perception"),
  };
  CREATURE_ATTRIBUTES.forEach((attribute) => {
    values[`data.${attribute}`] = getCreatureColumnValue("attribute", level, tierFor(attribute));
  });
  setCreatureHp(values, data, read("hp"));
  (data.skills || []).forEach((skill, index) => {
    setCreatureSkill(values, skill, index, getCreatureColumnValue("skill", level, tierFor("skill")));
  });
  setCreatureInitiative(values, data);
  const bonus = read("strike");
  const entry = CREATURE_TABLES.damage[tierFor("damage")][level - CREATURE_MIN_LEVEL];
  const formula = `${entry}`.replace(/\s*\(\d+\)$/, "");
  (data.attacks || []).forEach((attack, index) => {
    const rolls = attack.data?.damageRolls || [];
    const damageRolls = rolls.length ? rolls.map((roll, rollIndex) => (rollIndex === 0 ? { ...roll, data: { ...roll.data, formula } } : roll)) : [];
    setCreatureAttack(values, attack, index, bonus, damageRolls);
  });
  if (!(data.attacks || []).length) values["data.attacks"] = [getCreatureNewStrike(bonus, formula, ranged)];
  (data.spells || []).forEach((spellEntry, index) => {
    const tier = tiers.spell === "high" || tiers.spell === "extreme" ? tiers.spell : "moderate";
    values[`data.spells.${index}.data.dc`] = getCreatureColumnValue("spellDc", level, tier);
    values[`data.spells.${index}.data.mod`] = getCreatureColumnValue("spellAttack", level, tier);
  });
  return values;
}

// The values that return a token to its NPC record's numbers. Damage taken
// stays. Skills, Strikes and resistances come back whole; abilities and
// spells only in what a Rescale changed, so limited uses and slots are kept.
function getCreatureResetValues(token, source) {
  const data = token.data || {};
  const original = source.data || {};
  const values = {};
  ["level", "ac", "fortitudeMod", "reflexMod", "willMod", "perceptionMod", "initiativeMod", ...CREATURE_ATTRIBUTES, "weaknessesLabel", "resistancesLabel"].forEach((field) => {
    if (original[field] !== undefined) values[`data.${field}`] = original[field];
  });
  setCreatureHp(values, data, getCreatureNumber(original.hitpoints));
  ["skills", "attacks", "weaknesses", "resistances"].forEach((field) => {
    if (original[field] || data[field]) values[`data.${field}`] = JSON.parse(JSON.stringify(original[field] || []));
  });
  const findRow = (rows, row) => (rows || []).find((candidate) => candidate._id === row._id);
  (data.spells || []).forEach((entry, index) => {
    const match = findRow(original.spells, entry);
    if (!match) return;
    if (match.data?.dc !== undefined) values[`data.spells.${index}.data.dc`] = match.data.dc;
    if (match.data?.mod !== undefined) values[`data.spells.${index}.data.mod`] = match.data.mod;
  });
  (data.actions || []).forEach((action, index) => {
    const match = findRow(original.actions, action);
    if (match && match.data?.description !== action.data?.description) values[`data.actions.${index}.data.description`] = match.data?.description ?? "";
  });
  return values;
}

// Abilities whose text carries a number a Rescale can't safely change
function getCreatureHandChecks(token) {
  const stripLinks = (text) => `${text ?? ""}`.replace(/<record-link\b[^>]*>[\s\S]*?<\/record-link>/g, " ");
  return (token.data?.actions || [])
    .filter((action) => /\bDC \d+|\b\d+d\d+|\b(?:Rupture|Regeneration|Fast Healing) \d+/i.test(`${action.name} ${stripLinks(action.data?.description)}`))
    .map((action) => action.name);
}

// ---------------------------------------------------------------- The GM

const getCreatureGmLines = (lines) => lines.map((line) => `[gm]${line}[/gm]`).join("\n");

function getCreatureRescaleMessage(token, from, to, values) {
  const data = token.data || {};
  const name = getCreatureName(token);
  const checks = getCreatureHandChecks(token);
  return getCreatureGmLines([
    `**${name}: level ${from} to ${to}.**`,
    `AC ${data.ac} to ${values["data.ac"]}, HP ${data.hitpoints} to ${values["data.hitpoints"]}, Perception ${getSignedNumber(getCreatureNumber(data.perceptionMod))} to ${getSignedNumber(values["data.perceptionMod"])}.`,
    `Fortitude ${getSignedNumber(getCreatureNumber(data.fortitudeMod))} to ${getSignedNumber(values["data.fortitudeMod"])}, Reflex ${getSignedNumber(getCreatureNumber(data.reflexMod))} to ${getSignedNumber(values["data.reflexMod"])}, Will ${getSignedNumber(getCreatureNumber(data.willMod))} to ${getSignedNumber(values["data.willMod"])}.`,
    ...(data.spells?.length ? ["Its spell DC and attack changed; its spell list didn't."] : []),
    ...(checks.length ? [`Check by hand, their text has numbers: ${checks.join(", ")}.`] : []),
    ...(token.linked === true ? ["This token is linked, so its NPC record changed too and Reset can't undo it."] : []),
  ]);
}

function getCreatureBenchmarkMessage(level) {
  const row = (label, table, tiers, format = (value) => value) => {
    const cells = tiers
      .map((tier) => [tier, CREATURE_TABLES[table]?.[tier]?.[level - CREATURE_MIN_LEVEL]])
      .filter(([, entry]) => entry !== null && entry !== undefined)
      .map(([tier, entry]) => `${capitalize(tier)} ${format(entry)}`);
    return `**${label}:** ${cells.join(", ")}`;
  };
  const signed = (value) => getSignedNumber(value);
  const range = (value) => (Array.isArray(value) ? (value[0] === value[1] ? value[0] : `${value[1]}-${value[0]}`) : value);
  const four = ["extreme", "high", "moderate", "low"];
  const five = [...four, "terrible"];
  return getCreatureGmLines([
    `**Creature benchmarks, level ${level}** (GM Core Tables 2-1 to 2-12)`,
    row("Attribute", "attribute", four, signed),
    row("Perception", "perception", five, signed),
    row("Skill", "skill", four, signed),
    row("AC", "ac", four),
    row("Save", "save", five, signed),
    row("HP", "hp", ["high", "moderate", "low"], range),
    row("Resistance or weakness", "resistance", ["high", "low"]),
    row("Strike attack", "strike", four, signed),
    row("Strike damage", "damage", four),
    row("Spell DC", "spellDc", ["extreme", "high", "moderate"]),
    row("Spell attack", "spellAttack", ["extreme", "high", "moderate"], signed),
    row("Area damage", "area", ["unlimited", "limited"]),
  ]);
}

// The NPC tokens selected. Vehicles, hazards and familiars don't use the tables.
function getCreatureTokens() {
  const tokens = (api.getSelectedTokens() || [])
    .map((selected) => selected?.token || selected)
    .filter((token) => token?.recordType === "npcs" && (token.data?.type || "npc") === "npc" && !isSiegeToken(token));
  if (!tokens.length) api.showNotification("Select an NPC's token first.", "yellow", "Creature Builder");
  return tokens;
}

// Elite and Weak keep their own base numbers, which these writes would leave stale
function getCreatureUnadjusted(tokens) {
  const adjusted = tokens.filter((token) => token.data?.adjustment);
  if (adjusted.length) {
    api.showNotification(`Remove Elite or Weak first: ${adjusted.map(getCreatureName).join(", ")}.`, "yellow", "Creature Builder");
  }
  return tokens.filter((token) => !token.data?.adjustment);
}

function askCreatureLevel(prompt, callback) {
  const options = [];
  for (let level = CREATURE_MIN_LEVEL; level <= CREATURE_MAX_LEVEL; level += 1) {
    options.push({ label: `Level ${level}`, value: `${level}` });
  }
  api.showPrompt("Creature Builder", prompt, "Select...", options, null, (choice) => {
    const level = parseInt(pick(choice), 10);
    if (Number.isFinite(level)) callback(level);
  });
}

function postCreatureBenchmarks() {
  askCreatureLevel("Benchmarks for which level?", (level) => api.sendMessage(getCreatureBenchmarkMessage(level)));
}

function rescaleSelectedCreatures() {
  const tokens = getCreatureUnadjusted(getCreatureTokens());
  if (!tokens.length) return;
  askCreatureLevel("Rescale to which level?", (to) => {
    tokens.forEach((token) => {
      const from = getCreatureNumber(token.data?.level);
      const values = getCreatureRescaleValues(token, to);
      api.setValuesOnTokenById(token._id, token.recordType, values);
      api.sendMessage(getCreatureRescaleMessage(token, from, to, values));
    });
  });
}

function applyCreatureBuild(tokens, level, map, tiers) {
  tokens.forEach((token) => {
    const values = getCreatureBuildValues(token, level, tiers, map === "Sniper");
    api.setValuesOnTokenById(token._id, token.recordType, values);
    api.sendMessage(getCreatureGmLines([
      `**${getCreatureName(token)}: built as a level ${level} ${map}.**`,
      `AC ${values["data.ac"]}, HP ${values["data.hitpoints"]}, Perception ${getSignedNumber(values["data.perceptionMod"])}.`,
      "Its abilities, spells and skill list are yours to add. Reset returns it to its NPC record.",
    ]));
  });
}

// One tier at a time, for the statistics that aren't left at moderate
function askCreatureTiers(stats, tiers, done) {
  if (!stats.length) return done(tiers);
  const [stat, ...rest] = stats;
  const options = CREATURE_TIER_ORDER
    .filter((tier) => CREATURE_TABLES[CREATURE_STAT_TABLES[stat]]?.[tier])
    .map((tier) => ({ label: capitalize(tier), value: tier }));
  api.showPrompt("Creature Builder", CREATURE_STAT_LABELS[stat], "Select...", options, null, (choice) => {
    const tier = pick(choice);
    if (!tier) return;
    askCreatureTiers(rest, { ...tiers, [stat]: tier }, done);
  });
}

function buildSelectedCreatures() {
  const tokens = getCreatureUnadjusted(getCreatureTokens());
  if (!tokens.length) return;
  askCreatureLevel("Build at which level?", (level) => {
    const options = [...Object.keys(CREATURE_ROAD_MAPS), "Pick Each Statistic"].map((name) => ({ label: name, value: name }));
    api.showPrompt("Creature Builder", "Which road map?", "Select...", options, null, (choice) => {
      const map = pick(choice);
      if (!map) return;
      if (map !== "Pick Each Statistic") return applyCreatureBuild(tokens, level, map, CREATURE_ROAD_MAPS[map]);
      askCreatureTiers(Object.keys(CREATURE_STAT_LABELS), {}, (tiers) => applyCreatureBuild(tokens, level, "custom creature", tiers));
    });
  });
}

function resetSelectedCreatures() {
  getCreatureUnadjusted(getCreatureTokens()).forEach((token) => {
    if (token.linked === true || !token.recordId) {
      api.showNotification(`${getCreatureName(token)} shares its NPC record, so there's no original to return to.`, "yellow", "Creature Builder");
      return;
    }
    api.getRecord("npcs", token.recordId, (source) => {
      if (!source) {
        api.showNotification(`${getCreatureName(token)}'s NPC record is gone.`, "yellow", "Creature Builder");
        return;
      }
      api.setValuesOnTokenById(token._id, token.recordType, getCreatureResetValues(token, source));
      api.sendMessage(getCreatureGmLines([`**${getCreatureName(token)}** is back to its NPC record, level ${source.data?.level}.`]));
    });
  });
}
