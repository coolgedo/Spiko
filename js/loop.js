/* Spiko — the learning loop for "loop" stories (pilot: My Graduation Day).
   One screen per step: Listen → Read → Key phrases → Shadowing → Quiz → Answer → Your turn → Notice → Done.
   Plus Reviews: saved phrases come back 1, 3 and 7 days later.
   Content: data/stories/<id>.json with "type": "loop". Depends on core.js and app.js helpers. */
"use strict";

const LOOP_STEPS = [
  { id: "listen",  icon: "🎧", label: "Listen" },
  { id: "read",    icon: "📖", label: "Read" },
  { id: "phrases", icon: "💬", label: "Key phrases" },
  { id: "shadow",  icon: "🗣️", label: "Shadowing" },
  { id: "quiz",    icon: "✅", label: "Quiz" },
  { id: "answer",  icon: "🎤", label: "Answer" },
  { id: "turn",    icon: "⭐", label: "Your turn" },
  { id: "notice",  icon: "💡", label: "Notice" },
  { id: "done",    icon: "🏁", label: "Done" }
];
const loop = { shadow: 0, quiz: 0, quizScore: 0, answer: 0 };   // position inside multi-card steps

/* ---------- Words and phrases ---------- */
function baseOf(w) { const r = lookupWord(w); return r ? r.base : w.toLowerCase(); }
function phraseBases(phrase) { return (phrase.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []).map(baseOf); }

/** Find key phrases in a list of word bases → [{ start, end, k }] (any verb form: woke up, felt proud…) */
function findPhrases(bases, phrases) {
  const found = [];
  phrases.forEach((p, k) => {
    const pb = phraseBases(p.phrase);
    for (let i = 0; i + pb.length <= bases.length; i++) {
      if (pb.every((b, j) => bases[i + j] === b)) found.push({ start: i, end: i + pb.length - 1, k });
    }
  });
  return found;
}

/** One sentence → HTML with tappable words and key phrases underlined */
function sentenceHTML(text, story, i) {
  const parts = String(text).split(WORD_RE);
  const words = parts.filter((_, n) => n % 2);
  const hits = findPhrases(words.map(baseOf), story.phrases || []);
  let w = -1;
  const html = parts.map((part, n) => {
    if (n % 2 === 0) return esc(part);
    w++;
    const open = hits.find((h) => h.start === w);
    const close = hits.find((h) => h.end === w);
    return (open ? `<span class="kp" title="Key phrase">` : "") +
      `<span class="w" data-w="${esc(part)}">${esc(part)}</span>` + (close ? "</span>" : "");
  }).join("");
  return `<span class="s" data-i="${i}">${html}</span>`;
}

function loopSentences(story) { return story.paragraphs.flat(); }

function storyTextHTML(story) {
  let i = 0;
  return story.paragraphs.map((p) => `<p>${p.map((s) => sentenceHTML(s, story, i++)).join(" ")}</p>`).join("");
}

/* ---------- Reviews: saved phrases come back after 1, 3 and 7 days ---------- */
const KEY_REVIEWS = "spiko.reviews";
const REVIEW_DAYS = [1, 3, 7];
const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

const Reviews = {
  all() { return store.get(KEY_REVIEWS, []); },
  save(list) { store.set(KEY_REVIEWS, list); updateReviewBadge(); },
  has(phrase) { return this.all().some((r) => r.phrase === phrase); },
  add(p, storyId) {
    if (this.has(p.phrase)) return;
    const now = Date.now();
    const list = this.all();
    // stage 0 → due the next day, stage 1 → 3 days after saving, stage 2 → 7 days after saving
    list.push({ phrase: p.phrase, meaning: p.meaning, ex: p.ex, story: storyId, saved: now, stage: 0, due: startOfDay(now) + REVIEW_DAYS[0] * DAY });
    this.save(list);
  },
  remove(phrase) { this.save(this.all().filter((r) => r.phrase !== phrase)); },
  due() { const now = Date.now(); return this.all().filter((r) => r.stage < REVIEW_DAYS.length && r.due <= now); },
  mark(phrase, remembered) {
    const list = this.all();
    const r = list.find((x) => x.phrase === phrase);
    if (!r) return;
    if (remembered) {
      r.stage++;
      r.due = r.stage < REVIEW_DAYS.length ? startOfDay(r.saved) + REVIEW_DAYS[r.stage] * DAY : Infinity;
    } else {
      r.due = startOfDay(Date.now()) + DAY;       // not yet: show it again tomorrow
    }
    r.last = Date.now();
    this.save(list);
  }
};

function updateReviewBadge() {
  const n = Reviews.due().length;
  const c = $("#review-count"); if (c) c.textContent = n;
  const dot = $("#menu-dot"); if (dot) dot.hidden = n === 0;
}

