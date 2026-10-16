/* club.Drama — choose-your-response social puzzles with escalating stakes.
   Params (all optional): { scenario: "rival" | "promoter" | "friend" | "backstage" | "ego", rival: "DJ Brandon Shine", difficulty 1..5, arcade }
   Three beats of choices (stakes go up each time) and a payoff. Two meters: REPUTATION and VIBE.
   Result: { ok, score 0..100, outcome: "legend" | "win" | "draw" | "lose", ending: id, scenario, rep, vibe }
   ok = outcome is not "lose". Never mutates RP.state. All characters here are FICTIONAL. */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { el, clamp, R, P, ell, line, poly, mulberry, hashStr, ramp, txt, txtC, txtW, bayer } = U;
const K = ramp;

const CSS = `
.cd-wrap { width: fit-content; max-width: 100%; margin: 0 auto; }
.cd-hud { display: flex; justify-content: space-between; align-items: stretch; gap: 8px; margin-bottom: 6px; }
.cd-hud .sk-meter { flex: 1 1 0; min-width: 0; }
.cd-round { align-self: center; font-family: var(--logo); font-size: 10px; letter-spacing: .06em; color: var(--amber); background: #0c0919; padding: 6px 10px; border: 1px solid #2d2456; text-align: center; white-space: nowrap; }
@media (max-width: 559px) { .cd-round { display: none; } }
.cd-play { display: flex; flex-direction: column; gap: 10px; }
@media (max-height: 460px) and (min-width: 560px) {
  .cd-play { display: grid; grid-template-columns: 330px minmax(0, 1fr); grid-template-areas: "cw say" "cw choices"; gap: 5px 10px; align-items: start; }
  .cd-play > .cd-wrap { grid-area: cw; } .cd-play > .sk-say { grid-area: say; } .cd-play > .cd-choices { grid-area: choices; } .cd-round { display: none; }
  .cd-hud { margin-bottom: 4px; }
}
.cd-vs { font-size: 17px; color: var(--muted); letter-spacing: .08em; }
.cd-end { font-size: 22px; line-height: 1.1; }
.cd-flow .sk-say { min-height: 68px; padding-top: 6px; padding-bottom: 8px; } .cd-flow .sk-choice { padding-top: 4px; padding-bottom: 4px; min-height: 34px; font-size: 21px; } .cd-flow .sk-choices { gap: 4px; }
`;
let cssDone = false;

/* ------------------------------------------------------------------------------------------ scenario data */
/* node: { npc, mood, say: [[who, text|[alts]]...], ch: [[text, {r, v, t, f}, next|fn, reply, mood], ...] }
   who: "nar" narrator | "npc" the other person | "me" you.  reply starting with "~" is narration.
   Tokens: {me} your DJ name, {npc} their name.  next === "END" goes to the payoff. */
const SC = {};

SC.rival = {
  title: "The Rival", scene: "booth", npc: "brandon", start: "r1", bias: 4,
  intro: "{npc} is a resident here. He has hair like a toaster ad and a rotating list of grievances. It is 11:40 PM. Your set is at midnight.",
  nodes: {
    r1: { mood: "happy", say: [["nar", "Halcyon Room, 11:40 PM. The booth. Twenty minutes to your set."], ["npc", ["Oh hey, {me}. Just warming up your gear. For you. As a friend.", "Hey, {me}! I was just making sure your gear works. It does. Barely. Like you."]], ["npc", "Nice crate, by the way. Is it a rental?"]],
      ch: [
        ["Hands off the gear, {npc}.", { r: 6, v: -2, t: "firm" }, "r2a", "Whoa. Relax. I'm literally being helpful.", "angry"],
        ["Thanks. Somebody had to warm up the room.", { r: 8, v: 4, t: "wit" }, "r2b", "...Funny. We'll see how funny it is at 12:15.", "surprised"],
        ["[Say nothing. Trace the cables.]", { r: 4, v: 2, t: "careful" }, "r2c", "~Channel 2 is unplugged. The crossfader curve is set to \"chaos.\" {npc} whistles at the ceiling.", "worried"],
        ["{npc}! Buddy! Let's just have a great night.", { r: -3, v: 5, t: "peace" }, "r2d", "That's the spirit. Now step aside, buddy.", "happy"]
      ] },
    r2a: { mood: "angry", say: [["nar", "A few heads turn. {npc} raises his voice, just enough."], ["npc", "Everybody! {me} thinks I'm stealing his gear. His LAPTOP gear. His BORROWED gear."]],
      ch: [
        ["It's my gear. It's not borrowed. It's... financed.", { r: 7, v: 5, t: "wit" }, "r3x", "Ha! Financed! Somebody's been to the bank!", "surprised"],
        ["[Quietly pull his headphone cable out.] Oops.", { r: -3, v: 4, t: "petty" }, "r3y", "~The crowd laughs. {npc} looks like a toaster that's been dropped.", "angry"],
        ["Let the crowd decide. First track wins.", { r: 8, v: 3, t: "bold" }, "r3x", "Oh, you want to play? Fine. FINE.", "happy"],
        ["I'll go get the manager.", { r: 2, v: -3, t: "safe" }, "r3y", "Run along. Tell her I said hi. She hates me. She loves me.", "happy"]
      ] },
    r2b: { mood: "surprised", say: [["nar", "A flicker of doubt crosses his face, then gets deleted."], ["npc", "Cute. Let me guess. You're \"authentic.\" You play records. You have a \"story.\""]],
      ch: [
        ["I do have a story. It has a twist: I'm better than you.", { r: 8, v: 2, t: "bold" }, "r3x", "Ohhh. Okay. It's on.", "angry"],
        ["Records, yes. Want to hold one? It won't bite. It might scratch.", { r: 6, v: 5, t: "wit" }, "r3x", "Did you just... pun at me?", "surprised"],
        ["You're right. I'm not as good as you. Yet.", { r: 4, v: 4, t: "humble" }, "r3y", "Finally. Some respect. Write that down.", "happy"],
        ["[Shrug. Plug in.]", { r: 3, v: 0, t: "calm" }, "r3y", "You're not even going to fight me? Boring.", "worried"]
      ] },
    r2c: { mood: "worried", say: [["nar", "He is suddenly very interested in a poster."], ["npc", "That? That was already like that. Gear's old. Everything's old. Records. You."]],
      ch: [
        ["[Fix it quietly. Say nothing.]", { r: 5, v: 3, t: "calm" }, "r3y", "~He expected a scene. He did not get a scene. He looks for something to be mad at.", "worried"],
        ["[Hold up the cable.] Missing something, {npc}?", { r: 7, v: 4, t: "firm" }, "r3x", "That's... a cable. I don't know what that is.", "surprised"],
        ["Nice try. The crossfader curve was a nice touch.", { r: 6, v: 5, t: "wit" }, "r3x", "Thank you. Wait. No. It wasn't me.", "surprised"],
        ["[Yank out HIS cable.]", { r: -4, v: 2, t: "petty" }, "r3y", "HEY. That's the monitor. That's my monitor.", "angry"]
      ] },
    r2d: { mood: "happy", say: [["nar", "He is already wiping your name off the whiteboard with his sleeve."], ["npc", "Great. Then you won't mind me taking the 12:00 slot. You can have 1:30. It's a prime slot. For people who aren't here."]],
      ch: [
        ["That's not what the whiteboard says.", { r: 5, v: -2, t: "firm" }, "r3y", "The whiteboard's wrong. It's a whiteboard.", "angry"],
        ["Sure. Take 12:00. I'll... follow you.", { r: -8, v: -2, t: "weak" }, "r3y", "See? This is why you're the opener.", "happy"],
        ["Back-to-back. First record, the crowd votes.", { r: 8, v: 4, t: "bold" }, "r3x", "Deal. You'll regret it. In public.", "angry"],
        ["1:30? Peak hour, the crowd's drunk. You won't stand a chance.", { r: 6, v: 6, t: "wit" }, "r3x", "...You can't just flip my insult into a compliment. Stop it.", "surprised"]
      ] },
    r3x: { mood: "angry", say: [["nar", "The floor goes quiet. Somebody dims the lights. Somebody else yells \"FIGHT.\" They mean \"play.\""], ["npc", "Opening track. Loser buys the drinks. And apologizes. Publicly."]],
      ch: [
        ["[Drop something warm that everybody knows.]", { r: 8, v: 8, t: "read" }, "END", "~The whole floor sings the second line. {npc} sings the second line. He stops.", "worried"],
        ["[Go loud. Big drop, no build.]", { r: 2, v: -4, t: "ego" }, "END", "~Three people leave for the bathroom at the same time. Coincidence.", "happy"],
        ["This one's for you, {npc}. [Play something earnest and cheesy.]", { r: 7, v: 6, t: "wit" }, "END", "~The crowd howls. He's dancing. He doesn't know he's dancing.", "surprised"],
        ["[Grab the mic.] Ladies and gentlemen, {npc}, who is already tired!", { r: 3, v: 4, t: "cheek" }, "END", "~Half the room cheers, the other half writes it down for later.", "angry"]
      ] },
    r3y: { mood: "happy", say: [["nar", "Midnight. The manager taps her watch. {npc} leans in."], ["npc", "They're my crowd, {me}. They don't even know your name."]],
      ch: [
        ["Then I'll teach them.", { r: 6, v: 3, t: "bold" }, "END", "~He opens his mouth. Closes it. A very small win.", "worried"],
        ["They know it. They just can't spell it.", { r: 5, v: 6, t: "wit" }, "END", "~He pretends not to laugh. His shoulders betray him.", "surprised"],
        ["Maybe. Want to find out together?", { r: 4, v: 5, t: "kind" }, "END", "~He doesn't have a comeback. He has a drink.", "worried"],
        ["[Say nothing. Walk to the booth. Hands in pockets.]", { r: 5, v: 2, t: "cool" }, "END", "~It's the best insult you've ever delivered. Nobody can quote it.", "angry"]
      ] }
  },
  endings: {
    legend: { title: "Resident Legend", lines: [["nar", "You play. The room folds. {npc} tries a dad dance. It does not land."], ["nar", "By 1 AM people are asking who you are. {npc} is asking where the exit is."]] },
    win: { title: "You Took the Night", lines: [["nar", "Your set is good. His is louder. Yours is better."], ["nar", "He buys the first round. He writes \"apology\" on the napkin and spells it wrong."]] },
    draw: { title: "A Very Tense Tie", lines: [["nar", "You both play. Both sets are fine. The crowd can't decide, so they dance to both."], ["nar", "The bartender splits the tab and the grudge."]] },
    lose: { title: "Toast", lines: [["nar", "{npc} owns the floor. You own a valuable lesson and a parking ticket."], ["nar", "Somebody films it. It is, technically, content."]] }
  }
};

