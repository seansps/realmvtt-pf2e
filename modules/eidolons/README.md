# Eidolons module

Eidolons for the PF2e ruleset as **characters**, the way Foundry's [PF2e Companion Compendia](https://github.com/TikaelSol/PF2e-Animal-Companions) builds them, as the Animal Companions module does companions:

- **Ancestry = eidolon type.** The 15 remastered types: aberrant, angel, anger phantom, beast, construct, demon, devotion phantom, dragon, elemental, fey, ooze, plant, psychopomp, swarm, undead. Each has its traits, size, Speed and vision, and one ancestry feature with:
  - its fixed attributes (Con, Int, Wis, Cha)
  - a choice of key attribute: Strength (Str +4, Dex +2, +2 item bonus to AC, Dex cap +3) or Dexterity (Str +2, Dex +4, +1 item bonus to AC, Dex cap +4). Elemental and swarm eidolons pick one of their two named arrays instead.
  - its two trained skills (a dragon eidolon: Intimidation and its tradition's skill, from a tradition choice)
  - its senses and other Speeds

  Its initial, symbiosis (7th) and transcendence (17th) abilities are features of their own, with an action for those that cost actions.
- **Class = Eidolon.** Expert in Fortitude and Will; trained in Reflex, Perception, unarmed attacks and unarmored defense. The summoner's class features that raise those are its features by level: Shared Vigilance (3rd), Eidolon Unarmed Expertise (5th), Eidolon Weapon Specialization and Eidolon Symbiosis (7th), Shared Reflexes (9th), Twin Juggernauts and Eidolon Defensive Expertise (11th), Eidolon Unarmed Mastery (13th), Shared Resolve and Greater Eidolon Specialization (15th), Eidolon Transcendence (17th, with its +1 attribute choice) and Eidolon Defensive Mastery (19th). It grants the secondary attack (1d6, agile, finesse) and asks for the primary attack's statistics.

Its Hit Points are its summoner's, shared (the ruleset's part, `rollhandlers/eidolons.js`), so the ancestry and class give none.

## Making an eidolon

1. Create a character, drop an eidolon type (e.g. Angel Eidolon) and the Eidolon class on it. Don't use the creation wizard. Choose its key attribute and its primary attack when asked.
2. Rename its Primary Attack and Secondary Attack to fit its form (claw, jaws, fist...) and set their damage types.
3. On the Notes tab, set its summoner. Its level is the summoner's.

## Building

- `source/eidolon-types.json` is the 15 types from Archives of Nethys (ORC), made by `source/parse-aon.py` from AoN's search index.
- `icons.json` (optional) maps a record (`<recordType>|<name>`) to an icon from Realm's catalog.
- `node modules/eidolons/build.js` writes `records.json`. `tests/test-eidolon-module.js` builds eidolons from it and checks them against stat blocks worked by hand from Impossible Magic. The test fails if `records.json` is out of date.

The module ships no creature art.
