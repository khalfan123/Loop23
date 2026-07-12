"use strict";
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

import { Request, Response, NextFunction } from "express";
import { RateLimitError } from "../utils/errors";
import { AuthenticatedRequest } from "./errorHandler";

export interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

/**
 * Storage seam for rate-limit windows. The default store is in-process
 * memory (single-instance semantics); a Redis-backed implementation of
 * this interface makes limits consistent across horizontally scaled
 * instances without touching the middleware. `hit` may be async.
 */
export interface RateLimitStore {
  /** Register a request against the key's fixed window and return its state. */
  hit(key: string, windowMs: number, now: number): RateLimitEntry | Promise<RateLimitEntry>;
  size(): number;
  top(limit: number): Array<{ key: string; count: number }>;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  message?: string;
  store?: RateLimitStore;
}

const CLEANUP_INTERVAL = 60 * 1000;
const IDLE_EVICTION_MS = 60 * 60 * 1000;

export class MemoryRateLimitStore implements RateLimitStore {
  private entries = new Map<string, RateLimitEntry>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  hit(key: string, windowMs: number, now: number): RateLimitEntry {
    this.startCleanup();
    let entry = this.entries.get(key);
    if (!entry || now - entry.firstRequest > windowMs) {
      entry = { count: 1, firstRequest: now, lastRequest: now };
      this.entries.set(key, entry);
    } else {
      entry.count++;
      entry.lastRequest = now;
    }
    return entry;
  }

  size(): number {
    return this.entries.size;
  }

  top(limit: number): Array<{ key: string; count: number }> {
    return Array.from(this.entries.entries())
      .map(([key, entry]) => ({ key, count: entry.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private startCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(this.entries.entries())) {
        if (now - entry.lastRequest > IDLE_EVICTION_MS) {
          this.entries.delete(key);
        }
      }
    }, CLEANUP_INTERVAL);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

const defaultStore = new MemoryRateLimitStore();

function defaultKeyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.userId) {
    return `user:${authReq.userId}`;
  }
  
  const ip = req.ip || 
             req.headers["x-forwarded-for"]?.toString().split(",")[0] || 
             req.socket.remoteAddress || 
             "unknown";
  
  return `ip:${ip}`;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip,
    message = "Too many requests, please try again later",
    store = defaultStore
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    Promise.resolve(store.hit(key, windowMs, now))
      .then((entry) => {
        const remaining = Math.max(0, maxRequests - entry.count);
        const reset = Math.ceil((entry.firstRequest + windowMs - now) / 1000);

        res.setHeader("X-RateLimit-Limit", String(maxRequests));
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        res.setHeader("X-RateLimit-Reset", String(reset));

        if (entry.count > maxRequests) {
          res.setHeader("Retry-After", String(reset));
          const error = new RateLimitError(message, reset);
          return next(error);
        }

        next();
      })
      .catch((error) => {
        // A failing store (e.g. Redis outage) must not take the API down;
        // fail open and let the request through.
        console.error(`[RateLimiter] Store error for ${key}: ${error?.message}`);
        next();
      });
  };
}

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: "Too many API requests, please try again later"
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req: Request) => {
    const ip = req.ip || 
               req.headers["x-forwarded-for"]?.toString().split(",")[0] || 
               "unknown";
    return `auth:${ip}`;
  },
  message: "Too many login attempts, please try again later"
});

export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Rate limit exceeded for this sensitive operation"
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: "Too many payment requests, please wait before trying again"
});

export function getRateLimitStats(): { totalKeys: number; entries: Array<{ key: string; count: number }> } {
  return {
    totalKeys: defaultStore.size(),
    entries: defaultStore.top(20)
  };
}
