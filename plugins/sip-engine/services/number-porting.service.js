import { db } from "../../../server/db";
import { portRequests } from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
const GCC_CARRIERS = {
  AE: {
    name: "United Arab Emirates",
    carriers: ["Etisalat (e&)", "du (EITC)", "Virgin Mobile UAE"]
  },
  SA: {
    name: "Saudi Arabia",
    carriers: ["STC", "Mobily (Etihad Etisalat)", "Zain KSA", "Virgin Mobile KSA", "Lebara KSA"]
  },
  BH: {
    name: "Bahrain",
    carriers: ["Batelco", "Zain Bahrain", "STC Bahrain (VIVA)", "Virgin Mobile Bahrain"]
  },
  KW: {
    name: "Kuwait",
    carriers: ["Zain Kuwait", "Ooredoo Kuwait", "STC Kuwait (VIVA)"]
  },
  OM: {
    name: "Oman",
    carriers: ["Omantel", "Ooredoo Oman", "Vodafone Oman"]
  },
  QA: {
    name: "Qatar",
    carriers: ["Ooredoo Qatar", "Vodafone Qatar"]
  }
};
const GCC_REGULATORS = {
  AE: { body: "TDRA (Telecommunications & Digital Government Regulatory Authority)", note: "UAE porting typically takes 5-10 business days. TDRA requires the number to be active and in good standing." },
  SA: { body: "CST (Communications, Space & Technology Commission)", note: "Saudi Arabia porting may take 7-14 business days. Ensure no outstanding balance with current carrier." },
  BH: { body: "TRA (Telecommunications Regulatory Authority)", note: "Bahrain porting usually completes within 3-5 business days." },
  KW: { body: "CITRA (Communication & Information Technology Regulatory Authority)", note: "Kuwait porting takes approximately 5-7 business days." },
  OM: { body: "TRA (Telecommunications Regulatory Authority)", note: "Oman porting typically takes 5-10 business days." },
  QA: { body: "CRA (Communications Regulatory Authority)", note: "Qatar porting usually takes 3-7 business days." }
};
const COUNTRY_PREFIXES = {
  AE: "+971",
  SA: "+966",
  BH: "+973",
  KW: "+965",
  OM: "+968",
  QA: "+974"
};
class NumberPortingService {
  static getGccCountries() {
    return Object.entries(GCC_CARRIERS).map(([code, data]) => ({
      code,
      name: data.name,
      prefix: COUNTRY_PREFIXES[code],
      carriers: data.carriers,
      regulator: GCC_REGULATORS[code]
    }));
  }
  static getCarriersForCountry(countryCode) {
    return GCC_CARRIERS[countryCode]?.carriers || [];
  }
  static async createPortRequest(data) {
    const loaText = this.generateLoaText(data);
    const [request] = await db.insert(portRequests).values({
      ...data,
      loaText,
      status: "submitted"
    }).returning();
    console.log(`[Number Porting] Port request created: ${request.id} for ${data.phoneNumber}`);
    return request;
  }
  static async getUserPortRequests(userId) {
    return db.select().from(portRequests).where(eq(portRequests.userId, userId)).orderBy(desc(portRequests.createdAt));
  }
  static async getPortRequest(id, userId) {
    const [request] = await db.select().from(portRequests).where(and(eq(portRequests.id, id), eq(portRequests.userId, userId))).limit(1);
    return request || null;
  }
  static async updatePortRequestStatus(id, status, adminNotes) {
    const updates = { status, updatedAt: /* @__PURE__ */ new Date() };
    if (adminNotes) updates.adminNotes = adminNotes;
    if (status === "completed") updates.completedAt = /* @__PURE__ */ new Date();
    const [updated] = await db.update(portRequests).set(updates).where(eq(portRequests.id, id)).returning();
    if (updated) {
      console.log(`[Number Porting] Request ${id} status updated to: ${status}`);
    }
    return updated || null;
  }
  static async cancelPortRequest(id, userId) {
    const [request] = await db.select().from(portRequests).where(and(eq(portRequests.id, id), eq(portRequests.userId, userId))).limit(1);
    if (!request) return false;
    if (["completed", "cancelled"].includes(request.status)) return false;
    await db.update(portRequests).set({ status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(eq(portRequests.id, id));
    console.log(`[Number Porting] Request ${id} cancelled`);
    return true;
  }
  static generateLoaText(data) {
    const countryName = GCC_CARRIERS[data.countryCode || ""]?.name || data.country || "";
    const regulator = GCC_REGULATORS[data.countryCode || ""];
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    return `
LETTER OF AUTHORIZATION (LOA)
FOR NUMBER PORTING
${"=".repeat(50)}

Date: ${today}

AUTHORIZATION

I, ${data.authorizedName || "_______________"}${data.companyName ? `, on behalf of ${data.companyName},` : ","} hereby authorize the transfer (porting) of the following telephone number(s) from the current service provider to Twilio Inc.

PHONE NUMBER(S) TO BE PORTED
Phone Number: ${data.phoneNumber || "_______________"}
Country: ${countryName}

CURRENT SERVICE PROVIDER
Carrier: ${data.currentCarrier || "_______________"}
Account Number: ${data.accountNumber || "N/A"}

AUTHORIZED CONTACT
Name: ${data.authorizedName || "_______________"}
${data.companyName ? `Company: ${data.companyName}` : ""}
Address: ${data.addressLine1 || "_______________"}${data.addressLine2 ? `, ${data.addressLine2}` : ""}
City: ${data.city || "_______________"}${data.region ? `, ${data.region}` : ""}${data.postalCode ? ` ${data.postalCode}` : ""}
Country: ${data.country || "_______________"}

RECEIVING PROVIDER
Twilio Inc.
101 Spear Street, Suite 500
San Francisco, CA 94105
United States

REGULATORY COMPLIANCE
${regulator ? `Regulatory Body: ${regulator.body}` : ""}
This porting request is made in compliance with the applicable number portability regulations in ${countryName}.

DECLARATION
I hereby declare that:
1. I am the authorized user/account holder of the above telephone number(s).
2. I authorize the transfer of the number(s) to Twilio Inc.
3. I understand that upon completion of the port, the number(s) will no longer be serviced by the current provider.
4. All information provided in this letter is accurate and complete.
5. I understand that the porting process may result in a brief interruption of service.

${regulator ? `
NOTE: ${regulator.note}` : ""}

SIGNATURE

_______________________________
${data.authorizedName || "_______________"}
Date: ${today}

${"=".repeat(50)}
This document serves as authorization for number porting
in accordance with ${regulator?.body || "local telecommunications regulatory"} guidelines.
`.trim();
  }
  static async checkPortability(phoneNumber, countryCode) {
    const prefix = COUNTRY_PREFIXES[countryCode];
    if (!prefix) {
      return {
        portable: false,
        message: `Country code ${countryCode} is not a supported GCC country for porting.`,
        requirements: []
      };
    }
    if (!phoneNumber.startsWith(prefix) && !phoneNumber.startsWith("+")) {
      return {
        portable: false,
        message: `Phone number must start with ${prefix} for ${GCC_CARRIERS[countryCode]?.name}.`,
        requirements: []
      };
    }
    const requirements = [
      "Number must be active and in good standing with current carrier",
      "No outstanding balance on the account",
      "Number must not be under contract lock-in period",
      "Valid government-issued ID of the account holder",
      "Recent bill or account statement from current carrier",
      "Completed and signed Letter of Authorization (LOA)"
    ];
    const estimatedDays = {
      AE: 10,
      SA: 14,
      BH: 5,
      KW: 7,
      OM: 10,
      QA: 7
    };
    return {
      portable: true,
      message: `Number appears eligible for porting from ${GCC_CARRIERS[countryCode]?.name}. Estimated processing time: ${estimatedDays[countryCode]} business days.`,
      estimatedDays: estimatedDays[countryCode],
      requirements
    };
  }
}
export {
  NumberPortingService
};
