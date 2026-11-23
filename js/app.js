/* Spiko — app screens: home (topic covers) → topic (story list) → story → questions → done, My words.
   Content: data/sections.json, data/stories/<id>.json, data/dictionary.json. Depends on core.js. */
"use strict";

let STORIES = [];     // all loaded stories, in order, with section info
let SECTIONS = [];    // topics from sections.json (+ .loaded stories)
let ONBOARD = null;
let CHARS = {};       // data/characters.json — shared by all stories

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(url + " " + res.status);
  return res.json();
}

const app = () => $("#app");
const state = { storyId: null, playing: false, index: 0, revealed: false, qIndex: 0, cIndex: 0, choiceScore: 0 };
let currentStory = null;

function storyById(id) { return STORIES.find((s) => s.id === id); }
function sectionById(id) { return SECTIONS.find((s) => s.id === id); }

/* =====================================================================
   Router
   ===================================================================== */
function startApp() {
  show("app-shell");
  updateCount();
  window.addEventListener("hashchange", route);
  route();
}

function route() {
  Voice.stop();
  Recorder.reset();
  Listener.abort();
  closeSheet();
  state.playing = false;
  app().onclick = null;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);
  if (parts[0] === "words") return renderWords();
  if (parts[0] === "section") {
    const sec = sectionById(parts[1]);
    return sec && sec.open ? renderSection(sec) : renderHome();
  }
  if (parts[0] === "topic") {
    const sec = sectionById(parts[1]);
    const topic = topicById(sec, parts[2]);
    return topic ? renderTopic(sec, topic) : (sec ? renderSection(sec) : renderHome());
  }
  if (parts[0] === "story") {
    const story = storyById(parts[1]);
    if (!story) return renderHome();
    currentStory = story;
    if (state.storyId !== story.id) {
      Object.assign(state, { storyId: story.id, index: 0, revealed: !!Progress.get(story.id).read, qIndex: 0, cIndex: 0, choiceScore: 0 });
    }
    if (parts[2] === "choice") return renderChoice(story);
    if (parts[2] === "questions") return renderQuestions(story);
    if (parts[2] === "done") return renderDone(story);
    return renderStory(story);
  }
  renderHome();
}

/* =====================================================================
   Navigation: Home (section covers) → Section (topic cards) → Topic (stories)
   ===================================================================== */
function topicById(sec, id) { return sec && sec.topics.find((t) => t.id === id); }
function slotsOf(sec) { return sec.topics.flatMap((t) => t.slots); }

/** Progress for a list of story slots → { total, done, pct } */
function slotStats(slots) {
  const total = slots.length;
  const done = slots.filter((s) => s.story && Progress.get(s.story.id).done).length;
  const pct = slots.reduce((a, s) => a + (s.story ? Progress.percent(s.story.id) : 0), 0) / Math.max(total, 1);
  return { total, done, pct };
}
function sectionStats(sec) { return slotStats(slotsOf(sec)); }

function progressBar(pct, cls = "") {
  return `<div class="progress ${cls}"><span style="width:${Math.round(pct * 100)}%"></span></div>`;
}

function renderHome() {
  const lastId = store.get("spiko.last", null);
  const last = lastId && storyById(lastId);
  const next = (last && !Progress.get(last.id).done) ? last
    : STORIES.find((s) => !Progress.get(s.id).done) || STORIES[0];
  const doneCount = STORIES.filter((s) => Progress.get(s.id).done).length;

  app().innerHTML = `
    <section class="hello">
      <div>
        <p class="hello-small">Hi there 👋</p>
        <h1 class="hello-title">Ready for your<br/>15 minutes?</h1>
      </div>
      <div class="hello-stat"><b>${doneCount}</b><span>stories<br/>done</span></div>
    </section>

    ${next ? `
    <a class="continue-card" href="#/story/${esc(next.id)}">
      <span class="cc-cover">${esc(next.cover || "📖")}</span>
      <span class="cc-body">
        <small>${Progress.get(next.id).done ? "Done ✓ · Listen again" : Progress.percent(next.id) > 0 ? "Continue" : "Start here"} · ${esc(next.topic)}</small>
        <b>${esc(next.title)}</b>
        ${progressBar(Progress.percent(next.id), "thin")}
      </span>
      <span class="cc-go">${ICON.play}</span>
    </a>` : ""}

    <h2 class="h2">Choose your world</h2>
    <div class="covers">
      ${SECTIONS.map((sec, i) => {
        const st = sectionStats(sec);
        const inner = `
          <span class="cover-emoji">${esc(sec.cover || "📚")}</span>
          <span class="cover-title">${esc(sec.title)}</span>
          ${sec.titleAr ? `<span class="cover-ar" lang="ar" dir="rtl">${esc(sec.titleAr)}</span>` : ""}
          ${sec.open
            ? `<span class="cover-meta">${st.done} / ${st.total} stories</span>${progressBar(st.pct, "thin")}`
            : `<span class="soon-badge" lang="ar">قريبًا</span>`}`;
        const cls = `cover cover-${esc(sec.color || "blue")}${i === 0 ? " cover-wide" : ""}${sec.open ? "" : " locked"}`;
        return sec.open
          ? `<a class="${cls}" href="#/section/${esc(sec.id)}" style="animation-delay:${i * 0.06}s">${inner}</a>`
          : `<button class="${cls}" type="button" data-locked="${esc(sec.title)}" style="animation-delay:${i * 0.06}s" aria-disabled="true">${inner}</button>`;
      }).join("")}
    </div>`;

  app().onclick = (e) => {
    const l = e.target.closest("[data-locked]");
    if (l) toast(`${l.dataset.locked} — قريبًا 🚀`);
  };
}

