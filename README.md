# Spiko — Speak English. Live it.

A mobile-first English learning web app for Arabic speakers. Plain HTML, CSS and JavaScript with no frameworks and no build step, ready for GitHub Pages. All content lives in `data/`, so you can add stories without touching code.

The full product spec is in [`spiko_v2_prompt.md`](spiko_v2_prompt.md).

## Flow
1. **Splash** – the logo zooms in, blinks, then fades out.
2. **Intro** (Arabic) – 5 full-screen slides in the style of Instagram stories, with progress bars and an Arabic voice-over when the device has one.
   - Tap the right side for the next slide, the left side to go back, and press and hold to pause.
   - "تخطي" skips to the guide.
3. **Guide** (Arabic) → "يلا نبدأ". Screens 1–3 show only on the first visit.
4. **Home** – section covers. Build Your Future is open; Home, Hospital, Travel and School show "قريبًا".
5. **Topics** – Graduation (Story 1), Job Search (2), Interviews (3–6) and Work (7), with emoji covers and completed counts.
6. **Story list** – the stories in a topic, with ✓ on completed ones.
7. **Story** – scene cards (emoji, title, sound note) and chat bubbles. Each speaker has a coloured avatar showing their first letter and their own voice.
   - Speed: Slow 0.65, Normal 0.8 or Fast 1.0.
   - Listen first, then tap **Read**.
   - Tap a bubble to hear its line again. Tap any word for the dictionary popup.
8. **Part A** – multiple choice. Spiko reads the question and options aloud; you say the answer (or tap it). You see ✓/✗ marks, then your score.
9. **Part B** – open questions by voice.
   - "We heard: …" shows what Spiko understood, and "Play my voice" plays your recording.
   - Spiko gives feedback by key-word overlap: Excellent / Good try / Let's listen together.
   - "Show answer" shows the model answer, then "Repeat after me" lets you say it again.
   - The last question is personal: Spiko says "Thank you for sharing! 👏" and shows the example as an idea.
10. **Story complete!** – your score, saved words, ✓ saved in progress, and **Next story** / **Back to topics**.
11. **My words** – saved words with emoji, definition and example, plus Play all.

Progress, saved words and the speed setting are kept in `localStorage`.

## Files
```
index.html                  page shell + logo SVG
css/style.css               styles (brand colors, Baloo 2)
js/core.js                  voices (Voice), speech recognition (Listener), recorder, storage, dictionary lookup
js/intro.js                 splash, intro slides, guide
js/app.js                   navigation, story view, questions, end screen, My words
data/sections.json          sections → topics → story slots
data/stories/<id>.json      one file per story
data/characters.json        names, colours and voices of all characters
data/dictionary.json        494 words: definition, example, emoji + irregular forms
data/onboarding.json        intro slides + Arabic guide text
tools/build_stories.py      converts the stories in spiko_v2_prompt.md to data/stories/*.json
tools/check_dictionary.js   lists any story word missing from the dictionary
```

## Add a story
1. Write it in the same format as the CONTENT section of `spiko_v2_prompt.md` and run `python3 tools/build_stories.py`. Or create `data/stories/<id>.json` by hand:
```json
{
  "id": "first-day", "number": 8, "title": "First Day", "cover": "🏢",
  "scenes": [
    { "title": "The office, 9:00 a.m.", "emoji": "🏢", "sound": "phones ringing", "lines": [
        { "who": "nadia", "text": "Welcome to BlueLine, Adam!" },
        { "who": "adam", "note": "nervous", "text": "Thank you. I'm happy to be here." }
    ]}
  ],
  "words": ["welcome"],
  "choice": [ { "q": "Who welcomes Adam?", "options": ["Sami", "Nadia", "Lina"], "answer": 1 } ],
  "questions": [
    { "q": "How does Adam feel?", "a": "He feels nervous but happy." },
    { "q": "How did you feel on your first day at a new place?", "a": "Example: I felt shy, but people were kind.", "personal": true }
  ]
}
```
   - `answer` is the position of the correct option, counting from 0.
   - `words` are the key words, highlighted in the text. Every word is tappable anyway.
2. Put its id in a slot in `data/sections.json`: `{ "number": 8, "id": "first-day" }`. A slot without an `id` shows as "Coming soon".
3. New character? Add them to `data/characters.json`:
   - `color`: one of blue, orange, green, pink, navy, purple or grey.
   - `gender`: male or female.
   - `slot`: a number that isn't used yet, so they get their own voice.
4. Run `node tools/check_dictionary.js`, then add any missing words to `data/dictionary.json` by base form:
   `"word": { "def": "max 12 easy words", "ex": "An example sentence.", "emoji": "🏢" }`.
   - Plurals, -ed, -ing, -ies and possessives are found automatically.
   - Add irregular forms (e.g. `"wore": "wear"`) to `_forms`.
   - Contractions (I'm, don't) are entries of their own.

## Voices
- **One place for audio.** Everything goes through `Voice.playItem` in `js/core.js`.
- **Recorded voices later.** Add `"audio": "audio/first-day/01.mp3"` to a line, and that file plays instead of the browser voice. The speed switch still works.
- **A voice per character.** Characters get different device voices by gender and `slot`. When a phone has few voices, the pitch changes instead.

## Browser support
- **Speech recognition** ("We heard" and voice answers) works in Chrome on Android and desktop, Edge, and Safari.
- **Without it** (for example Firefox and some iPhone browsers), Spiko shows an Arabic note and you continue by tapping. Answers are still recorded.
- **The microphone** needs HTTPS or localhost; GitHub Pages is HTTPS.

## Run locally
```bash
python3 -m http.server 8000
```
Open http://localhost:8000. Opening `index.html` directly from the file system won't load the data files.

## Deploy
GitHub → Settings → Pages → Deploy from a branch → `main` / root.
