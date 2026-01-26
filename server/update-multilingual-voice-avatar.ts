/**
 * Update Multilingual Agents with Voice and Avatar
 * Copies voice settings and avatars from English agents to their translations
 * Uses gender-based voice selection for agents without voice assignments
 */

import { db } from "./db";
import { agents } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { getElevenLabsVoiceForAgent, detectGender } from "./services/avatar-generator";

interface EnglishAgentVoice {
  name: string;
  openaiVoice: string | null;
  elevenLabsVoiceId: string | null;
  avatarUrl: string | null;
}

const NAME_MAPPINGS: Record<string, string[]> = {
  "Marcus Sterling": ["马超 (Ma Chao)", "أحمد الصالح", "Marc Dupont", "Marco Rossi", "मनीष शर्मा (Manish Sharma)"],
  "Sophia Chen": ["陈雅婷 (Chen Yating)", "سارة الحسيني", "Sophie Martin", "Sofia Bianchi", "सोफिया चेन (Sophia Chen)"],
  "James Rodriguez": ["李明 (Li Ming)", "محمد العلي", "Jacques Bernard", "Giacomo Ferrari", "जयेश राव (Jayesh Rao)"],
  "Alex Thompson": ["张伟 (Zhang Wei)", "خالد المنصور", "Alexandre Moreau", "Alessandro Romano", "अलेक्स त्रिपाठी (Alex Tripathi)"],
  "Emily Watson": ["王芳 (Wang Fang)", "فاطمة الزهراء", "Émilie Dubois", "Emilia Colombo", "ईमिली वर्मा (Emily Verma)"],
  "Sarah Mitchell": ["刘静 (Liu Jing)", "نور القحطاني", "Sarah Lefebvre", "Sara Ricci", "सारा मिश्रा (Sara Mishra)"],
  "David Park": ["朴大卫 (Piao Dawei)", "يوسف الحربي", "David Leroy", "Davide Parco", "दीपक पार्क (Deepak Park)"],
  "Rachel Green": ["赵欣 (Zhao Xin)", "ليلى الراشد", "Rachel Girard", "Rachele Verdi", "राधिका गुप्ता (Radhika Gupta)"],
  "Jessica Lee": ["李佳琪 (Li Jiaqi)", "مريم العتيبي", "Jessica Rousseau", "Jessica Esposito", "जेसिका सिंह (Jessica Singh)"],
  "Jennifer Adams": ["金美玲 (Jin Meiling)", "هند السعيد", "Jennifer Adam", "Ginevra Adami", "जेनिफर आदम (Jennifer Adam)"],
  "Dr. Amanda Foster": ["傅博士 (Dr. Fu)", "د. أمل المهدي", "Dr. Amanda Fontaine", "Dott.ssa Amanda Fiorentino", "डॉ. अमांडा फोस्टर (Dr. Amanda Foster)"],
  "Kevin O'Brien": ["欧阳凯 (Ouyang Kai)", "كريم البدوي", "Kevin Blanc", "Kevin Bruno", "केविन ओ'ब्रायन (Kevin O'Brien)"],
  "Linda Matthews": ["林小萌 (Lin Xiaomeng)", "رانيا الفيصل", "Linda Mathieu", "Linda Mattei", "लिंडा माथुर (Linda Mathur)"],
  "Victoria James": ["郝雅兰 (Hao Yalan)", "دينا الجبالي", "Victoria Jacques", "Vittoria Giordano", "विक्टोरिया जेम्स (Victoria James)"],
  "Anthony Romano": ["罗马诺 (Luomano)", "أنطونيو الرومي", "Antoine Romain", "Antonio Romano", "एंथनी रोमानो (Anthony Romano)"],
  "Natalie Rose": ["罗丝 (Luo Si)", "نادية الوردي", "Natalie Rose", "Natalia Rosa", "नताली रोज़ (Natalie Rose)"],
  "Tyler Brooks": ["布鲁克斯 (Bulukesi)", "طارق البركات", "Théo Broussard", "Tiziano Bruni", "टायलर ब्रुक्स (Tyler Brooks)"],
  "Marco Valentino": ["马可 (Ma Ke)", "ماركو فالنتينو", "Marco Valentin", "Marco Valentino", "मार्को वेलेंटिनो (Marco Valentino)"],
  "Nicole Harper": ["哈珀 (Hape)", "نيكول حارب", "Nicole Hébert", "Nicola Marchetti", "निकोल हार्पर (Nicole Harper)"],
  "Robert Hayes": ["海斯 (Haisi)", "رامي الحياة", "Robert Hayet", "Roberto Conti", "रॉबर्ट हेज़ (Robert Hayes)"],
  "Samantha Brooks": ["布鲁克斯 (Bulukesi)", "سمية البروك", "Samantha Broussard", "Samanta Bruni", "समंता ब्रुक्स (Samantha Brooks)"],
  "Daniel Cooper": ["库珀 (Kupe)", "دانيال كوبر", "Daniel Couperin", "Daniele Costa", "डेनियल कूपर (Daniel Cooper)"],
  "Catherine Blake": ["凯瑟琳 (Kaiselin)", "كاترين بليك", "Catherine Blanc", "Caterina Bianco", "कैथरीन ब्लेक (Catherine Blake)"],
  "Chris Martinez": ["马丁内斯 (Madineisi)", "كريس مارتينيز", "Christophe Martinez", "Cristiano Martinelli", "क्रिस मार्टिनेज (Chris Martinez)"],
  "Elizabeth Sterling": ["伊丽莎白 (Yilishabai)", "إليزابيث ستيرلينج", "Élisabeth Sterling", "Elisabetta Stella", "एलिज़ाबेथ स्टर्लिंग (Elizabeth Sterling)"],
  "Professor Amanda Chen": ["陈教授 (Prof. Chen)", "أ.د. أماندا تشن", "Professeur Amanda Chen", "Prof.ssa Amanda Chen", "प्रोफेसर अमांडा चेन"],
  "Dr. Rebecca Stone": ["斯通博士 (Dr. Stone)", "د. ريبيكا ستون", "Dr. Rébecca Pierre", "Dott.ssa Rebecca Pietra", "डॉ. रेबेका स्टोन (Dr. Rebecca Stone)"],
};

