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

import { Router, Request, Response } from "express";
import { RouteContext, AuthRequest } from "./common";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { eq, desc, and, sql, inArray, gte, lt } from "drizzle-orm";
import { 
  users, plans, userSubscriptions, otpVerifications, refreshTokens,
  campaigns, contacts, calls, agents, paymentTransactions, creditTransactions
} from "@shared/schema";
import { NotificationService } from "../services/notification-service";
import { logger } from '../utils/logger';
import { 
  createRefreshTokenData, 
  hashRefreshToken, 
  generateShortAccessToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  AUTH_CONSTANTS
} from "../middleware/auth";

export function createAuthRoutes(ctx: RouteContext): Router {
  const router = Router();
  const { db, storage, authenticateToken, requireRole, generateTokenAsync, 
          checkUserActive, authRateLimiter, emailService } = ctx;

  // ============================================
  // CHECK EMAIL ENDPOINT
  // ============================================

  router.post("/api/auth/check-email", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      return res.json({ exists: !!user });
    } catch (error: any) {
      return res.status(500).json({ error: "Failed to check email" });
    }
  });

  // ============================================
  // OTP ENDPOINTS FOR EMAIL VERIFICATION
  // ============================================

  router.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const { email, name } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Calculate cutoff time to avoid SQL injection via sql.raw
      const otpCutoffTime = new Date(Date.now() - 5 * 60 * 1000);
      const recentOTPs = await db
        .select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.email, email),
          gte(otpVerifications.createdAt, otpCutoffTime)
        ));

      if (recentOTPs.length >= 3) {
        return res.status(429).json({ error: "Too many OTP requests. Please try again in 5 minutes." });
      }

      const otpExpirySetting = await storage.getGlobalSetting('otp_expiry_minutes');
      const otpExpiryMinutes = typeof otpExpirySetting?.value === 'number' ? otpExpirySetting.value : 5;
      
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

      await db.insert(otpVerifications).values({
        email,
        otpCode,
        expiresAt,
      });

      await emailService.sendOTPEmail(email, otpCode, name, otpExpiryMinutes);

      logger.info(`Sent verification code to ${email}`, undefined, 'Auth');
      
      res.json({ success: true, message: "Verification code sent to your email" });
    } catch (error: any) {
      logger.error('Send OTP error', error, 'Auth');
      res.status(500).json({ error: error.message || "Failed to send verification code" });
    }
  });

  router.post("/api/auth/verify-otp", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, otpCode } = req.body;

      if (!email || !otpCode) {
        return res.status(400).json({ error: "Email and OTP code are required" });
      }

      const [otpRecord] = await db
        .select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.verified, false)
        ))
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);

      if (!otpRecord) {
        return res.status(404).json({ error: "No verification code found. Please request a new code." });
      }

      if (new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      if (otpRecord.attempts >= 3) {
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
      }

      if (otpRecord.otpCode !== otpCode) {
        await db
          .update(otpVerifications)
          .set({ attempts: otpRecord.attempts + 1 })
          .where(eq(otpVerifications.id, otpRecord.id));

        return res.status(400).json({ 
          error: `Invalid verification code. ${3 - (otpRecord.attempts + 1)} attempts remaining.` 
        });
      }

      await db
        .update(otpVerifications)
        .set({ verified: true })
        .where(eq(otpVerifications.id, otpRecord.id));

      logger.info(`Email verified: ${email}`, undefined, 'Auth');
      
      res.json({ success: true, message: "Email verified successfully" });
    } catch (error: any) {
      logger.error('Verify OTP error', error, 'Auth');
      res.status(500).json({ error: error.message || "Failed to verify code" });
    }
  });

  // ============================================
  // FORGOT PASSWORD ENDPOINTS
  // ============================================

  router.post("/api/auth/forgot-password/send-otp", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (!existingUser) {
        return res.json({ success: true, message: "If an account exists with this email, a verification code has been sent." });
      }

      const expiryMinutesSetting = await storage.getGlobalSetting('password_reset_expiry_minutes');
      const expiryMinutes = (expiryMinutesSetting?.value as number) || 5;

      // Calculate cutoff time in application code to avoid SQL injection via sql.raw
      const cutoffTime = new Date(Date.now() - expiryMinutes * 60 * 1000);
      const recentOTPs = await db
        .select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.email, email),
          gte(otpVerifications.createdAt, cutoffTime)
        ));

      if (recentOTPs.length >= 3) {
        return res.status(429).json({ error: `Too many OTP requests. Please try again in ${expiryMinutes} minutes.` });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      await db.insert(otpVerifications).values({
        email,
        otpCode,
        expiresAt,
      });

      await emailService.sendPasswordResetEmail(email, otpCode, existingUser.name, expiryMinutes);

      logger.info(`Password reset: Sent verification code to ${email} (expires in ${expiryMinutes} min)`, undefined, 'Auth');
      
      res.json({ success: true, message: "If an account exists with this email, a verification code has been sent." });
    } catch (error: any) {
      logger.error('Forgot password send OTP error', error, 'Auth');
      res.status(500).json({ error: error.message || "Failed to send verification code" });
    }
  });

  router.post("/api/auth/forgot-password/verify-otp", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, otpCode } = req.body;

      if (!email || !otpCode) {
        return res.status(400).json({ error: "Email and OTP code are required" });
      }

      const [otpRecord] = await db
        .select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.verified, false)
        ))
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);

      if (!otpRecord) {
        return res.status(404).json({ error: "No verification code found. Please request a new code." });
      }

      if (new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      if (otpRecord.attempts >= 3) {
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new code." });
      }

      if (otpRecord.otpCode !== otpCode) {
        await db
          .update(otpVerifications)
          .set({ attempts: otpRecord.attempts + 1 })
          .where(eq(otpVerifications.id, otpRecord.id));

        return res.status(400).json({ 
          error: `Invalid verification code. ${3 - (otpRecord.attempts + 1)} attempts remaining.` 
        });
      }

      await db
        .update(otpVerifications)
        .set({ verified: true })
        .where(eq(otpVerifications.id, otpRecord.id));

      logger.info(`Password reset: OTP verified for ${email}`, undefined, 'Auth');
      
      res.json({ success: true, message: "Verification successful" });
    } catch (error: any) {
      logger.error('Forgot password verify OTP error', error, 'Auth');
      res.status(500).json({ error: error.message || "Failed to verify code" });
    }
  });

  router.post("/api/auth/forgot-password/reset", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const [verifiedOTP] = await db
        .select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.verified, true)
        ))
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);

      if (!verifiedOTP || (new Date().getTime() - verifiedOTP.createdAt!.getTime()) > 10 * 60 * 1000) {
        return res.status(400).json({ error: "Password reset session expired. Please start over." });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email));

      await db
        .delete(otpVerifications)
        .where(eq(otpVerifications.email, email));

      logger.info(`Password reset: Password updated for ${email}`, undefined, 'Auth');
      
      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error: any) {
      logger.error('Password reset error', error, 'Auth');
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  // ============================================
  // REGISTRATION ENDPOINT
  // ============================================

  router.post("/api/auth/register", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const [verifiedOTP] = await db
        .select()
        .from(otpVerifications)
        .where(and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.verified, true)
        ))
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);

      if (!verifiedOTP) {
        return res.status(400).json({ error: "Email not verified. Please complete OTP verification first." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: "user",
      });

      const [freePlan] = await db.select().from(plans).where(eq(plans.name, 'free')).limit(1);
      const initialCredits = freePlan?.includedCredits ?? 0;
      
      if (initialCredits > 0) {
        await storage.updateUserCredits(user.id, initialCredits);
      }
      
      if (freePlan) {
        const now = new Date();
        const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        await db.insert(userSubscriptions).values({
          userId: user.id,
          planId: freePlan.id,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: oneYearFromNow,
          billingPeriod: 'monthly',
        });
        logger.info(`Registration: Created Free plan subscription for user ${user.id} with ${initialCredits} credits`, undefined, 'Auth');
      }

      const updatedUser = await storage.getUser(user.id);

      await NotificationService.notifyWelcome(user.id, user.name);

      try {
        const emailResult = await emailService.sendWelcomeEmail(user.id);
        if (emailResult.success) {
          logger.info(`Welcome email sent successfully to user ${user.id}`, undefined, 'Auth');
        } else {
          logger.warn(`Welcome email not sent to user ${user.id}: ${emailResult.error}`, undefined, 'Auth');
        }
      } catch (emailError: any) {
        logger.error(`Exception sending welcome email to user ${user.id}`, emailError?.message || emailError, 'Auth');
      }

      const accessToken = generateShortAccessToken(user.id, user.role);
      
      const userAgent = req.headers['user-agent'] || undefined;
      const ipAddress = req.ip || req.connection.remoteAddress || undefined;
      const refreshTokenData = createRefreshTokenData(user.id, userAgent, ipAddress);
      
      await db.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenData.hashedToken,
        expiresAt: refreshTokenData.expiresAt,
        userAgent: refreshTokenData.userAgent,
        ipAddress: refreshTokenData.ipAddress,
        lastUsedAt: new Date(),
      });

      // Set refresh token as HttpOnly cookie (XSS-safe)
      setRefreshTokenCookie(res, refreshTokenData.token);

      res.json({
        user: { 
          id: updatedUser!.id, 
          email: updatedUser!.email, 
          name: updatedUser!.name, 
          role: updatedUser!.role, 
          credits: updatedUser!.credits
        },
        token: accessToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
      });
    } catch (error: any) {
      logger.error('Registration error', error, 'Auth');
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ============================================
  // LOGIN ENDPOINT
  // ============================================

  router.post("/api/auth/login", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      logger.debug('Login user from DB', { id: user.id, email: user.email, role: user.role }, 'Auth');

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (user.isActive === false) {
        logger.info(`Login blocked: User ${user.id} account is suspended`, undefined, 'Auth');
        return res.status(403).json({ 
          error: "Your account has been suspended. Please contact support for assistance.",
          code: "ACCOUNT_SUSPENDED"
        });
      }

      const accessToken = generateShortAccessToken(user.id, user.role);
      
      const userAgent = req.headers['user-agent'] || undefined;
      const ipAddress = req.ip || req.connection.remoteAddress || undefined;
      const refreshTokenData = createRefreshTokenData(user.id, userAgent, ipAddress);
      
      await db.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenData.hashedToken,
        expiresAt: refreshTokenData.expiresAt,
        userAgent: refreshTokenData.userAgent,
        ipAddress: refreshTokenData.ipAddress,
        lastUsedAt: new Date(),
      });

      const responseUser: any = { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        credits: user.credits,
        planType: user.planType
      };

      logger.debug('Login response user', responseUser, 'Auth');

      // Set refresh token as HttpOnly cookie (XSS-safe)
      setRefreshTokenCookie(res, refreshTokenData.token);

      res.json({
        user: responseUser,
        token: accessToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
      });
    } catch (error: any) {
      logger.error('Login error', error, 'Auth');
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ============================================
  // REFRESH TOKEN ENDPOINT
  // ============================================

  router.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      // Read refresh token from HttpOnly cookie (more secure than request body)
      const refreshToken = getRefreshTokenFromCookie(req);

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const hashedToken = hashRefreshToken(refreshToken);
      
      const [tokenRecord] = await db
        .select()
        .from(refreshTokens)
        .where(and(
          eq(refreshTokens.token, hashedToken),
          eq(refreshTokens.isValid, true)
        ))
        .limit(1);

      if (!tokenRecord) {
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      if (new Date() > tokenRecord.expiresAt) {
        await db
          .update(refreshTokens)
          .set({ isValid: false })
          .where(eq(refreshTokens.id, tokenRecord.id));
        return res.status(401).json({ error: "Refresh token has expired" });
      }

      const user = await storage.getUser(tokenRecord.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.isActive === false) {
        return res.status(403).json({ 
          error: "Your account has been suspended",
          code: "ACCOUNT_SUSPENDED"
        });
      }

      await db
        .update(refreshTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(refreshTokens.id, tokenRecord.id));

      const newAccessToken = generateShortAccessToken(user.id, user.role);

      res.json({
        token: newAccessToken,
        expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
      });
    } catch (error: any) {
      logger.error('Refresh token error', error, 'Auth');
      res.status(500).json({ error: "Token refresh failed" });
    }
  });

  // ============================================
  // LOGOUT ENDPOINT (Revoke Refresh Token)
  // ============================================

  router.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      // Read refresh token from HttpOnly cookie
      const refreshToken = getRefreshTokenFromCookie(req);

      if (refreshToken) {
        const hashedToken = hashRefreshToken(refreshToken);
        await db
          .update(refreshTokens)
          .set({ isValid: false })
          .where(eq(refreshTokens.token, hashedToken));
      }

      // Clear the refresh token cookie
      clearRefreshTokenCookie(res);

      res.json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      logger.error('Logout error', error, 'Auth');
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // ============================================
  // REVOKE ALL SESSIONS ENDPOINT
  // ============================================

  router.post("/api/auth/revoke-all-sessions", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      await db
        .update(refreshTokens)
        .set({ isValid: false })
        .where(eq(refreshTokens.userId, req.userId!));

      res.json({ success: true, message: "All sessions have been revoked" });
    } catch (error: any) {
      logger.error('Revoke all sessions error', error, 'Auth');
      res.status(500).json({ error: "Failed to revoke sessions" });
    }
  });

  // ============================================
  // GET CURRENT USER
  // ============================================

  router.get("/api/auth/me", authenticateToken, checkUserActive(storage), async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let actualPlanType = user.planType || 'free';
      try {
        const subscription = await storage.getUserSubscription(req.userId!);
        if (subscription?.plan?.name) {
          actualPlanType = subscription.plan.name;
        }
      } catch (subError: any) {
        logger.warn('Could not fetch subscription, using user.planType', subError.message, 'Auth');
      }

      const response: any = { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        planType: actualPlanType,
        credits: user.credits,
        company: user.company || null,
        timezone: user.timezone || null,
        cookieConsent: user.cookieConsent || false,
        analyticsConsent: user.analyticsConsent || false,
        marketingConsent: user.marketingConsent || false,
        consentTimestamp: user.consentTimestamp || null,
        kycStatus: user.kycStatus || 'pending',
        kycSubmittedAt: user.kycSubmittedAt || null,
        kycApprovedAt: user.kycApprovedAt || null,
        kycRejectionReason: user.kycRejectionReason || null
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Get user error', error, 'Auth');
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // ============================================
  // UPDATE USER PROFILE
  // ============================================

  router.patch("/api/auth/me", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { name, timezone, company, cookieConsent, analyticsConsent, marketingConsent } = req.body;
      
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      
      if (name !== undefined && typeof name === 'string' && name.trim()) {
        updateData.name = name.trim();
      }
      
      if (company !== undefined) {
        if (company === null || company === '') {
          updateData.company = null;
        } else if (typeof company === 'string') {
          updateData.company = company.trim();
        }
      }
      
      if (timezone !== undefined) {
        if (timezone === null || timezone === '') {
          updateData.timezone = null;
        } else if (typeof timezone === 'string') {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
            updateData.timezone = timezone;
          } catch (e) {
            return res.status(400).json({ error: "Invalid timezone. Please use a valid IANA timezone like 'America/New_York'" });
          }
        }
      }
      
      if (cookieConsent !== undefined) {
        updateData.cookieConsent = Boolean(cookieConsent);
        updateData.consentTimestamp = new Date();
      }
      if (analyticsConsent !== undefined) {
        updateData.analyticsConsent = Boolean(analyticsConsent);
        updateData.consentTimestamp = new Date();
      }
      if (marketingConsent !== undefined) {
        updateData.marketingConsent = Boolean(marketingConsent);
        updateData.consentTimestamp = new Date();
      }

      await db.update(users)
        .set(updateData)
        .where(eq(users.id, req.userId!));

      const updatedUser = await storage.getUser(req.userId!);
      res.json({ 
        success: true, 
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          name: updatedUser!.name,
          company: updatedUser!.company,
          timezone: updatedUser!.timezone,
          cookieConsent: updatedUser!.cookieConsent,
          analyticsConsent: updatedUser!.analyticsConsent,
          marketingConsent: updatedUser!.marketingConsent,
          consentTimestamp: updatedUser!.consentTimestamp
        }
      });
    } catch (error: any) {
      logger.error('Update user error', error, 'Auth');
      res.status(500).json({ error: "Failed to update user settings" });
    }
  });

  // ============================================
  // CHANGE PASSWORD
  // ============================================

  router.post("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users)
        .set({ 
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, req.userId!));

      logger.info(`Password changed for user: ${user.email}`, undefined, 'Auth');
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      logger.error('Change password error', error, 'Auth');
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ============================================
  // GDPR DATA EXPORT
  // ============================================

  router.get("/api/auth/export-data", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const exportCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
      
      const campaignIds = exportCampaigns.map(c => c.id);
      const exportContacts = campaignIds.length > 0 
        ? await db.select().from(contacts).where(inArray(contacts.campaignId, campaignIds))
        : [];
      
      const exportCalls = await db.select().from(calls).where(eq(calls.userId, userId));
      
      const exportAgents = await db.select().from(agents).where(eq(agents.userId, userId));
      
      const exportPayments = await db.select().from(paymentTransactions).where(eq(paymentTransactions.userId, userId));
      
      const exportCredits = await db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId));
      
      const exportSubscriptions = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId));

      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          planType: user.planType,
          credits: user.credits,
          timezone: user.timezone,
          createdAt: user.createdAt,
        },
        campaigns: exportCampaigns.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          totalContacts: c.totalContacts,
          createdAt: c.createdAt,
        })),
        contacts: exportContacts.map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email,
          createdAt: c.createdAt,
        })),
        calls: exportCalls.map(c => ({
          id: c.id,
          status: c.status,
          duration: c.duration,
          transcript: c.transcript,
          aiSummary: c.aiSummary,
          createdAt: c.createdAt,
        })),
        agents: exportAgents.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          language: a.language,
          createdAt: a.createdAt,
        })),
        paymentTransactions: exportPayments.map(t => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          createdAt: t.createdAt,
        })),
        creditTransactions: exportCredits.map(t => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt,
        })),
        subscriptions: exportSubscriptions,
      };

      const jsonData = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(jsonData, 'utf-8');
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="agentlabs-export-${new Date().toISOString().split('T')[0]}.json"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error: any) {
      logger.error('Export data error', error, 'Auth');
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // ============================================
  // ACCOUNT DELETION (SOFT DELETE)
  // ============================================

  router.post("/api/auth/delete-account", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: "Password is required to delete account" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.role === 'admin') {
        return res.status(403).json({ error: "Admin accounts cannot be deleted through this endpoint" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      await db.update(users)
        .set({ 
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: 'user',
          isActive: false
        })
        .where(eq(users.id, req.userId!));

      res.json({ success: true, message: "Account has been scheduled for deletion" });
    } catch (error: any) {
      logger.error('Delete account error', error, 'Auth');
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // ============================================
  // UAE PASS OAUTH ENDPOINTS
  // ============================================

  const UAEPASS_CONFIG = {
    clientId: process.env.UAEPASS_CLIENT_ID || 'sandbox_stage',
    clientSecret: process.env.UAEPASS_CLIENT_SECRET || 'sandbox_stage',
    baseUrl: process.env.UAEPASS_BASE_URL || 'https://stg-id.uaepass.ae/idshub',
    redirectUri: process.env.UAEPASS_REDIRECT_URI || '',
    scope: 'urn:uae:digitalid:profile:general',
    acrValues: 'urn:safelayer:tws:policies:authentication:level:low',
  };

  const uaePassStates = new Map<string, { createdAt: number }>();

  setInterval(() => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of uaePassStates.entries()) {
      if (val.createdAt < tenMinutesAgo) uaePassStates.delete(key);
    }
  }, 60 * 1000);

  router.get("/api/auth/uaepass/authorize", (req: Request, res: Response) => {
    try {
      if (!UAEPASS_CONFIG.redirectUri) {
        return res.status(500).json({ error: "UAE Pass redirect URI not configured" });
      }

      const state = crypto.randomBytes(32).toString('hex');
      uaePassStates.set(state, { createdAt: Date.now() });

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: UAEPASS_CONFIG.clientId,
        scope: UAEPASS_CONFIG.scope,
        state,
        redirect_uri: UAEPASS_CONFIG.redirectUri,
        acr_values: UAEPASS_CONFIG.acrValues,
        ui_locales: 'en',
      });

      const authUrl = `${UAEPASS_CONFIG.baseUrl}/authorize?${params.toString()}`;
      res.json({ authUrl, state });
    } catch (error: any) {
      logger.error('UAE Pass authorize error', error, 'Auth');
      res.status(500).json({ error: "Failed to initiate UAE Pass authentication" });
    }
  });

  router.get("/api/auth/uaepass/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error: uaeError } = req.query;

      if (uaeError) {
        logger.warn(`UAE Pass auth denied: ${uaeError}`, undefined, 'Auth');
        return res.redirect(`/login?error=uaepass_denied`);
      }

      if (!code || !state) {
        return res.redirect(`/login?error=uaepass_missing_params`);
      }

      const stateStr = state as string;
      if (!uaePassStates.has(stateStr)) {
        return res.redirect(`/login?error=uaepass_invalid_state`);
      }
      uaePassStates.delete(stateStr);

      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('code', code as string);
      formData.append('redirect_uri', UAEPASS_CONFIG.redirectUri);
      formData.append('client_id', UAEPASS_CONFIG.clientId);
      formData.append('client_secret', UAEPASS_CONFIG.clientSecret);

      const tokenResponse = await fetch(`${UAEPASS_CONFIG.baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error(`UAE Pass token exchange failed: ${tokenResponse.status} ${errorText}`, undefined, 'Auth');
        return res.redirect(`/login?error=uaepass_token_failed`);
      }

      const tokenData = await tokenResponse.json() as { access_token: string; token_type: string };
      const accessToken = tokenData.access_token;

      const userInfoResponse = await fetch(`${UAEPASS_CONFIG.baseUrl}/userinfo`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!userInfoResponse.ok) {
        logger.error(`UAE Pass userinfo failed: ${userInfoResponse.status}`, undefined, 'Auth');
        return res.redirect(`/login?error=uaepass_userinfo_failed`);
      }

      const uaeProfile = await userInfoResponse.json() as {
        uuid?: string;
        sub?: string;
        email?: string;
        firstnameEN?: string;
        lastnameEN?: string;
        firstnameAR?: string;
        lastnameAR?: string;
        gender?: string;
        mobile?: string;
        nationalityEN?: string;
        idn?: string;
      };

      const uaePassId = uaeProfile.uuid || uaeProfile.sub || '';
      const fullName = [uaeProfile.firstnameEN, uaeProfile.lastnameEN].filter(Boolean).join(' ') || 'UAE Pass User';
      const email = uaeProfile.email || `${uaePassId}@uaepass.local`;

      let user = await storage.getUserByEmail(email);

      if (!user) {
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        user = await storage.createUser({
          email,
          password: hashedPassword,
          name: fullName,
          role: 'user',
          kycStatus: 'pending',
        });

        const [freePlan] = await db.select().from(plans).where(eq(plans.name, 'free')).limit(1);
        if (freePlan) {
          const initialCredits = freePlan.includedCredits ?? 0;
          if (initialCredits > 0) {
            await storage.updateUserCredits(user.id, initialCredits);
          }
          const now = new Date();
          const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          await db.insert(userSubscriptions).values({
            userId: user.id,
            planId: freePlan.id,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: oneYearFromNow,
            billingPeriod: 'monthly',
          });
        }

        await NotificationService.notifyWelcome(user.id, user.name);
        logger.info(`UAE Pass: New user created ${user.id} (${email})`, undefined, 'Auth');
      }

      const jwtToken = generateShortAccessToken(user.id, user.role);

      const userAgent = req.headers['user-agent'] || undefined;
      const ipAddress = req.ip || req.connection.remoteAddress || undefined;
      const refreshTokenData = createRefreshTokenData(user.id, userAgent, ipAddress);

      await db.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenData.hashedToken,
        expiresAt: refreshTokenData.expiresAt,
        userAgent: refreshTokenData.userAgent,
        ipAddress: refreshTokenData.ipAddress,
        lastUsedAt: new Date(),
      });

      setRefreshTokenCookie(res, refreshTokenData.token);

      const kycStatus = user.kycStatus || 'pending';
      const redirectPath = (kycStatus === 'pending' || kycStatus === 'submitted') ? '/onboarding' : '/app';

      const callbackHtml = `<!DOCTYPE html><html><head><title>Authenticating...</title></head><body><script>
        try {
          const authData = ${JSON.stringify({
            token: jwtToken,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, credits: user.credits },
            expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
          })};
          localStorage.setItem('auth_token', authData.token);
          localStorage.setItem('user', JSON.stringify(authData.user));
          var expiryTime = Date.now() + authData.expiresIn * 1000;
          localStorage.setItem('token_expiry', expiryTime.toString());
          window.location.href = '${redirectPath}';
        } catch(e) { window.location.href = '/login?error=uaepass_storage_failed'; }
      </script></body></html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(callbackHtml);
    } catch (error: any) {
      logger.error('UAE Pass callback error', error, 'Auth');
      res.redirect(`/login?error=uaepass_callback_failed`);
    }
  });

  return router;
}
