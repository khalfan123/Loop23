import { Router, Request, Response } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { plans, creditPackages, creditTransactions, users, userSubscriptions, paymentTransactions } from "@shared/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

const router = Router();

router.get("/billing/overview", async (_req: Request, res: Response) => {
  try {
    const [planCount] = await db.select({ count: sql<number>`count(*)` }).from(plans);
    const [activePlanCount] = await db.select({ count: sql<number>`count(*)` }).from(plans).where(eq(plans.isActive, true));
    const [pkgCount] = await db.select({ count: sql<number>`count(*)` }).from(creditPackages);
    const [subCount] = await db.select({ count: sql<number>`count(*)` }).from(userSubscriptions).where(eq(userSubscriptions.status, "active"));
    const [totalCreditsResult] = await db.select({ total: sql<number>`COALESCE(sum(${users.credits}), 0)` }).from(users);
    const [revenueResult] = await db.select({ total: sql<number>`COALESCE(sum(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions).where(eq(paymentTransactions.status, "completed"));
    const [monthlyRevenue] = await db.select({ total: sql<number>`COALESCE(sum(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.status, "completed"),
        gte(paymentTransactions.createdAt, new Date(new Date().getFullYear(), new Date().getMonth(), 1))
      ));

    res.json({
      plans: { total: Number(planCount?.count || 0), active: Number(activePlanCount?.count || 0) },
      creditPackages: Number(pkgCount?.count || 0),
      activeSubscriptions: Number(subCount?.count || 0),
      totalCreditsInCirculation: Number(totalCreditsResult?.total || 0),
      totalRevenue: Number(revenueResult?.total || 0),
      monthlyRevenue: Number(monthlyRevenue?.total || 0),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch billing overview" });
  }
});

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const allPlans = await storage.getAllPlans();
    res.json(allPlans);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

router.get("/plans/:id", async (req: Request, res: Response) => {
  try {
    const plan = await storage.getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const [subCount] = await db.select({ count: sql<number>`count(*)` }).from(userSubscriptions)
      .where(and(eq(userSubscriptions.planId, req.params.id), eq(userSubscriptions.status, "active")));
    res.json({ ...plan, activeSubscribers: Number(subCount?.count || 0) });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

router.post("/plans", async (req: Request, res: Response) => {
  try {
    const plan = await storage.createPlan(req.body);
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.patch("/plans/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: "Plan not found" });
    await storage.updatePlan(req.params.id, req.body);
    const updated = await storage.getPlan(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.delete("/plans/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: "Plan not found" });
    const [subCount] = await db.select({ count: sql<number>`count(*)` }).from(userSubscriptions)
      .where(and(eq(userSubscriptions.planId, req.params.id), eq(userSubscriptions.status, "active")));
    if (Number(subCount?.count || 0) > 0) {
      return res.status(400).json({ error: "Cannot delete plan with active subscribers. Migrate subscribers first." });
    }
    await storage.deletePlan(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

router.post("/plans/:id/toggle", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: "Plan not found" });
    await storage.updatePlan(req.params.id, { isActive: !existing.isActive });
    res.json({ success: true, isActive: !existing.isActive });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to toggle plan" });
  }
});

router.post("/plans/:id/duplicate", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getPlan(req.params.id);
    if (!existing) return res.status(404).json({ error: "Plan not found" });
    const { id, createdAt, updatedAt, ...planData } = existing;
    const newPlan = await storage.createPlan({
      ...planData,
      name: `${planData.name}_copy`,
      displayName: `${planData.displayName} (Copy)`,
      isActive: false,
    } as any);
    res.status(201).json(newPlan);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to duplicate plan" });
  }
});

router.get("/credit-packages", async (_req: Request, res: Response) => {
  try {
    const packages = await storage.getAllCreditPackages();
    res.json(packages);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch credit packages" });
  }
});

router.post("/credit-packages", async (req: Request, res: Response) => {
  try {
    const pkg = await storage.createCreditPackage(req.body);
    res.status(201).json(pkg);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create credit package" });
  }
});

router.patch("/credit-packages/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getCreditPackage(req.params.id);
    if (!existing) return res.status(404).json({ error: "Credit package not found" });
    await storage.updateCreditPackage(req.params.id, req.body);
    const updated = await storage.getCreditPackage(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update credit package" });
  }
});

router.delete("/credit-packages/:id", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getCreditPackage(req.params.id);
    if (!existing) return res.status(404).json({ error: "Credit package not found" });
    await db.delete(creditPackages).where(eq(creditPackages.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete credit package" });
  }
});

router.post("/credit-packages/:id/toggle", async (req: Request, res: Response) => {
  try {
    const existing = await storage.getCreditPackage(req.params.id);
    if (!existing) return res.status(404).json({ error: "Credit package not found" });
    await storage.updateCreditPackage(req.params.id, { isActive: !existing.isActive });
    res.json({ success: true, isActive: !existing.isActive });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to toggle credit package" });
  }
});

router.get("/subscriptions", async (req: Request, res: Response) => {
  try {
    const { status, planId, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (status) conditions.push(eq(userSubscriptions.status, status as string));
    if (planId) conditions.push(eq(userSubscriptions.planId, planId as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select({
      subscription: userSubscriptions,
      userName: users.name,
      userEmail: users.email,
      planName: plans.displayName,
    }).from(userSubscriptions)
      .leftJoin(users, eq(userSubscriptions.userId, users.id))
      .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(userSubscriptions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.get("/subscriptions/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await db.select({
      planId: userSubscriptions.planId,
      planName: plans.displayName,
      status: userSubscriptions.status,
      count: sql<number>`count(*)`,
    }).from(userSubscriptions)
      .leftJoin(plans, eq(userSubscriptions.planId, plans.id))
      .groupBy(userSubscriptions.planId, plans.displayName, userSubscriptions.status);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch subscription stats" });
  }
});

router.patch("/subscriptions/:id", async (req: Request, res: Response) => {
  try {
    const { planId, status } = req.body;
    const updates: any = {};
    if (planId) updates.planId = planId;
    if (status) updates.status = status;
    await storage.updateUserSubscription(req.params.id, updates);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

router.post("/users/:userId/credits/adjust", async (req: Request, res: Response) => {
  try {
    const { amount, description, type } = req.body;
    if (typeof amount !== "number") return res.status(400).json({ error: "amount must be a number" });
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const newCredits = Math.max(0, user.credits + amount);
    await storage.updateUserCredits(user.id, newCredits);
    await storage.createCreditTransaction({
      userId: user.id,
      type: type || (amount > 0 ? "credit" : "debit"),
      amount: Math.abs(amount),
      description: description || `Admin ${amount > 0 ? "credit" : "debit"} adjustment`,
      reference: "admin-adjustment",
      stripePaymentId: null,
    });
    res.json({ success: true, previousCredits: user.credits, newCredits, adjustment: amount });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to adjust credits" });
  }
});

router.post("/users/:userId/subscription/assign", async (req: Request, res: Response) => {
  try {
    const { planId, periodDays } = req.body;
    if (!planId) return res.status(400).json({ error: "planId is required" });
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const plan = await storage.getPlan(planId);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const existing = await storage.getUserSubscription(req.params.userId);
    const periodEnd = new Date(Date.now() + (periodDays || 30) * 24 * 60 * 60 * 1000);
    if (existing) {
      await storage.updateUserSubscriptionByUserId(req.params.userId, {
        planId,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      });
    } else {
      await storage.createUserSubscription({
        userId: req.params.userId,
        planId,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      } as any);
    }
    if (plan.includedCredits > 0) {
      const newCredits = user.credits + plan.includedCredits;
      await storage.updateUserCredits(user.id, newCredits);
      await storage.createCreditTransaction({
        userId: user.id,
        type: "credit",
        amount: plan.includedCredits,
        description: `Plan credits: ${plan.displayName}`,
        reference: "plan-assignment",
        stripePaymentId: null,
      });
    }
    res.json({ success: true, message: `Assigned ${plan.displayName} to user` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to assign subscription" });
  }
});

router.get("/transactions/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await db.select({
      type: creditTransactions.type,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`COALESCE(sum(${creditTransactions.amount}), 0)`,
    }).from(creditTransactions)
      .groupBy(creditTransactions.type);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch transaction summary" });
  }
});

router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const { userId, type, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (userId) conditions.push(eq(creditTransactions.userId, userId as string));
    if (type) conditions.push(eq(creditTransactions.type, type as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select().from(creditTransactions).orderBy(desc(creditTransactions.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(creditTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.get("/payment-transactions", async (req: Request, res: Response) => {
  try {
    const { userId, status, gateway, limit: lim, offset: off } = req.query;
    const conditions: any[] = [];
    if (userId) conditions.push(eq(paymentTransactions.userId, userId as string));
    if (status) conditions.push(eq(paymentTransactions.status, status as string));
    if (gateway) conditions.push(eq(paymentTransactions.gateway, gateway as string));
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    let query = db.select().from(paymentTransactions).orderBy(desc(paymentTransactions.createdAt)).limit(limit).offset(offset);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const results = await query;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(paymentTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json({ data: results, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch payment transactions" });
  }
});

router.get("/payment-transactions/revenue", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions: any[] = [eq(paymentTransactions.status, "completed")];
    if (startDate) conditions.push(gte(paymentTransactions.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(paymentTransactions.createdAt, new Date(endDate as string)));
    const revenue = await db.select({
      gateway: paymentTransactions.gateway,
      currency: paymentTransactions.currency,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`COALESCE(sum(${paymentTransactions.amount}), 0)`,
    }).from(paymentTransactions)
      .where(and(...conditions))
      .groupBy(paymentTransactions.gateway, paymentTransactions.currency);
    res.json(revenue);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
});

router.get("/pricing/config", async (_req: Request, res: Response) => {
  try {
    const keys = [
      "default_currency", "credits_per_minute", "credits_per_sms",
      "phone_rental_credits_monthly", "phone_purchase_credits",
      "free_trial_credits", "referral_bonus_credits",
      "minimum_credits_for_call", "credit_expiry_days",
    ];
    const config: Record<string, any> = {};
    for (const key of keys) {
      const setting = await storage.getGlobalSetting(key);
      config[key] = setting?.value ?? null;
    }
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch pricing config" });
  }
});

router.put("/pricing/config", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const updated: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      await storage.updateGlobalSetting(key, value);
      updated.push(key);
    }
    res.json({ success: true, updated });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update pricing config" });
  }
});

export default router;
