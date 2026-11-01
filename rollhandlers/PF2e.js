// Create a map of trait descriptions
const traitDescriptions = {
  Aberration:
    "Aberrations are creatures from beyond the planes or corruptions of the natural order.",
  Acid: "Effects with this trait deal acid damage. Creatures with this trait have a magical connection to acid.",
  Additive:
    "Feats with the additive trait allow you to add special substances to alchemical consumables you create when you use Quick Alchemy to create a consumable (you can't use additives with quick vials). You can add only one additive to a single alchemical item, you can add an additive only once per round, and most additive abilities specify a subset of alchemical consumables you can add them to.",
  Adjusted:
    "The equipment comes with an adjustment described in its entry. This adjustment is built into the equipment permanently, meaning the equipment can't have another adjustment added, nor can it be swapped out for a different adjustment. If the adjustment alters the item's base statistics, such as adding the noisy trait, that's reflected in the equipment's table entry.",
  Adjustment:
    "Items with this trait are intended to alter existing pieces of equipment, typically armors, shields, and weapons. The given item will note which type of equipment it modifies. A piece of equipment can only be affected by a single adjustment at a time. Unless otherwise noted, adding or removing an adjustment requires using a 10-minute activity and a repair kit.",
  Aeon: "These monitors are the self-styled defenders of reality. Traditional aeons have dualistic natures and forms, hold a dichotomy of interests, and communicate via a strange telepathic hodgepodge of sensory sending called envisioning. Axiomites and their creations are aeons, but don't share all the characteristics of traditional aeons.",
  Aesir:
    "Aesir are often-bellicose monitors of the chaotic planes, honing their skill in battle and preparing for a final confrontation at the end of the multiverse.",
  Aftermath:
    "This trait describes feats that represent special abilities gained after exposure to the weird and deadly.",
  Agathion:
    "This family of animal-featured celestials is native to the plane of Nirvana. Most agathions are neutral good, have darkvision, and have a weakness to evil damage.",
  Agile:
    "The multiple attack penalty you take with this weapon on the second attack on your turn is -4 instead of -5, and -8 instead of -10 on the third and subsequent attacks in the turn.",
  Air: "Effects with the air trait either manipulate or conjure air. Those that manipulate air have no effect in a vacuum or an area without air. Creatures with this trait consist primarily of air or have a connection to magical air.",
  Aiuvarin:
    "A creature with this trait has the aiuvarin versatile heritage. Aiuvarins are of mixed ancestry, including elves or other aiuvarins. An ability with this trait can be used or selected only by aiuvarins.",
  Alchemical:
    "Alchemical items are powered by reactions of alchemical reagents. Unless otherwise noted, alchemical items aren't magical and don't radiate a magical aura. Alchemical creatures are partially powered by alchemical reactions.",
  Alchemist: "This indicates abilities from the alchemist class.",
  Amp: "An amp is a special thoughtform that modifies the properties of your psi cantrips. Psi cantrips each have their own amp, and feats with the amp trait provide different amps you can apply to psi cantrips in place of their normal amps.",
  Amphibious:
    "An amphibious creature can breathe in water and in air, even outside of its preferred environment, usually indefinitely but at least for hours. These creatures often have a swim Speed. Their bludgeoning and slashing unarmed Strikes don't take the usual –2 penalty for being underwater.",
  Anadi:
    "A reclusive people from Garund who resemble spiders and can assume human forms.",
  Analog:
    "This weapon eschews advanced electronics, computers systems, and electric power sources, but was manufactured and calibrated using advanced technology. This weapon is immune to abilities that target technology. Weapon runes don't function on this weapon unless this weapon also has the archaic trait.",
  Android:
    "A synthetic humanoid ancestry created by artificial means. Most common in Numeria.",
  Angel:
    "This family of celestials are messengers and warriors. Most angels are holy, have darkvision, and have a weakness to unholy.",
  Animal:
    "An animal is a creature with a relatively low intelligence. It typically doesn't have an Intelligence attribute modifier over –4, can't speak languages, and can't be trained in Intelligence-based skills.",
  Animist: "This indicates abilities from the animist class.",
  Apex: "<p>When you Invest an Item that has the apex trait, it improves one of your attributes, either increasing the attribute's modifier by 1 or to a total of +4, whichever would give you a higher value. This gives you all the benefits of the new attribute modifier until the investiture ends. For example, in addition to increasing rolls you make using the attribute, increasing your Intelligence lets you become trained in an additional skill and learn a new language, and increasing your Constitution gives you more Hit Points.</p><p>An apex item grants this benefit only the first time it's invested within a 24-hour period, and you can benefit from only one apex item at a time. If you attempt to invest an apex item when you already have one invested, you don't gain the attribute modifier increase, though you do gain any other effects of Investing the Item.</p>",
  Aphorite:
    "A type of planar scion descended from a being from Axis, the Plane of Law.",
  Apparition:
    "<p>Apparitions are spiritual entities who generally lack the power, cohesiveness, or attachments to enter or affect the physical world. Unlike a ghost or phantom, an apparition does not need to have ever been a living creature and could be the spiritual memory of a particularly meaningful location or event. Apparitions are reliant on animists to interact with other people and things, and generally can't be targeted or affected by spells and abilities other than those of the animist they are attuned to. Animist feats and abilities that affect spirits affect apparitions only if they specifically say so.</p><p> Animist abilities with the apparition trait involve one or more of your apparitions acting alongside you. You must be attuned to at least one apparition to use an apparition ability, and some abilities might state in their requirements more specifically which apparition you must be attuned to. Typically, you're assumed to always attune to your apparitions during your daily preparations, but in some rare circumstances or as a result of certain animist abilities, your apparitions might be dispersed or separated from you for a time; you aren't attuned to dispersed apparitions.</p>",
  Aquadynamic:
    "This armor is designed for use underwater, with streamlined design and buoyant materials used in strategic places. You don't apply the armor's check penalty to Acrobatics or Athletics checks in water or similar liquids.",
  Aquatic:
    "Aquatic creatures are at home underwater. Their bludgeoning and slashing unarmed Strikes don't take the usual –2 penalty for being underwater. Aquatic creatures can breathe water but not air.",
  Arcane:
    "This magic comes from the arcane tradition, which is built on logic and rationality. Anything with this trait is magical. A creature with this trait is primarily constituted of or has a strong connection to arcane magic.",
  Ardande:
    "Ardandes are planar scions descended from kizidhars and other beings of elemental wood.",
  Archon:
    "Members of this family of celestials are the protectors of Heaven and are typically holy. They have darkvision and a weakness to unholy.",
  Archetype: "This feat belongs to an archetype.",
  Artifact:
    "Items with this trait are artifacts. These magic items can't be crafted by normal means, and they can't be damaged by normal means. Artifacts are always rare or unique.",
  Astral:
    "Astral creatures are native to the Astral Plane. They can survive the basic environmental effects of the Astral Plane.",
  Asura:
    "These lawful fiends are physical manifestations of divine accidents. Asuras typically have darkvision, immunity to curses, and a weakness to good.",
  Athamaru: "Athamarus are fishlike aquatic humanoids.",
  Attached:
    "An attached weapon must be combined with another piece of gear to be used. The trait lists what type of item the weapon must be attached to. You must be wielding or wearing the item the weapon is attached to in order to attack with it. For example, shield spikes are attached to a shield, allowing you to attack with the spikes instead of a shield bash. An attached weapon is usually bolted onto or built into the item it's attached to, and typically an item can have only one weapon attached to it. An attached weapon can be affixed to an item with 10 minutes of work and a successful DC 10 Crafting check; this includes the time needed to remove the weapon from a previous item, if necessary. If an item is destroyed, its attached weapon can usually be salvaged.",
  Attack:
    "An ability with this trait involves an attack. For each attack you make beyond the first on your turn, you take a multiple attack penalty.",
  Auditory:
    "Auditory actions and effects rely on sound. An action with the auditory trait can be successfully performed only if the creature using the action can speak or otherwise produce the required sounds. A spell or effect with the auditory trait has its effect only if the target can hear it. This applies only to sound-based parts of the effect, as determined by the GM. This is different from a sonic effect, which still affects targets who can't hear it (such as deaf targets) as long as the effect itself makes sound.",
  Aura: "An aura is an emanation that continually ebbs out from you, affecting creatures within a certain radius. Aura can also refer to the magical signature of an item.",
  Automaton:
    "A creature with this trait is a member of the automaton ancestry.",
  AwakenedAnimal:
    "Awakened animals were once normal creatures before they gained sapience.",
  Azarketi:
    "Amphibious humanoids who live among the seas of the Inner Sea region, said to have descended from the people of Azlant. Sometimes known as gillmen or Low Azlanti. Azarketi are an offshoot of humans adapted to live in aquatic communities. They have gills, webbed digits, and small fins, and they can survive in or out of water.",
  Azata:
    "This family of celestials is native to Elysium. They are typically holy and have darkvision and a weakness to cold iron and unholy.",
  Backstabber:
    "When you hit an off-guard creature, this weapon deals 1 precision damage in addition to its normal damage. The precision damage increases to 2 if the weapon is a +3 weapon.",
  Backswing:
    "You can use the momentum from a missed attack with this weapon to lead into your next attack. After missing with this weapon on your turn, you gain a +1 circumstance bonus to your next attack with this weapon before the end of your turn.",
  Barbarian: "This indicates abilities from the barbarian class.",
  Bard: "This indicates abilities from the bard class.",
  Barding:
    "You can purchase special armor for animals, called barding. All animals have a trained proficiency rank in light barding, and combat-trained animals are trained in heavy barding. Barding uses the same rules as armor except for the following. The Price and Bulk of barding depend on the animal's size. Unlike for a suit of armor, barding's Strength entry is listed as a modifier, not a score. Barding can't be etched with magic runes, though special magical barding might be available.",
  Beast:
    "A creature similar to an animal but with an Intelligence modifier of –3 or higher is usually a beast. Unlike an animal, a beast might be able to speak and reason.",
  Beastkin:
    "Humanoids that can partially or fully transform into animal forms.",
  Blight: "Blights are corruptions of nature's wrath.",
  Boggard: "Boggards are frog-like humanoids. They typically have darkvision.",
  Bomb: "An alchemical bomb combines volatile alchemical components that explode when the bomb hits a creature or object. Most alchemical bombs deal damage, though some produce other effects.",
  BottledBreath:
    "Bottles of breath are enchanted bottles of cloud and mist, first developed by the denizens of the Plane of Air. You can Activate an item with the bottled breath trait as you inhale it or cause another creature to inhale it.",
  Brace:
    "A brace weapon is effective at damaging moving opponents. When you Ready to Strike an opponent that moves within your reach, until the start of your next turn Strikes with the brace weapon deal an additional 2 precision damage for each weapon damage die it has.",
  Bravado:
    "Actions with this trait can grant panache, depending on the result of the check involved. If you succeed at the check on a bravado action, you gain panache, and if you fail (but not critically fail) the check, you gain panache but only until the end of your next turn. These effects can be applied even if the action had no other effect due to a failure or a creature's immunity.",
  Brutal:
    "A ranged attack with this trait uses its Strength modifier instead of Dexterity on the attack roll.",
  Bugbear:
    "A creature with this trait is a furry, stealthy goblinoid. Bugbears tend to have darkvision.",
  Bulwark:
    "The armor covers you so completely that it provides benefits against some damaging effects. On Reflex saves to avoid a damaging effect, such as a fireball, you add a +3 modifier instead of your Dexterity modifier.",
  Caligni:
    "These subterranean people have darkvision, and some have powers to create darkness.",
  Calling:
    "The calling trait identifies mechanical options a character gains when they first gain mythic power. Every calling option grants a way to use and regain Mythic Points.",
  Cantrip:
    "A spell you can cast at will that is automatically heightened to half your level rounded up.",
  Capacity:
    "Weapons that have the capacity trait typically have multiple barrels or chambers capable of containing a round of ammunition. Capacity is always accompanied by a number indicating the number of barrels or chambers. After a capacity weapon is fired, you can select the next loaded barrel or chamber as an Interact action that doesn't require a free hand. Each barrel or chamber can be reloaded after it's fired as a separate Interact action.",
  Catalyst:
    "Items that have the catalyst trait are consumable material spell components that alter or magnify specific spells. Activating a catalyst is part of Casting the Spell. The catalyst might increase the number of actions required to Cast the Spell, as indicated in the catalyst's Activate entry. Additionally, the spell gains the manipulate trait if it didn't already. Because the catalyst becomes part of the spell, you can draw the catalyst as part of Casting the Spell.",
  Catfolk:
    "A creature with this trait is a member of the catfolk ancestry. Catfolk are humanoids with feline features.",
  Celestial:
    "Creatures that hail from or have a strong connection to the holy planes are called celestials. Celestials can survive the basic environmental effects of planes in the Outer Sphere.",
  Censer:
    "Censers are decorative containers, often metal or ceramic, in which incense is burned. An item with the censer trait must be filled with incense to Activate it, which ignites the incense and causes the censer to exude a cloud of smoke.",
  Centaur: "Centaurs have humanoid upper bodies and equine lower bodies.",
  CertainKill:
    "The Lightkeeper can use a Certain Kill Art as long as they are within the Glass Lighthouse—these abilities, which have the certain kill trait, cause obvious distortions in the Lighthouse's fabric as the user calls upon their technique. However, as each technique requires one of the Lightkeepers to temporarily take command of the demiplane from the rest of their team, only one Certain Kill Art can be used by any of the Lightkeepers in a given round.",
  Champion: "This indicates abilities from the champion class.",
  Changeling:
    "A creature with this trait has the changeling versatile heritage. Changelings are the children of hags and members of other humanoid ancestries. An ability with this trait can be used or selected only by changelings.",
  CharauKa:
    "Mandrill-like humanoids that are brutal warriors. Many charau-ka live in Usaro.",
  Class:
    "Archetypes with the class trait fundamentally diverge from your class's specialties but still fit within the theme of your class. You can select a class archetype only if your class meets the criteria listed in the archetype's prerequisites. Class archetypes always alter or replace some of a class's static class features in addition to any new feats they offer. It might be possible to take a class archetype at 1st level if it alters or replaces some of the class's initial class features. The 1st-level ability is presented much like a class feature and includes the class archetype's prerequisites and rules on how it changes your class. If you select this ability, you must take that archetype's dedication feat at 2nd level, and you proceed normally afterward. You can never have more than one class archetype.",
  Cleric: "This indicates abilities from the cleric class.",
  Climbing: "The hand wielding the weapon is available to Climb.",
  Clockwork:
    "Clockworks are intricate, complex constructs that can be programmed to perform specific functions.",
  Coagulant:
    "Healing alchemical items with the coagulant trait lose effectiveness when many are applied in a short period of time. If a creature heals Hit Points from an item with the coagulant trait, that creature is temporarily immune to healing Hit Points from subsequent items with the coagulant trait for 10 minutes (but not immune to any other effects of those items).",
  Coatl:
    "A family of supernatural feathered serpents who serve as guardians and messengers in the Universe for various holy divinities.",
  Cobbled:
    "This firearm is cobbled together and likely to misfire. No matter how well you upkeep it, on a failed attack roll, the attack misses and you must roll a @Check[flat|dc:5]. If you fail this check, the weapon misfires.",
  Coda: "<p>Instruments with the coda trait work mostly like staves and have the staff trait. There are two differences: Coda instruments are in the form of musical instruments, and they can be prepared only by bards. Because they're not physically staves, you can't attack with a coda instrument, nor can you etch it with weapon runes.</p><p>The process of preparing a coda instrument involves playing significant portions of songs related to the spells within the instrument—either old standards or ones of your own creation. This leaves magical reverberations within the instrument that allow you to complete the songs by playing their coda later in the day.</p>",
  Cold: "Effects with this trait deal cold damage. Creatures with this trait have a connection to magical cold.",
  Combination:
    "This is a trait for weapons that combine the functionality of melee weapons and firearms in unique or unusual ways. A combination weapon has both a firearm form or usage and a melee weapon form or usage.",
  Comfort:
    "The armor is so comfortable that you can rest normally while wearing it.",
  Common:
    "Anything that doesn't list another rarity trait (uncommon, rare, or unique) automatically has the common trait. This rarity indicates that an ability, item, or spell is available to all players who meet the prerequisites for it. A creature of this rarity is generally known and can be summoned with the appropriate summon spell.",
  Companion:
    "An item with this trait can be worn by an animal companion or similar creature. A companion can have up to two items invested.",
  Complex: "A hazard with this trait takes turns in an encounter.",
  Composite:
    "A composite impulse combines multiple elements. You can gain an impulse with the composite trait only if your kinetic elements include all the elements listed in the impulse's traits.",
  Composition:
    "To cast a composition cantrip or focus spell, you use a type of Performance. If the spell requires an auditory performance, you might recite a poem, sing a song, or perform a dramatic monologue. If the spell requires a visual performance, you might dance or pantomime. You can cast only one composition spell each turn, and you can have only one active at a time. If you cast a new composition spell, any ongoing effects from your previous composition spell end immediately.",
  Concealable:
    "This weapon is designed to be inconspicuous or easily concealed. You gain a +2 circumstance bonus to Stealth checks and DCs to hide or conceal a weapon with this trait.",
  Concentrate:
    "An action with this trait requires a degree of mental concentration and discipline.",
  Concussive:
    "These weapons smash as much as puncture. When determining a creature's resistance or immunity to damage from this weapon, use the weaker of the target's resistance or immunity to piercing or to bludgeoning. For instance, if the creature were immune to piercing and had no resistance or immunity to bludgeoning damage, it would take full damage from a concussive weapon. Resistance or immunity to all physical damage, or all damage, applies as normal.",
  Conrasu:
    "A people that are made of cosmic force given consciousness and housed within unique exoskeletons.",
  Consecration:
    "A consecration spell enhances an area for an extended period of time. A given area can have only a single consecration effect at a time. The new effect attempts to counteract any existing one in areas of overlap.",
  Construct:
    "A construct is an artificial creature empowered by a force other than vitality or void. Constructs are often mindless; they are immune to bleed, death effects, disease, healing, nonlethal attacks, poison, spirit, vitality, void, and the doomed, drained, fatigued, paralyzed, sickened, and unconscious conditions; and they may have Hardness based on the materials used to construct their bodies. Constructs are not living creatures, nor are they undead. When reduced to 0 Hit Points, a construct creature is destroyed.",
  Consumable:
    "An item with this trait can be used only once. Unless stated otherwise, it's destroyed after activation. Consumable items include alchemical items and magical consumables such as scrolls and talismans. When a character creates consumable items, they can make them in batches of four.",
  Contact:
    "A contact poison is activated by applying it to an item or directly onto a living creature's skin. The first creature to touch the affected item must attempt a saving throw against the poison; if the poison is applied directly, the creature must attempt a saving throw immediately when the poison touches its skin. Contact poisons are infeasible to apply to a creature via a weapon attack due to the logistics of delivering them without poisoning yourself. Typically, the onset time of a contact poison is 1 minute.",
  Contingency:
    "Spells with this trait grant you an action during the spell's effects, typically a reaction with a special trigger. They typically have a long duration, such as 24 hours. You can have only one spell with the contingency trait, or one contingency spell, active at a time. If you cast another spell with the contingency trait or contingency, the newer casting supersedes the older.",
  Contract:
    "A contract is a type of item that magically establishes an agreement between multiple parties and typically grants magical benefits.",
  CriticalFusion:
    "Critical fusion is a new trait for combination weapons that grants you two additional options for the critical specialization effect when using the combination weapon's melee version to make a melee attack while the firearm is loaded. If you choose to use one of them, they replace the melee usage's normal critical specialization effect. First, you can discharge the firearm to create a loud bang and concussion, using the critical specialization effect for firearms instead of the melee weapon group's critical specialization effect. Second, you can choose to discharge the firearm to increase the critical hit's momentum or shoot the foe as you attack them in melee, dealing 2 additional damage per weapon damage die. Both of these options discharge the firearm, which typically means you have to reload it before firing it again.",
  Curse:
    "A curse is an effect that places some long-term affliction on a creature. Curses are always magical and are typically the result of a spell or trap. Effects with this trait can be removed only by effects that specifically target curses.",
  Cursebound:
    "Spells with this trait increase the severity of your oracular curse when cast. Usually, only revelation spells have this trait. You can't cast a cursebound spell if you don't have an oracular curse. A cursebound ability that allows a defense uses your spell attack modifier or spell DC unless noted otherwise.",
  Cursed:
    "An item with this trait is cursed to cause trouble for its owner. A curse isn't detected when the item is identified, though a critical success reveals both the presence and exact nature of the curse. Cursed items can't be discarded once they've been triggered or invested the first time. The item can be removed only if the curse is removed.",
  Daemon:
    "A family of fiends spawned on the desolate plane of Abaddon, most daemons are irredeemably unholy. They typically have darkvision and weakness to holy.",
  Darkness:
    "Darkness effects extinguish non-magical light in the area, and can counteract less powerful magical light. You must usually target light magic with your darkness magic directly to counteract the light, but some darkness spells automatically attempt to counteract light.",
  Darvakka:
    "Entropic undead creatures twisted by the Netherworld and the Void.",
  Deadly:
    "On a critical hit, the weapon adds a weapon damage die of the listed size. Roll this after doubling the weapon's damage. This increases to two dice if the weapon has a greater striking rune and three dice if the weapon has a major striking rune. For instance, a rapier with a greater striking rune deals 2d8 extra piercing damage on a critical hit. An ability that changes the size of the weapon's normal damage dice doesn't change the size of its deadly die.",
  Death:
    "An effect with the death trait kills you immediately if it reduces you to 0 HP. Some death effects can bring you closer to death or slay you outright without reducing you to 0 HP.",
  Dedication:
    "Each archetype's dedication feat represents your character's dedicated effort learning a new set of abilities, making it impossible to split your focus and pursue another archetype at the same time. Once you take a dedication feat, you can't select a different dedication feat until you complete your dedication by taking two other feats from your current archetype. You can't retrain a dedication feat as long as you have any other feats from that archetype.",
  Deflecting:
    "This shield is designed to block or divert certain types of attacks or weapons. Increase the shield's Hardness against the listed type of attack by 2.",
  Demon:
    "A family of fiends, demons hail from or trace their origins to the Outer Rifts. Most are irredeemably unholy and have darkvision and weaknesses to cold iron and holy.",
  Dero: "This family of humanoids are the descendants of fey creatures that fell into darkness and confusion after being abandoned in the Darklands. They are immune to confusion and vulnerable to sunlight.",
  Destiny:
    "The destiny trait indicates the first feat in a mythic destiny. You must be a mythic character of 12th-level to select a destiny and cannot take subsequent feats in that mythic destiny without first taking the destiny feat.",
  Detection:
    "Effects with this trait attempt to determine the presence or location of a person, object, or aura.",
  Deviant: "This trait describes strange supernatural or paranormal abilities.",
  Devil:
    "A family of fiends from Hell, most devils are irredeemably unholy. They typically have greater darkvision, immunity to fire, telepathy, and weakness to holy.",
  Dhampir:
    "A creature with this trait has the dhampir versatile heritage. These humanoids are the offspring of vampires and members of other ancestries.",
  Dinosaur: "These reptiles have survived from prehistoric times.",
  Disarm:
    "You can use this weapon to Disarm with the Athletics skill even if you don't have a free hand. This uses the weapon's reach (if different from your own) and adds the weapon's item bonus to attack rolls (if any) as an item bonus to the Athletics check. If you critically fail a check to Disarm using the weapon, you can drop the weapon to take the effects of a failure instead of a critical failure. On a critical success, you still need a free hand if you want to take the item.",
  Disease:
    "An effect with this trait applies one or more diseases. A disease is typically an affliction.",
  Div: "Divs are a family of fiends spawned from the spirits of evil genies within the desolation of Abaddon. Most divs are neutral evil. They typically have greater darkvision and weakness to cold iron and good damage.",
  Divine:
    "This magic comes from the divine tradition, drawing power from deities or similar sources. Anything with this trait is magical. A creature with this trait is primarily constituted of or has a strong connection to divine magic.",
  DoubleBarrel:
    "This weapon has two barrels that are each loaded separately. You can fire both barrels of a double barrel weapon in a single Strike to increase the weapon damage die by one step. If the weapon has the fatal trait, this increases the fatal die by one step.",
  Downtime:
    "An activity with this trait takes a day or more, and can be used only during downtime.",
  Dragon:
    "Dragons are reptilian creatures, often winged or with the power of flight. Most can exhale magical energy and are immune to sleep and paralysis.",
  Dragonblood:
    "A creature with this trait has the dragonblood versatile heritage. These creatures are born of draconic lineage and often have draconic appearances.",
  Dream:
    "Creatures native to the Dimension of Dreams can possess a diverse array of abilities, although those associated with the nightmare realm of Leng are almost always unholy and immune to that realm's freezing temperatures.",
  Dromaar:
    "A creature with this trait has the dromaar versatile heritage. Dromaars are of mixed ancestry, including orcs or other dromaars. An ability with this trait can be used or selected only by dromaars.",
  Drug: "An item with this trait is a drug, a poison that conveys short-term benefits in addition to harmful side effects and long-term consequences. Each time a creature uses a given drug it must also attempt a saving throw against addiction to that drug.",
  Druid: "This indicates abilities from the druid class.",
  Duskwalker:
    "A creature with this trait has the duskwalker versatile heritage. Duskwalkers are planar scions infused with the supernatural energy of psychopomps. An ability with this trait can be used or selected only by duskwalkers.",
  Dwarf:
    "A creature with this trait is a member of the dwarf ancestry. Dwarves are stout folk who often live underground and typically have darkvision. An ability with this trait can be used or selected only by dwarves. An item with this trait is created and used by dwarves.",
  Earth:
    "Effects with the earth trait either manipulate or conjure earth. Those that manipulate earth have no effect in an area without earth. Creatures with this trait consist primarily of earth or have a connection to magical earth.",
  Eidolon:
    "A creature with this trait is a summoner's eidolon. An item with this trait can be worn by an eidolon. An eidolon can have up to two items invested.",
  Electricity:
    "Effects with this trait deal electricity damage. A creature with this trait has a magical connection to electricity.",
  Elemental:
    "Creatures directly tied to an element and native to the elemental planes. Elementals don't need to breathe.",
  Elf: "A creature with this trait is a member of the elf ancestry. Elves are mysterious people with rich traditions of magic and scholarship who typically have low-light vision. An ability with this trait can be used or selected only by elves. A weapon with this trait is created and used by elves.",
  Elixir: "Elixirs are alchemical liquids that are used by drinking them.",
  Emotion:
    "This effect alters a creature's emotions. Effects with this trait always have the mental trait as well. Creatures with special training or that have mechanical or artificial intelligence are immune to emotion effects.",
  Entrench:
    "You can position yourself in the armor or reposition its articulated pieces to better protect against some attacks. If you're trained in this armor, while wearing it you can spend a single action to gain a +1 circumstance bonus to AC against a certain type of attack until the start of your next turn. The entrench trait lists the type of attack this bonus applies against, typically entrench melee or entrench ranged.",
  Environmental:
    "A hazard with this trait is something dangerous that's part of the natural world, such as quicksand or harmful mold.",
  Esoterica:
    "The esoterica trait is present in many thaumaturge feats and class features that incorporate the various talismans, supernatural trinkets, and other objects you carry with you. Abilities that have the esoterica trait require you to be in possession of your esoterica to use them. Normally, you're assumed to always have your esoterica with you, but in some rare circumstances, you might either not have them on hand or have your gear stripped from you.",
  Ethereal:
    "Ethereal creatures are natives of the Ethereal Plane. They can survive the basic environmental effects of the Ethereal Plane.",
  Evolution:
    "Feats with this trait affect your eidolon instead of you, typically by granting it additional physical capabilities.",
  Expandable:
    "An item with the expandable trait increases to a specific size when activated. Unless otherwise noted, this space must be adjacent to you and on the ground, and the item needs to have enough open space to expand into or else the activation has no effect. When the effect ends, the expanded item disintegrates if it's a consumable or shrinks back to its normal size if it's not a consumable.",
  Exemplar: "This indicates abilities from the exemplar class.",
  Experiment:
    "An experimental cryptid has been purposefully altered through alchemy, engineering, magic, or ritual to contain some degree of construct components. Although powerful, the process is volatile and imperfect.",
  Exploration:
    "An activity with this trait takes more than a turn to use, and can usually be used only during exploration mode.",
  Extradimensional:
    "This effect or item creates an extradimensional space. An extradimensional effect placed inside another extradimensional space ceases to function until it is removed.",
  Fatal:
    "The fatal trait includes a die size. On a critical hit, the weapon's damage die increases to that die size instead of the normal die size, and the weapon adds one additional damage die of the listed size.",
  FatalAim:
    "It's possible to hold the stock of this weapon under one arm so you can fire it with a single hand as long as the other hand isn't holding a weapon, shield, or anything else you would need to move and position, to ensure the weapon doesn't slip out from under your arm. However, if you use both hands, the weapon can make fatal attacks. When you wield the weapon in two hands, it gains the fatal trait with the listed damage die. Holding the weapon underarm stably enough to fire is significantly more complicated than just releasing one hand from the weapon, so to switch between the two grips, you must do so with an Interact action rather than Releasing or as part of reloading.",
  Fear: "Fear effects evoke the emotion of fear. Effects with this trait always have the mental and emotion traits as well.",
  Fetchling:
    "A creature with this trait is a member of the fetchling ancestry. Fetchlings were once human, but generations of life in the Netherworld have transformed them.",
  Fey: "Creatures of the First World are called the fey.",
  Fiend:
    "Creatures that hail from or have a strong connection to the unholy planes are called fiends. Fiends can survive the basic environmental effects of planes in the Outer Sphere.",
  Fighter: "This indicates abilities from the fighter class.",
  Figurehead:
    "While many ships are adorned with decorative carvings, daring crews sometimes procure magical figureheads for their vessels.",
  Finesse:
    "You can use your Dexterity modifier instead of your Strength modifier on attack rolls using this melee weapon. You still use your Strength modifier when calculating damage.",
  Finisher:
    "Finishers are spectacular finishing moves. You can use a finisher only if you have panache, and you lose your panache immediately after performing a finisher. Once you use a finisher, you can't use actions that have the attack trait for the rest of your turn. Some finisher actions also grant an effect on a failure. If your finisher succeeds, you can choose to apply the failure effect instead.",
  Finite: "Planes with this trait consist of a limited amount of space.",
  Fire: "Effects with the fire trait deal fire damage, or either conjure or manipulate fire. Those that manipulate fire have no effect in an area without fire. Creatures with this trait consist primarily of fire or have a connection to magical fire.",
  Fleshwarp:
    "A humanoid transformed so completely by outside forces that they are now a unique ancestry.",
  Flexible:
    "The armor is flexible enough that it doesn't hinder most actions. You don't apply its check penalty to Acrobatics or Athletics checks.",
  Flourish:
    "Actions with the flourish trait are special techniques that require too much exertion for you to perform frequently. You can use only one action with the flourish trait per round.",
  Focus:
    "Focus spells are a special type of spell attained directly from a branch of study, from a deity, or from another specific source. You can learn focus spells only through special class features or feats, rather than choosing them from a spell list. Furthermore, you cast focus spells using a special pool of Focus Points—you can't prepare a focus spell in a spell slot or use your spell slots to cast focus spells; similarly, you can't spend your Focus Points to cast spells that aren't focus spells.",
  Focused:
    "An item with this trait can give you an additional Focus Point. This focus point is separate from your focus pool and doesn't count toward the cap on your focus pool. You can gain this benefit only if you have a focus pool, and there might be restrictions on how the point can be used. You can't gain more than 1 Focus Point per day from focused items.",
  Foldaway:
    "<p>This shield can collapse into a smaller form attached to a gauntlet for stability and easy travel. You can use an Interact action to deploy or stow the shield. While it's deployed, you can Raise the Shield as long as you have that hand free or are holding an object of light Bulk that's not a weapon in that hand. The shield impedes the use of your hand while it's deployed. Though you can still hold items in that hand, you can't wield weapons in that hand, operate anything that takes two hands, or attack with the gauntlet.</p><p>A foldaway shield must be attached to a gauntlet for stability. It can be affixed to an item with 10 minutes of work and a successful DC 10 Crafting check; this includes the time needed to remove the shield from a previous gauntlet, if necessary. If the gauntlet is destroyed, the foldaway shield can usually be salvaged. The collapsible nature of the shield makes it impossible to affix an attached weapon to it.</p>",
  Force:
    "Effects with this trait deal force damage or create objects made of pure magical force.",
  Forceful:
    "This weapon becomes more dangerous as you build momentum. When you attack with it more than once on your turn, the second attack gains a circumstance bonus to damage equal to the number of weapon damage dice, and each subsequent attack gains a circumstance bonus to damage equal to double the number of weapon damage dice.",
  Fortune:
    "A fortune effect beneficially alters how you roll your dice. You can never have more than one fortune effect alter a single roll. If multiple fortune effects would apply, you have to pick which to use. If a fortune effect and a misfortune effect would apply to the same roll, the two cancel each other out, and you roll normally.",
  FreeHand:
    "This weapon doesn't take up your hand, usually because it is built into your armor. A free-hand weapon can't be Disarmed. You can use the hand covered by your free-hand weapon to wield other items, perform manipulate actions, and so on. You can't attack with a free-hand weapon if you're wielding anything in that hand or otherwise using that hand. When you're not wielding anything and not otherwise using the hand, you can use abilities that require you to have a hand free as well as those that require you to be wielding a weapon in that hand. Each of your hands can have only one free-hand weapon on it.",
  Fulu: "Fulus are small paper charms that can be affixed to a suit of armor, a shield, a weapon, a creature, or even a structure. Some fulus are composed of multiple such charms, taking effect only once all have been affixed. Normal fulus have effects immediately once affixed, while fulu talismans have an effect only once activated. Once a fulu has been activated, it lasts for the given duration and then burns out. Unless otherwise noted, fulus expire one year after being created, reverting to mundane paper. All fulus have the fulu and consumable traits. Fulus also have a tradition trait—either arcane, divine, occult or primal—determined by the magical tradition of its creator. For example, a fulu created by a priest would have the divine trait, whereas a witch who dabbles in fate might create a fulu with the occult trait. Some fulus also have the talisman trait, if they work similarly to talismans (such as being affixed to a suit of armor, a shield, or a weapon. Each fulu's stat block indicates the type of item or creature it can be affixed to. Affixing or removing a fulu requires using the Affix a Fulu activity, or the Affix a Talisman action instead if the fulu is also a talisman.",
  Fungus:
    "Fungal creatures have the fungus trait. They are distinct from normal fungi.",
  Gadget:
    "Gadgets are consumable technological inventions with innovative uses.",
  Ganzi:
    "A planar scion descended from a chaotic being of the Maelstrom, such as a protean.",
  General:
    "A type of feat that any character can select, regardless of ancestry and class, as long as they meet the prerequisites. You can select a feat with this trait when your class grants a general feat.",
  Genie:
    "The diverse families of genies hold positions of prominence on the elemental planes. They have powerful magical abilities.",
  Geniekin:
    "An umbrella term for planar scions descended from beings from the Elemental Planes.",
  Ghoran:
    "An intelligent plant ancestry that maintain long lives by rejuvenating themselves from seeds.",
  Ghost:
    "Lost souls that haunt the world as incorporeal undead are called ghosts.",
  Ghoul: "Ghouls are vile undead creatures that feast on flesh.",
  Ghul: "Greedy and gluttonous undead originally formed from genie.",
  Giant: "Giants are massive humanoid creatures.",
  Gnoll: "Kholos are humanoids that resemble hyenas.",
  Gnome:
    "A creature with this trait is a member of the gnome ancestry. Gnomes are small people skilled at magic who seek out new experiences and usually have low-light vision. An ability with this trait can be used or selected only by gnomes. A weapon with this trait is created and used by gnomes.",
  Goblin:
    "A creature with this trait is a small, frantic goblinoid. Goblins tend to have darkvision. An ability with this trait can be used or chosen only by goblins. A weapon with this trait is created and used by goblins.",
  Goloma: "Insular humanoids that bear countless eyes.",
  Graft:
    "<p>An item that has the graft trait is a living tissue sample that has been implanted into a host. It's permanently a part of the subject's body and reduces the number of items that creature can invest per day by 1. Each graft has the invested trait to indicate this limitation—a graft is like an invested item that the host creature has no choice but to invest. If a creature gets a new graft when their limit on invested items has already been reduced to zero, the host body rejects the graft. Once fully implanted, a graft cannot take damage separately.</p><p>If a graft is ever severed from the host body, it can be reattached by any effect that can typically reattach limbs or organs, such as the regenerate spell. A grafter can remove a grant using the same process required to implant one, though this does not necessarily restore any organs replaced by the graft initially. Grafts typically require specialized storage conditions, such as alchemical tanks, to remain viable outside of a host. Grafts can usually be upgraded into their greater versions by having a grafter apply additional surgeries, mutagenic development, or similar medical procedures</p>",
  Grapple:
    "You can use this weapon to Grapple with the Athletics skill even if you don't have a free hand. This uses the weapon's reach (if different from your own) and adds the weapon's item bonus to attack rolls as an item bonus to the Athletics check. If you critically fail a check to Grapple using the weapon, you can drop the weapon to take the effects of a failure instead of a critical failure.",
  Gremlin:
    "Cruel and mischievous fey, gremlins have acclimated to life in the Universe.",
  Grimoire:
    "Spellbooks are useful tools for any magic user to write down incantations and runes of power, but where most spellbooks are nothing more than ink on parchment, grimoires have absorbed the magic of the spells within—magic that knowledgeable spellcasters can use to augment their spells.",
  Grioth:
    "A grioth is a batlike alien that wields occult powers and can exist in the dark vacuum of space. They have darkvision and echolocation.",
  Grippli: "Tripkees are a family of froglike humanoids.",
  Gunslinger: "This indicates abilities from the gunslinger class.",
  Hag: "These malevolent spellcasters form covens.",
  Halfling:
    "A creature with this trait is a member of the halfling ancestry. These small people are friendly wanderers considered to be lucky. An ability with this trait can be used or selected only by halflings. A weapon with this trait is created and used by halflings.",
  Hampering:
    "After you hit with the weapon, you can use an Interact action to give the target a –10-foot circumstance penalty to all Speeds. The penalty ends after the target takes a move action, at the start of your next turn, if you attack with the weapon, or if you move out of reach of the target, whichever comes first.",
  Harnessed:
    "This shield features a special brace or opening designed to hold jousting weapons.",
  Haunt:
    "A hazard with this trait is a spiritual echo, often of someone with a tragic death. Putting a haunt to rest often involves resolving the haunt's unfinished business. A haunt that hasn't been properly put to rest always returns after a time.",
  Healing:
    "A healing effect restores a creature's body, typically by restoring Hit Points, but sometimes by removing diseases or other debilitating effects.",
  Hefty:
    "A hefty shield is so heavy that raising it takes more effort. Raising a Shield with the hefty trait is a 2-action activity unless your Strength score equals or exceeds the number with the trait.",
  Herald:
    "Nearly all deities have a specific representative known as a herald; heralds are as diverse in their appearances and abilities as the gods themselves. A creature with the herald type is always unique.",
  Hex: "A hex is a spell caused by your patron's direct attention and intervention. Your patron does not take well to being disturbed repeatedly, so you can cast only one spell that has the hex trait each turn; attempts to use a second automatically fail and usually cause your familiar to hiss in displeasure as your patron rejects your call.",
  Hindering:
    "This armor is so heavy and bulky it slows you down no matter what. You take a -5 penalty to all your Speeds (to a minimum of a 5-foot Speed). This is separate from and in addition to the armor's Speed penalty, and affects you even if your Strength or an ability lets you reduce or ignore the armor's Speed penalty.",
  Hobgoblin:
    "A creature with this trait is a tall, militaristic goblinoid. Hobgoblins tend to have darkvision.",
  z: "Effects with the holy trait are tied to powerful magical forces of benevolence and virtue. They often have stronger effects on unholy creatures. Creatures with this trait are strongly devoted to holy causes and often have weakness to unholy. If a creature with weakness to holy uses a holy item or effect, it takes damage from its weakness.",
  Hryngar:
    "Subterranean kin of the dwarves, hryngars typically have darkvision, resist poison, and recoil from bright light",
  Human:
    "A creature with this trait is a member of the human ancestry. Humans are a diverse array of people known for their adaptability. An ability with this trait can be used or selected only by humans.",
  Humanoid:
    "Humanoid creatures reason and act much like humans. They typically stand upright and have two arms and two legs.",
  Ifrit: "A type of geniekin descended from a being from the Plane of Fire.",
  Ikon: "An item with the ikon trait is a special item provided or created by an exemplar's divinity that is so tied to that exemplar that it can serve as a sacred vessel for their might. You gain three ikons at first level. Each ikon has a passive immanence ability and an activated transcendence ability. A feat with the ikon trait imbues one of your ikons with further capabilities. Whenever you gain a feat with the ikon trait, choose which of your ikons gains that ability; if you have multiple ikons that meet the feat's usage requirements, you can take the feat multiple times to apply its effects to another one of your ikons. These feats list what ikon they can be imbued into, and any number of them can be imbued into a single ikon.",
  Illusion:
    "Effects and magic items with this trait involve false sensory stimuli.",
  Impulse:
    "The primary magical actions kineticists use are called impulses. You can use an impulse only if your kinetic aura is active and channeling that element, and only if you have a hand free to shape the elemental flow. The impulse trait means the action has the concentrate trait unless another ability changes this. If an impulse allows you to choose an element, you can choose any element you're channeling, and the impulse gains that element's trait.",
  Incapacitation:
    "An ability with this trait can take a character completely out of the fight or even kill them, and it's harder to use on a more powerful character. If a spell has the incapacitation trait, any creature of more than twice the spell's rank treats the result of their check to prevent being incapacitated by the spell as one degree of success better, or the result of any check the spellcaster made to incapacitate them as one degree of success worse. If any other effect has the incapacitation trait, a creature of higher level than the item, creature, or hazard generating the effect gains the same benefits.",
  Incarnate:
    "A spell with the incarnate trait is similar in theme to spells that summon creatures, but it doesn't conjure a minion with the summoned trait. Instead, when summoned, the incarnate creature takes its Arrive action when you finish Casting the Spell. At the end of your next turn, the incarnate creature can either Step, Stride, or take the action for another movement type it has (such as Climb or Burrow), and then takes its Depart action. The spell then ends. The names of specific Arrive and Depart actions are listed in italics after the word &quote;Arrive&quote; or &quote;Depart&quote; respectively, along with any traits. A creature summoned by an incarnate spell acts in your interests, directs its effects away from you and your allies as much as possible, and might listen to your requests, but ultimately makes its own decisions. If the spell indicates that the incarnate makes a decision, the GM determines what the incarnate would do. It might even become more inclined to do precisely as you wish over multiple summonings. The incarnate is not fully a creature. It can't take any other actions, nor can it be targeted or harmed by Strikes, spells, or other effects unless they would be able to target or end a spell effect (such as dispel magic). It has a size for the purposes of determining its placement for effects, but it doesn't block movement. If applicable, its effects use your spell DCs and spell attack roll modifier.",
  Incorporeal:
    "An incorporeal creature or object has no physical form. It can pass through solid objects, including walls. When inside an object, an incorporeal creature can't perceive, attack, or interact with anything outside the object, and if it starts its turn in an object, it is slowed 1 until the end of its turn. A corporeal and an incorporeal creature can pass through one another, but they can't end their movement in each other's space. An incorporeal creature can't attempt Strength-based checks against physical creatures or objects—only against incorporeal ones—unless those objects have the ghost touch property rune. Likewise, a corporeal creature can't attempt Strength-based checks against incorporeal creatures or objects. Incorporeal creatures usually have immunity to effects or conditions that require a physical body, like disease, poison, and precision damage. They usually have resistance against all damage (except force damage, spirit damage, and damage from Strikes with the ghost touch property rune), with double the resistance against non-magical damage.",
  Inevitable:
    "These constructed aeons were created by the axiomites. Each type of inevitable is dedicated to a specific task. Most inevitables have weakness to chaotic damage.",
  Infused:
    "An alchemical item with the infused trait has a limited time before it becomes inert. Any non-permanent effects from your infused alchemical items, with the exception of afflictions such as slow-acting poisons, end when you make your daily preparations again.",
  Infusion:
    "Actions with the infusion trait tweak your kineticist impulses. You must use an infusion action directly before the impulse action you want to alter. If you use any action (including free actions and reactions) other than an impulse action directly after, you waste the benefits of the infusion action. Any additional effects added by an infusion action are part of the impulse's effect, not of the infusion action itself.",
  Ingested:
    "An ingested poison is activated by applying it to food or drink to be consumed by a living creature, or by placing it directly into a living creature's mouth. A creature attempts a saving throw against such a poison when it consumes the poison or the food or drink treated with the poison. The onset time of ingested poisons typically ranges anywhere from 1 minute to 1 day.",
  Inhaled:
    "An inhaled poison is activated by unleashing it from its container. Once unleashed, the poison creates a cloud filling a 10-foot cube lasting for 1 minute or until a strong wind dissipates the cloud. Every creature entering this cloud is exposed to the poison and must attempt a saving throw against it; a creature aware of the poison before entering the cloud can use a single action to hold its breath and gain a +2 circumstance bonus to the saving throw for 1 round.",
  Injection:
    "This weapon can be filled with an injury poison. Immediately after a successful attack with the weapon, you can inject the target with the loaded poison with a single Interact action. Refilling the weapon with a new substance requires 3 Interact actions and uses two hands.",
  Injury:
    "An injury poison is activated by applying it to a weapon or ammunition, and it affects the target of the first Strike made using the poisoned item. If that Strike is a success and deals piercing or slashing damage, the target must attempt a saving throw against the poison. On a failed Strike, the target is unaffected, but the poison remains on the weapon and you can try again. On a critical failure, or if the Strike fails to deal slashing or piercing damage for some other reason, the poison is spent but the target is unaffected.",
  Inscribed:
    "The armor or shield has been treated so it can be inscribed with magical symbols using the same method as Crafting a scroll. Inscribed attire can hold one scroll inscribed on it. You need a free hand to Activate the scroll, but you don't need to Interact to draw it. You can also Activate the magic to erase the scroll the armor currently contains. You can't inscribe a new scroll onto the armor if a scroll is currently inscribed on it or if the armor is broken.",
  Integrated:
    "This shield has been created to include a weapon in its construction, which works like an attached weapon but can't be removed from the shield.",
  Intelligent:
    "An item with this trait is intelligent and has its own will and personality, as well as several statistics that most items don't have. Intelligent items can't be crafted by normal means, and they are always rare or unique.",
  Inventor: "This indicates abilities from the inventor class.",
  Invested:
    "A character can invest only 10 magical items that have the invested trait. None of the magical effects of the item apply if the character hasn't invested it, nor can it be activated, though the character still gains any normal benefits from wearing the physical item (like a hat keeping rain off their head).",
  Investigator: "This indicates abilities from the investigator class.",
  Jousting:
    "The weapon is suited for mounted combat with a harness or similar means. When mounted, if you moved at least 10 feet on the action before your attack, add a circumstance bonus to damage for that attack equal to the number of damage dice for the weapon. In addition, while mounted, you can wield the weapon in one hand, changing the damage die to the listed value.",
  Kami: "Kami are spirits of the Material Plane that bond with a specific object or place.",
  Kashrishi:
    "A stout ancestry bearing distinctive crystal horns and inherent psychic abilities.",
  Kholo: "Kholos are humanoids that resemble hyenas.",
  Kickback:
    "A kickback weapon is extra powerful and difficult to use due to its high recoil. A kickback weapon deals 1 additional damage with all attacks. Firing a kickback weapon gives a -2 circumstance penalty to the attack roll, but characters with 14 or more Strength ignore the penalty. Attaching a kickback weapon to a deployed bipod, tripod, or other stabilizer can lower or negate this penalty.",
  Kineticist: "This indicates abilities from the kineticist class.",
  Kitsune: "Shapeshifting humanoids whose true forms resemble foxes.",
  Kobold:
    "A creature with this trait is a member of the kobold ancestry. Kobolds are reptilian humanoids who are usually Small and typically have darkvision.",
  Kovintus:
    "Reclusive humanoids with an inborn talent for geomancy, kovintus have an intrinsic tie to nature and magic alike",
  Laminar:
    "The armor is made up of layered sections, so when it breaks, it isn't as much of a problem. The status penalty to AC if this armor is broken is –1 for broken medium armor, –2 for broken heavy armor, or no penalty for broken light armor.",
  Launching:
    'A mechanism within this shield can shoot projectiles, causing the shield to also function as a ranged weapon. The trait lists the type of weapon, such as "launching dart." Striking with the launcher requires the same number of hands as normal, except that the hand holding the shield counts toward this total, so a one-handed ranged weapon would require only one hand. Reloading takes the normal number of Interact actions, to a minimum of 1 action, and you can\'t use the hand holding your shield to reload.',
  Leshy:
    "A creature with this trait is a member of the leshy ancestry. These small plant or fungus creatures are humanoid in form.",
  Light:
    "Light effects overcome non-magical darkness in the area, and can counteract magical darkness. You must usually target darkness magic with your light magic directly to counteract the darkness, but some light spells automatically attempt to counteract darkness.",
  Lineage:
    "A feat with this trait indicates a character's descendance from a particular type of creature. You can have only one lineage feat. You can select a lineage feat only at 1st level, and you can't retrain into or out of these feats.",
  Linguistic:
    "An effect with this trait depends on language comprehension. A linguistic effect that targets a creature works only if the target understands the language you are using.",
  Litany:
    "Litanies are special devotion spells, typically used by champions and requiring a single action, that usually give temporary immunity to further litanies.",
  Lizardfolk:
    "Lizardfolk are a family of reptilian humanoids. These reptilian humanoids, also known as iruxi, are extremely adaptable and patient.",
  Lozenge:
    "You Activate an alchemical lozenge by putting it in your mouth. It stays there, slowly dissolving and releasing its ingredients over time. You can bite a lozenge for a secondary effect. The action this takes is noted in the item. As soon as this secondary effect is over, the lozenge is used up and its benefits for you end. You can drink elixirs, potions, and beverages with a lozenge in your mouth, but you can't benefit from more than one lozenge at a time. If you have two lozenges in your mouth at the same time, both become inert. You can also spit out a lozenge as a single action to end its effect and make it inert. A lozenge dissolves due to its alchemical ingredients, so it typically still works even if you don't have saliva.",
  Magical:
    "Something with the magical trait is imbued with magical energies not tied to a specific tradition of magic. Some items or effects are closely tied to a particular tradition of magic. In these cases, the item has the arcane, divine, occult, or primal trait instead of the magical trait. Any of these traits indicate that the item is magical.",
  Magus: "This indicates abilities from the magus class.",
  Manipulate:
    "You must physically manipulate an item or make gestures to use an action with this trait. Creatures without a suitable appendage can't perform actions with this trait. Manipulate actions often trigger reactions.",
  Mechanical: "A hazard with this trait is a constructed physical object.",
  Mental:
    "A mental effect can alter the target's mind. It has no effect on an object or a mindless creature.",
  Merfolk:
    "These aquatic humanoids have an upper body similar to a human and a lower body similar to a fish.",
  Metal:
    "Effects with the metal trait conjure or manipulate metal. Those that manipulate metal have no effect in an area without metal. Creatures with this trait consist primarily of metal or have a connection to magical metal.",
  Mindless:
    "A mindless creature has either programmed or rudimentary mental attributes. Most, if not all, of their mental attribute modifiers are –5. They are immune to all mental effects.",
  Mindshift:
    "An action with this trait can always be altered to use the raw power of your mind. When you take this action, you can choose to replace any damage it deals with mental damage, give it the mental trait, and replace any save it requires with a Will save. The action loses any traits matching damage types it no longer deals.",
  Minion:
    "<p>Minions are creatures that directly serve another creature. Your minion acts on your turn in combat, once per turn, when you spend an action to issue it commands. For an animal companion, you Command an Animal; for a minion that's a spell or magic item effect, like a summoned minion, you Sustain the effect; if not otherwise specified, you issue a verbal command as a single action with the auditory and concentrate traits. If given no commands, minions use no actions except to defend themselves or to escape obvious harm. If left unattended for long enough, typically 1 minute, mindless minions usually don't act, animals follow their instincts, and sapient minions act how they please. You can have a maximum of four minions under your control.</p><p>A minion has only 2 actions and 0 reactions per turn, though certain conditions (such as slowed or quickened) or abilities might give them a reaction that they can use. Alterations to a minion's actions occur when they gain their actions for the round. A minion can't control other creatures.</p>",
  Minotaur:
    "Minotaurs are horned, bovine humanoids with a mastery of mazes and puzzles.",
  Misfortune:
    "A misfortune effect detrimentally alters how you roll your dice. You can never have more than one misfortune effect alter a single roll. If multiple misfortune effects would apply, the GM decides which is worse and applies it. If a fortune effect and a misfortune effect would apply to the same roll, the two cancel each other out, and you roll normally.",
  Missive:
    "A missive is a piece of magical stationery that must be crafted and composed before it can be activated. All missives have the missive and consumable traits. Missives are often constructed of paper, parchment, or vellum, but any other thin, portable material that can hold writing or embossing upon it can be crafted into missives. After being crafted, the missive is a blank sheet until a message is composed upon it, completing its magic.",
  Modification:
    "A feat with this trait alters the construction of your innovation. If you have the reconfigure class feature, you can retrain such a feat more easily.",
  Modular:
    "The weapon has multiple configurations that you can switch between using an Interact action. Typically, switching between configurations of a modular weapon allows it to deal different types of damage (listed in the trait, such as \"modular B, P, or S\"), though it's possible for a modular weapon's description to list more complicated configurations.",
  Monitor:
    "Creatures that hail from or have a strong connection to Axis, the Boneyard, or the Maelstrom are called monitors. Monitors can survive the basic environmental effects of planes in the Outer Sphere.",
  Monk: "Abilities with this trait are from the monk class. A weapon with this trait is primarily used by monks.",
  MonkWeapon: "Many monks learn to use these weapons.",
  Morlock:
    "Morlocks are a family of pale, underground-dwelling humanoids who, generations ago, were regular humans.",
  Morph:
    "Effects that slightly alter a creature's form have the morph trait. Any Strikes specifically granted by a morph effect are magical. You can be affected by multiple morph spells at once, but if you morph the same body part more than once, the second morph effect attempts to counteract the first (in the same manner as two polymorph effects, described in that trait). Your morph effects might also end if you are polymorphed and the polymorph effect invalidates or overrides your morph effect. The GM determines which morph effects can be used together and which can't.",
  Mortic:
    "Mortics are living humanoids with close ties to undeath. They have darkvision, negative healing, and vulnerabilities to sacred ground, and they can become undead by holding their breath.",
  Mounted:
    "Mounted siege weapons take up a certain size and space, and typically have statistics to allow them to be attacked. They're used for large-scale warfare.",
  Move: "An action with this trait involves moving from one space to another.",
  Multiclass:
    "Archetypes with the multiclass trait represent diversifying your training into another class's specialties. You can't select a multiclass archetype's dedication feat if you are a member of the class of the same name.",
  Mummy: "A mummy is an undead creature created from a preserved corpse.",
  Munavri:
    "Amicable humanoids living in the Darklands, munavris have powerful telekinetic and psychic abilities.",
  Mutagen:
    "An elixir with the mutagen trait temporarily transmogrifies the subject's body and alters its mind. A mutagen always conveys one or more beneficial effects paired with one or more detrimental effects. Mutagens are polymorph effects, meaning you can benefit from only one at a time.",
  Mutant:
    "The monster has mutated or evolved, granting it unusual benefits, drawbacks, or both.",
  Mythic:
    "Options with this trait grant or utilize mythic power. Feats with the mythic trait can only be taken by mythic characters, who are typically characters with a mythic Calling.</p><p>Monsters with the mythic trait have access to a pool of Mythic Points and are particularly strong for creatures of their level. Many mythic monsters are either resistant or entirely immune to attacks from non-mythic creatures and weapons.</p><p>Spells with the mythic trait require the expenditure of a Mythic Point in order to be cast, and items with the mythic trait require the expenditure of a Mythic Point in order to use their activated abilities.</p><p>Weapons with the mythic trait overcome the resistances and immunities of mythic monsters.",
  Nagaji:
    "A traditionalist ancestry with reptilian features and serpentine heads.",
  Nephilim:
    "A creature with this trait has the nephilim versatile heritage. Nephilim are planar scions descended from immortal beings from other planes. An ability with this trait can be used or selected only by nephilim.",
  Nindoru:
    "Nindorus are chaotic evil fiends that rise from corruptions to the cycle of reincarnating souls and live on the Universe. Although they often have elements in their appearance that make them seem undead, they're actually living beings. Most nindorus have darkvision, are immune to death effects, have weakness to silver, and possess the power to manifest objects or creatures from their thoughts.",
  Noisy:
    "This armor is loud and likely to alert others to your presence when you're using the Avoid Notice exploration activity. The armor's check penalty applies to Stealth checks even if you meet the required Strength score.",
  None: "This trait has no description.",
  Nonlethal:
    "Attacks with this weapon are nonlethal, and are used to knock creatures unconscious instead of kill them. You can use a nonlethal weapon to make a lethal attack with a -2 circumstance penalty.",
  Nymph:
    "This family of beautiful fey creatures has strong ties to natural locations.",
  Oath: "Oaths add an additional tenet to your code. You can usually have only one feat with this trait.",
  Occult:
    "This magic comes from the occult tradition, calling upon bizarre and ephemeral mysteries. Anything with this trait is magical. A creature with this trait is primarily constituted of or has a strong connection to occult magic.",
  Oil: "Oils are magical gels, ointments, pastes, or salves that are typically applied to an object and are used up in the process.",
  Olfactory:
    "An olfactory effect can affect only creatures that can smell it. This applies only to olfactory parts of the effect, as determined by the GM.",
  Oni: "Oni are a family of brutal, shapechanging giants who were once kami.",
  Ooze: "Oozes are creatures with simple anatomies. They tend to have low mental attribute modifiers and immunity to mental effects and precision damage.",
  Oracle: "This indicates abilities from the oracle class.",
  Orc: "A creature with this trait is a member of the orc ancestry. These green-skinned people tend to have darkvision. A weapon with this trait is a weapon which orcs craft and use.",
  Oread: "A type of geniekin descended from a being from the Plane of Earth.",
  Overflow:
    "Powerful impulses temporarily overdraw the energy of your kinetic gate. When you use an impulse that has the overflow trait, your kinetic aura deactivates until you revitalize it (typically with Channel Elements). Extinguishing your element this severely is taxing, and consequently, you can use only one overflow impulse per round, even if you reactivate your kinetic gate.",
  Paaridar:
    "A paaridar is a humanoid who has gained physical aspects and abilities of a powerful beast through corrupted magical rituals.",
  Palinthanos:
    "When a cosmic event like Godsrain disturbs all that exists, the River of Souls sometimes flows backward for a brief moment, literally, from the shockwave. Unwilling and confused souls that are forced back far enough can have the agonizing experience of enduring death in reversed time. Some of these souls manage to re-enter the river once the flow returns to normal, but those who are stranded on the metaphorical shores of the living can become palinthanos: powerful undead born from their reversed demise who struggle futilely until their predestined banishment back to the River.",
  Parry:
    "This weapon can be used defensively to block attacks. While wielding this weapon, if your proficiency with it is trained or better, you can spend a single action to position your weapon defensively, gaining a +1 circumstance bonus to AC until the start of your next turn.",
  Peachwood:
    "Peachwood weapons have a particularly auburn tinge to them when under direct sunlight. Peachwood is treated as duskwood for any undead creatures' resistances or weaknesses related to duskwood (allowing a peachwood weapon to bypass a jiang-shi's resistance, for example). In addition, peachwood weapons bypass a small portion of the resistances of any undead creature. Strikes with a peachwood weapon treat an undead's resistances against physical damage as 2 lower for standard-grade peachwood, and 4 lower for high-grade.",
  PersonaFlirt:
    "The public perceives you as the most romantic of the group, and you may be thought of as a seducer or vapid pretender who gets by on their looks and brings nothing of value to the party.",
  PersonaGuardian:
    'The public perceives you as the healer and protector of the group, but some may also consider you too soft-hearted and meek to be a "true hero."',
  PersonaLeader:
    "The public perceives you as the leader of the group, but some likewise consider you too brash or even pompous.",
  PersonaScholar:
    "The public considers you the problem-solver and brains of the group, though some also perceive you as arrogant or incapable of physical tasks.",
  PersonaScoundrel:
    'The public is convinced you are the "bad boy/bad girl" of the group who gets the distasteful but necessary things done, but who is at times thought of as a criminal or potential traitor to the party.',
  PersonaUnderdog:
    'The public perceives you as a "fish out of water"—someone who accidently got swept up by the group and still manages to triumph, but who is sometimes thought of as a weak link or loser.',
  PersonaWarrior:
    "The public believes you are the strong-arm of the group, the person who excels in a fight but is also at times considered cruel, uncouth, or even a bully.",
  PersonaWildcard:
    "The public perceives you as a source of whimsy, outlandish ideas, and comedy in the group, but that reputation is a double-edged sword, as some also consider you a liability or unreliable.",
  Phantom:
    "A phantom is soul that has diverged from the River of Souls on the Ethereal Plane before being judged. They typically retain memories of their life before death but are not undead.",
  Plant:
    "Vegetable creatures have the plant trait. They are distinct from normal plants. Magical effects with this trait manipulate or conjure plants or plant matter in some way. Those that manipulate plants have no effect in an area with no plants.",
  Poison:
    "An effect with this trait delivers a poison or deals poison damage. An item with this trait is poisonous and might cause an affliction.",
  Polymorph:
    "These effects transform the target into a new form. A target can't be under the effect of more than one polymorph effect at a time. If it comes under the effect of a second polymorph effect, the second polymorph effect attempts to counteract the first. If it succeeds, it takes effect, and if it fails, the spell has no effect on that target. Any Strikes specifically granted by a polymorph effect are magical. Unless otherwise stated, polymorph spells don't allow the target to take on the appearance of a specific individual creature, but rather just a generic creature of a general type or ancestry. If you take on a battle form with a polymorph spell, the special statistics can be adjusted only by circumstance bonuses, status bonuses, and penalties. Unless otherwise noted, the battle form prevents you from casting spells, speaking, and using most manipulate actions that require hands. (If there's doubt about whether you can use an action, the GM decides.) Your gear is absorbed into you; the constant abilities of your gear still function, but you can't activate any items.",
  Ponderous:
    "The armor has moving parts or other complications that lengthen the wearer's initial reaction time. While wearing the armor, you take a –1 penalty to initiative checks. If you don't meet the armor's required Strength score, this penalty increases to be equal to the armor's check penalty if it's worse.",
  Poppet: "A creature with this trait is a member of the poppet ancestry.",
  Portable:
    "Portable siege weapons, such as battering rams, can be more easily carried and have a role in both warfare and smaller conflicts or exploration.",
  Possession:
    "Effects with this trait allow a creature to project its mind and spirit into a target. A creature immune to mental effects can't use a possession effect. While possessing a target, a possessor's true body is unconscious (and can't wake up normally), unless the possession effect allows the creature to physically enter the target. Whenever the target takes damage, the possessor takes half that amount of damage as mental damage. A possessor loses the benefits of any of its active spells or abilities that affect its physical body, though it gains the benefits of the target's active spells and abilities that affect their body. A possessor can use any of the target's abilities that are purely physical, and it can't use any of its own abilities except spells and purely mental abilities. The GM decides whether an ability is purely physical or purely mental. A possessor uses the target's attack modifier, AC, Fortitude save, Reflex save, Perception, and physical skills, and its own Will save, mental skills, spell attack roll, and spell DC; benefits of invested items apply where relevant (the possessor's invested items apply when using its own values, and the target's invested items apply when using the target's values). A possessor gains no benefit from casting spells that normally affect only the caster, since it isn't in its own body. The possessor must use its own actions to make the possessed creature act. If a possessor reaches 0 Hit Points through any combination of damage to its true body and mental damage from the possession, it is knocked out as normal and the possession immediately ends. If the target reaches 0 Hit Points first, the possessor can either fall unconscious with the body and continue the possession or end the effect as a free action and return to its body. If the target dies, the possession ends immediately and the possessor is stunned for 1 minute.",
  Potion: "A potion is a magical liquid activated when you drink it.",
  Precious:
    "Valuable materials with special properties have the precious trait. They can be substituted for base materials when you Craft items.",
  Prediction:
    "Effects with this trait determine what is likely to happen in the near future. Most predictions are divinations.",
  Press:
    "Actions with this trait allow you to follow up earlier attacks. An action with the press trait can be used only if you are currently affected by a multiple attack penalty. You can't use a press action when it's not your turn, even if you use the Ready activity. Some actions with the press trait also grant an effect on a failure. The effects that are added on a failure don't apply on a critical failure. If your press action succeeds, you can choose to apply the failure effect instead. (For example, you may wish to do this when an attack deals no damage due to resistance.)",
  Primal:
    "This magic comes from the primal tradition, connecting to the natural world and instinct. Anything with this trait is magical. A creature with this trait is primarily constituted of or has a strong connection to primal magic.",
  Processed:
    "An alchemical consumable with the processed trait can be created with Quick Alchemy but is too complex to create in a single action.",
  Propulsive:
    "You add half your Strength modifier (if positive) to damage rolls with a propulsive ranged weapon. If you have a negative Strength modifier, you add your full Strength modifier instead.",
  Protean:
    "A family of monitors spawned within the Maelstrom, these creatures are guardians of disorder. They typically have darkvision, an amorphous anatomy, and abilities that create magical warpwaves.",
  Psyche:
    "Your psyche must be unleashed to use abilities that have the psyche trait, and they end automatically when your unleashed psyche subsides.",
  Psychic: "This indicates abilities from the psychic class.",
  Psychopomp:
    "A family of monitors spawned within the Boneyard to convey souls to the Outer Planes. They typically have darkvision, lifesense, and shepherd's touch, and they are immune to death effects.",
  Qlippoth:
    "A family of fiends hailing from the Outer Rifts, most qlippoth are unholy. Their appearance affects the minds of non-qlippoth that view them.",
  Radiation:
    "A dangerous, typically poisonous emission typically originating from radioactive minerals.",
  Rage: "You must be raging to use abilities with the rage trait, and they end automatically when you stop raging.",
  Rakshasa:
    "Rakshasas are divine spirits who exemplify the profane. They can typically Change Shape and have a weakness to holy.",
  Range:
    "These attacks will either list a finite range or a range increment, which follows the normal rules for range increments.",
  RangedTrip:
    "This weapon can be used to Trip with the Athletics skill at a distance up to the weapon's first range increment. The skill check takes a -2 circumstance penalty. You can add the weapon's item bonus to attack rolls as a bonus to the check. As with using a melee weapon to trip, a ranged trip doesn't deal any damage when used to Trip.",
  Ranger: "This indicates abilities from the ranger class.",
  Rare: "This rarity indicates that a rules element is very difficult to find in the game world. A rare feat, spell, item or the like is available to players only if the GM decides to include it in the game, typically through discovery during play. Creatures with this trait are rare. They typically can't be summoned. The DC of Recall Knowledge checks related to these creatures is increased by 5.",
  Ratfolk:
    "A creature with this trait is a member of the ratfolk ancestry. Ratfolk are humanoids who resemble rats.",
  Razing:
    "Razing weapons are particularly good at damaging objects, structures, and vehicles. Whenever you deal damage to an object (including shields and animated objects), structure, or vehicle with a razing weapon, the object takes an amount of additional damage equal to double the number of weapon damage dice.",
  Reach:
    "Natural attacks with this trait can be used to attack creatures up to the listed distance away instead of only adjacent creatures. Weapons with this trait are long and can be used to attack creatures up to 10 feet away instead of only adjacent creatures. For creatures that already have reach with the limb or limbs that wield the weapon, the weapon increases their reach by 5 feet.",
  Reckless:
    "Actions with the reckless trait run the risk of the pilot losing control of a vehicle. When performing a reckless action, the pilot must first attempt an appropriate piloting check to keep control of the vehicle.",
  Recovery:
    "Recovery weapons are thrown weapons designed to return to the thrower when they miss the target. When you make an unsuccessful thrown Strike with this weapon, it flies back to your hand after the Strike is complete, allowing you to try again. If your hands are full when the weapon returns, it falls to the ground in your space.",
  Reincarnated:
    "This ancestry feat is available to any character who has reincarnated at least once, either as part of their backstory or because of a reincarnation that took place during play.",
  Reflection:
    "A creature with this trait has the reflection versatile heritage. Reflections are beings who are copies of living people, whether through cloning, planar duplication, or another mechanism. An ability with this trait can be used or selected only by reflections.",
  Relic: "An item with the relic trait grows in power with its wielder.",
  Reload:
    "While all weapons need some amount of time to get into position, many ranged weapons also need to be loaded and reloaded. This entry indicates how many Interact actions it takes to reload such weapons. This can be 0 if drawing ammunition and firing the weapon are part of the same action. If an item takes 2 or more actions to reload, the GM determines whether they must be performed together as an activity, or you can spend some of those actions during one turn and the rest during your next turn.",
  Repeating:
    "These weapons can't be loaded with individual bolts or bullets like other crossbows and firearms; instead, they require a magazine of specialized ammunition to be loaded into a special slot. Once that magazine is in place, the ammunition is automatically loaded each time the weapon is cocked to fire, reducing its reload to the value in its reload entry (typically 0). When the ammunition runs out, a new magazine must be loaded, which requires a free hand and 3 Interact actions (to remove the old magazine, retrieve the new magazine, and slot the new magazine in place). These actions don't need to be consecutive.",
  Resonant:
    "This weapon can channel energy damage. You gain the Conduct Energy free action while wielding a resonant weapon.",
  Revelation: "Effects with this trait see things as they truly are.",
  Rogue: "This indicates abilities from the rogue class.",
  Saggorak:
    "Ancient dwarven blacksmiths in Saggorak designed a series of spectacularly powerful runes. Only someone with legendary proficiency in Crafting, or a well-versed dwarven crafter from the city of Kovlar, can apply, transfer, or remove a rune with the Saggorak trait. Because of their considerable power, all Saggorak runes take up two property rune slots, and consequently they can be applied only to armor and weapons with at least a +2 potency rune.",
  Sahkil:
    "Sahkils are fiends that delight in spreading fear and unease among mortal creatures. They typically have darkvision, immunity to fear, and weakness to good.",
  Samsaran:
    "Blue-skinned people native to Zi Ha, who reincarnate upon death and recall pieces of their past lives.",
  Sanctified:
    "If you are holy or unholy, your sanctified actions and spells gain the same trait.",
  Scatter:
    "This weapon fires a cluster of pellets in a wide spray. Scatter always has an area listed with it, indicating the radius of the spray. On a hit, the primary target of attacks with a scatter weapon take the listed damage, and the target and all other creatures within the listed radius around it take 1 point of splash damage per weapon damage die.",
  Scroll: "A scroll contains a single spell you can cast without a spell slot.",
  Scrying:
    "A scrying effect lets you see, hear, or otherwise get sensory information from a distance using a sensor or apparatus, rather than your own eyes and ears.",
  SeaDevil:
    "Evil ocean-dwelling humanoids, sea devils usually have darkvision and wavesense.",
  Secret: "The GM rolls the check for this ability in secret.",
  Sedacthy:
    "Ocean-dwelling humanoids who communicate with sea life and usually have darkvision and wavesense.",
  Serpentfolk: "Serpentfolk are a family of serpentine humanoids.",
  Shabti:
    "A shabti is a constructed humanoid originally meant to face judgment for a living creature's sins after death.",
  Shade:
    "Shades are mortal souls who have been judged and then transformed into creatures native to other planes. Petitioners can survive the basic environmental effects of their home plane.",
  Shadow: "This magic involves shadows or the energy of the Netherworld.",
  ShieldThrow:
    "A shield with this trait is designed to be thrown as a ranged attack.",
  Shisk: "Secretive humanoids covered in bony plumage that reside underground.",
  Shoony: "A creature with this trait is a member of the shoony ancestry.",
  Shove:
    "You can use this weapon to Shove with the Athletics skill even if you don't have a free hand. This uses the weapon's reach (if different from your own) and adds the weapon's item bonus to attack rolls as an item bonus to the Athletics check. If you critically fail a check to Shove using the weapon, you can drop the weapon to take the effects of a failure instead of a critical failure.",
  Skeleton:
    "This undead is made by animating a dead creature's skeleton with void energy. An ability with this trait can be used or selected only by skeletons.",
  Skelm:
    "These creatures are monstrous, wrathful misanthropes who seek to control others through anger and spite.",
  Skill:
    "A general feat with the skill trait improves your skills and their actions or gives you new actions for a skill. A feat with this trait can be selected when a class grants a skill feat or general feat. Archetype feats with the skill trait can be selected in place of a skill feat if you have that archetype's dedication feat.",
  Skulk:
    "Skulks are a family of humanoids whose skin can shift coloration to aid in stealth.",
  Sleep: "This effect can cause a creature to fall asleep or get drowsy.",
  Snare:
    "Traps typically made by rangers, snares follow special rules that allow them to be constructed quickly and used on the battlefield.",
  Social:
    "Actions and abilities with the social trait can be used only while a vigilante is in their social identity.",
  Sonic:
    "An effect with the sonic trait functions only if it makes sound, meaning it has no effect in an area of silence or in a vacuum. This is different from an auditory spell, which is effective only if the target can hear it. A sonic effect might deal sonic damage.",
  Sorcerer: "This indicates abilities from the sorcerer class.",
  Soulbound:
    "These constructs are mentally augmented by a fragment of a once-living creature's soul.",
  Spellgun:
    "The spellgun trait appears on items that can generate a magical effect that flies out like a bullet. You can make either a spell attack roll with a spellgun or a ranged attack roll using your proficiency with simple firearms. Spellguns have a range increment, which applies regardless of which type of attack roll you make. Though you can use your modifier for simple firearms, a spellgun isn't actually a firearm. You don't get the damage of a firearm Strike, nor other benefits like critical specialization. Similarly, you can't load or reload a spellgun, affix talismans to one, make a spellgun Strike as part of an action that lets you make a firearm Strike, and so on.",
  Spellheart:
    "Spellhearts are permanent items that work similarly to talismans. You affix a spellheart using the Affix a Spellheart activity, which is otherwise identical to Affix a Talisman. The limit of one talisman per item remains—an item can have one spellheart or one talisman, not both. When casting a cantrip from a spellheart, you can use your own spell attack roll or spell DC if it's higher. Crafting a spellheart requires the spells the spellheart can cast. For example, a major five-feather wreath requires air walk, gale blast, and wall of wind.",
  Spellshape:
    "Spellshape actions tweak the properties of your spells. You must use a spellshape action directly before casting the spell you want to alter. If you use any action (including free actions and reactions) other than casting a spell directly after, you waste the benefits of the spellshape action. The benefit is also lost if your turn ends before you cast the spell. Any additional effects added by a spellshape action are part of the spell's effect, not of the spellshape action itself.",
  Spirit:
    "Effects with this trait can affect creatures with spiritual essence and might deal spirit damage. A creature with this trait is defined by its spiritual essence. Spirit creatures often lack a material form.",
  Splash:
    "Some weapons and effects, such as alchemical bombs, have the splash trait. When you use a weapon or effect with the splash trait, you don't add your Strength modifier to the damage roll. A splash weapon or effect deals any listed splash damage to the target on a failure, success, or critical success, and to all other creatures within 5 feet of the target on a success or critical success. On a critical failure, the weapon or effect misses entirely, dealing no damage. Add splash damage together with the initial damage against the target before applying the target's resistance or weakness. You don't multiply splash damage on a critical hit.",
  Splash10:
    "When you use a thrown weapon with the splash trait, you don't add your Strength modifier to the damage roll. If an attack with a splash weapon fails, succeeds, or critically succeeds, all creatures within 10 feet of the target (including the target) take the listed splash damage. On a failure (but not a critical failure), the target of the attack still takes the splash damage. Add splash damage together with the initial damage against the target before applying the target's weaknesses or resistances. You don't multiply splash damage on a critical hit.",
  Spriggan:
    "Kin to gnomes, spriggans tend to be evil and can grow in size to resemble giants.",
  Sprite:
    "A family of diminutive winged fey with a strong connection to primal magic.",
  Staff:
    "This magic item holds spells of a particular theme and allows a spellcaster to cast additional spells by preparing the staff.",
  Stance:
    "A stance is a general combat strategy that you enter by using an action with the stance trait, and that you remain in for some time. A stance lasts until you get knocked out, until its requirements (if any) are violated, until the encounter ends, or until you enter a new stance, whichever comes first. After you use an action with the stance trait, you can't use another one for 1 round. You can enter or be in a stance only in encounter mode.",
  Steam:
    "Items with this trait are powered by engines that boil water to produce steam and move their components.",
  Stheno: "Stheno are humanoids related to medusas, with snakes for hair.",
  Strix: "Winged humanoids, most of whom live in and around Cheliax.",
  Structure:
    "A spell, item activation, or ability with the structure trait creates a magical building or other structure. The structure must be created on a plot of land free of other structures. The structure adapts to the natural terrain, adopting the structural requirements for being built there. The structure adjusts around small features such as ponds or spires of rock, but it can't be created on water or other nonsolid surfaces. If created on snow, sand dunes, or other soft surfaces with a solid surface underneath, the structure's foundation (if any) reaches the solid ground. If the structure is on a solid but unstable surface, such as a swamp or an area plagued by tremors, roll a @Check[flat|dc:3] each day; on a failure, the structure begins to sink or collapse.</p><p>The structure doesn't harm creatures within the area when it appears, and it can't be created within a crowd or in a densely populated area. Any creature inadvertently caught inside the structure when it's created ends up unharmed inside the complete structure and always has a clear path of escape. A creature inside the structure when the effect ends isn't harmed, and it lands harmlessly on the ground if it was on an upper level of the structure",
  SubjectiveGravity:
    "All bodies of mass can be centers of gravity with the same force, but only if a non-mindless creature wills it. Unattended items, objects, and mindless creatures treat the plane as having microgravity. Creatures on a plane with subjective gravity can move normally along a solid surface by imagining &quote;down&quote; near their feet. Designating this downward direction is a free action that has the concentration trait. If suspended in midair, a creature can replicate flight by choosing a &quote;down&quote; direction and falling in that direction, moving up to their Speed or fly Speed. This pseudo-flight uses the Fly action.",
  Subtle:
    "A spell with the subtle trait can be cast without incantations and doesn't have obvious manifestations.",
  Suli: "Sulis are planar scions descended from jann.",
  Surki:
    "Surkis are a subterranean insectile ancestry that absorb ambient magic and evolve unique adaptations.",
  Summon:
    "Spells with the summon trait can conjure creatures, typically ones with a particular trait. Such creatures can be found in Monster Core and similar books. Unless noted otherwise, the creature must be common, it gains the summoned trait, and it must appear in an unoccupied space in range large enough to contain it. The highest level of creature the spell can summon depends on the rank of the spell, as listed below. The spell can still summon a creature of a lower level if you so choose. These rules apply only to spells that have the summon trait; other spells that call or conjure items or beings but that don't have the trait, like summon instrument, work as explained in the spell.",
  Summoned:
    "A creature called by a spell or effect gains the summoned trait. A summoned creature can't summon other creatures, create things of value, or cast spells that require a cost. It has the minion trait. If it tries to Cast a Spell of equal or higher rank than the spell that summoned it, it overpowers the summoning magic, causing its own spell to fail and the summon spell to end. Otherwise, the summoned creature uses the standard abilities for a creature of its kind. It generally attacks your enemies to the best of its ability. If you can communicate with it, you can attempt to command it, but the GM determines the degree to which it follows your commands. Immediately when you finish Casting the Spell, the summoned creature uses its 2 actions for that turn. A spawn or other creature generated from a summoned creature returns to its unaltered state (usually a corpse in the case of spawn) once the summoned creature is gone. If it's unclear what this state would be, the GM decides. Summoned creatures can be banished by various spells and effects. They are automatically banished if reduced to 0 Hit Points or if the spell that called them ends.",
  Summoner: "This indicates abilities from the Summoner class.",
  Swashbuckler: "This indicates abilities from the Swashbuckler class.",
  Swarm:
    "A swarm is a mass or cloud of creatures that functions as one monster. Its size entry gives the size of the entire mass, though for most swarms the individual creatures that make up that mass are Tiny. A swarm can occupy the same space as other creatures and must do so in order to use its damaging action. A swarm typically has weakness to effects that deal damage over an area (like area spells and splash weapons). Swarms are immune to the grappled, prone, and restrained conditions.",
  Sweep:
    "This weapon makes wide sweeping or spinning attacks, making it easier to attack multiple enemies. When you attack with this weapon, you gain a +1 circumstance bonus to your attack roll if you already attempted to attack a different target this turn using this weapon.",
  Sylph: "A type of geniekin descended from a being from the Plane of Air.",
  Talisman:
    "A talisman is a small object affixed to armor, a shield, or a weapon (called the affixed item). You must be wielding or wearing an item to activate a talisman attached to it. Once activated, a talisman burns out permanently.",
  Talos: "Taloses are planar scions descended from zuhras.",
  Tandem:
    "Actions with this trait involve you and your eidolon acting in concert. You can't use a tandem action if either you or your eidolon can't act, if you haven't Manifested your Eidolon, or if you've Manifested your Eidolon in a way where it isn't a separate entity (such as with the Meld into Eidolon feat). Tandem actions often let both you and your eidolon take separate actions, but these must be actions taken separately by you and your eidolon; you can't use a tandem action to take another tandem action.",
  Tane: "The Tane are powerful creatures created eons ago by the Eldest of the First World. All of the Tane treat whatever plane they happen to be on as their home plane.",
  Tanggal:
    "This family of cannibalistic aberrations consists of various humanoid-shaped creatures that can separate their body into two pieces while hunting.",
  Tattoo:
    "A tattoo is a type of item that is drawn or cut into a creature's skin and usually takes the form of images or symbols.",
  Tea: "<p>Magic tea is a type of potion. It activates when you drink it, which uses it up. Magic tea has the potion and tea traits. When you craft a dose of magic tea, the raw materials you supply are in the form of unusual and costly tea leaves. The process of crafting magic tea includes infusing the leaves with magical reagents, purifying the water, and steeping the tea in the water, resulting in what's essentially a particularly delicious-tasting potion. You can activate magic tea with an Interact action as you drink it or feed it to another creature, as if it were a potion. You can also activate magic tea with a 10-minute activity that requires sterling tea ware (these artisan's tools can be shared by up to four people who take this activity simultaneously) to prepare the tea and then consume it or present it to someone during a short tea ceremony, after which the magic tea's effects begin; activating magic tea in this way enhances its effect, as detailed in each entry's Tea Ceremony.</p><p>Once you drink a dose of magic tea, you're temporarily immune to that particular type of magic tea for 24 hours.</p>",
  Tearing:
    "This weapon is edged with curved teeth that leave bleeding wounds. When you hit a creature with this weapon, it deals an additional 1 persistent bleed damage. This increases to 2 persistent bleed damage if the weapon has a greater striking rune.",
  Tech: "Items with the tech trait can be crafted by anyone, but if they also have the magical trait, they are hybrid items and require the Machine Magic feat to craft.",
  Telepathy:
    "A creature with telepathy can communicate mentally with creatures. This doesn't give any special access to their thoughts, and communicates no more information than normal speech would.",
  Teleportation:
    "Teleportation effects allow you to instantaneously move from one point in space to another. Teleportation does not usually trigger reactions based on movement.",
  Tengu:
    "A creature with this trait is a member of the tengu ancestry. Tengus are humanoids who resemble crows. An ability with this trait can be used or selected only by tengus. An item with this trait is created and used by tengus.",
  Tethered:
    "This weapon is attached to a length of rope or chain that allows you to retrieve it after it has left your hand. If you have a free hand (including if you've just thrown a two-handed tethered weapon and have a hand holding nothing but the weapon's tether), you can use an Interact action to pull the weapon back into your grasp after you have thrown it as a ranged attack or after it has been disarmed (unless it's being held by another creature).",
  Thaumaturge: "This indicates abilities from the thaumaturge class.",
  Thrown:
    "You can throw this weapon as a ranged attack. A thrown weapon adds your Strength modifier to damage just like a melee weapon does. When this trait appears on a melee weapon, it also includes the range increment.",
  Titan:
    "Titans are enormous, primordial creatures of neargodlike power who predate the mortal races.",
  Training:
    "A training weapon is designed to be used when training an animal to participate in combat by identifying the target for the animal to attack. Striking a creature with a training weapon gives your animal companion or your bonded animal a +1 circumstance bonus to its next attack roll against that target.",
  Transcendence:
    "Transcendence channels the might of an exemplar's divine spark through one of their ikons to surpass the mortal and enact a miraculous deed. Each ikon has an action with the transcendence trait, and using it is called Sparking Transcendence. To use the action, your divine spark must be empowering that ikon and you must have the ikon ready to use (typically holding a weapon ikon or wearing a worn ikon). Immediately after you Spark Transcendence, your divine spark is forcefully ejected from that ikon, coming to rest in another ikon of your choice. You can Spark Transcendence only once each round. As it comes from your divine spark, a transcendence action has the divine trait.",
  Trap: "A hazard or item with this trait is constructed to hinder interlopers.",
  Trip: "You can use this weapon to Trip with the Athletics skill even if you don't have a free hand. This uses the weapon's reach (if different from your own) and adds the weapon's item bonus to attack rolls as an item bonus to the Athletics check. If you critically fail a check to Trip using the weapon, you can drop the weapon to take the effects of a failure instead of a critical failure.",
  Troll:
    "Trolls are giant, brutish creatures and are well known for transforming into inanimate materials.",
  Troop:
    "A troop is an organized collection of component creatures, typically Small or Medium in size, working as a cohesive whole. Over the course of enough attacks and downed comrades, troops shrink in size. A troop typically has the troop defenses and troop movement abilities, and most troops have weaknesses to area damage and splash damage. Because they consist of multiple discrete creatures, they can't be summoned.",
  TrueName:
    "Certain spells, feats, and items have the true name trait. This trait means they require you to know a creature's true name to use them.",
  Twin: "These weapons are used as a pair, complementing each other. When you attack with a twin weapon, you add a circumstance bonus to the damage roll equal to the weapon's number of damage dice if you have previously attacked with a different weapon of the same type this turn. The weapons must be of the same type to benefit from this trait, but they don't need to have the same runes.",
  TwoHand:
    "This weapon can be wielded with two hands. Doing so changes its weapon damage die to the indicated value. This change applies to all the weapon's damage dice, such as those from striking runes.",
  Unarmed:
    "An unarmed attack uses your body rather than a manufactured weapon. An unarmed attack isn't a weapon, though it's categorized with weapons for weapon groups, and it might have weapon traits. Since it's part of your body, an unarmed attack can't be Disarmed. It also doesn't take up a hand, though a fist or other grasping appendage follows the same rules as a free-hand weapon.",
  Uncommon:
    "Something of uncommon rarity requires special training or comes from a particular culture or part of the world. Some character choices give access to uncommon options, and the GM can choose to allow access for anyone. Less is known about uncommon creatures than common creatures. They typically can't be summoned. The DC of Recall Knowledge checks related to these creature is increased by 2.",
  Undead:
    "Once living, these creatures were infused after death with void energy and soul-corrupting unholy magic. When reduced to 0 Hit Points, an undead creature is destroyed. Undead creatures are damaged by vitality energy and are healed by void energy, and don't benefit from healing vitality effects.",
  Undine: "A type of geniekin descended from a being from the Plane of Water.",
  Unholy:
    "Effects with the unholy trait are tied to powerful magical forces of cruelty and sin. They often have stronger effects on holy creatures. Creatures with this trait are strongly devoted to unholy causes, and often have weakness to holy. If a creature with weakness to unholy uses an unholy item or effect, it takes damage from its weakness.",
  Unique:
    "A rules element with this trait is one-of-a-kind. The DC of Recall Knowledge checks related to creatures with this trait is increased by 10.",
  Unstable:
    "Unstable actions rely on experimental functions of your innovation that even you can't fully predict. After an unstable action is used on an innovation, using another one is dangerous.",
  Urdefhan:
    "Urdefhans are humanoids who have pacts with daemons, have transparent skin, and drink blood.",
  Vampire:
    "Undead creatures who thirst for blood, vampires are notoriously versatile and hard to destroy.",
  Vanara:
    "An inquisitive ancestry with primate-like features and prehensile tails.",
  Vehicular:
    "A vehicular weapon is attached to a vehicle or worn by a mount and can typically only be wielded by the driver of the vehicle or the mount's primary rider. The driver or rider can control a vehicular weapon with the same hands they use to steer the vehicle or guide the mount. A vehicular weapon can be Disarmed by knocking the controls (typically reins for a mount or a steering device for a vehicle) out of the wielder's hands.",
  Velstrac:
    "A family of fiends from the Shadow Plane that are associated with pain and agony. All velstracs possess some form of disturbing gaze.",
  Venomous:
    "These weapons inject poison into every hit. When you hit a creature with this weapon, it deals an additional 1 persistent poison damage. This increases to 2 persistent poison damage if the weapon has a greater striking rune.",
  Versatile:
    "A versatile weapon can be used to deal a different type of damage than that listed in the Damage entry. This trait indicates the alternate damage type. For instance, a piercing weapon that is versatile S can be used to deal piercing or slashing damage. You choose the damage type each time you make an attack.",
  Vigilante:
    "Your class feats and vigilante feats are associated with your vigilante identity, and using them while in your social identity may risk exposing you as a vigilante. If your identity is exposed to the public, you lose the benefits of Vigilante Dedication to disguising yourself, but you can spend 1 week of downtime to create a new social identity.",
  Virulent:
    "Afflictions with the virulent trait are harder to remove. You must succeed at two consecutive saves to reduce a virulent affliction's stage by 1. A critical success reduces a virulent affliction's stage by only 1 instead of by 2.",
  Vishkanya: "An ancestry with snake-like features and powerful venom.",
  Visual:
    "A visual effect can affect only creatures that can see it. This applies only to visible parts of the effect, as determined by the GM.",
  Vitality:
    "Effects with this trait heal living creatures with energy from the Forge of Creation, deal vitality energy damage to undead, or manipulate vitality energy.",
  Void: "Effects with this trait heal undead creatures with void energy, deal void damage to living creatures, or manipulate void energy.",
  Volley:
    "This ranged weapon is less effective at close distances. Your attacks against targets that are at a distance within the range listed take a -2 penalty.",
  Wand: "A wand contains a single spell which you can cast once per day.",
  Wandering:
    "Wandering identifies animist feats attuned to particular types of apparitions. These feats require you to have attuned to an apparition who matches their prerequisites when you select them, and represent knowledge and ability pulled from that specific bond. When you make your daily preparations, you can retrain any wandering feat you know for any other wandering feat available at the level you took the exchanged feat (including lower-level wandering feats, as usual). You must meet all the new feat's other prerequisites.",
  Water:
    "Effects with the water trait either manipulate or conjure water. Those that manipulate water have no effect in an area without water. Creatures with this trait consist primarily of water or have a connection to magical water.",
  Wayang:
    "Small people native to the Netherworld. Immigrated to Golarion after Earthfall.",
  Werecreature:
    "These shapechanging creatures can shift between animal, humanoid, and hybrid forms.",
  Whetstone:
    "A whetstone is a magically enhanced consumable item designed to increase a weapon's effectiveness",
  Wight:
    "A wight is an undead creature that drains life and stands vigil over a burial site.",
  WildHunt:
    "Creatures with the wild hunt trait are never below 14th level. They possess greater darkvision, greensight, planar acclimation, wild gaze, instinctive cooperation, weakness to cold iron, the ability to speak with plants and animals, and their own specific wild hunt link.",
  Witch: "This indicates abilities from the witch class.",
  Wizard: "This indicates abilities from the wizard class.",
  Wraith:
    "A wraith is an incorporeal undead creature infused with void energy and driven by a hatred of all life.",
  Wood: "Effects with the wood trait conjure or manipulate wood. Those that manipulate wood have no effect in an area without wood. Creatures with this trait consist primarily of wood or have a connection to magical wood.",
  Wyrwood:
    "A wyrwood is a small, sapient living construct crafted of wood and powered with an aeon stone or a similar magical stone.",
  Xulgath:
    "These subterranean reptilian creatures tend to have darkvision and smell awful.",
  Zombie:
    "These undead are mindless rotting corpses that hunger for living flesh.",
};