/* ---------- Shell: step bar on top, Back / Next at the bottom ---------- */
function loopShell(story, n, body, { next = true, nextLabel, nextId = "loop-next", nav = true } = {}) {
  const st = LOOP_STEPS[n];
  const reached = Math.max(Progress.get(story.id).step || 0, n);
  app().innerHTML = `
    <a href="#/topic/${esc(story.sectionId)}/${esc(story.topicId)}" class="back-link">${ICON.back}${esc(story.topic)}</a>
    <div class="loop-head">
      <span class="story-cover small">${esc(story.cover || "📖")}</span>
      <div><p class="eyebrow">Step ${n + 1} of ${LOOP_STEPS.length} · ${esc(st.label)}</p><h1 class="loop-title">${esc(story.title)}</h1></div>
    </div>
    <nav class="steps" aria-label="Steps">
      ${LOOP_STEPS.map((s, k) => `<a class="step${k === n ? " now" : ""}${k < n || k <= reached ? " done" : ""}" href="#/story/${esc(story.id)}/step/${k}" title="${esc(s.label)}" aria-label="${esc(s.label)}"${k > reached ? ' tabindex="-1" aria-disabled="true"' : ""}><span>${s.icon}</span></a>`).join("")}
    </nav>
    ${progressBar((n + 1) / LOOP_STEPS.length, "steps-bar")}
    <section class="loop-body">${body}</section>
    <div class="loop-nav"${nav ? "" : " hidden"}>
      ${n > 0 ? `<a class="btn btn-outline" href="#/story/${esc(story.id)}/step/${n - 1}">← Back</a>` : "<span></span>"}
      ${next && n + 1 < LOOP_STEPS.length ? `<a id="${nextId}" class="btn btn-orange" href="#/story/${esc(story.id)}/step/${n + 1}">${esc(nextLabel || LOOP_STEPS[n + 1].label)} →</a>` : ""}
    </div>`;
  // Locked steps (not reached yet) can't be opened from the bar
  $$(".step[aria-disabled]").forEach((a) => a.onclick = (e) => { e.preventDefault(); toast("Finish this step first 🙂"); });
}

function renderLoop(story, n) {
  n = Math.max(0, Math.min(LOOP_STEPS.length - 1, n | 0));
  const p = Progress.get(story.id);
  if (n > (p.step || 0) + 1 && !p.done) n = p.step || 0;        // can't jump ahead past the next step
  Progress.set(story.id, { step: Math.max(p.step || 0, n) });
  const fn = { listen: stepListen, read: stepRead, phrases: stepPhrases, shadow: stepShadow, quiz: stepQuiz,
               answer: stepAnswer, turn: stepTurn, notice: stepNotice, done: stepDone }[LOOP_STEPS[n].id];
  fn(story, n);
}

/* ---------- Player: Listen / Pause, Again, speed ---------- */
function playerHTML() {
  const speed = store.get(KEY_SPEED, "normal");
  return `<div class="loop-player">
      <div class="player-row">
        <button id="btn-replay" class="icon-btn" type="button" aria-label="Start again">${ICON.replay}</button>
        <button id="btn-listen" class="btn btn-listen" type="button">${ICON.play}<span>Listen</span></button>
      </div>
      <div class="speed" role="radiogroup" aria-label="Speed">
        ${SPEEDS.map((s) => `<button type="button" role="radio" data-speed="${s.id}" aria-checked="${s.id === speed}">${esc(s.label)}</button>`).join("")}
      </div>
      <p id="player-status" class="loop-status"></p>
    </div>`;
}

