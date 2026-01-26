import { generateImageBuffer } from "../replit_integrations/image/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Generates a professional AI avatar based on agent name.
 * Determines gender from name and creates appropriate avatar.
 */

// Common female first names for gender detection
const femaleNames = new Set([
  'amanda', 'anna', 'catherine', 'cathy', 'claire', 'diana', 'elizabeth', 'emily', 
  'emma', 'eva', 'grace', 'hannah', 'isabella', 'jennifer', 'jessica', 'julia',
  'karen', 'kate', 'katherine', 'laura', 'linda', 'lisa', 'lucy', 'maria', 'mary',
  'melissa', 'michelle', 'nancy', 'natalie', 'nicole', 'olivia', 'patricia', 
  'rachel', 'rebecca', 'samantha', 'sarah', 'sophia', 'stephanie', 'susan', 
  'victoria', 'amy', 'ashley', 'brittany', 'heather', 'megan', 'andrea', 'angela',
]);

// Common male first names for gender detection
const maleNames = new Set([
  'adam', 'alex', 'alexander', 'andrew', 'anthony', 'benjamin', 'brian', 'charles',
  'chris', 'christopher', 'daniel', 'david', 'edward', 'eric', 'frank', 'george',
  'henry', 'jack', 'jacob', 'james', 'jason', 'john', 'joseph', 'joshua', 'kevin',
  'mark', 'marcus', 'matthew', 'michael', 'nick', 'nicholas', 'patrick', 'paul',
  'peter', 'richard', 'robert', 'ryan', 'steven', 'thomas', 'timothy', 'tyler',
  'william', 'marco', 'antonio', 'diego', 'carlos', 'miguel', 'professor',
]);

function detectGender(name: string): 'male' | 'female' | 'neutral' {
  // Extract first name (handle titles like "Dr.", "Professor")
  const parts = name.toLowerCase().split(/\s+/);
  let firstName = parts[0];
  
  // Skip titles
  if (['dr.', 'dr', 'professor', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms'].includes(firstName)) {
    firstName = parts[1] || firstName;
  }
  
  if (femaleNames.has(firstName)) return 'female';
  if (maleNames.has(firstName)) return 'male';
  return 'neutral';
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
    const imageBuffer = await generateImageBuffer(prompt, "512x512");
    
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
