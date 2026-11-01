// Builds the Eidolons module's records, the way Foundry's PF2e Companion
// Compendia models eidolons (as the Animal Companions module does companions):
// each eidolon type is an ancestry, and "Eidolon" is a class. The ruleset's
// support is rollhandlers/eidolons.js.
//
// Source: source/eidolon-types.json, the 15 remastered eidolon types from
// Archives of Nethys (ORC): Impossible Magic, Rage of Elements (elemental) and
// Battlecry! (swarm). Icons: icons.json (Realm's icon catalog).
// Run: node modules/eidolons/build.js  ->  records.json

const fs = require("fs");
const path = require("path");

const here = __dirname;
const TYPES = JSON.parse(fs.readFileSync(path.join(here, "source", "eidolon-types.json"), "utf8"));
const FEATS = JSON.parse(fs.readFileSync(path.join(here, "source", "evolution-feats.json"), "utf8"));
const ICONS = fs.existsSync(path.join(here, "icons.json"))
  ? JSON.parse(fs.readFileSync(path.join(here, "icons.json"), "utf8"))
  : {};

const PUBLICATION = { license: "ORC", remaster: true, title: "Pathfinder Impossible Magic" };
const publicationFor = (type) => ({ ...PUBLICATION, title: `Pathfinder ${type.source}` });
const UNARMED = "item:category:unarmed";

const slug = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
// Stable ids, so a rebuild matches the records already uploaded
const idFor = (...parts) => `eid-${parts.map(slug).join("-")}`;
const traitsList = (traits) => traits.map((name) => ({ _id: idFor("trait", name), name, identified: true, data: {} }));
const icon = (key, fallback) => ICONS[key] || fallback;
const p = (text) => `<p>${text}</p>`;
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
// Source text to HTML paragraphs and lists
const html = (text) =>
  String(text || "")
    .split(/\n(?=- )|\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (block.startsWith("- ") ? `<ul><li>${block.slice(2)}</li></ul>` : p(block)))
    .join("")
    .replace(/<\/ul><ul>/g, "");

const modifier = (name, data) => ({
  _id: idFor("mod", name, data.type, data.field || "", data.value, data.predicate || ""),
  name,
  unidentifiedName: "Modifier",
  recordType: "records",
  identified: true,
  data: { modifierType: "none", valueType: "number", active: true, field: "", ...data },
});
const attribute = (name, field, value) =>
  value >= 0
    ? modifier(name, { type: "attributeBonus", field, value: String(value) })
    : modifier(name, { type: "attributePenalty", field, value: String(-value) });
const attributes = (name, values) =>
  Object.entries(values)
    .filter(([, value]) => value !== 0)
    .map(([field, value]) => attribute(name, field, value));
const proficiency = (name, rank, predicate = "") => ({
  _id: idFor("prof", name, rank, predicate),
  name: "Proficiency",
  recordType: "records",
  identified: true,
  data: { name, rank: String(rank), field: "", ...(predicate ? { predicate } : {}) },
});

// A feature (class or ancestry), with its level
function feature(id, name, level, description, data = {}, type = "classfeature") {
  return {
    _id: id,
    name,
    recordType: "features",
    identified: true,
    portrait: icon(`features|${name}`, "/icons/fantasy/sundries/books/book-red-square.webp"),
    data: { level, type, description, publication: PUBLICATION, ...data },
  };
}

// A choice on a feature: one option per entry, each adding its features or
// items (common.js promptForChoices)
function choice(id, description, options, extra = {}) {
  return {
    _id: id,
    name: description,
    recordType: "records",
    identified: true,
    data: {
      description,
      options: options.map((option) => ({
        _id: `${id}-option-${slug(option.name)}`,
        name: option.name,
        recordType: "records",
        identified: true,
        data: { ...(option.slug ? { slug: option.slug } : {}), value: option.value },
      })),
      ...extra,
    },
  };
}

