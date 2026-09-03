// Generates a random UUID for adding Subskills manually to Skills during character creation
function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    // Generate a random number between 0 and 15 (0xF)
    const r = Math.floor(Math.random() * 16);
    // For 'x', use random digit
    // For 'y', use random digit with bits 0 and 1 set to 1 and 0 respectively (8, 9, A, or B)
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    // Convert to hexadecimal string
    return v.toString(16);
  });
}

function getEffectAppliedBy(record, effect) {
  const effectValue = record?.effectValues?.[effect?._id];
  if (effectValue && effectValue?.tokenId !== "null") {
    return effectValue?.tokenId;
  }
  return null;
}

const getNearestParentDataPath = (dataPath) => {
  const parts = dataPath.split(".data");
  return parts.length > 1 ? parts.slice(0, -1).join(".data") : "";
};

function capitalize(string) {
  if (!string || typeof string !== "string") return "";
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function normalToCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/\s+(.)/g, (match, char) => char.toUpperCase());
}

function camelToNormal(skill) {
  return skill.replace(/([A-Z])/g, " $1").replace(/^./, function (str) {
    return str.toUpperCase();
  });
}

function convertToDataPaths(data) {
  const result = {};

  function processObject(obj, currentPath = "") {
    // Exit early if obj is null or undefined
    if (obj === null || obj === undefined) return;

    // Handle arrays and objects differently
    if (Array.isArray(obj)) {
      // For arrays, we store the entire array at the current path
      result[currentPath] = obj;
    } else if (typeof obj === "object") {
      // For objects, recursively process each property
      Object.keys(obj).forEach((key) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;

        // If the value is a primitive or an array, add it directly to the result
        if (
          typeof obj[key] !== "object" ||
          Array.isArray(obj[key]) ||
          obj[key] === null
        ) {
          result[newPath] = obj[key];
        } else {
          // Otherwise, recursively process the nested object
          processObject(obj[key], newPath);
        }
      });
    } else {
      // Handle primitive values
      result[currentPath] = obj;
    }
  }

  processObject(data);
  return result;
}

function evaluateMath(stringValue) {
  // Return 0 if no value provided
  if (!stringValue) return 0;

  try {
    // Remove all whitespace
    let sanitizedString = stringValue.replace(/\s+/g, "");

    // Replace floor() and ceil() with Math.floor() and Math.ceil()
    sanitizedString = sanitizedString.replace(/floor\(/g, "Math.floor(");
    sanitizedString = sanitizedString.replace(/ceil\(/g, "Math.ceil(");
    // Replace min(), max(), and abs() with Math.min(), Math.max(), and Math.abs()
    sanitizedString = sanitizedString.replace(/min\(/g, "Math.min(");
    sanitizedString = sanitizedString.replace(/max\(/g, "Math.max(");
    sanitizedString = sanitizedString.replace(/abs\(/g, "Math.abs(");

    // Validate string only contains valid math characters and functions
    // Allow: digits, operators, parentheses, and Math.floor/Math.ceil/Math.min/Math.max/Math.abs
    if (!/^[0-9+\-*/().Mathflorceuimnxbs]+$/.test(sanitizedString)) {
      return 0;
    }

    // Use Function constructor to safely evaluate the math expression
    // Note: Result is not automatically floored to allow ceil() to work properly
    return Function(`'use strict'; return (${sanitizedString})`)();
  } catch (e) {
    // Return 0 if evaluation fails
    return 0;
  }
}

/**
 * Updates the display name/label for IWR (Immunities/Weaknesses/Resistances) lists
 * @param {string} listType - Optional. The list type to update ('immunities', 'resistances', 'weaknesses').
 *                            If not provided, will be inferred from the current dataPath.
 */
function updateIWRName(listType) {
  // If listType not provided, infer from dataPath
  if (!listType) {
    const parentPath = getNearestParentDataPath(dataPath);
    // Path looks like: data.resistances.0.data or data.immunities.0.data
    const pathParts = parentPath.split(".");
    listType = pathParts[1]; // e.g., 'immunities', 'resistances', 'weaknesses'
  }

  // Get all entries in this list
  const listPath = `data.${listType}`;
  const iwrList = api.getValue(listPath) || [];

  const typeOptions = [
    { label: "all damage", value: "all-damage" },
    { label: "bludgeoning", value: "bludgeoning" },
    { label: "piercing", value: "piercing" },
    { label: "slashing", value: "slashing" },
    { label: "acid", value: "acid" },
    { label: "bleed", value: "bleed" },
    { label: "cold", value: "cold" },
    { label: "electricity", value: "electricity" },
    { label: "fire", value: "fire" },
    { label: "force", value: "force" },
    { label: "mental", value: "mental" },
    { label: "poison", value: "poison" },
    { label: "precision", value: "precision" },
    { label: "sonic", value: "sonic" },
    { label: "spirit", value: "spirit" },
    { label: "vitality", value: "vitality" },
    { label: "void", value: "void" },
  ];

  // Build a string for each entry
  const entryStrings = iwrList
    .map((iwrData) => {
      if (!iwrData?.data?.type) return "";

      const typeOption = typeOptions.find(
        (opt) => opt.value === iwrData.data.type,
      );
      const typeLabel = typeOption ? typeOption.label : iwrData.data.type || "";

      let name = typeLabel;

      // Add value if present and not hidden
      if (iwrData.data.value && !iwrData.fields?.valueBox?.hidden) {
        name += ` ${iwrData.data.value}`;
      }

      // Build exception clause
      const exceptions =
        Array.isArray(iwrData.data.exceptions) &&
        iwrData.data.exceptions.length > 0
          ? iwrData.data.exceptions
          : [];
      const doubleVs =
        Array.isArray(iwrData.data.doubleVs) && iwrData.data.doubleVs.length > 0
          ? iwrData.data.doubleVs
          : [];

      if (exceptions.length > 0 || doubleVs.length > 0) {
        name += " (";

        const clauses = [];

        if (exceptions.length > 0) {
          let exceptionText = "except ";
          if (exceptions.length === 1) {
            exceptionText += exceptions[0];
          } else if (exceptions.length === 2) {
            exceptionText += `${exceptions[0]} or ${exceptions[1]}`;
          } else {
            exceptionText +=
              exceptions.slice(0, -1).join(", ") +
              ", or " +
              exceptions.slice(-1);
          }
          clauses.push(exceptionText);
        }

        if (doubleVs.length > 0) {
          // Determine the word based on list type
          let resistanceWord = "resistance";
          if (listType === "weaknesses") {
            resistanceWord = "weakness";
          } else if (listType === "immunities") {
            resistanceWord = "immunity";
          }
          clauses.push(`double ${resistanceWord} vs. ${doubleVs.join(", ")}`);
        }

        name += clauses.join("; ");
        name += ")";
      }

      return name;
    })
    .filter((str) => str); // Remove empty strings

  // Join all entries with commas
  const fullLabel = entryStrings.join(", ");

  // Set the appropriate label field based on list type
  const labelField = `data.${listType}Label`;
  api.setValues({
    [labelField]: fullLabel,
  });
}

function applyMath(value, math) {
  // Trim spaces and split the string into operator and number
  const trimmedMath = math.trim();
  const operator = trimmedMath.charAt(0);
  const number = parseInt(trimmedMath.slice(1).trim(), 10);

  if (isNaN(number)) {
    return value;
  }

  switch (operator) {
    case "+":
      return value + number;
    case "-":
      return value - number;
    case "*":
      return value * number;
    case "/":
      return Math.floor(value / number); // Always round down
    default:
      return value;
  }
}

function getDurationInSeconds(duration) {
  if (!duration) return 0;

  // Parse the string to get the number and unit
  const match = duration.match(/(\d+)\s+(round|minute|hour|day|week)s?/i);
  if (match) {
    const timeAmount = parseInt(match[1], 10);
    if (isNaN(timeAmount)) {
      return 0;
    }

    const timeUnit = match[2].toLowerCase();
    switch (timeUnit) {
      case "round":
        return timeAmount * 6; // 1 round = 6 seconds
      case "minute":
        return timeAmount * 60; // 1 minute = 60 seconds
      case "hour":
        return timeAmount * 3600; // 1 hour = 3600 seconds
      case "day":
        return timeAmount * 86400; // 1 day = 86400 seconds
      case "week":
        return timeAmount * 604800; // 1 week = 604800 seconds
      default:
        return 0;
    }
  }
  return 0;
}

function getLabelForAbility(ability) {
  if (ability === "str") {
    return "Strength";
  } else if (ability === "dex") {
    return "Dexterity";
  } else if (ability === "con") {
    return "Constitution";
  } else if (ability === "wis") {
    return "Wisdom";
  } else if (ability === "int") {
    return "Intelligence";
  } else if (ability === "cha") {
    return "Charisma";
  }
  return ability;
}

function getDamageType(rollString) {
  const regex = /(?:\d*d\d+|\+\d+)?(?:\s*\+?-?\s*\d+)?(?:\s+([\w-_]+))?/;
  const match = rollString.match(regex);
  return match && match[1] ? match[1] : "untyped";
}

/**
 * Extracts the die size from a spell's main damage formula
 * For example, "2d6 fire" returns "6", "1d8+2 cold" returns "8"
 * @param {Object} spell - The spell object with data.damage array
 * @returns {string} - The die size (e.g., "6", "8", "10") or empty string if none found
 */
function getSpellDieSize(spell) {
  if (!spell || !spell.data || !spell.data.damage) {
    return "";
  }

  const damageArray = spell.data.damage;
  if (!Array.isArray(damageArray) || damageArray.length === 0) {
    return "";
  }

  // Get the first damage entry's formula
  const firstDamage = damageArray[0];
  const formula = firstDamage?.data?.formula || "";

  // Extract die size from formula like "2d6", "1d8+2", "d10", etc.
  const dieMatch = formula.match(/\dd(\d+)/);
  if (dieMatch && dieMatch[1]) {
    return dieMatch[1];
  }

  return "";
}

// Checks for replacements in a string modifier
function checkForReplacements(
  value,
  replacements = {},
  recordOverride = null,
  effectContext = null,
  context = {},
) {
  let thisRecord = recordOverride || record;

  // Ensure value is a string for regex operations
  if (typeof value !== "string") {
    value = String(value || "");
  }

  // Replace @effect.count with the number of times this effect appears
  if (value.includes("@effect.count") && effectContext?._id) {
    const effectIds = thisRecord?.effectIds || [];
    const count =
      effectIds.filter((id) => id === effectContext._id).length || 1;
    value = value.replaceAll("@effect.count", String(count));
  }

  // Replace @actor.level with actual level
  const actorLevel = parseInt(thisRecord?.data?.level || "1", 10);
  value = value.replaceAll("@actor.level", String(actorLevel));

  // Replace things like @actor.abilities.int.mod with record.data.int
  value = value.replaceAll(
    /@actor\.abilities\.(str|dex|con|int|wis|cha)\.mod/g,
    (_match, ability) => {
      return String(parseInt(thisRecord?.data?.[ability] || "0", 10));
    },
  );

  // Replace all @record.data.... with the value of the field
  value = value.replaceAll(/@record\.data\.([\w.]+)/g, (_match, field) => {
    const fullPath = `data.${field}`;
    return api.getValueOnRecord(thisRecord, fullPath) || "";
  });

  // Replace @dieSize with the spell's or weapon's main damage die size
  if (value.includes("@dieSize")) {
    let dieSize = "";
    if (context?.spell) {
      dieSize = getSpellDieSize(context.spell);
    } else if (context?.weapon) {
      dieSize = context.weapon.data?.damage?.die || "";
    }
    if (dieSize) {
      // Strip leading 'd' if present to avoid duplication (e.g., 1d@dieSize -> 1d6 not 1dd6)
      dieSize = dieSize.replace(/^d/i, "");
      // Replace d@dieSize pattern first to avoid dd duplication
      value = value.replaceAll("d@dieSize", "d" + dieSize);
      // Then replace any remaining @dieSize
      value = value.replaceAll("@dieSize", dieSize);
    }
  }

  // Replace @weaponDie with the weapon's damage die
  if (value.includes("@weaponDie") && context?.weapon) {
    let weaponDie = context.weapon.data?.damage?.die;
    if (weaponDie) {
      // Strip leading 'd' if present to avoid duplication (e.g., 1d@weaponDie -> 1d6 not 1dd6)
      weaponDie = weaponDie.replace(/^d/i, "");
      // Replace d@weaponDie pattern first to avoid dd duplication
      value = value.replaceAll("d@weaponDie", "d" + weaponDie);
      // Then replace any remaining @weaponDie
      value = value.replaceAll("@weaponDie", weaponDie);
    }
  }

  // Case for 'Half Level' or 'Half Character Level'
  const matchHalfLevel =
    value.match(/[Hh]alf [Cc]haracter [Ll]evel/) ||
    value.match(/[Hh]alf [Ll]evel/);
  const matchCharacterLevel =
    value.match(/[Cc]haracter [Ll]evel/) || value.match(/[Ll]evel/);
  if (matchHalfLevel) {
    // Minimum of 1 if half level is 0
    value = value.replaceAll(
      matchHalfLevel[0],
      String(Math.max(1, Math.floor(actorLevel / 2))),
    );
  } else if (matchCharacterLevel) {
    // Minimum of 1
    value = value.replaceAll(matchCharacterLevel[0], String(actorLevel));
  }

  // Case for Strength|Dexterity|Constitution|Wisdom|Intelligence|Charisma
  const matchModifier = value.match(
    /[Ss]trength|[Dd]exterity|[Cc]onstitution|[Ww]isdom|[Ii]ntelligence|[Cc]harisma/,
  );
  if (matchModifier) {
    let attribute = "str";
    if (matchModifier[0].toLowerCase().includes("dexterity")) {
      attribute = "dex";
    } else if (matchModifier[0].toLowerCase().includes("constitution")) {
      attribute = "con";
    } else if (matchModifier[0].toLowerCase().includes("wisdom")) {
      attribute = "wis";
    } else if (matchModifier[0].toLowerCase().includes("intelligence")) {
      attribute = "int";
    } else if (matchModifier[0].toLowerCase().includes("charisma")) {
      attribute = "cha";
    }
    const attributeMod = parseInt(
      thisRecord?.data?.[`${attribute}`] || "0",
      10,
    );
    value = value.replaceAll(matchModifier[0], attributeMod);
  }

  // Check for replacements in the replacements object
  if (replacements && Object.keys(replacements).length > 0) {
    Object.keys(replacements).forEach((key) => {
      value = value.replaceAll(key, replacements[key]);
    });
  }

  // Process formulas: ternary() and comparison functions
  // This handles expressions like: ternary(lt(@actor.level, 5), 1, 2)
  value = evaluateFormula(value);

  // Evaluate mathematical expressions in curly braces
  // Example: {5*(@record.data.effects.energyAbsorption.level - 1)}
  value = value.replace(/\{([^}]+)\}/g, (_match, expression) => {
    // The expression should already have @record.data references replaced
    const result = evaluateMath(expression);
    return String(result);
  });

  return value;
}

// Helper function to evaluate formulas
function evaluateFormula(formula) {
  if (typeof formula !== "string") {
    return formula;
  }

  // Keep evaluating until no more functions are found
  let previousFormula = "";
  let iterations = 0;
  const maxIterations = 50; // Prevent infinite loops

  while (formula !== previousFormula && iterations < maxIterations) {
    previousFormula = formula;
    iterations++;

    // Evaluate comparison functions: lt, lte, gt, gte, eq, ne
    // lt(a, b) - less than
    formula = formula.replace(/lt\(([^,]+),\s*([^)]+)\)/g, (_match, a, b) => {
      const numA = parseFloat(a.trim());
      const numB = parseFloat(b.trim());
      return numA < numB ? "1" : "0";
    });

    // lte(a, b) - less than or equal
    formula = formula.replace(/lte\(([^,]+),\s*([^)]+)\)/g, (_match, a, b) => {
      const numA = parseFloat(a.trim());
      const numB = parseFloat(b.trim());
      return numA <= numB ? "1" : "0";
    });

    // gt(a, b) - greater than
    formula = formula.replace(/gt\(([^,]+),\s*([^)]+)\)/g, (_match, a, b) => {
      const numA = parseFloat(a.trim());
      const numB = parseFloat(b.trim());
      return numA > numB ? "1" : "0";
    });

    // gte(a, b) - greater than or equal
    formula = formula.replace(/gte\(([^,]+),\s*([^)]+)\)/g, (_match, a, b) => {
      const numA = parseFloat(a.trim());
      const numB = parseFloat(b.trim());
      return numA >= numB ? "1" : "0";
    });

    // eq(a, b) - equal
    formula = formula.replace(/eq\(([^,]+),\s*([^)]+)\)/g, (_match, a, b) => {
      const numA = parseFloat(a.trim());
      const numB = parseFloat(b.trim());
      return numA === numB ? "1" : "0";
    });

    // ne(a, b) - not equal
    formula = formula.replace(/ne\(([^,]+),\s*([^)]+)\)/g, (_match, a, b) => {
      const numA = parseFloat(a.trim());
      const numB = parseFloat(b.trim());
      return numA !== numB ? "1" : "0";
    });

    // Evaluate ternary: ternary(condition, trueValue, falseValue)
    // We need to handle nested ternaries by finding matching parentheses
    const ternaryMatch = findTernary(formula);
    if (ternaryMatch) {
      const { start, end, condition, trueValue, falseValue } = ternaryMatch;
      const conditionNum = parseFloat(condition.trim());
      // Any non-zero value is true
      const result = conditionNum !== 0 ? trueValue.trim() : falseValue.trim();
      formula = formula.substring(0, start) + result + formula.substring(end);
    }
  }

  return formula;
}

// Helper function to find and parse a ternary expression with proper parenthesis matching
function findTernary(str) {
  const ternaryIndex = str.indexOf("ternary(");
  if (ternaryIndex === -1) return null;

  const startIndex = ternaryIndex;
  let pos = ternaryIndex + 8; // Position after "ternary("
  let parenDepth = 1;
  let commaPositions = [];

  // Find commas at depth 1 (not inside nested parentheses)
  while (pos < str.length && parenDepth > 0) {
    const char = str[pos];
    if (char === "(") {
      parenDepth++;
    } else if (char === ")") {
      parenDepth--;
      if (parenDepth === 0) break;
    } else if (char === "," && parenDepth === 1) {
      commaPositions.push(pos);
    }
    pos++;
  }

  // We need exactly 2 commas for ternary(condition, trueValue, falseValue)
  if (commaPositions.length !== 2 || parenDepth !== 0) {
    return null;
  }

  const conditionStart = ternaryIndex + 8;
  const conditionEnd = commaPositions[0];
  const trueValueStart = commaPositions[0] + 1;
  const trueValueEnd = commaPositions[1];
  const falseValueStart = commaPositions[1] + 1;
  const falseValueEnd = pos;
  const endIndex = pos + 1; // Include the closing paren

  return {
    start: startIndex,
    end: endIndex,
    condition: str.substring(conditionStart, conditionEnd),
    trueValue: str.substring(trueValueStart, trueValueEnd),
    falseValue: str.substring(falseValueStart, falseValueEnd),
  };
}

function getTotalValueFromFields(
  recordContext,
  fieldsToAddToUses,
  fieldValueOverrides,
) {
  let total = 0;
  let times5 = false;
  let plus1 = false;
  fieldsToAddToUses.forEach((field) => {
    let value = 0;
    if (field === "times5") {
      times5 = true;
    } else if (field === "plus1") {
      plus1 = true;
    } else if (isClassLevel(field)) {
      value = getClassLevel(recordContext, field, fieldValueOverrides);
    } else {
      value = parseInt(recordContext?.data?.[field] || "0", 10);
    }
    if (isNaN(value)) {
      value = 0;
    }
    if (fieldValueOverrides && fieldValueOverrides[`data.${field}`]) {
      value = parseInt(fieldValueOverrides[`data.${field}`], 10);
      if (isNaN(value)) {
        value = 0;
      }
    }
    total += value;
  });
  // Minimum of 1
  if (total < 1) {
    total = 1;
  }
  if (times5) {
    total *= 5;
  }
  if (plus1) {
    total += 1;
  }
  return total;
}

// In this call, we look for effects that are relevant to the caller and the target
function getAttackModifiersForTarget(target, distance) {
  if (!target) {
    return [];
  }

  let results = [];

  // Get effects that are relevant to the target
  const effectsToCheck = ["attackTargeting"];
  // If we're within 5 feet, add the attackTargetingFive effect
  if (distance !== undefined && distance !== null && distance <= 5) {
    effectsToCheck.push("attackTargetingFive");
  }
  // If we're greater than 5 feet, add the attackTargetingGreaterFive effect
  if (distance !== undefined && distance > 5) {
    effectsToCheck.push("attackTargetingGreaterFive");
  }
  const attackTargetingEffects = getEffectsAndModifiersForToken(
    target,
    effectsToCheck,
  );
  attackTargetingEffects.forEach((r) => {
    results.push({
      ...r,
      name: r.isEffect ? `Target Has the ${r.name} Effect` : r.name,
    });
  });

  return results;
}

// In this call we look for effects that are relevant to the caller and the target for damage rolls
function getDamageEffectsForTarget(ourToken, target) {
  if (!target) {
    return [];
  }

  let results = [];

  // Get effects that are relevant to the target
  // damageTargetBonus is for damage bonuses to attacks specific to the target
  // and the token that applied the effect
  const effectsToCheck = ["damageTargetBonus"];

  const damageEffects = getEffectsAndModifiersForToken(
    target, // Look for effects on this target
    effectsToCheck, // that match damageTargetBonus
    "", // field is irrelevant
    undefined, // itemId is irrelevant
    ourToken?._id, // appliedById is the caller
  );

  damageEffects.forEach((r) => {
    results.push({
      ...r,
      name: r.isEffect ? `Target Has the ${r.name} Effect` : r.name,
    });
  });

  return results;
}

// Helper to convert name to kebab-case slug
const toSlug = (name) => {
  return (name || "")
    .replace(/[''ʼ`]/g, "") // Remove all types of apostrophes and quotes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
};

/**
 * Collects all relevant traits and properties from a token and context objects
 * for predicate evaluation.
 *
 * @param {Object} token - The token/record to check
 * @param {Object} context - Context object containing additional objects like weapon, spell, etc.
 * @param {boolean} skipRollOptions - If true, skip adding stored rollOptions (used by updateRollOptions)
 * @returns {Set} Set of all trait strings (e.g., "self:trait:fire", "item:damage:type:slashing")
 */
function collectTraitsAndProperties(
  token,
  context = {},
  skipRollOptions = false,
) {
  const traits = new Set();

  // Collect traits from the token itself
  if (token?.data?.traits) {
    const tokenTraits = Array.isArray(token.data.traits)
      ? token.data.traits
      : [];

    tokenTraits.forEach((trait) => {
      const traitName = typeof trait === "string" ? trait : trait.name;
      if (traitName) {
        traits.add(`self:trait:${traitName.toLowerCase()}`);
      }
    });
  }

  // Collect token type (e.g., "npc", "character")
  // recordType can be "tokens", "npcs", or "characters"
  if (token?.recordType) {
    if (token.recordType === "tokens" || token.recordType === "npcs") {
      traits.add(`self:type:npc`);
    } else if (token.recordType === "characters") {
      traits.add(`self:type:character`);
    }
  }

  // Collect conditions from effects (e.g., "Prone" becomes "self:condition:prone")
  if (token?.effects) {
    const effects = Array.isArray(token.effects) ? token.effects : [];
    effects.forEach((effect) => {
      const effectName = effect?.name || "";
      if (effectName) {
        const conditionName = toSlug(effectName);
        traits.add(`self:condition:${conditionName}`);
        traits.add(`self:effect:${conditionName}`);
      }
    });
  }

  // Collect class names (e.g., "Barbarian" becomes "class:barbarian")
  if (token?.data?.classes) {
    const classes = Array.isArray(token.data.classes) ? token.data.classes : [];
    classes.forEach((classObj) => {
      const className = classObj?.name || "";
      if (className) {
        const classSlug = className.toLowerCase().replace(/\s+/g, "-");
        traits.add(`class:${classSlug}`);
      }
    });
  }

  // Collect ancestry names (e.g., "Human" becomes "ancestry:human")
  if (token?.data?.ancestries) {
    const ancestries = Array.isArray(token.data.ancestries)
      ? token.data.ancestries
      : [];
    ancestries.forEach((ancestryObj) => {
      const ancestryName = ancestryObj?.name || "";
      if (ancestryName) {
        const ancestrySlug = ancestryName.toLowerCase().replace(/\s+/g, "-");
        traits.add(`ancestry:${ancestrySlug}`);
      }
    });
  }

  // Collect heritage names (e.g., "Skilled Heritage" becomes "heritage:skilled-heritage")
  if (token?.data?.heritages) {
    const heritages = Array.isArray(token.data.heritages)
      ? token.data.heritages
      : [];
    heritages.forEach((heritageObj) => {
      const heritageName = heritageObj?.name || "";
      if (heritageName) {
        const heritageSlug = heritageName.toLowerCase().replace(/\s+/g, "-");
        traits.add(`heritage:${heritageSlug}`);
      }
    });
  }

  // Collect feat names (e.g., "Raging Thrower" becomes "feat:raging-thrower")
  if (token?.data?.feats) {
    const feats = Array.isArray(token.data.feats) ? token.data.feats : [];
    feats.forEach((feat) => {
      const featName = feat?.name || "";
      if (featName) {
        traits.add(`feat:${toSlug(featName)}`);
      }
    });
  }

  // Collect bonus feat names
  if (token?.data?.bonusFeats) {
    const bonusFeats = Array.isArray(token.data.bonusFeats)
      ? token.data.bonusFeats
      : [];
    bonusFeats.forEach((feat) => {
      const featName = feat?.name || "";
      if (featName) {
        traits.add(`feat:${toSlug(featName)}`);
      }
    });
  }

  // Collect feature names from data.features
  if (token?.data?.features) {
    const features = Array.isArray(token.data.features)
      ? token.data.features
      : [];
    features.forEach((feature) => {
      const featureName = feature?.name || "";
      if (featureName) {
        traits.add(`feature:${toSlug(featureName)}`);
      }
    });
  }

  // Collect features from class features
  if (token?.data?.classes) {
    const classes = Array.isArray(token.data.classes) ? token.data.classes : [];
    const level = token?.data?.level || 0;
    classes.forEach((classObj) => {
      const classFeatures = classObj?.data?.features || [];
      classFeatures.forEach((feature) => {
        const featureLevel = feature?.data?.level || 0;
        // Only include features at or below character level
        if (featureLevel <= level) {
          const featureName = feature?.name || "";
          if (featureName) {
            traits.add(`feature:${toSlug(featureName)}`);
          }
        }
      });
    });
  }

  // Collect features from ancestry features
  if (token?.data?.ancestries) {
    const ancestries = Array.isArray(token.data.ancestries)
      ? token.data.ancestries
      : [];
    ancestries.forEach((ancestry) => {
      const ancestryFeatures = ancestry?.data?.features || [];
      ancestryFeatures.forEach((feature) => {
        const featureName = feature?.name || "";
        if (featureName) {
          traits.add(`feature:${toSlug(featureName)}`);
        }
      });
    });
  }

  // Collect features from heritage features
  if (token?.data?.heritages) {
    const heritages = Array.isArray(token.data.heritages)
      ? token.data.heritages
      : [];
    heritages.forEach((heritage) => {
      const heritageFeatures = heritage?.data?.features || [];
      heritageFeatures.forEach((feature) => {
        const featureName = feature?.name || "";
        if (featureName) {
          traits.add(`feature:${toSlug(featureName)}`);
        }
      });
    });
  }

  // Collect action name if provided (e.g., "Subsist" becomes "action:subsist")
  if (context.action && context.action.name) {
    const actionName = context.action.name.toLowerCase().replace(/\s+/g, "-");
    traits.add(`action:${actionName}`);
  }

  // Collect properties from context objects (weapon, spell, etc.)
  Object.values(context).forEach((obj) => {
    if (!obj) return;

    // Collect item traits
    if (obj.data?.traits) {
      const itemTraits = Array.isArray(obj.data.traits) ? obj.data.traits : [];
      itemTraits.forEach((trait) => {
        const traitName = typeof trait === "string" ? trait : trait.name;
        if (traitName) {
          traits.add(`item:trait:${traitName.toLowerCase()}`);
          traits.add(`${traitName.toLowerCase()}`);
        }
      });
    }

    // Collect damage types
    if (obj.data?.damageType || obj.data?.damage?.damageType) {
      const damageTypeLower = (
        obj.data?.damageType ||
        obj.data?.damage?.damageType ||
        ""
      ).toLowerCase();
      traits.add(`item:damage:type:${damageTypeLower}`);

      // Add damage category based on type
      if (
        ["bludgeoning", "piercing", "slashing", "bleed", "poison"].includes(
          damageTypeLower,
        )
      ) {
        traits.add(`item:damage:category:physical`);
      } else if (
        ["acid", "cold", "electricity", "fire", "sonic"].includes(
          damageTypeLower,
        )
      ) {
        traits.add(`item:damage:category:energy`);
      } else if (damageTypeLower === "mental") {
        traits.add(`item:damage:category:mental`);
      }
      // untyped, spirit, vitality, void, etc. won't get a category unless dmg.category is set
    }

    // Collect additional damage types from damage array
    if (obj.data?.damage) {
      const damageArray = Array.isArray(obj.data.damage)
        ? obj.data.damage
        : [obj.data.damage];
      damageArray.forEach((dmg) => {
        let damageType =
          dmg?.type || dmg?.data?.type || dmg?.data?.damageType || "";
        if (damageType) {
          const damageTypeLower = damageType.toLowerCase();
          traits.add(`item:damage:type:${damageTypeLower}`);

          // Add damage category based on type
          if (
            ["bludgeoning", "piercing", "slashing", "bleed", "poison"].includes(
              damageTypeLower,
            )
          ) {
            traits.add(`item:damage:category:physical`);
          } else if (
            ["acid", "cold", "electricity", "fire", "sonic"].includes(
              damageTypeLower,
            )
          ) {
            traits.add(`item:damage:category:energy`);
          } else if (damageTypeLower === "mental") {
            traits.add(`item:damage:category:mental`);
          }
          // untyped, spirit, vitality, void, etc. won't get a category unless dmg.category is set
        }
        if (dmg?.category) {
          traits.add(`item:damage:category:${dmg.category.toLowerCase()}`);
        }
      });
    }

    // If spell, add item:type:spell
    if (obj.recordType === "spells") {
      traits.add(`item:type:spell`);
    } else if (obj.recordType === "items") {
      traits.add(`item:type:item`);
      traits.add(`item:type:equipment`);
    }

    // Collect property runes
    if (obj.data?.runes?.property) {
      const propertyRunes = Array.isArray(obj.data.runes.property)
        ? obj.data.runes.property
        : [];
      propertyRunes.forEach((rune) => {
        const runeName = typeof rune === "string" ? rune : rune.name;
        if (runeName) {
          traits.add(`item:rune:property:${runeName.toLowerCase()}`);
        }
      });
    }

    // Collect weapon range traits (melee, ranged, thrown)
    if (obj.recordType === "items" && obj.data?.type === "weapon") {
      const itemTraits = Array.isArray(obj.data.traits) ? obj.data.traits : [];
      const traitNames = itemTraits.map((t) =>
        (typeof t === "string" ? t : t.name || "").toLowerCase(),
      );
      const hasThrown = traitNames.includes("thrown");
      const range = parseInt(obj.data?.range, 10) || 0;

      if (hasThrown) {
        traits.add("item:thrown");
      }
      if (range > 0) {
        traits.add("item:ranged");
      } else {
        traits.add("item:melee");
      }
    }
  });

  // Add "id:${item._id}" to the traits for each item in the context
  Object.values(context).forEach((obj) => {
    if (typeof obj === "object" && obj !== null && obj._id) {
      traits.add(`id:${obj._id}`);
    }
  });

  // Add item:proficiency:rank:{value} for items in context
  const item = context.item || context.weapon || context.spell;
  if (item && token) {
    // Determine the item category (weapon or armor)
    const itemType = (item.data?.type || "").toLowerCase();
    const itemCategory = (item.data?.itemCategory || "").toLowerCase();
    const itemGroup = (item.data?.group || "").toLowerCase();

    // Add item:category:X trait (e.g., item:category:martial, item:category:simple)
    if (itemCategory) {
      traits.add(`item:category:${itemCategory}`);
    }

    // Add item:group:X trait (e.g., item:group:firearm, item:group:crossbow)
    if (itemGroup) {
      traits.add(`item:group:${itemGroup}`);
    }

    // For weapons, check attack proficiencies
    const isWeapon =
      itemType === "weapon" ||
      ["simple", "martial", "advanced", "unarmed"].includes(itemCategory);

    if (item.recordType === "items" && isWeapon && itemCategory) {
      // Use getProfiencyForWeapon helper which handles group-specific proficiencies
      const rank = getProfiencyForWeapon(token, itemCategory, itemGroup);
      if (rank !== undefined && rank !== null) {
        traits.add(`item:proficiency:rank:${rank}`);
      }
    }

    // For armor, check defense proficiencies
    const isArmor =
      itemType === "armor" ||
      ["unarmored", "light", "medium", "heavy"].includes(itemCategory);

    if (item.recordType === "items" && isArmor && itemCategory) {
      // Use getProfiencyForArmor helper which handles group-specific proficiencies
      const rank = getProfiencyForArmor(token, itemCategory, itemGroup);
      if (rank !== undefined && rank !== null) {
        traits.add(`item:proficiency:rank:${rank}`);
      }
    }
  }

  // Collect target conditions from context (e.g., target:condition:off-guard)
  // Target info can be passed in context.target
  if (context.target) {
    const target = context.target;

    // Collect conditions from target's effects
    if (target.effects) {
      const effects = Array.isArray(target.effects) ? target.effects : [];
      effects.forEach((effect) => {
        const effectName = effect?.name || "";
        if (effectName) {
          const conditionName = effectName.toLowerCase().replace(/\s+/g, "-");
          traits.add(`target:condition:${conditionName}`);
        }
      });
    }

    // Calculate target range increment based on weapon range and distance
    const weapon = context.weapon || context.item;
    const targetDistance = context.targetDistance || target.distance || 0;
    if (weapon && targetDistance > 0) {
      const weaponRange = parseInt(weapon.data?.range, 10) || 0;
      if (weaponRange > 0) {
        // Calculate which range increment we're in (1 = within first increment, 2 = second, etc.)
        const rangeIncrement = Math.ceil(targetDistance / weaponRange);
        traits.add(`target:range-increment:${rangeIncrement}`);
      } else {
        // Melee weapon - if we're in melee range, it's increment 1
        // Use token's reach or default to 5ft
        const reach = token?.data?.reach || 5;
        if (targetDistance <= reach) {
          traits.add(`target:range-increment:1`);
        }
      }
    }
  }

  // Check for tokenMark rules on the TARGET's effects that were applied by this token
  // This allows abilities like Hunt Prey to mark a target, and when attacking that target,
  // the attacker gets the target:mark:{value} trait for predicate evaluation
  if (
    context.targets &&
    Array.isArray(context.targets) &&
    context.targets.length > 0
  ) {
    const ourToken = api.getToken();
    const tokenId = ourToken?._id;
    const recordId = token?.record?._id;
    for (const target of context.targets) {
      const targetRecord = target?.token;
      const targetEffects = targetRecord?.effects || [];

      targetEffects.forEach((effect) => {
        const rules = effect.rules || [];
        rules.forEach((rule) => {
          if (rule.type === "tokenMark" && rule.value) {
            // Check if this effect was applied by the current token (attacker)
            const effectValue = targetRecord?.effectValues?.[effect?._id];
            const appliedById = effectValue?.tokenId;

            if (
              (appliedById &&
                (appliedById === tokenId || appliedById === recordId)) ||
              appliedById === undefined ||
              appliedById === null
            ) {
              // This target has a mark effect applied by us - add the trait
              const markValue =
                typeof rule.value === "string"
                  ? rule.value.toLowerCase().replace(/\s+/g, "-")
                  : rule.value;
              traits.add(`target:mark:${markValue}`);
            }
          }
        });
      });
    }
  }

  // Collect predicateValues from active toggles
  if (token?.data?.toggles) {
    const toggles = Array.isArray(token.data.toggles) ? token.data.toggles : [];
    toggles.forEach((toggle) => {
      // Check if toggle is active
      if (toggle.data?.toggled === true && toggle.data?.predicateValue) {
        const predicateValue = toggle.data.predicateValue;
        // Add the predicate value directly (it's already in the correct format)
        if (typeof predicateValue === "string" && predicateValue.trim()) {
          traits.add(predicateValue.trim());
        }
      }
    });
  }

  // Add stored rollOptions from the character record
  // These are calculated and stored by updateRollOptions() in onAddEditFeature
  // Skip if skipRollOptions is true (used when recalculating rollOptions)
  if (!skipRollOptions && token?.data?.rollOptions) {
    const rollOptions = Array.isArray(token.data.rollOptions)
      ? token.data.rollOptions
      : [];
    rollOptions.forEach((option) => {
      if (typeof option === "string" && option.trim()) {
        traits.add(option.trim());
      }
    });
  }

  return traits;
}

/**
 * Recalculates and stores the active rollOptions for a character.
 * Call this in onAddEditFeature to keep record.data.rollOptions up to date.
 *
 * @param {Object} record - The character record
 * @param {Object} valuesToSet - Object to add the rollOptions update to
 */
function updateRollOptions(record, valuesToSet) {
  if (!record) return;

  // Get base traits WITHOUT stored rollOptions
  const baseTraits = collectTraitsAndProperties(record, {}, true);

  // Get all rollOption modifiers
  const rollOptionModifiers = getEffectsAndModifiersForToken(
    record,
    ["rollOption"],
    undefined,
    undefined,
    undefined,
    {},
    baseTraits, // Pass base traits to evaluate predicates against
  );

  // Collect active rollOptions (single pass - no cascading)
  const activeRollOptions = [];
  rollOptionModifiers.forEach((rollOpt) => {
    if (rollOpt.active && rollOpt.option) {
      activeRollOptions.push(rollOpt.option);
    }
  });

  // Also collect rollOptions from choices that have been made
  // Helper to extract selectedRollOption from choices in features
  const collectChoiceRollOptions = (features) => {
    if (!Array.isArray(features)) return;
    features.forEach((feature) => {
      const choices = feature.data?.choices || [];
      choices.forEach((choice) => {
        // The selected choice data is stored as JSON string in choice.data.choices[0]
        const selectedChoices = choice.data?.choices || [];
        if (selectedChoices.length > 0) {
          try {
            const selectedData =
              typeof selectedChoices[0] === "string"
                ? JSON.parse(selectedChoices[0])
                : selectedChoices[0];
            if (selectedData?.selectedRollOption) {
              activeRollOptions.push(selectedData.selectedRollOption);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
    });
  };

  // Collect from all feature sources
  collectChoiceRollOptions(record.data?.feats);
  collectChoiceRollOptions(record.data?.bonusFeats);
  collectChoiceRollOptions(record.data?.features);

  // Collect from ancestry features
  if (record.data?.ancestries) {
    record.data.ancestries.forEach((ancestry) => {
      collectChoiceRollOptions(ancestry.data?.features);
    });
  }

  // Collect from heritage features
  if (record.data?.heritages) {
    record.data.heritages.forEach((heritage) => {
      collectChoiceRollOptions(heritage.data?.features);
    });
  }

  // Collect from class features
  if (record.data?.classes) {
    record.data.classes.forEach((classObj) => {
      collectChoiceRollOptions(classObj.data?.features);
    });
  }

  // Only update if rollOptions actually changed
  const currentRollOptions = record.data?.rollOptions || [];
  const hasChanged =
    activeRollOptions.length !== currentRollOptions.length ||
    activeRollOptions.some((opt) => !currentRollOptions.includes(opt)) ||
    currentRollOptions.some((opt) => !activeRollOptions.includes(opt));

  if (hasChanged) {
    valuesToSet["data.rollOptions"] = activeRollOptions;
  }
}

/**
 * Parses a modifier predicate string into the format used by evaluateEffectPredicate.
 * Expects JSON string format from the converter.
 *
 * @param {string|Array|Object} predicateInput - The predicate from modifier data (JSON string or already parsed)
 * @returns {Array|Object|String} Parsed predicate in effect format
 */
function parseModifierPredicate(predicateInput) {
  // If already an object or array (already parsed), return as-is
  if (typeof predicateInput === "object") {
    return predicateInput;
  }

  if (!predicateInput || typeof predicateInput !== "string") {
    return [];
  }

  const predicateString = predicateInput.trim();

  // Try to parse as JSON
  try {
    return JSON.parse(predicateString);
  } catch (e) {
    // If JSON parse fails, return empty array
    console.warn(
      `Failed to parse modifier predicate as JSON: ${predicateString}`,
      e,
    );
    return [];
  }
}

/**
 * Resolves dynamic predicate values like "actor:level", "actor:armor:light:rank",
 * "item:level", and "item:proficiency:rank"
 * @param {string} value - The value to resolve
 * @param {Object} target - The target record (actor/token)
 * @param {Object} context - Context object containing item, weapon, spell, etc.
 * @param {Set} traits - Traits set for fallback lookup
 * @returns {number} The resolved numeric value
 */
function resolvePredicateValue(value, target, context, traits) {
  // Handle numeric values
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  // actor:level or self:level - get level from target record
  if (value === "actor:level" || value === "self:level") {
    return target?.data?.level || 0;
  }

  // actor:armor:{category}:rank - get the character's current armor rank.
  // updateProficiencies supplies its in-progress map in context so a predicate
  // can correctly inspect ranks granted by an earlier feature in the same pass.
  const armorRankMatch = value.match(
    /^(?:actor|self):armor:(unarmored|light|medium|heavy):rank$/,
  );
  if (armorRankMatch) {
    const armorCategory = armorRankMatch[1];
    const calculatedRank = context?.proficiencies?.[armorCategory];
    if (calculatedRank !== undefined) {
      return parseInt(calculatedRank, 10) || 0;
    }
    return parseInt(target?.data?.defenses?.[armorCategory] || "0", 10) || 0;
  }

  // item:level - get level from the item in context
  if (value === "item:level") {
    // Check all possible item sources in context
    const item =
      context.item || context.weapon || context.spell || context.feature;
    return item?.data?.level || item?.level || 0;
  }

  // item:proficiency:rank - get proficiency rank for the item
  if (value === "item:proficiency:rank") {
    const item = context.item || context.weapon || context.spell;

    if (!item || !target) {
      return 0;
    }

    // Determine the item category (weapon or armor)
    const itemType = (item.data?.type || "").toLowerCase();
    const itemCategory = (item.data?.itemCategory || "").toLowerCase();
    const itemGroup = (item.data?.group || "").toLowerCase();

    // For weapons, check attack proficiencies
    // Check item.data.type === "weapon" OR if itemCategory is a weapon category
    const isWeapon =
      itemType === "weapon" ||
      ["simple", "martial", "advanced", "unarmed"].includes(itemCategory);

    if (item.recordType === "items" && isWeapon && itemCategory) {
      const proficiencies = target.data?.attackProficiencies || {};

      // Use getProfiencyForWeapon helper which handles group-specific proficiencies
      const rank = getProfiencyForWeapon(target, itemCategory, itemGroup);
      return rank;
    }

    // For armor, check defense proficiencies
    // Check item.data.type === "armor" OR if itemCategory is an armor category
    const isArmor =
      itemType === "armor" ||
      ["unarmored", "light", "medium", "heavy"].includes(itemCategory);

    if (item.recordType === "items" && isArmor && itemCategory) {
      const defenses = target.data?.defenses || {};

      // Use getProfiencyForArmor helper which handles group-specific proficiencies
      const rank = getProfiencyForArmor(target, itemCategory, itemGroup);
      return rank;
    }

    return 0;
  }

  // Check if it's a trait key with a numeric value (e.g., "item:proficiency:rank:3")
  for (const trait of traits) {
    if (trait.startsWith(value + ":")) {
      const numValue = trait.substring(value.length + 1);
      return parseFloat(numValue) || 0;
    } else if (trait === value) {
      // If exact match exists, treat as 1 (present)
      return 1;
    }
  }

  // Not found, treat as 0
  return 0;
}

/**
 * Evaluates an effect predicate condition (JSON format) against a set of traits.
 * This is different from the existing evaluatePredicate which handles string-based predicates.
 *
 * @param {Array|Object|String} predicate - The predicate to evaluate (JSON format)
 * @param {Set} traits - Set of trait strings to check against
 * @param {Object} target - The target record (actor/token)
 * @param {Object} context - Context object containing item, weapon, spell, etc.
 * @returns {boolean} Whether the predicate is satisfied
 */
function evaluateEffectPredicate(predicate, traits, target, context = {}) {
  // Base case: string predicate - check if trait exists
  if (typeof predicate === "string") {
    // Unsupported predicate types - assume true
    if (predicate.startsWith("item:tag:")) {
      return true;
    }

    // If the predicate contains @record.data., replace with actual values
    // Example: "id:@record.data.effects.handOfTheApprentice" becomes "id:abc123"
    if (predicate.includes("@record.data.")) {
      let resolvedPredicate = predicate;
      // Find all @record.data.{path} patterns in the predicate
      const matches = predicate.match(/@record\.data\.([\w.]+)/g);
      if (matches) {
        matches.forEach((match) => {
          // Extract the field path (e.g., "effects.handOfTheApprentice")
          const field = match.replace("@record.data.", "");
          // Get the value at data.{field} on the target record
          const value = api.getValueOnRecord(target, `data.${field}`);
          if (value) {
            // Replace the @record.data.{path} with the actual value
            resolvedPredicate = resolvedPredicate.replace(match, value);
          }
        });
      }
      return traits.has(resolvedPredicate);
    }
    return traits.has(predicate);
  }

  // Array: treat as implicit AND - all items must be true
  if (Array.isArray(predicate)) {
    return predicate.every((item) =>
      evaluateEffectPredicate(item, traits, target, context),
    );
  }

  // Object: handle logical operators
  if (typeof predicate === "object" && predicate !== null) {
    // NOT operator
    if ("not" in predicate) {
      return !evaluateEffectPredicate(predicate.not, traits, target, context);
    }

    // OR operator
    if ("or" in predicate) {
      const orArray = Array.isArray(predicate.or)
        ? predicate.or
        : [predicate.or];
      return orArray.some((item) =>
        evaluateEffectPredicate(item, traits, target, context),
      );
    }

    // AND operator (explicit)
    if ("and" in predicate) {
      const andArray = Array.isArray(predicate.and)
        ? predicate.and
        : [predicate.and];
      return andArray.every((item) =>
        evaluateEffectPredicate(item, traits, target, context),
      );
    }

    // NAND operator (not and)
    if ("nand" in predicate) {
      const nandArray = Array.isArray(predicate.nand)
        ? predicate.nand
        : [predicate.nand];
      return !nandArray.every((item) =>
        evaluateEffectPredicate(item, traits, target, context),
      );
    }

    // NOR operator (not or)
    if ("nor" in predicate) {
      const norArray = Array.isArray(predicate.nor)
        ? predicate.nor
        : [predicate.nor];
      return !norArray.some((item) =>
        evaluateEffectPredicate(item, traits, target, context),
      );
    }

    // XOR operator (exclusive or)
    if ("xor" in predicate) {
      const xorArray = Array.isArray(predicate.xor)
        ? predicate.xor
        : [predicate.xor];
      const trueCount = xorArray.filter((item) =>
        evaluateEffectPredicate(item, traits, target, context),
      ).length;
      return trueCount === 1;
    }

    // Comparison operators: gte, gt, lte, lt, eq, ne
    // Format: {"gte": ["item:proficiency:rank", 2]} or {"gte": ["actor:level", 5]}
    const comparisonOps = ["gte", "gt", "lte", "lt", "eq", "ne"];
    for (const op of comparisonOps) {
      if (op in predicate) {
        const operands = Array.isArray(predicate[op])
          ? predicate[op]
          : [predicate[op]];

        if (operands.length !== 2) {
          console.warn(
            `Comparison operator ${op} requires exactly 2 operands, got ${operands.length}`,
          );
          return false;
        }

        // Resolve both operands using the helper function
        const leftValue = resolvePredicateValue(
          operands[0],
          target,
          context,
          traits,
        );
        const rightValue = resolvePredicateValue(
          operands[1],
          target,
          context,
          traits,
        );

        // Perform comparison
        let result;
        switch (op) {
          case "gte":
            result = leftValue >= rightValue;
            break;
          case "gt":
            result = leftValue > rightValue;
            break;
          case "lte":
            result = leftValue <= rightValue;
            break;
          case "lt":
            result = leftValue < rightValue;
            break;
          case "eq":
            result = leftValue === rightValue;
            break;
          case "ne":
            result = leftValue !== rightValue;
            break;
        }

        return result;
      }
    }
  }

  // Unknown predicate type - default to false
  return false;
}

/**
 * Applies adjustModifier effects to values like splash damage.
 * adjustModifier can upgrade/downgrade/add/multiply/override values based on targetSlug.
 *
 * @param {Object} record - The character/token record
 * @param {number|string} currentValue - The current value to adjust (e.g., splash damage)
 * @param {string} targetSlug - The slug to match (e.g., "splash")
 * @param {Object} weapon - The weapon being used (for context)
 * @returns {number|string} - The adjusted value
 */
function applyAdjustModifiers(record, currentValue, targetSlug, weapon = null) {
  if (!targetSlug) return currentValue;

  // Get all adjustModifier modifiers
  const adjustModifiers = getEffectsAndModifiersForToken(
    record,
    ["adjustModifier"],
    undefined,
    weapon?._id,
    undefined,
    weapon ? { weapon } : {},
  );

  let adjustedValue = currentValue;

  // Process each adjustModifier that matches our targetSlug
  adjustModifiers.forEach((adjMod) => {
    const modTargetSlug = adjMod.targetSlug || "";
    const adjustMode = adjMod.adjustMode || "upgrade";
    const adjustValue = adjMod.value;

    // Only process if this modifier targets our slug and is active
    if (modTargetSlug === targetSlug && adjMod.active) {
      // Parse current and adjust values as numbers
      let currentNum =
        typeof adjustedValue === "number"
          ? adjustedValue
          : parseInt(adjustedValue, 10) || 0;
      let adjustNum =
        typeof adjustValue === "number"
          ? adjustValue
          : parseInt(adjustValue, 10) || 0;

      // Apply adjustment based on mode
      if (adjustMode === "upgrade") {
        // Use the higher value
        adjustedValue = Math.max(currentNum, adjustNum);
      } else if (adjustMode === "downgrade") {
        // Use the lower value
        adjustedValue = Math.min(currentNum, adjustNum);
      } else if (adjustMode === "add") {
        // Add the values
        adjustedValue = currentNum + adjustNum;
      } else if (adjustMode === "multiply") {
        // Multiply the values (use parseFloat for decimals)
        const currentFloat =
          typeof adjustedValue === "number"
            ? adjustedValue
            : parseFloat(adjustedValue) || 0;
        const multFloat =
          typeof adjustValue === "number"
            ? adjustValue
            : parseFloat(adjustValue) || 0;
        adjustedValue = Math.floor(currentFloat * multFloat);
      } else if (adjustMode === "override") {
        // Replace with new value
        adjustedValue = adjustNum;
      }
    }
  });

  return adjustedValue;
}

/**
 * Processes damage modifiers to extract special category damage (persistent, splash, precision)
 * and returns both the filtered modifiers and extracted special damage.
 *
 * @param {Array} damageModifiers - Array of damage modifier objects
 * @param {string} existingPersistent - Existing persistent damage string to append to
 * @param {string|number} existingSplash - Existing splash damage to append to
 * @param {string} existingSplashType - Existing splash damage type
 * @returns {Object} - { modifiers, persistentDamage, splashDamage, splashDamageType, precisionCategories }
 */
function processDamageModifierCategories(
  damageModifiers,
  existingPersistent = "",
  existingSplash = 0,
  existingSplashType = "",
) {
  const filteredModifiers = [];
  const persistentDamageParts = existingPersistent ? [existingPersistent] : [];
  const splashDamageParts = [];
  const precisionCategories = new Set();

  // If there's existing splash damage, add it to the parts array with its type
  if (existingSplash && existingSplash !== 0 && existingSplash !== "0") {
    // Format as "formula type"
    splashDamageParts.push(`${existingSplash} ${existingSplashType}`);
  }

  damageModifiers.forEach((mod) => {
    const value = mod.value?.toString() || "";

    // Check if this modifier has dice and a damage type with a category suffix
    // Pattern: "{dice} {damageType}-{category}" e.g., "1d6 poison-persistent"
    const match = value.match(
      /^([0-9]+d[0-9]+(?:\s*[+\-]\s*[0-9]+)?)\s+([a-z]+)-(persistent|splash|precision)$/i,
    );

    if (match) {
      const diceFormula = match[1].trim();
      const damageType = match[2].toLowerCase();
      const category = match[3].toLowerCase();

      if (category === "persistent") {
        // Add to persistent damage with its type, don't include in modifiers
        persistentDamageParts.push(`${diceFormula} ${damageType}`);
      } else if (category === "splash") {
        // Add to splash damage with its type, don't include in modifiers
        splashDamageParts.push(`${diceFormula} ${damageType}`);
      } else if (category === "precision") {
        // Keep in modifiers but strip the "-precision" suffix and track category
        filteredModifiers.push({
          ...mod,
          value: `${diceFormula} ${damageType}`,
          precisionDamage: true,
        });
        precisionCategories.add("precision");
      }
    } else {
      // No category suffix, keep as-is
      filteredModifiers.push(mod);
    }
  });

  // Combine splash parts into a single string like "1d4 fire + 1d6 acid"
  const combinedSplash =
    splashDamageParts.length > 0 ? splashDamageParts.join(" + ") : "";

  return {
    modifiers: filteredModifiers,
    persistentDamage: persistentDamageParts.join(", "),
    splashDamage: combinedSplash,
    splashDamageType: "", // Not needed anymore since type is in the combined string
    precisionCategories: Array.from(precisionCategories),
  };
}

// Get all effects and modifiers for a speicifc token that match the given types, field, itemId, and appliedById
function getEffectsAndModifiersForToken(
  target,
  types = [],
  field = "",
  itemId = undefined,
  appliedById = undefined,
  context = {},
  prebuiltTraitsSet = null,
) {
  if (!target) {
    return [];
  }
  let results = [];

  // Collect traits and properties for predicate evaluation
  // If a prebuilt traitsSet is provided, use it (to avoid circular dependency with collectTraitsAndProperties)
  const traitsSet =
    prebuiltTraitsSet || collectTraitsAndProperties(target, context);

  // For effects we also need to check those that include -circumstance, -item, -status,
  // so make a new array to include those
  const allTypes = [...types];
  for (const type of allTypes) {
    if (type.endsWith("Penalty") || type.endsWith("Bonus")) {
      allTypes.push(`${type}-circumstance`);
      allTypes.push(`${type}-item`);
      allTypes.push(`${type}-status`);
    }
  }

  // Set of stack modifiers that we have seen so we don't duplicate them
  const stackModifiers = {};

  // First collect modifiers from effects
  const effects = target?.effects || [];
  effects.forEach((effect) => {
    const rules = effect.rules || [];
    // Get the relevant field for the rule
    rules.forEach((rule) => {
      let field = rule?.field || "";
      // Fields can reference other fields on the record in PF2e, so we need to resolve them
      if (field && field.startsWith("data.")) {
        field = String(api.getValueOnRecord(target, field) || "").toLowerCase();
      }
      if (field && field.startsWith("@record")) {
        field = String(
          api.getValueOnRecord(target, field.replace("@record.", "")) || "",
        ).toLowerCase();
      }

      // Check for predicates in rule.data
      let active = true;
      if (rule.data && typeof rule.data === "object") {
        if (rule.data.predicate) {
          // Evaluate the predicate - if it fails, skip this rule
          const predicatePassed = evaluateEffectPredicate(
            rule.data.predicate,
            traitsSet,
            target,
            context,
          );
          if (!predicatePassed) {
            // Mark as inactive
            active = false;
          }
        }
      }

      const ruleType = rule?.type || "";
      const isPenalty = ruleType.toLowerCase().includes("penalty");
      let value = rule.value || "";
      let bonusPenaltyType = "";

      // For effects, we get the modifierType from the suffix, if it ends with -circumstance, -item, or -status
      if (ruleType.endsWith("-circumstance")) {
        bonusPenaltyType = "circumstance";
      } else if (ruleType.endsWith("-item")) {
        bonusPenaltyType = "item";
      } else if (ruleType.endsWith("-status")) {
        bonusPenaltyType = "status";
      }

      // Override valueType to string if the value contains non-numerical content that needs replacements
      let valueType = rule.valueType;
      if (valueType === "number" && typeof value === "string") {
        // Check if value starts with a non-numerical character (excluding minus sign and whitespace)
        const trimmedValue = value.trim();
        if (trimmedValue && /^[^0-9\-\s]/.test(trimmedValue)) {
          valueType = "string";
        }
      }

      if (valueType === "number") {
        value = parseInt(rule.value, 10);
        if (isNaN(value)) {
          value = 0;
        }
        if (isPenalty && value > 0) {
          value = -value;
        }
      } else if (
        valueType === "string" &&
        !value.trim().startsWith("-") &&
        isPenalty &&
        !value.includes("disadvantage")
      ) {
        value = "-" + value;
      }
      // Check for strings that require replacements
      if (valueType === "string") {
        // Check if value references a data field on the record (e.g., "data.level")
        if (typeof value === "string" && value.startsWith("data.")) {
          value = api.getValueOnRecord(target, value) || 0;
        } else {
          value = checkForReplacements(value, {}, target, effect, context);
        }
      }
      if (value !== 0 && (valueType === "number" || valueType === "string")) {
        let name = effect.name || "Effect";
        // If this is a stackable effect, add the effect per stack amount with a different name each time
        let times = 1;
        if (effect.stackable) {
          times = target?.effectIds?.filter((id) => id === effect?._id).length;
        }
        for (let i = 0; i < times; i++) {
          results.push({
            name: i > 0 ? `${name} (x${i + 1})` : name,
            value: value,
            active: active,
            modifierType: ruleType,
            type: bonusPenaltyType,
            field: field,
            valueType: rule.valueType,
            isPenalty: isPenalty,
            isEffect: true,
            appliedBy: getEffectAppliedBy(target, effect),
            slug: rule.slug || "",
            targetSlug: rule.targetSlug || "",
            adjustMode: rule.adjustMode || "",
          });
        }
      } else if (rule.valueType === "api") {
        let value = parseInt(target?.effectValues?.[effect?._id] || "0", 10);
        if (isPenalty && value > 0) {
          value = -value;
        }
        if (value !== 0) {
          results.push({
            name: effect.name || "Effect",
            value: value,
            active: active,
            modifierType: ruleType,
            type: bonusPenaltyType,
            field: rule?.field || "",
            valueType: rule.valueType,
            isPenalty: isPenalty,
            isEffect: true,
            appliedBy: null,
            slug: rule.slug || "",
            targetSlug: rule.targetSlug || "",
            adjustMode: rule.adjustMode || "",
          });
        }
      } else if (
        rule.valueType === "stack" &&
        !stackModifiers[`${effect?._id}-${JSON.stringify(rule)}`]
      ) {
        stackModifiers[`${effect?._id}-${JSON.stringify(rule)}`] = true;
        // The value is the number of times they have this effect
        let value = target?.effectIds?.filter(
          (id) => id === effect?._id,
        ).length;
        if (isPenalty && value > 0) {
          value = -value;
        }
        // Check if there is addtional math to apply to it
        const math = rule?.value || "";
        if (math) {
          value = applyMath(value, math);
        }
        if (isPenalty && value > 0) {
          value = -value;
        }
        if (value !== 0) {
          results.push({
            name: effect.name || "Effect",
            value: value,
            active: active,
            modifierType: ruleType,
            type: bonusPenaltyType,
            field: rule?.field || "",
            valueType: rule.valueType,
            isPenalty: isPenalty,
            isEffect: true,
            appliedBy: getEffectAppliedBy(target, effect),
            slug: rule.slug || "",
            targetSlug: rule.targetSlug || "",
            adjustMode: rule.adjustMode || "",
          });
        }
      }
    });
  });

  // Now collect all modifiers from Features and Items.
  // Copy into a fresh array - never alias target.data.features, or the pushes below
  // mutate the stored record and double-count modifiers on repeated calls (e.g. the
  // 6 successive updateAttribute calls in updateAllAttributes).
  const features = [...(target?.data?.features || [])];
  const feats = target?.data?.feats || [];
  const bonusFeats = target?.data?.bonusFeats || [];
  features.push(...feats);
  features.push(...bonusFeats);
  // Ensure items is an array before filtering
  const items = Array.isArray(target?.data?.inventory)
    ? target?.data?.inventory
    : [];

  // Collect all modifiers from ancestry and class features
  const ancestries = target?.data?.ancestries || [];
  for (const ancestry of ancestries) {
    features.push(...(ancestry.data?.features || []));
  }
  const heritages = target?.data?.heritages || [];
  for (const heritage of heritages) {
    features.push(...(heritage.data?.features || []));
  }
  const classes = target?.data?.classes || [];
  for (const classObj of classes) {
    // Only push class features that are <= our level
    const level = target?.data?.level || 0;
    const classFeatures = classObj.data?.features || [];
    classFeatures.forEach((feature) => {
      const featureLevel = feature.data?.level || 0;
      if (featureLevel <= level) {
        features.push(feature);
      }
    });
  }

  const isNPC = target?.recordType !== "characters";
  const actions = target?.data?.actions || [];
  actions.forEach((action) => {
    const level = target?.data?.level || 0;
    const actionLevel = action.data?.level || 0;
    // If we're an NPC we always add actions
    if (isNPC || actionLevel <= level) {
      features.push(action);
    }
  });

  // Filter items that are not equipped or that require investment and not invested
  // Helper function to check if an item requires investment
  const requiresInvestment = (item) => {
    if (isNPC) {
      // NPCs don't require investment
      return false;
    }
    const traits = item.data?.traits || [];
    // Assume if there are property runes and it is armor it requires investment
    const propertyRunes = item.data?.runes?.property || [];
    const potencyRune = item.data?.runes?.potency || "";
    const resilientRune = item.data?.runes?.resilient || "";
    if (
      (propertyRunes.length > 0 || !!potencyRune || !!resilientRune) &&
      item.data?.type === "armor"
    ) {
      return true;
    }
    return traits.map((trait) => trait.toLowerCase()).includes("invested");
  };

  const equippedItems = items.filter(
    (item) =>
      item.data?.carried === "equipped" &&
      (!requiresInvestment(item) || item.data?.invested === "true"),
  );

  // Get and modifiers from runes
  const runeModifiers = getFeaturesFromRunes(equippedItems);

  // Determine if we're using a weapon that has ammo, and add effects for that ammo
  let ammoEffects = [];
  if (itemId) {
    // Find the item that has the itemId
    const item = equippedItems.find((item) => item._id === itemId);
    if (item) {
      // Check if the item has ammo
      const ammo = item.data?.ammoSelect;
      if (ammo) {
        // Find the ammo item
        const ammoItem = items.find((item) => item._id === ammo);
        if (ammoItem) {
          ammoEffects.push({
            ...ammoItem,
            // Mark it as the itemId so we can use it to filter results
            _id: itemId,
          });
        }
      }
    }
  }

  // Add traits to the traitsSet for each feature's name in kebab-case
  // Unless that feature had a toggleable predicate of the same value
  const toggles = target?.data?.toggles || [];
  const togglePredicateValues = toggles
    .map((toggle) => toggle.data?.predicateValue || "")
    .filter((value) => value !== "");
  [...features, ...equippedItems, ...runeModifiers].forEach((feature) => {
    const name = (feature?.name || "")
      .replace(/'/g, "") // Remove apostrophes (Mage's -> Mages)
      .toLowerCase() // Convert to lowercase
      .trim()
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
    if (name && !togglePredicateValues.includes(name)) {
      traitsSet.add(name);
    }
  });

  [...features, ...equippedItems, ...runeModifiers].forEach((feature) => {
    const modifiers = feature.data?.modifiers || [];
    modifiers.forEach((modifier) => {
      const ruleType = modifier.data?.type || "";
      const bonusPenaltyType = modifier.data?.modifierType || "";
      const isPenalty =
        ruleType.toLowerCase().includes("penalty") &&
        !ruleType.toLowerCase() === "ignoreRangePenalty";
      let value = modifier.data?.value || "";

      // Check for predicate value in modifier data first
      const predicate = modifier.data?.predicate || "";
      let active = true; // Default to active

      if (predicate) {
        // If there's a predicate, use its result to determine active state
        const parsedPredicate = parseModifierPredicate(predicate);
        const predicatePassed = evaluateEffectPredicate(
          parsedPredicate,
          traitsSet,
          target,
          context,
        );
        active = predicatePassed;
      } else {
        // No predicate - use modifier's active field if set, otherwise default to true
        active = modifier.data?.active !== false;
      }

      // Degree of success adjustments are always active by default unless predicate is false
      if (ruleType === "adjustDegreeOfSuccess") {
        active = predicate ? active : true;
      }

      // Override valueType to string if the value contains non-numerical content that needs replacements
      let valueType = modifier.data?.valueType;
      if (valueType === "number" && typeof value === "string") {
        // Check if value starts with a non-numerical character (excluding minus sign and whitespace)
        const trimmedValue = value.trim();
        if (trimmedValue && /^[^0-9\-\s]/.test(trimmedValue)) {
          valueType = "string";
        }
      }

      if (valueType === "number") {
        value = parseFloat(modifier.data?.value);
        if (isNaN(value)) {
          value = 0;
        }
        if (isPenalty && value > 0) {
          value = -value;
        }
      } else if (valueType === "field") {
        const fieldToUse = modifier.data?.value || "";
        if (fieldToUse) {
          value = target?.data?.[fieldToUse] || "";
        }
      } else if (
        valueType === "string" &&
        !value.trim().startsWith("-") &&
        isPenalty
      ) {
        value = "-" + value;
      }

      // Check for strings that require replacements
      if (valueType === "string") {
        // Check if value references a data field on the record (e.g., "data.level")
        if (typeof value === "string" && value.startsWith("data.")) {
          value = api.getValueOnRecord(target, value) || 0;
        } else {
          value = checkForReplacements(value, {}, target, null, context);
        }
      }

      // If this is adjustDegreeOfSuccess, set value to the object
      if (ruleType === "adjustDegreeOfSuccess") {
        value = {
          all: modifier.data?.adjustment?.all || "none",
          success: modifier.data?.adjustment?.success || "none",
          failure: modifier.data?.adjustment?.failure || "none",
          criticalFailure: modifier.data?.adjustment?.criticalFailure || "none",
        };
      }

      // If this is activeEffect, set value to the effectValue
      if (ruleType === "activeEffect") {
        value = modifier.data?.effectValue || "";
      }

      // If this is rollOption, the value is the option string to add as a trait
      if (ruleType === "rollOption") {
        value = modifier.data?.option || "";
      }

      // Only relevant if it has a value (activeEffect and rollOption can have empty string values, so allow those)
      if (
        value !== 0 ||
        ruleType === "activeEffect" ||
        ruleType === "rollOption"
      ) {
        // Check if this only applies to equipped item and mark it with ID if so
        const itemOnly = modifier.data?.itemOnly || false;
        const resultObj = {
          name: feature?.name || "Feature",
          value: value,
          // If toggleable is true, make all modifiers inactive by default
          active: active,
          type: bonusPenaltyType,
          modifierType: ruleType,
          field: modifier.data?.field || "",
          valueType: modifier.data?.valueType,
          itemId: itemOnly ? feature?._id : undefined,
          isPenalty: isPenalty,
          isEffect: false,
          slug: modifier.data?.slug || "",
          targetSlug: modifier.data?.targetSlug || "",
          adjustMode: modifier.data?.adjustMode || "",
          predicate: predicate, // Include predicate so it can be evaluated in adjustModifier processing
        };

        // Add activeEffect-specific fields
        if (ruleType === "activeEffect") {
          resultObj.effectField = modifier.data?.effectField || "";
          resultObj.effectMode = modifier.data?.effectMode || "override";
        }

        // Add rollOption-specific fields
        if (ruleType === "rollOption") {
          resultObj.option = modifier.data?.option || "";
        }

        results.push(resultObj);
      }
    });
  });

  // Add modifiers for armor penalties and runes
  const bestArmor = getBestEquippedArmor(target);
  const checkPenalty = getCheckPenaltyForArmor(target, bestArmor);
  const resilientBonus = getResilientArmorBonus(target, bestArmor);
  if (checkPenalty) {
    results.push(...checkPenalty);
  }
  if (resilientBonus) {
    results.push(...resilientBonus);
  }

  // Process AdjustModifier rules - these modify existing modifiers by slug
  const adjustModifiers = results.filter(
    (r) => r.modifierType === "adjustModifier" && r.active,
  );
  adjustModifiers.forEach((adjMod) => {
    const targetSlug = adjMod.targetSlug || "";
    const adjustMode = adjMod.adjustMode || "upgrade";
    const adjustValue = adjMod.value;

    if (!targetSlug) return;

    // Check if this adjustModifier has a predicate that needs evaluation
    // If it does and it fails, skip this adjustModifier
    if (adjMod.predicate) {
      const parsedPredicate = parseModifierPredicate(adjMod.predicate);
      if (parsedPredicate && parsedPredicate.length > 0) {
        const predicatePassed = evaluateEffectPredicate(
          parsedPredicate,
          traitsSet,
          target,
          context,
        );
        if (!predicatePassed) {
          return; // Skip this adjustModifier
        }
      }
    }

    // Find all modifiers with matching slug and apply adjustment
    // Note: We don't check result.active here because adjustModifier should modify the value
    // regardless of whether the target modifier is currently active. The target modifier's
    // own predicate will determine if the adjusted value gets used in the roll.
    results.forEach((result) => {
      if (
        result.slug === targetSlug &&
        result !== adjMod &&
        result.modifierType !== "adjustModifier"
      ) {
        // Helper to check if a value is a pure number (not a dice expression like "1d6")
        const isPureNumber = (val) => {
          if (typeof val === "number") return true;
          if (typeof val !== "string") return false;
          const trimmed = val.trim();
          return trimmed !== "" && !isNaN(Number(trimmed));
        };

        // Apply adjustment based on mode
        if (adjustMode === "upgrade") {
          // Use the higher value
          // For string values that aren't pure numbers (e.g., "1d6"), use the adjust value
          if (typeof result.value === "number") {
            const newVal =
              typeof adjustValue === "number"
                ? adjustValue
                : parseInt(adjustValue, 10) || 0;
            if (newVal > result.value) {
              result.value = newVal;
            }
          } else if (isPureNumber(result.value)) {
            const currentVal = parseInt(result.value, 10) || 0;
            const newVal =
              typeof adjustValue === "number"
                ? adjustValue
                : parseInt(adjustValue, 10) || 0;
            if (newVal > currentVal) {
              result.value = newVal;
              result.valueType = "number";
            }
          } else {
            // String value that isn't a pure number (e.g., "1d6") - use adjust value
            result.value =
              typeof adjustValue === "number"
                ? adjustValue
                : parseInt(adjustValue, 10) || 0;
            result.valueType = "number";
          }
        } else if (adjustMode === "downgrade") {
          // Use the lower value
          // For string values that aren't pure numbers, use the adjust value
          if (typeof result.value === "number") {
            const newVal =
              typeof adjustValue === "number"
                ? adjustValue
                : parseInt(adjustValue, 10) || 0;
            if (newVal < result.value) {
              result.value = newVal;
            }
          } else if (isPureNumber(result.value)) {
            const currentVal = parseInt(result.value, 10) || 0;
            const newVal =
              typeof adjustValue === "number"
                ? adjustValue
                : parseInt(adjustValue, 10) || 0;
            if (newVal < currentVal) {
              result.value = newVal;
              result.valueType = "number";
            }
          } else {
            // String value that isn't a pure number - use adjust value
            result.value =
              typeof adjustValue === "number"
                ? adjustValue
                : parseInt(adjustValue, 10) || 0;
            result.valueType = "number";
          }
        } else if (adjustMode === "add") {
          // Add the values
          const currentVal =
            typeof result.value === "number"
              ? result.value
              : parseInt(result.value, 10) || 0;
          const addVal =
            typeof adjustValue === "number"
              ? adjustValue
              : parseInt(adjustValue, 10) || 0;
          result.value = currentVal + addVal;
          result.valueType = "number";
        } else if (adjustMode === "multiply") {
          // Multiply the values
          const currentVal =
            typeof result.value === "number"
              ? result.value
              : parseFloat(result.value) || 0;
          const multVal =
            typeof adjustValue === "number"
              ? adjustValue
              : parseFloat(adjustValue) || 0;
          result.value = Math.floor(currentVal * multVal);
          result.valueType = "number";
        } else if (adjustMode === "override") {
          // Replace the value
          result.value = adjustValue;
          result.valueType =
            typeof adjustValue === "number" ? "number" : "string";
        }
      }
    });
  });

  if (allTypes && allTypes.length > 0) {
    results = results.filter((r) => allTypes.includes(r.modifierType));
  }

  // Remove adjustModifier entries from results as they've done their job
  // BUT only if we weren't specifically asking for adjustModifier types
  if (!allTypes || !allTypes.includes("adjustModifier")) {
    results = results.filter((r) => r.modifierType !== "adjustModifier");
  }

  if (field && field !== "") {
    results = results.filter(
      (r) =>
        r.field === field ||
        r.field === "all" ||
        r.field === itemId ||
        !r.field,
    );
  }

  // Filter by itemId if provided, some effects only apply to the itemId, or if the field is set to the itemId
  results = results.filter(
    (r) => r.itemId === itemId || r.field === itemId || r.itemId === undefined,
  );

  // For the roll, we need only count 1 status / item / circumstance bonus or penalty,
  // and we take the highest of each
  const filteredResults = [];
  const bonusGroups = { circumstance: [], item: [], status: [] };
  const penaltyGroups = { circumstance: [], item: [], status: [] };

  // Group results by type and bonus/penalty
  results.forEach((result) => {
    if (result.type === "" || result.type === "none") {
      // Keep non-typed modifiers as-is
      filteredResults.push(result);
      return;
    }

    // Check if this is a negative bonus and convert it to a penalty
    let isPenalty = result.modifierType.toLowerCase().includes("penalty");
    const isBonus = result.modifierType.toLowerCase().includes("bonus");

    // Parse the value to check if it's negative
    let numericValue = 0;
    if (typeof result.value === "number") {
      numericValue = result.value;
    } else if (typeof result.value === "string") {
      // Try to extract numeric value from string (e.g., "-2" or "1d4")
      const match = String(result.value).match(/^-?\d+/);
      if (match) {
        numericValue = parseInt(match[0], 10);
      }
    }

    // If this is a bonus but has a negative value, convert to penalty
    if (isBonus && !isPenalty && numericValue < 0) {
      result.modifierType = result.modifierType.replace(/bonus/gi, "penalty");
      result.isPenalty = true;
      isPenalty = true;
    }

    const groups = isPenalty ? penaltyGroups : bonusGroups;

    if (groups[result.type]) {
      groups[result.type].push(result);
    }
  });

  // For each type, keep only the highest value. Prefer active modifiers so a
  // predicate-failed (inactive) modifier can't shadow an active one of the same type
  // - e.g. Swashbuckler's Speed grants +10 with panache OR +5 without (mutually
  // exclusive predicates); the inactive higher value must not win the dedup and then
  // get dropped by the consumer's active check. Fall back to inactive only when
  // nothing in the group is active, so roll prompts still show a toggleable option.
  Object.keys(bonusGroups).forEach((type) => {
    if (bonusGroups[type].length > 0) {
      const activeBonuses = bonusGroups[type].filter((m) => m.active);
      const pool = activeBonuses.length > 0 ? activeBonuses : bonusGroups[type];
      const highestBonus = pool.reduce((highest, current) =>
        (current.value || 0) > (highest.value || 0) ? current : highest,
      );
      filteredResults.push(highestBonus);
    }

    if (penaltyGroups[type].length > 0) {
      const activePenalties = penaltyGroups[type].filter((m) => m.active);
      const pool =
        activePenalties.length > 0 ? activePenalties : penaltyGroups[type];
      const highestPenalty = pool.reduce((highest, current) =>
        (current.value || 0) < (highest.value || 0) ? current : highest,
      );
      filteredResults.push(highestPenalty);
    }
  });

  // Replace results with filtered results
  results = filteredResults;

  // Filter by appliedById if provided
  if (appliedById) {
    results = results.filter((r) => r.appliedBy === appliedById);
  }

  return results;
}

/**
 * Applies degree of success adjustments and returns the adjusted degree and modifier name.
 * This function is used in roll handlers (attack.js, skill.js, save.js) to apply adjustments
 * from effects and modifiers like Evasive Reflexes.
 *
 * @param {number} degreeOfSuccess - Original degree (-1=crit fail, 0=fail, 1=success, 2=crit success)
 * @param {Object} adjustments - Adjustment object from metadata.degreeOfSuccessAdjustments
 * @returns {Object} {degree: number, modifierName: string|null}
 */
function applyDegreeOfSuccessAdjustment(degreeOfSuccess, adjustments) {
  if (!adjustments) return { degree: degreeOfSuccess, modifierName: null };

  let appliedAdjustment = null;
  let appliedModifierName = null;

  // Map degree number to name: -1=criticalFailure, 0=failure, 1=success, 2=criticalSuccess
  let currentDegreeName = "";
  if (degreeOfSuccess === -1) currentDegreeName = "criticalFailure";
  else if (degreeOfSuccess === 0) currentDegreeName = "failure";
  else if (degreeOfSuccess === 1) currentDegreeName = "success";

  // Check for specific degree adjustment first
  if (currentDegreeName && adjustments[currentDegreeName]?.value !== "none") {
    appliedAdjustment = adjustments[currentDegreeName].value;
    appliedModifierName = adjustments[currentDegreeName].modifierName;
  }
  // Then check for "all" adjustment
  else if (adjustments.all?.value !== "none") {
    appliedAdjustment = adjustments.all.value;
    appliedModifierName = adjustments.all.modifierName;
  }

  if (!appliedAdjustment || appliedAdjustment === "none") {
    return { degree: degreeOfSuccess, modifierName: null };
  }

  // Apply the adjustment
  let newDegree = degreeOfSuccess;
  switch (appliedAdjustment) {
    case "one-degree-better":
      newDegree = Math.min(degreeOfSuccess + 1, 2);
      break;
    case "two-degrees-better":
      newDegree = Math.min(degreeOfSuccess + 2, 2);
      break;
    case "one-degree-worse":
      newDegree = Math.max(degreeOfSuccess - 1, -1);
      break;
    case "two-degrees-worse":
      newDegree = Math.max(degreeOfSuccess - 2, -1);
      break;
    case "to-critical-success":
      newDegree = 2;
      break;
    case "to-success":
      newDegree = 1;
      break;
    case "to-failure":
      newDegree = 0;
      break;
    case "to-critical-failure":
      newDegree = -1;
      break;
  }

  return { degree: newDegree, modifierName: appliedModifierName };
}

/**
 * Collects degree of success adjustments for a given field(s) and returns the best adjustment
 * for each degree (all, success, failure, criticalFailure).
 *
 * @param {Object} record - The character/token record
 * @param {string|Array<string>} fields - Field name(s) to check (e.g., "reflex" or ["reflex", "dex"])
 * @param {string} itemId - Optional item ID for item-specific adjustments
 * @param {string} appliedById - Optional applied by ID for effect tracking
 * @param {Object} context - Optional context for predicate evaluation
 * @returns {Object} Object with adjustment values and modifier names for each degree
 */
function getDegreeOfSuccessAdjustments(
  record,
  fields,
  itemId = undefined,
  appliedById = undefined,
  context = {},
) {
  // Normalize fields to array
  const fieldsArray = Array.isArray(fields) ? fields : [fields];

  const allAdjustments = [];

  // Collect adjustments for each field
  fieldsArray.forEach((field) => {
    const adjustments = getEffectsAndModifiersForToken(
      record,
      ["adjustDegreeOfSuccess"],
      field,
      itemId,
      appliedById,
      context,
    );
    allAdjustments.push(...adjustments);
  });

  // Define adjustment priority (higher is better)
  const adjustmentPriority = {
    none: 0,
    "two-degrees-worse": -2,
    "one-degree-worse": -1,
    "one-degree-better": 1,
    "two-degrees-better": 2,
    "to-failure": -1, // Specific to critical failure
    "to-critical-success": 2, // Specific to success
  };

  // Result object with best adjustment for each degree
  const result = {
    all: { value: "none", modifierName: null },
    success: { value: "none", modifierName: null },
    failure: { value: "none", modifierName: null },
    criticalFailure: { value: "none", modifierName: null },
  };

  // Process each adjustment and keep the best one for each degree
  allAdjustments.forEach((adj) => {
    if (!adj.active || !adj.value) return;

    const adjustmentValue = adj.value;
    const modifierName = adj.name;

    // Process each degree type
    ["all", "success", "failure", "criticalFailure"].forEach((degreeType) => {
      const newValue = adjustmentValue[degreeType];
      if (!newValue || newValue === "none") return;

      const currentPriority = adjustmentPriority[result[degreeType].value] || 0;
      const newPriority = adjustmentPriority[newValue] || 0;

      // Keep the better adjustment (higher priority for positive adjustments)
      if (newPriority > currentPriority) {
        result[degreeType] = { value: newValue, modifierName };
      }
    });
  });

  return result;
}

/**
 * Returns all Pathfinder 2e skills with their associated ability scores
 */
function getPathfinderSkills() {
  return {
    acrobatics: "dex",
    arcana: "int",
    athletics: "str",
    crafting: "int",
    deception: "cha",
    diplomacy: "cha",
    intimidation: "cha",
    medicine: "wis",
    nature: "wis",
    occultism: "int",
    performance: "cha",
    religion: "wis",
    society: "int",
    stealth: "dex",
    survival: "wis",
    thievery: "dex",
  };
}

function getAllSkillOptions() {
  return [
    { label: "Acrobatics", value: "acrobatics" },
    { label: "Arcana", value: "arcana" },
    { label: "Athletics", value: "athletics" },
    { label: "Crafting", value: "crafting" },
    { label: "Deception", value: "deception" },
    { label: "Diplomacy", value: "diplomacy" },
    { label: "Intimidation", value: "intimidation" },
    { label: "Medicine", value: "medicine" },
    { label: "Nature", value: "nature" },
    { label: "Occultism", value: "occultism" },
    { label: "Performance", value: "performance" },
    { label: "Religion", value: "religion" },
    { label: "Society", value: "society" },
    { label: "Stealth", value: "stealth" },
    { label: "Survival", value: "survival" },
    { label: "Thievery", value: "thievery" },
  ];
}

// Call this function after adding a talent/feature or equipping an item
function updateAllAttributes(record, callback = undefined) {
  const attributes = ["str", "dex", "con", "int", "wis", "cha"];
  const valuesToSet = {};

  // Use the existing ability scores to update derived values
  attributes.forEach((attribute) => {
    // Get the current ability score (already calculated from boosts + mods)
    const currentValue = parseInt(record.data?.[attribute] || 0, 10);

    // Calculate the modifiers and other derived values using the current score
    updateAttribute({
      record,
      attribute,
      value: currentValue,
      moreValuesToSet: valuesToSet,
    });
  });

  if (Object.keys(valuesToSet).length > 0) {
    api.setValuesOnRecord(record, valuesToSet, callback);
  }
}

// Get an effect macro for a given effect by its name and apply it a given number of times (max 4)
function applyEffect(
  effectName,
  times = 1,
  duration = undefined,
  value = undefined,
) {
  let targets = api.getSelectedOrDroppedToken();
  targets.forEach((target) => {
    const effects = [];
    for (let i = 0; i < times; i++) {
      effects.push(effectName);
    }
    api.addEffects(effects, target, duration, value);
  });
}

// Gets macros for all effects that an ability can apply
function getEffectMacrosFor(effects = []) {
  let effectButtons = "";
  const ourToken = api.getToken();
  const ourTokenId = ourToken?._id || "";
  let ourTokenName = ourToken?.name || ourToken?.record?.name || "";
  if (ourToken?.identified === false) {
    ourTokenName =
      ourToken?.unidentifiedName || ourToken?.record?.unidentifiedName;
  }
  ourTokenName = ourTokenName.replace(/'/g, "\\'"); // First escape single quotes
  effects.forEach((effectJson) => {
    const effect = JSON.parse(effectJson);
    const effectName = effect?.name || "";
    const effectID = effect?._id || "";
    const effectTitle = `Apply_${effectName.replace(/ /g, "_")}`;
    if (effectButtons !== "") {
      effectButtons += "\n";
    }
    effectButtons += `\`\`\`${effectTitle}
let targets = api.getSelectedOrDroppedToken();
targets.forEach(target => {
const ourToken = '${ourTokenId}' ? {_id: '${ourTokenId}', name: '${ourTokenName}'} : undefined;
api.addEffectById('${effectID}', target, undefined, ourToken);
});
\`\`\``;
  });
  return effectButtons;
}

function useItem() {
  // Shared with the grid popover's Use button; implementation is
  // useInventoryItem below.
  useInventoryItem(dataPath.replace(".data.useBtn", ""));
}

// Shared inventory "Use" logic. Outputs the item's description (plus any linked
// spell and damage/healing macros) to chat, then, for consumables, deducts uses
// then count (auto-destroying at 0 when configured). Shared by the item-row Use
// button (useItem) and the grid popover's Use button (useGridItem).
// `itemDataPath` is the path to the item, e.g. "data.inventory.3".
function useInventoryItem(itemDataPath) {
  const itemName = api.getValue(`${itemDataPath}.name`);
  const itemCount = api.getValue(`${itemDataPath}.data.count`);
  const item = api.getValue(itemDataPath);

  const indexValue = parseInt(itemDataPath.split(".").pop());

  const traits = item.data?.traits || [];
  const hasConsumableTrait = traits
    .map((trait) => trait.toLowerCase())
    .includes("consumable");
  const isConsumable = item.data?.type === "consumable" || hasConsumableTrait;

  // Output the description to Chat
  const description = api.getValue(`${itemDataPath}.data.description`) || "";

  const portrait = encodeURI(item?.portrait || "");
  const itemIcon = portrait
    ? `![${itemName}](${assetUrl}${portrait}?width=40&height=40) `
    : "";

  const itemDescription = updateDamageMacros(
    api.richTextToMarkdown(description || ""),
    { item },
  );
  let markdownDescription = `
#### ${itemIcon}${itemName}

---
${itemDescription}
`;

  let recordLinks;
  const spell = api.getValue(`${itemDataPath}.data.spell`);
  if (spell) {
    const spellName = JSON.parse(spell)?.name || "";
    const spellId = JSON.parse(spell)?._id || "";
    if (spellId) {
      recordLinks = [
        {
          tooltip: spellName,
          type: "records",
          value: {
            _id: spellId,
            recordType: "spells",
          },
        },
      ];
    }
  }

  const hasDamage =
    !!item.data?.damage?.formula ||
    !!item.data?.damage?.dice ||
    !!item.data?.damage?.persistent?.number;
  const isHealing = item.data?.damage?.kind === "healing";

  if (hasDamage) {
    let kind = isHealing ? "Healing" : "Damage";
    const damageButton = `\`\`\`Roll_${kind}
performDamageRollForSpellOrItem("${record._id}","${record.recordType}", "${itemDataPath}");
\`\`\``;
    markdownDescription += `\n${damageButton}`;
  }

  api.sendMessage(markdownDescription, undefined, recordLinks);

  // If consumable, deduct uses first, then count
  if (isConsumable) {
    // Auto destroy if true and not ammo or thrown weapon
    let autoDestroy = item.data?.uses?.autoDestroy || false;
    const isAmmo = item?.data?.itemCategory?.toLowerCase() === "ammo";
    const isThrown = item?.data?.traits?.some((trait) =>
      trait.toLowerCase().startsWith("thrown"),
    );
    const isBomb = item?.data?.group?.toLowerCase() === "bomb";

    const count = parseFloat(itemCount || "0");
    const currentUses = parseFloat(item.data?.uses?.value || "0");
    const maxUses = parseFloat(item.data?.uses?.max || "0");

    const valuesToSet = {};

    // Check if the item has a uses system (maxUses > 0)
    if (maxUses > 0) {
      // Deduct uses first
      const newUses = currentUses - 1;

      if (newUses > 0) {
        // Still have uses remaining
        valuesToSet[`${itemDataPath}.data.uses.value`] = newUses;
      } else if (newUses <= 0 && count > 1) {
        // Uses depleted, deduct count and reset uses
        valuesToSet[`${itemDataPath}.data.uses.value`] = maxUses;
        valuesToSet[`${itemDataPath}.data.count`] = count - 1;
      } else {
        // Uses and count both depleted
        valuesToSet[`${itemDataPath}.data.uses.value`] = 0;
        valuesToSet[`${itemDataPath}.data.count`] = 0;
      }
    } else {
      // No uses system, deduct count directly
      const newCount = count - 1;
      valuesToSet[`${itemDataPath}.data.count`] = newCount;
    }

    if (isAmmo || isThrown || isBomb) {
      autoDestroy = false;
    }

    // Determine if any ammo values need adjusting (if it's ammo, a thrown weapon, or a bomb)
    const finalCount = valuesToSet[`${itemDataPath}.data.count`] ?? count;
    if (isAmmo) {
      const inventory = record?.data?.inventory || [];
      inventory.forEach((inventoryItem, index) => {
        if (inventoryItem.data?.ammoSelect === item._id) {
          valuesToSet[`data.inventory.${index}.data.ammo`] = finalCount;
        }
      });
    } else if (isThrown || isBomb) {
      valuesToSet[`${itemDataPath}.data.ammo`] = finalCount;
    }

    const shouldDestroy = autoDestroy && finalCount <= 0;

    if (!shouldDestroy || finalCount > 0) {
      api.setValues(valuesToSet, () => {
        // Re-query the record to get the latest data
        api.getRecord(record.recordType, record._id, (updatedRecord) => {
          updateTotalBulk(updatedRecord, true);
        });
      });
    } else if (shouldDestroy && !isNaN(indexValue)) {
      api.removeValue(`data.inventory`, indexValue, () => {
        // Re-query the record to get the latest data
        api.getRecord(record.recordType, record._id, (updatedRecord) => {
          updateTotalBulk(updatedRecord, true);
        });
      });
    }
  }
}

function onItemInvested() {
  onAddEditFeature(record, undefined, true);
}

// Returns the proper fields object for the given item
function getItemFields(item) {
  const traits = item.data?.traits || [];
  const hasInvestedTrait = traits
    .map((trait) => trait.toLowerCase())
    .includes("invested");
  const hasArmorPropertyRunes =
    (item.data?.runes?.property || []).length > 0 &&
    item.data?.type === "armor";
  const hasArmorPotencyRune =
    !!item.data?.runes?.potency && item.data?.type === "armor";
  const hasArmorResilientRune =
    !!item.data?.runes?.resilient && item.data?.type === "armor";
  const hasConsumableTrait = traits
    .map((trait) => trait.toLowerCase())
    .includes("consumable");
  const isConsumable = item.data?.type === "consumable" || hasConsumableTrait;
  const hasUseBtn = item.data?.hasUseBtn || false;
  const isTwoHanded = item.data?.usage === "held-in-two-hands";
  const isThrown = traits
    .map((trait) => trait.toLowerCase())
    .some((trait) => trait.startsWith("thrown"));
  const isBomb = item.data?.group?.toLowerCase() === "bomb";
  const isMelee = (item.data?.range || 0) === 0; // Melee shown only melee icon
  const hasVersatilePiercingProperty = traits.some((trait) => {
    const lower = trait.toLowerCase();
    return lower === "versatile p" || lower === "versatile-p";
  });
  const hasVersatileBludgeoningProperty = traits.some((trait) => {
    const lower = trait.toLowerCase();
    return lower === "versatile b" || lower === "versatile-b";
  });
  const hasVersatileSlashingProperty = traits.some((trait) => {
    const lower = trait.toLowerCase();
    return lower === "versatile s" || lower === "versatile-s";
  });

  // If we have any of the versatile properties, we need to show the toggle for the
  // primary damage type
  const hasVersatile =
    hasVersatilePiercingProperty ||
    hasVersatileBludgeoningProperty ||
    hasVersatileSlashingProperty;
  const versatileFields = {
    versatilePiercing: { hidden: !hasVersatilePiercingProperty },
    versatileBludgeoning: { hidden: !hasVersatileBludgeoningProperty },
    versatileSlashing: { hidden: !hasVersatileSlashingProperty },
  };
  if (hasVersatile) {
    const itemDamageType = item.data?.damage?.damageType || "";
    if (itemDamageType === "bludgeoning") {
      versatileFields.versatileBludgeoning = { hidden: false };
    } else if (itemDamageType === "piercing") {
      versatileFields.versatilePiercing = { hidden: false };
    } else if (itemDamageType === "slashing") {
      versatileFields.versatileSlashing = { hidden: false };
    }
  }

  const requiresReload = (item.data?.reload || 0) > 0;

  return {
    invested: {
      hidden:
        !hasInvestedTrait &&
        !hasArmorPropertyRunes &&
        !hasArmorPotencyRune &&
        !hasArmorResilientRune,
    },
    useBtn: { hidden: !isConsumable && !hasUseBtn },
    handBtn: { hidden: isTwoHanded },
    rangeToggleBtn: { hidden: !(isMelee && isThrown) },
    rangeToggleBtnDisabled: { hidden: isMelee },
    meleeToggleBtnDisabled: { hidden: !isMelee || (isMelee && isThrown) },
    ammoFields: { hidden: isMelee && !isThrown },
    ammo: { hidden: isMelee && !isThrown },
    reloadBtn: { hidden: !requiresReload },
    loadedAmmo: { hidden: !requiresReload },
    ammoSelect: { hidden: isMelee || isThrown || isBomb },
    ...versatileFields,
  };
}

// On the given, item, and valuesToSet, set the items fields as needed
function setItemFields(item, itemDataPath, valuesToSet) {
  const itemFields = item.fields || {};
  const traits = item.data?.traits || [];
  const hasInvestedTrait = traits
    .map((trait) => trait.toLowerCase())
    .includes("invested");
  const hasArmorPropertyRunes =
    (item.data?.runes?.property || []).length > 0 &&
    item.data?.type === "armor";
  const hasArmorPotencyRune =
    !!item.data?.runes?.potency && item.data?.type === "armor";
  const hasArmorResilientRune =
    !!item.data?.runes?.resilient && item.data?.type === "armor";
  const hasConsumableTrait = traits
    .map((trait) => trait.toLowerCase())
    .includes("consumable");
  const isConsumable = item.data?.type === "consumable" || hasConsumableTrait;
  const hasUseBtn = item.data?.hasUseBtn || false;
  const isTwoHanded = item.data?.usage === "held-in-two-hands";
  const isThrown = traits
    .map((trait) => trait.toLowerCase())
    .some((trait) => trait.startsWith("thrown"));
  const isBomb = item.data?.group?.toLowerCase() === "bomb";
  const isMelee = (item.data?.range || 0) === 0; // Melee shown only melee icon
  const hasVersatilePiercingProperty = traits.some((trait) => {
    const lower = trait.toLowerCase();
    return lower === "versatile p" || lower === "versatile-p";
  });
  const hasVersatileBludgeoningProperty = traits.some((trait) => {
    const lower = trait.toLowerCase();
    return lower === "versatile b" || lower === "versatile-b";
  });
  const hasVersatileSlashingProperty = traits.some((trait) => {
    const lower = trait.toLowerCase();
    return lower === "versatile s" || lower === "versatile-s";
  });

  const requiresReload = (item.data?.reload || 0) > 0;

  // Set properties - only set hidden to false when needed (to unhide)
  if (
    (hasInvestedTrait ||
      hasArmorPropertyRunes ||
      hasArmorPotencyRune ||
      hasArmorResilientRune) &&
    itemFields?.invested?.hidden !== false
  ) {
    valuesToSet[`${itemDataPath}.fields.invested.hidden`] = false;
  } else if (
    !hasInvestedTrait &&
    !hasArmorPropertyRunes &&
    !hasArmorPotencyRune &&
    !hasArmorResilientRune &&
    itemFields?.invested?.hidden !== true
  ) {
    valuesToSet[`${itemDataPath}.fields.invested.hidden`] = true;
  }

  if ((isConsumable || hasUseBtn) && itemFields?.useBtn?.hidden !== false) {
    valuesToSet[`${itemDataPath}.fields.useBtn.hidden`] = false;
  }
  if (!isTwoHanded && itemFields?.handBtn?.hidden !== false) {
    valuesToSet[`${itemDataPath}.fields.handBtn.hidden`] = false;
  }
  // Show toggle button only for melee throwing weapons
  if (isMelee && isThrown && itemFields?.rangeToggleBtn?.hidden !== false) {
    valuesToSet[`${itemDataPath}.fields.rangeToggleBtn.hidden`] = false;
  }
  // Hide disabled range button for melee weapons or when toggle is showing
  if (!isMelee && itemFields?.rangeToggleBtnDisabled?.hidden !== false) {
    valuesToSet[`${itemDataPath}.fields.rangeToggleBtnDisabled.hidden`] = false;
  }
  // Hide disabled melee button for ranged weapons or thrown melee weapons
  if (
    isMelee &&
    !isThrown &&
    itemFields?.meleeToggleBtnDisabled?.hidden !== false
  ) {
    valuesToSet[`${itemDataPath}.fields.meleeToggleBtnDisabled.hidden`] = false;
  }
  if (
    (!isMelee || isThrown) &&
    (itemFields?.ammo?.hidden !== false ||
      itemFields?.ammoFields?.hidden !== false)
  ) {
    valuesToSet[`${itemDataPath}.fields.ammoFields.hidden`] = false;
    valuesToSet[`${itemDataPath}.fields.ammo.hidden`] = false;
  }
  // Reload fields
  if (requiresReload && itemFields?.reloadBtn?.hidden !== false) {
    valuesToSet[`${itemDataPath}.fields.reloadBtn.hidden`] = false;
  }
  if (requiresReload && itemFields?.loadedAmmo?.hidden !== false) {
    valuesToSet[`${itemDataPath}.fields.loadedAmmo.hidden`] = false;
  }
  if (
    !isMelee &&
    !isBomb &&
    !isThrown &&
    itemFields?.ammoSelect?.hidden !== false
  ) {
    valuesToSet[`${itemDataPath}.fields.ammoSelect.hidden`] = false;
  }

  if (isThrown && item.data?.count !== item.data?.ammo) {
    valuesToSet[`${itemDataPath}.data.ammo`] = item.data?.count;
  }

  // Versatile fields
  if (
    hasVersatilePiercingProperty &&
    itemFields?.versatilePiercing?.hidden !== false
  ) {
    valuesToSet[`${itemDataPath}.fields.versatilePiercing.hidden`] = false;
  }
  if (
    hasVersatileBludgeoningProperty &&
    itemFields?.versatileBludgeoning?.hidden !== false
  ) {
    valuesToSet[`${itemDataPath}.fields.versatileBludgeoning.hidden`] = false;
  }
  if (
    hasVersatileSlashingProperty &&
    itemFields?.versatileSlashing?.hidden !== false
  ) {
    valuesToSet[`${itemDataPath}.fields.versatileSlashing.hidden`] = false;
  }

  const hasVersatile =
    hasVersatilePiercingProperty ||
    hasVersatileBludgeoningProperty ||
    hasVersatileSlashingProperty;

  // Also set the fields for the versatile properties
  if (hasVersatile) {
    const itemDamageType = item.data?.damage?.damageType || "";
    if (
      itemDamageType === "bludgeoning" &&
      itemFields?.versatileBludgeoning?.hidden !== false
    ) {
      valuesToSet[`${itemDataPath}.fields.versatileBludgeoning.hidden`] = false;
    } else if (
      itemDamageType === "piercing" &&
      itemFields?.versatilePiercing?.hidden !== false
    ) {
      valuesToSet[`${itemDataPath}.fields.versatilePiercing.hidden`] = false;
    } else if (
      itemDamageType === "slashing" &&
      itemFields?.versatileSlashing?.hidden !== false
    ) {
      valuesToSet[`${itemDataPath}.fields.versatileSlashing.hidden`] = false;
    }
  }
}

function onItemEquipped() {
  onItemEquippedFor(dataPath.replace(".data.carried", ""), value);
}

// Shared equip/carry/drop handler. Applies/removes equip effects, recomputes
// bulk, refreshes per-item field visibility, and re-runs the character recalc.
// Shared by the item-row carried dropdown (onItemEquipped) and the grid
// Equip/Carry/Drop actions (equipGridItem).
function onItemEquippedFor(itemDataPath, newValue) {
  const item = api.getValue(itemDataPath);

  // Some items add/remove effects when equipped
  const equipEffect = api.getValue(`${itemDataPath}.data.equipEffect`);
  const isEquipEffect = newValue === "equipped";

  if (equipEffect) {
    const effect = JSON.parse(equipEffect);
    const effectId = effect?._id || "";
    const ourToken = api.getToken();
    if (effectId && isEquipEffect && ourToken) {
      api.addEffectById(effectId, ourToken);
    } else if (effectId && !isEquipEffect && ourToken) {
      api.removeEffectById(effectId, ourToken);
    }
  }

  // If an item's equipped status changes, we need to recalculate the total bulk
  // and update any bonuses such as AC if it's a piece of armor
  const valuesToSet = {};
  const totalBulk = updateTotalBulk(record, false);
  if (totalBulk !== record?.data?.totalBulk) {
    valuesToSet["data.totalBulk"] = totalBulk;
  }

  // Update the fields to show/hide the correct buttons on attack list
  // based on type incase it changed
  setItemFields(item, itemDataPath, valuesToSet);

  if (Object.keys(valuesToSet).length > 0) {
    api.setValues(valuesToSet, (recordUpdated) => {
      // Update attributes as needed
      onAddEditFeature(recordUpdated, undefined, true);
    });
  } else {
    onAddEditFeature(record, undefined, true);
  }
}

// Gets the AC for an armor item
function getACForArmor(item) {
  let ac = item?.data?.acBonus || 0;
  // Check for potency runes
  const potencyRune = parseInt(item?.data?.runes?.potency || 0, 10);
  ac += potencyRune;
  return ac;
}

// Gets the best equipped armor for the context of the current PC
// Mirrors a just-changed item field onto the in-memory record's inventory entry.
// getBestEquippedArmor() reads record.data.inventory, and a handler invoked from an
// api.setValue callback still sees the pre-change snapshot — so total bulk and AC would
// be computed from the PREVIOUS state. api.getValue is always fresh, so sync the
// fresh value across before re-deriving. No-op for items that aren't inventory
// rows (a compendium item record has no parent inventory).
function syncInventoryItemValue(itemDataPath, key, value) {
  if (!itemDataPath || !itemDataPath.startsWith("data.inventory.")) return;
  const index = parseInt(itemDataPath.split(".")[2], 10);
  if (isNaN(index)) return;
  const entry = record?.data?.inventory?.[index];
  if (!entry) return;
  entry.data = { ...(entry.data || {}), [key]: value };
}

function getBestEquippedArmor(record) {
  // Get the current ac due to armor
  let bestEquippedArmor = {
    armor: {
      armorId: null,
      armorIndex: null,
      acBonus: 0,
      dexCap: 10, // Unarmored, just set cap to 10
      strength: null,
      checkPenalty: null,
      speedPenalty: null,
      armorCategory: "unarmored",
      group: "",
      propertyRunes: [],
    },
    shield: {
      shieldId: null,
      shieldIndex: null,
      acBonus: 0,
      hardness: 0,
      traits: [],
      hp: {
        value: 0,
        max: 0,
      },
      speedPenalty: null,
    },
  };

  const items = record?.data?.inventory || [];
  items.forEach((item, index) => {
    if (item.data?.carried === "equipped" && item.data?.type === "armor") {
      const ac = getACForArmor(item);
      const dexCap = item?.data?.dexCap ? item?.data?.dexCap : 0;
      if (ac > bestEquippedArmor.armor.acBonus) {
        bestEquippedArmor.armor.acBonus = ac;
        bestEquippedArmor.armor.dexCap = dexCap;
        bestEquippedArmor.armor.checkPenalty = item?.data?.checkPenalty;
        bestEquippedArmor.armor.speedPenalty = item?.data?.speedPenalty;
        bestEquippedArmor.armor.strength = item?.data?.strength;
        bestEquippedArmor.armor.armorId = item?._id;
        bestEquippedArmor.armor.armorIndex = index;
        bestEquippedArmor.armor.propertyRunes =
          item?.data?.runes?.property || [];
        bestEquippedArmor.armor.armorCategory = (
          item?.data?.itemCategory || "unarmored"
        ).toLowerCase();
        bestEquippedArmor.armor.group = (item?.data?.group || "").toLowerCase();
      }
    } else if (
      item.data?.carried === "equipped" &&
      item.data?.type === "shield"
    ) {
      const ac = item?.data?.acBonus || 0;
      const hardness = item?.data?.hardness || 0;
      const hpValue = item?.data?.hp?.value || 0;
      if (
        ac > bestEquippedArmor.shield.acBonus ||
        (ac === bestEquippedArmor.shield.acBonus &&
          hardness > bestEquippedArmor.shield.hardness) ||
        (ac === bestEquippedArmor.shield.acBonus &&
          hardness === bestEquippedArmor.shield.hardness &&
          hpValue > bestEquippedArmor.shield.hp.value)
      ) {
        bestEquippedArmor.shield.acBonus = ac;
        bestEquippedArmor.shield.hardness = item?.data?.hardness;
        bestEquippedArmor.shield.hp.value = item?.data?.hp?.value;
        bestEquippedArmor.shield.hp.max = item?.data?.hp?.max;
        bestEquippedArmor.shield.speedPenalty = item?.data?.speedPenalty;
        bestEquippedArmor.shield.shieldId = item?._id;
        bestEquippedArmor.shield.shieldIndex = index;
        bestEquippedArmor.shield.traits = item?.data?.traits || [];
      }
    }
  });

  return bestEquippedArmor;
}

// Returns bonuses to Saves for Resiliency rune in armor
function getResilientArmorBonus(record, bestArmor) {
  // Check if record and bestArmor are valid
  if (!record || !bestArmor?.armor?.armorId) {
    return null;
  }

  // Find the armor in the inventory and check for a rune
  const armor = (record.data?.inventory || [])?.find(
    (item) => item._id === bestArmor?.armor?.armorId,
  );

  if (armor) {
    const resiliencyRune = parseInt(armor?.data?.runes?.resilient || 0, 10);
    if (resiliencyRune > 0) {
      let runeName = "Resilient";
      if (resiliencyRune === 2) {
        runeName = "Greater Resilient";
      } else if (resiliencyRune === 3) {
        runeName = "Major Resilient";
      }
      return [
        {
          value: Math.abs(resiliencyRune),
          isPenalty: false,
          valueType: "number",
          name: `Armor ${runeName} Rune`,
          type: "item",
          modifierType: "saveBonus",
          field: "all",
          active: true,
        },
      ];
    }
  }

  return null;
}

// Returns the penalty if necessary for the armor worn
function getCheckPenaltyForArmor(record, bestArmor) {
  if (!record) {
    return null;
  }

  const checkPenalty =
    bestArmor?.armor?.checkPenalty !== undefined
      ? bestArmor.armor.checkPenalty
      : 0;
  const strength = record.data?.str != undefined ? record.data?.str : 0;
  const armorStrengthRequired = bestArmor?.armor?.strength;
  if (armorStrengthRequired !== undefined && strength < armorStrengthRequired) {
    return [
      {
        value: -1 * Math.abs(checkPenalty),
        isPenalty: true,
        valueType: "number",
        name: "Check Penalty",
        type: "item",
        modifierType: "skillPenalty",
        field: "str",
        active: true,
      },
      {
        value: -1 * Math.abs(checkPenalty),
        isPenalty: true,
        valueType: "number",
        name: "Check Penalty",
        type: "item",
        modifierType: "skillPenalty",
        field: "dex",
        active: true,
      },
    ];
  }
  return null;
}

function getSaveDCForToken(token, saveType) {
  const saveMods = getEffectsAndModifiersForToken(
    token,
    [`saveBonus`, `savePenalty`],
    saveType,
  );

  const saveValue = parseInt(token.data?.[`${saveType}Mod`] || "0", 10);

  let saveDC = 10 + saveValue;

  saveMods.forEach((mod) => {
    const value = parseInt(mod.value || 0, 10);
    saveDC += value;
  });

  return saveDC;
}

function getArmorClassForToken(token, targetIsOffGuardDueToFlanking = false) {
  // Get best equipped armor to pass as context for predicate evaluation
  const bestArmor = getBestEquippedArmor(token);
  let armorItem = null;
  if (bestArmor?.armor?.armorId) {
    const inventory =
      token?.data?.inventory || token?.record?.data?.inventory || [];
    armorItem = inventory.find((item) => item._id === bestArmor.armor.armorId);
  }

  const acModifiers = getEffectsAndModifiersForToken(
    token,
    ["armorClassBonus", "armorClassPenalty", "allBonus", "allPenalty"],
    undefined,
    undefined,
    undefined,
    armorItem ? { item: armorItem } : {},
  );

  let tokenData = token.data === undefined ? token.record.data : token.data;

  // NPCs store in attributes.ac.value, PCs store in ac, fall back to 10 as the default
  let ac = tokenData?.attributes?.ac?.value || tokenData?.ac || 10;

  // Check if there's already a circumstance penalty
  const existingCircumstancePenalty = acModifiers.find(
    (mod) => mod.modifierType === "circumstance" && mod.isPenalty,
  );

  // Apply all modifiers from getEffectsAndModifiersForToken
  // (already returns highest of each type)
  acModifiers.forEach((mod) => {
    // Only if it's from an effect, because features/feats adjust it directly if it's a character
    // and if the modifier was active
    if ((mod.isEffect || token.recordType !== "characters") && mod.active) {
      const value = parseInt(mod.value || 0, 10);
      ac += value;
    }
  });

  // Handle flanking: -2 circumstance penalty
  if (targetIsOffGuardDueToFlanking) {
    if (!existingCircumstancePenalty) {
      // No circumstance penalty exists, add -2 for flanking
      ac -= 2;
    } else if (existingCircumstancePenalty.value === -1) {
      // Existing penalty is -1, but flanking is -2 (higher)
      // Add an additional -1 to reach -2 total
      ac -= 1;
    }
  }

  return ac;
}

function updateAttribute({
  record,
  attribute,
  value,
  moreValuesToSet = undefined,
}) {
  const valuesToSet = {};

  const val = parseInt(value, 10);
  if (isNaN(val)) {
    return;
  }

  // Since direct editing is disabled, the value passed in is already the final ability score
  // Store it directly
  valuesToSet[`data.${attribute}`] = val;

  // Get hitpoints max modifiers
  const hitpointsMaxMods = getEffectsAndModifiersForToken(record, [
    "hitpoints",
  ]);
  const extraHitpoints = hitpointsMaxMods.reduce((acc, mod) => {
    return acc + parseInt(mod.value || 0, 10);
  }, 0);

  // If this was constitution, update hitpoints
  if (attribute === "con") {
    // hitpoints = CON MOD + hp rolled at each level (min 1)
    const conMod = value;
    // Hit Points in PF2e is Ancestry HP + (Class HP + Con Mod)*Level
    const ancestryHp = record.data?.ancestries?.[0]?.data?.hp || 0;
    const classHp = record.data?.classes?.[0]?.data?.hp || 0;
    const level = record.data?.level || 0;
    const totalHp = extraHitpoints + ancestryHp + (conMod + classHp) * level;
    valuesToSet[`data.hitpoints`] = totalHp;
    // If curhp is not set, set it to hitpoints
    if (record.data?.curhp === undefined) {
      valuesToSet[`data.curhp`] = totalHp;
    }
  }

  // You can carry an amount of Bulk equal to 5 plus your Strength modifier without penalty
  let strength = parseInt(
    record.data?.str !== undefined ? record.data?.str : 0,
    10,
  );
  if (attribute === "str") {
    strength = value;
  }
  valuesToSet[`data.bulk`] = 5 + strength;

  // AC = 10 + your Dexterity modifier. Wearing armor changes your AC and adds proficency bonus if proficient
  let dexValue = parseInt(
    record.data?.dex !== undefined ? record.data?.dex : 0,
    10,
  );
  if (attribute === "dex") {
    dexValue = value;
  }
  const bestArmor = getBestEquippedArmor(record);

  // Get the armor item to pass as context for predicate evaluation
  let armorItem = null;
  if (bestArmor?.armor?.armorId) {
    const inventory = record.data?.inventory || [];
    armorItem = inventory.find((item) => item._id === bestArmor.armor.armorId);
  }

  let ac = 10 + Math.max(0, bestArmor.armor.acBonus);
  let additionalAcAttribute = "dex";
  // Check for armorClassCalculation mods
  const acCalculationMods = getEffectsAndModifiersForToken(
    record,
    ["armorClassCalculation"],
    undefined,
    undefined,
    undefined,
    armorItem ? { item: armorItem } : {},
  );
  acCalculationMods.forEach((mod) => {
    if (mod.field !== undefined && mod.field !== "dex") {
      additionalAcAttribute = mod.field;
    }
  });
  if (additionalAcAttribute !== "dex") {
    let additionalAcValue = parseInt(
      record.data?.[additionalAcAttribute] !== undefined
        ? record.data?.[additionalAcAttribute]
        : 0,
      10,
    );
    if (attribute === additionalAcAttribute) {
      additionalAcValue = value;
    }
    ac += additionalAcValue;
  }
  // AC = 10 + your Dexterity modifier. Wearing armor changes your AC.
  if (bestArmor.armor.dexCap !== undefined && bestArmor.armor.dexCap > 0) {
    ac += Math.min(dexValue, bestArmor.armor.dexCap);
  }
  const shieldBroken = record.data?.shieldBroken === true;
  // AC bonus is only if shield is equipped AND raised AND not broken
  if (
    bestArmor.shield &&
    record.data?.shieldRaised === "true" &&
    !shieldBroken
  ) {
    ac += bestArmor.shield.acBonus;
  }
  // Get proficiency bonus for this armor type
  const armorProf = getProfiencyForArmor(
    record,
    bestArmor?.armor?.armorCategory,
    bestArmor?.armor?.group,
  );
  // Prof bonus is prof * 2 + level, if we're proficient, else we don't add level
  if (armorProf > 0) {
    ac += armorProf * 2 + (record?.data?.level || 0);
  }

  const acBonus = getEffectsAndModifiersForToken(
    record,
    ["armorClassBonus", "armorClassPenalty"],
    "all",
    undefined,
    undefined,
    armorItem ? { item: armorItem } : {},
  );
  const armorModsSet = new Set();
  acBonus.forEach((modifier) => {
    // Only if it was from a feature or item, not effect
    // And also if it had a predicate, only if it evaluates to true (modifier.active is true)
    if (
      !armorModsSet.has(JSON.stringify(modifier) && !modifier.isEffect) &&
      modifier.active
    ) {
      ac += modifier.value;
      armorModsSet.add(JSON.stringify(modifier));
    }
  });
  // Also get the armor type bonuses
  if (bestArmor.armorType) {
    const armorTypeBonus = getEffectsAndModifiersForToken(
      record,
      ["armorClassBonus", "armorClassPenalty"],
      bestArmor.armorType,
      undefined,
      undefined,
      armorItem ? { item: armorItem } : {},
    );
    armorTypeBonus.forEach((modifier) => {
      // Only if it was from a feature or item, not effect
      // And also if it had a predicate, only if it evaluates to true (modifier.active is true)
      if (
        !armorModsSet.has(JSON.stringify(modifier) && !modifier.isEffect) &&
        modifier.active
      ) {
        ac += modifier.value;
        armorModsSet.add(JSON.stringify(modifier));
      }
    });
  }
  // Also get the shield bonuses
  if (bestArmor.shieldName) {
    const shieldBonus = getEffectsAndModifiersForToken(
      record,
      ["armorClassBonus", "armorClassPenalty"],
      "Shield",
      undefined,
      undefined,
      armorItem ? { item: armorItem } : {},
    );
    shieldBonus.forEach((modifier) => {
      // Only if it was from a feature or item, not effect
      if (
        !armorModsSet.has(JSON.stringify(modifier) && !modifier.isEffect) &&
        modifier.active
      ) {
        ac += modifier.value;
        armorModsSet.add(JSON.stringify(modifier));
      }
    });
  }

  valuesToSet[`data.ac`] = ac;

  // Check for speed penalty. Note: getBestEquippedArmor returns speedPenalty: null
  // (not undefined) when unarmored, so guard against a non-positive base penalty -
  // otherwise the strength-requirement reduction below turns 0 into -5.
  let totalSpeedPenalty = 0;
  const armorSpeedPenalty = parseInt(bestArmor?.armor?.speedPenalty, 10) || 0;
  const armorStrength = parseInt(bestArmor?.armor?.strength, 10) || 0;
  if (armorSpeedPenalty > 0) {
    totalSpeedPenalty = armorSpeedPenalty;
    // If we meet the strength requirement, reduce speed penalty by 5 (min 0)
    if (strength >= armorStrength) {
      totalSpeedPenalty -= 5;
    }
  }
  // If the shield has a speed penalty always add it
  const shieldSpeedPenalty = parseInt(bestArmor?.shield?.speedPenalty, 10) || 0;
  if (shieldSpeedPenalty > 0) {
    totalSpeedPenalty += shieldSpeedPenalty;
  }
  // A speed penalty can never be negative (the strength reduction floors at 0).
  totalSpeedPenalty = Math.max(0, totalSpeedPenalty);

  // Collect speed bonus/penalty modifiers from feats, features, items, and effects.
  // getEffectsAndModifiersForToken already negates penalty values and returns the
  // highest of each stacking type (status/item/circumstance), so summing is correct.
  const speedMods = getEffectsAndModifiersForToken(record, [
    "speedBonus",
    "speedPenalty",
  ]);
  let totalSpeedModifier = 0;
  speedMods.forEach((mod) => {
    if (mod.active) {
      totalSpeedModifier += parseInt(mod.value || 0, 10) || 0;
    }
  });

  const speed = record.data?.speed || "";
  valuesToSet[`data.speedPenalty`] = totalSpeedPenalty;

  // Derive the base speed from the ancestry (an immutable source) so recomputation
  // never compounds - adding a speed bonus must not read back a value that already
  // includes a previously-applied bonus. Fall back to the current speed field (minus
  // any parenthetical note) for characters without an ancestry speed (e.g. NPCs).
  const ancestrySpeed = record.data?.ancestries?.[0]?.data?.speed;
  const baseSpeedStr = String(ancestrySpeed || speed || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();

  const speedMatch = baseSpeedStr.match(/(\d+)/);
  if (speedMatch) {
    const baseSpeed = parseInt(speedMatch[1], 10);
    // Net: feat/effect/item speed modifiers minus the armor speed penalty.
    const effectiveSpeed = Math.max(
      0,
      baseSpeed + totalSpeedModifier - totalSpeedPenalty,
    );
    // Preserve the unit from the base speed (e.g., "feet").
    const unitMatch = baseSpeedStr.match(/\d+\s+(\w+)/);
    const unit = unitMatch ? unitMatch[1] : "feet";
    const newSpeed = `${effectiveSpeed} ${unit}`;
    if (newSpeed !== speed) {
      valuesToSet[`data.speed`] = newSpeed;
    }
  }

  if (bestArmor?.shield?.hp?.value !== undefined) {
    valuesToSet[`data.shieldHp`] = bestArmor.shield.hp.value;
    valuesToSet[`data.shieldMaxHp`] = bestArmor.shield.hp.max;
    valuesToSet[`data.shieldBt`] = Math.floor(
      (bestArmor.shield.hp.max || 0) / 2,
    );
  } else {
    valuesToSet[`data.shieldHp`] = null;
    valuesToSet[`data.shieldMaxHp`] = null;
    valuesToSet[`data.shieldBt`] = null;
  }
  if (bestArmor?.shield?.hardness !== undefined) {
    valuesToSet[`data.shieldHardness`] = bestArmor.shield.hardness;
  } else {
    valuesToSet[`data.shieldHardness`] = null;
  }
  if (bestArmor?.shield?.acBonus !== undefined) {
    valuesToSet[`data.shieldAC`] = bestArmor.shield.acBonus;
  } else {
    valuesToSet[`data.shieldAC`] = null;
  }

  // If moreValuesToSet is provided, add it to the valuesToSet else call API directly
  if (moreValuesToSet) {
    Object.keys(valuesToSet).forEach((key) => {
      moreValuesToSet[key] = valuesToSet[key];
    });
  } else {
    api.setValuesOnRecord(record, valuesToSet);
  }
}

// This function looks for all features in the record that have choices,
// then checks for features that were provided by the choices. If we have
// any choices that are not yet provided, we prompt the user to make a choice
// and then add the feature to the record.
function processChoices(record, depth = 0) {
  const characterLevel = record.data?.level || 1;
  const ancestryFeatures = [];
  const heritageFeatures = [];
  const classFeatures = [];
  // Collect all features from ancestries, heritages, and classes
  const ancestries = record.data?.ancestries || [];
  const heritages = record.data?.heritages || [];
  const classes = record.data?.classes || [];
  for (const ancestry of ancestries) {
    ancestryFeatures.push(...(ancestry.data?.features || []));
  }
  for (const heritage of heritages) {
    heritageFeatures.push(...(heritage.data?.features || []));
  }
  for (const classObj of classes) {
    classFeatures.push(...(classObj.data?.features || []));
  }

  // Collect all feats
  const feats = record.data?.feats || [];
  const bonusFeats = record.data?.bonusFeats || [];

  const groups = [
    {
      name: "Ancestry",
      // Assume only ever 1 ancestry
      dataPath: "data.ancestries.0.data.features",
      features: ancestryFeatures,
    },
    {
      name: "Heritage",
      // Assume only ever 1 heritage
      dataPath: "data.heritages.0.data.features",
      features: heritageFeatures,
    },
    {
      name: "Class",
      // Assume only ever 1 class
      dataPath: "data.classes.0.data.features",
      features: classFeatures,
    },
    {
      name: "Feats",
      dataPath: "data.feats",
      features: feats,
    },
    {
      name: "Bonus Feats",
      dataPath: "data.bonusFeats",
      features: bonusFeats,
    },
  ];

  // Collect traits for predicate evaluation
  const traitsSet = collectTraitsAndProperties(record, {});

  // Now check for choices that are not yet provided
  const choicesToMake = [];

  for (const group of groups) {
    for (const feature of group.features) {
      // If this feature is for our level or lower, check for choices
      const featureLevel = feature.data?.level || 0;
      if (featureLevel <= characterLevel) {
        const choiceObjects = feature.data?.choices || [];

        // Check each choice object to see if a selection has been made
        for (const choiceObj of choiceObjects) {
          // Check if this choice object has a predicate that needs to pass
          if (choiceObj.data?.predicate) {
            const parsedPredicate = parseModifierPredicate(
              choiceObj.data.predicate,
            );
            const predicatePassed = evaluateEffectPredicate(
              parsedPredicate,
              traitsSet,
              record,
              {},
            );
            if (!predicatePassed) {
              continue; // Skip this choice if predicate fails
            }
          }

          const selectedChoices = choiceObj.data?.choices || [];
          const options = choiceObj.data?.options || [];
          const hasQuery =
            choiceObj.data?.query && choiceObj.data.query.trim() !== "";
          const isTextInput = choiceObj.data?.isTextInput === true;

          // If there are options, a query, or it's a text input, and no selection has been made yet, prompt for choice
          if (
            (options.length > 0 || hasQuery || isTextInput) &&
            selectedChoices.length === 0
          ) {
            choicesToMake.push({ feature, group, choiceObj });
          }
        }
      }
    }
  }

  promptForChoices(record, choicesToMake, 0, depth);
}

function addFeatsToCharacter(record, feats, callback = undefined) {
  const curFeats = record.data?.feats || [];

  // If there are no feats to add, call callback and return
  if (feats.length === 0) {
    if (callback) callback();
    return;
  }

  // Helper function to collect feats recursively
  function collectFeats(featIds, collectedFeats = []) {
    if (featIds.length === 0) {
      // All feats collected, now append them to the character's feats
      const updatedFeats = [...curFeats, ...collectedFeats];
      api.setValues({ "data.feats": updatedFeats }, callback);
      return;
    }

    // Take the first feat from the array
    const featToAdd = featIds[0];
    const remainingFeats = featIds.slice(1);

    // Parse the JSON string to get the feat ID
    let featId;
    try {
      const featData = JSON.parse(featToAdd);
      featId = featData._id;
    } catch (error) {
      console.error("Error parsing feat JSON:", featToAdd, error);
      // Skip this feat and continue with the next one
      collectFeats(remainingFeats, collectedFeats);
      return;
    }

    // Check if this feat is already in the character's current feats
    const featName = JSON.parse(featToAdd).name;
    const alreadyHasFeat = curFeats.some(
      (existingFeat) => existingFeat.name === featName,
    );

    if (alreadyHasFeat) {
      // Skip this feat and continue with the next one
      collectFeats(remainingFeats, collectedFeats);
      return;
    }

    // Query for the current feat using the parsed ID
    api.getRecord("feats", featId, (featRecord) => {
      // Add the retrieved feat to our collected feats
      collectedFeats.push(featRecord);

      // Recursively collect remaining feats
      collectFeats(remainingFeats, collectedFeats);
    });
  }

  // Start collecting feats
  collectFeats(feats);
}

// Helper function to process query strings with actor template patterns for
// character level and class trait. Supports both the Realm-native and the
// original Foundry token spellings so imported content works without conversion:
// - Level cap ("impulse feat of your level or lower"): {"$lte": "{actor|level}"}
//   OR the Foundry token {"$lte": "parent:granter:level"} -> {"$lte": 3}
// - {actor|system.details.class.trait}: if the actor has a class, replaces the
//   pattern with the class trait (e.g., "fighter"); if not, removes the filter.
function processQueryActorTemplates(queryString, record) {
  // Resolve level tokens first. Replace the *quoted* token with a bare number so
  // the JSON stays valid and numeric comparisons work (a string RHS would make
  // every level comparison fail). The Realm-native {actor|level}, the predicate
  // tokens self:level / actor:level (as emitted by the Foundry importer for
  // choice queries), and the Foundry parent:granter:level token all resolve to
  // the character's level.
  const levelTokens = [
    "{actor|level}",
    "self:level",
    "actor:level",
    "parent:granter:level",
  ];
  if (levelTokens.some((t) => queryString.includes(t))) {
    const actorLevel = parseInt(record?.data?.level ?? "1", 10) || 1;
    for (const token of levelTokens) {
      queryString = queryString
        .split(`"${token}"`)
        .join(String(actorLevel))
        .split(token)
        .join(String(actorLevel));
    }
  }

  const actorClassPattern = /\{actor\|system\.details\.class\.trait\}/g;

  // Check if the pattern exists in the query
  if (!actorClassPattern.test(queryString)) {
    return queryString; // No pattern found, return as-is
  }

  // Get the class trait from the record
  const classes = Array.isArray(record?.data?.classes)
    ? record.data.classes
    : [];
  const className = classes[0]?.name || "";
  const classTrait = className
    ? className.toLowerCase().replace(/\s+/g, "-")
    : "";

  if (classTrait) {
    // Has a class - simple string replacement
    return queryString.replace(actorClassPattern, classTrait);
  } else {
    // No class - need to remove the filter containing this pattern
    // Parse the JSON, find and remove properties that contain the pattern, then stringify
    try {
      const queryObj = JSON.parse(queryString);

      // Recursively remove properties that contain the actor class pattern
      const removeActorClassFilters = (obj) => {
        if (typeof obj !== "object" || obj === null) {
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj
            .map((item) => removeActorClassFilters(item))
            .filter((item) => item !== null);
        }

        const result = {};
        for (const key of Object.keys(obj)) {
          const value = obj[key];

          // Check if this key-value pair contains the actor class pattern
          const valueStr = JSON.stringify(value);
          if (valueStr.includes("{actor|system.details.class.trait}")) {
            // Skip this property entirely
            continue;
          }

          // Recursively process nested objects
          result[key] = removeActorClassFilters(value);
        }
        return result;
      };

      const cleanedQuery = removeActorClassFilters(queryObj);
      return JSON.stringify(cleanedQuery);
    } catch (e) {
      console.error("Failed to process actor template in query:", e);
      return queryString; // Return original on error
    }
  }
}

function promptForChoices(record, choicesToMake, index, depth = 0) {
  const MAX_CHOICE_DEPTH = 3;

  if (index >= choicesToMake.length) {
    // Only call onAddEditFeature if we actually processed choices
    if (choicesToMake.length > 0) {
      // Re-query the record to get the latest values
      api.getRecord("characters", record._id, (updatedRecord) => {
        // Check if we can go deeper into nested choices
        if (depth < MAX_CHOICE_DEPTH - 1) {
          // Allow processing new choices that might have appeared from added features
          onAddEditFeature(updatedRecord, undefined, false, depth + 1);
        } else {
          // At max depth - just update calculations, no more choice prompts
          onAddEditFeature(updatedRecord, undefined, true, depth);
        }
      });
    }
    return;
  }

  const choiceData = choicesToMake[index];
  const feature = choiceData.feature;
  const group = choiceData.group;
  const choiceObj = choiceData.choiceObj;
  const featureDataPath = group.dataPath; // Define early so both callbacks can access it

  const promptName =
    choiceObj.data?.description || choiceObj.name || "Make a choice";
  const promptDescription = "";

  // Check if this is a text input choice
  const isTextInput = choiceObj.data?.isTextInput === true;

  // Check if there's a query parameter first
  const queryString = choiceObj.data?.query;
  let optionsQuery = null;
  let useQuery = false;

  if (queryString && queryString.trim() !== "") {
    try {
      // Process any actor template patterns (e.g., {actor|system.details.class.trait})
      const processedQueryString = processQueryActorTemplates(
        queryString,
        record,
      );
      optionsQuery = JSON.parse(processedQueryString);
      useQuery = true;
    } catch (e) {
      console.error("Failed to parse choice query:", e);
      // Fall back to options list
      useQuery = false;
    }
  }

  // Prompt the user for the choice
  const callback = (selectedOptions) => {
    if (!selectedOptions || selectedOptions.length === 0) {
      // No choice made, continue to next
      promptForChoices(record, choicesToMake, index + 1);
      return;
    }

    let itemsToAdd = [];
    let selectedChoiceData = {};

    // Check if this choice has a rollOption prefix
    const rollOptionPrefix = choiceObj.data?.rollOption;

    if (useQuery) {
      // When using query, the selected item is the full record
      const selectedRecord = selectedOptions[0];
      if (!selectedRecord) {
        promptForChoices(record, choicesToMake, index + 1);
        return;
      }

      // Store the selected record as the choice
      selectedChoiceData = {
        _id: selectedRecord._id,
        name: selectedRecord.name,
      };

      // If rollOption prefix is set, construct the full rollOption
      if (rollOptionPrefix) {
        selectedChoiceData.selectedRollOption = `${rollOptionPrefix}:${toSlug(
          selectedRecord.name,
        )}`;
      }

      // Add the selected record to items
      itemsToAdd = [selectedRecord];
    } else {
      // Using options list - get the option ID from the selection
      const selectedOptionId = selectedOptions[0];
      if (!selectedOptionId) {
        promptForChoices(record, choicesToMake, index + 1);
        return;
      }

      // Get choice options from the choice object
      const options = choiceObj.data?.options || [];

      // Find the selected option
      const selectedOption = options.find(
        (opt) => opt._id === selectedOptionId,
      );
      if (!selectedOption) {
        // Option not found, continue to next
        promptForChoices(record, choicesToMake, index + 1);
        return;
      }

      // Use custom slug if set, otherwise convert name to slug
      const slug = selectedOption.data?.slug || toSlug(selectedOption.name);

      selectedChoiceData = {
        _id: selectedOption._id,
        name: selectedOption.name,
        slug: slug, // Store the slug for later use
      };

      // If rollOption prefix is set, construct the full rollOption
      if (rollOptionPrefix) {
        selectedChoiceData.selectedRollOption = `${rollOptionPrefix}:${slug}`;
      }

      // Get items from the selected option's data.value array
      itemsToAdd = selectedOption.data?.value || [];
    }

    // Prepare values to set
    const valuesToSet = {};

    // Handle flag storage if flag is set
    const flagName = choiceObj.data?.flag;
    if (flagName) {
      // Use the stored slug if available (from options), otherwise convert name to slug
      const sluggedName =
        selectedChoiceData.slug || toSlug(selectedChoiceData.name);

      // Store the slugged choice as a string in the flag
      valuesToSet[`data.flags.${flagName}`] = sluggedName;
    }

    // We'll need to update the feature with the choice selection
    // IMPORTANT: Re-fetch the current feature from `record` instead of using the stale
    // `feature` from choicesToMake, since previous choices may have updated it
    let currentFeature = feature; // default fallback

    // Find the current version of this feature in the record
    if (featureDataPath === "data.ancestries.0.data.features") {
      const ancestryList = record.data?.ancestries || [];
      if (ancestryList.length > 0) {
        const ancestryFeatures = ancestryList[0].data?.features || [];
        currentFeature =
          ancestryFeatures.find((f) => f._id === feature._id) || feature;
      }
    } else if (featureDataPath === "data.heritages.0.data.features") {
      const heritageList = record.data?.heritages || [];
      if (heritageList.length > 0) {
        const heritageFeatures = heritageList[0].data?.features || [];
        currentFeature =
          heritageFeatures.find((f) => f._id === feature._id) || feature;
      }
    } else if (featureDataPath === "data.classes.0.data.features") {
      const classList = record.data?.classes || [];
      if (classList.length > 0) {
        const classFeatures = classList[0].data?.features || [];
        currentFeature =
          classFeatures.find((f) => f._id === feature._id) || feature;
      }
    } else if (featureDataPath === "data.feats") {
      const feats = record.data?.feats || [];
      currentFeature = feats.find((f) => f._id === feature._id) || feature;
    } else if (featureDataPath === "data.bonusFeats") {
      const bonusFeats = record.data?.bonusFeats || [];
      currentFeature = bonusFeats.find((f) => f._id === feature._id) || feature;
    }

    // Clone the current feature (not the stale one) and update its choice
    const updatedFeature = { ...currentFeature };
    const choiceObjects = currentFeature.data?.choices || [];
    const choiceIndex = choiceObjects.findIndex((c) => c._id === choiceObj._id);

    if (choiceIndex >= 0) {
      // Create choice entry (just store the option ID and name)
      const choiceEntry = JSON.stringify(selectedChoiceData);

      // Clone the choices array and update the specific choice
      const updatedChoices = [...choiceObjects];
      updatedChoices[choiceIndex] = {
        ...updatedChoices[choiceIndex],
        data: {
          ...updatedChoices[choiceIndex].data,
          choices: [choiceEntry],
        },
      };

      // Update the feature with the new choices
      updatedFeature.data = {
        ...updatedFeature.data,
        choices: updatedChoices,
      };
    }

    // Note: group.features might be stale if record was re-queried between choices
    // So we need to find the feature in the current record by _id, not by using the old group
    let featureIndex = -1;

    // Accumulate items by type to avoid path conflicts
    const itemsByType = {
      inventory: [],
      bonusFeats: [],
      actions: [],
      classFeatures: [],
      ancestryFeatures: [],
    };

    // Process each item from the selected option's value array
    itemsToAdd.forEach((item) => {
      const recordType = item.recordType;

      if (recordType === "items") {
        // Prepare item for inventory
        const newItem = {
          ...item,
          _id: generateUuid(),
          data: {
            ...item.data,
            carried: item.data?.type === "weapon" ? "equipped" : "carried",
            count: 1, // Set count to 1
          },
          fields: getItemFields(item), // Initialize item fields
        };
        itemsByType.inventory.push(newItem);
      } else if (recordType === "feats") {
        itemsByType.bonusFeats.push(item);
      } else if (recordType === "actions") {
        itemsByType.actions.push(item);
      } else if (recordType === "features") {
        // Check feature type
        const featureType = (item.data?.type || "classfeature").toLowerCase();
        const isAncestryFeature = featureType === "ancestryfeature";
        const newItem = {
          ...item,
          portrait:
            item.portrait ||
            "/icons/fantasy/sundries/books/book-red-square.webp",
          data: {
            ...item.data,
            level: item.data?.level || 1,
          },
        };

        if (isAncestryFeature) {
          itemsByType.ancestryFeatures.push(newItem);
        } else {
          itemsByType.classFeatures.push(newItem);
        }
      }
    });

    // Now set each path once with all accumulated items
    if (itemsByType.inventory.length > 0) {
      const currentInventory = record.data?.inventory || [];
      valuesToSet["data.inventory"] = [
        ...currentInventory,
        ...itemsByType.inventory,
      ];
    }

    if (itemsByType.bonusFeats.length > 0) {
      const currentBonusFeats = record.data?.bonusFeats || [];
      valuesToSet["data.bonusFeats"] = [
        ...currentBonusFeats,
        ...itemsByType.bonusFeats,
      ];
    }

    if (itemsByType.actions.length > 0) {
      const currentActions = record.data?.actions || [];
      valuesToSet["data.actions"] = [...currentActions, ...itemsByType.actions];
    }

    // Handle feature updates based on which group this choice belongs to
    if (featureDataPath === "data.ancestries.0.data.features") {
      const ancestryList = record.data?.ancestries || [];
      if (ancestryList.length > 0) {
        let ancestryFeatures = [...(ancestryList[0].data?.features || [])];

        // Find the feature in the current record by _id
        featureIndex = ancestryFeatures.findIndex((f) => f._id === feature._id);

        // Replace the feature that had the choice with the updated version
        if (featureIndex >= 0) {
          ancestryFeatures[featureIndex] = updatedFeature;
        }

        // Add any new features from the choice (filter out duplicates)
        if (itemsByType.ancestryFeatures.length > 0) {
          const newFeatures = itemsByType.ancestryFeatures.filter(
            (newFeature) => {
              // Check if a feature with the same name OR _id already exists
              return !ancestryFeatures.some(
                (existingFeature) =>
                  existingFeature.name === newFeature.name ||
                  existingFeature._id === newFeature._id,
              );
            },
          );
          ancestryFeatures = [...ancestryFeatures, ...newFeatures];
        }

        valuesToSet["data.ancestries.0.data.features"] = ancestryFeatures;
      }
    } else if (featureDataPath === "data.heritages.0.data.features") {
      const heritageList = record.data?.heritages || [];
      if (heritageList.length > 0) {
        let heritageFeatures = [...(heritageList[0].data?.features || [])];

        // Find the feature in the current record by _id
        featureIndex = heritageFeatures.findIndex((f) => f._id === feature._id);

        // Replace the feature that had the choice with the updated version
        if (featureIndex >= 0) {
          heritageFeatures[featureIndex] = updatedFeature;
        }

        valuesToSet["data.heritages.0.data.features"] = heritageFeatures;
      }
    } else if (featureDataPath === "data.classes.0.data.features") {
      const classList = record.data?.classes || [];
      if (classList.length > 0) {
        let classFeatures = [...(classList[0].data?.features || [])];

        // Find the feature in the current record by _id
        featureIndex = classFeatures.findIndex((f) => f._id === feature._id);

        // Replace the feature that had the choice with the updated version
        if (featureIndex >= 0) {
          classFeatures[featureIndex] = updatedFeature;
        }

        // Add any new features from the choice (filter out duplicates)
        if (itemsByType.classFeatures.length > 0) {
          const newFeatures = itemsByType.classFeatures.filter((newFeature) => {
            // Check if a feature with the same name OR _id already exists
            return !classFeatures.some(
              (existingFeature) =>
                existingFeature.name === newFeature.name ||
                existingFeature._id === newFeature._id,
            );
          });
          classFeatures = [...classFeatures, ...newFeatures];
        }

        valuesToSet["data.classes.0.data.features"] = classFeatures;
      }
    } else if (featureDataPath === "data.feats") {
      let feats = [...(record.data?.feats || [])];

      // Find the feature in the current record by _id
      featureIndex = feats.findIndex((f) => f._id === feature._id);

      // Replace the feature that had the choice with the updated version
      if (featureIndex >= 0) {
        feats[featureIndex] = updatedFeature;
      }

      valuesToSet["data.feats"] = feats;
    } else if (featureDataPath === "data.bonusFeats") {
      let bonusFeats = [...(record.data?.bonusFeats || [])];

      // Find the feature in the current record by _id
      featureIndex = bonusFeats.findIndex((f) => f._id === feature._id);

      // Replace the feature that had the choice with the updated version
      if (featureIndex >= 0) {
        bonusFeats[featureIndex] = updatedFeature;
      }

      // Add any new feats from the choice (filter out duplicates)
      if (itemsByType.bonusFeats.length > 0) {
        const newFeats = itemsByType.bonusFeats.filter((newFeat) => {
          // Check if a feat with the same name already exists
          return !bonusFeats.some(
            (existingFeat) => existingFeat.name === newFeat.name,
          );
        });
        bonusFeats = [...bonusFeats, ...newFeats];
      }

      valuesToSet["data.bonusFeats"] = bonusFeats;
    }

    // Apply all changes
    if (Object.keys(valuesToSet).length > 0) {
      api.setValues(valuesToSet, () => {
        // Re-query the record to get the latest values before processing next choice
        api.getRecord("characters", record._id, (updatedRecord) => {
          promptForChoices(updatedRecord, choicesToMake, index + 1, depth);
        });
      });
    } else {
      promptForChoices(record, choicesToMake, index + 1, depth);
    }
  };

  // Prompt the user for the choice
  if (isTextInput) {
    // Use text input prompt
    const textInputCallback = (value) => {
      if (!value || value.trim() === "") {
        // User cancelled or entered nothing
        promptForChoices(record, choicesToMake, index + 1, depth);
        return;
      }

      // Create a one-off feature based on the text input
      // For feats, create a feat object; otherwise create a feature
      const isFeat =
        featureDataPath === "data.feats" ||
        featureDataPath === "data.bonusFeats";
      const newFeature = {
        _id: generateUuid(),
        name: value,
        portrait: "/icons/fantasy/sundries/books/book-red-square.webp",
        recordType: isFeat ? "feats" : "features",
        identified: true,
        data: {
          type: isFeat
            ? undefined
            : group.name === "Ancestry"
              ? "ancestryfeature"
              : "classfeature",
          level: feature.data?.level || 1,
          description: `Choice made for: ${feature.name}`,
        },
      };

      // Update the choice as selected
      const selectedChoiceData = {
        _id: generateUuid(),
        name: value,
      };

      // Prepare values to set
      const valuesToSet = {};

      // Handle flag storage if flag is set
      const flagName = choiceObj.data?.flag;
      if (flagName) {
        const sluggedName = toSlug(value);

        // Store the slugged choice as a string in the flag
        valuesToSet[`data.flags.${flagName}`] = sluggedName;
      }

      // IMPORTANT: Re-fetch the current feature from `record` instead of using the stale
      // `feature` from choicesToMake, since previous choices may have updated it
      let currentFeature = feature; // default fallback

      // Find the current version of this feature in the record
      if (featureDataPath === "data.ancestries.0.data.features") {
        const ancestryList = record.data?.ancestries || [];
        if (ancestryList.length > 0) {
          const ancestryFeatures = ancestryList[0].data?.features || [];
          currentFeature =
            ancestryFeatures.find((f) => f._id === feature._id) || feature;
        }
      } else if (featureDataPath === "data.heritages.0.data.features") {
        const heritageList = record.data?.heritages || [];
        if (heritageList.length > 0) {
          const heritageFeatures = heritageList[0].data?.features || [];
          currentFeature =
            heritageFeatures.find((f) => f._id === feature._id) || feature;
        }
      } else if (featureDataPath === "data.classes.0.data.features") {
        const classList = record.data?.classes || [];
        if (classList.length > 0) {
          const classFeatures = classList[0].data?.features || [];
          currentFeature =
            classFeatures.find((f) => f._id === feature._id) || feature;
        }
      } else if (featureDataPath === "data.feats") {
        const feats = record.data?.feats || [];
        currentFeature = feats.find((f) => f._id === feature._id) || feature;
      } else if (featureDataPath === "data.bonusFeats") {
        const bonusFeats = record.data?.bonusFeats || [];
        currentFeature =
          bonusFeats.find((f) => f._id === feature._id) || feature;
      }

      // Clone the current feature (not the stale one) and update its choice
      const updatedFeature = { ...currentFeature };
      const choiceObjects = currentFeature.data?.choices || [];
      const choiceIndex = choiceObjects.findIndex(
        (c) => c._id === choiceObj._id,
      );

      if (choiceIndex >= 0) {
        // Create choice entry
        const choiceEntry = JSON.stringify(selectedChoiceData);

        // Clone the choices array and update the specific choice
        const updatedChoices = [...choiceObjects];
        updatedChoices[choiceIndex] = {
          ...updatedChoices[choiceIndex],
          data: {
            ...updatedChoices[choiceIndex].data,
            choices: [choiceEntry],
          },
        };

        // Update the feature with the new choices
        updatedFeature.data = {
          ...updatedFeature.data,
          choices: updatedChoices,
        };
      }

      // Note: group.features might be stale if record was re-queried between choices
      // So we need to find the feature in the current record by _id in each block below
      let featureIndex = -1;

      // Add the new feature to the appropriate location
      if (featureDataPath === "data.ancestries.0.data.features") {
        const ancestryList = record.data?.ancestries || [];
        if (ancestryList.length > 0) {
          let ancestryFeatures = [...(ancestryList[0].data?.features || [])];

          // Find the feature in the current record by _id
          featureIndex = ancestryFeatures.findIndex(
            (f) => f._id === feature._id,
          );

          // Replace the feature that had the choice with the updated version
          if (featureIndex >= 0) {
            ancestryFeatures[featureIndex] = updatedFeature;
          }

          // Add the new feature
          ancestryFeatures = [...ancestryFeatures, newFeature];

          valuesToSet["data.ancestries.0.data.features"] = ancestryFeatures;
        }
      } else if (featureDataPath === "data.heritages.0.data.features") {
        const heritageList = record.data?.heritages || [];
        if (heritageList.length > 0) {
          let heritageFeatures = [...(heritageList[0].data?.features || [])];

          // Find the feature in the current record by _id
          featureIndex = heritageFeatures.findIndex(
            (f) => f._id === feature._id,
          );

          // Replace the feature that had the choice with the updated version
          if (featureIndex >= 0) {
            heritageFeatures[featureIndex] = updatedFeature;
          }

          // Add the new feature
          heritageFeatures = [...heritageFeatures, newFeature];

          valuesToSet["data.heritages.0.data.features"] = heritageFeatures;
        }
      } else if (featureDataPath === "data.classes.0.data.features") {
        const classList = record.data?.classes || [];
        if (classList.length > 0) {
          let classFeatures = [...(classList[0].data?.features || [])];

          // Find the feature in the current record by _id
          featureIndex = classFeatures.findIndex((f) => f._id === feature._id);

          // Replace the feature that had the choice with the updated version
          if (featureIndex >= 0) {
            classFeatures[featureIndex] = updatedFeature;
          }

          // Add the new feature
          classFeatures = [...classFeatures, newFeature];

          valuesToSet["data.classes.0.data.features"] = classFeatures;
        }
      } else if (
        featureDataPath === "data.feats" ||
        featureDataPath === "data.bonusFeats"
      ) {
        let feats = [...(record.data?.feats || [])];
        let bonusFeats = [...(record.data?.bonusFeats || [])];

        // Find the feature in the current record by _id
        if (featureDataPath === "data.feats") {
          featureIndex = feats.findIndex((f) => f._id === feature._id);
        } else {
          featureIndex = bonusFeats.findIndex((f) => f._id === feature._id);
        }

        // Replace the feature that had the choice with the updated version
        if (featureDataPath === "data.feats" && featureIndex >= 0) {
          feats[featureIndex] = updatedFeature;
        } else if (featureDataPath === "data.bonusFeats" && featureIndex >= 0) {
          bonusFeats[featureIndex] = updatedFeature;
        }

        // Add the text input as a bonus feat
        bonusFeats = [...bonusFeats, newFeature];

        valuesToSet["data.feats"] = feats;
        valuesToSet["data.bonusFeats"] = bonusFeats;
      }

      // Apply all changes
      if (Object.keys(valuesToSet).length > 0) {
        api.setValues(valuesToSet, () => {
          // Re-query the record to get the latest values before processing next choice
          api.getRecord("characters", record._id, (updatedRecord) => {
            promptForChoices(updatedRecord, choicesToMake, index + 1, depth);
          });
        });
      } else {
        promptForChoices(record, choicesToMake, index + 1, depth);
      }
    };

    api.showValuePrompt(
      choiceObj.name || "Enter Value",
      promptName,
      textInputCallback,
    );
  } else if (useQuery) {
    // Use query to populate options
    api.showPrompt(
      promptName,
      promptDescription,
      "Select Option...",
      null, // No static options
      optionsQuery,
      callback,
      "OK",
      "Cancel",
      1, // Limit 1 choice
    );
  } else {
    // Use options list
    const options = choiceObj.data?.options || [];

    // Collect traits for predicate evaluation
    const traitsSet = collectTraitsAndProperties(record, {});

    // Filter options by predicate if set
    const filteredOptions = options.filter((option) => {
      if (option.data?.predicate) {
        const parsedPredicate = parseModifierPredicate(option.data.predicate);
        const predicatePassed = evaluateEffectPredicate(
          parsedPredicate,
          traitsSet,
          record,
          {},
        );
        return predicatePassed;
      }
      return true; // Include option if no predicate
    });

    const promptOptions = filteredOptions.map((option) => ({
      label: option.name || "Option",
      value: option._id,
    }));

    if (promptOptions.length === 0) {
      // No options, skip to next choice
      promptForChoices(record, choicesToMake, index + 1);
      return;
    }

    api.showPrompt(
      promptName,
      promptDescription,
      "Select Option...",
      promptOptions,
      null, // No query
      callback,
      "OK",
      "Cancel",
      1, // Limit 1 choice
    );
  }
}

// Helper function to calculate proficiency bonus
function calculateProficiencyBonus(record, training) {
  const characterLevel = parseInt(record.data?.level || "0", 10);
  switch (parseInt(training, 10)) {
    case 0:
      return 0;
    case 1:
      return 2 + characterLevel;
    case 2:
      return 4 + characterLevel;
    case 3:
      return 6 + characterLevel;
    case 4:
      return 8 + characterLevel;
    default:
      return 0;
  }
}

function calculateProficiencyBonusForLevel(characterLevel, training) {
  switch (parseInt(training, 10)) {
    case 0:
      return 0;
    case 1:
      return 2 + characterLevel;
    case 2:
      return 4 + characterLevel;
    case 3:
      return 6 + characterLevel;
    case 4:
      return 8 + characterLevel;
    default:
      return 0;
  }
}

function showAlchemistFields(record, valuesToSet) {
  // Get all classes
  let hasAlchemistClass = false;
  const classObjs = record.data?.classes || [];
  for (const classObj of classObjs) {
    if (classObj?.name.toLowerCase().startsWith("alchemist")) {
      hasAlchemistClass = true;
    }
  }

  if (hasAlchemistClass) {
    if (record.fields?.advancedAlchemyBox?.hidden !== false) {
      valuesToSet["data.showAdvancedAlchemy"] = true;
      valuesToSet["fields.advancedAlchemyBox.hidden"] = false;
    }

    // Update daily creafting based on int
    // You can Craft a number of alchemical items up to 4 + your Intelligence modifier.
    const int = valuesToSet["data.int"] ?? record.data?.int ?? 0;
    const numDailyCrafting = 4 + int;
    if (valuesToSet["data.numDailyCrafting"] !== numDailyCrafting) {
      valuesToSet["data.numDailyCrafting"] = numDailyCrafting;
    }
    const usedDailyCrafting = valuesToSet["data.usedDailyCrafting"] ?? 0;
    if (valuesToSet["data.usedDailyCrafting"] === usedDailyCrafting) {
      valuesToSet["data.usedDailyCrafting"] = usedDailyCrafting;
    }
    const labelToSet = `Remaining: ${
      numDailyCrafting - usedDailyCrafting
    } out of ${numDailyCrafting}`;
    if (valuesToSet["data.totalDailyCraftingLabel"] !== labelToSet) {
      valuesToSet["data.totalDailyCraftingLabel"] = labelToSet;
    }
  }
}

// Called by onAddEditSpellcastingEntry to update the DC and Mod for all spellcasting entries
function updateSpellcastingEntries(record, valuesToSet) {
  if (record.recordType !== "characters") {
    return;
  }

  const spellcastingEntries = record.data?.spells || [];
  spellcastingEntries.forEach((spellcastingEntry, index) => {
    const spellcastingEntryDataPath = `data.spells.${index}`;

    const proficiency = spellcastingEntry.data?.proficiency || "spell";
    const attribute = spellcastingEntry.data?.attribute || "int";
    const training = parseInt(spellcastingEntry.data?.training || "0", 10);
    const isItem = spellcastingEntry.data?.type === "item";

    // Don't auto-update item types since they might be manually set
    if (!isItem) {
      // Get current spellcasting training level (check valuesToSet first)
      const currentTraining =
        proficiency === "spell"
          ? `${
              valuesToSet["data.spellcasting"] ??
              record.data?.spellcasting ??
              "0"
            }`
          : `${
              valuesToSet["data.classDCProficiency"] ??
              record.data?.classDCProficiency ??
              "0"
            }`;
      const newTraining = Math.max(parseInt(currentTraining, 10), training);

      // Check if level is being updated in valuesToSet
      const level = valuesToSet["data.level"] ?? record.data?.level ?? 1;

      const proficiencyBonus = calculateProficiencyBonusForLevel(
        level,
        newTraining,
      );

      // Check if attribute is being updated in valuesToSet
      const attributeScore =
        valuesToSet[`data.${attribute}`] ?? record.data?.[`${attribute}`] ?? 0;

      // Set the DC and Modifier based on the proficiency
      const mod = attributeScore + proficiencyBonus;
      const dc = 10 + mod;

      valuesToSet[`${spellcastingEntryDataPath}.data.dc`] = dc;
      valuesToSet[`${spellcastingEntryDataPath}.data.mod`] = mod;
      valuesToSet[`${spellcastingEntryDataPath}.data.training`] = newTraining;
    }
  });
}

// Called by onAddEditFeature to set the feat slots for the character based on their feats
function setFeatSlots(record, valuesToSet) {
  const classes = record.data?.classes || [];
  const classObj = classes?.[0];
  const ancestryFeatLevels = (classObj?.data?.ancestryFeatLevels || []).map(
    (level) => parseInt(level, 10),
  );
  const classFeatLevels = (classObj?.data?.classFeatLevels || []).map((level) =>
    parseInt(level, 10),
  );
  const generalFeatLevels = (classObj?.data?.generalFeatLevels || []).map(
    (level) => parseInt(level, 10),
  );
  const skillFeatLevels = (classObj?.data?.skillFeatLevels || []).map((level) =>
    parseInt(level, 10),
  );

  // Get current feats to check what slots already exist
  const oldFeats = record.data?.feats || [];
  let currentFeats = [...(record.data?.feats || [])];

  // Get character's current level
  const characterLevel = parseInt(record.data?.level || "1", 10);

  // Filter out empty feat slots that we are not high enough to have,
  // incase we set the level lower
  currentFeats = currentFeats.filter((feat) => {
    const featLevel = feat.data?.level || 0;
    const isSlot = feat.data?.type === "slot";
    const shouldKeep = featLevel <= characterLevel || !isSlot;
    return shouldKeep;
  });

  // Create feat slots for each type
  const featSlots = [];
  let slotOrder = 0;

  // Ancestry feat slots - only for levels up to current character level
  ancestryFeatLevels.forEach((level) => {
    if (level <= characterLevel) {
      const existingSlot = currentFeats.find(
        (feat) =>
          feat.data?.featSlotType === "ancestry" && feat.data?.level === level,
      );

      if (!existingSlot) {
        featSlots.push({
          _id: generateUuid(),
          name: "Ancestry Feat Slot",
          recordType: "feats",
          unidentifiedName: "Ancestry Feat Slot",
          data: {
            type: "slot",
            level: level,
            featSlotType: "ancestry",
            slotOrder: slotOrder++,
          },
          fields: {
            featSlot: { hidden: false },
            featDetails: { hidden: true },
          },
        });
      }
    }
  });

  // Class feat slots - only for levels up to current character level
  classFeatLevels.forEach((level) => {
    if (level <= characterLevel) {
      const existingSlot = currentFeats.find(
        (feat) =>
          feat.data?.featSlotType === "class" && feat.data?.level === level,
      );

      if (!existingSlot) {
        featSlots.push({
          _id: generateUuid(),
          name: "Class Feat Slot",
          recordType: "feats",
          unidentifiedName: "Class Feat Slot",
          data: {
            type: "slot",
            level: level,
            featSlotType: "class",
            slotOrder: slotOrder++,
          },
          fields: {
            featSlot: { hidden: false },
            featDetails: { hidden: true },
          },
        });
      }
    }
  });

  // General feat slots - only for levels up to current character level
  generalFeatLevels.forEach((level) => {
    if (level <= characterLevel) {
      const existingSlot = currentFeats.find(
        (feat) =>
          feat.data?.featSlotType === "general" && feat.data?.level === level,
      );

      if (!existingSlot) {
        featSlots.push({
          _id: generateUuid(),
          name: "General Feat Slot",
          recordType: "feats",
          unidentifiedName: "General Feat Slot",
          data: {
            type: "slot",
            level: level,
            featSlotType: "general",
            slotOrder: slotOrder++,
          },
          fields: {
            featSlot: { hidden: false },
            featDetails: { hidden: true },
          },
        });
      }
    }
  });

  // Skill feat slots - only for levels up to current character level
  skillFeatLevels.forEach((level) => {
    if (level <= characterLevel) {
      const existingSlot = currentFeats.find(
        (feat) =>
          feat.data?.featSlotType === "skill" && feat.data?.level === level,
      );

      if (!existingSlot) {
        featSlots.push({
          _id: generateUuid(),
          name: "Skill Feat Slot",
          recordType: "feats",
          unidentifiedName: "Skill Feat Slot",
          data: {
            type: "slot",
            level: level,
            featSlotType: "skill",
            slotOrder: slotOrder++,
          },
          fields: {
            featSlot: { hidden: false },
            featDetails: { hidden: true },
          },
        });
      }
    }
  });

  // Update feats array with filtered feats and any new slots
  const updatedFeats = [...currentFeats, ...featSlots];

  // Always update if feats changed (either filtered out or new slots added)
  if (updatedFeats.length !== oldFeats.length || featSlots.length > 0) {
    valuesToSet["data.feats"] = updatedFeats;
  }
}

// Called by onAddEditFeature to update the proficiencies for the character based on class and all features
function updateProficiencies(record, valuesToSet) {
  // Helper function to get ability score value, checking valuesToSet first, then record
  const getAbilityScore = (ability) => {
    const valueFromSet = valuesToSet[`data.${ability}`];
    if (valueFromSet !== undefined) {
      return parseInt(valueFromSet, 10);
    }
    const recordValue = record.data?.[ability];
    if (
      recordValue !== undefined &&
      recordValue !== null &&
      recordValue !== ""
    ) {
      return parseInt(recordValue, 10);
    }
    return 0; // Only default to 0 if truly not set
  };
  // Collect all features from ancestries, heritages, and classes
  const ancestries = record.data?.ancestries || [];
  const heritages = record.data?.heritages || [];
  const classes = record.data?.classes || [];
  const classObj = classes?.[0];
  const backgrounds = record.data?.backgrounds || [];
  const backgroundObj = backgrounds?.[0];
  const features = [];
  for (const ancestry of ancestries) {
    features.push(...(ancestry.data?.features || []));
  }
  for (const heritage of heritages) {
    features.push(...(heritage.data?.features || []));
  }
  for (const classObj of classes) {
    features.push(...(classObj.data?.features || []));
  }

  // Feats and standalone character features can grant proficiencies directly.
  // This is especially important for general feats whose effect is not tied to
  // a class feature, such as Armor Proficiency.
  features.push(...(record.data?.feats || []));
  features.push(...(record.data?.bonusFeats || []));
  features.push(...(record.data?.features || []));

  // First create a map of all proficiencies, 0=untrained, 1=trained, 2=expert, 3=master, 4=legendary
  const proficiencies = {
    // class dc is always trained by default
    classDC: 1,
    // saving throws
    reflex: 0,
    fortitude: 0,
    will: 0,
    // armor
    unarmored: 0,
    light: 0,
    medium: 0,
    heavy: 0,
    // weapons
    unarmed: 0,
    simple: 0,
    martial: 0,
    advanced: 0,
    // spellcasting
    spellcasting: 0,
    // perception
    perception: 0,
    // skills
    acrobatics: 0,
    arcana: 0,
    athletics: 0,
    crafting: 0,
    deception: 0,
    diplomacy: 0,
    intimidation: 0,
    medicine: 0,
    nature: 0,
    occultism: 0,
    performance: 0,
    religion: 0,
    society: 0,
    stealth: 0,
    survival: 0,
    thievery: 0,
    lore: {},
  };

  const possibleSkills = [
    "acrobatics",
    "arcana",
    "athletics",
    "crafting",
    "deception",
    "diplomacy",
    "intimidation",
    "medicine",
    "nature",
    "occultism",
    "performance",
    "religion",
    "society",
    "stealth",
    "survival",
    "thievery",
  ];

  // First check Class
  if (classObj?.data?.classDC) {
    proficiencies.classDC = parseInt(classObj.data.classDC, 10);
  }
  if (classObj?.data?.savingThrows) {
    proficiencies.reflex = parseInt(
      classObj.data.savingThrows?.reflex || "0",
      10,
    );
    proficiencies.fortitude = parseInt(
      classObj.data.savingThrows?.fortitude || "0",
      10,
    );
    proficiencies.will = parseInt(classObj.data.savingThrows?.will || "0", 10);
  }
  if (classObj?.data?.perception) {
    proficiencies.perception = parseInt(classObj.data.perception || "0", 10);
  }
  if (classObj?.data?.defenses) {
    proficiencies.unarmored = parseInt(
      classObj.data.defenses?.unarmored || "0",
      10,
    );
    proficiencies.light = parseInt(classObj.data.defenses?.light || "0", 10);
    proficiencies.medium = parseInt(classObj.data.defenses?.medium || "0", 10);
    proficiencies.heavy = parseInt(classObj.data.defenses?.heavy || "0", 10);
  }
  if (classObj?.data?.attacks) {
    proficiencies.unarmed = parseInt(classObj.data.attacks?.unarmed || "0", 10);
    proficiencies.simple = parseInt(classObj.data.attacks?.simple || "0", 10);
    proficiencies.martial = parseInt(classObj.data.attacks?.martial || "0", 10);
    proficiencies.advanced = parseInt(
      classObj.data.attacks?.advanced || "0",
      10,
    );
    // Handle "other" attack proficiency (e.g., Alchemical Bombs for Alchemist)
    if (
      classObj.data.attacks?.other?.name &&
      classObj.data.attacks?.other?.rank
    ) {
      proficiencies.otherName = classObj.data.attacks.other.name;
      proficiencies.otherRank = parseInt(
        classObj.data.attacks.other.rank || "0",
        10,
      );
    }
  }
  if (classObj?.data?.spellcasting) {
    proficiencies.spellcasting = parseInt(
      classObj.data.spellcasting || "0",
      10,
    );
  }
  // Class and background skills
  if (classObj?.data?.trainedSkills || backgroundObj?.data?.trainedSkills) {
    const skills = classObj?.data?.trainedSkills || [];
    const backgroundSkills = backgroundObj?.data?.trainedSkills || [];
    const allSkills = [...skills, ...backgroundSkills];
    for (const skill of allSkills) {
      const skillName = skill.toLowerCase();
      // Check if it's a lore skill (ends with " lore")
      if (skillName.endsWith(" lore")) {
        // Handle both "Farming Lore" and "<Farming> Lore" formats
        let loreSkillName = skillName.replace(" lore", "");

        // Extract name from angle brackets if present (e.g., "<farming>" becomes "farming")
        const angleBracketMatch = loreSkillName.match(/^<(.+)>$/);
        if (angleBracketMatch) {
          loreSkillName = angleBracketMatch[1].trim();
        }

        // Set proficiency to trained (1) if not already set or if current is lower
        if (
          !proficiencies.lore[loreSkillName] ||
          1 > proficiencies.lore[loreSkillName]
        ) {
          proficiencies.lore[loreSkillName] = 1;
        }
      }
      // Check if it's a regular skill
      else if (possibleSkills.includes(skillName)) {
        proficiencies[skillName] = 1;
      }
    }
  }

  // Now add all proficiencies from features
  // First sort features by level (assume 0 if level is not set)
  features.sort((a, b) => {
    const levelA = parseInt(a.data?.level || "0", 10);
    const levelB = parseInt(b.data?.level || "0", 10);
    return levelA - levelB;
  });

  // Get character level (check valuesToSet first)
  const characterLevel = valuesToSet["data.level"] ?? record.data?.level ?? 1;

  // Go through each feature and update proficiencies if the new rank is higher
  for (const feature of features) {
    // Check if character level meets the feature's level requirement
    const featureLevel = parseInt(feature.data?.level || "0", 10);
    if (featureLevel > characterLevel) {
      continue; // Skip this feature if character hasn't reached its level yet
    }

    const featureProficiencies = feature.data?.proficiencies || [];
    // Every grant in a feature evaluates against the ranks that existed before
    // that feature applied. Otherwise, a conditional grant for Light armor
    // would immediately make the same Armor Proficiency feat also satisfy its
    // Medium armor predicate.
    const proficienciesBeforeFeature = {
      ...proficiencies,
      lore: { ...proficiencies.lore },
    };
    const proficiencyPredicateContext = {
      proficiencies: proficienciesBeforeFeature,
    };
    const traitsSet = collectTraitsAndProperties(record, {});
    featureProficiencies.forEach((proficiency) => {
      const predicate = proficiency?.data?.predicate;
      if (predicate) {
        const parsedPredicate = parseModifierPredicate(predicate);
        if (
          !evaluateEffectPredicate(
            parsedPredicate,
            traitsSet,
            record,
            proficiencyPredicateContext,
          )
        ) {
          return;
        }
      }

      const name = (proficiency?.data?.name || "").toLowerCase();
      const rank = parseInt(proficiency?.data?.rank || "0", 10);
      // Some proficiencies apply only to a specific group *by field* so we will not
      // apply them here if field is set
      const field = proficiency?.data?.field || "";
      const setProfiency =
        field === "" || field === null || field === undefined;

      if (name && rank > 0 && setProfiency) {
        // Check if it's a saving throw
        if (name === "fortitude" || name === "reflex" || name === "will") {
          if (rank > proficiencies[name]) {
            proficiencies[name] = rank;
          }
        }
        // Check if it's armor
        else if (
          name === "unarmored" ||
          name === "light" ||
          name === "medium" ||
          name === "heavy"
        ) {
          if (rank > proficiencies[name]) {
            proficiencies[name] = rank;
          }
        }
        // Check if it's weapons
        else if (
          name === "unarmed" ||
          name === "simple" ||
          name === "martial" ||
          name === "advanced"
        ) {
          if (rank > proficiencies[name]) {
            proficiencies[name] = rank;
          }
        }
        // Check if it's spellcasting
        else if (name === "spellcasting") {
          if (rank > proficiencies.spellcasting) {
            proficiencies.spellcasting = rank;
          }
        }
        // Check if it's perception
        else if (name === "perception") {
          if (rank > proficiencies.perception) {
            proficiencies.perception = rank;
          }
        }
        // Check if it's a skill
        else if (possibleSkills.includes(name.toLowerCase())) {
          if (rank > proficiencies[name.toLowerCase()]) {
            proficiencies[name.toLowerCase()] = rank;
          }
        }
        // Check if it's a lore skill (ends with " Lore")
        else if (name.endsWith(" lore")) {
          const loreSkillName = name.replace(" lore", "");
          if (
            !proficiencies.lore[loreSkillName] ||
            rank > proficiencies.lore[loreSkillName]
          ) {
            proficiencies.lore[loreSkillName] = rank;
          }
        }
        // Otherwise assume it's a class DC
        else {
          if (rank > proficiencies.classDC) {
            proficiencies.classDC = rank;
          }
        }
      }
    });
  }

  // Set Class DC
  const keyAbility = record.data?.keyAbility;
  let keyAbilityScore = 0;
  if (
    keyAbility &&
    ["str", "dex", "con", "int", "wis", "cha"].includes(keyAbility)
  ) {
    keyAbilityScore = getAbilityScore(keyAbility);
  }
  const currentClassDCProficiency = parseInt(
    record.data?.classDCProficiency || "0",
    10,
  );

  // If no class, reset class DC proficiency to 0
  if (!classObj) {
    valuesToSet["data.classDCProficiency"] = 0;
    valuesToSet["data.classDC"] = 10 + keyAbilityScore;
  } else {
    const effectiveClassDCProficiency = Math.max(
      currentClassDCProficiency,
      proficiencies.classDC,
    );
    const classDCProficiencyBonus = calculateProficiencyBonus(
      record,
      effectiveClassDCProficiency,
    );
    valuesToSet["data.classDC"] =
      10 + classDCProficiencyBonus + keyAbilityScore;
    if (
      currentClassDCProficiency < proficiencies.classDC ||
      proficiencies.classDC === 0
    ) {
      valuesToSet["data.classDCProficiency"] = proficiencies.classDC;
    }
  }

  // Set saving throw modifiers
  const dexMod = getAbilityScore("dex");
  const conMod = getAbilityScore("con");
  const wisMod = getAbilityScore("wis");

  // Reflex (DEX + proficiency bonus)
  const currentReflex = parseInt(record.data?.reflex || "0", 10);
  const effectiveReflex = Math.max(currentReflex, proficiencies.reflex);
  const reflexProficiencyBonus = calculateProficiencyBonus(
    record,
    effectiveReflex,
  );
  valuesToSet["data.reflexMod"] = dexMod + reflexProficiencyBonus;
  if (currentReflex < proficiencies.reflex || proficiencies.reflex === 0) {
    valuesToSet["data.reflex"] = proficiencies.reflex.toString();
  }

  // Fortitude (CON + proficiency bonus)
  const currentFortitude = parseInt(record.data?.fortitude || "0", 10);
  const effectiveFortitude = Math.max(
    currentFortitude,
    proficiencies.fortitude,
  );
  const fortitudeProficiencyBonus = calculateProficiencyBonus(
    record,
    effectiveFortitude,
  );
  valuesToSet["data.fortitudeMod"] = conMod + fortitudeProficiencyBonus;
  if (
    currentFortitude < proficiencies.fortitude ||
    proficiencies.fortitude === 0
  ) {
    valuesToSet["data.fortitude"] = proficiencies.fortitude.toString();
  }

  // Will (WIS + proficiency bonus)
  const currentWill = parseInt(record.data?.will || "0", 10);
  const effectiveWill = Math.max(currentWill, proficiencies.will);
  const willProficiencyBonus = calculateProficiencyBonus(record, effectiveWill);
  valuesToSet["data.willMod"] = wisMod + willProficiencyBonus;
  if (currentWill < proficiencies.will || proficiencies.will === 0) {
    valuesToSet["data.will"] = proficiencies.will.toString();
  }

  // Perception (WIS + proficiency bonus)
  const currentPerception = parseInt(record.data?.perception || "0", 10);
  const effectivePerception = Math.max(
    currentPerception,
    proficiencies.perception,
  );
  const perceptionProficiencyBonus = calculateProficiencyBonus(
    record,
    effectivePerception,
  );
  valuesToSet["data.perceptionMod"] = wisMod + perceptionProficiencyBonus;
  if (
    currentPerception < proficiencies.perception ||
    proficiencies.perception === 0
  ) {
    valuesToSet["data.perception"] = proficiencies.perception.toString();
  }

  // Set skill modifiers
  const pathfinderSkills = getPathfinderSkills();
  for (const [skillName, abilityKey] of Object.entries(pathfinderSkills)) {
    const skillProficiency = proficiencies[skillName] || 0;

    // Check if user has set a custom ability score for this skill
    const customAbilityKey = record.data?.[`${skillName}Ability`];
    const effectiveAbilityKey = customAbilityKey || abilityKey;
    const abilityMod = getAbilityScore(effectiveAbilityKey);

    // Get the current skill proficiency from the record
    const currentSkillProficiency = parseInt(
      record.data?.[skillName] || "0",
      10,
    );

    // Use the higher of current proficiency or calculated proficiency for the modifier
    const effectiveProficiency = Math.max(
      currentSkillProficiency,
      skillProficiency,
    );
    const skillProficiencyBonus = calculateProficiencyBonus(
      record,
      effectiveProficiency,
    );

    // Always set the modifier based on the effective proficiency
    valuesToSet[`data.${skillName}Mod`] = abilityMod + skillProficiencyBonus;

    // Only update the proficiency value if the calculated one is higher
    // Don't override manually set higher values
    if (currentSkillProficiency < skillProficiency) {
      valuesToSet[`data.${skillName}`] = skillProficiency.toString();
    }
  }

  // Set lore skills
  const currentLoreSkills = record.data?.loreSkills || [];
  const loreSkillsToSet = [];
  const processedLoreSkills = new Set();

  // Process each lore skill from proficiencies
  for (const [loreSkillName, rank] of Object.entries(proficiencies.lore)) {
    const formattedLoreSkillName =
      loreSkillName.charAt(0).toUpperCase() + loreSkillName.slice(1);
    const loreSkillFullName = `${formattedLoreSkillName} Lore`;

    // Check if this lore skill already exists in current lore skills
    const existingLoreSkill = currentLoreSkills.find(
      (skill) => skill.name === loreSkillFullName,
    );

    if (existingLoreSkill) {
      // Update existing lore skill if new rank is higher
      const currentRank = parseInt(existingLoreSkill.data?.rank || "0", 10);
      if (rank > currentRank) {
        existingLoreSkill.data.rank = rank.toString();
      }
      loreSkillsToSet.push(existingLoreSkill);
      processedLoreSkills.add(loreSkillFullName);
    } else {
      // Create new lore skill entry
      loreSkillsToSet.push({
        _id: generateUuid(),
        name: loreSkillFullName,
        recordType: "records",
        unidentifiedName: "Lore Skill",
        data: {
          rank: rank.toString(),
        },
        icon: "IconTools",
      });
      processedLoreSkills.add(loreSkillFullName);
    }
  }

  // Preserve existing lore skills that weren't processed (user-added lore skills)
  currentLoreSkills.forEach((loreSkill) => {
    if (!processedLoreSkills.has(loreSkill.name)) {
      loreSkillsToSet.push(loreSkill);
    }
  });

  // Set the lore skills array (always set it to preserve existing lore skills)
  valuesToSet["data.loreSkills"] = loreSkillsToSet;

  // Process lore skills for modifiers
  for (const loreSkill of loreSkillsToSet) {
    const rank = parseInt(loreSkill.data?.rank || "0", 10);
    const proficiencyBonus = calculateProficiencyBonus(record, rank);

    // Check if lore skill has a custom ability score set
    const customAbilityKey = loreSkill.data?.ability;
    const effectiveAbilityKey = customAbilityKey || "int"; // Default to Intelligence for lore skills
    const abilityMod = getAbilityScore(effectiveAbilityKey);

    // Calculate and set the modifier
    const totalMod = abilityMod + proficiencyBonus;
    loreSkill.data.mod = totalMod;
  }

  // Set armor and weapon proficiencies
  const currentUnarmored = parseInt(
    record.data?.defenses?.unarmored || "0",
    10,
  );
  if (currentUnarmored < proficiencies.unarmored) {
    valuesToSet["data.defenses.unarmored"] = proficiencies.unarmored;
  }

  const currentLight = parseInt(record.data?.defenses?.light || "0", 10);
  if (currentLight < proficiencies.light) {
    valuesToSet["data.defenses.light"] = proficiencies.light;
  }

  const currentMedium = parseInt(record.data?.defenses?.medium || "0", 10);
  if (currentMedium < proficiencies.medium) {
    valuesToSet["data.defenses.medium"] = proficiencies.medium;
  }

  const currentHeavy = parseInt(record.data?.defenses?.heavy || "0", 10);
  if (currentHeavy < proficiencies.heavy) {
    valuesToSet["data.defenses.heavy"] = proficiencies.heavy;
  }

  const currentUnarmed = parseInt(
    record.data?.attackProficiencies?.unarmed || "0",
    10,
  );
  if (currentUnarmed < proficiencies.unarmed || proficiencies.unarmed === 0) {
    valuesToSet["data.attackProficiencies.unarmed"] = proficiencies.unarmed;
  }

  const currentSimple = parseInt(
    record.data?.attackProficiencies?.simple || "0",
    10,
  );
  if (currentSimple < proficiencies.simple || proficiencies.simple === 0) {
    valuesToSet["data.attackProficiencies.simple"] = proficiencies.simple;
  }

  const currentMartial = parseInt(
    record.data?.attackProficiencies?.martial || "0",
    10,
  );
  if (currentMartial < proficiencies.martial || proficiencies.martial === 0) {
    valuesToSet["data.attackProficiencies.martial"] = proficiencies.martial;
  }

  const currentAdvanced = parseInt(
    record.data?.attackProficiencies?.advanced || "0",
    10,
  );
  if (
    currentAdvanced < proficiencies.advanced ||
    proficiencies.advanced === 0
  ) {
    valuesToSet["data.attackProficiencies.advanced"] = proficiencies.advanced;
  }

  // Set "other" attack proficiency if defined (e.g., Alchemical Bombs for Alchemist)
  if (proficiencies.otherName) {
    const currentOtherRank = parseInt(
      record.data?.attackProficiencies?.other?.rank || "0",
      10,
    );
    if (
      currentOtherRank < proficiencies.otherRank ||
      proficiencies.otherRank === 0
    ) {
      valuesToSet["data.attackProficiencies.other.name"] =
        proficiencies.otherName;
      valuesToSet["data.attackProficiencies.other.rank"] =
        proficiencies.otherRank;
    }
  }

  // Set spellcasting proficiency
  const currentSpellcasting = parseInt(record.data?.spellcasting || "0", 10);
  if (
    currentSpellcasting < proficiencies.spellcasting ||
    proficiencies.spellcasting === 0
  ) {
    valuesToSet["data.spellcasting"] = proficiencies.spellcasting;
  }
}

// Calculate Pathfinder 2e ability boosts
function calculateAbilityBoosts(record) {
  const boosts = {
    ancestryBoost1: record.data?.ancestryBoost1,
    ancestryBoost2: record.data?.ancestryBoost2,
    backgroundBoost1: record.data?.backgroundBoost1,
    backgroundBoost2: record.data?.backgroundBoost2,
    classBoost: record.data?.keyAbility,
    freeBoosts: record.data?.freeBoosts || [],
    freeBoostsLevel5: record.data?.freeBoostsLevel5 || [],
    freeBoostsLevel10: record.data?.freeBoostsLevel10 || [],
    freeBoostsLevel15: record.data?.freeBoostsLevel15 || [],
    freeBoostsLevel20: record.data?.freeBoostsLevel20 || [],
  };

  // Count boosts per ability
  const boostCounts = {
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0,
  };

  // Handle ancestry boosts and flaws if not using alternate ancestry boosts
  const alternateAncestryBoosts = record.data?.alternateAncestryBoosts;
  const ancestries = record.data?.ancestries || [];
  if (!alternateAncestryBoosts && ancestries.length > 0) {
    const ancestry = ancestries[0];
    const ancestryBoosts = ancestry?.data?.boosts || {};
    const ancestryFlaws = ancestry?.data?.flaws || {};

    // Process ancestry boosts (arrays of 1 are provided boosts)
    for (const boost of Object.values(ancestryBoosts)) {
      if (Array.isArray(boost) && boost.length === 1 && boost[0]) {
        const ability = boost[0];
        if (boostCounts.hasOwnProperty(ability)) {
          boostCounts[ability]++;
        }
      }
    }

    // Process ancestry flaws (always decrement by 1)
    for (const flaw of Object.values(ancestryFlaws)) {
      if (Array.isArray(flaw) && flaw.length === 1 && flaw[0]) {
        const ability = flaw[0];
        if (boostCounts.hasOwnProperty(ability)) {
          boostCounts[ability]--;
        }
      }
    }
  }

  // Helper function to add a boost
  const addBoost = (ability) => {
    if (ability && boostCounts.hasOwnProperty(ability)) {
      boostCounts[ability]++;
    }
  };

  // Process all boost sources
  Object.values(boosts).forEach((boost) => {
    if (Array.isArray(boost)) {
      boost.forEach(addBoost);
    } else if (boost) {
      addBoost(boost);
    }
  });

  // Calculate final ability scores based on boost rules
  const attributes = ["str", "dex", "con", "int", "wis", "cha"];
  const boostResults = {};

  attributes.forEach((attribute) => {
    const boostCount = boostCounts[attribute];

    // Calculate modifier from boosts
    let modifier = 0;
    let partialBoost = false;

    if (boostCount !== 0) {
      if (boostCount > 0) {
        // Each boost adds +1 until +4, then it takes 2 boosts for each additional +1
        if (boostCount <= 4) {
          modifier = boostCount;
        } else {
          // After +4, it takes 2 boosts for each +1
          const extraBoosts = boostCount - 4;
          modifier = 4 + Math.floor(extraBoosts / 2);

          // Check if there's a partial boost (odd number of extra boosts)
          if (extraBoosts % 2 === 1) {
            partialBoost = true;
          }
        }
      } else {
        // Negative boostCount (from flaws) - each flaw reduces by 1
        modifier = boostCount;
      }
    }

    boostResults[attribute] = {
      boostCount: boostCount,
      modifier: modifier,
      partialBoost: partialBoost,
    };
  });

  return boostResults;
}

// This function collects all `providesItems` from feats, features, actions, and backgrounds
// and adds them to the appropriate location based on their type
function setProvidedItems(record, callback = undefined) {
  const feats = record.data?.feats || [];
  const bonusFeats = record.data?.bonusFeats || [];
  const features = record.data?.features || [];
  const actions = record.data?.actions || [];
  const ancestries = record.data?.ancestries || [];
  const ancestryFeatures = ancestries
    .map((ancestry) => ancestry.data?.features || [])
    .flat();
  const heritages = record.data?.heritages || [];
  const heritageFeatures = heritages
    .map((heritage) => heritage.data?.features || [])
    .flat();
  const classes = record.data?.classes || [];
  const classFeatures = classes
    .map((classObj) => classObj.data?.features || [])
    .flat();
  const backgrounds = record.data?.backgrounds || [];

  // Get character level (default to 1 if not set)
  const characterLevel = parseInt(record.data?.level || "1", 10);

  // Collect all sources that might have providesItems
  const allSources = [
    ...feats,
    ...bonusFeats,
    ...features,
    ...actions,
    ...ancestryFeatures,
    ...heritageFeatures,
    ...classFeatures,
    ...backgrounds,
  ];

  // Filter sources by level requirement
  const validSources = allSources.filter((source) => {
    const sourceLevel = parseInt(source.data?.level || "1", 10);
    return sourceLevel <= characterLevel;
  });

  // First pass: Collect all flags from valid sources
  const flagMap = new Map();
  for (const source of validSources) {
    if (source.data?.flags && source.data.flags.length > 0) {
      for (const flag of source.data.flags) {
        // Access nested data properties
        const key = flag.data?.key || flag.key;
        const value = flag.data?.value || flag.value;

        if (key && value) {
          flagMap.set(key, value);
        }
      }
    }
  }

  // Collect traits for predicate evaluation
  const traitsSet = collectTraitsAndProperties(record, {});

  // Second pass: Collect all provided items from valid sources
  const providedItems = [];
  for (const source of validSources) {
    // Add items from providesItems
    if (source.data?.providesItems && source.data.providesItems.length > 0) {
      // Filter items by predicate if set
      for (const item of source.data.providesItems) {
        if (item.data?.predicate) {
          const parsedPredicate = parseModifierPredicate(item.data.predicate);
          const predicatePassed = evaluateEffectPredicate(
            parsedPredicate,
            traitsSet,
            record,
            {},
          );
          if (!predicatePassed) {
            continue; // Skip this item if predicate fails
          }
        }
        providedItems.push(item);
      }
    }

    // Add items from conditionalGrants based on flag values
    if (
      source.data?.conditionalGrants &&
      source.data.conditionalGrants.length > 0
    ) {
      for (const grant of source.data.conditionalGrants) {
        // Access nested data properties
        const flagKey = grant.data?.flagKey;
        const allowMultiple = grant.data?.allowMultiple;

        if (!flagKey) continue;

        const flagValue = flagMap.get(flagKey);
        if (flagValue && Array.isArray(flagValue)) {
          if (allowMultiple) {
            // Grant all items from the flag's value array
            providedItems.push(...flagValue);
          } else {
            // Grant only the first item
            if (flagValue.length > 0) {
              providedItems.push(flagValue[0]);
            }
          }
        }
      }
    }
  }

  if (providedItems.length === 0) {
    if (callback) {
      callback(record);
    }
    return;
  }

  // Get existing items to check for duplicates
  const existingInventory = record.data?.inventory || [];
  const existingBonusFeats = record.data?.bonusFeats || [];
  const existingActions = record.data?.actions || [];

  // Prepare items to add
  const itemsToAdd = {
    inventory: [],
    bonusFeats: [],
    actions: [],
    classFeatures: [], // Will be added to first class
    ancestryFeatures: [], // Will be added to first ancestry
  };

  for (const item of providedItems) {
    const itemId = item._id;
    const recordType = item.recordType;

    if (!itemId || !recordType) {
      console.error("Invalid provided item - missing _id or recordType:", item);
      continue;
    }

    // Determine where to add based on record type
    if (recordType === "items") {
      // Add to inventory if not already present (check by fromId or name)
      const alreadyExists = existingInventory.some(
        (i) => i.data?.fromId === itemId || i.name === item.name,
      );
      if (!alreadyExists) {
        itemsToAdd.inventory.push({
          ...item,
          _id: generateUuid(), // Generate new ID for inventory item
          data: {
            ...item.data,
            count: 1, // Always set count to 1
            carried: item.data?.type === "weapon" ? "equipped" : "carried", // Mark as equipped if weapon
            fromId: itemId, // Track source
          },
          fields: getItemFields(item),
        });
      }
    } else if (recordType === "feats") {
      // Add to bonusFeats if not already present (check by fromId or name)
      const alreadyExists = existingBonusFeats.some(
        (f) => f.data?.fromId === itemId || f.name === item.name,
      );
      if (!alreadyExists) {
        itemsToAdd.bonusFeats.push({
          ...item,
          data: {
            ...item.data,
            fromId: itemId, // Track source
          },
        });
      }
    } else if (recordType === "actions") {
      // Add to actions if not already present (check by fromId or name)
      const alreadyExists = existingActions.some(
        (a) => a.data?.fromId === itemId || a.name === item.name,
      );
      if (!alreadyExists) {
        itemsToAdd.actions.push({
          ...item,
          data: {
            ...item.data,
            fromId: itemId, // Track source
          },
        });
      }
    } else if (recordType === "features") {
      // Check feature type to determine if it's a class or ancestry feature
      const featureType = (item.data?.type || "classfeature").toLowerCase();
      const isAncestryFeature = featureType === "ancestryfeature";

      if (isAncestryFeature) {
        // Add to first ancestry's features
        const ancestryList = record.data?.ancestries || [];
        if (ancestryList.length > 0) {
          const ancestryFeaturesList = ancestryList[0].data?.features || [];
          const alreadyExists = ancestryFeaturesList.some(
            (f) =>
              f.data?.fromId === itemId ||
              f._id === itemId ||
              f.name === item.name,
          );

          if (!alreadyExists) {
            itemsToAdd.ancestryFeatures.push({
              ...item,
              data: {
                ...item.data,
                fromId: itemId,
              },
            });
          }
        }
      } else {
        // It's a class feature (or assumed to be)
        // Add to first class's features
        const classList = record.data?.classes || [];
        if (classList.length > 0) {
          const classFeaturesList = classList[0].data?.features || [];
          const alreadyExists = classFeaturesList.some(
            (f) =>
              f.data?.fromId === itemId ||
              f._id === itemId ||
              f.name === item.name,
          );

          if (!alreadyExists) {
            itemsToAdd.classFeatures.push({
              ...item,
              data: {
                ...item.data,
                fromId: itemId,
              },
            });
          }
        }
      }
    }
  }

  // Now add all items using api.setValuesOnRecord
  const valuesToSet = {};
  let hasChanges = false;

  if (itemsToAdd.inventory.length > 0) {
    valuesToSet["data.inventory"] = [
      ...existingInventory,
      ...itemsToAdd.inventory,
    ];
    hasChanges = true;
  }

  if (itemsToAdd.bonusFeats.length > 0) {
    valuesToSet["data.bonusFeats"] = [
      ...existingBonusFeats,
      ...itemsToAdd.bonusFeats,
    ];
    hasChanges = true;
  }

  if (itemsToAdd.actions.length > 0) {
    valuesToSet["data.actions"] = [...existingActions, ...itemsToAdd.actions];
    hasChanges = true;
  }

  // Add class features
  if (itemsToAdd.classFeatures.length > 0) {
    const classList = record.data?.classes || [];
    if (classList.length > 0) {
      const existingFeatures = classList[0].data?.features || [];
      valuesToSet["data.classes.0.data.features"] = [
        ...existingFeatures,
        ...itemsToAdd.classFeatures,
      ];
      hasChanges = true;
    }
  }

  // Add ancestry features
  if (itemsToAdd.ancestryFeatures.length > 0) {
    const ancestryList = record.data?.ancestries || [];
    if (ancestryList.length > 0) {
      const existingFeatures = ancestryList[0].data?.features || [];
      valuesToSet["data.ancestries.0.data.features"] = [
        ...existingFeatures,
        ...itemsToAdd.ancestryFeatures,
      ];
      hasChanges = true;
    }
  }

  if (hasChanges) {
    api.setValuesOnRecord(record, valuesToSet, () => {
      // Re-query to get the latest record with all newly added items
      api.getRecord(record.recordType, record._id, (freshRecord) => {
        // Recursively call setProvidedItems to process providesItems from newly added features
        // This ensures that features added via conditionalGrants or providesItems
        // will have their own providesItems processed
        setProvidedItems(freshRecord, callback);
      });
    });
  } else {
    if (callback) {
      callback(record);
    }
  }
}

// Update toggles list with all toggleable items from actions, feats, and features
function updateTogglesList(record, valuesToSet) {
  const toggleableItems = [];
  const seenNames = new Set();

  // Get all actions
  const actions = record.data?.actions || [];
  actions.forEach((action) => {
    if (
      action.data?.toggleable === true &&
      action.name &&
      !seenNames.has(action.name)
    ) {
      toggleableItems.push({
        name: action.name,
        predicateValue: action.data?.predicateValue || "",
      });
      seenNames.add(action.name);
    }
  });

  // Get all feats
  const feats = record.data?.feats || [];
  feats.forEach((feat) => {
    if (
      feat.data?.toggleable === true &&
      feat.name &&
      !seenNames.has(feat.name)
    ) {
      toggleableItems.push({
        name: feat.name,
        predicateValue: feat.data?.predicateValue || "",
      });
      seenNames.add(feat.name);
    }
  });

  // Get class features (from first class)
  const classes = record.data?.classes || [];
  if (classes.length > 0) {
    const classObj = classes[0];
    const classFeatures = classObj.data?.features || [];
    classFeatures.forEach((feature) => {
      if (
        feature.data?.toggleable === true &&
        feature.name &&
        record.data?.level >= feature.data?.level &&
        !seenNames.has(feature.name)
      ) {
        toggleableItems.push({
          name: feature.name,
          predicateValue: feature.data?.predicateValue || "",
        });
        seenNames.add(feature.name);
      }
    });
  }

  // Get ancestry features (from first ancestry)
  const ancestries = record.data?.ancestries || [];
  if (ancestries.length > 0) {
    const ancestry = ancestries[0];
    const ancestryFeatures = ancestry.data?.features || [];
    ancestryFeatures.forEach((feature) => {
      if (
        feature.data?.toggleable === true &&
        feature.name &&
        !seenNames.has(feature.name)
      ) {
        toggleableItems.push({
          name: feature.name,
          predicateValue: feature.data?.predicateValue || "",
        });
        seenNames.add(feature.name);
      }
    });
  }

  // Get heritage features (from first heritage)
  const heritages = record.data?.heritages || [];
  if (heritages.length > 0) {
    const heritage = heritages[0];
    const heritageFeatures = heritage.data?.features || [];
    heritageFeatures.forEach((feature) => {
      if (
        feature.data?.toggleable === true &&
        feature.name &&
        !seenNames.has(feature.name)
      ) {
        toggleableItems.push({
          name: feature.name,
          predicateValue: feature.data?.predicateValue || "",
        });
        seenNames.add(feature.name);
      }
    });
  }

  // Get existing toggles to preserve their state
  const existingToggles = record.data?.toggles || [];
  const existingTogglesMap = new Map();
  existingToggles.forEach((toggle) => {
    if (toggle.name) {
      existingTogglesMap.set(toggle.name, toggle);
    }
  });

  // Build the new toggles list, preserving existing state where possible
  const newToggles = toggleableItems.map((item) => {
    const existing = existingTogglesMap.get(item.name);
    if (existing) {
      // Update predicateValue but keep existing toggle state
      return {
        ...existing,
        data: {
          ...existing.data,
          predicateValue: item.predicateValue,
        },
      };
    } else {
      // Create new toggle entry
      return {
        _id: generateUuid(),
        name: item.name,
        identified: true,
        data: {
          predicateValue: item.predicateValue,
          toggled: false, // Default to inactive
        },
      };
    }
  });

  // Only update if toggles actually changed
  // Check if the lists are different (different length or different names/predicateValues)
  let hasChanges = existingToggles.length !== newToggles.length;

  if (!hasChanges) {
    // Same length, check if any items are different
    const existingMap = new Map(
      existingToggles.map((t) => [t.name, t.data?.predicateValue || ""]),
    );

    for (const newToggle of newToggles) {
      const existingPredicateValue = existingMap.get(newToggle.name);
      const newPredicateValue = newToggle.data?.predicateValue || "";

      if (
        existingPredicateValue === undefined ||
        existingPredicateValue !== newPredicateValue
      ) {
        hasChanges = true;
        break;
      }
    }
  }

  // Only set if there are changes
  if (hasChanges) {
    valuesToSet["data.toggles"] = newToggles;
  }
}

// This function is called after adding/editing a talent/feature or equipping an item
function onAddEditFeature(
  record,
  callback = undefined,
  skipChoices = false,
  depth = 0,
) {
  // Calculate Pathfinder 2e ability boosts first
  const boostResults = calculateAbilityBoosts(record);

  // Check for ability score bonuses from other sources
  const abilityScoreBonus = getEffectsAndModifiersForToken(record, [
    "attributeBonus",
    "attributePenalty",
  ]);

  const valuesToSet = {};

  // Update rollOptions first (these affect predicate evaluation for other modifiers)
  updateRollOptions(record, valuesToSet);

  // Initialize total modifier values for each ability
  const attributes = ["str", "dex", "con", "int", "wis", "cha"];

  // Reset all total mods to 0 first
  attributes.forEach((attribute) => {
    valuesToSet[`data.total${capitalize(attribute)}Mod`] = 0;
  });

  // Apply boost-based modifiers first
  attributes.forEach((attribute) => {
    const boostResult = boostResults[attribute];
    if (boostResult) {
      valuesToSet[`data.total${capitalize(attribute)}Mod`] =
        boostResult.modifier;

      // Track partial boost if applicable
      if (boostResult.partialBoost) {
        valuesToSet[`data.partial${capitalize(attribute)}Boost`] = true;
      } else {
        valuesToSet[`data.partial${capitalize(attribute)}Boost`] = false;
      }
    }
  });

  // Calculate the total modifier for each ability from other sources
  abilityScoreBonus.forEach((modifier) => {
    const ability = modifier.field || "";
    if (ability && attributes.includes(ability)) {
      const currentTotalMod =
        valuesToSet[`data.total${capitalize(ability)}Mod`] || 0;
      valuesToSet[`data.total${capitalize(ability)}Mod`] =
        currentTotalMod + modifier.value;
    } else if (ability === "all") {
      attributes.forEach((attribute) => {
        const currentTotalMod =
          valuesToSet[`data.total${capitalize(attribute)}Mod`] || 0;
        valuesToSet[`data.total${capitalize(attribute)}Mod`] =
          currentTotalMod + modifier.value;
      });
    }
  });

  // Calculate final ability scores and modifiers
  attributes.forEach((attribute) => {
    const boostResult = boostResults[attribute];
    if (boostResult) {
      const totalMod =
        valuesToSet[`data.total${capitalize(attribute)}Mod`] || 0;

      // Store the total modifier for reference
      valuesToSet[`data.${attribute}Mod`] = totalMod;

      // The final ability score is just the total modifier (starts from 0 base)
      valuesToSet[`data.${attribute}`] = totalMod;
    }
  });

  // Check for sense bonuses
  const senseBonus = getEffectsAndModifiersForToken(record, ["sense"]);
  const lowLightDarkvisionBonus = getEffectsAndModifiersForToken(record, [
    "lowLightDarkvision",
  ]);
  const currentSenses = String(record.data?.senses || "");

  // Handle low-light darkvision bonus
  if (lowLightDarkvisionBonus.length > 0) {
    let newSenses = currentSenses;

    // Check if they already have Low-Light vision (various formats)
    const hasLowLight = /low.?light|lowlight/i.test(currentSenses);
    const hasDarkvision = /darkvision/i.test(currentSenses);

    if (hasLowLight && !hasDarkvision) {
      // Replace Low-Light vision with Darkvision
      newSenses = currentSenses.replace(/low.?light|lowlight/gi, "Darkvision");
    } else if (!hasDarkvision) {
      // Add Low-Light vision if they don't have it and don't already have Darkvision
      if (newSenses && !newSenses.includes("Low-Light")) {
        newSenses = `${newSenses}, Low-Light`;
      } else if (!newSenses) {
        newSenses = "Low-Light";
      }
    }

    valuesToSet[`data.senses`] = newSenses;
  }

  senseBonus.forEach((modifier) => {
    const sense = String(modifier.value || modifier.field || "");
    if (sense && sense.trim() && !currentSenses.includes(sense)) {
      let newSenses = currentSenses;

      // If the new sense is Darkvision, replace any existing Low-Light vision
      if (sense.toLowerCase() === "darkvision") {
        newSenses = currentSenses.replace(/low-light/gi, "Darkvision");
      }

      // Only append if the sense isn't already in the new senses string
      if (newSenses && !newSenses.includes(sense)) {
        newSenses = `${newSenses}, ${sense}`;
      } else if (!newSenses) {
        newSenses = sense;
      }

      valuesToSet[`data.senses`] = newSenses;
    }
  });

  // Check for trait bonuses
  const traitBonus = getEffectsAndModifiersForToken(record, ["trait"]);
  const currentTraits = record.data?.traits || [];
  const currentTraitsList = record.data?.traitsList || [];
  const newTraits = [...currentTraits];
  const newTraitsList = [...currentTraitsList];

  traitBonus.forEach((modifier) => {
    const trait = modifier.value || modifier.field || "";
    if (trait && typeof trait === "string") {
      // Set traits list
      const traitObject = {
        _id: generateUuid(),
        name: trait,
        identified: true,
        data: {},
      };

      // Add to traits array if not already present
      if (!newTraits.includes(trait)) {
        newTraits.push(trait);
      }

      // Add to traitsList if not already present
      const existingTrait = newTraitsList.find((t) => t.name === trait);
      if (!existingTrait) {
        newTraitsList.push(traitObject);
      }
    }
  });

  // Only update if there are changes
  if (JSON.stringify(newTraits) !== JSON.stringify(currentTraits)) {
    valuesToSet[`data.traits`] = newTraits;
  }
  if (JSON.stringify(newTraitsList) !== JSON.stringify(currentTraitsList)) {
    valuesToSet[`data.traitsList`] = newTraitsList;
  }

  // Note: IWR (Immunities, Weaknesses, Resistances) from effects and modifiers
  // are now handled dynamically in getIWR() during damage calculation.
  // This prevents double-counting and allows for conditional IWR based on predicates.

  // Show fields for alchemist if needed
  showAlchemistFields(record, valuesToSet);

  // Determine the best proficiencies for class dcs / saving throws / armor / weapons
  // And set them on the character
  updateProficiencies(record, valuesToSet);

  // Check for feats that the character gets at their current level, and add (or remove empty slots)
  // to make sure it matches
  setFeatSlots(record, valuesToSet);

  // Check all spellcasting entries and update DC and Mod
  updateSpellcastingEntries(record, valuesToSet);

  // Update toggles list with all toggleable items
  updateTogglesList(record, valuesToSet);

  // Process active effects from features, feats, items, etc.
  const activeEffects = getEffectsAndModifiersForToken(record, [
    "activeEffect",
  ]);

  // Get the set of already processed active effects to avoid re-applying one-time effects
  const processedActiveEffects = record.data?.processedActiveEffects || {};
  const newProcessedEffects = { ...processedActiveEffects };

  activeEffects.forEach((effect) => {
    if (!effect.active) return; // Skip inactive effects

    const effectField = effect.effectField || "";
    const effectMode = effect.effectMode || "override";
    const effectValue = effect.value;

    if (!effectField) return; // Skip if no field specified

    // Build the data path - prepend "data." if not already present
    const dataPath = effectField.startsWith("data.")
      ? effectField
      : `data.${effectField}`;

    // Create a unique key for this effect using slug (or name) + field + value
    const effectKey = `${
      effect.slug || effect.name || "effect"
    }_${effectField}_${effectValue}`;

    // For modes that modify values (not override), check if already processed
    const isOneTimeMode = [
      "add",
      "multiply",
      "append",
      "remove",
      "upgrade",
    ].includes(effectMode);
    if (isOneTimeMode && processedActiveEffects[effectKey]) {
      // Already processed, skip
      return;
    }

    // Get current value at the path
    const currentValue = api.getValueOnRecord(record, dataPath);

    // Apply the effect based on mode
    switch (effectMode) {
      case "override":
        valuesToSet[dataPath] = effectValue;
        break;
      case "upgrade":
        // Take the higher of current vs new value (useful for skill proficiencies)
        const upgradeCurrent = parseInt(currentValue, 10) || 0;
        const upgradeNew = parseInt(effectValue, 10) || 0;
        if (upgradeNew > upgradeCurrent) {
          valuesToSet[dataPath] = upgradeNew;
        }
        // Mark as processed
        newProcessedEffects[effectKey] = true;
        break;
      case "add":
        // Sum numerical values
        const numericCurrent = parseFloat(currentValue) || 0;
        const numericNew = parseFloat(effectValue) || 0;
        valuesToSet[dataPath] = numericCurrent + numericNew;
        // Mark as processed
        newProcessedEffects[effectKey] = true;
        break;
      case "multiply":
        const multCurrent = parseFloat(currentValue) || 0;
        const multNew = parseFloat(effectValue) || 1;
        valuesToSet[dataPath] = multCurrent * multNew;
        // Mark as processed
        newProcessedEffects[effectKey] = true;
        break;
      case "append":
        // Add to array
        const currentArray = Array.isArray(currentValue)
          ? [...currentValue]
          : [];
        if (!currentArray.includes(effectValue)) {
          currentArray.push(effectValue);
        }
        valuesToSet[dataPath] = currentArray;
        // Mark as processed
        newProcessedEffects[effectKey] = true;
        break;
      case "remove":
        // Remove from array
        if (Array.isArray(currentValue)) {
          valuesToSet[dataPath] = currentValue.filter(
            (item) => item !== effectValue,
          );
        }
        // Mark as processed
        newProcessedEffects[effectKey] = true;
        break;
      default:
        valuesToSet[dataPath] = effectValue;
    }
  });

  // Save the updated processed effects set
  if (
    Object.keys(newProcessedEffects).length >
    Object.keys(processedActiveEffects).length
  ) {
    valuesToSet["data.processedActiveEffects"] = newProcessedEffects;
  }

  // Set provided items (feats, actions, items, features) from providesItems
  const setItemsCallback = () => {
    setProvidedItems(record, () => {
      // Call the original callback first (if provided)
      if (callback) {
        callback();
      }

      // Check for choices that the character needs to make and
      // process each one sequentially (unless explicitly skipped to prevent infinite loops)
      if (!skipChoices) {
        // Re-query the record to get the latest values before processing choices
        api.getRecord("characters", record._id, (updatedRecord) => {
          processChoices(updatedRecord, depth);
        });
      }
    });
  };

  if (Object.keys(valuesToSet).length > 0) {
    api.setValuesOnRecord(record, valuesToSet, (recordUpdated) => {
      updateAllAttributes(recordUpdated, setItemsCallback);
    });
  } else {
    updateAllAttributes(record, setItemsCallback);
  }
}

// Add languages to the character or npc
function setLanguages(languages) {
  const recordDataPath = getNearestParentDataPath(dataPath);

  // Set the traits list to the values within traitsList
  const languageList = [];
  for (const language of languages) {
    // Strip rarity information from parentheses if present
    const cleanLanguageName = language.replace(/\s*\([^)]*\)$/, "");

    languageList.push({
      _id: generateUuid(),
      name: cleanLanguageName,
      identified: true,
      data: {
        description: `Can speak the ${cleanLanguageName} language.`,
      },
    });
  }

  const valuesToSet = {
    [`${recordDataPath}${recordDataPath ? "." : ""}data.languagesList`]:
      languageList,
  };

  api.setValues(valuesToSet);
}

// Sets the traits for the record
function setTraits(traits, callback = undefined) {
  const recordDataPath = getNearestParentDataPath(dataPath);

  // Set the traits list to the values within traitsList
  const traitsObjects = [];
  for (const trait of traits) {
    traitsObjects.push({
      _id: generateUuid(),
      name: trait,
      identified: true,
      data: {},
    });
  }

  const valuesToSet = {
    [`${recordDataPath}${recordDataPath ? "." : ""}data.traitsList`]:
      traitsObjects,
  };

  api.setValues(valuesToSet, (recordUpdated) => {
    if (callback) {
      callback(recordUpdated);
    }
  });
}

// Roll a saving throw for PF2e
function rollSave(record, type, dc = null, isSpell = false, isMacro = false) {
  if (!record || !type) {
    console.error("rollSave: Invalid record or type");
    return;
  }

  // Normalize the save type
  const saveType = type.toLowerCase();
  const validSaves = ["fortitude", "reflex", "will"];

  if (!validSaves.includes(saveType)) {
    console.error(`rollSave: Invalid save type '${type}'`);
    return;
  }

  // Get the save modifier from the record
  const saveMod = parseInt(record.data?.[`${saveType}Mod`] || "0", 10);

  // Get the proficiency level for display purposes (character only)
  const isNPC = record.recordType === "tokens" || record.recordType === "npcs";
  let modifierName = `${capitalize(saveType)} Modifier`;
  let saveDisplay = `${capitalize(saveType)}`;
  let npcSaveBonus = 0;

  if (!isNPC) {
    const proficiencyLevel = parseInt(record.data?.[saveType] || "0", 10);
    const proficiencyNames = [
      "Untrained",
      "Trained",
      "Expert",
      "Master",
      "Legendary",
    ];
    const proficiencyName = proficiencyNames[proficiencyLevel] || "Untrained";

    // Capitalize the save type for display
    const saveDisplay = saveType.charAt(0).toUpperCase() + saveType.slice(1);
    modifierName = `${saveDisplay} (${proficiencyName})`;
  } else {
    // Get the bonus
    npcSaveBonus = parseInt(record.data?.saveBonus || "0", 10);
  }

  // Build modifiers array for the roll
  const modifiers = [];

  // Add the total save modifier (includes ability + proficiency)
  if (saveMod !== 0) {
    modifiers.push({
      name: modifierName,
      type: "",
      value: saveMod,
      active: true,
    });
  }

  if (npcSaveBonus !== 0) {
    modifiers.push({
      name: "Bonus to All Saves",
      type: "",
      value: npcSaveBonus,
      active: true,
    });
  }

  // Get any additional modifiers from effects
  const additionalMods = getEffectsAndModifiersForToken(
    record,
    [`saveBonus`, `savePenalty`],
    saveType,
  );

  const additionalModsSet = new Set();

  // If this is a spell, get the spell save modifiers
  if (isSpell) {
    const spellSaveMods = getEffectsAndModifiersForToken(
      record,
      [`saveBonus`, `savePenalty`],
      "spell",
    );
    spellSaveMods.forEach((mod) => {
      const modString = modToString(mod);
      if (!additionalModsSet.has(modString)) {
        additionalModsSet.add(modString);
        modifiers.push(mod);
      }
    });
  }

  // Determine the attribute for this save
  let attribute = "con"; // Fortitude uses CON
  if (saveType === "reflex") {
    attribute = "dex";
  } else if (saveType === "will") {
    attribute = "wis";
  }

  // Get all bonuses/penalties that apply to the save's attribute
  const allEffectMods = getEffectsAndModifiersForToken(
    record,
    [`allBonus`, `allPenalty`],
    attribute,
  );

  // Add save-specific modifiers
  additionalMods.forEach((mod) => {
    const modString = modToString(mod);
    if (!additionalModsSet.has(modString)) {
      additionalModsSet.add(modString);
      modifiers.push(mod);
    }
  });

  // Add attribute-based all bonuses/penalties unless already seen
  allEffectMods.forEach((mod) => {
    const modString = modToString(mod);
    if (!additionalModsSet.has(modString)) {
      additionalModsSet.add(modString);
      modifiers.push(mod);
    }
  });

  // Get degree of success adjustments for both the save type and its attribute
  const degreeOfSuccessAdjustments = getDegreeOfSuccessAdjustments(record, [
    saveType,
    attribute,
  ]);

  // Prepare metadata for the roll handler
  const metadata = {
    rollName: `${saveDisplay} Save`,
    tooltip: `${saveDisplay} Saving Throw`,
    saveType: saveType,
    degreeOfSuccessAdjustments: degreeOfSuccessAdjustments,
  };

  // Add DC if provided
  if (dc !== null && dc !== undefined) {
    metadata.dc = dc;
  }

  // Add isSpell flag if true
  if (isSpell) {
    metadata.isSpell = true;
  }

  // Use promptRoll to allow players to modify the roll
  if (isMacro) {
    api.promptRollForToken(
      record,
      `${saveDisplay} Save`,
      "1d20",
      modifiers,
      metadata,
      "save",
    );
  } else {
    api.promptRoll(`${saveDisplay} Save`, "1d20", modifiers, metadata, "save");
  }
}

function modToString(mod) {
  return JSON.stringify({
    name: mod.name,
    value: mod.value,
    active: mod.active,
    type: mod.type,
  });
}

// Generate a clickable save macro for PF2e
function getSaveMacro(saveType, dc = null, isSpell = false, showDc = false) {
  if (!saveType) {
    console.error("getSaveMacro: Invalid saveType");
    return "";
  }

  // Normalize the save type
  const normalizedSaveType = saveType.toLowerCase();
  const validSaves = ["fortitude", "reflex", "will"];

  if (!validSaves.includes(normalizedSaveType)) {
    console.error(`getSaveMacro: Invalid save type '${saveType}'`);
    return "";
  }

  // Create snake_case name for the macro
  const saveNameSnakeCase = `${capitalize(normalizedSaveType)}_Save`;

  // Escape the save type for the macro
  const escapedSaveType = normalizedSaveType.replace(/'/g, "\\'");

  // Build the macro content that gets selected tokens and rolls for each
  let macroContent = `const selectedTokens = api.getSelectedOrDroppedToken();
selectedTokens.forEach(token => {
  rollSave(token, '${escapedSaveType}'`;

  // Add DC parameter
  if (dc !== null && dc !== undefined) {
    macroContent += `, ${dc}`;
  } else {
    macroContent += `, null`;
  }

  // Add isSpell parameter
  macroContent += `, ${isSpell}, true`;

  // Close the function call and forEach
  macroContent += `);
});`;

  // Build the macro label
  let macroLabel = `Roll_${saveNameSnakeCase}`;
  if (dc !== null && dc !== undefined && showDc) {
    macroLabel += `_DC${dc}`;
  }

  // Generate the macro
  return `\`\`\`${macroLabel}
${macroContent}
\`\`\``;
}

// Roll a skill check for PF2e
function rollSkill(
  record,
  skillName,
  dc = null,
  isLore = false,
  loreSkillMod = 0,
  loreSkillTraining = 1,
  loreSkillStat = "int",
  isMacro = false,
  isInitiative = false,
  initiativeGroup = undefined,
  additionalMetadata = {},
) {
  if (!record || !skillName) {
    console.error("rollSkill: Invalid record or skillName");
    return;
  }

  // Normalize the skill name
  const skill = skillName.toLowerCase();

  // Determine if this is Perception (special case)
  const isPerception = skill === "perception";

  // Get the skill modifier from the record
  let skillMod = isLore
    ? loreSkillMod
    : parseInt(record.data?.[`${skill}Mod`] || "0", 10);

  const isNPC = record.recordType === "npcs" || record.recordType === "tokens";

  // Get the proficiency level for display purposes (if character)
  let skillModName = `${skillName} Modifier`;
  if (!isNPC) {
    const proficiencyLevel = isLore
      ? loreSkillTraining
      : parseInt(record.data?.[skill] || "0", 10);
    const proficiencyNames = [
      "Untrained",
      "Trained",
      "Expert",
      "Master",
      "Legendary",
    ];
    const proficiencyName = proficiencyNames[proficiencyLevel] || "Untrained";
    skillModName = `${skillName} (${proficiencyName})`;
  } else if (isNPC & !isPerception) {
    // NPCs need to get the skill mod from the .skills list
    const skills = record.data?.skills || [];
    const skillObj = skills.find(
      (s) => s?.name?.toLowerCase() === skillName?.toLowerCase(),
    );
    skillMod = skillObj?.data?.mod || 0;
  }

  // Capitalize the skill name for display
  const skillDisplay = skill.charAt(0).toUpperCase() + skill.slice(1);

  // Build modifiers array
  const modifiers = [];

  // Add the total skill modifier (includes ability + proficiency)
  if (skillMod !== 0) {
    modifiers.push({
      name: skillModName,
      type: "",
      value: skillMod,
      active: true,
    });
  }

  // Build context object for action-based predicates
  const actionName = additionalMetadata.action || "";
  const context = actionName ? { action: { name: actionName } } : {};

  // Get skill-specific modifiers
  const additionalModsSet = new Set();
  let additionalMods;
  if (isPerception) {
    // Perception gets special treatment with perception-specific bonuses
    additionalMods = getEffectsAndModifiersForToken(
      record,
      [`perceptionBonus`, `perceptionPenalty`, `skillBonus`, `skillPenalty`],
      "perception",
      undefined,
      undefined,
      context,
    );
  } else {
    // Regular skills get skill bonuses
    additionalMods = getEffectsAndModifiersForToken(
      record,
      [`skillBonus`, `skillPenalty`],
      skill,
      undefined,
      undefined,
      context,
    );
  }
  if (isInitiative) {
    const initiativeMods = getEffectsAndModifiersForToken(
      record,
      ["initiativeBonus", "initiativePenalty"],
      undefined,
      undefined,
      undefined,
      context,
    );
    initiativeMods.forEach((mod) => {
      additionalMods.push(mod);
    });
  }

  // Determine the attribute for this skill
  let attribute = "";
  if (isPerception) {
    attribute = "wis";
  } else if (isLore) {
    attribute = loreSkillStat;
    // If attribute is undefined or empty, get default ability from skill
    if (!attribute) {
      attribute = "int";
    }
  } else {
    // Get attribute setting from record
    attribute = record.data?.[`${skill}Ability`] || "";
    // If attribute is undefined or empty, get default ability from skill
    if (!attribute) {
      attribute = getPathfinderSkills()[skill];
    }
  }

  // Get all bonuses/penalties that apply to the skill's attribute
  let allEffectMods = [];
  if (attribute) {
    allEffectMods = getEffectsAndModifiersForToken(
      record,
      ["allBonus", "allPenalty", "skillBonus", "skillPenalty"],
      attribute,
    );
  }

  // Get all bonuses/penalties that specifically reference this skill as the field
  let allEffectMods2 = [];
  if (attribute) {
    allEffectMods2 = getEffectsAndModifiersForToken(
      record,
      ["allBonus", "allPenalty"],
      skill,
      undefined,
      undefined,
      context,
    );
  }

  // Add skill-specific modifiers
  additionalMods.forEach((mod) => {
    if (!additionalModsSet.has(modToString(mod))) {
      additionalModsSet.add(modToString(mod));
      modifiers.push(mod);
    }
  });

  // Add attribute-based all bonuses/penalties
  allEffectMods.forEach((mod) => {
    const modString = modToString(mod);
    if (!additionalModsSet.has(modString)) {
      additionalModsSet.add(modString);
      modifiers.push(mod);
    }
  });

  allEffectMods2.forEach((mod) => {
    const modString = modToString(mod);
    if (!additionalModsSet.has(modString)) {
      additionalModsSet.add(modString);
      modifiers.push(mod);
    }
  });

  // Get degree of success adjustments for both the skill and its attribute
  const degreeOfSuccessAdjustments = getDegreeOfSuccessAdjustments(
    record,
    [skill, attribute],
    undefined,
    undefined,
    context,
  );

  // Prepare metadata for the roll handler
  const metadata = {
    rollName: `${capitalize(skillName)}`,
    tooltip: `${capitalize(skillName)} Skill Check`,
    skillName: skill,
    group: initiativeGroup,
    degreeOfSuccessAdjustments: degreeOfSuccessAdjustments,
    ...additionalMetadata,
  };

  if (isPerception) {
    metadata.tooltip = `Perception Check`;
  }

  // Add DC if provided
  if (dc !== null && dc !== undefined) {
    metadata.dc = dc;
  }

  // Use promptRoll to allow players to modify the roll
  if (isMacro) {
    api.promptRollForToken(
      record,
      `${skillDisplay} Check`,
      "1d20",
      modifiers,
      metadata,
      isInitiative ? "initiative" : "skill",
    );
  } else {
    api.promptRoll(
      `${skillDisplay} Check`,
      "1d20",
      modifiers,
      metadata,
      isInitiative ? "initiative" : "skill",
    );
  }
}

// Generate a clickable skill check macro for PF2e
function getSkillCheckMacro(skillName, dc = null) {
  if (!skillName) {
    console.error("getSkillCheckMacro: Invalid skillName");
    return "";
  }

  // Normalize the skill name
  const skill = skillName.toLowerCase();

  // Create snake_case name for the macro
  const skillNameSnakeCase =
    capitalize(skillName).replace(/\s+/g, "_") + "_Check";

  // Escape the skill name for the macro
  const escapedSkillName = skill.replace(/'/g, "\\'");

  // Build the macro content that gets selected tokens and rolls for each
  let macroContent = `const selectedTokens = api.getSelectedOrDroppedToken();
selectedTokens.forEach(token => {
  rollSkill(token, '${escapedSkillName}'`;

  // Add DC parameter
  if (dc !== null && dc !== undefined) {
    macroContent += `, ${dc}, false, 0, 1, "int", true`;
  } else {
    macroContent += `, null, false, 0, 1, "int", true`;
  }

  // Close the function call and forEach
  macroContent += `);
});`;

  // Build the macro label
  let macroLabel = `Roll_${skillNameSnakeCase}`;
  if (dc !== null && dc !== undefined) {
    macroLabel += `_DC${dc}`;
  }

  // Generate the macro
  return `\`\`\`${macroLabel}
${macroContent}
\`\`\``;
}

// For a quick custom macro
function rollSavingThrow(save, dc) {
  const escapedSaveType = save.toLowerCase().replace(/'/g, "\\'");
  const selectedTokens = api.getSelectedOrDroppedToken();
  selectedTokens.forEach((token) => {
    rollSave(token, escapedSaveType, dc);
  });
}

// For a quick custom skill macro
function rollSkillCheck(skill, dc, options = {}) {
  const escapedSkillName = skill.toLowerCase().replace(/'/g, "\\'");
  const selectedTokens = api.getSelectedOrDroppedToken();
  const actionName = options.action || "";
  selectedTokens.forEach((token) => {
    rollSkill(
      token,
      escapedSkillName,
      dc,
      false,
      0,
      1,
      "int",
      true,
      false,
      undefined,
      {
        action: actionName,
      },
    );
  });
}

function updateTotalBulk(record, setValue = true) {
  // Update total weight
  const items = record?.data?.inventory || [];
  let totalBulk = 0;
  items.forEach((item) => {
    if (item.data?.carried !== "dropped") {
      let weight = parseFloat(item.data?.bulk?.value || "0");

      // If heldOrStowed is set, and it's not dropped or carried
      if (item.data?.bulk?.heldOrStowed && item.data?.carried !== "equipped") {
        weight = item.data?.bulk?.heldOrStowed;
      }

      // Armor that is carried is 1 bulk more
      if (item.data?.type === "armor" && item.data?.carried !== "equipped") {
        weight += 1;
      }

      let count = parseFloat(item.data?.count || "0");
      if (count === undefined || isNaN(count)) {
        count = 0;
      }
      if (weight !== undefined && !isNaN(weight)) {
        totalBulk += weight * count;
      }

      // Get the total bulk of all backpacks (containers)
      if (item.data?.type === "backpack") {
        let totalBulkOfPack = parseFloat(item.data?.bulkUsed || "0");
        // Subtract what's ignored
        totalBulkOfPack = Math.max(
          0,
          totalBulkOfPack - parseFloat(item.data?.bulk?.ignored || "0"),
        );
        totalBulk += totalBulkOfPack;
      }
    }
  });

  // Include coinage if set
  const includeCoinage = api.getSetting("coinWeight") === "yes";
  if (includeCoinage) {
    const totalCoins =
      (record?.data?.cp || 0) +
      (record?.data?.sp || 0) +
      (record?.data?.gp || 0) +
      (record?.data?.pp || 0);
    totalBulk += Math.floor(totalCoins / 1000);
  }

  totalBulk = Math.round(totalBulk * 100) / 100;

  if (setValue) {
    api.setValuesOnRecord(record, { "data.totalBulk": totalBulk });
  } else {
    return totalBulk;
  }
}

// Helper function to convert size string to grid squares (1 square = 5 feet)
function getSizeInSquares(size) {
  const sizeMap = {
    tiny: 1,
    small: 1,
    medium: 1,
    large: 2,
    huge: 3,
    gargantuan: 4,
  };
  return sizeMap[size?.toLowerCase()] || 1;
}

// Helper function to check if a token is incapacitated and cannot act
function isTokenIncapacitated(token) {
  if (!token) {
    return true; // No token means can't act
  }

  // Check if token has any incapacitating effects
  const effects = token.effects || [];
  const incapacitatingConditions = [
    "dead",
    "dying",
    "paralyzed",
    "petrified",
    "unconscious",
    "stunned", // In PF2e, stunned can prevent actions
    "restrained", // Prevents attack
  ];

  for (const effect of effects) {
    const effectName = (effect.name || "").toLowerCase();
    // Check if the effect name contains any of the incapacitating conditions
    if (
      incapacitatingConditions.some((condition) =>
        effectName.includes(condition),
      )
    ) {
      return true;
    }
  }

  return false;
}

// Helper function to parse reach from a traits array
// Returns the reach in feet, or null if no reach trait found
function parseReachFromTraits(traits, baseReach) {
  if (!traits || !Array.isArray(traits)) {
    return null;
  }

  for (const trait of traits) {
    const traitLower = (trait || "").toString().toLowerCase().trim();

    // Check if this is a reach trait
    if (traitLower.startsWith("reach")) {
      // Try to extract a number from "reach-#" or "reach #"
      const match = traitLower.match(/^reach[-\s]?(\d+)$/);
      if (match) {
        // Specific reach distance (e.g., "reach-10" = 10 feet)
        const reachDistance = parseInt(match[1], 10);
        return isNaN(reachDistance) ? baseReach + 5 : reachDistance;
      } else if (traitLower === "reach") {
        // Just "reach" with no number = add 5 feet to base reach
        return baseReach + 5;
      }
    }
  }

  return null;
}

// Helper function to get the reach of a token
// If weapon is provided, only check that specific weapon/attack's reach
function getTokenReach(token, weapon = null) {
  if (!token) {
    return 5; // Default reach
  }

  // Start with the base reach (5 feet by default, or the token's reach property if specified)
  let baseReach = parseInt(token?.data?.reach || "5", 10);
  if (isNaN(baseReach) || baseReach < 5) {
    baseReach = 5;
  }

  // If a specific weapon is provided, only check that weapon's reach
  if (weapon) {
    const traits = weapon.data?.traits || [];
    const weaponReach = parseReachFromTraits(traits, baseReach);
    // If weapon has reach trait, use it; otherwise use base reach
    return weaponReach !== null ? weaponReach : baseReach;
  }

  // No specific weapon provided - find the maximum reach across all weapons
  let maxReach = baseReach;

  // Check equipped melee weapons for reach trait (for PCs)
  const inventory = token?.data?.inventory;
  if (Array.isArray(inventory)) {
    const equippedMeleeWeapons = inventory.filter((item) => {
      const isMelee = (item.data?.range || 0) === 0;
      const isEquipped = item.data?.carried === "equipped";
      return isMelee && isEquipped;
    });

    // Check if any equipped melee weapon has the reach trait
    for (const equippedWeapon of equippedMeleeWeapons) {
      const traits = equippedWeapon.data?.traits || [];
      const weaponReach = parseReachFromTraits(traits, baseReach);
      if (weaponReach !== null && weaponReach > maxReach) {
        maxReach = weaponReach;
      }
    }
  }

  // Always check NPC Attacks for reach - use largest melee reach
  const npcAttacks = token?.data?.attacks;
  if (Array.isArray(npcAttacks)) {
    for (const attack of npcAttacks) {
      const weaponType = (attack.data?.weaponType || "").toLowerCase();
      const isMelee = weaponType === "melee" || weaponType === "unarmed";

      if (isMelee) {
        const traits = attack.data?.traits || [];
        const attackReach = parseReachFromTraits(traits, baseReach);
        if (attackReach !== null && attackReach > maxReach) {
          maxReach = attackReach;
        }
      }
    }
  }

  return maxReach;
}

function isOffGuard(token) {
  const effects = token?.effects || [];
  return effects.some(
    (effect) =>
      effect.name.toLowerCase().includes("off-guard") ||
      effect.name.toLowerCase().includes("off guard") ||
      effect.name.toLowerCase().includes("offguard"),
  );
}

function getOffGuardTooltip() {
  return "You're distracted or otherwise unable to focus your full attention on defense. You take a –2 circumstance penalty to AC. Some effects give you the off-guard condition only to certain creatures or against certain attacks. Others—especially conditions—can make you off-guard against everything. If a rule doesn't specify that the condition applies only to certain circumstances, it applies to all of them, such as \"The target is off-guard.\"";
}

// Checks if a token can be made off-guard by an attacker based on off-guard prevention modifiers
// Returns true if the token CAN be made off-guard, false if prevented
function canBeOffGuard(targetToken, attackerToken, source = "flanking") {
  if (!targetToken) return true;

  // Get off-guard prevention modifiers
  const preventionModifiers = getEffectsAndModifiersForToken(
    targetToken,
    ["offGuardPrevention"],
    source,
  );

  if (preventionModifiers.length === 0) {
    return true; // No prevention, can be off-guard
  }

  // Check each prevention modifier
  for (const mod of preventionModifiers) {
    if (!mod.active) continue;

    // Get the level threshold from the modifier value
    let levelThreshold = 0;
    if (typeof mod.value === "number") {
      levelThreshold = mod.value;
    } else if (typeof mod.value === "string") {
      // Parse the value (could be "Character Level" replacement or a number)
      const parsedValue = parseInt(mod.value, 10);
      if (!isNaN(parsedValue)) {
        levelThreshold = parsedValue;
      }
    }

    // If attacker's level is <= threshold, prevent off-guard
    const attackerLevel = attackerToken?.data?.level || 0;
    if (attackerLevel <= levelThreshold) {
      return false; // Prevented from being off-guard
    }
  }

  return true; // Can be off-guard
}

// Determines if an enemy is Off-Guard due to Flanking
// Per PF2e rules: A line drawn between the center of the flankers' spaces
// must pass through opposite sides or opposite corners of the target's space
function isOffGuardDueToFlanking({
  sourceToken,
  sourceReach = 5, // Default to 5ft reach
  otherTokens,
  target,
}) {
  const targetToken = target?.token;
  const targetDistance = target?.distance || 0;

  // Basic validation
  if (!otherTokens || otherTokens.length === 0) {
    return false;
  }

  if (!sourceToken || !targetToken) {
    return false;
  }

  // Check if source is within reach of target
  if (targetDistance > sourceReach) {
    return false;
  }

  const targetPos = targetToken.position;

  if (!sourceToken.position || !targetPos) {
    return false;
  }

  // Get target size in grid squares
  const targetSize =
    targetToken?.data?.size || targetToken?.record?.data?.size || "medium";
  const targetSizeSquares = getSizeInSquares(targetSize);

  // The 3D renderer stores a multi-cell token's position as its footprint ANCHOR,
  // with the visual centre offset by (span - 1) / 2 cells on BOTH axes. The 2D
  // engine uses a different convention (odd sizes: position IS the centre; even
  // sizes: position is offset inward from a corner). `api.is3D` (undefined on
  // older 2D-only clients) tells us which convention the positions follow so the
  // flanking geometry lands on the real token centre in both renderers.
  const is3D = !!(typeof api !== "undefined" && api && api.is3D);

  // Compute the center of a token's space from its position and size.
  function getTokenCenter(token) {
    const pos = token.position;
    const size = token?.data?.size || token?.record?.data?.size || "medium";
    const sizeSquares = getSizeInSquares(size);
    if (sizeSquares <= 1) return pos;
    if (is3D) {
      // 3D: position is the footprint anchor; centre is offset on both axes.
      const offset = (sizeSquares - 1) / 2;
      return { x: pos.x + offset, y: pos.y + offset };
    }
    // 2D conventions:
    if (sizeSquares % 2 === 1) {
      return pos; // Odd: position is already the center
    }
    const offset = sizeSquares / 2 - 1;
    const right = pos.x + offset + 0.5;
    const left = right - sizeSquares;
    const top = pos.y - offset - 0.5;
    const bottom = top + sizeSquares;
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }

  const sourcePos = getTokenCenter(sourceToken);

  const targetTokenHasAllAroundVision =
    targetToken?.data?.acDetails
      ?.toLowerCase()
      .replace(/ /g, "-")
      .includes("all-around") ||
    targetToken?.record?.data?.acDetails
      ?.toLowerCase()
      .replace(/ /g, "-")
      .includes("all-around");

  if (targetTokenHasAllAroundVision) {
    return false;
  }

  // Find allied tokens (same faction as source)
  const sourceFaction = sourceToken.faction;
  const allies = otherTokens.filter((token) => {
    // Must be the same faction
    if (token.faction !== sourceFaction) {
      return false;
    }

    // Must not be the source token itself
    if (token._id === sourceToken._id) {
      return false;
    }

    // Must not be the target token
    if (token._id === targetToken._id) {
      return false;
    }

    // Must be able to act (not incapacitated)
    if (isTokenIncapacitated(token)) {
      return false;
    }

    return true;
  });

  if (allies.length === 0) {
    return false;
  }

  // Helper function to check if line segment intersects with a line segment
  function lineSegmentsIntersect(p1, p2, p3, p4) {
    const ccw = (A, B, C) =>
      (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  }

  // Helper function to calculate distance from point to line segment
  function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Helper function to check if line between two allies passes through opposite sides
  function doesLineCrossOppositeSides(pos1, pos2) {
    // The target's bounding box is its space: centred on the token centre and
    // extending half its size in each direction. Deriving it from the centre (via
    // getTokenCenter, which is renderer-aware) reproduces the 2D box exactly AND
    // works for the 3D anchor convention — no per-convention edge math here.
    const targetCenter = getTokenCenter(targetToken);
    const half = targetSizeSquares / 2;
    const left = targetCenter.x - half;
    const right = targetCenter.x + half;
    const top = targetCenter.y - half;
    const bottom = targetCenter.y + half;

    // Define the four corners of the target's bounding box
    const topLeft = { x: left, y: top };
    const topRight = { x: right, y: top };
    const bottomLeft = { x: left, y: bottom };
    const bottomRight = { x: right, y: bottom };

    // For opposite-side detection, check if the line passes through the target's bounding box
    // when the flankers are on opposite sides of the target's center

    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    // Determine which sides of the center each flanker is on
    const pos1OnLeft = pos1.x < centerX;
    const pos1OnRight = pos1.x > centerX;
    const pos1OnTop = pos1.y < centerY;
    const pos1OnBottom = pos1.y > centerY;

    const pos2OnLeft = pos2.x < centerX;
    const pos2OnRight = pos2.x > centerX;
    const pos2OnTop = pos2.y < centerY;
    const pos2OnBottom = pos2.y > centerY;

    // Check if flankers are on opposite sides (horizontally or vertically)
    const oppositeHorizontally =
      (pos1OnLeft && pos2OnRight) || (pos1OnRight && pos2OnLeft);
    const oppositeVertically =
      (pos1OnTop && pos2OnBottom) || (pos1OnBottom && pos2OnTop);

    // For opposite-side flanking, check if the line segment intersects the bounding box
    let passesHorizontally = false;
    let passesVertically = false;

    if (oppositeHorizontally || oppositeVertically) {
      // Check if line intersects with any of the four edges of the bounding box
      const intersectsTop = lineSegmentsIntersect(
        pos1,
        pos2,
        topLeft,
        topRight,
      );
      const intersectsBottom = lineSegmentsIntersect(
        pos1,
        pos2,
        bottomLeft,
        bottomRight,
      );
      const intersectsLeft = lineSegmentsIntersect(
        pos1,
        pos2,
        topLeft,
        bottomLeft,
      );
      const intersectsRight = lineSegmentsIntersect(
        pos1,
        pos2,
        topRight,
        bottomRight,
      );

      // Also check if either point is inside the bounding box
      const pos1Inside =
        pos1.x >= left && pos1.x <= right && pos1.y >= top && pos1.y <= bottom;
      const pos2Inside =
        pos2.x >= left && pos2.x <= right && pos2.y >= top && pos2.y <= bottom;

      // For valid flanking, the line must pass through OPPOSITE sides, not adjacent sides
      // Horizontal flanking: line must cross BOTH left AND right edges (or one flanker inside)
      if (oppositeHorizontally) {
        if ((intersectsLeft && intersectsRight) || pos1Inside || pos2Inside) {
          passesHorizontally = true;
        }
      }

      // Vertical flanking: line must cross BOTH top AND bottom edges (or one flanker inside)
      if (oppositeVertically) {
        if ((intersectsTop && intersectsBottom) || pos1Inside || pos2Inside) {
          passesVertically = true;
        }
      }
    }

    // For diagonal flanking, check if the line passes close to opposite corners
    // A line passes through opposite corners if it's close to both corners of a diagonal
    const threshold = 0.1; // Tolerance for "close enough" to corner

    const distToTopLeft = pointToLineDistance(topLeft, pos1, pos2);
    const distToTopRight = pointToLineDistance(topRight, pos1, pos2);
    const distToBottomLeft = pointToLineDistance(bottomLeft, pos1, pos2);
    const distToBottomRight = pointToLineDistance(bottomRight, pos1, pos2);

    // Check if line passes through top-left to bottom-right diagonal
    const passesTopLeftToBottomRight =
      distToTopLeft < threshold && distToBottomRight < threshold;

    // Check if line passes through top-right to bottom-left diagonal
    const passesTopRightToBottomLeft =
      distToTopRight < threshold && distToBottomLeft < threshold;

    const passesDiagonally =
      passesTopLeftToBottomRight || passesTopRightToBottomLeft;

    return passesHorizontally || passesVertically || passesDiagonally;
  }

  // Check each ally to see if they create a flanking position
  for (const ally of allies) {
    // Get ally's reach
    const allyReach = getTokenReach(ally);

    // Check if ally is within reach of the target
    const allyDistance = api.getDistance(ally, targetToken);
    if (allyDistance > allyReach) {
      continue; // Ally is not within reach of target
    }

    if (!ally.position) {
      continue;
    }
    const allyPos = getTokenCenter(ally);

    // Check if the line between source and ally passes through opposite sides
    if (doesLineCrossOppositeSides(sourcePos, allyPos)) {
      // Check if target can be made off-guard (considering prevention modifiers)
      if (!canBeOffGuard(targetToken, sourceToken, "flanking")) {
        continue; // Target is immune to off-guard from this attacker's level
      }
      return true;
    }
  }

  return false;
}

// Automatically determine an animation based on the attack or spell damage and ranged/melee
function getAnimationFor({
  abilityName,
  damage = "",
  healing = "",
  isRanged = false,
}) {
  if (!abilityName) return null;

  const animation = {
    animationName: isRanged ? "bolt_1" : "slash_1",
    sound: isRanged ? "bolt_1" : "slash_1",
    moveToDestination: isRanged,
    stretchToDestination:
      isRanged &&
      (abilityName.toLowerCase().match(/\bray\b/i) ||
        abilityName.toLowerCase().match(/\bspray\b/i) ||
        abilityName.toLowerCase().match(/\bbeam\b/i) ||
        abilityName.toLowerCase().match(/\bdisintegrate\b/i)),
    destinationOnly: false,
    startAtCenter: false,
  };

  if (!damage) {
    animation.animationName = "";
    animation.sound = "";
  }

  if (
    isRanged &&
    damage &&
    (abilityName.toLowerCase().match(/\borb\b/i) ||
      abilityName.toLowerCase().match(/\bmissile\b/i))
  ) {
    animation.animationName = "orb_1";
  }

  // If this is actually healing, we use a different animation
  if (healing) {
    animation.animationName = "healing_1";
    animation.scale = 0.75;
    animation.opacity = 1;
    animation.sound = "healing_1";
    animation.moveToDestination = false;
    animation.startAtCenter = true;
    animation.destinationOnly = true;
    return animation;
  }

  // Based on the damage, set the animation name and props
  if (damage.includes("fire")) {
    animation.animationName = "fire_1";
    animation.sound = "bolt_2";
    animation.hue = undefined;
    animation.contrast = undefined;
    animation.brightness = undefined;
    if (abilityName.toLowerCase().includes("fireball")) {
      animation.animationName = "fire_2";
    }
  } else if (damage.includes("cold")) {
    animation.animationName = "ice_1";
    animation.hue = 180;
    animation.contrast = 1.0;
    animation.brightness = 0.5;
  } else if (damage.includes("acid")) {
    animation.animationName = "splash_1";
    animation.sound = "water_1";
    animation.hue = 100;
    animation.contrast = 1.0;
    animation.brightness = 0.8;
  } else if (damage.includes("lightning") || damage.includes("electric")) {
    animation.animationName = "lightning_1";
    animation.sound = "lightning_1";
    animation.hue = 244;
    animation.opacity = 0.5;
    animation.contrast = 1.0;
    animation.brightness = 0.5;
  } else if (damage.includes("poison")) {
    animation.hue = 128;
    animation.contrast = 1.0;
    animation.brightness = 0.1;
  } else if (damage.includes("necrotic") || damage.includes("void")) {
    animation.animationName = "necrotic_1";
    animation.hue = 240;
    animation.contrast = 0.1;
    animation.brightness = 0.1;
    animation.scale = 0.5;
    animation.opacity = 0.75;
  } else if (damage.includes("radiant") || damage.includes("vitality")) {
    animation.animationName = "radiant_1";
    animation.hue = 50;
    animation.contrast = 1.0;
    animation.brightness = 0.8;
    animation.scale = 0.5;
    animation.opacity = 0.75;
  } else if (damage.includes("thunder") || damage.includes("sonic")) {
    animation.animationName = "lightning_1";
    animation.sound = "lightning_1";
    animation.hue = 244;
    animation.contrast = 1.0;
    animation.brightness = 0.8;
  } else if (damage.includes("force") || damage.includes("spirit")) {
    animation.hue = 284;
    animation.contrast = 1.0;
    animation.brightness = 0.2;
    if (abilityName.toLowerCase().includes("disintegrate")) {
      animation.hue = 128;
    }
  } else if (damage.includes("psychic") || damage.includes("mental")) {
    animation.hue = 330;
    animation.contrast = 1.0;
    animation.brightness = 0.2;
  } else if (damage.includes("piercing")) {
    animation.sound = isRanged ? "arrow_1" : "slash_1";
    // If this is a ranged bow use arrow_1 animationName
    if (
      (isRanged &&
        (abilityName.toLowerCase().match(/\bbow\b/i) ||
          abilityName.toLowerCase().match(/\bcrossbow\b/i))) ||
      abilityName.toLowerCase().match(/\longbow\b/i) ||
      abilityName.toLowerCase().match(/\bshortbow\b/i)
    ) {
      animation.animationName = "arrow_1";
    } else if (isRanged) {
      animation.animationName = "arrow_2";
    } else if (!isRanged) {
      animation.animationName = "pierce_1";
    }
  } else if (damage.includes("bludgeoning")) {
    animation.sound = isRanged ? "bolt_1" : "bludgeon_1";
    if (isRanged) {
      animation.animationName = "bullet_1";
    } else {
      animation.animationName = "bludgeon_1";
    }
  } else if (damage.includes("slashing")) {
    animation.sound = isRanged ? "bolt_1" : "slash_1";
  }

  // Alternatively, if the ability name includes something that indicates a metallic weapon, we use slash_2
  // or a whip, use whip_1, or guns use gun_1
  if (
    (abilityName.toLowerCase().includes("sword") ||
      abilityName.toLowerCase().includes("axe")) &&
    damage.includes("slashing")
  ) {
    animation.animationName = "slash_1";
    animation.sound = "slash_2";
  } else if (abilityName.toLowerCase().includes("whip")) {
    animation.animationName = "slash_1";
    animation.sound = "whip_1";
  } else if (abilityName.toLowerCase().includes("pistol")) {
    animation.animationName = "bullet_2";
    animation.sound = "gun_1";
  } else if (abilityName.toLowerCase().includes("rifle")) {
    animation.animationName = "bullet_2";
    animation.sound = "gun_1";
  } else if (abilityName.toLowerCase().includes("arquebus")) {
    animation.animationName = "bullet_2";
    animation.sound = "gun_1";
  } else if (abilityName.toLowerCase().includes("musket")) {
    animation.animationName = "bullet_2";
    animation.sound = "gun_1";
  } else if (abilityName.toLowerCase().includes("shotgun")) {
    animation.animationName = "bullet_2";
    animation.sound = "gun_1";
  } else if (abilityName.toLowerCase().includes("revolver")) {
    animation.animationName = "bullet_2";
    animation.sound = "gun_1";
  } else if (abilityName.toLowerCase().includes("grenade")) {
    animation.animationName = "explosion_1";
    animation.sound = "explosive_1";
    animation.moveToDestination = false;
    animation.stretchToDestination = false;
    animation.destinationOnly = true;
  } else if (abilityName.toLowerCase().includes("gunpowder")) {
    animation.animationName = "explosion_1";
    animation.sound = "explosive_1";
    animation.moveToDestination = false;
    animation.stretchToDestination = false;
    animation.destinationOnly = true;
  } else if (abilityName.toLowerCase().includes("dynamite")) {
    animation.animationName = "explosion_1";
    animation.sound = "explosive_1";
    animation.moveToDestination = false;
    animation.stretchToDestination = false;
    animation.destinationOnly = true;
  } else if (abilityName.toLowerCase().includes("bomb")) {
    animation.animationName = "explosion_1";
    animation.sound = "explosive_1";
    animation.moveToDestination = false;
    animation.stretchToDestination = false;
    animation.destinationOnly = true;
  }

  if (!damage && !healing) {
    if (abilityName.match(/\bshield\b/i)) {
      animation.animationName = "shield_1";
      animation.sound = "healing_1";
    }
  }

  // Ray spells (Ray of Frost, Ray of Enfeeblement, Scorching Ray, etc.) and
  // Disintegrate always fire a stretched bolt_2 beam. Runs after the damage
  // block so it wins on the animation itself while keeping any damage-type
  // tint (hue/contrast/brightness).
  if (
    isRanged &&
    (abilityName.toLowerCase().match(/\bray\b/i) ||
      abilityName.toLowerCase().match(/\bdisintegrate\b/i))
  ) {
    animation.animationName = "bolt_2";
    animation.sound = "bolt_2";
    animation.moveToDestination = true;
    animation.stretchToDestination = true;
    if (damage.includes("fire")) {
      // Fire ray (e.g. Scorching Ray): the fire block above cleared the tint,
      // so give bolt_2 an orange-red fire hue.
      animation.hue = 16;
      animation.contrast = 1.0;
      animation.brightness = 0.6;
    } else if (abilityName.toLowerCase().includes("enfeeblement")) {
      // Ray of Enfeeblement deals no damage, so nothing above tints it — give
      // it a deep green cast.
      animation.hue = 128;
      animation.contrast = 1.0;
      animation.brightness = 0.3;
    }
  }

  if (!animation.animationName) {
    // If not a spell or ability, we can't determine an animation
    return null;
  }

  return animation;
}

function useFeat() {
  const featDataPath = getNearestParentDataPath(dataPath);
  const feat = api.getValue(featDataPath);
  useAction(feat);
}

function useAction(action) {
  const actionName = action?.name || "Unknown Action";
  const actions = action?.data?.actions || "";
  const actionType = action?.data?.actionType || "";
  let actionIcon = "";
  if (
    actions === "free" ||
    (actions === undefined && actionType === "action")
  ) {
    actionIcon = ":free-action:";
  } else if (actions === "oneAction") {
    actionIcon = ":one-action:";
  } else if (actions === "twoActions") {
    actionIcon = ":two-actions:";
  } else if (actions === "threeActions") {
    actionIcon = ":three-actions:";
  } else if (actions === "oneToTwoActions") {
    actionIcon = ":1-to-2:";
  } else if (actions === "oneToThreeActions") {
    actionIcon = ":1-to-3:";
  } else if (actions === "reaction") {
    actionIcon = ":reaction:";
  }

  const traits = action?.data?.traits || [];
  const tags = [];

  // Get all traits as tags
  traits.forEach((trait) => {
    // Ignore rarity traits
    if (getIsTraitRarity(trait)) {
      return;
    }
    tags.push({
      name: trait,
      tooltip: getTraitToolTip(trait),
    });
  });

  const actionDescription = updateDamageMacros(
    api.richTextToMarkdown(action?.data?.description || ""),
    { item: action },
  );

  let portrait = action?.portrait
    ? `![${actionName}](${assetUrl}${encodeURI(
        action?.portrait,
      )}?width=40&height=40) `
    : "";

  if (
    (portrait.includes("Action") || portrait.includes("Reaction")) &&
    actionIcon !== ""
  ) {
    // If the portrait is also an action icon, don't show it
    portrait = "";
  }

  const effectMacros = getEffectMacrosFor(action?.data?.effects || []);

  const message = `
#### ${portrait}${actionName}${actionIcon ? "&nbsp;" : ""}${actionIcon}

---
${actionDescription}
${effectMacros}
`;

  // Send the message
  api.sendMessage(message, undefined, [], tags);

  // Play animation if needed
  const ourToken = api.getToken();
  const targets = api.getTargets();
  const tokenId = ourToken?._id;
  const targetId = targets.length > 0 ? targets[0]?.token?._id : null;
  if (action?.data?.animation && tokenId) {
    api.playAnimation(action?.data?.animation, tokenId, targetId);
  }
}

/**
 * Set NPC attack damage fields based on damageRolls array
 * Creates a string representation of the damage (e.g., "1d6 piercing + 1 fire")
 * @param {Object} record - The NPC record (npcs/tokens) or individual NPC attack record (npc_attacks)
 */
function setNPCDamageFields(record) {
  if (!record) {
    return;
  }

  const valuesToSet = {};

  // Determine if this is an NPC/token record or an individual attack record
  const isNPCRecord =
    record.recordType === "npcs" || record.recordType === "tokens";
  const isAttackRecord = record.recordType === "npc_attacks";

  if (!isNPCRecord && !isAttackRecord) {
    return;
  }

  // Get attacks to process
  let attacks = [];
  if (isNPCRecord) {
    // Process all attacks on the NPC
    attacks = record.data?.attacks || [];
  } else if (isAttackRecord) {
    // Process just this single attack
    attacks = [{ attack: record, index: null }];
  }

  // Process each attack
  attacks.forEach((attackEntry, idx) => {
    const attack = isNPCRecord ? attackEntry : attackEntry.attack;
    const attackIndex = isNPCRecord ? idx : attackEntry.index;
    const damageRolls = attack.data?.damageRolls || [];

    // Build data path prefix based on whether we're processing an NPC or individual attack
    const pathPrefix = isNPCRecord ? `data.attacks.${attackIndex}.` : "";

    // Combine all damage rolls for the label (no category labels)
    const allDamageRolls = damageRolls;

    let damageString = "";
    if (allDamageRolls.length > 0) {
      const damageParts = allDamageRolls.map((roll) => {
        const formula = roll.data?.formula || "0";
        const type = roll.data?.type || "";
        return type ? `${formula} ${type}` : formula;
      });
      damageString = damageParts.join(" + ");
    }

    // Set the damage field
    if (damageString) {
      const damageLabel = `${damageString}`;
      if (attack.data?.damage !== damageLabel) {
        valuesToSet[`${pathPrefix}data.damage`] = damageLabel;
      }
      if (attack.fields?.damage?.hidden !== false) {
        valuesToSet[`${pathPrefix}fields.damage.hidden`] = false;
      }

      // Critical label is just "Critical"
      const criticalLabel = "Critical";
      if (attack.data?.critical !== criticalLabel) {
        valuesToSet[`${pathPrefix}data.critical`] = criticalLabel;
      }
      if (attack.fields?.critical?.hidden !== false) {
        valuesToSet[`${pathPrefix}fields.critical.hidden`] = false;
      }
    } else {
      if (attack.fields?.damage?.hidden !== true) {
        valuesToSet[`${pathPrefix}fields.damage.hidden`] = true;
      }
      if (attack.fields?.critical?.hidden !== true) {
        valuesToSet[`${pathPrefix}fields.critical.hidden`] = true;
      }
    }

    // Create tooltip strings
    const damageTooltip = damageString
      ? `Roll ${damageString} damage`
      : "No damage";
    const criticalTooltip = damageString
      ? `Roll 2 * (${damageString}) damage`
      : "No damage";

    if (attack.data?.damageTooltip !== damageTooltip) {
      valuesToSet[`${pathPrefix}data.damageTooltip`] = damageTooltip;
    }
    if (attack.data?.criticalTooltip !== criticalTooltip) {
      valuesToSet[`${pathPrefix}data.criticalTooltip`] = criticalTooltip;
    }
  });

  // Apply all updates at once
  if (Object.keys(valuesToSet).length > 0) {
    api.setValues(valuesToSet);
  }
}

/**
 * Helper function to get damage type, string, and modifiers for a weapon/spell/item
 * @returns {Object} - { damageType, damageString, damageMod, strikingRuneMod, deadlyDie, isMelee, isThrown, isPropulsive, hasDeathTrait, isSpell, isItem }
 */
function getWeaponDamageInfo(record, weapon) {
  // Check if this is an NPC attack
  const isNPCAttack = weapon.recordType === "npc_attacks";

  const isMelee = isNPCAttack
    ? (weapon.data?.weaponType || "melee").toLowerCase() === "melee" ||
      (weapon.data?.weaponType || "melee").toLowerCase() === "unarmed"
    : (weapon.data?.range || 0) === 0;
  const hasThrownTrait = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().startsWith("thrown"),
  );
  const hasDeathTrait = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().includes("death"),
  );

  // Handle NPC attacks with damageRolls array
  if (isNPCAttack) {
    const damageRolls = weapon.data?.damageRolls || [];

    // Build damage string from all standard damage rolls
    const standardRolls = damageRolls.filter(
      (roll) => !roll.data?.category || roll.data?.category === "standard",
    );
    const precisionRolls = damageRolls.filter(
      (roll) => roll.data?.category === "precision",
    );
    const splashRolls = damageRolls.filter(
      (roll) => roll.data?.category === "splash",
    );
    const persistentRolls = damageRolls.filter(
      (roll) => roll.data?.category === "persistent",
    );

    let damageString = "";
    let damageType = "";
    let splashDamage = 0;
    let splashDamageType = "";
    let persistentDamage = "";

    // Build main damage string from standard rolls
    if (standardRolls.length > 0) {
      const damageParts = standardRolls.map((roll) => {
        const formula = roll.data?.formula || "0";
        const type = roll.data?.type || "untyped";
        // Check for modifier field and add it to the formula
        let damagePart = `${formula} ${type}`;
        if (roll.data?.modifier !== undefined && roll.data?.modifier !== null) {
          const modifier = parseInt(roll.data.modifier, 10);
          if (!isNaN(modifier) && modifier !== 0) {
            // Add modifier to the damage string (e.g., "1d6 + 2 piercing")
            const modifierSign = modifier >= 0 ? "+" : "";
            damagePart = `${formula} ${modifierSign}${modifier} ${type}`;
          }
        }
        return damagePart;
      });
      damageString = damageParts.join(" + ");
      damageType = standardRolls[0].data?.type || "untyped";
    }

    // Handle splash damage
    if (splashRolls.length > 0) {
      const splashFormula = splashRolls[0].data?.formula || "0";
      splashDamageType = splashRolls[0].data?.type || damageType;
      // Check if it's a pure number or a dice formula
      const splashNumber = Number(splashFormula);
      if (!isNaN(splashNumber)) {
        // It's a pure number like "3"
        splashDamage = splashNumber;
      } else {
        // It's a dice formula like "1d4" or complex formula
        splashDamage = splashFormula;
      }
    }

    // Handle persistent damage
    if (persistentRolls.length > 0) {
      const persistentParts = persistentRolls.map((roll) => {
        const formula = roll.data?.formula || "0";
        const type = roll.data?.type || "untyped";
        return `${formula} ${type}`;
      });
      persistentDamage = persistentParts.join(", ");
    }

    // Check for deadly/fatal traits
    let deadlyDie = null;
    const deadlyTrait = weapon.data?.traits?.find((trait) =>
      trait.toLowerCase().startsWith("deadly"),
    );
    if (deadlyTrait) {
      const match = deadlyTrait.match(/deadly[\s\-]*(d\d+)/i);
      if (match) {
        deadlyDie = match[1].toLowerCase();
      }
    }

    let fatalDie = null;
    const fatalTrait = weapon.data?.traits?.find((trait) =>
      trait.toLowerCase().startsWith("fatal"),
    );
    if (fatalTrait) {
      const match = fatalTrait.match(/fatal[\s\-]*(d\d+)/i);
      if (match) {
        fatalDie = match[1].toLowerCase();
      }
    }

    // Calculate fatal damage string if fatal trait exists
    // Fatal changes ALL damage dice to the fatal die size
    let fatalDamageString = null;
    if (fatalDie && standardRolls.length > 0) {
      const fatalParts = standardRolls.map((roll) => {
        const formula = roll.data?.formula || "0";
        const type = roll.data?.type || "untyped";
        // Replace die size with fatal die (e.g., "2d6" becomes "2d10" if fatal d10)
        const fatalFormula = formula.replace(/d\d+/g, fatalDie);
        return `${fatalFormula} ${type}`;
      });
      fatalDamageString = fatalParts.join(" + ");
    }

    // NPCs don't add stat modifiers or have runes
    return {
      damageType,
      damageKind: "damage",
      damageString,
      damageMod: { name: "", value: 0, active: false, type: damageType },
      splashDamage,
      splashDamageType,
      persistentDamage,
      precisionDamage: precisionRolls,
      strikingRuneMod: null,
      deadlyDie,
      fatalDie,
      fatalDamageString,
      isMelee,
      isThrown: false,
      isPropulsive: false,
      hasDeathTrait,
      isSpell: false,
      isItem: false,
      isNPCAttack: true,
    };
  }

  // Check for two-hand trait and parse the die size
  // Format: "Two Hand d10", "Two-Hand d10", "Two-Hand-d10", "TwoHand d10", etc.
  let twoHandDie = null;
  const twoHandTrait = weapon.data?.traits?.find((trait) => {
    const normalized = trait.toLowerCase().replace(/[\s\-]+/g, "");
    return normalized.includes("twohand");
  });
  if (twoHandTrait) {
    // Match with optional spaces or hyphens between "two hand" and die size
    const match = twoHandTrait.match(/two[\s\-]*hand[\s\-]*(d\d+)/i);
    if (match) {
      twoHandDie = match[1].toLowerCase(); // e.g., "d10"
    }
  }

  const isSpell = weapon.recordType === "spells";
  const isItem =
    weapon.recordType === "items" && weapon.data?.type !== "weapon";
  const isThrown = hasThrownTrait && weapon.data?.rangeToggleBtn === "ranged";

  let isPropulsive = false;
  // If the weapon has the propulsive trait we only do half strength
  if (
    weapon.data?.traits?.some((trait) =>
      trait.toLowerCase().includes("propulsive"),
    )
  ) {
    isPropulsive = true;
  }

  // Check for deadly trait and parse the die size
  // Format: "Deadly d4", "Deadly d10", "Deadly-d10", etc.
  let deadlyDie = null;
  const deadlyTrait = weapon.data?.traits?.find((trait) =>
    trait.toLowerCase().startsWith("deadly"),
  );
  if (deadlyTrait) {
    // Match with optional space or hyphen between "deadly" and die size
    const match = deadlyTrait.match(/deadly[\s\-]*(d\d+)/i);
    if (match) {
      deadlyDie = match[1].toLowerCase(); // e.g., "d10"
    }
  }

  // Check for fatal trait the same way
  let fatalDie = null;
  const fatalTrait = weapon.data?.traits?.find((trait) =>
    trait.toLowerCase().startsWith("fatal"),
  );
  if (fatalTrait) {
    // Match with optional space or hyphen between "fatal" and die size
    const match = fatalTrait.match(/fatal[\s\-]*(d\d+)/i);
    if (match) {
      fatalDie = match[1].toLowerCase(); // e.g., "d10"
    }
  }

  let damageType =
    weapon.data?.damage.damageType || weapon.data?.damage.type || "";
  let kind = weapon.data?.damage.kind || "damage";
  let splashDamage = weapon.data?.splashDamage || 0;

  // If this is a versatile weapon and we have a different type, use that
  if (weapon.data?.versatilePiercing) {
    damageType = "piercing";
  } else if (weapon.data?.versatileBludgeoning) {
    damageType = "bludgeoning";
  } else if (weapon.data?.versatileSlashing) {
    damageType = "slashing";
  }

  // Get the damage modifier (STR/DEX)
  let damageMod = {
    name: "Strength",
    value: 0,
    active: true,
    type: damageType,
  };

  // If we add strength to the damage, add the strength modifier
  // Don't add for spells or non-weapon items
  if (!isSpell && !isItem && (isMelee || isThrown || isPropulsive)) {
    const isPositive = record.data?.str > 0;
    if (isPropulsive) {
      // Add half strength for propulsive weapons if positive, else add whole strength
      if (isPositive) {
        damageMod.value = Math.floor(record.data?.str / 2);
        damageMod.name = "Half Strength (Propulsive)";
      } else {
        damageMod.value = record.data?.str;
        damageMod.name = "Strength (Propulsive)";
      }
    } else {
      damageMod.value = record.data?.str;
    }
  }

  // Check for striking runes and create modifier
  // Striking runes add extra weapon damage dice of the same type
  const strikingRune = parseInt(weapon.data?.runes?.striking || "0", 10);
  let strikingRuneMod = null;

  if (strikingRune > 0 && weapon.data?.damage?.die) {
    const strikingNames = {
      1: "Striking",
      2: "Greater Striking",
      3: "Major Striking",
    };

    strikingRuneMod = {
      name: strikingNames[strikingRune] || "Striking",
      value: `${strikingRune}${weapon.data.damage.die}`,
      active: true,
      type: damageType,
      valueType: "string",
    };
  }

  const damageFormula = weapon.data?.damage?.formula;
  let damageDie = weapon.data?.damage.die;
  if (twoHandDie && weapon.data?.handBtn === "two") {
    damageDie = twoHandDie;
  }
  let numDice = weapon.data?.damage.dice;

  let damageString = `${numDice}${damageDie} ${damageType}`;
  const fatalDamageString = fatalDie
    ? `${numDice}${fatalDie} ${damageType}`
    : null;

  if (!numDice && damageFormula) {
    damageString = damageFormula;
  }

  return {
    damageType,
    damageKind: kind,
    damageString,
    damageMod,
    splashDamage,
    strikingRuneMod,
    deadlyDie,
    fatalDie,
    fatalDamageString,
    isMelee,
    isThrown,
    isPropulsive,
    hasDeathTrait,
    isSpell,
    isItem,
  };
}

/**
 * Extracts the scatter radius from weapon traits.
 * Scatter trait format: "Scatter-10", "Scatter 10", "scatter-5", etc.
 *
 * @param {Array} traits - Array of trait strings
 * @returns {number} - The scatter radius in feet, or 0 if no scatter trait
 */
function getScatterRadiusFromTraits(traits) {
  if (!traits || !Array.isArray(traits)) return 0;

  for (const trait of traits) {
    const traitLower = trait.toLowerCase();
    // Match "scatter-10" or "scatter 10"
    const match = traitLower.match(/\bscatter[-\s](\d+)\b/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 0;
}

/**
 * Counts the total number of weapon damage dice including base dice and striking runes.
 * Used for calculating scatter weapon splash damage.
 *
 * @param {Object} weapon - The weapon object
 * @param {number} strikingRune - The striking rune level (0-3)
 * @returns {number} - Total number of weapon damage dice
 */
function countWeaponDamageDice(weapon, strikingRune) {
  const isNPCAttack = weapon.recordType === "npc_attacks";

  if (isNPCAttack) {
    // For NPC attacks, count dice from all standard damage rolls
    const damageRolls = weapon.data?.damageRolls || [];
    const standardRolls = damageRolls.filter(
      (roll) => !roll.data?.category || roll.data?.category === "standard",
    );

    let totalDice = 0;
    standardRolls.forEach((roll) => {
      const formula = roll.data?.formula || "0";
      // Match XdY patterns and sum up the X values
      const diceMatches = formula.matchAll(/(\d+)d\d+/g);
      for (const match of diceMatches) {
        totalDice += parseInt(match[1], 10);
      }
    });

    return totalDice;
  }

  // For PC weapons, get base dice and add striking rune dice
  const baseDice = parseInt(weapon.data?.damage?.dice || "1", 10);
  const strikingDice = parseInt(strikingRune || "0", 10);

  return baseDice + strikingDice;
}

/**
 * Activates Sneak Attack modifiers if conditions are met.
 * Sneak Attack applies when:
 * - Target has the off-guard condition
 * - AND you're using an agile/finesse melee weapon, agile/finesse unarmed attack,
 *   ranged weapon attack, or ranged unarmed attack
 *
 * @param {Array} modifiers - Array of damage modifiers
 * @param {Object} weapon - The weapon being used
 * @param {boolean} targetIsOffGuard - Whether the target has the off-guard condition
 * @returns {Array} - Modified array with sneak attack modifiers activated if conditions met
 */
function activateSneakAttackIfConditionsMet(
  modifiers,
  weapon,
  targetIsOffGuard,
) {
  if (!targetIsOffGuard) {
    return modifiers; // No sneak attack if target is not off-guard
  }

  // Check weapon properties
  const isMelee = (weapon.data?.range || 0) === 0;
  const traits = weapon.data?.traits || [];

  const hasAgileTrait = traits.some((trait) =>
    trait.toLowerCase().includes("agile"),
  );
  const hasFinesseTrait = traits.some((trait) =>
    trait.toLowerCase().includes("finesse"),
  );

  // Determine if sneak attack conditions are met
  let sneakAttackApplies = false;

  if (isMelee) {
    // Melee: must have agile or finesse trait
    sneakAttackApplies = hasAgileTrait || hasFinesseTrait;
  } else {
    // Ranged: always applies (ranged weapon or ranged unarmed)
    sneakAttackApplies = true;
  }

  if (!sneakAttackApplies) {
    return modifiers; // Conditions not met
  }

  // Activate all "sneak attack" modifiers
  return modifiers.map((mod) => {
    const modName = (mod.name || "").toLowerCase();
    if (modName.includes("sneak attack")) {
      return {
        ...mod,
        active: true,
      };
    }
    return mod;
  });
}

function collectFeatures(record) {
  // Collect all features from ancestries, heritages, classes, feats, and inventory
  const features = [];
  const ancestries = record.data?.ancestries || [];
  const heritages = record.data?.heritages || [];
  const classes = record.data?.classes || [];
  const feats = record.data?.feats || [];
  const bonusFeats = record.data?.bonusFeats || [];
  const characterFeatures = record.data?.features || [];

  // Collect features from ancestries
  for (const ancestry of ancestries) {
    features.push(...(ancestry.data?.features || []));
  }

  // Collect features from heritages
  for (const heritage of heritages) {
    features.push(...(heritage.data?.features || []));
  }

  // Collect features from classes
  for (const classObj of classes) {
    const level = record.data?.level || 0;
    const classFeatures = classObj.data?.features || [];
    classFeatures.forEach((feature) => {
      const featureLevel = feature.data?.level || 0;
      if (featureLevel <= level) {
        features.push(feature);
      }
    });
  }

  // Add feats and character features
  features.push(...feats);
  features.push(...bonusFeats);
  features.push(...characterFeatures);

  // Check equipped items for proficiency bonuses
  const items = Array.isArray(record.data?.inventory)
    ? record.data.inventory
    : [];
  const requiresInvestment = (item) => {
    const traits = item.data?.traits || [];
    return traits.map((trait) => trait.toLowerCase()).includes("invested");
  };
  const equippedItems = items.filter(
    (item) =>
      item.data?.carried === "equipped" &&
      (!requiresInvestment(item) || item.data?.invested === "true"),
  );
  features.push(...equippedItems);
  return features;
}

function getProfiencyForArmor(record, armorCategory, armorGroup) {
  // First check proficiency for the armor category
  let armorProf = parseInt(record?.data?.defenses?.[armorCategory] || "0", 10);

  const features = collectFeatures(record);

  // Check all features for armor group-specific proficiencies
  for (const feature of features) {
    const featureProficiencies = feature.data?.proficiencies || [];
    featureProficiencies.forEach((proficiency) => {
      const name = (proficiency?.data?.name || "").toLowerCase();
      const rank = parseInt(proficiency?.data?.rank || "0", 10);
      const field = (proficiency?.data?.field || "").toLowerCase();

      // Check if this proficiency matches the armor category and has a field matching the armor group
      if (
        name === armorCategory.toLowerCase() &&
        field &&
        field === armorGroup.toLowerCase() &&
        rank > armorProf
      ) {
        armorProf = rank;
      }
    });
  }

  return armorProf;
}

function getProfiencyForWeapon(
  record,
  weaponCategory,
  weaponGroup,
  weapon = null,
) {
  // First check proficiency for the weapon category
  let weaponProficiency = parseInt(
    record.data?.attackProficiencies?.[weaponCategory] || "0",
    10,
  );

  // Check if "other" attack proficiency applies to this weapon
  const otherProf = record.data?.attackProficiencies?.other;
  if (otherProf?.name && otherProf?.rank) {
    const otherRank = parseInt(otherProf.rank || "0", 10);

    // Get weapon name from weapon parameter or fall back to checking by group
    const weaponName = (weapon?.data?.name || weapon?.name || "").toLowerCase();
    const weaponGroupLower = (weaponGroup || "").toLowerCase();
    const weaponCategoryLower = (weaponCategory || "").toLowerCase();

    // Split by comma to handle multiple proficiencies like "Simple Firearms, Martial Firearms"
    const otherNames = otherProf.name
      .split(",")
      .map((n) => n.trim().toLowerCase());

    let otherMatches = false;

    for (const otherName of otherNames) {
      // Special case: "Alchemical Bombs" matches weapons with group "Bomb"
      if (otherName === "alchemical bombs") {
        if (weaponGroupLower === "bomb") {
          otherMatches = true;
          break;
        }
      }
      // Check for category + group patterns like "Simple Firearms" or "Martial Firearms"
      // This matches if the proficiency name starts with the weapon category and
      // the weapon group matches the rest (e.g., "simple firearms" matches simple category + firearm group)
      else if (otherName.startsWith(weaponCategoryLower + " ")) {
        const expectedGroup = otherName.substring(
          weaponCategoryLower.length + 1,
        );
        // Handle plurals (e.g., "firearms" -> "firearm")
        const normalizedExpectedGroup = expectedGroup.endsWith("s")
          ? expectedGroup.slice(0, -1)
          : expectedGroup;
        const normalizedWeaponGroup = weaponGroupLower.endsWith("s")
          ? weaponGroupLower.slice(0, -1)
          : weaponGroupLower;
        if (normalizedWeaponGroup === normalizedExpectedGroup) {
          otherMatches = true;
          break;
        }
      }
      // Otherwise check if weapon name contains the proficiency name
      else if (weaponName.includes(otherName)) {
        otherMatches = true;
        break;
      }
    }

    if (otherMatches && otherRank > weaponProficiency) {
      weaponProficiency = otherRank;
    }
  }

  // Then check if we have any features or class features that provide a proficiency for this weapon group
  const features = collectFeatures(record);

  // Check all features for weapon group-specific proficiencies
  for (const feature of features) {
    const featureProficiencies = feature.data?.proficiencies || [];
    featureProficiencies.forEach((proficiency) => {
      const name = (proficiency?.data?.name || "").toLowerCase();
      const rank = parseInt(proficiency?.data?.rank || "0", 10);
      const field = (proficiency?.data?.field || "").toLowerCase();

      // Check if this proficiency matches the weapon category and has a field matching the weapon group
      if (
        name === weaponCategory.toLowerCase() &&
        field &&
        field === weaponGroup.toLowerCase() &&
        rank > weaponProficiency
      ) {
        weaponProficiency = rank;
      }
    });
  }

  // Check for weaponProficiency modifiers from effects/features
  // These use predicates to match specific weapons (e.g., martial firearms, crossbows)
  if (weapon) {
    const weaponProfMods = getEffectsAndModifiersForToken(
      record,
      ["weaponProficiency"],
      "",
      undefined,
      undefined,
      { item: weapon },
    );

    for (const mod of weaponProfMods) {
      // Skip inactive modifiers (predicate failed)
      if (mod.active === false) continue;

      const modRank = parseInt(mod.value || "0", 10);
      if (modRank > weaponProficiency) {
        weaponProficiency = modRank;
      }
    }
  }

  return weaponProficiency;
}

/**
 * Evaluates a predicate string for game mechanics.
 * Supports predicates like:
 * - gte(item:proficiency:rank, 3)
 * - target:condition:off-guard
 * - item:trait:agile
 * - and(...), or(...) for combining conditions
 *
 * @param {string} predicate - The predicate string to evaluate
 * @param {Object} record - The character record
 * @param {Object} item - The item (weapon, armor, etc.) being evaluated
 * @param {Object} targetIsOffGuard - True if the target is off guard (optional)
 * @param {Set} traits - Optional set of collected traits to check against
 * @returns {boolean} - True if predicate is satisfied
 */
function evaluatePredicate(
  predicate,
  record,
  item,
  targetIsOffGuard = false,
  traits = null,
) {
  if (!predicate || typeof predicate !== "string") {
    console.warn("evaluatePredicate: invalid predicate", predicate);
    return false;
  }

  // Safety check for required parameters
  if (!record || !item) {
    console.warn("evaluatePredicate: missing record or item parameter");
    return false;
  }

  // If traits set is provided, check if the predicate exists directly in traits
  // This allows predicates like "feat:raging-thrower" to match collected traits
  if (traits && traits.has(predicate)) {
    return true;
  }

  // Helper to check if item has a trait
  const hasItemTrait = (traitName) => {
    if (!item || !item.data) return false;
    const traits = item.data?.traits || [];
    return traits.some((trait) =>
      trait.toLowerCase().includes(traitName.toLowerCase()),
    );
  };

  // Helper to get item proficiency rank (for weapons/armor)
  const getItemProficiencyRank = () => {
    if (!item || !item.data) return 0;

    const itemCategory = (item.data.itemCategory || "simple").toLowerCase();
    const itemGroup = (item.data.group || "").toLowerCase();

    // Check if this is armor or weapon
    const armorCategories = ["unarmored", "light", "medium", "heavy"];
    if (armorCategories.includes(itemCategory)) {
      return getProfiencyForArmor(record, itemCategory, itemGroup);
    } else {
      // Default to weapon proficiency
      return getProfiencyForWeapon(record, itemCategory, itemGroup, item);
    }
  };

  // Replace predicate variables with actual values
  let evaluatedPredicate = predicate;

  try {
    // Handle item:proficiency:rank
    if (evaluatedPredicate.includes("item:proficiency:rank")) {
      const profRank = getItemProficiencyRank();
      evaluatedPredicate = evaluatedPredicate.replace(
        /item:proficiency:rank/g,
        String(profRank),
      );
    }

    // Handle target:condition:off-guard
    // Check both the targetIsOffGuard parameter AND if traits set includes it
    if (evaluatedPredicate.includes("target:condition:off-guard")) {
      const offGuardFromTraits =
        traits && traits.has("target:condition:off-guard");
      const offGuardValue = targetIsOffGuard || offGuardFromTraits ? "1" : "0";
      evaluatedPredicate = evaluatedPredicate.replace(
        /target:condition:off-guard/g,
        offGuardValue,
      );
    }

    // Handle item:trait:X patterns
    // Convert iterator to array to avoid issues when modifying the string
    const traitMatches = Array.from(
      evaluatedPredicate.matchAll(/item:trait:(\w+)/g),
    );
    for (const match of traitMatches) {
      const traitName = match[1];
      const hasTrait = hasItemTrait(traitName);
      evaluatedPredicate = evaluatedPredicate.replace(
        match[0],
        hasTrait ? "1" : "0",
      );
    }

    // Handle item:category:X patterns (e.g., item:category:martial, item:category:simple)
    const categoryMatches = Array.from(
      evaluatedPredicate.matchAll(/item:category:(\w+)/g),
    );
    for (const match of categoryMatches) {
      const categoryName = match[1].toLowerCase();
      const itemCategory = (item.data?.itemCategory || "").toLowerCase();
      const hasCategory = itemCategory === categoryName;
      evaluatedPredicate = evaluatedPredicate.replace(
        match[0],
        hasCategory ? "1" : "0",
      );
    }

    // Handle item:group:X patterns (e.g., item:group:firearm, item:group:crossbow)
    const groupMatches = Array.from(
      evaluatedPredicate.matchAll(/item:group:(\w+)/g),
    );
    for (const match of groupMatches) {
      const groupName = match[1].toLowerCase();
      const itemGroup = (item.data?.group || "").toLowerCase();
      const hasGroup = itemGroup === groupName;
      evaluatedPredicate = evaluatedPredicate.replace(
        match[0],
        hasGroup ? "1" : "0",
      );
    }

    // Handle origin:X patterns
    // TODO: Implement proper origin predicate evaluation
    // For now, we ignore origin predicates by treating them as true (1)
    // Origin predicates reference properties of the entity that created/applied the effect
    const originMatches = Array.from(
      evaluatedPredicate.matchAll(/origin:[\w:]+/g),
    );
    for (const match of originMatches) {
      evaluatedPredicate = evaluatedPredicate.replace(match[0], "1");
    }

    // Handle item:tag:X patterns
    // TODO: Implement proper item tag evaluation
    // For now, we treat item:tag predicates as true (1) since we don't support tags yet
    const tagMatches = Array.from(
      evaluatedPredicate.matchAll(/item:tag:[\w-]+/g),
    );
    for (const match of tagMatches) {
      evaluatedPredicate = evaluatedPredicate.replace(match[0], "1");
    }
  } catch (error) {
    console.error("Error in evaluatePredicate variable replacement:", error);
    console.error("Predicate:", predicate);
    console.error("Item:", item);
    return false;
  }

  // Now we need to handle logical operators: and(...), or(...)
  // Process from innermost to outermost

  // Helper to recursively evaluate logical functions from innermost to outermost
  const evaluateLogicalFunctions = (str) => {
    let result = str;
    let changed = true;

    // Keep processing until no more changes occur
    while (changed) {
      changed = false;
      const previousResult = result;

      // Find innermost and/or functions (those with no nested functions in args)
      // Process both and() and or() in the same pass
      const andRegex = /and\(([^()]+)\)/g;
      const orRegex = /or\(([^()]+)\)/g;

      // Replace all innermost and() functions
      result = result.replace(andRegex, (match, argsStr) => {
        const args = argsStr.split(",").map((arg) => arg.trim());
        // Verify all arguments are numeric
        const allNumeric = args.every((arg) => !isNaN(parseFloat(arg)));
        if (!allNumeric) return match; // Skip if not all numeric

        const allTrue = args.every((arg) => {
          const num = parseFloat(arg);
          return !isNaN(num) && num !== 0;
        });
        return allTrue ? "1" : "0";
      });

      // Replace all innermost or() functions
      result = result.replace(orRegex, (match, argsStr) => {
        const args = argsStr.split(",").map((arg) => arg.trim());
        // Verify all arguments are numeric
        const allNumeric = args.every((arg) => !isNaN(parseFloat(arg)));
        if (!allNumeric) return match; // Skip if not all numeric

        const anyTrue = args.some((arg) => {
          const num = parseFloat(arg);
          return !isNaN(num) && num !== 0;
        });
        return anyTrue ? "1" : "0";
      });

      // Check if anything changed
      if (result !== previousResult) {
        changed = true;
      }
    }

    return result;
  };

  try {
    // Evaluate all logical functions (handles nesting recursively)
    evaluatedPredicate = evaluateLogicalFunctions(evaluatedPredicate);

    // Now use the existing evaluateFormula to handle comparison functions like gte, lt, etc.
    evaluatedPredicate = evaluateFormula(evaluatedPredicate);

    // Final result: check if the predicate evaluates to a truthy value
    const result = parseFloat(evaluatedPredicate);

    return !isNaN(result) && result !== 0;
  } catch (error) {
    console.error("Error in evaluatePredicate logical evaluation:", error);
    console.error("Predicate at error:", evaluatedPredicate);
    return false;
  }
}

/**
 * Checks if the character has a critical specialization effect for the given item.
 * Critical specialization requires:
 * - A feature with a "criticalSpecialization" modifier
 * - The modifier's field predicate must evaluate to true
 *
 * @param {Object} record - The character record
 * @param {Object} item - The item (typically a weapon) being used
 * @param {Object} targetIsOffGuard - True if the target is off guard (optional)
 * @returns {boolean} - True if critical specialization effect applies
 */
function hasCriticalSpecializationEffect(
  record,
  item,
  targetIsOffGuard = false,
) {
  const features = collectFeatures(record);

  // Check all features for criticalSpecialization modifiers
  for (const feature of features) {
    const modifiers = feature.data?.modifiers || [];
    for (const modifier of modifiers) {
      const modifierType = modifier.data?.type || "";
      const predicateField = modifier.data?.field || "";
      const predicate = modifier.data?.predicate || "";

      // Check if this is a criticalSpecialization modifier
      if (modifierType.toLowerCase() === "criticalspecialization") {
        // Evaluate the predicate
        // If the predicate is just a category or group that matches the item, return true
        if (
          predicateField &&
          (predicateField.toLowerCase() === item.data?.group?.toLowerCase() ||
            predicateField.toLowerCase() ===
              item.data?.itemCategory?.toLowerCase())
        ) {
          return true;
        }

        // Check if we have a predicate to evaluate
        if (predicate) {
          // Build context for predicate evaluation
          const context = { weapon: item, item: item };

          // Add target conditions if target is off-guard
          if (targetIsOffGuard) {
            // Create a mock target with off-guard effect for trait collection
            context.target = {
              effects: [{ name: "Off-Guard" }],
            };
          }

          // Collect traits for evaluation
          const traits = collectTraitsAndProperties(record, context);

          // Try to parse as JSON predicate (new format)
          const parsedPredicate = parseModifierPredicate(predicate);
          if (parsedPredicate && parsedPredicate.length > 0) {
            // Evaluate using the new JSON predicate system
            const predicateResult = evaluateEffectPredicate(
              parsedPredicate,
              traits,
              record,
              context,
            );

            if (predicateResult) {
              return true;
            }
          } else {
            // Fall back to old string-based evaluation
            if (
              evaluatePredicate(
                predicate,
                record,
                item,
                targetIsOffGuard,
                traits,
              )
            ) {
              return true;
            }
          }
        } else if (predicateField) {
          // Build context for predicate evaluation
          const context = { weapon: item, item: item };
          if (targetIsOffGuard) {
            context.target = {
              effects: [{ name: "Off-Guard" }],
            };
          }

          // Collect traits for evaluation
          const traits = collectTraitsAndProperties(record, context);

          // Try old predicate field evaluation
          if (
            evaluatePredicate(
              predicateField,
              record,
              item,
              targetIsOffGuard,
              traits,
            )
          ) {
            return true;
          }
        } else {
          // If we don't have a predicate just assume it's for all weapons
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Checks if the character has a armor specialization effect for the given item.
 * Armor specialization requires:
 * - A feature with a "armorSpecialization" modifier
 * - The modifier's field predicate must evaluate to true
 *
 * @param {Object} record - The character record
 * @param {Object} item - The item (typically armor) that is equipped
 * @returns {boolean} - True if critical specialization effect applies
 */
function hasArmorSpecializationEffect(record, item) {
  const features = collectFeatures(record);

  // Only applies to medium or heavy armor
  if (
    item.data?.itemCategory?.toLowerCase() !== "medium" &&
    item.data?.itemCategory?.toLowerCase() !== "heavy"
  ) {
    return false;
  }

  // Collect traits for predicate evaluation
  const context = { item: item, armor: item };
  const traits = collectTraitsAndProperties(record, context);

  // Check all features for criticalSpecialization modifiers
  for (const feature of features) {
    const modifiers = feature.data?.modifiers || [];
    for (const modifier of modifiers) {
      const modifierType = modifier.data?.type || "";
      const predicate = modifier.data?.field || "";
      const predicateField = modifier.data?.field || "";

      // Check if this is a criticalSpecialization modifier
      if (modifierType.toLowerCase() === "armorspecialization") {
        // Evaluate the predicate
        // If the predicate is just a category or group that matches the item, return true
        if (
          predicateField &&
          (predicateField.toLowerCase() === item.data?.group?.toLowerCase() ||
            predicateField.toLowerCase() ===
              item.data?.itemCategory?.toLowerCase())
        ) {
          return true;
        } else if (
          // Otherwise evaluate the predicate
          ((predicate || predicateField) &&
            evaluatePredicate(predicate, record, item, false, traits)) ||
          evaluatePredicate(predicateField, record, item, false, traits)
        ) {
          return true;
        } else if (!predicate) {
          // If we don't have a predicate just assume it's for all weapons
          return true;
        }
      }
    }
  }

  return false;
}

function performAttackRoll(record, weapon, weaponDataPath, attackNumber = 1) {
  const valuesToSet = {};

  // Check if this is an NPC attack
  const isNPCAttack = weapon.recordType === "npc_attacks";
  const isSpell = weapon.recordType === "spells";

  // Helper function to get range from NPC attack traits
  function getRangeFromTraits(traits) {
    if (!traits || !Array.isArray(traits)) return 0;

    let thrownRange = 0;

    for (const trait of traits) {
      const traitLower = trait.toLowerCase();
      // Priority 1: Match "range-increment-60" or "range increment 60"
      let match = traitLower.match(/range[-\s]increment[-\s](\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }

      // Priority 2: Check for "thrown-10" or "thrown 10" (save for later if no range-increment)
      match = traitLower.match(/\bthrown[-\s](\d+)\b/);
      if (match && !thrownRange) {
        thrownRange = parseInt(match[1], 10);
      }

      // Priority 3: Match just "range-60" or "range 60"
      match = traitLower.match(/\brange[-\s](\d+)\b/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    // Return thrown range if found, otherwise 0
    return thrownRange;
  }

  // Helper function to get volley range from traits
  // Volley weapons take a -2 penalty when attacking targets within the specified range
  function getVolleyRangeFromTraits(traits) {
    if (!traits || !Array.isArray(traits)) return 0;

    for (const trait of traits) {
      const traitLower = trait.toLowerCase();
      // Match "volley-30" or "volley 30"
      const match = traitLower.match(/\bvolley[-\s](\d+)\b/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  const isMelee = isNPCAttack
    ? (weapon.data?.weaponType || "melee").toLowerCase() === "melee" ||
      (weapon.data?.weaponType || "melee").toLowerCase() === "unarmed"
    : (weapon.data?.range || 0) === 0;
  const hasThrownTrait = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().startsWith("thrown"),
  );
  const hasFinesseTrait = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().includes("finesse"),
  );
  const hasAgileTrait = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().includes("agile"),
  );
  const range = weapon.data?.range || getRangeFromTraits(weapon.data?.traits);
  const volleyRange = getVolleyRangeFromTraits(weapon.data?.traits);
  const hasReachTrait = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().includes("reach"),
  );

  // Create a list of all traits as tags that we'll add to the roll message
  const traits = weapon.data?.traits || [];
  const damageCategories = [];

  // Create a list of all runes as tags that we'll add to the roll message
  const runes = weapon.data?.runes?.property || [];

  // Check if weapon has any runes, add "non-magical" trait if it does not or does not have a magic trait
  const hasMagicalTrait = traits.some(
    (trait) =>
      trait.toLowerCase().includes("magical") ||
      trait.toLowerCase().includes("arcane") ||
      trait.toLowerCase().includes("divine") ||
      trait.toLowerCase().includes("occult") ||
      trait.toLowerCase().includes("primal"),
  );
  const hasRunes =
    runes.length > 0 ||
    !!weapon.data?.runes?.potency ||
    !!weapon.data?.runes?.striking;

  if (!hasMagicalTrait && !hasRunes) {
    damageCategories.push("non-magical");
  }

  runes.forEach((rune) => {
    // Format runes like "Ghost Touch" to "ghost-touch"
    damageCategories.push(rune.toLowerCase().replace(/ /g, "-"));
  });

  // Add material type if present (e.g., "cold-iron", "silver", "adamantine")
  if (weapon.data?.material?.type) {
    const materialType = weapon.data.material.type
      .toLowerCase()
      .trim()
      .replace(/ /g, "-");
    if (materialType) {
      damageCategories.push(materialType);
    }
  }

  let reach = getTokenReach(record, weapon);

  const isThrown = hasThrownTrait && weapon.data?.rangeToggleBtn === "ranged";
  const requiresReload =
    !isNPCAttack && (weapon.data?.reload || 0) > 0 && !isMelee;

  if (requiresReload && !weapon.data?.loadedAmmo) {
    api.showNotification("You need to reload first!", "red", "Out of Ammo");
    return;
  }

  let abilityScore = "str";
  let damageScore = "";
  let addStrengthToDamage = true;
  let isPropulsive = false;
  // If the weapon has the propulsive trait we only do half strength
  if (
    weapon.data?.traits?.some((trait) =>
      trait.toLowerCase().includes("propulsive"),
    )
  ) {
    isPropulsive = true;
  }

  // Bombs and thrown weapons don't use ammo select
  const isBomb = !isNPCAttack && weapon?.data?.group?.toLowerCase() === "bomb";

  if (!isNPCAttack && (isThrown || !isMelee)) {
    // Thrown and ranged always use dex
    abilityScore = "dex";
    // Only if thrown
    addStrengthToDamage = isThrown;
    // Check if we have enough ammo
    const ammo = weapon.data?.ammo || 0;
    if (ammo <= 0) {
      api.showNotification("You are out of ammo!", "red", "Out of Ammo");
      return;
    }

    // Deduct ammo for all weapons that are using this, as well as the item itself
    let ammoSelected = weapon.data?.ammoSelect;
    if (isBomb || isThrown) {
      // In this case, we just use the weapon itself as the ammo selected
      ammoSelected = weapon._id;
    }

    const expend = parseInt(weapon.data?.expend || "1", 10) || 1; // Default to 1 if 0 or undefined

    // Get the ammo item to check for uses system
    let ammoItem = null;
    let newAmmoCount = 0;
    let newUsesValue = 0;
    let needsReload = false; // Track if we need to reload (consumed a full shot)

    if (ammoSelected) {
      const inventory = record.data?.inventory || [];
      ammoItem = inventory.find((item) => item._id === ammoSelected);
    } else {
      ammoItem = weapon;
    }

    // Calculate the new ammo count and uses value once
    if (ammoItem) {
      const usesMax = parseInt(ammoItem.data?.uses?.max || "0", 10);
      const usesValue = parseInt(
        ammoItem.data?.uses?.value || (usesMax > 0 ? usesMax : "0"),
        10,
      );

      if (usesMax <= 1) {
        // No uses system or single-use, just deduct count
        newAmmoCount = Math.max(0, ammo - expend);
        newUsesValue = 0;
        needsReload = true; // Always need reload if no uses system
      } else {
        // Multi-use system
        const newValue = usesValue - expend;

        if (newValue > 0) {
          // Still have uses left on current item
          newAmmoCount = ammo;
          newUsesValue = newValue;
          needsReload = false; // Don't need reload, still have uses
        } else if (newValue === 0) {
          // Exactly used up this item, deduct count and reset to max
          newAmmoCount = Math.max(0, ammo - 1);
          newUsesValue = usesMax;
          needsReload = true; // Need reload, consumed full item
        } else {
          // Went negative, deduct count and calculate carry-over
          const countToDeduct = Math.ceil(Math.abs(newValue) / usesMax);
          newAmmoCount = Math.max(0, ammo - countToDeduct);
          const remainder = Math.abs(newValue) % usesMax;
          newUsesValue = remainder > 0 ? usesMax - remainder : usesMax;
          needsReload = true; // Need reload, consumed full item(s)
        }
      }
    } else {
      // Fallback if no ammo item found
      newAmmoCount = Math.max(0, ammo - expend);
      newUsesValue = 0;
      needsReload = true;
    }

    // Apply the calculated values to all relevant items
    if (ammoSelected) {
      const inventory = record.data?.inventory || [];
      inventory.forEach((item, index) => {
        if (item._id === ammoSelected) {
          // Update the ammo item itself
          valuesToSet[`data.inventory.${index}.data.count`] = newAmmoCount;
          valuesToSet[`data.inventory.${index}.data.ammo`] = newAmmoCount;
          const usesMax = parseInt(item.data?.uses?.max || "0", 10);
          if (usesMax > 1) {
            valuesToSet[`data.inventory.${index}.data.uses.value`] =
              newUsesValue;
          }
        }
        if (item.data?.ammoSelect === ammoSelected) {
          // Update all weapons using this ammo
          valuesToSet[`data.inventory.${index}.data.ammo`] = newAmmoCount;
          const usesMax = parseInt(ammoItem?.data?.uses?.max || "0", 10);
          if (usesMax > 1) {
            valuesToSet[`data.inventory.${index}.data.uses.value`] =
              newUsesValue;
            valuesToSet[`data.inventory.${index}.data.uses.max`] = usesMax;
          }
          // If weapon requires reloading and we consumed a shot, set loadedAmmo to false
          if (requiresReload && needsReload) {
            valuesToSet[`data.inventory.${index}.data.loadedAmmo`] = false;
          }
        }
      });
    } else {
      // No ammo selected, update weapon itself
      valuesToSet[`${weaponDataPath}.data.ammo`] = newAmmoCount;
      const usesMax = parseInt(weapon.data?.uses?.max || "0", 10);
      if (usesMax > 1) {
        valuesToSet[`${weaponDataPath}.data.uses.value`] = newUsesValue;
      }
    }

    // If this weapon requires reloading and we consumed a shot, set loadedAmmo to false
    if (requiresReload && needsReload) {
      valuesToSet[`${weaponDataPath}.data.loadedAmmo`] = false;
    }
  } else if (
    hasFinesseTrait &&
    (record.data?.dex || 0) > (record.data?.str || 0)
  ) {
    // If melee, and has finesse trait, use dex if it's higher than str
    abilityScore = "dex";
  }

  // Get weapon damage info using helper function
  const weaponDamageInfo = getWeaponDamageInfo(record, weapon);
  const damageType = weaponDamageInfo.damageType;
  const damage = weaponDamageInfo.damageString;
  let splashDamage = weaponDamageInfo.splashDamage;
  let splashDamageType = weaponDamageInfo.splashDamageType || damageType;
  const fatalDamageString = weaponDamageInfo.fatalDamageString;
  const hasDeathTraitFromHelper = weaponDamageInfo.hasDeathTrait;
  const strikingRuneMod = weaponDamageInfo.strikingRuneMod;
  const deadlyDie = weaponDamageInfo.deadlyDie;
  const fatalDie = weaponDamageInfo.fatalDie;

  let targetShieldRaised = false;
  const damageIsPhysical = ["bludgeoning", "piercing", "slashing"].includes(
    damageType.toLowerCase(),
  );

  // Check for persistent damage
  let persistentDamage = "";
  if (isNPCAttack) {
    // For NPC attacks, persistent damage comes from weaponDamageInfo
    persistentDamage = weaponDamageInfo.persistentDamage || "";
  } else {
    // For PC weapons, calculate from damage.persistent structure
    const persistentDamageNumber = weapon.data?.damage?.persistent?.number || 0;
    const persistentDie = weapon.data?.damage?.persistent?.faces
      ? `d${weapon.data?.damage?.persistent?.faces}`
      : "";
    const persistentType = weapon.data?.damage?.persistent?.type || "acid";
    persistentDamage =
      persistentDamageNumber > 0
        ? `${persistentDamageNumber}${persistentDie} ${persistentType}`
        : "";
  }

  // Check for Scatter trait and calculate scatter splash damage
  // Scatter weapons deal splash damage equal to 1 point per weapon damage die
  const scatterRadius = getScatterRadiusFromTraits(traits);

  if (scatterRadius > 0) {
    // Get the striking rune level to count total dice
    const strikingRune = parseInt(weapon.data?.runes?.striking || "0", 10);
    const totalDice = countWeaponDamageDice(weapon, strikingRune);

    if (totalDice > 0) {
      // Add scatter splash to existing splash damage
      const existingSplash =
        typeof splashDamage === "number"
          ? splashDamage
          : parseInt(splashDamage, 10) || 0;
      splashDamage = existingSplash + totalDice;
      if (!splashDamageType) {
        splashDamageType = damageType;
      }
    }
  }

  // Override damageMod logic for attack roll (uses addStrengthToDamage flag)
  let damageMod = {
    ...weaponDamageInfo.damageMod,
  };

  // In attack rolls, we use addStrengthToDamage instead of the helper's logic
  if (isMelee || addStrengthToDamage || isPropulsive) {
    const isPositive = record.data?.str > 0;
    damageScore = "str";
    if (isPropulsive) {
      // Add half strength for propulsive weapons if positive, else add whole strength
      if (isPositive) {
        damageMod.value = Math.floor(record.data?.str / 2);
        damageMod.name = "Half Strength (Propulsive)";
      } else {
        damageMod.value = record.data?.str;
        damageMod.name = "Strength (Propulsive)";
      }
    } else {
      damageMod.value = record.data?.str;
    }
  } else {
    damageMod.value = 0; // Don't add damage if conditions not met
  }

  // Get targets early so we can pass them to modifier collection for target:mark predicates
  const targets = api.getTargets();

  // Check for damageCalculation modifier
  // Don't filter by field - collect all and filter manually
  const attackType = isMelee && !isThrown ? "melee" : "ranged";
  // Get all damageCalculation modifiers without field filtering
  let damageCalculationMod = getEffectsAndModifiersForToken(
    record,
    ["damageCalculation"],
    undefined, // Don't filter by field here
    weapon._id,
    undefined,
    { weapon, targets },
  );

  if (damageCalculationMod.length) {
    damageCalculationMod.forEach((mod) => {
      if (mod.active) {
        // Support both old and new patterns:
        // - Old: field contains the ability (e.g., field: "dex"), no field restriction
        // - New: value contains the ability (e.g., value: "dex"), field contains attack type (e.g., "melee")
        // Check if this modifier applies to this attack type
        const modField = (mod.field || "").toLowerCase();
        const isAbilityScore = [
          "str",
          "dex",
          "con",
          "int",
          "wis",
          "cha",
        ].includes(modField);
        const matchesAttackType = modField === attackType || modField === "";

        // For new pattern: field must match attack type (or be empty)
        // For old pattern: field is an ability score (always applies)
        if (!isAbilityScore && !matchesAttackType) {
          return; // Skip this modifier
        }

        // Determine which ability to use
        let alternativeAbility;
        if (isAbilityScore) {
          // Old pattern: field contains the ability
          alternativeAbility = modField;
        } else {
          // New pattern: value contains the ability
          alternativeAbility = mod.value
            ? mod.value.toString().toLowerCase()
            : "";
        }

        if (
          alternativeAbility &&
          ["str", "dex", "con", "int", "wis", "cha"].includes(
            alternativeAbility,
          )
        ) {
          const alternativeScore = record.data?.[alternativeAbility] || 0;
          // Only use the alternative if it's higher than the current damage score
          if (alternativeScore > damageMod.value) {
            damageScore = alternativeAbility;
            damageMod.value = alternativeScore;
            damageMod.name = mod.name;
          }
        }
      }
    });
  }

  const animation = weapon?.data?.animation?.animationName
    ? weapon?.data?.animation
    : undefined;

  // Check attackCalculation modifier to see if we use a different stat
  const attackCalculationMod = getEffectsAndModifiersForToken(
    record,
    ["attackCalculation"],
    undefined,
    weapon._id,
    undefined,
    { weapon, targets },
  );
  attackCalculationMod.forEach((mod) => {
    const attackCalculation = mod.field;
    if (attackCalculation && mod.active) {
      if (
        record.data?.[`${attackCalculation}`] > record.data?.[`${abilityScore}`]
      ) {
        abilityScore = attackCalculation.toLowerCase();
      }
    }
  });

  const modifiers = [];

  // Determine weapon category and group (needed for metadata even for NPCs)
  const weaponCategory = isNPCAttack
    ? ""
    : (weapon.data?.itemCategory || "simple").toLowerCase();
  const weaponGroup = weapon.data?.group || "";

  if (isNPCAttack) {
    // For NPC attacks, use the simple bonus field
    const attackBonus = parseInt(weapon.data?.bonus || "0", 10);
    if (attackBonus !== 0) {
      modifiers.push({
        name: `Attack Bonus`,
        type: "",
        value: attackBonus,
        active: true,
      });
    }
  } else {
    // PC weapon proficiency and potency runes
    // Check proficiency
    const weaponProficiency = getProfiencyForWeapon(
      record,
      weaponCategory,
      weaponGroup,
      weapon,
    );
    const proficiencyNames = [
      "Untrained",
      "Trained",
      "Expert",
      "Master",
      "Legendary",
    ];
    const proficiencyName = proficiencyNames[weaponProficiency] || "Untrained";

    // Add the total proficiency modifier
    if (weaponProficiency !== 0) {
      // Calculate the modifier
      const level = parseInt(record.data?.level || "0", 10);
      let statMod = parseInt(record.data?.[`${abilityScore}`] || "0", 10);
      let modifier = weaponProficiency * 2 + level + statMod;
      modifiers.push({
        name: `${weaponCategory} (${proficiencyName})`,
        type: "",
        value: modifier,
        active: true,
      });
    }

    // Get bonuses for potency runes
    const potencyRune = parseInt(weapon.data?.runes?.potency || "0", 10);
    if (potencyRune > 0) {
      modifiers.push({
        name: `Weapon Potency +${potencyRune}`,
        value: potencyRune,
        isPenalty: false,
        active: true,
        valueType: "number",
      });
    }
  }

  // Get other bonuses and penalties
  const seenAttackModifiers = new Set();
  const otherBonusesAndPenalties = getEffectsAndModifiersForToken(
    record,
    ["attackBonus", "attackPenalty", "allBonus", "allPenalty"],
    isMelee ? "melee" : "ranged",
    weapon._id,
    undefined,
    { weapon, targets },
  );
  otherBonusesAndPenalties.forEach((mod) => {
    const modString = modToString(mod);
    if (!seenAttackModifiers.has(modString)) {
      seenAttackModifiers.add(modString);
      modifiers.push(mod);
    }
  });

  // In unarmed, get for unarmed
  if (weaponCategory === "unarmed") {
    const unarmedBonusesAndPenalties = getEffectsAndModifiersForToken(
      record,
      ["attackBonus", "attackPenalty", "allBonus", "allPenalty"],
      "unarmed",
      weapon._id,
      undefined,
      { weapon, targets },
    );
    unarmedBonusesAndPenalties.forEach((mod) => {
      const modString = modToString(mod);
      if (!seenAttackModifiers.has(modString)) {
        seenAttackModifiers.add(modString);
        modifiers.push(mod);
      }
    });
  }

  // Get bonuses and penalties for stat-based checks
  const statBonusesAndPenalties = getEffectsAndModifiersForToken(
    record,
    ["attackBonus", "attackPenalty", "allBonus", "allPenalty"],
    abilityScore,
    weapon._id,
    undefined,
    { weapon, targets },
  );
  statBonusesAndPenalties.forEach((mod) => {
    const modString = modToString(mod);
    if (!seenAttackModifiers.has(modString)) {
      seenAttackModifiers.add(modString);
      modifiers.push(mod);
    }
  });

  // Add extra attack modifiers passed via weapon (e.g., from elemental blast)
  if (weapon.data?.extraAttackModifiers) {
    weapon.data.extraAttackModifiers.forEach((mod) => {
      const modString = modToString(mod);
      if (!seenAttackModifiers.has(modString)) {
        seenAttackModifiers.add(modString);
        modifiers.push(mod);
      }
    });
  }

  // Check if weapon has nonlethal trait and add option to make it lethal
  const hasNonlethalTrait = traits.some(
    (trait) =>
      trait.toLowerCase().trim() === "nonlethal" ||
      trait.toLowerCase().trim() === "non-lethal",
  );

  if (hasNonlethalTrait) {
    // Check if there's already a circumstance penalty of -2 or more
    // Circumstance penalties don't stack, so we only add this if needed
    const existingCircumstancePenalties = otherBonusesAndPenalties.filter(
      (mod) =>
        mod.modifierType === "circumstance" &&
        mod.value < 0 &&
        Math.abs(mod.value) >= 2,
    );

    let lethalPenaltyValue = -2;
    if (existingCircumstancePenalties.length > 0) {
      // Already have a -2 or worse circumstance penalty, so this adds nothing
      lethalPenaltyValue = 0;
    }

    modifiers.push({
      name: "Make Attack Lethal",
      type: "circumstance",
      value: lethalPenaltyValue,
      active: false, // Inactive by default - player must opt in
      modifierType: "circumstance",
    });
  }

  // If this is the second or third attach we add MAP
  if (attackNumber === 2 || attackNumber === 3) {
    let mapPenalty = attackNumber === 2 ? -5 : -10;
    if (hasAgileTrait) {
      // If agile trait, -4 / -8
      mapPenalty = attackNumber === 2 ? -4 : -8;
    }
    // Check for MAP reduction modifier
    const mapReductionMod = getEffectsAndModifiersForToken(
      record,
      ["mapReduction"],
      isSpell ? "spell" : "attack",
      weapon._id,
      undefined,
      { weapon, targets },
    );

    if (mapReductionMod.length) {
      mapReductionMod.forEach((mod) => {
        const mapReduction = mod.value;
        if (mod.active && Math.abs(mapReduction) > 0) {
          modifiers.push({
            name: `${mod.name} (Reduce MAP)`,
            value: Math.abs(mapReduction),
            isPenalty: false,
            valueType: "number",
            active: true,
          });
        }
      });
    }
    modifiers.push({
      name: "Mutliple Attack Penalty",
      value: mapPenalty,
      isPenalty: true,
      valueType: "number",
      active: true,
    });
  }

  if (Object.keys(valuesToSet).length > 0) {
    api.setValues(valuesToSet);
  }

  // Get damage modifiers
  let damageModifiers = getEffectsAndModifiersForToken(
    record,
    ["damageBonus", "damagePenalty"],
    isMelee ? "melee" : "ranged",
    weapon._id,
    undefined,
    { weapon, targets },
  );

  // Damage stat modifiers
  if (damageScore) {
    const damageStatModifiers = getEffectsAndModifiersForToken(
      record,
      ["damageBonus", "damagePenalty"],
      damageScore,
      weapon._id,
      undefined,
      { weapon, targets },
    );
    // Create a Set from existing damage modifiers to avoid duplicates
    const seenDamageModifiers = new Set(
      damageModifiers.map((mod) => modToString(mod)),
    );
    damageStatModifiers.forEach((mod) => {
      const modString = modToString(mod);
      if (!seenDamageModifiers.has(modString)) {
        seenDamageModifiers.add(modString);
        damageModifiers.push(mod);
      }
    });
  }

  // Add extra damage modifiers passed via weapon (e.g., from elemental blast)
  if (weapon.data?.extraDamageModifiers) {
    const seenDamageModifiers = new Set(
      damageModifiers.map((mod) => modToString(mod)),
    );
    weapon.data.extraDamageModifiers.forEach((mod) => {
      const modString = modToString(mod);
      if (!seenDamageModifiers.has(modString)) {
        seenDamageModifiers.add(modString);
        damageModifiers.push(mod);
      }
    });
  }

  // Preserve the modifierType before mapping to avoid losing deduplication info
  damageModifiers = damageModifiers.map((mod) => {
    return {
      ...mod,
      type:
        getDamageType(mod?.value?.toString() || "") !== "untyped"
          ? ""
          : damageType,
      modifierType: mod.modifierType, // Preserve for potential future deduplication
    };
  });

  // Add striking rune modifier if present
  if (strikingRuneMod) {
    damageModifiers.unshift(strikingRuneMod);
  }

  // Push the damage mod, if there is one, to the top
  if (damageMod.value !== 0) {
    damageModifiers.unshift(damageMod);
  }

  // Add precision damage for NPC attacks
  if (isNPCAttack && weaponDamageInfo.precisionDamage) {
    weaponDamageInfo.precisionDamage.forEach((precisionRoll) => {
      damageModifiers.push({
        name: precisionRoll.name || "Precision Damage",
        value: precisionRoll.data?.formula || "0",
        active: true,
        type: precisionRoll.data?.type || "untyped",
        valueType: "string",
      });
    });
  }

  // Remove duplicates based on name and value
  const seenModifiers = new Set();
  damageModifiers = damageModifiers.filter((mod) => {
    const key = `${mod.name}-${mod.value}-${mod.valueType}`;
    if (seenModifiers.has(key)) {
      return false; // Skip duplicate
    }
    seenModifiers.add(key);
    return true;
  });

  // Apply adjustModifier effects to splash damage (e.g., upgrade splash based on intelligence)
  splashDamage = applyAdjustModifiers(record, splashDamage, "splash", weapon);

  // Process damage modifiers to extract category-specific damage (persistent, splash, precision)
  const processedDamage = processDamageModifierCategories(
    damageModifiers,
    persistentDamage,
    splashDamage,
    splashDamageType,
  );
  damageModifiers = processedDamage.modifiers;
  persistentDamage = processedDamage.persistentDamage;
  splashDamage = processedDamage.splashDamage;
  splashDamageType = processedDamage.splashDamageType;
  // Add precision categories to damageCategories if any were found
  processedDamage.precisionCategories.forEach((cat) => {
    if (!damageCategories.includes(cat)) {
      damageCategories.push(cat);
    }
  });

  // Determine if we are making a damage roll that ignores resistances / immunities
  const damageIgnoresResistances = damageModifiers
    .filter(
      (mod) =>
        mod.valueType === "string" &&
        typeof mod.value === "string" &&
        mod.value.trim().toLowerCase().startsWith("ignore") &&
        mod.value.trim().toLowerCase().includes("resistance"),
    )
    ?.map((mod) => mod.value.split(" ")[1])
    .join(",");
  const damageIgnoresImmunities = damageModifiers
    .filter(
      (mod) =>
        mod.valueType === "string" &&
        typeof mod.value === "string" &&
        mod.value.trim().toLowerCase().startsWith("ignore") &&
        (mod.value.trim().toLowerCase().includes("immunities") ||
          mod.value.trim().toLowerCase().includes("immunity")),
    )
    ?.map((mod) => mod.value.split(" ")[1])
    .join(",");
  const damageIgnoresWeaknesses = damageModifiers
    .filter(
      (mod) =>
        mod.valueType === "string" &&
        typeof mod.value === "string" &&
        mod.value.trim().toLowerCase().startsWith("ignore") &&
        mod.value.trim().toLowerCase().includes("weakness"),
    )
    ?.map((mod) => mod.value.split(" ")[1])
    .join(",");
  // Filter these out of the modifiers array, we don't need them to be toggleable
  const filteredDamageModifiers = damageModifiers.filter(
    (m) => !m?.value?.toString()?.toLowerCase()?.includes("ignore"),
  );

  // Roll for each target or just once
  const ourToken = api.getToken();
  const otherTokens = api.getOtherTokens();
  if (targets.length > 0) {
    for (const target of targets) {
      const targetName =
        target?.token?.identified === false
          ? target?.token?.record?.unidentifiedName
          : target?.token?.record?.name;
      const targetDistance = target?.distance || 0;

      // Check if target has shield raised
      if (target?.token?.data?.shieldRaised === "true") {
        targetShieldRaised = true;
      }

      // If this a ranged attack, add penalties based on range increment
      if (!isMelee || isThrown) {
        let rangePenalty = 0;
        let increment = 0;

        // Look up ignoreRangePenalty modifier
        const ignoreRangePenaltyMod = getEffectsAndModifiersForToken(
          record,
          ["ignoreRangePenalty"],
          undefined,
          weapon._id,
          undefined,
          { weapon, targets: [target] },
        );
        let ignoreRangePenalty = 0;
        for (const mod of ignoreRangePenaltyMod) {
          if (mod.value > 0 && mod.value > ignoreRangePenalty && mod.active) {
            ignoreRangePenalty = mod.value;
          }
        }

        // Calculate range increment penalty
        // No penalty within first range increment, -2 for each additional increment
        // Attacks beyond 6th increment (6x range) are impossible
        if (range > 0 && targetDistance > range) {
          increment = Math.ceil(targetDistance / range);

          // Attacks beyond 6th increment are impossible
          if (increment > 6) {
            api.showNotification(
              `Target is beyond maximum range (${6 * range} ft)!`,
              "red",
              "Out of Range",
            );
            continue;
          }

          // -2 penalty for each increment beyond the first
          rangePenalty = -(increment - 1) * 2;
        }

        // Add penalties based on range increment
        if (
          targetDistance > 0 &&
          rangePenalty < 0 &&
          increment > ignoreRangePenalty
        ) {
          modifiers.push({
            name: `Range Increment (${increment})`,
            value: rangePenalty,
            valueType: "number",
            isPenalty: true,
            active: true,
          });
        }

        // Check for volley penalty (attacks within volley range take -2 penalty)
        if (
          volleyRange > 0 &&
          targetDistance > 0 &&
          targetDistance <= volleyRange
        ) {
          modifiers.push({
            name: `Volley (within ${volleyRange} ft)`,
            value: -2,
            valueType: "number",
            isPenalty: true,
            active: true,
          });
        }
      }

      // Get modifiers for target
      // Get effects and modifiers for the target
      let autoCritical = false;
      const targetEffects = getAttackModifiersForTarget(
        target?.token,
        targetDistance,
      );
      targetEffects.forEach((r) => {
        if (r.value === "critical") {
          autoCritical = true;
        } else {
          modifiers.push(r);
        }
      });

      // Get damage effects for the target
      const targetDamageEffects = getDamageEffectsForTarget(
        ourToken,
        target?.token,
      );
      const allDamageModifiers = [...filteredDamageModifiers];
      targetDamageEffects.forEach((r) => {
        allDamageModifiers.push({
          ...r,
          type: damageType,
        });
      });

      // Check if target is off guard due to effects or flanking (only for melee attacks)
      // Per PF2e rules, flanking only applies to melee attacks
      let targetIsOffGuard = isOffGuard(target?.token);
      let targetIsOffGuardDueToFlanking = false;
      if (isMelee && !isThrown && !targetIsOffGuard) {
        targetIsOffGuardDueToFlanking = isOffGuardDueToFlanking({
          sourceToken: ourToken,
          sourceReach: reach,
          otherTokens: otherTokens,
          target: target,
        });
        targetIsOffGuard = targetIsOffGuardDueToFlanking;
      }

      // Activate sneak attack modifiers if conditions are met
      const finalDamageModifiers = activateSneakAttackIfConditionsMet(
        allDamageModifiers,
        weapon,
        targetIsOffGuard,
      );

      // Build list of precision modifier indices for damage handler
      const precisionModifierIndices = [];
      finalDamageModifiers.forEach((mod, index) => {
        if (mod.precisionDamage === true) {
          precisionModifierIndices.push(index);
        }
      });

      let targetAc = getArmorClassForToken(
        target?.token,
        targetIsOffGuardDueToFlanking,
      );

      // Check if we have a critical specialization effect
      const hasCriticalSpecialization = hasCriticalSpecializationEffect(
        record,
        weapon,
        targetIsOffGuard,
      );

      const diceRoll = "1d20";
      // Get degree of success adjustments for attack rolls (ability score and melee/ranged)
      const attackField = isMelee ? "melee" : "ranged";
      const degreeOfSuccessAdjustments = getDegreeOfSuccessAdjustments(
        record,
        [attackField, abilityScore],
        weapon._id,
        undefined,
        { weapon, targets: [target] },
      );

      const metadata = {
        attack: `${weapon.name}`,
        rollName: "Attack",
        tooltip: `Attack with ${weapon.name}`,
        weaponName: weapon.name,
        weaponGroup: weaponGroup,
        hasCriticalSpecialization: hasCriticalSpecialization,
        traits: traits,
        damageCategories: damageCategories,
        runes: runes,
        icon: isMelee && !isThrown ? "IconSword" : "IconBow",
        portrait: weapon?.portrait,
        targetName: targetName,
        tokenId: ourToken?._id,
        tokenName:
          ourToken?.identified === false
            ? ourToken?.record?.unidentifiedName
            : ourToken?.record?.name,
        targetId: target?.token?._id,
        autoCritical: autoCritical,
        dc: targetAc,
        damage: damage,
        showShieldDamage: targetShieldRaised && damageIsPhysical,
        persistentDamage: persistentDamage,
        damageType: damageType,
        splashDamage: splashDamage,
        splashDamageType: splashDamageType,
        fatalDamageString: fatalDamageString,
        damageModifiers: finalDamageModifiers,
        damageIgnoresResistances: damageIgnoresResistances,
        damageIgnoresImmunities: damageIgnoresImmunities,
        damageIgnoresWeaknesses: damageIgnoresWeaknesses,
        isOffGuard: targetIsOffGuard,
        isRanged: !isMelee || isThrown,
        deadlyDie: deadlyDie,
        fatalDie: fatalDie,
        animation,
        precisionModifierIndices: precisionModifierIndices, // Track which modifiers are precision damage
        degreeOfSuccessAdjustments: degreeOfSuccessAdjustments,
      };

      if (targetIsOffGuardDueToFlanking) {
        // Float text to show
        api.floatText(target?.token, "Off-Guard (Flanked)", "#ff7700");
      }

      api.promptRoll(
        `Attack with ${weapon.name}`,
        diceRoll,
        modifiers,
        metadata,
        "attack",
      );
    }
  } else {
    const hasCriticalSpecialization = hasCriticalSpecializationEffect(
      record,
      weapon,
      false,
    );

    // Build list of precision modifier indices for damage handler
    const precisionModifierIndices = [];
    filteredDamageModifiers.forEach((mod, index) => {
      if (mod.precisionDamage === true) {
        precisionModifierIndices.push(index);
      }
    });

    // Get degree of success adjustments for attack rolls (ability score and melee/ranged)
    const attackField = isMelee ? "melee" : "ranged";
    const degreeOfSuccessAdjustments = getDegreeOfSuccessAdjustments(
      record,
      [attackField, abilityScore],
      weapon._id,
      undefined,
      { weapon },
    );

    const metadata = {
      attack: `${weapon.name}`,
      rollName: "Attack",
      tooltip: `Attack with ${weapon.name}`,
      traits: traits,
      damageCategories: damageCategories,
      runes: runes,
      weaponName: weapon.name,
      weaponGroup: weaponGroup,
      hasCriticalSpecialization: hasCriticalSpecialization,
      icon: isMelee && !isThrown ? "IconSword" : "IconBow",
      portrait: weapon?.portrait,
      tokenId: ourToken?._id,
      tokenName:
        ourToken?.identified === false
          ? ourToken?.record?.unidentifiedName
          : ourToken?.record?.name,
      damage: damage,
      persistentDamage: persistentDamage,
      damageType: damageType,
      showShieldDamage: targetShieldRaised && damageIsPhysical,
      splashDamage: splashDamage,
      splashDamageType: splashDamageType,
      fatalDamageString: fatalDamageString,
      damageModifiers: filteredDamageModifiers,
      damageIgnoresResistances: damageIgnoresResistances,
      damageIgnoresImmunities: damageIgnoresImmunities,
      damageIgnoresWeaknesses: damageIgnoresWeaknesses,
      hasDeathTrait: hasDeathTraitFromHelper,
      isRanged: !isMelee || isThrown,
      deadlyDie: deadlyDie,
      fatalDie: fatalDie,
      animation,
      precisionModifierIndices: precisionModifierIndices, // Track which modifiers are precision damage
      degreeOfSuccessAdjustments: degreeOfSuccessAdjustments,
    };

    api.promptRoll(
      `Attack with ${weapon.name}`,
      "1d20",
      modifiers,
      metadata,
      "attack",
    );
  }
}

function performDamageRollForSpellOrItem(recordId, recordType, weaponDataPath) {
  if (!recordId || !recordType || !weaponDataPath) {
    console.error(
      `Invalid parameters for performDamageRollForSpellOrItem: recordId: ${recordId}, recordType: ${recordType}, weaponDataPath: ${weaponDataPath}`,
    );
    return;
  }

  // Requery the record first
  api.getRecord(recordType, recordId, (updatedRecord) => {
    const weapon = api.getValueOnRecord(updatedRecord, weaponDataPath);
    if (!weapon) {
      console.error(`Weapon not found for data path: ${weaponDataPath}`);
      return;
    } else {
      // Call preformDamage again with the record and weapon
      performDamageRoll(updatedRecord, weapon, weaponDataPath, false);
    }
  });
}

// Perform a damage roll with the given weapon (or ability/item)
function performDamageRoll(record, weapon, weaponDataPath, isCritical) {
  // If weapon is undefined get by dataPath
  if (!weapon) {
    console.error(`Weapon not found for data path: ${weaponDataPath}`);
    return;
  }

  // Get weapon damage info using helper function
  const weaponDamageInfo = getWeaponDamageInfo(record, weapon);
  const damageKind = weaponDamageInfo.damageKind;
  const damageType = weaponDamageInfo.damageType;
  let splashDamage = weaponDamageInfo.splashDamage;
  let splashDamageType = weaponDamageInfo.splashDamageType || damageType;
  let damage = weaponDamageInfo.damageString;

  // Don't add splash to damage yet - will do after processing modifiers
  // so we can include modifier splash damage too

  const fatalDamageString = weaponDamageInfo.fatalDamageString;
  const damageMod = weaponDamageInfo.damageMod;
  const strikingRuneMod = weaponDamageInfo.strikingRuneMod;
  const deadlyDie = weaponDamageInfo.deadlyDie;
  const fatalDie = weaponDamageInfo.fatalDie;
  const isMelee = weaponDamageInfo.isMelee;
  const isThrown = weaponDamageInfo.isThrown;
  const hasDeathTrait = weaponDamageInfo.hasDeathTrait;
  const isSpell = weaponDamageInfo.isSpell;
  const isNPCAttack = weaponDamageInfo.isNPCAttack;
  const propertyRunes = weapon.data?.runes?.property || [];

  // Check for persistent damage
  let persistentDamage = "";
  if (isNPCAttack) {
    // For NPC attacks, persistent damage comes from weaponDamageInfo
    persistentDamage = weaponDamageInfo.persistentDamage || "";
  } else {
    // For PC weapons, calculate from damage.persistent structure
    const persistentDamageNumber = weapon.data?.damage?.persistent?.number || 0;
    const persistentDie = weapon.data?.damage?.persistent?.faces
      ? `d${weapon.data?.damage?.persistent?.faces}`
      : "";
    const persistentType = weapon.data?.damage?.persistent?.type || "acid";
    persistentDamage =
      persistentDamageNumber > 0
        ? `${persistentDamageNumber}${persistentDie} ${persistentType}`
        : "";
  }

  // Check for Scatter trait and calculate scatter splash damage
  // Scatter weapons deal splash damage equal to 1 point per weapon damage die
  const traits = weapon.data?.traits || [];
  const scatterRadius = getScatterRadiusFromTraits(traits);

  if (scatterRadius > 0) {
    // Get the striking rune level to count total dice
    const strikingRune = parseInt(weapon.data?.runes?.striking || "0", 10);
    const totalDice = countWeaponDamageDice(weapon, strikingRune);

    if (totalDice > 0) {
      // Add scatter splash to existing splash damage
      const existingSplash =
        typeof splashDamage === "number"
          ? splashDamage
          : parseInt(splashDamage, 10) || 0;
      splashDamage = existingSplash + totalDice;
      if (!splashDamageType) {
        splashDamageType = damageType;
      }
    }
  }

  // Create a list of all traits as tags that we'll add to the roll message
  const damageCategories = [];

  // Check if weapon has any runes, add "non-magical" trait if it does not or does not have a magic trait
  const hasMagicalTrait =
    weapon.recordType === "spells" ||
    traits.some(
      (trait) =>
        trait.toLowerCase().includes("magical") ||
        trait.toLowerCase().includes("arcane") ||
        trait.toLowerCase().includes("divine") ||
        trait.toLowerCase().includes("occult") ||
        trait.toLowerCase().includes("primal"),
    );
  const hasRunes =
    propertyRunes.length > 0 ||
    !!weapon.data?.runes?.potency ||
    !!weapon.data?.runes?.striking;

  if (!hasMagicalTrait && !hasRunes) {
    damageCategories.push("non-magical");
  }

  propertyRunes.forEach((rune) => {
    // Format runes like "Ghost Touch" to "ghost-touch"
    damageCategories.push(rune.toLowerCase().replace(/ /g, "-"));
  });

  // Add material type if present (e.g., "cold-iron", "silver", "adamantine")
  if (weapon.data?.material?.type) {
    const materialType = weapon.data.material.type
      .toLowerCase()
      .trim()
      .replace(/ /g, "-");
    if (materialType) {
      damageCategories.push(materialType);
    }
  }

  // Determine damage stat (for stat-based damage modifiers)
  let damageScore = "";
  const isPropulsive = weapon.data?.traits?.some((trait) =>
    trait.toLowerCase().includes("propulsive"),
  );
  const addStrengthToDamage = isMelee || isThrown;

  if (isMelee || addStrengthToDamage || isPropulsive) {
    damageScore = "str";
  }

  // Check for damageCalculation modifier
  // Don't filter by field - collect all and filter manually
  const attackType = isMelee && !isThrown ? "melee" : "ranged";

  // Get all damageCalculation modifiers without field filtering
  let damageCalculationMod = getEffectsAndModifiersForToken(
    record,
    ["damageCalculation"],
    undefined, // Don't filter by field here
    weapon._id,
    undefined,
    { weapon },
  );

  if (damageCalculationMod.length) {
    damageCalculationMod.forEach((mod) => {
      if (mod.active) {
        // Support both old and new patterns:
        // - Old: field contains the ability (e.g., field: "dex"), no field restriction
        // - New: value contains the ability (e.g., value: "dex"), field contains attack type (e.g., "melee")

        // Check if this modifier applies to this attack type
        const modField = (mod.field || "").toLowerCase();
        const isAbilityScore = [
          "str",
          "dex",
          "con",
          "int",
          "wis",
          "cha",
        ].includes(modField);
        const matchesAttackType = modField === attackType || modField === "";

        // For new pattern: field must match attack type (or be empty)
        // For old pattern: field is an ability score (always applies)
        if (!isAbilityScore && !matchesAttackType) {
          return; // Skip this modifier
        }

        // Determine which ability to use
        let alternativeAbility;
        if (isAbilityScore) {
          // Old pattern: field contains the ability
          alternativeAbility = modField;
        } else {
          // New pattern: value contains the ability
          alternativeAbility = mod.value
            ? mod.value.toString().toLowerCase()
            : "";
        }

        if (
          alternativeAbility &&
          ["str", "dex", "con", "int", "wis", "cha"].includes(
            alternativeAbility,
          )
        ) {
          const alternativeScore = record.data?.[alternativeAbility] || 0;
          const currentScore = damageMod.value || 0;

          // Only use the alternative if it's higher than the current damage score
          if (alternativeScore > currentScore) {
            damageScore = alternativeAbility;
            damageMod.value = alternativeScore;
            damageMod.name = mod.name;
          }
        }
      }
    });
  }

  // Get damage modifiers
  let damageModifiers = [];
  if (!weaponDamageInfo.isItem) {
    if (weaponDamageInfo.isSpell) {
      const isCantrip = weapon.data?.traits?.some((trait) =>
        trait.toLowerCase().includes("cantrip"),
      );
      let types = isCantrip
        ? ["cantripDamageBonus", "cantripDamagePenalty"]
        : ["spellDamageBonus", "spellDamagePenalty"];
      if (damageKind === "healing") {
        types = ["healingBonus", "healingPenalty"];
      }
      damageModifiers = getEffectsAndModifiersForToken(
        record,
        types,
        isMelee ? "melee" : "ranged",
        weapon._id,
        undefined,
        { weapon },
      );
    } else {
      damageModifiers = getEffectsAndModifiersForToken(
        record,
        ["damageBonus", "damagePenalty"],
        isMelee ? "melee" : "ranged",
        weapon._id,
        undefined,
        { weapon },
      );
    }
  }

  // Damage stat modifiers (if using a stat for damage)
  if (damageScore && !weaponDamageInfo.isItem) {
    const damageStatModifiers = getEffectsAndModifiersForToken(
      record,
      ["damageBonus", "damagePenalty"],
      damageScore,
      weapon._id,
      undefined,
      { weapon },
    );
    // Create a Set from existing damage modifiers to avoid duplicates
    const seenDamageModifiers = new Set(
      damageModifiers.map((mod) => modToString(mod)),
    );
    damageStatModifiers.forEach((mod) => {
      const modString = modToString(mod);
      if (!seenDamageModifiers.has(modString)) {
        seenDamageModifiers.add(modString);
        damageModifiers.push(mod);
      }
    });
  }

  damageModifiers = damageModifiers.map((mod) => {
    return {
      ...mod,
      type:
        getDamageType(mod?.value?.toString() || "") !== "untyped"
          ? ""
          : damageType,
    };
  });

  // Add striking rune modifier if present
  if (strikingRuneMod) {
    damageModifiers.unshift(strikingRuneMod);
  }

  // Push the damage mod for STR, if there is one, to the top
  if (damageMod.value !== 0) {
    damageModifiers.unshift(damageMod);
  }

  // Add precision damage for NPC attacks
  if (isNPCAttack && weaponDamageInfo.precisionDamage) {
    weaponDamageInfo.precisionDamage.forEach((precisionRoll) => {
      damageModifiers.push({
        name: precisionRoll.name || "Precision Damage",
        value: precisionRoll.data?.formula || "0",
        active: true,
        type: precisionRoll.data?.type || "untyped",
        valueType: "string",
      });
    });
  }

  // Apply adjustModifier effects to splash damage (e.g., upgrade splash based on intelligence)
  splashDamage = applyAdjustModifiers(record, splashDamage, "splash", weapon);

  // Process damage modifiers to extract category-specific damage (persistent, splash, precision)
  const processedDamage = processDamageModifierCategories(
    damageModifiers,
    persistentDamage,
    splashDamage,
    splashDamageType,
  );
  damageModifiers = processedDamage.modifiers;
  persistentDamage = processedDamage.persistentDamage;
  splashDamage = processedDamage.splashDamage;
  splashDamageType = processedDamage.splashDamageType;
  // Add precision categories to damageCategories if any were found
  processedDamage.precisionCategories.forEach((cat) => {
    if (!damageCategories.includes(cat)) {
      damageCategories.push(cat);
    }
  });

  // Now add the combined splash damage (weapon + modifiers) to the damage string
  // Note: splashDamage now includes the type(s) in the string, e.g., "1d4 fire + 1d6 acid"
  if (splashDamage && splashDamage !== 0 && splashDamage !== "0") {
    damage = `${damage} + ${splashDamage}`;
  }

  // On critical hits, add deadly dice to damage modifiers
  // The number of deadly dice depends on striking runes
  let criticalOnlyDice = [];

  // Track splash damage so it doesn't get doubled on critical hits
  // Splash damage is now formatted as "1d4 fire + 1d6 acid" with types included
  if (splashDamage && splashDamage !== 0 && splashDamage !== "0") {
    // Split by " + " to get individual splash components
    const splashComponents = String(splashDamage).split(/\s*\+\s*/);

    splashComponents.forEach((component) => {
      component = component.trim();
      // Parse each component like "1d4 fire" or "3 bludgeoning"
      // Pattern: "(dice or number) (damage type)"
      const componentMatch = component.match(
        /^([0-9]*d[0-9]+|[0-9]+)\s+([a-z]+)$/i,
      );

      if (componentMatch) {
        const formula = componentMatch[1];
        const type = componentMatch[2].toLowerCase();

        let splashDieType = 0;
        let splashFlatDamage = 0;

        // Check if it's a dice formula or flat number
        const diceMatch = formula.match(/\d*d(\d+)/);
        if (diceMatch) {
          splashDieType = parseInt(diceMatch[1], 10);
        } else {
          splashFlatDamage = parseInt(formula, 10) || 0;
        }

        criticalOnlyDice.push({
          dieType: splashDieType,
          damageType: type,
          flatDamage: splashFlatDamage,
        });
      }
    });
  }

  if (isCritical && deadlyDie) {
    // Determine number of deadly dice based on striking runes
    let strikingRuneLevel = 0;
    if (strikingRuneMod) {
      if (strikingRuneMod.name.includes("Major")) {
        strikingRuneLevel = 2;
      } else if (strikingRuneMod.name.includes("Greater")) {
        strikingRuneLevel = 1;
      } else {
        strikingRuneLevel = 0;
      }
    }

    // Number of deadly dice = 1 + striking rune level
    const numDeadlyDice = 1 + strikingRuneLevel;

    // Add deadly dice modifier
    const deadlyMod = {
      name: `Deadly`,
      value: `${numDeadlyDice}${deadlyDie}`,
      active: true,
      type: damageType,
      valueType: "string",
    };

    damageModifiers.push(deadlyMod);

    // Track the deadly dice so we don't double them
    // Extract die size (e.g., "d8" -> 8)
    const dieSizeMatch = deadlyDie.match(/d(\d+)/);
    const dieSize = dieSizeMatch ? parseInt(dieSizeMatch[1], 10) : 0;

    if (dieSize > 0) {
      // Add one entry for each deadly die
      for (let i = 0; i < numDeadlyDice; i++) {
        criticalOnlyDice.push({
          dieType: dieSize,
          damageType: damageType.toLowerCase(),
        });
      }
    }
  }

  // On critical hits, add fatal dice to damage modifiers
  if (isCritical && fatalDie) {
    damage = fatalDamageString;
    // Add modifier for the fatal die
    const fatalMod = {
      name: `Fatal`,
      value: `1${fatalDie}`,
      active: true,
      type: damageType,
      valueType: "string",
    };
    damageModifiers.push(fatalMod);

    const dieSizeMatch = fatalDie.match(/d(\d+)/);
    const dieSize = dieSizeMatch ? parseInt(dieSizeMatch[1], 10) : 0;

    // Add one entry for the fatal die
    criticalOnlyDice.push({
      dieType: dieSize,
      damageType: damageType.toLowerCase(),
    });
  }

  // Determine if we are making a damage roll that ignores resistances / immunities
  const damageIgnoresResistances = damageModifiers
    .filter(
      (mod) =>
        mod.valueType === "string" &&
        typeof mod.value === "string" &&
        mod.value.trim().toLowerCase().startsWith("ignore") &&
        mod.value.trim().toLowerCase().includes("resistance"),
    )
    ?.map((mod) => mod.value.split(" ")[1])
    .join(",");
  const damageIgnoresImmunities = damageModifiers
    .filter(
      (mod) =>
        mod.valueType === "string" &&
        typeof mod.value === "string" &&
        mod.value.trim().toLowerCase().startsWith("ignore") &&
        (mod.value.trim().toLowerCase().includes("immunities") ||
          mod.value.trim().toLowerCase().includes("immunity")),
    )
    ?.map((mod) => mod.value.split(" ")[1])
    .join(",");
  const damageIgnoresWeaknesses = damageModifiers
    .filter(
      (mod) =>
        mod.valueType === "string" &&
        typeof mod.value === "string" &&
        mod.value.trim().toLowerCase().startsWith("ignore") &&
        mod.value.trim().toLowerCase().includes("weakness"),
    )
    ?.map((mod) => mod.value.split(" ")[1])
    .join(",");
  // Filter these out of the modifiers array, we don't need them to be toggleable
  const filteredDamageModifiers = damageModifiers.filter(
    (m) => !m?.value?.toString()?.toLowerCase()?.includes("ignore"),
  );

  // Roll for each target or just once
  const targets = api.getTargets();
  const ourToken = api.getToken();
  let targetIsOffGuard = false;
  let targetShieldRaised = false;
  const damageIsPhysical = ["bludgeoning", "piercing", "slashing"].includes(
    damageType.toLowerCase(),
  );

  if (targets.length > 0) {
    for (const target of targets) {
      // Check if target has shield raised
      if (target?.token?.data?.shieldRaised === "true") {
        targetShieldRaised = true;
      }
      // Check if target is off-guard
      targetIsOffGuard = isOffGuard(target?.token);

      let targetIsOffGuardDueToFlanking = false;
      if (isMelee && !isThrown && !targetIsOffGuard) {
        const otherTokens = api.getOtherTokens();
        targetIsOffGuardDueToFlanking = isOffGuardDueToFlanking({
          sourceToken: ourToken,
          sourceReach: getTokenReach(ourToken),
          otherTokens: otherTokens,
          target: target,
        });
        targetIsOffGuard = targetIsOffGuardDueToFlanking;
      }

      // Get damage effects for the target
      const targetDamageEffects = getDamageEffectsForTarget(
        ourToken,
        target?.token,
      );
      targetDamageEffects.forEach((r) => {
        filteredDamageModifiers.push({
          ...r,
          type: damageType,
        });
      });
    }
  }

  // Activate sneak attack modifiers if conditions are met
  const finalDamageModifiers = activateSneakAttackIfConditionsMet(
    filteredDamageModifiers,
    weapon,
    targetIsOffGuard,
  );

  // Build list of precision modifier indices for damage handler
  const precisionModifierIndices = [];
  finalDamageModifiers.forEach((mod, index) => {
    if (mod.precisionDamage === true) {
      precisionModifierIndices.push(index);
    }
  });

  const metadata = {
    attack: `${weapon.name}`,
    icon: isMelee && !isThrown ? "IconSword" : "IconBow",
    portrait: weapon?.portrait,
    traits: traits,
    damageCategories,
    rollName: damageKind === "healing" ? "Healing" : "Damage",
    tooltip: `${weapon.name} ${
      damageKind === "healing" ? "Healing" : "Damage"
    }`,
    critical: isCritical,
    splashDamage: splashDamage,
    splashDamageType: splashDamageType,
    damageType: damageType,
    persistentDamage: persistentDamage,
    damageIgnoresResistances: damageIgnoresResistances,
    damageIgnoresImmunities: damageIgnoresImmunities,
    damageIgnoresWeaknesses: damageIgnoresWeaknesses,
    // If the target has the shield raised and damage is physical, can block
    showShieldDamage: targetShieldRaised && damageIsPhysical,
    isRanged: !isMelee || isThrown,
    isSpell: isSpell,
    hasDeathTrait: hasDeathTrait,
    criticalOnlyDice: criticalOnlyDice,
    precisionModifierIndices: precisionModifierIndices, // Track which modifiers are precision damage
  };

  api.promptRoll(
    `${weapon.name} ${damageKind === "healing" ? "Healing" : "Damage"}`,
    damage,
    finalDamageModifiers,
    metadata,
    damageKind === "healing" ? "healing" : "damage",
  );
}

/**
 * Helper function to check if a roll matches a condition string based on traits
 * @param {Object} roll - The damage roll object with metadata.traits
 * @param {string[]} conditionsArray - The array of condition strings (e.g., ["fire", "undead"])
 * @returns {boolean} True if any trait matches the condition string
 */
function rollMatchesCondition(roll, conditionsArray, damageType) {
  // Handle null, undefined, or empty arrays
  if (
    !conditionsArray ||
    (Array.isArray(conditionsArray) && conditionsArray.length === 0)
  ) {
    return false;
  }

  // Convert string to array for consistent processing
  const conditionsToCheck = Array.isArray(conditionsArray)
    ? conditionsArray
    : [conditionsArray];

  const traits = roll?.metadata?.traits || [];
  const damageCategories = roll?.metadata?.damageCategories || [];

  const normalize = (str) =>
    (str || "").toLowerCase().trim().replace(/-/g, "").replace(/ /g, "");

  // An exception can be a damage type (e.g., "force"), a trait, or a material/
  // damage category. Match against the current damage type first so that an
  // IWR like "all damage resistance 5 (except force)" correctly ignores force
  // damage, then fall back to trait and category matches.
  const normalizedDamageType = normalize(damageType);

  return conditionsToCheck.some((condition) => {
    const normalizedCondition = normalize(condition);
    return (
      (normalizedDamageType !== "" &&
        normalizedDamageType === normalizedCondition) ||
      traits.some((trait) => normalize(trait) === normalizedCondition) ||
      damageCategories.some(
        (category) => normalize(category) === normalizedCondition,
      )
    );
  });
}

// Helper function to get Immunities, Weaknesses, and Resistances for PF2e
function getIWR(target, armorSpecDetails = null) {
  const immunitiesMap = {};
  const weaknessesMap = {};
  const resistancesMap = {};

  // Parse immunities from new data structure
  const immunityArray = target.data?.immunities || [];
  immunityArray.forEach((immunity) => {
    if (immunity?.data?.type) {
      // Normalize only with lowercase + trim (matching weaknesses/resistances
      // and the dynamic-modifier path below). Stripping spaces/hyphens here
      // would turn "all damage"/"all-damage" into "alldamage", which the
      // applyDamage lookups for "all damage"/"all-damage" would never match;
      // the per-type and damage-category lookups normalize on their own side.
      const type = immunity.data.type.toLowerCase().trim();
      const doubleVs = immunity.data?.doubleVs || null;
      const exceptions = immunity.data?.exceptions || null;

      // Store immunity with full details
      // If we already have this type, we don't need to duplicate (immunity is binary)
      if (!immunitiesMap[type]) {
        immunitiesMap[type] = {
          type: type,
          doubleVs: doubleVs,
          exceptions: exceptions,
        };
      }
    }
  });

  // Parse weaknesses from new data structure
  const weaknessArray = target.data?.weaknesses || [];
  weaknessArray.forEach((weakness) => {
    if (weakness?.data?.type) {
      const type = weakness.data.type.toLowerCase().trim();
      const value = parseInt(weakness.data.value || "0", 10);
      const doubleVs = weakness.data?.doubleVs || null;
      const exceptions = weakness.data?.exceptions || null;

      // Keep the worst (highest) weakness for each type
      if (!weaknessesMap[type] || value > weaknessesMap[type].value) {
        weaknessesMap[type] = {
          type: type,
          value: value,
          doubleVs: doubleVs,
          exceptions: exceptions,
        };
      }
    }
  });

  // Parse resistances from new data structure
  const resistanceArray = target.data?.resistances || [];
  resistanceArray.forEach((resistance) => {
    if (resistance?.data?.type) {
      const type = resistance.data.type.toLowerCase().trim();
      const value = parseInt(resistance.data.value || "0", 10);
      const doubleVs = resistance.data?.doubleVs || null;
      const exceptions = resistance.data?.exceptions || null;

      // Keep the best (highest) resistance for each type
      if (!resistancesMap[type] || value > resistancesMap[type].value) {
        resistancesMap[type] = {
          type: type,
          value: value,
          doubleVs: doubleVs,
          exceptions: exceptions,
        };
      }
    }
  });

  // Add armor specialization resistances if applicable
  if (armorSpecDetails) {
    const { group, category, potency } = armorSpecDetails;
    const categoryLower = (category || "").toLowerCase();
    const potencyValue = parseInt(potency, 10) || 0;

    // Calculate resistance value based on armor category
    let resistanceValue = 0;
    if (categoryLower === "medium") {
      resistanceValue = 1 + potencyValue;
    } else if (categoryLower === "heavy") {
      resistanceValue = 2 + potencyValue;
    }

    // Add resistance based on armor group
    if (group === "composite" && resistanceValue > 0) {
      // Composite: piercing resistance
      if (
        !resistancesMap["piercing"] ||
        resistanceValue > resistancesMap["piercing"].value
      ) {
        resistancesMap["piercing"] = {
          type: "piercing",
          value: resistanceValue,
          doubleVs: null,
          exceptions: null,
        };
      }
    } else if (group === "leather" && resistanceValue > 0) {
      // Leather: bludgeoning resistance
      if (
        !resistancesMap["bludgeoning"] ||
        resistanceValue > resistancesMap["bludgeoning"].value
      ) {
        resistancesMap["bludgeoning"] = {
          type: "bludgeoning",
          value: resistanceValue,
          doubleVs: null,
          exceptions: null,
        };
      }
    } else if (group === "plate" && resistanceValue > 0) {
      // Plate: slashing resistance
      if (
        !resistancesMap["slashing"] ||
        resistanceValue > resistancesMap["slashing"].value
      ) {
        resistancesMap["slashing"] = {
          type: "slashing",
          value: resistanceValue,
          doubleVs: null,
          exceptions: null,
        };
      }
    } else if (group === "skeletal") {
      // Skeletal: precision resistance (different formula)
      const skeletalValue =
        categoryLower === "medium"
          ? 3 + potencyValue
          : categoryLower === "heavy"
            ? 5 + potencyValue
            : 0;
      if (skeletalValue > 0) {
        if (
          !resistancesMap["precision"] ||
          skeletalValue > resistancesMap["precision"].value
        ) {
          resistancesMap["precision"] = {
            type: "precision",
            value: skeletalValue,
            doubleVs: null,
            exceptions: null,
          };
        }
      }
    }
  }

  // Get dynamic IWR from effects and modifiers
  const iwrModifiers = getEffectsAndModifiersForToken(target, [
    "immunity",
    "weakness",
    "resistance",
  ]);

  iwrModifiers.forEach((modifier) => {
    // Skip modifiers that aren't active (predicate didn't pass)
    if (!modifier.active) {
      return;
    }

    const modifierType = modifier.modifierType || "";
    const value = modifier.value || "";

    if (typeof value !== "string") {
      return; // Skip non-string values
    }

    // Parse the value string (e.g., "fire", "fire 4", "all damage 5", "cold 0+3")
    // Find the last numeric value (or math expression) and treat everything before it as the type
    const trimmedValue = value.trim();
    const parts = trimmedValue.split(/\s+/);

    // Check if the last part is a number or math expression
    let damageType = "";
    let numericValue = 0;

    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];

      // Check if last part contains math operators or is a plain number
      const isMathExpression = /^[0-9+\-*/().]+$/.test(lastPart);

      if (isMathExpression) {
        // Evaluate the math expression (handles both "3" and "0+3")
        numericValue = evaluateMath(lastPart);
        damageType = parts.slice(0, -1).join(" ").toLowerCase().trim();
      } else {
        // No number found - entire string is the type
        damageType = trimmedValue.toLowerCase().trim();
      }
    }

    // If damageType is empty but we have a field, use the field as the damage type
    // This handles cases where value is just a number/expression (e.g., "1+3")
    // and the damage type is in the field property
    if (!damageType && modifier.field) {
      damageType = modifier.field.toLowerCase().trim();
    }

    if (!damageType) {
      return; // Skip empty values
    }

    // Add to appropriate map based on modifier type
    if (modifierType === "immunity") {
      // Immunity is binary - just add the type
      if (!immunitiesMap[damageType]) {
        immunitiesMap[damageType] = {
          type: damageType,
          doubleVs: null,
          exceptions: null,
        };
      }
    } else if (modifierType === "weakness") {
      // Keep the worst (highest) weakness for each type
      if (
        !weaknessesMap[damageType] ||
        numericValue > weaknessesMap[damageType].value
      ) {
        weaknessesMap[damageType] = {
          type: damageType,
          value: numericValue,
          doubleVs: null,
          exceptions: null,
        };
      }
    } else if (modifierType === "resistance") {
      // Keep the best (highest) resistance for each type
      if (
        !resistancesMap[damageType] ||
        numericValue > resistancesMap[damageType].value
      ) {
        resistancesMap[damageType] = {
          type: damageType,
          value: numericValue,
          doubleVs: null,
          exceptions: null,
        };
      }
    }
  });

  // Check if target has object immunities
  // Object immunities apply automatically to vehicles, or if explicitly listed in immunities
  const isVehicle =
    target.recordType === "npcs" && target.data?.type === "vehicle";
  const hasObjectImmunitiesExplicit = immunityArray.some((immunity) => {
    if (immunity?.data?.type) {
      const type = immunity.data.type.toLowerCase().trim();
      return (
        type === "object-immunities" ||
        type === "object immunities" ||
        type === "object-immunity" ||
        type === "object immunity"
      );
    }
    return false;
  });

  // Apply object immunities if applicable
  if (isVehicle || hasObjectImmunitiesExplicit) {
    // Object Immunities: Inanimate objects and hazards are immune to:
    // - Damage types: bleed, poison, spirit, vitality, void, mental, disease
    // - Nonlethal attacks
    // Note: Healing immunity is handled separately in applyDamage
    // Note: Death effects check is handled separately in applyDamage
    const objectImmuneDamageTypes = [
      "bleed",
      "poison",
      "spirit",
      "vitality",
      "void",
      "mental",
      "disease",
      "nonlethal",
      "non-lethal",
    ];

    objectImmuneDamageTypes.forEach((type) => {
      // Only add if not already present (explicit immunities take precedence)
      if (!immunitiesMap[type]) {
        immunitiesMap[type] = {
          type: type,
          doubleVs: null,
          exceptions: null,
        };
      }
    });
  }

  return {
    immunities: immunitiesMap,
    weaknesses: weaknessesMap,
    resistances: resistancesMap,
  };
}

// Doubles the dice in the damage string
function doubleDamageDice(damage) {
  if (damage && typeof damage === "string" && damage.includes("d")) {
    return damage.replace(/(\d+)?d(\d+)/g, (match, n, d) => {
      n = n ? parseInt(n) * 2 : 2; // If n is undefined, it means 1d, so we use 2
      return `${n}d${d}`;
    });
  }
  return damage;
}

/**
 * Applies persistent damage to the target.
 * @param {Object} persistentDamage - The persistent damage string which will be set as the effect value.
 * @param {string} tokenId - The ID of the token that is applying the persistent damage.
 * @param {string} tokenName - The name of the token that is applying the persistent damage.
 * @returns {void}
 */
function applyPersistentDamage(persistentDamage, tokenId, tokenName) {
  const targets = api.getSelectedOrDroppedToken();
  targets.forEach((target) => {
    const effectValue =
      tokenId && tokenName
        ? {
            value: persistentDamage,
            _id: tokenId,
            name: tokenName,
          }
        : persistentDamage;
    api.addEffect("Persistent Damage", target, undefined, effectValue);
  });
}

/**
 * Applies damage to selected or dropped tokens following PF2e rules.
 *
 * @param {Object} record - The record that initiated the damage (for ownership checks)
 * @param {Object} roll - The damage roll object containing:
 *   - types: Array of damage types with {type, value} properties
 *   - dice: Array of individual dice results with {type, value} properties
 *   - metadata: Additional roll metadata including:
 *     - critical: Boolean indicating critical hit
 *     - criticalOnlyDice: Array of {dieType, damageType} objects for dice that shouldn't be doubled (deadly/fatal)
 *     - hasDeathTrait: Boolean indicating death trait
 *     - damageIgnoresResistances: Comma-separated string of damage types that ignore resistances
 *     - damageIgnoresImmunities: Comma-separated string of damage types that ignore immunities
 *     - damageIgnoresWeaknesses: Comma-separated string of damage types that ignore weaknesses
 * @param {boolean} halfDamage - Whether to halve the damage (e.g., successful basic save)
 *
 * PF2e Critical Damage Rules:
 * - On a critical hit, damage is normally doubled (roll dice twice or double the total)
 * - Dice from deadly/fatal weapon traits are NOT doubled (they're critical-only bonuses)
 * - Use metadata.criticalOnlyDice to specify which dice shouldn't be doubled
 *   - Each entry: { dieType: 8, damageType: "slashing" } for a d8
 * - All modifiers, bonuses, and penalties are doubled
 * - After doubling, subtract the extra value from deadly/fatal dice
 * - Critical Hit Immunity: If target has immunity to "critical" or "critical hits", treat as normal hit
 *   - Damage is not doubled
 *   - Dying condition increases by 1 instead of 2
 * - Apply IWR (Immunities, Weaknesses, Resistances) after damage calculation
 * - Round down when halving damage (minimum 1 damage)
 *
 * PF2e Death Rules:
 * - Massive Damage: Instant death if damage >= 2× max HP (after all reductions)
 * - Death Trait: Instant death if reduced to 0 HP by damage with death trait
 * - Dying Condition: At 0 HP, gain Dying 1 + Wounded value
 * - Critical Hit Dying: Gain Dying 2 instead of 1 from critical hits (unless immune to critical)
 * - Death at Dying 4+
 *
 * @example
 * // Normal damage
 * applyDamage(null, rollData, false);
 *
 * // Critical hit with deadly dice (marked in metadata)
 * const roll = {
 *   types: [
 *     {type: 'slashing', value: 20},  // Normal damage: doubled
 *     {type: 'slashing', value: 8}    // Deadly dice: not doubled
 *   ],
 *   dice: [
 *     {type: 6, value: 4}, {type: 6, value: 5},  // 2d6 weapon dice
 *     {type: 8, value: 8}                         // 1d8 deadly die
 *   ],
 *   metadata: {
 *     critical: true,
 *     criticalOnlyDice: [
 *       { dieType: 8, damageType: "slashing" }  // The d8 is deadly, don't double
 *     ]
 *   }
 * };
 * applyDamage(null, roll, false);
 *
 * // Half damage (successful basic save)
 * applyDamage(null, rollData, true);
 *
 * // Death effect spell
 * const roll = {
 *   types: [{type: 'negative', value: 30}],
 *   metadata: { hasDeathTrait: true }
 * };
 * applyDamage(null, roll, false);
 */
function applyDamage(
  record,
  roll,
  halfDamage = false,
  splashDamage = null,
  shieldDamage = false,
) {
  // If splashDamage is provided, we're applying splash damage directly
  // splashDamage should be an object like: { type: "fire", value: 3 }
  // We still use the roll object for metadata (traits, ignore resistances, etc.)
  const isApplyingSplash = splashDamage !== null;
  const traits = roll.metadata?.traits || [];

  // Extract values from metadata
  // Splash damage is never a critical hit and never has death trait
  const isCritical = !isApplyingSplash && roll.metadata?.critical === true;
  const hasDeathTrait =
    !isApplyingSplash && roll.metadata?.hasDeathTrait === true;

  // Parse damage ignore lists from metadata (comma-separated strings)
  const damageIgnoresResistances = (
    roll.metadata?.damageIgnoresResistances || ""
  )
    .split(",")
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 0);
  const damageIgnoresImmunities = (roll.metadata?.damageIgnoresImmunities || "")
    .split(",")
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 0);
  const damageIgnoresWeaknesses = (roll.metadata?.damageIgnoresWeaknesses || "")
    .split(",")
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 0);

  let targets = api.getSelectedOrDroppedToken();

  // If record is not null, use it
  if (record) {
    targets = [record];
  }

  // If we're a player and we did not drop on a record, get our owned tokens
  if (!isGM && targets.length === 0) {
    targets = api.getSelectedOwnedTokens().map((target) => target.token);
  }

  targets.forEach((target) => {
    // Apply damage
    if (target && target.data) {
      let damage = 0;

      // Check for armor specialization (only for characters)
      // This needs to be done before getIWR so we can add armor spec resistances
      let targetHasArmorSpecialization = false;
      let targetArmorGroup = "";
      let targetArmorItem = null;
      let armorSpecDetails = null;
      let targetPropertyRunes = [];

      if (target.recordType === "characters") {
        // Get best equipped armor
        const bestArmor = getBestEquippedArmor(target);
        targetPropertyRunes = bestArmor?.armor?.propertyRunes || [];

        // Find the armor item in inventory if it exists
        if (bestArmor?.armor?.armorId) {
          const inventory = target.data?.inventory || [];
          targetArmorItem = inventory.find(
            (item) => item._id === bestArmor.armor.armorId,
          );

          if (targetArmorItem) {
            targetArmorGroup = (
              targetArmorItem.data?.group || ""
            ).toLowerCase();

            // Check if target has armor specialization for this armor
            targetHasArmorSpecialization = hasArmorSpecializationEffect(
              target,
              targetArmorItem,
            );

            // Get armor specialization details if applicable
            if (targetHasArmorSpecialization) {
              armorSpecDetails = {
                group: targetArmorGroup,
                category: targetArmorItem.data?.itemCategory || "",
                potency: targetArmorItem.data?.runes?.potency || 0,
              };
            }
          }
        }
      }

      const IWR = getIWR(target, armorSpecDetails);

      // Check if target is immune to critical hits
      const immuneToCritical = Object.keys(IWR.immunities).some(
        (immunityType) =>
          [
            "critical",
            "critical hits",
            "critical-hits",
            "critical hit",
            "crits",
            "crit",
          ].includes(immunityType.toLowerCase().trim()),
      );

      // Get list of critical-only dice that shouldn't be doubled (deadly/fatal)
      // Each entry has { dieType, damageType }
      const criticalOnlyDice = roll.metadata?.criticalOnlyDice || [];

      // Get the base damage type from metadata to use for precision conversion
      const baseDamageType = (
        roll.metadata?.damageType || "untyped"
      ).toLowerCase();

      // Track which roll.types indices are precision damage
      const precisionIndices = [];
      let totalPrecisionDamage = 0;

      // Get precision modifier indices from metadata
      // These tell us which modifiers in the original prompt were precision damage
      // We need to map these to roll.types indices (accounting for base damage at index 0)
      const precisionModifierIndices =
        roll.metadata?.precisionModifierIndices || [];

      // First, calculate damage with PF2e critical rules
      // On a critical hit: double all damage EXCEPT dice from deadly/fatal traits
      // If target is immune to critical hits, treat as a normal hit
      const damageByType = {};

      // Track pre-critical damage for Chain armor specialization
      let preCriticalDamage = 0;

      // If applying splash damage, use the splash parameter instead of roll.types
      if (isApplyingSplash) {
        // Splash damage is simple: just the value and type, no doubling, no halving
        const damageType = splashDamage.damageType || "untyped";
        const damageValue = splashDamage.value || 0;
        damageByType[damageType] = damageValue;
        preCriticalDamage = damageValue;
      } else {
        // Normal damage calculation from roll.types
        // Calculate pre-critical damage first
        roll.types.forEach((type, index) => {
          preCriticalDamage += type.value;
        });

        // Process each damage type entry from the roll
        roll.types.forEach((type, index) => {
          let damageType = type.type || "untyped";
          let damageValue = type.value;

          // Check if this is precision damage
          // Method 1: Damage type is explicitly "precision"
          let isPrecision = damageType.toLowerCase() === "precision";

          // Method 2: This roll.types index corresponds to a precision modifier
          // roll.types[0] = base damage, roll.types[1] = modifiers[0], etc.
          // So if index > 0, check if (index - 1) is in precisionModifierIndices
          if (!isPrecision && index > 0) {
            const modifierIndex = index - 1;
            isPrecision = precisionModifierIndices.includes(modifierIndex);
          }

          // If this is precision damage, track it and convert type to base damage type
          if (isPrecision) {
            precisionIndices.push(index);
            totalPrecisionDamage += damageValue;
            damageType = baseDamageType; // Convert precision to base damage type
          }

          // PF2e Critical Rule: Double damage unless it's from deadly/fatal trait
          // or target is immune to critical hits
          if (isCritical && !immuneToCritical) {
            damageValue *= 2; // Start by doubling everything
          }

          damageByType[damageType] =
            (damageByType[damageType] || 0) + damageValue;
        });

        // Now subtract the doubled critical-only dice
        // We need to process the roll types to find and "un-double" the deadly/fatal/splash damage
        // Skip this if target is immune to critical hits (damage wasn't doubled)
        if (
          isCritical &&
          !immuneToCritical &&
          criticalOnlyDice.length > 0 &&
          roll.types
        ) {
          // Create a working copy of criticalOnlyDice to track which we've found
          const remainingCriticalDice = [...criticalOnlyDice];

          // Process types from the end (deadly/fatal/splash are added last)
          for (
            let i = roll.types.length - 1;
            i >= 0 && remainingCriticalDice.length > 0;
            i--
          ) {
            const rollType = roll.types[i];

            // Find a matching critical-only die
            const matchIndex = remainingCriticalDice.findIndex(
              (critDie) => critDie.dieType === rollType.die,
            );

            if (matchIndex >= 0) {
              // Found a match - this die/damage shouldn't have been doubled
              const critDie = remainingCriticalDice[matchIndex];
              const damageType = critDie.damageType || "untyped";

              // Subtract the extra value (we doubled it, but should have only counted it once)
              if (damageByType[damageType] !== undefined) {
                damageByType[damageType] -= rollType.value;
              }

              // Remove this entry from the remaining list
              remainingCriticalDice.splice(matchIndex, 1);
            }
          }
        }
      }

      // Apply precision-specific IWR (immunity/resistance/weakness) to the
      // precision portion BEFORE the main IWR loop. Precision damage shares the
      // base damage type, so it was folded into that type's bucket above and
      // will be subject to that type's resistance in the main loop. Applying
      // precision IWR here — and removing the affected amount from the base
      // type bucket — ensures the precision portion isn't reduced twice (once
      // by its damage type's resistance and again by precision immunity/
      // resistance). See the "all damage except force + precision immunity"
      // case: force is excepted, the precision is removed by immunity, and the
      // base type resistance no longer double-dips the already-removed
      // precision.
      if (precisionIndices.length > 0 && !isApplyingSplash) {
        // Reconstruct the precision amount at the same (post-critical) scale as
        // it currently sits inside the base damage type bucket.
        let precisionInBucket = totalPrecisionDamage;
        if (isCritical && !immuneToCritical) {
          precisionInBucket *= 2;
        }

        let survivingPrecision = precisionInBucket;

        const precisionImmune =
          IWR.immunities["precision"] &&
          !damageIgnoresImmunities.includes("precision") &&
          !(
            IWR.immunities["precision"].exceptions &&
            rollMatchesCondition(
              roll,
              IWR.immunities["precision"].exceptions,
              "precision",
            )
          );

        if (precisionImmune) {
          // Immunity to precision negates the precision portion entirely.
          survivingPrecision = 0;
        } else {
          // Precision weakness adds extra damage to the precision portion.
          const precisionWeakness = IWR.weaknesses["precision"];
          if (
            precisionWeakness &&
            !damageIgnoresWeaknesses.includes("precision") &&
            !(
              precisionWeakness.exceptions &&
              rollMatchesCondition(
                roll,
                precisionWeakness.exceptions,
                "precision",
              )
            )
          ) {
            let weaknessValue = precisionWeakness.value;
            if (
              precisionWeakness.doubleVs &&
              rollMatchesCondition(roll, precisionWeakness.doubleVs, "precision")
            ) {
              weaknessValue *= 2;
            }
            survivingPrecision += weaknessValue;
          }

          // Precision resistance reduces the precision portion.
          const precisionResistance = IWR.resistances["precision"];
          if (
            precisionResistance &&
            !damageIgnoresResistances.includes("precision") &&
            !(
              precisionResistance.exceptions &&
              rollMatchesCondition(
                roll,
                precisionResistance.exceptions,
                "precision",
              )
            )
          ) {
            let resistanceValue = precisionResistance.value;
            if (
              precisionResistance.doubleVs &&
              rollMatchesCondition(
                roll,
                precisionResistance.doubleVs,
                "precision",
              )
            ) {
              resistanceValue *= 2;
            }
            survivingPrecision = Math.max(
              0,
              survivingPrecision - resistanceValue,
            );
          }
        }

        // Remove the affected amount from the base type bucket so only the
        // surviving precision is carried into the main IWR loop (a negative
        // removal from weakness correctly adds to the bucket).
        const precisionRemoved = precisionInBucket - survivingPrecision;
        if (
          precisionRemoved !== 0 &&
          damageByType[baseDamageType] !== undefined
        ) {
          damageByType[baseDamageType] = Math.max(
            0,
            damageByType[baseDamageType] - precisionRemoved,
          );
        }
      }

      // Check for vitality/void trait healing conversion
      // This must be done before we calculate baseDamage
      const targetTraits = target.data?.traits || [];
      const hasUndeadTrait = targetTraits.some(
        (trait) => trait?.toLowerCase() === "undead",
      );
      const hasVitalityTrait = traits.some(
        (trait) => trait?.toLowerCase() === "vitality",
      );
      const hasVoidTrait = traits.some(
        (trait) => trait?.toLowerCase() === "void",
      );

      // Convert damage to healing based on vitality/void traits
      let healingAmount = 0;
      const damageTypesToRemove = [];

      Object.keys(damageByType).forEach((type) => {
        const lowerType = type.toLowerCase();

        // Void damage heals undead
        if (hasVoidTrait && lowerType === "void" && hasUndeadTrait) {
          healingAmount += damageByType[type];
          damageTypesToRemove.push(type);
        }

        // Vitality damage heals living (non-undead)
        if (hasVitalityTrait && lowerType === "vitality" && !hasUndeadTrait) {
          healingAmount += damageByType[type];
          damageTypesToRemove.push(type);
        }
      });

      // Apply half damage to healing if halfDamage is true
      if (halfDamage && healingAmount > 0 && !isApplyingSplash) {
        healingAmount = Math.floor(healingAmount / 2);
        // Minimum 1 healing if there was any healing to begin with
        healingAmount = Math.max(1, healingAmount);
      }

      // Remove converted damage types from damageByType
      damageTypesToRemove.forEach((type) => {
        delete damageByType[type];
      });

      // Calculate total base damage (before IWR and before half)
      let baseDamage = 0;
      Object.keys(damageByType).forEach((type) => {
        baseDamage += damageByType[type];
      });

      // Apply Chain Armor Specialization: Reduce critical hit damage
      // This is applied after critical doubling but before halving and IWR
      if (
        isCritical &&
        !immuneToCritical &&
        targetHasArmorSpecialization &&
        armorSpecDetails?.group === "chain"
      ) {
        const categoryLower = (armorSpecDetails.category || "").toLowerCase();
        const potencyValue = parseInt(armorSpecDetails.potency, 10) || 0;

        let chainReduction = 0;
        if (categoryLower === "medium") {
          chainReduction = 4 + potencyValue;
        } else if (categoryLower === "heavy") {
          chainReduction = 6 + potencyValue;
        }

        if (chainReduction > 0) {
          // Apply the reduction
          baseDamage -= chainReduction;

          // Can't reduce damage below the pre-critical amount
          if (baseDamage < preCriticalDamage) {
            baseDamage = preCriticalDamage;
          }
        }
      }

      // Apply half damage to each type proportionally if needed (e.g., successful basic save)
      // This must be done BEFORE IWR
      // Note: Splash damage is never halved
      const damageByTypeAfterHalf = {};
      if (halfDamage && !isApplyingSplash && baseDamage > 0) {
        const halfTotal = Math.floor(baseDamage / 2);
        const minDamage = Math.max(1, halfTotal); // Minimum 1 damage if there was any damage to begin with

        // Distribute the halved damage proportionally across damage types
        let remainingDamage = minDamage;
        const types = Object.keys(damageByType);

        types.forEach((type, index) => {
          if (index === types.length - 1) {
            // Last type gets all remaining damage to avoid rounding issues
            damageByTypeAfterHalf[type] = remainingDamage;
          } else {
            // Proportional distribution
            const proportion = damageByType[type] / baseDamage;
            const thisDamage = Math.floor(minDamage * proportion);
            damageByTypeAfterHalf[type] = thisDamage;
            remainingDamage -= thisDamage;
          }
        });
      } else {
        // No halving needed, copy values
        Object.keys(damageByType).forEach((type) => {
          damageByTypeAfterHalf[type] = damageByType[type];
        });
      }

      // Check for nonlethal immunity (trait-based, not damage type)
      // Nonlethal is a trait, so we check it separately before IWR
      const isNonlethal = traits.some(
        (trait) =>
          trait.toLowerCase().trim() === "nonlethal" ||
          trait.toLowerCase().trim() === "non-lethal",
      );
      const hasNonlethalImmunity =
        IWR.immunities["nonlethal"] || IWR.immunities["non-lethal"];

      // If target is immune to nonlethal and damage is nonlethal, negate all damage
      if (isNonlethal && hasNonlethalImmunity && !isApplyingSplash) {
        // Check if this immunity has an exception that matches the roll
        if (
          hasNonlethalImmunity.exceptions &&
          rollMatchesCondition(roll, hasNonlethalImmunity.exceptions)
        ) {
          // Exception applies - ignore immunity, process damage normally
        } else {
          // Immune to nonlethal - set all damage to 0
          Object.keys(damageByTypeAfterHalf).forEach((type) => {
            damageByTypeAfterHalf[type] = 0;
          });
        }
      }

      // PF2e: Apply Immunities, Weaknesses, and Resistances
      // These are applied AFTER halving
      // Track final damage per type to ensure each type doesn't go below 0
      const finalDamageByType = {};

      Object.keys(damageByTypeAfterHalf).forEach((type) => {
        const lowerType = type.toLowerCase();
        let damageOfThisType = damageByTypeAfterHalf[type];

        // Check Immunities first (all damage of this type is negated)
        if (!damageIgnoresImmunities.includes(lowerType)) {
          let isImmune = false;

          // Check for specific type immunity
          const immunity = IWR.immunities[lowerType];
          // Check for "all damage" immunity
          const allDamageImmunity =
            IWR.immunities["all damage"] || IWR.immunities["all-damage"];

          const applicableImmunity = immunity || allDamageImmunity;

          if (applicableImmunity) {
            // Check if this immunity has an exception that matches the roll
            if (
              applicableImmunity.exceptions &&
              rollMatchesCondition(roll, applicableImmunity.exceptions, lowerType)
            ) {
              // Exception applies - ignore this immunity
            } else {
              isImmune = true;
            }
          }

          // Also check immunities against damageCategories
          if (!isImmune) {
            const damageCategories = roll?.metadata?.damageCategories || [];
            for (const category of damageCategories) {
              const categoryNormalized = category
                .toLowerCase()
                .trim()
                .replace(/-/g, "")
                .replace(/ /g, "");

              // Find matching immunity by normalizing the immunity type
              const matchingImmunityKey = Object.keys(IWR.immunities).find(
                (immunityKey) => {
                  const immunityNormalized = immunityKey
                    .toLowerCase()
                    .trim()
                    .replace(/-/g, "")
                    .replace(/ /g, "");
                  return immunityNormalized === categoryNormalized;
                },
              );

              if (matchingImmunityKey) {
                const categoryImmunity = IWR.immunities[matchingImmunityKey];
                // Check if this immunity has an exception that matches the roll
                if (
                  categoryImmunity.exceptions &&
                  rollMatchesCondition(roll, categoryImmunity.exceptions, lowerType)
                ) {
                  // Exception applies - ignore this immunity
                } else {
                  isImmune = true;
                  break;
                }
              }
            }
          }

          if (isImmune) {
            // Immune to this damage - negate damage of this type
            finalDamageByType[type] = 0;
            return; // Skip weakness/resistance for this type
          }
        }

        // Apply Weaknesses (add extra damage)
        if (!damageIgnoresWeaknesses.includes(lowerType)) {
          // Track which weaknesses we've applied to avoid duplicates
          const appliedWeaknesses = new Set();

          // Check for specific type weakness
          const weakness = IWR.weaknesses[lowerType];
          // Check for "all damage" weakness
          const allDamageWeakness =
            IWR.weaknesses["all damage"] || IWR.weaknesses["all-damage"];

          const applicableWeakness = weakness || allDamageWeakness;

          if (applicableWeakness) {
            // Check if this weakness has an exception that matches the roll
            if (
              applicableWeakness.exceptions &&
              rollMatchesCondition(roll, applicableWeakness.exceptions, lowerType)
            ) {
              // Exception applies - ignore this weakness
            } else {
              // Apply weakness value (double it if doubleVs condition matches)
              let weaknessValue = applicableWeakness.value;
              if (
                applicableWeakness.doubleVs &&
                rollMatchesCondition(roll, applicableWeakness.doubleVs, lowerType)
              ) {
                weaknessValue = weaknessValue * 2;
              }
              damageOfThisType += weaknessValue;
              // Mark this weakness as applied
              if (weakness) appliedWeaknesses.add(lowerType);
              if (allDamageWeakness) appliedWeaknesses.add("all damage");
            }
          }

          // Also check weaknesses against damageCategories (e.g., materials like "cold-iron", "silver")
          const damageCategories = roll?.metadata?.damageCategories || [];
          damageCategories.forEach((category) => {
            const categoryNormalized = category
              .toLowerCase()
              .trim()
              .replace(/-/g, "")
              .replace(/ /g, "");

            // Find matching weakness by normalizing the weakness type
            const matchingWeaknessKey = Object.keys(IWR.weaknesses).find(
              (weaknessKey) => {
                const weaknessNormalized = weaknessKey
                  .toLowerCase()
                  .trim()
                  .replace(/-/g, "")
                  .replace(/ /g, "");
                return weaknessNormalized === categoryNormalized;
              },
            );

            if (matchingWeaknessKey) {
              const matchingWeaknessNormalized = matchingWeaknessKey
                .toLowerCase()
                .trim()
                .replace(/-/g, "")
                .replace(/ /g, "");

              // Skip if we've already applied this weakness
              if (appliedWeaknesses.has(matchingWeaknessNormalized)) {
                return;
              }

              const categoryWeakness = IWR.weaknesses[matchingWeaknessKey];
              // Check if this weakness has an exception that matches the roll
              if (
                categoryWeakness.exceptions &&
                rollMatchesCondition(roll, categoryWeakness.exceptions, lowerType)
              ) {
                // Exception applies - ignore this weakness
              } else {
                // Apply weakness value (double it if doubleVs condition matches)
                let weaknessValue = categoryWeakness.value;
                if (
                  categoryWeakness.doubleVs &&
                  rollMatchesCondition(roll, categoryWeakness.doubleVs, lowerType)
                ) {
                  weaknessValue = weaknessValue * 2;
                }
                damageOfThisType += weaknessValue;
                appliedWeaknesses.add(matchingWeaknessNormalized);
              }
            }
          });
        }

        // Apply Resistances (reduce damage)
        if (!damageIgnoresResistances.includes(lowerType)) {
          // Track which resistances we've applied to avoid duplicates
          const appliedResistances = new Set();

          // Check for specific type resistance
          const resistance = IWR.resistances[lowerType];
          // Check for "all damage" resistance
          const allDamageResistance =
            IWR.resistances["all damage"] || IWR.resistances["all-damage"];

          const applicableResistance = resistance || allDamageResistance;

          if (applicableResistance) {
            // Check if this resistance has an exception that matches the roll
            if (
              applicableResistance.exceptions &&
              rollMatchesCondition(roll, applicableResistance.exceptions, lowerType)
            ) {
              // Exception applies - ignore this resistance
            } else {
              // Apply resistance value (double it if doubleVs condition matches)
              let resistanceValue = applicableResistance.value;
              if (
                applicableResistance.doubleVs &&
                rollMatchesCondition(roll, applicableResistance.doubleVs, lowerType)
              ) {
                resistanceValue = resistanceValue * 2;
              }
              damageOfThisType -= resistanceValue;
              // Mark this resistance as applied
              if (resistance) appliedResistances.add(lowerType);
              if (allDamageResistance) appliedResistances.add("all damage");
            }
          }

          // Also check resistances against damageCategories (e.g., materials like "cold-iron", "silver")
          const damageCategories = roll?.metadata?.damageCategories || [];
          damageCategories.forEach((category) => {
            const categoryNormalized = category
              .toLowerCase()
              .trim()
              .replace(/-/g, "")
              .replace(/ /g, "");

            // Find matching resistance by normalizing the resistance type
            const matchingResistanceKey = Object.keys(IWR.resistances).find(
              (resistanceKey) => {
                const resistanceNormalized = resistanceKey
                  .toLowerCase()
                  .trim()
                  .replace(/-/g, "")
                  .replace(/ /g, "");
                return resistanceNormalized === categoryNormalized;
              },
            );

            if (matchingResistanceKey) {
              const matchingResistanceNormalized = matchingResistanceKey
                .toLowerCase()
                .trim()
                .replace(/-/g, "")
                .replace(/ /g, "");

              // Skip if we've already applied this resistance
              if (appliedResistances.has(matchingResistanceNormalized)) {
                return;
              }

              const categoryResistance = IWR.resistances[matchingResistanceKey];
              // Check if this resistance has an exception that matches the roll
              if (
                categoryResistance.exceptions &&
                rollMatchesCondition(roll, categoryResistance.exceptions, lowerType)
              ) {
                // Exception applies - ignore this resistance
              } else {
                // Apply resistance value (double it if doubleVs condition matches)
                let resistanceValue = categoryResistance.value;
                if (
                  categoryResistance.doubleVs &&
                  rollMatchesCondition(roll, categoryResistance.doubleVs, lowerType)
                ) {
                  resistanceValue = resistanceValue * 2;
                }
                damageOfThisType -= resistanceValue;
                appliedResistances.add(matchingResistanceNormalized);
              }
            }
          });
        }

        // Ensure this damage type doesn't go below 0
        finalDamageByType[type] = Math.max(0, damageOfThisType);
      });

      // Calculate final damage by summing all damage types after IWR
      // Each type has already been capped at 0, so total can't be negative
      damage = Object.values(finalDamageByType).reduce(
        (sum, dmg) => sum + dmg,
        0,
      );

      // Precision-specific IWR (immunity/resistance/weakness) was already
      // applied to the precision portion before the main IWR loop above, so
      // there is nothing further to adjust here.

      // Subtract healing amount from damage (can make damage negative)
      damage -= healingAmount;

      // Apply target's hardness (for objects, hazards, and constructs)
      // Hardness reduces damage before it's applied to HP
      // Only apply if damage is positive (not healing)
      let hardnessReduction = 0;
      if (damage > 0) {
        const targetHardness = parseInt(target.data?.hardness || "0", 10);
        if (targetHardness > 0) {
          hardnessReduction = Math.min(targetHardness, damage);
          damage = Math.max(0, damage - targetHardness);
        }
      }

      // Handle shield damage if shieldDamage is true and shield is raised
      let shieldAbsorbed = 0;
      let shieldDamaged = false;
      let shieldData = null;
      if (shieldDamage && damage > 0) {
        // Get the best equipped shield (works for both characters and NPCs)
        const bestArmor = getBestEquippedArmor(target);
        const shield = bestArmor?.shield;

        if (shield && shield.shieldId && shield.shieldIndex !== null) {
          let hardness = shield.hardness || 0;

          // Check for Deflecting trait
          // Deflecting trait increases shield hardness by 2 against specific damage types
          const shieldTraits = shield.traits || [];
          const damageType = (roll.metadata?.damageType || "")
            .toLowerCase()
            .trim();

          if (damageType) {
            // Look for Deflecting traits (e.g., "Deflecting Bludgeoning")
            const deflectingTrait = shieldTraits.find((trait) => {
              const traitName = trait.toLowerCase().trim();
              return traitName.startsWith("deflecting");
            });

            if (deflectingTrait) {
              // Extract the damage type from the trait name
              // e.g., "Deflecting Bludgeoning" -> "bludgeoning"
              const traitName = deflectingTrait.toLowerCase().trim();
              const deflectingType = traitName
                .split(" ")?.[1]
                ?.toLowerCase()
                ?.trim();

              // If the deflecting type matches the damage type, add 2 to hardness
              if (deflectingType === damageType) {
                hardness += 2;
              }
            }
          }

          const currentShieldHp = shield.hp.value || 0;
          const maxShieldHp = shield.hp.max || 0;

          // Shield blocks damage equal to its hardness
          shieldAbsorbed = Math.min(hardness, damage);
          damage = Math.max(0, damage - hardness);

          // Apply remaining damage to the shield's HP
          const shieldDamageAmount = damage;
          const newShieldHp = Math.max(0, currentShieldHp - shieldDamageAmount);

          // Calculate broken threshold (half of max HP)
          const brokenThreshold = Math.floor(maxShieldHp / 2);
          const wasShieldBroken = target.data?.shieldBroken === true;
          const isShieldBroken = newShieldHp <= brokenThreshold;

          if (shieldDamageAmount > 0 || isShieldBroken !== wasShieldBroken) {
            shieldDamaged = true;
            shieldData = {
              shieldIndex: shield.shieldIndex,
              newShieldHp,
              isShieldBroken,
              wasShieldBroken,
              shieldDamageAmount,
              brokenThreshold,
              maxShieldHp,
            };
          }
        }
      }

      var curhp = target.data?.curhp || 0;
      const maxHp = target.data?.hitpoints || 0;
      const oldTempHp = parseInt(target.data?.tempHp || "0", 10);

      // Check for Massive Damage (instant death)
      // "You die instantly if you ever take damage equal to or greater than double your maximum Hit Points in one blow."
      // This uses the actual damage taken after all reductions (IWR, half damage, etc.)
      let massiveDamage = false;
      if (damage >= maxHp * 2) {
        massiveDamage = true;
      }

      // Collect all values to change and their old values for undo
      const valuesToSet = {};
      const oldValues = {};

      // Store old values
      const oldHp = curhp;
      oldValues["data.curhp"] = oldHp;
      oldValues["data.tempHp"] = oldTempHp;

      // Float text for damage or healing
      if (damage !== 0) {
        if (damage > 0) {
          // Damage - red text
          let message = `-${damage}`;
          if (immuneToCritical && isCritical) {
            message += "\n(Immune to Critical Hits)";
          }
          api.floatText(target, message, "#FF0000");
        } else {
          // Healing (negative damage) - green text
          const healAmount = Math.abs(damage);
          api.floatText(target, `+${healAmount}`, "#1bc91b");
        }
      }

      // Handle temp HP and healing
      let usedTempHp = false;

      if (damage > 0) {
        // Damage: First deduct from Temp HP
        const newTempHp = Math.max(oldTempHp - damage, 0);
        damage = Math.max(damage - oldTempHp, 0);
        if (newTempHp !== oldTempHp) {
          valuesToSet["data.tempHp"] = newTempHp;
          usedTempHp = true;
        }
        // Then deduct from Current HP
        curhp -= damage;
      } else if (damage < 0) {
        // Healing: Add to current HP (damage is negative, so subtract it)
        curhp -= damage;
      }

      // Check for instant death conditions
      let instantDeath = false;
      let deathReason = "";

      if (massiveDamage) {
        instantDeath = true;
        deathReason = "MASSIVE DAMAGE";
      } else if (hasDeathTrait && curhp <= 0) {
        // Death trait: "If you are reduced to 0 Hit Points by a death effect, you are slain instantly"
        instantDeath = true;
        deathReason = "DEATH EFFECT";
      }

      if (curhp < 0) {
        curhp = 0;
      }
      if (curhp > maxHp) {
        curhp = maxHp;
      }

      valuesToSet["data.curhp"] = curhp;

      // Apply shield damage updates if shield was damaged
      if (shieldDamaged && shieldData) {
        // Get the best equipped shield again to access original values
        const bestArmor = getBestEquippedArmor(target);
        const shield = bestArmor?.shield;

        // Update shield HP on both the item and the character/NPC record
        valuesToSet[`data.inventory.${shieldData.shieldIndex}.data.hp.value`] =
          shieldData.newShieldHp;
        valuesToSet["data.shieldHp"] = shieldData.newShieldHp;

        // Update broken status if it changed
        if (shieldData.isShieldBroken !== shieldData.wasShieldBroken) {
          valuesToSet["data.shieldBroken"] = shieldData.isShieldBroken;
        }

        // Store old values for undo
        if (shield) {
          oldValues[`data.inventory.${shieldData.shieldIndex}.data.hp.value`] =
            shield.hp.value;
          oldValues["data.shieldHp"] = target.data?.shieldHp || 0;
          if (shieldData.isShieldBroken !== shieldData.wasShieldBroken) {
            oldValues["data.shieldBroken"] = shieldData.wasShieldBroken;
          }
        }
      }

      const unIdentified = target.identified === false;
      const targetName = !unIdentified
        ? target.name || target.record.name
        : target.unidentifiedName || target.record.unidentifiedName;

      let message;
      if (damage < 0) {
        // Healing message
        const healAmount = Math.abs(damage);
        message = `${targetName} was healed ${healAmount} HP.`;
      } else {
        // Damage message
        message = isApplyingSplash
          ? `${targetName} took ${damage} splash damage.`
          : `${targetName} took ${damage} damage.`;
        if (usedTempHp && !isApplyingSplash) {
          message = `${targetName} took ${damage} damage after deducting Temp HP.`;
        } else if (usedTempHp && isApplyingSplash) {
          message = `${targetName} took ${damage} splash damage after deducting Temp HP.`;
        }
      }

      // Add shield damage message if shield was damaged
      if (shieldDamaged && shieldData) {
        if (shieldAbsorbed > 0) {
          message += `\n**Shield blocked ${shieldAbsorbed} damage** (Hardness)`;
        }
        if (shieldData.shieldDamageAmount > 0) {
          message += `\n**Shield took ${shieldData.shieldDamageAmount} damage** (${shieldData.newShieldHp}/${shieldData.maxShieldHp} HP remaining)`;
        }
        if (shieldData.isShieldBroken && !shieldData.wasShieldBroken) {
          message += `\n**[color=orange]Shield is now BROKEN![/color]**`;
        }
      }

      // Add hardness reduction message if applicable
      if (hardnessReduction > 0) {
        message += `\n**Hardness blocked ${hardnessReduction} damage**`;
      }

      // Handle death conditions
      if (instantDeath) {
        message += `\n**[center][color=red]INSTANT DEATH (${deathReason})[/color][/center]**`;
        // For characters, set dying to 4+ (dead)
        if (target.recordType === "characters") {
          oldValues["data.dying"] = parseInt(target.data?.dying || "0", 10);
          oldValues["data.wounded"] = parseInt(target.data?.wounded || "0", 10);
          valuesToSet["data.dying"] = 4;
          valuesToSet["data.wounded"] = 0;
          api.addEffect("Dead", target);
        }
        // For NPCs, add Dead effect
        if (target.recordType === "npcs") {
          api.addEffect("Dead", target);
        }
      } else if (curhp <= 0 && damage > 0) {
        // Not instant death, but reduced to 0 HP
        const isObject =
          target.recordType === "npcs" &&
          (target.data?.type === "hazard" || target.data?.type === "vehicle");
        const isCompanion =
          target.recordType === "npcs" && target.data?.type === "familiar";
        if (target.recordType === "characters" || isCompanion) {
          // Characters and their companions gain Dying condition
          const currentDying = parseInt(target.data?.dying || "0", 10);
          let wounded = 0;

          // Only add wounded if we're gaining the dying condition (currentDying === 0)
          if (currentDying === 0) {
            wounded = parseInt(target.data?.wounded || "0", 10);
          }

          // Store old values
          oldValues["data.dying"] = currentDying;

          // Calculate new dying value
          let newDying = currentDying + 1 + wounded;

          // Check if this is from a critical hit (if isCritical is available)
          // If target is immune to critical hits, treat as normal hit
          if (
            typeof isCritical !== "undefined" &&
            isCritical &&
            !immuneToCritical
          ) {
            newDying = currentDying + 2 + wounded;
            message += `\n${targetName} gains Dying ${newDying} (critical hit increases dying by 2).`;
          } else {
            message += `\n${targetName} gains Dying ${newDying}.`;
          }

          // Cap dying at 4 (death)
          if (newDying > 4) {
            newDying = 4;
          }

          valuesToSet["data.dying"] = newDying;

          // Check if dying >= 4 (death)
          if (newDying >= 4) {
            api.addEffect("Dead", target);
            message += `\n**[center][color=red]DEAD (Dying ${newDying})[/color][/center]**`;
          } else {
            if (
              target.effects.find((effect) => effect.name === "Unconscious") ===
              undefined
            ) {
              api.addEffects(["Unconscious", "Prone"], target);
            }
          }
        } else if (target.recordType === "npcs") {
          // NPCs just die at 0 HP
          api.addEffect("Dead", target);
          message += `\n${targetName} is ${isObject ? "destroyed" : "dead"}.`;
        }
      }

      // Apply all value changes in a single batch
      if (Object.keys(valuesToSet).length > 0) {
        api.setValuesOnTokenById(
          target._id,
          target.recordType,
          valuesToSet,
          () => {
            // After applying damage, check if token was reduced to 0 HP
            // If so, move their initiative to directly before the current turn
            if (curhp <= 0 && damage > 0) {
              api.getCombatTracker((combatTracker) => {
                if (combatTracker && combatTracker.initiative !== undefined) {
                  const newInitiative =
                    Math.floor(combatTracker.initiative) + 1;
                  api.setValuesOnTokenById(target._id, target.recordType, {
                    "data.initiative": newInitiative,
                  });
                }
              });
            }
          },
        );
      }

      // Build undo macro with all old values as a single batch operation
      // Include undo for both damage (damage > 0) and healing (damage < 0)
      const macro =
        damage !== 0 && !instantDeath && Object.keys(oldValues).length > 0
          ? `\n\`\`\`Undo\nif (isGM) { api.setValuesOnTokenById('${
              target._id
            }', '${target.recordType}', ${JSON.stringify(
              oldValues,
            )}); api.editMessage(null, \`~${message}~\`); } else { api.showNotification('Only the GM can undo damage.', 'yellow', 'Notice'); }\n\`\`\``
          : "";

      // Build tags array for armor specialization
      const tags = [];
      if (targetHasArmorSpecialization && targetArmorGroup) {
        const armorSpecDetails =
          getArmorSpecializationDetails(targetArmorGroup);
        if (armorSpecDetails.description) {
          tags.push({
            name: `${capitalize(armorSpecDetails.group)} Specialization`,
            tooltip: armorSpecDetails.description,
          });
        }
      }

      // Add tags for runes on the target's armor
      targetPropertyRunes.forEach((rune) => {
        tags.push({
          name: getArmorRuneDetails(rune).displayName || "",
          tooltip: getArmorRuneDetails(rune).description || "",
        });
      });

      api.sendMessage(
        `${message}${macro}`,
        undefined,
        undefined,
        tags.length > 0 ? tags : undefined,
        target,
      );
    }
  });
}

function performInitiativeRoll(record) {
  const initiativeSkill = record.data?.initiativeSkill || "Perception";
  rollSkill(
    record,
    initiativeSkill.toLowerCase(),
    null,
    false,
    0,
    1,
    "int",
    false,
    true,
    undefined,
    {
      initiativeSkill: initiativeSkill,
    },
  );
}

function replaceWithDamageMacro() {
  api.showNotification(
    "This macro must be used from the the Chat after using this ability.",
    "red",
    "Requires Use",
  );
}

/**
 * Creates a damage macro for a given formula and category
 * @param {string} formula - Damage formula like "1d6 fire" or "2d4 + 3 bludgeoning"
 * @param {string} category - Damage category: "persistent", "splash", "precision", "standard", or undefined
 * @param {string} name - Optional name for the macro (defaults to formula)
 * @param {Object} context - Context object that may contain item data
 * @returns {string} - Macro string that can be executed
 */
function executeDamageMacro(
  formula,
  category = "standard",
  name = null,
  context = {},
) {
  if (!formula || formula.trim() === "") {
    return "";
  }

  // Replace @item.level or @item.rank with actual item level from context
  // Context can have:
  //   - context.level (for heightened spells or explicit level override)
  //   - context.item.data.level (for full item objects)
  //   - Default to 1 if neither is available
  let processedFormula = formula.trim();

  const itemLevel =
    context.level !== undefined
      ? context.level
      : context?.item?.data?.level || 1;

  // First replace @item.level/@item.rank with actual value
  processedFormula = processedFormula.replace(
    /@item\.(level|rank)/gi,
    itemLevel,
  );

  // Then evaluate any mathematical expressions like floor(2/2), (3), etc.
  // This handles cases like: floor(@item.level/2) -> floor(2/2) -> 1
  // or (@item.level) -> (2) -> 2
  processedFormula = processedFormula.replace(
    /\(([0-9+\-*/.]+)\)|floor\([^)]+\)|ceil\([^)]+\)|min\([^)]+\)|max\([^)]+\)|abs\([^)]+\)/gi,
    (match) => {
      const evaluated = evaluateMath(match);
      return String(evaluated);
    },
  );

  // Check for formulas with both standard and persistent damage
  // Example: "5d6 bludgeoning and 2d8 persistent electricity damage"
  let persistentDamage = null;
  const persistentMatch = processedFormula.match(
    /\s+and\s+([0-9d+\-*/.() ]+)\s+persistent\s+([a-z]+)(\s+damage)?/i,
  );
  if (persistentMatch) {
    // Extract persistent damage formula and type
    const persistentFormula = persistentMatch[1].trim();
    const persistentType = persistentMatch[2].trim();
    persistentDamage = `${persistentFormula} ${persistentType}`;

    // Remove the persistent damage portion from the main formula
    processedFormula = processedFormula.replace(persistentMatch[0], "").trim();
  }

  // Extract damage type from formula (last word should be the damage type)
  const parts = processedFormula.split(/\s+/);
  const damageType = parts[parts.length - 1] || "untyped";

  // Clean formula and damage type
  const cleanFormula = processedFormula;
  const macroName = name || cleanFormula.replace(/\s+/g, "_");

  const traits = context.traits || [];
  // Add vitality/void to traits if they are in the formula
  if (processedFormula.includes("vitality")) {
    traits.push("vitality");
  }
  if (processedFormula.includes("void")) {
    traits.push("void");
  }

  let metadata = {
    rollName: `${macroName} Damage`,
    damageType: damageType,
    traits,
  };

  // Add persistent damage to metadata if it exists
  if (persistentDamage) {
    metadata.persistentDamage = persistentDamage;
  }

  let mainDamage = cleanFormula;
  let modifiers = [];

  // Handle different categories
  if (category === "persistent") {
    // For persistent damage, directly apply the persistent damage effect
    applyPersistentDamage(
      cleanFormula,
      context.originTokenId,
      context.originTokenName,
    );
    return;
  } else if (category === "splash") {
    // Splash damage goes in metadata and criticalOnlyDice so it doesn't double on crits
    metadata.splashDamage = cleanFormula;

    // Parse splash damage to add to criticalOnlyDice
    const splashMatch = cleanFormula.match(
      /^([0-9]*d[0-9]+|[0-9]+)\s+([a-z]+)$/i,
    );
    if (splashMatch) {
      const splashFormula = splashMatch[1];
      const splashType = splashMatch[2].toLowerCase();

      let splashDieType = 0;
      let splashFlatDamage = 0;

      const diceMatch = splashFormula.match(/\d*d(\d+)/);
      if (diceMatch) {
        splashDieType = parseInt(diceMatch[1], 10);
      } else {
        splashFlatDamage = parseInt(splashFormula, 10) || 0;
      }

      metadata.criticalOnlyDice = [
        {
          dieType: splashDieType,
          damageType: splashType,
          flatDamage: splashFlatDamage,
        },
      ];
    }

    // Splash is also added to main damage
    mainDamage = cleanFormula;
  } else if (category === "precision") {
    // Precision damage is added as a modifier with precisionDamage flag
    modifiers.push({
      name: "Precision Damage",
      value: cleanFormula,
      active: true,
      type: damageType,
      valueType: "string",
      precisionDamage: true,
    });

    metadata.precisionModifierIndices = [0]; // First modifier is precision
    mainDamage = "0"; // No base damage, only precision modifier
  } else {
    // Standard damage - just roll normally
    mainDamage = cleanFormula;
  }

  api.promptRoll(
    macroName,
    mainDamage,
    modifiers,
    metadata,
    category === "healing" ? "healing" : "damage",
  );
}

/**
 * Updates a description by replacing replaceWithDamageMacro(...) calls with executeDamageMacro(...) calls
 * @param {string} description - The markdown description text
 * @param {Object} context - Context object containing:
 *   - item: the item/spell/action object with _id and recordType
 *   - level: optional override level (e.g., casting rank for heightened spells)
 * @returns {string} - Updated description with function calls replaced
 */
function updateDamageMacros(description, context = {}) {
  if (!description || typeof description !== "string") {
    return description;
  }

  const token = api.getToken();
  const tokenId = token?._id;
  const tokenName =
    token?.identified === false
      ? token?.record?.unidentifiedName
      : token?.record?.name;

  // Build minimal context with _id, recordType, and level
  const item = context.item;
  if (!item || !item._id || !item.recordType) {
    return description;
  }

  // Use provided level (e.g., casting rank) or fall back to item's level
  const level =
    context.level !== undefined ? context.level : item.data?.level || 1;

  const minimalContext = JSON.stringify({
    _id: item._id,
    recordType: item.recordType,
    level: level,
    originTokenId: tokenId,
    originTokenName: tokenName,
  });

  // Find all instances of replaceWithDamageMacro(...) and replace them
  // Pattern: replaceWithDamageMacro('formula', 'category', 'name') or replaceWithDamageMacro("formula", "category", "name")
  // Supports both single and double quotes
  const result = description.replace(
    /replaceWithDamageMacro\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"])?(?:,\s*['"]([^'"]*)['"]\s*)?\)/g,
    (match, formula, category, name) => {
      // Build the executeDamageMacro function call string
      const categoryParam = category ? `"${category}"` : '"standard"';
      const nameParam = name ? `"${name}"` : "null";

      return `executeDamageMacro("${formula}", ${categoryParam}, ${nameParam}, ${minimalContext})`;
    },
  );
  return result;
}

// Treat Wounds Macro for Pathfinder 2e
// This function handles the Treat Wounds action from the Medicine skill
function treatWounds() {
  let selectedTokens = api.getSelectedOrDroppedToken();

  // If no tokens selected, try to get the current token
  if (!selectedTokens || selectedTokens.length === 0) {
    return;
  }

  // Get the first selected token (the healer)
  let healer = selectedTokens[0];

  // If healer has a .token property, use that (it's wrapped)
  if (healer && healer.token) {
    healer = healer.token;
  }

  // Ensure we have a valid healer with data
  if (!healer || !healer.data) {
    return;
  }

  // Get Medicine skill information
  const medicineMod = parseInt(healer.data?.medicineMod || "0", 10);
  const medicineTraining = parseInt(healer.data?.medicine || "0", 10);

  // Training levels: 0 = Untrained, 1 = Trained, 2 = Expert, 3 = Master, 4 = Legendary
  const proficiencyNames = [
    "Untrained",
    "Trained",
    "Expert",
    "Master",
    "Legendary",
  ];
  const proficiencyName = proficiencyNames[medicineTraining] || "Untrained";

  // Check if character is trained in Medicine
  if (medicineTraining < 1) {
    api.showNotification(
      "You must be at least Trained in Medicine to use Treat Wounds",
      "red",
      "Notice",
    );
    return;
  }

  // Determine available DC options based on proficiency
  const dcOptions = [
    { label: "DC 15 (Trained) - Restore 2d8 HP", value: "15" },
  ];

  if (medicineTraining >= 2) {
    dcOptions.push({
      label: "DC 20 (Expert) - Restore 2d8+10 HP",
      value: "20",
    });
  }
  if (medicineTraining >= 3) {
    dcOptions.push({
      label: "DC 30 (Master) - Restore 2d8+30 HP",
      value: "30",
    });
  }
  if (medicineTraining >= 4) {
    dcOptions.push({
      label: "DC 40 (Legendary) - Restore 2d8+50 HP",
      value: "40",
    });
  }

  // Get targets for healing
  const targets = api.getTargets();
  let targetInfo = "";
  if (targets && targets.length > 0) {
    targetInfo = `Target${targets.length > 1 ? "s" : ""}: ${targets
      .map((t) => t.name)
      .join(", ")}`;
  }

  // Prompt for DC selection
  api.showPrompt(
    "Treat Wounds",
    `Select the DC for your Medicine check.\n\n${proficiencyName} in Medicine (${
      medicineMod >= 0 ? "+" : ""
    }${medicineMod})\n\n${targetInfo}\n\nNote: This takes 10 minutes. Target becomes immune to Treat Wounds for 1 hour.\nTreating for a full hour doubles the healing.`,
    "Select DC...",
    dcOptions,
    null,
    (selectedDC) => {
      if (!selectedDC) return;

      const dc = parseInt(selectedDC, 10);

      // Determine healing amounts based on DC
      let successHealing = "2d8";
      let critSuccessHealing = "4d8";

      if (dc === 20) {
        successHealing = "2d8 + 10";
        critSuccessHealing = "4d8 + 10";
      } else if (dc === 30) {
        successHealing = "2d8 + 30";
        critSuccessHealing = "4d8 + 30";
      } else if (dc === 40) {
        successHealing = "2d8 + 50";
        critSuccessHealing = "4d8 + 50";
      }

      // Build modifiers array for the Medicine check
      const modifiers = [];

      if (medicineMod !== 0) {
        modifiers.push({
          name: `Medicine (${proficiencyName})`,
          type: "",
          value: medicineMod,
          active: true,
        });
      }

      // Get Medicine skill-specific modifiers
      const additionalModsSet = new Set();
      const skillMods = getEffectsAndModifiersForToken(
        healer,
        ["skillBonus", "skillPenalty"],
        "medicine",
      );

      skillMods.forEach((mod) => {
        const modString = modToString(mod);
        if (!additionalModsSet.has(modString)) {
          additionalModsSet.add(modString);
          modifiers.push(mod);
        }
      });

      // Get Wisdom-based all modifiers (Medicine uses Wisdom by default)
      const wisdomAbility = healer.data?.medicineAbility || "wis";
      const allMods = getEffectsAndModifiersForToken(
        healer,
        ["allBonus", "allPenalty"],
        wisdomAbility,
      );

      allMods.forEach((mod) => {
        const modString = modToString(mod);
        if (!additionalModsSet.has(modString)) {
          additionalModsSet.add(modString);
          modifiers.push(mod);
        }
      });

      // Get degree of success adjustments
      const degreeOfSuccessAdjustments = getDegreeOfSuccessAdjustments(healer, [
        "medicine",
        wisdomAbility,
      ]);

      // Prepare metadata for the roll
      const metadata = {
        rollName: "Treat Wounds",
        tooltip: "Treat Wounds (Medicine Check)",
        skillName: "medicine",
        dc: dc,
        degreeOfSuccessAdjustments: degreeOfSuccessAdjustments,
        action: "Treat Wounds",
        // Store healing info for the roll handler
        treatWounds: {
          successHealing: successHealing,
          critSuccessHealing: critSuccessHealing,
          dc: dc,
        },
      };

      // Make the Medicine check
      api.promptRoll(
        "Treat Wounds (Medicine)",
        "1d20",
        modifiers,
        metadata,
        "skill",
      );
    },
    "Roll",
    "Cancel",
    1,
  );
}

// Elemental Blast - Kineticist impulse attack
function elementalBlast() {
  const record = api.getToken();
  if (!record) {
    api.showNotification("No character selected", "red", "Error");
    return;
  }

  // Element configuration: damage die, damage types available, and range
  const elementData = {
    air: {
      die: "d6",
      types: ["electricity", "slashing"],
      range: 60,
    },
    earth: {
      die: "d8",
      types: ["bludgeoning", "piercing"],
      range: 30,
    },
    fire: {
      die: "d6",
      types: ["fire"],
      range: 60,
    },
    metal: {
      die: "d8",
      types: ["piercing", "slashing"],
      range: 30,
    },
    water: {
      die: "d8",
      types: ["bludgeoning", "cold"],
      range: 30,
    },
    wood: {
      die: "d8",
      types: ["bludgeoning", "vitality"],
      range: 30,
    },
  };

  // Check which elements the character has access to via flags
  const availableElements = new Set();
  const flags = record.data?.flags || {};

  // Iterate through all flags and check for any that start with "element"
  Object.keys(flags).forEach((flagKey) => {
    if (flagKey.toLowerCase().startsWith("element")) {
      const element = flags[flagKey];
      if (element && elementData[element.toLowerCase().replace("-gate", "")]) {
        availableElements.add(element.toLowerCase().replace("-gate", ""));
      }
    }
  });

  // Helper function to continue with a selected element
  const continueWithElement = (element) => {
    const elementKey = element.toLowerCase();
    if (!elementData[elementKey]) {
      api.showNotification(
        `Invalid element: ${element}. Valid options: air, earth, fire, metal, water, wood`,
        "red",
        "Error",
      );
      return;
    }

    const chosenElement = elementData[elementKey];
    const level = record.data?.level || 1;

    // Calculate number of damage dice (base + 1 per 4 levels)
    const damageDice = 1 + Math.floor(level / 4);

    // Helper function to continue with the selected damage type
    const continueWithDamageType = (selectedDamageType) => {
      // Extract from array if needed (api.showPrompt returns arrays)
      selectedDamageType = Array.isArray(selectedDamageType)
        ? selectedDamageType[0]
        : selectedDamageType;
      if (!selectedDamageType) return;

      // Step 2: Prompt for melee or ranged
      const attackTypeOptions = [
        { label: "Melee", value: "melee" },
        { label: `Ranged (${chosenElement.range} feet)`, value: "ranged" },
      ];

      api.showPrompt(
        "Elemental Blast - Attack Type",
        "Choose melee or ranged attack:",
        "Select Type...",
        attackTypeOptions,
        null,
        (selectedAttackType) => {
          // Extract from array if needed (api.showPrompt returns arrays)
          selectedAttackType = Array.isArray(selectedAttackType)
            ? selectedAttackType[0]
            : selectedAttackType;
          if (!selectedAttackType) return;

          // Step 3: Prompt for action count
          const actionOptions = [
            { label: "1 Action", value: "1" },
            { label: "2 Actions (add Constitution to damage)", value: "2" },
          ];

          api.showPrompt(
            "Elemental Blast - Actions",
            "How many actions are you using?",
            "Select Actions...",
            actionOptions,
            null,
            (selectedActions) => {
              // Extract from array if needed (api.showPrompt returns arrays)
              selectedActions = Array.isArray(selectedActions)
                ? selectedActions[0]
                : selectedActions;
              if (!selectedActions) return;

              const isMelee = selectedAttackType === "melee";
              const isTwoAction = selectedActions === "2";

              // Build traits array
              const traits = [
                "attack",
                "impulse",
                "kineticist",
                "primal",
                elementKey,
              ];

              // Add damage type as trait if it's not a physical damage type
              const physicalTypes = ["bludgeoning", "piercing", "slashing"];
              if (!physicalTypes.includes(selectedDamageType.toLowerCase())) {
                traits.push(selectedDamageType.toLowerCase());
              }

              // Add range trait if ranged
              if (!isMelee) {
                traits.push(`range ${chosenElement.range}`);
              }

              // Build damage formula
              const damageFormula = `${damageDice}${chosenElement.die}`;

              // If 2-action version, add Constitution modifier directly to damage
              const conMod = isTwoAction ? record.data?.con || 0 : 0;

              // Build damageRolls array
              const damageRolls = [
                {
                  _id: generateUuid(),
                  data: {
                    formula: damageFormula,
                    type: selectedDamageType,
                    category: "standard",
                    modifier: conMod,
                  },
                },
              ];

              // Calculate impulse attack bonus (Class DC - 10)
              const classDC = record.data?.classDC || 10;
              const impulseAttackBonus = classDC - 10;

              // For melee impulse attacks, add Strength modifier
              let meleeMod = 0;
              if (isMelee) {
                meleeMod = record.data?.str || 0;
              }

              // Create synthetic weapon object for the impulse attack
              const syntheticWeapon = {
                _id: generateUuid(),
                name: `Elemental Blast (${
                  elementKey.charAt(0).toUpperCase() + elementKey.slice(1)
                })`,
                recordType: "npc_attacks",
                data: {
                  weaponType: isMelee ? "melee" : "ranged",
                  range: isMelee ? 0 : chosenElement.range,
                  traits: traits,
                  damageRolls: damageRolls,
                  damage: { die: chosenElement.die }, // For @dieSize replacement
                  bonus: impulseAttackBonus + meleeMod, // Impulse attack bonus + Strength for melee
                },
              };

              // Get attack modifiers for elemental-blast (now that weapon exists for context)
              const seenAttackMods = new Set();
              const extraAttackModifiers = [];

              // Get elemental-blast specific attack modifiers
              const blastAttackMods = getEffectsAndModifiersForToken(
                record,
                ["attackBonus", "attackPenalty"],
                "elemental-blast",
                undefined,
                undefined,
                { weapon: syntheticWeapon },
              );
              blastAttackMods.forEach((mod) => {
                const modString = modToString(mod);
                if (!seenAttackMods.has(modString)) {
                  seenAttackMods.add(modString);
                  extraAttackModifiers.push(mod);
                }
              });

              // Also get general all bonuses/penalties for elemental-blast
              const allAttackMods = getEffectsAndModifiersForToken(
                record,
                ["allBonus", "allPenalty"],
                "elemental-blast",
                undefined,
                undefined,
                { weapon: syntheticWeapon },
              );
              allAttackMods.forEach((mod) => {
                const modString = modToString(mod);
                if (!seenAttackMods.has(modString)) {
                  seenAttackMods.add(modString);
                  extraAttackModifiers.push(mod);
                }
              });

              // Get damage modifiers for elemental-blast
              const seenDamageMods = new Set();
              const extraDamageModifiers = [];

              // Get elemental-blast specific damage modifiers
              const blastDamageMods = getEffectsAndModifiersForToken(
                record,
                ["damageBonus", "damagePenalty"],
                "elemental-blast",
                undefined,
                undefined,
                { weapon: syntheticWeapon },
              );
              blastDamageMods.forEach((mod) => {
                const modString = modToString(mod);
                if (!seenDamageMods.has(modString)) {
                  seenDamageMods.add(modString);
                  extraDamageModifiers.push(mod);
                }
              });

              // Add the collected modifiers to the weapon
              syntheticWeapon.data.extraAttackModifiers = extraAttackModifiers;
              syntheticWeapon.data.extraDamageModifiers = extraDamageModifiers;

              // Perform the attack roll using the existing function
              performAttackRoll(record, syntheticWeapon, null, 1);
            },
            "Roll Attack",
            "Cancel",
            1,
          );
        },
        "Continue",
        "Cancel",
        1,
      );
    };

    // Step 1: Prompt for damage type (if element has multiple options)
    const damageTypeOptions = chosenElement.types.map((type) => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      value: type,
    }));

    if (damageTypeOptions.length === 1) {
      // Only one option, use it directly
      continueWithDamageType(damageTypeOptions[0].value);
    } else {
      api.showPrompt(
        "Elemental Blast - Damage Type",
        `Choose the damage type for your ${elementKey} blast:`,
        "Select Type...",
        damageTypeOptions,
        null,
        (selectedDamageType) => {
          continueWithDamageType(selectedDamageType);
        },
        "Continue",
        "Cancel",
        1,
      );
    }
  }; // End of continueWithElement

  // Determine which elements to offer based on character flags
  const elementArray = Array.from(availableElements);

  if (elementArray.length === 0) {
    // No elements in flags, prompt for all elements
    const allElementOptions = Object.keys(elementData).map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: key,
    }));

    api.showPrompt(
      "Elemental Blast - Choose Element",
      "Choose your element:",
      "Select Element...",
      allElementOptions,
      null,
      (selectedElement) => {
        selectedElement = Array.isArray(selectedElement)
          ? selectedElement[0]
          : selectedElement;
        if (selectedElement) {
          continueWithElement(selectedElement);
        }
      },
      "Continue",
      "Cancel",
      1,
    );
  } else if (elementArray.length === 1) {
    // Only one element available, use it directly
    continueWithElement(elementArray[0]);
  } else {
    // Multiple elements available, prompt for selection
    const elementOptions = elementArray.map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: key,
    }));

    api.showPrompt(
      "Elemental Blast - Choose Element",
      "Choose your element:",
      "Select Element...",
      elementOptions,
      null,
      (selectedElement) => {
        selectedElement = Array.isArray(selectedElement)
          ? selectedElement[0]
          : selectedElement;
        if (selectedElement) {
          continueWithElement(selectedElement);
        }
      },
      "Continue",
      "Cancel",
      1,
    );
  }
}
