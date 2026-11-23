# Spiko — Speak English. Live it.

A mobile-first English learning page for Arabic speakers. Plain HTML, CSS and JavaScript with no frameworks and no build step, ready for GitHub Pages.

## Flow
1. **Splash** – the logo zooms in, blinks, then fades out.
2. **Intro** (Arabic) – 5 full-screen slides in the style of Instagram stories, with progress bars. Each slide moves on after about 5 seconds, or when its Arabic voice-over ends. Tap the right side for the next slide, the left side to go back, and press and hold to pause. Use "تخطي" to skip.
3. **Guide** (Arabic) → "يلا نبدأ".
4. **Home** – a "Continue" card and big section covers. "Build Your Future" is open; Home, Hospital, Travel and School are greyed out with "قريبًا".
5. **Section** – topic cards (Graduation, Job Search, Interviews, Work), each with an emoji cover, its number of stories and how many are completed.
6. **Topic** – its stories, with ✓ on completed ones. Story slots without content show "Coming soon".
7. **Story** – scenes shown as chat bubbles, with a different voice for each character.
   - Speed switch: Slow, Normal or Fast.
   - Listen first: the text stays blurred until you tap **Read**.
   - Tap any word for its meaning, or tap a face to hear that line again.
8. **Questions**
   - Part 1, multiple choice: tap the answer, or say it.
   - Part 2, open questions: answer by voice. Spiko shows what it heard ("We heard"), gives feedback, and lets you play your answer back and show the model answer.
9. **Story complete!** – your score, saved words, topic progress and the next story.
10. **My words** – filter by story, Play all, meanings.

Screens 1–3 show only on the first visit. Progress, saved words and the speed setting are kept in `localStorage`.

## Files
```
index.html                  page shell + logo SVG
css/style.css               styles (brand colors, Baloo 2)
js/core.js                  voices, speech recognition, recorder, storage, dictionary lookup
js/intro.js                 splash, intro slides, guide
js/app.js                   home, topics, story view, questions, end screen, My words
data/sections.json          sections → topics → story slots
data/stories/<id>.json      one file per story
data/dictionary.json        simple meanings for every word + irregular forms
data/onboarding.json        intro slides + Arabic guide text
img/logo.svg                favicon / logo
```

## Add a story (no code changes)
1. Create `data/stories/<id>.json`:
```json
{
  "id": "first-interview",
  "number": 2,
  "title": "First Interview",
  "cover": "💼",
  "characters": {
    "narrator": { "name": "Narrator", "voice": "narrator" },
    "omar":     { "name": "Omar", "voice": "male", "avatar": "👨‍🎓", "main": true },
    "manager":  { "name": "Ms. Lina", "voice": "female", "avatar": "👩‍💼" }
  },
  "scenes": [
    {
      "title": "The waiting room", "place": "🏢",
      "lines": [
        { "who": "narrator", "text": "Omar sits in the waiting room." },
        { "who": "manager",  "text": "Good morning! Please come in." }
      ]
    }
  ],
  "words": ["interview", "manager"],
  "choice": [
    { "q": "Where does Omar sit?", "options": ["In a car", "In the waiting room", "At home"], "answer": 1 }
  ],
  "questions": [
    { "q": "How does Omar feel?", "a": "He feels nervous." },
    { "q": "Tell me about a job you want.", "a": "Example: I want to work in a bank.", "personal": true }
  ]
}
```
   - `voice` can be one of `narrator`, `male`, `male2`, `male3`, `female`, `female2` or `child`. Each one gets a different device voice when the phone has one; otherwise the pitch changes.
   - `main: true` puts that character's bubbles on the right.
   - `words` are the key words, highlighted in the text.
   - `answer` is the position of the correct option, counting from 0.
   - `personal: true` marks a question about the learner's own life, so any full answer is fine.
2. In `data/sections.json`, give the story's slot the file name as its `id`: `{ "number": 2, "id": "first-interview" }`. A slot without an `id` shows as "Coming soon".
3. Add any new words to `data/dictionary.json`. Use the base form (`interview`, not `interviews`). Plurals, -ed, -ing and the irregular forms listed in `_forms` are found automatically. A word that's missing is looked up online.

## Add a topic or section
Topics live inside a section in `data/sections.json`:
```json
{ "id": "interviews", "title": "Interviews", "titleAr": "المقابلات", "cover": "🤝",
  "stories": [{ "number": 3 }, { "number": 4, "id": "first-interview" }] }
```
To open a locked section, set `"open": true` and give it `topics`. A section's `color` can be `blue`, `navy`, `orange` or `light`.

## Recorded voices (later)
All audio goes through `Voice.playItem` in `js/core.js`. Add `"audio": "audio/first-interview/01.mp3"` to any line, and that file is played instead of the browser voice. The speed switch still works on audio files.

## Edit the intro slides
Each slide in `data/onboarding.json` has these fields:
- `emoji`: the big picture at the top.
- `logo`: how the logo moves, one of `blink`, `bounce` or `wave`.
- `theme`: the background, one of `navy`, `light`, `blue`, `orange` or `white`.
- `text`: what's shown and read aloud.
- `voice` (optional): different text to read aloud instead of `text`.
- `lang`: `"en"` for an English line.
- `button` (optional): shows a button that opens the guide.

## Browser support
- **Voices** use `speechSynthesis`, which every modern browser has.
- **"We heard"** uses speech recognition, which works in Chrome (Android and desktop), Edge and Safari. In other browsers, answers are recorded only, and multiple choice is by tap.
- **The microphone** needs HTTPS or localhost; GitHub Pages is HTTPS.

## Run locally
`fetch()` doesn't work from `file://`, so serve the folder:
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000. The microphone needs HTTPS or localhost; GitHub Pages is HTTPS.

## Deploy
On GitHub, go to Settings → Pages → Deploy from branch → `main` / root.
