/**
 * SMS Country Rates Seed Data
 *
 * Per-destination-country credit rates for outbound SMS. Admins edit these
 * in /app/admin/sms-rates. The row with iso_country='*' is the global
 * fallback used when a destination country isn't listed.
 *
 * Rates are denominated in CREDITS PER SEGMENT (not dollars). The platform
 * decides what a credit costs end-customers via its credit-package pricing.
 * These defaults are conservative — admins should tune them against real
 * Twilio wholesale pricing (https://www.twilio.com/sms/pricing).
 *
 * @copyright Diploy - CodeCanyon/Envato Distribution
 */

import { db } from "./db";
import { smsCountryRates } from "@shared/schema";
import { eq } from "drizzle-orm";

export const SMS_COUNTRY_RATES_SEED_DATA = [
  // Global fallback — applies to any destination not explicitly listed.
  // NOTE: kept in sync with the value seeded by migrations/0011_sms_messaging.sql
  // so a fresh install and a migrated install end up identical.
  { isoCountry: "*",  creditsPerSegment: 2,   label: "Default (fallback)",  isDefault: true  },

  // Tier 1: cheap destinations
  { isoCountry: "US", creditsPerSegment: 1,   label: "United States",       isDefault: false },
  { isoCountry: "CA", creditsPerSegment: 1,   label: "Canada",              isDefault: false },
  { isoCountry: "GB", creditsPerSegment: 2,   label: "United Kingdom",      isDefault: false },
  { isoCountry: "IN", creditsPerSegment: 1,   label: "India",               isDefault: false },

  // Tier 2: mid-priced destinations
  { isoCountry: "AU", creditsPerSegment: 3,   label: "Australia",           isDefault: false },
  { isoCountry: "DE", creditsPerSegment: 4,   label: "Germany",             isDefault: false },
  { isoCountry: "FR", creditsPerSegment: 4,   label: "France",              isDefault: false },
  { isoCountry: "ES", creditsPerSegment: 4,   label: "Spain",               isDefault: false },
  { isoCountry: "IT", creditsPerSegment: 4,   label: "Italy",               isDefault: false },
  { isoCountry: "NL", creditsPerSegment: 4,   label: "Netherlands",         isDefault: false },
  { isoCountry: "BR", creditsPerSegment: 3,   label: "Brazil",              isDefault: false },
  { isoCountry: "MX", creditsPerSegment: 3,   label: "Mexico",              isDefault: false },
  { isoCountry: "ZA", creditsPerSegment: 3,   label: "South Africa",        isDefault: false },
  { isoCountry: "SG", creditsPerSegment: 3,   label: "Singapore",           isDefault: false },

  // Tier 3: expensive destinations (regulatory / carrier surcharges)
  { isoCountry: "AE", creditsPerSegment: 8,   label: "United Arab Emirates", isDefault: false },
  { isoCountry: "SA", creditsPerSegment: 8,   label: "Saudi Arabia",        isDefault: false },
  { isoCountry: "QA", creditsPerSegment: 8,   label: "Qatar",               isDefault: false },
  { isoCountry: "KW", creditsPerSegment: 8,   label: "Kuwait",              isDefault: false },
  { isoCountry: "OM", creditsPerSegment: 8,   label: "Oman",                isDefault: false },
  { isoCountry: "BH", creditsPerSegment: 8,   label: "Bahrain",             isDefault: false },
  { isoCountry: "EG", creditsPerSegment: 5,   label: "Egypt",               isDefault: false },
  { isoCountry: "TR", creditsPerSegment: 5,   label: "Turkey",              isDefault: false },
  { isoCountry: "NG", creditsPerSegment: 5,   label: "Nigeria",             isDefault: false },
  { isoCountry: "KE", creditsPerSegment: 4,   label: "Kenya",               isDefault: false },
];

export async function seedSmsCountryRates() {
  console.log("\n💬 Seeding SMS Country Rates...");
  try {
    const existing = await db.select().from(smsCountryRates);
    const existingByCountry = new Map(existing.map((r) => [r.isoCountry, r]));

    let inserted = 0;
    let skipped = 0;

    for (const rate of SMS_COUNTRY_RATES_SEED_DATA) {
      if (existingByCountry.has(rate.isoCountry)) {
        skipped++;
        continue;
      }
      await db.insert(smsCountryRates).values(rate);
      inserted++;
    }

    if (inserted === 0) {
      console.log(`   ℹ️  All ${SMS_COUNTRY_RATES_SEED_DATA.length} SMS rates already exist. Skipping.`);
    } else {
      console.log(`   ✅ Inserted ${inserted} SMS country rate${inserted === 1 ? "" : "s"} (${skipped} already existed)`);
      console.log(`      - Default fallback: ${SMS_COUNTRY_RATES_SEED_DATA.find((r) => r.isDefault)?.creditsPerSegment} credits/segment`);
      console.log(`      - Tier 1 (cheap): US, CA, GB, IN`);
      console.log(`      - Tier 2 (mid): AU, DE, FR, ES, IT, NL, BR, MX, ZA, SG`);
      console.log(`      - Tier 3 (expensive): AE, SA, QA, KW, OM, BH, EG, TR, NG, KE`);
    }
  } catch (error) {
    console.error("❌ Error seeding SMS Country Rates:", error);
    throw error;
  }
}

if (process.env.RUN_SEED === "sms-rates") {
  seedSmsCountryRates()
    .then(() => {
      console.log("✅ SMS Country Rates seeding complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ SMS Country Rates seeding failed:", error);
      process.exit(1);
    });
}
