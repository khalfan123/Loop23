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
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Play, Mic, Square, AlertCircle, Globe, Pause, Volume2, PanelLeft, Languages, Users, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import OpenAIVoicePreviewButton from "@/components/OpenAIVoicePreviewButton";
import { cn } from "@/lib/utils";

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
  { value: 'it', label: 'Italian', code: 'it' },
  { value: 'zh', label: 'Chinese', code: 'zh' },
  { value: 'ar', label: 'Arabic', code: 'ar' },
  { value: 'hi', label: 'Hindi', code: 'hi' },
];

const GENDER_COLORS: Record<string, string> = {
  male: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  female: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400",
};

const CATEGORY_COLORS: Record<string, string> = {
  professional: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  premade: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  cloned: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  generated: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
};

function getGenderColor(gender?: string) {
  if (!gender) return GENDER_COLORS.neutral;
  return GENDER_COLORS[gender.toLowerCase()] || GENDER_COLORS.neutral;
}

function getCategoryColor(category?: string) {
  if (!category) return "bg-muted text-muted-foreground";
  return CATEGORY_COLORS[category.toLowerCase()] || "bg-muted text-muted-foreground";
}

function VoiceAvatar({ name, gender }: { name: string; gender?: string }) {
  const initial = name.charAt(0).toUpperCase();
  const gradients: Record<string, string> = {
    male: "from-blue-500 to-indigo-600",
    female: "from-pink-500 to-rose-600",
    neutral: "from-gray-400 to-slate-600",
  };
  const gradient = gradients[gender?.toLowerCase() || "neutral"] || gradients.neutral;

  return (
    <div className={cn(
      "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
      gradient
    )}>
      <span className="text-white font-semibold text-sm">{initial}</span>
    </div>
  );
}

