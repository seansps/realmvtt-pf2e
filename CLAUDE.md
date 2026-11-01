# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

- Answer at the altitude asked. Do not restate what the code already shows.
- Do not narrate steps as you take them, and do not explain reasoning that was not requested.
- Report what changed and anything that broke or is still outstanding. Skip the rest — no preamble, no recap of small edits, no summarizing the summary.

## Overview

This is a Pathfinder 2nd Edition ruleset implementation for Realm VTT. The codebase consists of HTML files with embedded JavaScript that interact with the Realm VTT API.

**Important**: This ruleset uses the Realm VTT API (https://www.realmvtt.com/wiki/ruleset-editor-and-api). HTML and JavaScript must be written to conform to this API. Field values cannot be directly embedded into HTML - all data access must go through the API.

## Architecture

### Data Path System

- `dataPath` - Current field's data path context
- `getNearestParentDataPath(dataPath)` - Navigate to parent object in data hierarchy
- `record` - The current record being edited
- Field paths use dot notation: `data.ancestries`, `fields.levelLabel.hidden`

### Modifier System - Critical for All Rolls

**Always check for relevant modifiers before making any roll** using `getEffectsAndModifiersForToken`:

```javascript
getEffectsAndModifiersForToken(record, modifierTypes, field, itemId, appliedById)
```

**Parameters**:
- `record` - The character/token record
- `modifierTypes` - Array of modifier types (e.g., `['saveBonus', 'savePenalty']`)
- `field` - **Third parameter (often required)** - The relevant field/context (e.g., 'fortitude', 'dex', 'perception')
- `itemId` - Fourth parameter - Only for attack rolls with specific items
- `appliedById` - Fifth parameter - Only when checking for effects from specific tokens

**Implementation Pattern**:
1. Always make TWO modifier checks:
   - Specific modifiers for the roll type
   - General modifiers using `['allBonus', 'allPenalty']` with the relevant attribute

2. Example for saving throws:
```javascript
// Get save-specific modifiers (e.g., fortitude bonus)
const saveMods = getEffectsAndModifiersForToken(
  record,
  ['saveBonus', 'savePenalty'],
  saveType // 'fortitude', 'reflex', or 'will'
);

// Get attribute-based all modifiers
const allMods = getEffectsAndModifiersForToken(
  record,
  ['allBonus', 'allPenalty'],
  attribute // 'con' for fort, 'dex' for reflex, 'wis' for will
);
```

**Note**: The field parameter may not be relevant for all modifier types, but include it when there's a relevant context.

### UI Conventions

- Lists use `_id` field with `generateUuid()` for unique identifiers
- Trait objects structure: `{ _id, name, identified, data }`
- Hidden field control via `fields.[fieldname].hidden` properties
- Conditional visibility based on data values

## Development Guidelines

### Working with HTML Files

1. All JavaScript must be within `<script>` tags in the HTML files
2. Functions can reference the global `record`, `dataPath`, and `api` objects
3. Use `api.setValues()` for all data modifications - never modify data directly
4. Always provide callbacks when chaining operations that depend on data updates

Fields such as `onload` and `onchange` only work on Realm VTT field HTML, not on plain elements like `div` or `span`.

### Adding New Features

1. Check existing patterns in similar files (e.g., other `-main.html` or `-list.html` files)
2. Use `generateUuid()` when adding items to lists
3. Implement `showHideFields()` for dynamic UI elements
4. Handle drag-and-drop via `onDrop()` functions

### Modifying Game Mechanics

1. Core mechanics are in `rollhandlers/common.js`
2. Proficiency calculations, ability scores, and modifiers are centralized
3. Use `onAddEditFeature()` to trigger recalculations after data changes

### Attack Log (multiple attack penalty, momentum traits)

`rollhandlers/attack-log.js` counts the attacks a creature makes on its own turn. It suggests and never enforces, since players make mistakes:

- Strikes keep their 1st/2nd/3rd buttons, which always set the penalty. The card doesn't compare the button with the count: a player can roll again before the last roll's result is logged, so the count can lag behind.
- Spell attacks and attack-trait skill actions (Grapple, Trip...) get the penalty from the count as a ticked modifier that can be unticked in the roll prompt.
- Forceful, twin, sweep and backswing apply from the earlier attacks, also as ticked modifiers.

Storage:

- `onTurnStart` sets the campaign variable `pf2eTurn` to `{ key, round, tokenId, recordId }`. The same token's turn starting again in the same round (Next after Previous) keeps the key and so the turn's log; any other turn start gets a new key. `onEncounterEnd` clears it, so a new encounter always starts a new log.
- The log is on the attacker's token at `data.turnAttacks` (`{ turnKey, attacks }`). It is written only by the result handlers (`attack.js`, `skill.js`) from `metadata.turnAttack`, which carries the log as it was at roll time. A log whose `turnKey` isn't the current turn's is ignored.

When adding a new kind of attack roll, pass `turnAttack` (from `getTurnAttackMetadata`) in the roll metadata and call `logTurnAttack` in its result handler. Attacks on another creature's turn (reactions) are not logged and take no penalty from the log.

### Stances and the action economy

`rollhandlers/action-limits.js` only swaps stances: applying a `Stance: ...` effect (`applyEffectButton`) first removes the creature's other `Stance: ...` effects. The ruleset doesn't police the action economy (flourish, press, finisher, hex, composition, spellshape): no warnings and no per-turn action log. The GM runs those at the table.

### Basic Saves (applied per target)

`rollhandlers/basic-saves.js` lets one damage roll be applied to many creatures by each one's own basic save.

- `rollSave` puts the saver's token in the roll metadata (`saverTokenId`, from `getSaverTokenRef`), and `basicSave: true` when the save button passed `{ basic: true }` (`getSaveMacro`'s `basic` argument; spells with the Basic box).
- `save.js` keeps the result on that token at `data.lastSave` (`{ degree, saveType, dc }`), and a basic save's card says what damage it takes.
- A damage card with `metadata.basicSave` (`{ saveType }`) has an Apply by Saves button. A spell's damage button sets it from the Basic box. An ability's damage buttons (`executeDamageMacro`) get it from `updateDamageMacros` when the description's save button is basic: the module converter writes `rollSavingThrow('reflex', 28, { basic: true })` for Foundry's `@Check[reflex|dc:28|basic]`, with `undefined` for the DC of one without a DC. Older imports without the flag get no button. `applyDamageBySaves` applies it to each selected creature by its most recent save (no time limit and no save-type check; the card names the save it used): none, half, full or double. Each damaged creature's damage card is headed by one bold line ("Fireball: applied by Reflex failure, full damage"); the rest share one card. A save is never marked used, so it can be applied again (another damage part, or redoing it).

