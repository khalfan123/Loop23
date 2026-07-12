import { SipTrunkingWizard } from "@/components/SipTrunkingWizard";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function SipTrunkingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => setLocation("/app/phone-numbers?add=1")}
          data-testid="button-back-to-number-options"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>
      <SipTrunkingWizard />
    </div>
  );
}
