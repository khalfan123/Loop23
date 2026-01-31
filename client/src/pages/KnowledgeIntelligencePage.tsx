import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import KnowledgeIntelligence from "@/components/knowledge-intelligence";

export default function KnowledgeIntelligencePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/app/knowledge-base">
          <Button variant="ghost" size="sm" data-testid="button-back-knowledge">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>
        </Link>
        <h1 className="text-2xl font-bold" data-testid="heading-intelligence">AI Knowledge Intelligence</h1>
      </div>
      <KnowledgeIntelligence />
    </div>
  );
}
