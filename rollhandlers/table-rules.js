// Rules some tables use (Player Core): Earn Income, Subsist and the cost of
// living, mounts, and aquatic combat and drowning. Every one assists the GM:
// buttons and notes, nothing is refused.
//
//   - Earn Income: a trained skill (or Lore), the task's level and the days
//     worked. The check is against the task level's DC; the card gives the
//     income for the days (the Income Earned table, level + 1 on a critical
//     success, the failure column on a failure) with a Collect button.
//     Experienced Professional makes a Lore's critical failure a failure,
//     and at expert Lore doubles a failure that wasn't a critical failure
//   - Subsist: the environment's simple DC (or the GM's), -5 after a day of
//     exploring and -2 after a critical failure as unticked modifiers, and
//     the outcome with Fatigued and Adverse Subsist Situation buttons
//   - Cost of living: pays a standard of living for a week, month or year
//   - Mount and Dismount: the rider gets the Mounted effect, its applier
//     recorded as the mount. With Ride, commanding the mount to take a move
//     action succeeds without a roll
//   - Underwater: the Underwater effect, and off-guard for creatures without
//     a swim Speed. A bludgeoning or slashing Strike underwater takes a -2
//     circumstance penalty (not with the underwater property rune, nor an
//     aquatic or amphibious creature's unarmed attack)
//   - Holding breath: Holding Breath stacks for 5 + Con rounds of air. Each
//     turn's end posts the air left with buttons that spend it; out of air,
//     Suffocating counts the Fortitude saves (DC 20, +5 and +1d10 each)
//
// Mounted, Underwater, Holding Breath, Suffocating and Adverse Subsist
// Situation are module effects: applied by name, so a campaign without them
// gets the card's text only.

function getTableRuleRecordName(record) {
  return record?.name || getTokenDisplayName(record) || "The character";
}

// ---------------------------------------------------------------- Earn Income

// The failure column of the Income Earned table (Player Core pg. 229), in
// copper by task level. Level 21 is the "20 (critical success)" row.
const EARN_INCOME_FAILURE_CP = [
  1, 2, 4, 8, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 400,
  600, 800, 0,
];

// Income for one day of work, in copper, by the check's degree of success.
// Experienced Professional (a Lore only): a critical failure is a failure,
// and at expert or better a failure earns double, unless it was a critical
// failure (Player Core pg. 254; Foundry's code skips both conditions)
function getEarnIncomePerDayCp(level, rank, degree, experienced = false) {
  const r = Math.min(4, parseInt(rank, 10) || 0);
  if (r < 1) return 0;
  const row = (l) => Math.max(0, Math.min(21, parseInt(l, 10) || 0));
  const failure = EARN_INCOME_FAILURE_CP[row(level)];
  switch (degree) {
    case 2:
      return INCOME_EARNED_CP[row((parseInt(level, 10) || 0) + 1)][r - 1];
    case 1:
      return INCOME_EARNED_CP[row(level)][r - 1];
    case 0:
      return experienced && r >= 2 ? failure * 2 : failure;
    default:
      return experienced ? failure : 0;
  }
}

// The task level's DC, less the level with Proficiency without Level
function getEarnIncomeDC(level, variants = getVariantRules()) {
  const l = parseInt(level, 10) || 0;
  const dc = getDCForLevel(l);
  return variants.proficiencyWithoutLevel ? dc - l : dc;
}

// The skills a character can Earn Income with: trained or better, and each
// trained Lore ("lore:<index>")
function getEarnIncomeSkillOptions(record) {
  const rankName = (rank) => PROFICIENCY_RANK_NAMES[rank] || "";
  const skills = Object.keys(getPathfinderSkills()).map((skill) => ({
    skill,
    rank: parseInt(record?.data?.[skill] || "0", 10) || 0,
  }))
    .filter(({ rank }) => rank > 0)
    .map(({ skill, rank }) => ({ label: `${capitalize(skill)} (${rankName(rank)})`, value: skill }));
  const lores = (record?.data?.loreSkills || [])
    .map((lore, index) => ({ lore, index, rank: parseInt(lore?.data?.rank || "0", 10) || 0 }))
    .filter(({ lore, rank }) => rank > 0 && lore?.name)
    .map(({ lore, index, rank }) => ({ label: `${lore.name} (${rankName(rank)})`, value: `lore:${index}` }));
  return [...skills, ...lores];
}

