import { generateImageBuffer } from "../replit_integrations/image/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Generates a professional AI avatar based on agent name.
 * Determines gender from name and creates appropriate avatar.
 */

// Common female first names for gender detection (English + International)
const femaleNames = new Set([
  // English names
  'amanda', 'anna', 'catherine', 'cathy', 'claire', 'diana', 'elizabeth', 'emily', 
  'emma', 'eva', 'grace', 'hannah', 'isabella', 'jennifer', 'jessica', 'julia',
  'karen', 'kate', 'katherine', 'laura', 'linda', 'lisa', 'lucy', 'maria', 'mary',
  'melissa', 'michelle', 'nancy', 'natalie', 'nicole', 'olivia', 'patricia', 
  'rachel', 'rebecca', 'samantha', 'sarah', 'sophia', 'stephanie', 'susan', 
  'victoria', 'amy', 'ashley', 'brittany', 'heather', 'megan', 'andrea', 'angela',
  // Italian female names
  'caterina', 'sofia', 'emilia', 'sara', 'rachele', 'ginevra', 'vittoria', 'natalia',
  'samanta', 'michela', 'elisabetta', 'patrizia', 'francesca', 'giulia', 'chiara',
  'alessandra', 'valentina', 'federica', 'silvia', 'paola', 'elena', 'roberta',
  // French female names
  'sophie', 'émilie', 'camille', 'chloé', 'léa', 'manon', 'marie', 'amélie',
  'charlotte', 'juliette', 'margot', 'céline', 'nathalie', 'sylvie', 'véronique',
  // Spanish female names
  'carmen', 'rosa', 'lucia', 'elena', 'pilar', 'dolores', 'teresa', 'cristina',
  'marta', 'ana', 'isabel', 'beatriz', 'alicia', 'ines', 'paula',
  // German female names
  'anna', 'marie', 'sophie', 'emma', 'lena', 'mia', 'hannah', 'lea', 'klara',
  'greta', 'helga', 'ingrid', 'ursula', 'heidi', 'monika',
  // Arabic female names (romanized)
  'fatima', 'aisha', 'maryam', 'layla', 'nour', 'sara', 'hind', 'rania', 'dina',
  'sumaya', 'nadia', 'amira', 'yasmin', 'salma', 'zeina',
  // Hindi female names (romanized)  
  'priya', 'sunita', 'anita', 'rekha', 'sita', 'radha', 'deepa', 'kavita', 'neha',
  'pooja', 'rani', 'geeta', 'maya', 'usha', 'rita',
  // Chinese female names (romanized)
  'mei', 'ling', 'fang', 'xin', 'jing', 'yating', 'xiaomeng', 'yalan', 'meiling',
  'jiaqi', 'yilishabai',
]);

// Common male first names for gender detection (English + International)
const maleNames = new Set([
  // English names
  'adam', 'alex', 'alexander', 'andrew', 'anthony', 'benjamin', 'brian', 'charles',
  'chris', 'christopher', 'daniel', 'david', 'edward', 'eric', 'frank', 'george',
  'henry', 'jack', 'jacob', 'james', 'jason', 'john', 'joseph', 'joshua', 'kevin',
  'mark', 'marcus', 'matthew', 'michael', 'nick', 'nicholas', 'patrick', 'paul',
  'peter', 'richard', 'robert', 'ryan', 'steven', 'thomas', 'timothy', 'tyler',
  'william', 'professor',
  // Italian male names
  'marco', 'giacomo', 'alessandro', 'davide', 'michele', 'antonio', 'tiziano',
  'cristiano', 'daniele', 'roberto', 'guglielmo', 'giuseppe', 'luigi', 'giovanni',
  'francesco', 'lorenzo', 'andrea', 'luca', 'matteo', 'nicola',
  // French male names
  'marc', 'jacques', 'alexandre', 'théo', 'antoine', 'christophe', 'michel',
  'guillaume', 'pierre', 'jean', 'françois', 'olivier', 'nicolas', 'laurent',
  // Spanish male names
  'diego', 'carlos', 'miguel', 'juan', 'jose', 'pablo', 'pedro', 'fernando',
  'rafael', 'alejandro', 'javier', 'sergio', 'manuel', 'luis', 'ramon',
  // German male names
  'hans', 'klaus', 'wolfgang', 'heinrich', 'karl', 'friedrich', 'otto', 'max',
  'felix', 'paul', 'leon', 'tim', 'jan', 'lukas', 'niklas',
  // Arabic male names (romanized)
  'ahmad', 'mohammed', 'khaled', 'yusuf', 'omar', 'karim', 'tarek', 'rami',
  'hassan', 'ali', 'mahmoud', 'ibrahim', 'abdullah', 'salem',
  // Hindi male names (romanized)
  'manish', 'jayesh', 'deepak', 'mihir', 'raj', 'amit', 'sunil', 'vijay', 'rahul',
  'arjun', 'krishna', 'ravi', 'sanjay', 'ajay', 'anil',
  // Chinese male names (romanized)
  'wei', 'ming', 'chao', 'zhiqiang', 'dawei', 'kai', 'haisi', 'kupe',
]);

// Title prefixes to skip when detecting gender (international)
const titlePrefixes = new Set([
  'dr.', 'dr', 'professor', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms',
  // Italian titles
  'dott.', 'dott', 'dott.ssa', 'prof.ssa', 'sig.', 'sig', 'sig.ra', 'signora',
  // French titles  
  'mme', 'mme.', 'mlle', 'mlle.', 'm.', 'docteur',
  // Spanish titles
  'don', 'doña', 'señor', 'señora', 'sr.', 'sra.',
  // German titles
  'herr', 'frau', 'dr.',
  // Arabic titles (romanized)
  'sheikh', 'sheikha', 'sayyid', 'sayyida',
]);