SC.promoter = {
  title: "The Promoter", scene: "bar", npc: "dante", start: "p1",
  intro: "{npc} runs Nowhere and says he pays on time. He has a tab, a smile, and a calendar that only has \"next week\" in it.",
  nodes: {
    p1: { mood: "happy", say: [["nar", "The bar. Last call. {npc} materializes at your elbow with open arms."], ["npc", ["My favorite DJ! Listen. I need a tiny favor. Nowhere's DJ cancelled. You play 2 to 6 AM. Tonight. Pay's... next week.", "{me}! My guy! Tiny favor. Four hours. Nowhere. Tonight. I'll pay you... you know."]], ["me", "(Next week.)"]],
      ch: [
        ["{npc}. You owe me for the last four gigs.", { r: 6, v: -2, t: "firm" }, "p2a", "Owe? We're family. Family doesn't count.", "worried"],
        ["What's the fee? A number. Out loud.", { r: 8, v: 0, t: "savvy" }, "p2b", "A number. Out loud. In public. You're killing me.", "surprised"],
        ["Sure! Anything for Nowhere!", { r: -8, v: 4, t: "weak" }, "p2c", "That's why you're my guy. Loyal. Dumb. Loyal.", "happy"],
        ["Next week? Great. I'll play next week. You pay me next week. We're even.", { r: 7, v: 6, t: "wit" }, "p2b", "...Hm. Wait. Is that a joke? Is that my joke?", "surprised"]
      ] },
    p2a: { mood: "worried", say: [["nar", "He pulls out a wallet. It is mostly receipts and one very old hug."], ["npc", "Come on. Think about what I did for you. I gave you your first gig. Basically a miracle."]],
      ch: [
        ["Family also doesn't pay in coupons.", { r: 6, v: 5, t: "wit" }, "p3x", "That coupon is good at Sal's. Sal knows me.", "angry"],
        ["Then what's the family discount on my rent?", { r: 5, v: 4, t: "wit" }, "p3x", "Landlords don't do family. I looked into it.", "worried"],
        ["Fine. But I'm writing it down.", { r: 3, v: 3, t: "kind" }, "p3y", "Write it down! Put it in a book. Nobody reads books.", "happy"],
        ["[Open a countdown timer on your phone. It says \"NEXT WEEK.\"]", { r: 7, v: 2, t: "meme" }, "p3x", "That's... a very threatening app.", "surprised"]
      ] },
    p2b: { mood: "surprised", say: [["nar", "Dante has the look of a man who just found out the ice machine has a lock."], ["npc", "A number? Okay. Okay. Let me think. A number between zero and... zero. With a drink ticket."]],
      ch: [
        ["Three hundred. Cash. And a drink ticket.", { r: 8, v: 2, t: "firm" }, "p3x", "Three hundred?! You're making me sweat. I've got a clean shirt on.", "worried"],
        ["Two hundred, plus the Saturday residency.", { r: 9, v: 3, t: "bold" }, "p3x", "Saturday? SATURDAY? That's my... that's... fine. We'll talk.", "surprised"],
        ["A hundred and your word.", { r: 2, v: 3, t: "meh" }, "p3y", "My word! I have plenty of those!", "happy"],
        ["Whatever you can afford.", { r: -5, v: 2, t: "weak" }, "p3y", "I can afford... gratitude. Gratitude's free.", "happy"]
      ] },
    p2c: { mood: "happy", say: [["nar", "Somewhere across the city, your landlord feels a disturbance."], ["npc", "I'll even throw in a free drink ticket. A WHOLE free drink ticket."]],
      ch: [
        ["Okay, but I'm bringing Marcus. Plus three.", { r: 0, v: 8, t: "joke" }, "p3y", "Marcus? Plus three? ...Do they drink? Of course they drink.", "worried"],
        ["Actually, wait. Let's talk about my fee.", { r: 5, v: -1, t: "recover" }, "p3x", "Oh no. Oh no, the face. The fee face.", "worried"],
        ["Also I get the Saturday slot.", { r: 6, v: 1, t: "bold" }, "p3x", "Whoa! Whoa. A negotiator. When did you become a negotiator?", "surprised"],
        ["[Nod. Die a little inside.]", { r: -6, v: -2, t: "weak" }, "p3y", "That's my guy.", "happy"]
      ] },
    p3x: { mood: "worried", say: [["nar", "His phone buzzes. The screen says LANDLORD. He declines it. It buzzes again. He declines it harder."], ["npc", "Alright, alright. Final offer."], ["nar", "He slides over an envelope. It contains a coupon for Sal's Pizza and a check dated next week."]],
      ch: [
        ["Dante. This is a pizza coupon.", { r: 6, v: 5, t: "wit" }, "END", "It's a GOOD pizza coupon. Two slices. Don't scoff.", "worried"],
        ["Cash. Today. Even if it's in singles.", { r: 8, v: 1, t: "firm" }, "END", "~He winces like you've asked for a kidney.", "worried"],
        ["The coupon plus the Saturday slot. Deal.", { r: 9, v: 2, t: "deal" }, "END", "Deal? Deal. Deal! I mean... let me check the calendar. It says next week.", "surprised"],
        ["[Tear the check in half, slowly. Eye contact.]", { r: 2, v: 6, t: "drama" }, "END", "~A woman at the bar applauds. Dante looks for the exit.", "surprised"]
      ] },
    p3y: { mood: "happy", say: [["nar", "He puts an arm around you. You smell cologne and old promises."], ["npc", "Listen. I'm gonna pay you. One hundred percent. I can feel it. Next week."]],
      ch: [
        ["I can feel it too. It's called a deposit.", { r: 7, v: 4, t: "wit" }, "END", "~He pats his pockets, all of them, like a man looking for his own dignity.", "worried"],
        ["Put it in writing.", { r: 6, v: 0, t: "firm" }, "END", "I do not have a pen. I have never had a pen.", "worried"],
        ["Next week is great. I'll take next week's Saturday.", { r: 8, v: 4, t: "counter" }, "END", "~He opens his mouth to say \"next week\" and realizes it's his own trap.", "surprised"],
        ["[Mutter] ...Okay.", { r: -5, v: -2, t: "weak" }, "END", "~He is already waving at someone across the room.", "happy"]
      ] }
  },
  endings: {
    legend: { title: "Dante Paid", lines: [["nar", "Dante pays. In cash. Out loud. A wallet gasps."], ["nar", "\"Mark the calendar,\" says the bartender. \"Dante paid.\" Someone starts a slow clap."]] },
    win: { title: "A Napkin Is a Contract", lines: [["nar", "He pays half and signs a napkin. The napkin is a document. Probably."], ["nar", "You also get the coupon. The pizza is incredible."]] },
    draw: { title: "Paid in Coupons", lines: [["nar", "He pays in coupons. You eat free pizza for a week. It's something."], ["nar", "Sal asks if you're the \"next week guy.\" You are."]] },
    lose: { title: "Exposure", lines: [["nar", "You play 2 to 6 AM. You are paid in exposure. The bartender gives you a pity shot."], ["nar", "At 5:40 AM a man asleep on a speaker applauds. He's the whole crowd."]] }
  }
};