### Animal companions (characters)

Animal companions are characters, as Foundry's PF2e Companion Compendia builds them. Their ancestry is the companion type, their class is "Animal Companion", and their stages (Mature, Nimble, Savage, Specialized) are feats, all in a data module. `rollhandlers/animal-companions.js` holds the ruleset's part; common.js calls it:

- `isAnimalCompanionCharacter`: the class is named Animal Companion, or has `data.animalCompanion: true`. Such a character:
  - has no Automatic Bonus Progression (`isAbpCharacter`) and gains no attribute boosts at Level Up (`getLevelUpGains`)
  - benefits only from item bonuses to AC and Speed (`withoutAnimalCompanionItemBonuses`, in `getEffectsAndModifiersForToken`; an effect rule's `-item` suffix is stripped first)
  - gets at most +3 to AC from item bonuses all told: its armor's (barding's, potency included, `getACForArmor`), and the rest of the +3 for any other
  - shows no free boost fields when its level is typed in by hand (`getFreeBoostFieldsForLevel`)
- Its attributes are `attributeBonus` modifiers on the ancestry's feature. Its ancestry has no boosts or flaws. `attributeBonus` values are added as numbers, and inactive ones are skipped.
- Modifiers the module's feats use:
  - `weaponDiceCount`: the number of base damage dice for matching weapons (`getAlteredWeapon`), the highest wins. Striking runes still add to it. Mature uses 2 and Specialized 3, with predicate `["item:category:unarmed"]`.
  - `creatureSize` value `"+1"`: one size larger, up to Large, adding up and counting from the ancestry's size (`getFeatureCreatureSize`). The rules say "grows by one size if it's Medium or smaller".
- The Notes tab shows an Animal Companion box only for a companion (`fields.companionProperties`, set in `onAddEditFeature`). It has the master (`data.companionMaster`) and a Match Master's Level button. Choosing the master, or the button, sets the companion's level to the master's (`syncCompanionLevel`) and works the sheet out again. There's no level-up hook, so a master's Level Up doesn't reach it on its own.
- Pictures:
  - Dropping a companion ancestry gives the character the ancestry's portrait, and its `data.tokenImage` (or portrait) as the token image. This only fills a picture that's still empty or a placeholder (`getCompanionImageValues`).
  - The Notes tab's **Use art from creature** picker copies any NPC's portrait and token (`onCompanionArtChange`), so a table's own licensed creature art can be used; the module ships none.
- Rules choices:
  - The module's README lists them under "Rules notes".
  - A specialization's "master if it was already expert from its type" is read literally: a savage Bully's Athletics stays expert, where Foundry raises it to master.
  - Barding is modeled as light and heavy armor proficiency.
  - No ABP is Foundry's convention, not a printed rule.
- Companions skip the creation wizard, which requires a key attribute and boosts. You make one by dropping the ancestry and the class on a new character.

### Concealment and detection

`rollhandlers/concealment.js` (Player Core pg. 442-447): a Strike or spell attack against a concealed target (DC 5), or a hidden, invisible or undetected one (DC 11), or from a dazzled (DC 5) or blinded (DC 11) attacker, carries the worst flat check as `metadata.concealment`. `attack.js` shows it as a line and a Flat Check button; nothing is rolled or refused automatically. A hidden, invisible or undetected attacker makes its target off-guard, applied to the AC as flanking is. Effects aren't per observer, so a condition on a token counts against everyone; the GM removes it when it no longer applies.

### Immunities, weaknesses and resistances

`applyDamage` reads them from `getIWR` and matches each damage type, then the roll's `metadata.damageCategories`. The categories follow Foundry's IWR types (`actor/data/iwr.ts`):

- "physical" means bludgeoning, piercing and slashing. "energy" means acid, cold, electricity, fire, sonic, force, vitality and void. Both are expanded into those types (`IWR_DAMAGE_GROUPS`) in the IWR lists, in "ignore ... resistance" modifiers and in suppressIWR.
- `withDamageCategories` adds the categories a roll's types don't carry:
  - "spells" for damage from a spell
  - "holy" or "unholy" when the attack or spell has that trait
  - "area-damage" when its source has an area: `getDamageSource` sets `damageSource.area` from `data.area`, and `updateDamageMacros` also from the ability's text ("in a 30 ft. Cone", `hasAreaText`), since the converted NPC data keeps the area only there. A bare NPC `executeDamageMacro('formula', 'category', 'name')` gets a context (`damageSource`, plus `basicSave` when there is one) when it has a basic save or an area.
  - "splash-damage" on a hit whose damage includes splash (`metadata.splashDamage`) and when splash damage is applied on its own
- Weaknesses are checked for each damage type in the hit. Of those that apply to a type (its own, all damage, then each category), only the highest is added, with exceptions and doubleVs counted first: a demon weak to cold iron 5 and holy 5 takes +5 from a holy cold-iron weapon. A precision weakness is part of that choice for the type the precision damage rides on.
- Legacy data reads as remaster:
  - Damage types: positive becomes vitality and negative becomes void. Good and evil damage becomes spirit damage with the holy or unholy category.
  - Weaknesses, resistances and immunities: positive and negative become vitality and void, and good and evil become holy and unholy, keeping the stronger of a legacy entry and a remaster one.
  - Lawful and chaotic stay as they are.
