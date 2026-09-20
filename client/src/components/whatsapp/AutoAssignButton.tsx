import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Zap } from "lucide-react";

type Props = {
  onCompleted?: () => void;
  /** Suggested business name to pre-fill the dialog. */
  suggestedDisplayName?: string;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  label?: string;
};

type AssignResponse = {
  alreadyAssigned: boolean;
  pool: {
    phoneNumberE164: string;
    displayName: string | null;
    displayNameStatus: string;
  };
  sender?: { id: string; phoneNumberE164: string };
};

export default function AutoAssignButton({
  onCompleted,
  suggestedDisplayName,
  variant = "default",
  className,
  label = "Get a WhatsApp number",
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(suggestedDisplayName || "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      toast({
        title: "Display name required",
        description: "Enter the business name customers will see on WhatsApp (2–80 characters).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await apiRequest("POST", "/api/whatsapp/auto-assign", { displayName: trimmed });
      const data = (await resp.json()) as AssignResponse;

      if (data.alreadyAssigned) {
        toast({
          title: "WhatsApp number already assigned",
          description: `Your workspace already has ${data.pool.phoneNumberE164}.`,
        });
      } else {
        toast({
          title: "WhatsApp number assigned",
          description: `${data.pool.phoneNumberE164} is now connected. Display name "${trimmed}" is pending Meta approval (1–3 business days).`,
        });
      }
      setOpen(false);
      onCompleted?.();
    } catch (e: any) {
      let msg = e?.message || "Failed to assign a WhatsApp number";
      // apiRequest tends to throw with the response status text + body; surface friendly message for pool exhaustion
      if (typeof msg === "string" && msg.toLowerCase().includes("no whatsapp numbers available")) {
        msg = "No WhatsApp numbers are available in the pool right now. Please contact support.";
      }
      toast({ title: "Could not assign a WhatsApp number", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => {
          setDisplayName(suggestedDisplayName || displayName);
          setOpen(true);
        }}
      >
        <Zap className="h-4 w-4 mr-2" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Get a WhatsApp number</DialogTitle>
            <DialogDescription>
              We'll instantly assign one of our pre-approved WhatsApp numbers to your workspace. Just tell us the
              business name your customers should see when you message them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="display-name">Business display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Acme Travel"
              maxLength={80}
              disabled={submitting}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Meta typically approves the display name in 1–3 business days. You can start sending messages immediately;
              the name updates once approved.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning…
                </>
              ) : (
                "Assign number"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
