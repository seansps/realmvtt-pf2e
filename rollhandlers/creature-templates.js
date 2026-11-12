// Undead creature adjustments (Book of the Dead pg. 72-73), applied like the
// creature builder's Rescale: to selected unlinked NPC tokens, one write each,
// and undone with Reset. Book of the Dead predates the remaster, so negative
// healing is void healing, positive weakness is vitality weakness, and
// negative damage is void damage. Changes the rules leave to judgment (which
// Strikes drain life, a new jaws Strike) are noted on the card for the GM.

// [highest level, value]: the level-based numbers on the adjustment tables
const UNDEAD_WEAKNESS = [[3, 3], [8, 5], [13, 10], [Infinity, 15]];
const SKELETON_ADJUSTMENT = [[-1, 2, 2], [1, 4, 2], [5, 10, 3], [10, 20, 5], [Infinity, 40, 10]];
const VAMPIRE_ADJUSTMENT = [[-1, 3, 2], [1, 5, 2], [5, 10, 3], [10, 20, 5], [Infinity, 40, 10]];

const BASE_UNDEAD_IMMUNITIES = ["death effects", "disease", "paralyzed", "poison", "unconscious"];

const UNDEAD_ABILITIES = {
  voidHealing: ["Void Healing", "A creature with void healing draws health from void energy: void effects that heal undead heal it, and vitality damage harms it."],
  ghostlyPassage: ["Ghostly Passage", "One action. The creature Flies, passing through walls, creatures and other material obstacles as though incorporeal. It must start and end outside any obstacle, and passing through solid material is difficult terrain."],
  paralysis: ["Paralysis", "When the creature critically hits a living, non-elf foe of its level or lower with its jaws, the foe is paralyzed until the end of its next turn."],
  swiftLeap: ["Swift Leap", "One action (move). The creature jumps up to half its Speed without triggering reactions."],
  lesserDespair: ["Lesser Despair", "Aura (emotion, fear, mental) 30 feet. Living creatures of the creature's level or lower are frightened 1 in the aura, can't recover from it there, and recover as soon as they leave."],
  slink: ["Slink in Shadows", "The creature can Hide or end its Sneak in a creature's or object's shadow."],
  feed: ["Feed", "One action. Requirement: its last action was a jaws or fangs Strike that dealt damage. It drains blood, dealing that Strike's minimum damage and regaining Hit Points (see the card)."],
  drainLife: ["Drain Life", "When a Strike with drain life damages a living creature, this creature gains temporary Hit Points equal to its level, and the target must succeed at a Fortitude save (moderate DC for its level) or become drained 1."],
};

const UNDEAD_TEMPLATES = {
  undead: { label: "Undead", traits: ["Undead"], necril: true, immunities: BASE_UNDEAD_IMMUNITIES, abilities: ["voidHealing"] },
  undeadMindless: { label: "Undead (mindless)", traits: ["Undead", "Mindless"], immunities: [...BASE_UNDEAD_IMMUNITIES, "mental"], abilities: ["voidHealing"] },
  ghost: { label: "Ghost", traits: ["Ghost", "Spirit", "Undead"], necril: true, immunities: [...BASE_UNDEAD_IMMUNITIES, "precision"], weaknesses: ["force", "ghost touch", "vitality"], voidStrikes: true, fly: true, abilities: ["voidHealing", "ghostlyPassage"] },
  ghoul: { label: "Ghoul", traits: ["Ghoul", "Undead"], immunities: BASE_UNDEAD_IMMUNITIES, saves: -1, abilities: ["voidHealing", "paralysis", "swiftLeap"], note: "Paralysis goes on its jaws, fangs or similar attack; without one, give it a jaws Strike like its strongest melee Strike." },
  mummy: { label: "Mummy", traits: ["Mummy", "Undead"], necril: true, immunities: BASE_UNDEAD_IMMUNITIES, weaknesses: ["fire"], abilities: ["voidHealing", "lesserDespair"] },
  shadow: { label: "Shadow", traits: ["Undead"], necril: true, immunities: [...BASE_UNDEAD_IMMUNITIES, "precision"], weaknesses: ["force", "ghost touch", "vitality"], voidStrikes: true, fly: true, stealth: true, abilities: ["voidHealing", "slink"], note: "It can cast darkness as an innate divine spell once per day." },
  skeleton: { label: "Skeleton", traits: ["Skeleton", "Undead"], necril: true, immunities: BASE_UNDEAD_IMMUNITIES, skeleton: true, abilities: ["voidHealing"] },
  skeletonMindless: { label: "Skeleton (mindless)", traits: ["Skeleton", "Undead", "Mindless"], immunities: [...BASE_UNDEAD_IMMUNITIES, "mental"], skeleton: true, abilities: ["voidHealing"] },
  vampireColdIron: { label: "Vampire (cold iron bypasses)", traits: ["Undead", "Vampire"], necril: true, immunities: ["death effects", "disease", "paralyzed", "poison", "sleep"], vampire: "cold iron", abilities: ["voidHealing", "feed"] },
  vampireSilver: { label: "Vampire (silver bypasses)", traits: ["Undead", "Vampire"], necril: true, immunities: ["death effects", "disease", "paralyzed", "poison", "sleep"], vampire: "silver", abilities: ["voidHealing", "feed"] },
  vampireWood: { label: "Vampire (wood bypasses)", traits: ["Undead", "Vampire"], necril: true, immunities: ["death effects", "disease", "paralyzed", "poison", "sleep"], vampire: "wood", abilities: ["voidHealing", "feed"] },
  wight: { label: "Wight", traits: ["Undead", "Wight"], necril: true, immunities: BASE_UNDEAD_IMMUNITIES, abilities: ["voidHealing", "drainLife"], note: "Drain life goes on any of its Strikes you choose; each one's damage drops by half its level." },
};

