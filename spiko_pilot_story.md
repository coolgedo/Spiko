# Spiko pilot: one story, full learning loop

Replace Story 1 with the story below. Hide stories 2–7 for now ("Coming soon"). Build the full loop for this one story so we can test it.

## Also fix
- The intro shows only the first visit, so testers never see it. Show the splash + intro every time the page opens, with a "تخطي" link, and add "شاهد المقدمة" in the menu.

## The learning loop (one screen per step, progress bar on top)
1. **Listen**: one natural English voice reads the story (rate 0.8, speed switch Slow/Normal/Fast). Text hidden: "Listen first".
2. **Read**: text appears, the sentence being read is highlighted. Every word is tappable (definition + speaker + example + "More" link to Oxford Learner's). Key phrases are underlined in blue.
3. **Key phrases**: cards for the 8 phrases below, each with meaning, example, speaker button and "Save".
4. **Shadowing**: one sentence at a time: play it, then the user says it right after (speech recognition shows "We heard: …" and highlights missing words). Buttons: Again / Next.
5. **Quiz**: multiple choice by voice or tap, ✓/✗ with the right answer spoken.
6. **Answer**: open questions by voice, "We heard: …", key-word feedback, "Show answer" + "Repeat after me".
7. **Your turn**: the user tells their own story using the key phrases. Show the phrases as a checklist that ticks itself when speech recognition hears each one. End with "You used X of 8 new phrases".
8. **Notice**: one small grammar note (below).
9. **Done**: score, phrases used, saved words. Saved phrases come back as a quick review card the next day, after 3 days and after 7 days (store dates in localStorage).

## Story: My Graduation Day

Today is my graduation day. I wake up at six. I am happy, but I am nervous too. I put on my new suit and look in the mirror. I smile.

My mother makes breakfast, but I can't eat. My sister laughs at me. My father wears his old wedding suit. It is a little small now!

We take a taxi to the university. The traffic is terrible. I check the time again and again.

At the ceremony, I wait for my name. My hands are cold. Then I hear it: "Adam Fares!" I walk to the stage and take my certificate. My family claps and cheers. I feel proud.

In the evening, we celebrate at a restaurant. My uncle asks me, "Where are you working now?" I don't have an answer.

At night, I can't sleep. I open my laptop and search for jobs. Every job wants good English. So I make a decision: I will practice English every day.

## Key phrases (meaning — example)
1. wake up — stop sleeping — I wake up at seven every day.
2. put on — start wearing clothes — I put on my jacket.
3. look in the mirror — see yourself in a mirror — She looks in the mirror before work.
4. take a taxi — go somewhere by taxi — We take a taxi to the airport.
5. again and again — many times — He calls me again and again.
6. feel proud — feel very happy about something good — I feel proud of my son.
7. search for jobs — look for work — She searches for jobs online.
8. make a decision — decide something — I made a big decision today.

## Quiz (correct answer marked *)
1. How does Adam feel in the morning? — angry / *happy and nervous / tired and sad
2. Why can't he eat breakfast? — the food is cold / *he is nervous / he is late
3. How do they go to the university? — by bus / by car / *by taxi
4. What does the uncle ask? — "Where is your certificate?" / *"Where are you working now?" / "Are you hungry?"
5. "Make a decision" means… — *decide something / make a cake / make a mistake

## Open questions (model answers)
1. What does Adam do after he wakes up? — He puts on his new suit and looks in the mirror.
2. What is funny about his father? — He wears his old wedding suit, and it is a little small.
3. How does Adam feel on the stage? — He feels proud.
4. Why can't Adam sleep at night? — Because he doesn't have a job, and every job wants good English.
5. What decision does Adam make? — He decides to practice English every day.

## Your turn (prompt shown to the user)
"Tell me about an important day in your life. Use these phrases: wake up, put on, feel proud, make a decision."
Example answer: "My wedding day was very important. I woke up early. I put on my new suit and looked in the mirror. I felt nervous, but I also felt proud. That day, I made a decision: to be a good husband."

## Notice (grammar note)
I wake up → he wakes up. I feel → she feels. With he / she / it, add -s.