SC.friend = {
  title: "The Best Friend", scene: "party", npc: "marcus", start: "f1",
  intro: "{npc} is your best friend, the most loyal human alive, and a hazard to all electronics. Your set starts in ten minutes. He brought a cake.",
  nodes: {
    f1: { mood: "happy", say: [["nar", "Your set starts in ten minutes. {npc} arrives. With friends. Seven of them. He's holding two drinks and a cake."], ["npc", ["{me}! My guy! It's my birthday! You're playing my birthday! And these are the guys, you know, plus three. And four.", "{me}!! Birthday! Mine! You're playing it! These guys are plus three. Plus four. Plus a cake."]]],
      ch: [
        ["It's not your birthday, {npc}.", { r: 3, v: -3, t: "firm" }, "f2a", "It's a SPIRITUAL birthday. You wouldn't understand. You're a Capricorn.", "worried"],
        ["Happy birthday! Let's get you on the list. One at a time.", { r: 5, v: 4, t: "kind" }, "f2b", "One at a time! So professional! I'm so proud!", "surprised"],
        ["[Hand him the clipboard.] You're in charge of the door.", { r: 6, v: 6, t: "clever" }, "f2c", "~He holds the clipboard like a holy relic. His eyes shine.", "surprised"],
        ["Marcus, I love you. Can you do me a favor and be quiet?", { r: 1, v: -2, t: "blunt" }, "f2a", "I'm quiet. I'm SO quiet. Listen to how quiet I am.", "sad"]
      ] },
    f2a: { mood: "worried", say: [["nar", "The friends begin chanting \"BIRTHDAY.\" They are not sure whose."], ["npc", "I just wanted to be part of it. You know? The big night. You, the decks. Me, the cake."]],
      ch: [
        ["Okay. Spiritual birthday. Sit over there with the cake.", { r: 4, v: 5, t: "kind" }, "f3x", "I'll be so spiritual. Watch me sit.", "happy"],
        ["Share the cake with the bartender and I'll let this go.", { r: 5, v: 6, t: "deal" }, "f3x", "The bartender gets cake! Everyone gets cake! That's the party!", "happy"],
        ["Capricorn is a sign, not a personality.", { r: 0, v: 2, t: "petty" }, "f3y", "Okay but you're being so Capricorn right now.", "angry"],
        ["[Hug him.]", { r: 3, v: 6, t: "kind" }, "f3x", "~He tears up. The friends tear up. A stranger tears up. Nobody knows why.", "sad"]
      ] },
    f2b: { mood: "surprised", say: [["nar", "He turns to his friends and says, very loud, \"This is my friend. The DJ.\" They applaud. Some are unsure why."], ["npc", "Okay. What do you need from me? I'm ready. I'm so ready. What do you need."]],
      ch: [
        ["Guard my records.", { r: 6, v: 3, t: "trust" }, "f3y", "I will guard them with my body. With my LIFE. With my seven friends.", "happy"],
        ["Stand by the speaker and tell me if the bass is good.", { r: 7, v: 3, t: "job" }, "f3x", "I'll know. I always know. I have a lot of feelings in my chest.", "happy"],
        ["Bring me a water. A big one.", { r: 3, v: 2, t: "practical" }, "f3y", "A big water! A heroic water!", "happy"],
        ["Don't touch anything.", { r: 4, v: -1, t: "firm" }, "f3y", "I won't touch anything. Except the cake. The cake's mine.", "worried"]
      ] },
    f2c: { mood: "surprised", say: [["nar", "{npc} is checking in his friends. He checks them in. He turns them away. He turns himself away. He lets himself back in."], ["npc", "I'm so good at this. I should be a bouncer. A bounce-er. A person who bounces."]],
      ch: [
        ["{npc}. You can't turn yourself away.", { r: 3, v: 7, t: "joke" }, "f3x", "Watch me. I'm very strict. I'm like a wall.", "surprised"],
        ["Let him. It's the best door in town.", { r: 4, v: 8, t: "joke" }, "f3x", "The best door! Put that on a flyer!", "happy"],
        ["[Take the clipboard back, gently.]", { r: 5, v: 3, t: "kind" }, "f3y", "I understand. It's a lot of power.", "sad"],
        ["[Film it. This is going on the Halcyon's story.]", { r: 2, v: 7, t: "meme" }, "f3x", "Am I famous? Is this my big break?", "surprised"]
      ] },
    f3x: { mood: "happy", say: [["nar", "Your set is rolling. Then a hand on the mic. {npc}. Very drunk, very proud, holding a cupcake."], ["npc", "EVERYBODY. QUIET. THIS IS MY BEST FRIEND. HE'S GOING TO BE FAMOUS. HE'S GOING TO FORGET US."]],
      ch: [
        ["[Let him finish. Drop the beat under his speech.]", { r: 6, v: 9, t: "read" }, "END", "~The floor catches it. Eight hundred people shout \"FORGET US\" in 4/4 time.", "surprised"],
        ["[Gently take the mic.] Okay! Everyone, give it up for {npc}!", { r: 5, v: 6, t: "kind" }, "END", "~Big cheers. He bows. He bows again, into the cake.", "happy"],
        ["[Cut the music.] Marcus. Sit.", { r: 1, v: -4, t: "firm" }, "END", "~Silence. The sound of one cupcake hitting a floor.", "sad"],
        ["He's right. I'll forget you all. But Marcus last.", { r: 7, v: 8, t: "wit" }, "END", "~The crowd says \"awww\" in unison. A stranger sobs.", "happy"]
      ] },
    f3y: { mood: "worried", say: [["nar", "Mid-set. {npc} trips on a cable. A smoothie leaves the cup. It rises in slow motion toward the mixer."], ["npc", "NOOOOOOOOOOOO"]],
      ch: [
        ["[Dive and catch the smoothie in the air.]", { r: 8, v: 8, t: "hero" }, "END", "~You catch it. Four hundred people see it. Slow-motion applause.", "surprised"],
        ["[Cover the mixer with your body.]", { r: 6, v: 3, t: "loyal" }, "END", "~You are wet. The mixer is dry. This is what a career is.", "sad"],
        ["[Yell \"NO!\" in slow motion too.]", { r: 0, v: 7, t: "joke" }, "END", "~The mixer is fine. The room is delighted. You're slightly damp.", "worried"],
        ["[Watch it happen.]", { r: -6, v: -6, t: "weak" }, "END", "~Channel 2 goes quiet, then makes a sound like a dolphin being sad.", "worried"]
      ] }
  },
  endings: {
    legend: { title: "A Toast to Marcus", lines: [["nar", "Marcus cries. The crowd chants his name. He is now more famous than you at this venue."], ["nar", "You are fine with that. Mostly. A little."]] },
    win: { title: "Great Night, Better Friend", lines: [["nar", "Marcus cries. The crowd claps. You get the best set of the month and an unsolicited hug."], ["nar", "He leaves you half the cake. You find it in your bag a week later. It is not good."]] },
    draw: { title: "It Could Have Been Worse", lines: [["nar", "Marcus is carried out by the friends. You finish your set."], ["nar", "A text arrives: \"I LOVE YOU MAN. also whats ur wifi.\""]] },
    lose: { title: "Plus Three Plus Disaster", lines: [["nar", "Marcus falls asleep in the booth. You play 45 minutes with a snoring man in a party hat on your cable."], ["nar", "The bartender takes a photo. It is now the club's logo."]] }
  }
};