function getLevelRow(table, level) {
  return table.find((row) => level <= row[0]) || table[table.length - 1];
}

function iwrRow(type, value) {
  return {
    _id: generateUuid(),
    name: "New IWR",
    unidentifiedName: "IWR",
    recordType: "records",
    identified: true,
    data: value === undefined ? { type } : { type, value },
  };
}

function iwrLabel(rows) {
  return rows
    .map((row) => `${row.data?.type}${row.data?.value !== undefined && row.data?.value !== "" ? ` ${row.data.value}` : ""}${row.data?.exceptions ? ` (except ${row.data.exceptions})` : ""}`)
    .join(", ");
}

// Every value a template writes to the token (one write), and lines for the
// GM's card
function getCreatureTemplateValues(token, key) {
  const template = UNDEAD_TEMPLATES[key];
  if (!template) return null;
  const data = token.data || {};
  const level = getCreatureNumber(data.level);
  const values = {};
  const lines = [];

  // Traits
  const traits = [...(data.traits || [])];
  const traitsList = [...(data.traitsList || [])];
  template.traits.forEach((trait) => {
    if (traits.some((t) => `${t}`.toLowerCase() === trait.toLowerCase())) return;
    traits.push(trait);
    traitsList.push({ _id: generateUuid(), name: trait, identified: true, data: {} });
  });
  values["data.traits"] = traits;
  values["data.traitsList"] = traitsList;

  // Necril
  if (template.necril) {
    const languages = Array.isArray(data.languages) ? [...data.languages] : [];
    if (!languages.some((language) => /necril/i.test(`${language}`))) {
      values["data.languages"] = [...languages, "Necril"];
      values["data.languagesList"] = [...(data.languagesList || []), { _id: generateUuid(), name: "Necril", identified: true, data: {} }];
    }
  }

  // Darkvision
  if (!/darkvision/i.test(`${data.senses || ""}`)) {
    values["data.senses"] = data.senses ? `${data.senses}, Darkvision` : "Darkvision";
  }

  // Immunities
  const immunities = [...(data.immunities || [])];
  template.immunities.forEach((type) => {
    if (!immunities.some((row) => `${row.data?.type}`.toLowerCase() === type)) immunities.push(iwrRow(type));
  });
  values["data.immunities"] = immunities;
  values["data.immunitiesLabel"] = iwrLabel(immunities);

  // Weaknesses by level
  if (template.weaknesses) {
    const amount = getLevelRow(UNDEAD_WEAKNESS, level)[1];
    const weaknesses = [...(data.weaknesses || [])];
    template.weaknesses.forEach((type) => {
      const index = weaknesses.findIndex((row) => `${row.data?.type}`.toLowerCase() === type);
      if (index >= 0) weaknesses[index] = { ...weaknesses[index], data: { ...weaknesses[index].data, value: Math.max(amount, getCreatureNumber(weaknesses[index].data?.value)) } };
      else weaknesses.push(iwrRow(type, amount));
    });
    values["data.weaknesses"] = weaknesses;
    values["data.weaknessesLabel"] = iwrLabel(weaknesses);
  }

  // Skeleton: less HP, resistances
  if (template.skeleton) {
    const [, decrease, resistance] = getLevelRow(SKELETON_ADJUSTMENT, level);
    setCreatureHp(values, data, Math.max(1, getCreatureNumber(data.hitpoints) - decrease));
    const resistances = [...(data.resistances || [])];
    ["cold", "electricity", "fire", "piercing", "slashing"].forEach((type) => {
      if (!resistances.some((row) => `${row.data?.type}`.toLowerCase() === type)) resistances.push(iwrRow(type, resistance));
    });
    values["data.resistances"] = resistances;
    values["data.resistancesLabel"] = iwrLabel(resistances);
    lines.push(`Hit Points ${decrease} lower, resistance ${resistance} to cold, electricity, fire, piercing and slashing.`);
  }

  // Vampire: less HP, physical resistance with a material that bypasses it
  if (template.vampire) {
    const [, decrease, resistance] = getLevelRow(VAMPIRE_ADJUSTMENT, level);
    setCreatureHp(values, data, Math.max(1, getCreatureNumber(data.hitpoints) - decrease));
    const row = iwrRow("physical", resistance);
    row.data.exceptions = template.vampire;
    const resistances = [...(data.resistances || []), row];
    values["data.resistances"] = resistances;
    values["data.resistancesLabel"] = iwrLabel(resistances);
    lines.push(`Hit Points ${decrease} lower, resistance ${resistance} to physical (except ${template.vampire}). Feed regains ${resistance} Hit Points. Give it a fangs Strike that deals its lowest melee Strike's damage if it has no jaws or fangs.`);
  }

  // Ghoul: saves 1 lower
  if (template.saves) {
    ["fortitudeMod", "reflexMod", "willMod"].forEach((field) => {
      if (data[field] !== undefined && data[field] !== "") values[`data.${field}`] = getCreatureNumber(data[field]) + template.saves;
    });
    lines.push("All saving throw modifiers 1 lower.");
  }

  // Shadow: Stealth at its best skill modifier
  if (template.stealth) {
    const skills = [...(data.skills || [])];
    const best = Math.max(0, ...skills.map((row) => getCreatureNumber(row.data?.mod)));
    const index = skills.findIndex((row) => `${row.name}`.toLowerCase() === "stealth");
    const row = { _id: index >= 0 ? skills[index]._id : generateUuid(), name: "Stealth", unidentifiedName: "Stealth", recordType: "records", identified: true, data: { mod: best, skillWithMod: `Stealth +${best}` } };
    if (index >= 0) skills[index] = row;
    else skills.push(row);
    values["data.skills"] = skills;
  }

  // Ghost and shadow: physical Strikes deal void damage and are magical
  if (template.voidStrikes) {
    (data.attacks || []).forEach((attack, attackIndex) => {
      let changed = false;
      (attack.data?.damageRolls || []).forEach((roll, rollIndex) => {
        if (["bludgeoning", "piercing", "slashing"].includes(`${roll.data?.type}`.toLowerCase())) {
          values[`data.attacks.${attackIndex}.data.damageRolls.${rollIndex}.data.type`] = "void";
          changed = true;
        }
      });
      if (changed) {
        const traitsOnAttack = attack.data?.traits || [];
        if (!traitsOnAttack.some((t) => `${t}`.toLowerCase() === "magical")) {
          values[`data.attacks.${attackIndex}.data.traits`] = [...traitsOnAttack, "Magical"];
        }
        const damage = `${attack.data?.damage || ""}`.replace(/\b(bludgeoning|piercing|slashing)\b/gi, "void");
        if (damage) values[`data.attacks.${attackIndex}.data.damage`] = damage;
      }
    });
    lines.push("Its physical Strikes deal void damage and are magical.");
  }
  if (template.fly) {
    lines.push("If it can't fly, its highest Speed becomes a fly Speed, and it loses its other Speeds (set on its Speeds).");
  }

  // Abilities, as passive actions on its sheet
  const actions = [...(data.actions || [])];
  template.abilities.forEach((name) => {
    const [title, text] = UNDEAD_ABILITIES[name];
    if (actions.some((action) => action.name === title)) return;
    actions.push({
      _id: generateUuid(),
      name: title,
      recordType: "actions",
      identified: true,
      unidentifiedName: "Unidentified Action",
      data: { type: "passive", actions: "", actionType: "passive", actionCategory: "defensive", description: `<p>${text}</p>`, traits: [], traitsList: [] },
      fields: { actions: { hidden: true } },
    });
  });
  values["data.actions"] = actions;
  if (template.note) lines.push(template.note);

  return { values, lines, label: template.label };
}

