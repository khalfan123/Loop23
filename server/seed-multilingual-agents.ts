/**
 * Multilingual Agents Seeder
 * Creates translated versions of all 31 agents in Chinese, Arabic, French, Italian, and Hindi
 */

import { db } from "./db";
import { agents, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface AgentData {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  language: string;
  personality: string | null;
  voiceTone: string | null;
  llmModel: string | null;
  temperature: number | null;
  type: string;
  specialist: string | null;
  isActive: boolean;
}

interface LanguageConfig {
  code: string;
  nativeName: string;
  nameMapping: Record<string, string>;
}

const LANGUAGE_CONFIGS: LanguageConfig[] = [
  {
    code: "zh",
    nativeName: "Chinese",
    nameMapping: {
      "Marcus Sterling": "马超 (Ma Chao)",
      "Sophia Chen": "陈雅婷 (Chen Yating)",
      "James Rodriguez": "李明 (Li Ming)",
      "Alex Thompson": "张伟 (Zhang Wei)",
      "Emily Watson": "王芳 (Wang Fang)",
      "Sarah Mitchell": "刘静 (Liu Jing)",
      "David Park": "朴大卫 (Piao Dawei)",
      "Rachel Green": "赵欣 (Zhao Xin)",
      "Michael Chen": "陈志强 (Chen Zhiqiang)",
      "Jessica Lee": "李佳琪 (Li Jiaqi)",
      "Jennifer Adams": "金美玲 (Jin Meiling)",
      "Dr. Amanda Foster": "傅博士 (Dr. Fu)",
      "Kevin O'Brien": "欧阳凯 (Ouyang Kai)",
      "Linda Matthews": "林小萌 (Lin Xiaomeng)",
      "Victoria James": "郝雅兰 (Hao Yalan)",
      "Anthony Romano": "罗马诺 (Luomano)",
      "Natalie Rose": "罗丝 (Luo Si)",
      "Tyler Brooks": "布鲁克斯 (Bulukesi)",
      "Marco Valentino": "马可 (Ma Ke)",
      "Nicole Harper": "哈珀 (Hape)",
      "Robert Hayes": "海斯 (Haisi)",
      "Samantha Brooks": "布鲁克斯 (Bulukesi)",
      "Daniel Cooper": "库珀 (Kupe)",
      "Catherine Blake": "凯瑟琳 (Kaiselin)",
      "Chris Martinez": "马丁内斯 (Madineisi)",
      "Elizabeth Sterling": "伊丽莎白 (Yilishabai)",
      "Professor Amanda Chen": "陈教授 (Prof. Chen)",
      "Dr. Rebecca Stone": "斯通博士 (Dr. Stone)",
      "Ryan Parker": "帕克 (Pake)",
      "Michelle Torres": "托雷斯 (Tuoleisi)",
      "Amanda Foster": "福斯特 (Fuste)",
    }
  },
  {
    code: "ar",
    nativeName: "Arabic",
    nameMapping: {
      "Marcus Sterling": "أحمد الصالح",
      "Sophia Chen": "سارة الحسيني",
      "James Rodriguez": "محمد العلي",
      "Alex Thompson": "خالد المنصور",
      "Emily Watson": "فاطمة الزهراء",
      "Sarah Mitchell": "نور القحطاني",
      "David Park": "يوسف الحربي",
      "Rachel Green": "ليلى الراشد",
      "Michael Chen": "عمر الشهري",
      "Jessica Lee": "مريم العتيبي",
      "Jennifer Adams": "هند السعيد",
      "Dr. Amanda Foster": "د. أمل المهدي",
      "Kevin O'Brien": "كريم البدوي",
      "Linda Matthews": "رانيا الفيصل",
      "Victoria James": "دينا الجبالي",
      "Anthony Romano": "أنطونيو الرومي",
      "Natalie Rose": "نادية الوردي",
      "Tyler Brooks": "طارق البركات",
      "Marco Valentino": "ماركو فالنتينو",
      "Nicole Harper": "نيكول حارب",
      "Robert Hayes": "رامي الحياة",
      "Samantha Brooks": "سمية البروك",
      "Daniel Cooper": "دانيال كوبر",
      "Catherine Blake": "كاترين بليك",
      "Chris Martinez": "كريس مارتينيز",
      "Elizabeth Sterling": "إليزابيث ستيرلينج",
      "Professor Amanda Chen": "أ.د. أماندا تشن",
      "Dr. Rebecca Stone": "د. ريبيكا ستون",
      "Ryan Parker": "ريان باركر",
      "Michelle Torres": "ميشيل توريس",
      "Amanda Foster": "أماندا فوستر",
    }
  },
  {
    code: "fr",
    nativeName: "French",
    nameMapping: {
      "Marcus Sterling": "Marc Dupont",
      "Sophia Chen": "Sophie Martin",
      "James Rodriguez": "Jacques Bernard",
      "Alex Thompson": "Alexandre Moreau",
      "Emily Watson": "Émilie Dubois",
      "Sarah Mitchell": "Sarah Lefebvre",
      "David Park": "David Leroy",
      "Rachel Green": "Rachel Girard",
      "Michael Chen": "Michel Laurent",
      "Jessica Lee": "Jessica Rousseau",
      "Jennifer Adams": "Jennifer Adam",
      "Dr. Amanda Foster": "Dr. Amanda Fontaine",
      "Kevin O'Brien": "Kevin Blanc",
      "Linda Matthews": "Linda Mathieu",
      "Victoria James": "Victoria Jacques",
      "Anthony Romano": "Antoine Romain",
      "Natalie Rose": "Natalie Rose",
      "Tyler Brooks": "Théo Broussard",
      "Marco Valentino": "Marco Valentin",
      "Nicole Harper": "Nicole Hébert",
      "Robert Hayes": "Robert Hayet",
      "Samantha Brooks": "Samantha Broussard",
      "Daniel Cooper": "Daniel Couperin",
      "Catherine Blake": "Catherine Blanc",
      "Chris Martinez": "Christophe Martinez",
      "Elizabeth Sterling": "Élisabeth Sterling",
      "Professor Amanda Chen": "Professeur Amanda Chen",
      "Dr. Rebecca Stone": "Dr. Rébecca Pierre",
      "Ryan Parker": "Ryan Parisot",
      "Michelle Torres": "Michelle Torres",
      "Amanda Foster": "Amanda Fontaine",
    }
  },
  {
    code: "it",
    nativeName: "Italian",
    nameMapping: {
      "Marcus Sterling": "Marco Rossi",
      "Sophia Chen": "Sofia Bianchi",
      "James Rodriguez": "Giacomo Ferrari",
      "Alex Thompson": "Alessandro Romano",
      "Emily Watson": "Emilia Colombo",
      "Sarah Mitchell": "Sara Ricci",
      "David Park": "Davide Parco",
      "Rachel Green": "Rachele Verdi",
      "Michael Chen": "Michele Russo",
      "Jessica Lee": "Jessica Esposito",
      "Jennifer Adams": "Ginevra Adami",
      "Dr. Amanda Foster": "Dott.ssa Amanda Fiorentino",
      "Kevin O'Brien": "Kevin Bruno",
      "Linda Matthews": "Linda Mattei",
      "Victoria James": "Vittoria Giordano",
      "Anthony Romano": "Antonio Romano",
      "Natalie Rose": "Natalia Rosa",
      "Tyler Brooks": "Tiziano Bruni",
      "Marco Valentino": "Marco Valentino",
      "Nicole Harper": "Nicola Marchetti",
      "Robert Hayes": "Roberto Conti",
      "Samantha Brooks": "Samanta Bruni",
      "Daniel Cooper": "Daniele Costa",
      "Catherine Blake": "Caterina Bianco",
      "Chris Martinez": "Cristiano Martinelli",
      "Elizabeth Sterling": "Elisabetta Stella",
      "Professor Amanda Chen": "Prof.ssa Amanda Chen",
      "Dr. Rebecca Stone": "Dott.ssa Rebecca Pietra",
      "Ryan Parker": "Ryan Parisi",
      "Michelle Torres": "Michela Torre",
      "Amanda Foster": "Amanda Fiorentino",
    }
  },
  {
    code: "hi",
    nativeName: "Hindi",
    nameMapping: {
      "Marcus Sterling": "मनीष शर्मा (Manish Sharma)",
      "Sophia Chen": "सोफिया चेन (Sophia Chen)",
      "James Rodriguez": "जयेश राव (Jayesh Rao)",
      "Alex Thompson": "अलेक्स त्रिपाठी (Alex Tripathi)",
      "Emily Watson": "ईमिली वर्मा (Emily Verma)",
      "Sarah Mitchell": "सारा मिश्रा (Sara Mishra)",
      "David Park": "दीपक पार्क (Deepak Park)",
      "Rachel Green": "राधिका गुप्ता (Radhika Gupta)",
      "Michael Chen": "मिहिर चेन (Mihir Chen)",
      "Jessica Lee": "जेसिका सिंह (Jessica Singh)",
      "Jennifer Adams": "जेनिफर आदम (Jennifer Adam)",
      "Dr. Amanda Foster": "डॉ. अमांडा फोस्टर (Dr. Amanda Foster)",
      "Kevin O'Brien": "केविन ओ'ब्रायन (Kevin O'Brien)",
      "Linda Matthews": "लिंडा माथुर (Linda Mathur)",
      "Victoria James": "विक्टोरिया जेम्स (Victoria James)",
      "Anthony Romano": "एंथनी रोमानो (Anthony Romano)",
      "Natalie Rose": "नताली रोज़ (Natalie Rose)",
      "Tyler Brooks": "टायलर ब्रुक्स (Tyler Brooks)",
      "Marco Valentino": "मार्को वेलेंटिनो (Marco Valentino)",
      "Nicole Harper": "निकोल हार्पर (Nicole Harper)",
      "Robert Hayes": "रॉबर्ट हेज़ (Robert Hayes)",
      "Samantha Brooks": "समंता ब्रुक्स (Samantha Brooks)",
      "Daniel Cooper": "डेनियल कूपर (Daniel Cooper)",
      "Catherine Blake": "कैथरीन ब्लेक (Catherine Blake)",
      "Chris Martinez": "क्रिस मार्टिनेज (Chris Martinez)",
      "Elizabeth Sterling": "एलिज़ाबेथ स्टर्लिंग (Elizabeth Sterling)",
      "Professor Amanda Chen": "प्रोफेसर अमांडा चेन",
      "Dr. Rebecca Stone": "डॉ. रेबेका स्टोन (Dr. Rebecca Stone)",
      "Ryan Parker": "रयान पार्कर (Ryan Parker)",
      "Michelle Torres": "मिशेल टोरेस (Michelle Torres)",
      "Amanda Foster": "अमांडा फोस्टर (Amanda Foster)",
    }
  }
];

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text) return text;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text to ${targetLang}. Keep the same tone, formatting, and meaning. Only return the translated text, nothing else.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
    });
    
    return response.choices[0].message.content || text;
  } catch (error) {
    console.error(`Translation error for ${targetLang}:`, error);
    return text;
  }
}

