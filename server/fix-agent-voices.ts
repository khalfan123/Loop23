/**
 * Fix Agent Voices Script
 * Updates agents with mismatched gender/voice assignments
 * 
 * This script:
 * 1. Detects gender from agent names
 * 2. Checks if the assigned ElevenLabs voice matches the gender
 * 3. Updates voices for agents with mismatched assignments
 */

import { db } from "./db";
import { agents } from "@shared/schema";
import { detectGender, ELEVENLABS_VOICES, getElevenLabsVoiceForAgent } from "./services/avatar-generator";

// Map of ElevenLabs voice IDs to their gender
const voiceGenderMap: Record<string, 'male' | 'female' | 'neutral'> = {
  // Female voices
  '21m00Tcm4TlvDq8ikWAM': 'female', // Rachel
  'cgSgspJ2msm6clMCkdW9': 'female', // Jessica
  'EXAVITQu4vr4xnSDxMaL': 'female', // Bella
  'MF3mGyEYCl7XYWbV9V6O': 'female', // Elli
  'jBpfuIE2acCO8z3wKNLl': 'female', // Gigi
  'jsCqWAovK2LkecY7zXl4': 'female', // Freya
  // Male voices
  'CYw3kZ02Hs0563khs1Fj': 'male', // Dave
  'CwhRBWXzGAHq8TQ4Fs17': 'male', // Roger
  'IKne3meq5aSn9XLyUdCD': 'male', // Charlie
  'bIHbv24MWmeRgasZH58o': 'male', // Will
  'cjVigY5qzO86Huf0OWal': 'male', // Eric
  'iP95p4xoKVk53GoZ742B': 'male', // Chris
  'ErXwobaYiN019PkySvjV': 'male', // Antoni
  'TxGEqnHWrfWFTfGW9XjX': 'male', // Josh
  'VR6AewLTigWG4xSOukaG': 'male', // Arnold
  'pNInz6obpgDQGcFmaJgB': 'male', // Adam
  'yoZ06aMxZJJ28mfd3POQ': 'male', // Sam
  // Neutral voices
  'SAz9YHcvj6GT2YYXdXww': 'neutral', // River
};

// OpenAI voice gender mapping
const openaiVoiceGenderMap: Record<string, 'male' | 'female' | 'neutral'> = {
  'alloy': 'neutral',
  'echo': 'male',
  'shimmer': 'female',
  'ash': 'male',
  'ballad': 'male',
  'coral': 'female',
  'sage': 'male',
  'verse': 'female',
  'cedar': 'male',
  'marin': 'female',
};

async function fixAgentVoices() {
  console.log("🔊 Starting agent voice fix...\n");
  
  const allAgents = await db.select({
    id: agents.id,
    name: agents.name,
    language: agents.language,
    openaiVoice: agents.openaiVoice,
    elevenLabsVoiceId: agents.elevenLabsVoiceId,
  }).from(agents);
  
  console.log(`Found ${allAgents.length} agents to check\n`);
  
  let fixed = 0;
  let alreadyCorrect = 0;
  let skipped = 0;
  
  for (const agent of allAgents) {
    const detectedGender = detectGender(agent.name);
    
    if (detectedGender === 'neutral') {
      skipped++;
      continue;
    }
    
    const currentVoiceGender = agent.elevenLabsVoiceId 
      ? voiceGenderMap[agent.elevenLabsVoiceId] 
      : null;
    
    const currentOpenaiGender = agent.openaiVoice 
      ? openaiVoiceGenderMap[agent.openaiVoice] 
      : null;
    
    // Check if there's a mismatch
    const elevenLabsMismatch = currentVoiceGender && currentVoiceGender !== detectedGender && currentVoiceGender !== 'neutral';
    const openaiMismatch = currentOpenaiGender && currentOpenaiGender !== detectedGender && currentOpenaiGender !== 'neutral';
    
    if (elevenLabsMismatch || openaiMismatch) {
      // Get appropriate voices for this gender
      const newElevenLabsVoice = getElevenLabsVoiceForAgent(agent.name);
      const newOpenaiVoice = detectedGender === 'female' ? 'shimmer' : 
                             detectedGender === 'male' ? 'ash' : 'alloy';
      
      console.log(`🔧 Fixing ${agent.name} (${agent.language}):`);
      console.log(`   Gender: ${detectedGender}`);
      if (elevenLabsMismatch) {
        console.log(`   ElevenLabs: ${agent.elevenLabsVoiceId} (${currentVoiceGender}) → ${newElevenLabsVoice} (${detectedGender})`);
      }
      if (openaiMismatch) {
        console.log(`   OpenAI: ${agent.openaiVoice} (${currentOpenaiGender}) → ${newOpenaiVoice} (${detectedGender})`);
      }
      
      await db.update(agents)
        .set({
          elevenLabsVoiceId: newElevenLabsVoice,
          openaiVoice: newOpenaiVoice,
        })
        .where(eq(agents.id, agent.id));
      
      fixed++;
    } else {
      alreadyCorrect++;
    }
  }
  
  console.log("\n✅ Voice fix complete!");
  console.log(`   Fixed: ${fixed} agents`);
  console.log(`   Already correct: ${alreadyCorrect} agents`);
  console.log(`   Skipped (neutral): ${skipped} agents`);
}

import { eq } from "drizzle-orm";

fixAgentVoices()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error fixing agent voices:", err);
    process.exit(1);
  });