const ACTION_PORTRAITS = { oneAction: "/icons/fantasy/actions/OneAction.webp", twoActions: "/icons/fantasy/actions/TwoActions.webp", threeActions: "/icons/fantasy/actions/ThreeActions.webp", reaction: "/icons/fantasy/actions/Reaction.webp", free: "/icons/fantasy/actions/FreeAction.webp" };
function action(id, name, actions, description, traits, publication) {
  return {
    _id: id,
    name,
    recordType: "actions",
    identified: true,
    unidentifiedName: "Unidentified Action",
    portrait: icon(`actions|${name}`, ACTION_PORTRAITS[actions] || "/icons/fantasy/actions/Passive.webp"),
    data: {
      type: actions ? "action" : "passive",
      actions,
      actionType: actions ? "action" : "passive",
      actionCategory: "offensive",
      description,
      traits,
      traitsList: traitsList(traits),
      publication,
    },
    fields: { actions: { hidden: !actions } },
  };
}

// --- unarmed attacks -----------------------------------------------------

// The primary attack's statistics (Impossible Magic pg. 70): 1d8 with one of
// disarm, nonlethal, shove or trip, or 1d6 with fatal d10, forceful and
// sweep, or deadly d8 and finesse
const PRIMARY_ATTACKS = [
  { name: "1d8, Disarm", die: 8, traits: ["Disarm"] },
  { name: "1d8, Nonlethal", die: 8, traits: ["Nonlethal"] },
  { name: "1d8, Shove", die: 8, traits: ["Shove"] },
  { name: "1d8, Trip", die: 8, traits: ["Trip"] },
  { name: "1d6, Fatal d10", die: 6, traits: ["Fatal d10"] },
  { name: "1d6, Forceful and Sweep", die: 6, traits: ["Forceful", "Sweep"] },
  { name: "1d6, Deadly d8 and Finesse", die: 6, traits: ["Deadly d8", "Finesse"] },
];

function unarmed(id, name, die, traits, note) {
  const all = [...new Set([...traits, "Unarmed"])];
  return {
    _id: id,
    name,
    recordType: "items",
    identified: true,
    unidentifiedName: name,
    portrait: icon(`items|${name}`, "/icons/fantasy/default-icons/melee.svg"),
    data: {
      type: "weapon",
      level: 0,
      itemCategory: "Unarmed",
      group: "Brawling",
      range: "",
      traits: all,
      traitsList: traitsList(all),
      damage: { dice: 1, die: `d${die}`, damageType: "bludgeoning" },
      description: p(`Your eidolon's ${name.toLowerCase()}. ${note} Rename it and set its damage type (bludgeoning, piercing or slashing) to fit its form: claw, jaws, fist, horn...`),
      publication: PUBLICATION,
    },
  };
}

// --- the class -----------------------------------------------------------

// Eidolon weapon specialization: 2 extra damage with expert unarmed attacks,
// 3 with master; greater specialization doubles it (Foundry's rank-gated
// damage modifiers)
// A Summoner Dedication eidolon doesn't get the summoner's class features:
// their proficiencies and modifiers carry this predicate
const NOT_DEDICATION = { not: "feat:summoner-dedication-eidolon" };
const classProficiency = (name, rank) => proficiency(name, rank, JSON.stringify([NOT_DEDICATION]));

const specialization = (name, expert, master) => [
  modifier(name, { type: "damageBonus", field: "all", value: String(expert), predicate: JSON.stringify([UNARMED, "item:proficiency:rank:2", NOT_DEDICATION]) }),
  modifier(name, { type: "damageBonus", field: "all", value: String(master), predicate: JSON.stringify([UNARMED, "item:proficiency:rank:3", NOT_DEDICATION]) }),
];

const TRANSCENDENCE_ATTRIBUTES = [
  ["Strength", "str"],
  ["Dexterity", "dex"],
  ["Constitution", "con"],
  ["Intelligence", "int"],
  ["Wisdom", "wis"],
  ["Charisma", "cha"],
];