// The rank of a skill choice, and whether it's a Lore
function getEarnIncomeSkill(record, choice) {
  const match = String(choice || "").match(/^lore:(\d+)$/);
  if (match) {
    const lore = (record?.data?.loreSkills || [])[parseInt(match[1], 10)];
    return lore
      ? {
          name: lore.name,
          lore,
          rank: parseInt(lore.data?.rank || "0", 10) || 0,
        }
      : null;
  }
  const skill = String(choice || "").toLowerCase();
  if (!Object.keys(getPathfinderSkills()).includes(skill)) return null;
  return { name: skill, rank: parseInt(record?.data?.[skill] || "0", 10) || 0 };
}

const EARN_INCOME_DAYS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 28];

// The Earn Income prompts: the skill (unless given), the task level, then
// the days worked. Then the check.
function promptEarnIncome(record, skill = null) {
  if (!record) return;
  const pick = (choice) => (Array.isArray(choice) ? choice[0] : choice);
  const askLevel = (skillChoice) => {
    const maxLevel = Math.min(20, parseInt(record.data?.level || "0", 10) || 0);
    const levels = Array.from({ length: maxLevel + 1 }, (_, level) => ({
      label: `Level ${level} (DC ${getEarnIncomeDC(level)})`,
      value: `${level}`,
    })).reverse();
    api.showPrompt(
      "Earn Income",
      "The task's level (the GM sets it).",
      "Select...",
      levels,
      null,
      (levelChoice) => {
        const level = parseInt(pick(levelChoice), 10);
        if (!Number.isFinite(level)) return;
        api.showPrompt(
          "Earn Income",
          "Days of work (each day after the first earns the same).",
          "Select...",
          EARN_INCOME_DAYS.map((days) => ({ label: `${days} day${days > 1 ? "s" : ""}`, value: `${days}` })),
          null,
          (daysChoice) => {
            const days = parseInt(pick(daysChoice), 10);
            if (days > 0) rollEarnIncome(record, skillChoice, level, days);
          },
          "Roll",
          "Cancel",
          1,
        );
      },
      "Next",
      "Cancel",
      1,
    );
  };
  if (skill) {
    askLevel(skill);
    return;
  }
  const options = getEarnIncomeSkillOptions(record);
  if (options.length === 0) {
    api.showNotification("Earn Income needs a trained skill.", "yellow", "Earn Income");
    return;
  }
  api.showPrompt(
    "Earn Income",
    "Which skill? (usually Crafting, a Lore or Performance)",
    "Select...",
    options,
    null,
    (choice) => {
      const value = pick(choice);
      if (value) askLevel(value);
    },
    "Next",
    "Cancel",
    1,
  );
}

// The Earn Income check, with what the result handler needs
function rollEarnIncome(record, skillChoice, level, days) {
  const skill = getEarnIncomeSkill(record, skillChoice);
  if (!skill) return;
  if (skill.rank < 1) {
    api.showNotification(`Earn Income needs a trained skill; ${capitalize(skill.name)} isn't.`, "yellow", "Earn Income");
    return;
  }
  const earnIncome = {
    level,
    days,
    rank: skill.rank,
    experienced: !!skill.lore && hasFeatNamed(record, "Experienced Professional"),
    recordId: record._id,
    recordType: record.recordType || "characters",
    name: getTableRuleRecordName(record),
  };
  const metadata = {
    action: "Earn Income",
    traits: ["downtime"],
    dcName: `Task Level ${level} DC`,
    earnIncome,
  };
  const dc = getEarnIncomeDC(level);
  if (skill.lore) {
    rollSkill(
      record,
      skill.lore.name,
      dc,
      true,
      parseInt(skill.lore.data?.mod || "0", 10) || 0,
      skill.rank,
      skill.lore.data?.ability || "int",
      false,
      false,
      undefined,
      metadata,
    );
    return;
  }
  rollSkill(record, skill.name, dc, false, 0, 1, "int", false, false, undefined, metadata);
}

