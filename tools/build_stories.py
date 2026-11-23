#!/usr/bin/env python3
"""Convert the stories in spiko_v2_prompt.md (CONTENT section) into data/stories/*.json.

Format it reads (one story):
    ### Story 1 — Graduation Day (topic: Graduation)
    Scene 1 🏠 Home, 6:00 a.m. (alarm ringing)
    Mom: Adam! Wake up! Today is the big day!
    ...
    Multiple choice ...:
    1. Question? — option a / *correct option / option c
    Open questions — model answers:
    1. Question? — Model answer.
    6. (personal) Question? — Example: ...

Usage:  python3 tools/build_stories.py [spiko_v2_prompt.md]
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "spiko_v2_prompt.md"

IDS = {
    1: ("graduation-day", "🎓"),
    2: ("looking-for-a-job", "🔎"),
    3: ("the-first-interview", "😬"),
    4: ("rejected", "📧"),
    5: ("getting-better", "💪"),
    6: ("the-second-interview", "👔"),
    7: ("accepted", "🎉"),
}
# Key words highlighted in each story (all words are tappable anyway)
KEY_WORDS = {
    1: ["graduate", "nervous", "stomach", "suit", "late", "traffic", "congratulations", "scary", "ceremony", "proud", "neighbor", "certificate", "required"],
    2: ["experience", "ad", "customer", "service", "salary", "training", "solve", "apply", "skill", "upload", "department", "interview"],
    3: ["interview", "alarm", "traffic", "reception", "candidate", "obvious", "breathe", "hiring", "manager", "handle", "stress", "teamwork", "terrible"],
    4: ["interest", "position", "unfortunately", "candidate", "luck", "reject", "fail", "disaster", "rejection", "prepared"],
    5: ["research", "goal", "practice", "record", "weird", "pause", "professional", "eye", "contact", "calm", "focus", "podcast", "course"],
    6: ["iron", "print", "soldier", "battle", "chance", "recently", "opportunity", "grow", "deep", "breath", "plan", "impression", "regards"],
    7: ["offer", "position", "accept", "training", "wonderful", "proud", "failure", "lesson", "ready"],
}

def split_q(line):
    """'1. Question — answer' → (question, answer)"""
    body = re.sub(r"^\d+\.\s*", "", line.strip())
    q, a = body.split(" — ", 1)
    return q.strip(), a.strip()

def parse():
    text = SRC.read_text(encoding="utf-8")
    content = text.split("## CONTENT", 1)[1]
    blocks = re.split(r"^### ", content, flags=re.M)[1:]
    stories = []
    for block in blocks:
        lines = [l.rstrip() for l in block.splitlines()]
        head = re.match(r"Story (\d+) — (.+?) \(topic: (.+?)\)", lines[0])
        num, title, topic = int(head[1]), head[2].strip(), head[3].strip()
        scenes, choice, questions, mode = [], [], [], "scenes"
        for l in lines[1:]:
            if not l.strip() or l.startswith("When everything works"):
                continue
            if l.startswith("Multiple choice"):
                mode = "choice"; continue
            if l.startswith("Open questions"):
                mode = "open"; continue
            if mode == "scenes":
                m = re.match(r"Scene (\d+) (\S+) (.+?)(?: \(([^)]*)\))?$", l)
                if m:
                    scenes.append({"title": m[3].strip(), "emoji": m[2], **({"sound": m[4]} if m[4] else {}), "lines": []})
                    continue
                who, said = l.split(": ", 1)
                line = {"who": who.strip().lower()}
                note = re.match(r"^\(([^)]*)\)\s*(.*)$", said.strip())
                if note:                                   # (email notification) An email!
                    line["note"], said = note[1], note[2]
                line["text"] = said.strip()
                scenes[-1]["lines"].append(line)
            elif mode == "choice":
                q, rest = split_q(l)
                opts = [o.strip() for o in rest.split(" / ")]
                answer = next(i for i, o in enumerate(opts) if o.startswith("*"))
                opts = [o.lstrip("*").strip() for o in opts]
                choice.append({"q": q, "options": opts, "answer": answer})
            else:
                q, a = split_q(l)
                item = {"q": q, "a": a}
                if q.startswith("(personal)"):
                    item["q"] = q.replace("(personal)", "").strip()
                    item["personal"] = True
                questions.append(item)
        sid, cover = IDS[num]
        stories.append({
            "id": sid, "number": num, "title": title, "topic": topic, "cover": cover,
            "scenes": scenes, "words": KEY_WORDS.get(num, []),
            "choice": choice, "questions": questions,
        })
    return stories

def dump(story):
    d = lambda x: json.dumps(x, ensure_ascii=False)
    scenes = []
    for sc in story["scenes"]:
        head = {k: v for k, v in sc.items() if k != "lines"}
        body = ",\n".join("        " + d(l) for l in sc["lines"])
        scenes.append("    " + d(head)[:-1] + ', "lines": [\n' + body + "\n    ]}")
    out = ["{",
           f'  "id": {d(story["id"])},', f'  "number": {story["number"]},', f'  "title": {d(story["title"])},',
           f'  "cover": {d(story["cover"])},',
           '  "scenes": [\n' + ",\n".join(scenes) + "\n  ],",
           f'  "words": {d(story["words"])},',
           '  "choice": [\n' + ",\n".join("    " + d(c) for c in story["choice"]) + "\n  ],",
           '  "questions": [\n' + ",\n".join("    " + d(q) for q in story["questions"]) + "\n  ]",
           "}"]
    text = "\n".join(out) + "\n"
    json.loads(text)
    return text

if __name__ == "__main__":
    stories = parse()
    for s in stories:
        (ROOT / "data" / "stories" / f'{s["id"]}.json').write_text(dump(s), encoding="utf-8")
        n = sum(len(sc["lines"]) for sc in s["scenes"])
        print(f'Story {s["number"]}: {s["id"]}: {len(s["scenes"])} scenes, {n} lines, {len(s["choice"])} choice, {len(s["questions"])} open')