SC.backstage = {
  title: "Backstage", scene: "corridor", npc: "gus", start: "b1",
  intro: "Fifteen minutes to doors. The monitor is dead. The sound guy is eating a sandwich the size of a toddler. Somebody legendary is about to walk down this hall.",
  nodes: {
    b1: { mood: "", say: [["nar", "Backstage. Fifteen minutes to doors. Your monitor is dead."], ["npc", ["Monitors? Yeah. Sure. When I'm done with... this.", "Monitors. I hear you. I don't listen, but I hear. Hold on. I'm mid-sandwich."]], ["nar", "{npc} the sound guy is mid-sandwich. The sandwich is also mid-sandwich."]],
      ch: [
        ["{npc}, I really need those monitors. Please.", { r: 2, v: -1, t: "polite" }, "b2", "Mm. Mm-hm. Polite. I like polite. Still eating.", ""],
        ["[Offer your granola bar.] It's got nuts. And honey.", { r: 5, v: 3, t: "bribe", f: "gus" }, "b2", "...Nuts AND honey. Okay. I'm listening. Barely. With my mouth.", "happy"],
        ["I'll tell the promoter you're eating on the clock.", { r: -4, v: -3, t: "threat" }, "b2", "Oh, you'll tell the promoter. I've been on the clock since 2009.", "angry"],
        ["That's a serious sandwich. What's in it?", { r: 7, v: 5, t: "kind", f: "gus" }, "b2", "FINALLY. Somebody asks. Smoked turkey, pickled onion, a little hot honey. It's a work of art.", "happy"]
      ] },
    b2: { mood: "happy", say: [["nar", "A door opens. A coat the color of midnight floats down the hall. Kosmo Delacroix is wearing sunglasses indoors, correctly."], ["npc", "...Kevin! Wonderful to see you."], ["nar", "Your name is not Kevin."]],
      cast: { npc: "kosmo" },
      ch: [
        ["It's {me}, Kosmo. Great to see you too.", { r: 4, v: 2, t: "polite", f: "named" }, "b3", "Of course. Of course it is. It was on the tip of my tongue. Right behind Kevin.", "surprised"],
        ["Hey, Kosmo. Yeah. Kevin. It's been a while.", { r: -3, v: 6, t: "go-along", f: "kevin" }, "b3", "I knew it. I never forget a face. Or a Kevin.", "happy"],
        ["Kevin's in the green room. I'm {me}.", { r: 6, v: 5, t: "wit", f: "named" }, "b3", "Ahh, a different one. Of course. There are so many. Names are a tapestry.", "surprised"],
        ["[Bow slightly.] Master.", { r: 2, v: 6, t: "joke", f: "kevin" }, "b3", "Rise, Kevin. Rise.", "happy"]
      ] },
    b3a: { mood: "happy", say: [["nar", "Two minutes. The monitors hum. Somebody hands you water. Gus gives you a thumbs-up with the sandwich hand."], ["npc", "Don't tell anyone I'm nice. It ruins the brand."]],
      cast: { npc: "gus" },
      ch: [
        ["[Walk out calm. A slow nod to the crowd.]", { r: 7, v: 6, t: "cool" }, "END", "~The floor roars before you touch a record. It's the nod.", "happy"],
        ["[Hug Gus. Briefly. Respectfully.]", { r: 5, v: 8, t: "kind" }, "END", "~He holds the sandwich out of the way. You have been hugged by a man who loves you, and a sandwich.", "surprised"],
        ["[Hype the crowd.] Brooklyn! Are you ready?!", { r: 3, v: 5, t: "cheesy" }, "END", "~Brooklyn is ready. Brooklyn is slightly embarrassed for you.", "worried"],
        ["[Pump your arms like a runner.]", { r: 2, v: 7, t: "joke" }, "END", "~You look like an inflatable tube man at a car dealership. The crowd loves it.", "happy"]
      ] },
    b3b: { mood: "angry", say: [["nar", "Doors open. The monitor is still dead. Gus is still mid-sandwich. He is now apparently on dessert."], ["npc", "Oh, you're on? Huh. Check the thing. The... thing."]],
      cast: { npc: "gus" },
      ch: [
        ["Gus. One more time. Please. I'll buy you the next sandwich.", { r: 5, v: 4, t: "deal" }, "END", "~He puts down the sandwich. It's a historic moment. The monitor lights up.", "surprised"],
        ["[Plug the monitor in yourself. Pray.]", { r: 6, v: 3, t: "diy" }, "END", "~It wasn't unplugged. It was just on mute. You are the sound guy now.", "worried"],
        ["I'll go on without it. I have the best ears in the building.", { r: 4, v: 5, t: "bold" }, "END", "~You play blind. It's incredible. It's terrifying. You never admit it.", "surprised"],
        ["[Sigh dramatically at the ceiling.]", { r: -4, v: -3, t: "weak" }, "END", "~Nobody notices. The ceiling doesn't care either.", "happy"]
      ] },
    b3k: { mood: "", say: [["nar", "The stage manager peeks in with a headset and a clipboard."], ["npc", "Kevin? Two minutes! Kevin?"], ["nar", "Somewhere, a man named Kevin is being paged. It's you."]],
      cast: { npc: "gus" },
      ch: [
        ["[Run on as Kevin. Commit.]", { r: -2, v: 9, t: "go-along" }, "END", "~The crowd chants \"KEV-IN.\" You wave. You get a hat. You never explain.", "surprised"],
        ["Excuse me. It's {me}. Please correct the MC.", { r: 6, v: 1, t: "firm" }, "END", "~The MC fixes it mid-announcement. It still sounds like a fruit.", "worried"],
        ["I'm Kevin's cousin. Kevin couldn't make it. I'm {me}.", { r: 6, v: 7, t: "wit" }, "END", "~The crowd cheers for Kevin's cousin. Kevin's cousin is doing great.", "happy"],
        ["[Hide in a road case.]", { r: -5, v: -3, t: "weak" }, "END", "~It's a very good road case. You'll stay in it a while.", "worried"]
      ] }
  },
  endings: {
    legend: { title: "Kosmo Said Your Name", lines: [["nar", "From the wings, Kosmo lowers his sunglasses and says it, correctly, in front of the crew. The crew gasps."], ["nar", "Gus gives you a pickle. It is an honor. Eat it."]] },
    win: { title: "Smooth Backstage", lines: [["nar", "You hit the stage warm, the monitors loud, the sandwich still half-eaten."], ["nar", "Kosmo walks by again: \"Great set, ...Kev—\" He stops. \"Great set.\" Progress."]] },
    draw: { title: "Held Together With Tape", lines: [["nar", "The set happens. It's fine. The monitor cuts out once. Gus pretends he didn't see."], ["nar", "A kid asks you to sign a setlist. It says \"Kevin.\""]] },
    lose: { title: "Gus Has Left the Chat", lines: [["nar", "No monitors. Wrong name. A pickle you didn't ask for."], ["nar", "At midnight, Gus waves at you from the booth with an entire second sandwich. You wave back, sadly."]] }
  }
};

