// Dying, wounded and doomed (Player Core pg. 410-411, 443, 446-447): the
// dying value a creature dies at, recovery checks, healing out of dying,
// Heroic Recovery, nonlethal knockouts, Orc Ferocity and Administer First
// Aid. The numbers follow Foundry PF2e's actor data: dying dies at 4 (Diehard
// raises it to 5) less the doomed value, wounded stops 1 below that, and a
// recovery check is DC 10 (Toughness lowers it by 1) plus the dying value.
// Loaded as one of the ruleset's scripts (ruleset.config.json,
// otherSettings.scripts), so it shares common.js's scope at runtime.

function getDyingValue(creature) {
  return parseInt(creature?.data?.dying || "0", 10) || 0;
}

function getWoundedValue(creature) {
  return parseInt(creature?.data?.wounded || "0", 10) || 0;
}

// A creature's doomed value, from the Doomed condition on it
function getDoomedValue(creature) {
  return getTokenCondition(creature, "doomed")?.value || 0;
}

// The dying value a creature dies at: 4, or 5 with Diehard, less its doomed
// value. At 0 or less it dies as soon as it gains dying.
function getDeathThreshold(creature) {
  return getDyingMaximum(creature) - getDoomedValue(creature);
}

// The dying value a creature dies at before doomed: 4, 5 with Diehard, or
// higher from dyingMax modifiers (the highest applies)
function getDyingMaximum(creature) {
  let maximum = hasFeatNamed(creature, "Diehard") ? 5 : 4;
  getEffectsAndModifiersForToken(creature, ["dyingMax"]).forEach((mod) => {
    if (mod.active === false) return;
    const value = parseInt(mod.value, 10);
    if (value > maximum) maximum = value;
  });
  return maximum;
}

// recoveryDC modifiers adjust the recovery check DC (Toughness and Mountain's
// Stoutness lower it by 1); like Toughness, the strongest reduction applies
function getRecoveryDCAdjustment(creature) {
  let adjustment = hasFeatNamed(creature, "Toughness") ? -1 : 0;
  getEffectsAndModifiersForToken(creature, ["recoveryDC"]).forEach((mod) => {
    if (mod.active === false) return;
    const value = parseInt(mod.value, 10);
    if (!isNaN(value) && value < adjustment) adjustment = value;
  });
  return adjustment;
}

// The highest wounded value, 1 below the dying value a creature dies at
// before doomed (3, or 4 with Diehard)
function getWoundedMax(creature) {
  return getDyingMaximum(creature) - 1;
}

// The DC of a recovery check: 10 + the dying value, 1 lower with Toughness
// (the Core Rulebook's Toughness made it 9 + dying, the same number)
function getRecoveryCheckDC(creature, dying = getDyingValue(creature)) {
  return 10 + dying + getRecoveryDCAdjustment(creature);
}

// Whether damage has the nonlethal trait (fists, nonlethal spells), which
// knocks a creature out instead of killing it (Player Core pg. 407, 410)
function isNonlethalDamage(traits) {
  return (traits || []).some((trait) =>
    ["nonlethal", "non-lethal"].includes(`${trait || ""}`.toLowerCase().trim()),
  );
}

// The dying value damage gives a creature at 0 Hit Points: dying 1 (2 from a
// critical hit or its own critical failure) plus its wounded value when it
// gains dying, or 1 (2) more while it's already dying
function getDyingAfterDamage(creature, critical) {
  const dying = getDyingValue(creature);
  const step = critical ? 2 : 1;
  return dying > 0 ? dying + step : step + getWoundedValue(creature);
}

// Whether the person viewing can change a token's sheet: the GM or its owner
function canChangeToken(token) {
  if (typeof isGM !== "undefined" && isGM) {
    return true;
  }
  const viewer = typeof userId !== "undefined" ? userId : null;
  const owner = token?.record?.ownerId || token?.ownerId || null;
  return !viewer || !owner || `${owner}` === `${viewer}`;
}

