/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Play, Mic, Square, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from 'react-i18next';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OpenAIVoicePreviewButton from "@/components/OpenAIVoicePreviewButton";

interface AccountVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface OpenAIVoiceInfo {
  id: string;
  name: string;
  description: string;
  gender: string;
  style: string;
}

const OPENAI_VOICES: OpenAIVoiceInfo[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutral, versatile voice suitable for a wide range of applications', gender: 'Neutral', style: 'Balanced' },
  { id: 'echo', name: 'Echo', description: 'Warm, engaging voice with a friendly tone', gender: 'Male', style: 'Warm' },
  { id: 'shimmer', name: 'Shimmer', description: 'Expressive, dynamic voice with clear articulation', gender: 'Female', style: 'Expressive' },
  { id: 'ash', name: 'Ash', description: 'Calm, professional voice ideal for business contexts', gender: 'Male', style: 'Professional' },
  { id: 'ballad', name: 'Ballad', description: 'Smooth, melodic voice with a soothing quality', gender: 'Female', style: 'Melodic' },
  { id: 'coral', name: 'Coral', description: 'Bright, energetic voice with an upbeat tone', gender: 'Female', style: 'Energetic' },
  { id: 'sage', name: 'Sage', description: 'Wise, authoritative voice conveying expertise', gender: 'Male', style: 'Authoritative' },
  { id: 'verse', name: 'Verse', description: 'Articulate, clear voice perfect for narration', gender: 'Neutral', style: 'Narrative' },
  { id: 'cedar', name: 'Cedar', description: 'Deep, resonant voice with a grounded presence', gender: 'Male', style: 'Deep' },
  { id: 'marin', name: 'Marin', description: 'Fresh, youthful voice with modern appeal', gender: 'Female', style: 'Youthful' },
];

interface VoicesProps {
  externalProvider?: string;
  externalLanguage?: string;
  hideHeader?: boolean;
  hideProviderTabs?: boolean;
}

export const VOICE_LANGUAGES = [
  { value: 'all', label: 'All Languages', code: '' },
  { value: 'en', label: 'English', code: 'en' },
  { value: 'es', label: 'Spanish', code: 'es' },
  { value: 'fr', label: 'French', code: 'fr' },
  { value: 'de', label: 'German', code: 'de' },
  { value: 'it', label: 'Italian', code: 'it' },
  { value: 'pt', label: 'Portuguese', code: 'pt' },
  { value: 'ja', label: 'Japanese', code: 'ja' },
  { value: 'ko', label: 'Korean', code: 'ko' },
  { value: 'zh', label: 'Chinese', code: 'zh' },
  { value: 'ru', label: 'Russian', code: 'ru' },
  { value: 'ar', label: 'Arabic', code: 'ar' },
  { value: 'hi', label: 'Hindi', code: 'hi' },
  { value: 'nl', label: 'Dutch', code: 'nl' },
  { value: 'pl', label: 'Polish', code: 'pl' },
  { value: 'sv', label: 'Swedish', code: 'sv' },
  { value: 'tr', label: 'Turkish', code: 'tr' },
];