function getIsTraitRarity(trait) {
  return (
    trait.toLowerCase().trim().startsWith("uncommon") ||
    trait.toLowerCase().trim().startsWith("common") ||
    trait.toLowerCase().trim().startsWith("rare") ||
    trait.toLowerCase().trim().startsWith("unique")
  );
}

// Helper function to convert PascalCase to readable format with spaces
function formatTraitName(name) {
  return name.replace(/([A-Z])/g, " $1").trim();
}

function getTraitToolTip(value) {
  // If no value is provided, return empty string
  if (!value) return "";

  // Format all trait names in the traitDescriptions object
  const formattedTraitDescriptions = {};
  for (const [key, value] of Object.entries(traitDescriptions)) {
    formattedTraitDescriptions[formatTraitName(key)] = value;
  }

  // Function to normalize a trait name by removing spaces and hyphens (to match camelCase keys)
  function normalizeTraitName(name) {
    return name.replace(/[\s\-]+/g, "");
  }

  // Function to find a trait that starts with the given value
  function findTraitStartingWith(value) {
    if (!value) return null;

    // Normalize the incoming value to remove spaces and hyphens
    const normalizedValue = normalizeTraitName(value);

    // Convert keys to an array and find a match
    const keys = Object.keys(traitDescriptions);
    return keys.find((key) => normalizedValue.startsWith(key));
  }

  // First, check if the exact value exists in the original trait descriptions
  if (traitDescriptions[value]) {
    return traitDescriptions[value];
  }

  // Try to find a trait that the value starts with (for cases like "Deadly d8" or "Two Hand d10")
  const matchingTrait = findTraitStartingWith(value);
  if (matchingTrait) {
    return traitDescriptions[matchingTrait];
  }

  // If no match is found in the original descriptions, check the formatted descriptions
  if (formattedTraitDescriptions[value]) {
    return formattedTraitDescriptions[value];
  }

  // If still no match, return the value itself
  return value;
}

