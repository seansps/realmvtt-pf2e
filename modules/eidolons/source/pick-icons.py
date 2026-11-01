# Picks a Realm catalog icon for every record in modules/eidolons/records.json:
# an icon named for the record (its slug, or the feat without "(Eidolon)"),
# then the hand picks below, then one by kind. Writes icons.json.
import json, re, sys

catalog_path, records_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
catalog = [p for p in json.load(open(catalog_path, encoding="utf-8")) if p.startswith("/icons/fantasy/")]
records = json.load(open(records_path, encoding="utf-8"))

by_file = {}
for path in catalog:
    by_file.setdefault(path.rsplit("/", 1)[1][:-5], []).append(path)

PREFER = ["/features/classes/", "/feats/", "/actions/", "/spells/", "/features/", "/skills/summoner/"]


def rank(path):
    for i, part in enumerate(PREFER):
        if part in path:
            return i
    return len(PREFER)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("'", "").replace("’", "")).strip("-")


HAND = {
    "ancestry|Aberrant Eidolon": "/icons/fantasy/skills/summoner/tentacled-eye-creature.webp",
    "ancestry|Angel Eidolon": "/icons/fantasy/magic/air/angelic-wings-in-a-mystical-swirl.webp",
    "ancestry|Anger Phantom Eidolon": "/icons/fantasy/skills/aberrant/flame-wraith.webp",
    "ancestry|Beast Eidolon": "/icons/fantasy/skills/summoner/roaring-beast.webp",
    "ancestry|Construct Eidolon": "/icons/fantasy/skills/summoner/rock-golem-summoning.webp",
    "ancestry|Demon Eidolon": "/icons/fantasy/skills/summoner/summoned-demon-beast.webp",
    "ancestry|Devotion Phantom Eidolon": "/icons/fantasy/creatures/magical/spirit-undead-ghost-blue.webp",
    "ancestry|Dragon Eidolon": "/icons/fantasy/skills/summoner/fire-breathing-dragon.webp",
    "ancestry|Elemental Eidolon": "/icons/fantasy/skills/summoner/tornado-of-destruction.webp",
    "ancestry|Fey Eidolon": "/icons/fantasy/avatars/fey/elder-fairy-with-wings.webp",
    "ancestry|Ooze Eidolon": "/icons/fantasy/skills/summoner/glowing-green-slimes.webp",
    "ancestry|Plant Eidolon": "/icons/fantasy/skills/summoner/thorny-vines-with-glowing-tips.webp",
    "ancestry|Psychopomp Eidolon": "/icons/fantasy/features/classes/psychopomp.webp",
    "ancestry|Swarm Eidolon": "/icons/fantasy/skills/summoner/summoners-call-of-the-swarm.webp",
    "ancestry|Undead Eidolon": "/icons/fantasy/avatars/undead/skeleton-mage.webp",
    "class|Eidolon": "/icons/fantasy/features/classes/eidolon.webp",
    "items|Primary Attack": "/icons/fantasy/skills/summoner/summoners-claw-attack.webp",
    "items|Secondary Attack": "/icons/fantasy/skills/summoner/beastly-claws.webp",
    "items|Ranged Attack": "/icons/fantasy/skills/summoner/targeted-strike.webp",
    # Better than the word matches (a sawing action, a chair, sculptures...)
    "feats|Alacritous Action (Eidolon)": "/icons/fantasy/spells/fleet-step.webp",
    "feats|Amphibious Form (Eidolon)": "/icons/fantasy/spells/water-breathing.webp",
    "feats|Hulking Size (Eidolon)": "/icons/fantasy/spells/enlarge-companion.webp",
    "feats|Towering Size (Eidolon)": "/icons/fantasy/spells/enlarge.webp",
    "feats|Constricting Hold (Eidolon)": "/icons/fantasy/skills/summoner/snake-bind.webp",
    "feats|Defend Summoner (Eidolon)": "/icons/fantasy/spells/shield-other.webp",
    "feats|Advanced Weaponry (Eidolon)": "/icons/fantasy/skills/summoner/claw-of-summoning.webp",
    "feats|Airborne Form (Eidolon)": "/icons/fantasy/skills/summoner/dragon-wing.webp",
    "feats|Glider Form (Eidolon)": "/icons/fantasy/conditions-2/status_fly.webp",
    "feats|Burrowing Form (Eidolon)": "/icons/fantasy/spells/burrow-ward.webp",
    "feats|Protective Bond (Eidolon)": "/icons/fantasy/spells/shield-other.webp",
    "feats|Ranged Combatant (Eidolon)": "/icons/fantasy/skills/summoner/targeted-strike.webp",
    "feats|Eidolon's Trample (Eidolon)": "/icons/fantasy/skills/summoner/summoned-demon-beast.webp",
    "feats|Summoner Dedication (Eidolon)": "/icons/fantasy/classes/summoner.webp",
    "feats|Expanded Senses (Eidolon)": "/icons/fantasy/spells/enhance-senses.webp",
    "actions|Field of Roots": "/icons/fantasy/features/classes/entangling-form.webp",
    "features|Field of Roots": "/icons/fantasy/features/classes/entangling-form.webp",
    "actions|Empower Breath": "/icons/fantasy/creatures/abilities/dragon-fire-breath-orange.webp",
    "features|Empower Breath": "/icons/fantasy/creatures/abilities/dragon-fire-breath-orange.webp",
    "actions|Primal Roar": "/icons/fantasy/skills/summoner/feral-roar.webp",
    "features|Primal Roar": "/icons/fantasy/skills/summoner/feral-roar.webp",
    "features|Twin Juggernauts": "/icons/fantasy/features/classes/greater-juggernaut.webp",
}
KIND = {
    "feats": "/icons/fantasy/features/classes/eidolon-symbiosis.webp",
    "features": "/icons/fantasy/features/classes/eidolon.webp",
    "actions": "/icons/fantasy/skills/summoner/summoners-fury.webp",
}

