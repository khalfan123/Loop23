'use strict';
import { Router, Response } from 'express';
import { storage } from '../../storage';
import { AdminRequest } from '../../middleware/admin-auth';
import { insertPlanSchema } from '@shared/schema';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { 
  resetRazorpayClient, 
  getActivePaymentGateway, 
  createRazorpayPlan,
  isRazorpayConfigured
} from '../../services/razorpay-service';
import {
  resetStripeClient,
  getStripeCurrency,
} from '../../services/stripe-service';
import {
  isPayPalConfigured,
  createPayPalProduct,
  createPayPalPlan,
  getPayPalCurrency,
} from '../../services/paypal-service';
import {
  isPaystackConfigured,
  createPaystackPlan,
  getPaystackCurrency,
} from '../../services/paystack-service';
import {
  isMercadoPagoConfigured,
  createMercadoPagoSubscriptionPlan,
  getMercadoPagoCurrency,
} from '../../services/mercadopago-service';

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

function convertPriceFields(bodyData: any): any {
  const result = { ...bodyData };
  const priceFields = [
    'monthlyPrice', 'yearlyPrice', 'razorpayMonthlyPrice', 'razorpayYearlyPrice',
    'paypalMonthlyPrice', 'paypalYearlyPrice', 'paystackMonthlyPrice', 'paystackYearlyPrice',
    'mercadopagoMonthlyPrice', 'mercadopagoYearlyPrice'
  ];
  
  for (const field of priceFields) {
    if (typeof result[field] === 'number') {
      result[field] = result[field].toFixed(2);
    }
  }
  
  return result;
}

