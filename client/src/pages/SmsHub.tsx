import { useLocation, useRoute } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SmsConversations from "@/pages/SmsConversations";
import SmsSetup from "@/pages/SmsSetup";

/**
 * SMS hub — top-level entry from the sidebar. Mirrors the WhatsApp inbox
 * pattern (sidebar → /app/inbox). Two tabs: Conversations (default) and
 * Setup (sender configuration + per-country rate preview).
 *
 * Path conventions:
 *   /app/sms             → conversations tab
 *   /app/sms/setup       → setup tab
 *   /app/sms/conversations/:id  → conversation deep-link (handled inside SmsConversations)
 */
export default function SmsHub() {
  const [, setLocation] = useLocation();
  const [isSetup] = useRoute("/app/sms/setup");
  const activeTab = isSetup ? "setup" : "conversations";

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SMS</h1>
          <p className="text-sm text-muted-foreground">
            Send and receive SMS through your workspace's Twilio sender.
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setLocation(v === "setup" ? "/app/sms/setup" : "/app/sms")}
      >
        <TabsList>
          <TabsTrigger value="conversations" data-testid="tab-sms-conversations">
            Conversations
          </TabsTrigger>
          <TabsTrigger value="setup" data-testid="tab-sms-setup">
            Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="mt-4">
          <SmsConversations />
        </TabsContent>

        <TabsContent value="setup" className="mt-4">
          <SmsSetup />
        </TabsContent>
      </Tabs>
    </div>
  );
}