async function getExistingEnglishAgents(userId: string): Promise<AgentData[]> {
  const existingAgents = await db.select({
    name: agents.name,
    systemPrompt: agents.systemPrompt,
    firstMessage: agents.firstMessage,
    language: agents.language,
    personality: agents.personality,
    voiceTone: agents.voiceTone,
    llmModel: agents.llmModel,
    temperature: agents.temperature,
    type: agents.type,
    specialist: agents.specialist,
    isActive: agents.isActive,
  })
    .from(agents)
    .where(eq(agents.userId, userId));
  
  return existingAgents.filter(a => a.language === 'en') as AgentData[];
}

export async function seedMultilingualAgents() {
  console.log("Starting multilingual agents seeding...");
  
  const adminUsers = await db.select().from(users).where(eq(users.role, "admin"));
  if (adminUsers.length === 0) {
    console.log("No admin user found. Please create an admin user first.");
    return;
  }
  
  const adminUser = adminUsers[0];
  console.log(`Using admin user: ${adminUser.email}`);
  
  const englishAgents = await getExistingEnglishAgents(adminUser.id);
  console.log(`Found ${englishAgents.length} English agents to translate`);
  
  let totalCreated = 0;
  
  for (const langConfig of LANGUAGE_CONFIGS) {
    console.log(`\nProcessing ${langConfig.nativeName} (${langConfig.code})...`);
    
    for (const agent of englishAgents) {
      const translatedName = langConfig.nameMapping[agent.name] || agent.name;
      const translatedSystemPrompt = await translateText(agent.systemPrompt || "", langConfig.nativeName);
      const translatedFirstMessage = await translateText(agent.firstMessage || "", langConfig.nativeName);
      
      await db.insert(agents).values({
        userId: adminUser.id,
        name: translatedName,
        systemPrompt: translatedSystemPrompt,
        firstMessage: translatedFirstMessage,
        language: langConfig.code,
        personality: agent.personality,
        voiceTone: agent.voiceTone,
        llmModel: agent.llmModel,
        temperature: agent.temperature,
        type: agent.type,
        specialist: agent.specialist,
        isActive: agent.isActive,
      });
      
      console.log(`  Created: ${translatedName}`);
      totalCreated++;
    }
  }
  
  console.log(`\nCompleted! Created ${totalCreated} multilingual agents.`);
}

seedMultilingualAgents()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding multilingual agents:", err);
    process.exit(1);
  });
