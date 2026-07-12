import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "byanai:rebrand-banner-dismissed:v1";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // ignore
  }
}

export function RebrandBanner() {
  const initiallyDismissed = useMemo(() => (typeof window === "undefined" ? true : readDismissed()), []);
  const [dismissed, setDismissed] = useState(initiallyDismissed);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (dismissed) return null;

  return (
    <div className="sticky top-0 z-50 border-b bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2">
        <div className="text-sm">
          <span className="font-semibold">Loop9 is now Byan AI.</span>{" "}
          <span className="text-amber-900/80 dark:text-amber-100/80">Same product, new name.</span>{" "}
          <Link href="/rebrand" className="underline underline-offset-4">
            Learn more
          </Link>
        </div>
        <div className="ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-950/80 hover:bg-amber-200/40 hover:text-amber-950 dark:text-amber-100/80 dark:hover:bg-white/10"
            onClick={() => {
              writeDismissed();
              setDismissed(true);
            }}
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