function classFeatures() {
  const f = (name, level, text, data = {}) => feature(idFor("feature", name), name, level, p(text), data);
  return [
    f(
      "Eidolon",
      1,
      "Your eidolon shares your Hit Points, your actions and your multiple attack penalty (Impossible Magic pg. 63). Its level is yours, and it shares your skill proficiencies. Set its summoner on the Notes tab.",
      {
        providesItems: [
          unarmed(idFor("item", "primary-attack-secondary"), "Secondary Attack", 6, ["Agile", "Finesse"], "Your eidolon's secondary unarmed attack: 1d6, agile and finesse."),
        ],
        choices: [
          choice(
            idFor("choice", "primary-attack"),
            "Choose your eidolon's primary attack",
            PRIMARY_ATTACKS.map((attack) => ({
              name: attack.name,
              value: [unarmed(idFor("item", "primary-attack", attack.name), "Primary Attack", attack.die, attack.traits, `Your eidolon's primary unarmed attack: ${attack.name.toLowerCase()}.`)],
            })),
            { flag: "eidolonPrimaryAttack" },
          ),
        ],
      },
    ),
    f("Shared Vigilance", 3, "Your eidolon's proficiency rank for Perception increases to expert.", { proficiencies: [classProficiency("perception", 2)] }),
    f("Eidolon Unarmed Expertise", 5, "Your eidolon's proficiency rank for unarmed attacks increases to expert.", { proficiencies: [classProficiency("unarmed", 2)] }),
    f("Eidolon Symbiosis", 7, "Your eidolon gains the symbiosis ability of its type (its ancestry)."),
    f("Eidolon Weapon Specialization", 7, "Your eidolon's unarmed attacks deal 2 additional damage, 3 if it's a master in them.", { modifiers: specialization("Eidolon Weapon Specialization", 2, 3) }),
    f("Shared Reflexes", 9, "Your eidolon's proficiency rank for Reflex saves increases to expert.", { proficiencies: [classProficiency("reflex", 2)] }),
    f("Twin Juggernauts", 11, "Your eidolon's proficiency rank for Fortitude saves increases to master.", { proficiencies: [classProficiency("fortitude", 3)] }),
    f("Eidolon Defensive Expertise", 11, "Your eidolon's proficiency rank for unarmored defense increases to expert.", { proficiencies: [classProficiency("unarmored", 2)] }),
    f("Eidolon Unarmed Mastery", 13, "Your eidolon's proficiency rank for unarmed attacks increases to master.", { proficiencies: [classProficiency("unarmed", 3)] }),
    f("Shared Resolve", 15, "Your eidolon's proficiency rank for Will saves increases to master.", { proficiencies: [classProficiency("will", 3)] }),
    f("Greater Eidolon Specialization", 15, "Your eidolon's weapon specialization damage doubles: 4 additional damage, 6 if it's a master in its unarmed attacks.", { modifiers: specialization("Greater Eidolon Specialization", 2, 3) }),
    f("Eidolon Transcendence", 17, "Your eidolon gains the transcendence ability of its type (its ancestry), and one of its attribute modifiers increases by 1.", {
      choices: [
        choice(
          idFor("choice", "transcendence-attribute"),
          "Choose the attribute your eidolon's transcendence increases by 1",
          TRANSCENDENCE_ATTRIBUTES.map(([label, field]) => ({
            name: label,
            value: [feature(idFor("feature", "transcendence", field), `Transcendence: ${label}`, 17, p(`Your eidolon's ${label} modifier increases by 1.`), { modifiers: [attribute(`Transcendence: ${label}`, field, 1)] })],
          })),
          { flag: "eidolonTranscendence" },
        ),
      ],
    }),
    f("Eidolon Defensive Mastery", 19, "Your eidolon's proficiency rank for unarmored defense increases to master.", { proficiencies: [classProficiency("unarmored", 3)] }),
  ];
}