async function updateMultilingualVoicesAndAvatars() {
  console.log("Starting voice and avatar update for multilingual agents...");

  const englishAgents = await db.select({
    name: agents.name,
    openaiVoice: agents.openaiVoice,
    elevenLabsVoiceId: agents.elevenLabsVoiceId,
    avatarUrl: agents.avatarUrl,
  })
    .from(agents)
    .where(eq(agents.language, "en"));

  console.log(`Found ${englishAgents.length} English agents`);

  const englishMap = new Map<string, EnglishAgentVoice>();
  for (const agent of englishAgents) {
    englishMap.set(agent.name, agent);
  }

  let updated = 0;

  for (const [englishName, translations] of Object.entries(NAME_MAPPINGS)) {
    const englishAgent = englishMap.get(englishName);
    if (!englishAgent) {
      console.log(`  Warning: No English agent found for ${englishName}`);
      continue;
    }

    for (const translatedName of translations) {
      const result = await db.update(agents)
        .set({
          openaiVoice: englishAgent.openaiVoice,
          elevenLabsVoiceId: englishAgent.elevenLabsVoiceId,
          avatarUrl: englishAgent.avatarUrl,
        })
        .where(and(
          eq(agents.name, translatedName),
          ne(agents.language, "en")
        ));

      updated++;
      console.log(`  Updated: ${translatedName} -> voice: ${englishAgent.openaiVoice}, avatar: ${englishAgent.avatarUrl}`);
    }
  }

  const remaining = await db.select({ id: agents.id, name: agents.name, language: agents.language })
    .from(agents)
    .where(and(
      ne(agents.language, "en"),
      eq(agents.openaiVoice, null as any)
    ));

  if (remaining.length > 0) {
    console.log(`\nAgents still without voice (using gender-based selection):`);
    for (const agent of remaining) {
      const gender = detectGender(agent.name);
      const elevenLabsVoice = getElevenLabsVoiceForAgent(agent.name);
      // Select appropriate OpenAI voice based on gender
      // shimmer = female, alloy = neutral, ash = male
      const openaiVoice = gender === 'female' ? 'shimmer' : 
                          gender === 'male' ? 'ash' : 'alloy';
      
      await db.update(agents)
        .set({
          openaiVoice,
          elevenLabsVoiceId: elevenLabsVoice,
        })
        .where(eq(agents.id, agent.id));
      console.log(`  Set voice for ${agent.name} (${agent.language}): gender=${gender}, openai=${openaiVoice}, elevenlabs=${elevenLabsVoice}`);
    }
  }

  console.log(`\nCompleted! Updated ${updated} multilingual agents.`);
}

updateMultilingualVoicesAndAvatars()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error updating agents:", err);
    process.exit(1);
  });
