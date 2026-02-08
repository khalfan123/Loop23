/**
 * ============================================================
 * IntegrationsPage - Integration Cards and API Overview
 * ============================================================
 */
import { motion } from "framer-motion";
import { 
  Phone, Mic, Brain, Webhook, Code, Zap,
  ArrowRight, ExternalLink, Check, Calendar, ShoppingCart,
  BarChart3, Database, Users, Bot, Headphones, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { SEOHead } from "@/components/landing/SEOHead";
import { Link } from "wouter";
import { 
  SiTwilio, SiOpenai, SiZapier, SiSlack, SiHubspot, SiSalesforce,
  SiStripe, SiShopify, SiNotion, SiFirebase, SiDiscord, SiTelegram,
  SiWhatsapp, SiZendesk, SiIntercom, SiMailchimp, SiAirtable, SiGooglesheets
} from "react-icons/si";
import { useBranding } from "@/components/BrandingProvider";
import { useSeoSettings } from "@/hooks/useSeoSettings";
import { useTranslation } from "react-i18next";

interface IntegrationCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  category: string;
  delay: number;
}

const IntegrationCard = ({ icon, name, description, category, delay }: IntegrationCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -5 }}
    className="feature-card-border p-6 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
        {category}
      </span>
    </div>
    <h3 className="text-lg font-semibold mb-2">{name}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </motion.div>
);