function buildClass() {
  return {
    _id: idFor("class", "eidolon"),
    name: "Eidolon",
    recordType: "class",
    identified: true,
    portrait: icon("class|Eidolon", "/icons/fantasy/skills/summoner/summoners-beast-companion.webp"),
    data: {
      // Matched by name or by this flag (isEidolonCharacter)
      eidolon: true,
      // Its Hit Points are its summoner's (shared, eidolons.js)
      hp: 0,
      keyAbility: [],
      perception: "1",
      classDC: "0",
      spellcasting: "0",
      savingThrows: { fortitude: "2", reflex: "1", will: "2" },
      attacks: { unarmed: "1", simple: "0", martial: "0", advanced: "0", other: { name: "", rank: "0" } },
      defenses: { unarmored: "1", light: "0", medium: "0", heavy: "0" },
      trainedSkills: [],
      trainedSkillsAdditional: 0,
      ancestryFeatLevels: [],
      // Evolution feats taken for the eidolon
      classFeatLevels: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
      generalFeatLevels: [],
      skillFeatLevels: [],
      skillIncreaseLevels: [],
      description:
        p("An eidolon is a summoner's link to another plane. It shares the summoner's Hit Points, actions and multiple attack penalty, its level is the summoner's, and it shares the summoner's skill proficiencies (set its summoner on the Notes tab).") +
        p("It's an expert in Fortitude and Will saves, and trained in Reflex saves, Perception, unarmed attacks and unarmored defense; the summoner's class features raise them. Its type (its ancestry) sets its attributes other than Strength and Dexterity; choose its key attribute when you drop the type. It gets attribute boosts at 5th, 10th, 15th and 20th levels, as you do.") +
        p("<em>Impossible Magic pg. 63 and 69.</em>"),
      traits: ["Eidolon"],
      traitsList: traitsList(["Eidolon"]),
      features: classFeatures(),
      publication: PUBLICATION,
    },
  };
}

// --- the ancestries ----------------------------------------------------------

// Key attribute (Impossible Magic pg. 69): +4 and +2 to Strength and
// Dexterity, with an item bonus to AC and a Dexterity cap; Elemental and
// Swarm eidolons pick one of two named arrays instead
function arrayFeature(type, array) {
  const name = `${type.name}: ${array.name}`;
  const key = array.name === "Strength" || array.name === "Dexterity" ? `${array.name} key attribute` : array.name;
  const values = { str: array.str, dex: array.dex };
  if (!(array.name === "Strength" || array.name === "Dexterity")) Object.assign(values, { con: array.con, int: array.int, wis: array.wis, cha: array.cha });
  return feature(
    idFor("feature", type.name, array.name),
    name,
    1,
    p(`<strong>${key}</strong> Str ${signed(array.str)}, Dex ${signed(array.dex)}${values.con !== undefined ? `, Con ${signed(array.con)}, Int ${signed(array.int)}, Wis ${signed(array.wis)}, Cha ${signed(array.cha)}` : ""}; ${signed(array.ac)} item bonus to AC, Dexterity cap ${signed(array.dexCap)}.`),
    {
      modifiers: [
        ...attributes(name, values),
        modifier(name, { type: "armorClassBonus", modifierType: "item", value: String(array.ac) }),
        modifier(name, { type: "dexCap", value: String(array.dexCap) }),
      ],
    },
    "ancestryfeature",
  );
}

function senses(type, name) {
  const text = String(type.senses || "").toLowerCase();
  const vision = text.includes("darkvision") ? "Darkvision" : text.includes("low-light") ? "Low-Light Vision" : "";
  const extra = String(type.senses || "")
    .split(/,(?![^(]*\))/)
    .map((sense) => sense.trim())
    .filter((sense) => sense && !/^(low-light vision|darkvision)$/i.test(sense));
  return { vision, modifiers: extra.map((sense) => modifier(name, { type: "sense", valueType: "string", value: sense })) };
}

const ABILITY_LEVELS = { initial: 1, symbiosis: 7, transcendence: 17 };
const ABILITY_LABELS = { initial: "Initial ability", symbiosis: "Symbiosis (7th)", transcendence: "Transcendence (17th)" };

// The type's initial, symbiosis and transcendence abilities: a feature each,
// at its level, with an action for the ones that cost actions
function abilityFeatures(type) {
  return Object.entries(type.abilities).map(([kind, ability]) => {
    const description = html(ability.text) + p(`<em>${ABILITY_LABELS[kind]} of the ${type.name.toLowerCase()} (${type.source} ${type.page}).</em>`);
    const traits = ["Eidolon"];
    return feature(
      idFor("feature", type.name, ability.name),
      ability.name,
      ABILITY_LEVELS[kind],
      description,
      ability.actions ? { providesItems: [action(idFor("action", type.name, ability.name), ability.name, ability.actions, description, traits, publicationFor(type))] } : {},
      "ancestryfeature",
    );
  });
}

