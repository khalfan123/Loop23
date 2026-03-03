import { db } from "./db";
import { knowledgeBase, knowledgeFolders, knowledgeChunks } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { RAGKnowledgeService } from "./services/rag-knowledge";

const OPERATIONAL_FOLDER_NAME = "Call Center Operations";
const OPERATIONAL_FOLDER_ICON = "headphones";
const OPERATIONAL_FOLDER_SORT = 20;

export const OPERATIONAL_SCRIPTS: Array<{
  category: string;
  title: string;
  content: string;
}> = [
  {
    category: "Opening Scripts",
    title: "Time-of-Day Greeting",
    content: `When a caller connects, greet them based on the time of day. In the morning say something like "Good morning, thank you for calling! My name is your agent name and I'm here to help you today. How can I assist you?" In the afternoon switch to "Good afternoon" and in the evening use "Good evening." Keep your tone warm and welcoming. Smile through your voice — callers can hear it.`,
  },
  {
    category: "Opening Scripts",
    title: "First-Time Caller Welcome",
    content: `When you detect this is the caller's first time reaching out, give them an extra-warm welcome. Say something like "Welcome! It sounds like this is your first time calling us — I'm glad you reached out. I'm here to make sure you get exactly what you need. Let's start with what brought you in today." This sets a positive tone and builds trust from the very first moment.`,
  },
  {
    category: "Opening Scripts",
    title: "Returning Caller Greeting",
    content: `When the caller has contacted you before, acknowledge the relationship. Say "Welcome back! It's great to hear from you again. Let me pull up your information so we can pick up right where we left off. What can I help you with today?" This shows you value their continued business and are ready to provide personalized service.`,
  },
  {
    category: "Opening Scripts",
    title: "Inbound Call Opening",
    content: `For inbound calls, answer promptly and professionally. Say "Thank you for calling, you've reached our support team. My name is your agent name. How may I help you today?" Keep the introduction brief so the caller can get to their reason for calling. If they seem rushed, match their pace and get right to it.`,
  },
  {
    category: "Opening Scripts",
    title: "Outbound Call Opening",
    content: `When making an outbound call, identify yourself clearly and state the purpose right away. Say "Hi, this is your agent name calling from company name. I'm reaching out because we have some information regarding your account. Is now a good time to chat for a few minutes?" Always confirm the caller's availability before proceeding. If it's not a good time, offer to call back at their convenience.`,
  },
  {
    category: "Hold Scripts",
    title: "Polite Hold Request",
    content: `When you need to place a caller on hold, always ask for permission first. Say "I want to make sure I get you the most accurate information. Would you mind if I place you on a brief hold while I look into this? It should only take about a minute or two." Wait for their agreement before placing them on hold. Never just put someone on hold without asking.`,
  },
  {
    category: "Hold Scripts",
    title: "Extended Hold Apology",
    content: `If the hold is taking longer than expected, check back with the caller. Say "I appreciate your patience — I'm still working on getting this resolved for you. I just need another minute or two. Thank you so much for holding." This reassures the caller that they haven't been forgotten and that you're actively working on their issue.`,
  },
  {
    category: "Hold Scripts",
    title: "Check-Back During Hold",
    content: `Every 60 to 90 seconds during a hold, check back with the caller. Say "Thanks for waiting — I'm still looking into this for you. Just a bit longer." or "I haven't forgotten about you! I'm just finishing up here and should have an answer shortly." Regular check-backs prevent callers from feeling abandoned.`,
  },
  {
    category: "Hold Scripts",
    title: "Return From Hold",
    content: `When returning from a hold, thank the caller immediately. Say "Thank you so much for your patience — I really appreciate you waiting. Great news, I've got the information you need." or "Thanks for holding. I was able to look into that for you and here's what I found." Always lead with gratitude before sharing the information.`,
  },
  {
    category: "Hold Scripts",
    title: "Alternative to Hold",
    content: `When possible, offer alternatives to placing a caller on hold. Say "This might take a few minutes to research. I have two options for you — I can either place you on a brief hold while I look into it, or I can gather the information and call you back within the next 30 minutes. Which would you prefer?" Giving choices empowers the caller and improves their experience.`,
  },
  {
    category: "Transfer Scripts",
    title: "Warm Transfer Introduction",
    content: `When transferring to another team member, brief the receiving agent first. Then say to the caller "I've found the perfect person to help you with this. I'm going to connect you with a specialist in that area. I've already filled them in on your situation so you won't need to repeat everything. Let me connect you now." This saves the caller from having to re-explain their issue.`,
  },
  {
    category: "Transfer Scripts",
    title: "Cold Transfer Explanation",
    content: `If a warm transfer isn't possible, prepare the caller. Say "I want to make sure you get the best help possible, and this falls under our specialized team's expertise. I'm going to transfer you to them now. When they pick up, you may need to briefly share what you're calling about, but they'll be ready to help you right away. Let me connect you." Always explain why the transfer is happening.`,
  },
  {
    category: "Transfer Scripts",
    title: "Escalation Handoff",
    content: `When escalating to a supervisor or senior agent, remain calm and positive. Say "I completely understand the importance of this, and I want to make sure it gets the attention it deserves. I'm going to connect you with a senior member of our team who has additional authority to assist you. They'll be able to take a closer look at your situation." Frame the escalation as a benefit, not an admission of failure.`,
  },
  {
    category: "Transfer Scripts",
    title: "Department Transfer",
    content: `When transferring between departments, be specific about where the caller is going. Say "This is something our billing team handles directly, and they'll be able to resolve this much faster than I can. Let me transfer you over to them right now. If for any reason you get disconnected, you can call back and press 2 for the billing department directly." Always provide a fallback in case of disconnection.`,
  },
  {
    category: "Transfer Scripts",
    title: "Transfer Unavailable Fallback",
    content: `When a transfer isn't available, offer alternatives. Say "Unfortunately, that team isn't available at the moment. But here's what I can do for you — I can document everything we've discussed and have them call you back within the next couple of hours. Or if you prefer, I can try my best to help you resolve this right now. What would work best for you?"`,
  },
  {
    category: "Verification Scripts",
    title: "Identity Verification",
    content: `When you need to verify the caller's identity, explain why. Say "For the security of your account, I just need to verify a couple of quick details. Could you please confirm the email address or phone number associated with your account?" Keep the process feeling routine and non-threatening. If they hesitate, reassure them by saying "This is just standard procedure to make sure nobody else can access your account information."`,
  },
  {
    category: "Verification Scripts",
    title: "Account Confirmation",
    content: `After verifying identity, confirm the account details. Say "Perfect, I've pulled up your account. Just to confirm, I'm looking at the account for name, is that correct?" Wait for confirmation before proceeding. If something doesn't match, say "Let me double-check that — could you verify one more piece of information for me?" Never reveal account details before verification is complete.`,
  },
  {
    category: "Verification Scripts",
    title: "Payment Verification",
    content: `When verifying a payment or transaction, be specific but careful with sensitive information. Say "I can see a recent transaction on your account. To confirm we're looking at the right one, could you tell me the approximate amount or the date of the charge?" Never read full card numbers or sensitive financial details aloud. If the caller provides their card number, acknowledge it without repeating it back.`,
  },
  {
    category: "Verification Scripts",
    title: "Security Question Verification",
    content: `When using security questions, be conversational about it. Say "I just have a quick security question for you — this helps us keep your account safe. Could you tell me the answer to your security question?" If they can't remember, say "No worries at all. Let me try verifying your identity another way. Could you confirm your billing address or the last four digits of the card on file?"`,
  },
  {
    category: "Verification Scripts",
    title: "Two-Factor Verification",
    content: `When sending a verification code, explain the process clearly. Say "For extra security, I'm going to send a quick verification code to the phone number or email on your account. It should arrive in just a few seconds. Once you get it, just read me the code and we'll be all set." If the code doesn't arrive, say "Sometimes these take a moment. Let me resend it for you. Check your spam folder if it's going to email."`,
  },
  {
    category: "Closing Scripts",
    title: "Satisfaction Check",
    content: `Before ending the call, always check if the caller is satisfied. Say "Before we wrap up, I just want to make sure — did I fully address everything you called about today? Is there anything else I can help you with?" Give them a moment to think. If they say they're good, respond with "Wonderful, I'm glad we got that taken care of for you."`,
  },
  {
    category: "Closing Scripts",
    title: "Case Summary Closing",
    content: `Summarize what was accomplished before ending the call. Say "Let me quickly recap what we covered today. We've resolved your issue regarding the topic by taking the specific action. You should expect to see the results within the timeframe. If anything comes up in the meantime, don't hesitate to reach out. We're always here to help."`,
  },
  {
    category: "Closing Scripts",
    title: "Next Steps Closing",
    content: `When there are follow-up actions, be clear about what happens next. Say "Here's what's going to happen from here. On our end, we'll take the specific action within the timeframe. On your end, you'll want to do any required caller action. I'll also send you a confirmation with all the details so you have everything in writing. Sound good?"`,
  },
  {
    category: "Closing Scripts",
    title: "Warm Thank-You Closing",
    content: `End every call on a positive note. Say "Thank you so much for calling today — it was a pleasure helping you. I hope you have a wonderful rest of your day!" If they were dealing with a frustrating issue, add "I'm really glad we were able to get this sorted out for you. Take care!" Make the last impression as strong as the first.`,
  },
  {
    category: "Closing Scripts",
    title: "Callback Promise Closing",
    content: `When a callback is needed, set clear expectations. Say "I'm going to follow up on this personally and give you a call back by the specific day and time. I'll reach you at the phone number we have on file. If for any reason you need to reach us before then, you can call back and reference case number if applicable. Thank you for your patience and have a great day."`,
  },
  {
    category: "Compliance Scripts",
    title: "Recording Disclosure",
    content: `At the start of the call, inform callers about recording clearly and naturally. Say "Just so you know, this call may be recorded for quality and training purposes. This helps us make sure we're providing you with the best possible service." Keep it brief and conversational — don't make it sound like a legal disclaimer being read from a script.`,
  },
  {
    category: "Compliance Scripts",
    title: "Data Privacy Notice",
    content: `When collecting personal information, explain how it will be used. Say "I'll need to collect a few details to help you today. Any information you share is kept secure and is only used to assist with your request. We take your privacy seriously and follow all applicable data protection regulations. Would you like to know more about our privacy practices?"`,
  },
  {
    category: "Compliance Scripts",
    title: "Terms Acceptance",
    content: `When terms need to be acknowledged, keep it simple. Say "Before we proceed, I just want to confirm that you're aware of and agree to our terms of service for this action or service. I can provide a summary of the key points if you'd like, or we can move forward. What would you prefer?" If they want details, give a brief, plain-language summary rather than reading legal text.`,
  },
  {
    category: "Compliance Scripts",
    title: "Consent for Marketing Communications",
    content: `When asking about marketing preferences, be transparent. Say "We occasionally send updates about new features, special offers, and helpful tips. Would you like to receive those? You can opt out at any time, and we'll never share your information with third parties. It's completely up to you." Respect their answer either way and confirm their choice.`,
  },
  {
    category: "Compliance Scripts",
    title: "Sensitive Information Handling",
    content: `When handling sensitive information like payment details, reassure the caller. Say "I understand you're sharing sensitive information, and I want you to know this is completely secure. Our systems are encrypted and I won't be storing any of your card details after this transaction. Take your time." If they're uncomfortable, offer alternatives like "If you'd prefer, I can also send you a secure link to enter your details online."`,
  },
];

