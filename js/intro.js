/* Spiko — splash, Instagram-style intro slides and guide (first visit only).
   Content: data/onboarding.json. Depends on core.js; calls startApp() from app.js. */
"use strict";

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