// Function to get all traits as options for dropdown
function getTraitOptions() {
  // Get all trait keys from traitDescriptions
  const traitKeys = Object.keys(traitDescriptions);

  // Format options similar to getLocations function
  return [
    ...traitKeys.map((trait) => ({
      value: trait,
      label: formatTraitName(trait),
    })),
  ];
}

// Function to get all languages as options for dropdown
function getLanguageOptions() {
  return [
    // Common Languages
    { value: "Taldane", label: "Taldane (Common)" },
    { value: "Razatlani", label: "Razatlani (Common)" },
    { value: "Sakvroth", label: "Sakvroth (Common)" },
    { value: "Fey", label: "Fey (Common)" },
    { value: "Common", label: "Common (Common)" },
    { value: "Draconic", label: "Draconic (Common)" },
    { value: "Dwarven", label: "Dwarven (Common)" },
    { value: "Elven", label: "Elven (Common)" },
    { value: "Gnomish", label: "Gnomish (Common)" },
    { value: "Goblin", label: "Goblin (Common)" },
    { value: "Halfling", label: "Halfling (Common)" },
    { value: "Jotun", label: "Jotun (Common)" },
    { value: "Orcish", label: "Orcish (Common)" },
    { value: "Tanuki", label: "Tanuki (Common)" },
    { value: "Wayang", label: "Wayang (Common)" },
    { value: "Yaksha", label: "Yaksha (Common)" },
    { value: "Iblydosi", label: "Iblydosi (Common)" },

    // Uncommon Languages
    { value: "Alghollthu", label: "Alghollthu (Uncommon)" },
    { value: "Amurrun", label: "Amurrun (Uncommon)" },
    { value: "Arboreal", label: "Arboreal (Uncommon)" },
    { value: "Boggard", label: "Boggard (Uncommon)" },
    { value: "Caligni", label: "Caligni (Uncommon)" },
    { value: "Cyclops", label: "Cyclops (Uncommon)" },
    { value: "Daemonic", label: "Daemonic (Uncommon)" },
    { value: "Iruxi", label: "Iruxi (Uncommon)" },
    { value: "Protean", label: "Protean (Uncommon)" },
    { value: "Requian", label: "Requian (Uncommon)" },
    { value: "Sphinx", label: "Sphinx (Uncommon)" },
    { value: "Utopian", label: "Utopian (Uncommon)" },
    { value: "Anadi", label: "Anadi (Uncommon)" },
    { value: "Tengu", label: "Tengu (Uncommon)" },
    { value: "Azlanti", label: "Azlanti (Uncommon)" },
    { value: "Strix", label: "Strix (Uncommon)" },
    { value: "Thassilonian", label: "Thassilonian (Uncommon)" },
    { value: "Garundi", label: "Garundi (Uncommon)" },
    { value: "Erutaki", label: "Erutaki (Uncommon)" },
    { value: "Varki", label: "Varki (Uncommon)" },
    { value: "Shoony", label: "Shoony (Uncommon)" },
    { value: "Destrachan", label: "Destrachan (Uncommon)" },
    { value: "D'ziriak", label: "D'ziriak (Uncommon)" },
    { value: "Jistkan", label: "Jistkan (Uncommon)" },
    { value: "Jyoti", label: "Jyoti (Uncommon)" },
    { value: "Ysoki", label: "Ysoki (Uncommon)" },
    { value: "Adlet", label: "Adlet (Uncommon)" },
    { value: "Girtablilu", label: "Girtablilu (Uncommon)" },
    { value: "Calda", label: "Calda (Uncommon)" },
    { value: "Ekujae", label: "Ekujae (Uncommon)" },
    { value: "Kibwani", label: "Kibwani (Uncommon)" },
    { value: "Lirgeni", label: "Lirgeni (Uncommon)" },
    { value: "Mzunu", label: "Mzunu (Uncommon)" },
    { value: "Ocotan", label: "Ocotan (Uncommon)" },
    { value: "Xanmba", label: "Xanmba (Uncommon)" },
    { value: "Anugobu", label: "Anugobu (Uncommon)" },
    { value: "Kitsune", label: "Kitsune (Uncommon)" },
    { value: "Nagaji", label: "Nagaji (Uncommon)" },
    { value: "Muan", label: "Muan (Uncommon)" },
    { value: "Petran", label: "Petran (Uncommon)" },
    { value: "Pyric", label: "Pyric (Uncommon)" },
    { value: "Sussuran", label: "Sussuran (Uncommon)" },
    { value: "Talican", label: "Talican (Uncommon)" },
    { value: "Thalassic", label: "Thalassic (Uncommon)" },
    { value: "Chthonian", label: "Chthonian (Uncommon)" },
    { value: "Empyrean", label: "Empyrean (Uncommon)" },
    { value: "Diabolic", label: "Diabolic (Uncommon)" },
    { value: "Minkaian", label: "Minkaian (Uncommon)" },
    { value: "Kholo", label: "Kholo (Uncommon)" },
    { value: "Aklo", label: "Aklo (Uncommon)" },
    { value: "Necril", label: "Necril (Uncommon)" },
    { value: "Shadowtongue", label: "Shadowtongue (Uncommon)" },
    { value: "Hallit", label: "Hallit (Uncommon)" },
    { value: "Kelish", label: "Kelish (Uncommon)" },
    { value: "Mwangi", label: "Mwangi (Uncommon)" },
    { value: "Osiriani", label: "Osiriani (Uncommon)" },
    { value: "Shoanti", label: "Shoanti (Uncommon)" },
    { value: "Skald", label: "Skald (Uncommon)" },
    { value: "Tien", label: "Tien (Uncommon)" },
    { value: "Varisian", label: "Varisian (Uncommon)" },
    { value: "Vudrani", label: "Vudrani (Uncommon)" },
    { value: "Tripkee", label: "Tripkee (Uncommon)" },

    // Rare Languages
    { value: "Androffan", label: "Androffan (Rare)" },
    { value: "Grioth", label: "Grioth (Rare)" },
    { value: "Kovintal", label: "Kovintal (Rare)" },
    { value: "Mi-Go", label: "Mi-Go (Rare)" },
    { value: "Munavri", label: "Munavri (Rare)" },
    { value: "Samsaran", label: "Samsaran (Rare)" },
    { value: "Sasquatch", label: "Sasquatch (Rare)" },
    { value: "Shae", label: "Shae (Rare)" },
    { value: "Vanara", label: "Vanara (Rare)" },
    { value: "Vishkanyan", label: "Vishkanyan (Rare)" },
    { value: "Yithian", label: "Yithian (Rare)" },
    { value: "Rasu", label: "Rasu (Rare)" },
    { value: "Goloma", label: "Goloma (Rare)" },
    { value: "Shisk", label: "Shisk (Rare)" },
    { value: "Arcadian", label: "Arcadian (Rare)" },
    { value: "Wyrwood", label: "Wyrwood (Rare)" },
    { value: "Minatan", label: "Minatan (Rare)" },
    { value: "Wayang", label: "Wayang (Rare)" },
    { value: "Senzar", label: "Senzar (Rare)" },
    { value: "Jistka", label: "Jistka (Rare)" },
    { value: "Akitonian", label: "Akitonian (Rare)" },
    { value: "Formian", label: "Formian (Rare)" },
    { value: "Ikeshti", label: "Ikeshti (Rare)" },
    { value: "Shobhad", label: "Shobhad (Rare)" },
    { value: "Hwan", label: "Hwan (Rare)" },
    { value: "Okaiyan", label: "Okaiyan (Rare)" },
    { value: "Drooni", label: "Drooni (Rare)" },
    { value: "Ancient Osiriani", label: "Ancient Osiriani (Rare)" },
    { value: "Kashrishi", label: "Kashrishi (Rare)" },
    { value: "Vishkanya", label: "Vishkanya (Rare)" },
    { value: "Ratajin", label: "Ratajin (Rare)" },
    { value: "Elder Thing", label: "Elder Thing (Rare)" },
    { value: "Orvian", label: "Orvian (Rare)" },
    { value: "Surki", label: "Surki (Rare)" },
    { value: "Lashunta", label: "Lashunta (Rare)" },

    // Secret Languages
    { value: "Wildsong", label: "Wildsong (Secret)" },
  ];
}

