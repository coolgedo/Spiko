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
      const pick = () => {
        const all = speechSynthesis.getVoices();
        this.voice = this.pickVoice(all);
        this.arVoice = this.pickArabic(all);
      };
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

    // Arabic voice for the intro voice-over: Egyptian first, then any Arabic
    pickArabic(voices) {
      const ar = voices.filter((v) => /^ar([-_]|$)/i.test(v.lang));
      if (!ar.length) return null;
      const score = (v) => {
        const n = v.name.toLowerCase();
        let s = 0;
        if (/ar[-_]eg/i.test(v.lang)) s += 40;
        if (/natural|neural|premium|enhanced|wavenet/.test(n)) s += 30;
        if (/google/.test(n)) s += 10;
        if (/ar[-_]sa/i.test(v.lang)) s += 5;
        return s;
      };
      return ar.sort((a, b) => score(b) - score(a))[0];
    },

    hasArabic() {
      if (!("speechSynthesis" in window)) return false;
      if (!this.arVoice) this.arVoice = this.pickArabic(speechSynthesis.getVoices());
      return !!this.arVoice;
    },

    /**
     * Play one item: { text, lang?, audio? }. lang "ar" uses the Arabic voice.
     * onEnd(error) is called when finished (not when stopped); error is set on failure.
     */
    playItem(item, onEnd, onStart) {
      const token = this._token;
      const done = (err) => { if (token === this._token && onEnd) onEnd(err); };

      if (item.audio) {                         // recorded voice file
        const a = new Audio(item.audio);
        this._audio = a;
        a.onended = () => done();
        a.onerror = () => done("audio-error");
        a.onplay = () => onStart && onStart();
        a.play().catch(() => done("not-allowed"));
        return;
      }
      if (!("speechSynthesis" in window)) { setTimeout(() => done("unsupported"), 300); return; }
      const voice = item.lang === "ar" ? this.arVoice : this.voice;
      let u;
      try {
        u = new SpeechSynthesisUtterance(item.text.replace(/["“”]/g, ""));
        u.lang = (voice && voice.lang) || (item.lang === "ar" ? "ar-EG" : "en-US");
        if (voice) u.voice = voice;
      } catch (e) { setTimeout(() => done("error"), 0); return; }
      u.rate = item.lang === "ar" ? 0.95 : this.rate;
      u.onstart = () => onStart && onStart();
      u.onend = () => done();
      u.onerror = (e) => done((e && e.error) || "error");
      this._utter = u;
      try { speechSynthesis.speak(u); } catch (e) { setTimeout(() => done("error"), 0); }
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
  let SECTIONS = [];
  let DICT = {};

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
    Intro.stop();
    startApp();
  }

  function runSplash() {
    show("splash");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let started = false;
    const go = () => { if (started) return; started = true; clearTimeout(t); Intro.start(); };
    const t = setTimeout(go, reduced ? 600 : 3100);
    $("#splash").addEventListener("click", go, { once: true });
  }

  // Inline logo (not <use>) so the eyes can blink
  const LOGO_ANIM = (cls) => `<svg class="logo-anim ${cls}" viewBox="0 0 200 200" aria-hidden="true"><line x1="100" y1="28" x2="100" y2="14" stroke="#0F1B3D" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="10" r="8" fill="#FF9F1C"/><path d="M50 146 L32 188 L86 164 Z" fill="#1F4FD1"/><circle cx="100" cy="100" r="72" fill="#1F4FD1"/><path d="M22 104 A78 78 0 0 1 178 104" fill="none" stroke="#0F1B3D" stroke-width="9" stroke-linecap="round"/><rect x="12" y="88" width="20" height="38" rx="10" fill="#0F1B3D"/><rect x="168" y="88" width="20" height="38" rx="10" fill="#0F1B3D"/><path d="M178 124 Q178 156 142 158" fill="none" stroke="#0F1B3D" stroke-width="5" stroke-linecap="round"/><circle cx="138" cy="158" r="7" fill="#FF9F1C"/><g class="eye"><ellipse cx="78" cy="94" rx="13" ry="15" fill="#fff"/><circle cx="81" cy="97" r="7" fill="#0F1B3D"/></g><g class="eye"><ellipse cx="122" cy="94" rx="13" ry="15" fill="#fff"/><circle cx="125" cy="97" r="7" fill="#0F1B3D"/></g><path d="M84 120 Q100 134 116 120" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>`;

  /* ---------- Intro: Instagram-story style slides ----------
     Each slide auto-advances after ~5 s, or when its voice-over ends
     (whichever is later). Tap right = next, tap left = back,
     press and hold = pause. */
  const KEY_MUTED = "spiko.introMuted";
  const Intro = {
    SLIDE_MS: 5000,
    i: 0, elapsed: 0, dur: 5000, last: 0, raf: 0,
    voiceDone: true, needUnlock: false, held: false, holdTimer: 0,
    slides: [], els: [], bars: [],

    start() {
      this.slides = ONBOARD.slides;
      show("intro");
      const root = $("#intro");
      $("#st-bars").innerHTML = this.slides.map(() => "<span><i></i></span>").join("");
      this.bars = [...$("#st-bars").querySelectorAll("i")];
      $("#st-slides").innerHTML = this.slides.map((s) => {
        const en = s.lang === "en";
        return `<div class="st-slide">
          <div class="st-emoji" aria-hidden="true">${esc(s.emoji || "")}</div>
          <div class="st-badge">${LOGO_ANIM("anim-" + (s.logo || "blink"))}</div>
          <p class="st-text${en ? " en" : ""}"${en ? ' lang="en"' : ""}>${esc(s.text)}</p>
          ${s.button ? `<button class="btn btn-orange btn-big st-cta" type="button" data-cta>${esc(s.button)}</button>` : ""}
        </div>`;
      }).join("");
      this.els = [...$("#st-slides").children];

      // Sound toggle only when an Arabic voice exists (otherwise: text only)
      const sound = $("#st-sound");
      const refreshSound = () => {
        sound.hidden = !Voice.hasArabic();
        sound.textContent = store.get(KEY_MUTED, false) ? "🔇" : "🔊";
      };
      refreshSound();
      if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", refreshSound);
      sound.onclick = (e) => {
        e.stopPropagation();
        const muted = !store.get(KEY_MUTED, false);
        store.set(KEY_MUTED, muted);
        refreshSound();
        if (muted) { Voice.stop(); this.voiceDone = true; this.dur = Math.max(this.elapsed, this.SLIDE_MS); }
        else this.speak();
      };
      $("#st-skip").onclick = (e) => { e.stopPropagation(); this.toGuide(); };

      // Taps: right side = next, left side = back; hold = pause
      const area = $("#st-slides");
      area.onpointerdown = (e) => {
        if (e.target.closest("button, a")) return;
        this.unlockVoice();
        this.held = false;
        clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => { this.held = true; root.classList.add("paused"); }, 280);
      };
      const release = () => { clearTimeout(this.holdTimer); root.classList.remove("paused"); };
      area.onpointerup = area.onpointercancel = area.onpointerleave = release;
      area.onclick = (e) => {
        if (e.target.closest("[data-cta]")) { this.toGuide(); return; }
        if (e.target.closest("button, a")) return;
        if (this.held) { this.held = false; return; }      // it was a hold, not a tap
        const x = e.clientX / window.innerWidth;
        if (x < 0.35) this.go(this.i - 1); else this.go(this.i + 1);
      };
      document.onkeydown = (e) => {
        if ($("#intro").hidden) return;
        if (e.key === "ArrowRight") this.go(this.i + 1);
        if (e.key === "ArrowLeft") this.go(this.i - 1);
      };

      this.go(0);
      this.last = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame((t) => this.tick(t));
    },

    go(n) {
      if (n < 0) n = 0;
      if (n >= this.slides.length) { this.toGuide(); return; }
      this.i = n;
      Voice.stop();
      this.els.forEach((el, k) => el.classList.toggle("active", k === n));
      this.bars.forEach((b, k) => { b.style.width = k < n ? "100%" : "0%"; });
      $("#intro").dataset.theme = this.slides[n].theme || "navy";
      this.elapsed = 0;
      this.dur = this.SLIDE_MS;
      this.speak();
    },

    // Voice-over for the current slide (Arabic voice; English line uses the English voice)
    speak() {
      this.voiceDone = true;
      const s = this.slides[this.i];
      const isEn = s.lang === "en";
      if (store.get(KEY_MUTED, false) || !("speechSynthesis" in window)) return;
      if (!isEn && !Voice.hasArabic()) return;                    // no Arabic voice: text only
      const text = s.voice || s.text;
      const slide = this.i;
      this.voiceDone = false;
      // Rough length estimate so the bar moves at the voice's pace
      this.dur = Math.max(this.SLIDE_MS, this.elapsed + text.length * (isEn ? 70 : 85));
      Voice.stop();
      Voice.playItem({ text, lang: isEn ? "en" : "ar" }, (err) => {
        if (slide !== this.i) return;
        this.voiceDone = true;
        if (err === "not-allowed") this.needUnlock = true;          // browser wants a tap first
        if (err) this.dur = Math.max(this.elapsed, this.SLIDE_MS);
      });
    },

    // Most browsers only allow speech after a tap; replay the voice on the first tap
    unlockVoice() {
      if (!this.needUnlock) return;
      this.needUnlock = false;
      this.speak();
    },

    tick(now) {
      const dt = Math.min(100, now - this.last);
      this.last = now;
      if (!$("#intro").hidden) {
        const paused = $("#intro").classList.contains("paused") || document.hidden;
        if (!paused) this.elapsed += dt;
        const bar = this.bars[this.i];
        if (bar) bar.style.width = Math.min(100, (this.elapsed / this.dur) * 100) + "%";
        const lastSlide = this.i === this.slides.length - 1;
        // advance when time is up and the voice is done (safety: 10 s extra max)
        if (!lastSlide && this.elapsed >= this.dur && (this.voiceDone || this.elapsed > this.dur + 10000)) {
          this.go(this.i + 1);
        }
      }
      this.raf = requestAnimationFrame((t) => this.tick(t));
    },

    toGuide() { this.stop(); runGuide(); },

    stop() {
      cancelAnimationFrame(this.raf);
      Voice.stop();
      document.onkeydown = null;
    }
  };

  function runGuide() {
    Intro.stop();
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
      return `<span class="w${key && key.key ? " key" : ""}" data-w="${esc(part)}">${esc(part)}</span>`;
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
      <p class="eyebrow">${esc(story.section)} · Story ${esc(story.number)}${story.sectionTotal ? ` of ${esc(story.sectionTotal)}` : ""}</p>
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
  // Our simple meaning from data/dictionary.json (tries plain forms: tears → tear, graduated → graduate).
  // `key` is true when the word is one of the story's key words (highlighted in the text).
  function lookupKeyWord(story, word) {
    const keys = (story && story.words) || [];
    const w = word.replace(/['’]s$/, "");
    const tries = [w, w.replace(/s$/, ""), w.replace(/es$/, ""), w.replace(/ed$/, ""), w.replace(/d$/, ""), w.replace(/ing$/, ""), w.replace(/ing$/, "e")];
    for (const t of tries) {
      if (t && Object.prototype.hasOwnProperty.call(DICT, t)) return { base: t, meaning: DICT[t], key: keys.includes(t) };
    }
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
      const [sec, dict, o] = await Promise.all([
        loadJSON("data/sections.json"), loadJSON("data/dictionary.json"), loadJSON("data/onboarding.json")
      ]);
      SECTIONS = sec.sections || [];
      DICT = dict || {};
      ONBOARD = o;
      // Load every story listed in sections.json → data/stories/<id>.json (in order)
      const lists = await Promise.all(SECTIONS.map((section) =>
        Promise.all((section.stories || []).map((id) =>
          loadJSON(`data/stories/${id}.json`)
            .then((story) => ({ ...story, id: story.id || id, section: section.title, sectionId: section.id, sectionTotal: section.total }))
            .catch(() => null)))));
      STORIES = lists.flat().filter(Boolean);
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
