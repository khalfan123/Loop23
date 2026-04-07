export type ProviderSupport = "elevenlabs" | "openai" | "both";

export interface LanguageOption {
  value: string;
  label: string;
  providers: ProviderSupport;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: "en", label: "English", providers: "both" },
  { value: "zh", label: "Chinese", providers: "both" },
  { value: "hi", label: "Hindi", providers: "both" },
  { value: "es", label: "Spanish", providers: "both" },
  { value: "fr", label: "French", providers: "both" },
  { value: "ar", label: "Arabic", providers: "both" },
];

export function getLanguageLabel(value: string): string {
  const lang = SUPPORTED_LANGUAGES.find(l => l.value === value);
  return lang?.label || value;
}

export function isProviderSupported(value: string, provider: "elevenlabs" | "openai"): boolean {
  const lang = SUPPORTED_LANGUAGES.find(l => l.value === value);
  if (!lang) return false;
  return lang.providers === "both" || lang.providers === provider;
}
