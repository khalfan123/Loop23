import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

type CallbackResult = {
  senderId?: string;
  wabaRowId?: string;
  wabaId?: string;
  phoneNumberE164?: string;
  status?: string;
  twilioSenderSid?: string;
};

type Props = {
  onCompleted?: (result: CallbackResult) => void;
  extraCallbackPayload?: Record<string, unknown>;
  /** When true, button is inert (e.g. wizard step requires a selected Twilio number first). */
  disabled?: boolean;
  /** Primary action label (Twilio-style wizard uses “Continue with Facebook”). */
  buttonLabel?: string;
};

type WhatsappConfig = {
  appId: string;
  configId: string;
  graphVersion?: string;
};

function loadFacebookSdkOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve();

    const existing = document.getElementById("facebook-jssdk");
    if (existing) {
      // sdk script tag exists; wait until window.FB is available
      const t = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(t);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(t);
        reject(new Error("Facebook SDK load timeout"));
      }, 15000);
      return;
    }

    window.fbAsyncInit = function () {
      resolve();
    };

    const js = document.createElement("script");
    js.id = "facebook-jssdk";
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    js.async = true;
    js.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(js);
  });
}

export default function EmbeddedSignupButton({
  onCompleted,
  extraCallbackPayload,
  disabled: disabledProp,
  buttonLabel = "Enable WhatsApp",
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const configRef = useRef<WhatsappConfig | null>(null);
  const handlerRef = useRef<((e: MessageEvent) => void) | null>(null);

  const graphVersionFallback = useMemo(() => (import.meta.env.VITE_META_GRAPH_VERSION as string | undefined) || "v21.0", []);

  // Pre-load FB SDK + config on mount so FB.login() can run synchronously inside the click handler.
  // Browsers block popups opened after `await` boundaries because the user-gesture context is lost.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfgResp = await apiRequest("GET", "/api/whatsapp/config");
        const cfg = (await cfgResp.json()) as WhatsappConfig;
        if (cancelled) return;
        if (!cfg?.appId || !cfg?.configId) {
          throw new Error("WhatsApp config missing appId or configId");
        }
        configRef.current = cfg;

        await loadFacebookSdkOnce();
        if (cancelled) return;
        const gv = cfg.graphVersion || graphVersionFallback;
        window.FB.init({
          appId: cfg.appId,
          cookie: true,
          xfbml: false,
          version: gv,
        });
        setReady(true);
      } catch (e: any) {
        if (cancelled) return;
        setInitError(e?.message || "Failed to initialize WhatsApp signup");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphVersionFallback]);

  const onClick = useCallback(() => {
    if (disabledProp) {
      toast({
        title: "Complete the previous step",
        description: "Select a Twilio number first, then continue with Facebook.",
        variant: "destructive",
      });
      return;
    }
    if (!ready || !configRef.current) {
      toast({
        title: "WhatsApp signup not ready",
        description: initError || "Still loading. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    const cfg = configRef.current;
    const gv = cfg.graphVersion || graphVersionFallback;

    // Re-attach message handler each click in case it was removed.
    if (handlerRef.current) {
      window.removeEventListener("message", handlerRef.current);
    }
    (window as any).__loop9WaSignupInfo = undefined;

    handlerRef.current = (event: MessageEvent) => {
      try {
        if (!event.data) return;
        // Meta uses different shapes over time; keep this tolerant.
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data) return;
        if (data.type !== "WA_EMBEDDED_SIGNUP") return;

        const wabaId = data.waba_id || data.wabaId;
        const phoneNumberId = data.phone_number_id || data.phoneNumberId;
        if (!wabaId || !phoneNumberId) return;

        (window as any).__loop9WaSignupInfo = { wabaId, phoneNumberId };
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", handlerRef.current);

    const start = Date.now();

    // CRITICAL: FB.login must be invoked synchronously inside the click handler
    // (no `await` before it) or the browser will block the popup.
    window.FB.login(
      (resp: any) => {
        (async () => {
          try {
            if (!resp) throw new Error("No response from Meta");
            if (resp.status !== "connected") throw new Error("Meta login not connected");
            const code: string | undefined = resp.authResponse?.code;
            if (!code) throw new Error("Meta did not return an OAuth code");

            // Wait briefly for WA_EMBEDDED_SIGNUP message (waba_id + phone_number_id)
            const embeddedInfo = await new Promise<{ wabaId: string; phoneNumberId: string }>((resolve, reject) => {
              const timeout = window.setTimeout(
                () => reject(new Error("Timed out waiting for Embedded Signup payload")),
                15000,
              );
              const poll = window.setInterval(() => {
                const stash = (window as any).__loop9WaSignupInfo as any;
                if (stash?.wabaId && stash?.phoneNumberId) {
                  window.clearTimeout(timeout);
                  window.clearInterval(poll);
                  resolve({ wabaId: stash.wabaId, phoneNumberId: stash.phoneNumberId });
                }
              }, 50);
            });

            const callbackResp = await apiRequest("POST", "/api/whatsapp/embedded-signup/callback", {
              code,
              wabaId: embeddedInfo.wabaId,
              phoneNumberId: embeddedInfo.phoneNumberId,
              graphVersion: gv,
              ...(extraCallbackPayload || {}),
            });
            let callbackJson: CallbackResult = {};
            try {
              callbackJson = (await callbackResp.json()) as CallbackResult;
            } catch {
              // ignore
            }

            toast({
              title: "WhatsApp sender setup started",
              description: `Signup completed in ${Math.max(1, Math.round((Date.now() - start) / 1000))}s`,
            });
            onCompleted?.(callbackJson);
          } catch (e: any) {
            toast({
              title: "WhatsApp setup failed",
              description: e?.message || "Unknown error",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        })();
      },
      {
        // Embedded Signup config
        config_id: cfg.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      },
    );
  }, [disabledProp, extraCallbackPayload, graphVersionFallback, initError, onCompleted, ready, toast]);

  const buttonDisabled = loading || !ready || !!disabledProp;

  return (
    <Button onClick={onClick} disabled={buttonDisabled}>
      {loading
        ? "Launching…"
        : !ready
          ? initError
            ? "WhatsApp unavailable"
            : "Loading…"
          : buttonLabel}
    </Button>
  );
}

