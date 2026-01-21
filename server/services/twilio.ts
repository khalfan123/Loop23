'use strict';
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
import { getTwilioClient, getTwilioAccountSid } from "./twilio-connector";
import { getDomain } from "../utils/domain";
import { withServiceErrorHandling } from '../utils/service-error-wrapper';

// Use REAL Twilio by default, only mock if explicitly set
const TWILIO_MODE = process.env.TWILIO_MODE || 'live';
const SHOULD_MOCK_TWILIO = TWILIO_MODE === 'mock';

if (SHOULD_MOCK_TWILIO) {
  console.log("🔧 Twilio running in MOCK mode - using simulated phone numbers");
} else {
  console.log("📞 Twilio running in LIVE mode - using real Twilio connector");
}

interface TwilioPhoneNumber {
  phoneNumber: string;
  friendlyName?: string;
  sid: string;
  capabilities?: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  pricing?: {
    purchasePrice: string;
    monthlyPrice: string;
    priceUnit: string;
  };
}

interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  isoCountry: string;
  addressRequirements?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

interface TwilioAddress {
  sid: string;
  friendlyName: string;
  customerName: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  isoCountry: string;
  validated: boolean;
  verified: boolean;
}

interface BuyPhoneNumberOptions {
  phoneNumber: string;
  friendlyName?: string;
  addressSid?: string;
  bundleSid?: string;
}

// In-memory store for mock phone numbers in development
const mockOwnedNumbers: TwilioPhoneNumber[] = [];

export class TwilioService {
  private shouldMock: boolean;

  constructor() {
    this.shouldMock = SHOULD_MOCK_TWILIO;
  }

  private async getTwilioClientInstance() {
    if (this.shouldMock) {
      throw new Error("Mock mode - no Twilio client available");
    }
    return await getTwilioClient();
  }