function renderSection(sec) {
  const st = sectionStats(sec);
  app().innerHTML = `
    <a href="#/" class="back-link">${ICON.back}Home</a>
    <header class="topic-head cover-${esc(sec.color || "blue")}">
      <span class="cover-emoji">${esc(sec.cover || "📚")}</span>
      <div>
        <h1>${esc(sec.title)}</h1>
        ${sec.titleAr ? `<p lang="ar" dir="rtl">${esc(sec.titleAr)}</p>` : ""}
        <small>${st.done} of ${st.total} stories done</small>
      </div>
    </header>
    ${progressBar(st.pct)}
    <h2 class="h2">Topics</h2>
    <div class="topic-grid">
      ${sec.topics.map((t, i) => {
        const ts = slotStats(t.slots);
        const nums = t.slots.map((s) => s.number);
        const range = nums.length > 1 ? `Stories ${nums[0]}–${nums[nums.length - 1]}` : `Story ${nums[0]}`;
        return `<a class="topic-card${ts.done === ts.total && ts.total ? " complete" : ""}" href="#/topic/${esc(sec.id)}/${esc(t.id)}" style="animation-delay:${i * 0.06}s">
          <span class="tc-cover">${esc(t.cover || "📖")}</span>
          <span class="tc-title">${esc(t.title)}</span>
          <span class="tc-ar" lang="ar" dir="rtl">${esc(t.titleAr || "")}</span>
          <span class="tc-meta">${range} · ${ts.total} ${ts.total === 1 ? "story" : "stories"}</span>
          <span class="tc-done">${ts.done === ts.total && ts.total ? "✓ Completed" : `${ts.done} / ${ts.total} completed`}</span>
          ${progressBar(ts.pct, "thin")}
        </a>`;
      }).join("")}
    </div>`;
}

function renderTopic(sec, topic) {
  const ts = slotStats(topic.slots);
  const rows = topic.slots.map((slot) => {
    const story = slot.story;
    if (!story) {
      return `<li><button class="story-row soon" type="button" data-soon="${slot.number}">
        <span class="sr-num">${slot.number}</span><span class="sr-cover">🔒</span>
        <span class="sr-body"><b>Story ${slot.number}</b><small>Coming soon · <span lang="ar">قريبًا</span></small></span></button></li>`;
    }
    const p = Progress.get(story.id);
    const pct = Progress.percent(story.id);
    const status = p.done ? "✓" : pct > 0 ? `${Math.round(pct * 100)}%` : "New";
    return `<li><a class="story-row${p.done ? " done" : ""}" href="#/story/${esc(story.id)}">
      <span class="sr-num">${p.done ? ICON.check : slot.number}</span>
      <span class="sr-cover">${esc(story.cover || "📖")}</span>
      <span class="sr-body"><small>Story ${slot.number}</small><b>${esc(story.title)}</b>${progressBar(pct, "thin")}</span>
      <span class="sr-status">${status}</span></a></li>`;
  }).join("");

  app().innerHTML = `
    <a href="#/section/${esc(sec.id)}" class="back-link">${ICON.back}${esc(sec.title)}</a>
    <header class="topic-head cover-light">
      <span class="cover-emoji">${esc(topic.cover || "📖")}</span>
      <div>
        <h1>${esc(topic.title)}</h1>
        ${topic.titleAr ? `<p lang="ar" dir="rtl">${esc(topic.titleAr)}</p>` : ""}
        <small>${ts.done} of ${ts.total} completed</small>
      </div>
    </header>
    ${progressBar(ts.pct)}
    <ol class="story-list">${rows}</ol>`;

  app().onclick = (e) => {
    const s = e.target.closest("[data-soon]");
    if (s) toast(`Story ${s.dataset.soon} is coming soon 🚀`);
  };
}

/* =====================================================================
   Boot
   ===================================================================== */
async function boot() {
  Voice.init();
  $("#word-sheet").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  $$("[data-skip]").forEach((b) => b.addEventListener("click", finishOnboarding));

  try {
    const [sec, dict, o, chars] = await Promise.all([
      loadJSON("data/sections.json"), loadJSON("data/dictionary.json"), loadJSON("data/onboarding.json"),
      loadJSON("data/characters.json").catch(() => ({}))
    ]);
    CHARS = chars || {};
    ONBOARD = o;
    FORMS = (dict && dict._forms) || {};
    DICT = dict || {};
    SECTIONS = sec.sections || [];
    // sections → topics → story slots. A slot with an "id" loads data/stories/<id>.json;
    // a slot without one (or whose file is missing) shows as "Coming soon".
    const jobs = [];
    SECTIONS.forEach((section) => {
      section.topics = section.topics || [];
      section.total = section.topics.reduce((n, t) => n + (t.stories || []).length, 0);
      section.topics.forEach((topic) => {
        topic.slots = (topic.stories || []).map((slot) => ({ ...slot, story: null }));
        topic.slots.forEach((slot) => {
          if (!slot.id) return;
          jobs.push(loadJSON(`data/stories/${slot.id}.json`).then((story) => {
            slot.story = {
              ...story, id: story.id || slot.id, number: slot.number || story.number,
              section: section.title, sectionId: section.id, sectionTotal: section.total,
              topic: topic.title, topicAr: topic.titleAr, topicId: topic.id
            };
          }).catch(() => { /* file missing → Coming soon */ }));
        });
      });
    });
    await Promise.all(jobs);
    STORIES = SECTIONS.flatMap((sec) => sec.topics.flatMap((t) => t.slots.map((sl) => sl.story).filter(Boolean)));
  } catch (e) {
    show("app-shell");
    app().innerHTML = `<p class="empty">Couldn't load the stories.<br/>If you opened the file directly, run a local server (see README).</p>`;
    return;
  }

  if (store.get(KEY_ONBOARDED, false)) startApp();
  else runSplash();
}

