import { db } from "../db";
import { elevenLabsCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ElevenLabsPoolService } from "./elevenlabs-pool";

export async function bootstrapElevenLabsPoolFromEnv(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    return;
  }

  try {
    const existingByKey = await db
      .select({ id: elevenLabsCredentials.id, name: elevenLabsCredentials.name, isActive: elevenLabsCredentials.isActive })
      .from(elevenLabsCredentials)
      .where(eq(elevenLabsCredentials.apiKey, apiKey))
      .limit(1);

    if (existingByKey.length > 0) {
      const cred = existingByKey[0];
      if (!cred.isActive) {
        await db
          .update(elevenLabsCredentials)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(elevenLabsCredentials.id, cred.id));
        console.log(`🔑 [ElevenLabs Bootstrap] Re-activated existing credential "${cred.name}" matching ELEVENLABS_API_KEY env var`);
      }
      return;
    }

    const allActive = await db
      .select({ id: elevenLabsCredentials.id })
      .from(elevenLabsCredentials)
      .where(eq(elevenLabsCredentials.isActive, true))
      .limit(1);

    if (allActive.length > 0) {
      console.log("🔑 [ElevenLabs Bootstrap] Pool already has active credentials; skipping env-key seed");
      return;
    }

    console.log("🔑 [ElevenLabs Bootstrap] Pool is empty — seeding from ELEVENLABS_API_KEY env var");
    const isValid = await ElevenLabsPoolService.testCredential(apiKey);
    if (!isValid) {
      console.warn("⚠️ [ElevenLabs Bootstrap] ELEVENLABS_API_KEY did not validate against ElevenLabs API; not inserting");
      return;
    }

    const [credential] = await db
      .insert(elevenLabsCredentials)
      .values({
        name: "Env (ELEVENLABS_API_KEY)",
        apiKey,
        isActive: true,
        healthStatus: "healthy",
        lastHealthCheck: new Date(),
      })
      .returning();

    console.log(`✅ [ElevenLabs Bootstrap] Seeded credential "${credential.name}" (${credential.id}) into pool`);
  } catch (error: any) {
    console.error("❌ [ElevenLabs Bootstrap] Failed to seed pool from env:", error?.message || error);
  }
}
