// Limited uses: actions and feats with a frequency ("once per round", "once
// per day"). Each one's row shows the uses left, and Use or Send to Chat
// spends one. With none left it still posts, with a warning, as Foundry PF2e
// does (createUseActionMessage). Uses come back as Foundry recharges them
// (ActorPF2e.recharge):
//   - per turn and per round at the creature's own turn, and per turn at
//     every other creature's turn;
//   - per minute when the encounter ends;
//   - per 10 minutes at Refocus;
//   - up to an hour when an hour passes ("1 Hour Passes" on the sheet);
//   - those, and per day, at daily preparations.
// A frequency per 24 hours, week, month or year is left to the GM, as in
// Foundry. Every counter can also be changed by hand. Loaded as one of the
// ruleset's scripts (ruleset.config.json, otherSettings.scripts), so it
// shares common.js's scope at runtime.

// Foundry's frequency periods, shortest first
const FREQUENCY_PERIODS = ["turn", "round", "PT1M", "PT10M", "PT1H", "PT24H", "day", "P1W", "P1M", "P1Y"];

const FREQUENCY_LABELS = {
  turn: "per turn",
  round: "per round",
  PT1M: "per minute",
  PT10M: "per 10 minutes",
  PT1H: "per hour",
  PT24H: "per 24 hours",
  day: "per day",
  P1W: "per week",
  P1M: "per month",
  P1Y: "per year",
};

// The periods whose uses each reset point brings back
const RECHARGE_PERIODS = {
  turnStart: ["turn", "round"],
  otherTurnStart: ["turn"],
  encounterEnd: ["turn", "round", "PT1M"],
  refocus: ["turn", "round", "PT1M", "PT10M"],
  hour: ["turn", "round", "PT1M", "PT10M", "PT1H"],
  dailyPreparations: ["turn", "round", "PT1M", "PT10M", "PT1H", "day"],
};

// Feats that change another one's frequency, as Foundry's ItemAlteration
// rules do: Incredible Ferocity makes Orc Ferocity once per hour
const FREQUENCY_ALTERATIONS = {
  "orc ferocity": { feat: "Incredible Ferocity", per: "PT1H" },
};

// The character's lists whose rows have a Use or Send to Chat button
const LIMITED_USE_LISTS = ["actions", "feats", "bonusFeats"];