/* ---------- Story helpers ---------- */
function linesOf(story) {
  return story.scenes ? story.scenes.flatMap((sc) => sc.lines) : (story.paragraphs || []).flat().map((text) => ({ who: "narrator", text }));
}
function lookupKeyWord(story, word) {
  const r = lookupWord(word);
  return r && { ...r, key: ((story && story.words) || []).includes(r.base) };
}

/* =====================================================================
   Story view: scenes with chat bubbles, a voice per character,
   speed switch, listen first → then read, tappable words
   ===================================================================== */
// Same word pattern as the dictionary builder: a.m./p.m./Mr./Ms., accented letters, contractions
const WORD_RE = /(a\.m\.|p\.m\.|Mr\.|Ms\.|[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)*)/;

function tokenize(text, story) {
  // Every word becomes a tappable span; the story's key words are highlighted
  return String(text).split(WORD_RE).map((part, i) => {
    if (i % 2 === 0) return esc(part);
    const key = lookupKeyWord(story, part.toLowerCase());
    return `<span class="w${key && key.key ? " key" : ""}" data-w="${esc(part)}">${esc(part)}</span>`;
  }).join("");
}

function charOf(story, who) {
  return CHARS[who] || (story.characters || {})[who] || { name: who.charAt(0).toUpperCase() + who.slice(1), color: "grey", gender: "male", slot: 0 };
}

function lineHTML(story, line, i) {
  const c = charOf(story, line.who);
  return `<div class="line say c-${esc(c.color || "grey")}${c.main ? " me" : ""}" data-i="${i}">
      <button class="avatar" type="button" data-replay="${i}" aria-label="Hear ${esc(c.name)}">${esc(c.name.charAt(0))}</button>
      <div class="bubble" data-bubble="${i}">
        <span class="who">${esc(c.name)}</span>
        ${line.note ? `<span class="note">(${esc(line.note)})</span>` : ""}
        <span class="txt">${tokenize(line.text, story)}</span>
      </div>
    </div>`;
}