function bindPlayer(story, { onLine, onDone } = {}) {
  const items = loopSentences(story).map((text, i) => ({ text, audio: Array.isArray(story.audio) ? story.audio[i] : null }));
  const btn = $("#btn-listen"), status = $("#player-status");
  const ui = () => {
    btn.innerHTML = state.playing ? `${ICON.pause}<span>Pause</span>` : `${ICON.play}<span>${state.index > 0 ? "Continue" : "Listen"}</span>`;
    status.textContent = state.playing ? `Sentence ${state.index + 1} of ${items.length}` : state.index > 0 ? "Paused" : "";
  };
  const play = (from) => {
    state.playing = true;
    Voice.playList(items, from, {
      onItem: (i) => { state.index = i; if (onLine) onLine(i); ui(); },
      onDone: () => { state.playing = false; state.index = 0; if (onLine) onLine(null); ui(); if (onDone) onDone(); }
    });
    ui();
  };
  btn.onclick = () => { if (state.playing) { Voice.stop(); state.playing = false; ui(); } else play(state.index); };
  $("#btn-replay").onclick = () => { state.index = 0; play(0); };
  $$("[data-speed]").forEach((b) => b.onclick = () => {
    store.set(KEY_SPEED, b.dataset.speed);
    $$("[data-speed]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    if (state.playing) play(state.index);
  });
  state.playing = false; state.index = 0;
  ui();
}

/* ---------- 1. Listen ---------- */
function stepListen(story, n) {
  const listened = Progress.get(story.id).listened;
  loopShell(story, n, `
    <div class="listen-card">
      <div class="listen-waves" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      <h2>🎧 Listen first</h2>
      <p>Don't read yet. Close your eyes and listen to the whole story.</p>
    </div>
    ${playerHTML()}
    <div id="listen-cheer"></div>
    ${listened ? "" : `<p class="skip-line"><a href="#/story/${esc(story.id)}/step/${n + 1}" id="skip-listen">Skip</a></p>`}`,
  { nextLabel: "Read" });
  const next = $("#loop-next");
  if (!listened) next.classList.add("disabled");
  next.onclick = (e) => { if (next.classList.contains("disabled")) { e.preventDefault(); toast("Listen to the story first 🎧"); } };
  bindPlayer(story, {
    onLine: (i) => $(".listen-card").classList.toggle("playing", i != null),
    onDone: () => {
      Progress.set(story.id, { listened: true });
      next.classList.remove("disabled"); next.classList.add("pulse");
      $("#listen-cheer").innerHTML = spikoSays("Great listening! Now let's read it.");
    }
  });
}

/* ---------- 2. Read ---------- */
function stepRead(story, n) {
  Progress.set(story.id, { read: true });
  loopShell(story, n, `
    ${playerHTML()}
    <p class="tap-hint">Tap any word for its meaning. <span class="kp-legend">Blue underline</span> = key phrase.</p>
    <div id="story-text" class="story-text loop-text" lang="en">${storyTextHTML(story)}</div>`,
  { nextLabel: "Key phrases" });
  const setActive = (i) => {
    $$(".s.active").forEach((el) => el.classList.remove("active"));
    if (i == null) return;
    const el = $(`.s[data-i="${i}"]`);
    if (el) { el.classList.add("active"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
  bindPlayer(story, { onLine: setActive });
  $("#story-text").onclick = (e) => {
    const w = e.target.closest(".w");
    if (!w) return;
    if (state.playing) { Voice.stop(); state.playing = false; }
    $$(".w.tapped").forEach((x) => x.classList.remove("tapped"));
    w.classList.add("tapped");
    openWord(w.dataset.w, story);
  };
}

/* ---------- 3. Key phrases ---------- */
function highlightPhrase(text, phrase) {
  const parts = String(text).split(WORD_RE);
  const words = parts.filter((_, n) => n % 2);
  const hits = findPhrases(words.map(baseOf), [{ phrase }]);
  let w = -1;
  return parts.map((part, n) => {
    if (n % 2 === 0) return esc(part);
    w++;
    return (hits.some((h) => h.start === w) ? "<b>" : "") + esc(part) + (hits.some((h) => h.end === w) ? "</b>" : "");
  }).join("");
}

function savePhrase(p, story) {
  Reviews.add(p, story.id);
  Words.add({ word: p.phrase, meaning: p.meaning, ex: p.ex, kind: "phrase", story: story.id, date: Date.now() });
}
function unsavePhrase(p) { Reviews.remove(p.phrase); Words.remove(p.phrase); }

function stepPhrases(story, n) {
  loopShell(story, n, `
    <p class="sub">8 phrases from the story. Listen, say each one out loud, and save the ones you want to remember.</p>
    <div class="phrase-list">
      ${story.phrases.map((p, k) => `
        <article class="phrase-card" style="animation-delay:${k * 0.05}s">
          <div class="pc-top">
            <span class="pc-num">${k + 1}</span>
            <h3 lang="en">${esc(p.phrase)}</h3>
            <button class="icon-btn" type="button" data-say="${k}" aria-label="Hear ${esc(p.phrase)}">${ICON.speaker}</button>
          </div>
          <p class="pc-meaning">${esc(p.meaning)}</p>
          <p class="pc-ex" lang="en">“${highlightPhrase(p.ex, p.phrase)}”</p>
          <button class="btn btn-block pc-save${Words.has(p.phrase) ? " saved" : ""}" type="button" data-save="${k}">${Words.has(p.phrase) ? "Saved ✓" : "Save"}</button>
        </article>`).join("")}
    </div>`,
  { nextLabel: "Shadowing" });
  app().onclick = (e) => {
    const say = e.target.closest("[data-say]");
    const save = e.target.closest("[data-save]");
    if (say) { const p = story.phrases[+say.dataset.say]; Voice.say(p.phrase, () => Voice.say(p.ex)); }
    if (save) {
      const p = story.phrases[+save.dataset.save];
      if (Words.has(p.phrase)) { unsavePhrase(p); save.textContent = "Save"; save.classList.remove("saved"); }
      else { savePhrase(p, story); save.textContent = "Saved ✓"; save.classList.add("saved"); toast("Saved! It will come back for review tomorrow 🔁"); }
    }
  };
}

/* ---------- 4. Shadowing ---------- */
/** Mark each word of the target: heard (ok) or missing */
function compareWords(target, heard) {
  const said = new Set(normWords(heard));
  const parts = String(target).split(WORD_RE);
  let total = 0, ok = 0;
  const html = parts.map((part, n) => {
    if (n % 2 === 0) return esc(part);
    total++;
    const hit = said.has(normWords(part)[0] || baseOf(part));
    if (hit) ok++;
    return `<span class="${hit ? "hw-ok" : "hw-miss"}">${esc(part)}</span>`;
  }).join("");
  return { html, score: ok / Math.max(total, 1) };
}

function stepShadow(story, n) {
  const list = loopSentences(story);
  const i = Math.min(loop.shadow, list.length - 1);
  const s = list[i];
  const canHear = Listener.supported();
  loopShell(story, n, `
    <p class="sub">Listen to one sentence, then say it right after — same speed, same music.</p>
    <div class="q-card shadow-card">
      <p class="eyebrow">Sentence ${i + 1} of ${list.length}</p>
      ${progressBar((i + 1) / list.length, "thin")}
      <p id="sh-text" class="sh-text" lang="en">${esc(s)}</p>
      <div class="q-actions">
        <button id="sh-play" class="btn btn-outline" type="button">${ICON.speaker}<span>Play</span></button>
        ${canHear ? `<button id="sh-mic" class="btn btn-primary btn-big mic-btn" type="button">${ICON.mic}<span>Say it</span></button>` : noSpeechNote()}
      </div>
      <p id="sh-heard" class="heard" hidden></p>
      <div id="sh-cheer"></div>
      <div class="row2 sh-nav">
        <button id="sh-again" class="btn btn-ghost" type="button">${ICON.replay}<span>Again</span></button>
        <button id="sh-next" class="btn btn-navy" type="button">${i + 1 < list.length ? "Next sentence" : "Finish"} →</button>
      </div>
    </div>`,
  { nextLabel: "Quiz" });

  const mic = $("#sh-mic");
  const play = (then) => Voice.say(s, then);
  const listen = () => {
    if (!mic) return;
    listenOnce(mic, $("#sh-heard"), "Say it", (t, err) => {
      const heard = $("#sh-heard");
      if (err === "not-allowed" || err === "service-not-allowed") { heard.innerHTML = "<small>Please allow the microphone.</small>"; return; }
      if (!t) { heard.innerHTML = "<small>We heard:</small>…nothing. Tap “Say it” and speak a little louder."; return; }
      const c = compareWords(s, t);
      $("#sh-text").innerHTML = c.html;
      heard.innerHTML = `<small>We heard:</small>“${esc(t)}”`;
      const pct = Math.round(c.score * 100);
      $("#sh-cheer").innerHTML = spikoSays(pct >= 90 ? `Perfect! 🌟 (${pct}%)` : pct >= 60 ? `Great! ${pct}%. Try once more for the red words.` : `${pct}%. Listen again and copy the music.`, pct >= 90 ? "good" : "");
    });
  };
  $("#sh-play").onclick = () => play();
  if (mic) mic.onclick = listen;
  $("#sh-again").onclick = () => { $("#sh-text").textContent = s; $("#sh-cheer").innerHTML = ""; $("#sh-heard").hidden = true; play(); };
  $("#sh-next").onclick = () => {
    Listener.abort(); Voice.stop();
    if (i + 1 < list.length) { loop.shadow = i + 1; stepShadow(story, n); }
    else { loop.shadow = 0; location.hash = `#/story/${story.id}/step/${n + 1}`; }
  };
  setTimeout(() => { if ($("#sh-play")) play(); }, 300);
}

/* ---------- 5. Quiz ---------- */
function stepQuiz(story, n) {
  const list = story.choice || [];
  if (loop.quiz >= list.length) return quizScore(story, n);
  const i = loop.quiz;
  if (i === 0) loop.quizScore = 0;
  const q = list[i];
  const canSpeak = Listener.supported();
  let answered = false;
  loopShell(story, n, `
    <div class="q-card">
      <p class="eyebrow">Question ${i + 1} of ${list.length}</p>
      <div class="q-row">
        <p class="q-text" lang="en">${esc(q.q)}</p>
        <button id="q-say" class="icon-btn" type="button" aria-label="Hear the question">${ICON.speaker}</button>
      </div>
      <div class="options">
        ${q.options.map((o, k) => `<button class="option" type="button" data-opt="${k}"><span class="opt-letter">${"ABC"[k]}</span><span class="opt-text">${esc(o)}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join("")}
      </div>
      ${canSpeak ? `<button id="c-mic" class="btn btn-primary btn-block mic-btn" type="button">${ICON.mic}<span>Say your answer</span></button>` : noSpeechNote()}
      <p id="c-heard" class="heard" hidden></p>
    </div>
    <div id="c-feedback"></div>
    <button id="c-next" class="btn btn-navy btn-block btn-big" type="button" hidden>${i + 1 < list.length ? "Next question →" : "See my score →"}</button>`,
  { next: false });
  const read = () => Voice.say(`${q.q} ${q.options.map((o, k) => `${"ABC"[k]}: ${o}.`).join(" ")}`);
  $("#q-say").onclick = read;
  setTimeout(() => { if ($("#q-say")) read(); }, 300);
  const choose = (k) => {
    if (answered) return;
    answered = true;
    Listener.abort();
    const ok = k === q.answer;
    if (ok) loop.quizScore++;
    $$(".option").forEach((b, m) => {
      b.disabled = true;
      if (m === q.answer) { b.classList.add("correct"); b.querySelector(".opt-mark").textContent = "✓"; }
      else if (m === k) { b.classList.add("wrong"); b.querySelector(".opt-mark").textContent = "✗"; }
    });
    const right = q.options[q.answer].replace(/["“”]/g, "");
    $("#c-feedback").innerHTML = spikoSays(ok ? "Correct! 🎉" : `The answer is “${right}”.`, ok ? "good" : "");
    Voice.say(ok ? "Correct!" : `The answer is: ${right}.`);
    const mic = $("#c-mic"); if (mic) mic.hidden = true;
    $("#c-next").hidden = false;
  };
  $$(".option").forEach((b) => b.onclick = () => choose(+b.dataset.opt));
  const mic = $("#c-mic");
  if (mic) mic.onclick = () => listenOnce(mic, $("#c-heard"), "Say your answer", (t, err) => {
    if (answered) return;
    const heard = $("#c-heard");
    if (err === "not-allowed" || err === "service-not-allowed") { heard.innerHTML = "<small>Please allow the microphone, or tap an answer.</small>"; return; }
    if (!t) { heard.innerHTML = "<small>I didn't hear you. Try again or tap an answer.</small>"; return; }
    heard.innerHTML = heardHTML(t);
    const k = matchOption(t, q.options);
    if (k >= 0) choose(k); else $("#c-feedback").innerHTML = spikoSays("Hmm, I didn't catch which one. Say it again, or tap it.");
  });
  $("#c-next").onclick = () => { Voice.stop(); loop.quiz = i + 1; stepQuiz(story, n); window.scrollTo(0, 0); };
}

function quizScore(story, n) {
  const total = (story.choice || []).length;
  const score = loop.quizScore;
  Progress.set(story.id, { choice: { score, total } });
  loopShell(story, n, `
    <div class="score-card">
      <p class="eyebrow">Quiz score</p>
      <div class="score-big"><b>${score}</b><span>/ ${total}</span></div>
      ${progressBar(score / Math.max(total, 1))}
      ${spikoSays(score === total ? "Perfect score! 🌟" : "Good work! Now answer in your own words.")}
      <button id="quiz-again" class="btn btn-outline btn-block" type="button">Try the quiz again</button>
    </div>`, { nextLabel: "Answer" });
  Voice.say(`You got ${score} out of ${total}.`);
  $("#quiz-again").onclick = () => { loop.quiz = 0; loop.quizScore = 0; stepQuiz(story, n); };
}

/* ---------- 6. Answer (open questions) ---------- */
function stepAnswer(story, n) {
  const list = story.questions || [];
  const i = Math.min(loop.answer, list.length - 1);
  const q = list[i];
  const canHear = Listener.supported(), canRecord = Recorder.supported();
  Recorder.reset();
  loopShell(story, n, `
    <div class="q-card">
      <p class="eyebrow">Question ${i + 1} of ${list.length}</p>
      <div class="q-row">
        <p class="q-text" lang="en">${esc(q.q)}</p>
        <button id="q-say" class="icon-btn" type="button" aria-label="Hear the question">${ICON.speaker}</button>
      </div>
      <p class="q-tip">Answer in a full sentence, out loud.</p>
      ${canHear ? "" : noSpeechNote()}
      <div class="q-actions">
        <button id="q-rec" class="btn btn-primary btn-big mic-btn" type="button">${ICON.mic}<span>Speak my answer</span></button>
        <div class="row2">
          <button id="q-play" class="btn btn-outline" type="button" disabled>${ICON.play}<span>Play my voice</span></button>
          <button id="q-show" class="btn btn-outline" type="button">${ICON.eye}<span>Show answer</span></button>
        </div>
      </div>
      <p id="q-heard" class="heard" hidden></p>
      <p id="q-err" class="mic-error" hidden></p>
      <div id="q-answer"></div>
      <div id="q-repeat" hidden>
        <button id="q-rep-btn" class="btn btn-navy btn-block mic-btn" type="button">${ICON.mic}<span>Repeat after me</span></button>
        <p id="q-rep-heard" class="heard" hidden></p>
      </div>
    </div>
    <div id="q-cheer"></div>
    <button id="q-next" class="btn btn-navy btn-block btn-big" type="button">${i + 1 < list.length ? "Next question →" : "Your turn →"}</button>`,
  { next: false });

  const recBtn = $("#q-rec"), playBtn = $("#q-play"), heard = $("#q-heard"), err = $("#q-err");
  let active = false;
  $("#q-say").onclick = () => Voice.say(q.q);
  setTimeout(() => { if ($("#q-say")) Voice.say(q.q); }, 300);
  if (!canHear && !canRecord) recBtn.disabled = true;

  const showAnswer = () => {
    $("#q-answer").innerHTML = `<div class="model-answer" lang="en"><small>Model answer</small>${esc(q.a)}
      <button class="icon-btn" type="button" id="q-model-say" aria-label="Hear it">${ICON.speaker}</button></div>`;
    $("#q-model-say").onclick = () => Voice.say(q.a);
    Voice.say(q.a);
    if (canHear) $("#q-repeat").hidden = false;
  };
  const finish = async (t, e) => {
    if (!active) return;
    active = false;
    await Recorder.stop();
    recBtn.classList.remove("recording");
    recBtn.innerHTML = `${ICON.mic}<span>Speak again</span>`;
    if (Recorder.url) playBtn.disabled = false;
    if (e === "not-allowed" || e === "service-not-allowed") { err.hidden = false; err.textContent = "Please allow the microphone so Spiko can hear you."; return; }
    if (!canHear) { $("#q-cheer").innerHTML = spikoSays("Great! Tap “Play my voice”, then compare with the model answer."); return; }
    if (!t) { heard.hidden = false; heard.innerHTML = "<small>We heard:</small>…nothing. Tap the mic and speak a little louder."; return; }
    const { score, hits } = overlap(t, q.a);
    heard.innerHTML = heardHTML(t, hits);
    const msg = score > 0.6 ? "Excellent! 🌟" : score >= 0.3 ? "Good try! Listen to the model answer and repeat it." : "Let's listen to the model answer together.";
    $("#q-cheer").innerHTML = spikoSays(msg, score > 0.6 ? "good" : "");
    if (score < 0.3) showAnswer(); else Voice.say(msg.replace("🌟", ""));
  };
  recBtn.onclick = async () => {
    err.hidden = true;
    if (active) { if (Listener.rec) Listener.stop(); else finish("", null); return; }
    Voice.stop();
    active = true;
    recBtn.classList.add("recording");
    recBtn.innerHTML = `${ICON.stop}<span>Listening… tap to stop</span>`;
    heard.hidden = !canHear;
    heard.innerHTML = "<small>Listening…</small>";
    if (canRecord) { try { await Recorder.start(); } catch (e) { if (!canHear) { active = false; recBtn.classList.remove("recording"); err.hidden = false; err.textContent = "Please allow the microphone."; return; } } }
    if (canHear) { try { Listener.start({ onUpdate: (t) => { heard.innerHTML = heardHTML(t); }, onEnd: finish }); } catch (e) {} }
  };
  playBtn.onclick = () => { playBtn.innerHTML = `${ICON.speaker}<span>Playing…</span>`; Recorder.play(() => { playBtn.innerHTML = `${ICON.play}<span>Play my voice</span>`; }); };
  $("#q-show").onclick = showAnswer;
  const rep = $("#q-rep-btn");
  rep.onclick = () => listenOnce(rep, $("#q-rep-heard"), "Repeat after me", (t) => {
    const { score, hits } = overlap(t, q.a);
    $("#q-rep-heard").innerHTML = heardHTML(t, hits);
    if (t) $("#q-cheer").innerHTML = spikoSays(score > 0.6 ? "Excellent! 🌟" : "Good! Say it one more time.", score > 0.6 ? "good" : "");
  });
  $("#q-next").onclick = () => {
    Voice.stop(); Listener.abort(); Recorder.reset();
    Progress.set(story.id, { answered: Math.max(Progress.get(story.id).answered || 0, i + 1) });
    if (i + 1 < list.length) { loop.answer = i + 1; stepAnswer(story, n); window.scrollTo(0, 0); }
    else { loop.answer = 0; location.hash = `#/story/${story.id}/step/${n + 1}`; }
  };
}

/* ---------- 7. Your turn ---------- */
function stepTurn(story, n) {
  const t = story.yourTurn || {};
  const use = new Set(t.use || []);
  const canHear = Listener.supported(), canRecord = Recorder.supported();
  const total = story.phrases.length;
  Recorder.reset();
  loopShell(story, n, `
    <div class="q-card turn-card">
      <div class="q-row">
        <p class="q-text" lang="en">${esc(t.prompt)}</p>
        <button id="t-say" class="icon-btn" type="button" aria-label="Hear it">${ICON.speaker}</button>
      </div>
      ${canHear ? "" : noSpeechNote()}
      <ul class="checklist">
        ${story.phrases.map((p, k) => `<li data-k="${k}" class="${use.has(p.phrase) ? "must" : ""}"><span class="box" aria-hidden="true"></span>${esc(p.phrase)}${use.has(p.phrase) ? ' <small>★ use this</small>' : ""}</li>`).join("")}
      </ul>
      <button id="t-rec" class="btn btn-primary btn-big btn-block mic-btn" type="button">${ICON.mic}<span>Start talking</span></button>
      <p id="t-heard" class="heard" hidden></p>
      <p id="t-result" class="turn-result" hidden></p>
      <div class="row2">
        <button id="t-play" class="btn btn-outline" type="button" disabled>${ICON.play}<span>Play my voice</span></button>
        <button id="t-example" class="btn btn-outline" type="button">${ICON.eye}<span>Show example</span></button>
      </div>
      <div id="t-ex"></div>
    </div>
    <div id="t-cheer"></div>`,
  { nextLabel: "Notice" });

  const rec = $("#t-rec"), heard = $("#t-heard");
  let talking = false, text = "", used = new Set();
  const tick = (spoken) => {
    const words = String(spoken).split(WORD_RE).filter((_, k) => k % 2);
    findPhrases(words.map(baseOf), story.phrases).forEach((h) => {
      if (!used.has(h.k)) { used.add(h.k); const li = $(`.checklist li[data-k="${h.k}"]`); if (li) li.classList.add("ticked"); }
    });
  };
  const show = (spoken) => {
    heard.hidden = false;
    heard.innerHTML = spoken ? `<small>We heard:</small>${sentenceLike(spoken, story)}` : "<small>Listening…</small>";
  };
  const end = async () => {
    talking = false;
    await Recorder.stop();
    rec.classList.remove("recording");
    rec.innerHTML = `${ICON.mic}<span>Talk again</span>`;
    if (Recorder.url) $("#t-play").disabled = false;
    const x = used.size;
    const res = $("#t-result");
    res.hidden = false;
    res.innerHTML = `You used <b>${x}</b> of <b>${total}</b> new phrases`;
    Progress.set(story.id, { phrasesUsed: Math.max(Progress.get(story.id).phrasesUsed || 0, x) });
    $("#t-cheer").innerHTML = spikoSays(x >= 4 ? "Amazing! You told your own story in English! 🌟" : x > 0 ? "Great start! Try again and use more phrases." : canHear ? "Try again and use the phrases in the list." : "Well done for speaking! Play your voice and listen.", x >= 4 ? "good" : "");
    Voice.say(`You used ${x} of ${total} new phrases.`);
  };
  const listenLoop = () => {
    Listener.start({
      onUpdate: (s) => { const all = (text + " " + s).trim(); show(all); tick(all); },
      onEnd: (s, err) => {
        if (s) { text = (text + " " + s).trim(); tick(text); show(text); }
        if (talking && err !== "not-allowed" && err !== "service-not-allowed") { try { listenLoop(); } catch (e) { end(); } }
        else if (talking) end();
      }
    });
  };
  rec.onclick = async () => {
    if (talking) { talking = false; Listener.abort(); end(); return; }
    Voice.stop();
    talking = true; text = ""; used = new Set();
    $$(".checklist li").forEach((li) => li.classList.remove("ticked"));
    $("#t-result").hidden = true; $("#t-cheer").innerHTML = "";
    rec.classList.add("recording");
    rec.innerHTML = `${ICON.stop}<span>I'm done</span>`;
    show("");
    if (canRecord) { try { await Recorder.start(); } catch (e) { /* recognition can still work */ } }
    if (canHear) { try { listenLoop(); } catch (e) {} }
  };
  $("#t-play").onclick = () => Recorder.play();
  $("#t-say").onclick = () => Voice.say(t.prompt);
  $("#t-example").onclick = () => {
    $("#t-ex").innerHTML = `<div class="model-answer" lang="en"><small>Example answer</small>${storyPhrasesBold(t.example, story)}
      <button class="icon-btn" type="button" id="t-ex-say" aria-label="Hear it">${ICON.speaker}</button></div>`;
    $("#t-ex-say").onclick = () => Voice.say(t.example);
    Voice.say(t.example);
  };
  setTimeout(() => { if ($("#t-say")) Voice.say(t.prompt); }, 300);
}

/** Text with the story's key phrases in bold (for transcripts and examples) */
function storyPhrasesBold(text, story) {
  const parts = String(text).split(WORD_RE);
  const words = parts.filter((_, n) => n % 2);
  const hits = findPhrases(words.map(baseOf), story.phrases);
  let w = -1;
  return parts.map((part, n) => {
    if (n % 2 === 0) return esc(part);
    w++;
    return (hits.some((h) => h.start === w) ? "<mark>" : "") + esc(part) + (hits.some((h) => h.end === w) ? "</mark>" : "");
  }).join("");
}
function sentenceLike(text, story) { return `“${storyPhrasesBold(text, story)}”`; }

/* ---------- 8. Notice (grammar) ---------- */
function stepNotice(story, n) {
  const g = story.notice || {};
  // "wake{s}" in the data marks the ending to highlight
  const addS = (s) => esc(s).replace(/\{(\w+)\}/g, '<b class="s-end">$1</b>');
  const plain = (s) => s.replace(/[{}]/g, "");
  loopShell(story, n, `
    <div class="notice-card">
      <span class="notice-icon">💡</span>
      <h2>${esc(g.title || "Notice")}</h2>
      <p class="notice-rule">${esc(g.rule || "")}</p>
      <div class="pairs">
        ${(g.pairs || []).map(([a, b], k) => `
          <div class="pair">
            <span lang="en">${esc(a)}</span><span class="arrow">→</span><span lang="en">${addS(b)}</span>
            <button class="icon-btn" type="button" data-pair="${k}" aria-label="Hear it">${ICON.speaker}</button>
          </div>`).join("")}
      </div>
      ${(g.fromStory || []).length ? `<p class="eyebrow">From the story</p><ul class="from-story">${g.fromStory.map((s) => `<li lang="en">${addS(s)}</li>`).join("")}</ul>` : ""}
    </div>
    ${spikoSays("Say each pair out loud. Listen for the -s sound!")}`,
  { nextLabel: "Done" });
  $$("[data-pair]").forEach((b) => b.onclick = () => { const [a, c] = g.pairs[+b.dataset.pair]; Voice.say(`${plain(a)}. ${plain(c)}.`); });
}

/* ---------- 9. Done ---------- */
function stepDone(story, n) {
  Progress.set(story.id, { done: true, step: LOOP_STEPS.length - 1 });
  const p = Progress.get(story.id);
  const saved = Words.all().filter((w) => w.story === story.id).length;
  const savedPhrases = Reviews.all().filter((r) => r.story === story.id).length;
  const score = p.choice ? `${p.choice.score}/${p.choice.total}` : "–";
  const nx = nextStoryAfter(story);
  loopShell(story, n, `
    ${confetti()}
    <div class="done">
      <svg class="done-logo" aria-hidden="true"><use href="#spiko-logo"/></svg>
      <h1>Story complete!</h1>
      <div class="stats">
        <div class="stat"><b>${score}</b>quiz<br/>score</div>
        <div class="stat"><b>${p.phrasesUsed || 0}/${story.phrases.length}</b>phrases<br/>used</div>
        <div class="stat"><b>${saved}</b>words &amp;<br/>phrases saved</div>
      </div>
      <p class="saved-badge">✓ Saved in your progress</p>
      ${savedPhrases
        ? spikoSays(`Your ${savedPhrases} saved ${savedPhrases === 1 ? "phrase comes" : "phrases come"} back for a quick review tomorrow, in 3 days and in 7 days. 🔁`)
        : spikoSays("Tip: save phrases in step 3 — they come back for a quick review tomorrow, in 3 days and in 7 days. 🔁")}
      <div class="actions">
        ${nx.story ? `<a class="btn btn-orange btn-big btn-block" href="#/story/${esc(nx.story.id)}">Next story →</a>`
                   : `<button id="next-soon" class="btn btn-orange btn-big btn-block" type="button">Next story <span class="soon">Coming soon</span></button>`}
        <a class="btn btn-navy btn-big btn-block" href="#/section/${esc(story.sectionId)}">Back to topics</a>
        <div class="row2">
          <a class="btn btn-ghost" href="#/words">My words</a>
          <button id="loop-restart" class="btn btn-outline" type="button">Start again</button>
        </div>
      </div>
    </div>`, { next: false, nav: false });
  Voice.say("Story complete! Great job!");
  const soon = $("#next-soon");
  if (soon) soon.onclick = () => toast(nx.soon ? `Story ${nx.soon} is coming soon 🚀` : "More stories coming soon 🚀");
  $("#loop-restart").onclick = () => { Object.assign(loop, { shadow: 0, quiz: 0, quizScore: 0, answer: 0 }); location.hash = `#/story/${story.id}/step/0`; };
}

/* ---------- Quick review (saved phrases: day 1, 3, 7) ---------- */
function renderReview(practiceAll) {
  const list = practiceAll ? Reviews.all() : Reviews.due();
  const upcoming = Reviews.all().filter((r) => r.stage < REVIEW_DAYS.length).sort((a, b) => a.due - b.due);
  if (!list.length) {
    app().innerHTML = `
      <a href="#/" class="back-link">${ICON.back}Home</a>
      <h1 class="page-title">Quick review</h1>
      ${spikoSays(Reviews.all().length ? "Nothing to review today. Come back tomorrow! 🌙" : "Save phrases in a story (step 3). They come back here tomorrow, in 3 days and in 7 days.")}
      ${upcoming.length ? `<h2 class="h2">Coming up</h2><ul class="word-list">${upcoming.map((r) => `
        <li class="word-item"><div class="wi-body"><h3>${esc(r.phrase)}</h3><p>Review ${r.stage + 1} of 3 · ${new Date(r.due).toLocaleDateString()}</p></div></li>`).join("")}</ul>
        <button id="rv-all" class="btn btn-outline btn-block" type="button" style="margin-top:14px">Practice all now</button>` : ""}`;
    const all = $("#rv-all"); if (all) all.onclick = () => renderReview(true);
    return;
  }
  let i = 0, remembered = 0;
  const card = () => {
    if (i >= list.length) {
      app().innerHTML = `
        <a href="#/" class="back-link">${ICON.back}Home</a>
        <div class="done"><h1>Review done! 🎉</h1>
        <div class="stat"><b>${remembered}/${list.length}</b>remembered</div>
        ${spikoSays("Great memory! See you at the next review.")}
        <a class="btn btn-orange btn-big btn-block" href="#/">Home</a></div>`;
      updateReviewBadge();
      return;
    }
    const r = list[i];
    app().innerHTML = `
      <a href="#/" class="back-link">${ICON.back}Home</a>
      <p class="eyebrow">Quick review · ${i + 1} of ${list.length}</p>
      ${progressBar((i + 1) / list.length)}
      <div class="review-card">
        <h2 lang="en">${esc(r.phrase)}</h2>
        <button id="rv-say" class="icon-btn" type="button" aria-label="Hear it">${ICON.speaker}</button>
        <p class="rv-q">Do you remember what it means? Say an example out loud.</p>
        <div id="rv-back" hidden>
          <p class="pc-meaning">${esc(r.meaning)}</p>
          <p class="pc-ex" lang="en">“${highlightPhrase(r.ex, r.phrase)}”</p>
        </div>
        <button id="rv-show" class="btn btn-primary btn-block" type="button">Show meaning</button>
        <div id="rv-rate" class="row2" hidden>
          <button id="rv-no" class="btn btn-outline" type="button">Not yet</button>
          <button id="rv-yes" class="btn btn-orange" type="button">I remembered ✓</button>
        </div>
      </div>`;
    Voice.say(r.phrase);
    $("#rv-say").onclick = () => Voice.say(r.phrase, () => Voice.say(r.ex));
    $("#rv-show").onclick = () => { $("#rv-back").hidden = false; $("#rv-rate").hidden = false; $("#rv-show").hidden = true; Voice.say(r.ex); };
    $("#rv-yes").onclick = () => { if (!practiceAll) Reviews.mark(r.phrase, true); remembered++; i++; card(); };
    $("#rv-no").onclick = () => { if (!practiceAll) Reviews.mark(r.phrase, false); i++; card(); };
  };
  card();
}
