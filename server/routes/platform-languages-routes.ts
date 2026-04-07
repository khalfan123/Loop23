/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { Router, Response, Request } from 'express';
import { db } from '../db';
import { platformLanguages } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';

// Helper function to get enabled languages
async function getEnabledLanguages() {
  return db
    .select()
    .from(platformLanguages)
    .where(eq(platformLanguages.isEnabled, true))
    .orderBy(asc(platformLanguages.sortOrder), asc(platformLanguages.name));
}

// Public router - no authentication required
export const platformLanguagesPublicRouter = Router();
platformLanguagesPublicRouter.get('/', async (req: Request, res: Response) => {
  try {
    const languages = await getEnabledLanguages();
    res.json(languages);
  } catch (error) {
    console.error('Error fetching enabled platform languages:', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

export default platformLanguagesPublicRouter;