SC.ego = {
  title: "The Superstar", scene: "dock", npc: "axl", start: "e1", bias: 2,
  intro: "{npc} headlines the main stage and believes the sun sets when he says so. His people want your 10 PM slot. You need it more than he does.",
  nodes: {
    e1: { mood: "happy", say: [["nar", "Harbor Lights. Backstage by the water. 6:30 PM. Your set is at ten."], ["npc", ["Hey. You. The local act. Great news. Your slot's moving to 3 AM. It's a promotion. Of time.", "Oh hey, local guy. We moved you to 3 AM. It's very exclusive. Nobody will be there. Perfect."]], ["nar", "{npc}'s assistant hands him a golden towel. He holds it like a trophy."]],
      ch: [
        ["My slot's at ten. It's on the poster.", { r: 5, v: -1, t: "firm" }, "e2a", "A POSTER? I'm on three posters. Two of them are bigger than the festival.", "angry"],
        ["Three AM? Perfect. Nobody's ever played after sunrise.", { r: 7, v: 4, t: "wit" }, "e2b", "...Wait. Are you making fun of me?", "surprised"],
        ["Congratulations on having so many hours.", { r: 6, v: 5, t: "wit" }, "e2b", "Thank you. I do have a lot of hours. I'm very busy.", "happy"],
        ["Of course, {npc}. Whatever you need.", { r: -9, v: 0, t: "weak" }, "e2c", "See, THIS is why I like local acts. Unthreatening. Like furniture.", "happy"]
      ] },
    e2a: { mood: "angry", say: [["nar", "His assistant hands him a cold-pressed something. He drinks it like he's been wronged by it."], ["npc", "I don't think you understand how this works. I move slots. It's what I do. Like the moon. Or tides."]],
      ch: [
        ["Then take the moon's slot. Mine is ten.", { r: 5, v: 5, t: "wit" }, "e3x", "...The moon's already headlining. It's not a bad take.", "surprised"],
        ["Posters are legally binding. It says ten PM. That's the deal.", { r: 7, v: 2, t: "firm" }, "e3x", "Legally binding?! Who said that? Who TOLD you that?", "worried"],
        ["[Smile.] Let's ask the crowd.", { r: 6, v: 6, t: "bold" }, "e3y", "The crowd. Ha. The crowd. They love me. That's all they do.", "happy"],
        ["[Walk away.]", { r: 2, v: -2, t: "cool" }, "e3y", "Hey! I wasn't done being impressive!", "angry"]
      ] },
    e2b: { mood: "surprised", say: [["nar", "His entourage laughs. He looks at them. They stop."], ["npc", "It's a joke, isn't it. You think I'm a joke. Say it."]],
      ch: [
        ["Only a little. Mostly I'm making fun of the timetable.", { r: 7, v: 6, t: "wit" }, "e3x", "That's fair. The timetable is an idiot.", "happy"],
        ["No. I'm genuinely scared. Please spare my slot.", { r: -3, v: 3, t: "weak" }, "e3y", "Good. Fear's a start.", "happy"],
        ["Yes.", { r: 6, v: 4, t: "bold" }, "e3x", "...Huh. Nobody ever says yes. That's refreshing. I hate it.", "surprised"],
        ["Is that a golden towel?", { r: 3, v: 6, t: "deflect" }, "e3y", "It's a golden TOWEL, yes. It's from my tour. I have three.", "happy"]
      ] },
    e2c: { mood: "happy", say: [["nar", "He pats your head. You feel it in your pride."], ["npc", "Look at you. Obedient. Quiet. I could put a plant on your slot and nobody would notice."]],
      ch: [
        ["Actually, furniture bites.", { r: 6, v: 5, t: "wit" }, "e3x", "~He jumps back an inch. The entourage pretends they didn't see.", "surprised"],
        ["{npc}. I need that slot. My whole life is in it.", { r: 4, v: 2, t: "honest" }, "e3y", "...A whole life? In a slot? That's... sad. But also kind of beautiful.", "worried"],
        ["[Nod. Say nothing.]", { r: -6, v: -4, t: "weak" }, "e3y", "Good. Great. Love the energy.", "happy"],
        ["I'll play 3 AM. If you open for me at ten.", { r: 8, v: 4, t: "bold" }, "e3x", "OPEN?! For YOU? I... have never... no. No. Ha. Ha ha ha ha.", "surprised"]
      ] },
    e3x: { mood: "worried", say: [["nar", "His manager, Reggie, appears with a tablet and a face like a spreadsheet."], ["npc", "The contract says ten PM for the local. Axl's rider says \"ten PM: Axl.\" One of these is a hallucination."]],
      ch: [
        ["[Read the contract out loud. Slowly.]", { r: 8, v: 3, t: "firm" }, "END", "~Reggie reads along. His lips move. His eyes close. \"Yeah. That's the contract.\"", "angry"],
        ["How about I open at 9:30 and Axl closes at 10:30?", { r: 6, v: 4, t: "deal" }, "END", "~Reggie looks to Axl. Axl looks at the water. The water doesn't help.", "worried"],
        ["Kosmo Delacroix said the schedule's fine. Ask him.", { r: 5, v: 6, t: "name-drop" }, "END", "~The entourage goes silent. Somebody drops a tablet. In the distance, a dog barks.", "surprised"],
        ["[Hand over your phone with the festival's own email.]", { r: 7, v: 5, t: "proof" }, "END", "~Reggie reads it. He reads it again. He whispers the word \"oops.\"", "worried"]
      ] },
    e3y: { mood: "angry", say: [["nar", "He is bored. Bored is when he's dangerous."], ["npc", "Let's do this like adults. Back-to-back. First one to clear the floor loses the slot. Loser carries the towel."]],
      ch: [
        ["Deal. But a coin toss decides who goes first.", { r: 6, v: 4, t: "savvy" }, "END", "~You flip it. He calls tails. It's heads. He calls it a technicality.", "angry"],
        ["Deal. Loser carries the golden towel.", { r: 6, v: 7, t: "wit" }, "END", "~The entourage mouths \"oooh.\" The towel looks nervous.", "surprised"],
        ["No. I don't gamble with my own slot.", { r: 5, v: -2, t: "firm" }, "END", "~He shrugs. \"Smart. Boring. Smart.\"", "happy"],
        ["Deal. Bring a chair, {npc}. You'll want to sit.", { r: 7, v: 5, t: "bold" }, "END", "~He doesn't bring a chair. Somebody brings a chair for him. It's an awkward chair.", "angry"]
      ] }
  },
  endings: {
    legend: { title: "You Keep Ten O'Clock", lines: [["nar", "Axl backs down. In front of everyone. He hands you the golden towel. It's warm. It smells like a fancy gym."], ["nar", "You open at ten. He plays at midnight. Your name is on the poster in bigger letters."]] },
    win: { title: "Ten PM, Locked", lines: [["nar", "You keep ten PM. Axl takes 11:30 and a long pout."], ["nar", "Reggie quietly buys you a drink and says, \"For the record. I read the contract.\""]] },
    draw: { title: "A Compromise (Everyone Is Annoyed)", lines: [["nar", "Ten to eleven, you. Eleven to midnight, Axl. A schedule everyone hates equally."], ["nar", "That's what a compromise is. You learn something."]] },
    lose: { title: "Three A.M.", lines: [["nar", "You play at 3 AM. Eleven people. Two are asleep. One is Lou."], ["nar", "Lou is thrilled. \"Reminds me of 1993,\" he says. You have no idea what that means. But you play for Lou."]] }
  }
};

/* ------------------------------------------------------------------------------------------ characters */
const DEFS = {
  brandon: { name: "Brandon Shine", height: 100, build: "thin", skin: "#f1c7a5", hair: { style: "slick", color: "#e8e0d0" }, top: { style: "bomber", color: "#aab4c8", color2: "#17131f" }, bottom: { style: "pants", color: "#17131f" }, shoes: { style: "shoes", color: "#efeaf6" }, acc: ["shades", "chain"], voice: "#9ad0ff" },
  gus: { name: "Gus", height: 92, build: "stocky", skin: "#e0a27a", hair: { style: "buzz", color: "#7a4a2a" }, facial: "beard", facialColor: "#7a4a2a", top: { style: "tee", color: "#2a2836", print: "text", text: "STAFF", printColor: "#efeaf6" }, bottom: { style: "cargo", color: "#3a3a2a" }, shoes: { style: "boots", color: "#2a1a12" }, acc: ["headphones", "beanie"], headphonesOn: false, hatColor: "#5a3a8a", voice: "#7fe0c0" }
};
const PRESET = { dante: "dante", marcus: "marcus", axl: "axl", kosmo: "kosmo" };
const MOOD_EXPR = { happy: "happy", angry: "angry", sad: "sad", surprised: "surprised", worried: "worried" };

