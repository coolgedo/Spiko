/* Spiko — app screens: home (topic covers) → topic (story list) → story → questions → done, My words.
   Content: data/sections.json, data/stories/<id>.json, data/dictionary.json. Depends on core.js. */
"use strict";

let STORIES = [];     // all loaded stories, in order, with section info
let SECTIONS = [];    // topics from sections.json (+ .loaded stories)
let ONBOARD = null;

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
  if (parts[0] === "topic") {
    const sec = sectionById(parts[1]);
    return sec ? renderTopic(sec) : renderHome();
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
   Home: topic covers
   ===================================================================== */
function sectionStats(sec) {
  const total = sec.total || sec.loaded.length;
  const done = sec.loaded.filter((s) => Progress.get(s.id).done).length;
  const pct = sec.loaded.reduce((a, s) => a + Progress.percent(s.id), 0) / Math.max(total, 1);
  return { total, done, pct };
}

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
        <small>${Progress.percent(next.id) > 0 ? "Continue" : "Start here"} · ${esc(next.section)}</small>
        <b>${esc(next.title)}</b>
        ${progressBar(Progress.percent(next.id), "thin")}
      </span>
      <span class="cc-go">${ICON.play}</span>
    </a>` : ""}

    <h2 class="h2">Topics</h2>
    <div class="covers">
      ${SECTIONS.map((sec, i) => {
        const st = sectionStats(sec);
        return `
        <a class="cover cover-${esc(sec.color || ["blue", "navy", "orange", "light"][i % 4])}" href="#/topic/${esc(sec.id)}" style="animation-delay:${i * 0.07}s">
          <span class="cover-emoji">${esc(sec.cover || "📚")}</span>
          <span class="cover-title">${esc(sec.title)}</span>
          ${sec.titleAr ? `<span class="cover-ar" lang="ar" dir="rtl">${esc(sec.titleAr)}</span>` : ""}
          <span class="cover-meta">${st.done} / ${st.total} stories</span>
          ${progressBar(st.pct, "thin")}
        </a>`;
      }).join("")}
    </div>`;
}

/* =====================================================================
   Topic: story list with progress
   ===================================================================== */
function renderTopic(sec) {
  const st = sectionStats(sec);
  const rows = [];
  for (let n = 1; n <= st.total; n++) {
    const story = sec.loaded.find((s) => s.number === n);
    if (!story) {
      rows.push(`<li><div class="story-row soon"><span class="sr-num">${n}</span><span class="sr-cover">🔒</span>
        <span class="sr-body"><b>Story ${n}</b><small>Coming soon</small></span></div></li>`);
      continue;
    }
    const p = Progress.get(story.id);
    const pct = Progress.percent(story.id);
    const status = p.done ? "Done" : pct > 0 ? `${Math.round(pct * 100)}%` : "New";
    rows.push(`<li><a class="story-row${p.done ? " done" : ""}" href="#/story/${esc(story.id)}">
      <span class="sr-num">${p.done ? ICON.check : n}</span>
      <span class="sr-cover">${esc(story.cover || "📖")}</span>
      <span class="sr-body"><b>${esc(story.title)}</b>${progressBar(pct, "thin")}</span>
      <span class="sr-status">${status}</span></a></li>`);
  }
  app().innerHTML = `
    <a href="#/" class="back-link">${ICON.back}Topics</a>
    <header class="topic-head cover-${esc(sec.color || "blue")}">
      <span class="cover-emoji">${esc(sec.cover || "📚")}</span>
      <div>
        <h1>${esc(sec.title)}</h1>
        ${sec.titleAr ? `<p lang="ar" dir="rtl">${esc(sec.titleAr)}</p>` : ""}
        <small>${st.done} of ${st.total} stories done</small>
      </div>
    </header>
    ${progressBar(st.pct)}
    <ol class="story-list">${rows.join("")}</ol>`;
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
    const [sec, dict, o] = await Promise.all([
      loadJSON("data/sections.json"), loadJSON("data/dictionary.json"), loadJSON("data/onboarding.json")
    ]);
    ONBOARD = o;
    FORMS = (dict && dict._forms) || {};
    DICT = dict || {};
    SECTIONS = sec.sections || [];
    // Load every story listed in sections.json → data/stories/<id>.json (in order)
    await Promise.all(SECTIONS.map(async (section) => {
      const list = await Promise.all((section.stories || []).map((id, i) =>
        loadJSON(`data/stories/${id}.json`)
          .then((story) => ({
            ...story, id: story.id || id, number: story.number || i + 1,
            section: section.title, sectionId: section.id, sectionTotal: section.total || section.stories.length
          }))
          .catch(() => null)));
      section.loaded = list.filter(Boolean);
    }));
    STORIES = SECTIONS.flatMap((s) => s.loaded);
  } catch (e) {
    show("app-shell");
    app().innerHTML = `<p class="empty">Couldn't load the stories.<br/>If you opened the file directly, run a local server (see README).</p>`;
    return;
  }

  if (store.get(KEY_ONBOARDED, false)) startApp();
  else runSplash();
}