export default function IntegrationsPage() {
  const { branding } = useBranding();
  const { data: seoSettings } = useSeoSettings();
  const { t } = useTranslation();
  
  const integrations = [
    {
      icon: <SiSalesforce className="w-6 h-6 text-[#00A1E0]" />,
      name: "Salesforce",
      description: "Auto-create leads and log call activities after every AI conversation.",
      category: "CRM"
    },
    {
      icon: <SiHubspot className="w-6 h-6 text-[#FF7A59]" />,
      name: "HubSpot",
      description: "Push call outcomes, create deals, and update contact timelines automatically.",
      category: "CRM"
    },
    {
      icon: <SiTwilio className="w-6 h-6 text-red-500" />,
      name: "Twilio",
      description: "Phone numbers and SIP trunking for outbound/inbound AI agent calls.",
      category: "Telephony"
    },
    {
      icon: <Phone className="w-6 h-6 text-green-500" />,
      name: "Plivo",
      description: "Cost-effective global telephony provider for AI voice calls.",
      category: "Telephony"
    },
    {
      icon: <SiOpenai className="w-6 h-6 text-slate-900 dark:text-white" />,
      name: "OpenAI",
      description: "Power AI agents with GPT-4o for natural, intelligent conversations.",
      category: "AI & LLM"
    },
    {
      icon: <Bot className="w-6 h-6 text-[#D4A574]" />,
      name: "Anthropic (Claude)",
      description: "Highly accurate, safety-aware AI agent conversations with Claude models.",
      category: "AI & LLM"
    },
    {
      icon: <Mic className="w-6 h-6 text-indigo-500" />,
      name: "ElevenLabs",
      description: "Ultra-realistic AI voices for natural-sounding agent conversations.",
      category: "Voice & Speech"
    },
    {
      icon: <Headphones className="w-6 h-6 text-[#13EF93]" />,
      name: "Deepgram",
      description: "Real-time speech-to-text with industry-leading accuracy for call transcription.",
      category: "Voice & Speech"
    },
    {
      icon: <SiSlack className="w-6 h-6 text-[#4A154B]" />,
      name: "Slack",
      description: "Real-time notifications when AI calls complete or leads are captured.",
      category: "Communication"
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-[#6264A7]" />,
      name: "Microsoft Teams",
      description: "Post call summaries and alerts to Teams channels for team awareness.",
      category: "Communication"
    },
    {
      icon: <SiWhatsapp className="w-6 h-6 text-[#25D366]" />,
      name: "WhatsApp Business",
      description: "Send follow-up messages to contacts after AI agent calls.",
      category: "Communication"
    },
    {
      icon: <SiTelegram className="w-6 h-6 text-[#0088CC]" />,
      name: "Telegram",
      description: "Receive call alerts and lead notifications via Telegram bot messages.",
      category: "Communication"
    },
    {
      icon: <SiZendesk className="w-6 h-6 text-[#03363D]" />,
      name: "Zendesk",
      description: "Auto-create support tickets from unresolved AI call issues.",
      category: "Support"
    },
    {
      icon: <SiIntercom className="w-6 h-6 text-[#6AFDEF]" />,
      name: "Intercom",
      description: "Create conversations and update profiles from AI call interactions.",
      category: "Support"
    },
    {
      icon: <Calendar className="w-6 h-6 text-[#4285F4]" />,
      name: "Google Calendar",
      description: "Book meetings directly into Google Calendar during live AI calls.",
      category: "Scheduling"
    },
    {
      icon: <Calendar className="w-6 h-6 text-[#006BFF]" />,
      name: "Calendly",
      description: "Schedule appointments when AI agents qualify leads during calls.",
      category: "Scheduling"
    },
    {
      icon: <SiMailchimp className="w-6 h-6 text-[#FFE01B]" />,
      name: "Mailchimp",
      description: "Add call leads to email audiences for automated nurture campaigns.",
      category: "Marketing"
    },
    {
      icon: <SiStripe className="w-6 h-6 text-[#635BFF]" />,
      name: "Stripe",
      description: "Process payments and look up subscription details during AI calls.",
      category: "Payments"
    },
    {
      icon: <SiShopify className="w-6 h-6 text-[#7AB55C]" />,
      name: "Shopify",
      description: "Look up orders and check product availability during customer calls.",
      category: "E-Commerce"
    },
    {
      icon: <SiGooglesheets className="w-6 h-6 text-[#0F9D58]" />,
      name: "Google Sheets",
      description: "Export call data and campaign results for reporting and analysis.",
      category: "Data"
    },
    {
      icon: <SiAirtable className="w-6 h-6 text-[#18BFFF]" />,
      name: "Airtable",
      description: "Sync call records and leads for flexible, visual data management.",
      category: "Data"
    },
    {
      icon: <SiNotion className="w-6 h-6" />,
      name: "Notion",
      description: "Push call summaries and meeting notes to Notion databases.",
      category: "Data"
    },
    {
      icon: <SiZapier className="w-6 h-6 text-orange-500" />,
      name: "Zapier",
      description: "Trigger 5,000+ app automations from AI call events and outcomes.",
      category: "Automation"
    },
    {
      icon: <Webhook className="w-6 h-6 text-purple-500" />,
      name: "Webhooks & REST API",
      description: "Build custom integrations with webhooks and our full REST API.",
      category: "Developer"
    },
  ];

  const apiFeatures = [
    t('landing.integrationsPage.api.features.createAgents'),
    t('landing.integrationsPage.api.features.launchCampaigns'),
    t('landing.integrationsPage.api.features.accessCallStatus'),
    t('landing.integrationsPage.api.features.manageContacts'),
    t('landing.integrationsPage.api.features.configureWebhooks'),
    t('landing.integrationsPage.api.features.generateAnalytics')
  ];

  const webhookEvents = [
    t('landing.integrationsPage.webhooks.events.callStarted'),
    t('landing.integrationsPage.webhooks.events.callCompleted'),
    t('landing.integrationsPage.webhooks.events.callFailed'),
    t('landing.integrationsPage.webhooks.events.campaignStarted'),
    t('landing.integrationsPage.webhooks.events.campaignCompleted'),
    t('landing.integrationsPage.webhooks.events.appointmentBooked')
  ];

  const webhookFeatures = [
    t('landing.integrationsPage.webhooks.features.hmac'),
    t('landing.integrationsPage.webhooks.features.retry'),
    t('landing.integrationsPage.webhooks.features.logs')
  ];
  
  return (
    <div className="min-h-screen bg-background" data-testid="integrations-page">
      <SEOHead
        title={t('landing.integrationsPage.seo.title')}
        description={t('landing.integrationsPage.seo.description')}
        canonicalUrl={seoSettings?.canonicalBaseUrl ? `${seoSettings.canonicalBaseUrl}/integrations` : undefined}
        ogImage={seoSettings?.defaultOgImage || undefined}
        ogSiteName={branding.app_name}
        twitterSite={seoSettings?.twitterHandle || undefined}
        twitterCreator={seoSettings?.twitterHandle || undefined}
        googleVerification={seoSettings?.googleVerification || undefined}
        bingVerification={seoSettings?.bingVerification || undefined}
        facebookAppId={seoSettings?.facebookAppId || undefined}
        structuredDataOrg={seoSettings?.structuredDataOrg}
      />

      <Navbar />

      <main className="pt-16">
        {/* Hero */}
        <section className="py-16 md:py-24 hero-gradient">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 mb-6">
                <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {t('landing.integrationsPage.hero.badge')}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                {t('landing.integrationsPage.hero.title')}
                <br />
                <span className="gradient-text-primary">{t('landing.integrationsPage.hero.titleHighlight')}</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                {t('landing.integrationsPage.hero.subtitle')}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Integration Grid */}
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {integrations.map((integration, index) => (
                <IntegrationCard
                  key={index}
                  {...integration}
                  delay={index * 0.05}
                />
              ))}
            </div>
          </div>
        </section>

        {/* API Overview */}
        <section className="py-16 md:py-24 section-gradient-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 mb-6">
                  <Code className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {t('landing.integrationsPage.api.badge')}
                  </span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  {t('landing.integrationsPage.api.title')}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {t('landing.integrationsPage.api.description')}
                </p>

                <ul className="space-y-3 mb-8">
                  {apiFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button variant="outline" className="gap-2">
                  {t('landing.integrationsPage.api.viewDocs')}
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="feature-card-border p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <pre className="text-sm overflow-x-auto">
                  <code className="text-muted-foreground">
{`// Create an AI agent
const agent = await api.agents.create({
  name: "Sales Agent",
  voice: "emma",
  language: "en-US",
  systemPrompt: "You are a helpful..."
});

// Launch a campaign
const campaign = await api.campaigns.create({
  agentId: agent.id,
  contacts: contactList,
  schedule: "2024-01-15T09:00:00Z"
});`}
                  </code>
                </pre>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Webhook Events */}
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-2 lg:order-1"
              >
                <div className="feature-card-border p-6">
                  <h4 className="font-semibold mb-4">{t('landing.integrationsPage.webhooks.availableEvents')}</h4>
                  <ul className="space-y-3">
                    {webhookEvents.map((event, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                        <code className="text-muted-foreground">{event}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 mb-6">
                  <Webhook className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {t('landing.integrationsPage.webhooks.badge')}
                  </span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  {t('landing.integrationsPage.webhooks.title')}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {t('landing.integrationsPage.webhooks.description')}
                </p>

                <ul className="space-y-3">
                  {webhookFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 section-gradient-2">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('landing.integrationsPage.cta.title')}
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                {t('landing.integrationsPage.cta.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <Button className="cta-button text-white font-medium border-0 h-14 px-8 text-lg">
                    {t('landing.integrationsPage.cta.startFreeTrial')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Button variant="outline" className="h-14 px-8 text-lg gap-2">
                  {t('landing.integrationsPage.cta.viewDocumentation')}
                  <ExternalLink className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
