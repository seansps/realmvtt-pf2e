// Casting rituals (Player Core pg. 389): a ritual's Cast card gets its checks.
// The primary check is very hard for a level twice the ritual's rank, each
// secondary check standard for that level. Secondary checks come first, each
// by a different secondary caster, and change the primary check: critical
// success +2 circumstance, failure -4, critical failure -4 and the primary
// one degree worse. Like other downtime checks, fortune and misfortune don't
// apply. The ritual's cost and its effect stay the GM's.

function isRitualSpell(spell) {
  return spell?.data?.type === "ritual" || (spell?.data?.traits || []).some((trait) => `${trait}`.toLowerCase() === "ritual");
}

function getRitualRank(spell) {
  return Math.max(1, parseInt(spell?.data?.level ?? spell?.data?.rank ?? 1, 10) || 1);
}

function getRitualDCs(rank) {
  const level = Math.min(25, 2 * rank);
  return { level, primary: getDCForLevel(level, "very hard"), secondary: getDCForLevel(level) };
}

// The skills named in a ritual's check text ("Arcana (expert)", "Crafting,
// Society"), Lore skills by name
function getRitualSkills(text) {
  const skills = Object.keys(getPathfinderSkills());
  const found = [];
  `${text || ""}`.split(/[,;]|\bor\b|\band\b/i).forEach((part) => {
    const words = part.replace(/\([^)]*\)/g, "").trim();
    const skill = skills.find((name) => new RegExp(`^${name}$`, "i").test(words));
    const lore = /^[\w' -]+ lore$/i.test(words) ? words : null;
    const name = skill || lore;
    if (name && !found.includes(name)) found.push(name);
  });
  return found;
}

function getRitualCheckMacro(label, skill, dc, kind) {
  const metadata = kind === "primary"
    ? {
        ritual: "primary",
        noFortune: true,
        extraModifiers: [
          { name: "Secondary check critical success", type: "circumstance", value: 2, active: false },
          { name: "Secondary check failure", type: "circumstance", value: -4, active: false },
        ],
      }
    : { ritual: "secondary", noFortune: true };
  const isLore = / lore$/i.test(skill);
  return `\`\`\`${label.replace(/[^A-Za-z0-9]+/g, "_")}
api.getSelectedOrDroppedToken().forEach((token) => {
  rollSkill(token, ${JSON.stringify(isLore ? skill : skill.toLowerCase())}, ${dc}, ${isLore}, 0, 1, "int", true, false, undefined, ${JSON.stringify(metadata)});
});
\`\`\``;
}

// The text a ritual's Cast card gets, or "" for other spells
function getRitualCastText(spell) {
  if (!isRitualSpell(spell)) return "";
  const rank = getRitualRank(spell);
  const dcs = getRitualDCs(rank);
  const ritual = spell.data?.ritual || {};
  const primary = getRitualSkills(ritual.primary?.check);
  const secondary = getRitualSkills(ritual.secondary?.check);
  const casters = parseInt(ritual.secondary?.casters, 10) || 0;
  const lines = [
    `**Ritual** (rank ${rank}): primary check DC ${dcs.primary} (very hard for level ${dcs.level})${
      secondary.length ? `, secondary checks DC ${dcs.secondary}` : ""
    }${casters ? `, ${casters} secondary caster${casters === 1 ? "" : "s"}` : ""}. Fortune and misfortune don't apply.`,
  ];
  if (secondary.length) {
    lines.push(
      "*Secondary checks first, each by a different secondary caster: critical success +2 to the primary check, failure -4, critical failure -4 and the primary one degree worse.*",
    );
  }
  const buttons = [
    ...secondary.map((skill) => getRitualCheckMacro(`Secondary ${capitalize(skill)}`, skill, dcs.secondary, "secondary")),
    ...primary.map((skill) => getRitualCheckMacro(`Primary ${capitalize(skill)}`, skill, dcs.primary, "primary")),
  ];
  return `\n\n${lines.join("\n")}${buttons.length ? `\n${buttons.join("\n")}` : ""}`;
}

// A secondary check's result line, for skill.js
function getRitualResultLines(metadata, degree) {
  if (metadata?.ritual !== "secondary" || degree === null || degree === undefined) return [];
  const text = {
    2: "+2 circumstance bonus to the primary check.",
    1: "No bonus or penalty to the primary check.",
    0: "-4 circumstance penalty to the primary check.",
    "-1": "-4 circumstance penalty to the primary check, and its degree of success one step worse.",
  }[degree];
  return text ? [`**Ritual secondary check:** ${text}`] : [];
}
