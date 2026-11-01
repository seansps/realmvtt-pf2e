# Eidolons module

Eidolons for the PF2e ruleset as **characters**, the way Foundry's [PF2e Companion Compendia](https://github.com/TikaelSol/PF2e-Animal-Companions) builds them, as the Animal Companions module does companions:

- **Ancestry = eidolon type.** The 15 remastered types: aberrant, angel, anger phantom, beast, construct, demon, devotion phantom, dragon, elemental, fey, ooze, plant, psychopomp, swarm, undead. Each has its traits, size, Speed and vision, and one ancestry feature with:
  - its fixed attributes (Con, Int, Wis, Cha)
  - a choice of key attribute: Strength (Str +4, Dex +2, +2 item bonus to AC, Dex cap +3) or Dexterity (Str +2, Dex +4, +1 item bonus to AC, Dex cap +4). Elemental and swarm eidolons pick one of their two named arrays instead.
  - its two trained skills (a dragon eidolon: Intimidation and its tradition's skill, from a tradition choice)
  - its senses and other Speeds

  Its initial, symbiosis (7th) and transcendence (17th) abilities are features of their own, with an action for those that cost actions.
- **Class = Eidolon.** Expert in Fortitude and Will; trained in Reflex, Perception, unarmed attacks and unarmored defense. The summoner's class features that raise those are its features by level: Shared Vigilance (3rd), Eidolon Unarmed Expertise (5th), Eidolon Weapon Specialization and Eidolon Symbiosis (7th), Shared Reflexes (9th), Twin Juggernauts and Eidolon Defensive Expertise (11th), Eidolon Unarmed Mastery (13th), Shared Resolve and Greater Eidolon Specialization (15th), Eidolon Transcendence (17th, with its +1 attribute choice) and Eidolon Defensive Mastery (19th). It grants the secondary attack (1d6, agile, finesse) and asks for the primary attack's statistics.

- **Evolution feats** for the eidolon itself: Impossible Magic's 40, named "<feat> (Eidolon)" so they don't clash with the summoner's own (the class book's). Add one to the eidolon when the summoner takes the matching feat. What they change on the eidolon is automated where the ruleset can (Foundry's Companion Compendia does the same):
  - Energy Heart and Dual Energy Heart (an energy choice: resistance of half the level, minimum 1), Energy Resistance (that resistance becomes the level)
  - Expanded Senses, Vibration Sense (senses); Alacritous Action, Amphibious Form, Burrowing Form, Airborne Form (Speeds); Hulking Size, Towering Size (size)
  - Ranged Combatant (a 1d4 magical, propulsive ranged unarmed attack, with a damage type choice), Nimble Form (agile unarmed attacks at -3 and -6), Resilient Shell (physical resistance 5, 6 at 17th), Ever-Vigilant Senses (+2 circumstance to Perception)
  - the rest are their text, with an action for those that cost actions
- **Summoner Dedication (Eidolon):** for an archetype summoner's eidolon. Its key attribute is +3 instead of +4 until 5th level.

Its Hit Points are its summoner's, shared (the ruleset's part, `rollhandlers/eidolons.js`), so the ancestry and class give none. It also takes item bonuses from its summoner's gear: the armor potency rune or bands of force raise its item bonus to AC, the resilient rune or bands of force give an item bonus to its saves, and the runes on the summoner's worn, invested handwraps of mighty blows go on its unarmed attacks (Impossible Magic pg. 70). With Automatic Bonus Progression, runes give nothing, as for anyone. It also takes the summoner's best item bonus to Perception and to each skill from the summoner's invested magic items. The other way to share runes, a magic weapon the summoner invests and holds, isn't supported: put the runes on handwraps, or add them to the eidolon's attacks by hand.

An eidolon shares its summoner's skill proficiency ranks (pg. 69), copied by the sync. A Summoner Dedication eidolon also shares the summoner's Perception and save ranks, and doesn't get the summoner's class features.

A linked eidolon brought to 0 Hit Points unmanifests, and its summoner drops to 0 and gains dying (Manifest Eidolon, pg. 64). One effect that hits both applies once, the greater amount (pg. 63). A linked eidolon's Rest heals nothing: the pool is the summoner's.

## Making an eidolon

1. Create a character, drop an eidolon type (e.g. Angel Eidolon) and the Eidolon class on it. Don't use the creation wizard. Choose its key attribute and its primary attack when asked.
2. Rename its Primary Attack and Secondary Attack to fit its form (claw, jaws, fist...) and set their damage types.
3. On the Notes tab, set its summoner (**Companion or Eidolon of**). Its level, Hit Points and the item bonuses from the summoner's gear follow; use **Match Master's Level** after the summoner levels up. Damage and healing to either land on both.
4. Add the "(Eidolon)" version of each evolution feat the summoner takes.

## Building

- `source/eidolon-types.json` is the 15 types and `source/evolution-feats.json` the 40 evolution feats from Archives of Nethys (ORC), made by `source/parse-aon.py` and `source/parse-aon-feats.py` from AoN's search index.
- `icons.json` maps every record (`<recordType>|<name>`) to an icon from Realm's catalog, made by `source/pick-icons.py` (an icon named for the record, then hand picks, then the closest word).
- `node modules/eidolons/build.js` writes `records.json`. `tests/test-eidolon-module.js` builds eidolons from it and checks them against stat blocks worked by hand from Impossible Magic. The test fails if `records.json` is out of date.

The module ships no creature art.
