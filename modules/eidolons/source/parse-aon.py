# Parses Archives of Nethys' remastered eidolon entries (its search index,
# saved as remaster.json) into modules/eidolons/source/eidolon-types.json.
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
entries = json.load(open(src, encoding="utf-8"))

ACTIONS = {"Single Action": "oneAction", "Two Actions": "twoActions", "Three Actions": "threeActions", "Reaction": "reaction", "Free Action": "free"}
STANDARD = [
    {"name": "Strength", "str": 4, "dex": 2, "ac": 2, "dexCap": 3},
    {"name": "Dexterity", "str": 2, "dex": 4, "ac": 1, "dexCap": 4},
]


def clean(text):
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<actions string=\"([^\"]+)\"\s*/>", "", text)
    text = text.replace("<ul>", "").replace("</ul>", "").replace("<li>", "\n- ").replace("</li>", "")
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return "\n".join(line.strip() for line in text.splitlines()).strip()


def field(md, label):
    m = re.search(r"\*\*" + label + r"\*\*[ \t]*([^\n]*)", md)
    return clean(m.group(1)) if m else ""


def arrays(md):
    found = []
    for m in re.finditer(r"\*\*([A-Z][a-z]+ [A-Z][a-z]+)\*\*\s*\n((?:- [^\n]*\n)+)", md):
        values = dict(re.findall(r"- (Str|Dex|Con|Int|Wis|Cha) (-?\d+)", m.group(2)))
        ac = re.search(r"\+(\d+) AC \(\+(\d+) Dex cap\)", m.group(2))
        if len(values) == 6 and ac:
            found.append({"name": m.group(1), **{k.lower(): int(v) for k, v in values.items()}, "ac": int(ac.group(1)), "dexCap": int(ac.group(2))})
    if found:
        return found
    values = dict(re.findall(r"- (Con|Int|Wis|Cha) (-?\d+)", md))
    rest = {k.lower(): int(v) for k, v in values.items()}
    return [{**a, **rest} for a in STANDARD]


def abilities(md):
    names = {}
    for kind in ("Initial", "Symbiosis", "Transcendence"):
        m = re.search(r"- \*\*" + kind + r"\*\* ([^<\n]+?)\s*(?:<actions string=\"([^\"]+)\"\s*/>)?\s*\n", md)
        if m:
            names[kind.lower()] = {"name": m.group(1).strip(), "actions": ACTIONS.get(m.group(2), "")}
    sections = re.split(r"<title level=\"2\"[^>]*>", md)[1:]
    texts = {}
    for section in sections:
        title, _, body = section.partition("</title>")
        texts[clean(title)] = clean(body)
    for ability in names.values():
        ability["text"] = texts.get(ability["name"], "")
    return names


types = []
for e in sorted(entries, key=lambda e: e["name"]):
    md = e["markdown"]
    intro = md.split("**Source**", 1)[1].split("\n", 1)[1].split("<column", 1)[0]
    speed = {"land": 25}
    raw = e.get("speed_raw") or ""
    for kind, feet in re.findall(r"(?:(climb|fly|swim|burrow) )?(\d+) feet", raw):
        speed[kind or "land"] = int(feet)
    types.append({
        "name": f"{e['name']} Eidolon",
        "source": e["primary_source"],
        "page": re.search(r"pg\. \d+", md).group(0),
        "traits": [t for t in e.get("trait", []) if t],
        "tradition": (e.get("tradition") or [""])[0],
        "homePlane": field(md, "Home Plane"),
        "size": field(md, "Size"),
        "suggestedAttacks": field(md, "Suggested Attacks"),
        "arrays": arrays(md),
        "skills": e.get("skill") or [],
        "senses": field(md, "Senses"),
        "language": field(md, "Language"),
        "speed": speed,
        "abilities": abilities(md),
        "description": clean(intro),
        "url": e["url"],
    })

# Dragon's tradition and skills come from a choice that the entry leaves blank
# (Foundry's Companion Compendia: the tradition's trait and skill, plus
# Intimidation)
for t in types:
    if t["name"] == "Dragon Eidolon":
        t["tradition"] = ""
        t["skills"] = ["Intimidation"]
        t["traditionChoice"] = {"Arcane": "Arcana", "Divine": "Religion", "Occult": "Occultism", "Primal": "Nature"}

json.dump(types, open(out, "w", encoding="utf-8", newline="\n"), indent=2, ensure_ascii=False)
print(len(types), "types")