/**
 * Gets the critical specialization effect details for a weapon group.
 *
 * @param {string} weaponGroup - The weapon group name
 * @returns {Object} - Object containing description, group name, and macros array
 */
function getCriticalSpecializationDetails(weaponGroup) {
  const group = (weaponGroup || "").toLowerCase();

  const specializations = {
    axe: "Choose one creature adjacent to the initial target and within reach. If its AC is lower than your attack roll result for the critical hit, you deal damage to that creature equal to the result of the weapon damage die you rolled (including extra dice for its striking rune, if any). This amount isn't doubled, and no bonuses or other additional dice apply to this damage.",

    bomb: "Increase the radius of the bomb's splash damage (if any) to 10 feet.",

    bow: "If the target of the critical hit is adjacent to a surface, it gets stuck to that surface by the missile. The target is immobilized and must spend an Interact action to attempt a DC 10 Athletics check to pull the missile free; it can't move from its space until it succeeds. The creature doesn't become stuck if it is incorporeal, is liquid (like a water elemental or some oozes), or could otherwise escape without effort.",

    brawling:
      "The target must succeed at a Fortitude save against your class DC or be slowed 1 until the end of your next turn.",

    club: "You knock the target away from you up to 10 feet (you choose the distance). This is forced movement.",

    crossbow:
      "The target takes 1d8 persistent bleed damage. You gain an item bonus to this bleed damage equal to the weapon's item bonus to attack rolls.",

    dart: "The target takes 1d6 persistent bleed damage. You gain an item bonus to this bleed damage equal to the weapon's item bonus to attack rolls.",

    firearm:
      "The target must succeed at a Fortitude save against your class DC or be stunned 1.",

    flail:
      "The target is knocked prone unless they succeed at a Reflex save against your class DC.",

    hammer:
      "The target is knocked prone unless they succeed at a Fortitude save against your class DC.",

    knife:
      "The target takes 1d6 persistent bleed damage. You gain an item bonus to this bleed damage equal to the weapon's item bonus to attack rolls.",

    pick: "The weapon viciously pierces the target, who takes 2 additional damage per weapon damage die.",

    polearm:
      "The target is moved 5 feet in a direction of your choice. This is forced movement.",

    shield:
      "You knock the target back from you 5 feet. This is forced movement.",

    sling:
      "The target must succeed at a Fortitude save against your class DC or be stunned 1.",

    spear:
      "The weapon pierces the target, weakening its attacks. The target is clumsy 1 until the start of your next turn.",

    sword:
      "The target is made off-balance by your attack, becoming off-guard until the start of your next turn.",
  };

  const description = specializations[group] || "";

  return {
    description: description,
    group: group,
    // Its buttons come from getCriticalSpecializationButtons
    // (critical-specialization.js), which needs the attack's metadata
    macros: [],
  };
}

