#!/usr/bin/env tsx
import { db } from "../db";
import { users, workspaces, workspaceMembers, phoneNumbers } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[backfill-workspaces] Starting (dryRun=${dryRun})`);

  const allUsers = await db.select().from(users);
  console.log(`[backfill-workspaces] users=${allUsers.length}`);

  // existing workspaces by owner
  const existing = await db.select().from(workspaces);
  const byOwner = new Map<string, typeof workspaces.$inferSelect>();
  for (const w of existing) byOwner.set(w.ownerUserId, w);

  let createdCount = 0;
  let memberCount = 0;
  let phoneLinked = 0;

  for (const u of allUsers) {
    let w = byOwner.get(u.id);
    if (!w) {
      const baseSlug = slugify(u.company || u.name || u.email.split("@")[0] || `user-${u.id}`);
      const slug = baseSlug ? `${baseSlug}-${u.id.slice(0, 6)}` : `user-${u.id.slice(0, 6)}`;
      if (!dryRun) {
        const [created] = await db
          .insert(workspaces)
          .values({
            name: u.company || u.name || u.email,
            slug,
            ownerUserId: u.id,
            status: "active",
          })
          .returning();
        w = created;
        byOwner.set(u.id, w);
      }
      createdCount++;
    }

    if (!w) continue;

    // ensure membership row exists
    const existingMember = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, w.id))
      .limit(200);

    const hasUser = existingMember.some((m) => m.userId === u.id);
    if (!hasUser) {
      if (!dryRun) {
        await db.insert(workspaceMembers).values({
          workspaceId: w.id,
          userId: u.id,
          role: "owner",
        });
      }
      memberCount++;
    }

    // link existing phone numbers owned by this user
    const ownedPhones = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.userId, u.id));

    for (const p of ownedPhones) {
      if (p.workspaceId) continue;
      if (!dryRun) {
        await db.update(phoneNumbers).set({ workspaceId: w.id }).where(eq(phoneNumbers.id, p.id));
      }
      phoneLinked++;
    }
  }

  // system pool numbers remain workspaceId null
  const poolCount = await db.select().from(phoneNumbers).where(isNull(phoneNumbers.userId));
  console.log(`[backfill-workspaces] systemPoolNumbers=${poolCount.length}`);

  console.log(
    `[backfill-workspaces] Done. workspacesCreated=${createdCount} membersCreated=${memberCount} phoneNumbersLinked=${phoneLinked}`,
  );
}

main().catch((err) => {
  console.error("[backfill-workspaces] Failed:", err);
  process.exit(1);
});

