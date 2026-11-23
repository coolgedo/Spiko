Here are parts 2 to 8 and all the content again. Part 1 (intro) is already done, keep it.
Work in this order and commit after each step: (A) add all 7 stories below as data/stories/*.json and the 4 topics in data/sections.json, (B) navigation, (C) scene/chat story view, (D) full dictionary, (E) voice questions, (F) end screen and My words. Do not stop until all steps are done.

## 2. Navigation (new)
- Home screen: section covers as big cards. "Build Your Future" is open. "Home", "Hospital", "Travel", "School" are greyed out with "قريبًا".
- Tap "Build Your Future" → topics screen with 4 topic cards:
  1. Graduation • التخرج → Story 1
  2. Job Search • البحث عن وظيفة → Story 2
  3. Interviews • المقابلات → Stories 3, 4, 5, 6
  4. Work • الشغل → Story 7
- Each topic card shows an emoji cover, the number of stories, and how many are completed. Tap a topic → list of its stories with a ✓ on completed ones (save progress in localStorage). Add a back button on every screen.

## 3. Story screen (scene style, no narrator)
- Stories are dialogues split into scenes. Each scene has a title, an emoji, and an optional sound note in brackets (like "(car horns)"). Show the scene title as a card with the emoji, then the lines as chat bubbles with the speaker's name and a small avatar circle with the first letter. Adam = blue, Lina = orange, Sami = green, Mom = pink, Dad = navy, Nadia = purple, others = grey.
- Audio: use speechSynthesis with a DIFFERENT voice per character (pick male English voices for Adam, Sami, Dad, Uncle, Driver and female voices for Lina, Mom, Nadia, Woman, Receptionist; if few voices exist, vary the pitch). Default rate 0.8. Add a speed switch: Slow (0.65) / Normal (0.8) / Fast (1.0). Highlight the bubble that is being spoken. Play, pause, replay a line by tapping its bubble. Keep all audio in one module so it can switch to recorded mp3 files later.
- First "Listen" (bubbles hidden as "Listen first"), then "Read" shows the text.

## 4. Dictionary: every word must work
- Every word in every bubble and question is tappable.
- Create data/dictionary.json with a simple English definition (A1–A2 words, max 12 words) for EVERY distinct word in all 7 stories, all questions and all options, stored by base form, plus one example sentence. Add an emoji for concrete words (suit 🤵, taxi 🚕, phone 📱, certificate 📜, coffee ☕ …).
- When a word is tapped: convert it to its base form (handle -s, -es, -ed, -ing, -ies, irregular verbs like was/went/got/found/wore/made/took/came/said, and contractions like I'm, don't, can't, it's, you're, we'll). Look it up in data/dictionary.json. Only if it is not there, try https://api.dictionaryapi.dev/api/v2/entries/en/{word}.
- Popup: the word, emoji (if any), a speaker button, the definition, the example, a "More" link to https://www.oxfordlearnersdictionaries.com/definition/english/{word}, and "Save" to My words.

## 5. Questions part A: multiple choice by voice (warm-up)
- After the story, show the multiple-choice questions one at a time. Read the question and the three options aloud.
- The user answers by voice: use the Web Speech API (SpeechRecognition / webkitSpeechRecognition, lang en-US). Match what they said to the closest option (word overlap). The user can also tap an option if the microphone is not available.
- Show ✓ (green) or ✗ (red), say "Correct!" or "The answer is …" aloud, then "Next". Show the score at the end of part A.

## 6. Questions part B: open questions by voice
- One question at a time, read aloud.
- "Speak my answer": use SpeechRecognition and show "We heard: …" with the text. Also record the voice with MediaRecorder so the user can tap "Play my voice".
- Compare with the model answer using key-word overlap and show friendly feedback from Spiko: more than 60% → "Excellent! 🌟", 30–60% → "Good try! Listen to the model answer and repeat it.", less → "Let's listen to the model answer together."
- "Show answer" shows the model answer and reads it aloud; then "Repeat after me": the user says it again and sees "We heard: …" again.
- The last question in each story is personal: there is no right answer, so always reply "Thank you for sharing! 👏" and show the example answer as an idea.

## 7. End of story
- "Story complete!" with: multiple-choice score, number of saved words, a ✓ saved in progress, and buttons "Next story" and "Back to topics".

## 8. Small extras
- A "My words" page (from the menu) with all saved words and their definitions.
- If speech recognition is not supported (some iPhone browsers), show a short Arabic note: "المتصفح ده مش بيدعم التعرف على الصوت، جرّب Chrome. تقدر تكمل بالدوس على الإجابات."

## CONTENT

Characters: Adam Fares (hero, commerce graduate), Lina (his sister, 19), Mom, Dad, Uncle, Sami (Adam's friend, works in a call center), Nadia (hiring manager at BlueLine Communications), plus Speaker, Woman, Driver, Receptionist, Candidate, Everyone.

### Story 1 — Graduation Day (topic: Graduation)
Scene 1 🏠 Home, 6:00 a.m. (alarm ringing)
Mom: Adam! Wake up! Today is the big day!
Adam: I'm up, I'm up!
Scene 2 🍳 The kitchen
Mom: Eat something. You can't graduate on an empty stomach!
Adam: Mom, I'm too nervous to eat.
Lina: Nervous? Four years of exams, and now you're nervous?
Dad: Good morning, everyone! How do I look?
Lina: Dad… is that your wedding suit?
Dad: Yes. It still fits. Almost.
Mom: It's perfect, dear. Now let's go. We can't be late.
Scene 3 🚕 In a taxi (car horns, heavy traffic)
Adam: It's eight thirty! We're going to be late!
Dad: We're not going to be late.
Lina: Dad is never late… except for every family event.
Dad: Very funny, Lina.
Scene 4 🎓 The university
Sami: Adam! Over here!
Adam: Sami! You came!
Sami: Of course! Congratulations, man. You're a graduate now. Welcome to real life!
Adam: Real life? That sounds scary.
Sami: Don't worry. It's scary for everyone at the beginning.
Scene 5 👏 The ceremony (applause)
Speaker: And now… Adam Fares!
Lina: Go, Adam! Woohoo!
Dad: That's my son!
Mom: I'm so proud of you!
Scene 6 🍽️ The restaurant, evening
Uncle: Congratulations, Adam! So, tell me, where are you working now?
Adam: Um… I'm still looking.
Uncle: Still looking? My neighbor's son found a job before he graduated. In a bank! With a car!
Mom: Adam will find something great. Right, Adam?
Adam: Yes… of course.
Scene 7 🌙 Adam's room, night (keyboard typing)
Adam: A certificate on the wall… but no job.
Adam: "Jobs for fresh graduates"… Thousands of jobs, and they all say the same thing: "Excellent English required."
Adam: OK. Excellent English. Let's start.

Multiple choice (correct answer marked *):
1. Why is Adam nervous? — a football match / *his graduation / a job interview
2. Where is the ceremony? — *at the university / at a stadium / at a wedding hall
3. What is Dad wearing? — new jeans / *his wedding suit / a sports shirt
4. A "graduate" is a person who… — won a prize / *finished studying / got a job
5. What does the uncle ask? — "When is your wedding?" / *"Where are you working now?" / "Do you like football?"
6. "Scary" means something that makes you… — happy / hungry / *afraid

Open questions — model answers:
1. Why can't Adam eat breakfast? — Because he is too nervous.
2. What is funny about Dad's suit? — It is his wedding suit, and it is a little small now.
3. What does Sami say to Adam at the university? — He says, "Congratulations! You're a graduate now. Welcome to real life!"
4. What does the uncle ask, and how does Adam feel? — He asks, "Where are you working now?" Adam feels bad because he doesn't have a job.
5. What do all the job ads say? — They say, "Excellent English required."
6. (personal) Has someone ever asked you a question that made you feel uncomfortable? What happened? — Example: Yes. My aunt asked me about my exam results, and I felt uncomfortable.

### Story 2 — Looking for a Job (topic: Job Search)
Scene 1 💻 Adam's room, morning (keyboard typing)
Adam: Accountant… two years of experience. Sales… three years of experience. Seriously? How can I get experience if nobody gives me a job?
Lina: Can I come in? You've been in front of that laptop for five hours.
Adam: I'm looking for a job, Lina. And all these ads want experience and excellent English.
Lina: Let me see… "Customer Service Agents. Full-time. Good salary. Training provided. Fresh graduates are welcome." Fresh graduates! That's you!
Adam: A call center? Hmm… Sami works in a call center.
Lina: So call him!
Scene 2 📞 Phone call (phone ringing)
Sami: Hello? Adam! What's up, graduate?
Adam: Sami, I found a job ad for a call center. Is the job difficult?
Sami: Not really. You talk to customers on the phone and help them solve problems. But the most important thing is your English. You need to listen well and speak clearly.
Adam: My English is… OK. I think.
Sami: Just apply. What can you lose?
Scene 3 📄 Adam's room
Adam: Name: Adam Fares. Degree: Bachelor of Commerce. Skills: computers, teamwork… Experience… nothing.
Lina: Write about your university project! And the summer you helped Uncle in his shop.
Adam: You're right. OK… upload my CV… and… Apply. Done!
Scene 4 📱 Three days later (phone ringing)
Woman: Hello, is this Adam Fares?
Adam: Yes, speaking.
Woman: I'm calling from the HR department at BlueLine Communications. We'd like to invite you for an interview next Sunday at ten a.m.
Adam: Really? Yes! Of course! Thank you!
Woman: You're welcome. See you on Sunday.
Lina: Well? Well?
Adam: I have an interview!
Lina: Yes! Wait… are you ready?
Adam: …I have no idea.

Multiple choice:
1. What do most job ads want? — *experience and excellent English / a car / a big family
2. What job does Lina find? — teacher / *customer service agent / doctor
3. Who works in a call center? — Lina / Dad / *Sami
4. "Apply" means… — buy something / *ask for a job in an official way / clean your room
5. When is the interview? — Friday / *next Sunday / tomorrow

Open questions — model answers:
1. What do most of the job ads want? — They want experience and excellent English.
2. How does Lina help Adam? — She finds a job ad for fresh graduates and helps him with his CV.
3. What does Sami say is the most important thing in a call center? — English. You need to listen well and speak clearly.
4. What does Adam write in the experience part of his CV? — His university project and the summer he helped his uncle in his shop.
5. Who calls Adam three days later, and why? — A woman from the HR department. She invites him for an interview.
6. (personal) What kind of job do you want? Why? — Example: I want to work in a bank because I like numbers.

### Story 3 — The First Interview (topic: Interviews)
Scene 1 ⏰ Adam's room, 8:45 a.m.
Mom: Adam! It's quarter to nine! Isn't your interview at ten?
Adam: What?! My phone died! My alarm didn't ring!
Scene 2 🚪 The front door
Mom: You're wearing jeans? To an interview?
Adam: No time, Mom! Bye!
Scene 3 🚕 In a taxi (car horns)
Adam: Please, can you go faster?
Driver: Faster? Look at this traffic, my friend. Nobody is going anywhere.
Scene 4 🏢 Reception, 10:10 a.m.
Receptionist: Good morning. Can I help you?
Adam: Hi… sorry… I'm Adam Fares. I have an interview at ten. I'm late, I'm so sorry.
Receptionist: Please take a seat. Ms. Nadia will call you.
Candidate: First interview?
Adam: Is it that obvious?
Candidate: You're breathing very fast. And… you're wearing jeans.
Scene 5 💼 Nadia's office
Nadia: Adam? Come in, please. I'm Nadia, the hiring manager. Have a seat.
Adam: Thank you.
Nadia: So, Adam, tell me about yourself.
Adam: Um… my name is Adam. I am, like, twenty-three years old. I… um… graduated from university.
Nadia: OK. Why do you want to work with us?
Adam: Because… um… I need a job. And the salary is good.
Nadia: I see. Last question. How do you handle stress?
Adam: Stress? Um… I like working in a team. Teamwork is very important.
Nadia: …Thank you, Adam. We will contact you.
Scene 6 😓 Outside the building
Adam: That was terrible. "I like working in a team"? She asked about stress!
Adam: Maybe it wasn't that bad. Maybe they will call me.

Multiple choice:
1. Why is Adam late? — *his alarm didn't ring / he lost his CV / he went to the wrong company
2. What is Adam wearing? — a suit / *jeans / a uniform
3. Who is Nadia? — the receptionist / *the hiring manager / Adam's teacher
4. "Obvious" means… — *easy to see / very expensive / very far
5. What does Adam talk about when Nadia asks about stress? — his family / *teamwork / football

Open questions — model answers:
1. Why is Adam late? — Because his phone died and his alarm didn't ring.
2. What does Mom notice about Adam's clothes? — He is wearing jeans to an interview.
3. How does the other candidate know it's Adam's first interview? — Adam is breathing very fast, and he is wearing jeans.
4. What is Adam's answer to "Why do you want to work with us?" — He says, "Because I need a job, and the salary is good."
5. What mistake does Adam make with the stress question? — He talks about teamwork, not about stress.
6. (personal) If Nadia asked you "Tell me about yourself," what would you say? — Example: I'm Mona. I'm a business graduate, and I love working with people.

### Story 4 — Rejected (topic: Interviews)
Scene 1 🛋️ The living room, one week later
Lina: You checked your phone forty times today.
Adam: They said they will contact me.
Lina: Maybe they're busy.
Adam: (email notification) An email! From BlueLine!
Adam: "Dear Adam, thank you for your interest in the Customer Service Agent position. Unfortunately, we have decided to move forward with other candidates. We wish you the best of luck."
Lina: Oh, Adam… I'm sorry.
Adam: I don't want to talk about it.
Scene 2 🌙 Adam's room, night (knock on the door)
Mom: Adam? You didn't eat dinner. Can I come in?
Adam: They rejected me, Mom. Everyone will know I failed. My uncle, the neighbors… everyone.
Mom: Listen to me. When one door closes, another door opens. This is not the end. It's only the beginning.
Scene 3 📞 Phone call (phone ringing)
Sami: Hey! How was the interview?
Adam: A disaster. I was late, I wore jeans, I said "um" a hundred times, and I answered the wrong question.
Sami: The wrong question?
Adam: She asked about stress. I talked about teamwork.
Sami: OK… that's bad. But listen, my first two interviews were a disaster too. Rejection is normal. The problem isn't you. The problem is you weren't prepared.
Adam: Prepared? How?
Sami: Meet me tomorrow at the café at six. I'll show you.
Adam: …OK. Thanks, Sami.

Multiple choice:
1. How does Adam get the news? — a phone call / *an email / a letter
2. "Unfortunately" comes before… — good news / *bad news / a question
3. What does Mom say? — *"When one door closes, another door opens." / "Go to sleep." / "Call your uncle."
4. What does Sami say about his first interviews? — they were easy / *they were a disaster too / he never had interviews
5. Where will Adam meet Sami? — at the university / *at the café / at BlueLine

Open questions — model answers:
1. What does the email from BlueLine say? — It says they decided to move forward with other candidates.
2. Why is Adam worried about his uncle and the neighbors? — Because he thinks everyone will know he failed.
3. What does Mom tell Adam? — She says, "When one door closes, another door opens. This is not the end."
4. What four mistakes did Adam make in the interview? — He was late, he wore jeans, he said "um" a lot, and he answered the wrong question.
5. What does Sami say is Adam's real problem? — He wasn't prepared.
6. (personal) Tell me about a time something didn't go well for you. What did you learn? — Example: I failed my driving test the first time. I learned to practice more.

### Story 5 — Getting Better (topic: Interviews)
Scene 1 ☕ The café, 6:00 p.m. (coffee machine)
Sami: An interview is like a football match. You can't win without training. Ready?
Adam: Ready.
Sami: Step one: research. Learn about the company. Read their website. What do they do? What are their goals?
Adam: Research. Got it.
Sami: Step two: practice. Some questions come in almost every interview. "Tell me about yourself." "Why do you want this job?" "How do you handle stress?" Prepare your answers. Then record yourself and listen.
Adam: Record myself? That's weird.
Sami: Weird, but it works. You'll hear every "um" and every "like."
Sami: Step three: listen. Listen to the whole question. Then pause, think, and answer. It's OK to say, "That's a good question. Let me think."
Sami: Step four: be professional. Wear a suit. Arrive early. Smile and make eye contact.
Adam: Research, practice, listen, be professional. I can do this.
Scene 2 🎙️ Adam's room, one week later (phone recording)
Adam: Tell me about yourself… Hi, I'm Adam. Um… no. Again.
Lina: Who are you talking to?
Adam: Myself. It's Sami's idea.
Lina: Can I be the interviewer?
Adam: Please!
Lina: Mr. Fares, how do you handle stress?
Adam: That's a good question. When I feel stressed, I stay calm and focus on one problem at a time.
Lina: Wow! Who are you, and what did you do with my brother?
Scene 3 🎧 The kitchen, three weeks later
Mom: You're up early again?
Adam: English podcast. Every morning, I listen and repeat. And I finished an online course in customer service. Look, a certificate!
Mom: I'm proud of you, son.
Adam: Mom, look! BlueLine has a new job ad. Same company. Same job.
Mom: So what are you waiting for?

Multiple choice:
1. Sami says an interview is like… — a movie / *a football match / a wedding
2. Step one is… — *research / sleep / buy a suit
3. Why should Adam record himself? — to send it to Nadia / *to hear his mistakes / to make a video for fun
4. Who plays the interviewer? — Sami / *Lina / Dad
5. What does Adam do every morning? — *listens to an English podcast and repeats / plays football / watches TV

Open questions — model answers:
1. Why does Sami compare an interview to a football match? — Because you can't win without training.
2. What are Sami's four steps? — Research, practice, listen, and be professional.
3. Why does Sami tell Adam to record himself? — To hear every "um" and every "like" and fix them.
4. How does Lina help Adam practice? — She plays the interviewer and asks him questions.
5. What does Adam do every morning? — He listens to an English podcast and repeats.
6. (personal) Answer "Tell me about yourself" in English. How do you feel when you hear yourself? — Example: I feel a little shy, but I'm happy because I'm speaking English.

### Story 6 — The Second Interview (topic: Interviews)
Scene 1 👔 Adam's room, the night before
Adam: Suit: ironed. CV: printed. Traffic: checked. Alarm: two alarms.
Lina: You look like a soldier before a battle.
Adam: That's exactly how I feel.
Scene 2 🏢 Reception, 9:45 a.m.
Receptionist: Good morning. You're early!
Adam: Good morning. I'm Adam Fares. I have an interview at ten with Ms. Nadia.
Scene 3 💼 Nadia's office
Nadia: Adam? I remember you.
Adam: Good morning, Ms. Nadia. Thank you for giving me a second chance.
Nadia: So, tell me about yourself.
Adam: I'm a commerce graduate from Cairo University. I enjoy helping people and solving problems. Recently, I finished a course in customer service, and I practice my English every day. I believe this job is a great opportunity for me to grow.
Nadia: Why do you want to work with us?
Adam: BlueLine helps thousands of customers every day, and you're known for great service. I want to be part of a team that makes customers happy.
Nadia: How do you handle stress?
Adam: That's a good question. When I feel stressed, I take a deep breath and focus on one problem at a time. For example, during my final exams, I made a study plan, and it helped me a lot.
Nadia: Adam, you're a different person from last time. What happened?
Adam: I learned from my mistakes.
Scene 4 ✉️ Home, evening (keyboard typing)
Adam: "Dear Ms. Nadia, thank you for your time today. I really enjoyed our conversation, and I am very interested in this position. Best regards, Adam Fares." Send.
Lina: A thank-you email? Fancy!
Adam: Sami says it makes a good impression.
Lina: So now what?
Adam: Now… we wait.

Multiple choice:
1. When does Adam arrive this time? — *early / late / he doesn't go
2. What does Lina say he looks like? — a teacher / *a soldier before a battle / a football player
3. How does Adam handle stress? — *he takes a deep breath and focuses on one problem / he goes to sleep / he calls Sami
4. "Opportunity" means… — a problem / *a good chance / a long trip
5. What does Adam send in the evening? — a gift / *a thank-you email / his CV again

Open questions — model answers:
1. What does Adam prepare the night before the interview? — He irons his suit, prints his CV, checks the traffic, and sets two alarms.
2. Why does Lina say he looks like a soldier? — Because he is very serious and ready, like a soldier before a battle.
3. How is Adam's answer about stress different this time? — He listens to the question, stays calm, and gives an example.
4. Why does Nadia say Adam is "a different person"? — Because he is prepared, calm, and confident this time.
5. Why does Adam send a thank-you email? — Because it makes a good impression.
6. (personal) Why do you want your dream job? Answer like you are in an interview. — Example: I want to be a nurse because I enjoy helping people, and I believe it is a great opportunity to grow.

### Story 7 — Accepted (topic: Work)
Scene 1 🛒 The supermarket (phone ringing)
Mom: Adam, your phone!
Adam: It's BlueLine! Hello?
Nadia: Hello, Adam. This is Nadia. I have good news. We would like to offer you the position of Customer Service Agent. Congratulations!
Adam: Really? Thank you! Thank you so much! I accept!
Nadia: Wonderful. We'll send you the job offer by email. Your training starts on the first of next month. Welcome to the team!
Adam: Mom… I got the job!
Mom: (a bag of oranges falls) You got the job? My son got the job!
Scene 2 🎉 Home, evening (family celebrating)
Dad: A few weeks ago, I asked you, "What's next?" Now I know the answer. I'm proud of you, son.
Lina: And I'm proud of me. I was the interviewer!
Uncle: A call center? Good, good. You know, my neighbor's son…
Everyone: Uncle!
Uncle: OK, OK! Congratulations, Adam!
Scene 3 📞 Phone call
Adam: Sami, I did it! Thank you. I couldn't do it without you.
Sami: No, you did it. I only showed you the way. You did the hard work.
Scene 4 🌙 Adam's room, night
Adam: The graduation… the rejection… the weeks of practice… and today. Failure isn't the end. It's a lesson.
Adam: But next month, I'll talk to real customers… in English. Am I ready for that?

Multiple choice:
1. Where is Adam when Nadia calls? — at home / *at the supermarket / at the café
2. What does Nadia offer Adam? — *the position of Customer Service Agent / a car / a free course
3. When does the training start? — tomorrow / *on the first of next month / next year
4. "Accept" means… — *say yes / say no / say sorry
5. What does Adam learn? — *failure isn't the end, it's a lesson / jobs are easy / English is not important

Open questions — model answers:
1. Where is Adam when Nadia calls? — He is at the supermarket with his mother.
2. What does Nadia offer Adam? — The position of Customer Service Agent.
3. What does Dad say about his question "What's next?" — He says, "Now I know the answer. I'm proud of you, son."
4. Why does everyone shout "Uncle!"? — Because he starts talking about his neighbor's son again.
5. What important thing did Adam learn? — Failure isn't the end. It's a lesson.
6. (personal) What is a lesson you learned from a mistake? — Example: I was late for an important meeting, and I learned to always leave early.

When everything works on a phone, commit and push to main and update the README.