function renderStory(story) {
  const lines = linesOf(story);
  const items = lines.map((l, i) => ({
    text: l.text,
    character: charOf(story, l.who),
    audio: l.audio || (Array.isArray(story.audio) ? story.audio[i] : null)
  }));
  const scenes = story.scenes || [{ title: "", lines }];
  let n = 0;
  const scenesHTML = scenes.map((sc, si) => `
    <section class="scene">
      <div class="scene-card">
        <span class="scene-emoji">${esc(sc.emoji || sc.place || "🎬")}</span>
        <span class="scene-info"><small>Scene ${si + 1}</small><b>${esc(sc.title || "")}</b>
        ${sc.sound ? `<span class="scene-sound">🔊 ${esc(sc.sound)}</span>` : ""}</span>
      </div>
      ${sc.lines.map((l) => lineHTML(story, l, n++)).join("")}
    </section>`).join("");
  const speed = store.get(KEY_SPEED, "normal");

  app().innerHTML = `
    <a href="#/topic/${esc(story.sectionId)}/${esc(story.topicId)}" class="back-link">${ICON.back}${esc(story.topic)}</a>
    <div class="story-hero">
      <span class="story-cover">${esc(story.cover || "📖")}</span>
      <div>
        <p class="eyebrow">Story ${esc(story.number)}${story.sectionTotal ? ` of ${esc(story.sectionTotal)}` : ""}</p>
        <h1 class="story-title">${esc(story.title)}</h1>
      </div>
    </div>

    <div id="read-gate" class="read-gate">
      <span class="rg-ear">🎧</span>
      <div class="rg-body"><b>Listen first</b><small>Press Listen and follow the bubbles. Then tap Read.</small></div>
      <button id="btn-read" class="btn btn-primary" type="button">${ICON.book}<span>Read</span></button>
    </div>
    <p id="tap-hint" class="tap-hint" hidden>Tap any word to see its meaning. Tap a bubble to hear it again.</p>

    <div id="story-body" class="story-body locked" lang="en">${scenesHTML}</div>
    <div id="story-cheer"></div>

    <div class="next-step">
      <a class="btn btn-navy btn-block btn-big" href="#/story/${esc(story.id)}/choice">Answer the questions →</a>
    </div>

    <div class="player-bar">
      <div class="speed" role="radiogroup" aria-label="Speed">
        ${SPEEDS.map((s) => `<button type="button" role="radio" data-speed="${s.id}" aria-checked="${s.id === speed}">${esc(s.label)}</button>`).join("")}
      </div>
      <div class="player-row">
        <button id="btn-replay" class="icon-btn" type="button" aria-label="Start again">${ICON.replay}</button>
        <button id="btn-listen" class="btn btn-listen" type="button">${ICON.play}<span>Listen</span></button>
        <span id="player-status" class="player-status"></span>
      </div>
    </div>`;

  const body = $("#story-body");
  const btnListen = $("#btn-listen");
  const status = $("#player-status");

  const setActive = (i) => {
    $$(".line.active", body).forEach((el) => el.classList.remove("active"));
    if (i == null) return;
    const el = body.querySelector(`.line[data-i="${i}"]`);
    if (el) { el.classList.add("active"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
  const setUI = () => {
    btnListen.innerHTML = state.playing ? `${ICON.pause}<span>Pause</span>`
      : `${ICON.play}<span>${state.index > 0 ? "Continue" : (Progress.get(story.id).listened ? "Listen again" : "Listen")}</span>`;
    const l = lines[state.index];
    status.textContent = state.playing && l ? `${state.index + 1}/${lines.length} · ${charOf(story, l.who).name}` : (state.index > 0 ? "Paused" : "");
  };
  const play = (from) => {
    state.playing = true;
    Voice.playList(items, from, {
      onItem: (i) => { state.index = i; setActive(i); setUI(); },
      onDone: () => {
        state.playing = false; state.index = 0; setActive(null); setUI();
        Progress.set(story.id, { listened: true });
        $("#story-cheer").innerHTML = spikoSays(state.revealed
          ? "Well done! Now answer the questions out loud."
          : "Great listening! Now tap Read and follow the story.");
        if (!state.revealed) { $("#btn-read").classList.add("pulse"); $("#read-gate").scrollIntoView({ behavior: "smooth", block: "center" }); }
      }
    });
    setUI();
  };
  const pause = () => { Voice.stop(); state.playing = false; setUI(); };
  btnListen.onclick = () => (state.playing ? pause() : play(state.index));
  $("#btn-replay").onclick = () => { state.index = 0; play(0); };

  // Speed switch — applies from the current line
  $$("[data-speed]").forEach((b) => b.onclick = () => {
    store.set(KEY_SPEED, b.dataset.speed);
    $$("[data-speed]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    if (state.playing) play(state.index);
  });

  // Listen first → then read
  const reveal = () => {
    state.revealed = true;
    Progress.set(story.id, { read: true });
    body.classList.remove("locked");
    $("#read-gate").hidden = true;
    $("#tap-hint").hidden = false;
  };
  $("#btn-read").onclick = reveal;
  if (state.revealed) reveal();
  setUI();

  body.addEventListener("click", (e) => {
    const w0 = state.revealed && e.target.closest(".w");
    const rep = !w0 && (e.target.closest("[data-replay]") || e.target.closest("[data-bubble]"));
    if (rep) {                                     // tap a bubble or avatar: hear that line again
      const i = +(rep.dataset.replay || rep.dataset.bubble);
      state.playing = false;
      Voice.stop();
      setActive(i);
      Voice.playItem(items[i], () => setActive(null));
      setUI();
      return;
    }
    if (!state.revealed) return;
    const w = e.target.closest(".w");
    if (!w) return;
    if (state.playing) pause();
    $$(".w.tapped").forEach((x) => x.classList.remove("tapped"));
    w.classList.add("tapped");
    openWord(w.dataset.w, story);
  });
}

function closeSheet() {
  const s = $("#word-sheet");
  if (s) s.hidden = true;
  document.querySelectorAll(".w.tapped").forEach((x) => x.classList.remove("tapped"));
}

let sheetReq = 0;
async function openWord(raw, story) {
  const req = ++sheetReq;
  const lower = raw.toLowerCase().replace(/’/g, "'");
  const key = lookupKeyWord(story, lower);
  const word = key ? key.base : lower;
  const sheet = $("#word-sheet");
  const meaningEl = $("#sheet-meaning");
  const metaEl = $("#sheet-meta");
  const saveBtn = $("#sheet-save");
  let meaning = "";

  $("#sheet-word").textContent = word;
  $("#sheet-emoji").textContent = (key && key.emoji) || "";
  const exEl = $("#sheet-ex");
  exEl.hidden = !(key && key.ex);
  exEl.innerHTML = key && key.ex ? `<small>Example</small>${esc(key.ex)}` : "";
  $("#sheet-more").href = "https://www.oxfordlearnersdictionaries.com/definition/english/" + encodeURIComponent(word.split("'")[0].replace(/\./g, ""));
  const from = key && key.base !== lower ? `from “${raw}” · ` : "";
  metaEl.textContent = key ? from + (key.key ? "Key word ⭐" : "Spiko dictionary") : "";
  sheet.hidden = false;

  const setSave = () => {
    const saved = Words.has(word);
    saveBtn.textContent = saved ? "Saved ✓" : "Save";
    saveBtn.classList.toggle("saved", saved);
  };
  setSave();
  saveBtn.onclick = () => {
    if (Words.has(word)) { Words.remove(word); toast("Removed from My words"); }
    else { Words.add({ word, meaning, ex: key && key.ex, emoji: key && key.emoji, story: story.id, date: Date.now() }); toast("Saved to My words ⭐"); }
    setSave();
  };
  $("#sheet-say").onclick = () => { Voice.say(word, () => { if (key && key.ex) Voice.say(key.ex); }); };
  Voice.say(word);

  if (key) {
    meaning = key.meaning;
    meaningEl.classList.remove("loading");
    meaningEl.textContent = meaning;
    return;
  }
  meaningEl.classList.add("loading");
  meaningEl.textContent = "Looking it up…";
  try {
    // Not in our dictionary: try the word, then its base forms, online
    let d = null;
    for (const cand of baseForms(word).slice(0, 4)) {
      try { d = await fetchDefinition(cand); if (cand !== word) d = { ...d, base: cand }; break; } catch (e) { /* try next */ }
    }
    if (req !== sheetReq) return;
    if (!d) throw new Error("not found");
    meaning = d.def;
    metaEl.textContent = [d.base ? `base form: ${d.base}` : "", d.pos, d.phonetic].filter(Boolean).join(" · ");
    meaningEl.textContent = meaning;
  } catch (e) {
    if (req !== sheetReq) return;
    meaningEl.textContent = navigator.onLine === false ? "You are offline. Tap “More” later." : "No short meaning found. Tap “More”.";
  }
  meaningEl.classList.remove("loading");
}


/* =====================================================================
   Questions — part 1: multiple choice (tap or say the answer)
               part 2: open questions (answer by voice → "We heard", feedback)
   ===================================================================== */
const STOP_WORDS = new Set("a an the is are was were am be to of in on at and or but so he she it they i you we his her their my your our its this that there then do does did not no yes because example".split(" "));

function normWords(text) {
  return (String(text).toLowerCase().replace(/[’]/g, "'").match(/[a-z]+(?:'[a-z]+)?/g) || [])
    .map((w) => { const r = lookupWord(w); return r ? r.base : w.replace(/s$/, ""); });
}
function contentWords(text) { return normWords(text).filter((w) => !STOP_WORDS.has(w)); }

/** Which option did the learner say? → index or -1 */
function matchOption(transcript, options) {
  const t = transcript.toLowerCase().trim();
  const letter = t.match(/^(?:option |answer |letter |the )?([abc])\b|^(?:option |answer )?(one|two|three|first|second|third)\b/);
  if (letter) {
    const m = letter[1] || letter[2];
    const map = { a: 0, b: 1, c: 2, one: 0, two: 1, three: 2, first: 0, second: 1, third: 2 };
    if (map[m] != null && map[m] < options.length) return map[m];
  }
  const said = new Set(normWords(t));
  let best = -1, bestScore = 0, tie = false;
  options.forEach((opt, i) => {
    const words = contentWords(opt).length ? contentWords(opt) : normWords(opt);
    const hit = words.filter((w) => said.has(w)).length / Math.max(words.length, 1);
    if (hit > bestScore) { best = i; bestScore = hit; tie = false; } else if (hit === bestScore && hit > 0) tie = true;
  });
  return bestScore >= 0.5 && !tie ? best : -1;
}

/** Compare an open answer with the model answer → { level, hits } */
function gradeAnswer(transcript, q) {
  const said = normWords(transcript);
  if (!said.length) return { level: "none", hits: new Set() };
  if (q.personal) return { level: said.length >= 6 ? "great" : said.length >= 3 ? "good" : "try", hits: new Set() };
  const model = [...new Set(contentWords(q.a))];
  const saidSet = new Set(said);
  const hits = new Set(model.filter((w) => saidSet.has(w)));
  const score = hits.size / Math.max(model.length, 1);
  return { level: score >= 0.6 ? "great" : score >= 0.3 ? "good" : "try", hits };
}

const FEEDBACK = {
  great: ["Excellent! 🎉 That's a great answer. Now listen to the model answer and repeat it.",
          "Wow, great English! Listen to the model answer and say it one more time."],
  good:  ["Good job! You're close. Now listen to the model answer and repeat it.",
          "Nice! Now listen to the model answer and repeat it."],
  try:   ["Nice try! Listen to the model answer, then say it again out loud.",
          "Good effort! Tap “Show answer”, listen, and try once more."],
  none:  ["I didn't hear any words. Tap the mic and speak a little louder."]
};
const pick = (arr, i) => arr[i % arr.length];

function heardHTML(text, hits) {
  if (!text) return "";
  const html = text.split(/(\s+)/).map((w) => {
    const b = normWords(w)[0];
    return b && hits && hits.has(b) ? `<mark>${esc(w)}</mark>` : esc(w);
  }).join("");
  return `<small>We heard</small>“${html}”`;
}

function qHeader(story, part, title, i, total) {
  return `
    <a href="#/story/${esc(story.id)}" class="back-link">${ICON.back}${esc(story.title)}</a>
    <p class="eyebrow">${part}</p>
    <h1 class="page-title">${title} <span class="q-count">${i + 1} / ${total}</span></h1>
    ${progressBar((i + 1) / total)}`;
}

/* ---------- Part 1: multiple choice ---------- */
function renderChoice(story) {
  const list = story.choice || [];
  if (!list.length) { location.replace(`#/story/${story.id}/questions`); return; }
  const i = Math.min(state.cIndex, list.length - 1);
  if (i === 0) state.choiceScore = 0;
  const q = list[i];
  const canSpeak = Listener.supported();
  let answered = false;

  app().innerHTML = `
    ${qHeader(story, "Part 1 · Choose the answer", "Question", i, list.length)}
    <div class="q-card">
      <div class="q-row">
        <p class="q-text" lang="en">${esc(q.q)}</p>
        <button id="q-say" class="icon-btn" type="button" aria-label="Hear the question">${ICON.speaker}</button>
      </div>
      <div class="options">
        ${q.options.map((o, k) => `<button class="option" type="button" data-opt="${k}"><span class="opt-letter">${"ABC"[k] || k + 1}</span><span>${esc(o)}</span></button>`).join("")}
      </div>
      ${canSpeak ? `<button id="c-mic" class="btn btn-primary btn-block mic-btn" type="button">${ICON.mic}<span>Say your answer</span></button>` : ""}
      <p id="c-heard" class="heard" hidden></p>
    </div>
    <div id="c-feedback"></div>
    <button id="c-next" class="btn btn-orange btn-block btn-big" type="button" hidden>${i + 1 < list.length ? "Next →" : "Part 2: Speak →"}</button>`;

  const readQuestion = () => Voice.say(`${q.q} ${q.options.map((o, k) => `${"ABC"[k]}: ${o}.`).join(" ")}`);
  $("#q-say").onclick = readQuestion;
  setTimeout(() => { if ($("#q-say")) readQuestion(); }, 300);

  const choose = (k, how) => {
    if (answered) return;
    answered = true;
    Listener.abort();
    const ok = k === q.answer;
    if (ok) state.choiceScore++;
    $$(".option").forEach((b, n) => {
      b.disabled = true;
      if (n === q.answer) b.classList.add("correct");
      else if (n === k) b.classList.add("wrong");
    });
    const right = q.options[q.answer];
    $("#c-feedback").innerHTML = spikoSays(ok ? `Correct! 🎉 ${how === "voice" ? "Great speaking!" : ""}` : `Not quite. The answer is: “${right}”. Say it out loud!`, ok ? "good" : "");
    Voice.say(ok ? `Correct! ${right}.` : `The answer is: ${right}.`);
    const mic = $("#c-mic"); if (mic) mic.hidden = true;
    $("#c-next").hidden = false;
  };
  $$(".option").forEach((b) => b.onclick = () => choose(+b.dataset.opt, "tap"));

  const mic = $("#c-mic");
  if (mic) mic.onclick = () => {
    if (Listener.rec) { Listener.stop(); return; }
    Voice.stop();
    const heard = $("#c-heard");
    heard.hidden = false;
    heard.innerHTML = "<small>Listening…</small>";
    mic.classList.add("recording");
    mic.innerHTML = `${ICON.stop}<span>Listening… tap to stop</span>`;
    try {
      Listener.start({
        onUpdate: (t) => { heard.innerHTML = heardHTML(t); },
        onEnd: (t, err) => {
          mic.classList.remove("recording");
          mic.innerHTML = `${ICON.mic}<span>Say your answer</span>`;
          if (answered) return;
          if (err === "not-allowed" || err === "service-not-allowed") { heard.innerHTML = "<small>Please allow the microphone, or tap an answer.</small>"; return; }
          const k = t ? matchOption(t, q.options) : -1;
          heard.innerHTML = t ? heardHTML(t) : "<small>I didn't hear you. Try again or tap an answer.</small>";
          if (k >= 0) choose(k, "voice");
          else if (t) $("#c-feedback").innerHTML = spikoSays("Hmm, I didn't catch which one. Say the answer again, or tap it.");
        }
      });
    } catch (e) { mic.hidden = true; heard.innerHTML = "<small>Voice isn't available here. Tap an answer.</small>"; }
  };

  $("#c-next").onclick = () => {
    Voice.stop();
    if (i + 1 < list.length) { state.cIndex = i + 1; renderChoice(story); window.scrollTo(0, 0); }
    else {
      Progress.set(story.id, { choice: { score: state.choiceScore, total: list.length } });
      state.cIndex = 0; state.qIndex = 0;
      location.hash = `#/story/${story.id}/questions`;
    }
  };
}

/* ---------- Part 2: open questions by voice ---------- */
function renderQuestions(story) {
  const list = story.questions || [];
  if (!list.length) { location.replace(`#/story/${story.id}/done`); return; }
  const qi = Math.min(state.qIndex, list.length - 1);
  const q = list[qi];
  const canHear = Listener.supported();
  const canRecord = Recorder.supported();
  Recorder.reset();

  app().innerHTML = `
    ${qHeader(story, "Part 2 · Answer out loud", "Question", qi, list.length)}
    <div class="q-card">
      <div class="q-row">
        <p class="q-text" lang="en">${esc(q.q)}</p>
        <button id="q-say" class="icon-btn" type="button" aria-label="Hear the question">${ICON.speaker}</button>
      </div>
      <p class="q-tip">Answer in a full sentence, out loud.</p>
      <div class="q-actions">
        <button id="q-rec" class="btn btn-primary btn-big mic-btn" type="button">${ICON.mic}<span>Answer by voice</span></button>
        <div class="row2">
          <button id="q-play" class="btn btn-outline" type="button" disabled>${ICON.play}<span>Play my answer</span></button>
          <button id="q-show" class="btn btn-outline" type="button">${ICON.eye}<span>Show answer</span></button>
        </div>
      </div>
      <p id="q-heard" class="heard" hidden></p>
      <p id="q-err" class="mic-error" hidden></p>
      <div id="q-answer"></div>
    </div>
    <div id="q-cheer"></div>
    <button id="q-next" class="btn btn-orange btn-block btn-big" type="button">${qi + 1 < list.length ? "Next →" : "Finish ✓"}</button>`;

  const recBtn = $("#q-rec");
  const playBtn = $("#q-play");
  const heard = $("#q-heard");
  const err = $("#q-err");
  let active = false;

  $("#q-say").onclick = () => Voice.say(q.q);
  setTimeout(() => { if ($("#q-say")) Voice.say(q.q); }, 300);

  if (!canHear && !canRecord) {
    recBtn.disabled = true;
    err.hidden = false;
    err.textContent = "This browser can't use the microphone. Answer out loud anyway, then tap Show answer!";
  }

  const idle = (label) => { active = false; recBtn.classList.remove("recording"); recBtn.innerHTML = `${ICON.mic}<span>${label}</span>`; };

  const finish = async (transcript, error) => {
    if (!active) return;
    await Recorder.stop();
    idle("Answer again");
    if (Recorder.url) playBtn.disabled = false;
    if (error === "not-allowed" || error === "service-not-allowed") {
      err.hidden = false;
      err.textContent = "Please allow the microphone so Spiko can hear you (check your browser settings).";
      return;
    }
    if (canHear) {
      const g = gradeAnswer(transcript, q);
      heard.hidden = false;
      heard.innerHTML = transcript ? heardHTML(transcript, g.hits) : "<small>We heard</small>…nothing yet.";
      $("#q-cheer").innerHTML = spikoSays(pick(FEEDBACK[g.level], qi), g.level === "great" ? "good" : "");
      if (g.level !== "none") Progress.set(story.id, { answered: Math.max(Progress.get(story.id).answered || 0, qi + 1) });
    } else {
      $("#q-cheer").innerHTML = spikoSays("Great job! Play your answer, then listen to the model answer and repeat it.");
      Progress.set(story.id, { answered: Math.max(Progress.get(story.id).answered || 0, qi + 1) });
    }
  };

  recBtn.onclick = async () => {
    err.hidden = true;
    if (active) {                                   // stop
      if (Listener.rec) Listener.stop();            // → onEnd → finish
      else finish("", null);
      return;
    }
    Voice.stop();
    active = true;
    recBtn.classList.add("recording");
    recBtn.innerHTML = `${ICON.stop}<span>Listening… tap to stop</span>`;
    heard.hidden = !canHear;
    heard.innerHTML = "<small>Listening…</small>";
    if (canRecord) {
      try { await Recorder.start(); }
      catch (e) {
        if (!canHear) {
          idle("Answer by voice");
          err.hidden = false;
          err.textContent = e && e.name === "NotAllowedError"
            ? "Please allow the microphone so Spiko can hear you (check your browser settings)."
            : "Couldn't start the microphone. Answer out loud anyway!";
          return;
        }
      }
    }
    if (canHear) {
      try {
        Listener.start({
          onUpdate: (t) => { heard.innerHTML = heardHTML(t); },
          onEnd: (t, e) => finish(t, e)
        });
      } catch (e) { /* recording still works */ }
    }
  };

  playBtn.onclick = () => {
    playBtn.innerHTML = `${ICON.speaker}<span>Playing…</span>`;
    Recorder.play(() => { playBtn.innerHTML = `${ICON.play}<span>Play my answer</span>`; });
  };

  $("#q-show").onclick = () => {
    $("#q-answer").innerHTML = `<div class="model-answer" lang="en"><small>Model answer</small>${esc(q.a)}
      <button class="icon-btn" type="button" id="q-model-say" aria-label="Hear the model answer">${ICON.speaker}</button></div>`;
    $("#q-model-say").onclick = () => Voice.say(q.a.replace(/^Example:\s*/i, ""));
    Voice.say(q.a.replace(/^Example:\s*/i, ""));
  };

  $("#q-next").onclick = () => {
    Voice.stop(); Listener.abort(); Recorder.reset();
    if (qi + 1 < list.length) { state.qIndex = qi + 1; renderQuestions(story); window.scrollTo(0, 0); }
    else {
      state.qIndex = 0;
      Progress.set(story.id, { answered: list.length, done: true });
      location.hash = `#/story/${story.id}/done`;
    }
  };
}

/* =====================================================================
   End of story
   ===================================================================== */
function nextStoryAfter(story) {
  const sec = sectionById(story.sectionId);
  const slot = slotsOf(sec).filter((sl) => sl.number > story.number).sort((x, y) => x.number - y.number)[0];
  if (slot) return slot.story ? { story: slot.story } : { soon: slot.number };
  const nextSec = SECTIONS.slice(SECTIONS.indexOf(sec) + 1).find((x) => x.open && x.topics.some((t) => t.slots.some((sl) => sl.story)));
  const first = nextSec && slotsOf(nextSec).find((sl) => sl.story);
  return first ? { story: first.story } : { soon: null };
}

function confetti() {
  const colors = ["#1F4FD1", "#FF9F1C", "#0F1B3D", "#DCE6FF"];
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;background:${colors[i % 4]};animation-delay:${(i % 7) * 0.12}s;animation-duration:${1.8 + (i % 5) * 0.3}s"></i>`).join("")}</div>`;
}

function renderDone(story) {
  Progress.set(story.id, { done: true });
  const p = Progress.get(story.id);
  const sec = sectionById(story.sectionId);
  const st = sectionStats(sec);
  const saved = Words.all().filter((w) => w.story === story.id).length;
  const nx = nextStoryAfter(story);
  const choice = p.choice ? `${p.choice.score}/${p.choice.total}` : "–";
  const spoken = (story.questions || []).length;

  app().innerHTML = `
    ${confetti()}
    <a href="#/topic/${esc(story.sectionId)}/${esc(story.topicId)}" class="back-link">${ICON.back}${esc(story.topic)}</a>
    <div class="done">
      <svg class="done-logo" aria-hidden="true"><use href="#spiko-logo"/></svg>
      <h1>Story complete!</h1>
      <p class="sub">${esc(story.title)} · ${esc(story.topic)}</p>
      <div class="stats">
        <div class="stat"><b>${choice}</b>correct<br/>answers</div>
        <div class="stat"><b>${spoken}</b>questions<br/>spoken</div>
        <div class="stat"><b>${saved}</b>${saved === 1 ? "word" : "words"}<br/>saved</div>
      </div>
      <div class="topic-progress">
        <span>${esc(story.section)}: ${st.done} of ${st.total} stories</span>
        ${progressBar(st.pct)}
      </div>
      ${spikoSays("You listened, read and spoke English today. See you tomorrow for 15 more minutes!")}
      <div class="actions">
        ${nx.story
          ? `<a class="btn btn-orange btn-big btn-block" href="#/story/${esc(nx.story.id)}">Next story: ${esc(nx.story.title)} →</a>`
          : `<button id="next-soon" class="btn btn-orange btn-big btn-block" type="button">Next story <span class="soon">Coming soon</span></button>`}
        <div class="row2">
          <a class="btn btn-ghost" href="#/words">My words</a>
          <a class="btn btn-outline" href="#/topic/${esc(story.sectionId)}/${esc(story.topicId)}">${esc(story.topic)}</a>
        </div>
        <a class="btn btn-outline btn-block" href="#/story/${esc(story.id)}">Listen again</a>
      </div>
    </div>`;
  Voice.say("Story complete! Great job!");
  const soon = $("#next-soon");
  if (soon) soon.onclick = () => toast(nx.soon ? `Story ${nx.soon} is coming soon 🚀` : "More stories coming soon 🚀");
}

/* =====================================================================
   My words
   ===================================================================== */
let wordsFilter = "all";

function renderWords() {
  const all = Words.all();
  const storyIds = [...new Set(all.map((w) => w.story))];
  if (wordsFilter !== "all" && !storyIds.includes(wordsFilter)) wordsFilter = "all";
  const list = wordsFilter === "all" ? all : all.filter((w) => w.story === wordsFilter);
  const titleOf = (id) => (storyById(id) || {}).title || "Other";

  app().innerHTML = `
    <a href="#/" class="back-link">${ICON.back}Home</a>
    <div class="words-head">
      <div>
        <h1 class="page-title">My words</h1>
        <p class="sub">${all.length ? `${all.length} saved ${all.length === 1 ? "word" : "words"}. Hear each one and say it out loud.` : ""}</p>
      </div>
      ${list.length ? `<button id="play-all" class="btn btn-primary" type="button">${ICON.play}<span>Play all</span></button>` : ""}
    </div>
    ${storyIds.length > 1 ? `<div class="chips">
      <button class="chip" type="button" data-filter="all" aria-pressed="${wordsFilter === "all"}">All</button>
      ${storyIds.map((id) => `<button class="chip" type="button" data-filter="${esc(id)}" aria-pressed="${wordsFilter === id}">${esc(titleOf(id))}</button>`).join("")}
    </div>` : ""}
    ${list.length ? `<ul class="word-list">${list.map((w, i) => `
      <li class="word-item" data-i="${i}">
        <button class="icon-btn" type="button" data-say="${esc(w.word)}" aria-label="Hear ${esc(w.word)}">${ICON.speaker}</button>
        <div class="wi-body">
          <h3>${esc(w.word)}</h3>
          <p>${esc(w.meaning || (lookupWord(w.word) || {}).meaning || "")}</p>
          <span class="wi-meta"><span class="wi-story">${esc(titleOf(w.story))}</span>
          <a href="https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(w.word)}" target="_blank" rel="noopener">More ↗</a></span>
        </div>
        <button class="del" type="button" data-del="${esc(w.word)}" aria-label="Remove ${esc(w.word)}">×</button>
      </li>`).join("")}</ul>`
    : `<div class="empty">${ICON.logo.replace("<svg", '<svg width="90" height="90"')}<p>No words yet.<br/>Tap any word in a story, then tap <b>Save</b>.</p></div>`}
    <div style="text-align:center"><button id="replay-intro" class="small-link" type="button">Show the intro again</button></div>`;

  const items = $$(".word-item");
  const mark = (i) => items.forEach((el, k) => el.classList.toggle("active", k === i));
  app().onclick = (e) => {
    const say = e.target.closest("[data-say]");
    const del = e.target.closest("[data-del]");
    const chip = e.target.closest("[data-filter]");
    if (say) Voice.say(say.dataset.say);
    if (del) { Words.remove(del.dataset.del); renderWords(); }
    if (chip) { wordsFilter = chip.dataset.filter; Voice.stop(); renderWords(); }
    if (e.target.closest("#play-all")) {
      Voice.playList(list.map((w) => ({ text: w.word })), 0, {
        onItem: (i) => { mark(i); items[i].scrollIntoView({ behavior: "smooth", block: "center" }); },
        onDone: () => mark(-1)
      });
    }
    if (e.target.id === "replay-intro") { store.set(KEY_ONBOARDED, false); location.hash = ""; location.reload(); }
  };
}

boot();
