import { db } from "./db";
import { knowledgeBase, knowledgeFolders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { RAGKnowledgeService } from "./services/rag-knowledge";

const SCENARIO_FOLDER_NAME = "Conversation Scenarios";
const SCENARIO_FOLDER_ICON = "message-circle";
const SCENARIO_FOLDER_SORT_ORDER = 13;

export interface ScenarioEntry {
  title: string;
  category: string;
  content: string;
}

export const SCENARIO_SCRIPTS: ScenarioEntry[] = [
  // ─── ANGRY / FRUSTRATED CALLER (8) ───
  {
    title: "Angry Caller — Refund Demand",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer who feels wronged and demands money back immediately.
Emotional State: Angry, impatient, possibly raising voice.
Detection Cues: Words like "refund," "money back," "rip-off," "scam," "unacceptable," demanding tone, interrupting.

Spoken Script:
"I completely understand your frustration, and I'm really sorry you're dealing with this. You deserve a resolution, and I'm going to do everything I can to help you right now. Let me pull up your account so I can see exactly what happened. Can you give me your email address or phone number on the account?"

[After reviewing]
"Okay, I can see the charge you're referring to. Here's what I can do for you — I'm going to initiate a refund right away. You should see that back in your account within three to five business days. Does that work for you?"

[If still upset]
"I hear you, and I want to make sure you walk away feeling taken care of. While I process this refund, is there anything else I can help sort out for you today?"

Resolution Options: Full refund, partial refund with credit, plan swap, escalate to billing supervisor.
Closing: "I've submitted your refund and you'll get a confirmation email shortly. I'm sorry again for the trouble, and I hope we can earn your trust back. Have a great rest of your day."`
  },
  {
    title: "Angry Caller — Service Not Working Abroad",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Traveler stranded without connectivity in a foreign country.
Emotional State: Frustrated, anxious, possibly panicking.
Detection Cues: "Not working," "no signal," "abroad," "traveling," "stranded," urgency in voice.

Spoken Script:
"Oh no, I can only imagine how stressful that must be, especially when you're traveling. Let's get this sorted out for you right away. First, can you tell me which country you're in right now?"

[After confirming location]
"Perfect, we definitely have coverage there. Sometimes when you land, you need to restart your phone to let it connect to the local network. Have you tried turning your phone off and back on since you arrived?"

[If restart didn't help]
"No worries, let's try one more thing. Go to your phone settings, then look for mobile data or cellular, and make sure data roaming is turned on. I'll walk you through it step by step."

[If still not working]
"I understand this is really frustrating. Let me check if there's a network issue on our end for your area. In the meantime, I'm going to make sure your plan is fully activated and provisioned correctly."

Resolution Options: Remote activation, APN configuration guidance, replacement eSIM, escalate to technical team.
Closing: "I'm going to stay on top of this until you're connected. If it doesn't kick in within the next fifteen minutes, call us right back and we'll escalate it immediately. Safe travels!"`
  },
  {
    title: "Angry Caller — Overcharged on Bill",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer who noticed unexpected charges on their statement.
Emotional State: Angry, suspicious, feeling cheated.
Detection Cues: "Overcharged," "extra charge," "didn't authorize," "billing error," "wrong amount."

Spoken Script:
"I'm really sorry about that — unexpected charges are never a good surprise. Let me look into this right away so we can figure out exactly what happened. Can you tell me the amount you're seeing that doesn't look right?"

[After reviewing]
"Okay, I found it. It looks like this charge was for [specific item]. I can see how that would be confusing. Let me explain what happened and then we'll figure out the best way to fix this for you."

[If it was an error]
"You're absolutely right, this shouldn't have been charged. I'm going to reverse it right now and make sure it doesn't happen again."

[If charge was legitimate but unclear]
"So this charge is actually for your data top-up from last week. I understand it wasn't clear on the statement though. Would you like me to apply a courtesy credit for the confusion?"

Resolution Options: Reverse charge, apply credit, explain with documentation, adjust billing cycle.
Closing: "That's all taken care of now. I've also added a note to your account so this won't happen again. Is there anything else about your bill I can clear up?"`
  },
  {
    title: "Angry Caller — Long Wait Time",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer who waited on hold for an extended period.
Emotional State: Irritated, impatient, may vent about the wait.
Detection Cues: "Been waiting forever," "on hold for," "terrible service," "how long," "wasting my time."

Spoken Script:
"I sincerely apologize for the wait — I know your time is valuable, and I appreciate your patience. I want to make sure we make the most of this call, so let me jump right in. What can I help you with today?"

[Let them vent if needed, then]
"I completely understand your frustration with the wait. You have my full attention now, and I'm going to do everything I can to resolve this quickly so we don't take up any more of your time."

[After resolving their issue]
"I'm glad we got that sorted out. Again, I'm sorry about the hold time. We're working on improving that. Is there anything else I can handle for you while I have you on the line?"

Resolution Options: Quick resolution of original issue, apply courtesy credit for wait, offer callback option for future.
Closing: "Thank you so much for your patience today. Everything is taken care of, and if you ever need help again, don't hesitate to reach out."`
  },
  {
    title: "Angry Caller — Repeated Issues Not Resolved",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer calling back about the same unresolved problem.
Emotional State: Extremely frustrated, feeling ignored, losing trust.
Detection Cues: "Called before," "already told," "third time," "still not fixed," "nobody helped."

Spoken Script:
"I am so sorry you've had to call back about this. That should not happen, and I completely understand your frustration. Let me look at all the notes on your account so I don't make you repeat everything."

[After reviewing history]
"I can see you spoke with us on [date] and [date] about this. I want you to know that I'm taking personal ownership of this right now. I'm not going to pass you around — we're going to fix this on this call."

[Take definitive action]
"Here's exactly what I'm doing right now: [specific action]. And I'm going to follow up with you personally to make sure it's actually resolved this time. What's the best number to reach you?"

Resolution Options: Immediate escalation, direct resolution with supervisor authority, personal follow-up commitment, compensation for inconvenience.
Closing: "I've taken care of everything and put my direct reference number on your account. If you have any issues at all, reference case number [X] and you'll be connected to our priority team right away."`
  },
  {
    title: "Angry Caller — Misleading Pricing",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer who feels the advertised price didn't match what they paid.
Emotional State: Feeling deceived, demanding answers.
Detection Cues: "False advertising," "said it was," "website showed," "different price," "bait and switch."

Spoken Script:
"I totally understand how frustrating that must be — nobody wants to feel like they're paying more than expected. Let me take a look at what you signed up for and compare it with what you were shown."

[After reviewing]
"I can see where the confusion happened. The price you saw was for our basic plan, and it looks like your account was set up on the premium tier. That's not your fault at all. Here's what I can do for you right now."

[Offer resolution]
"I'm going to adjust your plan to match the price you expected, and I'll credit you the difference for this billing period. How does that sound?"

Resolution Options: Price match to advertised rate, downgrade plan, refund difference, apply promotional pricing.
Closing: "I've updated your plan and applied the credit. You'll see the corrected amount on your next statement. I want to make sure you feel good about this — is there anything else I can help with?"`
  },
  {
    title: "Angry Caller — eSIM Won't Activate",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer who purchased an eSIM but can't get it working.
Emotional State: Frustrated, possibly anxious if traveling soon.
Detection Cues: "Won't activate," "not working," "scanned the code," "nothing happened," "wasted money."

Spoken Script:
"I'm really sorry you're having trouble with the activation. I know that can be really frustrating, especially if you need it for a trip. Let's get this working for you right now. First, can you tell me what kind of phone you have?"

[After confirming device]
"Great, your phone definitely supports eSIM. Sometimes the activation just needs a little nudge. Let me walk you through it step by step. Can you go to your phone settings for me?"

[Walk through activation]
"Go to Settings, then Cellular or Mobile Data, then tap Add eSIM or Add Cellular Plan. Now try scanning your QR code again. Make sure you're connected to WiFi when you do this."

[If still failing]
"No worries at all. I'm going to generate a fresh QR code for you right now and send it to your email. Sometimes the original code can have a glitch. I'll stay on the line while we get this sorted."

Resolution Options: New QR code, manual activation code, remote provisioning, device-specific troubleshooting, replacement eSIM.
Closing: "Awesome, I can see your eSIM is now active and connected! You're all set. If you have any issues once you start traveling, just give us a call and we'll help right away."`
  },
  {
    title: "Angry Caller — Data Ran Out Unexpectedly",
    category: "Angry/Frustrated Caller",
    content: `Caller Profile: Customer whose data allotment depleted faster than expected.
Emotional State: Frustrated, caught off guard, feeling misled about data amount.
Detection Cues: "Data ran out," "used up already," "not enough data," "should have lasted," "only been a day."

Spoken Script:
"Oh no, I'm sorry that happened! That's definitely not the experience we want you to have. Let me check your usage history to see what's going on."

[After reviewing]
"So it looks like your data was consumed faster than expected. This sometimes happens when apps run background updates or when streaming video on mobile data. The good news is I can help you get back online right away."

[Offer solution]
"I have a couple of options for you. I can add a top-up to your current plan so you have data right now, or if you'd like, we can look at a plan with more data for next time. Which would you prefer?"

[If they feel misled]
"I completely understand, and I agree that your data should have lasted longer based on typical usage. Let me add a courtesy top-up at no charge to make up for the inconvenience."

Resolution Options: Free data top-up, paid top-up at discount, plan upgrade, usage analysis and tips.
Closing: "You're all topped up and back online! I've also turned on low data notifications on your account so you'll get a heads-up when you're running low. That way, no more surprises!"`
  },

  // ─── FIRST-TIME USER (8) ───
  {
    title: "First-Time User — What Is eSIM",
    category: "First-Time User",
    content: `Caller Profile: Someone who has never heard of or used an eSIM before.
Emotional State: Curious but possibly confused, cautious.
Detection Cues: "What is," "never heard of," "how is it different," "is it a real SIM," "do I need to put it in."

Spoken Script:
"Great question! An eSIM is basically a digital version of the little SIM card you'd normally put in your phone. Instead of a physical card, it gets installed right onto your phone digitally — kind of like downloading an app. You don't need to open your phone or swap anything out."

[If they ask how it works]
"It works the same way as a regular SIM card for making calls and using data. The only difference is that it's built into your phone's software instead of being a physical chip. You activate it by scanning a QR code, and you're good to go — usually in under a minute."

[If they seem hesitant]
"I know it might sound a bit techy, but it's actually really simple. Most modern smartphones already have it built in. Would you like me to check if your phone is compatible?"

Resolution Options: Explain eSIM benefits, check device compatibility, guide to first purchase.
Closing: "It's really that easy! And the best part is you can have your regular SIM and an eSIM on the same phone at the same time. Would you like to look at some plans?"`
  },
  {
    title: "First-Time User — How to Install eSIM",
    category: "First-Time User",
    content: `Caller Profile: Customer who just purchased an eSIM and needs help installing it.
Emotional State: Slightly anxious, wants clear guidance, afraid of doing it wrong.
Detection Cues: "How do I install," "where do I start," "got the QR code," "what do I do now," "first time."

Spoken Script:
"Congratulations on your purchase! Installing your eSIM is super easy — I'll walk you through it step by step. First, make sure you're connected to WiFi. Are you on WiFi right now?"

[Once confirmed]
"Perfect. Now open your phone Settings. Then look for Cellular or Mobile Data — it might say Mobile Network on some phones. You'll see an option that says Add eSIM or Add Cellular Plan. Tap on that."

[Guide through QR scan]
"Now you should see an option to scan a QR code. Point your camera at the QR code we sent you — you can pull it up on another device or print it out. Your phone should recognize it right away."

[After successful scan]
"You should see a prompt asking you to confirm the new plan. Just tap Continue or Add, and give it about thirty seconds to activate. You'll see the signal bars appear when it's ready."

Resolution Options: Step-by-step guidance, screen sharing, send video tutorial link, schedule callback if needed.
Closing: "And that's it, you're all set! Your eSIM is installed and ready to use. If you run into anything when you start traveling, just give us a call. Happy travels!"`
  },
  {
    title: "First-Time User — Phone Compatibility Check",
    category: "First-Time User",
    content: `Caller Profile: Potential customer unsure if their phone supports eSIM.
Emotional State: Uncertain, wanting reassurance before purchasing.
Detection Cues: "Does my phone support," "is my phone compatible," "which phones work," "I have a," "will it work on."

Spoken Script:
"That's a smart question to ask before buying! Can you tell me what phone you're using? The brand and model would be really helpful."

[For supported phones]
"Great news — your phone fully supports eSIM! You're good to go. Would you like me to help you pick a plan?"

[For phones that might not support]
"So your phone model is right on the edge. Let me help you check — go to Settings, then General, then About. Look for a line that says EID or Digital SIM. If you see it, your phone supports eSIM."

[If phone doesn't support eSIM]
"Unfortunately, that particular model doesn't support eSIM yet. But don't worry — if you're planning to upgrade your phone at any point, most newer models from the last couple of years do support it. In the meantime, we do have some alternatives I can tell you about."

Resolution Options: Confirm compatibility, guide self-check, suggest alternative solutions, share compatible device list.
Closing: "I'm glad we checked that before you purchased. Is there anything else you'd like to know about getting set up?"`
  },
  {
    title: "First-Time User — Country Coverage Question",
    category: "First-Time User",
    content: `Caller Profile: Traveler planning a trip and checking if service is available.
Emotional State: Excited about trip, practical, wants certainty.
Detection Cues: "Which countries," "does it work in," "going to [country]," "coverage," "traveling to."

Spoken Script:
"Oh how exciting — where are you headed? Let me check our coverage for you right away."

[After they name the destination]
"Great news! We have excellent coverage in [country]. You'll be able to use data, and in most areas you'll get 4G or even 5G speeds. Our network partners there are some of the best in the region."

[If multiple countries]
"Perfect, so you're doing a multi-country trip! We actually have regional plans that cover multiple countries in one package, which is usually the best deal for trips like yours. Want me to tell you about those?"

[If country is not covered]
"I want to be honest with you — we don't currently have coverage in [country]. But we do cover [nearby alternatives]. If your trip includes any of those countries, we've got you covered for those portions."

Resolution Options: Confirm coverage, suggest regional plans, multi-country packages, set expectations for specific areas.
Closing: "You're going to have a great trip! Would you like me to help you pick the right plan for your destination?"`
  },
  {
    title: "First-Time User — How Much Data Do I Need",
    category: "First-Time User",
    content: `Caller Profile: Customer unsure about how much data to buy for their trip.
Emotional State: Indecisive, wants guidance, afraid of buying too much or too little.
Detection Cues: "How much data," "which plan," "enough data," "how many gigs," "what do you recommend."

Spoken Script:
"That's a really common question, and it depends a lot on how you use your phone. Let me help you figure it out. How long is your trip, and what do you mainly use your phone for when you travel?"

[After understanding usage]
"Based on what you've described, I'd recommend our [specific plan]. For basic things like messaging, maps, and checking email, you probably need about one to two gigs per day. If you're streaming video or doing video calls, that goes up to about three to five gigs per day."

[Give practical examples]
"To put it in perspective — one gigabyte is roughly enough for about three hours of web browsing, or five hundred emails, or about an hour of streaming music. For a week-long trip with moderate use, our [X GB] plan is usually perfect."

[If still unsure]
"Here's what I'd suggest — go with the medium plan, and if you find you need more, you can always top up easily through our app. It's much better than running out!"

Resolution Options: Personalized plan recommendation, usage calculator, suggest with top-up safety net.
Closing: "I think that plan is going to work perfectly for your trip. And remember, you can always add more data if you need it. Would you like to go ahead and set it up?"`
  },
  {
    title: "First-Time User — Can I Keep My Number",
    category: "First-Time User",
    content: `Caller Profile: Customer worried about losing their regular phone number with eSIM.
Emotional State: Concerned, protective of their existing number.
Detection Cues: "Keep my number," "lose my number," "regular SIM," "both at once," "replace my SIM."

Spoken Script:
"Don't worry at all — you absolutely keep your existing number! The eSIM works alongside your regular SIM, not instead of it. Think of it as adding a second line to your phone."

[Explain dual SIM]
"Your phone can handle both at the same time. Your regular number stays exactly as it is for calls and texts, and the eSIM gives you an affordable data connection when you're traveling. You just choose which one to use for data in your settings."

[If they're worried about conflicts]
"There's no conflict between them. Your phone is smart enough to manage both. You'll still receive calls and texts on your regular number while using the eSIM for internet. It's really seamless."

Resolution Options: Explain dual SIM functionality, reassure about number retention, guide settings configuration.
Closing: "Your number is completely safe. Once you install the eSIM, you'll have the best of both worlds — your regular number plus affordable international data. Shall we get you started?"`
  },
  {
    title: "First-Time User — Dual SIM Setup",
    category: "First-Time User",
    content: `Caller Profile: Customer who wants to understand how dual SIM with eSIM works.
Emotional State: Curious, slightly technical, wants to understand before committing.
Detection Cues: "Dual SIM," "two SIMs," "both at same time," "which one for what," "how do I switch."

Spoken Script:
"Dual SIM is actually one of the best features of modern phones, and it's really easy to use. Basically, your phone can have your physical SIM and an eSIM active at the same time. You get to choose which one handles calls, texts, and data."

[Explain practical setup]
"Most people set it up so their regular SIM handles calls and texts — that way your number stays the same. Then the eSIM handles your data, which gives you affordable internet when you're abroad. Your phone lets you pick this in settings."

[Walk through configuration]
"After you install the eSIM, your phone will ask you which line to use for different things. You'll see options like Primary and Secondary. Just set your regular SIM as Primary for calls, and your eSIM for mobile data. It takes about thirty seconds."

Resolution Options: Explain dual SIM concept, walk through configuration, device-specific guidance.
Closing: "Once it's set up, you won't even have to think about it — your phone handles everything automatically. Would you like me to help you get your eSIM installed?"`
  },
  {
    title: "First-Time User — Planning First International Trip",
    category: "First-Time User",
    content: `Caller Profile: Traveler going abroad for the first time, nervous about staying connected.
Emotional State: Excited but anxious, wants to be prepared, lots of questions.
Detection Cues: "First time traveling," "never been abroad," "how to stay connected," "avoid charges," "roaming fees."

Spoken Script:
"How exciting — your first international trip! Don't worry, we're going to make sure you stay connected the whole time without any surprise charges. Where are you headed and when do you leave?"

[After getting details]
"Perfect! Here's what I recommend for your trip. Get an eSIM before you leave — you can install it right now while you're on WiFi at home. Then when you land, just turn on the eSIM data and you're instantly connected. No hunting for a SIM card shop at the airport!"

[Address common concerns]
"And here's the best part — with an eSIM, you won't get those scary roaming charges from your regular carrier. You'll be using our affordable data plan instead. Your regular number still works for receiving calls and texts."

[Practical tips]
"A few quick tips for your trip: download your maps offline before you go, turn off your regular carrier's data roaming to avoid accidental charges, and download our app so you can check your data usage and top up if needed."

Resolution Options: Complete trip preparation package, plan recommendation, pre-departure checklist.
Closing: "You're going to be all set! I'd suggest installing the eSIM today so you don't have to worry about it later. Would you like to pick a plan right now?"`
  },

  // ─── TECHNICAL ISSUES (8) ───
  {
    title: "Technical Issue — No Signal After Landing",
    category: "Technical Issues",
    content: `Caller Profile: Customer who just landed in a new country and has no connectivity.
Emotional State: Stressed, time-sensitive, possibly jet-lagged.
Detection Cues: "Just landed," "no signal," "no bars," "not connecting," "arrived at airport."

Spoken Script:
"Welcome to [destination]! Let's get you connected right away. First things first — have you restarted your phone since you landed? Sometimes the phone needs a fresh start to find the local network."

[If restart didn't help]
"Okay, let's try a couple more things. Go to Settings, then Cellular or Mobile Data. Make sure your eSIM line is turned on and set as the data source. Also check that Data Roaming is switched on."

[If still no signal]
"Let's try manually selecting a network. Go to Settings, Cellular, Network Selection, and turn off Automatic. You should see a list of available networks pop up. Try connecting to one of the major carriers listed there."

[If nothing works]
"I want to make sure we get this sorted for you right away. I'm going to check your account on our end to verify everything is provisioned correctly. Can you stay on the line for just a moment? I'm not putting you on hold — I'm working on it right now."

Resolution Options: Device restart, APN settings, manual network selection, re-provision eSIM, send new activation.
Closing: "I can see you're connected now — great! If your signal drops at any point, just toggle airplane mode on and off, and it should reconnect. Enjoy your trip!"`
  },
  {
    title: "Technical Issue — QR Code Won't Scan",
    category: "Technical Issues",
    content: `Caller Profile: Customer trying to set up their eSIM but the QR code isn't working.
Emotional State: Confused, slightly frustrated, may feel technically challenged.
Detection Cues: "QR code won't scan," "nothing happens," "camera doesn't read it," "scan not working."

Spoken Script:
"No worries at all, this happens sometimes and it's usually a quick fix. Let me help you through this. First, are you scanning the code from your phone's eSIM settings, not just the regular camera?"

[Guide to correct method]
"Let me walk you through it. Go to Settings, then Cellular, then Add eSIM. Choose the option to scan a QR code. That will open a special camera that's specifically designed to read eSIM codes."

[If still not working]
"Let's try something else — make sure the QR code is displayed clearly and your screen is bright. Hold your phone about six inches away and keep it steady. If you're scanning from another phone screen, increase the brightness all the way up."

[Final fallback]
"You know what, let me give you the manual activation code instead. This works just as well — you'll just type it in instead of scanning. I'm going to give you two pieces: an address and an activation code. Ready?"

Resolution Options: Correct scanning method, manual activation code, new QR code via email, video tutorial link.
Closing: "There you go, all activated! The manual code approach is just as good as scanning. Is everything looking good on your end?"`
  },
  {
    title: "Technical Issue — Slow Data Speed",
    category: "Technical Issues",
    content: `Caller Profile: Customer experiencing unusually slow internet on their eSIM.
Emotional State: Annoyed, may be trying to get work done or navigate.
Detection Cues: "Super slow," "pages won't load," "taking forever," "barely working," "speed is terrible."

Spoken Script:
"I'm sorry about the slow speeds — that's definitely not the experience you should be having. Let me help figure out what's going on. A couple of quick questions: are you in a city or a more rural area, and are you indoors or outdoors?"

[Diagnose the issue]
"Location can make a big difference. If you're inside a building, try stepping near a window or outside for a moment to see if the speed improves. Thick walls can really affect signal quality."

[If location isn't the issue]
"Let's check your settings. Go to Settings, Cellular, and look at your eSIM line. Make sure it shows 4G or LTE, not 3G. If it says 3G, try toggling airplane mode on and off — that sometimes pushes it to reconnect on a faster network."

[If still slow]
"It might be that the network in your area is congested right now. This is common in busy tourist areas during peak hours. I'd suggest trying again in a little while, or moving to a different area. If speeds don't improve in the next hour, call us back and we'll look into it further."

Resolution Options: Network selection optimization, APN check, report to network partner, data speed guarantee claim.
Closing: "I hope that helps improve your speeds. If they don't get better soon, definitely reach out again and we'll dig deeper into it. In the meantime, connecting to WiFi when it's available can help bridge the gap."`
  },
  {
    title: "Technical Issue — Switching From Physical SIM",
    category: "Technical Issues",
    content: `Caller Profile: Customer who wants to transition from physical SIM to eSIM.
Emotional State: Cautious, afraid of losing service or data.
Detection Cues: "Switch to eSIM," "replace my SIM," "convert to eSIM," "physical to digital."

Spoken Script:
"Moving to eSIM is a great choice! It's a smooth process, and I'll make sure you don't lose anything. Just to clarify — are you looking to replace your current carrier's physical SIM with an eSIM, or are you adding our eSIM as a second line for travel?"

[If adding as second line]
"Perfect, that's the easiest setup! Your physical SIM stays exactly where it is. We're just adding our eSIM alongside it. Your existing number, contacts, everything stays the same. Let me walk you through the installation."

[If replacing carrier SIM]
"Okay, for that you'll want to contact your current carrier to request an eSIM conversion. They'll give you a QR code to set up your existing number as an eSIM. Once that's done, you can remove the physical SIM and still have room for a travel eSIM. Would you like me to explain the steps?"

Resolution Options: Guide dual SIM setup, explain carrier conversion process, troubleshoot conflicts.
Closing: "You're all set with both your regular service and your eSIM! You've got the best of both worlds now. Anything else I can help you with?"`
  },
  {
    title: "Technical Issue — Hotspot Not Working",
    category: "Technical Issues",
    content: `Caller Profile: Customer trying to share their eSIM data via hotspot.
Emotional State: Frustrated, possibly needs to connect laptop urgently.
Detection Cues: "Hotspot," "tethering," "share data," "connect laptop," "WiFi sharing not working."

Spoken Script:
"I understand you need to share your connection — let me help you get that working. First, can you check which data line your hotspot is using? Sometimes the phone defaults to your regular SIM instead of the eSIM."

[Guide configuration]
"Go to Settings, then Personal Hotspot. If you see an option to choose which line to use, make sure your eSIM is selected. On some phones, you might need to go to Cellular first and set the eSIM as your default data line before the hotspot will use it."

[If hotspot is blocked]
"Some of our plans do include hotspot capability, but let me check your specific plan. Give me just a moment to look that up."

[If plan doesn't include hotspot]
"So your current plan actually doesn't include hotspot sharing. But the good news is I can upgrade you to a plan that does, and it only costs a little bit more. Would you like me to switch you over? It'll take effect immediately."

Resolution Options: Configure hotspot settings, upgrade plan, alternative connection methods.
Closing: "Your hotspot should be working now. You'll be able to connect your laptop and any other devices you need. Let me know if anything else comes up!"`
  },
  {
    title: "Technical Issue — Accidentally Deleted eSIM",
    category: "Technical Issues",
    content: `Caller Profile: Customer who removed their eSIM profile by mistake.
Emotional State: Panicking, worried they've lost their purchase, may feel foolish.
Detection Cues: "Accidentally deleted," "removed it," "eSIM is gone," "how do I get it back," "made a mistake."

Spoken Script:
"Don't worry at all — this happens more often than you'd think, and it's completely fixable! You haven't lost anything. Your plan is still active on our end, we just need to get it reinstalled on your phone."

[Reassure and resolve]
"I'm going to send you a fresh QR code right now to your email. It'll work exactly the same way as the original one. Can you confirm your email address for me?"

[Guide reinstallation]
"Once you get the email, just go back to Settings, Cellular, Add eSIM, and scan the new QR code. It'll pick right up where you left off with all your remaining data intact."

[If they lost the data]
"Your data balance is tied to your account, not to the QR code. So even though the eSIM was removed from your phone, your plan and data are completely safe. Once you reinstall it, everything will be right where you left it."

Resolution Options: New QR code, manual activation code, verify remaining balance, add courtesy data if any was lost.
Closing: "All restored! Your eSIM is back and working with all your data intact. No harm done at all. Is there anything else I can help with?"`
  },
  {
    title: "Technical Issue — Wrong APN Settings",
    category: "Technical Issues",
    content: `Caller Profile: Customer whose data isn't working due to incorrect network settings.
Emotional State: Confused by technical terminology, needs patient guidance.
Detection Cues: "APN," "internet settings," "data not working but signal is fine," "connected but no internet."

Spoken Script:
"It sounds like your phone might just need the right internet settings configured. Don't worry, this is a quick fix and I'll walk you through it. First, let me confirm — you have signal bars but no internet when you try to browse, is that right?"

[Confirm the issue]
"Perfect, that's exactly what an APN issue looks like. APN is just a fancy name for your phone's internet settings — think of it like a WiFi password but for mobile data. Let me give you the right settings."

[Walk through APN configuration]
"Go to Settings, then Cellular or Mobile Data, then tap on your eSIM line, and look for Cellular Data Network or Access Point Names. You should see a field called APN. I need you to type in the following — I'll spell it out for you."

[After entering settings]
"Now save those settings, toggle airplane mode on and off, and give it about thirty seconds. You should see your internet kick in."

Resolution Options: APN configuration, remote settings push, device-specific instructions, fallback manual configuration.
Closing: "There you go — internet is working now! These settings are saved so you won't need to do this again. Safe travels and enjoy your trip!"`
  },
  {
    title: "Technical Issue — No Service Error Message",
    category: "Technical Issues",
    content: `Caller Profile: Customer seeing "No Service" or "SOS Only" on their phone.
Emotional State: Worried, possibly feeling isolated, needs quick resolution.
Detection Cues: "No service," "SOS only," "emergency calls only," "says no service," "lost connection."

Spoken Script:
"I know seeing 'No Service' can be alarming, but let's fix that right away. This usually has a simple solution. First, let's make sure your eSIM line is turned on — sometimes it can get accidentally toggled off."

[Check eSIM status]
"Go to Settings, then Cellular. You should see two lines listed — your regular SIM and the eSIM. Make sure the eSIM has its toggle switched to ON, and that it's set as the data line."

[If eSIM is on but still no service]
"Let's try resetting your network settings. Go to Settings, General, Transfer or Reset, Reset Network Settings. This won't delete any of your data — it just refreshes how your phone connects to networks. You'll need to reconnect to WiFi after, but it often fixes this issue."

[If that doesn't work either]
"Okay, let me check on our end. Sometimes there's a provisioning step that didn't complete. I'm going to reactivate your profile right now — this should only take a minute or two."

Resolution Options: Toggle eSIM, reset network settings, re-provision profile, carrier settings update, new eSIM profile.
Closing: "You should be seeing full bars now. If the 'No Service' message ever pops up again, the quickest fix is usually toggling airplane mode on and off. That forces your phone to reconnect. Anything else I can help with?"`
  },

  // ─── PURCHASE / BILLING (8) ───
  {
    title: "Purchase — Comparing Plans",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer trying to decide between different plans.
Emotional State: Analytical, wants value for money, may be comparison shopping.
Detection Cues: "Which plan," "difference between," "compare," "best value," "recommend."

Spoken Script:
"I'd love to help you find the perfect plan! To give you the best recommendation, let me ask you a couple of quick questions. How long is your trip and how do you mainly use your phone — things like browsing, streaming, or mostly just messaging?"

[Based on their answers]
"Based on what you've told me, I'd say our [plan name] is your best bet. It gives you [X GB] of data which is plenty for [their usage]. It covers [X] days and you're looking at [price] — that works out to less than [price per day] a day."

[If they want to compare]
"Our other option would be the [plan name]. It's a bit more at [price], but you get [X GB] extra data and it covers a few more countries. If you think you might need more data or if your plans change, that extra buffer could be worth it."

[Help them decide]
"Honestly, for the trip you described, the [recommended plan] is the sweet spot. But if you want peace of mind and not worry about data at all, the larger plan eliminates that worry completely. Either way, you can always add a top-up if you need more."

Resolution Options: Personalized recommendation, side-by-side comparison, cost-per-day breakdown, trial suggestion.
Closing: "I hope that helps with the decision! Would you like to go ahead and set one up? I can help you through the whole process right now."`
  },
  {
    title: "Purchase — Group or Family Purchase",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer buying eSIMs for multiple travelers — family or group.
Emotional State: Organized, wants a good deal, coordinating logistics.
Detection Cues: "Family trip," "for my wife and kids," "group of," "multiple people," "everyone needs one."

Spoken Script:
"A family trip — how fun! Let me help you get everyone set up. How many people are in your group and are they all going to the same destination?"

[After getting details]
"Great, so for your group of [X], I'd recommend setting up individual plans for each person. That way everyone has their own data and can use it however they need. The good news is you can manage all of them from one account."

[If they ask about group discounts]
"For groups of four or more, we actually have some great bundle pricing. Let me calculate that for you — you'd be looking at [total price] for everyone, which saves you about [percentage] compared to buying them separately."

[Logistics]
"Here's the easiest way to handle it — I'll set up all the eSIMs under your email, and I'll send individual QR codes that you can share with each family member. They can install them on their own phones whenever they're ready."

Resolution Options: Individual plans, family bundle, group discount, single management account, custom package.
Closing: "Everyone is all set! I've sent all the QR codes to your email. Each person just needs to scan their code to install their eSIM. Have an amazing trip with the family!"`
  },
  {
    title: "Purchase — Corporate Account Inquiry",
    category: "Purchase/Billing",
    content: `Caller Profile: Business representative looking for corporate or bulk solutions.
Emotional State: Professional, value-conscious, may need approval process.
Detection Cues: "Corporate," "business account," "employees," "company," "enterprise," "bulk pricing."

Spoken Script:
"We'd love to work with your company! We have solutions specifically designed for businesses with traveling employees. Can you tell me a bit about your needs — roughly how many employees travel and to which regions?"

[After understanding scope]
"For a company of your size, our Business plan would be perfect. It includes centralized management, so your IT team can provision and monitor all eSIMs from one dashboard. You also get priority support and volume pricing."

[If they need a proposal]
"I'd be happy to put together a detailed proposal for you. I'll include our corporate pricing, the management features, and how billing works. Can I get your work email so I can send that over? Most companies have this approved within a day or two."

[Address common business concerns]
"We also provide detailed usage reports for expense reporting, and all charges can be consolidated onto a single corporate invoice. Many of our business clients love that feature for their accounting teams."

Resolution Options: Corporate plan details, custom proposal, demo of management dashboard, connect with enterprise sales.
Closing: "I'll send over that proposal today. In the meantime, if you'd like to try it out, I can set up a pilot with a couple of eSIMs for your team to test. Would that be helpful?"`
  },
  {
    title: "Purchase — Payment Failed",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer whose payment was declined during purchase.
Emotional State: Embarrassed, frustrated, may be in a hurry.
Detection Cues: "Payment failed," "card declined," "won't go through," "error during checkout," "can't pay."

Spoken Script:
"I'm sorry about the payment trouble — this happens sometimes and it's usually a quick fix. Let me help you figure it out. First, can you tell me what error message you're seeing?"

[Diagnose common issues]
"The most common reason for this is that your bank may have flagged it as an international or online transaction. You might want to try giving your bank a quick call to authorize it, or you could try a different card."

[Offer alternatives]
"We also accept several other payment methods. Would you like to try with a different card, or we have options like PayPal and Apple Pay as well. Sometimes switching the payment method resolves it right away."

[If still not working]
"Tell you what — let me create a special payment link for you that sometimes works better than the regular checkout. I'll send it to your email and you can try from there. It goes through a different payment processor that tends to have fewer issues."

Resolution Options: Alternative payment methods, manual payment link, bank authorization guidance, installment options.
Closing: "I see the payment went through this time! Your eSIM is ready and I've sent the QR code to your email. Sorry for the hiccup — glad we got it sorted!"`
  },
  {
    title: "Purchase — Receipt or Invoice Request",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer who needs documentation for expense reporting or records.
Emotional State: Matter-of-fact, business-like, specific requirements.
Detection Cues: "Receipt," "invoice," "proof of purchase," "expense report," "tax purposes."

Spoken Script:
"Of course! I can help you get that documentation. We automatically send a receipt to the email address on your account when you make a purchase. Let me check if that went through for you."

[If receipt was sent]
"It looks like the receipt was sent to [email] right after your purchase. It might be in your spam or promotions folder — would you mind checking there?"

[If they need a formal invoice]
"For a formal invoice with your company details, I can generate one for you right now. I'll just need your company name and address, and any tax ID or VAT number you'd like included."

[For multiple purchases]
"If you need receipts for multiple transactions, I can send you a consolidated statement covering any date range you need. That's usually easier for expense reporting. What time period should I cover?"

Resolution Options: Resend receipt, generate formal invoice, consolidated statement, custom documentation.
Closing: "I've sent that invoice to your email. It includes all the details you'll need for your expense report. If your accounting team needs anything formatted differently, just let us know."`
  },
  {
    title: "Purchase — Plan Renewal Questions",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer approaching the end of their plan wanting to know about renewal.
Emotional State: Proactive, wants to avoid interruption, possibly price-sensitive.
Detection Cues: "Renewal," "expires soon," "extend my plan," "auto-renew," "what happens when."

Spoken Script:
"Great that you're thinking ahead! Let me check your plan status. I can see your current plan expires on [date]. Here are your options for continuing your service."

[Explain renewal options]
"You can renew your current plan at the same rate, or if your needs have changed, we can look at different options. If you renew before your current plan expires, there's no interruption — your data just rolls right over."

[If they want auto-renewal]
"We do have an auto-renewal feature that makes this completely hands-free. I can set that up for you and your plan will automatically renew before it expires. You'll get a notification email a few days before each renewal so you're always in the loop."

[If they want to change plans]
"If you want to switch to a different plan at renewal time, that's totally fine. Your new plan would start as soon as the current one ends. Would you like me to show you what's available?"

Resolution Options: Same plan renewal, plan change, auto-renewal setup, early renewal discount.
Closing: "You're all set for renewal! You won't have to worry about losing service. Is there anything else I can help you plan for?"`
  },
  {
    title: "Purchase — Data Top-Up Request",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer who needs more data on their existing plan.
Emotional State: Urgent, may be currently without data, wants quick solution.
Detection Cues: "Run out of data," "need more data," "top up," "add data," "extra gigs."

Spoken Script:
"I can get you topped up right away! Let me check your current plan and see what top-up options are available for you."

[Check and offer]
"I can see your plan has used up its data allowance. For your current plan, you can add a top-up of [X GB] for [price], or [Y GB] for [price]. The data gets added instantly — you'd be back online in under a minute."

[If they're in a rush]
"Let me get this done as fast as possible. I'll add [X GB] to your plan right now. Can you confirm the last four digits of the card on file, or would you like to use a different payment method?"

[After top-up]
"Your top-up is active! You should be back online now. Try opening a webpage or an app to confirm everything is working."

Resolution Options: Instant top-up, bulk top-up discount, auto top-up setting, plan upgrade instead.
Closing: "You're all topped up and good to go! To avoid running out again, I can set up a low-data alert that will notify you when you're getting close to your limit. Would you like me to turn that on?"`
  },
  {
    title: "Purchase — Price Match Request",
    category: "Purchase/Billing",
    content: `Caller Profile: Customer who found a lower price elsewhere and wants to match it.
Emotional State: Confident, negotiating, wants the best deal.
Detection Cues: "Found cheaper," "price match," "competitor offers," "better deal elsewhere," "why should I."

Spoken Script:
"I appreciate you giving us the chance to earn your business! Can you tell me what plan you're comparing to and where you found it? I want to make sure we're comparing apples to apples."

[After reviewing their comparison]
"So looking at what you've described, our plan actually includes a few things that the other option might not — like [specific benefits]. But I totally understand that price is important."

[Make an offer]
"Here's what I can do for you. I can offer you our [plan name] at [promotional price], which brings it very close to what you saw elsewhere but with all the extras we include. How does that sound?"

[If they still push]
"I want to make sure you feel great about choosing us. Let me also add [bonus — extra data, extended validity, free top-up] as a welcome bonus. That brings the total value way above what you'd get elsewhere."

Resolution Options: Promotional pricing, bundle bonus, extended validity, loyalty credit, competitive analysis.
Closing: "Awesome, I'm glad we could work something out! I've applied the special pricing to your account. You're getting a great deal and great service to go with it. Welcome aboard!"`
  },

  // ─── ESCALATION TRIGGERS (6) ───
  {
    title: "Escalation — Caller Demands Supervisor",
    category: "Escalation Triggers",
    content: `Caller Profile: Customer who is unsatisfied and wants to speak with management.
Emotional State: Determined, feeling unheard, may be angry.
Detection Cues: "Speak to your manager," "supervisor," "someone in charge," "not good enough," "higher up."

Spoken Script:
"I absolutely understand, and I respect your request. Before I connect you, I want to make sure they have all the context so you don't have to repeat yourself. Let me briefly summarize what we've discussed — does this sound right?"

[Summarize the issue]
"You contacted us about [issue], and so far we've tried [solutions]. You're looking for [desired outcome]. Is there anything else I should include in the notes?"

[Transition professionally]
"I'm going to connect you with my supervisor now. Their name is [name] and they have full authority to help resolve this. I've already shared all the details. Please hold for just a moment while I transfer you."

[If supervisor is unavailable]
"My supervisor isn't available at this exact moment, but I have two options for you. I can schedule a callback from them within the next two hours, guaranteed. Or, I can escalate your case to our priority resolution team who can take action right now. Which would you prefer?"

Resolution Options: Warm transfer to supervisor, scheduled callback, priority case escalation, direct authority to resolve.
Closing: "I'm transferring you now. [Supervisor name] will take great care of you. Thank you for your patience, and I'm sorry we couldn't resolve this sooner."`
  },
  {
    title: "Escalation — Legal Threats",
    category: "Escalation Triggers",
    content: `Caller Profile: Customer threatening legal action or regulatory complaints.
Emotional State: Very angry, feeling wronged, possibly mentioning lawyers or agencies.
Detection Cues: "Lawyer," "legal action," "sue," "consumer protection," "BBB," "regulatory," "complaint."

Spoken Script:
"I take your concerns very seriously, and I want to assure you that we want to resolve this. I understand you're frustrated, and I'd like to try to find a solution before it gets to that point. Can you tell me exactly what outcome you're looking for?"

[Listen and acknowledge]
"I hear you. What you're describing is absolutely a valid concern, and I want to make sure we address it properly. Let me escalate this to our resolution team who has the authority to handle situations like this."

[Document carefully]
"I'm documenting everything you've shared with me, and I'm creating a priority case right now. Our resolution team will review this and contact you within twenty-four hours with a proposed solution. Can I confirm the best phone number and email to reach you?"

[De-escalate if possible]
"While I understand the frustration, I genuinely believe we can resolve this directly. Many of our most satisfied customers have been in situations like this and we were able to find a fair solution. Would you be willing to give us forty-eight hours to work on this?"

Resolution Options: Priority case creation, direct escalation to legal/compliance team, expedited resolution, written response commitment.
Closing: "I've created priority case number [X] for you. You'll hear from our resolution team within twenty-four hours. In the meantime, if you need anything, you can reference that case number and you'll be connected to the team handling your situation directly."`
  },
  {
    title: "Escalation — Unresolved After Multiple Contacts",
    category: "Escalation Triggers",
    content: `Caller Profile: Customer who has contacted support multiple times without resolution.
Emotional State: Exhausted, at breaking point, considering leaving.
Detection Cues: "Fifth time calling," "still not fixed," "nobody can help," "going in circles," "about to cancel."

Spoken Script:
"I am truly sorry that you've had to call so many times about this. That is absolutely not acceptable, and I want to own this issue personally. Let me review your entire case history right now."

[After reviewing]
"I can see all your previous contacts and I understand exactly what's been happening. Here's what I'm going to do — I'm assigning myself as your dedicated point of contact for this issue. No more starting over with someone new."

[Take definitive action]
"I'm escalating this to our senior resolution team with a directive to resolve it within twenty-four hours. I'm also going to give you my direct reference number so that if you need to call back, you go straight to someone who knows your case."

[Offer compensation]
"I also want to make this right for the time and frustration you've experienced. I'm applying a [credit/discount/free service] to your account as a gesture of goodwill. You shouldn't have had to go through this."

Resolution Options: Dedicated case owner, senior escalation, compensation, direct callback commitment, service recovery package.
Closing: "Here's your case reference number: [X]. I will personally follow up with you by [specific time] tomorrow. You have my word that this will be resolved. Is there anything else I can address right now?"`
  },
  {
    title: "Escalation — Emergency Connectivity Need",
    category: "Escalation Triggers",
    content: `Caller Profile: Customer in an urgent or emergency situation needing immediate connectivity.
Emotional State: Panicked, scared, desperate for help.
Detection Cues: "Emergency," "urgent," "need it now," "stranded," "safety," "can't reach anyone," "medical."

Spoken Script:
"I can hear this is urgent and I'm here to help you right now. If you're in immediate danger, please call 911 or the local emergency number — those calls work even without data service. Are you safe right now?"

[Once safety is confirmed]
"Okay good. Let me get you connected as fast as possible. I'm going to prioritize your account right now. Give me thirty seconds."

[Take immediate action]
"I've activated an emergency data package on your account at no charge. This should get you connected immediately. Can you try toggling airplane mode on and off? You should see service come up within a minute."

[Follow up]
"Are you connected now? Great. This emergency package gives you enough data to handle what you need right now. Once your situation is resolved, we can sort out your regular plan. The important thing is that you're connected."

Resolution Options: Immediate emergency data activation, free temporary service, priority technical support, local emergency number provision.
Closing: "I'm glad you're connected and safe. Don't worry about anything on the billing side — we'll sort that out later. Right now just focus on what you need to do. Call us back anytime if you need more help."`
  },
  {
    title: "Escalation — Accessibility Needs",
    category: "Escalation Triggers",
    content: `Caller Profile: Customer with a disability who needs accommodations for setup or service.
Emotional State: May feel frustrated by barriers, appreciates patience and understanding.
Detection Cues: "Hard to see," "can't read the screen," "hearing impaired," "disability," "need help setting up," "accessibility."

Spoken Script:
"Of course, I'm happy to help and we'll go at whatever pace works best for you. Can you tell me a bit about what would make this easiest for you?"

[Adapt approach]
"Absolutely. Instead of the QR code scanning, let me give you a method that might be easier. I can send you a direct link that you just tap on, or I can give you a code to type in manually — whichever is more comfortable for you."

[Be patient and thorough]
"Take your time, there's no rush at all. I'll stay on the line as long as you need. If at any point you'd like me to repeat something or explain it differently, just let me know."

[Offer ongoing support]
"I'm also going to add a note to your account about your preferences so that whenever you call us, we can assist you in the way that works best from the start."

Resolution Options: Alternative setup methods, extended call time, accessibility notes on account, dedicated support channel.
Closing: "I'm really glad we could get this set up for you. Your account is all noted with your preferences. Anytime you call, we'll be ready to help in the way that works best for you. Take care!"`
  },
  {
    title: "Escalation — Language Barrier",
    category: "Escalation Triggers",
    content: `Caller Profile: Customer whose primary language differs from the support language.
Emotional State: Frustrated by communication difficulty, may feel embarrassed, determined to get help.
Detection Cues: Broken sentences, frequent pauses, "don't speak English well," asks for translation, difficulty understanding instructions.

Spoken Script:
"No problem at all. I want to make sure you get the help you need. Let me speak slowly and I'll keep things as simple as possible. If you need me to repeat anything, just say 'again' and I will."

[Simplify communication]
"I'm going to explain things one small step at a time. After each step, I'll pause and you can tell me if you're ready for the next one. There's no rush."

[If available]
"I'd like to try connecting you with a team member who might speak your language. Can you tell me which language is most comfortable for you? I'll do my best to find someone."

[If no translator available]
"While I don't have someone who speaks [language] available right now, I'm going to send you written instructions by email in [language] so you can follow along at your own pace. Would that be helpful?"

Resolution Options: Multilingual support transfer, translated written instructions, simplified step-by-step, callback with interpreter.
Closing: "I hope we were able to help you today. I'm sending those translated instructions now. If you need more help, please call back anytime — we're always happy to assist."`
  },

  // ─── POSITIVE / UPSELL (6) ───
  {
    title: "Positive — Customer Wants to Share Experience",
    category: "Positive/Upsell",
    content: `Caller Profile: Happy customer who wants to leave positive feedback or refer friends.
Emotional State: Enthusiastic, grateful, excited about the product.
Detection Cues: "Great experience," "want to recommend," "love this," "tell my friends," "really impressed."

Spoken Script:
"That is so wonderful to hear, thank you! It really means a lot to us when customers have a great experience. I'm thrilled that everything worked well for you!"

[Encourage sharing]
"If you'd like, you can leave a review on our website or app — that really helps other travelers find us. And we actually have a referral program where you and your friend both get a bonus when they sign up."

[Capture the opportunity]
"Would you like me to send you a referral link? When your friend uses it, you both get [incentive] on your next plan. It's our way of saying thank you for spreading the word."

[Ask for details]
"I'd love to hear more about your trip! What destination were you visiting? Stories like yours help us understand what we're doing right."

Resolution Options: Referral link, review invitation, testimonial capture, loyalty program enrollment.
Closing: "Thank you so much for sharing that with us. I've sent your referral link to your email. We really appreciate you being part of our community! Happy travels!"`
  },
  {
    title: "Positive — Interested in More Destinations",
    category: "Positive/Upsell",
    content: `Caller Profile: Satisfied customer planning additional trips.
Emotional State: Excited, loyal, open to recommendations.
Detection Cues: "Next trip," "also going to," "another destination," "more countries," "travel a lot."

Spoken Script:
"That's exciting — sounds like you've got the travel bug! Where are you headed next? I'd love to help you find the perfect plan for your upcoming adventures."

[After learning about their plans]
"For someone who travels as much as you do, you might want to look at our annual or multi-trip plans. They give you coverage across multiple destinations at a much better rate than buying individual plans each time."

[Highlight value]
"With our frequent traveler plan, you'd actually save about [percentage] compared to what you spent on individual plans last year. Plus, you'd always have coverage ready to go whenever you decide to take off on a trip."

[Create excitement]
"And here's something cool — we recently added coverage in [new countries]. So if any of those are on your bucket list, you're covered!"

Resolution Options: Multi-trip plan, annual coverage, destination bundles, loyalty pricing, early access to new destinations.
Closing: "I've set up your multi-trip plan and you're now covered for your next adventure. Just activate it when you land and you're good to go. Let us know about your next trip — we'd love to hear about it!"`
  },
  {
    title: "Positive — Corporate Partnership Interest",
    category: "Positive/Upsell",
    content: `Caller Profile: Business owner or travel manager looking for a long-term partnership.
Emotional State: Professional, sees value, wants to explore deeper relationship.
Detection Cues: "Partnership," "ongoing relationship," "all our employees," "preferred vendor," "contract."

Spoken Script:
"That's fantastic — we'd be thrilled to partner with your organization! We work with many companies that have traveling teams, and we've designed our business solutions specifically for situations like yours."

[Explore needs]
"To put together the right package, I'd love to understand your needs better. How many employees typically travel in a month, and what regions do they usually visit?"

[Present solution]
"Based on what you've described, our Corporate Partner program would be ideal. It includes volume pricing, a dedicated account manager, centralized billing, and a management portal where your team can self-serve."

[Next steps]
"I'd like to set up a brief call with our partnerships team — they can walk you through all the details and customize a plan specifically for your organization. What day works best for you?"

Resolution Options: Corporate partnership proposal, dedicated account manager, pilot program, custom pricing, executive meeting.
Closing: "I'm going to connect you with our partnerships team and they'll have a proposal ready for you by [date]. Thank you for considering us — I think this is going to be a great fit!"`
  },
  {
    title: "Positive — Affiliate or Reseller Interest",
    category: "Positive/Upsell",
    content: `Caller Profile: Content creator, travel blogger, or business wanting to resell eSIMs.
Emotional State: Entrepreneurial, excited about opportunity, wants details.
Detection Cues: "Affiliate program," "resell," "commission," "promote," "blog about," "travel influencer."

Spoken Script:
"That sounds great — we'd love to work with you! We have an affiliate program that's been really popular with travel bloggers and content creators. Let me tell you about it."

[Explain the program]
"As an affiliate, you get a unique referral link that you can share with your audience. For every customer who signs up through your link, you earn a commission on their purchase. Our top affiliates are earning some really great passive income from it."

[If they want to resell]
"For reselling, we have a white-label option where you can offer our eSIMs under your own brand. You set your own prices and keep the margin. We handle all the technical infrastructure and customer support behind the scenes."

[Get them started]
"To get started, I'll need a few details from you. Can you share your website or social media handles? Our partnership team reviews applications within forty-eight hours and will get you set up with everything you need."

Resolution Options: Affiliate signup, commission structure details, white-label program, marketing materials, co-branded campaigns.
Closing: "I've submitted your application to our partnerships team. You'll hear back within forty-eight hours with your unique affiliate setup. We're excited to have you on board!"`
  },
  {
    title: "Positive — Media or Press Inquiry",
    category: "Positive/Upsell",
    content: `Caller Profile: Journalist or media representative seeking information for a story.
Emotional State: Professional, on deadline, wants accurate information quickly.
Detection Cues: "Press," "media," "writing an article," "journalist," "publication," "interview."

Spoken Script:
"Thank you for reaching out to us! We're always happy to work with the media. Can you tell me a bit about what you're working on and what publication it's for?"

[Understand their needs]
"That sounds like a great piece. I'd be happy to help connect you with the right person on our team. For press inquiries, our communications team can provide official statements, data points, and arrange interviews."

[Provide immediate help]
"In the meantime, I can share some general information that might help with your article. For example, we currently serve customers in over [X] countries and our platform handles [X] active connections. Would details like that be useful?"

[Connect to PR]
"Let me get you in touch with our press team directly. They can provide you with a press kit, high-resolution assets, and arrange any interviews you might need. Can I get your email so they can reach out to you?"

Resolution Options: Press team connection, press kit, interview arrangement, data points and statistics, review unit.
Closing: "I've forwarded your details to our press team and they'll be in touch by [timeframe]. If you have any urgent questions before then, feel free to call back and ask for the media liaison. Good luck with the article!"`
  },
  {
    title: "Positive — Bulk Purchase for Event or Tour",
    category: "Positive/Upsell",
    content: `Caller Profile: Tour operator or event organizer needing eSIMs for a large group.
Emotional State: Organized, deadline-driven, wants efficiency and pricing.
Detection Cues: "Bulk order," "large group," "tour group," "conference," "event," "50 people," "attendees."

Spoken Script:
"A bulk order — excellent! We work with tour operators and event organizers all the time. How many eSIMs do you need and what's the destination?"

[Get details]
"For [X] people going to [destination], I can put together a group package that's going to save you a significant amount compared to individual pricing. Let me calculate that for you."

[Present the offer]
"At bulk pricing, you're looking at [price] per person, which is [percentage] off our regular rate. For [X] people, that comes to [total]. And I can have all the QR codes ready for distribution at least a week before your departure date."

[Logistics]
"For the logistics, I can either send you a spreadsheet with all the individual QR codes, or I can set up a self-serve portal where your attendees can claim their own eSIMs using a group code. Which approach works better for your event?"

Resolution Options: Bulk pricing, custom group portal, pre-departure distribution, on-site setup support, volume tiers.
Closing: "I'll have the full proposal and pricing breakdown in your inbox by tomorrow morning. Once you confirm, we can have everything ready well before your event date. This is going to make connectivity one less thing for your group to worry about!"`
  },

  // ─── EDGE CASES (6) ───
  {
    title: "Edge Case — Wrong Timezone Activation Issue",
    category: "Edge Cases",
    content: `Caller Profile: Customer whose plan activated at an unexpected time due to timezone differences.
Emotional State: Confused, may feel cheated out of time, wants fair treatment.
Detection Cues: "Started early," "wrong time," "already counting down," "timezone," "lost a day."

Spoken Script:
"I understand the confusion — timezone differences can definitely cause some unexpected timing with plan activations. Let me look into this for you."

[Explain what happened]
"So here's what happened — your plan activated based on [timezone], which is different from your local time. I can see how that would feel like you lost some of your plan duration."

[Make it right]
"Here's what I'm going to do — I'm adding an extra day to your plan to make up for the timezone difference. That way you get the full duration you expected."

[Prevent future issues]
"For your next trip, here's a pro tip: install your eSIM before you leave but don't turn it on until you actually arrive at your destination. That way the clock starts when you want it to."

Resolution Options: Extension of plan duration, credit for lost time, activation timing adjustment, future prevention tips.
Closing: "I've extended your plan by a full day. You now have until [new expiry] to use your data. And remember that tip about waiting to activate next time — it'll save you from this happening again!"`
  },
  {
    title: "Edge Case — Unsupported Country Inquiry",
    category: "Edge Cases",
    content: `Caller Profile: Customer wanting service in a country not currently covered.
Emotional State: Disappointed, may be urgent if trip is soon, seeking alternatives.
Detection Cues: "Do you cover [country]," "not listed," "not available," "any plans for," "when will you."

Spoken Script:
"Let me check our coverage for [country]. I want to give you accurate information rather than guessing."

[If not covered]
"I want to be straightforward with you — we don't currently have coverage in [country]. I know that's not what you wanted to hear, and I'm sorry about that."

[Offer alternatives]
"But let me see if I can still help. We do cover several neighboring countries, including [list]. If your trip includes any of those, we can definitely help with those portions. And for [unsupported country], you might want to check with local providers at the airport when you arrive — I can give you some tips for that."

[Show commitment]
"I'm going to make a note that you requested coverage for [country]. We're always expanding our network, and customer demand definitely influences which countries we add next. I wish I could give you a specific timeline, but I'll make sure your request is logged."

Resolution Options: Alternative destination coverage, neighboring country plans, local provider tips, waitlist notification, partial trip coverage.
Closing: "I'm sorry we couldn't help with [country] this time, but I hope the tips for local options help. When we do add coverage there, you'll be the first to know. Have a wonderful trip!"`
  },
  {
    title: "Edge Case — Dual eSIM Conflicts",
    category: "Edge Cases",
    content: `Caller Profile: Customer with two eSIM profiles that are conflicting.
Emotional State: Confused by technical complexity, frustrated that things aren't working cleanly.
Detection Cues: "Two eSIMs," "conflicting," "which one is active," "both installed," "keeps switching."

Spoken Script:
"Having two eSIM profiles can sometimes cause a little confusion for your phone. Let's sort this out so both work smoothly. Can you tell me which two eSIMs you have installed?"

[Diagnose the conflict]
"The issue is that your phone is trying to use both for data at the same time. We need to tell it which one to use for what. Let me walk you through the settings."

[Guide resolution]
"Go to Settings, then Cellular. You'll see both your eSIM lines listed. Tap on the one you want to use for data, and make sure only that one has 'Turn On This Line' and 'Data Roaming' enabled. For the other one, you can keep it on for calls and texts but turn off its data."

[Verify it's working]
"Now toggle airplane mode on and off. Your phone should reconnect using just the eSIM you selected for data. Try opening a website to confirm it's working."

Resolution Options: eSIM prioritization settings, remove unused profile, configure line assignments, device-specific dual eSIM guide.
Closing: "Both eSIMs should be working harmoniously now — one for your calls and the other for data. If they start conflicting again, just go back to those settings and double-check the data line assignment."`
  },
  {
    title: "Edge Case — Device Change Mid-Trip",
    category: "Edge Cases",
    content: `Caller Profile: Customer who needs to move their eSIM to a different phone while traveling.
Emotional State: Stressed, possibly dealing with a broken phone, time-sensitive.
Detection Cues: "New phone," "phone broke," "switch devices," "transfer eSIM," "different phone."

Spoken Script:
"Oh no, I'm sorry about your phone situation! Let's get you connected on your new device as quickly as possible. The good news is your plan and data are tied to your account, not to the physical device."

[Explain the process]
"Unfortunately, eSIM profiles can't be directly transferred between phones. But here's what we can do — I'll issue you a brand new QR code right now that you can install on your new device. Your remaining data and plan time will carry over completely."

[If old phone still works]
"If your old phone is still working, you should remove the eSIM from it first. Go to Settings, Cellular, tap on the eSIM line, and choose Remove eSIM. Then scan the new QR code on your new phone."

[If old phone is broken]
"Since you can't access your old phone, don't worry about removing the old eSIM. I'll deactivate it on our end and the new QR code will be your active profile. I'm generating it right now."

Resolution Options: New QR code for new device, remote deactivation of old profile, expedited replacement, no-cost reissue.
Closing: "You're all set on your new device! Your remaining [X GB] of data and [X days] are right where you left them. I hope the rest of your trip goes smoothly!"`
  },
  {
    title: "Edge Case — eSIM Transfer Between Accounts",
    category: "Edge Cases",
    content: `Caller Profile: Customer who wants to give their unused eSIM plan to someone else.
Emotional State: Practical, may feel the plan is going to waste, wants flexibility.
Detection Cues: "Give to someone," "transfer to friend," "not using it," "share my plan," "give the rest."

Spoken Script:
"That's a thoughtful idea! Let me check what options we have for that. Can you tell me a bit more about the situation — do you have unused data you'd like to share?"

[Explain transfer possibilities]
"So here's how it works — our eSIM plans are tied to the device they're installed on for security reasons. We can't directly transfer an active plan to another person's phone."

[Offer alternatives]
"But here's what we can do. If the plan hasn't been activated yet, meaning the QR code hasn't been scanned, your friend can simply scan it on their phone instead. Unused plans are totally transferable."

[If already activated]
"Since your plan is already active, the simplest option would be for your friend to get their own plan. I can offer them a discount using your referral link, so they save money and you get a credit too. Would that work?"

Resolution Options: Transfer unused QR code, referral discount for friend, pause plan for future use, convert to credit.
Closing: "I think that referral approach will work great for both of you. I've sent your referral link to your email — just share it with your friend and they'll get [discount] off their first plan."`
  },
  {
    title: "Edge Case — Expired Plan Data Recovery",
    category: "Edge Cases",
    content: `Caller Profile: Customer whose plan expired and wants to know about their remaining data.
Emotional State: Disappointed, hoping to recover lost value, may feel it's unfair.
Detection Cues: "Plan expired," "still had data left," "can I get it back," "unused data," "wasted."

Spoken Script:
"I understand the frustration — having unused data expire never feels great. Let me look at your account and see what happened."

[Review the situation]
"I can see your plan expired on [date] and you still had [X GB] remaining. Unfortunately, once a plan expires, the data allocation does reset. I know that's not ideal."

[Offer a fair resolution]
"Here's what I can do for you. Since you had a significant amount of data left, I'm going to give you a [discount/credit] toward your next plan. That way you're not losing out on the value you already paid for."

[Suggest prevention]
"For next time, there are a couple of ways to avoid this. We have plans with longer validity periods, or I can set up an expiry reminder that alerts you a few days before your plan ends so you can use up your data or extend it."

Resolution Options: Courtesy credit, discounted renewal, extended validity plan, expiry reminders, data rollover options.
Closing: "I've applied a [credit amount] to your account that you can use toward any future plan. And I've turned on expiry reminders so you'll get a heads-up next time. No more wasted data!"`
  },
];

export async function seedConversationScenarios(userId: string): Promise<{ created: number; skipped: number; folderId: string }> {
  let created = 0;
  let skipped = 0;

  const existingFolders = await db
    .select()
    .from(knowledgeFolders)
    .where(and(
      eq(knowledgeFolders.userId, userId),
      eq(knowledgeFolders.name, SCENARIO_FOLDER_NAME)
    ));

  let folderId: string;
  if (existingFolders.length > 0) {
    folderId = existingFolders[0].id;
  } else {
    const [newFolder] = await db
      .insert(knowledgeFolders)
      .values({
        userId,
        name: SCENARIO_FOLDER_NAME,
        icon: SCENARIO_FOLDER_ICON,
        sortOrder: SCENARIO_FOLDER_SORT_ORDER,
      })
      .returning();
    folderId = newFolder.id;
  }

  for (const scenario of SCENARIO_SCRIPTS) {
    const existing = await db
      .select()
      .from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.userId, userId),
        eq(knowledgeBase.folderId, folderId),
        eq(knowledgeBase.title, scenario.title)
      ));

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const contentSize = Buffer.byteLength(scenario.content, 'utf8');

    await db.insert(knowledgeBase).values({
      userId,
      folderId,
      type: 'text',
      title: scenario.title,
      content: scenario.content,
      storageSize: contentSize,
      metadata: {
        category: scenario.category,
        scenarioType: 'conversation_script',
        voiceReady: true,
      },
    });

    created++;
  }

  console.log(`[Scenario Seeds] Created ${created}, skipped ${skipped} (total: ${SCENARIO_SCRIPTS.length}) for user ${userId} in folder ${folderId}`);

  return { created, skipped, folderId };
}

export async function seedAndProcessScenarios(userId: string): Promise<{ created: number; skipped: number; folderId: string; chunksProcessed: number }> {
  const result = await seedConversationScenarios(userId);
  let chunksProcessed = 0;

  if (result.created > 0) {
    const entries = await db
      .select()
      .from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.userId, userId),
        eq(knowledgeBase.folderId, result.folderId)
      ));

    for (const entry of entries) {
      if (entry.content) {
        try {
          const processResult = await RAGKnowledgeService.processKnowledgeItem(
            entry.id,
            userId,
            entry.content,
            {
              title: entry.title,
              type: entry.type,
              category: (entry.metadata as any)?.category,
              scenarioType: 'conversation_script',
            }
          );
          if (processResult.success) {
            chunksProcessed += processResult.chunksCreated;
          }
        } catch (err: any) {
          console.error(`[Scenario Seeds] Failed to process "${entry.title}":`, err.message);
        }
      }
    }
  }

  return { ...result, chunksProcessed };
}