function WaveformBars({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-primary transition-all duration-300",
            isPlaying ? "animate-pulse" : "opacity-40"
          )}
          style={{
            height: isPlaying
              ? `${8 + Math.sin(i * 1.2) * 8}px`
              : `${4 + (i % 3) * 2}px`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

function FilterSidebar({
  selectedLanguage,
  setSelectedLanguage,
  selectedGender,
  setSelectedGender,
  availableLanguages,
  activeProvider,
  activeFilterCount,
  clearFilters,
}: {
  selectedLanguage: string;
  setSelectedLanguage: (v: string) => void;
  selectedGender: string;
  setSelectedGender: (v: string) => void;
  availableLanguages: typeof VOICE_LANGUAGES;
  activeProvider: string;
  activeFilterCount: number;
  clearFilters: () => void;
}) {
  const genderOptions = [
    { value: "all", label: "All" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "neutral", label: "Neutral" },
  ];

  return (
    <nav className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-[11px] text-primary hover:text-primary/80 font-medium"
            data-testid="button-clear-sidebar-filters"
          >
            Clear all
          </button>
        )}
      </div>

      {activeProvider === "elevenlabs" && (
        <div className="px-3 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 px-1 mb-3">
            <Languages className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Language</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {availableLanguages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setSelectedLanguage(lang.value)}
                data-testid={`filter-lang-${lang.value}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full",
                  selectedLanguage === lang.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {lang.value !== 'all' && (
                  <Globe className="h-3.5 w-3.5 shrink-0 opacity-50" />
                )}
                {lang.value === 'all' && (
                  <span className="h-3.5 w-3.5 shrink-0 text-center text-[10px] font-bold opacity-50">∞</span>
                )}
                <span className="truncate">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 py-4">
        <div className="flex items-center gap-2 px-1 mb-3">
          <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Gender</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {genderOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedGender(opt.value)}
              data-testid={`filter-gender-${opt.value}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left w-full",
                selectedGender === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {opt.value !== "all" ? (
                <span className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  opt.value === "male" && "bg-blue-500",
                  opt.value === "female" && "bg-pink-500",
                  opt.value === "neutral" && "bg-gray-400"
                )} />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-gradient-to-r from-blue-500 via-pink-500 to-gray-400" />
              )}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function Voices({ externalProvider, externalLanguage, hideHeader, hideProviderTabs }: VoicesProps = {}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("elevenlabs");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const VOICES_PER_PAGE = 10;

  const effectiveProvider = externalProvider || activeTab;
  const effectiveLanguage = externalLanguage || selectedLanguage;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedLanguage, selectedGender]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const { data: accountVoices, isLoading, isError, error } = useQuery<AccountVoice[]>({
    queryKey: ["/api/elevenlabs/voices"],
    staleTime: 60000,
  });

  const availableLanguages = useMemo(() => {
    if (!accountVoices) return [];
    const langs = new Set<string>();
    accountVoices.forEach(v => {
      if (v.labels?.language) langs.add(v.labels.language.toLowerCase());
    });
    return VOICE_LANGUAGES.filter(l => l.value === 'all' || langs.has(l.code));
  }, [accountVoices]);

  const filteredVoices = useMemo(() => {
    if (!accountVoices) return [];
    let result = accountVoices;
    if (effectiveLanguage && effectiveLanguage !== 'all') {
      result = result.filter(v =>
        v.labels?.language?.toLowerCase() === effectiveLanguage.toLowerCase()
      );
    }
    if (selectedGender !== 'all') {
      result = result.filter(v =>
        v.labels?.gender?.toLowerCase() === selectedGender.toLowerCase()
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
  }, [accountVoices, debouncedSearch, effectiveLanguage, selectedGender]);

  const filteredOpenAIVoices = useMemo(() => {
    let result = OPENAI_VOICES;
    if (selectedGender !== 'all') {
      result = result.filter(v => v.gender.toLowerCase() === selectedGender.toLowerCase());
    }
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(searchLower) ||
        v.description.toLowerCase().includes(searchLower) ||
        v.gender.toLowerCase().includes(searchLower) ||
        v.style.toLowerCase().includes(searchLower)
      );
    }
    return result;
  }, [debouncedSearch, selectedGender]);

  const handlePlayPreview = useCallback((voiceId: string, previewUrl?: string) => {
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
    audio.play().catch(() => {});
    setPlayingVoice(voiceId);
    audio.onended = () => {
      setPlayingVoice(null);
      audioRef.current = null;
    };
  }, [playingVoice]);

  const formatLanguageName = (code: string) => {
    const languageNames: Record<string, string> = {
      en: "English", es: "Spanish", fr: "French", de: "German",
      it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean",
      zh: "Chinese", ru: "Russian", ar: "Arabic", hi: "Hindi",
      nl: "Dutch", pl: "Polish", sv: "Swedish", tr: "Turkish",
      id: "Indonesian", th: "Thai", vi: "Vietnamese", cs: "Czech",
      el: "Greek", hu: "Hungarian", ro: "Romanian", uk: "Ukrainian",
      he: "Hebrew", ms: "Malay", fil: "Filipino", da: "Danish",
      fi: "Finnish", no: "Norwegian", sk: "Slovak", bg: "Bulgarian",
      hr: "Croatian", lt: "Lithuanian", lv: "Latvian", sl: "Slovenian",
      et: "Estonian",
    };
    return languageNames[code?.toLowerCase()] || code?.toUpperCase() || "Unknown";
  };

  const getFilteredCount = () => {
    if (effectiveProvider === "elevenlabs") return filteredVoices.length;
    return filteredOpenAIVoices.length;
  };

  const getTotalCount = () => {
    if (effectiveProvider === "elevenlabs") return accountVoices?.length || 0;
    return OPENAI_VOICES.length;
  };

  const activeFilterCount =
    (selectedLanguage !== 'all' ? 1 : 0) +
    (selectedGender !== 'all' ? 1 : 0);

  const hasActiveFilters = !!debouncedSearch || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedLanguage("all");
    setSelectedGender("all");
  };

  const renderVoiceCard = (voice: AccountVoice) => {
    const isPlaying = playingVoice === voice.voice_id;
    return (
      <div
        key={voice.voice_id}
        className={cn(
          "group relative rounded-2xl border transition-all duration-200 p-4",
          "bg-card hover:bg-accent/50 dark:hover:bg-accent/30",
          "border-border/60 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
          isPlaying && "border-primary/50 bg-primary/[0.03] dark:bg-primary/[0.06] shadow-md shadow-primary/10"
        )}
        data-testid={`card-voice-${voice.voice_id}`}
      >
        <div className="flex items-start gap-3">
          <VoiceAvatar name={voice.name} gender={voice.labels?.gender} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold truncate text-foreground" data-testid="text-voice-name">
                {voice.name}
              </h3>
              {voice.category && (
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize shrink-0",
                  getCategoryColor(voice.category)
                )}>
                  {voice.category}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {voice.labels?.language && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 dark:bg-muted/30 px-1.5 py-0.5 rounded-md">
                  <Globe className="h-2.5 w-2.5" />
                  {formatLanguageName(voice.labels.language)}
                </span>
              )}
              {voice.labels?.gender && (
                <span className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded-md capitalize font-medium",
                  getGenderColor(voice.labels.gender)
                )}>
                  {voice.labels.gender}
                </span>
              )}
              {voice.labels?.accent && (
                <span className="text-[11px] text-muted-foreground/70 bg-muted/40 dark:bg-muted/20 px-1.5 py-0.5 rounded-md capitalize">
                  {voice.labels.accent}
                </span>
              )}
              {voice.labels?.age && (
                <span className="text-[11px] text-muted-foreground/60 bg-muted/30 dark:bg-muted/15 px-1.5 py-0.5 rounded-md capitalize">
                  {voice.labels.age}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {isPlaying && <WaveformBars isPlaying={true} />}
            {voice.preview_url && (
              <button
                onClick={() => handlePlayPreview(voice.voice_id, voice.preview_url)}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200",
                  isPlaying
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                    : "bg-muted/60 dark:bg-muted/30 text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:shadow-primary/20 hover:scale-105"
                )}
                data-testid="button-play-voice"
              >
                {isPlaying ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderOpenAICard = (voice: OpenAIVoiceInfo) => {
    return (
      <div
        key={voice.id}
        className={cn(
          "group relative rounded-2xl border transition-all duration-200 p-4",
          "bg-card hover:bg-accent/50 dark:hover:bg-accent/30",
          "border-border/60 hover:border-violet-400/30 hover:shadow-md hover:shadow-violet-500/5"
        )}
        data-testid={`card-openai-voice-${voice.id}`}
      >
        <div className="flex items-start gap-3">
          <VoiceAvatar name={voice.name} gender={voice.gender} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold truncate text-foreground" data-testid="text-openai-voice-name">
                {voice.name}
              </h3>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
                OpenAI
              </span>
            </div>

            <p className="text-xs text-muted-foreground/80 line-clamp-1 mb-1.5">
              {voice.description}
            </p>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                "text-[11px] px-1.5 py-0.5 rounded-md capitalize font-medium",
                getGenderColor(voice.gender)
              )}>
                {voice.gender}
              </span>
              <span className="text-[11px] text-muted-foreground/70 bg-muted/40 dark:bg-muted/20 px-1.5 py-0.5 rounded-md">
                {voice.style}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <OpenAIVoicePreviewButton
              voiceId={voice.id}
              voiceName={voice.name}
            />
          </div>
        </div>
      </div>
    );
  };

  const paginateItems = <T,>(items: T[]): { paged: T[]; totalPages: number } => {
    const totalPages = Math.max(1, Math.ceil(items.length / VOICES_PER_PAGE));
    const start = (currentPage - 1) * VOICES_PER_PAGE;
    return { paged: items.slice(start, start + VOICES_PER_PAGE), totalPages };
  };

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / VOICES_PER_PAGE));
    if (totalPages <= 1) return null;

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

    return (
      <div className="flex items-center justify-center gap-1.5 pt-6" data-testid="pagination-controls">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
            currentPage === 1
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          data-testid="button-page-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => setCurrentPage(1)}
              className="h-8 min-w-8 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              data-testid="button-page-1"
            >
              1
            </button>
            {startPage > 2 && <span className="text-xs text-muted-foreground/50 px-1">...</span>}
          </>
        )}

        {pages.map(page => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={cn(
              "h-8 min-w-8 px-2 rounded-lg text-xs font-medium transition-colors",
              currentPage === page
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            data-testid={`button-page-${page}`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-xs text-muted-foreground/50 px-1">...</span>}
            <button
              onClick={() => setCurrentPage(totalPages)}
              className="h-8 min-w-8 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              data-testid={`button-page-${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
            currentPage === totalPages
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          data-testid="button-page-next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
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
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-5 w-14 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (filteredVoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Mic className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/80 mb-1">
            {hasActiveFilters
              ? t('voices.noVoicesMatch', 'No voices match your filters')
              : t('voices.noVoicesAvailable', 'No voices available')}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {hasActiveFilters
              ? t('voices.tryDifferentSearch', 'Try adjusting your search or filters')
              : t('voices.voicesWillAppear', 'Your ElevenLabs account voices will appear here')}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-full" data-testid="button-clear-filters">
              Clear all filters
            </Button>
          )}
        </div>
      );
    }

    const { paged } = paginateItems(filteredVoices);
    return (
      <>
        <div className="grid grid-cols-1 gap-3">
          {paged.map(renderVoiceCard)}
        </div>
        {renderPagination(filteredVoices.length)}
      </>
    );
  };

  const renderOpenAIContent = () => {
    if (filteredOpenAIVoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
            <Mic className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/80 mb-1">
            {t('voices.noVoicesMatch', 'No voices match your filters')}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {t('voices.tryDifferentSearch', 'Try adjusting your search or filters')}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-full" data-testid="button-clear-filters-openai">
              Clear all filters
            </Button>
          )}
        </div>
      );
    }

    const { paged } = paginateItems(filteredOpenAIVoices);
    return (
      <>
        <div className="grid grid-cols-1 gap-3">
          {paged.map(renderOpenAICard)}
        </div>
        {renderPagination(filteredOpenAIVoices.length)}
      </>
    );
  };

  const sidebarProps = {
    selectedLanguage: effectiveLanguage,
    setSelectedLanguage: (v: string) => { setSelectedLanguage(v); setMobileOpen(false); },
    selectedGender,
    setSelectedGender: (v: string) => { setSelectedGender(v); setMobileOpen(false); },
    availableLanguages,
    activeProvider: effectiveProvider,
    activeFilterCount,
    clearFilters,
  };

  return (
    <div className="flex w-full min-h-[calc(100vh-80px)] -mx-4 md:-mx-8 lg:-mx-12 -my-4 md:-my-6">
      <aside className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900">
        <FilterSidebar {...sidebarProps} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex md:hidden items-center gap-2 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="voices-mobile-filter-toggle">
                <PanelLeft className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0 bg-white dark:bg-zinc-900">
              <FilterSidebar {...sidebarProps} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-zinc-50/80 dark:bg-zinc-950/50 px-4 md:px-8 lg:px-10 py-4 md:py-6">
          {!hideHeader && (
            <div className="space-y-1 mb-5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
                Voices
              </h1>
              <p className="text-sm text-muted-foreground">
                Browse and preview available voices
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Search by name, language, or style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/30"
                data-testid="input-search-voices"
              />
            </div>

            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <div className="hidden md:flex items-center gap-1.5">
                  {selectedLanguage !== 'all' && (
                    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                      {VOICE_LANGUAGES.find(l => l.value === selectedLanguage)?.label || selectedLanguage}
                      <button onClick={() => setSelectedLanguage('all')} className="hover:text-primary/70" data-testid="remove-lang-filter">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedGender !== 'all' && (
                    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium capitalize">
                      {selectedGender}
                      <button onClick={() => setSelectedGender('all')} className="hover:text-primary/70" data-testid="remove-gender-filter">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
              {!isLoading && (
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap" data-testid="text-voice-count">
                  {hasActiveFilters
                    ? `${getFilteredCount()} of ${getTotalCount()} voices`
                    : `${getTotalCount()} voices`}
                </span>
              )}
            </div>
          </div>

          {!hideProviderTabs ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-white dark:bg-zinc-900 border border-border/50 rounded-xl p-1" data-testid="tabs-voice-provider">
                <TabsTrigger
                  value="elevenlabs"
                  className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-xs"
                  data-testid="tab-elevenlabs"
                >
                  ElevenLabs
                  <span className="ml-1.5 text-[10px] text-muted-foreground">({accountVoices?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="openai"
                  className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-xs"
                  data-testid="tab-openai"
                >
                  OpenAI
                  <span className="ml-1.5 text-[10px] text-muted-foreground">({OPENAI_VOICES.length})</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="elevenlabs">{renderElevenLabsContent()}</TabsContent>
              <TabsContent value="openai">{renderOpenAIContent()}</TabsContent>
            </Tabs>
          ) : (
            effectiveProvider === "elevenlabs" ? renderElevenLabsContent() : renderOpenAIContent()
          )}
        </div>
      </div>
    </div>
  );
}
