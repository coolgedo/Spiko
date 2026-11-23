# Spiko — Speak English. Live it.

A mobile-first English learning page for Arabic speakers. Plain HTML, CSS and JavaScript with no frameworks and no build step, ready for GitHub Pages.

## Flow
1. **Splash** – the logo zooms in, blinks, then fades out.
2. **Intro** (Arabic) – 5 full-screen slides in the style of Instagram stories, with a progress bar at the top. Each slide moves on after about 5 seconds, or when its Arabic voice-over ends. Tap the right side for the next slide, the left side to go back, and press and hold to pause. Use "تخطي" to skip. The voice-over uses an Arabic `speechSynthesis` voice (Egyptian if the device has one). With no Arabic voice, the slides show text only.
3. **Guide** (Arabic) – how to learn with Spiko → "يلا نبدأ".
4. **Story** – Listen (read aloud with the current sentence highlighted) → Read → tap any word for its meaning, pronunciation, an Oxford "More" link and "Save" → questions (record yourself, play it back, model answer) → "Story complete!".

Screens 1–3 show only on the first visit (`localStorage`). "My words" has a link to show the intro again.

## Files
```
index.html                  page shell + logo SVG
css/style.css               styles (brand colors, Baloo 2)
js/app.js                   all logic (voice, intro slides, router, screens, recorder)
data/sections.json          sections (topics) and the order of their stories
data/stories/<id>.json      one file per story: text, key words, questions
data/dictionary.json        Spiko's simple meanings, shared by all stories
data/onboarding.json        intro slides + Arabic guide text
img/logo.svg                favicon / logo
```

## Add a new story (no code changes)
1. Create `data/stories/first-interview.json`:
```json
{
  "id": "first-interview",
  "number": 2,
  "title": "First Interview",
  "paragraphs": [
    ["Sentence one.", "Sentence two."],
    ["Next paragraph."]
  ],
  "audio": null,
  "words": ["interview", "nervous"],
  "questions": [
    { "q": "Question?", "a": "Model answer." }
  ]
}
```
   Each paragraph is a list of sentences, so the sentence being read can be highlighted. `words` lists the story's key words, which are highlighted in the text.
2. Add its id to the section in `data/sections.json`: `"stories": ["graduation-day", "first-interview"]`.
3. Add meanings for any new words to `data/dictionary.json`: `"interview": "a meeting where a company asks you questions for a job"`. A word that's missing from the dictionary is looked up online at dictionaryapi.dev.

For a new topic, add another object to `sections` with its own `id`, `title`, `total` and `stories`.

## Edit the intro slides
Each slide in `data/onboarding.json` has these fields:
- `emoji`: the big picture at the top.
- `logo`: how the logo moves, one of `blink`, `bounce` or `wave`.
- `theme`: the background, one of `navy`, `light`, `blue`, `orange` or `white`.
- `text`: what's shown and read aloud.
- `voice` (optional): different text to read aloud instead of `text`.
- `lang`: `"en"` for an English line.
- `button` (optional): shows a button that opens the guide.

## Recorded voices (later)
All audio goes through the `Voice` object in `js/app.js` (`Voice.playItem`). To use recorded files, set `"audio"` to a list of file URLs, one per sentence, in the same order as the sentences, e.g. `["audio/graduation-day/01.mp3", ...]`. Those files are then played instead of the browser voice.

## Run locally
`fetch()` doesn't work from `file://`, so serve the folder:
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000. The microphone needs HTTPS or localhost; GitHub Pages is HTTPS.

## Deploy
On GitHub, go to Settings → Pages → Deploy from branch → `main` / root.