- A token immune to a condition is asked about it (`getConditionImmunity` in `addConditionGain`, which every Apply button and maneuver goes through): its immunities list names the condition, or object immunities cover it. Vehicles and hazards have object immunities whether or not their data lists them (Foundry adds them to every hazard), nonlethal attacks among them. The GM can apply it anyway; nothing is refused.

### Scrolls and Wands (casting from items)

`rollhandlers/item-spells.js` lets Use on a scroll or wand cast its spell with the character's own spellcasting.

- A scroll or wand is found by its `scroll`/`wand` trait or item category (`getItemSpellKind`), never by its uses. Its spell is the Spell field or the first spell its description links (looked up by id, then by name); its rank is the Level field, "(3rd-Rank Spell)" in its name, or "at 3rd-rank" in its text.
- An automatic "Scrolls and Wands" entry (type `item`, `data.itemSpells: true`) follows the inventory: one row per scroll and wand at the item's rank, whose uses show the wand's use for the day or the scroll's count, and whose `data.itemSpell` (`{ itemId, itemIndex, itemName, kind, spellId }`) names its item. `syncItemSpells` brings it up to date when a scroll or wand is added (dropped on the sheet), equipped, counted, deleted or used; it reads the record again first, writes only the entry (`data.spells.<index>`; `api.addValue` when new, `api.removeValue` when none are left) and only when it changed. It never runs on sheet open. Realm runs every click as a script of its own (a fresh sandbox; top-level variables don't carry over), so two syncs can overlap and can't wait for each other. Each writes against a record it has just read (again after any spell look-up), only when something changed, and removes by id with `api.removeValueFromRecord` on that read (Realm pulls by `_id`, so two removing at once remove once; plain `api.removeValue` maps the index on the record bound when the script started, which can be stale). Two adding at once can leave a second entry; each sync reads again after writing and removes any but the first. A used-up scroll is found again by its id before it's removed, and stays if it's gone or restocked.
- Casting from a row (from the entry, or Use on the item, which syncs and casts the row) goes through `castSpell`: `getItemSpellCast` works out the caster's numbers for that spell (their best prepared or spontaneous entry of its tradition, or one that already lists it, Foundry's `canCast`) and spends the row's item, all in castSpell's one write, and the card says which item and with what. It never refuses: a spent wand still casts, with an overcharge line. An overlay spends nothing. A row from before rows named their item finds it by the spell's name.
- Anything that walks `data.spells` must leave that entry out of slots, uses and refills (`isItemSpellsEntry`); `rest` skips it, and the class sync and recalculation already leave unmanaged `item` entries alone.
- Without the tradition, it casts with Trick Magic Item's DC and attack (Player Core pg. 264: level as proficiency, the highest of Int, Wis and Cha), for casters of another tradition too, and the card says so; the GM asks for the check if the table wants it.
- A scroll is used up (removed at 0 when it auto-destroys, with its row, then bulk is worked out again); a wand spends `uses.value`, which `getWandRecharges` refills at daily preparations, along with its row's uses.

### GM tools (XP, advancement, initiative, DCs)

`rollhandlers/gm-tools.js`:

