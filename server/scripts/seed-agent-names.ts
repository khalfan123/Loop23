import { db } from "../db";
import { agentNames } from "@shared/schema";
import { getOpenAIClient } from "../services/openai-modelfarm";
import { sql } from "drizzle-orm";
import type OpenAI from "openai";

interface NameEntry {
  name: string;
  gender: "male" | "female" | "unisex";
}

interface CountRow {
  cnt: string;
}

const LANGUAGES = [
  { code: "ar", label: "Arabic", script: "Arabic script (العربية)", namesPerBatch: 25, batches: 7 },
  { code: "en", label: "English", script: "Latin/English letters", namesPerBatch: 25, batches: 7 },
  { code: "zh", label: "Chinese", script: "Chinese characters (汉字)", namesPerBatch: 25, batches: 7 },
  { code: "hi", label: "Hindi", script: "Devanagari script (हिन्दी)", namesPerBatch: 25, batches: 7 },
  { code: "es", label: "Spanish", script: "Latin letters with Spanish diacritics", namesPerBatch: 25, batches: 7 },
  { code: "fr", label: "French", script: "Latin letters with French diacritics", namesPerBatch: 25, batches: 7 },
];

async function generateBatch(openai: OpenAI, lang: typeof LANGUAGES[0], batchIndex: number): Promise<NameEntry[]> {
  const genderFocus = batchIndex % 3 === 0 ? "female" : batchIndex % 3 === 1 ? "male" : "mixed (both male and female)";
  
  const prompt = `Generate exactly ${lang.namesPerBatch} realistic, culturally authentic full names (first name and last name) for ${lang.label}-speaking people.

Requirements:
- Names MUST be written in ${lang.script}. Do NOT transliterate into other scripts.
- Include ${genderFocus} names in this batch.
- Names should be diverse — different family names, different regions/backgrounds within ${lang.label}-speaking cultures.
- Each name should feel natural and professional, suitable for a customer service agent.
- Do NOT include numbers, titles (Mr/Mrs/Dr), or honorifics.

Output format: Return a JSON array of objects with "name" and "gender" fields.
Gender must be exactly "male", "female", or "unisex".

Example output format:
[{"name": "Example Name", "gender": "female"}, {"name": "Another Name", "gender": "male"}]

Return ONLY the JSON array, no other text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 2000,
    temperature: 1.0,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.choices[0]?.message?.content?.trim() || "[]";
  
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn(`[Seed] Could not parse JSON for ${lang.label} batch ${batchIndex + 1}`);
    return [];
  }
  
  try {
    const parsed: NameEntry[] = JSON.parse(jsonMatch[0]);
    return parsed.filter((item) => item.name && item.gender);
  } catch (e) {
    console.warn(`[Seed] JSON parse error for ${lang.label} batch ${batchIndex + 1}:`, e);
    return [];
  }
}

async function seedAgentNames() {
  console.log("[Seed] Starting agent names seed...");

  const openai = await getOpenAIClient();
  let totalInserted = 0;

  for (const lang of LANGUAGES) {
    const existingRows = await db.execute(
      sql`SELECT count(*) as cnt FROM agent_names WHERE language = ${lang.code}`
    );
    const row = existingRows.rows[0] as CountRow | undefined;
    const existingCount = Number(row?.cnt || 0);
    const targetCount = lang.namesPerBatch * lang.batches;
    if (existingCount >= targetCount) {
      console.log(`[Seed] ${lang.label} already has ${existingCount} names (target: ${targetCount}), skipping.`);
      continue;
    }
    console.log(`[Seed] Generating names for ${lang.label} (${lang.batches} batches of ${lang.namesPerBatch}, existing: ${existingCount}, target: ${targetCount})...`);
    
    const allNames: { name: string; language: string; gender: string }[] = [];
    const seenNames = new Set<string>();

    for (let i = 0; i < lang.batches; i++) {
      console.log(`  Batch ${i + 1}/${lang.batches}...`);
      
      try {
        const batch = await generateBatch(openai, lang, i);
        
        for (const item of batch) {
          const normalizedName = item.name.trim();
          if (!seenNames.has(normalizedName) && normalizedName.length > 0) {
            seenNames.add(normalizedName);
            allNames.push({
              name: normalizedName,
              language: lang.code,
              gender: item.gender || "unisex",
            });
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`  Error in batch ${i + 1} for ${lang.label}:`, err);
      }
    }

    if (allNames.length > 0) {
      const batchSize = 50;
      for (let j = 0; j < allNames.length; j += batchSize) {
        const chunk = allNames.slice(j, j + batchSize);
        await db.insert(agentNames).values(chunk).onConflictDoNothing();
      }
      console.log(`  Inserted ${allNames.length} unique names for ${lang.label}`);
      totalInserted += allNames.length;
    }
  }

  console.log(`[Seed] Done! Total names inserted: ${totalInserted}`);
}

seedAgentNames()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Seed] Fatal error:", err);
    process.exit(1);
  });
