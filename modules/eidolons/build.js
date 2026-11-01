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
        _id: idFor(id, "option", option.name),
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
const specialization = (name, expert, master) => [
  modifier(name, { type: "damageBonus", field: "all", value: String(expert), predicate: JSON.stringify([UNARMED, "item:proficiency:rank:2"]) }),
  modifier(name, { type: "damageBonus", field: "all", value: String(master), predicate: JSON.stringify([UNARMED, "item:proficiency:rank:3"]) }),
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
    f("Shared Vigilance", 3, "Your eidolon's proficiency rank for Perception increases to expert.", { proficiencies: [proficiency("perception", 2)] }),
    f("Eidolon Unarmed Expertise", 5, "Your eidolon's proficiency rank for unarmed attacks increases to expert.", { proficiencies: [proficiency("unarmed", 2)] }),
    f("Eidolon Symbiosis", 7, "Your eidolon gains the symbiosis ability of its type (its ancestry)."),
    f("Eidolon Weapon Specialization", 7, "Your eidolon's unarmed attacks deal 2 additional damage, 3 if it's a master in them.", { modifiers: specialization("Eidolon Weapon Specialization", 2, 3) }),
    f("Shared Reflexes", 9, "Your eidolon's proficiency rank for Reflex saves increases to expert.", { proficiencies: [proficiency("reflex", 2)] }),
    f("Twin Juggernauts", 11, "Your eidolon's proficiency rank for Fortitude saves increases to master.", { proficiencies: [proficiency("fortitude", 3)] }),
    f("Eidolon Defensive Expertise", 11, "Your eidolon's proficiency rank for unarmored defense increases to expert.", { proficiencies: [proficiency("unarmored", 2)] }),
    f("Eidolon Unarmed Mastery", 13, "Your eidolon's proficiency rank for unarmed attacks increases to master.", { proficiencies: [proficiency("unarmed", 3)] }),
    f("Shared Resolve", 15, "Your eidolon's proficiency rank for Will saves increases to master.", { proficiencies: [proficiency("will", 3)] }),
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
    f("Eidolon Defensive Mastery", 19, "Your eidolon's proficiency rank for unarmored defense increases to master.", { proficiencies: [proficiency("unarmored", 3)] }),
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
      type.arrays.map((array) => ({ name: array.name, value: [arrayFeature(type, array)] })),
      { flag: "eidolonAttributes" },
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

function build() {
  return {
    ancestry: TYPES.map(buildAncestry),
    class: [buildClass()],
  };
}

module.exports = { build, PRIMARY_ATTACKS };

if (require.main === module) {
  const records = build();
  fs.writeFileSync(path.join(here, "records.json"), JSON.stringify(records, null, 1) + "\n");
  console.log(Object.entries(records).map(([type, list]) => `${list.length} ${type}`).join(", "));
}