function buildAncestry(type) {
  const name = type.name;
  const featureName = name;
  const { vision, modifiers: senseModifiers } = senses(type, featureName);
  const otherSpeeds = Object.entries(type.speed || {})
    .filter(([kind]) => kind !== "land")
    .map(([kind, feet]) => modifier(featureName, { type: "speed", field: kind, value: String(feet) }));
  const standard = type.arrays.every((array) => array.name === "Strength" || array.name === "Dexterity");
  const fixed = standard ? { con: type.arrays[0].con, int: type.arrays[0].int, wis: type.arrays[0].wis, cha: type.arrays[0].cha } : {};
  const choices = [
    choice(
      idFor("choice", name, "attributes"),
      standard ? "Choose your eidolon's key attribute" : `Choose your ${name.toLowerCase()}'s attributes`,
      // The roll option names the key attribute (the one at +4), for the
      // Summoner Dedication's reduced start: eidolon-key:strength or
      // eidolon-key:dexterity
      type.arrays.map((array) => ({ name: array.name, slug: array.str >= array.dex ? "strength" : "dexterity", value: [arrayFeature(type, array)] })),
      { flag: "eidolonAttributes", rollOption: "eidolon-key" },
    ),
  ];
  if (type.traditionChoice) {
    choices.push(
      choice(
        idFor("choice", name, "tradition"),
        "Choose your dragon eidolon's tradition",
        Object.entries(type.traditionChoice).map(([tradition, skill]) => ({
          name: tradition,
          value: [
            feature(idFor("feature", name, tradition), `${name}: ${tradition}`, 1, p(`Your dragon eidolon has the ${tradition.toLowerCase()} trait, and you're trained in ${skill}.`), {
              modifiers: [modifier(`${name}: ${tradition}`, { type: "trait", valueType: "string", value: tradition })],
              proficiencies: [proficiency(skill.toLowerCase(), 1)],
            }, "ancestryfeature"),
          ],
        })),
        { flag: "eidolonTradition" },
      ),
    );
  }
  const size = /\bor\b/.test(type.size) ? p(`<strong>Size</strong> ${type.size}; change the character's size if you pick the other.`) : p(`<strong>Size</strong> ${type.size}.`);
  const attributeText = standard
    ? `<strong>Eidolon Attributes</strong> Con ${signed(fixed.con)}, Int ${signed(fixed.int)}, Wis ${signed(fixed.wis)}, Cha ${signed(fixed.cha)}; Strength and Dexterity from its key attribute.`
    : `<strong>Eidolon Attributes</strong> ${type.arrays.map((a) => `${a.name}: Str ${signed(a.str)}, Dex ${signed(a.dex)}, Con ${signed(a.con)}, Int ${signed(a.int)}, Wis ${signed(a.wis)}, Cha ${signed(a.cha)}, ${signed(a.ac)} AC (${signed(a.dexCap)} Dex cap)`).join("; ")}.`;
  const traits = type.traits.filter((trait) => trait !== "(Variable)");

  return {
    _id: idFor("ancestry", name),
    name,
    recordType: "ancestry",
    identified: true,
    unidentifiedName: "Unidentified Ancestries",
    portrait: icon(`ancestry|${name}`, "/icons/fantasy/default-icons/npc.svg"),
    data: {
      // An eidolon type: dropping it asks for no heritage (isEidolonAncestry)
      eidolon: true,
      // Its Hit Points are its summoner's (shared, eidolons.js)
      hp: 0,
      size: /small/i.test(type.size) && !/medium/i.test(type.size) ? "Small" : /large/i.test(type.size) && !/medium/i.test(type.size) ? "Large" : "Medium",
      speed: `${type.speed?.land || 0} feet`,
      reach: 5,
      vision,
      // Eidolons have no boosts or flaws at creation: their type sets their
      // attributes (the features' attribute modifiers)
      boosts: {},
      flaws: {},
      langauges: [],
      additionalLanguages: { value: [], count: 0 },
      description:
        html(type.description) +
        p(`An eidolon type (${type.source} ${type.page}). Use it as the ancestry of an eidolon character, with the Eidolon class.`) +
        p(`<strong>Tradition</strong> ${type.tradition || "Choose arcane, divine, occult or primal"}. <strong>Home Plane</strong> ${type.homePlane}.`) +
        size +
        p(`<strong>Suggested Attacks</strong> ${type.suggestedAttacks}`) +
        p(attributeText) +
        p(`<strong>Skills</strong> ${type.skills.join(", ")}${type.traditionChoice ? " and the skill of its tradition" : ""}. <strong>Senses</strong> ${type.senses || "as a human's"}. <strong>Language</strong> ${type.language || "none"}.`),
      traits,
      traitsList: traitsList(traits),
      features: [
        feature(
          idFor("feature", name, "eidolon"),
          featureName,
          1,
          p(attributeText) + p(`<strong>Skills</strong> ${type.skills.join(", ")}. <strong>Senses</strong> ${type.senses || "as a human's"}.`),
          {
            modifiers: [...attributes(featureName, fixed), ...senseModifiers, ...otherSpeeds],
            proficiencies: type.skills.map((skill) => proficiency(skill.toLowerCase(), 1)),
            choices,
          },
          "ancestryfeature",
        ),
        ...abilityFeatures(type),
      ],
      publication: publicationFor(type),
    },
  };
}