function getWeaponRuneDetails(runeName) {
  const rune = getPropertyRuneKey(runeName);

  const runeData = {
    ancestralechoing: {
      displayName: "Ancestral Echoing",
      description:
        "The wisdom of this weapon's past owners flows into your mind, amplifying your own abilities with the weapon. Your proficiency rank with this weapon is one step higher than normal, to a maximum of the highest proficiency rank you have in any weapon. For instance, if you had master proficieny with martial weapons and expert proficiency with advanced weapons, you would have master proficiency with advanced weapon that had this rune.\n\nIn addition, while wielding the ancestral echoing weapon, you have expert proficiency in one Lore skill relevant to one or more of the weapon's previous owners. This is typically Dwarven Lore but is ultimately determined by the GM depending on the weapon's history.",
      macros: [],
      modifiers: [],
    },
    anchoring: {
      displayName: "Anchoring",
      description:
        "This rune prevents enemies from escaping your grasp by fleeing to other planes. If you critically hit a target with an anchoring weapon, the weapon casts dimensional anchor on the target (DC 27, counteract modifier +17).",
      macros: [],
      modifiers: [],
    },
    animated: {
      displayName: "Animated",
      description:
        "An animated weapon flies autonomously and strikes your foes.\n\nActivate—Set Free [two-actions] (concentrate, manipulate); Effect You Release the weapon and it flutters through the air, fighting on its own against the last enemy you attacked, or the nearest enemy to it if your target has been defeated. At the end of your turn each round, the weapon can Fly up to its fly Speed of 40 feet, and then can either Fly again or Strike one creature within its reach.\nThe weapon has a space of 5 feet, but it doesn't block or impede enemies attempting to move though that space, nor does it benefit from or provide flanking. The weapon can't move through an enemy's space. The weapon can't use reactions, and its Fly actions don't trigger reactions.\nWhile it's activated, an animated weapon makes Strikes with an attack modifier of +24 plus its item bonus to attack rolls. It uses the weapon's normal damage but has a +0 Strength modifier. The weapon's abilities that automatically trigger on a hit or critical hit still function, but the weapon can't be activated or benefit from any of your abilities while animated.\nEach round, when the weapon finishes using its actions, attempt a DC 6 flat check. On a failure, the activation ends. The weapon falls to the ground and can't be Set Free again for 10 minutes.",
      macros: [],
      modifiers: [],
    },
    ashen: {
      displayName: "Ashen",
      description:
        "In his attempts to recreate the initial feeling of the object he encountered ages ago, the Ash Engineer discovered a different effect, one that would confound his enemies. Ashen weapons are typically coated in a thin layer of ash that gradually returns over the span of a day, even after wiping away. A creature hit by an attack from an ashen weapon becomes surrounded by burning ash, which deals 1d4 persistent fire damage. This ash clouds the senses, causing the creature to become confused for 1 round unless it succeeds at a DC 25 Will save.",
      macros: [],
      modifiers: [],
    },
    astral: {
      displayName: "Astral",
      description:
        "Astral weapons command powerful spiritual energy from the Astral Plane. This rune has the same effects as a ghost touch rune, plus Strikes with it deal an extra 1d6 spirit damage. If used to attack a creature that's possessing another creature, this weapon deals no damage to the possessed creature. On a critical hit against a creature possessing another creature, the possessing creature must succeed at a DC 26 Will save or be expelled and unable to possess a creature for 1d4 rounds.",
      macros: [],
      modifiers: [],
    },
    authorized: {
      displayName: "Authorized",
      description:
        "Sharp needles impale anyone who attempts to wield this weapon other than its rightful owner. Each authorized rune is etched with the blood of a specific creature. If any other creature wields the weapon, needles immediately erupt from the weapon's hilt or shaft, dealing 1d8 piercing damage plus 1d4 persistent bleed damage to the wielder. If the weapon has a striking rune, this damage increases to 1d8 per damage die and 1d4 persistent damage per damage die; this counts only the weapon's base die and dice from the striking rune. The persistent bleed damage can't end while the creature still holds the weapon. The spikes retract once the creature lets go.\n\nWhen the rune is crafted, the crafter can choose to broaden the criteria for who can safely wield the item, expanding the users to creatures with a particular bloodline, patron deity, or sanctification, as the crafter chooses. This criterion must be shared by the creature who contributed the blood for the rune.",
      macros: [],
      modifiers: [],
    },
    bane: {
      displayName: "Bane",
      description:
        "A bane rune causes a weapon to grant you improved understanding of creatures of a particular type, allowing you to deal more damage to those creatures. The crafter chooses aberration, animal, beast, celestial, construct, dragon, elemental, fey, fiend, giant, monitor, ooze, or both fungus and plant. The weapon deals 1d6 additional damage of the weapon's damage type to creatures with the chosen trait or traits. The benefit doesn't apply against creatures of the chosen type disguised as other creatures. It's up to GM discretion whether the bane rune applies against a creature disguised as a creature of the chosen type.\n\nThe GM might allow bane runes for other creature traits, such as astral, dream, or demon. However, humanoids, undead, and specific types of humanoids (such as elves) are never a valid option.",
      macros: [],
      modifiers: [],
    },
    bloodbane: {
      displayName: "Bloodbane",
      description:
        "A bloodbane clan dagger is especially vicious against the ancestral enemies of the clan. When you damage an appropriate type of creature with the weapon, that creature takes 1 persistent bleed damage. The type of creature depends on the clan that made the dagger, but is typically drow, duergar, giant, or orc.\n\nIn addition, whenever you inflict persistent bleed damage with a bloodbane weapon (whether from its innate ability or in some other way), the weapon leaves ragged wounds. The bleeding creature must succeed at a DC 25 Fortitude save or become sickened 1. The creature is then temporarily immune for 1 hour.",
      macros: [],
      modifiers: [],
    },
    bloodthirsty: {
      displayName: "Bloodthirsty",
      description:
        "The magic in this rune sings in time with your attacks and coaxes you into finishing your opponent. When you critically hit a target that's taking persistent bleed damage, your target becomes drained 1.\n\nActivate [reaction] envision; Trigger You reduce a creature to 0 Hit Points with the weapon; Effect You gain a number of temporary Hit Points equal to twice the creature's level. These Hit Points remain for 1 minute.",
      macros: [],
      modifiers: [],
    },
    bolkasblessing: {
      displayName: "Bolkas Blessing",
      description:
        "This filigree grants you a +1 item bonus to Diplomacy checks and to Perception checks to Sense Motive. Additionally, once per day, the filigree symbol can be activated for a healing effect.\n\nActivate—Gift of Life [one-action] (concentrate, healing, vitality); Frequency once per day; Effect You regain 3d10 Hit Points.",
      macros: [],
      modifiers: [],
    },
    brilliant: {
      displayName: "Brilliant",
      description:
        "This rune causes a weapon to transform into pure, brilliant energy. The weapon deals an additional 1d4 fire damage on a successful Strike, as well as 1d4 spirit damage to fiends and 1d4 vitality damage to undead. On a critical hit, the target must succeed at a DC 29 Fortitude save or be blinded for 1 round.\n\nActivate—Shine Bright [one-action] (concentrate, light); Effect You plunge your weapon into darkness to return the light. Attempt a counteract check with a counteract rank of 5 and a +19 counteract modifier to end a magical darkness effect whose area is within reach of the weapon.",
      macros: [],
      modifiers: [],
    },
    called: {
      displayName: "Called",
      description:
        "With this rune, you can instantly retrieve an item in your possession without digging around looking for it.\n\nActivate [one-action] command; Frequency once per hour; Requirements You have a free hand and the called item is in a bag, pack, pouch, or other container on your person, or unattended within 30 feet; Effect The item teleports to a free hand.",
      macros: [],
      modifiers: [],
    },
    coating: {
      displayName: "Coating",
      description:
        "When etched, this rune creates an extradimensional space that links to the weapon that wields it. The space can hold up to 1 Bulk but can contain only poisons and magic oils that could be applied to the weapon. Stowing or retrieving an item in the space requires an Interact action, except when using the rune's activation.\n\nActivate [one-action] (concentrate); Requirements At least one magic oil or poison is stored inside the rune's extradimensional space; Effect For 1 minute, you can apply stored oils and poisons to the weapon without needing any hands free. Applying them takes the same number of actions as normal. An oil or poison applied this way pours directly from the extradimensional space onto the weapon, and when it's fully applied, its empty vial is ejected.",
      macros: [],
      modifiers: [],
    },
    conducting: {
      displayName: "Conducting",
      description:
        "A conducting weapon can channel energy through it. The weapon gains the resonant weapon trait, except that when you Conduct Energy, the weapon deals an additional 1d8 damage of the selected type instead of 1 additional damage per die; if the weapon already had the resonant weapon trait, it deals 1d8 damage plus 1 damage per die instead. On a critical hit, the weapon deals 1d8 persistent damage of the same type.",
      macros: [],
      modifiers: [],
    },
    corrosive: {
      displayName: "Corrosive",
      description:
        "Acid sizzles across the surface of the weapon etched with this rune. When you hit with the weapon, add 1d6 acid damage to the damage dealt. In addition, on a critical hit, the target's armor (if any) takes 3d6 acid damage (before applying Hardness); if the target has a shield raised, the shield takes this damage instead.",
      macros: [],
      modifiers: [],
    },
    crushing: {
      displayName: "Crushing",
      description:
        "Weapons with this rune empower your strength, and attacks with these weapons leave your foe staggered. When you critically hit a target with this weapon, your target becomes clumsy 1 and enfeebled 1 until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    cunning: {
      displayName: "Cunning",
      description:
        "The weapon performs divination magic on the blood of your foes, granting you insight into their abilities and weaknesses.\n\nActivate [free-action] envision; Frequency once per minute; Requirements On your previous action this turn, you used this weapon to hit and damage a creature that has blood or other vital fluids; Effect You learn the secrets the weapon gleaned from the creature's blood. Attempt to Recall Knowledge about the target of the required attack, gaining an item bonus to the Recall Knowledge skill check equal to the weapon's item bonus to attack rolls from its potency rune. If the required attack was a critical hit, you also gain a +2 circumstance bonus to this check.",
      macros: [],
      modifiers: [],
    },
    decaying: {
      displayName: "Decaying",
      description:
        "Eerie waves of purplish energy dance across the surface of a weapon etched with this rune. When you hit with the weapon, add 1d4 void damage to the damage dealt. In addition, on a critical hit, the target takes 2d4 persistent void damage; if the target has a shield raised, the shield takes the same amount of persistent damage (its wielder rolls the flat check to see if the persistent damage ends, or the GM rolls if the shield is no longer in someone's possession). Unlike normal void damage, the void damage from a decaying rune damages objects, constructs, and the like by eroding them away.",
      macros: [],
      modifiers: [],
    },
    deathdrinking: {
      displayName: "Deathdrinking",
      description:
        "A weapon etched with a deathdrinking rune shimmers with dark purple energy. When held by a living creature, the weapon causes twinges of hunger to manifest.\n\nWhile holding a deathdrinking weapon, you gain a +1 item bonus to saving throws against negative damage and death effects. When you critically hit a creature with a deathdrinking weapon, you inflict an additional 1d6 points of positive or negative damage to the creature— whichever type of damage would harm the creature. You also gain the following reaction when wielding a deathdrinking weapon.\n\nActivate [reaction] envision; Frequency once per day; Trigger you kill or destroy a creature with the deathdrinking weapon; Effect If the creature you killed was living, you gain a +1 item bonus to attack and damage rolls for 10 minutes. If the creature you destroyed was undead, you gain a number of temporary HP equal to twice your level for 10 minutes.",
      macros: [],
      modifiers: [],
    },
    demolishing: {
      displayName: "Demolishing",
      description:
        "A demolishing weapon is made to destroy constructs. Damage inflicted on a construct with a demolishing weapon continues to spread throughout the creature—cracks form, linkages fail, surfaces erode—and otherwise dismantle its body. When you damage a construct using a demolishing weapon, you deal an extra 1d6 persistent force damage. On a critical hit, you deal an extra 1d12 persistent force damage instead.",
      macros: [],
      modifiers: [],
    },
    vitalizing: {
      displayName: "Vitalizing",
      description:
        "A vitalizing weapon pulses with vital energy, dealing an extra 1d6 persistent vitality damage to undead. On a critical hit, the undead is also enfeebled 1 until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    earthbinding: {
      displayName: "Earthbinding",
      description:
        "A weapon with this rune hums when touched to the ground.\n\nActivate [reaction] (concentrate); Frequency once per hour; Requirements You critically hit a flying creature with the etched weapon; Effect The rune casts a DC 20 earthbind spell on the flying creature.",
      macros: [],
      modifiers: [],
    },
    energizing: {
      displayName: "Energizing",
      description:
        "A weapon with this rune can absorb energy damage to empower it.\n\nActivate [reaction] concentrate; Trigger You take acid, cold, electricity, fire, or sonic damage; Effect The weapon becomes imbued with the triggering energy type. It deals an additional 1d8 damage of the triggering type until the end of your next turn. As normal, if you use this reaction again during the duration, the damage doesn't combine; instead, change the 1d8 damage to the new triggering type of damage and change the duration to the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    extending: {
      displayName: "Extending",
      description:
        "An extending rune allows you to extend your weapon to impossible lengths.\n\nActivate—Extend [two-actions] (manipulate); Effect You extend your weapon, giving you an impossible reach. You Strike with the weapon, and you have reach 60 feet for the Strike.",
      macros: [],
      modifiers: [],
    },
    fanged: {
      displayName: "Fanged",
      description:
        "When etched with this rune, a weapon's hilt or haft becomes engraved with grooves that match the imprints of a wolf's teeth. By putting a fanged weapon in your mouth, you can transform into an animal.\n\nActivate [one-action] Interact (magical, polymorph, transmutation); Effect You transform into a Small or Medium animal that wields the fanged weapon in its jaws; the animal matches the animal you are most closely associated with (a lizardfolk would turn into a lizard, a kitsune into a fox, a deer instinct barbarian into a deer, etc.) or a wolf if no specific animal is applicable. While in this form, you can attack with the fanged weapon even though you don't have any hands. However, you can attack only with the fanged weapon and you don't have hands or the ability to hold items. For effects dependent on how many hands you are using to hold the item, such as the two-hand trait, you are holding the weapon in two hands. You can Dismiss this effect, and it ends automatically if you drop the fanged weapon (whether or not of your own volition).",
      macros: [],
      modifiers: [],
    },
    fearsome: {
      displayName: "Fearsome",
      description:
        "When you critically hit with this weapon, the target becomes frightened 1.",
      macros: [],
      modifiers: [],
    },
    flaming: {
      displayName: "Flaming",
      description:
        "A weapon with this rune is empowered by flickering flame. The weapon deals an additional 1d6 fire damage on a successful Strike, plus 1d10 persistent fire damage on a critical hit.",
      macros: [],
      modifiers: [],
    },
    flickering: {
      displayName: "Flickering",
      description:
        "A flickering rune causes a weapon to shimmer, grow blurry and indistinct, and momentarily turn invisible at random intervals for a second or two. A flickering weapon adds its item bonus from its potency rune to the DC against attempts to Disarm or Steal it. On a critical hit, the weapon flashes bright pulses of color into the creature's eyes, dazzling the creature for 1 round (this effect has the visual trait).\n\nActivate [two-actions] envision, command; Frequency once per day; Effect The flickering weapon casts blur to your specification.",
      macros: [],
      modifiers: [],
    },
    flurrying: {
      displayName: "Flurrying",
      description:
        "When you make a Flurry of Blows using the etched weapon and your first Strike reduces a creature to 0 Hit Points, you can make your second Strike with an echo of the weapon, increasing the reach to 30 feet.\n\nActivate [two-actions] (concentrate, force); Frequency once per day; Effect The weapon casts a spiritual weapon spell. The ghostly weapon looks like the etched weapon. Use your normal attack bonus and damage for the weapon instead of the damage listed in the spell, but use your Wisdom modifier instead of Strength when determining damage. You can choose to make a Flurry of Blows instead of a Strike when the spiritual weapon attacks; this still counts as your flourish for the turn. You can Sustain this activation in the same manner as the spell.",
      macros: [],
      modifiers: [],
    },
    frost: {
      displayName: "Frost",
      description:
        "This weapon is empowered with freezing ice. It deals an additional 1d6 cold damage on a successful Strike. On a critical hit, the target is also slowed 1 until the end of your next turn unless it succeeds at a DC 24 Fortitude save.",
      macros: [],
      modifiers: [],
    },
    ghosttouch: {
      displayName: "Ghost Touch",
      description:
        "A weapon etched with this rune can harm creatures without physical form. A ghost touch weapon is particularly effective against incorporeal creatures, which almost always have a specific vulnerability to ghost touch weapons. Incorporeal creatures can touch, hold, and wield ghost touch weapons (unlike most physical objects).",
      macros: [],
      modifiers: [],
    },
    giantkilling: {
      displayName: "Giant Killing",
      description:
        "This weapon features stylized etchings of giants. A giant-killing weapon deals an additional 1d6 mental damage on a successful Strike against a giant. On a critical hit, the giant is also enfeebled 1 until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    greateranchoring: {
      displayName: "Greater Anchoring",
      description:
        "This rune prevents enemies from escaping your grasp by fleeing to other planes. If you critically hit a target with an anchoring weapon, the weapon casts dimensional anchor on the target (DC 27, counteract modifier +17).\n\nWhen you critically hit a target with a weapon with the anchoring rune, the weapon casts 8th-level dimensional anchor on the target (DC 38, counteract modifier +28), except that if the target critically succeeds at its Will save, instead of having no effect, the dimensional anchor lasts for 1 round. When you hit a target with the weapon but don't critically hit, the target is affected by 4th-level dimensional anchor for 1 round without a save (this still uses a counteract modifier of +28).",
      macros: [],
      modifiers: [],
    },
    greaterashen: {
      displayName: "Greater Ashen",
      description:
        "In his attempts to recreate the initial feeling of the object he encountered ages ago, the Ash Engineer discovered a different effect, one that would confound his enemies. Ashen weapons are typically coated in a thin layer of ash that gradually returns over the span of a day, even after wiping away. A creature hit by an attack from an ashen weapon becomes surrounded by burning ash, which deals 1d8 persistent fire damage. This ash clouds the senses, causing the creature to become confused for 1 minute unless it succeeds at a DC 35 Will save.",
      macros: [],
      modifiers: [],
    },
    greaterastral: {
      displayName: "Greater Astral",
      description:
        "Astral weapons command powerful spiritual energy from the Astral Plane. This rune has the same effects as a ghost touch rune, plus Strikes with it deal an extra 1d6 spirit damage. If used to attack a creature that's possessing another creature, this weapon deals no damage to the possessed creature. On a critical hit against a creature possessing another creature, the possessing creature must succeed at a DC 36 Will save or be expelled and unable to possess a creature for 1d4 rounds. Spirit damage dealt by this weapon ignores the target's spirit resistance.",
      macros: [],
      modifiers: [],
    },
    greaterbloodbane: {
      displayName: "Greater Bloodbane",
      description:
        "A bloodbane clan dagger is especially vicious against the ancestral enemies of the clan. When you damage an appropriate type of creature with the weapon, that creature takes 1 persistent bleed damage. The type of creature depends on the clan that made the dagger, but is typically drow, duergar, giant, or orc.\n\nIn addition, whenever you inflict persistent bleed damage with a bloodbane weapon (whether from its innate ability or in some other way), the weapon leaves ragged wounds. The bleeding creature must succeed at a DC 30 Fortitude save or become sickened 1. The creature is then temporarily immune for 1 hour. The weapon deals 1d4 bleed damage to creatures designated as the clan's enemy.",
      macros: [],
      modifiers: [],
    },
    greaterbolkasblessing: {
      displayName: "Greater Bolkas Blessing",
      description:
        "This filigree grants you a +2 item bonus to Diplomacy checks and to Perception checks to Sense Motive. Additionally, once per day, the filigree symbol can be activated for a healing effect.\n\nActivate—Gift of Life [one-action] (concentrate, healing, vitality); Frequency once per day; Effect You regain 6d10 Hit Points.",
      macros: [],
      modifiers: [],
    },
    greaterbrilliant: {
      displayName: "Greater Brilliant",
      description:
        "This rune causes a weapon to transform into pure, brilliant energy. The weapon deals an additional 1d4 fire damage on a successful Strike, as well as 1d4 spirit damage to fiends and 1d4 vitality damage to undead. On a critical hit, the target must succeed at a DC 41 Fortitude save or be blinded for 1 round.\n\nActivate—Shine Bright [one-action] (concentrate, light); Effect You plunge your weapon into darkness to return the light. Attempt a counteract check with a counteract rank of 9 and a +31 counteract modifier to end a magical darkness effect whose area is within reach of the weapon. Damage dealt by this weapon ignores the target's resistances to fire, spirit, and vitality.",
      macros: [],
      modifiers: [],
    },
    greatercorrosive: {
      displayName: "Greater Corrosive",
      description:
        "Acid sizzles across the surface of the weapon etched with this rune. When you hit with the weapon, add 1d6 acid damage to the damage dealt. In addition, on a critical hit, the target's armor (if any) takes 6d6 acid damage (before applying Hardness); if the target has a shield raised, the shield takes this damage instead. The acid damage dealt by this weapon ignores the target's acid resistance.",
      macros: [],
      modifiers: [],
    },
    greatercrushing: {
      displayName: "Greater Crushing",
      description:
        "Weapons with this rune empower your strength, and attacks with these weapons leave your foe staggered. When you critically hit a target with this weapon, your target becomes clumsy 2 and enfeebled 2 until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    greaterdecaying: {
      displayName: "Greater Decaying",
      description:
        "Eerie waves of purplish energy dance across the surface of a weapon etched with this rune. When you hit with the weapon, add 1d4 void damage to the damage dealt. In addition, on a critical hit, the target takes 4d4 persistent void damage; if the target has a shield raised, the shield takes the same amount of persistent damage (its wielder rolls the flat check to see if the persistent damage ends, or the GM rolls if the shield is no longer in someone's possession). Unlike normal void damage, the void damage from a decaying rune damages objects, constructs, and the like by eroding them away. The void damage dealt by this weapon ignores the target's void resistance or immunity.",
      macros: [],
      modifiers: [],
    },
    greatervitalizing: {
      displayName: "Greater Vitalizing",
      description:
        "A vitalizing weapon pulses with vital energy, dealing an extra 2d6 persistent vitality damage to undead. On a critical hit, the undead creature is enfeebled 1 and stupefied 1 as long as it has the persistent damage from this rune.",
      macros: [],
      modifiers: [],
    },
    greaterextending: {
      displayName: "Greater Extending",
      description:
        "An extending rune allows you to extend your weapon to impossible lengths.\n\nActivate—Extend [two-actions] (manipulate); Effect You extend your weapon, giving you an impossible reach. You Strike with the weapon, and you have reach 120 feet for the Strike.",
      macros: [],
      modifiers: [],
    },
    greaterfanged: {
      displayName: "Greater Fanged",
      description:
        "When etched with this rune, a weapon's hilt or haft becomes engraved with grooves that match the imprints of a wolf's teeth. By putting a fanged weapon in your mouth, you can transform into an animal.\n\nActivate [one-action] Interact (magical, polymorph, transmutation); Effect You transform into a Small or Medium animal that wields the fanged weapon in its jaws; the animal matches the animal you are most closely associated with (a lizardfolk would turn into a lizard, a kitsune into a fox, a deer instinct barbarian into a deer, etc.) or a wolf if no specific animal is applicable. While in this form, you can attack with the fanged weapon even though you don't have any hands. However, you can attack only with the fanged weapon and you don't have hands or the ability to hold items. For effects dependent on how many hands you are using to hold the item, such as the two-hand trait, you are holding the weapon in two hands. You can Dismiss this effect, and it ends automatically if you drop the fanged weapon (whether or not of your own volition). In animal form, you gain low-light vision and a +5-foot item bonus to your Speed.",
      macros: [],
      modifiers: [],
    },
    greaterfearsome: {
      displayName: "Greater Fearsome",
      description:
        "When you critically hit with this weapon, the target becomes frightened 2.",
      macros: [],
      modifiers: [],
    },
    greaterflaming: {
      displayName: "Greater Flaming",
      description:
        "A weapon with this rune is empowered by flickering flame. The weapon deals an additional 1d6 fire damage on a successful Strike, plus 2d10 persistent fire damage on a critical hit. Fire damage dealt by this weapon (including the persistent fire damage) ignores the target's fire resistance.",
      macros: [],
      modifiers: [],
    },
    greaterfrost: {
      displayName: "Greater Frost",
      description:
        "This weapon is empowered with freezing ice. It deals an additional 1d6 cold damage on a successful Strike. On a critical hit, the target is also slowed 1 until the end of your next turn unless it succeeds at a DC 34 Fortitude save. Cold damage dealt by this weapon ignores the target's cold resistance.",
      macros: [],
      modifiers: [],
    },
    greatergiantkilling: {
      displayName: "Greater Giant Killing",
      description:
        "This weapon features stylized etchings of giants. A giant-killing weapon deals an additional 2d6 mental damage on a successful Strike against a giant. On a critical hit, the giant must attempt a DC 34 Fortitude save with the following effects.\n\nCritical Success The giant is enfeebled 1 until the end of your next turn.\nSuccess The giant is enfeebled 2 until the end of your next turn and takes 1d10 additional mental damage.\nFailure The giant is enfeebled 2 for the next minute and takes 2d10 additional mental damage.\nCritical Failure The giant is enfeebled 4 for the next minute and takes 4d10 additional mental damage.",
      macros: [],
      modifiers: [],
    },
    greaterhauling: {
      displayName: "Greater Hauling",
      description:
        "Hauling weapons are adept at moving creatures around the battlefield after a successful attack.\n\nActivate [reaction] Command; Frequency once per hour; Trigger You succeed at an attack roll to Strike with a weapon with the hauling rune; Effect The target must succeed at a DC 28 Reflex save or be moved 10 feet in a direction you choose. This is forced movement.",
      macros: [],
      modifiers: [],
    },
    greaterimpactful: {
      displayName: "Greater Impactful",
      description:
        "This rune thrums with pure magical energy. Weapons with the rune deal an additional 1d6 force damage on a successful Strike. On a critical hit, you can choose to force the target to succeed at a DC 27 Fortitude save or be pushed 5 feet away from you.",
      macros: [],
      modifiers: [],
    },
    greaterkolssoath: {
      displayName: "Greater Kolss Oath",
      description:
        "This filigree grants you, as the clan dagger's owner, a +2 item bonus to Society checks and to Diplomacy checks to Request. Additionally, once per day, the filigree symbol can be activated to compel an enemy to act.\n\nActivate—Vow Unbreakable [one-action] (auditory, concentrate, linguistic, mental); Frequency once per day; Effect You command a creature within 30 feet to Stride away from you, drop prone, or release one item it's holding. The creature can choose to perform that action as the first action on its next turn; if it doesn't, it takes 8d6 mental damage (DC 28 basic Will save).",
      macros: [],
      modifiers: [],
    },
    greaterrooting: {
      displayName: "Greater Rooting",
      description:
        "Small roots grow along the surface of the weapon, clinging tightly to its contours. On a critical hit with the weapon, roots grow from the target. It's immobilized for 1 round (Escape DC 28) and clumsy 1 for as long as the immobilization lasts.",
      macros: [],
      modifiers: [],
    },
    greatershock: {
      displayName: "Greater Shock",
      description:
        "Electric arcs crisscross shock weapons, dealing an extra 1d6 electricity damage on a hit. On a critical hit, electricity arcs out to deal an equal amount of electricity damage to up to two other creatures of your choice within 10 feet of the target. Electricity damage dealt by this weapon ignores the target's electricity resistance (and the other creatures' on a critical hit).",
      macros: [],
      modifiers: [],
    },
    greaterthundering: {
      displayName: "Greater Thundering",
      description:
        "A thundering weapon lets out a peal of thunder when it hits, dealing an extra 1d6 sonic damage on a successful Strike. On a critical hit, the target must succeed at a DC 34 Fortitude save or be deafened permanently. Sonic damage dealt by this weapon ignores the target's sonic resistance.",
      macros: [],
      modifiers: [],
    },
    greatertruddsstrength: {
      displayName: "Greater Trudds Strength",
      description:
        "This filigree depiction of a warhammer in front of a kiteshaped shield grants you a +2 item bonus to Athletics checks and to Intimidation checks to Coerce. Additionally, once per day, the filigree symbol can be activated to protect your allies.\n\nActivate—Protect the Clan! [one-action] (concentrate); Frequency once per day; Effect Protective energy releases in a 10-foot emanation, granting a +2 status bonus to Armor Class to all allies within the area. The bonus lasts for 1 minute.",
      macros: [],
      modifiers: [],
    },
    grievous: {
      displayName: "Grievous",
      description:
        "When your attack roll with this weapon is a critical hit and gains the critical specialization effect, you gain an additional benefit depending on the weapon group.\n\nAxe You can damage a third creature, with the same restrictions.\nBow The Athletics check to pull the missile free is DC 20.\nBrawling The target takes a –4 circumstance penalty to its save.\nClub You can knock the target up to 15 feet away.\nCrossbow If the target of the critical hit is adjacent to a surface, it gets stuck to that surface by the missile, as the bow critical specialization.\nDart The base persistent bleed damage increases to 2d6.\nFirearm The target takes a –4 circumstance penalty to its save.\nFlail You move the target 5 feet. You can't move it away from you, but you can move it in another direction of your choice.\nHammer You can also knock the target 5 feet away from you.\nKnife The target takes a –5-foot status penalty to its Speed while it has the persistent bleed damage.\nPick The extra damage from the critical specialization effect increases to 4 per weapon damage die.\nPolearm You can move the target up to 10 feet.\nShield You can knock the target up to 10 feet away.\nSling The target also takes a –10-foot status penalty to its Speed for 1 round if it fails the save.\nSpear The clumsy condition lasts for 2 rounds.\nSword The target is off-guard until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    hauling: {
      displayName: "Hauling",
      description:
        "Hauling weapons are adept at moving creatures around the battlefield after a successful attack.\n\nActivate [reaction] Command; Frequency once per hour; Trigger You succeed at an attack roll to Strike with a weapon with the hauling rune; Effect The target must succeed at a DC 20 Reflex save or be moved 5 feet in a direction you choose. This is forced movement.",
      macros: [],
      modifiers: [],
    },
    holy: {
      displayName: "Holy",
      description:
        "A holy weapon commands powerful celestial energy. Strikes made with it gain the holy trait and deal an extra 1d4 spirit damage, or an extra 2d4 against an unholy target. If you are unholy, you are enfeebled 2 while carrying or wielding this weapon.\n\nActivate—Holy Healing [reaction] concentrate, healing, vitality; Frequency once per day; Trigger You critically succeed at a Strike against an unholy creature with the weapon; Effect You regain HP equal to double the unholy creature's level",
      macros: [],
      modifiers: [],
    },
    hopeful: {
      displayName: "Hopeful",
      description:
        "A weapon with a hopeful rune exudes positivity. On a critical hit with this weapon, you inspire your comrades, pushing them to fight harder and stand for your shared convictions. Allies within 30 feet that share at least one alignment component with you gain a +1 status bonus to attack rolls until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    hooked: {
      displayName: "Hooked",
      description:
        "A hooked weapon extends hooks when it's used to attack. A hooked weapon gains the trip trait. If a hooked weapon normally has the trip trait, you can attempt to Trip a foe as a reaction when you critically hit it with the hooked weapon.",
      macros: [],
      modifiers: [],
    },
    impactful: {
      displayName: "Impactful",
      description:
        "This rune thrums with pure magical energy. Weapons with the rune deal an additional 1d6 force damage on a successful Strike. On a critical hit, you can choose to force the target to succeed at a DC 37 Fortitude save or be pushed 10 feet away from you.",
      macros: [],
      modifiers: [],
    },
    impossible: {
      displayName: "Impossible",
      description:
        "This rune makes a weapon capable of impossible offense and defense. The etched weapon is immune to dispel magic and similar effects that could counteract its magic. If it's a ranged weapon or thrown weapon, its range increment is doubled.\n\nActivate [two-actions] (concentrate, teleportation); Frequency once per hour; Effect You and the weapon flash to a perfect attacking position, then return to where you started. Make a Strike with the etched weapon against one creature you can see, even if the target is beyond the weapon's reach or range. On this Strike, ignore any circumstance penalty, status penalty, and range increment penalty.",
      macros: [],
      modifiers: [],
    },
    keen: {
      displayName: "Keen",
      description:
        "The edges of a keen weapon are preternaturally sharp. Attacks with this weapon are a critical hit on a 19 on the die as long as that result is a success. This property has no effect on a 19 if the result would be a failure.",
      macros: [],
      modifiers: [],
    },
    kinwarding: {
      displayName: "Kin Warding",
      description:
        "A kin-warding clan dagger can deflect attacks aimed at your allies. When you use the weapon's parry trait, you can point the clan dagger at an adjacent ally instead of defending yourself, creating a shield of runes around them. The runic barrier grants your ally the weapon's circumstance bonus to AC, but you do not gain the bonus yourself.",
      macros: [],
      modifiers: [],
    },
    kolssoath: {
      displayName: "Kolss Oath",
      description:
        "This filigree grants you, as the clan dagger's owner, a +1 item bonus to Society checks and to Diplomacy checks to Request. Additionally, once per day, the filigree symbol can be activated to compel an enemy to act.\n\nActivate—Vow Unbreakable [one-action] (auditory, concentrate, linguistic, mental); Frequency once per day; Effect You command a creature within 30 feet to Stride away from you, drop prone, or release one item it's holding. The creature can choose to perform that action as the first action on its next turn; if it doesn't, it takes 4d6 mental damage (DC 20 basic Will save).",
      macros: [],
      modifiers: [],
    },
    majorfanged: {
      displayName: "Major Fanged",
      description:
        "When etched with this rune, a weapon's hilt or haft becomes engraved with grooves that match the imprints of a wolf's teeth. By putting a fanged weapon in your mouth, you can transform into an animal.\n\nActivate [one-action] Interact (magical, polymorph, transmutation); Effect You transform into a Small or Medium animal that wields the fanged weapon in its jaws; the animal matches the animal you are most closely associated with (a lizardfolk would turn into a lizard, a kitsune into a fox, a deer instinct barbarian into a deer, etc.) or a wolf if no specific animal is applicable. While in this form, you can attack with the fanged weapon even though you don't have any hands. However, you can attack only with the fanged weapon and you don't have hands or the ability to hold items. For effects dependent on how many hands you are using to hold the item, such as the two-hand trait, you are holding the weapon in two hands. You can Dismiss this effect, and it ends automatically if you drop the fanged weapon (whether or not of your own volition). In animal form, you gain low-light vision, imprecise scent to a range of 30 feet, and a +10-foot item bonus to your Speed.",
      macros: [],
      modifiers: [],
    },
    majorrooting: {
      displayName: "Major Rooting",
      description:
        "Small roots grow along the surface of the weapon, clinging tightly to its contours. On a critical hit with the weapon, roots grow from the target. It's immobilized for 1 round (Escape DC 34) and clumsy 1 for as long as the immobilization lasts.",
      macros: [],
      modifiers: [],
    },
    merciful: {
      displayName: "Merciful",
      description:
        "Merciful weapons are sheathed in an unmistakable wispy green aura recognized by both gladiators and guards around the world. A merciful weapon has the nonlethal trait and can't be used to make a lethal attack. Any persistent damage the weapon would deal is negated.\n\nOn a critical hit, a merciful weapon causes the target to become fascinated with the weapon's wielder for 1 minute, as the target is bombarded with feelings of guilt and remorse. This is a mental effect. If you have access to the weapon's critical specialization effect, you choose whether to use it or the merciful effect",
      macros: [],
      modifiers: [],
    },
    nightmare: {
      displayName: "Nightmare",
      description:
        "A nightmare rune creates minor phantasmal alterations to a weapon's appearance so that those who look upon it see subtle reminders of their deepest fears. An arachnophobe might interpret the cross guard of a nightmare longsword to look like curving, twitching spider legs, for example, while someone who's afraid of sickness might see a nightmare club as a diseased length of bone crawling with flies. These images are all in the mind of the observer, but they also infuse the weapon with additional power. When you hit with a nightmare weapon, add 1d6 mental damage to the damage dealt. In addition, on a critical hit, the target becomes stupefied 1 by overwhelming visions in their mind of personal horrors that linger. If you critically hit a creature that's already stupefied, it becomes frightened 2 as well. These critical hit effects have the emotion, fear, and mental traits.\n\nActivate 10 minutes (envision, Interact); Frequency once per day; Effect The nightmare weapon casts nightmare to your specifications.",
      macros: [],
      modifiers: [],
    },
    pacifying: {
      displayName: "Pacifying",
      description:
        "This rune turns weapons into instruments of peacemaking.\n\nActivate [reaction] (concentrate, mental); Trigger You damage a creature with the etched weapon; Effect The damaged creature must succeed at a DC 20 Will save or be pacified. A pacified creature takes a –2 penalty to attack rolls on any attacks that aren't nonlethal for 1 minute, and the creature also experiences a clear psychic warning that they should stop making attacks that could kill.",
      macros: [],
      modifiers: [],
    },
    quickstrike: {
      displayName: "Quickstrike",
      description:
        "Attacks with a quickstrike weapon are supernaturally swift. While wielding a quickstrike weapon, you gain the quickened condition, but you can use the additional action granted only to make a Strike with the etched weapon.",
      macros: [],
      modifiers: [],
    },
    returning: {
      displayName: "Returning",
      description:
        "When you make a thrown Strike with this weapon, it flies back to your hand after the Strike is complete. If your hands are full when the weapon returns, it falls to the ground in your space.",
      macros: [],
      modifiers: [],
    },
    rooting: {
      displayName: "Rooting",
      description:
        "Small roots grow along the surface of the weapon, clinging tightly to its contours. On a critical hit with the weapon, roots grow from the target. It's immobilized for 1 round (Escape DC 23) and clumsy 1 for as long as the immobilization lasts.",
      macros: [],
      modifiers: [],
    },
    serrating: {
      displayName: "Serrating",
      description:
        "A serrating weapon's bladed edge separates into jagged, swirling shards that spin along the blade. When dealing slashing damage, the weapon deals an additional 1d4 damage.\n\nActivate [one-action] Interact; Effect You brandish the weapon and focus its power, causing the serrated shards to buzz as they spin at a dizzying speed. On your next hit with the weapon this turn that deals slashing damage, the serrating rune adds an additional 1d12 damage instead of the additional 1d4 damage, and then the shards return to their usual speed.",
      macros: [],
      modifiers: [],
    },
    shifting: {
      displayName: "Shifting",
      description:
        "With a moment of manipulation, you can shift this weapon into a different weapon with a similar form.\n\nActivate—Shift Weapon [one-action] (manipulate); Effect The weapon takes the shape of another melee weapon that requires the same number of hands to wield. The weapon's runes and any precious material it's made of apply to the weapon's new shape. Any property runes that can't apply to the new form are suppressed until the item takes a shape to which they can apply.\nThe weapons a shifting weapon can turn into are based on the base attributes of the weapon, so reference the weapon's Hands entry in the weapons table to see what it can turn into. For example, a bastard sword requires one hand, even though it gets a benefit in two hands from the two-hand trait. Therefore, a shifting bastard sword could turn into a longsword, but not a greatsword. Activating this rune doesn't change how many hands you're currently using to hold the weapon.",
      macros: [],
      modifiers: [],
    },
    shock: {
      displayName: "Shock",
      description:
        "Electric arcs crisscross shock weapons, dealing an extra 1d6 electricity damage on a hit. On a critical hit, electricity arcs out to deal an equal amount of electricity damage to up to two other creatures of your choice within 10 feet of the target.",
      macros: [],
      modifiers: [],
    },
    shockwave: {
      displayName: "Shockwave",
      description:
        "Shockwave weapons magically increase their density and momentum when swung, creating a thudding impact on those nearby. Strikes with this weapon deal bludgeoning splash damage equal to the number of weapon damage dice. You're immune to this splash damage.",
      macros: [],
      modifiers: [],
    },
    spellreservoir: {
      displayName: "Spell Reservoir",
      description:
        "A spell reservoir rune creates a pool of eldritch energy within the etched weapon. A spellcaster can spend 1 minute to cast a spell of 3rd rank or lower into the weapon. The spell must require 2 actions or fewer to cast and must be able to target a creature other than the caster. The spell has no immediate effect—it is instead stored for later.\nWhen you wield a spell reservoir weapon, you immediately know the name and rank of the stored spell. A spell reservoir weapon found as treasure has a 50% chance of having a spell of the GM's choice stored in it.\n\nActivate—Channeled Release [two-actions] (concentrate); Requirements A spell is stored in the weapon; Effect Make a Strike with the weapon. You expend the stored spell as part of this Strike; this empties the spell from the weapon and allows a spell to be cast into it again. If the Strike hits, the spell targets the target of the attack. If the spell requires a spell attack roll, the result of your attack roll with the weapon determines the degree of success of the spell, and if the spell requires a saving throw, the DC is 30.\n\nActivate—Safe Release [one-action] (concentrate); Effect Harmlessly expend the stored spell. This frees the weapon to have a new spell cast into it.",
      macros: [],
      modifiers: [],
    },
    swarming: {
      displayName: "Swarming",
      description:
        "Able to copy itself many times over when thrown until the air is filled with deadly blades, a swarming weapon turns a single weapon into a shower of devastation.\n\nActivate [two-actions] (concentrate); Frequency once per hour; Effect You fling your weapon and it multiplies as it flies through the air, filling a 30-foot cone. All creatures within the area take damage equal to double the weapon's number of damage dice, with a DC 27 basic Reflex save.",
      macros: [],
      modifiers: [],
    },
    thundering: {
      displayName: "Thundering",
      description:
        "A thundering weapon lets out a peal of thunder when it hits, dealing an extra 1d6 sonic damage on a successful Strike. On a critical hit, the target must succeed at a DC 24 Fortitude save or be deafened for 1 minute (or 1 hour on a critical failure).",
      macros: [],
      modifiers: [],
    },
    truddsstrength: {
      displayName: "Trudds Strength",
      description:
        "This filigree depiction of a warhammer in front of a kiteshaped shield grants you a +1 item bonus to Athletics checks and to Intimidation checks to Coerce. Additionally, once per day, the filigree symbol can be activated to protect your allies.\n\nActivate—Protect the Clan! [one-action] (concentrate); Frequency once per day; Effect Protective energy releases in a 10-foot emanation, granting a +1 status bonus to Armor Class to all allies within the area. The bonus lasts for 1 minute.",
      macros: [],
      modifiers: [],
    },
    truerooting: {
      displayName: "True Rooting",
      description:
        "Small roots grow along the surface of the weapon, clinging tightly to its contours. On a critical hit with the weapon, roots grow from the target. It's immobilized for 1 round (Escape DC 41) and clumsy 1 for as long as the immobilization lasts.",
      macros: [],
      modifiers: [],
    },
    underwater: {
      displayName: "Underwater",
      description:
        "This weapon works as well in water as it does on land. Attacks with the weapon don't take the normal penalties and restrictions for being used in water or underwater. If the weapon is capable of dealing fire damage, its fire functions underwater as well.",
      macros: [],
      modifiers: [],
    },
    unholy: {
      displayName: "Unholy",
      description:
        "An unholy rune instills fiendish power into the etched weapon. Strikes made with it gain the unholy trait and deal an extra 1d4 spirit damage, or an extra 2d4 against a holy target. If you are holy, you are enfeebled 2 while carrying or wielding this weapon.\n\nActivate—Unholy Bloodshed [reaction] (concentrate); Frequency once per day; Trigger You critically succeed at an attack roll against a holy creature with the weapon; Effect The target takes persistent bleed damage equal to 1d8 per weapon damage die of the etched weapon.",
      macros: [],
      modifiers: [],
    },
    vorpal: {
      displayName: "Vorpal",
      description:
        "Originally created as a means of slaying the legendary jabberwock, vorpal weapons prove equally effective against nearly any foe with a head.\n\nActivate—Snicker-Snack [reaction] (concentrate, death, incapacitation) ; Trigger You roll a natural 20 on a Strike with the weapon against a creature that has a head, critically succeed, and deal slashing damage; Effect The target must succeed at a DC 37 Fortitude save or be decapitated. This kills any creature except ones that don't require a head to live. For creatures with multiple heads, this usually kills the creature only if you sever its last head.",
      macros: [],
      modifiers: [],
    },
    wounding: {
      displayName: "Wounding",
      description:
        "Weapons with wounding runes are said to thirst for blood. When you hit a creature with a wounding weapon, you deal an extra 1d6 persistent bleed damage.",
      macros: [],
      modifiers: [],
    },
  };

  const details = runeData[rune] || {
    displayName: "",
    description: "",
    macros: [],
    modifiers: [],
  };

  return details;
}

