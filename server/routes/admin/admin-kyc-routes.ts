import { Router, Request, Response } from "express";
import { db } from "../../db";
import { users, userKycDocuments } from "@shared/schema";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { KycService } from "../../engines/kyc/services/kyc.service";

const router = Router();

router.get("/users/kyc-queue", async (req: Request, res: Response) => {
  try {
    const { status, limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const kycStatuses = status ? [status as string] : ["submitted", "pending"];
    const kycUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      kycStatus: users.kycStatus,
      kycSubmittedAt: users.kycSubmittedAt,
      kycApprovedAt: users.kycApprovedAt,
      kycRejectionReason: users.kycRejectionReason,
      createdAt: users.createdAt,
    }).from(users)
      .where(inArray(users.kycStatus, kycStatuses))
      .orderBy(desc(users.kycSubmittedAt))
      .limit(limit).offset(offset);

    const result = kycUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      kyc: {
        status: u.kycStatus,
        submittedAt: u.kycSubmittedAt,
        approvedAt: u.kycApprovedAt,
        rejectionReason: u.kycRejectionReason,
      },
      createdAt: u.createdAt,
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(users)
      .where(inArray(users.kycStatus, kycStatuses));
    res.json({ data: result, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch KYC queue" });
  }
});

router.get("/users/:userId/kyc", async (req: Request, res: Response) => {
  try {
    const status = await KycService.getUserKycStatus(req.params.userId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user KYC status" });
  }
});

router.get("/users/:userId/kyc/documents", async (req: Request, res: Response) => {
  try {
    const documents = await KycService.getUserDocuments(req.params.userId);
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user KYC documents" });
  }
});

router.post("/users/:userId/kyc/approve", async (req: Request, res: Response) => {
  try {
    const status = await KycService.approveKyc(req.params.userId);
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to approve KYC" });
  }
});

router.post("/users/:userId/kyc/reject", async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const status = await KycService.rejectKyc(req.params.userId, reason);
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to reject KYC" });
  }
});

router.get("/kyc/verifications", async (req: Request, res: Response) => {
  try {
    const { status, limit: lim, offset: off } = req.query;
    const limit = Math.min(parseInt(lim as string) || 50, 200);
    const offset = parseInt(off as string) || 0;
    const kycStatuses = status ? [status as string] : ["submitted", "pending"];
    const kycUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      kycStatus: users.kycStatus,
      kycSubmittedAt: users.kycSubmittedAt,
      kycApprovedAt: users.kycApprovedAt,
      kycRejectionReason: users.kycRejectionReason,
      createdAt: users.createdAt,
    }).from(users)
      .where(inArray(users.kycStatus, kycStatuses))
      .orderBy(desc(users.kycSubmittedAt))
      .limit(limit).offset(offset);

    const result = kycUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      kyc: {
        status: u.kycStatus,
        submittedAt: u.kycSubmittedAt,
        approvedAt: u.kycApprovedAt,
        rejectionReason: u.kycRejectionReason,
      },
      createdAt: u.createdAt,
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(users)
      .where(inArray(users.kycStatus, kycStatuses));
    res.json({ data: result, total: Number(countResult?.count || 0), limit, offset });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch KYC verifications" });
  }
});

export default router;
