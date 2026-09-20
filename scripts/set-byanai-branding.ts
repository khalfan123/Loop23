import { storage } from "../server/storage";

async function main() {
  const updates: Record<string, string> = {
    app_name: "Loop9",
    app_tagline: "AI call center",
    logo_url: "/images/loop9-wordmark.png",
    logo_url_light: "/images/loop9-wordmark.png",
    logo_url_dark: "/images/loop9-icon.png",
    favicon_url: "/images/loop9-icon.png",
    company_logo_url: "/images/loop9-wordmark.png",
    company_favicon_url: "/images/loop9-icon.png",
    company_name: "Loop9",
    company_tagline: "AI call center",
    branding_updated_at: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(updates)) {
    await storage.updateGlobalSetting(key, value);
  }

  const branding = await Promise.all(
    ["app_name", "logo_url", "logo_url_light", "logo_url_dark", "favicon_url", "branding_updated_at"].map(
      async (k) => {
        const s = await storage.getGlobalSetting(k);
        return [k, s?.value ?? null] as const;
      },
    ),
  );

  console.log("[branding] updated:", Object.fromEntries(branding));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[branding] failed:", err?.message || err);
    process.exit(1);
  });
