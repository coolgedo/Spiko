/* Spiko — shared core: helpers, storage, voices, speech recognition, recorder,
   saved words, progress and dictionary lookup. Plain JS, no build step.
   Scripts load in order: core.js → intro.js → app.js (they share globals). */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const KEY_ONBOARDED = "spiko.onboarded";
const KEY_WORDS = "spiko.words";
const KEY_PROGRESS = "spiko.progress";
const KEY_SPEED = "spiko.speed";

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1a7 7 0 0 0 6-6.9h-2z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a1 1 0 0 0 0 2H20v2H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  logo: '<svg aria-hidden="true"><use href="#spiko-logo"/></svg>'
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
  toast._t = setTimeout(() => { t.hidden = true; }, 2400);
}

function spikoSays(text, extraClass = "") {
  return `<div class="spiko-says ${extraClass}">${ICON.logo}<div class="bubble">${esc(text)}</div></div>`;
}

/* =====================================================================
   VOICE — every bit of audio goes through Voice.playItem().
   Today: browser speechSynthesis, with a different voice per character.
   Later: recorded files — give a line an `audio` URL and it is played instead.
   ===================================================================== */
const FEMALE_RE = /female|samantha|karen|zira|jenny|aria|ava|allison|susan|serena|victoria|moira|tessa|fiona|veena|kate|libby|sonia|emma|michelle|joanna|salli|kimberly|ivy|amy|nicky|natasha|hazel|catherine|google us english/;
const MALE_RE = /\bmale\b|daniel|alex|david|mark|guy|fred|tom|rishi|oliver|ryan|george|arthur|aaron|gordon|lee|thomas|christopher|eric|matthew|brian|william|james|google uk english male/;

const SPEEDS = [
  { id: "slow", label: "🐢 Slow", rate: 0.65 },
  { id: "normal", label: "Normal", rate: 0.8 },
  { id: "fast", label: "Fast", rate: 1.0 }
];