// --- the evolution feats -------------------------------------------------------

// The eidolon's versions of the summoner's evolution feats (Impossible Magic
// pg. 79-86), as Foundry's Companion Compendia has them: the summoner keeps
// the class book's feat, and the eidolon gets this one, with what it changes
// on the eidolon. Named "<feat> (Eidolon)" so the two don't clash.
const ENERGIES = ["Acid", "Cold", "Electricity", "Fire"];
const RANGED_DAMAGE_TYPES = ["Acid", "Bludgeoning", "Cold", "Electricity", "Fire", "Piercing", "Slashing", "Spirit", "Vitality", "Void"];
const levelAtLeast = (level) => ({ gte: ["self:level", level] });

// Resistance equal to half the level, minimum 1: one modifier per step (the
// best one counts)
function halfLevelResistance(name, type, rollOption) {
  const mods = [modifier(name, { type: "resistance", field: type.toLowerCase(), value: "1", predicate: JSON.stringify([rollOption]) })];
  for (let value = 2; value <= 10; value++) {
    mods.push(modifier(name, { type: "resistance", field: type.toLowerCase(), value: String(value), predicate: JSON.stringify([rollOption, levelAtLeast(value * 2)]) }));
  }
  return mods;
}

// An energy choice (Energy Heart, Dual Energy Heart): the pick's roll option
// (energy-heart:fire) turns on its resistance
function energyChoice(featName, rollOption) {
  return choice(
    idFor("choice", featName),
    `Choose ${featName}'s energy`,
    ENERGIES.map((energy) => ({
      name: energy,
      value: [feature(idFor("feature", featName, energy), `${featName}: ${energy}`, 1, p(`Your eidolon's energy is ${energy.toLowerCase()}.`), {}, "classfeature")],
    })),
    { flag: slug(rollOption).replace(/-(.)/g, (m, c) => c.toUpperCase()), rollOption },
  );
}

function rangedAttack(type) {
  const traits = ["Magical", "Propulsive", "Unarmed"];
  return {
    _id: idFor("item", "ranged-attack", type),
    name: "Ranged Attack",
    recordType: "items",
    identified: true,
    unidentifiedName: "Ranged Attack",
    portrait: icon("items|Ranged Attack", "/icons/fantasy/default-icons/ranged.svg"),
    data: {
      type: "weapon",
      level: 0,
      itemCategory: "Unarmed",
      group: "Brawling",
      range: "30",
      traits,
      traitsList: traitsList(traits),
      damage: { dice: 1, die: "d4", damageType: type.toLowerCase() },
      description: p(`Your eidolon's ranged unarmed attack (Ranged Combatant): 1d4 ${type.toLowerCase()}, range increment 30 feet, magical and propulsive. Rename it to fit its form: spines, flame jets, holy blasts...`),
      publication: PUBLICATION,
    },
  };
}