  async searchAvailableNumbers(params: {
    country?: string;
    areaCode?: string;
    contains?: string;
    inPostalCode?: string;
    inLocality?: string;
    inRegion?: string;
    limit?: number;
  }): Promise<AvailablePhoneNumber[]> {
    // Use mock numbers in mock mode
    if (this.shouldMock) {
      console.log("Mock mode: Returning mock phone numbers");
      const areaCode = params.areaCode || "415";
      const locality = params.inLocality || "San Francisco";
      const region = params.inRegion || "CA";
      const postalCode = params.inPostalCode || "94102";
      return [
        {
          phoneNumber: `+1${areaCode}5551234`,
          friendlyName: `(${areaCode}) 555-1234`,
          locality: locality,
          region: region,
          postalCode: postalCode,
          isoCountry: params.country || "US",
          capabilities: {
            voice: true,
            sms: true,
            mms: false,
          }
        },
        {
          phoneNumber: `+1${areaCode}5555678`,
          friendlyName: `(${areaCode}) 555-5678`,
          locality: locality,
          region: region,
          postalCode: String(parseInt(postalCode, 10) + 1),
          isoCountry: params.country || "US",
          capabilities: {
            voice: true,
            sms: true,
            mms: false,
          }
        },
      ];
    }
    
    // Use real Twilio connector
    const client = await this.getTwilioClientInstance();
    const country = params.country || "US";
    
    const listOptions: any = {
      limit: params.limit || 20,
    };
    if (params.areaCode) listOptions.areaCode = parseInt(params.areaCode, 10);
    if (params.contains) listOptions.contains = params.contains;
    if (params.inPostalCode) listOptions.inPostalCode = params.inPostalCode;
    if (params.inLocality) listOptions.inLocality = params.inLocality;
    if (params.inRegion) listOptions.inRegion = params.inRegion;
    
    const numbers = await client.availablePhoneNumbers(country).local.list(listOptions);

    return numbers.map((num: any) => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality,
      region: num.region,
      postalCode: num.postalCode,
      isoCountry: num.isoCountry,
      addressRequirements: num.addressRequirements,
      capabilities: num.capabilities,
    }));
  }

  async buyPhoneNumber(options: BuyPhoneNumberOptions): Promise<TwilioPhoneNumber>;
  async buyPhoneNumber(phoneNumber: string, friendlyName?: string): Promise<TwilioPhoneNumber>;
  async buyPhoneNumber(phoneNumberOrOptions: string | BuyPhoneNumberOptions, friendlyName?: string): Promise<TwilioPhoneNumber> {
    const options: BuyPhoneNumberOptions = typeof phoneNumberOrOptions === 'string' 
      ? { phoneNumber: phoneNumberOrOptions, friendlyName }
      : phoneNumberOrOptions;
    
    const { phoneNumber, addressSid, bundleSid } = options;
    const resolvedFriendlyName = options.friendlyName;
    
    // Use mock purchase in mock mode
    if (this.shouldMock) {
      console.log("Mock mode: Simulating phone number purchase");
      const mockNumber = {
        phoneNumber: phoneNumber,
        friendlyName: resolvedFriendlyName || phoneNumber,
        sid: `PN_MOCK_${Date.now()}`,
        capabilities: {
          voice: true,
          sms: true,
          mms: false
        }
      };
      // Add to in-memory store
      mockOwnedNumbers.push(mockNumber);
      return mockNumber;
    }
    
    // Use real Twilio connector
    const client = await this.getTwilioClientInstance();
    
    // SECURITY: Do NOT set any webhook URL on purchase
    // Numbers start with no incoming call handling - calls will be rejected by Twilio
    // Webhook is only configured when an incoming connection is created
    // This prevents unauthorized incoming calls from incurring costs
    
    console.log(`📞 [Phone Purchase] Purchasing number WITHOUT webhook (incoming calls disabled until configured)`);
    
    // Build purchase options - include addressSid/bundleSid for regulatory compliance
    const purchaseOptions: any = {
      phoneNumber: phoneNumber,
      friendlyName: resolvedFriendlyName,
      // No voiceUrl set = incoming calls are rejected by Twilio (no cost)
    };
    
    // Add address for countries requiring regulatory compliance (e.g., Australia, UK, Germany)
    if (addressSid) {
      purchaseOptions.addressSid = addressSid;
      console.log(`📞 [Phone Purchase] Including AddressSid for regulatory compliance: ${addressSid.substring(0, 8)}...`);
    }
    
    // Add bundle for mobile numbers in certain countries requiring regulatory bundles
    if (bundleSid) {
      purchaseOptions.bundleSid = bundleSid;
      console.log(`📞 [Phone Purchase] Including BundleSid for regulatory compliance: ${bundleSid.substring(0, 8)}...`);
    }
    
    // Purchase phone number WITHOUT voice webhook - incoming calls won't be handled
    const result = await client.incomingPhoneNumbers.create(purchaseOptions);

    // Mask phone number in logs (show last 4 digits only)
    const maskedNumber = `***${phoneNumber.slice(-4)}`;
    console.log(`✅ [Phone Purchase] Number ${maskedNumber} purchased (incoming calls disabled)`);

    return {
      phoneNumber: result.phoneNumber,
      friendlyName: result.friendlyName,
      sid: result.sid,
      capabilities: result.capabilities,
    };
  }

  async listOwnedNumbers(): Promise<TwilioPhoneNumber[]> {
    // Return mock owned numbers in mock mode
    if (this.shouldMock) {
      console.log("Mock mode: Returning mock owned numbers");
      return mockOwnedNumbers.map(num => ({
        ...num,
        pricing: {
          purchasePrice: '1.00',
          monthlyPrice: '1.15',
          priceUnit: 'USD'
        }
      }));
    }
    
    // Use real Twilio connector
    const client = await this.getTwilioClientInstance();
    
    const numbers = await client.incomingPhoneNumbers.list();

    // Add standard US phone number pricing
    // Twilio's API doesn't include pricing in the phone number response
    // US local numbers typically cost $1.00 one-time purchase + $1.15/month
    return numbers.map((num: any) => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      sid: num.sid,
      capabilities: num.capabilities,
      pricing: {
        purchasePrice: '1.00',
        monthlyPrice: '1.15',
        priceUnit: 'USD'
      }
    }));
  }

  async releasePhoneNumber(sid: string): Promise<void> {
    // Handle mock release in mock mode
    if (this.shouldMock) {
      console.log("Mock mode: Simulating phone number release");
      const index = mockOwnedNumbers.findIndex(n => n.sid === sid);
      if (index !== -1) {
        mockOwnedNumbers.splice(index, 1);
      }
      return;
    }
    
    // Use real Twilio connector
    const client = await this.getTwilioClientInstance();
    
    await client.incomingPhoneNumbers(sid).remove();
  }

  async updatePhoneNumber(sid: string, params: { friendlyName?: string; voiceUrl?: string }): Promise<void> {
    if (this.shouldMock) {
      console.log("Mock mode: Simulating phone number update");
      return;
    }
    
    const client = await this.getTwilioClientInstance();
    
    await client.incomingPhoneNumbers(sid).update(params);
  }

  /**
   * List all addresses in the Twilio account
   * Used for regulatory compliance when purchasing numbers in countries like Australia, UK, Germany
   */
  async listAddresses(isoCountry?: string): Promise<TwilioAddress[]> {
    if (this.shouldMock) {
      console.log("Mock mode: Returning empty addresses list");
      return [];
    }
    
    const client = await this.getTwilioClientInstance();
    
    const listOptions: any = {};
    if (isoCountry) {
      listOptions.isoCountry = isoCountry;
    }
    
    const addresses = await client.addresses.list(listOptions);
    
    return addresses.map((addr: any) => ({
      sid: addr.sid,
      friendlyName: addr.friendlyName,
      customerName: addr.customerName,
      street: addr.street,
      city: addr.city,
      region: addr.region,
      postalCode: addr.postalCode,
      isoCountry: addr.isoCountry,
      validated: addr.validated,
      verified: addr.verified,
    }));
  }

  /**
   * Create a new address in Twilio for regulatory compliance
   */
  async createAddress(params: {
    customerName: string;
    street: string;
    city: string;
    region: string;
    postalCode: string;
    isoCountry: string;
    friendlyName?: string;
  }): Promise<TwilioAddress> {
    if (this.shouldMock) {
      console.log("Mock mode: Simulating address creation");
      return {
        sid: `AD${Date.now()}`,
        friendlyName: params.friendlyName || params.customerName,
        customerName: params.customerName,
        street: params.street,
        city: params.city,
        region: params.region,
        postalCode: params.postalCode,
        isoCountry: params.isoCountry,
        validated: false,
        verified: false,
      };
    }
    
    const client = await this.getTwilioClientInstance();
    
    const address = await client.addresses.create({
      customerName: params.customerName,
      street: params.street,
      city: params.city,
      region: params.region,
      postalCode: params.postalCode,
      isoCountry: params.isoCountry,
      friendlyName: params.friendlyName || `${params.customerName} - ${params.city}`,
    });
    
    return {
      sid: address.sid,
      friendlyName: address.friendlyName,
      customerName: address.customerName,
      street: address.street,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      isoCountry: address.isoCountry,
      validated: address.validated,
      verified: address.verified,
    };
  }

  /**
   * Delete an address from Twilio
   */
  async deleteAddress(sid: string): Promise<void> {
    if (this.shouldMock) {
      console.log("Mock mode: Simulating address deletion");
      return;
    }
    
    const client = await this.getTwilioClientInstance();
    await client.addresses(sid).remove();
  }

  /**
   * Get a specific address from Twilio
   */
  async getAddress(sid: string): Promise<TwilioAddress | null> {
    if (this.shouldMock) {
      console.log("Mock mode: Returning null for address fetch");
      return null;
    }
    
    try {
      const client = await this.getTwilioClientInstance();
      const address = await client.addresses(sid).fetch();
      
      return {
        sid: address.sid,
        friendlyName: address.friendlyName,
        customerName: address.customerName,
        street: address.street,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        isoCountry: address.isoCountry,
        validated: address.validated,
        verified: address.verified,
      };
    } catch (error: any) {
      if (error.code === 20404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get address requirements for a specific country
   * Returns what type of address/documentation is needed
   */
  async getAddressRequirements(isoCountry: string): Promise<string> {
    // Countries that require local address for phone number purchase
    const addressRequirements: Record<string, string> = {
      'AU': 'local',      // Australia - requires Australian address
      'GB': 'any',        // UK - requires any address
      'DE': 'local',      // Germany - requires German address
      'FR': 'local',      // France - requires French address
      'ES': 'local',      // Spain - requires Spanish address
      'IT': 'local',      // Italy - requires Italian address
      'NL': 'any',        // Netherlands - requires any address
      'BE': 'local',      // Belgium - requires Belgian address
      'AT': 'local',      // Austria - requires Austrian address
      'CH': 'local',      // Switzerland - requires Swiss address
      'SE': 'any',        // Sweden - requires any address
      'NO': 'any',        // Norway - requires any address
      'DK': 'any',        // Denmark - requires any address
      'FI': 'any',        // Finland - requires any address
      'IE': 'any',        // Ireland - requires any address
      'NZ': 'local',      // New Zealand - requires NZ address
      'JP': 'local',      // Japan - requires Japanese address
      'SG': 'local',      // Singapore - requires local address
      'HK': 'local',      // Hong Kong - requires local address
      // Countries that don't require address
      'US': 'none',
      'CA': 'none',
    };
    
    return addressRequirements[isoCountry] || 'none';
  }

  /**
   * Get phone number pricing from Twilio Pricing API
   * Returns purchase price and monthly price for a phone number based on its country and type
   */
  async getPhoneNumberPricing(phoneNumber: string): Promise<{ purchasePrice: string; monthlyPrice: string; priceUnit: string }> {
    if (this.shouldMock) {
      console.log("Mock mode: Returning mock pricing");
      return {
        purchasePrice: '1.00',
        monthlyPrice: '1.15',
        priceUnit: 'USD'
      };
    }

    try {
      const client = await this.getTwilioClientInstance();
      
      // Determine country from phone number (default to US)
      // Format: +1 (US), +44 (UK), +61 (AU), etc.
      let isoCountry = 'US';
      if (phoneNumber.startsWith('+1')) {
        isoCountry = 'US';
      } else if (phoneNumber.startsWith('+44')) {
        isoCountry = 'GB';
      } else if (phoneNumber.startsWith('+61')) {
        isoCountry = 'AU';
      }
      // Add more country mappings as needed

      // Determine phone number type (local, toll-free, mobile)
      // US toll-free: +1 (800|888|877|866|855|844|833)
      let numberType = 'local';
      if (isoCountry === 'US' && /^\+1(800|888|877|866|855|844|833)/.test(phoneNumber)) {
        numberType = 'toll free';
      }

      console.log(`💰 [Pricing] Fetching pricing for ${isoCountry} ${numberType} number`);

      // Fetch pricing from Twilio Pricing API v1 (correct version for phone numbers)
      const pricingData: any = await client.pricing.v1
        .phoneNumbers
        .countries(isoCountry)
        .fetch();

      console.log(`📋 [Pricing] Received pricing data for ${isoCountry}:`, JSON.stringify(pricingData, null, 2));

      // Twilio Node SDK transforms REST API fields from snake_case to camelCase
      // So phoneNumberPrices array contains: { numberType, basePrice, currentPrice }
      const priceInfo = pricingData.phoneNumberPrices?.find(
        (price: any) => price.numberType?.toLowerCase() === numberType.toLowerCase()
      );

      if (!priceInfo) {
        console.warn(`⚠️ [Pricing] No pricing found for "${numberType}" in ${isoCountry}`);
        console.warn(`Available types:`, pricingData.phoneNumberPrices?.map((p: any) => p.numberType || p.number_type));
        return {
          purchasePrice: '1.00',
          monthlyPrice: '1.15',
          priceUnit: (pricingData.priceUnit as string)?.toUpperCase() || 'USD'
        };
      }

      // Twilio phone numbers charge the full monthly price on purchase (no separate purchase fee)
      // The monthly price is the MRC (Monthly Recurring Charge)
      const monthlyPrice = priceInfo.currentPrice || priceInfo.basePrice || '1.15';
      
      console.log(`✅ [Pricing] ${isoCountry} ${numberType}: $${monthlyPrice}/${pricingData.priceUnit}`);

      return {
        purchasePrice: monthlyPrice, // First month charged on purchase
        monthlyPrice: monthlyPrice,
        priceUnit: (pricingData.priceUnit as string)?.toUpperCase() || 'USD'
      };
    } catch (error: any) {
      console.error('❌ [Pricing] Failed to fetch pricing from Twilio:', error.message);
      // Return default US pricing on error
      return {
        purchasePrice: '1.00',
        monthlyPrice: '1.15',
        priceUnit: 'USD'
      };
    }
  }

  /**
   * Configure voice webhook for an existing phone number
   * This is useful for fixing phone numbers that were purchased without webhook configuration
   */
  async configurePhoneWebhook(sid: string): Promise<void> {
    if (this.shouldMock) {
      console.log("Mock mode: Simulating webhook configuration");
      return;
    }
    
    // Get domain for webhook URL - use /incoming for receiving calls
    const domain = getDomain();
    const voiceWebhookUrl = `${domain}/api/webhooks/twilio/incoming`;
    
    // Mask SID in logs (show last 8 chars only)
    const maskedSid = `***${sid.slice(-8)}`;
    console.log(`📞 [Webhook Config] Configuring webhook for SID ${maskedSid}: ${voiceWebhookUrl}`);
    
    const client = await this.getTwilioClientInstance();
    
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: voiceWebhookUrl,
      voiceMethod: 'POST',
      voiceFallbackUrl: voiceWebhookUrl,
      voiceFallbackMethod: 'POST',
    });
    
    console.log(`✅ [Webhook Config] Webhook configured successfully for SID ${maskedSid}`);
  }

  /**
   * Configure phone number to route incoming calls to ElevenLabs native integration
   * This is used when a phone number is assigned to an incoming agent
   */
  async configurePhoneWebhookForElevenLabs(sid: string, phoneNumber: string): Promise<void> {
    if (this.shouldMock) {
      console.log("Mock mode: Simulating ElevenLabs webhook configuration");
      return;
    }
    
    // ElevenLabs native Twilio inbound endpoint
    const elevenLabsInboundUrl = 'https://api.elevenlabs.io/twilio/inbound_call';
    
    // Mask SID in logs (show last 8 chars only)
    const maskedSid = `***${sid.slice(-8)}`;
    console.log(`📞 [Twilio Config] Configuring ElevenLabs native inbound for SID ${maskedSid}`);
    
    const client = await this.getTwilioClientInstance();
    
    // Step 1: Set regional routing to US1 via Twilio Routes API
    // This ensures Twilio routes the call to US region where ElevenLabs config exists
    // Note: If no explicit route exists, Twilio defaults to us1, so 404 is acceptable
    try {
      console.log(`📞 [Twilio Routes] Setting voice region to 'us1' for ${phoneNumber}`);
      await client.routes.v2.phoneNumbers(phoneNumber).update({
        voiceRegion: 'us1'
      });
      console.log(`✅ [Twilio Routes] Voice region set to 'us1'`);
    } catch (routeError: any) {
      // Routes API may return 404 if no explicit routing exists - this means it defaults to us1
      // which is what we want, so we can safely ignore this error
      if (routeError.status === 404) {
        console.log(`📞 [Twilio Routes] No explicit route exists - defaulting to 'us1' (OK)`);
      } else {
        console.warn(`⚠️ [Twilio Routes] Could not set voice region: ${routeError.message}`);
        // Continue anyway - the webhook config is more important
      }
    }
    
    // Step 2: Configure the webhook URL to point to ElevenLabs endpoint
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: elevenLabsInboundUrl,
      voiceMethod: 'POST',
      voiceFallbackUrl: elevenLabsInboundUrl,
      voiceFallbackMethod: 'POST',
    });
    
    console.log(`✅ [Twilio Config] ElevenLabs native inbound configured for SID ${maskedSid}`);
  }

  /**
   * Clear webhook configuration from phone number
   * This is used when an incoming connection is deleted - the number goes back to having no call handling
   */
  async clearPhoneWebhook(sid: string): Promise<void> {
    if (this.shouldMock) {
      console.log("Mock mode: Simulating webhook removal");
      return;
    }
    
    // Mask SID in logs (show last 8 chars only)
    const maskedSid = `***${sid.slice(-8)}`;
    console.log(`📞 [Twilio Config] Clearing webhook for SID ${maskedSid}`);
    
    const client = await this.getTwilioClientInstance();
    
    // Set voice URL to empty string to clear the webhook
    await client.incomingPhoneNumbers(sid).update({
      voiceUrl: '',
      voiceFallbackUrl: '',
    });
    
    console.log(`✅ [Twilio Config] Webhook cleared for SID ${maskedSid}`);
  }

  async makeCall(params: {
    from: string;
    to: string;
    url: string;
  }): Promise<{ callSid: string }> {
    // Handle mock call in mock mode
    if (this.shouldMock) {
      console.log("Mock mode: Simulating outbound call", params);
      return { callSid: `CA_MOCK_${Date.now()}` };
    }
    
    // Use real Twilio connector
    const client = await this.getTwilioClientInstance();
    
    const call = await client.calls.create({
      from: params.from,
      to: params.to,
      url: params.url,
    });

    return { callSid: call.sid };
  }

  /**
   * Fetch detailed call information from Twilio by call SID
   * Returns phone numbers, duration, status, and recording URL
   */
  async getCallDetails(callSid: string): Promise<{
    sid: string;
    from: string;
    to: string;
    status: string;
    direction: 'inbound' | 'outbound-api' | 'outbound-dial';
    duration: number | null;
    startTime: Date | null;
    endTime: Date | null;
    recordingUrl: string | null;
  } | null> {
    if (this.shouldMock) {
      console.log("Mock mode: Returning mock call details");
      return {
        sid: callSid,
        from: '+15551234567',
        to: '+15559876543',
        status: 'completed',
        direction: 'inbound',
        duration: 120,
        startTime: new Date(),
        endTime: new Date(),
        recordingUrl: null
      };
    }

    try {
      const client = await this.getTwilioClientInstance();
      
      // Fetch the call details
      const call = await client.calls(callSid).fetch();
      
      // Also try to get the recording
      let recordingUrl: string | null = null;
      try {
        const recordings = await client.recordings.list({
          callSid: callSid,
          limit: 1
        });
        if (recordings.length > 0) {
          recordingUrl = `https://api.twilio.com${recordings[0].uri.replace('.json', '')}`;
        }
      } catch (recError: any) {
        console.warn(`⚠️ Could not fetch recording for call ${callSid}: ${recError.message}`);
      }

      return {
        sid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        direction: call.direction as 'inbound' | 'outbound-api' | 'outbound-dial',
        duration: call.duration ? parseInt(call.duration, 10) : null,
        startTime: call.startTime ? new Date(call.startTime) : null,
        endTime: call.endTime ? new Date(call.endTime) : null,
        recordingUrl
      };
    } catch (error: any) {
      console.error(`❌ Error fetching call details for ${callSid}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch recordings for a call by Twilio call SID
   */
  async getCallRecordings(callSid: string): Promise<Array<{
    sid: string;
    duration: number;
    url: string;
  }>> {
    if (this.shouldMock) {
      console.log("Mock mode: Returning mock recordings");
      return [];
    }

    try {
      const client = await this.getTwilioClientInstance();
      const recordings = await client.recordings.list({
        callSid: callSid,
        limit: 10
      });

      return recordings.map((rec: any) => ({
        sid: rec.sid,
        duration: parseInt(rec.duration, 10) || 0,
        url: `https://api.twilio.com${rec.uri.replace('.json', '')}`
      }));
    } catch (error: any) {
      console.error(`❌ Error fetching recordings for ${callSid}: ${error.message}`);
      return [];
    }
  }
}

export const twilioService = new TwilioService();