STOP = {"eidolon", "eidolons", "form", "your", "with", "their", "attack"}
keys = []


def walk(node):
    if isinstance(node, dict):
        if node.get("recordType") in ("ancestry", "class", "feats", "features", "actions", "items") and node.get("name"):
            keys.append(f"{node['recordType']}|{node['name']}")
        for value in node.values():
            walk(value)
    elif isinstance(node, list):
        for value in node:
            walk(value)


walk(records)
icons, how = {}, {"exact": 0, "hand": 0, "kind": 0}
for key in dict.fromkeys(keys):
    kind, name = key.split("|", 1)
    base = re.sub(r"\s*\(Eidolon\)$", "", name)
    if key in HAND:
        icons[key] = HAND[key]; how["hand"] += 1; continue
    exact = sorted(by_file.get(slug(base), []), key=rank)
    if exact and kind != "ancestry":
        icons[key] = exact[0]; how["exact"] += 1; continue
    words = [w for w in slug(base).split("-") if len(w) > 3 and w not in STOP]
    words.sort(key=len, reverse=True)
    found = None
    for word in words:
        hits = sorted([path for name, paths in by_file.items() if re.search(r"(^|-)" + word + r"(-|$)", name) for path in paths], key=lambda path: (rank(path), len(path)))
        hits = [h for h in hits if rank(h) < len(PREFER)] or hits
        if hits:
            found = hits[0]; break
    if found and kind != "ancestry":
        icons[key] = found; how["word"] = how.get("word", 0) + 1; continue
    if kind in KIND:
        icons[key] = KIND[kind]; how["kind"] += 1
missing = [k for k in HAND.values() if k not in catalog]
assert not missing, missing
json.dump(dict(sorted(icons.items())), open(out, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
print(len(icons), how)