// Runs `action` on the token a chat button is for: the selected token with
// that id, or the one the button was dropped on, so a button on one
// creature's message never changes another's. Asks to select it otherwise.
function withChatButtonToken(tokenId, name, droppedOn, action) {
  const selected = (api.getSelectedOrDroppedToken() || []).map((t) => t?.token || t);
  const token =
    selected.find((t) => t?._id === tokenId) ||
    (droppedOn?._id === tokenId ? droppedOn : null);
  if (!token) {
    api.showNotification(`Select ${name}'s token, then click again.`, "yellow", "Notice");
    return;
  }
  action(token);
}

// A chat button that runs `call`, code using `token`, on a creature's own
// token
function getChatButton(label, creature, call) {
  const droppedOn = 'typeof record !== "undefined" ? record : null';
  const fence = "```";
  return `${fence}${label}\nwithChatButtonToken('${creature._id}', '${getCreatureName(creature)}', ${droppedOn}, (token) => ${call});\n${fence}`;
}

function getCreatureName(creature) {
  const name =
    creature?.identified === false
      ? creature?.unidentifiedName || creature?.record?.unidentifiedName
      : creature?.name || creature?.record?.name;
  return `${name || "The creature"}`.replace(/'/g, "");
}

function getHeroPoints(creature) {
  return parseInt(creature?.data?.heroPoints || "0", 10) || 0;
}

// Whether a character can use Orc Ferocity now: once per day, or once per
// hour with Incredible Ferocity. The feat's uses count once the sheet keeps
// them (limited-uses.js); before that, a flag the night's rest clears.
function canUseOrcFerocity(creature) {
  if (!hasFeatNamed(creature, "Orc Ferocity")) {
    return false;
  }
  const uses = getOrcFerocityUses(creature);
  if (uses) {
    return uses.left > 0;
  }
  return !creature?.data?.orcFerocityUsed || hasFeatNamed(creature, "Incredible Ferocity");
}

// The uses Orc Ferocity keeps on a character's feat row, { path, left, max,
// per, label }, or null when the sheet doesn't keep them (limited-uses.js)
function getOrcFerocityUses(creature) {
  const row = findFeatRow(creature, "Orc Ferocity");
  const uses = getLimitedUses(row?.item);
  return uses ? { ...uses, path: row.path } : null;
}

// What being reduced to 0 Hit Points does to a character or companion in
// applyDamage: it gains dying (unconscious and prone), or dies at the dying
// value it dies at. Nonlethal damage knocks it out without dying. Writes into
// valuesToSet and oldValues. Returns { lines, buttons }: the lines for the
// damage message, and buttons for Heroic Recovery when dying went up and for
// Orc Ferocity when it can still be used.
function getZeroHitPointsChanges(target, { critical = false, nonlethal = false, valuesToSet, oldValues }) {
  const name = getCreatureName(target);
  const dying = getDyingValue(target);
  const wasUnconscious = !!getTokenCondition(target, "unconscious");
  const lines = [];
  const buttons = [];
  const effects = [];
  let dead = false;

  if (nonlethal && dying === 0) {
    lines.push(`${name} is knocked out by nonlethal damage (unconscious at 0 HP, not dying).`);
  } else {
    const threshold = getDeathThreshold(target);
    const raised = getDyingAfterDamage(target, critical);
    const next = threshold > 0 ? Math.min(raised, threshold) : raised;
    oldValues["data.dying"] = dying;
    valuesToSet["data.dying"] = next;
    lines.push(
      dying > 0
        ? `${name}'s dying value goes up to ${next}${critical ? " (critical hit)" : ""}.`
        : `${name} gains Dying ${next}${critical ? " (critical hit increases dying by 2)" : ""}.`,
    );
    dead = threshold <= 0 || next >= threshold;
    if (dead) {
      effects.push("Dead");
      lines.push(`**[center][color=red]DEAD (Dying ${next})[/color][/center]**`);
    }
  }
  if (!dead && !wasUnconscious) {
    effects.push("Unconscious", "Prone");
  }
  if (effects.length > 0) {
    api.addEffects(effects, target);
  }

  // Heroic Recovery: when the dying value would increase
  if (!(nonlethal && dying === 0) && getHeroPoints(target) > 0) {
    buttons.push(getChatButton("Heroic_Recovery", target, "heroicRecovery(token)"));
  }
  // Orc Ferocity: when the creature would be reduced to 0 Hit Points
  if (target.recordType === "characters" && canUseOrcFerocity(target)) {
    const before = JSON.stringify({ dying, addedUnconscious: !wasUnconscious });
    buttons.push(getChatButton("Orc_Ferocity", target, `useOrcFerocity(token, ${before})`));
  }
  return { lines, buttons };
}

// What healing does to a creature it brings from 0 Hit Points to 1 or more
// (Player Core pg. 411, 446): it loses dying and unconscious, and losing
// dying adds 1 wounded. Healing other than from rest also wakes a creature
// that's unconscious with Hit Points left (asleep). Returns { values, wake }:
// the values to write and whether its Unconscious condition comes off.
function getHealingChanges(creature, oldHp, newHp, fromRest = false) {
  const values = {};
  if (newHp <= oldHp || newHp < 1) {
    return { values, wake: false };
  }
  if (getDyingValue(creature) > 0) {
    values["data.dying"] = 0;
    values["data.wounded"] = Math.min(getWoundedValue(creature) + 1, getWoundedMax(creature));
  }
  const wake = !!getTokenCondition(creature, "unconscious") && (oldHp < 1 || !fromRest);
  return { values, wake };
}

// Takes the Unconscious condition off a creature that woke up
function wakeCreature(creature, callback) {
  const unconscious = getTokenCondition(creature, "unconscious");
  if (!unconscious) {
    if (typeof callback === "function") callback();
    return;
  }
  api.removeEffectById(unconscious.effect._id, creature, () => {
    if (typeof callback === "function") callback();
  });
}

// Applies healing to a token, as the Apply Healing button on a healing roll
// does: Hit Points up to the maximum, out of dying and unconscious, and, for
// Treat Wounds, the wounded condition gone. Sends the chat line with an Undo
// button for the GM.
function applyHealingToToken(target, healing, options = {}) {
  if (!target?.data || !(healing > 0)) {
    return;
  }
  // Healing the target receives changes by its own healingReceived
  // modifiers (Robust Health: + level from Treat Wounds). Context: the action
  // (action:treat-wounds) and, for spells, item:type:spell.
  const received = getHealingReceivedAdjustment(target, options);
  healing = Math.max(0, healing + received.amount);
  if (!(healing > 0)) {
    return;
  }
  const oldHp = parseInt(target.data?.curhp || "0", 10) || 0;
  const maxHp = parseInt(target.data?.hitpoints || "0", 10) || 0;
  const newHp = Math.min(oldHp + healing, maxHp);
  const { values, wake } = getHealingChanges(target, oldHp, newHp);
  const valuesToSet = { "data.curhp": newHp, ...values };
  const lines = [];
  if (values["data.dying"] === 0) {
    lines.push(`no longer dying (wounded ${values["data.wounded"]})`);
  }
  // Treat Wounds ends the wounded condition when it restores Hit Points
  if (options.treatWounds && (valuesToSet["data.wounded"] ?? getWoundedValue(target)) > 0) {
    valuesToSet["data.wounded"] = 0;
    lines.push("no longer wounded");
  }
  const oldValues = {};
  for (const key of Object.keys(valuesToSet)) {
    oldValues[key] =
      key === "data.curhp" ? oldHp : parseInt(target.data?.[key.slice(5)] || "0", 10) || 0;
  }
  api.setValuesOnTokenById(target._id, target.recordType, valuesToSet);
  if (wake) {
    wakeCreature(target);
  }

  const name = getCreatureName(target);
  const adjusted = received.names.length > 0 ? ` (${received.names.join(", ")})` : "";
  const text = `${name} healed for ${healing} HP${adjusted}${lines.length > 0 ? `, ${lines.join(" and ")}` : ""}.`;
  const undo = `\`\`\`Undo\nif (isGM) { api.setValuesOnTokenById('${target._id}', '${target.recordType}', ${JSON.stringify(oldValues)}); api.editMessage(null, '~${text}~'); } else { api.showNotification('Only the GM can undo healing.', 'yellow', 'Notice'); }\n\`\`\``;
  api.sendMessage(`${text}\n${undo}`, undefined, undefined, undefined, target);
  api.floatText(target, `+${healing}`, "#1bc91b");
}

// The target's healingReceived modifiers for this healing: amount to add
// (negative for penalties) and the names of the modifiers that applied
function getHealingReceivedAdjustment(target, options = {}) {
  const action =
    options.action || (options.treatWounds ? "Treat Wounds" : "") || "";
  const context = {};
  if (action) context.action = { name: action };
  if (options.isSpell) context.origin = { recordType: "spells", data: { traits: ["magical", "healing"] } };
  let amount = 0;
  const names = [];
  getEffectsAndModifiersForToken(
    target,
    ["healingReceivedBonus", "healingReceivedPenalty"],
    "",
    undefined,
    undefined,
    context,
  ).forEach((mod) => {
    if (mod.active === false || mod.situational) return;
    const value = parseInt(mod.value || 0, 10) || 0;
    if (!value) return;
    amount += value;
    names.push(`${value > 0 ? "+" : ""}${value} ${mod.name}`);
  });
  return { amount, names };
}

// Heroic Recovery (Player Core pg. 411): with at least 1 Hero Point, a dying
// character can spend all of them at the start of their turn or when their
// dying value would increase. They lose the dying condition and stabilize at
// 0 Hit Points, still unconscious, and their wounded value stays as it was.
// A death from that increase is undone.
function heroicRecovery(token) {
  if (!token?.data) {
    return;
  }
  if (!canChangeToken(token)) {
    api.showNotification("Only the GM or the character's owner can use Heroic Recovery.", "yellow", "Notice");
    return;
  }
  const heroPoints = getHeroPoints(token);
  const dead = getTokenCondition(token, "dead");
  if (heroPoints < 1) {
    api.showNotification(`${getCreatureName(token)} has no Hero Points.`, "yellow", "Notice");
    return;
  }
  if (getDyingValue(token) === 0 && !dead) {
    api.showNotification(`${getCreatureName(token)} isn't dying.`, "yellow", "Notice");
    return;
  }
  api.setValuesOnTokenById(token._id, token.recordType, {
    "data.heroPoints": 0,
    "data.dying": 0,
  });
  if (dead) {
    api.removeEffectById(dead.effect._id, token);
  }
  api.sendMessage(
    `**${getCreatureName(token)} uses Heroic Recovery**, spending ${heroPoints} Hero Point${heroPoints === 1 ? "" : "s"}: no longer dying, stable at 0 HP and still unconscious.`,
    undefined,
    undefined,
    undefined,
    token,
  );
}

// Orc Ferocity (Player Core pg. 72), a reaction once per day (once per hour
// with Incredible Ferocity): reduced to 0 Hit Points but not killed outright,
// the character stays at 1 Hit Point and their wounded value goes up by 1.
// Undying Ferocity also gives temporary Hit Points equal to their level.
// Undoes what the damage did at 0 Hit Points: `before` holds the dying value
// before it and whether it knocked them out.
function useOrcFerocity(token, before = {}) {
  if (!token?.data) {
    return;
  }
  if (!canChangeToken(token)) {
    api.showNotification("Only the GM or the character's owner can use Orc Ferocity.", "yellow", "Notice");
    return;
  }
  const name = getCreatureName(token);
  const uses = getOrcFerocityUses(token);
  if (!canUseOrcFerocity(token)) {
    api.showNotification(
      uses
        ? `${name} has no uses of Orc Ferocity left (${describeLimitedUseLimit(uses)}).`
        : `${name} already used Orc Ferocity today.`,
      "yellow",
      "Notice",
    );
    return;
  }
  const wounded = Math.min(getWoundedValue(token) + 1, getWoundedMax(token));
  const valuesToSet = {
    "data.curhp": 1,
    "data.dying": parseInt(before.dying || "0", 10) || 0,
    "data.wounded": wounded,
  };
  if (uses) {
    valuesToSet[`${uses.path}.data.usesLeft`] = uses.left - 1;
  } else {
    valuesToSet["data.orcFerocityUsed"] = true;
  }
  const lines = [`stays at 1 HP, wounded ${wounded}`];
  if (uses) {
    lines.push(describeLimitedUses(uses, uses.left - 1));
  }
  if (hasFeatNamed(token, "Undying Ferocity")) {
    const level = parseInt(token.data?.level || "0", 10) || 0;
    const tempHp = parseInt(token.data?.tempHp || "0", 10) || 0;
    if (level > tempHp) {
      valuesToSet["data.tempHp"] = level;
    }
    lines.push(`${level} temporary HP from Undying Ferocity`);
  }
  api.setValuesOnTokenById(token._id, token.recordType, valuesToSet);
  const remove = ["dead", ...(before.addedUnconscious ? ["unconscious", "prone"] : [])]
    .map((condition) => getTokenCondition(token, condition)?.effect?._id)
    .filter(Boolean);
  const removeNext = () => {
    const id = remove.shift();
    if (id) api.removeEffectById(id, token, removeNext);
  };
  removeNext();
  api.sendMessage(`**${name} uses Orc Ferocity**: ${lines.join(", ")}.`, undefined, undefined, undefined, token);
}

// The chat line at the start of a dying character's turn: their recovery
// check, with buttons to roll it and, with Hero Points, to use Heroic
// Recovery instead
function getRecoveryCheckPrompt(token) {
  const dying = getDyingValue(token);
  const lines = [
    `**${getCreatureName(token)} is dying** (dying ${dying}, dies at dying ${getDeathThreshold(token)}). Attempt a recovery check: DC ${getRecoveryCheckDC(token, dying)} flat check.`,
    getChatButton("Roll_Recovery_Check", token, "rollRecoveryCheckFor(token)"),
  ];
  if (getHeroPoints(token) > 0) {
    lines.push(getChatButton("Heroic_Recovery", token, "heroicRecovery(token)"));
  }
  return lines.join("\n");
}

// Rolls a token's recovery check, from the button at the start of its turn
function rollRecoveryCheckFor(token) {
  if (!token) {
    return;
  }
  if (!canChangeToken(token)) {
    api.showNotification("Only the GM or the character's owner can roll this recovery check.", "yellow", "Notice");
    return;
  }
  api.promptRollForToken(
    token,
    "Recovery Check",
    "1d20",
    [],
    { rollName: "Recovery Check", recordId: token.recordId || token._id, tokenId: token._id },
    "recovery",
  );
}

// The result of a recovery check (Player Core pg. 411): dying down by 2 or 1
// on a critical success or success, up by 1 or 2 on a failure or critical
// failure. Losing dying adds 1 wounded; reaching the dying value it dies at
// kills it. `degree`: 2 critical success, 1 success, 0 failure, -1 critical
// failure. Returns { values, dying, dead }.
function getRecoveryCheckResult(creature, degree) {
  const dying = getDyingValue(creature);
  const threshold = getDeathThreshold(creature);
  const change = { 2: -2, 1: -1, 0: 1, "-1": 2 }[degree] ?? 0;
  const cap = threshold > 0 ? threshold : Infinity;
  const next = Math.max(0, Math.min(dying + change, cap));
  const values = { "data.dying": next };
  if (dying > 0 && next === 0) {
    values["data.wounded"] = Math.min(getWoundedValue(creature) + 1, getWoundedMax(creature));
  }
  // Doomed can bring the dying value it dies at to 0, which kills at once
  return { values, dying: next, dead: threshold <= 0 || (next > 0 && next >= threshold) };
}

// Rest: a creature at full Hit Points after 10 minutes of rest loses the
// wounded condition (Player Core pg. 447). The values to write.
function getRestWoundedChanges(creature, hpAfterRest) {
  const maxHp = parseInt(creature?.data?.hitpoints || "0", 10) || 0;
  if (getWoundedValue(creature) > 0 && maxHp > 0 && hpAfterRest >= maxHp) {
    return { "data.wounded": 0 };
  }
  return {};
}

// The Medicine check's modifiers for a healer, as Treat Wounds builds them
function getMedicineCheckModifiers(healer, action = "Administer First Aid") {
  // The action (action:administer-first-aid) and statistic for predicates
  const context = getRollSourceContext({ action }, "medicine");
  const medicineMod = parseInt(healer.data?.medicineMod || "0", 10) || 0;
  const training = parseInt(healer.data?.medicine || "0", 10) || 0;
  const rank = ["Untrained", "Trained", "Expert", "Master", "Legendary"][training] || "Untrained";
  const modifiers = [];
  if (medicineMod !== 0) {
    modifiers.push({ name: `Medicine (${rank})`, type: "", value: medicineMod, active: true });
  }
  const seen = new Set();
  const attribute = healer.data?.medicineAbility || "wis";
  for (const mod of [
    ...getEffectsAndModifiersForToken(healer, ["skillBonus", "skillPenalty"], ["medicine", "skill-check"], undefined, undefined, context),
    ...getEffectsAndModifiersForToken(healer, ["allBonus", "allPenalty"], attribute, undefined, undefined, context),
  ]) {
    const key = modToString(mod);
    if (!seen.has(key)) {
      seen.add(key);
      modifiers.push(mod);
    }
  }
  return { modifiers, attribute, medicineMod, rank };
}

// Administer First Aid (Player Core pg. 241), on the targeted creature by the
// selected one: Stabilize a dying creature (DC 5 + its recovery check DC) or
// Stop Bleeding (the DC of the effect that caused the bleed, asked for). The
// skill roll handler posts the result's buttons.
function administerFirstAid() {
  let healer = (api.getSelectedOrDroppedToken() || [])[0];
  if (healer?.token) healer = healer.token;
  if (!healer?.data) {
    api.showNotification("Select the character administering first aid.", "yellow", "Notice");
    return;
  }
  const targeted = (api.getTargets() || [])[0];
  const target = targeted?.token || targeted || null;
  if (!target?.data) {
    api.showNotification("Target the dying or bleeding creature.", "yellow", "Notice");
    return;
  }
  const dying = getDyingValue(target);
  const stabilizeDC = 5 + getRecoveryCheckDC(target, dying);
  const options = [];
  if (dying > 0) {
    options.push({ label: `Stabilize (DC ${stabilizeDC})`, value: "stabilize" });
  }
  options.push({ label: "Stop Bleeding", value: "stop-bleeding" });

  const roll = (variant, dc) => {
    const { modifiers, attribute } = getMedicineCheckModifiers(healer);
    const label = variant === "stabilize" ? "Stabilize" : "Stop Bleeding";
    api.promptRoll(
      `Administer First Aid: ${label} (Medicine)`,
      "1d20",
      modifiers,
      {
        rollName: `Administer First Aid: ${label}`,
        tooltip: "Administer First Aid (Medicine Check)",
        skillName: "medicine",
        dc,
        degreeOfSuccessAdjustments: getDegreeOfSuccessAdjustments(
          healer,
          ["medicine", "skill-check", attribute],
          undefined,
          undefined,
          getRollSourceContext({ action: "Administer First Aid" }, "medicine"),
        ),
        action: "Administer First Aid",
        administerFirstAid: { variant, target: getCreatureName(target), targetId: target._id },
      },
      "skill",
    );
  };

  api.showPrompt(
    "Administer First Aid",
    `${getCreatureName(target)}${dying > 0 ? ` is dying ${dying}` : ""}. Choose what to treat.`,
    "Select...",
    options,
    null,
    (selected) => {
      const variant = Array.isArray(selected) ? selected[0] : selected;
      if (variant === "stabilize") {
        roll("stabilize", stabilizeDC);
      } else if (variant === "stop-bleeding") {
        api.showValuePrompt("Stop Bleeding", "The DC of the effect that caused the bleed", (value) => {
          const dc = parseInt(value, 10);
          if (dc > 0) roll("stop-bleeding", dc);
        });
      }
    },
  );
}

// The lines the skill roll handler adds to an Administer First Aid check's
// result, with the button that applies it to the target's token
function getFirstAidResultLines(firstAid, degree) {
  const target = { _id: firstAid?.targetId, name: firstAid?.target };
  if (firstAid?.variant === "stabilize") {
    if (degree >= 1) {
      return [
        `**${target.name} loses the dying condition (but remains unconscious).**`,
        getChatButton("Apply_Stabilize", target, "applyFirstAidStabilize(token, true)"),
      ];
    }
    if (degree === -1) {
      return [
        `**${target.name}'s dying value increases by 1.**`,
        getChatButton("Apply_Dying_Increase", target, "applyFirstAidStabilize(token, false)"),
      ];
    }
    return [];
  }
  if (degree >= 1) {
    return [
      `**${target.name} gets an assisted recovery: a DC 10 flat check to end the bleeding.**`,
      getChatButton(
        "Roll_Bleeding_Flat_Check",
        target,
        `api.promptRollForToken(token, "Bleeding Flat Check", "1d20", [], { rollName: "Bleeding Flat Check", dc: 10 }, "flatCheck")`,
      ),
    ];
  }
  if (degree === -1) {
    return [`**${target.name} immediately takes its persistent bleed damage.**`];
  }
  return [];
}

// Applies a Stabilize result: success ends dying (adding 1 wounded) and the
// creature stays unconscious at 0 Hit Points; a critical failure raises dying
// by 1, which can kill it
function applyFirstAidStabilize(target, success) {
  if (!target?.data || getDyingValue(target) === 0) {
    return;
  }
  if (!canChangeToken(target)) {
    api.showNotification("Only the GM or the character's owner can change their dying value.", "yellow", "Notice");
    return;
  }
  const { values, dead } = getRecoveryCheckResult(target, success ? 1 : 0);
  if (success) {
    values["data.dying"] = 0;
    values["data.wounded"] = Math.min(getWoundedValue(target) + 1, getWoundedMax(target));
  }
  api.setValuesOnTokenById(target._id, target.recordType, values);
  const name = getCreatureName(target);
  if (!success && dead) {
    api.addEffect("Dead", target);
    api.sendMessage(`**[center][color=red]${name} DIES (Dying ${values["data.dying"]})[/color][/center]**`, undefined, undefined, undefined, target);
  } else {
    api.sendMessage(
      success
        ? `${name} is stabilized: no longer dying, wounded ${values["data.wounded"]}.`
        : `${name}'s dying value goes up to ${values["data.dying"]}.`,
      undefined,
      undefined,
      undefined,
      target,
    );
  }
}

// An Administer First Aid button for the action's chat message, which the
// module's action doesn't have (its Treat Wounds has a macro link)
function getFirstAidActionMacro(action) {
  const name = `${action?.name || ""}`.trim().toLowerCase();
  const description = `${action?.data?.description || ""}`;
  if (name !== "administer first aid" || description.includes("administerFirstAid")) {
    return "";
  }
  return `\n\`\`\`Administer_First_Aid\nadministerFirstAid();\n\`\`\``;
}
