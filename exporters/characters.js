// Character PDF Export Script for RealmVTT Pathfinder 2e Ruleset
// Produces a multi-page pdfmake docDefinition mirroring the in-app character sheet:
//   1. Main      — portrait, identity, attributes, saves, defenses, IWR
//   2. Actions   — attacks (computed bonus + MAP), actions
//   3. Skills    — skill ranks/mods, lore skills, armor & weapon proficiencies
//   4. Spells    — spellcasting entries, slots, spells by rank, focus points
//   5. Feats     — feats and class/ancestry/heritage features
//   6. Inventory — items, bulk, currency
//   7. Notes     — deity, physical description, notes
//
// Available at runtime:
//   record      — the character record (also exposed as `value`)
//   recordType  — "characters"
//   data.filename — the default filename from the ruleset template
//   api.loadImage(path) — async, returns a base64 data URL for embedding

const d = (record && record.data) || {};
const characterName = (record && record.name) || "Unnamed Character";

// ===== Helpers =====

function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(ul|ol|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function nonEmpty(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function val(v, fallback) {
  return nonEmpty(v) ? String(v) : fallback === undefined ? "—" : fallback;
}

function kv(label, value) {
  return {
    stack: [
      { text: label, style: "label" },
      { text: val(value), style: "value" },
    ],
  };
}

function signed(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return val(n);
  return num >= 0 ? "+" + num : String(num);
}

function titleCase(s) {
  if (!nonEmpty(s)) return "—";
  return String(s).replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

const DESC_MAX = 180;

// Proficiency ranks come from dropdowns as strings "0".."4"; some paths store
// numbers. Normalize before use.
function rankNum(v) {
  const n = parseInt(v || "0", 10);
  return isNaN(n) ? 0 : n;
}

const RANK_LABEL = ["U", "T", "E", "M", "L"];

function rankLabel(v) {
  return RANK_LABEL[rankNum(v)] || "U";
}

const level = parseInt(d.level || "1", 10) || 1;

function abilityMod(key) {
  // PF2e remaster: the stored value IS the modifier.
  const n = parseInt(d[key], 10);
  return isNaN(n) ? 0 : n;
}

// ===== Attack bonus computation =====
// Mirrors the roll-time formula in common.js: rank*2 + level (if trained) +
// ability mod + potency rune. Conditional effect modifiers are intentionally
// ignored — they depend on runtime state.
function weaponProficiencyRank(id) {
  const profs = d.attackProficiencies || {};
  const category = String(id.itemCategory || "").toLowerCase();
  if (category && profs[category] !== undefined) return rankNum(profs[category]);
  const other = profs.other || {};
  const names = String(other.name || "").toLowerCase();
  const group = String(id.group || "").toLowerCase();
  if (names && (names.includes(category) || (group && names.includes(group)))) {
    return rankNum(other.rank);
  }
  return rankNum(profs.simple);
}

function weaponTraits(id) {
  return (Array.isArray(id.traits) ? id.traits : [])
    .map((t) => String(t).toLowerCase())
    .filter(Boolean);
}

function isRangedWeapon(id) {
  return nonEmpty(id.range) && !weaponTraits(id).some((t) => t.startsWith("thrown"));
}

function computeAttackBonus(id) {
  const traits = weaponTraits(id);
  const ranged = isRangedWeapon(id);
  let mod;
  if (ranged) {
    mod = abilityMod("dex");
  } else if (traits.includes("finesse")) {
    mod = Math.max(abilityMod("str"), abilityMod("dex"));
  } else {
    mod = abilityMod("str");
  }
  const rank = weaponProficiencyRank(id);
  const prof = rank > 0 ? rank * 2 + level : 0;
  const potency = parseInt((id.runes && id.runes.potency) || "0", 10) || 0;
  return mod + prof + potency;
}

function damageString(id) {
  const dm = id.damage || {};
  if (nonEmpty(dm.formula)) return String(dm.formula);
  if (!nonEmpty(dm.dice) || !nonEmpty(dm.die)) return "";
  let dice = parseInt(dm.dice, 10) || 1;
  const striking = String((id.runes && id.runes.striking) || "").toLowerCase();
  if (striking === "striking") dice = Math.max(dice, 2);
  else if (striking === "greater striking" || striking === "greaterStriking")
    dice = Math.max(dice, 3);
  else if (striking === "major striking" || striking === "majorStriking")
    dice = Math.max(dice, 4);
  let str = dice + String(dm.die);
  const traits = weaponTraits(id);
  const ranged = isRangedWeapon(id);
  let dmgMod = 0;
  if (!ranged) dmgMod = abilityMod("str");
  else if (traits.includes("propulsive"))
    dmgMod = Math.floor(abilityMod("str") / 2);
  if (dmgMod !== 0) str += (dmgMod > 0 ? "+" : "") + dmgMod;
  const type = dm.damageType || dm.type;
  if (nonEmpty(type)) str += " " + type;
  return str;
}

function mapString(id) {
  const agile = weaponTraits(id).includes("agile");
  const first = computeAttackBonus(id);
  const step = agile ? 4 : 5;
  return signed(first) + " / " + signed(first - step) + " / " + signed(first - 2 * step);
}

// ===== Portrait =====

let portraitDataUrl = null;
if (record && record.portrait) {
  try {
    portraitDataUrl = await api.loadImage(record.portrait);
  } catch (e) {
    console.warn(
      "[characters.pdf] portrait load failed for",
      record.portrait,
      "—",
      e && e.message,
    );
    portraitDataUrl = null;
  }
}

// ===== Styles =====

const styles = {
  h3: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
  label: { fontSize: 8, color: "#666" },
  value: { fontSize: 11, bold: true },
  small: { fontSize: 9 },
  tiny: { fontSize: 8, color: "#555" },
  tableHeader: {
    fontSize: 9,
    bold: true,
    fillColor: "#eeeeee",
    margin: [2, 2, 2, 2],
  },
  pageTitle: {
    fontSize: 18,
    bold: true,
    color: "#5e0000",
    margin: [0, 0, 0, 10],
  },
};

const defaultStyle = { fontSize: 10, lineHeight: 1.15 };

// ===== Reusable fragments =====

function nameStrip(showPortrait, pageTitle) {
  const portraitBlock =
    showPortrait && portraitDataUrl
      ? {
          image: portraitDataUrl,
          width: 60,
          height: 60,
          fit: [60, 60],
        }
      : { text: "", width: 60 };

  const subtitleBits = [
    d.className || "",
    d.ancestryName ? " • " + d.ancestryName : "",
    d.heritageName ? " • " + d.heritageName : "",
    d.level ? " • Level " + d.level : "",
  ];

  return {
    columns: [
      portraitBlock,
      {
        stack: [
          { text: characterName, fontSize: 16, bold: true },
          {
            text: subtitleBits.filter(Boolean).join(""),
            style: "small",
            color: "#555",
          },
        ],
        margin: [12, showPortrait ? 8 : 0, 0, 0],
      },
      pageTitle
        ? {
            text: pageTitle,
            style: "pageTitle",
            alignment: "right",
            margin: [0, 8, 0, 0],
          }
        : { text: "", width: 1 },
    ],
    margin: [0, 0, 0, 10],
  };
}

// ===== Page 1: Main =====

const ATTRIBUTES = [
  { key: "str", label: "STR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "WIS" },
  { key: "cha", label: "CHA" },
];

const attributeTable = {
  table: {
    widths: ["*", "*", "*", "*", "*", "*"],
    body: [
      ATTRIBUTES.map((a) => ({
        text: a.label,
        style: "tableHeader",
        alignment: "center",
      })),
      ATTRIBUTES.map((a) => ({
        text: signed(abilityMod(a.key)),
        alignment: "center",
        fontSize: 16,
        bold: true,
        margin: [0, 4, 0, 4],
      })),
    ],
  },
  layout: "lightHorizontalLines",
  margin: [0, 0, 0, 10],
};

const SAVES = [
  { key: "fortitude", label: "Fortitude" },
  { key: "reflex", label: "Reflex" },
  { key: "will", label: "Will" },
];

const saveRows = [
  [
    { text: "Save", style: "tableHeader" },
    { text: "Rank", style: "tableHeader", alignment: "center" },
    { text: "Mod", style: "tableHeader", alignment: "center" },
  ],
  ...SAVES.map((s) => [
    { text: s.label },
    { text: rankLabel(d[s.key]), alignment: "center" },
    { text: signed(d[s.key + "Mod"]), alignment: "center" },
  ]),
  [
    { text: "Perception" },
    { text: rankLabel(d.perception), alignment: "center" },
    { text: signed(d.perceptionMod), alignment: "center" },
  ],
];

const traitsText = (d.traitsList || [])
  .map((t) => t.name)
  .filter(Boolean)
  .join(", ");
const languagesText = (d.languagesList || [])
  .map((l) => l.name)
  .filter(Boolean)
  .join(", ");

const mainContent = [
  nameStrip(true),
  {
    columns: [
      kv(
        "HP",
        val(d.curhp, val(d.hitpoints)) +
          " / " +
          val(d.hitpoints) +
          (nonEmpty(d.tempHp) && String(d.tempHp) !== "0"
            ? " (+" + d.tempHp + " temp)"
            : ""),
      ),
      kv("AC", d.ac),
      kv("Class DC", d.classDC),
      kv("Speed", d.speed),
      kv("Hero Points", val(d.heroPoints, "0")),
    ],
    columnGap: 8,
    margin: [0, 0, 0, 10],
  },
  {
    columns: [
      kv("Class", d.className),
      kv("Ancestry", d.ancestryName),
      kv("Heritage", d.heritageName),
      kv("Background", d.backgroundName),
    ],
    columnGap: 8,
    margin: [0, 0, 0, 10],
  },
  {
    columns: [
      kv("Size", titleCase(d.size)),
      kv("Senses", d.senses),
      kv("Dying / Wounded", val(d.dying, "0") + " / " + val(d.wounded, "0")),
      kv("XP", d.xp),
    ],
    columnGap: 8,
    margin: [0, 0, 0, 10],
  },
];

if (nonEmpty(traitsText)) {
  mainContent.push({
    text: [{ text: "Traits: ", bold: true }, { text: traitsText }],
    style: "small",
    margin: [0, 0, 0, 4],
  });
}
if (nonEmpty(languagesText)) {
  mainContent.push({
    text: [{ text: "Languages: ", bold: true }, { text: languagesText }],
    style: "small",
    margin: [0, 0, 0, 10],
  });
}

mainContent.push({ text: "Attributes", style: "h3" });
mainContent.push(attributeTable);
mainContent.push({ text: "Saving Throws & Perception", style: "h3" });
mainContent.push({
  table: { headerRows: 1, widths: ["*", 50, 60], body: saveRows },
  layout: "lightHorizontalLines",
  margin: [0, 0, 0, 4],
});
mainContent.push({
  text: "U = Untrained  •  T = Trained  •  E = Expert  •  M = Master  •  L = Legendary",
  style: "tiny",
  margin: [0, 0, 0, 10],
});

// Shield summary (mirrored from the equipped shield item)
if (nonEmpty(d.shieldAC) || nonEmpty(d.shieldMaxHp)) {
  mainContent.push({ text: "Shield", style: "h3" });
  mainContent.push({
    columns: [
      kv("AC Bonus", nonEmpty(d.shieldAC) ? "+" + d.shieldAC : "—"),
      kv("Hardness", d.shieldHardness),
      kv("HP", val(d.shieldHp, "0") + " / " + val(d.shieldMaxHp, "—")),
      kv("BT", d.shieldBt),
      kv("Broken", d.shieldBroken === true ? "Yes" : "No"),
    ],
    columnGap: 8,
    margin: [0, 0, 0, 10],
  });
}

// IWR — entry.name is already the formatted label (e.g. "fire 5 (except silver)")
const iwrRows = [
  ["Immunities", d.immunities],
  ["Weaknesses", d.weaknesses],
  ["Resistances", d.resistances],
]
  .map((r) => [r[0], (r[1] || []).map((e) => e.name).filter(Boolean).join(", ")])
  .filter((r) => nonEmpty(r[1]));

if (iwrRows.length > 0) {
  mainContent.push({ text: "Immunities, Weaknesses & Resistances", style: "h3" });
  mainContent.push({
    table: {
      widths: [90, "*"],
      body: iwrRows.map((r) => [
        { text: r[0], bold: true, style: "small" },
        { text: titleCase(r[1]), style: "small" },
      ]),
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 10],
  });
}

// ===== Page 2: Actions & Attacks =====

const inventory = d.inventory || [];

// Real weapons live in data.inventory; data.granted_inventory carries strikes
// granted by effects. data.attacks is polymorph-only.
function isWeaponItem(it) {
  const id = (it && it.data) || {};
  if (id.hideFromList === true) return false;
  const t = String(id.type || "").toLowerCase();
  if (t === "weapon") return true;
  return nonEmpty(id.damage && (id.damage.die || id.damage.formula));
}

const equippedWeapons = inventory.filter(
  (it) => isWeaponItem(it) && it.data && it.data.carried === "equipped",
);
const grantedWeapons = (d.granted_inventory || []).filter(isWeaponItem);
const allAttacks = [...equippedWeapons, ...grantedWeapons];

const actionsContent = [
  Object.assign(nameStrip(true, "Actions & Attacks"), { pageBreak: "before" }),
];

if (allAttacks.length > 0) {
  actionsContent.push({ text: "Attacks", style: "h3" });
  actionsContent.push({
    table: {
      headerRows: 1,
      widths: ["*", 78, 80, "*"],
      body: [
        [
          { text: "Weapon", style: "tableHeader" },
          { text: "Attack (MAP)", style: "tableHeader", alignment: "center" },
          { text: "Damage", style: "tableHeader", alignment: "center" },
          { text: "Traits", style: "tableHeader" },
        ],
        ...allAttacks.map((it) => {
          const id = it.data || {};
          const traits = weaponTraits(id).join(", ");
          const range = nonEmpty(id.range) ? "range " + id.range : "";
          return [
            { text: it.name || "" },
            { text: mapString(id), alignment: "center", style: "small" },
            { text: damageString(id), alignment: "center", style: "small" },
            {
              text: [traits, range].filter(Boolean).join(" • "),
              style: "tiny",
            },
          ];
        }),
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 9,
    margin: [0, 0, 0, 4],
  });
  actionsContent.push({
    text: "Attack bonus = proficiency + attribute + potency rune. Conditional bonuses from effects are not included.",
    style: "tiny",
    italics: true,
    margin: [0, 0, 0, 10],
  });
}

const ACTION_COST = {
  free: "Free",
  oneAction: "1",
  twoActions: "2",
  threeActions: "3",
  oneToTwoActions: "1-2",
  oneToThreeActions: "1-3",
  reaction: "Reaction",
};

const actions = d.actions || [];
if (actions.length > 0) {
  actionsContent.push({ text: "Actions", style: "h3" });
  actions.forEach((a) => {
    const ad = (a && a.data) || {};
    const cost = ACTION_COST[ad.actions] || ad.actions || "";
    const short = truncate(stripHtml(ad.description), DESC_MAX);
    actionsContent.push({
      text: [
        { text: a.name || "Unnamed Action", bold: true },
        cost ? { text: "  [" + cost + "]", style: "tiny", color: "#777" } : { text: "" },
        short ? { text: " — " + short, style: "small" } : { text: "" },
      ],
      margin: [0, 0, 0, 4],
    });
  });
}

// ===== Page 3: Skills =====

const SKILLS = [
  { key: "acrobatics", label: "Acrobatics", ability: "dex" },
  { key: "arcana", label: "Arcana", ability: "int" },
  { key: "athletics", label: "Athletics", ability: "str" },
  { key: "crafting", label: "Crafting", ability: "int" },
  { key: "deception", label: "Deception", ability: "cha" },
  { key: "diplomacy", label: "Diplomacy", ability: "cha" },
  { key: "intimidation", label: "Intimidation", ability: "cha" },
  { key: "medicine", label: "Medicine", ability: "wis" },
  { key: "nature", label: "Nature", ability: "wis" },
  { key: "occultism", label: "Occultism", ability: "int" },
  { key: "performance", label: "Performance", ability: "cha" },
  { key: "religion", label: "Religion", ability: "wis" },
  { key: "society", label: "Society", ability: "int" },
  { key: "stealth", label: "Stealth", ability: "dex" },
  { key: "survival", label: "Survival", ability: "wis" },
  { key: "thievery", label: "Thievery", ability: "dex" },
];

const skillRows = [
  [
    { text: "Skill", style: "tableHeader" },
    { text: "Attr", style: "tableHeader", alignment: "center" },
    { text: "Rank", style: "tableHeader", alignment: "center" },
    { text: "Mod", style: "tableHeader", alignment: "center" },
  ],
  ...SKILLS.map((s) => {
    const ability = d[s.key + "Ability"] || s.ability;
    return [
      { text: s.label },
      { text: String(ability).toUpperCase(), alignment: "center" },
      { text: rankLabel(d[s.key]), alignment: "center" },
      { text: signed(d[s.key + "Mod"]), alignment: "center" },
    ];
  }),
];

(d.loreSkills || []).forEach((lore) => {
  const ld = (lore && lore.data) || {};
  skillRows.push([
    { text: lore.name || "Lore", italics: true },
    { text: String(ld.ability || "int").toUpperCase(), alignment: "center" },
    { text: rankLabel(ld.rank), alignment: "center" },
    { text: signed(ld.mod), alignment: "center" },
  ]);
});

const skillsContent = [
  Object.assign(nameStrip(false, "Skills"), { pageBreak: "before" }),
  {
    table: { headerRows: 1, widths: ["*", 45, 45, 45], body: skillRows },
    layout: "lightHorizontalLines",
    fontSize: 10,
    margin: [0, 0, 0, 4],
  },
  {
    text: "U = Untrained  •  T = Trained  •  E = Expert  •  M = Master  •  L = Legendary",
    style: "tiny",
    margin: [0, 0, 0, 10],
  },
];

const defenses = d.defenses || {};
const attackProfs = d.attackProficiencies || {};
const profTableRows = [
  ["Unarmored", rankLabel(defenses.unarmored)],
  ["Light Armor", rankLabel(defenses.light)],
  ["Medium Armor", rankLabel(defenses.medium)],
  ["Heavy Armor", rankLabel(defenses.heavy)],
  ["Unarmed", rankLabel(attackProfs.unarmed)],
  ["Simple Weapons", rankLabel(attackProfs.simple)],
  ["Martial Weapons", rankLabel(attackProfs.martial)],
  ["Advanced Weapons", rankLabel(attackProfs.advanced)],
];
if (attackProfs.other && nonEmpty(attackProfs.other.name)) {
  profTableRows.push([
    attackProfs.other.name,
    rankLabel(attackProfs.other.rank),
  ]);
}
profTableRows.push(["Class DC", rankLabel(d.classDCProficiency)]);
profTableRows.push(["Spellcasting", rankLabel(d.spellcasting)]);

skillsContent.push({ text: "Armor, Weapon & Class Proficiencies", style: "h3" });
skillsContent.push({
  table: {
    widths: [150, "*"],
    body: profTableRows.map((r) => [
      { text: r[0], bold: true, style: "small" },
      { text: r[1], style: "small" },
    ]),
  },
  layout: "lightHorizontalLines",
  margin: [0, 0, 0, 10],
});

// ===== Page 4: Spells =====

const spellcastingEntries = d.spells || [];
const spellsContent = [];

// Skip empty prepared-slot placeholders (data.type === "slot")
function realSpells(list) {
  return (list || []).filter((s) => s && s.data && s.data.type !== "slot");
}

function describeSpell(s) {
  const sd = (s && s.data) || {};
  const meta = [
    nonEmpty(sd.actions) ? ACTION_COST[sd.actions] || sd.actions : "",
    sd.range,
    sd.duration && sd.duration.value,
  ]
    .filter(nonEmpty)
    .join(" • ");
  const desc = truncate(stripHtml(sd.description), DESC_MAX);
  return {
    stack: [
      {
        text: [
          { text: s.name || "Unnamed Spell", bold: true },
          meta ? { text: " — " + meta, style: "tiny" } : { text: "" },
        ],
      },
      desc
        ? { text: desc, style: "small", margin: [0, 1, 0, 4] }
        : { text: "", margin: [0, 0, 0, 2] },
    ],
  };
}

if (spellcastingEntries.length > 0) {
  spellsContent.push(
    Object.assign(nameStrip(false, "Spells"), { pageBreak: "before" }),
  );
  spellcastingEntries.forEach((entry) => {
    const ed = (entry && entry.data) || {};
    spellsContent.push({ text: entry.name || "Spellcasting", style: "h3" });
    const summary = [
      kv("Tradition", ed.tradition),
      kv("Type", titleCase(ed.type)),
      kv("Rank", rankLabel(ed.training)),
      kv("Attack", signed(ed.mod)),
      kv("DC", ed.dc),
    ];
    if (nonEmpty(ed.focusPoolMax)) {
      summary.push(
        kv("Focus", val(ed.focusPool, "0") + " / " + ed.focusPoolMax),
      );
    }
    spellsContent.push({
      columns: summary,
      columnGap: 8,
      margin: [0, 0, 0, 6],
    });

    const cantrips = realSpells(ed.cantrips);
    if (cantrips.length > 0) {
      spellsContent.push({
        text: "Cantrips" + (nonEmpty(ed.numCantrips) ? " (" + ed.numCantrips + ")" : ""),
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 2],
      });
      spellsContent.push({ stack: cantrips.map(describeSpell) });
    }
    for (let r = 1; r <= 10; r++) {
      const spells = realSpells(ed["spells" + r]);
      if (spells.length === 0) continue;
      const slots = ed["numSpells" + r];
      spellsContent.push({
        text:
          "Rank " + r + (nonEmpty(slots) ? " (" + slots + " slots)" : ""),
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 2],
      });
      spellsContent.push({ stack: spells.map(describeSpell) });
    }
    const known = realSpells(ed.knownSpells);
    if (known.length > 0 && ed.type === "spontaneous") {
      spellsContent.push({
        text: "Repertoire",
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 2],
      });
      spellsContent.push({
        ul: known.map(
          (s) => (s.name || "Unnamed") + " (rank " + val(s.data && s.data.level, "?") + ")",
        ),
        style: "small",
        margin: [0, 0, 0, 6],
      });
    }
  });
}

// ===== Page 5: Feats & Features =====

const featsContent = [
  Object.assign(nameStrip(false, "Feats & Features"), { pageBreak: "before" }),
];

// data.feats includes empty slot placeholders (data.type === "slot")
const feats = (d.feats || []).filter((f) => f && f.data && f.data.type !== "slot");
const bonusFeats = d.bonusFeats || [];

function featBlock(f) {
  const fd = f.data || {};
  const headerBits = [{ text: f.name || "Unnamed Feat", bold: true, fontSize: 11 }];
  if (nonEmpty(fd.featSlotType)) {
    headerBits.push({
      text: "  " + titleCase(fd.featSlotType) + " Feat",
      style: "tiny",
      color: "#777",
    });
  }
  if (nonEmpty(fd.level)) {
    headerBits.push({
      text: "  •  Level " + fd.level,
      style: "tiny",
      color: "#777",
    });
  }
  const desc = truncate(stripHtml(fd.description), DESC_MAX);
  return {
    stack: [
      { text: headerBits, margin: [0, 0, 0, 2] },
      { text: desc || "—", style: "small", margin: [0, 0, 0, 8] },
    ],
  };
}

if (feats.length > 0 || bonusFeats.length > 0) {
  featsContent.push({ text: "Feats", style: "h3" });
  feats.forEach((f) => featsContent.push(featBlock(f)));
  bonusFeats.forEach((f) => featsContent.push(featBlock(f)));
}

// Class/ancestry/heritage features are nested on the embedded parent records
const featureSources = [
  ["Class Features", d.classes && d.classes[0]],
  ["Ancestry Features", d.ancestries && d.ancestries[0]],
  ["Heritage Features", d.heritages && d.heritages[0]],
];

featureSources.forEach(([title, parent]) => {
  const features = (parent && parent.data && parent.data.features) || [];
  const visible = features.filter((f) => f && f.name);
  if (visible.length === 0) return;
  featsContent.push({ text: title, style: "h3" });
  visible.forEach((f) => {
    const fd = f.data || {};
    const short = truncate(stripHtml(fd.description), DESC_MAX);
    featsContent.push({
      text: [
        { text: f.name, bold: true },
        nonEmpty(fd.level)
          ? { text: "  (Level " + fd.level + ")", style: "tiny", color: "#777" }
          : { text: "" },
        short ? { text: " — " + short, style: "small" } : { text: "" },
      ],
      margin: [0, 0, 0, 4],
    });
  });
});

// ===== Page 6: Inventory =====

const inventoryContent = [
  Object.assign(nameStrip(false, "Inventory"), { pageBreak: "before" }),
];

function bulkLabel(id) {
  const b = id.bulk && id.bulk.value;
  if (!nonEmpty(b)) return "";
  const n = parseFloat(b);
  if (isNaN(n)) return String(b);
  if (n === 0) return "—";
  if (n < 1) return "L";
  return String(n);
}

if (inventory.length === 0) {
  inventoryContent.push({
    text: "No items.",
    style: "small",
    italics: true,
    margin: [0, 0, 0, 10],
  });
} else {
  inventoryContent.push({
    table: {
      headerRows: 1,
      widths: ["*", 40, 40, 55, 50],
      body: [
        [
          { text: "Item", style: "tableHeader" },
          { text: "Count", style: "tableHeader", alignment: "center" },
          { text: "Bulk", style: "tableHeader", alignment: "center" },
          { text: "Carried", style: "tableHeader", alignment: "center" },
          { text: "Invested", style: "tableHeader", alignment: "center" },
        ],
        ...inventory.map((it) => {
          const id = (it && it.data) || {};
          return [
            { text: it.name || "" },
            {
              text: String(id.count != null ? id.count : 1),
              alignment: "center",
            },
            { text: bulkLabel(id), alignment: "center" },
            {
              text: titleCase(id.carried || ""),
              alignment: "center",
              style: "tiny",
            },
            {
              text: id.invested === "true" || id.invested === true ? "●" : "",
              alignment: "center",
            },
          ];
        }),
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 9,
    margin: [0, 0, 0, 10],
  });
}

if (nonEmpty(d.totalBulk) || nonEmpty(d.bulk)) {
  inventoryContent.push({
    text:
      "Total Bulk: " + val(d.totalBulk, "0") + " / " + val(d.bulk, "—"),
    style: "small",
    margin: [0, 0, 0, 10],
  });
}

inventoryContent.push({ text: "Currency", style: "h3" });
inventoryContent.push({
  columns: [kv("CP", d.cp), kv("SP", d.sp), kv("GP", d.gp), kv("PP", d.pp)],
  columnGap: 8,
  margin: [0, 0, 0, 10],
});

if (nonEmpty(d.otherTreasure)) {
  inventoryContent.push({ text: "Other Treasure", style: "h3" });
  inventoryContent.push({
    text: stripHtml(d.otherTreasure),
    style: "small",
    margin: [0, 0, 0, 10],
  });
}

// ===== Page 7: Notes =====

const notesContent = [
  Object.assign(nameStrip(false, "Notes"), { pageBreak: "before" }),
];

function addRichSection(label, html) {
  const text = stripHtml(html);
  if (!text) return;
  notesContent.push({ text: label, style: "h3" });
  notesContent.push({ text, margin: [0, 0, 0, 8] });
}

const physical = [
  d.gender && "Gender: " + d.gender,
  d.pronouns && "Pronouns: " + d.pronouns,
  d.age && "Age: " + d.age,
  d.height && "Height: " + d.height,
  d.weight && "Weight: " + d.weight,
].filter(Boolean);

if (physical.length > 0) {
  notesContent.push({ text: "Physical Description", style: "h3" });
  notesContent.push({ ul: physical, style: "small", margin: [0, 0, 0, 8] });
}

if (nonEmpty(d.deity)) {
  notesContent.push({
    text: "Deity: " + d.deity,
    style: "small",
    margin: [0, 4, 0, 8],
  });
}

addRichSection("Notes", d.notes);

// ===== Assemble =====

return {
  pageSize: "LETTER",
  pageMargins: [40, 40, 40, 44],
  defaultStyle,
  styles,
  footer: (currentPage, pageCount) => ({
    columns: [
      { text: characterName, style: "tiny", margin: [40, 0, 0, 0] },
      {
        text: currentPage + " / " + pageCount,
        alignment: "right",
        style: "tiny",
        margin: [0, 0, 40, 0],
      },
    ],
    margin: [0, 10, 0, 0],
  }),
  content: [
    ...mainContent,
    ...actionsContent,
    ...skillsContent,
    ...spellsContent,
    ...featsContent,
    ...inventoryContent,
    ...notesContent,
  ],
  filename: characterName + ".pdf",
};