// Every template adds the Undead trait, so a creature that has it already
// (a template applied before, or one undead to begin with) isn't adjusted
// again: a second HP decrease or physical resistance would stack
function isAlreadyUndead(token) {
  return (token?.data?.traits || []).some((trait) => `${trait?.name ?? trait ?? ""}`.toLowerCase() === "undead");
}

// GM Tools: Template, for the selected unlinked NPC tokens
function applySelectedCreatureTemplate() {
  const tokens = getCreatureEditable(getCreatureTokens());
  if (!tokens.length) return;
  api.showPrompt(
    "Creature Builder",
    "Which undead adjustment? (Book of the Dead pg. 72-73)",
    "Select...",
    Object.entries(UNDEAD_TEMPLATES).map(([key, template]) => ({ label: template.label, value: key })),
    null,
    (choice) => {
      const key = pick(choice);
      tokens.forEach((token) => {
        if (isAlreadyUndead(token)) {
          api.sendMessage(getCreatureGmLines([`**${getCreatureName(token)}** is already undead, so it's left as it is. Reset it first to apply a different adjustment.`]));
          return;
        }
        const result = getCreatureTemplateValues(token, key);
        if (!result) return;
        api.setValuesOnTokenById(token._id, token.recordType, result.values);
        api.sendMessage(getCreatureGmLines([`**${getCreatureName(token)}** gets the ${result.label} adjustments (Reset undoes them).`, ...result.lines]));
      });
    },
  );
}