// The result card's lines: what the work earns, and the Collect button
function getEarnIncomeLines(earnIncome, degree) {
  if (!earnIncome || ![2, 1, 0, -1].includes(degree)) return [];
  const days = Math.max(1, parseInt(earnIncome.days, 10) || 1);
  const perDay = getEarnIncomePerDayCp(earnIncome.level, earnIncome.rank, degree, earnIncome.experienced);
  const total = perDay * days;
  const forDays = days > 1 ? ` a day for ${days} days: **${formatCp(total)}**` : `: **${formatCp(total)}**`;
  const lines = [];
  if (perDay <= 0) {
    lines.push("**Earn Income:** nothing earned.");
    return lines;
  }
  const lowered = degree === -1 ? " (Experienced Professional: a failure)" : "";
  lines.push(`**Earn Income:** ${formatCp(perDay)}${forDays}${lowered}.`);
  lines.push(
    `\`\`\`Collect_${formatCp(total).replace(/[^A-Za-z0-9]+/g, "_")}\ncollectIncome(${JSON.stringify(earnIncome.recordType)}, ${JSON.stringify(earnIncome.recordId)}, ${total});\n\`\`\``,
  );
  return lines;
}

// The Collect button: strikes out its card, so it can't be collected twice
// (as the healing card's Undo), then adds the coins to the character, read
// fresh
function collectIncome(recordType, recordId, amountCp) {
  api.editMessage(null, `~**Earn Income:** ${formatCp(amountCp)}~ Collected.`);
  api.getRecord(recordType || "characters", recordId, (record) => {
    if (!record) return;
    const values = getCoinRefund(record, amountCp);
    if (Object.keys(values).length === 0) return;
    api.setValuesOnRecord(record, values, () => {
      api.sendMessage(`**${getTableRuleRecordName(record)} collects ${formatCp(amountCp)}.**`);
    });
  });
}

// ---------------------------------------------------------------- Subsist

// Sample Subsist tasks (Player Core pg. 240), by the simple DC of their rank
const SUBSIST_TASKS = [
  "a lush forest with calm weather or a large city with plentiful resources",
  "a typical hillside or village",
  "typical mountains or an insular hamlet",
  "a typical desert or a city under siege",
  "a barren wasteland or a city of undead",
];

function getSubsistOptions() {
  return [
    ...SUBSIST_TASKS.map((task, rank) => ({
      label: `${PROFICIENCY_RANK_NAMES[rank]}: ${task} (DC ${getSimpleDC(rank)})`,
      value: `${rank}`,
    })),
    { label: "The GM sets the DC", value: "gm" },
  ];
}

// Subsist: the environment, then the check. The penalties are unticked
// modifiers the player ticks: -5 after exploring that day, -2 for a week
// after a critical failure
function promptSubsist(record, skill, isMacro = false) {
  if (!record) return;
  api.showPrompt(
    "Subsist",
    "Where are you trying to Subsist?",
    "Select...",
    getSubsistOptions(),
    null,
    (choice) => {
      const value = Array.isArray(choice) ? choice[0] : choice;
      if (!value) return;
      const dc = value === "gm" ? null : getSimpleDC(parseInt(value, 10));
      rollSkill(record, skill, dc, false, 0, 1, "int", isMacro, false, undefined, {
        action: "Subsist",
        traits: ["downtime"],
        extraModifiers: getSubsistModifiers(),
        subsist: {
          actorId: record._id,
          actorName: getTableRuleRecordName(record),
        },
      });
    },
    "Roll",
    "Cancel",
    1,
  );
}

function getSubsistModifiers() {
  return [
    { name: "Subsisting after a day of exploring", type: "", value: -5, active: false, isPenalty: true },
    { name: "Critical failure to Subsist in the last week", type: "circumstance", value: -2, active: false, isPenalty: true },
  ];
}