// What each feat changes on the eidolon; the rest are text (and an action
// when they cost actions)
const EVOLUTION_AUTOMATION = {
  "Energy Heart": {
    choices: [energyChoice("Energy Heart", "energy-heart")],
    modifiers: ENERGIES.flatMap((energy) => halfLevelResistance("Energy Heart", energy, `energy-heart:${slug(energy)}`)),
    note: "Change the damage type of one of your eidolon's unarmed attacks to the energy you choose.",
  },
  "Dual Energy Heart": {
    choices: [energyChoice("Dual Energy Heart", "dual-energy-heart")],
    modifiers: ENERGIES.flatMap((energy) => halfLevelResistance("Dual Energy Heart", energy, `dual-energy-heart:${slug(energy)}`)),
    note: "Add the versatile trait for the second energy to your eidolon's energy attack.",
  },
  "Energy Resistance": {
    modifiers: ENERGIES.map((energy) =>
      modifier("Energy Resistance", { type: "resistance", field: energy.toLowerCase(), valueType: "string", value: "@actor.level", predicate: JSON.stringify([{ or: [`energy-heart:${slug(energy)}`, `dual-energy-heart:${slug(energy)}`] }]) }),
    ),
  },
  "Expanded Senses": {
    modifiers: [
      modifier("Expanded Senses", { type: "sense", valueType: "string", value: "darkvision" }),
      modifier("Expanded Senses", { type: "sense", valueType: "string", value: "low-light vision" }),
      modifier("Expanded Senses", { type: "sense", valueType: "string", value: "scent (imprecise) 30 feet" }),
    ],
  },
  "Vibration Sense": {
    modifiers: [modifier("Vibration Sense", { type: "sense", valueType: "string", value: "tremorsense (imprecise) 30 feet" })],
    note: "An aquatic eidolon gets wavesense (imprecise) 30 feet instead, and an amphibious one gets both.",
  },
  "Alacritous Action": { modifiers: [modifier("Alacritous Action", { type: "speedBonus", value: "10" })] },
  "Amphibious Form": {
    modifiers: [
      modifier("Amphibious Form", { type: "trait", valueType: "string", value: "Amphibious" }),
      modifier("Amphibious Form", { type: "speed", field: "swim", value: "25" }),
    ],
    note: "The swim Speed is 25 feet, or the eidolon's land Speed if that's lower (an ooze eidolon: 20 feet).",
  },
  "Burrowing Form": { modifiers: [modifier("Burrowing Form", { type: "speed", field: "burrow", value: "15" })] },
  "Airborne Form": {
    // A fly Speed equal to its Speed: 25, or 35 with Alacritous Action
    modifiers: [
      modifier("Airborne Form", { type: "speed", field: "fly", value: "25" }),
      modifier("Airborne Form", { type: "speed", field: "fly", value: "35", predicate: JSON.stringify(["feat:alacritous-action-eidolon"]) }),
    ],
  },
  "Ranged Combatant": {
    choices: [
      choice(
        idFor("choice", "ranged-combatant"),
        "Choose your eidolon's ranged attack's damage type",
        RANGED_DAMAGE_TYPES.map((type) => ({ name: type, value: [rangedAttack(type)] })),
        { flag: "eidolonRangedDamage" },
      ),
    ],
  },
  "Hulking Size": { modifiers: [modifier("Hulking Size", { type: "creatureSize", valueType: "string", value: "large" })], note: "Its reach increases to 10 feet." },
  "Towering Size": { modifiers: [modifier("Towering Size", { type: "creatureSize", valueType: "string", value: "huge" })], note: "The reach of all its attacks increases to 15 feet." },
  "Nimble Form": { modifiers: [modifier("Nimble Form", { type: "mapReduction", valueType: "string", value: "1/2", predicate: JSON.stringify([UNARMED, "item:trait:agile"]) })] },
  "Resilient Shell": {
    modifiers: [
      modifier("Resilient Shell", { type: "resistance", field: "physical", value: "5" }),
      modifier("Resilient Shell", { type: "resistance", field: "physical", value: "6", predicate: JSON.stringify([levelAtLeast(17)]) }),
    ],
  },
  "Ever-Vigilant Senses": { modifiers: [modifier("Ever-Vigilant Senses", { type: "perceptionBonus", modifierType: "circumstance", value: "2" })] },
};

const FEAT_ACTION_TYPES = { reaction: "reaction", free: "free" };

