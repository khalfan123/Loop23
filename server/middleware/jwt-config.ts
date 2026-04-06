import crypto from "crypto";

export const JWT_SECRET: string = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable must be set in production");
  }
  console.warn("⚠️  WARNING: No JWT_SECRET set. Generating random secret for this session. Set JWT_SECRET environment variable for production!");
  return crypto.randomBytes(64).toString("hex");
})();