const Voice = {
  voice: null,       // best English voice (narrator)
  arVoice: null,     // Arabic voice (intro voice-over)
  females: [], males: [], english: [],
  _utter: null, _audio: null, _token: 0,

  get rate() {
    const sp = SPEEDS.find((s) => s.id === store.get(KEY_SPEED, "normal")) || SPEEDS[1];
    return sp.rate;
  },

  /**
   * Voice for a story character from data/characters.json: { gender: male|female|group, slot: n }.
   * Each slot gets a different device voice of that gender; when the device has fewer
   * voices than characters, the same voice is reused with a different pitch.
   */
  forCharacter(c) {
    const g = c && c.gender;
    const slot = (c && c.slot) || 0;
    if (g !== "male" && g !== "female") return { voice: this.voice, pitch: 1 };
    let pool = g === "female" ? this.females : this.males;
    let base = 1;
    if (!pool.length) {                       // no voice of that gender: any English voice, shifted pitch
      pool = this.english.length ? this.english : [null];
      base = g === "female" ? 1.2 : 0.85;
    }
    const round = Math.floor(slot / pool.length);
    const PITCH = [1, 0.82, 1.15, 0.72, 1.25, 0.9, 1.08];
    return { voice: pool[slot % pool.length] || this.voice, pitch: Math.min(2, Math.max(0.5, base * PITCH[round % PITCH.length])) };
  },

  init() {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      const all = speechSynthesis.getVoices();
      this.english = this.rankEnglish(all);
      this.voice = this.english[0] || null;
      this.females = this.english.filter((v) => FEMALE_RE.test(v.name.toLowerCase()));
      this.males = this.english.filter((v) => !FEMALE_RE.test(v.name.toLowerCase()) && MALE_RE.test(v.name.toLowerCase()));
      this.arVoice = this.pickArabic(all);
    };
    pick();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", pick);
    else speechSynthesis.onvoiceschanged = pick;
  },

  rankEnglish(voices) {
    const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
    const score = (v) => {
      let s = 0;
      const n = v.name.toLowerCase();
      if (/natural|neural|premium|enhanced|wavenet/.test(n)) s += 50;
      if (/google us english|samantha|ava|allison|jenny|aria|zira|karen|daniel|serena/.test(n)) s += 30;
      if (/google/.test(n)) s += 15;
      if (/en[-_]us/i.test(v.lang)) s += 10;
      else if (/en[-_]gb/i.test(v.lang)) s += 8;
      if (v.localService) s += 2;
      if (/compact|novelty|bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|albert|jester|organ|superstar|wobble|eloquence|grandma|grandpa|rocko|shelley|flo|reed|sandy/.test(n)) s -= 100;
      return s;
    };
    return en.filter((v) => score(v) > -50).sort((a, b) => score(b) - score(a));
  },

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
   * A voice for a character role: narrator | female | female2 | male | male2 | male3 | child.
   * Uses a different real voice when the device has one, otherwise changes the pitch.
   */
  forRole(role) {
    const r = role || "narrator";
    const base = this.voice;
    // Characters avoid the narrator's voice when the device has other voices
    const notBase = (list) => { const l = list.filter((v) => v !== base); return l.length ? l : list; };
    const nth = (list, i) => notBase(list)[i] || null;
    switch (r) {
      // Same voice as another role? Change the pitch so they still sound different
      case "female":  { const v = nth(this.females, 0); return { voice: v || base, pitch: v && v !== base ? 1 : 1.25 }; }
      case "female2": { const v = nth(this.females, 1); return { voice: v || nth(this.females, 0) || base, pitch: v && v !== base ? 1 : 1.12 }; }
      case "male":    { const v = nth(this.males, 0); return { voice: v || base, pitch: v && v !== base ? 1 : 0.85 }; }
      case "male2":   { const v = nth(this.males, 1); return { voice: v || nth(this.males, 0) || base, pitch: v ? 1 : 0.72 }; }
      case "male3":   { const v = nth(this.males, 2); return { voice: v || nth(this.males, 0) || base, pitch: v ? 0.95 : 0.65 }; }
      case "child":   return { voice: nth(this.females, 0) || base, pitch: 1.45 };
      default:        return { voice: base, pitch: 1 };
    }
  },

  /**
   * Play one item: { text, lang?, role?, audio? }.
   * onEnd(error) is called when finished (not when stopped); error is set on failure.
   */
  playItem(item, onEnd, onStart) {
    const token = this._token;
    const done = (err) => { if (token === this._token && onEnd) onEnd(err); };

    if (item.audio) {                              // recorded voice file
      const a = new Audio(item.audio);
      this._audio = a;
      a.playbackRate = item.lang === "ar" ? 1 : this.rate / 0.8;
      a.onended = () => done();
      a.onerror = () => done("audio-error");
      a.onplay = () => onStart && onStart();
      a.play().catch(() => done("not-allowed"));
      return;
    }
    if (!("speechSynthesis" in window)) { setTimeout(() => done("unsupported"), 300); return; }
    const isAr = item.lang === "ar";
    const prof = isAr ? { voice: this.arVoice, pitch: 1 } : item.character ? this.forCharacter(item.character) : this.forRole(item.role);
    let u;
    try {
      u = new SpeechSynthesisUtterance(String(item.text).replace(/["“”]/g, ""));
      u.lang = (prof.voice && prof.voice.lang) || (isAr ? "ar-EG" : "en-US");
      if (prof.voice) u.voice = prof.voice;
      u.pitch = prof.pitch;
      u.rate = isAr ? 0.95 : (item.rate || this.rate);
    } catch (e) { setTimeout(() => done("error"), 0); return; }
    u.onstart = () => onStart && onStart();
    u.onend = () => done();
    u.onerror = (e) => done((e && e.error) || "error");
    this._utter = u;                               // keep a reference (Chrome GC bug)
    try { speechSynthesis.speak(u); } catch (e) { setTimeout(() => done("error"), 0); }
  },

  /** Play a list of items in order, from `start`. */
  playList(items, start, { onItem, onDone } = {}) {
    this.stop();
    const token = this._token;
    const next = (i) => {
      if (token !== this._token) return;
      if (i >= items.length) { if (onDone) onDone(); return; }
      if (onItem) onItem(i);
      this.playItem(items[i], () => setTimeout(() => next(i + 1), 250));
    };
    next(start || 0);
  },

  /** Speak a word / sentence with the narrator voice. */
  say(text, onEnd, opts = {}) {
    this.stop();
    this.playItem({ text, ...opts }, onEnd);
  },

  stop() {
    this._token++;
    if (this._audio) { this._audio.pause(); this._audio = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
};

/* =====================================================================
   LISTENER — speech recognition (what the learner says → text)
   ===================================================================== */
const Listener = {
  rec: null,
  supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  /**
   * Start listening. Calls onUpdate(text, isFinal) as words arrive,
   * and onEnd(finalText, error) once it stops (silence, stop() or error).
   */
  start({ onUpdate, onEnd } = {}) {
    this.abort();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 3;
    let finalText = "", interim = "", error = null;
    rec.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += (finalText ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      if (onUpdate) onUpdate((finalText + " " + interim).trim(), !interim);
    };
    rec.onerror = (e) => { error = e.error || "error"; };
    rec.onend = () => {
      if (this.rec === rec) this.rec = null;
      if (onEnd) onEnd((finalText || interim).trim(), error);
    };
    this.rec = rec;
    rec.start();
  },
  stop() { if (this.rec) this.rec.stop(); },
  abort() { if (this.rec) { const r = this.rec; this.rec = null; r.onend = null; try { r.abort(); } catch (e) {} } }
};

/* =====================================================================
   RECORDER — MediaRecorder, so learners can hear themselves
   ===================================================================== */
const Recorder = {
  rec: null, stream: null, url: null, chunks: [], player: null,
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
  async start() {
    this.reset();
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
        this.url = blob.size ? URL.createObjectURL(blob) : null;
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

/* =====================================================================
   SAVED WORDS + PROGRESS (localStorage)
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
function updateCount() { const c = $("#words-count"); if (c) c.textContent = Words.all().length; }

// progress[storyId] = { listened, read, choice: {score,total}, answered, done, at }
const Progress = {
  all() { return store.get(KEY_PROGRESS, {}); },
  get(id) { return this.all()[id] || {}; },
  set(id, patch) {
    const all = this.all();
    all[id] = { ...(all[id] || {}), ...patch, at: Date.now() };
    store.set(KEY_PROGRESS, all);
    store.set("spiko.last", id);
  },
  /** 0..1 — listen, read, multiple choice, open questions (25 % each) */
  percent(id) {
    const p = this.get(id);
    if (p.done) return 1;
    return ((p.listened ? 1 : 0) + (p.read ? 1 : 0) + (p.choice ? 1 : 0) + (p.answered ? 1 : 0)) / 4;
  }
};

/* =====================================================================
   DICTIONARY — data/dictionary.json, with base-form lookup
   ===================================================================== */
let DICT = {};      // word → simple meaning
let FORMS = {};     // irregular form → base (went → go)

/** Candidate base forms for a word, most likely first: tears→tear, cried→cry, stopping→stop */
function baseForms(word) {
  let w = word.toLowerCase().replace(/[’']/g, "'").replace(/'s$|s'$/, "");
  w = w.replace(/n't$/, "").replace(/'(re|ve|ll|d|m)$/, "");
  const out = [w];
  if (FORMS[w]) out.unshift(FORMS[w]);
  const add = (x) => { if (x && x.length > 1 && !out.includes(x)) out.push(x); };
  if (/ies$/.test(w)) add(w.slice(0, -3) + "y");
  if (/ied$/.test(w)) add(w.slice(0, -3) + "y");
  if (/es$/.test(w)) add(w.slice(0, -2));
  if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
  if (/ed$/.test(w)) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (/([b-df-hj-np-tv-z])\1ed$/.test(w)) add(w.slice(0, -3));     // stopped → stop
  }
  if (/ing$/.test(w)) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + "e");                                       // smiling → smile
    if (/([b-df-hj-np-tv-z])\1ing$/.test(w)) add(w.slice(0, -4));    // stopping → stop
  }
  if (/er$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/est$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  if (/ly$/.test(w)) add(w.slice(0, -2));
  return out;
}

/** → { base, meaning } from our dictionary, or null */
function lookupWord(word) {
  const has = (k) => Object.prototype.hasOwnProperty.call(DICT, k) && k[0] !== "_";
  const lower = word.toLowerCase().replace(/[’]/g, "'");
  if (has(lower)) return { base: lower, meaning: DICT[lower] };      // "it's", "can't" as entries
  for (const b of baseForms(lower)) if (has(b)) return { base: b, meaning: DICT[b] };
  return null;
}

const dictCache = {};
/** Fallback: free online dictionary → first short definition */
async function fetchDefinition(word) {
  if (dictCache[word]) return dictCache[word];
  const res = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word));
  if (!res.ok) throw new Error("not found");
  const data = await res.json();
  let best = null;
  outer: for (const entry of data) {
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        if (!best) best = { pos: m.partOfSpeech, def: d.definition };
        if (d.definition.length <= 110) { best = { pos: m.partOfSpeech, def: d.definition }; break outer; }
      }
    }
  }
  if (!best) throw new Error("no definition");
  const phonetic = data[0].phonetic || ((data[0].phonetics || []).find((p) => p.text) || {}).text || "";
  return (dictCache[word] = { ...best, phonetic });
}