function getArmorRuneDetails(runeName) {
  const rune = getPropertyRuneKey(runeName);

  const runeData = {
    acidresistant: {
      displayName: "Acid Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 5 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    advancing: {
      displayName: "Advancing",
      description:
        "This rune charges up as you defeat your foes, driving you forward across the battlefield with every victory.\n\nActivate [free-action] (concentrate); Requirements Your last action or activity reduced an enemy to 0 Hit Points; Effect You Stride up to 15 feet. This movement doesn't trigger reactions. You can Burrow, Climb, Fly, or Swim instead of Striding if you have the corresponding movement type.",
      macros: [],
      modifiers: [],
    },
    aimaiding: {
      displayName: "Aim Aiding",
      description:
        "Armor etched with this rune aids in routing ranged attacks aimed at an enemy around you. You don't provide enemies cover against your allies' ranged attacks.",
      macros: [],
      modifiers: [],
    },
    antimagic: {
      displayName: "Antimagic",
      description:
        "This intricate rune displaces spell energy, granting you a +1 status bonus to saving throws against magical effects.\n\nActivate—Antimagic Armor [reaction] (concentrate); Frequency once per day; Trigger A spell targets you or includes you in its area; Effect The armor attempts to counteract the triggering spell with the effect of a 7th-rank dispel magic spell and a counteract modifier of +26.",
      macros: [],
      modifiers: [],
    },
    assisting: {
      displayName: "Assisting",
      description:
        "Your armor provides support for your joints or advanced prostheses for missing limbs, holding your body in place and easing physical symptoms. This replicates the benefits of any number of splints, supports, and prostheses. When you invest the armor, you determine how many such supports you want, and where on your body they assist you.\n\nIn addition, the extra support and structure provided by the armor allows you to transport more than you would otherwise normally be able to. You can carry Bulk equal to 6 + your Strength modifier before becoming encumbered, and you can hold and carry a total Bulk of up to 11 + your Strength modifier.",
      macros: [],
      modifiers: [],
    },
    bitter: {
      displayName: "Bitter",
      description:
        "While you wear this acrid armor, any creature that Engulfs you or Swallows you Whole is sickened 1; if it spends an action retching to reduce the sickened condition, you can attempt to Escape as a reaction.",
      macros: [],
      modifiers: [],
    },
    coldresistant: {
      displayName: "Cold Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 5 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    deathless: {
      displayName: "Deathless",
      description:
        "These symbols fortify your body's grasp on your soul, keeping it tethered when death approaches.\n\nActivate [reaction] envision; Frequency once per day; Trigger You gain the doomed or wounded condition; Effect You reduce the value of the triggering condition by 1.",
      macros: [],
      modifiers: [],
    },
    electricityresistant: {
      displayName: "Electricity Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 5 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    energyadaptive: {
      displayName: "Energy Adaptive",
      description:
        "A complex pattern of protective symbols gives protection against various forms of energy, but only part of the runic structure can be active at a given time.\n\nActivate [reaction] (concentrate); Frequency once per hour; Trigger You take acid, cold, electricity, or fire damage; Effect You gain resistance 5 to the triggering damage type. This doesn't apply to the triggering damage. This resistance lasts until you Activate this rune again or the armor is no longer invested by you.",
      macros: [],
      modifiers: [],
    },
    ethereal: {
      displayName: "Ethereal",
      description:
        "An ethereal rune replicates armor on the Ethereal Plane.\n\nActivate [one-action] command; Frequency once per day; Effect You gain the effects of an ethereal jaunt spell. This doesn't require concentration and lasts for 10 minutes or until you choose to return to material form as a free action.",
      macros: [],
      modifiers: [],
    },
    fireresistant: {
      displayName: "Fire Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 5 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    fortification: {
      displayName: "Fortification",
      description:
        "A fortification rune wards against the deadliest attacks. Each time you're critically hit while wearing the etched armor, attempt a DC 17 flat check. On a success, it becomes a normal hit. This property thickens the armor, increasing its Bulk by 1 and the Strength modifier require to reduce its penalties by 1.",
      macros: [],
      modifiers: [],
    },
    gliding: {
      displayName: "Gliding",
      description:
        "The armor allows you to make a controlled descent.\n\nActivate [one-action] (concentrate); Effect You glide slowly toward the ground, 5 feet down and up to 25 feet forward through the air. Provided you spend at least 1 action gliding on your turn and haven't yet reached the ground, you remain in the air at the end of your turn. Otherwise, you fall.",
      macros: [],
      modifiers: [],
    },
    greateracidresistant: {
      displayName: "Greater Acid Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 10 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    greateradvancing: {
      displayName: "Greater Advancing",
      description:
        "This rune charges up as you defeat your foes, driving you forward across the battlefield with every victory.\n\nActivate [free-action] (concentrate); Requirements Your last action or activity reduced an enemy to 0 Hit Points; Effect You Stride up to your speed. This movement doesn't trigger reactions. You can Burrow, Climb, Fly, or Swim instead of Striding if you have the corresponding movement type.",
      macros: [],
      modifiers: [],
    },
    greatercoldresistant: {
      displayName: "Greater Cold Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 10 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    greaterdread: {
      displayName: "Greater Dread",
      description:
        "Eerie symbols cover your armor, inspiring terror in your foes. Frightened enemies within 30 feet that can see you must attempt a DC 38 Will save at the end of their turn; on a failure, the value of their frightened condition doesn't decrease, no matter the value.",
      macros: [],
      modifiers: [],
    },
    greaterelectricityresistant: {
      displayName: "Greater Electricity Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 10 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    greaterfireresistant: {
      displayName: "Greater Fire Resistant",
      description:
        "These symbols convey protective forces from the Elemental Planes. You gain resistance 10 to acid, cold, electricity, or fire. The crafter chooses the damage type when creating the rune. Multiple energy-resistant runes can be etched onto a suit of armor; rather than using only the strongest effect, each must provide resistance to a different damage type. For instance, a +2 acid-resistant greater fire-resistant breastplate would give you acid resistance 5 and fire resistance 10.",
      macros: [],
      modifiers: [],
    },
    greaterfortification: {
      displayName: "Greater Fortification",
      description:
        "A fortification rune wards against the deadliest attacks. Each time you're critically hit while wearing the etched armor, attempt a DC 14 flat check. On a success, it becomes a normal hit. This property thickens the armor, increasing its Bulk by 1 and the Strength modifier require to reduce its penalties by 1.",
      macros: [],
      modifiers: [],
    },
    greaterinvisibility: {
      displayName: "Greater Invisibility",
      description:
        "Light seems to partially penetrate this armor.\n\nActivate—Go Invisible [one-action] (concentrate); Frequency 3 per day; Effect With a thought, you become invisible for 1 minute, gaining the effects of a 2nd-rank invisibility spell.",
      macros: [],
      modifiers: [],
    },
    greaterready: {
      displayName: "Greater Ready",
      description:
        "A ready rune draws component pieces of a suit of armor toward one another, making it extremely fast to get into. You can don any armor with this rune as a single action.",
      macros: [],
      modifiers: [],
    },
    greatershadow: {
      displayName: "Greater Shadow",
      description:
        "Armor etched with this rune takes on a hazy black appearance. You gain a +2 item bonus to Stealth checks while wearing the armor.",
      macros: [],
      modifiers: [],
    },
    greaterslick: {
      displayName: "Greater Slick",
      description:
        "This property makes armor slippery, as though it were coated with a thin film of oil. You gain a +2 item bonus to Acrobatics checks to Escape and Squeeze.",
      macros: [],
      modifiers: [],
    },
    greaterstanching: {
      displayName: "Greater Stanching",
      description:
        "These symbols close bloody wounds. Armor with this rune reduces the DC of the flat check to end persistent bleed damage from 15 to 10 (5 with particularly effective assistance).",
      macros: [],
      modifiers: [],
    },
    greaterquenching: {
      displayName: "Greater Quenching",
      description:
        "This rune counters burning and corrosive agents. Armor with this rune reduces the DC of the flat check to end persistent acid or fire damage affecting you from 15 to 10 (5 with particularly effective assistance).",
      macros: [],
      modifiers: [],
    },
    greaterswallowspike: {
      displayName: "Greater Swallow Spike",
      description:
        "Your armor responds to your desire to break free of a creature grabbing you by growing spikes.\n\nActivate [reaction] (attack, concentrate); Trigger You become grabbed, restrained, or otherwise held immobilized in a creature's grasp, such as by being engulfed or swallowed; Effect Your armor suddenly grows spikes, attacking the triggering creature. The armor makes a melee attack with an attack modifier of +22 that deals 3d6 piercing damage. If the creature is swallowing or engulfing you, the attack deals an additional 2d6 damage, and damage from this attack can cut you free if it equals or exceeds the Rupture value of the immobilizing ability. This attack gets an item bonus to the attack roll equal to the armor's item bonus to your AC and an item bonus to damage equal to double that amount.\n\nActivate [one-action] (attack, concentrate); Requirements You're being held immobilized as described in the rune's other activation; Effect Your armor attacks the creature immobilizing you. The armor makes a melee attack against the creature, as described in the rune's other activation.",
      macros: [],
      modifiers: [],
    },
    greaterwinged: {
      displayName: "Greater Winged",
      description:
        "This rune is a swirling glyph on the front of the armor. A large pair of transparent, ephemeral wings floats out from the back of the armor.\n\nActivate—Take to the Skies [two-actions] (concentrate, manipulate); Frequency once per hour; Effect You trace the rune on the front of the breastplate, and the armor's ephemeral wings grow tangible, granting you a fly Speed of 25 feet or your land Speed, whichever is slower. Once activated, the wings remain tangible indefinitely. You can Dismiss the activation if you choose, and you don't have to wait an hour to activate the rune again.",
      macros: [],
      modifiers: [],
    },
    immovable: {
      displayName: "Immovable",
      description:
        "This rune utilizes magical principles to manipulate gravity and turn you into an immovable object.\n\nActivate [one-action] (manipulate); Frequency once per day; Effect Your armor anchors you in place, even defying gravity, rendering you immobilized until you Dismiss the Activation. while you're immobilized in this way, you can be moved only if a creature succeeds at a DC 40 Athletics check to Force Open your armor. You can also be moved if 8,000 pounds of pressure are placed upon you, though this is likely fatal.",
      macros: [],
      modifiers: [],
    },
    implacable: {
      displayName: "Implacable",
      description:
        "This substantial rune makes you difficult to hold back. Whenever you are affected by an effect that lasts until you Escape (for instance, from the Grapple action or a tanglefoot bag), you become quickened. You can use the extra action each round only to Step or Escape.",
      macros: [],
      modifiers: [],
    },
    invisibility: {
      displayName: "Invisibility",
      description:
        "Light seems to partially penetrate this armor.\n\nActivate—Go Invisible [one-action] (concentrate); Frequency once per day; Effect With a thought, you become invisible for 1 minute, gaining the effects of a 2nd-rank invisibility spell.",
      macros: [],
      modifiers: [],
    },
    lesserdread: {
      displayName: "Lesser Dread",
      description:
        "Eerie symbols cover your armor, inspiring terror in your foes. Frightened enemies within 30 feet that can see you must attempt a DC 20 Will save at the end of their turn; on a failure, the value of their frightened condition doesn't decrease below 1 that turn.",
      macros: [],
      modifiers: [],
    },
    magnetizing: {
      displayName: "Magnetizing",
      description:
        "This rune alters the magnetic polarity of your armor, making other metal items drawn to it ever so slightly. You can amplify the magnetic power of the armor to keep another creature from getting away from you.\n\nActivate [one-action] (concentrate); Frequency once per hour; Requirements A creature adjacent to you is made of metal or wearing metal armor; Effect You magnetize your armor. If you or the target attempt to move away from one another, treat each square as difficult terrain. This doesn't affect movement that keeps you the same distance from one another, so you could still Step if you remained adjacent to the target. This effect ends once either of you is no longer adjacent to the other at the end of an action.\n\nThis Activation might work on some creatures partially made of metal, such as those with metal scales, as determined by the GM. Likewise, the GM might determine some metal creatures are non-magnetic, depending on the metal they're made of.",
      macros: [],
      modifiers: [],
    },
    majorquenching: {
      displayName: "Major Quenching",
      description:
        "This rune counters burning and corrosive agents. Armor with this rune reduces the DC of the flat check to end persistent acid or fire damage affecting you from 15 to 8 (3 with particularly effective assistance).",
      macros: [],
      modifiers: [],
    },
    majorshadow: {
      displayName: "Major Shadow",
      description:
        "Armor etched with this rune takes on a hazy black appearance. You gain a +3 item bonus to Stealth checks while wearing the armor.",
      macros: [],
      modifiers: [],
    },
    majorslick: {
      displayName: "Major Slick",
      description:
        "This property makes armor slippery, as though it were coated with a thin film of oil. You gain a +3 item bonus to Acrobatics checks to Escape and Squeeze.",
      macros: [],
      modifiers: [],
    },
    majorstanching: {
      displayName: "Major Stanching",
      description:
        "These symbols close bloody wounds. Armor with this rune reduces the DC of the flat check to end persistent bleed damage from 15 to 8 (3 with particularly effective assistance).",
      macros: [],
      modifiers: [],
    },
    majorswallowspike: {
      displayName: "Major Swallow Spike",
      description:
        "Your armor responds to your desire to break free of a creature grabbing you by growing spikes.\n\nActivate [reaction] (attack, concentrate); Trigger You become grabbed, restrained, or otherwise held immobilized in a creature's grasp, such as by being engulfed or swallowed; Effect Your armor suddenly grows spikes, attacking the triggering creature. The armor makes a melee attack with an attack modifier of +28 that deals 5d6 piercing damage. If the creature is swallowing or engulfing you, the attack deals an additional 3d6 damage, and damage from this attack can cut you free if it equals or exceeds the Rupture value of the immobilizing ability. This attack gets an item bonus to the attack roll equal to the armor's item bonus to your AC and an item bonus to damage equal to double that amount.\n\nActivate [one-action] (attack, concentrate); Requirements You're being held immobilized as described in the rune's other activation; Effect Your armor attacks the creature immobilizing you. The armor makes a melee attack against the creature, as described in the rune's other activation.",
      macros: [],
      modifiers: [],
    },
    malleable: {
      displayName: "Malleable",
      description:
        "The metal of your armor can shift and rearrange at a moment's notice, allowing you to manipulate what kind of damage it resists.\n\nActivate—Reconfigure Armor [one-action] (manipulate); Effect The armor's composition shifts, changing its specialization group to a different one of your choice. This doesn't change what the armor is made of, and any runes or precious material it's made of apply to the new composition. Any property runes that can't apply to the new form are suppressed until the item takes a composition to which they can apply.",
      macros: [],
      modifiers: [],
    },
    misleading: {
      displayName: "Misleading",
      description:
        "This rune attempts to obfuscate your location through illusory trickery. When you're concealed, the DC of the flat check to target you with an effect is 6 instead of 5.\n\nActivate [two-actions] (concentrate); Frequency once per day; Effect The armor casts mislead, affecting you. It lasts until the end of your next turn.",
      macros: [],
      modifiers: [],
    },
    moderatedread: {
      displayName: "Moderate Dread",
      description:
        "Eerie symbols cover your armor, inspiring terror in your foes. Frightened enemies within 30 feet that can see you must attempt a DC 29 Will save at the end of their turn; on a failure, the value of their frightened condition doesn't decrease below 2 that turn.",
      macros: [],
      modifiers: [],
    },
    portable: {
      displayName: "Portable",
      description:
        "This rune allows your armor to collapse into a disguised, portable form.\n\nActivate [three-actions] (concentrate, manipulate); Effect You doff your armor, which folds into another wearable object, such as a bangle or amulet with light Bulk. This wearable object has features that hint at the armor it hides. You aren't wearing the armor while it's in this form, but at the GM's discretion, you can still activate properties that might feasibly come from the wearable item the armor has become. If the armor is in its portable form, you can use this activation to revert it to armor, which you can don in 1 minute.",
      macros: [],
      modifiers: [],
    },
    quenching: {
      displayName: "Quenching",
      description:
        "This rune counters burning and corrosive agents. Armor with this rune reduces the DC of the flat check to end persistent acid or fire damage affecting you from 15 to 12 (7 with particularly effective assistance).",
      macros: [],
      modifiers: [],
    },
    raiment: {
      displayName: "Raiment",
      description:
        "This armor can be disguised with a mere thought.\n\nActivate—Costume Change [one-action] (concentrate); Effect You change the shape and appearance of this armor to appear as ordinary or fine clothes of your imagining. The armor's statistics don't change. Only a creature that's benefiting from truesight or a similar effect can attempt to disbelieve this illusion, with a DC of 25.",
      macros: [],
      modifiers: [],
    },
    ready: {
      displayName: "Ready",
      description:
        "A ready rune draws component pieces of a suit of armor toward one another, making it extremely fast to get into. You can don light armor with a ready rune as a single action, or medium or heavy armor with a ready rune as a 2-action activity.",
      macros: [],
      modifiers: [],
    },
    rockbraced: {
      displayName: "Rock Braced",
      description:
        "Rock-braced armor makes you as hard to move as a boulder. Whenever another creature attempts to forcibly move you from your space, you gain a +4 item bonus to your Fortitude DC against the check to move you. If the creature would not normally need to attempt a check to move you, then the creature must succeed at an Athletics check against your Fortitude DC (including the +4 item bonus) or you are unmoved.",
      macros: [],
      modifiers: [],
    },
    shadow: {
      displayName: "Shadow",
      description:
        "Armor etched with this rune takes on a hazy black appearance. You gain a +1 item bonus to Stealth checks while wearing the armor.",
      macros: [],
      modifiers: [],
    },
    sinisterknight: {
      displayName: "Sinister Knight",
      description:
        "Sinister knight armor shrouds the wearer's identity in secrecy, allowing Crimson Reclaimers to pass among foes without being immediately unmasked. The wearer gains a +1 item bonus to Deception checks.\n\nActivate [one-action] envision; Effect With a thought, the wearer activates a disguise. While the sinister knight armor's disguise is active, any identifying insignia or aesthetic of the armor is replaced by generic malevolent aesthetics such as spikes or demonic faces. While in the disguise, the wearer is always considered to be taking precautions against lifesense, and even a creature that successfully notices the wearer with its lifesense mistakes the wearer for an undead unless it critically succeeds at its Perception check or the wearer critically fails a Deception or Stealth check. Finally, while in the disguise, the rune attempts to counteract any effects that would reveal your alignment; on a successful counteract check, rather than negate the effect, the rune causes the effect to perceive your alignment as evil (maintaining any lawful or chaotic component of your alignment).\n\nThe wearer can Dismiss the disguise, and if the wearer's armor is removed, the disguise deactivates automatically.",
      macros: [],
      modifiers: [],
    },
    sizechanging: {
      displayName: "Size Changing",
      description:
        "This armor can make itself and its wearer quickly change size.\n\nActivate—Change Size [one-action] (concentrate); Frequency once per day; Effect The armor casts your choice of enlarge or shrink on you.",
      macros: [],
      modifiers: [],
    },
    slick: {
      displayName: "Slick",
      description:
        "This property makes armor slippery, as though it were coated with a thin film of oil. You gain a +1 item bonus to Acrobatics checks to Escape and Squeeze.",
      macros: [],
      modifiers: [],
    },
    soaring: {
      displayName: "Soaring",
      description:
        "A set of soaring armor helps you fly faster and protects you and nearby allies from falling. While wearing soaring armor, you gain a +10-foot item bonus to your fly Speed, if you have one. As normal, if your fly Speed is based on your land Speed and you already have an item bonus to your land Speed, these bonuses aren't cumulative.\n\nActivate [reaction] command; Trigger You or a creature within 60 feet of you is falling; Effect You cast feather fall on the triggering creature.",
      macros: [],
      modifiers: [],
    },
    spellwatch: {
      displayName: "Spellwatch",
      description:
        "Counter-runes chip away at unwanted magic that impedes you. You can attempt a new saving throw against one hostile spell affecting you at the start of each of your turns. If you succeed, the spell ends, and if you fail it continues unchanged, with no additional ill effect. If you're affected by multiple hostile spells, choose only one each turn to attempt the additional save against.",
      macros: [],
      modifiers: [],
    },
    stanching: {
      displayName: "Stanching",
      description:
        "These symbols close bloody wounds. Armor with this rune reduces the DC of the flat check to end persistent bleed damage from 15 to 12 (7 with particularly effective assistance).",
      macros: [],
      modifiers: [],
    },
    swallowspike: {
      displayName: "Swallow Spike",
      description:
        "Your armor responds to your desire to break free of a creature grabbing you by growing spikes.\n\nActivate [reaction] (attack, concentrate); Trigger You become grabbed, restrained, or otherwise held immobilized in a creature's grasp, such as by being engulfed or swallowed; Effect Your armor suddenly grows spikes, attacking the triggering creature. The armor makes a melee attack with an attack modifier of +14 that deals 2d6 piercing damage. If the creature is swallowing or engulfing you, the attack deals an additional 1d6 damage, and damage from this attack can cut you free if it equals or exceeds the Rupture value of the immobilizing ability. This attack gets an item bonus to the attack roll equal to the armor's item bonus to your AC and an item bonus to damage equal to double that amount.\n\nActivate [one-action] (attack, concentrate); Requirements You're being held immobilized as described in the rune's other activation; Effect Your armor attacks the creature immobilizing you. The armor makes a melee attack against the creature, as described in the rune's other activation.",
      macros: [],
      modifiers: [],
    },
    truequenching: {
      displayName: "True Quenching",
      description:
        "This rune counters burning and corrosive agents. Armor with this rune reduces the DC of the flat check to end persistent acid or fire damage affecting you from 15 to 5 (particularly effective assistance automatically removes the persistent acid or fire damage).",
      macros: [],
      modifiers: [],
    },
    truestanching: {
      displayName: "True Stanching",
      description:
        "These symbols close bloody wounds. Armor with this rune reduces the DC of the flat check to end persistent bleed damage from 15 to 5 (particularly effective assistance automatically removes the persistent bleed damage).",
      macros: [],
      modifiers: [],
    },
    winged: {
      displayName: "Winged",
      description:
        "This rune is a swirling glyph on the front of the armor. A large pair of transparent, ephemeral wings floats out from the back of the armor.\n\nActivate—Take to the Skies [two-actions] (concentrate, manipulate); Frequency once per hour; Effect You trace the rune on the front of the breastplate, and the armor's ephemeral wings grow tangible, granting you a fly Speed of 25 feet or your land Speed, whichever is slower. This effect lasts for 5 minutes or until you Dismiss it. Once the effect ends, the wings disappear completely, reappearing in their ephemeral form 1 hour later.",
      macros: [],
      modifiers: [],
    },
  };

  return (
    runeData[rune] || {
      displayName: "",
      description: "",
      macros: [],
      modifiers: [],
    }
  );
}

