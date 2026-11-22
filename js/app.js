/* Spiko — plain JS, no build step. Content lives in data/*.json */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const KEY_ONBOARDED = "spiko.onboarded";
  const KEY_WORDS = "spiko.words";

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1a7 7 0 0 0 6-6.9h-2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a1 1 0 0 0 0 2H20v2H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>',
    logo: '<svg aria-hidden="true"><use href="#spiko-logo"/></svg>'
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
    }
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* =====================================================================
     VOICE — every bit of audio goes through here.
     Today: browser speechSynthesis. Later: recorded files.
     To switch, give an item an `audio` URL (e.g. story.audio[i]) and
     Voice.playItem will play the file instead of speaking the text.
     ===================================================================== */
  const Voice = {
    rate: 0.9,
    voice: null,
    _utter: null,      // keep a reference (Chrome GC bug)
    _audio: null,
    _token: 0,

    init() {
      if (!("speechSynthesis" in window)) return;
      const pick = () => { this.voice = this.pickVoice(speechSynthesis.getVoices()); };
      pick();
      speechSynthesis.addEventListener ? speechSynthesis.addEventListener("voiceschanged", pick) : (speechSynthesis.onvoiceschanged = pick);
    },

    pickVoice(voices) {
      const en = voices.filter((v) => /^en[-_]/i.test(v.lang) || v.lang === "en");
      if (!en.length) return null;
      const score = (v) => {
        let s = 0;
        const n = v.name.toLowerCase();
        if (/natural|neural|premium|enhanced|wavenet/.test(n)) s += 50;
        if (/google us english|samantha|ava|allison|jenny|aria|zira|karen|daniel|serena/.test(n)) s += 30;
        if (/google/.test(n)) s += 15;
        if (/en[-_]us/i.test(v.lang)) s += 10;
        else if (/en[-_]gb/i.test(v.lang)) s += 8;
        if (v.localService) s += 2;
        if (/compact|novelty|bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|albert|jester|organ|superstar|wobble|eloquence/.test(n)) s -= 100;
        return s;
      };
      return en.sort((a, b) => score(b) - score(a))[0];
    },

    /** Play one item: { text, audio? }. Calls onEnd when finished (not when stopped). */
    playItem(item, onEnd) {
      const token = this._token;
      const done = () => { if (token === this._token && onEnd) onEnd(); };

      if (item.audio) {                         // recorded voice file
        const a = new Audio(item.audio);
        this._audio = a;
        a.onended = done;
        a.onerror = done;
        a.play().catch(done);
        return;
      }
      if (!("speechSynthesis" in window)) { setTimeout(done, 300); return; }
      const u = new SpeechSynthesisUtterance(item.text.replace(/["“”]/g, ""));
      u.lang = (this.voice && this.voice.lang) || "en-US";
      if (this.voice) u.voice = this.voice;
      u.rate = this.rate;
      u.onend = done;
      u.onerror = done;
      this._utter = u;
      speechSynthesis.speak(u);
    },

    /** Play a list of items in order, from `start`. */
    playList(items, start, { onItem, onDone } = {}) {
      this.stop();
      const token = this._token;
      const next = (i) => {
        if (token !== this._token) return;
        if (i >= items.length) { onDone && onDone(); return; }
        onItem && onItem(i);
        this.playItem(items[i], () => next(i + 1));
      };
      next(start || 0);
    },

    /** Speak a single word / sentence. */
    say(text, onEnd) {
      this.stop();
      this.playItem({ text }, onEnd);
    },

    stop() {
      this._token++;
      if (this._audio) { this._audio.pause(); this._audio = null; }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    }
  };

  /* =====================================================================
     Data
     ===================================================================== */
  let STORIES = [];
  let ONBOARD = null;

  async function loadJSON(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(url + " " + res.status);
    return res.json();
  }

  // Flatten a story to sentence items (text + optional recorded audio URL)
  function sentencesOf(story) {
    const items = [];
    story.paragraphs.forEach((p) => p.forEach((text) => {
      const i = items.length;
      items.push({ text, audio: Array.isArray(story.audio) ? story.audio[i] : null });
    }));
    return items;
  }

  /* =====================================================================
     Saved words
     ===================================================================== */
  const Words = {
    all() { return store.get(KEY_WORDS, []); },
    has(w) { return this.all().some((x) => x.word === w); },
    add(entry) {
      const list = this.all().filter((x) => x.word !== entry.word);
      list.unshift(entry);
      store.set(KEY_WORDS, list);
      updateCount();
    },
    remove(w) { store.set(KEY_WORDS, this.all().filter((x) => x.word !== w)); updateCount(); }
  };
  function updateCount() { $("#words-count").textContent = Words.all().length; }

  /* =====================================================================
     Onboarding: splash → intro → guide (first visit only)
     ===================================================================== */
  function show(id) {
    ["splash", "intro", "guide", "app-shell"].forEach((s) => { $("#" + s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function finishOnboarding() {
    store.set(KEY_ONBOARDED, true);
    clearTimeout(runIntro._t);
    startApp();
  }

  function runSplash() {
    show("splash");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const go = () => { clearTimeout(t); runIntro(); };
    const t = setTimeout(go, reduced ? 600 : 3100);
    $("#splash").addEventListener("click", go, { once: true });
  }

  function runIntro() {
    show("intro");
    const box = $("#intro-text");
    const lines = ONBOARD.intro.map((t) => ({ t, end: false })).concat([{ t: ONBOARD.introEnd, end: true }]);
    box.innerHTML = lines.map((l) => `<p class="${l.end ? "end" : ""}"${l.end ? ' lang="en"' : ""}>${esc(l.t)}</p>`).join("");
    const ps = [...box.children];
    let i = 0;
    const step = () => {
      if (i >= ps.length) return;
      ps[i].classList.add("show");
      if (i > 2) ps[i].scrollIntoView({ behavior: "smooth", block: "nearest" });
      i++;
      runIntro._t = setTimeout(step, 900);
    };
    step();
    $("#intro-next").onclick = runGuide;
  }

  function runGuide() {
    clearTimeout(runIntro._t);
    show("guide");
    $("#guide-title").textContent = ONBOARD.guideTitle;
    $("#guide-text").innerHTML = ONBOARD.guide.map((t, i) => `<li style="animation-delay:${i * 0.12}s">${esc(t)}</li>`).join("");
    $("#guide-start").onclick = finishOnboarding;
  }

  /* =====================================================================
     App / router
     ===================================================================== */
  const app = () => $("#app");
  const state = { storyId: null, playing: false, index: 0, revealed: false, qIndex: 0 };

  function startApp() {
    show("app-shell");
    updateCount();
    window.addEventListener("hashchange", route);
    route();
  }

  function route() {
    Voice.stop();
    Recorder.reset();
    closeSheet();
    state.playing = false;
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    window.scrollTo(0, 0);
    if (parts[0] === "words") return renderWords();
    const story = STORIES.find((s) => s.id === parts[1]) || STORIES[0];
    if (!story) { app().innerHTML = '<p class="empty">No stories yet.</p>'; return; }
    if (parts[2] === "questions") return renderQuestions(story);
    if (parts[2] === "done") return renderDone(story);
    renderStory(story);
  }

  function spikoSays(text) {
    return `<div class="spiko-says">${ICON.logo}<div class="bubble">${esc(text)}</div></div>`;
  }

  /* ---------- Story ---------- */
  function tokenize(sentence) {
    // Split into words (tappable) and everything else
    return sentence.split(/([A-Za-z]+(?:['’][A-Za-z]+)*)/).map((part, i) => {
      if (i % 2 === 0) return esc(part);
      const key = lookupKeyWord(currentStory, part.toLowerCase());
      return `<span class="w${key ? " key" : ""}" data-w="${esc(part)}">${esc(part)}</span>`;
    }).join("");
  }

  let currentStory = null;

  function renderStory(story) {
    currentStory = story;
    if (state.storyId !== story.id) { state.storyId = story.id; state.index = 0; state.revealed = false; }
    const items = sentencesOf(story);
    let n = 0;
    const textHTML = story.paragraphs.map((p) =>
      "<p>" + p.map((s) => `<span class="s" data-i="${n++}">${tokenize(s)}</span>`).join(" ") + "</p>"
    ).join("");

    app().innerHTML = `
      <p class="eyebrow">${esc(story.section)} · Story ${esc(story.number)}</p>
      <h1 class="story-title">${esc(story.title)}</h1>

      <div class="player">
        <button id="btn-listen" class="btn btn-listen" type="button">${ICON.play}<span>Listen</span></button>
        <button id="btn-replay" class="icon-btn" type="button" aria-label="Replay from the start">${ICON.replay}</button>
      </div>
      <p id="player-status" class="player-status"></p>

      <div class="story-card">
        <div id="story-locked" class="story-locked">
          <div class="big-ear">🎧</div>
          <h2>Listen first</h2>
          <p>Close your eyes and just listen. Then read.</p>
          <button id="btn-read" class="btn btn-primary" type="button">${ICON.book}<span>Read</span></button>
        </div>
        <div id="story-open" hidden>
          <p class="tap-hint">Tap any word to see its meaning.</p>
          <div id="story-text" class="story-text" lang="en">${textHTML}</div>
        </div>
      </div>

      <div class="next-step">
        <a class="btn btn-navy btn-block btn-big" href="#/story/${esc(story.id)}/questions">Answer the questions →</a>
      </div>`;

    const btnListen = $("#btn-listen");
    const status = $("#player-status");

    const setActive = (i) => {
      document.querySelectorAll(".s.active").forEach((el) => el.classList.remove("active"));
      if (i == null) return;
      const el = document.querySelector(`.s[data-i="${i}"]`);
      if (el) {
        el.classList.add("active");
        if (state.revealed) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    const setUI = () => {
      btnListen.innerHTML = state.playing ? `${ICON.pause}<span>Pause</span>` : `${ICON.play}<span>${state.index > 0 ? "Continue" : "Listen"}</span>`;
      status.textContent = state.playing ? `Listening… ${state.index + 1} / ${items.length}` : (state.index > 0 ? "Paused" : "");
    };
    const play = (from) => {
      state.playing = true;
      Voice.playList(items, from, {
        onItem: (i) => { state.index = i; setActive(i); setUI(); },
        onDone: () => { state.playing = false; state.index = 0; setActive(null); setUI(); status.textContent = state.revealed ? "Well done! Listen again or answer the questions." : "Now tap Read and follow the text."; }
      });
      setUI();
    };
    const pause = () => { Voice.stop(); state.playing = false; setUI(); };

    btnListen.onclick = () => (state.playing ? pause() : play(state.index));
    $("#btn-replay").onclick = () => { state.index = 0; play(0); };

    const reveal = () => {
      state.revealed = true;
      $("#story-locked").hidden = true;
      $("#story-open").hidden = false;
      if (state.playing) setActive(state.index);
    };
    $("#btn-read").onclick = reveal;
    if (state.revealed) reveal();
    setUI();

    $("#story-text").addEventListener("click", (e) => {
      const w = e.target.closest(".w");
      if (!w) return;
      if (state.playing) pause();
      document.querySelectorAll(".w.tapped").forEach((x) => x.classList.remove("tapped"));
      w.classList.add("tapped");
      openWord(w.dataset.w, story);
    });
  }

  /* ---------- Word lookup ---------- */
  function lookupKeyWord(story, word) {
    if (!story || !story.words) return null;
    const words = story.words;
    const w = word.replace(/['’]s$/, "");
    const tries = [w, w.replace(/s$/, ""), w.replace(/es$/, ""), w.replace(/ed$/, ""), w.replace(/d$/, ""), w.replace(/ing$/, ""), w.replace(/ing$/, "e")];
    for (const t of tries) if (t && words[t]) return { base: t, meaning: words[t] };
    return null;
  }

  const dictCache = {};
  async function fetchDefinition(word) {
    if (dictCache[word]) return dictCache[word];
    const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word));
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    let best = null;
    for (const entry of data) {
      for (const m of entry.meanings || []) {
        for (const d of m.definitions || []) {
          if (!best) best = { pos: m.partOfSpeech, def: d.definition };
          if (d.definition.length <= 110) { best = { pos: m.partOfSpeech, def: d.definition }; break; }
        }
        if (best && best.def.length <= 110) break;
      }
      if (best && best.def.length <= 110) break;
    }
    if (!best) throw new Error("no definition");
    const phonetic = (data[0].phonetic || ((data[0].phonetics || []).find((p) => p.text) || {}).text || "");
    const result = { ...best, phonetic };
    dictCache[word] = result;
    return result;
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
    metaEl.textContent = key ? "Spiko word ⭐" : "";
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

  /* =====================================================================
     Recorder (MediaRecorder)
     ===================================================================== */
  const Recorder = {
    rec: null, stream: null, url: null, chunks: [], player: null,
    supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
    async start() {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      this.rec = new MediaRecorder(this.stream);
      this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.rec.start();
    },
    stop() {
      return new Promise((resolve) => {
        if (!this.rec || this.rec.state === "inactive") return resolve(this.url);
        this.rec.onstop = () => {
          if (this.url) URL.revokeObjectURL(this.url);
          const blob = new Blob(this.chunks, { type: this.rec.mimeType || "audio/webm" });
          this.url = URL.createObjectURL(blob);
          this.releaseMic();
          resolve(this.url);
        };
        this.rec.stop();
      });
    },
    play(onEnd) {
      if (!this.url) return;
      Voice.stop();
      if (this.player) this.player.pause();
      this.player = new Audio(this.url);
      this.player.onended = onEnd;
      this.player.play().catch(() => onEnd && onEnd());
    },
    releaseMic() { if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; } },
    reset() {
      if (this.rec && this.rec.state !== "inactive") { this.rec.onstop = null; try { this.rec.stop(); } catch (e) {} }
      this.releaseMic();
      if (this.player) { this.player.pause(); this.player = null; }
      if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
      this.rec = null;
    }
  };

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
    if (soon) soon.onclick = () => toast("Story 2 is coming soon 🚀");
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

  /* =====================================================================
     Boot
     ===================================================================== */
  async function boot() {
    Voice.init();

    // Word sheet close handlers
    $("#word-sheet").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
    document.querySelectorAll("[data-skip]").forEach((b) => b.addEventListener("click", finishOnboarding));
    // Clear the "My words" page click handler when leaving it
    window.addEventListener("hashchange", () => { app().onclick = null; });

    try {
      const [s, o] = await Promise.all([loadJSON("data/stories.json"), loadJSON("data/onboarding.json")]);
      STORIES = s.stories || [];
      ONBOARD = o;
    } catch (e) {
      show("app-shell");
      app().innerHTML = `<p class="empty">Couldn't load the stories.<br/>If you opened the file directly, run a local server (see README).</p>`;
      return;
    }

    if (store.get(KEY_ONBOARDED, false)) startApp();
    else runSplash();
  }

  boot();
})();