// A feat's or action's name to match on, without a trailing tag such as
// "(Alchemist)", as hasFeatNamed matches
function getLimitedUseName(name) {
  return `${name || ""}`
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

// A frequency written out, as the module's feats give it ("Frequency once
// per 10 minutes", "twice per week"): { max, per } with Foundry's period, or
// null
function parseFrequencyText(description) {
  const text = `${description || ""}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const match = text.match(
    /\bfrequency\b\W*(once|one|twice|two|thrice|three|four|five|\d+)(?:\s+times?)?\s+(?:per|every|each|a)\s+(turn|round|minute|10 minutes|ten minutes|hour|24 hours|day|week|month|year)\b/i,
  );
  if (!match) {
    return null;
  }
  const counts = { once: 1, one: 1, twice: 2, two: 2, thrice: 3, three: 3, four: 4, five: 5 };
  const periods = {
    turn: "turn",
    round: "round",
    minute: "PT1M",
    "10 minutes": "PT10M",
    "ten minutes": "PT10M",
    hour: "PT1H",
    "24 hours": "PT24H",
    day: "day",
    week: "P1W",
    month: "P1M",
    year: "P1Y",
  };
  const word = match[1].toLowerCase();
  return { max: counts[word] || parseInt(word, 10) || 1, per: periods[match[2].toLowerCase()] };
}

// An action's or feat's frequency: its data.frequency, as the module's
// actions carry it, or the one its description gives; null for none
function getItemFrequency(record, item) {
  const data = item?.data?.frequency;
  const max = parseInt(data?.max, 10) || 0;
  let frequency =
    max > 0 && FREQUENCY_PERIODS.includes(data?.per)
      ? { max, per: data.per }
      : parseFrequencyText(item?.data?.description);
  const alteration = FREQUENCY_ALTERATIONS[getLimitedUseName(item?.name)];
  if (frequency && alteration && hasFeatNamed(record, alteration.feat)) {
    frequency = { ...frequency, per: alteration.per };
  }
  return frequency;
}

// The uses an action or feat keeps on the character, { left, max, per,
// label }, or null when it has none
function getLimitedUses(item) {
  const max = parseInt(item?.data?.usesMax || "0", 10) || 0;
  if (max < 1) {
    return null;
  }
  const stored = item.data.usesLeft;
  const left =
    stored === undefined || stored === null || stored === ""
      ? max
      : Math.max(0, Math.min(parseInt(stored, 10) || 0, max));
  return { left, max, per: item.data.usesPeriod, label: item.data.usesLabel || "" };
}

// The values that bring one action's or feat's uses in step with its
// frequency, keyed by path within the item ("data.usesMax"), or null when
// nothing changes. The counter starts full, and keeps what's left.
function getLimitedUseChanges(record, item) {
  if (!item || item.data?.type === "slot") {
    return null;
  }
  const frequency = getItemFrequency(record, item);
  const changes = {};
  const current = (path) => path.split(".").reduce((value, key) => value?.[key], item);
  const set = (path, value) => {
    if (JSON.stringify(current(path)) !== JSON.stringify(value)) {
      changes[path] = value;
    }
  };
  if (frequency) {
    const stored = item.data?.usesLeft;
    // Orc Ferocity used before its uses were kept (dying.js)
    const usedBefore =
      getLimitedUseName(item.name) === "orc ferocity" && !!record.data?.orcFerocityUsed;
    const left =
      stored === undefined || stored === null || stored === ""
        ? usedBefore
          ? 0
          : frequency.max
        : Math.max(0, Math.min(parseInt(stored, 10) || 0, frequency.max));
    set("data.usesMax", frequency.max);
    set("data.usesLeft", left);
    set("data.usesPeriod", frequency.per);
    set("data.usesLabel", FREQUENCY_LABELS[frequency.per]);
    set("fields.usesLeft.hidden", false);
    set("fields.usesLabel.hidden", false);
  } else if (item.data?.usesMax) {
    set("data.usesMax", 0);
    set("fields.usesLeft.hidden", true);
    set("fields.usesLabel.hidden", true);
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

// Keeps the uses on a character's actions and feats in step with their
// frequencies, from onAddEditFeature. A list the same run rewrites whole
// (new feat slots) gets the values on its rows rather than as paths, so the
// two never go in one payload.
function syncLimitedUses(record, valuesToSet) {
  if (record?.recordType !== "characters") {
    return;
  }
  for (const list of LIMITED_USE_LISTS) {
    const key = `data.${list}`;
    const whole = Array.isArray(valuesToSet[key]) ? valuesToSet[key] : null;
    const items = whole || record.data?.[list] || [];
    items.forEach((item, index) => {
      const changes = getLimitedUseChanges(record, item);
      if (!changes) return;
      if (whole) {
        const copy = JSON.parse(JSON.stringify(item));
        for (const [path, value] of Object.entries(changes)) {
          const keys = path.split(".");
          let target = copy;
          for (const step of keys.slice(0, -1)) {
            if (!target[step] || typeof target[step] !== "object") {
              target[step] = {};
            }
            target = target[step];
          }
          target[keys[keys.length - 1]] = value;
        }
        whole[index] = copy;
      } else {
        for (const [path, value] of Object.entries(changes)) {
          valuesToSet[`${key}.${index}.${path}`] = value;
        }
      }
    });
  }
}

// How many uses there are, for messages: "1 per day"
function describeLimitedUseLimit(uses) {
  return `${uses.max}${uses.label ? ` ${uses.label}` : ""}`;
}

// How many uses are left, for chat: "1 of 2 uses left per day"
function describeLimitedUses(uses, left) {
  return `${left} of ${uses.max} use${uses.max === 1 ? "" : "s"} left${uses.label ? ` ${uses.label}` : ""}`;
}

// Spends one use of an action or feat at a path on the sheet's record, as
// Use and Send to Chat do. Returns the line for its chat message: the uses
// left, a warning when none were left (which it also shows), or "" for one
// without uses.
function spendLimitedUse(item, path) {
  const uses = path ? getLimitedUses(item) : null;
  if (!uses) {
    return "";
  }
  if (uses.left < 1) {
    const limit = describeLimitedUseLimit(uses);
    api.showNotification(`${item.name} has no uses left (${limit}).`, "yellow", "No Uses Left");
    return `**No uses left** (${limit})`;
  }
  api.setValues({ [`${path}.data.usesLeft`]: uses.left - 1 });
  return `*${describeLimitedUses(uses, uses.left - 1)}*`;
}

// The values that bring back the uses a reset point recharges
// (RECHARGE_PERIODS) on a character's record or token
function getLimitedUseRecharges(creature, point) {
  const periods = RECHARGE_PERIODS[point] || [];
  const values = {};
  for (const list of LIMITED_USE_LISTS) {
    (creature?.data?.[list] || []).forEach((item, index) => {
      const uses = getLimitedUses(item);
      if (uses && periods.includes(uses.per) && uses.left < uses.max) {
        values[`data.${list}.${index}.data.usesLeft`] = uses.max;
      }
    });
  }
  return values;
}

// The uses a turn start brings back, [{ token, values }]: per turn and per
// round for the character whose turn it is, and per turn for every other
// character in the combat tracker's tokens, each record once
// (getEncounterTokens)
function getTurnStartRecharges(token, tokens) {
  const recharges = [];
  const add = (creature, point) => {
    const values = getLimitedUseRecharges(creature, point);
    if (creature?._id && Object.keys(values).length > 0) {
      recharges.push({ token: creature, values });
    }
  };
  if (token?.recordType === "characters") {
    add(token, "turnStart");
  }
  for (const other of getEncounterTokens(tokens)) {
    if (other.recordType === "characters" && getEncounterTokenKey(other) !== getEncounterTokenKey(token)) {
      add(other, "otherTurnStart");
    }
  }
  return recharges;
}

// The names of the actions and feats a reset brought back, for its message
function describeLimitedUseRecharges(creature, values) {
  const names = Object.keys(values)
    .map((path) => {
      const [, list, index] = path.split(".");
      return creature?.data?.[list]?.[index]?.name;
    })
    .filter(Boolean);
  if (names.length === 0) {
    return "";
  }
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return ` Uses back: ${list}.`;
}

// A character's feat by name, and where it is for spending its uses:
// { path: "data.feats.3", item }, or null
function findFeatRow(record, featName) {
  const wanted = getLimitedUseName(featName);
  for (const list of ["feats", "bonusFeats"]) {
    const feats = record?.data?.[list] || [];
    const index = feats.findIndex(
      (feat) => feat?.data?.type !== "slot" && getLimitedUseName(feat?.name) === wanted,
    );
    if (index >= 0) {
      return { path: `data.${list}.${index}`, item: feats[index] };
    }
  }
  return null;
}