// The Subsist result: the outcome, and buttons for Fatigued and the
// critical failure's penalty
function getSubsistLines(subsist, degree) {
  if (!subsist) return [];
  const button = (label, call) => getManeuverButton(label, subsist.actorId, subsist.actorName, call);
  switch (degree) {
    case 2:
      return ["**Subsist:** a subsistence living for you and one more creature, or a comfortable living for you."];
    case 1:
      return ["**Subsist:** enough food and shelter for a subsistence living."];
    case 0:
      return [
        "**Subsist:** exposed to the elements without enough food: fatigued until you get enough food and shelter.",
        button("Apply_Fatigued", 'api.addEffect("Fatigued", token)'),
      ];
    case -1:
      return [
        "**Subsist:** you worsen your situation: a -2 circumstance penalty to Subsist for 1 week, and no food at all. Without stored food, you risk starvation and thirst.",
        button("Apply_Adverse_Subsist_Situation", 'api.addEffect("Adverse Subsist Situation", token)'),
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------- Cost of living

// Cost of Living (Player Core pg. 295), in copper
const COST_OF_LIVING_CP = {
  subsistence: { week: 40, month: 200, year: 2400 },
  comfortable: { week: 100, month: 400, year: 5200 },
  fine: { week: 3000, month: 13000, year: 160000 },
  extravagant: { week: 10000, month: 43000, year: 520000 },
};

function getCostOfLivingOptions() {
  return Object.entries(COST_OF_LIVING_CP).flatMap(([lifestyle, costs]) =>
    Object.entries(costs).map(([period, cp]) => ({
      label: `${capitalize(lifestyle)}, 1 ${period} (${formatCp(cp)})`,
      value: `${lifestyle}:${period}`,
    })),
  );
}

// The coins a standard of living takes, or null when it's unknown or the
// character can't pay
function getCostOfLivingPayment(record, choice) {
  const [lifestyle, period] = String(choice || "").split(":");
  const cost = COST_OF_LIVING_CP[lifestyle]?.[period];
  if (!cost) return null;
  const values = getCoinPayment(record, cost);
  return { lifestyle, period, cost, values };
}

// The Pay Cost of Living prompt: one write, then the card
function payCostOfLiving(sheetRecord) {
  if (!sheetRecord) return;
  api.showPrompt(
    "Cost of Living",
    "Which standard of living? (Subsisting with Society or Survival is free.)",
    "Select...",
    getCostOfLivingOptions(),
    null,
    (choice) => {
      const value = Array.isArray(choice) ? choice[0] : choice;
      if (!value) return;
      api.getRecord(sheetRecord.recordType || "characters", sheetRecord._id, (fresh) => {
        const record = fresh || sheetRecord;
        const payment = getCostOfLivingPayment(record, value);
        if (!payment) return;
        if (!payment.values) {
          api.showNotification(`Not enough coins for ${formatCp(payment.cost)}.`, "yellow", "Cost of Living");
          return;
        }
        api.setValuesOnRecord(record, payment.values, () => {
          api.sendMessage(
            `**${getTableRuleRecordName(record)} pays ${formatCp(payment.cost)}** for a ${payment.lifestyle} living (1 ${payment.period}).`,
          );
        });
      });
    },
    "Pay",
    "Cancel",
    1,
  );
}

// ---------------------------------------------------------------- Mounts

function getTableRuleSize(token) {
  const raw = String(token?.data?.size || token?.record?.data?.size || "").trim().toLowerCase();
  return CREATURE_SIZES.indexOf(CREATURE_SIZE_ALIASES[raw] || raw);
}

// The mount a rider is on: the applier of its Mounted effect
function getMountId(rider) {
  const mounted = getTokenCondition(rider, "Mounted")?.effect;
  if (!mounted) return null;
  const instance = getEffectInstances(rider, mounted).find((entry) => entry?.tokenId);
  return instance?.tokenId || null;
}

// The Mount card's text, and a GM note when the mount isn't at least one
// size larger (never a block)
function getMountMessage(rider, mount) {
  const riderName = getTokenDisplayName(rider);
  const mountName = getTokenDisplayName(mount);
  const riderSize = getTableRuleSize(rider);
  const mountSize = getTableRuleSize(mount);
  const lines = [
    `**${riderName} mounts ${mountName}.**`,
    `${mountName} acts on ${riderName}'s initiative and spends its actions only when Commanded (Command an Animal). They share a multiple attack penalty. ${riderName} takes a -2 circumstance penalty to Reflex saves, and the only move action is Mount, to dismount.`,
    `With Ride, commanding ${mountName} to take a move action succeeds automatically, and it acts on ${riderName}'s turn like a minion; mounted in the middle of an encounter, it skips its next turn.`,
  ];
  if (riderSize >= 0 && mountSize >= 0 && mountSize <= riderSize) {
    lines.push(`[gm]${mountName} isn't at least one size larger than ${riderName}.[/gm]`);
  }
  return lines.join("\n");
}

// Mount: the selected token rides the targeted one
function mountTarget() {
  const rider = (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t)[0] || api.getToken();
  const targets = (typeof api.getTargets === "function" && api.getTargets()) || [];
  const mount = targets.length === 1 ? targets[0]?.token || targets[0] : null;
  if (!rider || !mount) {
    api.showNotification(
      "Select the rider's token, then target the mount (one target only), and click Mount Target again.",
      "yellow",
      "Mount",
    );
    return;
  }
  if (rider._id === mount._id) return;
  const mountName = getTokenDisplayName(mount);
  const add = () => {
    api.addEffect("Mounted", rider, undefined, { _id: mount._id, name: mountName });
    api.sendMessage(getMountMessage(rider, mount), undefined, [], [], rider);
  };
  const current = getTokenCondition(rider, "Mounted")?.effect;
  if (current) {
    api.removeEffectById(current._id, rider, add);
  } else {
    add();
  }
}

// Dismount: off the mount, into a space next to it
function dismountSelected() {
  const riders = (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t);
  riders.forEach((rider) => {
    const mounted = getTokenCondition(rider, "Mounted")?.effect;
    if (!mounted) return;
    const mountId = getMountId(rider);
    const mount = mountId ? findSceneToken(mountId) : null;
    api.removeEffectById(mounted._id, rider, () => {
      api.sendMessage(
        `**${getTokenDisplayName(rider)} dismounts${mount ? ` ${getTokenDisplayName(mount)}` : ""}**, into a space next to it.`,
        undefined,
        [],
        [],
        rider,
      );
    });
  });
}

// Whether Ride applies: the rider has the feat and commands its own mount
function isRideCommand(record, rider, target) {
  return !!rider && !!target && hasFeatNamed(record, "Ride") && getMountId(rider) === target._id;
}

// Ride's success card: commanding the mount to take a move action
function getRideCommandMessage(rider, target) {
  return `**${getTokenDisplayName(rider)} Commands an Animal: ${getTokenDisplayName(target)}.**\n[center][color=#2e7d32]Success[/color][/center]\nRide: commanding your mount to take a move action succeeds automatically.`;
}

// With Ride, Command an Animal on the rider's mount asks whether it's for a
// move action (Ride: "such as Stride"): yes posts the success, no rolls as
// usual (roll). False when Ride doesn't apply, so the caller rolls.
function promptRideCommand(record, rider, target, roll) {
  if (!isRideCommand(record, rider, target)) return false;
  api.showPrompt(
    "Ride",
    `Command ${getTokenDisplayName(target)} to take a move action (such as Stride)? With Ride, that succeeds automatically.`,
    "Select...",
    [
      { label: "Yes, a move action", value: "move" },
      { label: "No, roll the check", value: "roll" },
    ],
    null,
    (choice) => {
      const value = Array.isArray(choice) ? choice[0] : choice;
      if (value === "move") {
        api.sendMessage(getRideCommandMessage(rider, target), undefined, [], [], rider);
      } else if (value === "roll") {
        roll();
      }
    },
    "OK",
    "Cancel",
    1,
  );
  return true;
}

// The Mount action card's buttons
function getMountActionMacros() {
  return "\n```Mount_Target\nmountTarget();\n```\n```Dismount\ndismountSelected();\n```";
}

// ---------------------------------------------------------------- Underwater

function hasSwimSpeed(token) {
  const data = token?.data || token?.record?.data || {};
  if (data.otherSpeeds?.swim) return true;
  if (/\bswim\b/i.test(String(data.speed || ""))) return true;
  return (data.speeds || []).some((speed) => /swim/i.test(`${speed?.name || ""} ${speed?.data?.type || ""}`));
}

// Aquatic and amphibious creatures' unarmed Strikes take no penalty
function isAquaticCreature(token) {
  const data = token?.data || token?.record?.data || {};
  const traits = [
    ...getTraitNameList(data.traits),
    ...(data.ancestries || []).flatMap((ancestry) => getTraitNameList(ancestry?.data?.traits)),
  ];
  return traits.includes("aquatic") || traits.includes("amphibious");
}

// The -2 circumstance penalty to a bludgeoning or slashing Strike made
// underwater, for a creature with the Underwater effect
function getUnderwaterAttackModifiers(token, weapon) {
  if (!token || !weapon || !getTokenCondition(token, "Underwater")) return [];
  // The underwater property rune (Foundry's item:rune:property:underwater)
  const runes = Array.isArray(weapon.data?.runes?.property) ? weapon.data.runes.property : [];
  if (runes.some((rune) => /^underwater$/i.test(String(typeof rune === "string" ? rune : rune?.name || "").trim()))) {
    return [];
  }
  const traits = getTraitNameList(weapon.data?.traits);
  // A weapon's damage type, an NPC attack's damage rolls, or its damage text
  // ("1d6 slashing")
  const damage = Array.isArray(weapon.data?.damage) ? weapon.data.damage : [weapon.data?.damage];
  const types = [
    weapon.data?.damageType,
    ...(weapon.data?.damageRolls || []).map((roll) => roll?.data?.type),
    ...damage.map((dmg) =>
      typeof dmg === "string" ? dmg : dmg?.type || dmg?.data?.type || dmg?.damageType || dmg?.data?.damageType,
    ),
  ]
    .filter(Boolean)
    .map((type) => String(type).toLowerCase());
  if (!types.some((type) => /\b(bludgeoning|slashing)\b/.test(type))) return [];
  const unarmed = traits.includes("unarmed") || weapon.data?.category === "unarmed";
  if (unarmed && isAquaticCreature(token)) return [];
  return [{ name: "Underwater (bludgeoning or slashing)", type: "circumstance", value: -2, isPenalty: true, active: true }];
}

// Underwater for the selected tokens: on (with off-guard for those without a
// swim Speed), or off for those already underwater
function toggleUnderwater() {
  const tokens = (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t);
  if (tokens.length === 0) {
    api.showNotification("Select the creatures in the water.", "yellow", "Underwater");
    return;
  }
  const entering = [];
  const leaving = [];
  tokens.forEach((token) => {
    const underwater = getTokenCondition(token, "Underwater")?.effect;
    if (underwater) {
      api.removeEffectById(underwater._id, token);
      leaving.push(getTokenDisplayName(token));
      return;
    }
    const swims = hasSwimSpeed(token);
    api.addEffects(swims ? ["Underwater"] : ["Underwater", "Off-Guard"], token);
    entering.push(`${getTokenDisplayName(token)}${swims ? "" : " (off-guard: no swim Speed)"}`);
  });
  const lines = [];
  if (entering.length > 0) {
    lines.push(`**Underwater:** ${entering.join(", ")}.`);
    lines.push("Resistance 5 to acid and fire. Bludgeoning and slashing attacks take a -2 circumstance penalty, ranged range increments are halved, and fire doesn't work. Holding breath: Hold Breath button.");
    lines.push("```Hold_Breath\nholdBreathSelected();\n```");
  }
  if (leaving.length > 0) {
    lines.push(`**Out of the water:** ${leaving.join(", ")}. Remove off-guard if the water gave it.`);
  }
  api.sendMessage(lines.join("\n"));
}

// ---------------------------------------------------------------- Holding breath

// Rounds of air: 5 + the Constitution modifier (at least 1)
function getAirRounds(token) {
  const data = token?.data || token?.record?.data || {};
  return Math.max(1, 5 + (parseInt(data.con || "0", 10) || 0));
}

function holdBreathSelected() {
  const tokens = (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t);
  tokens.forEach((token) => {
    const current = getTokenCondition(token, "Holding Breath")?.value || 0;
    const air = getAirRounds(token);
    if (current >= air) return;
    api.addEffects(Array(air - current).fill("Holding Breath"), token);
    api.sendMessage(`**${getTokenDisplayName(token)} holds their breath:** ${air} rounds of air.`, undefined, [], [], token);
  });
}

// The turn end's card for a creature holding its breath or suffocating, or
// "" for one doing neither
function getBreathTurnEndMessage(token) {
  if (!token) return "";
  const name = getTokenDisplayName(token);
  const button = (label, call) => getManeuverButton(label, token._id, name, call);
  const suffocating = getTokenCondition(token, "Suffocating")?.value || 0;
  if (suffocating > 0) {
    const dc = 20 + 5 * (suffocating - 1);
    return [
      `**${name} is suffocating:** Fortitude DC ${dc}. Failure: ${suffocating}d10 damage. Critical failure: dies.`,
      button("Roll_Fortitude", `rollSuffocationSave(token)`),
      button(`Roll_${suffocating}d10_Damage`, `api.promptRoll("Suffocation", "${suffocating}d10", [], { rollName: "Suffocation" }, "damage")`),
      button("Breathes_Again", "breatheAgain(token)"),
    ].join("\n");
  }
  const air = getTokenCondition(token, "Holding Breath")?.value || 0;
  if (air <= 0) return "";
  return [
    `**${name} is holding their breath:** ${air} round${air > 1 ? "s" : ""} of air. The end of each turn takes 1, or 2 after attacking or casting a spell; a critical hit or a critically failed save against damage takes 1 more; speaking takes all of it.`,
    button("Lose_1_Round", "loseAir(token, 1)"),
    button("Attacked_or_Cast:_Lose_2", "loseAir(token, 2)"),
    button("Breathes_Again", "breatheAgain(token)"),
  ].join("\n");
}

// Spends air: one Holding Breath stack a round. Out of air, the creature
// falls unconscious and starts suffocating.
function loseAir(token, rounds = 1) {
  const held = getTokenCondition(token, "Holding Breath");
  if (!held) return;
  const left = Math.max(0, held.value - rounds);
  // The last instances, one at a time. The token passed in isn't updated
  // by the removals, so the indexes are worked out first.
  const indexes = [];
  for (let index = held.value - 1; index >= left; index--) indexes.push(index);
  const remove = (done) => {
    if (indexes.length === 0) {
      done();
      return;
    }
    api.removeEffectById(held.effect._id, token, () => remove(done), {
      instanceIndex: indexes.shift(),
    });
  };
  remove(() => {
    const name = getTokenDisplayName(token);
    if (left > 0) {
      api.sendMessage(`${name}: ${left} round${left > 1 ? "s" : ""} of air left.`, undefined, [], [], token);
      return;
    }
    api.addEffects(["Unconscious", "Suffocating"], token);
    api.sendMessage(
      `**${name} is out of air:** unconscious and suffocating, and can't recover while suffocating. A Fortitude save (DC 20) at the end of each turn.`,
      undefined,
      [],
      [],
      token,
    );
  });
}

// The suffocation save: DC 20, +5 for each one before. Each roll counts
// toward the next.
function rollSuffocationSave(token) {
  const suffocating = getTokenCondition(token, "Suffocating")?.value || 1;
  rollSave(token, "fortitude", 20 + 5 * (suffocating - 1), false, true);
  api.addEffect("Suffocating", token);
}

// Able to breathe again: no longer holding breath or suffocating. Unconscious
// stays at 0 Hit Points.
function breatheAgain(token) {
  // Every instance of each goes at once. The ids are read first: the token
  // passed in isn't updated by the removals.
  const ids = ["Holding Breath", "Suffocating"]
    .map((name) => getTokenCondition(token, name)?.effect?._id)
    .filter(Boolean);
  const next = () => {
    const id = ids.shift();
    if (!id) {
      api.sendMessage(
        `**${getTokenDisplayName(token)} can breathe again.** No longer unconscious from suffocating, unless at 0 Hit Points.`,
        undefined,
        [],
        [],
        token,
      );
      return;
    }
    api.removeEffectById(id, token, next);
  };
  next();
}