/**
 * Detects gender from a name, handling international names and titles
 * @param name - Full name string
 * @returns 'male' | 'female' | 'neutral'
 */
export function detectGender(name: string): 'male' | 'female' | 'neutral' {
  // Extract first name (handle titles like "Dr.", "Professor", "Dott.ssa")
  const parts = name.toLowerCase().split(/\s+/);
  let firstName = parts[0];
  
  // Skip title prefixes - check multiple positions
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    if (titlePrefixes.has(parts[i])) {
      firstName = parts[i + 1] || firstName;
    } else {
      firstName = parts[i];
      break;
    }
  }
  
  // Clean up any parenthetical content (e.g., "मनीष (Manish)" -> extract "manish")
  if (firstName.includes('(')) {
    const match = firstName.match(/\(([^)]+)\)/);
    if (match) {
      firstName = match[1].toLowerCase();
    }
  }
  
  // Also check for romanized name in parentheses at end of full name
  const fullNameMatch = name.match(/\(([^)]+)\)/);
  if (fullNameMatch) {
    const romanizedName = fullNameMatch[1].toLowerCase().split(/\s+/)[0];
    if (femaleNames.has(romanizedName)) return 'female';
    if (maleNames.has(romanizedName)) return 'male';
  }
  
  if (femaleNames.has(firstName)) return 'female';
  if (maleNames.has(firstName)) return 'male';
  return 'neutral';
}

/**
 * ElevenLabs voice IDs organized by gender
 * These are the conversational voices available in the current account
 */
export const ELEVENLABS_VOICES = {
  female: [
    { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
  ],
  male: [
    { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
    { id: 'bIHbv24MWmeRgasZH58o', name: 'Will' },
    { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric' },
    { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris' },
  ],
  neutral: [
    { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River' },
  ],
};

/**
 * Gets an appropriate ElevenLabs voice ID based on the agent's name/gender
 * @param agentName - Full name of the agent
 * @param preferredVoiceId - Optional preferred voice ID to use if provided
 * @returns ElevenLabs voice ID
 */
export function getElevenLabsVoiceForAgent(agentName: string, preferredVoiceId?: string | null): string {
  // If a valid preferred voice is provided, use it
  if (preferredVoiceId) {
    return preferredVoiceId;
  }
  
  const gender = detectGender(agentName);
  
  // Get a voice matching the detected gender
  const voices = gender === 'female' ? ELEVENLABS_VOICES.female :
                 gender === 'male' ? ELEVENLABS_VOICES.male :
                 ELEVENLABS_VOICES.neutral;
  
  // Use the first voice in the appropriate category as default
  // Rachel for female, Dave for male, River for neutral
  return voices[0].id;
}

function generateAvatarPrompt(name: string, specialist?: string): string {
  const gender = detectGender(name);
  const genderDesc = gender === 'female' ? 'professional woman' : 
                     gender === 'male' ? 'professional man' : 
                     'professional person';
  
  // Determine industry/role context from specialist
  let roleContext = 'business professional';
  let attire = 'wearing business attire';
  
  if (specialist) {
    const lower = specialist.toLowerCase();
    if (lower.includes('healthcare') || lower.includes('medical') || lower.includes('doctor')) {
      roleContext = 'healthcare professional';
      attire = 'wearing white medical coat';
    } else if (lower.includes('tech') || lower.includes('it') || lower.includes('support')) {
      roleContext = 'tech professional';
      attire = 'wearing smart casual tech industry attire';
    } else if (lower.includes('sales') || lower.includes('lead')) {
      roleContext = 'sales professional';
      attire = 'wearing sharp business suit';
    } else if (lower.includes('legal') || lower.includes('law')) {
      roleContext = 'legal professional';
      attire = 'wearing formal law firm attire';
    } else if (lower.includes('finance') || lower.includes('insurance')) {
      roleContext = 'financial professional';
      attire = 'wearing premium business attire';
    } else if (lower.includes('spa') || lower.includes('wellness')) {
      roleContext = 'wellness professional';
      attire = 'wearing elegant spa industry attire';
    } else if (lower.includes('restaurant') || lower.includes('hospitality')) {
      roleContext = 'hospitality professional';
      attire = 'wearing hospitality industry attire';
    } else if (lower.includes('education') || lower.includes('professor')) {
      roleContext = 'education professional';
      attire = 'wearing academic professional attire';
    } else if (lower.includes('real estate') || lower.includes('property')) {
      roleContext = 'real estate professional';
      attire = 'wearing upscale business attire';
    }
  }
  
  return `Professional 3D rendered portrait of ${name}, ${genderDesc}, ${roleContext}, confident friendly expression, ${attire}, clean modern background, photorealistic digital art style, corporate headshot, high quality render, professional lighting`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function generateAgentAvatar(
  agentName: string, 
  specialist?: string
): Promise<string> {
  try {
    const prompt = generateAvatarPrompt(agentName, specialist);
    const imageBuffer = await generateImageBuffer(prompt, "1024x1024");
    
    // Ensure avatars directory exists
    const avatarsDir = join(process.cwd(), 'public', 'avatars');
    await mkdir(avatarsDir, { recursive: true });
    
    // Generate unique filename
    const slug = slugify(agentName);
    const timestamp = Date.now();
    const filename = `${slug}-${timestamp}.png`;
    const filepath = join(avatarsDir, filename);
    
    // Save the image
    await writeFile(filepath, imageBuffer);
    
    // Return the public URL path
    return `/avatars/${filename}`;
  } catch (error) {
    console.error('[AvatarGenerator] Failed to generate avatar:', error);
    // Return empty string on failure - agent will use fallback icon
    return '';
  }
}