- Encounter XP (`getEncounterXp`, used by `onEncounterEnd.js`): the creature table from -4 to +4, or from -7 to +7 under Proficiency without Level (Foundry's `xpVariantCreatureDifferences`). Below the table: 0 XP. Above it: the table's highest. A simple hazard always uses the standard simple-hazard table (2 to 32, as Foundry's `getHazardXp`), and a complex hazard uses the creature table.
- Advancement speed: the campaign setting `advancementSpeed` (standard, fast, slow, milestone) feeds `getXpToNextLevel`. The XP bar's `maxvaluefield` is `data.xpToNextLevel`, which `onLoadCharacter` writes once (`getXpBarValues`). Story milestones return 0 XP, so Level Up always shows (it confirms), and the XP bar hides.
- Initiative:
  - A hazard rolls Stealth (`getInitiativeSkill`). Its Stealth modifier is `data.stealth.value`, which the converter copies from Foundry's `system.attributes.stealth.value` (`getHazardStealthMod`, used in `rollSkill` and the NPC sheet). The DC is that plus 10.
  - An adversary that ties a PC goes first. The tracker sorts on `data.initiative` alone, so `initiative.js` stores an enemy's roll plus 0.1 (`getInitiativeValue`). The roll's metadata says which tokens are adversaries; a roll from a sheet uses the sheet's token faction (`api.getToken()`) when there is one.
- DCs: `getSimpleDC(rank)`, `getDCAdjustment` (rarity maps to hard, very hard or incredibly hard) and `getDCForLevel` (PF2e.js). `showDCHelper()`, run from a GM's chat macro, prompts for the skill, the DC and the adjustment. It then posts a roll button for the selected tokens, with the DC in `[gm]` tags.

### Inventory tools (effects on Use, selling, investiture, handwraps, Bulk)

`rollhandlers/inventory-tools.js`:

- Effects on Use: `useInventoryItem` adds Apply buttons (`getEffectMacrosFor`) for `getItemUseEffects(item)`. Those are the item's own `data.useEffects` (the "Effects on Use" multiselect on the Rules tab) plus every effects `<record-link>` in its description, which is how the modules link "Effect: Bestial Mutagen (Lesser)".
- Selling: `sellInventoryItem(itemDataPath)` is the row's coin button and the grid's Sell action.
  - Both are hidden, and `sellInventoryItem` does nothing, unless the campaign setting "Allow Selling from the Sheet" (`sellFromSheet`, default No) is Yes. `setItemFields` sets `fields.sellBtn.hidden`, and the Inventory tab's onload (`onInventoryLoad`, `getSellButtonValues`) brings every row in line after the setting changes.
  - An item sells for half its Price per unit (the Price is per bundle, `getItemBundleSize`). Treasure sells for its full Price. The total is rounded down, not each unit (`getSellTotalCp`): 10 arrows sell for 5 cp.
  - Shoddy, temporary and infused items get a note in the confirm, not a block.
  - It reads the record again, writes the coins and count in one `setValues`, then removes a sold-out row by its id (`removeValueFromRecord`) and recalculates.
- Investiture: `data.investedCount` is set in the recalc (`getInvestedCount`). It counts items with the invested trait, and armor with runes, that are invested. Investing an 11th (`getInvestmentWarning`) or using an uninvested item that needs it (`getUninvestedUseWarning`) shows a notification. Nothing is blocked.
- Handwraps of mighty blows: an item named so, or with `data.handwraps` ticked, worn (`carried: equipped`) and invested, lends its potency, striking and property runes to every other unarmed attack.
  - `withHandwrapsRunes` is applied first in `getAlteredWeapon`.
  - `getEffectsAndModifiersForToken` also lets the handwraps' item-only modifiers (their property runes' features) apply when `itemId` is an unarmed attack (`getHandwrapsItemIdFor`).
  - The handwraps' own attack is left as it is, and NPCs are skipped.
- Bulk: `data.bulk` is "encumbered above" (5 + Str + `bulkLimit`), and `data.maxBulk` is 10 + Str + `bulkLimit`.
  - `updateTotalBulk` drops fractions (`dropBulkFractions`: 12 light items are 1 Bulk).
  - Crossing a limit posts a chat card (`getEncumbranceMessage`), with an Apply_Encumbered button when the character becomes encumbered. It's posted only for changes the user made: `updateTotalBulk(record, true, true)` (adding, removing, using or selling an item, coins, a count). The tab's onload never posts it.
  - `speedPenalty` (untyped) and `speedPenalty-circumstance`/`-item`/`-status` effect types exist. Foundry's Encumbered is an untyped -10 to all Speeds plus Clumsy 1.

### Healing tools (Treat Wounds and Battle Medicine, persistent damage, rest, regeneration)

`rollhandlers/healing-tools.js`:

- Treat Wounds and Battle Medicine: `treatWounds(kind)` runs both (`battleMedicine()` is `treatWounds("battleMedicine")`, the button on the Battle Medicine feat's card).
  - The metadata's `treatWounds` carries `kind`, `healerId` and `healerName`. The healing adds the module's "Treat Wounds Immunity" (anyone's, 1 hour) or "Battle Medicine Immunity" (that healer's, 1 day) with the healer as applier (`applyMedicineImmunity`). Every result card also has an Apply button for it, safe to click again.
  - A patient already immune gets a warning before the check (`getMedicineImmunityWarning`). Nothing is blocked.
  - Battle Medicine's healing passes `treatWounds: false`, so wounded stays.
  - Several instances of an effect: `effectIds` repeats the id, and `effectValues[id]` becomes an array of `{ value, tokenId, tokenName }` (`getEffectInstances`).
- Persistent damage:
  - `applyPersistentDamage` keeps the higher of one type (`getPersistentStackChange`, by average): a lower or equal one isn't added, and a higher one replaces it (`removeEffectById` with `instanceIndex`).
  - The recovery check: `getPersistentRecoveryOutput` gives the Roll_Recovery button, or rolls it now with the setting "Persistent Damage Recovery" (`persistentRecoveryRoll: auto`), plus an Assisted Recovery button at a flat DC 10 (particularly appropriate help). `flatCheck.js` finds the token by `metadata.tokenId` for an automatic roll.
  - Healing to full Hit Points ends persistent bleed (`applyHealingToToken`, `endPersistentBleed`).
- Rest: `rest()` asks first (`showRestOptions`: one choice, a normal night's rest first, and a days prompt only for long-term rest), then runs `restWith(options)`.
  - No shelter halves the healing (minimum 1). Each long-term rest day heals double (`getRestHealingAmount`). Sleeping in armor without the comfort trait wakes the character fatigued (`isRestFatiguing`).
  - The chat line reminds the GM to advance the calendar. `showWatchOrder()` (a GM chat macro) posts the party's watches (GM Core: 8 h x n / (n - 1)).
- Fast healing and regeneration (NPCs, from `hpDetails` or an ability's name, `getSelfHealing`):
  - Never automatic: only the GM knows whether regeneration was deactivated (damage types, materials, traits). `onTurnStart` posts a card ("Regeneration 20 (deactivated by electricity or fire), unless deactivated.") with an Apply Healing button that calls `applyHealingToToken`. No card at full Hit Points, and once per round (`data.selfHealRound`).
  - At 0 HP a regenerating monster is dead as any NPC, with a Regeneration button (`useRegeneration`): Dead off, dying (at most 3), unconscious and prone.
- Ferocity (an NPC ability named so): a button at 0 HP until wounded 3. `useMonsterFerocity` sets 1 HP and wounded + 1, and removes the Dead or Unconscious the damage added.

### Check tools (Assurance, incapacitation, signature spells, counteract, condition flat checks)

`rollhandlers/check-tools.js` (global script `CheckTools`), with the `counteract` roll type (`rollhandlers/counteract.js`):
- Assurance: `rollSkill` asks "Roll the check / Use Assurance (N)" for a character's skill with Assurance (trained or better). The skill comes from the feat's name ("Assurance (Athletics)") or its choice (`data.choices[i].data.choices[0]`). An Assurance with neither asks once which skill it's for (the current one first) and keeps it as the feat's choice (`getAssuranceSkillValues`); "Not now" rolls and asks again next time. The fixed result (10 + `getProficiencyBonusForRank`) goes to `skill.js` through `api.roll`, so the DC, notes and degree adjustments still apply. Not for initiative, Perception or NPCs.
- Untrained Improvisation has no code: the module feat's `skillBonus` modifier (predicate `proficiency:untrained`) already adds it on untrained rolls. The sheet's skill modifier stays ability + proficiency, as for every other modifier.
- Incapacitation: `getSpellSaveMacro` passes the casting rank (`rank` in the save options) for an incapacitation spell. `rollSave` sets `metadata.incapacitation` when the saver's level is more than twice that rank (or, with `level`, higher than the effect's level). `save.js` makes the result one degree better after every other adjustment. A spell attack does the same per target (`metadata.incapacitation` from `getSpellAttackMacro`): `attack.js` makes it one degree worse.
- Signature spells: a Signature checkbox (`data.signature`) on spontaneous spell rows, hidden by default. Every row builder sets `fields.signatureBox`, and the spells list's onload (`getSignatureBoxValues`) writes only the rows that differ. `castSpell` first asks for the rank (its own up to the highest with a slot left; also when the only rank left isn't the list's), then casts again with `spell.castRank`, which `getCastingRank` returns ahead of the list's rank.
- Counteract: a spell whose text mentions counteracting gets a Counteract button (`counteract(name, rank, mod)`). It asks the DC, then the target's rank (a targeted creature's half level first), then rolls a check (not an attack roll, as Foundry's counteract statistic): the entry's modifier plus `allBonus`/`allPenalty` for the casting attribute and the `counteract` field (`getCounteractModifiers`). The button carries the caster's token id, so an unlinked NPC's conditions count; the record is read only when the token isn't on the scene. `getCounteractOutcome` is the Player Core table.
- Flat checks to cast (`rollCastingFlatChecks`, after the spell's card): stupefied (DC 5 + value), grabbed for a manipulate spell, deafened for an auditory one (DC 5). `flatCheck.js` adds `metadata.failureNote` on a failure. Nothing is undone.
- Sickened: `retch()` rolls Fortitude against a typed DC (`metadata.retch`), and `save.js` adds a Reduce Sickened button on a success (2 on a critical success). `useInventoryItem` warns about a potion, elixir or ingested item while sickened.
- Confused: `applyDamage` adds a DC 11 recovery flat check button, not for persistent damage. `flatCheck.js` removes `metadata.endsCondition` from the token on a success.

### Combat riders (monster Strike riders, recharges, Debilitating Strike)

`rollhandlers/combat-riders.js` (global script `CombatRiders`):
- Effect durations: "until the end of <applier>'s next turn" is `api.addEffect(name, token, { value, unit: "end_applier_turn" }, { value, _id, name })`. The value counts the applier's turn ends (checked live): 2 on the applier's own turn, 1 on someone else's (a reaction; `getEndOfNextTurnValue` reads the attack log's current turn). The 4th argument records the applier.
- Strike riders (Monster Core): `performAttackRoll` puts `strikeRiders` (`getStrikeRiders`: the module's `attackEffects` names, or the editor's slugs) in the metadata. On a hit (or with no DC), `attack.js` adds each rider's text and a roll button (`rollStrikeRider`). It runs the monster's `performSkillAction(monster, "athletics", "Grapple" | "Trip" | "Shove", true, { targetId, noMultipleAttackPenalty })` against the Strike's target, so the maneuver card's outcomes and Apply buttons follow. Grab, Knockdown and Push (and their Improved versions) neither apply nor count toward the multiple attack penalty. A listed Trip is the monster's own Trip, with the penalty. Constrict is its own NPC action, with its buttons in the module data.
- `performSkillAction` options: `targetId` (a given creature instead of the targeted one) and `noMultipleAttackPenalty` (no penalty options, and not logged as an attack).
- Recharges: `useAction` adds a Start Recharge button when the text says the ability can't be used again for N rounds (`RECHARGE_PATTERN`: "can't use", "can't <Ability>", "cannot", "can't be used", and formulas like 1d6+1; `getRechargeFormula` reads a button's label). `startRecharge` rolls with `api.rollInstant` and, in combat, keeps `{ name, readyRound }` in `data.recharges`. `onTurnStart` tells the GM (`[gm]`) when the round comes and removes the entry. `onEncounterEnd` clears them (`clearEncounterRecharges`).
- Debilitating Strike: `debilitation` in the metadata (`getDebilitationCount`: the "debilitation" toggle, 2 with Double Debilitation), with `debilitationDuration` (1 off the rogue's turn) and `debilitationFeats`. A hit on an off-guard target lists the debilitations, with an Enfeebled 1 button until the end of the rogue's next turn. The Speed penalty has no module effect yet, so it's listed only.

### Weapon traits, hands in use, firearm loading

`rollhandlers/weapon-traits.js` (global script `WeaponTraits`). Rules follow Foundry PF2e.
- Kickback and jousting: `getWeaponTraitModifiers(record, weapon, { isNPCAttack, damageDice })` returns `{ attack, damage }`, used by `performAttackRoll` (next to the momentum traits) and `performDamageRoll`. Kickback: +1 damage, and a -2 circumstance attack penalty, unticked with Strength +2 or more (a stabilizer: the player unticks it). Jousting: a circumstance bonus equal to the damage dice, offered unticked (mounted, moved 10+ feet). NPCs get neither (their damage already has kickback's 1).
- Concussive: `applyDamage` looks up type immunity and resistance under `getConcussiveProtectionType(IWR, type, traits)`, the weaker of piercing or bludgeoning (immunity counts as the most). Weaknesses and physical or all-damage resistance are unchanged. Backstabber was already in `applyTargetOffGuardDamage`.
- Parry: the attack row's Parry button (`parryBtn`, shown for the trait) adds the module's Parry effect (`parryWithWeapon`). Untrained is a GM-only note, not a block.
- Versatile with any damage type: a weapon with a versatile trait other than B, P or S (`hasOtherVersatileType`) shows the `versatileType` dropdown (`getVersatileOptions`) instead of the checkboxes; `getWeaponDamageInfo` uses `getVersatileDamageType`.
- Hands: `getHandsHeld(item)` (equipped and held: 2 for two hands or a 1+ weapon on its two-hand button, else 1; worn, carried and unarmed are 0), `getHandsInUse(record, changes)` `{ held, free, reallyFree }`. Roll options `hands-free:<n>` (shields and free-hand weapons don't count) and `hands-free:but-really:<n>`, as Foundry's. `data.handsLabel` ("Hands n/2", Actions tab, shown only past 2: `fields.handsLabel.hidden`) is written by `getHandsValues` (only on a change) from `onAddEditFeature`, `onItemEquippedFor`, Stow, Drop, Draw and the hand button. More than 2 is a notification (`noteHandsInUse`), never a block.
- Loading: `getLoadCapacity`, the one place that says how many loads a weapon holds, as Foundry's `ammo.capacity` (1 for a weapon fed by a magazine: repeating, or ammo with `uses.max` > 1; else capacity N, 2 for double barrel, else 1), `getLoadedCount` (`data.loadedCount`; one shot when only `loadedAmmo` is set). Reload (`reloadWeapon`, `getReloadValues`) loads one up to the capacity; a shot (`getShotValues`) uses one, or two for both barrels, which expend `max(2, expend)` as Foundry's (`data.doubleBarrel`, `isFiringBothBarrels`, which steps the damage, striking and fatal dice up: `stepUpDie`). Only one barrel loaded: a note, and one fires. The card's `reloadNote` (attack.js) says what's left, and for a repeating weapon whose magazine ran out, that a new one takes a free hand and 3 Interact actions (`getMagazineNote`).

### Class extras (Hero Points, Rage temporary HP, panache, cursebound)

`rollhandlers/class-extras.js` (global script `ClassExtras`).
- Hero Points: GM chat macros `startHeroPointSession()` (each Party Sheet character to 1) and `awardHeroPoint()` (+1 to the selected characters, at most 3). Rerolls need the creature's own Hero Point: Foundry allows them for characters only, so a familiar or companion doesn't spend its master's.
- Rage: `applyActionTemporaryHitPoints` writes `data.tempHp` and `data.tempHpSource` `{ name, amount }` in one write (`getActionTempHpValues`). Every temporary HP writer notes its source the same way: the healing card's Apply Temporary HP (`Healing`; its Undo clears the source) and Undying Ferocity (`dying.js`). Damage that uses them up clears the source (`applyDamage`, kept in the undo values). `onEncounterEnd` (which ends Rage) clears what's left of Rage's (`clearRageTempHp`, `getRageEndTempHpValues`: only while the source is Rage and the amount isn't above what it gave).
- Panache: `rollSkill` puts `bravado` `{ tokenId, tokenName }` in the metadata when the check has the bravado trait (`isBravadoCheck`: the action's own trait or the module's `item:trait:bravado` roll option). `skill.js` shows Gain Panache on a success and Panache until the end of your next turn (`end_applier_turn`, `getEndOfNextTurnValue`) on a failure; both without a DC. A finisher's card has Lose Panache (`getFinisherButton`). No finisher or concentrate warnings (#27).
- Cursebound: `useAction` and `castSpell` (not overlays) add a Cursebound instance for the cursebound trait (`applyCursebound`), up to `getCurseboundMax` (2, 3 with the Major Curse feature, 4 with Extreme Curse; from features, not level, so Oracle Dedication stays at 2); at the maximum, a GM-only line and no change. Refocus (`shortRest`) reduces it by 1, one instance (`removeCursebound`; Oracular Curse class feature).

### Character growth (Intelligence increase, Multilingual, retraining)

`rollhandlers/character-growth.js` (global script `CharacterGrowth`).
- Intelligence: the level up's boost step (`promptLevelUpBoosts`, both the 4-boost and the Gradual Ability Boosts prompt) compares the Int modifier before and after (`getIntModGain`, through `getWizardIntMod`, so a partial boost above +4 counts right). For each point gained, `promptIntIncreaseGains` trains one untrained skill and adds one language, then the level up goes on.
- Languages are `data.languagesList` rows built with `buildLanguagesList`; `getNewLanguageOptions` offers the ancestry's choices and every common language not known, and `getAddLanguagesValues` appends in one write.
- Multilingual: placing it (a feat slot's `onDropFeat`, the level up's feat step, a retrain) asks for its languages (`promptFeatLanguages`, `getMultilingualCount`: 2, +1 at master Society, +1 at legendary). The module feat has no modifiers.
- Retraining (a week of downtime, `RETRAIN_DOWNTIME`): a feat row's Retrain Feat button (`retrainFeatAt`) re-picks from the slot's own query (`getFeatSlotQuery`) and writes `buildFilledFeatSlot` in one write; the Skills tab's Retrain a Skill Increase button (hidden when locked; `retrainSkillIncrease` reads the character fresh) lowers one skill a rank and raises another up to the level's cap (`getRetrainSkillValues`, `getMaxSkillIncreaseRank`) in one write, then recalculates (`onAddEditFeature`). The chat card has GM-only notes (`getRetrainFeatNotes`, `getSkillRetrainNotes`): lineage feats, feats listing the old feat or the skill in their prerequisites, the dedication rule, and removing Multilingual's languages. Nothing is blocked. Class feature choices (a month) aren't covered.

### Table rules (Earn Income, Subsist, cost of living, mounts, aquatic combat)

`rollhandlers/table-rules.js` (global script `TableRules`). Player Core rules some tables use; buttons and notes only, nothing refused.
- Earn Income: picking it in a skill's Roll as menu, or the Skills tab's Earn Income button (any trained skill or Lore, `getEarnIncomeSkillOptions`), asks the task level and days (`promptEarnIncome`). The check is against `getEarnIncomeDC` (the level's DC, less the level with Proficiency without Level) with `metadata.earnIncome` and the downtime trait. `skill.js` adds `getEarnIncomeLines`: `getEarnIncomePerDayCp` (Income Earned, level + 1 on a critical success, the failure column `EARN_INCOME_FAILURE_CP`; Experienced Professional on a Lore makes a critical failure a failure, and at expert Lore doubles a failure that wasn't a critical failure, per the feat text; Foundry's code skips both conditions) times the days, with a Collect button (`collectIncome`: strikes out the card with `api.editMessage`, then a fresh read and `getCoinRefund`). Hero Points aren't refused.
- Subsist: picking it in the Roll as menu asks the environment (`getSubsistOptions`: the sample tasks at their simple DC, or the GM's) and rolls with two unticked penalties (-5 after exploring, -2 after a critical failure in the last week). `getSubsistLines`: the outcome, a Fatigued button on a failure and an Adverse Subsist Situation button on a critical failure. Starvation and thirst are text only.
- Cost of living: the Skills tab's Pay Cost of Living button (`payCostOfLiving`, `COST_OF_LIVING_CP` by week, month and year) pays with `getCoinPayment` in one write from a fresh read.
- Mount: the Mount action card's buttons (`getMountActionMacros`). Mount Target (`mountTarget`) puts the Mounted effect on the selected rider with the targeted mount as its applier (`getMountId` reads it back), with a GM note when the mount isn't larger. Dismount removes it. With the Ride feat, Command an Animal on the rider's own mount asks whether it's for a move action (`promptRideCommand`, in `performSkillAction`): yes posts a success without a roll, no rolls as usual. Initiative seating isn't covered.
- Underwater: `toggleUnderwater()` (a chat macro for the selected tokens) adds the Underwater effect, and Off-Guard for creatures without a swim Speed (`hasSwimSpeed`), or removes Underwater from those already in it. `performAttackRoll` adds `getUnderwaterAttackModifiers`: -2 circumstance to a bludgeoning or slashing Strike, except a weapon with the underwater property rune (`data.runes.property`) and an aquatic or amphibious creature's unarmed attack.
- Holding breath: `holdBreathSelected()` gives Holding Breath stacks for 5 + Con rounds (`getAirRounds`). `onTurnEnd.js` posts `getBreathTurnEndMessage`: the air left with Lose 1 and Lose 2 buttons (`loseAir`, one instance at a time), and at 0 air Unconscious and Suffocating. Suffocating's stacks count the saves: Fortitude DC 20 + 5 per earlier save, 1d10 per stack on a failure (`rollSuffocationSave` adds a stack). Breathes Again (`breatheAgain`) removes both.
- Mounted, Underwater, Holding Breath, Suffocating and Adverse Subsist Situation are module effects applied by name; without them, the cards still say what applies.

### Armor traits (check penalty exceptions, bulwark, ponderous)

`rollhandlers/armor-traits.js` (global script `ArmorTraits`), following Foundry's character prepareSkills, prepareSaves and createPonderousPenalty.
- Check penalty: `getCheckPenaltyForArmor(record, bestArmor, context)` asks `isCheckPenaltyApplied` with the roll's context (`context.statistic` is the skill, `context.action` the action). Never with the attack trait (`isAttackTraitCheck`: a SKILL_ACTIONS entry marked `attack`, or a source passing the trait); Acrobatics and Athletics only when Strength is short and the armor isn't flexible; Stealth always in noisy armor; other checks when Strength is short. Armor without a Strength value has no check penalty.
- Bulwark: `rollSave` adds `getBulwarkModifier` on Reflex saves (+3 instead of the Dex modifier, as a difference): on for a basic save (damaging), unticked otherwise.
- Ponderous (Treasure Vault): `getPonderousModifier` is an untyped `initiativePenalty` added with the check penalty in `getEffectsAndModifiersForToken`, so it stacks with item penalties: -1, or the check penalty when Strength is short and it's worse.
- Hindering (the Speed calculation, `hasArmorTrait`) and comfort (the Rest prompt, healing-tools.js) were already in place.

### Familiars (master sync, ability Speeds, ability allowance, Familiar Focus)

`rollhandlers/familiars.js` (global script `Familiars`). A familiar is an NPC of type familiar; its abilities are its actions with `actionCategory` familiar.
- Sync: `getFamiliarSyncValues(familiar, master)` is everything the familiar takes from its master, in one write (`syncFamiliarWithMaster`): level, 5 HP per level plus `hitpoints` and `hitPointsBonus` modifiers worked out at the new level (Tough's "2 * @actor.level"), AC, saves, Perception and skills, Speeds, the ability allowance and the Familiar Focus button. The familiar's `data.master` and the master's `data.familiar` (Notes tab) link each other; the sync writes whichever is missing.
- Speeds: Amphibious, Burrower, Climber and Flier add rows to `data.speeds` (marked `fromFamiliarAbility`, so they're replaced next time; typed rows stay). Fast Movement raises the Speed in its `data.fastMovementSpeed` (asked when it's added, default land) to 40.
- Allowance: `getFamiliarAbilityAllowance(master)`, Foundry's familiarAbilities rules by name: the highest of 2, Basic Witchcraft 3, Enhanced Familiar 4, Incredible Familiar 6, plus the witch's Familiar (Witch) and Improved Familiar Attunement extras. A typed Total # of Familiar Abilities is kept in `numAbilitiesOverride`. Too many picks show a note; nothing is refused.
- Hooks: the master's level up resyncs the familiar (`resyncFamiliarOf`, at the end of the level-up steps), Rest says the abilities can be picked again (`getFamiliarRestNote`, with Spell Battery's slot), and the Familiar Focus button gives the master 1 Focus Point (`useFamiliarFocus`).
- Removing: a list row's delete has no hook, so a familiar ability's row has a remove button (`fields.removeBtn`, shown by `showFamiliarRemoveButton` when the picker adds it or a sync finds it hidden; other NPCs keep the list's delete). `removeNpcAction` reads fresh and writes once: it rewrites the Speeds and the Familiar Focus button from the abilities left (`getActionRemovalValues`). The module's Tough uses the `hitPointsBonus` modifier type, which is why HP reads it.

### Summons and minions (summon picker, initiative just below the master)

`rollhandlers/summons.js` (global script `Summons`), with `rollhandlers/onTokenAdd.js` (the combat tracker's onTokenAdd).
- A spell with the summon trait gets a Pick Creature button on its cast card (`getSummonButton`). `getSummonFilter` reads what it summons from its text ("has the animal trait", "a common celestial, fiend, or monitor of level", or one named creature), and the level cap comes from the summon trait's table by rank (`getSummonLevelCap`). `showSummonPicker` queries npcs with `api.getRecordsByQuery` (`$lte` level, case-insensitive trait regex), lists uncommon and rare ones with their rarity, opens the pick (`api.openRecord`) to drag onto the map, and posts a Mark Summoned button.
- Mark Summoned, dropped on the token: `data.summonedBy` `{ tokenId, name }` on the token, the initiative just below the caster in the same write, and the Summoned effect by name with the caster as applier (a module effect; a campaign without it gets the link and the note only).
- Minions (`getMinionMaster`): a summon's caster (`data.summonedBy`), a familiar's `data.master`, an animal companion's `data.companionMaster` (both matched to a token's `recordId`), or a mount's rider (the rider's Mounted applier). A minion added to the tracker goes to the master's initiative - 0.01 when the master is in it with an initiative; when a master rolls (`initiative.js`, alone or in a group), its minions in the tracker follow (`placeMinionsOf`). `api.getCombatTracker` gives `{ tokenIds, round, initiative, slot }`; scene tokens carry `data.initiative`.


### Eidolons (eidolon characters, summoner link, shared Hit Points)

`rollhandlers/eidolons.js` (global script `Eidolons`), with the data in `modules/eidolons` (see its README): an eidolon is a character whose ancestry is its type (flagged `data.eidolon`) and whose class is Eidolon (by name or `data.eidolon`), as Foundry's PF2e Companion Compendia builds them.
- An eidolon type asks for no heritage when dropped (`isEidolonAncestry`, characters-main.html). The Notes tab's companion box (master field, Match Master's Level) shows for eidolons too and links one to its summoner (`data.companionMaster`); the summoner links back (`data.eidolon`), as a familiar's master does.
- `syncEidolonWithSummoner`: the summoner's level, maximum, current and temporary HP in one write, then the summoner's link if missing; the sheet is worked out again when the level changed.
- Shared Hit Points (Impossible Magic pg. 63): `shareHitPoints(creature, values)` copies `data.hitpoints`, `data.curhp` and `data.tempHp` just written to an eidolon or its summoner to the other, reading it fresh and writing only what differs (dying and wounded aren't shared). It's called by applyDamage (common.js), damageScript.js, healingScript.js and dying.js's healing; a summoner's new maximum in `updateAttribute` goes to its eidolon, and a linked eidolon's maximum isn't recomputed.
- An eidolon goes just after its summoner in initiative through the companion master link (summons.js).
- Gear (Impossible Magic pg. 70): `getSummonerGear` snapshots the summoner's armor potency, resilient rune or bands of force, and worn, invested handwraps into the eidolon's `data.summonerGear` (on sync, and when the summoner's sheet works out its Hit Points: `shareSummonerGear`). `getEidolonGearModifiers` (called beside `getAbpModifiers`) adds the AC and save bonuses, and `getWornHandwraps` returns the summoner's handwraps for an eidolon, so their runes go on its unarmed attacks. Nothing with Automatic Bonus Progression.
- HP is also shared by temporary HP from actions and the healing card, Orc Ferocity and Undying Ferocity, and Rage's end. A linked eidolon's Rest heals nothing (the pool is the summoner's; restWith's `sharesPool`).
- 0 HP (Manifest Eidolon, pg. 64): a linked eidolon brought to 0 by applyDamage or the tracker's damage script gets no dying of its own; `applyEidolonZeroHitPoints` runs `getZeroHitPointsChanges` on the summoner's token (dying, 2 on a crit; the conditions) and the card says the eidolon unmanifests. A summoner at 0 gets the unmanifest line too. The damage card's Undo restores the partner's shared HP and the summoner's dying (`getSharedHitPointUndo`).
- One effect on both (pg. 63): applyDamage keeps a pool per summoner (`sharedPools`, keyed by `getSharedPoolKey` when the partner is among the targets); the second of the pair starts from the pool as the first left it and takes only what its amount adds (`getSharedPoolDamage`), so the greater applies once. Apply by Saves passes one pool for its card (`options.sharedPools`, `options.poolCreatures`).
- Ranks (pg. 69): the sync and the summoner's recalculation snapshot the summoner's ranks into `data.summonerRanks`; `updateProficiencies` takes the skill ranks for every eidolon, and Perception and save ranks too with Summoner Dedication (Eidolon), as exact ranks (`getEidolonSharedRanks`). The Eidolon class features' proficiencies and modifiers carry `{not: feat:summoner-dedication-eidolon}`. The gear snapshot also has the summoner's best item bonus to Perception and each skill from invested items.
- A ranged unarmed attack (Ranged Combatant) uses Dexterity but no ammunition (performAttackRoll's `isRangedUnarmed`).
### Data Structure

- Character data is nested under `record.data`
- UI state is under `record.fields`
- Lists (traits, features, etc.) typically have both array and object representations
- Always check for existing data before initializing defaults

## Realm VTT API Reference

See the `realm-vtt-api` skill for the API surface (data management, dice rolling, token management), the roll-type and metadata rules, and recipes for adding character options, calculations, and UI components.

## Language

All writing uses **American English**. This covers UI copy, marketing text, docs,
comments, commit messages, and anything else that ships. No British English:
write "color" not "colour", "organization" not "organisation", "math" not
"maths", "license" not "licence", "traveling" not "travelling", "gray" not
"grey". No em dashes in user-facing copy either.