export function registerPlansRoutes(router: Router) {
  router.get('/plans', async (req: AdminRequest, res: Response) => {
    try {
      const plans = await storage.getAllPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({ error: 'Failed to fetch plans' });
    }
  });

  router.post('/plans', async (req: AdminRequest, res: Response) => {
    try {
      const bodyData = convertPriceFields(req.body);
      
      let planData;
      try {
        planData = insertPlanSchema.parse(bodyData);
      } catch (validationError: any) {
        if (validationError.errors) {
          return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationError.errors 
          });
        }
        throw validationError;
      }
      
      let newPlan = await storage.createPlan(planData);
      
      const razorpayConfigured = await isRazorpayConfigured();
      if (razorpayConfigured) {
        try {
          const monthlyInrAmount = planData.razorpayMonthlyPrice ? parseFloat(planData.razorpayMonthlyPrice.toString()) : 0;
          let razorpayMonthlyPlanId: string | null = null;
          
          if (monthlyInrAmount > 0) {
            const monthlyPlan = await createRazorpayPlan({
              period: 'monthly',
              interval: 1,
              name: `${planData.displayName} - Monthly`,
              amount: monthlyInrAmount,
              currency: 'INR',
              description: planData.description || undefined,
              notes: { planId: newPlan.id, billingPeriod: 'monthly' }
            });
            razorpayMonthlyPlanId = monthlyPlan.id;
            console.log(`✅ [Razorpay] Created monthly plan ${monthlyPlan.id} with INR ${monthlyInrAmount}`);
          }
          
          let razorpayYearlyPlanId: string | null = null;
          const yearlyInrAmount = planData.razorpayYearlyPrice ? parseFloat(planData.razorpayYearlyPrice.toString()) : 0;
          if (yearlyInrAmount > 0) {
            const yearlyPlan = await createRazorpayPlan({
              period: 'yearly',
              interval: 1,
              name: `${planData.displayName} - Yearly`,
              amount: yearlyInrAmount,
              currency: 'INR',
              description: planData.description || undefined,
              notes: { planId: newPlan.id, billingPeriod: 'yearly' }
            });
            razorpayYearlyPlanId = yearlyPlan.id;
            console.log(`✅ [Razorpay] Created yearly plan ${yearlyPlan.id} with INR ${yearlyInrAmount}`);
          }
          
          if (razorpayMonthlyPlanId || razorpayYearlyPlanId) {
            await storage.updatePlan(newPlan.id, { razorpayPlanId: razorpayMonthlyPlanId, razorpayYearlyPlanId });
            const updatedPlan = await storage.getPlan(newPlan.id);
            if (updatedPlan) newPlan = updatedPlan;
          }
        } catch (razorpayError: any) {
          console.error('❌ [Razorpay] Error syncing plan to Razorpay:', razorpayError.message);
        }
      }
      
      const stripe = await getStripeClient();
      if (stripe) {
        try {
          const currency = await getDefaultCurrency();
          
          const stripeProduct = await stripe.products.create({
            name: planData.displayName,
            description: planData.description || undefined,
            metadata: { planId: newPlan.id, planName: planData.name }
          });
          
          const monthlyAmount = parseFloat(planData.monthlyPrice.toString());
          let monthlyPrice: Stripe.Price | null = null;
          if (monthlyAmount > 0) {
            monthlyPrice = await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: Math.round(monthlyAmount * 100),
              currency: currency.toLowerCase(),
              recurring: { interval: 'month' },
              metadata: { planId: newPlan.id, billingPeriod: 'monthly' }
            });
          }
          
          let yearlyPrice: Stripe.Price | null = null;
          if (planData.yearlyPrice) {
            const yearlyAmount = parseFloat(planData.yearlyPrice.toString());
            if (yearlyAmount > 0) {
              yearlyPrice = await stripe.prices.create({
                product: stripeProduct.id,
                unit_amount: Math.round(yearlyAmount * 100),
                currency: currency.toLowerCase(),
                recurring: { interval: 'year' },
                metadata: { planId: newPlan.id, billingPeriod: 'yearly' }
              });
            }
          }
          
          await storage.updatePlan(newPlan.id, {
            stripeProductId: stripeProduct.id,
            stripeMonthlyPriceId: monthlyPrice?.id || null,
            stripeYearlyPriceId: yearlyPrice?.id || null
          });
          
          const updatedPlan = await storage.getPlan(newPlan.id);
          if (updatedPlan) newPlan = updatedPlan;
          
          console.log(`✅ [Stripe] Created product ${stripeProduct.id} and prices for plan ${newPlan.id}`);
        } catch (stripeError: any) {
          console.error('❌ [Stripe] Error syncing plan to Stripe:', stripeError.message);
        }
      }
      
      const paypalConfigured = await isPayPalConfigured();
      if (paypalConfigured) {
        try {
          const paypalCurrency = await getPayPalCurrency();
          const paypalUpdateData: any = {};
          
          const paypalProduct = await createPayPalProduct({
            name: planData.displayName,
            description: planData.description || undefined,
            type: 'SERVICE',
          });
          paypalUpdateData.paypalProductId = paypalProduct.id;
          
          const paypalMonthlyAmount = planData.paypalMonthlyPrice ? parseFloat(planData.paypalMonthlyPrice.toString()) : 0;
          if (paypalMonthlyAmount > 0) {
            const monthlyPlan = await createPayPalPlan({
              productId: paypalProduct.id,
              name: `${planData.displayName} - Monthly`,
              description: planData.description || undefined,
              billingCycles: [{
                frequency: { interval_unit: 'MONTH', interval_count: 1 },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                  fixed_price: { value: paypalMonthlyAmount.toFixed(2), currency_code: paypalCurrency.currency },
                },
              }],
            });
            paypalUpdateData.paypalMonthlyPlanId = monthlyPlan.id;
          }
          
          const paypalYearlyAmount = planData.paypalYearlyPrice ? parseFloat(planData.paypalYearlyPrice.toString()) : 0;
          if (paypalYearlyAmount > 0) {
            const yearlyPlan = await createPayPalPlan({
              productId: paypalProduct.id,
              name: `${planData.displayName} - Yearly`,
              description: planData.description || undefined,
              billingCycles: [{
                frequency: { interval_unit: 'YEAR', interval_count: 1 },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                  fixed_price: { value: paypalYearlyAmount.toFixed(2), currency_code: paypalCurrency.currency },
                },
              }],
            });
            paypalUpdateData.paypalYearlyPlanId = yearlyPlan.id;
          }
          
          if (Object.keys(paypalUpdateData).length > 0) {
            await storage.updatePlan(newPlan.id, paypalUpdateData);
            const updatedPlan = await storage.getPlan(newPlan.id);
            if (updatedPlan) newPlan = updatedPlan;
          }
        } catch (paypalError: any) {
          console.error('❌ [PayPal] Error syncing plan to PayPal:', paypalError.message);
        }
      }
      
      const paystackConfigured = await isPaystackConfigured();
      if (paystackConfigured) {
        try {
          const paystackCurrency = await getPaystackCurrency();
          const paystackUpdateData: any = {};
          const PAYSTACK_MIN_AMOUNT = 100;
          
          const paystackMonthlyAmount = planData.paystackMonthlyPrice ? parseFloat(planData.paystackMonthlyPrice.toString()) : 0;
          if (paystackMonthlyAmount >= PAYSTACK_MIN_AMOUNT) {
            const monthlyPlan = await createPaystackPlan({
              name: `${planData.displayName} - Monthly`,
              interval: 'monthly',
              amount: paystackMonthlyAmount,
              currency: paystackCurrency.currency,
              description: planData.description || undefined,
            });
            paystackUpdateData.paystackMonthlyPlanCode = monthlyPlan.plan_code;
          }
          
          const paystackYearlyAmount = planData.paystackYearlyPrice ? parseFloat(planData.paystackYearlyPrice.toString()) : 0;
          if (paystackYearlyAmount >= PAYSTACK_MIN_AMOUNT) {
            const yearlyPlan = await createPaystackPlan({
              name: `${planData.displayName} - Yearly`,
              interval: 'annually',
              amount: paystackYearlyAmount,
              currency: paystackCurrency.currency,
              description: planData.description || undefined,
            });
            paystackUpdateData.paystackYearlyPlanCode = yearlyPlan.plan_code;
          }
          
          if (Object.keys(paystackUpdateData).length > 0) {
            await storage.updatePlan(newPlan.id, paystackUpdateData);
            const updatedPlan = await storage.getPlan(newPlan.id);
            if (updatedPlan) newPlan = updatedPlan;
          }
        } catch (paystackError: any) {
          console.error('❌ [Paystack] Error syncing plan to Paystack:', paystackError.message);
        }
      }
      
      const mercadopagoConfigured = await isMercadoPagoConfigured();
      if (mercadopagoConfigured) {
        try {
          const mercadopagoCurrency = await getMercadoPagoCurrency();
          const baseUrl = process.env.BASE_URL || process.env.APP_URL;
          const mercadopagoUpdateData: any = {};
          
          if (baseUrl) {
            const mercadopagoMonthlyAmount = planData.mercadopagoMonthlyPrice ? parseFloat(planData.mercadopagoMonthlyPrice.toString()) : 0;
            if (mercadopagoMonthlyAmount > 0) {
              const monthlyPlan = await createMercadoPagoSubscriptionPlan({
                reason: `${planData.displayName} - Monthly`,
                autoRecurring: {
                  frequency: 1,
                  frequencyType: 'months',
                  transactionAmount: mercadopagoMonthlyAmount,
                  currencyId: mercadopagoCurrency.currency,
                },
                backUrl: `${baseUrl}/app/billing`,
              });
              mercadopagoUpdateData.mercadopagoMonthlyPlanId = monthlyPlan.id;
            }
            
            const mercadopagoYearlyAmount = planData.mercadopagoYearlyPrice ? parseFloat(planData.mercadopagoYearlyPrice.toString()) : 0;
            if (mercadopagoYearlyAmount > 0) {
              const yearlyPlan = await createMercadoPagoSubscriptionPlan({
                reason: `${planData.displayName} - Yearly`,
                autoRecurring: {
                  frequency: 12,
                  frequencyType: 'months',
                  transactionAmount: mercadopagoYearlyAmount,
                  currencyId: mercadopagoCurrency.currency,
                },
                backUrl: `${baseUrl}/app/billing`,
              });
              mercadopagoUpdateData.mercadopagoYearlyPlanId = yearlyPlan.id;
            }
            
            if (Object.keys(mercadopagoUpdateData).length > 0) {
              await storage.updatePlan(newPlan.id, mercadopagoUpdateData);
              const updatedPlan = await storage.getPlan(newPlan.id);
              if (updatedPlan) newPlan = updatedPlan;
            }
          }
        } catch (mercadopagoError: any) {
          console.error('❌ [MercadoPago] Error syncing plan to MercadoPago:', mercadopagoError.message);
        }
      }
      
      res.json(newPlan);
    } catch (error: any) {
      console.error('Error creating plan:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create plan' });
    }
  });

  router.get('/plans/:planId/users', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const allUsers = await storage.getAllUsers();
      const usersOnPlan = allUsers.filter(user => {
        return user.planType && user.planType.toLowerCase() === plan.name.toLowerCase();
      });
      
      res.json({
        planId,
        planName: plan.displayName,
        userCount: usersOnPlan.length,
        users: usersOnPlan.map(u => ({ id: u.id, name: u.name, email: u.email }))
      });
    } catch (error: any) {
      console.error('Error fetching plan users:', error);
      res.status(500).json({ error: 'Failed to fetch plan users' });
    }
  });

  router.post('/plans/:planId/migrate', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      const { targetPlanId } = req.body;
      
      if (!targetPlanId) {
        return res.status(400).json({ error: 'Target plan ID is required' });
      }
      
      const sourcePlan = await storage.getPlan(planId);
      if (!sourcePlan) {
        return res.status(404).json({ error: 'Source plan not found' });
      }
      
      const targetPlan = await storage.getPlan(targetPlanId);
      if (!targetPlan) {
        return res.status(404).json({ error: 'Target plan not found' });
      }
      
      const allUsers = await storage.getAllUsers();
      const usersOnPlan = allUsers.filter(user => {
        return user.planType && user.planType.toLowerCase() === sourcePlan.name.toLowerCase();
      });
      
      if (usersOnPlan.length === 0) {
        return res.json({ success: true, migratedCount: 0 });
      }
      
      const { users } = await import('@shared/schema');
      
      for (const user of usersOnPlan) {
        await db.update(users)
          .set({ planType: targetPlan.name })
          .where(eq(users.id, user.id));
      }
      
      res.json({
        success: true,
        migratedCount: usersOnPlan.length,
        targetPlanName: targetPlan.displayName
      });
    } catch (error: any) {
      console.error('Error migrating users:', error);
      res.status(500).json({ error: 'Failed to migrate users' });
    }
  });

  router.delete('/plans/:planId', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const allUsers = await storage.getAllUsers();
      const usersOnPlan = allUsers.filter(user => {
        return user.planType && user.planType.toLowerCase() === plan.name.toLowerCase();
      });
      
      if (usersOnPlan.length > 0) {
        return res.status(400).json({ 
          error: 'USERS_NEED_MIGRATION',
          userCount: usersOnPlan.length,
          message: `${usersOnPlan.length} user(s) are currently subscribed to this plan. Please migrate them to another plan first.` 
        });
      }
      
      await storage.deletePlan(planId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  });

  // Stripe sync endpoint
  router.post('/plans/:planId/sync/stripe', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const stripe = await getStripeClient();
      if (!stripe) {
        return res.status(400).json({ error: 'Stripe is not configured' });
      }
      
      const currency = await getDefaultCurrency();
      const monthlyAmount = parseFloat(plan.monthlyPrice?.toString() || '0');
      const yearlyAmount = parseFloat(plan.yearlyPrice?.toString() || '0');
      
      let stripeProductId = plan.stripeProductId;
      
      // Create product if it doesn't exist
      if (!stripeProductId) {
        const stripeProduct = await stripe.products.create({
          name: plan.displayName,
          description: plan.description || undefined,
          metadata: { planId: plan.id, planName: plan.name }
        });
        stripeProductId = stripeProduct.id;
      }
      
      // Create or update monthly price
      let stripeMonthlyPriceId = plan.stripeMonthlyPriceId;
      if (monthlyAmount > 0 && !stripeMonthlyPriceId) {
        const monthlyPrice = await stripe.prices.create({
          product: stripeProductId,
          unit_amount: Math.round(monthlyAmount * 100),
          currency: currency.toLowerCase(),
          recurring: { interval: 'month' },
          metadata: { planId: plan.id, billingPeriod: 'monthly' }
        });
        stripeMonthlyPriceId = monthlyPrice.id;
      }
      
      // Create or update yearly price
      let stripeYearlyPriceId = plan.stripeYearlyPriceId;
      if (yearlyAmount > 0 && !stripeYearlyPriceId) {
        const yearlyPrice = await stripe.prices.create({
          product: stripeProductId,
          unit_amount: Math.round(yearlyAmount * 100),
          currency: currency.toLowerCase(),
          recurring: { interval: 'year' },
          metadata: { planId: plan.id, billingPeriod: 'yearly' }
        });
        stripeYearlyPriceId = yearlyPrice.id;
      }
      
      await storage.updatePlan(planId, {
        stripeProductId,
        stripeMonthlyPriceId,
        stripeYearlyPriceId
      });
      
      console.log(`✅ [Stripe] Synced plan ${planId} with product ${stripeProductId}`);
      
      res.json({ 
        success: true, 
        stripeProductId,
        stripeMonthlyPriceId,
        stripeYearlyPriceId
      });
    } catch (error: any) {
      console.error('Error syncing plan to Stripe:', error);
      res.status(500).json({ error: error.message || 'Failed to sync plan to Stripe' });
    }
  });

  // Razorpay sync endpoint
  router.post('/plans/:planId/sync/razorpay', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const razorpayConfigured = await isRazorpayConfigured();
      if (!razorpayConfigured) {
        return res.status(400).json({ error: 'Razorpay is not configured' });
      }
      
      const monthlyInrAmount = plan.razorpayMonthlyPrice ? parseFloat(plan.razorpayMonthlyPrice.toString()) : 0;
      const yearlyInrAmount = plan.razorpayYearlyPrice ? parseFloat(plan.razorpayYearlyPrice.toString()) : 0;
      
      let razorpayPlanId = plan.razorpayPlanId;
      let razorpayYearlyPlanId = plan.razorpayYearlyPlanId;
      
      if (monthlyInrAmount > 0 && !razorpayPlanId) {
        const monthlyPlan = await createRazorpayPlan({
          period: 'monthly',
          interval: 1,
          name: `${plan.displayName} - Monthly`,
          amount: monthlyInrAmount,
          currency: 'INR',
          description: plan.description || undefined,
          notes: { planId: plan.id, billingPeriod: 'monthly' }
        });
        razorpayPlanId = monthlyPlan.id;
        console.log(`✅ [Razorpay] Created monthly plan ${monthlyPlan.id}`);
      }
      
      if (yearlyInrAmount > 0 && !razorpayYearlyPlanId) {
        const yearlyPlan = await createRazorpayPlan({
          period: 'yearly',
          interval: 1,
          name: `${plan.displayName} - Yearly`,
          amount: yearlyInrAmount,
          currency: 'INR',
          description: plan.description || undefined,
          notes: { planId: plan.id, billingPeriod: 'yearly' }
        });
        razorpayYearlyPlanId = yearlyPlan.id;
        console.log(`✅ [Razorpay] Created yearly plan ${yearlyPlan.id}`);
      }
      
      await storage.updatePlan(planId, { razorpayPlanId, razorpayYearlyPlanId });
      
      res.json({ 
        success: true,
        razorpayPlanId,
        razorpayYearlyPlanId
      });
    } catch (error: any) {
      console.error('Error syncing plan to Razorpay:', error);
      res.status(500).json({ error: error.message || 'Failed to sync plan to Razorpay' });
    }
  });

  // PayPal sync endpoint
  router.post('/plans/:planId/sync/paypal', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const paypalConfigured = await isPayPalConfigured();
      if (!paypalConfigured) {
        return res.status(400).json({ error: 'PayPal is not configured' });
      }
      
      const paypalCurrency = await getPayPalCurrency();
      const paypalMonthlyAmount = plan.paypalMonthlyPrice ? parseFloat(plan.paypalMonthlyPrice.toString()) : 0;
      const paypalYearlyAmount = plan.paypalYearlyPrice ? parseFloat(plan.paypalYearlyPrice.toString()) : 0;
      
      let paypalProductId = plan.paypalProductId;
      let paypalMonthlyPlanId = plan.paypalMonthlyPlanId;
      let paypalYearlyPlanId = plan.paypalYearlyPlanId;
      
      if (!paypalProductId) {
        const paypalProduct = await createPayPalProduct({
          name: plan.displayName,
          description: plan.description || undefined,
          type: 'SERVICE',
        });
        paypalProductId = paypalProduct.id;
      }
      
      if (paypalMonthlyAmount > 0 && !paypalMonthlyPlanId && paypalProductId) {
        const monthlyPlan = await createPayPalPlan({
          productId: paypalProductId,
          name: `${plan.displayName} - Monthly`,
          description: plan.description || undefined,
          billingCycles: [{
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: paypalMonthlyAmount.toFixed(2), currency_code: paypalCurrency.currency },
            },
          }],
        });
        paypalMonthlyPlanId = monthlyPlan.id;
      }
      
      if (paypalYearlyAmount > 0 && !paypalYearlyPlanId && paypalProductId) {
        const yearlyPlan = await createPayPalPlan({
          productId: paypalProductId,
          name: `${plan.displayName} - Yearly`,
          description: plan.description || undefined,
          billingCycles: [{
            frequency: { interval_unit: 'YEAR', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: paypalYearlyAmount.toFixed(2), currency_code: paypalCurrency.currency },
            },
          }],
        });
        paypalYearlyPlanId = yearlyPlan.id;
      }
      
      await storage.updatePlan(planId, { paypalProductId, paypalMonthlyPlanId, paypalYearlyPlanId });
      
      console.log(`✅ [PayPal] Synced plan ${planId}`);
      
      res.json({ 
        success: true,
        paypalProductId,
        paypalMonthlyPlanId,
        paypalYearlyPlanId
      });
    } catch (error: any) {
      console.error('Error syncing plan to PayPal:', error);
      res.status(500).json({ error: error.message || 'Failed to sync plan to PayPal' });
    }
  });

  // Paystack sync endpoint
  router.post('/plans/:planId/sync/paystack', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const paystackConfigured = await isPaystackConfigured();
      if (!paystackConfigured) {
        return res.status(400).json({ error: 'Paystack is not configured' });
      }
      
      const paystackCurrency = await getPaystackCurrency();
      const PAYSTACK_MIN_AMOUNT = 100;
      
      const paystackMonthlyAmount = plan.paystackMonthlyPrice ? parseFloat(plan.paystackMonthlyPrice.toString()) : 0;
      const paystackYearlyAmount = plan.paystackYearlyPrice ? parseFloat(plan.paystackYearlyPrice.toString()) : 0;
      
      let paystackMonthlyPlanCode = plan.paystackMonthlyPlanCode;
      let paystackYearlyPlanCode = plan.paystackYearlyPlanCode;
      
      if (paystackMonthlyAmount >= PAYSTACK_MIN_AMOUNT && !paystackMonthlyPlanCode) {
        const monthlyPlan = await createPaystackPlan({
          name: `${plan.displayName} - Monthly`,
          interval: 'monthly',
          amount: paystackMonthlyAmount,
          currency: paystackCurrency.currency,
          description: plan.description || undefined,
        });
        paystackMonthlyPlanCode = monthlyPlan.plan_code;
      }
      
      if (paystackYearlyAmount >= PAYSTACK_MIN_AMOUNT && !paystackYearlyPlanCode) {
        const yearlyPlan = await createPaystackPlan({
          name: `${plan.displayName} - Yearly`,
          interval: 'annually',
          amount: paystackYearlyAmount,
          currency: paystackCurrency.currency,
          description: plan.description || undefined,
        });
        paystackYearlyPlanCode = yearlyPlan.plan_code;
      }
      
      await storage.updatePlan(planId, { paystackMonthlyPlanCode, paystackYearlyPlanCode });
      
      console.log(`✅ [Paystack] Synced plan ${planId}`);
      
      res.json({ 
        success: true,
        paystackMonthlyPlanCode,
        paystackYearlyPlanCode
      });
    } catch (error: any) {
      console.error('Error syncing plan to Paystack:', error);
      res.status(500).json({ error: error.message || 'Failed to sync plan to Paystack' });
    }
  });

  // MercadoPago sync endpoint
  router.post('/plans/:planId/sync/mercadopago', async (req: AdminRequest, res: Response) => {
    try {
      const { planId } = req.params;
      
      const plan = await storage.getPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      const mercadopagoConfigured = await isMercadoPagoConfigured();
      if (!mercadopagoConfigured) {
        return res.status(400).json({ error: 'MercadoPago is not configured' });
      }
      
      const mercadopagoCurrency = await getMercadoPagoCurrency();
      const baseUrl = process.env.BASE_URL || process.env.APP_URL;
      
      if (!baseUrl) {
        return res.status(400).json({ error: 'BASE_URL is not configured' });
      }
      
      const mercadopagoMonthlyAmount = plan.mercadopagoMonthlyPrice ? parseFloat(plan.mercadopagoMonthlyPrice.toString()) : 0;
      const mercadopagoYearlyAmount = plan.mercadopagoYearlyPrice ? parseFloat(plan.mercadopagoYearlyPrice.toString()) : 0;
      
      let mercadopagoMonthlyPlanId = plan.mercadopagoMonthlyPlanId;
      let mercadopagoYearlyPlanId = plan.mercadopagoYearlyPlanId;
      
      if (mercadopagoMonthlyAmount > 0 && !mercadopagoMonthlyPlanId) {
        const monthlyPlan = await createMercadoPagoSubscriptionPlan({
          reason: `${plan.displayName} - Monthly`,
          autoRecurring: {
            frequency: 1,
            frequencyType: 'months',
            transactionAmount: mercadopagoMonthlyAmount,
            currencyId: mercadopagoCurrency.currency,
          },
          backUrl: `${baseUrl}/app/billing`,
        });
        mercadopagoMonthlyPlanId = monthlyPlan.id;
      }
      
      if (mercadopagoYearlyAmount > 0 && !mercadopagoYearlyPlanId) {
        const yearlyPlan = await createMercadoPagoSubscriptionPlan({
          reason: `${plan.displayName} - Yearly`,
          autoRecurring: {
            frequency: 12,
            frequencyType: 'months',
            transactionAmount: mercadopagoYearlyAmount,
            currencyId: mercadopagoCurrency.currency,
          },
          backUrl: `${baseUrl}/app/billing`,
        });
        mercadopagoYearlyPlanId = yearlyPlan.id;
      }
      
      await storage.updatePlan(planId, { mercadopagoMonthlyPlanId, mercadopagoYearlyPlanId });
      
      console.log(`✅ [MercadoPago] Synced plan ${planId}`);
      
      res.json({ 
        success: true,
        mercadopagoMonthlyPlanId,
        mercadopagoYearlyPlanId
      });
    } catch (error: any) {
      console.error('Error syncing plan to MercadoPago:', error);
      res.status(500).json({ error: error.message || 'Failed to sync plan to MercadoPago' });
    }
  });
}