// Returns the rune details above so we can collect their modifiers, with
// what each rune does (property-runes.js)
function getFeaturesFromRunes(items = []) {
  const features = [];
  items.forEach((item) => {
    const propertyRunes = item.data?.runes?.property || [];

    propertyRunes.forEach((rune) => {
      const isWeapon = item.data?.type === "weapon";
      const runeDetails = isWeapon
        ? getWeaponRuneDetails(rune)
        : getArmorRuneDetails(rune);
      const effects = getPropertyRuneEffects(rune, isWeapon);
      const modifiers = [
        ...(runeDetails?.modifiers || []),
        ...(effects?.modifiers || []),
      ];
      // A modifier with a nameSuffix gets its own feature ("Holy (extra)"),
      // so the engine doesn't merge it with an equal one of the rune's
      const name = runeDetails.displayName || effects?.name || "";
      const groups = {};
      modifiers.forEach(({ nameSuffix, ...modifier }) => {
        const featureName = nameSuffix ? `${name} (${nameSuffix})` : name;
        (groups[featureName] = groups[featureName] || []).push(modifier);
      });
      Object.entries(groups).forEach(([featureName, featureModifiers]) => {
        features.push({
          // Use item ID since it came from this item
          _id: item._id,
          name: featureName,
          data: {
            modifiers: featureModifiers.map((modifier) => ({
              data: {
                ...modifier,
              },
            })),
          },
        });
      });
    });
  });
  return features;
}

