/* promoter.Talk — a dialogue duel in the promoter's back office. Insult-sword-fighting, but
   about getting booked. Each turn the promoter pushes back; you pick a line from a hand.
   Params (all optional): { promoter: "Vic", charId: <character id to draw>, ask: "a monthly" | "your fee",
     patience (turns of goodwill), difficulty 1..5, arcade }
   ask "your fee" (or anything with fee/negotiate/book) switches to NEGOTIATION mode: fee, flights, hotel,
   rider. "Exposure" offers must be refused.
   Result: { ok, score 0..100, deal }
     booking:      deal = { slot: "monthly" | "trial" | null, fee, night, party, promoter }
     negotiation:  deal = { fee (number, 0 = exposure), currency, flights, hotel, rider, exposure: bool, terms: {...text} }
   Never mutates RP.state. */
(function () {
"use strict";
const RP = window.RP;
const U = RP.u;
const { el, clamp, R, P, ell, mulberry, hashStr, ramp, txt, txtC, txtW } = U;
const K = ramp;

const CSS = `
.pt-deal { display: grid; grid-template-columns: 1fr; }
.pt-row { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 6px; padding: 3px 4px; border-bottom: 1px dashed #2d2456; font-size: 19px; line-height: 1.05; }
.pt-row .lb { color: var(--muted); font-size: 16px; letter-spacing: .08em; }
.pt-row.cur .lb { color: var(--pink); } .pt-row.cur { background: #1a1030; }
.pt-row.lock .vl { color: var(--ok); } .pt-row.lock .vl::after { content: " [locked]"; color: var(--muted); font-size: 15px; }
.pt-row.expo .vl { color: #ff6a6a; }
.pt-play { display: grid; gap: 10px; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto 1fr auto auto auto; grid-template-areas: "stage hud" "stage notes" "say say" "choices choices" "tip tip"; align-items: start; }
.pt-play.pt-neg { grid-template-rows: auto auto 1fr auto auto auto; grid-template-areas: "stage hud" "stage deal" "stage notes" "say say" "choices choices" "tip tip"; }
.pt-play > .sk-stage { grid-area: stage; margin: 0; } .pt-play > .sk-hud { grid-area: hud; } .pt-play > .pt-dealbox { grid-area: deal; } .pt-play > .pt-notes { grid-area: notes; }
.pt-play > .sk-say { grid-area: say; } .pt-play > .pt-choices { grid-area: choices; } .pt-play > .sk-tip { grid-area: tip; } .pt-play > .pt-brk { display: none; }
@media (max-width: 959px) { .pt-play, .pt-play.pt-neg { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-template-areas: "stage" "hud" "notes" "say" "choices" "tip"; } .pt-play.pt-neg { grid-template-areas: "stage" "hud" "deal" "notes" "say" "choices" "tip"; } .pt-play > .sk-stage { margin: 0 auto; } }
@media (max-height: 460px) and (min-width: 560px) {
  .pt-play { display: flex; flex-direction: column; flex-wrap: wrap; align-content: flex-start; gap: 6px 8px; height: calc(100vh - 56px); }
  .pt-play > * { grid-area: auto; box-sizing: border-box; }
  .pt-play > .sk-stage { order: 1; width: 330px; } .pt-play > .pt-dealbox { order: 2; width: 330px; } .pt-play > .pt-notes { order: 3; width: 330px; }
  .pt-play > .pt-brk { display: block; order: 4; flex: 0 0 100%; width: 0; }
  .pt-play > .sk-hud { order: 5; width: calc(100% - 346px); } .pt-play > .sk-say { order: 6; width: calc(100% - 346px); } .pt-play > .pt-choices { order: 7; width: calc(100% - 346px); } .pt-play > .sk-tip { order: 8; }
  .pt-deal { grid-template-columns: 1fr 1fr; column-gap: 8px; } .pt-row { grid-template-columns: 1fr; gap: 0; font-size: 17px; padding: 1px 4px; } .pt-row .lb { font-size: 13px; } .pt-row.lock .vl::after { content: " *"; }
}
.pt-peek { margin-top: 6px; }
.pt-hide { display: none; }
`;
let cssDone = false;

/* ------------------------------------------------------------------------------------------ cast */
const VIC = { name: "Vic", height: 98, build: "stocky", skin: "#c98a62", hair: { style: "buzz", color: "#2e1d16" }, facial: "stubble", facialColor: "#2e1d16",
  top: { style: "bomber", color: "#3d2a1e", color2: "#c8925a" }, bottom: { style: "pants", color: "#1c1a24" }, shoes: { style: "boots", color: "#2a1a12" }, acc: ["lanyard", "glasses"], glassesColor: "#c8925a", voice: "#ffd27a" };
const PARTIES = ["Basement Tapes", "Sunday School", "Low Ceiling", "The Understudy", "Halle Neun", "Late Fee", "Pipe Dream"];
const GRUDGES = ["Dante", "Eddie Two-Times"];
const FANS = ["Twinkie", "Marcus", "Kosmo Delacroix"];
const NEUTRAL = ["Ray", "Lou"];
const DOGS = ["Biscuit", "Pretzel", "Meatball", "Waffles"];

/* party facts: the dossier. truth = a line that uses the fact correctly, lie = a confident mix-up. */
const FACTS = [
  { id: "vinyl", note: "Vinyl only after midnight.", truth: "Vinyl only after midnight, right? I'll bring the heavy crate.", lie: "CDJs only after midnight, right? I'll bring a USB and a dream." },
  { id: "genre", note: "House and garage. Zero EDM.", truth: "House and garage, no EDM. Finally, a room with a spine.", lie: "Big-room EDM, right? I've got a drop that rattles fillings." },
  { id: "peak", note: "Peak hour is 3 AM.", truth: "Peak at 3 AM. That's when the real ones are still standing.", lie: "Peak at 8 PM, right? Dinner crowd. Early set. Cozy." },
  { id: "dog", note: "The dog, {dog}, works the door.", truth: "How's {dog}? Still running the door?", lie: "Still got that parrot on the door? The one with the opinions?" },
  { id: "phones", note: "No phones on the floor. Camera stickers.", truth: "No phones on the floor. I respect that. Nobody films a bad transition.", lie: "Everybody films everything there, right? Great for my clips." },
  { id: "anniv", note: "Two-year anniversary is in March.", truth: "I heard the two-year anniversary is in March. I want that night.", lie: "Five-year anniversary in June, right? I'll bring fireworks." },
  { id: "pa", note: "The PA is a rebuilt church speaker stack.", truth: "The church speaker stack. I'll tune the bass for it. Gospel house, baby.", lie: "That new laser rig you installed, right? I love a laser." },
  { id: "bar", note: "Bartender Dolores pours 'The Landlord'.", truth: "Is Dolores still pouring The Landlord? I'm having two.", lie: "Is the bartender still the guy with the mohawk? Great guy." },
  { id: "sat", note: "Last Saturday of every month.", truth: "Last Saturday of the month. I've already blocked my calendar.", lie: "Every Thursday, right? I love a Thursday." },
  { id: "flyers", note: "Hand-drawn flyers. No logos. Ever.", truth: "Hand-drawn flyers, no logos. I'll draw mine badly. It'll fit in.", lie: "Love the new logo, by the way. Very glossy." }
];

/* ------------------------------------------------------------------------------------------ writing */
const CAT = {
  conf: ["CONFIDENT", "t-conf"], desp: ["DESPERATE", "t-desp"], name: ["NAME-DROP", "t-name"],
  joke: ["JOKE", "t-joke"], know: ["HOMEWORK", "t-know"], num: ["NUMBERS", "t-num"]
};
const CATS = ["conf", "desp", "name", "joke", "know", "num"];

const OPENERS = {
  who: { q: { conf: 1, desp: -3, name: 1, joke: 1, know: 2, num: 3 },
    pro: ["Sorry, remind me who you are?", "{mangled}, right? Great name. Terrible spelling. Who are you?", "Have we met? You look like a guy who has a link."],
    conf: ["I'm {name}. By Saturday you'll be telling people you discovered me.", "I'm the DJ you didn't know you were out of."],
    desp: ["I'm... nobody yet. Please. I haven't eaten since Tuesday.", "I'm {name}. I'll play for free. For food. For a sandwich. A small sandwich."],
    name: ["{who} sent me. Said you'd know me. Said it twice.", "I came through {who}. You can ask. Actually, please don't ask."],
    joke: ["I'm the DJ equivalent of a spare key. Under the mat. You'll need me eventually.", "I'm {name}. Think of me as a fire extinguisher. Red, loud, and you hope you never need me."],
    num: ["I'm {name}. {fol} followers. Real ones. Mostly real. A few are bots, but they dance.", "R|I'm {name}, proud owner of {rec} records. Heavy ones. My back is a statistic."] },
  full: { q: { conf: 0, desp: -3, name: 2, joke: 2, know: 3, num: 1 },
    pro: ["We're booked through the spring. Maybe summer. Maybe never.", "The calendar's full. I have a waitlist. The waitlist has a waitlist.", "I'd love to, but I've got more DJs than Saturdays."],
    conf: ["Then someone's about to get bumped. Politely. By me.", "Book me anyway. I'm the one you'll be glad you didn't skip."],
    desp: ["Even the 5 AM slot? The cleanup slot? I'll sweep! I own a broom!", "I'll sleep on the stage. I'll be furniture. Just put me somewhere."],
    name: ["{who} said there's always room for one more. {who} says a lot of things.", "{who} said you had a hole in the calendar. They were very specific."],
    joke: ["Booked through spring? I'm not a DJ, I'm a Saturday. You can't book me, you can only wait for me.", "Full? Perfect. I'll play in the gaps between the sets. Nobody will notice. Many have tried."],
    num: ["I'll fill a gap with {fol} followers. Gaps are my specialty.", "R|{rec} records and one open Saturday. We were made for each other."] },
  draw: { q: { conf: 0, desp: -3, name: 1, joke: 1, know: 1, num: 3 },
    pro: ["What's your draw? How many people do you actually bring?", "How many people follow you? Real people. Not bots. Not your mother.", "Numbers. I need numbers. How many humans show up when you play?"],
    conf: ["Enough. Count the line at the door after I post.", "More than you need. Fewer than I deserve."],
    desp: ["My mom, my cousin, and a lady from the laundromat. She's got a car!", "I'll bring everyone I know! It's four people! One is a dog!"],
    name: ["{who} can vouch for me. {who} will say 'who?' first, but then vouch.", "{who} saw my last set. They didn't leave. They were also stuck, but still."],
    joke: ["My draw? I'm a magnet. People stick to me. It's a medical condition.", "I bring exactly who you want. And one guy named Gary. Nobody invited Gary."],
    num: ["{fol} followers. I can fill a room, a floor, or at least a corner with good lighting.", "R|I own {rec} records. People come for records. Some for me. Mostly records."] },
  pay: { q: { conf: 3, desp: -4, name: 0, joke: 1, know: 1, num: 2 },
    pro: ["The slot pays in exposure and one drink ticket.", "Door split. After costs. And there are always costs.", "We pay in 'good vibes' and a free coat check."],
    conf: ["I don't do exposure. I do rent. Rent doesn't take exposure.", "Exposure doesn't pay rent. A fee does. Let's talk a number."],
    desp: ["Exposure's great! I love exposure! I'll take two!", "The drink ticket is plenty! I'm not even thirsty! I'm just happy to be here!"],
    name: ["{who} would never do that to a DJ. {who} has very strong feelings.", "I told {who} you'd be fair. Don't make me a liar."],
    joke: ["Exposure? I've been exposed. It's cold. Mostly legal trouble.", "Good vibes? Great. I'll pay my landlord in vibes. He's famously mellow."],
    num: ["{fol} followers will see it. I'm the one providing the exposure. Me.", "R|{rec} records on my back and you want to pay me in vibes? The records have a union."] },
  vibe: { q: { conf: 1, desp: -2, name: 0, joke: 2, know: 3, num: 0 },
    pro: ["What do you even play?", "What's your sound? Three words. Don't say 'eclectic.'", "Describe your sound. Quickly. I have a pierogi getting cold."],
    conf: ["Dancefloor first, no filler, never boring. I don't play records, I play rooms.", "I play whatever the room's missing. Usually it's bass. Sometimes it's a different DJ."],
    desp: ["Whatever you want! Name a genre, I'll become it!", "I can play anything! I'm a blank wall! Paint me!"],
    name: ["{who} calls it 'a proper night out.' They said that. In the street. To me.", "{who} says if I played for you, you'd finally smile."],
    joke: ["Three words? 'Please book me.' That's four. Damn.", "Eclectic. Sorry. Reflex. I'll go sit in the hallway."],
    num: ["{fol} people follow what I play. I'd call it... popular.", "R|I've got {rec} records and no filler. I counted. It took a weekend."] },
  trial: { q: { conf: 2, desp: -3, name: 2, joke: 0, know: 3, num: 2 },
    pro: ["Why should I gamble on you?", "Why you? Why not the forty other emails?", "Give me one reason. A good one. I'll wait. Not long."],
    conf: ["Because I'll make you look smart. Booking me is the smartest thing you'll do this month.", "Because I show up early, play hard, and leave the room better than I found it. Ask around."],
    desp: ["Because I have nowhere else! Please! I need this!", "Because if I don't get this I'm back at the temp agency. Brenda is waiting. Brenda knows."],
    name: ["{who} says you take chances on people. That's the whole brand.", "Ask {who}. They said I was 'a risk worth taking.' Or 'a risk.' It was loud."],
    joke: ["Because the other forty don't have my charm. Or my cable collection.", "It's not a gamble. It's a sure thing with a small chance of feedback."],
    num: ["{fol} followers say I'm not a gamble. They also say 'where's the next one?'", "R|{rec} records and a pulse. That's two things more than most of your forty emails."] },
  stall: { q: { conf: 2, desp: -2, name: 1, joke: 2, know: 1, num: 1 },
    pro: ["Send me a link.", "Email my assistant.", "DM me. Actually, don't."],
    conf: ["No link. I'm right here and so is the Saturday. Let's do it now.", "I don't do links, I do rooms. You're in one. Let's talk dates."],
    desp: ["I'll send twelve links! A link a day! My whole life in links!", "I'll email your assistant every day! Does your assistant like snacks?"],
    name: ["{who} said you'd say that. They said I should say 'I'm already here.' So: I'm already here.", "{who} said you'd say that. They were laughing. A lot."],
    joke: ["Here's my link. (Hold up hand.) It's a hand. It's a hand link.", "Your assistant? Is that the guy asleep on the couch? He's never replied to anyone."],
    num: ["The link is {fol} followers long. You might as well do it in person.", "R|The link is {rec} records in my bag. It's a very heavy link."] },
  phone: { q: { conf: 1, desp: -2, name: 0, joke: 3, know: 1, num: 0 },
    pro: ["Hang on, I have to take this.", "One sec. It's the landlord. Or the cops. Same ring.", "Hold on. (into phone) Yes. No. Yes. Don't touch the speaker."],
    conf: ["[Say nothing. Nod at the poster. Let the silence work.]", "Take your time. I'll stand here looking like a headliner."],
    desp: ["Take your time! I have nowhere to be! Ever! Forever!", "No rush! I'll wait! I'll sit on the floor! Do you have water?"],
    name: ["Is that {who}? Tell them I said hi. They'll say 'who.' But hi.", "If it's {who}, tell them I'm here. They'll pretend not to know me."],
    joke: ["Take your time. I'll just stand here and become furniture.", "Is it a gig? A better gig? A gig for me? (It never is. I'm just asking.)"],
    num: ["[Silently hold up your phone: {fol} followers. Let him look.]", "R|[Tap your bag. {rec} records. Clink. He'll look.]"] },
  nextweek: { q: { conf: 4, desp: -3, name: 0, joke: 1, know: 1, num: 1 }, counter: true,
    pro: ["I like you. Check back next week.", "Love it. Let's circle back next week.", "Tell you what. Hit me up next week. Seriously. Next week."],
    conf: ["Next week? Perfect. Put me on next week's bill. I'll check back with my fee.", "Great. Next week works. I play next week, you pay me next week. Shake on it.", "'Next week.' Sure. Then next week I'm on your stage and you owe me next week's fee."],
    desp: ["Next week! Sure! I'll wait! I'll wait outside! Forever!", "Next week! Great! And the week after! I'll be your assistant!"],
    name: ["{who} said you'd say 'next week.' They told me to say 'this week.'", "{who} says 'next week' never comes. They're usually right."],
    joke: ["Next week? Sure. I'll book a flight to Next Week. Is it nice there?", "Next week is my favorite week. I have nothing in it. Literally nothing."],
    num: ["Next week I'll have more than {fol} followers. This week I have {fol}. Don't blame me for growth.", "R|Next week I'll have {rec} records. This week I also have {rec}. You're welcome to count."] }
};

const REACT = {
  great: ["Okay. Okay! Now we're talking.", "Huh. You're not terrible.", "I hate that that worked.", "Write that down. Somebody write that down.", "Where have you been all my Saturdays?", "Fine. You have my attention. Don't waste it."],
  good: ["That's... not nothing.", "Keep going. I'm listening. Mostly.", "Mm. Okay. A point for you.", "I've heard worse. Today. Twice.", "I'll allow it.", "Not bad. Not good. Not bad."],
  ok: ["Sure. Fine. Whatever.", "That's a thing people say.", "Uh huh.", "I'm mildly interested. Mildly.", "Okay. I guess.", "Sure. That's... a sentence."],
  meh: ["Wow. Riveting.", "I've heard that one. From everyone.", "Is that supposed to impress me?", "Cool story. Next.", "Yeah. No. Sure.", "My coffee has more charm."],
  bad: ["Oof.", "That landed like a dropped needle.", "Yeah, no. Try again.", "My assistant just quit. That's how bad.", "Do you hear yourself? I do. I can't stop.", "I felt that in my teeth."],
  awful: ["Did you really just say that?", "I need you to un-say that.", "I've seen better pitches at a Port Authority bus stop.", "Somewhere a promoter just lost a little faith.", "That's the worst thing I've heard today. And I took a call from my ex.", "Wow. Okay. Wow."]
};
const R_DESP = ["I can't tell if that's a pitch or a cry for help.", "Are you okay? Do you need a sandwich? I can get you a sandwich.", "I can smell the rent from here.", "Whoa, whoa. Sit down. Breathe. Don't beg in my office. It voids the lease.", "That's not a pitch, that's a hostage note."];
const R_GRUDGE = ["{who}?! {who} owes me four hundred dollars and a speaker cable!", "Don't say that name in here. The plant just wilted.", "You know {who}? Then you know why I'm lowering the bar.", "{who}. You said {who}. In my office. On purpose."];
const R_FAN = ["{who}? You know {who}? Small city.", "You know {who}? Say hi from me. Don't say it too loud.", "{who} vouched for you? ...Okay. That's worth something."];
const R_LIE = ["No. That's not right. Did you even look at the flyer?", "That's... wrong. Completely. Did you mix me up with another promoter?", "Wow. You really thought that. Out loud. Confidently.", "Wrong party, pal. Different Vic, different night."];
const R_LOWNUM = ["That's... a number. It's definitely a number.", "I have more followers than that. I have a flip phone.", "Huh. I've seen bigger crowds at a bus stop.", "I respect the honesty. I do not respect the number."];
const R_REPEAT = ["You said that already. Do you have a second line?", "Same bit twice? I was hoping for range.", "Still the same trick. Still the same trick."];
const R_NEXTWEEK = ["...Ugh. Okay. That's actually good. Annoying. But good.", "Did you just 'next week' me? In MY office?", "You flipped my own line. I'm angry and a little impressed.", "Damn. I've been saying 'next week' for nine years. Nobody's ever flipped it."];
const R_JOKE = ["Ha! Okay. That's good. Don't do it again.", "(snorts) Don't tell anyone I laughed.", "Okay, that one was funny. I hate that."];

const TERMS = {
  fee: { label: "FEE", w: 0.5, need: "{c}900", init: 0, nums: [0, 150, 350, 600, 900],
    intro: ["Let's talk fee. We have a budget. It is... theoretical.", "On the fee: we love you. So much we'll pay you in love.", "The fee. Right. My favorite subject: other people's."],
    rungs: [["Exposure", "The fee is exposure. Thousands will see you. It's free!"], ["{c}150", "{c}150 and a drink ticket. That's my budget and my lunch."], ["{c}350", "{c}350. I have to skip a vacation for that."], ["{c}600", "{c}600. Final offer. Practically a donation."], ["{c}900", "{c}900. You drive a hard bargain. I respect it. I hate it."]],
    conf: ["My fee is {c}900. That's the number.", "I don't play for exposure. I play for money. It's a whole thing."],
    desp: ["Exposure sounds great! I love exposure! I'm exposed all the time!", "Pay me whatever! In sandwiches! In IOUs! In hugs!"],
    joke: ["Exposure? I've been exposed. It's cold. It's mostly legal trouble.", "Great, I'll pay my rent in exposure. My landlord loves it. He's a tough sell, but he likes it."] },
  flights: { label: "FLIGHTS", w: 0.15, need: "a direct flight", init: 1, nums: [0, 1, 2, 3], keys: ["none", "economy", "economy-direct", "business"],
    intro: ["Flights. Also a thing we have to discuss.", "Okay, travel. This is where I get creative."],
    rungs: [["Make your own way", "We don't cover flights. You'll make your own way. Ever hear of a boat?"], ["Economy, 2 layovers", "Economy. Two layovers. One is nine hours in a place with a lot of fog."], ["Economy, direct", "Economy, direct. Aisle seat. Probably."], ["Business class", "Business class. Don't tell my accountant."]],
    conf: ["Direct flight. I carry vinyl. I need to land with my hands, not my knees.", "I fly direct, or I don't fly. My records get airsick."],
    desp: ["I'll swim! I'm a strong swimmer! Mostly!", "I'll sleep at the airport! I've done it before! It was fine!"],
    joke: ["A boat? Sure. Can the boat do 128 BPM?", "Two layovers? I'll DJ the baggage claim. They'll love me."] },
  hotel: { label: "HOTEL", w: 0.15, need: "a real room", init: 0, nums: [0, 1, 2, 3], keys: ["couch", "hostel", "room", "nice"],
    intro: ["Hotel. I have so many options. Most of them are bad.", "Now, where you'll sleep. Sleep is a luxury."],
    rungs: [["A cousin's couch", "My cousin has a couch. And a cat. The cat has opinions."], ["Hostel dorm", "A hostel. 12-bed dorm. Very social."], ["A real room", "A real room. Own door. Window optional."], ["The nice hotel", "The nice hotel. With the breakfast. The good breakfast."]],
    conf: ["I need a real room with a door. I play loud, I can't sleep next to eleven strangers.", "A real hotel. My back is made of records. It needs a mattress."],
    desp: ["The couch is great! I love cats! The cat and I are best friends already!", "I'll sleep in the booth! I'm very flexible! I'm also very tired!"],
    joke: ["A cat with opinions? Good. I need a roommate who judges me.", "Twelve beds? That's a quarter of an audience. I'll do a set."] },
  rider: { label: "RIDER", w: 0.1, need: "a proper rider", init: 1, nums: [0, 1, 2, 3], keys: ["water", "sandwich", "hot-meal", "full"],
    intro: ["The rider. Our favorite part. We have a rider.", "Rider time. Please be reasonable. I beg you."],
    rungs: [["Tap water", "Tap water. In a mug. A nice mug."], ["Water + sandwich", "Water and a sandwich. Cheese. Maybe."], ["Water, towels, hot meal", "Water, towels, one hot meal. Real food."], ["The full rider", "The full rider. Ginger tea, towels, hot meal, and a chair that's yours."]],
    conf: ["Ginger tea, towels, a hot meal. It's not a diva thing, it's a throat thing.", "A hot meal and a chair. I'll be on my feet for three hours. Be nice."],
    desp: ["The mug is perfect! Water is life! I'm not even thirsty!", "No rider! I'll bring my own! I always do! It's a sad sandwich!"],
    joke: ["A nice mug? Does it have a motto? 'World's Okayest Promoter'?", "Cheese. Maybe. I've been living on 'maybe.'"] }
};
const NEG_SHARED = {
  name: ["{who} always says: ask for {need}. So I'm asking for {need}.", "{who} got {need} here. I'm not asking for more than {who}. Just the same."],
  num: ["{fol} followers. {need} isn't a favor, it's math.", "With {fol} followers behind me, {need} is a bargain."]
};

/* ------------------------------------------------------------------------------------------ painting */
const PT = () => RP.social.P;
function paintOffice(party, pname, seed, drawCal) {
  const SK = RP.social, T = SK.P;
  const W = 320, H = 160;
  const far = U.mk(W, H), near = U.mk(W, H);
  let c = far.getContext("2d");
  const r = mulberry(seed);
  // plum brick wall + ceiling pipe
  T.brick(c, 0, 0, W, 118, "#4a2440", seed + 1);
  T.shade(c, 0, 0, W, 118, (x, y) => Math.max(0, (1 - y / 42) * 0.85, Math.abs(x - 190) > 150 ? (Math.abs(x - 190) - 150) / 90 : 0), "#0a0414", 0.7);
  R(c, 0, 5, W, 5, "#3a3550"); R(c, 0, 5, W, 1, "#8a86a0"); R(c, 0, 9, W, 1, "#1a1630"); for (let x = 20; x < W; x += 70) { R(c, x, 4, 3, 7, "#5a5670"); R(c, x, 4, 3, 1, "#a8a4c0"); }
  // window
  T.cityWindow(c, 236, 22, 62, 56, seed + 3, { tower: 38, moon: [48, 12] });
  T.glassFrame(c, 236, 22, 62, 56, "#2a1c3a", 2);
  R(c, 231, 80, 72, 4, "#3a2a4e"); R(c, 231, 80, 72, 1, "#6a5a86");
  // neon sign: party name
  const sc = txtW(party.toUpperCase(), 2, 2) <= 150 ? 2 : 1;
  T.neon(c, party.toUpperCase(), 118, 20, "#ff3fa4", sc);
  T.neon(c, "NO REFUNDS", 118, 40, "#39d0ff", 1, { glow: false });
  // posters + calendar
  T.poster(c, 12, 46, 20, 28, seed + 11, "LIVE");
  T.poster(c, 146, 52, 18, 26, seed + 13, "", { torn: true });
  // wall calendar with NEXT WEEK circled in red
  R(c, 80, 52, 40, 34, "#1c1030"); R(c, 81, 53, 38, 8, "#c0302c"); txtC(c, "NEXT", 100, 55, "#ffd6d6", 1, 1);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) R(c, 83 + i * 5, 64 + j * 5, 3, 3, (i === 2 && j === 3) ? "#ff3f3f" : "#8c84b8");
  ell(c, 98, 79, 4, 3, "#ff3f3f"); ell(c, 98, 79, 3, 2, "#1c1030");
  P(c, 98, 79, "#ff3f3f");
  // record crate on the floor behind the desk (peeks above desk edge)
  R(c, 4, 96, 40, 22, "#4a2e1c"); R(c, 4, 96, 40, 2, "#8a6038"); R(c, 4, 116, 40, 2, "#2a1a10");
  for (let i = 0; i < 9; i++) { const col = ["#ff3fa4", "#39d0ff", "#ffc44d", "#9be15d", "#7a3fb0", "#efeaf6", "#e07a2a"][r() * 7 | 0]; R(c, 6 + i * 4, 86 + (r() * 4 | 0), 3, 14, col); R(c, 6 + i * 4, 86, 3, 1, K(col)[4]); }
  // banker's lamp on the far desk corner
  R(c, 303, 100, 2, 14, "#2a2a38"); ell(c, 304, 114, 5, 2, "#1c1a26");
  U.poly(c, [[294, 99], [314, 99], [311, 91], [297, 91]], "#2f8a5a"); R(c, 297, 91, 14, 1, "#7ad8a0"); R(c, 294, 98, 20, 1, "#14402c");
  // sign spill
  T.glow(c, 118, 28, 80, 30, "#ff3fa4", 0.6, 0.2);
  T.glow(c, 268, 50, 50, 40, "#6e60c8", 0.5, 0.18);
  T.glow(c, 304, 104, 30, 22, "#ffc44d", 0.9, 0.3);
  // ---------- near layer: desk top
  c = near.getContext("2d");
  const k = K("#7a4a2a");
  let y = 112, i = 0;
  const hs = [3, 3, 4, 4, 5, 5, 6, 6, 7, 8];
  while (y < H) {
    const h = hs[Math.min(i, hs.length - 1)];
    R(c, 0, y, W, h, k[2 - (i % 2)]); R(c, 0, y, W, 1, k[3]); R(c, 0, y + h - 1, W, 1, k[1]);
    for (let g = 0; g < 5; g++) R(c, r() * W | 0, y + 1 + (r() * Math.max(1, h - 2) | 0), 4 + (r() * 14 | 0), 1, k[1]);
    for (let x = ((i * 53) % 90); x < W; x += 90 + (r() * 60 | 0)) R(c, x, y, 1, h, k[0]);
    y += h; i++;
  }
  R(c, 0, 110, W, 2, "#1a0e18"); T.glow(c, 120, 114, 90, 6, "#ff3fa4", 0.8, 0.25);
  T.glow(c, 215, 134, 70, 22, "#ffb04a", 0.55, 0.22);
  // laptop back
  R(c, 213, 108, 44, 24, "#1c1a24"); R(c, 213, 108, 44, 1, "#6a6890"); R(c, 213, 131, 44, 2, "#0a0814"); R(c, 213, 108, 1, 24, "#3a3850");
  ell(c, 235, 120, 4, 4, "#ffc44d"); ell(c, 235, 120, 2, 2, "#c0302c"); P(c, 236, 119, "#fff6d6");
  R(c, 220, 125, 10, 2, "#39d0ff"); R(c, 242, 114, 8, 2, "#9be15d");
  // mug
  R(c, 266, 122, 11, 11, "#efeaf6"); R(c, 266, 122, 11, 1, "#fff"); R(c, 266, 132, 11, 1, "#8a86a0"); R(c, 277, 125, 3, 5, "#efeaf6"); R(c, 278, 126, 1, 3, "#7a4a2a");
  R(c, 266, 123, 11, 2, "#6a3a28"); txt(c, "OK", 268, 127, "#c0302c", 1, 1);
  for (let s = 0; s < 3; s++) P(c, 270 + s * 2, 118 - s, "#8a86a0");
  // phone
  R(c, 118, 122, 24, 10, "#15131f"); R(c, 118, 122, 24, 1, "#4a4868"); R(c, 120, 118, 20, 4, "#1c1a2a"); R(c, 120, 118, 20, 1, "#6a6890"); R(c, 128, 124, 4, 4, "#8a86a0"); P(c, 129, 125, "#ffc44d");
  // papers
  for (let n = 0; n < 3; n++) { R(c, 148 + n * 2, 133 - n, 26, 15, n === 2 ? "#efeaf6" : "#d0c8e0"); R(c, 148 + n * 2, 133 - n, 26, 1, "#fff"); }
  for (let n = 0; n < 4; n++) R(c, 151, 136 + n * 2, 18 - (n % 2) * 5, 1, "#8c84b8");
  txt(c, "OVERDUE", 150, 134, "#c0302c", 1, 1);
  // nameplate
  const np = pname.toUpperCase().slice(0, 12), npw = Math.max(30, txtW(np, 1, 1) + 10), nx = 188 - (npw >> 1);
  R(c, nx, 146, npw, 11, "#b8924a"); R(c, nx, 146, npw, 1, "#f0d898"); R(c, nx, 156, npw, 1, "#6a4a1c"); R(c, nx + 1, 147, npw - 2, 1, "#d8b868");
  txtC(c, np, 188, 149, "#3a2a10", 1, 1); R(c, 188 - (txtW(np, 1, 1) >> 1) - 1, 148, 1, 1, "#d8b868");
  return { far, near };
}

/* ------------------------------------------------------------------------------------------ the game */
RP.mg.register("promoterTalk", {
  title: "promoter.Talk", order: 11,
  desc: "A dialogue duel. Get booked without begging. Know their party. Beat 'next week'.",
  auto(p) {
    const neg = /fee|negotiat|rider|book/i.test(String(p && p.ask || ""));
    if (neg) return { ok: true, score: 78, deal: { fee: 600, currency: "€", flights: "economy-direct", hotel: "room", rider: "hot-meal", exposure: false } };
    return { ok: true, score: 80, deal: { slot: "monthly", fee: 150, night: "last Saturday of the month", party: "Basement Tapes", promoter: (p && p.promoter) || "Vic" } };
  },
  async play(host, p) {
    const SK = RP.social;
    if (!SK) return { ok: false, score: 0, deal: null, error: "socialkit_lib missing" };
    try { return await run(host, p || {}, SK); }
    catch (e) { console.error("promoterTalk", e); return { ok: false, score: 0, deal: null, error: String(e) }; }
  }
});

async function run(host, p, SK) {
  if (!cssDone) { el("style", { text: CSS }, document.head); cssDone = true; }
  SK.css();
  const S = SK.session(host), root = host.root;
  try { host.ov.classList.add("sk-g"); } catch (e) { /* ignore */ }
  const diff = clamp(Math.round(p.difficulty || 2), 1, 5);
  const pname = String(p.promoter || "Vic");
  const ask = String(p.ask || "a monthly");
  const neg = /fee|negotiat|rider|book/i.test(ask);
  const rnd = Math.random;
  const seed = hashStr(pname.toLowerCase()) % 100000;
  const R2 = mulberry(seed);
  const isVic = /^vic$/i.test(pname);

  // ---- cast
  let proDef = null;
  if (p.charId) proDef = SK.charDef(p.charId);
  if (!proDef) {
    if (isVic) proDef = RP.chars.define("sk_vic", VIC);
    else { const d = RP.chars.random(seed + 31, { name: pname }); d.id = "sk_promo_" + seed; d.voice = "#ffd27a"; d.height = 98; proDef = RP.chars.define(d.id, d); }
  }
  const kidDef = SK.charDef("kid");
  const party = String(p.party || p.venue || (neg ? "Halle Neun" : isVic ? "Basement Tapes" : PARTIES[seed % PARTIES.length]));
  const voice = SK.voiceOf(proDef, "#ffd27a");
  const prof = { grudge: GRUDGES[seed % 2], fan: FANS[(seed >> 1) % FANS.length], dog: DOGS[seed % DOGS.length] };
  if (isVic) { prof.grudge = "Dante"; prof.fan = "Twinkie"; prof.dog = "Biscuit"; }
  const myName = SK.djName();
  const fol = SK.followers(p);
  const recCount = (RP.state && RP.state.records && RP.state.records.length) || (p.arcade ? 24 : 0);
  const recN = recCount || (p.arcade ? 24 : 3);
  const cur = String(p.currency || (neg ? "€" : "$"));
  const V = { name: myName, fol: SK.fmtNum(fol), rec: recN, party, pro: pname, dog: prof.dog, c: cur, ask, mangled: SK.mangle(myName, rnd) };
  const fmt = s => SK.fmt(s, V);

  // ---- dossier
  const facts = SK.shuffle(FACTS, rnd).slice(0, 3).map(f => ({ id: f.id, note: fmt(SK.fmt(f.note, { dog: prof.dog })), truth: SK.fmt(f.truth, { dog: prof.dog }), lie: SK.fmt(f.lie, { dog: prof.dog }), used: 0 }));
  const notes = facts.map(f => f.note).concat(["Do NOT mention " + prof.grudge + ". Long story. A speaker cable.", "Loves " + prof.fan + ". Everybody does."]);

  // ---- DOM
  const head = host.header("promoter.Talk", neg ? "Negotiation · " + pname : p.arcade ? "Arcade · " + pname : "Booking · " + pname);
  head.classList.add("sk-head");
  let leaveRes = null;
  const leaveP = new Promise(res => { leaveRes = res; });
  SK.leave(host, head, S, () => leaveRes({ ok: false, score: 0, deal: null, left: true }));
  const wrap = el("div", { cls: "sk-wrap" }, root);
  return Promise.race([leaveP, flow()]);

  async function flow() {
  const lightPro0 = { lx: -0.4, rim: { color: "#ff3fa4", side: -1 } };
  SK.warmQueue(S, SK.headJobs(proDef, "front", lightPro0, null, ["phone"]).concat(SK.headJobs(kidDef || proDef, "back", { lx: 0.35, rim: { color: "#ff3fa4", side: 1 } }, [""])), 40);
  await SK.intro(S, wrap, {
    kicker: neg ? "ACT IV \u00B7 THE BOOKING" : "THE BACK OFFICE",
    title: neg ? "Don't get lowballed" : "Get booked. Don't beg.",
    lead: neg ? pname + " at " + party + " has an offer. It is, to put it kindly, insulting." : pname + " runs " + party + ". You want " + ask + ". He wants you to go away.",
    steps: neg ? [
      "Four terms are on the table: <b>FEE, FLIGHTS, HOTEL, RIDER</b>. Push each one up, or <b>LOCK IT</b> to take the offer.",
      "<b>Exposure is not a fee.</b> Never accept it. The fee counts most.",
      "<b>LEVERAGE</b> is how much they want you: confident pushes work when it is high. Jokes and homework raise it; begging ruins it.",
      "Every turn costs <b>PATIENCE</b>. When it runs out, he takes what is left on the table."
    ] : [
      "Each turn " + pname + " pushes back. Pick a line (click, or press <b>1</b>\u2013<b>5</b>). Different pushbacks need different lines.",
      "Fill <b>INTEREST</b> to 100 for the deal. Every turn costs <b>PATIENCE</b>; bad lines cost more.",
      "<b>DESPERATE</b> lines tank interest. <b>HOMEWORK</b> lines win, but only if they match your notes. A mix-up is a disaster.",
      "Don't name-drop the wrong person. And if he says <b>next week</b>... flip it."
    ],
    pill: "DIFFICULTY " + diff,
    extra: box => { const n = el("div", { cls: "sk-note" }, box); el("h3", { text: neg ? "WHAT MARCUS DUG UP ABOUT " + party.toUpperCase() : "YOUR HOMEWORK ON " + party.toUpperCase() }, n); const ul = el("ul", {}, n); notes.forEach(t => el("li", { text: t }, ul)); },
    button: "START"
  });
  const play = el("div", { cls: "pt-play" + (neg ? " pt-neg" : "") }, wrap);
  const grid = play, side = play;
  const stageApi = SK.canvas(play, 320, 160, 2);
  const hud = el("div", { cls: "sk-hud" }, side);
  const startPat = clamp(Math.round(p.patience || (neg ? [12, 11, 10, 9, 8] : [9, 8, 7, 7, 6])[diff - 1]), 3, 20);
  const startInt = neg ? [45, 40, 35, 30, 25][diff - 1] : [35, 30, 25, 20, 15][diff - 1];
  const mPat = SK.meter(hud, { label: "PATIENCE", color: "#ffc44d", pips: startPat, value: startPat });
  const mInt = SK.meter(hud, { label: neg ? "LEVERAGE" : "INTEREST", color: "#ff3fa4", max: 100, value: startInt, marks: neg ? [60] : [55] });
  const dealRows = {};
  let peeked = true, notesApi = null;
  if (neg) {
    const dealBox = el("div", { cls: "sk-note pt-dealbox" }, side);
    el("h3", { text: "THE OFFER \u2014 " + party.toUpperCase() }, dealBox);
    const t = el("div", { cls: "pt-deal" }, dealBox);
    ["fee", "flights", "hotel", "rider"].forEach(id => { const tr = el("div", { cls: "pt-row" }, t); el("span", { cls: "lb", text: TERMS[id].label }, tr); const td = el("span", { cls: "vl", text: "-" }, tr); dealRows[id] = { tr, td }; });
  }
  notesApi = SK.noteBox(side, neg ? "WHAT YOU KNOW" : "NOTES ON " + party.toUpperCase(), notes);
  notesApi.box.classList.add("pt-notes");
  el("div", { cls: "pt-brk" }, play);
  if (diff >= 4 && !neg) {
    peeked = false; notesApi.set(false);
    const pk = el("button", { cls: "kbtn pt-peek", type: "button", text: "CHECK NOTES (-1 PATIENCE) [N]" }, notesApi.box);
    notesApi.box.querySelector(".sk-tg").style.display = "none"; notesApi.box.querySelector("h3").style.marginBottom = "0";
    const peek = () => { if (peeked || S.dead || !handLive) return; peeked = true; notesApi.set(true); pk.style.display = "none"; patience = Math.max(0, patience - 1); mPat.set(patience); floats.add("-1", 100, 20, "#ff6a6a"); RP.sfx("error"); };
    pk.addEventListener("click", peek);
    S.extraKey = e => { if (e.key === "n" || e.key === "N") peek(); };
    host.cleanup(() => { S.extraKey = null; });
  }
  const say = SK.say(S, play);
  const choiceBox = el("div", { cls: "pt-choices" }, play);
  const tipEl = el("div", { cls: "sk-tip", text: "Keys 1-6 pick a line · click or Space skips the typing" }, play);

  // ---- scene
  const scene = paintOffice(party, pname, seed, null);
  const c = stageApi.c;
  const floats = SK.floats();
  const st = { expr: "", act: "stand", mouthT: 0, talking: false, blink: SK.blinker(), flash: null, flashT: 0, headX: 196, shake: 0 };
  let handLive = false;
  const lightPro = { lx: -0.4, rim: { color: "#ff3fa4", side: -1 }, shadow: 0, cast: false };
  const lightKid = { lx: 0.35, rim: { color: "#ff3fa4", side: 1 }, shadow: 0, cast: false };
  function draw(dt) {
    c.drawImage(scene.far, 0, 0);
    st.mouthT += dt;
    const talking = say.talking && st.talking;
    const blink = st.blink(dt);
    SK.drawChar(c, proDef, 196, 222, { face: "front", act: st.act, frame: 0, mouth: talking && Math.floor(st.mouthT * 9) % 2 === 0, blink, expr: st.expr || undefined, scale: 2 }, lightPro);
    c.drawImage(scene.near, 0, 0);
    SK.drawChar(c, kidDef || proDef, 60, 282, { face: "back", act: "stand", scale: 2 }, lightKid);
    if (st.flash) {
      st.flashT += dt;
      const f = st.flash, w = txtW(f.text, 2, 2) + 12, x = Math.round(f.x - w / 2), y = f.y;
      if (!(f.blink && Math.floor(st.flashT * 8) % 2) || SK.reduced()) {
        R(c, x, y, w, 20, "#0a0414"); R(c, x, y, w, 2, f.col); R(c, x, y + 18, w, 2, f.col);
        txtC(c, f.text, f.x, y + 5, f.col, 2, 2);
      }
      if (st.flashT > f.life) st.flash = null;
    }
    floats.draw(c, dt);
  }
  let last = performance.now();
  host.raf(t => { const dt = Math.min(0.1, (t - last) / 1000); last = t; try { draw(dt); } catch (e) { /* never throw */ } });
  draw(0);

  // ---- helpers
  let patience = startPat, interest = startInt;
  let turn = 0, desperate = 0, hits = 0, lies = 0, counters = 0, lastCat = "", lastQ = 0, usedWho = {}, achieved = null;
  const setExpr = (e, act) => { st.expr = e || ""; st.act = act || "stand"; };
  const flash = (text, col, o = {}) => { st.flash = { text, col, x: o.x || 160, y: o.y || 8, life: o.life || 1.3, blink: o.blink !== false }; st.flashT = 0; };
  const pickReact = (q) => SK.pick(q >= 3 ? REACT.great : q === 2 ? REACT.good : q === 1 ? REACT.ok : q === 0 ? REACT.meh : q >= -2 ? REACT.bad : REACT.awful, rnd);
  const proSay = (text, o = {}) => { st.talking = true; return say.say(pname, fmt(text), Object.assign({ color: voice, pitch: 300 + (hashStr(pname) % 120) }, o)).then(() => { st.talking = false; }); };
  const youSay = (text) => { st.talking = false; return say.say(myName, text, { color: "#62e6ff", you: true, speed: 90, pitch: 640 }); };
  const feedback = (dInt, dPat, q) => {
    const hx = 196;
    if (dInt) floats.add((dInt > 0 ? "+" : "") + Math.round(dInt), hx, 44, dInt > 0 ? "#9be15d" : "#ff6a6a", { sc: 2, life: 1.6, icon: dInt > 0 ? "heart" : "cross" });
    if (dPat < 0) floats.add(String(dPat), hx + 36, 70, "#ffc44d", { life: 1.4 });
  };
  const expressionFor = () => interest >= 70 ? "happy" : patience <= 2 ? "angry" : interest <= 20 ? "sad" : "";

  // ---- hand building
  function makeHandBooking(op) {
    let cats = SK.shuffle(CATS, rnd);
    const drop = rnd() < 0.55 ? "desp" : cats.find(c0 => c0 !== "desp");
    if (diff === 1 && rnd() < 0.6) { /* keep the hand friendly: never drop the best category */ }
    cats = cats.filter(c0 => c0 !== drop);
    if (diff >= 3 && !cats.includes("desp") && rnd() < 0.5) { cats.pop(); cats.push("desp"); }
    cats = SK.shuffle(cats.slice(0, 5), rnd);
    return cats.map(cat => buildLine(cat, op));
  }
  function pickWho() {
    const gProb = [0, 0.3, 0.45, 0.55, 0.6][diff - 1], r0 = rnd();
    if (r0 < gProb) return { who: prof.grudge, kind: "grudge" };
    if (r0 < gProb + 0.4) return { who: prof.fan, kind: "fan" };
    return { who: SK.pick(NEUTRAL, rnd), kind: "neutral" };
  }
  function buildLine(cat, op, term) {
    const base = op ? op.q[cat] : 0;
    const out = { cat, tag: CAT[cat][0], tagCls: CAT[cat][1], q: base, text: "", meta: {} };
    if (cat === "know") {
      const unused = facts.filter(f => !f.used);
      const f = SK.pick(unused.length ? unused : facts, rnd);
      const lieProb = [0, 0.3, 0.45, 0.5, 0.55][diff - 1];
      if (rnd() < lieProb) { out.text = f.lie; out.q = -3; out.meta = { lie: true, fact: f }; }
      else { out.text = f.truth; out.q = f.used ? 1 : Math.max(base, 2); out.meta = { fact: f }; }
      return out;
    }
    let pool;
    if (neg) pool = cat === "name" || cat === "num" ? NEG_SHARED[cat] : term[cat];
    else pool = op[cat];
    let line = SK.pick(pool, rnd), numKind = "fol";
    if (cat === "num" && line.startsWith("R|")) { line = line.slice(2); numKind = "rec"; }
    const v = Object.assign({}, V);
    if (cat === "name") { const w = pickWho(); v.who = w.who; out.meta = w; out.q = w.kind === "grudge" ? -3 : w.kind === "fan" ? Math.min(3, base + 2) : base; }
    if (cat === "num") {
      const ratio = numKind === "rec" ? recN / 15 : fol / [100, 200, 300, 400, 500][diff - 1];
      out.meta = { ratio, numKind };
      out.q = ratio >= 1 ? base : ratio >= 0.5 ? Math.max(0, base - 1) : -1;
    }
    if (neg) v.need = fmt(term.need);
    out.text = SK.fmt(SK.fmt(line, v), v);
    return out;
  }

  // ---- result computation (booking)
  const K1 = 7;
  async function choose(lines, withTake) {
    handLive = true;
    const items = lines.map(l => ({ tag: l.tag, tagCls: l.tagCls, text: l.text }));
    if (withTake) items.push({ tag: "LOCK IT", tagCls: "t-take", text: "Okay. That works. Shake on it." });
    SK.__last = { lines: lines.map(l => ({ cat: l.cat, q: l.q })) };
    const r = await SK.choices(S, choiceBox, items);
    handLive = false;
    r.wrap.remove();
    return r.index;
  }

  // ====================================================================== booking loop
  async function bookingLoop() {
    const ids = Object.keys(OPENERS);
    const pool = SK.shuffle(ids.filter(i => i !== "nextweek" && i !== "who"), rnd);
    const seq = [];
    if (rnd() < 0.65) seq.push("who");
    seq.push(...pool.slice(0, 9));
    const nwAt = 2 + Math.floor(rnd() * 3);
    seq.splice(Math.min(nwAt, seq.length), 0, "nextweek");
    setExpr("", "stand");
    await proSay(SK.pick([
      "Heard you wanted " + ask + ". I've got six minutes and a pierogi. Talk.",
      "You're the DJ. The one with " + (fol > 50 ? "followers" : "enthusiasm") + ". Sit. Talk. Be brief.",
      "Oh good, another DJ. Sit. I'll pretend this is a meeting."
    ], rnd));
    for (const id of seq) {
      if (S.dead) return null;
      if (patience <= 0 || interest <= 0 || interest >= 100 || turn >= 10) break;
      turn++;
      const op = OPENERS[id];
      setExpr(expressionFor(), id === "phone" ? "phone" : "stand");
      if (id === "nextweek") { flash("NEXT WEEK", "#ffc44d", { x: 160, y: 8, life: 1.4 }); RP.sfx("buzz"); }
      await proSay(SK.pick(op.pro, rnd));
      if (id === "phone") setExpr(expressionFor(), "stand");
      const lines = makeHandBooking(op);
      if (op.counter) { const ci = lines.findIndex(l => l.cat === "conf"); if (ci < 0) lines[0] = buildLine("conf", op); }
      const idx = await choose(lines, false);
      const L = lines[idx];
      await youSay(L.text);
      let q = L.q;
      if (L.cat === lastCat && L.cat !== "know") q = Math.min(q, Math.max(-1, q - 2));
      if (L.meta && L.meta.fact) L.meta.fact.used++;
      if (L.cat === "know" && L.meta.lie) lies++;
      if (L.cat === "desp") desperate++;
      if (L.cat === "name" && L.meta.who) usedWho[L.meta.who] = (usedWho[L.meta.who] || 0) + 1;
      const wasRepeat = L.cat === lastCat && L.cat !== "know";
      lastCat = L.cat; lastQ = q;
      const dInt = Math.round(q * K1), dPat = q >= 3 ? 0 : q >= 0 ? -1 : q >= -2 ? -2 : -3;
      interest = clamp(interest + dInt, 0, 100); patience = Math.max(0, patience + dPat);
      if (q >= 2) hits++;
      mInt.set(interest); mPat.set(patience);
      feedback(dInt, dPat, q);
      // react
      let react;
      if (L.cat === "desp") react = SK.pick(R_DESP, rnd);
      else if (L.cat === "name" && L.meta.kind === "grudge") react = SK.pick(R_GRUDGE, rnd);
      else if (L.cat === "name" && L.meta.kind === "fan") react = SK.pick(R_FAN, rnd);
      else if (L.cat === "know" && L.meta.lie) react = SK.pick(R_LIE, rnd);
      else if (L.cat === "num" && L.meta.ratio < 0.5) react = SK.pick(R_LOWNUM, rnd);
      else if (op.counter && L.cat === "conf") react = SK.pick(R_NEXTWEEK, rnd);
      else if (L.cat === "joke" && q >= 2) react = SK.pick(R_JOKE, rnd);
      else if (wasRepeat) react = SK.pick(R_REPEAT, rnd);
      else react = pickReact(q);
      if (q >= 3) RP.sfx("cheer"); else if (q >= 1) RP.sfx("ping"); else if (q <= -2) RP.sfx("boo"); else if (q < 0) RP.sfx("buzz");
      if (op.counter && L.cat === "conf") { flash("COUNTER-OFFER!", "#62e6ff", { x: 160, y: 8, life: 1.6 }); counters++; RP.sfx("success"); }
      setExpr(q >= 2 ? "surprised" : q <= -2 ? "angry" : q < 0 ? "worried" : "", "stand");
      await S.wait(300);
      await proSay(SK.fmt(react, { who: L.meta && L.meta.who }));
      setExpr(expressionFor(), "stand");
      handLive = false;
      await S.wait(380);
    }
    return null;
  }

  // ====================================================================== negotiation loop
  async function negotiationLoop() {
    const order = ["fee"].concat(SK.shuffle(["flights", "hotel", "rider"], rnd));
    const T = {};
    order.forEach(id => { T[id] = { id, rung: TERMS[id].init, top: TERMS[id].rungs.length - 1, locked: false, counters: 0 }; });
    const setRow = (id, cls) => { const row = dealRows[id], t = T[id]; row.td.textContent = fmt(TERMS[id].rungs[t.rung][0]); row.tr.className = "pt-row " + (cls || "") + (t.locked ? " lock" : "") + (id === "fee" && t.rung === 0 ? " expo" : ""); };
    order.forEach(id => { dealRows[id].td.textContent = "?"; });
    setExpr("", "stand");
    await proSay("Alright. " + party + " wants you. Here's the offer. Brace yourself.");
      for (const id of order) {
      const tm = TERMS[id], t = T[id];
      if (patience <= 0) break;
      order.forEach(o => setRow(o, o === id ? "cur" : ""));
      setExpr("", "stand");
      await proSay(SK.pick(tm.intro, rnd) + " " + tm.rungs[t.rung][1]);
      if (id === "fee" && t.rung === 0) { flash("EXPOSURE?!", "#ff6a6a", { x: 160, y: 8 }); RP.sfx("buzz"); }
      while (!t.locked && patience > 0 && !S.dead) {
        turn++;
        // hand: 5 lines (no repeated categories) + a lock option
        let cats = SK.shuffle(CATS, rnd);
        const drop = rnd() < 0.5 ? "desp" : cats.find(c0 => c0 !== "desp");
        cats = cats.filter(c0 => c0 !== drop).slice(0, 5);
        const lines = SK.shuffle(cats, rnd).map(cat => buildLine(cat, null, tm));
        const idx = await choose(lines, true);
        if (idx === lines.length) {
          await youSay("Okay. That works. Let's lock it in.");
          t.locked = true;
          if (id === "fee" && t.rung === 0) {
            achieved = "exposure"; interest = clamp(interest - 30, 0, 100); patience = Math.max(0, patience - 2); mInt.set(interest); mPat.set(patience);
            feedback(-30, -2, -4); setExpr("surprised", "stand"); RP.sfx("boo");
            await proSay("...Wow. You said yes to exposure. I'll frame this. I'll put it on the wall.");
          } else {
            interest = clamp(interest + 3, 0, 100); mInt.set(interest);
            setExpr("happy", "stand"); RP.sfx("ping");
            await proSay(SK.pick(["Done. Good. I like you. Don't tell anyone.", "Great. Locked. That was painless. For me.", "Deal. Next."], rnd));
          }
          setRow(id, "cur");
          break;
        }
        const L = lines[idx];
        await youSay(L.text);
        const lev = interest;
        let dRung = 0, dInt = 0, dPat = -1, q = L.q, react;
        const wasRepeat = L.cat === lastCat;
        switch (L.cat) {
          case "conf": dRung = lev >= 60 ? 2 : 1; dInt = lev >= 60 ? 4 : 0; q = lev >= 60 ? 3 : 1; break;
          case "num": dRung = L.meta.ratio >= 1 ? 2 : L.meta.ratio >= 0.5 ? 1 : 0; dInt = L.meta.ratio >= 1 ? 8 : L.meta.ratio >= 0.5 ? 2 : -6; q = L.q; break;
          case "name": if (L.meta.kind === "grudge") { dRung = -1; dInt = -18; q = -3; } else if (L.meta.kind === "fan") { dRung = 1; dInt = 10; q = 2; } else { dRung = 0; dInt = 5; q = 1; } break;
          case "joke": dRung = 0; dInt = 9; dPat = 0; q = 2; break;
          case "know": if (L.meta.lie) { dRung = 0; dInt = -14; dPat = -2; q = -3; lies++; } else { dRung = 1; dInt = 12; q = L.meta.fact.used ? 1 : 3; if (L.meta.fact.used) dInt = 5; } break;
          case "desp": dRung = t.rung > 0 ? -t.rung : 0; dInt = -16; dPat = -2; q = -3; desperate++; break;
          default: break;
        }
        if (wasRepeat) { dInt = Math.round(dInt / 2); dRung = Math.min(dRung, 1); }
        if (L.meta && L.meta.fact) L.meta.fact.used++;
        lastCat = L.cat;
        if (dRung > 0) { t.counters++; }
        const before = t.rung;
        t.rung = clamp(t.rung + dRung, 0, t.top);
        interest = clamp(interest + dInt, 0, 100); patience = Math.max(0, patience + dPat);
        if (q >= 2) hits++;
        mInt.set(interest); mPat.set(patience); feedback(dInt, dPat, q);
        if (q >= 3) RP.sfx("cheer"); else if (q >= 1) RP.sfx("ping"); else if (q <= -2) RP.sfx("boo"); else RP.sfx("buzz");
        if (L.cat === "desp") react = SK.pick(R_DESP, rnd);
        else if (L.cat === "name" && L.meta.kind === "grudge") react = SK.pick(R_GRUDGE, rnd);
        else if (L.cat === "name" && L.meta.kind === "fan") react = SK.pick(R_FAN, rnd);
        else if (L.cat === "know" && L.meta.lie) react = SK.pick(R_LIE, rnd);
        else if (L.cat === "num" && L.meta.ratio < 0.5) react = SK.pick(R_LOWNUM, rnd);
        else if (L.cat === "joke") react = SK.pick(R_JOKE, rnd);
        else if (wasRepeat) react = SK.pick(R_REPEAT, rnd);
        else react = pickReact(q);
        setExpr(q >= 2 ? "surprised" : q <= -2 ? "angry" : q < 0 ? "worried" : "", "stand");
        await S.wait(300);
        react = SK.fmt(react, { who: L.meta && L.meta.who });
        const moved = t.rung - before;
        if (moved > 0) {
          const final = t.counters >= 2 || t.rung >= t.top;
          if (final) t.locked = true;
          await proSay(react + " " + (final ? "Okay. " : "") + tm.rungs[t.rung][1] + (final ? " That's the best I can do." : ""));
          setRow(id, "cur");
          if (final) { RP.sfx("ping"); }
        } else if (moved < 0) {
          await proSay(react + " " + tm.rungs[t.rung][1] + " Which is worse. For you.");
          setRow(id, "cur");
        } else {
          await proSay(react + (L.cat === "joke" || L.cat === "know" ? " Anyway. The offer stands." : " The offer stands."));
        }
        setExpr(expressionFor(), "stand");
        if (t.counters >= 2 && !t.locked) { t.locked = true; setRow(id, "cur"); }
        await S.wait(300);
      }
      setRow(id, "");
    }
    // patience gone: what's left gets locked where it stands (+ a courtesy bump if he likes you)
    order.forEach(id => { if (!T[id].locked) { T[id].locked = true; if (interest >= 55 && T[id].rung < T[id].top) T[id].rung++; setRow(id, ""); } });
    return T;
  }

  // ====================================================================== run + end
  let T = null;
  if (neg) T = await negotiationLoop(); else await bookingLoop();
  if (S.dead) return null;

  let score = 0, ok = false, deal = null, outcome = "", lines = [];
  const stats = [];
  if (!neg) {
    const won = interest >= 100;
    const trial = !won && interest >= 55;
    const slot = won ? "monthly" : trial ? "trial" : null;
    ok = !!slot;
    const feeBase = won ? 100 + Math.round((patience / startPat) * 75 / 25) * 25 : trial ? 75 : 0;
    const fee = won ? clamp(feeBase + (hits >= 4 ? 25 : 0), 100, 200) : trial ? 75 : 0;
    score = clamp(Math.round(interest * 0.6 + (patience / startPat) * 24 + hits * 2 - desperate * 3 - lies * 3 + (won ? 10 : 0)), 0, 100);
    if (!ok) score = Math.min(score, 38);
    if (won) score = Math.max(score, 62); if (trial) score = clamp(score, 40, 64);
    deal = { slot, fee, night: slot ? "last Saturday of the month" : null, party, promoter: pname, ask };
    outcome = won ? "monthly" : trial ? "trial" : "none";
    if (won) { setExpr("happy", "stand"); RP.sfx("success"); await proSay("Fine. You're in. " + party + ", last Saturday of the month. " + cur + fee + " a night. I'll send the paperwork next week."); }
    else if (trial) { setExpr("", "stand"); RP.sfx("ping"); await proSay("Okay. One night. A trial. " + cur + fee + " and a drink ticket. Don't make me regret it. I'll confirm it next week."); }
    else if (interest <= 0) { setExpr("angry", "stand"); RP.sfx("boo"); await proSay("We're done. Door's that way. Mind the plant."); }
    else { setExpr("angry", "stand"); RP.sfx("boo"); await proSay(SK.pick(["I have to go. I have a call. I'll... let you know. Next week.", "That's my time. Send me a link. Next week. Goodbye."], rnd)); }
    lines = [won ? "A monthly at " + party + ". At " + cur + fee + " a night, it's a start." : trial ? "A one-night trial at " + party + ". Don't blow it." : "No deal. Next week, maybe. (He means never.)"];
    stats.push(["INTEREST", interest], ["PATIENCE", patience + "/" + startPat], ["SHARP LINES", hits], ["BEGGING", desperate, desperate ? "bad" : "ok"]);
  } else {
    const fr = T.fee.rung, expo = achieved === "exposure";
    const wsum = TERMS.fee.w * (fr / 4) + TERMS.flights.w * (T.flights.rung / 3) + TERMS.hotel.w * (T.hotel.rung / 3) + TERMS.rider.w * (T.rider.rung / 3);
    score = clamp(Math.round(wsum * 88 + (patience / startPat) * 8 + interest * 0.04 - desperate * 2 - lies * 2 + (fr >= 3 ? 4 : 0)), 0, 100);
    ok = fr >= 2 && !expo;
    if (expo) score = Math.min(score, 25);
    if (!ok) score = Math.min(score, 45);
    deal = { fee: TERMS.fee.nums[fr], currency: cur, flights: TERMS.flights.keys[T.flights.rung], hotel: TERMS.hotel.keys[T.hotel.rung], rider: TERMS.rider.keys[T.rider.rung], exposure: expo || fr === 0,
      terms: { fee: fmt(TERMS.fee.rungs[fr][0]), flights: TERMS.flights.rungs[T.flights.rung][0], hotel: TERMS.hotel.rungs[T.hotel.rung][0], rider: TERMS.rider.rungs[T.rider.rung][0] }, promoter: pname, party };
    outcome = ok ? "booked" : expo ? "exposure" : "lowball";
    if (ok) { setExpr("happy", "stand"); RP.sfx("success"); await proSay("Done. " + fmt(TERMS.fee.rungs[fr][0]) + ", " + deal.terms.flights.toLowerCase() + ", " + deal.terms.hotel.toLowerCase() + ". Contract's coming. Next week."); }
    else { setExpr("angry", "stand"); RP.sfx("boo"); await proSay(expo ? "Wow. Exposure it is. See you in the brochure." : "That's all I've got. Take it or leave it. Preferably leave it."); }
    lines = [ok ? "Booked at " + party + ". The " + deal.terms.fee + " fee sticks." : expo ? "You took exposure. It's cold out there." : "The fee never got off the floor. Try again with more leverage."];
    stats.push(["FEE", deal.terms.fee, fr >= 3 ? "ok" : fr === 0 ? "bad" : ""], ["FLIGHTS", deal.terms.flights], ["HOTEL", deal.terms.hotel], ["RIDER", deal.terms.rider]);
  }
  await S.wait(500);
  play.style.display = "none";
  const stamp = { w: 64, h: 24, k: 4, draw(g) {
    const col = ok ? "#9be15d" : "#ff6a6a", w = ok ? (neg ? "BOOKED" : deal.slot === "monthly" ? "BOOKED" : "TRIAL") : "NO DEAL";
    R(g, 0, 0, 64, 24, "#0a0716"); R(g, 1, 1, 62, 22, col); R(g, 3, 3, 58, 18, "#0a0716");
    txtC(g, w, 32, 8, col, 2, 2);
  } };
  await SK.endCard(S, wrap, { kicker: pname.toUpperCase() + " \u00B7 " + party.toUpperCase(), title: ok ? (neg ? "Contract: Signed" : deal.slot === "monthly" ? "You're booked" : "One-night trial") : "No deal", lines, stats, score, ok, stamp, rank: neg ? (score >= 85 ? "NEGOTIATOR" : score >= 60 ? "FAIR DEAL" : score >= 40 ? "LOWBALLED" : "EXPOSED") : null });
  return { ok, score, deal, outcome };
  }
}
})();