export default function Voices({ externalProvider, externalLanguage, hideHeader, hideProviderTabs }: VoicesProps = {}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("elevenlabs");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveProvider = externalProvider || activeTab;
  const effectiveLanguage = externalLanguage || 'all';

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: accountVoices, isLoading, isError, error } = useQuery<AccountVoice[]>({
    queryKey: ["/api/elevenlabs/voices"],
    staleTime: 60000,
  });

  const filteredVoices = useMemo(() => {
    if (!accountVoices) return [];
    let result = accountVoices;
    if (effectiveLanguage && effectiveLanguage !== 'all') {
      result = result.filter(v => 
        v.labels?.language?.toLowerCase() === effectiveLanguage.toLowerCase()
      );
    }
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(v => 
        v.name.toLowerCase().includes(searchLower) ||
        v.labels?.language?.toLowerCase().includes(searchLower) ||
        v.labels?.gender?.toLowerCase().includes(searchLower) ||
        v.labels?.accent?.toLowerCase().includes(searchLower) ||
        v.category?.toLowerCase().includes(searchLower)
      );
    }
    return result;
  }, [accountVoices, debouncedSearch, effectiveLanguage]);

  const filteredOpenAIVoices = useMemo(() => {
    if (!debouncedSearch) return OPENAI_VOICES;
    const searchLower = debouncedSearch.toLowerCase();
    return OPENAI_VOICES.filter(v => 
      v.name.toLowerCase().includes(searchLower) ||
      v.description.toLowerCase().includes(searchLower) ||
      v.gender.toLowerCase().includes(searchLower) ||
      v.style.toLowerCase().includes(searchLower)
    );
  }, [debouncedSearch]);

  const handlePlayPreview = (voiceId: string, previewUrl?: string) => {
    if (!previewUrl) return;
    
    if (playingVoice === voiceId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setPlayingVoice(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingVoice(voiceId);
    audio.onended = () => {
      setPlayingVoice(null);
      audioRef.current = null;
    };
  };

  const formatLanguageName = (code: string) => {
    const languageNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      ru: "Russian",
      ar: "Arabic",
      hi: "Hindi",
      nl: "Dutch",
      pl: "Polish",
      sv: "Swedish",
      tr: "Turkish",
      id: "Indonesian",
      th: "Thai",
      vi: "Vietnamese",
      cs: "Czech",
      el: "Greek",
      hu: "Hungarian",
      ro: "Romanian",
      uk: "Ukrainian",
      he: "Hebrew",
      ms: "Malay",
      fil: "Filipino",
      da: "Danish",
      fi: "Finnish",
      no: "Norwegian",
      sk: "Slovak",
      bg: "Bulgarian",
      hr: "Croatian",
      lt: "Lithuanian",
      lv: "Latvian",
      sl: "Slovenian",
      et: "Estonian",
    };
    return languageNames[code?.toLowerCase()] || code?.toUpperCase() || "Unknown";
  };

  const getTotalVoiceCount = () => {
    if (effectiveProvider === "elevenlabs") {
      return accountVoices?.length || 0;
    }
    return OPENAI_VOICES.length;
  };

  const getFilteredCount = () => {
    if (effectiveProvider === "elevenlabs") {
      return filteredVoices.length;
    }
    return filteredOpenAIVoices.length;
  };

  const renderElevenLabsContent = () => {
    if (isError) {
      return (
        <Alert variant="destructive" data-testid="alert-voices-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>
            {(error as Error)?.message || t('voices.errorLoading', 'Failed to load voices. Please check your ElevenLabs API key configuration.')}
          </AlertDescription>
        </Alert>
      );
    }
    if (isLoading) {
      return (
        <div className="space-y-0 divide-y divide-border/40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (filteredVoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
            <Mic className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium text-foreground/80 mb-1">
            {debouncedSearch 
              ? t('voices.noVoicesMatch', 'No voices match your search')
              : t('voices.noVoicesAvailable', 'No voices available')}
          </h3>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {debouncedSearch 
              ? t('voices.tryDifferentSearch', 'Try a different search term')
              : t('voices.voicesWillAppear', 'Your ElevenLabs account voices will appear here')}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-0 divide-y divide-border/40">
        {filteredVoices.map((voice) => (
          <div
            key={voice.voice_id}
            className="group py-3 hover-elevate transition-colors duration-150 rounded-md px-2 -mx-2"
            data-testid={`card-voice-${voice.voice_id}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-medium truncate" data-testid="text-voice-name">
                    {voice.name}
                  </h3>
                  {voice.category && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium capitalize">{voice.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {voice.labels?.language && (
                    <span className="text-[11px] text-muted-foreground/70">{formatLanguageName(voice.labels.language)}</span>
                  )}
                  {voice.labels?.gender && (
                    <span className="text-[11px] text-muted-foreground/50 capitalize">{voice.labels.gender}</span>
                  )}
                  {voice.labels?.accent && (
                    <span className="text-[11px] text-muted-foreground/50 capitalize">{voice.labels.accent}</span>
                  )}
                  {voice.labels?.age && (
                    <span className="text-[11px] text-muted-foreground/40 capitalize">{voice.labels.age}</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ visibility: 'visible' }}>
                {voice.preview_url && (
                  <Button
                    variant={playingVoice === voice.voice_id ? "default" : "ghost"}
                    size="icon"
                    onClick={() => handlePlayPreview(voice.voice_id, voice.preview_url)}
                    data-testid="button-play-voice"
                  >
                    {playingVoice === voice.voice_id ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOpenAIContent = () => {
    if (filteredOpenAIVoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
            <Mic className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium text-foreground/80 mb-1">
            {t('voices.noVoicesMatch', 'No voices match your search')}
          </h3>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            {t('voices.tryDifferentSearch', 'Try a different search term')}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-0 divide-y divide-border/40">
        {filteredOpenAIVoices.map((voice) => (
          <div
            key={voice.id}
            className="group py-3 hover-elevate transition-colors duration-150 rounded-md px-2 -mx-2"
            data-testid={`card-openai-voice-${voice.id}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-medium truncate" data-testid="text-openai-voice-name">
                    {voice.name}
                  </h3>
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">OpenAI</span>
                </div>
                <p className="text-xs text-muted-foreground/70 line-clamp-1 mb-1">
                  {voice.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground/50">{voice.gender}</span>
                  <span className="text-[11px] text-muted-foreground/40">{voice.style}</span>
                </div>
              </div>
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ visibility: 'visible' }}>
                <OpenAIVoicePreviewButton
                  voiceId={voice.id}
                  voiceName={voice.name}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50 via-rose-100/50 to-fuchsia-50 dark:from-pink-950/40 dark:via-rose-900/30 dark:to-fuchsia-950/40 border border-pink-100 dark:border-pink-900/50 p-6 md:p-8">
          <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-700/20 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
                <Mic className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('voices.title')}</h1>
                <p className="text-muted-foreground mt-0.5">
                  {t('voices.subtitleBrowse', 'Browse and preview available voices')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search - iOS 8 style */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder="Search voices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
          data-testid="input-search-voices"
        />
      </div>

      {(effectiveProvider === "openai" || !isLoading) && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/60">
            {debouncedSearch 
              ? `${getFilteredCount()} of ${getTotalVoiceCount()} voices`
              : `${getTotalVoiceCount()} voices`}
          </span>
        </div>
      )}

      {!hideProviderTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList data-testid="tabs-voice-provider">
            <TabsTrigger value="elevenlabs" data-testid="tab-elevenlabs">
              ElevenLabs ({accountVoices?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="openai" data-testid="tab-openai">
              OpenAI ({OPENAI_VOICES.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="elevenlabs">{renderElevenLabsContent()}</TabsContent>
          <TabsContent value="openai">{renderOpenAIContent()}</TabsContent>
        </Tabs>
      ) : (
        effectiveProvider === "elevenlabs" ? renderElevenLabsContent() : renderOpenAIContent()
      )}
    </div>
  );
}