function evolutionFeat(source) {
  const name = `${source.name} (Eidolon)`;
  const automation = EVOLUTION_AUTOMATION[source.name] || {};
  const header = [
    source.prerequisites ? `<strong>Prerequisites</strong> ${source.prerequisites}` : "",
    source.frequency ? `<strong>Frequency</strong> ${source.frequency}` : "",
    source.trigger ? `<strong>Trigger</strong> ${source.trigger}` : "",
    source.requirements ? `<strong>Requirements</strong> ${source.requirements}` : "",
  ].filter(Boolean);
  const description =
    (header.length ? p(header.join("; ")) : "") +
    html(source.text) +
    (automation.note ? p(automation.note) : "") +
    p(`<em>Add this feat to your eidolon when you take ${source.name} (summoner feat ${source.level}). Impossible Magic ${source.page}.</em>`);
  const traits = source.traits.filter((trait) => trait !== "Summoner");
  const actions = source.actions;
  return {
    _id: idFor("feat", name),
    name,
    recordType: "feats",
    identified: true,
    unidentifiedName: "Unidentified Feat",
    portrait: icon(`feats|${name}`, "/icons/fantasy/sundries/books/book-red-exclamation.webp"),
    data: {
      level: source.level,
      levelLabel: "Eidolon",
      type: "bonus",
      actionType: actions ? FEAT_ACTION_TYPES[actions] || "action" : "passive",
      actions,
      prerequisites: source.prerequisites || "",
      description,
      traits,
      traitsList: traitsList(traits),
      modifiers: automation.modifiers || [],
      ...(automation.choices ? { choices: automation.choices } : {}),
      publication: PUBLICATION,
    },
    fields: { actions: { hidden: !actions }, keyOptions: { hidden: true }, levelLabel: { hidden: false } },
  };
}

// An archetype summoner's eidolon (Summoner Dedication, Impossible Magic):
// +3 instead of +4 in its key attribute until 5th level, and the summoner's
// proficiency ranks for Perception, saves and skills
function summonerDedicationFeat() {
  const name = "Summoner Dedication (Eidolon)";
  const reduced = (field, key) =>
    modifier(name, { type: "attributePenalty", field, value: "1", predicate: JSON.stringify([`eidolon-key:${key}`, { lt: ["self:level", 5] }]) });
  return {
    _id: idFor("feat", name),
    name,
    recordType: "feats",
    identified: true,
    unidentifiedName: "Unidentified Feat",
    portrait: icon(`feats|${name}`, "/icons/fantasy/sundries/books/book-red-exclamation.webp"),
    data: {
      level: 2,
      levelLabel: "Eidolon",
      type: "bonus",
      actionType: "passive",
      actions: "",
      prerequisites: "",
      description:
        p("Your eidolon's link to you is tenuous. Its key attribute starts at +3 instead of +4 (the other stays +2) and becomes +4 at 5th level, before its attribute boosts. It's trained in unarmed attacks and unarmored defense, and shares your proficiency rank for Perception, saving throws and skill checks (the sync copies them from you). It doesn't get the summoner's class features (Shared Vigilance, Eidolon Unarmed Expertise, the specializations and the rest). You can't use tandem actions.") +
        p("<em>Add this feat to the eidolon of a summoner who took Summoner Dedication. Impossible Magic.</em>"),
      traits: ["Eidolon"],
      traitsList: traitsList(["Eidolon"]),
      modifiers: [reduced("str", "strength"), reduced("dex", "dexterity")],
      publication: PUBLICATION,
    },
    fields: { actions: { hidden: true }, keyOptions: { hidden: true }, levelLabel: { hidden: false } },
  };
}

function build() {
  return {
    ancestry: TYPES.map(buildAncestry),
    class: [buildClass()],
    feats: [...FEATS.map(evolutionFeat), summonerDedicationFeat()],
  };
}

module.exports = { build, PRIMARY_ATTACKS };

if (require.main === module) {
  const records = build();
  fs.writeFileSync(path.join(here, "records.json"), JSON.stringify(records, null, 1) + "\n");
  console.log(Object.entries(records).map(([type, list]) => `${list.length} ${type}`).join(", "));
}