/**
 * Gets the armor specialization effect details for an armor group.
 *
 * @param {string} armorGroup - The armor group name
 * @returns {Object} - Object containing description, group name, and macros array
 */
function getArmorSpecializationDetails(armorGroup) {
  const group = (armorGroup || "").toLowerCase();

  const specializations = {
    chain:
      "The armor is so flexible it can bend with a critical hit and absorb some of the blow. Reduce the damage from critical hits by either 4 + the value of the armor's potency rune for medium armor, or 6 + the value of the armor's potency rune for heavy armor. This can't reduce the damage to less than the damage rolled for the hit before doubling for a critical hit.",

    cloth:
      "Clothing isn't armor, but if it has a Dex cap it can accept fundamental and property runes.",

    composite:
      "The numerous overlapping pieces of this armor protect you from piercing attacks. You gain resistance to piercing damage equal to 1 + the value of the armor's potency rune for medium armor, or 2 + the value of the armor's potency rune for heavy armor.",

    leather:
      "The thick second skin of the armor disperses blunt force to reduce bludgeoning damage. You gain resistance to bludgeoning damage equal to 1 + the value of the armor's potency rune for medium armor, or 2 + the value of the armor's potency rune for heavy armor.",

    plate:
      "The sturdy plate provides no purchase for a cutting edge. You gain resistance to slashing damage equal to 1 + the value of the armor's potency rune for medium armor, or 2 + the value of the armor's potency rune for heavy armor.",

    skeletal:
      "Armor made from the bone or exoskeleton of creatures as diverse as bears, insects, and coral, skeletal armor protects vital points from precision damage. You gain resistance to precision damage equal to 3 + the value of the armor's potency rune for medium armor, or 5 + the value of the armor's potency rune for heavy armor.",

    wood: "Wood armor is generally flexible and light, but it can splinter as it breaks, throwing off shards and fragments that damage foes who deal you critical blows. If a foe critically hits you with a melee unarmed attack or critically hits you with any melee attack while adjacent to you, it takes piercing damage equal to 3 + the armor's potency rune value for medium armor, or 5 + the armor's potency rune value for heavy armor.",
  };

  const description = specializations[group] || "";

  return {
    description: description,
    group: group,
    macros: [], // TODO add macros for certain specializations later
  };
}

function getDCForLevel(level, difficulty = null) {
  const dcByLevel = {
    "-1": 13,
    0: 14,
    1: 15,
    2: 16,
    3: 18,
    4: 19,
    5: 20,
    6: 22,
    7: 23,
    8: 24,
    9: 26,
    10: 27,
    11: 28,
    12: 30,
    13: 31,
    14: 32,
    15: 34,
    16: 35,
    17: 36,
    18: 38,
    19: 39,
    20: 40,
    21: 42,
    22: 44,
    23: 46,
    24: 48,
    25: 50,
  };

  const difficultyAdjustments = {
    "incredibly easy": -10,
    "very easy": -5,
    easy: -2,
    hard: 2,
    uncommon: 2,
    "very hard": 5,
    rare: 5,
    "incredibly hard": 10,
    unique: 10,
  };

  let dc = dcByLevel[level] || 14;

  if (difficulty && difficultyAdjustments[difficulty.toLowerCase()]) {
    dc += difficultyAdjustments[difficulty.toLowerCase()];
  }

  return dc;
}

function getDCForSpellRank(rank) {
  const dcByRank = {
    1: 15,
    2: 18,
    3: 20,
    4: 23,
    5: 26,
    6: 28,
    7: 31,
    8: 34,
    9: 36,
    10: 39,
  };
  return dcByRank[rank] || 15;
}

function getObjectImmunitiesTooltip(object) {
  return "Inanimate objects and hazards are immune to bleed, death effects, disease, healing, mental effects, nonlethal attacks, poison, spirit, vitality, void, as well as the doomed, drained, fatigued, paralyzed, sickened, and unconscious conditions. Conscious, thinking items are not immune to mental effects. Many objects are immune to other conditions, at the GM's discretion. For instance, a sword can't move, so it can't take a penalty to its Speed, but a spinning blade trap might be affected.";
}

// Deities and their favored weapons (Archives of Nethys, remastered entries
// where they exist), keyed by the deity name as a slug. Values are weapon
// slugs, comma-separated when a deity has more than one. The character's
// Deity (data.deity) is looked up here; data.favoredWeapon overrides it.
const DEITY_FAVORED_WEAPONS = {
  "aakriti": "whip", "abadar": "crossbow", "abraxas": "whip",
  "acavna": "spear", "achaekek": "sawtooth-saber", "adanye": "claw,kukri",
  "aegirran": "trident", "aerekostes": "falcata", "aesocar": "flail",
  "ah-pook": "macuahuitl", "ahriman": "whip", "alazhra": "dagger",
  "aleth": "shield-boss", "alglenweis": "war-flail", "alocer": "shortbow",
  "alseta": "dagger", "amaznen": "light-hammer", "aminara": "machete",
  "ananshea": "kukri", "andoletta": "staff", "angazhan": "fist,spear",
  "angradd": "greataxe", "anogetz": "spiked-gauntlet", "anras": "bo-staff",
  "anubis": "flail", "aonaurious": "scythe", "apep": "dagger",
  "apollyon": "scythe", "apsu": "jaws,staff", "arazni": "rapier",
  "archdevil-abrogail": "longsword", "ardad-lili": "dagger",
  "areshkagal": "sickle", "aroden": "longsword", "arqueros": "spear",
  "arshea": "flail", "arundhat": "staff", "ashava": "bladed-scarf",
  "ashukharma": "greatsword", "asmodeus": "mace", "atreia": "katar",
  "atrogine": "nails,sickle", "atropos": "dagger", "ayrzul": "morningstar",
  "azathoth": "warhammer", "baalzebul": "spear", "baekho": "katana",
  "balumbdar": "greatclub", "baphomet": "glaive", "barbatos": "staff",
  "barzahk": "club", "bastet": "claw,tekko-kagi", "belech": "maul",
  "belial": "ranseur", "bergelmir": "staff", "bes": "mambele",
  "besmara": "rapier", "bharnarol": "sickle", "bifrons": "war-flail",
  "black-butterfly": "starknife", "blooms-of-the-spreading-weald": "staff",
  "bokrug": "ranseur", "bolka": "mace", "breath-of-the-endless-sky": "longbow",
  "brigh": "light-hammer", "brixori": "tail,starknife", "calistria": "whip",
  "camazotz": "javelin", "casandalee": "polytool", "cayden-cailean": "rapier",
  "cernunnos": "longbow", "ceyannan": "staff", "chaldira": "shortsword",
  "chamiaholom": "staff", "chamidu": "spear", "charg": "falchion",
  "charon": "staff", "chavazvug": "war-flail",
  "children-of-the-night": "rapier", "chinostes-nightwarden": "dagger",
  "chinostes-redeemer": "dagger", "chohar": "starknife",
  "cihua-coatl": "spear", "cixyron": "flintlock-musket", "cong": "frying-pan",
  "conqueror-worm": "dagger", "cormigus": "flyssa", "cormion": "hatchet",
  "corosbel": "dagger", "cosmic-caravan": "starknife",
  "count-ranalc": "rapier", "cthulhu": "dagger", "cyth-vsug": "scimitar",
  "dachzerul": "rapier", "dagon": "trident", "dahak": "jaws,whip",
  "daikitsu": "flail", "dajermube": "greatpick", "dalenydra": "light-mace",
  "dammar": "shortsword", "dammerich": "greataxe", "demon-bringers": "machete",
  "deshto": "scimitar", "desna": "starknife", "dhalavei": "temple-sword",
  "diomazul": "scimitar", "dispater": "mace",
  "dolok-darkfur": "claw,war-gavel", "doloras": "kukri",
  "dramindyr": "shield-spikes", "dranngvit": "light-pick",
  "drokalion": "jaw,pick", "droskar": "light-hammer", "eiseth": "longbow",
  "elion": "longbow", "embaral": "wish-knife",
  "emmeton-galardaria": "frying-pan", "enkaar": "spiked-chain",
  "erastil": "longbow", "erecura": "light-mace", "eritrice": "dagger",
  "esoteric-order-of-the-palatine-eye": "sword-cane",
  "essence-dancers": "claws,tekko-kagi", "etaris": "staff",
  "eyes-that-watch": "dagger", "faith-in-the-fallen": "glaive",
  "falayna": "longsword", "fandarra": "dagger", "ferrumnestra": "pick",
  "findeladlara": "staff", "folgrit": "staff", "followers-of-fate": "shears",
  "fortunes-fate": "fighting-fan", "fumeiyoshi": "naginata",
  "furcas": "trident", "gaasham": "jaws,light-hammer",
  "garhaazh": "jaws,spear", "gendowyn": "whip",
  "general-susumu": "longbow,shortbow", "genzaeri": "bladed-gauntlet",
  "geryon": "war-flail", "ghlaunder": "spear", "gogunta": "whip",
  "good-neighbors": "longsword", "gorum": "greatsword", "gozreh": "trident",
  "grandmother-spider": "bola", "granduncle-taproot": "shield-boss",
  "grask-uldeth": "warhammer", "grasping-iovett": "shortsword",
  "graveladys-guard": "dagger", "green-faith": "sickle,claw",
  "green-man": "club", "groetus": "war-flail", "gruhastha": "shortbow",
  "grundinnar": "light-hammer", "guardians-of-the-sacred-self": "shield-boss",
  "gyronna": "dagger", "haagenti": "battle-axe", "haborym": "longspear",
  "hadregash": "flail", "haggakal": "greatclub", "halcamora": "club",
  "hanspur": "trident", "hastur": "rapier", "hataam": "bola",
  "hathor": "shortsword", "hearth-and-harvest": "sickle",
  "hei-feng": "jiu-huan-dao", "horus": "khopesh", "hshurha": "longbow",
  "husk": "shortsword", "iapholi": "tail,war-flail", "iggeret": "shortbow",
  "ilsurrish": "claw,fist", "imbrex": "war-flail",
  "immaculate-growth": "scythe", "immonhiel": "hatchet", "imot": "shield-boss",
  "inna": "alchemical-bomb", "insight-of-ego-triumphant": "longsword",
  "iomedae": "longsword", "irez": "dart", "irori": "fist", "isis": "staff",
  "isph-aun-vuln": "longbow", "izuyaku": "meteor-hammer", "jaidi": "scythe",
  "jaidz": "shortsword", "jezelda": "claw,scimitar", "jin-li": "sansetsukon",
  "jukha": "longbow", "kabriri": "jaw,flail", "kagia": "sickle",
  "kaldemash": "dueling-pistol", "kalekot": "jaw,dagger", "kazutal": "machete",
  "keepers-of-the-hearth": "light-hammer", "kelinahat": "shortsword",
  "kelizandri": "trident", "keltheald": "halberd", "kerkamoth": "warhammer",
  "ketephys": "longbow", "khepri": "sling", "kitumu": "dagger",
  "kofusachi": "staff", "kols": "light-hammer", "korada": "fist",
  "kostchtchie": "warhammer", "kugaptee": "kusarigama", "kurgess": "javelin",
  "kzininn": "spiked-chain", "lady-jingxi": "fighting-fan",
  "lady-nanbyo": "warhammer", "lady-razor": "dagger", "lahkgya": "jaw",
  "laivatiniel": "crossbow", "lalaci": "sling", "lamashtu": "falchion",
  "lao-shu-po": "dagger", "laudinmio": "alchemical-bomb",
  "light-of-the-everlasting-flame": "scimitar", "liisglan": "dancers-spear",
  "likha": "hatchet", "lissala": "whip", "lorris": "spear",
  "lorthact": "staff", "lubaiko": "longspear", "luhar": "spiked-chain",
  "lurlup": "dagger", "lymnieris": "longsword", "lysianassa": "spear",
  "maat": "starknife", "magdh": "scythe", "magrim": "warhammer",
  "mahathallah": "bola", "mahja-firehair": "scimitar",
  "malthus": "light-crossbow", "mammon": "spear", "marishi": "spiked-gauntlet",
  "matravash": "whip", "mazludeh": "shield-boss", "mephistopheles": "trident",
  "mestama": "katar", "mhar": "greatpick", "milani": "morningstar",
  "minderhal": "warhammer", "moloch": "whip", "monad": "fist",
  "mother-vulture": "sickle", "mrtyu": "greatsword",
  "mugura-and-nrithu": "fist", "musagani": "naginata", "myr": "longsword",
  "naderi": "dagger", "nalinivati": "jaw,urumi", "nameless": "longsword",
  "narakaas": "greataxe", "narriseminek": "hatchet", "neith": "shortbow",
  "nephthys": "light-mace", "nergal": "spiked-chain", "neshen": "ranseur",
  "nethys": "staff", "ng": "gauntlet", "nhimbaloth": "flail",
  "nin": "sword-cane", "nivi-rhombodazzle": "light-hammer",
  "nocticula": "dagger", "norgorber": "shortsword", "nulgreth": "greataxe",
  "nurgal": "mace", "nyarlathotep-haunter-in-the-dark": "kukri",
  "nyarlathotep-the-crawling-chaos": "staff",
  "nyarlathotep-the-faceless-sphinx": "katar",
  "nyarlathotep-the-veiled-voice": "bo-staff", "nyuo-ogh": "lance",
  "oathos": "staff", "oaur-ooung": "trident", "obari": "trident",
  "olheon": "halberd", "ongalte": "greataxe", "onos": "chakram",
  "orcus": "mace", "orgesh": "spear", "osiris": "flail", "otilaz": "jaws,mace",
  "otolmens": "mace", "ozranvial": "whip", "pahti-coatl": "sickle",
  "pavnuri": "morningstar", "pazuzu": "longsword", "pharasma": "dagger",
  "pharimia": "ranseur", "phi-deva": "shortbow", "phlegyas": "longbow",
  "picoperi": "blowgun", "pillars-of-knowledge": "light-hammer",
  "ptah": "staff", "pulura": "sling", "qi-zhong": "mace", "ra": "spear",
  "radiant-prism": "shortsword", "ragadahn": "whip",
  "ragathiel": "bastard-sword", "ragdya": "mace", "ranginori": "whip",
  "raumya": "trident", "ravithra": "jaw", "razmir": "mace",
  "reshmit-of-the-heavy-voice": "morningstar", "reymenda": "falchion",
  "rhan-tegoth": "sickle", "ristrentho": "trident", "rivethun": "mace",
  "rokoga-gin": "hand-cannon", "rovagug": "greataxe", "rowdrosh": "staff",
  "rull": "falchion", "sairazul": "pick", "saloc": "guisarme",
  "sarenrae": "scimitar", "sarshallatu": "jaws,sling", "scal": "meteor-hammer",
  "seafarers-hope": "rapier", "sekhmet": "claw,battle-axe", "selket": "whip",
  "seramaydiel": "blowgun", "set": "spear", "shadow-cabinet": "dagger",
  "shapes-of-the-fading-luster": "warhammer", "shawnari": "sap",
  "shax": "dagger", "shei": "sickle", "shelyn": "glaive",
  "shivaska": "war-flail", "shizuru": "katana", "shumunue": "club",
  "shyka": "light-mace", "sicva": "sickle", "sifkesh": "war-razor",
  "sigek": "rapier", "sithhud": "longsword", "sivanah": "bladed-scarf",
  "skode": "longbow", "skrymir": "rapier", "sky-keepers": "longbow",
  "smiad": "greatsword", "sobek": "falchion", "soralyon": "pick",
  "sorrows-sword": "bastard-sword", "sovyrian-conclave": "longbow,shortbow",
  "srikalis-sritaming-and-sribaril": "kris,arquebus",
  "ssilameshnik": "light-hammer",
  "stag-mother-of-the-forest-of-stones": "ranseur",
  "stones-blood": "warhammer", "sturovenen": "main-gauche",
  "sun-wukong": "bo-staff", "surveyors-of-the-deep": "trident",
  "suyuddha": "tekko-kagi", "szuriel": "greatsword",
  "talons-of-the-godclaw": "morningstar", "tanagaar": "kukri",
  "teki-stronggut": "longsword", "telastmar": "bola",
  "telvrys": "earthbreaker", "teshallas": "chakram", "thalaphyrr": "spear",
  "thamir": "dagger", "the-anointing-of-kings": "mace",
  "the-battered-chains": "spear", "the-circle-of-the-damned": "claws",
  "the-deliberate-journey": "crossbow", "the-devourer": "maul",
  "the-divine-dare": "spiked-gauntlet", "the-endless-road": "starknife",
  "the-enlightened-scholars-path": "staff", "the-freeing-flame": "sword-cane",
  "the-godclaw": "morningstar", "the-green-mother": "sickle",
  "the-laborers-bastion": "warhammer", "the-lady-of-the-north-star": "glaive",
  "the-lantern-king": "dagger", "the-last-breath": "dagger",
  "the-lost-prince": "staff", "the-offering-plate": "flail",
  "the-pale-horse": "trident", "the-pandemonia": "gnome-flickmace",
  "the-path-of-the-heavens": "starknife", "the-perplexing-jest": "war-razor",
  "the-readied-strike": "lance", "the-resplendent-court": "bladed-scarf",
  "the-spirit-wall": "claws,shield-boss", "the-tides-of-chaos": "dagger",
  "thisamet": "shortsword", "thoth": "sickle", "thremyr": "greataxe",
  "thuskchoon": "greatclub", "titivilus": "longsword", "tjasse": "spear",
  "tlehar": "morningstar", "tolte-coatl": "arbalest", "torag": "warhammer",
  "touch-of-the-sun": "rapier", "treasures-of-the-eternal-delve": "pick",
  "treerazer": "greataxe", "trelmarixian": "spiked-gauntlet",
  "tresmalvos": "halberd", "trudd": "warhammer", "tsukiyo": "spear",
  "turvu": "claws,staff", "uirch": "tekko-kagi", "ulon": "hand-crossbow",
  "umarik": "trident", "upion-and-warrik": "shield-boss",
  "urazra": "spiked-gauntlet", "urban-prosperity": "dagger",
  "urgathoa": "scythe", "uskyeria": "scimitar",
  "ussharassim": "dueling-pistol", "uvuko": "maul", "valani": "club",
  "vale": "war-flail", "valmallos": "kukri", "vapula": "staff",
  "varg": "greataxe", "vavaalrav": "shortbow", "velgaas": "spiked-chain",
  "venkelvore": "spear", "verilorn": "sickle", "vermilion-mother": "scythe",
  "vildeis": "dagger", "vineshvakhi": "longsword", "vonymos": "scythe",
  "vorasha": "spiked-chain", "vudravati": "longspear", "vulot": "dagger",
  "wadjet": "light-mace", "walkena": "spear", "wards-of-the-pharaoh": "staff",
  "waves-of-the-boundless-sea": "trident", "weight-of-the-world": "javelin",
  "wheels-of-innovation": "polytool", "winlas": "mace",
  "wulgren": "barricade-buster", "xhamen-dor": "spear",
  "xiquiripat": "macuahuitl", "xoveron": "ranseur", "xsistaid": "dart",
  "yaezhing": "shuriken", "yamasoth": "halberd", "yamatsumi": "greatclub",
  "ydajisk": "jaw,greatclub", "ydersius": "dagger", "yelayne": "staff",
  "yhidothrus": "spiked-chain", "yig": "fang,katar", "ylimancha": "longbow",
  "yluma": "claws,khakkhara", "ymeri": "longsword", "yog-sothoth": "dagger",
  "yrmidar": "light-hammer", "ytildos": "macuahuitl", "yuelral": "dagger",
  "zarongel": "dogslicer", "zeaki": "chakri", "zelishkar": "ranseur",
  "zevgavizeb": "spiked-gauntlet", "zibik": "scythe", "zipacna": "spear",
  "zjar-tovan": "greatsword", "zogmugot": "sickle", "zohls": "heavy-crossbow",
  "zon-kuthon": "spiked-chain", "zugero": "bola", "zura": "rapier",
  "zursvaater": "greatsword", "zyphus": "pick"
};
