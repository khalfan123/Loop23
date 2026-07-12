import { SEOHead } from "@/components/landing/SEOHead";
import { useBranding } from "@/components/BrandingProvider";

export default function RebrandAnnouncement() {
  const { branding } = useBranding();
  const siteName = branding.app_name || "Byan AI";

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Loop9 is now Byan AI"
        description="We’ve changed our name from Loop9 to Byan AI. Everything else stays the same: your account, data, and product experience."
        canonicalUrl={`${window.location.origin}/rebrand`}
        ogType="article"
        ogSiteName={siteName}
      />

      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="text-sm font-semibold text-primary">Announcement</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Loop9 is now <span className="text-primary">Byan AI</span>
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          We’re excited to share that we’ve renamed our platform from <span className="font-medium">Loop9</span> to{" "}
          <span className="font-medium">Byan AI</span>. This change better reflects our focus on building AI-powered voice
          agents for calling, lead qualification, and customer support.
        </p>

        <div className="mt-8 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">What’s changing</h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>The product name is now <span className="font-medium text-foreground">Byan AI</span>.</li>
            <li>You may see updated logos, page titles, and emails over the next few weeks.</li>
          </ul>
        </div>

        <div className="mt-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">What’s staying the same</h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>Your account, data, and existing settings.</li>
            <li>Core product functionality and pricing (unless separately communicated).</li>
            <li>Support channels and service levels.</li>
          </ul>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Thanks for being with us on the journey.
        </p>
      </div>
    </div>
  );
}