/* ------------------------------------------------------------------------------------------ scenes */
function paintScene(kind, SK, seed) {
  const T = SK.P, W = 320, H = 188;
  const far = U.mk(W, H), near = U.mk(W, H);
  let c = far.getContext("2d");
  const r = mulberry(seed);
  let light = { lx: -0.4, rim: { color: "#ff3fa4", side: 1 } };
  if (kind === "booth") {
    T.vgrad(c, 0, 0, W, 130, ["#0a0620", "#1a0c40", "#2e1260", "#4a1a70"]);
    for (let x = 44; x < 276; x += 4) { const h = 6 + (Math.sin(x / 9) * 4 + 4 + r() * 5) | 0; R(c, x, 56 - h, 3, h, x % 8 ? "#ff3fa4" : "#39d0ff"); P(c, x, 56 - h, "#fff6f0"); }
    T.shade(c, 44, 20, 232, 40, (x, y) => 0.35, "#0a0620", 0.5);
    [[2, 28], [2, 62], [2, 96], [282, 28], [282, 62], [282, 96]].forEach(([x, y]) => T.speaker(c, x, y, 36, 34));
    R(c, 0, 2, W, 5, "#2a2640"); R(c, 0, 2, W, 1, "#8a86a0");
    for (let x = 20; x < W; x += 50) { R(c, x - 3, 7, 6, 4, "#14101e"); T.glow(c, x, 14, 14, 10, (x / 50 | 0) % 2 ? "#39d0ff" : "#ff3fa4", 1, 0.4); }
    c.globalAlpha = 0.2; for (let i = 0; i < 7; i++) { const x1 = 40 + i * 40; U.line(c, 160, 8, x1, 118, i % 2 ? "#39d0ff" : "#ff8fcf"); U.line(c, 161, 8, x1 + 1, 118, i % 2 ? "#39d0ff" : "#ff8fcf"); } c.globalAlpha = 1;
    T.neon(c, "HALCYON ROOM", 160, 12, "#39d0ff", 2);
    R(c, 108, 96, 104, 5, "#2a2438"); R(c, 108, 96, 104, 1, "#7a76a0"); R(c, 112, 101, 96, 22, "#14101e"); R(c, 112, 101, 96, 1, "#3a3650");
    [[122, 98], [198, 98]].forEach(([x, y]) => { ell(c, x, 96, 11, 3, "#0a0814"); ell(c, x, 95, 10, 2, "#2a2640"); ell(c, x, 94, 4, 1, "#ff3fa4"); });
    R(c, 148, 90, 24, 8, "#1c1a26"); R(c, 148, 90, 24, 1, "#6a6890"); for (let i = 0; i < 4; i++) P(c, 151 + i * 5, 93, i % 2 ? "#39d0ff" : "#9be15d");
    T.dith(c, 0, 124, W, 64, "#120c26", "#1e1440", 0.5);
    for (let y = 130, g = 5; y < H; y += g, g += 3) R(c, 0, y, W, 1, "#2a1c50");
    for (let x = -80; x < W + 80; x += 40) U.line(c, 160 + (x - 160) * 0.25, 124, x, H, "#2a1c50");
    T.glow(c, 60, 150, 70, 20, "#ff3fa4", 0.8, 0.28); T.glow(c, 260, 150, 70, 20, "#39d0ff", 0.8, 0.28);
    c = near.getContext("2d");
    for (let i = 0; i < 34; i++) { const x = 4 + i * 9.5 + (r() * 4 | 0), y = 176 + (r() * 6 | 0) - (i % 3) * 3; ell(c, x, y, 4, 4, "#05030c"); R(c, x - 5, y + 3, 10, 14, "#05030c"); if (i % 4 === 0) { R(c, x + 4, y - 9, 2, 10, "#05030c"); } P(c, x - 3, y - 2, i % 2 ? "#ff3fa4" : "#39d0ff"); P(c, x - 4, y, i % 2 ? "#ff3fa4" : "#39d0ff"); }
    R(c, 0, 183, W, 5, "#05030c");
    light = { lx: -0.35, rim: { color: "#ff3fa4", side: -1 }, rim2: { color: "#39d0ff", side: 1 } };
  } else if (kind === "bar" || kind === "party") {
    T.brick(c, 0, 0, W, 120, "#3a1c34", seed + 2, 14, 6);
    T.shade(c, 0, 0, W, 120, (x, y) => Math.max(0, (1 - y / 40) * 0.8, Math.abs(x - 160) > 130 ? (Math.abs(x - 160) - 130) / 60 : 0), "#06030c", 0.7);
    R(c, 40, 28, 240, 6, "#6a4424"); R(c, 40, 28, 240, 1, "#c89058"); R(c, 40, 58, 240, 6, "#6a4424"); R(c, 40, 58, 240, 1, "#c89058");
    T.shade(c, 44, 8, 232, 52, (x, y) => 1, "#ffb04a", 0.16);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 24; i++) { const x = 46 + i * 9.6, h = 12 + (r() * 8 | 0), y0 = (row ? 58 : 28) - h, col = ["#39d0ff", "#ffc44d", "#9be15d", "#ff3fa4", "#e8dcc0", "#7a3fb0"][r() * 6 | 0], k = K(col); R(c, x, y0, 6, h, k[2]); R(c, x, y0, 1, h, k[3]); R(c, x + 5, y0, 1, h, k[1]); R(c, x + 2, y0 - 3, 2, 3, k[1]); P(c, x + 2, y0 + 3, k[4]); }
    T.glow(c, 160, 40, 110, 30, "#ffb04a", 0.8, 0.3);
    T.neon(c, "COLD ONES", 70, 10, "#ff3fa4", 1); T.neon(c, "OPEN", 250, 10, "#39d0ff", 2);
    // bar counter
    R(c, 0, 112, W, 7, "#8a5a30"); R(c, 0, 112, W, 1, "#e0b078"); R(c, 0, 118, W, 1, "#3a2210");
    R(c, 0, 119, W, 41, "#4a2e1c"); for (let x = 0; x < W; x += 16) { R(c, x, 119, 1, 41, "#2a1810"); R(c, x + 1, 120, 1, 39, "#6a4630"); }
    R(c, 0, 150, W, 3, "#b8924a"); R(c, 0, 150, W, 1, "#f0d898");
    for (let i = 0; i < 5; i++) { const x = 30 + i * 62; R(c, x, 100, 14, 12, "#0a0814"); ell(c, x + 7, 98, 7, 2, "#c0302c"); R(c, x + 6, 112, 2, 40, "#4a4660"); }
    if (kind === "party") {
      for (let i = 0; i < 9; i++) { const bx = 10 + i * 36 + (r() * 8 | 0), by = 20 + (r() * 14 | 0), col = ["#ff3fa4", "#39d0ff", "#ffc44d", "#9be15d", "#ff8a3a"][i % 5], k = K(col); ell(c, bx, by, 6, 8, col); ell(c, bx - 2, by - 3, 2, 2, k[4]); U.line(c, bx, by + 8, bx + ((i % 2) ? 5 : -5), by + 22, "#c8c0e0"); }
      R(c, 82, 70, 156, 16, "#14101e"); R(c, 82, 70, 156, 1, "#ffd27a"); txtC(c, "HAPPY B-DAY", 160, 74, "#ffd27a", 2, 2);
    }
    T.dith(c, 0, 160, W, 28, "#201424", "#2c1c34", 0.5);
    for (let y = 164, g = 6; y < H; y += g, g += 3) R(c, 0, y, W, 1, "#14101e");
    for (let x = 0; x < W; x += 28) R(c, x, 160, 1, 28, "#14101e");
    T.glow(c, 160, 170, 130, 14, "#ffb04a", 0.7, 0.2);
    c = near.getContext("2d");
    light = { lx: -0.4, rim: { color: "#ffb04a", side: -1 }, rim2: { color: "#ff3fa4", side: 1 } };
  } else if (kind === "corridor") {
    T.brick(c, 0, 0, W, 150, "#2c3a44", seed + 3, 16, 8);
    T.shade(c, 0, 0, W, 150, (x, y) => Math.max(0, (1 - y / 46) * 0.85, Math.abs(x - 160) > 120 ? (Math.abs(x - 160) - 120) / 70 : 0), "#04060a", 0.7);
    R(c, 0, 10, W, 5, "#5a2a2a"); R(c, 0, 10, W, 1, "#c06a5a"); R(c, 0, 14, W, 1, "#2a1010"); R(c, 0, 20, W, 4, "#4a4e58"); R(c, 0, 20, W, 1, "#9aa0b0"); R(c, 0, 23, W, 1, "#1a1e26");
    for (let x = 30; x < W; x += 80) { R(c, x, 8, 4, 18, "#7a7a8a"); R(c, x, 8, 4, 1, "#c0c0d0"); }
    for (let x = 24; x < W; x += 112) { R(c, x, 30, 40, 3, "#1a1e26"); R(c, x, 31, 40, 1, "#e8f0ff"); T.glow(c, x + 20, 34, 40, 18, "#c0f0ff", 0.8, 0.22); }
    // door
    R(c, 126, 56, 68, 94, "#14161e"); R(c, 126, 56, 68, 1, "#6a7080"); R(c, 130, 60, 60, 90, "#2a2230"); R(c, 130, 60, 60, 1, "#5a4a60"); R(c, 154, 82, 12, 28, "#ffd27a"); T.glow(c, 160, 96, 24, 26, "#ffb04a", 1, 0.3);
    U.poly(c, [[160, 64], [162, 69], [167, 69], [163, 72], [165, 77], [160, 74], [155, 77], [157, 72], [153, 69], [158, 69]], "#ffc44d");
    T.neon(c, "ARTISTS", 160, 46, "#ffc44d", 1);
    // exit sign
    R(c, 270, 40, 30, 12, "#0a2a14"); R(c, 270, 40, 30, 1, "#5af09a"); txtC(c, "EXIT", 285, 43, "#7af0a0", 1, 1); T.glow(c, 285, 46, 24, 14, "#5af09a", 0.8, 0.25);
    // schedule
    R(c, 220, 72, 30, 40, "#e8dcb8"); R(c, 220, 72, 30, 1, "#fff"); for (let i = 0; i < 8; i++) R(c, 223, 76 + i * 4, 18 + (i % 3) * 3, 1, "#8a7a52"); R(c, 223, 76, 12, 2, "#c0302c"); R(c, 222, 71, 6, 3, "#d8c890"); R(c, 242, 71, 6, 3, "#d8c890");
    // cases
    [[6, 112, 44, 38], [10, 80, 36, 32], [262, 118, 54, 32], [270, 92, 40, 26]].forEach(([x, y, w, h], i) => { R(c, x, y, w, h, "#2a2630"); R(c, x, y, w, 1, "#6a6678"); R(c, x, y + h - 1, w, 1, "#0a080e"); R(c, x, y, 1, h, "#4a4658"); [[x, y], [x + w - 4, y], [x, y + h - 4], [x + w - 4, y + h - 4]].forEach(([a, b]) => R(c, a, b, 4, 4, "#9aa0b0")); R(c, x + 6, y + (h >> 1) - 1, w - 12, 3, "#14101e"); if (i % 2 === 0) { R(c, x + 8, y + 6, 14, 8, "#ffc44d"); txt(c, "LOUD", x + 9, y + 8, "#14101e", 1, 1); } });
    T.dith(c, 0, 150, W, 38, "#1c1a24", "#2a2634", 0.5);
    R(c, 0, 150, W, 1, "#4a4658");
    for (let i = 0; i < 3; i++) { const y0 = 158 + i * 8; for (let x = 0; x < W; x++) { const y = y0 + Math.round(Math.sin(x / 26 + i * 2) * 3); P(c, x, y, "#08060c"); P(c, x, y + 1, "#08060c"); if (x % 40 === 0) R(c, x, y - 1, 6, 3, "#ffc44d"); } }
    c = near.getContext("2d");
    light = { lx: -0.3, rim: { color: "#7af0a0", side: 1 }, rim2: { color: "#ffc44d", side: -1 } };
  } else { // dock
    T.vgrad(c, 0, 0, W, 104, ["#1a1040", "#44186a", "#9a2a78", "#e0585a", "#ff9a4a", "#ffd27a"]);
    for (let i = 0; i < 40; i++) P(c, r() * W | 0, r() * 40 | 0, r() < 0.4 ? "#ffffff" : "#c0b0ff");
    for (let b = 0; b < 4; b++) T.dith(c, 0, 50 + b * 8, W, 4, "#b0407a", "#ff8a6a", 0.3);
    ell(c, 214, 98, 16, 16, "#fff0b8"); ell(c, 214, 98, 12, 12, "#fff8d8"); T.glow(c, 214, 98, 50, 36, "#ffb04a", 1, 0.4);
    // water
    T.vgrad(c, 0, 104, W, 28, ["#ff9a4a", "#b0407a", "#3a1a5a", "#140c34"]);
    for (let i = 0; i < 40; i++) { const y = 106 + (i * 0.65 | 0), w = 30 - (y - 104) * 0.7; R(c, 214 - w / 2 + (r() * 14 - 7), y, Math.max(4, w * (0.4 + r() * 0.6)), 1, "#ffd27a"); }
    // far shore + cranes + ferris wheel
    R(c, 0, 100, W, 5, "#1a0c34");
    [[22, 18], [52, 36], [300, 24]].forEach(([x, h]) => { R(c, x, 100 - h, 3, h, "#120828"); R(c, x - 14, 100 - h, 32, 2, "#120828"); R(c, x - 14, 100 - h, 1, 8, "#120828"); U.line(c, x + 1, 100 - h, x + 16, 100 - h + 12, "#120828"); });
    const fx = 268, fy = 66, fr = 26;
    for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; P(c, fx + Math.cos(ang) * fr, fy + Math.sin(ang) * fr, "#120828"); P(c, fx + Math.cos(ang) * (fr - 1), fy + Math.sin(ang) * (fr - 1), "#120828"); }
    for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; U.line(c, fx, fy, fx + Math.cos(ang) * fr, fy + Math.sin(ang) * fr, "#120828"); ell(c, fx + Math.cos(ang) * fr, fy + Math.sin(ang) * fr + 2, 2, 2, a % 2 ? "#ff3fa4" : "#ffc44d"); }
    U.line(c, fx, fy, fx - 12, 100, "#120828"); U.line(c, fx, fy, fx + 12, 100, "#120828");
    // bunting
    for (let x = 0; x <= W; x += 16) { const y = 12 + Math.round(Math.sin(x / W * Math.PI) * 8); U.line(c, x, y, x + 16, y + (x < W / 2 ? 1 : -1), "#2a1030"); U.poly(c, [[x + 2, y], [x + 14, y], [x + 8, y + 9]], ["#ff3fa4", "#39d0ff", "#ffc44d", "#9be15d"][(x / 16) % 4 | 0]); }
    // trailer (left)
    R(c, -8, 92, 76, 40, "#c8c0d8"); R(c, -8, 92, 76, 2, "#fff"); R(c, -8, 130, 76, 2, "#6a607a"); for (let x = -4; x < 64; x += 6) R(c, x, 100, 1, 28, "#a8a0c0");
    R(c, 36, 104, 18, 26, "#8a2a2a"); U.poly(c, [[45, 108], [47, 113], [52, 113], [48, 116], [50, 121], [45, 118], [40, 121], [42, 116], [38, 113], [43, 113]], "#ffd27a");
    T.glow(c, 20, 110, 40, 20, "#ffb04a", 0.6, 0.2);
    // banner
    R(c, 100, 76, 90, 20, "#14101e"); R(c, 100, 76, 90, 1, "#ffc44d"); R(c, 100, 95, 90, 1, "#ffc44d"); txtC(c, "HARBOR LIGHTS", 145, 82, "#ffd27a", 1, 1); txtC(c, "FESTIVAL · BACKSTAGE", 145, 89, "#ff8fcf", 1, 1);
    R(c, 101, 96, 2, 30, "#2a2236"); R(c, 187, 96, 2, 30, "#2a2236");
    // ground
    T.dith(c, 0, 132, W, 56, "#24203a", "#322c4c", 0.5);
    for (let y = 138, g = 6; y < H; y += g, g += 3) R(c, 0, y, W, 1, "#14101e");
    R(c, 0, 130, W, 3, "#4a4668"); for (let x = 0; x < W; x += 12) R(c, x, 130, 6, 3, "#ffc44d");
    T.glow(c, 214, 150, 90, 16, "#ffb04a", 0.7, 0.2);
    c = near.getContext("2d");
    light = { lx: 0.4, rim: { color: "#ffb04a", side: 1 }, rim2: { color: "#9a5ae0", side: -1 } };
  }
  return { far, near, light };
}

