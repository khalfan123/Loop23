import { db } from '../server/db';
import { integrationApps } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const zd = await db
    .select({
      slug: integrationApps.slug,
      name: integrationApps.name,
      n8nNodeType: integrationApps.n8nNodeType,
      isActive: integrationApps.isActive,
      isPopular: integrationApps.isPopular,
    })
    .from(integrationApps)
    .where(eq(integrationApps.slug, 'zendesk'));
  console.log('Zendesk:', JSON.stringify(zd, null, 2));

  const all = await db
    .select({ slug: integrationApps.slug, isActive: integrationApps.isActive })
    .from(integrationApps);
  console.log('Total apps:', all.length);
  console.log(
    'Active:',
    all.filter((a) => a.isActive).length,
    '/ Inactive:',
    all.filter((a) => !a.isActive).length,
  );
  console.log('Slugs:', all.map((a) => a.slug).sort().join(', '));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
