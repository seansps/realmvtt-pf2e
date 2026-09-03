// Tests for conditional proficiency grants, including repeatable Armor Proficiency.

const { createSandbox } = require("./sandbox");
const { assert, section, summary } = require("./test-helpers");

const ctx = createSandbox();

let nextId = 0;
const id = () => `test-${++nextId}`;

function grant(name, rank, predicate) {
  return {
    _id: id(),
    name: `${name}-${rank}`,
    recordType: "records",
    identified: true,
    data: { name, rank: String(rank), field: "", predicate: JSON.stringify(predicate) },
  };
}

function armorProficiencyFeat() {
  const below13 = { lt: ["actor:level", 13] };
  const atLeast13 = { gte: ["actor:level", 13] };
  const untrained = (armor) => ({ lt: [`actor:armor:${armor}:rank`, 1] });
  const trained = (armor) => ({ gte: [`actor:armor:${armor}:rank`, 1] });
  const all = (...predicates) => ({ and: predicates });

  return {
    _id: id(),
    name: "Armor Proficiency",
    recordType: "feats",
    identified: true,
    data: {
      level: 1,
      proficiencies: [
        grant("light", 1, all(untrained("light"), below13)),
        grant("light", 2, all(untrained("light"), atLeast13)),
        grant("medium", 1, all(trained("light"), untrained("medium"), below13)),
        grant("medium", 2, all(trained("light"), untrained("medium"), atLeast13)),
        grant("heavy", 1, all(trained("light"), trained("medium"), below13)),
        grant("heavy", 2, all(trained("light"), trained("medium"), atLeast13)),
      ],
    },
  };
}

function character(level, feats, defenses = {}) {
  return {
    _id: id(),
    recordType: "characters",
    data: {
      level,
      classes: [{ data: { defenses } }],
      feats,
      bonusFeats: [],
      features: [],
    },
  };
}

function armorRanks(record) {
  const valuesToSet = {};
  ctx.updateProficiencies(record, valuesToSet);
  return {
    light: valuesToSet["data.defenses.light"],
    medium: valuesToSet["data.defenses.medium"],
    heavy: valuesToSet["data.defenses.heavy"],
  };
}

section("Conditional proficiency grants");
assert(
  "first Armor Proficiency trains Light armor",
  armorRanks(character(1, [armorProficiencyFeat()])),
  { light: 1, medium: 0, heavy: 0 },
);
assert(
  "second Armor Proficiency trains Medium armor",
  armorRanks(character(1, [armorProficiencyFeat(), armorProficiencyFeat()])),
  { light: 1, medium: 1, heavy: 0 },
);
assert(
  "third Armor Proficiency trains Heavy armor",
  armorRanks(
    character(1, [armorProficiencyFeat(), armorProficiencyFeat(), armorProficiencyFeat()]),
  ),
  { light: 1, medium: 1, heavy: 1 },
);
assert(
  "level 13 Armor Proficiency grants Expert in its next armor type",
  armorRanks(character(13, [armorProficiencyFeat()], { light: "1" })),
  { light: 1, medium: 2, heavy: 0 },
);

process.exitCode = summary();
