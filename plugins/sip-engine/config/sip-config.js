const SIP_PROVIDERS = {
  tcxc: {
    name: "tcxc",
    displayName: "TelecomXchange (TCXC)",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    inboundTransport: "tcp",
    inboundPort: 5060,
    description: "TelecomXchange SIP trunking with global interconnection (Airtel, Mobily, Tonerro routes)"
  },
  twilio: {
    name: "twilio",
    displayName: "Twilio SIP",
    requiresRegistration: false,
    defaultPort: 5061,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    inboundTransport: "tcp",
    inboundPort: 5060,
    description: "Twilio Elastic SIP Trunking"
  },
  telnyx: {
    name: "telnyx",
    displayName: "Telnyx",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    description: "Telnyx SIP Trunking with global coverage"
  },
  vonage: {
    name: "vonage",
    displayName: "Vonage (Nexmo)",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "prefer",
    description: "Vonage SIP Trunking"
  },
  exotel: {
    name: "exotel",
    displayName: "Exotel",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tcp",
    defaultMediaEncryption: "prefer",
    description: "Exotel SIP for India and Southeast Asia"
  },
  bandwidth: {
    name: "bandwidth",
    displayName: "Bandwidth",
    requiresRegistration: false,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    description: "Bandwidth SIP Trunking"
  },
  didww: {
    name: "didww",
    displayName: "DIDWW",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "tls",
    defaultMediaEncryption: "require",
    description: "DIDWW global DID numbers"
  },
  generic: {
    name: "generic",
    displayName: "Generic SIP",
    requiresRegistration: true,
    defaultPort: 5060,
    defaultTransport: "udp",
    defaultMediaEncryption: "none",
    description: "Generic SIP provider - configure all settings manually"
  }
};
const ELEVENLABS_SIP_CONFIG = {
  apiBaseUrl: "https://api.elevenlabs.io/v1",
  sipEndpoint: "sip.rtc.elevenlabs.io",
  defaultCodecs: ["PCMU", "PCMA"],
  supportedEngines: ["elevenlabs-sip"]
};
function getProviderDefaults(provider) {
  return SIP_PROVIDERS[provider] || SIP_PROVIDERS.generic;
}
export {
  ELEVENLABS_SIP_CONFIG,
  SIP_PROVIDERS,
  getProviderDefaults
};
