// Variant: Dual-Class PCs (Gamemastery Guide pg. 192-193, a campaign setting).
// The second class is data.classes[1], so everything that goes through a
// character's classes picks it up. With the setting on, the Main tab has a
// second class line with a button to pick a class, which becomes a delete
// button once one is picked. What the rules take from the pair:
//   - the higher proficiency rank of the two, and the higher class Hit Points
//   - both classes' features, class feats, spellcasting and fixed skills
//   - general feats, skill feats, ancestry feats and skill increases once per
//     level, at the levels either class gives them
// The key attribute, class kit and class trait stay the first class's.

// Class feature paths: data.classes.<index>.data.features
function isClassFeaturePath(path) {
  return /^data\.classes\.\d+\.data\.features$/.test(`${path}`);
}

function getClassForFeaturePath(record, path) {
  return record?.data?.classes?.[parseInt(`${path}`.split(".")[2], 10)] || null;
}

function getSecondClass(record) {
  return record?.data?.classes?.[1] || null;
}

// The higher of the classes' Hit Points per level
function getClassHitPoints(record) {
  return Math.max(0, ...(record?.data?.classes || []).map((classObj) => parseInt(classObj?.data?.hp || 0, 10) || 0));
}

// The second class's proficiencies, where they're higher than the first's
function applySecondClassProficiencies(proficiencies, classObj) {
  const data = classObj?.data;
  if (!data) return;
  const raise = (key, value) => {
    proficiencies[key] = Math.max(proficiencies[key] || 0, parseInt(value || "0", 10) || 0);
  };
  raise("classDC", data.classDC);
  raise("perception", data.perception);
  raise("spellcasting", data.spellcasting);
  ["reflex", "fortitude", "will"].forEach((save) => raise(save, data.savingThrows?.[save]));
  ["unarmored", "light", "medium", "heavy"].forEach((armor) => raise(armor, data.defenses?.[armor]));
  ["unarmed", "simple", "martial", "advanced"].forEach((weapon) => raise(weapon, data.attacks?.[weapon]));
  const other = data.attacks?.other;
  const otherRank = parseInt(other?.rank || "0", 10) || 0;
  if (other?.name && otherRank > (proficiencies.otherRank || 0)) {
    proficiencies.otherName = other.name;
    proficiencies.otherRank = otherRank;
  }
}

// Feat slot levels with a second class: both classes' class feats, and the
// rest once per level at the levels either class gives them
function addSecondClassFeatLevels(levels, classObj, toLevels) {
  if (!classObj) return;
  levels.class = [...levels.class, ...toLevels(classObj.data?.classFeatLevels)];
  const union = (own, other) => [...new Set([...own, ...other])].sort((a, b) => a - b);
  levels.general = union(levels.general, toLevels(classObj.data?.generalFeatLevels));
  levels.skill = union(levels.skill, toLevels(classObj.data?.skillFeatLevels));
}

// The first class line's list shows only the first class
function getFirstClassFilters(record) {
  return getSecondClass(record) ? [{ field: "classSlot", operator: "equals", value: "first" }] : [];
}

const withClassSlot = (classObj, slot) => ({ ...classObj, data: { ...(classObj?.data || {}), classSlot: slot } });

// A class dropped on the first line replaces only the first class
function getClassesWithFirst(record, classObj) {
  const second = getSecondClass(record);
  return second ? [withClassSlot(classObj, "first"), second] : [classObj];
}

// The Main tab's second class line: shown with the setting on, or while a
// second class is still there so it can be cleared. Written only on a change,
// with a missing value counting as hidden.
function getDualClassFieldValues(record, variants = getVariantRules()) {
  const show = !!variants.dualClass || !!getSecondClass(record);
  const shown = record?.fields?.secondClassBox?.hidden === false;
  if (show && !shown) return { "fields.secondClassBox.hidden": false };
  if (!show && shown) return { "fields.secondClassBox.hidden": true };
  return {};
}

// What picking a second class writes. Null without a first class.
function getSecondClassValues(record, classObj) {
  const first = record?.data?.classes?.[0];
  if (!first || !classObj) return null;
  const traits = (classObj.data?.traits || []).filter((trait) => !getIsTraitRarity(trait));
  const current = record.data?.traits || [];
  const added = traits.filter((trait) => !current.includes(trait));
  return {
    "data.classes": [
      withClassSlot(first, "first"),
      { ...classObj, data: { ...classObj.data, classSlot: "second", traits } },
    ],
    "data.secondClassName": classObj.name,
    "data.traits": [...current, ...added],
    "data.traitsList": [
      ...(record.data?.traitsList || []),
      ...added.map((name) => ({ _id: generateUuid(), name, identified: true, data: {} })),
    ],
    "fields.pickSecondClassBtn.hidden": true,
    "fields.clearSecondClassBtn.hidden": false,
  };
}

// How many more skills the second class trains than the first (the larger
// number of additional skills applies)
function getSecondClassExtraSkills(first, second) {
  const additional = (classObj) => parseInt(classObj?.data?.trainedSkillsAdditional || 0, 10) || 0;
  return Math.max(0, additional(second) - additional(first));
}

function setSecondClass(record, classObj) {
  const values = getSecondClassValues(record, classObj);
  if (!values) return;
  const extra = getSecondClassExtraSkills(record.data?.classes?.[0], classObj);
  api.setValues(values, (updatedRecord) => {
    onAddEditFeature(updatedRecord, () => {
      api.sendMessage(
        `**${getCreatureName(record)}** adds **${classObj.name}** as a second class.${
          extra > 0 ? ` ${classObj.name} trains more additional skills: pick ${extra} more on the Skills tab.` : ""
        }`,
      );
    });
  });
}

// The Main tab's pick button
function pickSecondClass(record) {
  const first = record?.data?.classes?.[0];
  if (!first) {
    api.showNotification("Choose the first class before a second.", "yellow", "Dual-Class");
    return;
  }
  api.showPrompt(
    "Select a Second Class",
    "Select Class",
    "Select a Class...",
    null,
    { type: "class", query: { name: { $nin: [first.name, "Animal Companion", "Eidolon"] } } },
    (values) => {
      if (values?.length > 0) setSecondClass(record, values[0]);
    },
  );
}

// What clearing the second class writes: empty slots go, to be rebuilt for
// the class that's left. Chosen feats stay for the GM.
function getClearSecondClassValues(record) {
  const first = record?.data?.classes?.[0];
  return {
    "data.classes": first ? [first] : [],
    "data.secondClassName": "",
    "data.feats": (record?.data?.feats || []).filter((feat) => feat.data?.type !== "slot"),
    "fields.pickSecondClassBtn.hidden": false,
    "fields.clearSecondClassBtn.hidden": true,
  };
}

// The Main tab's delete button
function clearSecondClass(record) {
  api.setValues(getClearSecondClassValues(record), (updatedRecord) => {
    onAddEditFeature(updatedRecord, undefined, true);
  });
}

// Deleting the first class leaves the second on its own: both go, as a second
// class needs a first. {} when there's nothing to clear.
function getDeleteFirstClassValues(record) {
  const remaining = record?.data?.classes || [];
  if (!remaining.some((classObj) => classObj?.data?.classSlot === "second")) return {};
  return {
    "data.classes": [],
    "data.secondClassName": "",
    "fields.pickSecondClassBtn.hidden": false,
    "fields.clearSecondClassBtn.hidden": true,
  };
}
