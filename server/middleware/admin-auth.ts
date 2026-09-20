'use strict';
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
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from './jwt-config';

export interface AdminRequest extends Request {
  userId?: string;
  userRole?: string;
  isAdmin?: boolean;
}

export async function checkAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    // Get token from header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    const userId = decoded.userId;

    // Check if user has admin role
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Attach admin status to request
    req.userId = userId;
    req.userRole = user.role;
    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Same as checkAdmin, but also accepts service calls using:
 *   X-Internal-API-Key: <INTERNAL_API_SECRET>
 *
 * Must match the secret enforced by `/api/internal/*`.
 */
export async function checkAdminOrInternal(req: AdminRequest, res: Response, next: NextFunction) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const provided = req.headers["x-internal-api-key"];
  const providedStr = typeof provided === "string" ? provided : Array.isArray(provided) ? provided[0] : undefined;

  if (providedStr) {
    if (!internalSecret || providedStr !== internalSecret) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    req.userRole = "admin";
    req.isAdmin = true;
    const uid = req.headers["x-user-id"];
    if (typeof uid === "string" && uid.length > 0) {
      req.userId = uid;
    }
    return next();
  }

  return checkAdmin(req, res, next);
}

