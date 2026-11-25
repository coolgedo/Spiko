#!/usr/bin/env node
// Lists every word in data/stories/*.json (lines, questions, options) that the app
// can't find in data/dictionary.json. Run after adding a story:  node tools/check_dictionary.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = { window: {}, document: {}, localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/core.js"), "utf8") +
  ";this.lookupWord=lookupWord;this.load=(d)=>{DICT=d;FORMS=d._forms||{}};", ctx);
ctx.load(JSON.parse(fs.readFileSync(path.join(root, "data/dictionary.json"), "utf8")));
const WORD_RE = /(a\.m\.|p\.m\.|Mr\.|Ms\.|[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)*)/;   // same as js/app.js
const missing = {};
for (const f of fs.readdirSync(path.join(root, "data/stories")).filter((x) => x.endsWith(".json"))) {
  const s = JSON.parse(fs.readFileSync(path.join(root, "data/stories", f), "utf8"));
  const texts = [s.title,
    ...(s.scenes || []).flatMap((sc) => sc.lines.map((l) => l.text)),
    ...(s.paragraphs || []).flat(),
    ...(s.phrases || []).flatMap((p) => [p.phrase, p.meaning, p.ex]),
    ...(s.choice || []).flatMap((c) => [c.q, ...c.options]), ...(s.questions || []).flatMap((q) => [q.q, q.a]),
    ...(s.yourTurn ? [s.yourTurn.prompt, s.yourTurn.example] : []),
    ...(s.notice ? [s.notice.title, s.notice.rule, ...s.notice.pairs.flat(), ...(s.notice.fromStory || [])] : [])];
  for (const t of texts) t.split(WORD_RE).filter((_, i) => i % 2).forEach((w) => {
    if (!ctx.lookupWord(w)) (missing[w.toLowerCase()] = missing[w.toLowerCase()] || new Set()).add(f);
  });
}
const list = Object.entries(missing);
if (!list.length) console.log("✓ Every word is in data/dictionary.json");
else { console.log(`${list.length} words missing (add their base form to data/dictionary.json):`); list.forEach(([w, fs]) => console.log(`  ${w}  (${[...fs].join(", ")})`)); process.exitCode = 1; }
