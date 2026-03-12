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
 * 
 * REFACTORED: This file now uses modular route registration.
 * Individual route modules are located in ./admin/ directory.
 * ============================================================
 */
import { Router, Response } from 'express';
import { checkAdminWithReadOnly, AdminRequest } from '../middleware/admin-auth';
import { storage } from '../storage';
import Stripe from 'stripe';
import {
  getStripeCurrency,
} from '../services/stripe-service';

import {
  registerUsersRoutes,
  registerPlansRoutes,
  registerCreditPackagesRoutes,
  registerSettingsRoutes,
  registerConnectionsRoutes,
  registerWebhooksSetupRoutes,
  registerBrandingRoutes,
  registerSmtpRoutes,
  registerSeoRoutes,
  registerPhoneNumbersRoutes,
  registerElevenlabsPoolRoutes,
  registerCallsModerationRoutes,
  registerAwsCredentialsRoutes,
  registerCallErrorRoutes,
} from './admin/index';

const router = Router();

router.use(checkAdminWithReadOnly);

registerUsersRoutes(router);
registerPlansRoutes(router);
registerCreditPackagesRoutes(router);
registerSettingsRoutes(router);
registerConnectionsRoutes(router);
registerWebhooksSetupRoutes(router);
registerBrandingRoutes(router);
registerSmtpRoutes(router);
registerSeoRoutes(router);
registerPhoneNumbersRoutes(router);
registerElevenlabsPoolRoutes(router);
registerCallsModerationRoutes(router);
registerAwsCredentialsRoutes(router);
registerCallErrorRoutes(router);

async function getStripeClient(): Promise<Stripe | null> {
  try {
    const dbSetting = await storage.getGlobalSetting('stripe_secret_key');
    const secretKey = (dbSetting?.value as string) || process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey) {
      return null;
    }
    
    return new Stripe(secretKey, { apiVersion: '2025-10-29.clover' });
  } catch (error) {
    console.error('Error initializing Stripe client:', error);
    return null;
  }
}

async function getDefaultCurrency(): Promise<string> {
  try {
    const currencyConfig = await getStripeCurrency();
    return currencyConfig.currency;
  } catch (error) {
    console.error('Error getting default currency:', error);
    return 'USD';
  }
}

router.get('/analytics', async (req: AdminRequest, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    const allPlans = await storage.getAllPlans();
    const allAgents = await storage.getAgents();
    const allCampaigns = await storage.getAllCampaigns();
    
    const activeUsers = allUsers.filter(u => !u.deletedAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsersThisMonth = activeUsers.filter(u => new Date(u.createdAt) > thirtyDaysAgo);
    const paidUsers = activeUsers.filter(u => u.planId && u.planId !== 'free');
    
    const analytics = {
      totalUsers: activeUsers.length,
      newUsersThisMonth: newUsersThisMonth.length,
      paidUsers: paidUsers.length,
      totalAgents: allAgents.length,
      totalCampaigns: allCampaigns.length,
      totalPlans: allPlans.length,
      activePlans: allPlans.filter(p => p.isActive).length,
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/contacts', async (req: AdminRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 50;
    
    const allContacts = await storage.getAllContacts();
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedContacts = allContacts.slice(startIndex, endIndex);
    
    res.json({
      data: paginatedContacts,
      pagination: {
        page,
        pageSize,
        totalItems: allContacts.length,
        totalPages: Math.ceil(allContacts.length / pageSize)
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

export const adminRouter = router;
export default router;