/* ------------------------------------------------------------------------------------------ the game */
RP.mg.register("clubDrama", {
  title: "club.Drama", order: 15,
  desc: "Choose your response. Rivals, promoters, best friends, backstage, and Axl.",
  data: SC,
  auto(p) { const scn = p && SC[p.scenario] ? p.scenario : "rival"; return { ok: true, score: 80, outcome: "win", ending: "win", scenario: scn }; },
  async play(host, p) {
    const SK = RP.social;
    if (!SK) return { ok: false, score: 0, outcome: "lose", error: "socialkit_lib missing" };
    try { return await run(host, p || {}, SK); }
    catch (e) { console.error("clubDrama", e); return { ok: false, score: 0, outcome: "lose", error: String(e) }; }
  }
});

async function run(host, p, SK) {
  if (!cssDone) { el("style", { text: CSS }, document.head); cssDone = true; }
  SK.css();
  const S = SK.session(host), root = host.root;
  try { host.ov.classList.add("sk-g"); } catch (e) { /* ignore */ }
  const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
  const rnd = Math.random;
  const keys = Object.keys(SC);
  const scnKey = SC[p.scenario] ? p.scenario : SK.pick(keys, rnd);
  const sc = SC[scnKey];
  Object.keys(DEFS).forEach(k => { try { RP.chars.define("sk_" + k, DEFS[k]); } catch (e) { /* ignore */ } });
  const myName = SK.djName();
  const rivalName = String(p.rival || "DJ Brandon Shine");
  const npcNames = { brandon: rivalName, dante: "Dante", marcus: "Marcus", gus: "Gus", kosmo: "Kosmo", axl: "Axl Vanta" };
  const defFor = key => key === "brandon" || key === "gus" ? RP.chars.get("sk_" + key) : (RP.chars.get(PRESET[key] || key));
  const kidDef = SK.charDef("kid");
  const st = { rep: 50, vibe: 50, f: {}, tags: [] };
  const tok = (s) => SK.fmt(s, { me: myName, npc: npcNames[sc.npc] || "them" });
  const head = host.header("club.Drama", (p.arcade ? "Arcade · " : "") + sc.title);
  head.classList.add("sk-head");
  let leaveRes = null;
  const leaveP = new Promise(res => { leaveRes = res; });
  SK.leave(host, head, S, () => leaveRes({ ok: false, score: 0, outcome: "lose", left: true, scenario: scnKey }));
  const wrap = el("div", { cls: "sk-wrap cd-flow" }, root);
  return Promise.race([leaveP, flow()]);

  async function flow() {
    const thrShift = (diff - 2) * 3;
    { const sceneL = { lx: SC[scnKey].scene === "dock" ? 0.4 : SC[scnKey].scene === "bar" || SC[scnKey].scene === "party" ? -0.4 : SC[scnKey].scene === "corridor" ? -0.3 : -0.35 };
      const npcKeys = [sc.npc].concat(scnKey === "backstage" ? ["kosmo", "gus"] : []).filter((v, i, a) => a.indexOf(v) === i);
      const rimOf = { booth: { color: "#ff3fa4", side: -1 }, bar: { color: "#ffb04a", side: -1 }, party: { color: "#ffb04a", side: -1 }, corridor: { color: "#7af0a0", side: 1 }, dock: { color: "#ffb04a", side: 1 } }[sc.scene];
      const rim2Of = { booth: { color: "#39d0ff", side: 1 }, bar: { color: "#ff3fa4", side: 1 }, party: { color: "#ff3fa4", side: 1 }, corridor: { color: "#ffc44d", side: -1 }, dock: { color: "#9a5ae0", side: -1 } }[sc.scene];
      let jobs = SK.headJobs(kidDef, "right", { lx: sceneL.lx, rim: rimOf }, ["", "worried", "angry", "happy", "sad"]);
      npcKeys.forEach(k => { jobs = jobs.concat(SK.headJobs(defFor(k), "left", { lx: -sceneL.lx, rim: rim2Of }, null)); });
      SK.warmQueue(S, jobs, 40); }
    await SK.intro(S, wrap, {
      kicker: sc.title.toUpperCase(),
      title: "Choose your response",
      lead: tok(sc.intro),
      steps: [
        "Three beats, stakes rising. Each time, pick how to respond (click or press <b>1</b>–<b>4</b>).",
        "<b>REP</b> is what people think of you. <b>VIBE</b> is how the room feels. You need both.",
        "Wit beats force. Being kind beats being cheap. Being a doormat beats nothing.",
        "The ending depends on where both meters land. Someone legendary might be watching."
      ],
      pill: "DIFFICULTY " + diff,
      button: "START"
    });
    const play = el("div", { cls: "cd-play" }, wrap);
    const cw = el("div", { cls: "cd-wrap" }, play);
    const hud = el("div", { cls: "cd-hud" }, cw);
    const mRep = SK.meter(hud, { label: "REPUTATION", color: "#ff3fa4", max: 100, value: 50 });
    const roundEl = el("div", { cls: "cd-round", text: "BEAT 1/3" }, hud);
    const mVibe = SK.meter(hud, { label: "VIBE", color: "#39d0ff", max: 100, value: 50 });
    const stageApi = SK.canvas(cw, 320, 188, 2);
    const say = SK.say(S, play);
    const chBox = el("div", { cls: "cd-choices" }, play);
    el("div", { cls: "sk-tip", text: "Keys 1-4 pick a response · click or Space skips the typing" }, play);
    const c = stageApi.c;
    const scene = paintScene(sc.scene, SK, hashStr(scnKey) % 9999);
    const floats = SK.floats();
    const blinkK = SK.blinker(), blinkN = SK.blinker();
    const cast = { npc: sc.npc, npcExpr: "", meExpr: "", speaker: "", talking: false };
    let last = performance.now();
    host.raf(t => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      try { draw(dt); } catch (e) { /* never throw */ }
    });
    function draw(dt) {
      c.drawImage(scene.far, 0, 0);
      const lt = { lx: scene.light.lx, rim: scene.light.rim, shadow: 0, cast: false };
      const npcDef = defFor(cast.npc);
      const talkingNpc = say.talking && cast.speaker === "npc", talkingMe = say.talking && cast.speaker === "me";
      const tm = Math.floor(performance.now() / 110) % 2 === 0;
      SK.drawChar(c, kidDef, 84, 196, { face: "right", scale: 2, blink: blinkK(dt), expr: cast.meExpr || undefined, mouth: talkingMe && tm }, lt);
      SK.drawChar(c, npcDef, 236, 196, { face: "left", scale: 2, blink: blinkN(dt), expr: cast.npcExpr || undefined, mouth: talkingNpc && tm }, { lx: -scene.light.lx, rim: scene.light.rim2 || scene.light.rim, shadow: 0, cast: false });
      c.drawImage(scene.near, 0, 0);
      floats.draw(c, dt);
    }
    draw(0);
    const setMeters = () => { mRep.set(st.rep); mVibe.set(st.vibe); };
    const voiceOf = who => who === "npc" ? SK.voiceOf(defFor(cast.npc), "#ffd27a") : who === "me" ? "#62e6ff" : "#8c84b8";
    const nameOf = who => who === "npc" ? (npcNames[cast.npc] || "???") : who === "me" ? myName : "";
    const speak = async (who, text, o = {}) => {
      cast.speaker = who === "me" || who === "npc" ? who : "";
      const t = tok(Array.isArray(text) ? SK.pick(text, rnd) : text);
      await say.say(nameOf(who), t, Object.assign({ color: voiceOf(who), pitch: who === "npc" ? 280 + (hashStr(cast.npc) % 120) : who === "me" ? 600 : 220, speed: who === "nar" ? 70 : 58, you: who === "me" }, o));
      cast.speaker = "";
    };
    const pause = (ms = 700) => S.wait(ms);
    const resolve = nx => typeof nx === "function" ? nx(st) : nx;
    let id = sc.start, beat = 0;
    while (id && id !== "END") {
      const node = sc.nodes[id];
      if (!node) break;
      if (node.cast && node.cast.npc) cast.npc = node.cast.npc; else cast.npc = sc.npc;
      cast.npcExpr = MOOD_EXPR[node.mood] || ""; cast.meExpr = "";
      beat++;
      roundEl.textContent = "BEAT " + Math.min(beat, 3) + "/3";
      for (const [who, text] of node.say) { await speak(who, text); await pause(650); }
      // choose (shuffled for replay variety)
      const order = SK.shuffle(node.ch.map((_, i) => i), rnd);
      const items = order.map(i => ({ text: tok(node.ch[i][0]) }));
      const pick = await SK.choices(S, chBox, items, { label: "Your response" });
      const ch = node.ch[order[pick.index]];
      pick.wrap.remove();
      const [ctext, eff, nx, reply, mood] = ch;
      const scale = diff >= 4 && (eff.r < 0 || eff.v < 0) ? 1.25 : diff <= 1 && (eff.r < 0 || eff.v < 0) ? 0.75 : 1;
      const dr = Math.round(eff.r * scale), dv = Math.round(eff.v * scale);
      cast.meExpr = eff.t === "weak" ? "worried" : (eff.t === "bold" || eff.t === "firm") ? "angry" : (eff.t === "wit" || eff.t === "joke") ? "happy" : "";
      await speak("me", ctext, { speed: 90 });
      st.rep = clamp(st.rep + dr, 0, 100); st.vibe = clamp(st.vibe + dv, 0, 100); if (eff.t) st.tags.push(eff.t); if (eff.f) st.f[eff.f] = true;
      setMeters();
      if (dr) floats.add((dr > 0 ? "+" : "") + dr, 52, 38, dr > 0 ? "#9be15d" : "#ff6a6a", { sc: 2, life: 1.5 });
      if (dv) floats.add((dv > 0 ? "+" : "") + dv, 268, 38, dv > 0 ? "#9be15d" : "#ff6a6a", { sc: 2, life: 1.5 });
      const good = dr + dv >= 10, bad = dr + dv < 0;
      RP.sfx(good ? "cheer" : bad ? "boo" : dr + dv >= 5 ? "ping" : "blip");
      cast.npcExpr = MOOD_EXPR[mood] || cast.npcExpr;
      await pause(300);
      if (reply) {
        if (reply.startsWith("~")) { await speak("nar", reply.slice(1)); }
        else await speak("npc", reply);
        await pause(700);
      }
      id = resolve(nx);
      if (id === "b3") id = st.f.kevin ? "b3k" : st.f.gus ? "b3a" : "b3b";
    }
    // ---------- payoff
    const sum = st.rep + st.vibe;
    const bias = sc.bias || 0;
    const outcome = sum >= 134 + bias + thrShift ? "legend" : sum >= 124 + bias + thrShift ? "win" : sum >= 112 + bias + Math.round(thrShift * 0.66) ? "draw" : "lose";
    const end = sc.endings[outcome];
    cast.npcExpr = outcome === "legend" || outcome === "lose" ? (outcome === "lose" ? "happy" : "surprised") : outcome === "win" ? "worried" : "";
    cast.meExpr = outcome === "lose" ? "sad" : "happy";
    RP.sfx(outcome === "lose" ? "fail" : outcome === "legend" ? "cheer" : "success");
    for (const [who, text] of end.lines) { await speak(who, text); await pause(850); }
    const score = clamp(Math.round((sum - bias - 78) * 1.6), 0, 100);
    const ok = outcome !== "lose";
    await S.wait(250);
    play.style.display = "none";
    const stamp = { w: 64, h: 24, k: 4, draw(g) { const col = outcome === "lose" ? "#ff6a6a" : outcome === "draw" ? "#ffc44d" : "#9be15d", w = outcome === "legend" ? "LEGEND" : outcome === "win" ? "YOU WIN" : outcome === "draw" ? "DRAW" : "OUCH"; R(g, 0, 0, 64, 24, "#0a0716"); R(g, 1, 1, 62, 22, col); R(g, 3, 3, 58, 18, "#0a0716"); txtC(g, w, 32, 8, col, 2, 2); } };
    await SK.endCard(S, wrap, { kicker: sc.title.toUpperCase(), title: end.title, lines: [tok(end.lines[end.lines.length - 1][1])], stats: [["REPUTATION", st.rep, st.rep >= 60 ? "ok" : st.rep < 40 ? "bad" : ""], ["VIBE", st.vibe, st.vibe >= 60 ? "ok" : st.vibe < 40 ? "bad" : ""]], score, ok, stamp, rank: outcome === "legend" ? "LEGEND" : outcome === "win" ? "SMOOTH" : outcome === "draw" ? "SURVIVED" : "BURNED" });
    return { ok, score, outcome, ending: outcome, scenario: scnKey, rep: st.rep, vibe: st.vibe, title: end.title };
  }
}
})();
