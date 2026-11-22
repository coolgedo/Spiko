# Spiko — Speak English. Live it.

A mobile-first English learning page for Arabic speakers. Plain HTML, CSS and JavaScript with no frameworks and no build step, ready for GitHub Pages.

## Flow
1. **Splash** – the logo zooms in, blinks, then fades out.
2. **Intro** (Arabic, RTL) – the motivational text, one paragraph at a time.
3. **Guide** (Arabic, RTL) – how to learn with Spiko → "يلا نبدأ".
4. **Story** – Listen (read aloud with the current sentence highlighted, pause/continue, replay) → Read → tap any word for its meaning, pronunciation, a "More" link to Oxford Learner's and a "Save" button → questions (record your answer, play it back, model answer) → "Story complete!".

Screens 1–3 show only on the first visit (`localStorage`); there's a "Skip" link. "My words" has a link to show the intro again.

## Files
```
index.html            page shell + logo SVG
css/style.css         styles (brand colors, Baloo 2)
js/app.js             all logic (voice, router, screens, recorder)
data/stories.json     stories: text, key words, questions
data/onboarding.json  Arabic intro + guide text
img/logo.svg          favicon / logo
```

## Add a new story
Append an object to `stories` in `data/stories.json`. No code changes are needed:
```json
{
  "id": "first-interview",
  "section": "Build Your Future",
  "number": 2,
  "title": "First Interview",
  "paragraphs": [["Sentence one.", "Sentence two."], ["Next paragraph."]],
  "audio": null,
  "words": { "interview": "a meeting where a company asks you questions for a job" },
  "questions": [{ "q": "Question?", "a": "Model answer." }]
}
```
Each paragraph is a list of sentences, so the app can highlight one sentence at a time. Stories appear in the order of the array, and the "Next story" button links to the next one.

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