/* ---------- temporary bridges until the new story/question screens land ---------- */
function linesOf(story) {
  return story.scenes ? story.scenes.flatMap((sc) => sc.lines) : (story.paragraphs || []).flat().map((text) => ({ who: "narrator", text }));
}
function lookupKeyWord(story, word) {
  const r = lookupWord(word);
  return r && { ...r, key: ((story && story.words) || []).includes(r.base) };
}
function sentencesOf(story) {
  return linesOf(story).map((l, i) => ({ text: l.text, audio: l.audio || (Array.isArray(story.audio) ? story.audio[i] : null) }));
}
function renderChoice(story) { location.replace(`#/story/${story.id}/questions`); }

/* =====================================================================
   Story view: scenes with chat bubbles, a voice per character,
   speed switch, listen first → then read, tappable words
   ===================================================================== */
function tokenize(text, story) {
  // Words become tappable spans; key words of the story are highlighted
  return String(text).split(/([A-Za-z]+(?:['’][A-Za-z]+)*)/).map((part, i) => {
    if (i % 2 === 0) return esc(part);
    const key = lookupKeyWord(story, part.toLowerCase());
    return `<span class="w${key && key.key ? " key" : ""}" data-w="${esc(part)}">${esc(part)}</span>`;
  }).join("");
}

function charOf(story, who) {
  const c = (story.characters || {})[who];
  return c || { name: who === "narrator" ? "Narrator" : who, voice: who === "narrator" ? "narrator" : "male" };
}

function lineHTML(story, line, i) {
  const c = charOf(story, line.who);
  if (!line.who || line.who === "narrator") {
    return `<p class="line narr" data-i="${i}"><span class="txt">${tokenize(line.text, story)}</span></p>`;
  }
  return `<div class="line say${c.main ? " me" : ""}" data-i="${i}">
      <button class="avatar" type="button" data-replay="${i}" aria-label="Hear ${esc(c.name)}">${esc(c.avatar || "🙂")}</button>
      <div class="bubble"><span class="who">${esc(c.name)}</span><span class="txt">${tokenize(line.text, story)}</span></div>
    </div>`;
}

function renderStory(story) {
  const lines = linesOf(story);
  const items = lines.map((l, i) => ({
    text: l.text,
    role: charOf(story, l.who).voice || "narrator",
    audio: l.audio || (Array.isArray(story.audio) ? story.audio[i] : null)
  }));
  const scenes = story.scenes || [{ title: "", lines }];
  let n = 0;
  const scenesHTML = scenes.map((sc, si) => `
    <section class="scene">
      ${sc.title ? `<div class="scene-head"><span class="scene-place">${esc(sc.place || "🎬")}</span><span>Scene ${si + 1} · ${esc(sc.title)}</span></div>` : ""}
      ${sc.lines.map((l) => lineHTML(story, l, n++)).join("")}
    </section>`).join("");
  const sec = sectionById(story.sectionId);
  const speed = store.get(KEY_SPEED, "normal");

  app().innerHTML = `
    <a href="#/topic/${esc(story.sectionId)}" class="back-link">${ICON.back}${esc(story.section)}</a>
    <div class="story-hero">
      <span class="story-cover">${esc(story.cover || "📖")}</span>
      <div>
        <p class="eyebrow">Story ${esc(story.number)}${story.sectionTotal ? ` of ${esc(story.sectionTotal)}` : ""}</p>
        <h1 class="story-title">${esc(story.title)}</h1>
      </div>
    </div>

    <div id="read-gate" class="read-gate">
      <span class="rg-ear">🎧</span>
      <div class="rg-body"><b>Listen first</b><small>Press Listen and follow the voices. Then read.</small></div>
      <button id="btn-read" class="btn btn-primary" type="button">${ICON.book}<span>Read</span></button>
    </div>
    <p id="tap-hint" class="tap-hint" hidden>Tap any word to see its meaning. Tap a face to hear the line again.</p>

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
    const rep = e.target.closest("[data-replay]");
    if (rep) {                                     // hear one line again
      const i = +rep.dataset.replay;
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
  $("#sheet-more").href = "https://www.oxfordlearnersdictionaries.com/definition/english/" + encodeURIComponent(word.replace(/'/g, ""));
  metaEl.textContent = key ? (key.key ? "Key word ⭐" : "Spiko dictionary") : "";
  sheet.hidden = false;

  const setSave = () => {
    const saved = Words.has(word);
    saveBtn.textContent = saved ? "Saved ✓" : "Save";
    saveBtn.classList.toggle("saved", saved);
  };
  setSave();
  saveBtn.onclick = () => {
    if (Words.has(word)) { Words.remove(word); toast("Removed from My words"); }
    else { Words.add({ word, meaning, story: story.id, date: Date.now() }); toast("Saved to My words ⭐"); }
    setSave();
  };
  $("#sheet-say").onclick = () => Voice.say(word);
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
    const d = await fetchDefinition(word);
    if (req !== sheetReq) return;
    meaning = d.def;
    metaEl.textContent = [d.pos, d.phonetic].filter(Boolean).join(" · ");
    meaningEl.textContent = meaning;
  } catch (e) {
    if (req !== sheetReq) return;
    meaningEl.textContent = navigator.onLine === false ? "You are offline. Tap “More” later." : "No short meaning found. Tap “More”.";
  }
  meaningEl.classList.remove("loading");
}


/* ---------- Questions ---------- */
const CHEERS = [
  "Great job! Now listen to the model answer and repeat it.",
  "Well done! Play your answer, then compare it with the model answer.",
  "Nice! Your voice sounds great. Now listen to the model answer and repeat it.",
  "Awesome! Speaking out loud is how you learn. Now check the model answer."
];

function renderQuestions(story) {
  currentStory = story;
  if (state.storyId !== story.id) { state.storyId = story.id; state.index = 0; state.revealed = false; state.qIndex = 0; }
  const total = story.questions.length;
  const qi = Math.min(state.qIndex, total - 1);
  const q = story.questions[qi];
  Recorder.reset();

  app().innerHTML = `
    <a href="#/story/${esc(story.id)}" class="eyebrow" style="text-decoration:none">← ${esc(story.title)}</a>
    <h1 class="page-title" style="margin-top:6px">Question ${qi + 1} of ${total}</h1>
    <div class="progress"><span style="width:${((qi + 1) / total) * 100}%"></span></div>

    <div class="q-card">
      <div class="q-row">
        <p class="q-text" lang="en">${esc(q.q)}</p>
        <button id="q-say" class="icon-btn" type="button" aria-label="Hear the question">${ICON.speaker}</button>
      </div>
      <div class="q-actions">
        <button id="q-rec" class="btn btn-primary btn-big" type="button">${ICON.mic}<span>Record my answer</span></button>
        <div class="row2">
          <button id="q-play" class="btn btn-outline" type="button" disabled>${ICON.play}<span>Play my answer</span></button>
          <button id="q-show" class="btn btn-outline" type="button">${ICON.eye}<span>Show answer</span></button>
        </div>
      </div>
      <p id="q-err" class="mic-error" hidden></p>
      <div id="q-answer"></div>
    </div>
    <div id="q-cheer"></div>
    <button id="q-next" class="btn btn-orange btn-block btn-big" type="button" style="margin-top:16px">${qi + 1 < total ? "Next →" : "Finish ✓"}</button>`;

  const recBtn = $("#q-rec");
  const playBtn = $("#q-play");
  const err = $("#q-err");
  let recording = false;

  $("#q-say").onclick = () => Voice.say(q.q);
  setTimeout(() => { if ($("#q-say")) Voice.say(q.q); }, 300);

  if (!Recorder.supported()) {
    recBtn.disabled = true;
    err.hidden = false;
    err.textContent = "Recording is not supported in this browser. Answer out loud anyway!";
  }

  recBtn.onclick = async () => {
    err.hidden = true;
    if (!recording) {
      Voice.stop();
      try {
        await Recorder.start();
      } catch (e) {
        err.hidden = false;
        err.textContent = e && e.name === "NotAllowedError"
          ? "Please allow the microphone so Spiko can hear you. (Check your browser settings.)"
          : "Couldn't start the microphone. Answer out loud anyway!";
        return;
      }
      recording = true;
      recBtn.classList.add("recording");
      recBtn.innerHTML = `${ICON.stop}<span>Stop recording</span>`;
    } else {
      recording = false;
      await Recorder.stop();
      recBtn.classList.remove("recording");
      recBtn.innerHTML = `${ICON.mic}<span>Record again</span>`;
      playBtn.disabled = false;
      $("#q-cheer").innerHTML = spikoSays(CHEERS[qi % CHEERS.length]);
    }
  };

  playBtn.onclick = () => {
    playBtn.innerHTML = `${ICON.speaker}<span>Playing…</span>`;
    Recorder.play(() => { playBtn.innerHTML = `${ICON.play}<span>Play my answer</span>`; });
  };

  $("#q-show").onclick = () => {
    $("#q-answer").innerHTML = `<div class="model-answer" lang="en"><small>Model answer</small>${esc(q.a)}</div>`;
    Voice.say(q.a);
  };

  $("#q-next").onclick = () => {
    Voice.stop();
    Recorder.reset();
    if (qi + 1 < total) { state.qIndex = qi + 1; renderQuestions(story); window.scrollTo(0, 0); }
    else { state.qIndex = 0; location.hash = `#/story/${story.id}/done`; }
  };
}

/* ---------- Done ---------- */
function renderDone(story) {
  const idx = STORIES.indexOf(story);
  const next = STORIES[idx + 1];
  const saved = Words.all().filter((w) => w.story === story.id).length;
  app().innerHTML = `
    <div class="done">
      <svg class="done-logo" aria-hidden="true"><use href="#spiko-logo"/></svg>
      <h1>Story complete!</h1>
      <p class="sub">${esc(story.title)} · ${esc(story.section)}</p>
      <div class="stat"><b>${saved}</b>${saved === 1 ? "word saved" : "words saved"}</div>
      ${spikoSays("You listened, read and spoke English today. See you tomorrow for 15 more minutes!")}
      <div class="actions">
        ${next
          ? `<a class="btn btn-orange btn-big btn-block" href="#/story/${esc(next.id)}">Next story →</a>`
          : `<button id="next-soon" class="btn btn-orange btn-big btn-block" type="button">Next story <span class="soon">Coming soon</span></button>`}
        <a class="btn btn-ghost btn-block" href="#/words">My words</a>
        <a class="btn btn-outline btn-block" href="#/story/${esc(story.id)}">Listen again</a>
      </div>
    </div>`;
  const soon = $("#next-soon");
  const more = story.sectionTotal && story.number < story.sectionTotal;
  if (soon) soon.onclick = () => toast(more ? `Story ${story.number + 1} is coming soon 🚀` : "More stories coming soon 🚀");
}

/* ---------- My words ---------- */
function renderWords() {
  const list = Words.all();
  app().innerHTML = `
    <a href="#/" class="eyebrow" style="text-decoration:none">← Back to story</a>
    <h1 class="page-title" style="margin-top:6px">My words</h1>
    <p class="sub">${list.length ? `${list.length} saved ${list.length === 1 ? "word" : "words"}. Tap 🔊 and say it out loud.` : ""}</p>
    ${list.length ? `<ul class="word-list">${list.map((w) => `
      <li class="word-item">
        <button class="icon-btn" type="button" data-say="${esc(w.word)}" aria-label="Hear ${esc(w.word)}">${ICON.speaker}</button>
        <div class="wi-body">
          <h3>${esc(w.word)}</h3>
          <p>${esc(w.meaning || "")}</p>
          <a href="https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(w.word)}" target="_blank" rel="noopener">More ↗</a>
        </div>
        <button class="del" type="button" data-del="${esc(w.word)}" aria-label="Remove ${esc(w.word)}">×</button>
      </li>`).join("")}</ul>`
    : `<div class="empty">${ICON.logo.replace("<svg", '<svg width="90" height="90"')}<p>No words yet.<br/>Tap any word in a story, then tap <b>Save</b>.</p></div>`}
    <div style="text-align:center"><button id="replay-intro" class="small-link" type="button">Show the intro again</button></div>`;

  app().onclick = (e) => {
    const say = e.target.closest("[data-say]");
    const del = e.target.closest("[data-del]");
    if (say) Voice.say(say.dataset.say);
    if (del) { Words.remove(del.dataset.del); renderWords(); }
    if (e.target.id === "replay-intro") { store.set(KEY_ONBOARDED, false); location.hash = ""; location.reload(); }
  };
}


boot();