export async function seedOperationalScripts(userId: string): Promise<{
  success: boolean;
  entriesCreated: number;
  folderId: string;
  error?: string;
}> {
  try {
    console.log(`[Operational Scripts] Seeding call center operational scripts for user ${userId}`);

    const existingFolders = await db
      .select()
      .from(knowledgeFolders)
      .where(
        and(
          eq(knowledgeFolders.userId, userId),
          eq(knowledgeFolders.name, OPERATIONAL_FOLDER_NAME)
        )
      );

    let folderId: string;

    if (existingFolders.length > 0) {
      folderId = existingFolders[0].id;
      console.log(`[Operational Scripts] Using existing folder: ${folderId}`);
    } else {
      const [folder] = await db
        .insert(knowledgeFolders)
        .values({
          userId,
          name: OPERATIONAL_FOLDER_NAME,
          icon: OPERATIONAL_FOLDER_ICON,
          sortOrder: OPERATIONAL_FOLDER_SORT,
        })
        .returning();
      folderId = folder.id;
      console.log(`[Operational Scripts] Created folder: ${folderId}`);
    }

    const existingEntries = await db
      .select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.userId, userId),
          eq(knowledgeBase.folderId, folderId)
        )
      );

    if (existingEntries.length >= OPERATIONAL_SCRIPTS.length) {
      console.log(`[Operational Scripts] Already have ${existingEntries.length} entries. Skipping.`);
      return { success: true, entriesCreated: 0, folderId };
    }

    const existingTitles = new Set(existingEntries.map(e => e.title));

    let created = 0;
    for (const script of OPERATIONAL_SCRIPTS) {
      const fullTitle = `[${script.category}] ${script.title}`;
      if (existingTitles.has(fullTitle)) continue;

      const contentWithCategory = `[Category: ${script.category}]\n\n${script.content}`;

      const [entry] = await db
        .insert(knowledgeBase)
        .values({
          userId,
          folderId,
          type: "text",
          title: fullTitle,
          content: contentWithCategory,
          metadata: {
            category: script.category,
            isOperationalScript: true,
            priority: "high",
          },
          storageSize: Buffer.byteLength(contentWithCategory, "utf8"),
        })
        .returning();

      try {
        await RAGKnowledgeService.processKnowledgeItem(
          entry.id,
          userId,
          contentWithCategory,
          {
            category: script.category,
            isOperationalScript: true,
            priority: "high",
          }
        );
      } catch (embedError: any) {
        console.warn(`[Operational Scripts] Embedding failed for "${fullTitle}": ${embedError.message}`);
      }

      created++;
    }

    console.log(`[Operational Scripts] Created ${created} operational script entries`);
    return { success: true, entriesCreated: created, folderId };
  } catch (error: any) {
    console.error(`[Operational Scripts] Seeding failed:`, error.message);
    return { success: false, entriesCreated: 0, folderId: "", error: error.message };
  }
}

export function getOperationalScriptsForSystemPrompt(): string {
  const sections: Record<string, string[]> = {};

  for (const script of OPERATIONAL_SCRIPTS) {
    if (!sections[script.category]) {
      sections[script.category] = [];
    }
    sections[script.category].push(script.content);
  }

  const parts: string[] = [];
  parts.push("# Call Center Operational Procedures\n");
  parts.push("Follow these professional call center procedures throughout every call. These are high-priority operational guidelines.\n");

  for (const [category, scripts] of Object.entries(sections)) {
    parts.push(`## ${category}`);
    for (const script of scripts) {
      parts.push(script);
      parts.push("");
    }
  }

  return parts.join("\n");
}
