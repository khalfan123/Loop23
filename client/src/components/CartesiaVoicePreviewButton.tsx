import { useState, useRef, useEffect, useCallback, MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Square, Loader2, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthStorage } from "@/lib/auth-storage";
import { useTranslation } from "react-i18next";

interface CartesiaVoicePreviewButtonProps {
  voiceId: string;
  voiceName?: string;
  previewText?: string;
  compact?: boolean;
  stopOthersRef?: MutableRefObject<(() => void) | null>;
  onPlayingChange?: (playing: boolean) => void;
}

async function fetchCartesiaVoicePreview(
  voiceId: string,
  text: string
): Promise<Blob> {
  const authHeader = AuthStorage.getAuthHeader();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const response = await fetch("/api/cartesia/voices/preview", {
    method: "POST",
    headers,
    body: JSON.stringify({ voiceId, text }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to generate preview";
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const errorText = await response.text();
        errorMessage = errorText || `Server error: ${response.status}`;
      }
    } catch {
      errorMessage = `Server error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.blob();
}

export default function CartesiaVoicePreviewButton({
  voiceId,
  voiceName,
  previewText,
  compact = false,
  stopOthersRef,
  onPlayingChange,
}: CartesiaVoicePreviewButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const defaultText = t(
    "voicePreview.defaultText",
    "Hello! This is a preview of how I'll sound. I can adjust my tone and style based on your preferences."
  );

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const stopPlayback = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  useEffect(() => {
    if (stopOthersRef) {
      stopOthersRef.current = stopPlayback;
    }
  }, [stopOthersRef, stopPlayback]);

  const playAudio = useCallback(
    async (url: string) => {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
        await audioRef.current.play().catch(() => {});
        setIsPlaying(true);
        onPlayingChange?.(true);
      }
    },
    [onPlayingChange]
  );

  const handleAudioEnded = () => {
    setIsPlaying(false);
    onPlayingChange?.(false);
  };

  const quickPreview = async () => {
    if (!voiceId) return;

    if (stopOthersRef?.current) {
      stopOthersRef.current();
    }

    setIsLoading(true);
    try {
      const blob = await fetchCartesiaVoicePreview(
        voiceId,
        previewText || defaultText
      );
      const url = URL.createObjectURL(blob);

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(url);
      await playAudio(url);
    } catch (error: any) {
      console.error("Cartesia voice preview error:", error);
      toast({
        title: t("voicePreview.error"),
        description: error.message || t("voicePreview.failedToGenerate"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} onEnded={handleAudioEnded} />
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "sm"}
        onClick={isPlaying ? stopPlayback : quickPreview}
        disabled={!voiceId || isLoading}
        data-testid="button-cartesia-voice-preview"
        title={voiceName ? `Preview ${voiceName}` : "Preview voice"}
        className={compact ? "h-8 w-8" : ""}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Square className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {!compact && <span className="ml-1.5">Preview</span>}
      </Button>
    </>
  );
}
