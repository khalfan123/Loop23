/**
 * ============================================================
 * Voice Core — provider registry
 * ============================================================
 */

import type { TTSProvider, TTSProviderId } from './types';

export class ProviderRegistry {
  private ttsProviders: Map<TTSProviderId, TTSProvider> = new Map();

  registerTTS(provider: TTSProvider): void {
    if (this.ttsProviders.has(provider.id)) {
      throw new Error(`TTS provider already registered: ${provider.id}`);
    }
    this.ttsProviders.set(provider.id, provider);
  }

  getTTS(id: TTSProviderId): TTSProvider | undefined {
    return this.ttsProviders.get(id);
  }

  listTTS(): TTSProvider[] {
    return Array.from(this.ttsProviders.values());
  }
}
