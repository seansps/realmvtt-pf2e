# Parses Archives of Nethys' remastered evolution feats (its search index:
# category feat, trait Evolution, primary source Impossible Magic, saved as
# evo.json) into modules/eidolons/source/evolution-feats.json.
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
hits = [h["_source"] for h in json.load(open(src, encoding="utf-8"))["hits"]["hits"]]
feats = [s for s in hits if s.get("primary_source") == "Impossible Magic"]

ACTIONS = {"Single Action": "oneAction", "Two Actions": "twoActions", "Three Actions": "threeActions", "Reaction": "reaction", "Free Action": "free"}


def clean(text):
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<actions string=\"([^\"]+)\"\s*/>", "", text)
    text = text.replace("<ul>", "").replace("</ul>", "").replace("<li>", "\n- ").replace("</li>", "")
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return "\n".join(line.strip() for line in text.splitlines()).strip()


out_feats = []
for s in sorted(feats, key=lambda s: (s["level"], s["name"])):
    md = s["markdown"]
    head, _, body = md.partition("---")
    # Drop the "X leads to..." line and the feats it lists
    body = re.split(r"\n[^\n]* leads to\.\.\.", clean(body))[0].strip()
    fields = {}
    for label in ("Prerequisites", "Frequency", "Trigger", "Requirements"):
        m = re.search(r"\*\*" + label + r"\*\*\s*([^\n]+)", head)
        if m:
            fields[label.lower()] = clean(m.group(1)).rstrip(";").strip()
    out_feats.append({
        "name": s["name"],
        "level": s["level"],
        "actions": ACTIONS.get(s.get("actions", ""), ""),
        "traits": [t for t in s.get("trait", []) if t],
        **fields,
        "text": body,
        "page": re.search(r"pg\. \d+", md).group(0),
        "url": s["url"],
    })

json.dump(out_feats, open(out, "w", encoding="utf-8", newline="\n"), indent=2, ensure_ascii=False)
print(len(out_feats), "feats")
