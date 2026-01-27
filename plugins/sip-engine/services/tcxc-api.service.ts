'use strict';

import { db } from '../../../server/db';
import { tcxcCredentials } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

type TcxcCredential = typeof tcxcCredentials.$inferSelect;

interface TcxcDid {
  id: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  type: string;
  capabilities: string[];
  monthlyPrice: number;
  setupPrice: number;
  currency: string;
  available: boolean;
}

interface TcxcInterconnection {
  id: string;
  name: string;
  status: string;
  type: string;
  destination: string;
  protocol: string;
  port: number;
}

interface TcxcMarketplaceDid {
  i_did: number;
  did: string;
  description: string;
  country: string;
  country_code: string;
  seller: string;
  seller_id: number;
  price_per_minute: number;
  monthly_fee: number;
  setup_fee: number;
  currency: string;
  voice: boolean;
  sms: boolean;
  fax: boolean;
  video: boolean;
  did_type: string;
  capacity: number;
}

const GCC_COUNTRIES = [
  { code: 'SA', name: 'Saudi Arabia', prefix: '966' },
  { code: 'AE', name: 'United Arab Emirates', prefix: '971' },
  { code: 'KW', name: 'Kuwait', prefix: '965' },
  { code: 'QA', name: 'Qatar', prefix: '974' },
  { code: 'BH', name: 'Bahrain', prefix: '973' },
  { code: 'OM', name: 'Oman', prefix: '968' },
];

// Map country codes to phone prefixes for API calls
const COUNTRY_CODE_TO_PREFIX: Record<string, string> = {
  'SA': '966',
  'AE': '971',
  'KW': '965',
  'QA': '974',
  'BH': '973',
  'OM': '968',
  'US': '1',
  'GB': '44',
  'DE': '49',
  'FR': '33',
  'AU': '61',
  'CA': '1',
};

export class TcxcApiService {
  private static async getActiveCredential(): Promise<TcxcCredential | null> {
    const [credential] = await db
      .select()
      .from(tcxcCredentials)
      .where(and(eq(tcxcCredentials.isActive, true), eq(tcxcCredentials.isPrimary, true)))
      .limit(1);
    
    if (credential) return credential;

    const [anyActive] = await db
      .select()
      .from(tcxcCredentials)
      .where(eq(tcxcCredentials.isActive, true))
      .limit(1);
    
    return anyActive || null;
  }

  private static generateDigestAuth(
    username: string,
    password: string,
    method: string,
    uri: string,
    realm: string,
    nonce: string,
    nc: string,
    cnonce: string,
    qop: string
  ): string {
    const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
    const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
    
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  }

  private static async makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    const credential = await this.getActiveCredential();
    if (!credential) {
      throw new Error('No TCXC credentials configured');
    }

    const baseUrl = credential.apiEndpoint || 'https://apiv2.telecomsxchange.com';
    const url = `${baseUrl}${endpoint}`;
    const uri = endpoint;

    // First request to get the WWW-Authenticate header (Digest challenge)
    const initialResponse = await fetch(url, { method });
    
    if (initialResponse.status === 401) {
      const authHeader = initialResponse.headers.get('www-authenticate');
      if (!authHeader || !authHeader.toLowerCase().startsWith('digest')) {
        throw new Error('TCXC API requires Digest Authentication but did not return proper challenge');
      }

      // Parse the Digest challenge
      const realmMatch = authHeader.match(/realm="([^"]+)"/);
      const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
      const qopMatch = authHeader.match(/qop="([^"]+)"/);

      const realm = realmMatch ? realmMatch[1] : '';
      const nonce = nonceMatch ? nonceMatch[1] : '';
      const qop = qopMatch ? qopMatch[1].split(',')[0].trim() : 'auth';

      const nc = '00000001';
      const cnonce = crypto.randomBytes(8).toString('hex');

      const authValue = this.generateDigestAuth(
        credential.apiLogin,
        credential.apiKey,
        method,
        uri,
        realm,
        nonce,
        nc,
        cnonce,
        qop
      );

      const headers: Record<string, string> = {
        'Authorization': authValue,
        'Content-Type': body ? 'application/x-www-form-urlencoded' : 'application/json',
      };

      const response = await fetch(url, {
        method,
        headers,
        body: body ? new URLSearchParams(body).toString() : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TCXC API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    }

    // If we got a successful response without auth challenge
    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      throw new Error(`TCXC API error: ${initialResponse.status} - ${errorText}`);
    }

    return initialResponse.json();
  }

  static async getAllCredentials(): Promise<TcxcCredential[]> {
    return db.select().from(tcxcCredentials);
  }

  static async getCredentialById(id: string): Promise<TcxcCredential | null> {
    const [credential] = await db
      .select()
      .from(tcxcCredentials)
      .where(eq(tcxcCredentials.id, id))
      .limit(1);
    return credential || null;
  }

  static async createCredential(params: {
    name: string;
    apiLogin: string;
    apiKey: string;
    apiEndpoint?: string;
    isPrimary?: boolean;
    techPrefixes?: string[];
    connectionType?: string;
    sipServer?: string;
    sipPort?: number;
  }): Promise<TcxcCredential> {
    if (params.isPrimary) {
      await db
        .update(tcxcCredentials)
        .set({ isPrimary: false })
        .where(eq(tcxcCredentials.isPrimary, true));
    }

    const [credential] = await db
      .insert(tcxcCredentials)
      .values({
        name: params.name,
        apiLogin: params.apiLogin,
        apiKey: params.apiKey,
        apiEndpoint: params.apiEndpoint || 'https://apiv2.telecomsxchange.com',
        isPrimary: params.isPrimary ?? false,
        isActive: true,
        techPrefixes: params.techPrefixes || [],
        connectionType: params.connectionType || 'tcxc',
        sipServer: params.sipServer,
        sipPort: params.sipPort,
      })
      .returning();

    return credential;
  }

  static async updateCredential(
    id: string,
    updates: Partial<{
      name: string;
      apiLogin: string;
      apiKey: string;
      apiEndpoint: string;
      isPrimary: boolean;
      isActive: boolean;
      techPrefixes: string[];
      connectionType: string;
      sipServer: string;
      sipPort: number;
    }>
  ): Promise<TcxcCredential | null> {
    if (updates.isPrimary) {
      await db
        .update(tcxcCredentials)
        .set({ isPrimary: false })
        .where(eq(tcxcCredentials.isPrimary, true));
    }

    const [updated] = await db
      .update(tcxcCredentials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tcxcCredentials.id, id))
      .returning();

    return updated || null;
  }

  static async deleteCredential(id: string): Promise<boolean> {
    const result = await db
      .delete(tcxcCredentials)
      .where(eq(tcxcCredentials.id, id));
    return true;
  }

  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const credential = await this.getActiveCredential();
      if (!credential) {
        return { success: false, message: 'No TCXC credentials configured' };
      }

      // Use the top destinations endpoint as a test - it's available to all users
      await this.makeRequest('/sellers/toproutes?type=CLI&number=1&period=today', 'GET');
      
      await db
        .update(tcxcCredentials)
        .set({ 
          healthStatus: 'healthy', 
          lastHealthCheck: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tcxcCredentials.id, credential.id));

      return { success: true, message: 'Connection successful - TCXC API verified' };
    } catch (error: any) {
      const credential = await this.getActiveCredential();
      if (credential) {
        await db
          .update(tcxcCredentials)
          .set({ 
            healthStatus: 'unhealthy', 
            lastHealthCheck: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tcxcCredentials.id, credential.id));
      }
      return { success: false, message: error.message };
    }
  }

  static async getAvailableDids(options?: {
    countryCode?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<TcxcDid[]> {
    try {
      const params = new URLSearchParams();
      if (options?.countryCode) params.append('country', options.countryCode);
      if (options?.type) params.append('type', options.type);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const queryString = params.toString();
      const endpoint = `/v1/dids/available${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return response.dids || [];
    } catch (error: any) {
      console.error('[TCXC] Get available DIDs error:', error.message);
      return [];
    }
  }

  static async getGccDids(): Promise<TcxcDid[]> {
    const allDids: TcxcDid[] = [];
    
    for (const country of GCC_COUNTRIES) {
      try {
        const dids = await this.getAvailableDids({ countryCode: country.code, limit: 50 });
        allDids.push(...dids);
      } catch (error) {
        console.warn(`[TCXC] Failed to fetch DIDs for ${country.name}:`, error);
      }
    }
    
    return allDids;
  }

  static async getMyDids(): Promise<TcxcDid[]> {
    try {
      const response = await this.makeRequest('/v1/dids/my');
      return response.dids || [];
    } catch (error: any) {
      console.error('[TCXC] Get my DIDs error:', error.message);
      return [];
    }
  }

  static async getInterconnections(): Promise<TcxcInterconnection[]> {
    try {
      const response = await this.makeRequest('/v1/interconnections');
      return response.interconnections || [];
    } catch (error: any) {
      console.error('[TCXC] Get interconnections error:', error.message);
      return [];
    }
  }

  static async purchaseDid(didId: string): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
    try {
      const response = await this.makeRequest('/v1/dids/purchase', 'POST', { did_id: didId });
      return { success: true, phoneNumber: response.phone_number };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static getGccCountries() {
    return GCC_COUNTRIES;
  }

  static async searchMarketplaceDids(options: {
    prefix?: string;
    country?: string;
    seller?: string;
    voice?: boolean;
    sms?: boolean;
    didType?: string;
    limit?: number;
    offset?: number;
  }): Promise<TcxcMarketplaceDid[]> {
    try {
      const formData: Record<string, string> = {};
      
      // Convert country code to phone prefix if it's a 2-letter ISO code
      // The TCXC API expects 'prefix' to be the phone number prefix (e.g., 971 for UAE)
      let phonePrefix = options.prefix;
      if (options.prefix && options.prefix.length <= 3 && /^[A-Z]{2}$/.test(options.prefix.toUpperCase())) {
        // It's a 2-letter country code, convert to phone prefix
        phonePrefix = COUNTRY_CODE_TO_PREFIX[options.prefix.toUpperCase()] || options.prefix;
      }
      
      if (phonePrefix) formData.prefix = phonePrefix;
      // Don't send country as a separate param - the API uses prefix for filtering
      if (options.seller) formData.seller = options.seller;
      formData.voice = options.voice !== false ? '1' : '0';
      formData.sms = options.sms ? '1' : '0';
      formData.fax = '0';
      formData.video = '0';
      formData.did_type = options.didType || 'any';
      formData.pager = String(options.limit || 50);
      formData.off = String(options.offset || 1);

      console.log('[TCXC] Marketplace search params:', formData);
      const response = await this.makeRequest('/number/market', 'POST', formData);
      console.log('[TCXC] Marketplace search response:', JSON.stringify(response).substring(0, 500));
      
      // Normalize the response to match our interface
      const normalizeDid = (raw: any): TcxcMarketplaceDid => ({
        i_did: raw.i_did || 0,
        did: raw.number || raw.msisdn || raw.did || '',
        description: raw.description || raw.type || '',
        country: raw.country || '',
        country_code: raw.country_code || raw.country || '',
        seller: raw.vendor_name || raw.seller || 'Unknown',
        seller_id: raw.i_vendor || raw.seller_id || 0,
        price_per_minute: parseFloat(raw.price_1) || parseFloat(raw.price_per_minute) || 0,
        monthly_fee: parseFloat(raw.monthly_fee) || 0,
        setup_fee: parseFloat(raw.setup_fee) || 0,
        currency: raw.currency || 'USD',
        voice: raw.voice === 1 || raw.voice === true,
        sms: raw.sms === 1 || raw.sms === true,
        fax: raw.fax === 1 || raw.fax === true,
        video: raw.video === 1 || raw.video === true,
        did_type: raw.did_type || raw.type || 'national',
        capacity: raw.capacity || 0,
      });
      
      if (response && Array.isArray(response.dids)) {
        return response.dids.map(normalizeDid);
      }
      if (response && Array.isArray(response)) {
        return response.map(normalizeDid);
      }
      return [];
    } catch (error: any) {
      console.error('[TCXC] Search marketplace DIDs error:', error.message);
      return [];
    }
  }

  static async rentMarketplaceDid(
    iDid: number,
    billingAccountId: number,
    sipContact: string
  ): Promise<{ success: boolean; did?: string; error?: string }> {
    try {
      const formData = {
        i_did: String(iDid),
        billing_i_account: String(billingAccountId),
        contact: sipContact,
      };

      const response = await this.makeRequest('/number/purchase', 'POST', formData);
      
      if (response && response.did) {
        return { success: true, did: response.did };
      }
      if (response && response.success) {
        return { success: true };
      }
      return { success: false, error: 'Unknown response from TCXC API' };
    } catch (error: any) {
      console.error('[TCXC] Rent marketplace DID error:', error.message);
      return { success: false, error: error.message };
    }
  }

  static async getSellerList(): Promise<Array<{ id: number; name: string }>> {
    try {
      const response = await this.makeRequest('/sellers/list', 'GET');
      if (response && Array.isArray(response.sellers)) {
        return response.sellers;
      }
      return [];
    } catch (error: any) {
      console.error('[TCXC] Get seller list error:', error.message);
      return [];
    }
  }

  /**
   * Search Market View for voice termination rates
   * This searches available rates from all sellers for a specific destination prefix
   */
  static async searchMarketRates(params: {
    prefix: string;
    routeType?: 'CLI' | 'NCLI' | 'TDM' | 'any';
    seller?: string;
    limit?: number;
  }): Promise<Array<{
    prefix: string;
    vendorName: string;
    connectionName: string;
    tariffId: number;
    connectionId: number;
    vendorId: number;
    price: number;
    priceN: number;
    interval1: number;
    intervalN: number;
    dailyAsr: number;
    weeklyAsr: number;
    dailyAcd: number;
    weeklyAcd: number;
    dailyMinutes: number;
    weeklyMinutes: number;
    routeType: string;
    countryCode: string;
    countryName: string;
    description: string;
    capacity: number;
    sellerRating: number;
    sellerReviews: number;
  }>> {
    try {
      // Build form data object for makeRequest
      const formBody: Record<string, string> = {
        prefix: params.prefix,
        searchform: '1',
        type: params.routeType || 'any',
        pager: String(params.limit || 50),
        off: '0',
      };
      if (params.seller) {
        formBody.seller = params.seller;
      }

      console.log('[TCXC] Market View search params:', {
        prefix: params.prefix,
        type: params.routeType || 'any',
        seller: params.seller,
        limit: params.limit || 50
      });

      // Use existing makeRequest with POST and form body (it handles Digest Auth)
      const response = await this.makeRequest('/marketview/search', 'POST', formBody);
      
      console.log('[TCXC] Market View response status:', response?.status);

      if (response?.status === 'success' && Array.isArray(response.rates)) {
        console.log('[TCXC] Market View found', response.rates.length, 'rates');
        return response.rates.map((rate: any) => ({
          prefix: rate.prefix || '',
          vendorName: rate.vendor_name || '',
          connectionName: rate.connection_name || '',
          tariffId: parseInt(rate.i_tariff) || 0,
          connectionId: parseInt(rate.i_connection) || 0,
          vendorId: parseInt(rate.i_vendor) || 0,
          price: parseFloat(rate.price_1) || 0,
          priceN: parseFloat(rate.price_n) || 0,
          interval1: parseInt(rate.interval_1) || 1,
          intervalN: parseInt(rate.interval_n) || 1,
          dailyAsr: parseFloat(rate.daily_asr) || 0,
          weeklyAsr: parseFloat(rate.weekly_asr) || 0,
          dailyAcd: parseFloat(rate.daily_acd) || 0,
          weeklyAcd: parseFloat(rate.weekly_acd) || 0,
          dailyMinutes: parseFloat(rate.daily_minutes) || 0,
          weeklyMinutes: parseFloat(rate.weekly_minutes) || 0,
          routeType: rate.route_type || 'CLI',
          countryCode: rate.country_code || '',
          countryName: rate.country_name || '',
          description: rate.description || '',
          capacity: parseInt(rate.capacity_limit) || 0,
          sellerRating: parseFloat(rate.seller_avg_rating) || 0,
          sellerReviews: parseInt(rate.seller_reviews) || 0,
        }));
      }

      return [];
    } catch (error: any) {
      console.error('[TCXC] Market View search error:', error.message);
      return [];
    }
  }

  static async getRoutes(): Promise<Array<{
    destination: string;
    prefix: string;
    country: string;
    seller: string;
    sellerId: number;
    ratePerMinute: number;
    currency: string;
    quality: string;
    routeType: string;
  }>> {
    try {
      // Try to get top routes which shows available destinations
      const response = await this.makeRequest('/sellers/toproutes?type=CLI&number=100&period=today', 'GET');
      
      if (response && Array.isArray(response.routes)) {
        return response.routes.map((route: any) => ({
          destination: route.destination || route.country_name || '',
          prefix: route.prefix || route.destination_code || '',
          country: route.country_code || route.country || '',
          seller: route.seller_name || route.vendor_name || '',
          sellerId: route.i_vendor || route.seller_id || 0,
          ratePerMinute: parseFloat(route.rate || route.price_1 || '0'),
          currency: route.currency || 'USD',
          quality: route.quality || route.asr || 'unknown',
          routeType: route.route_type || 'CLI',
        }));
      }
      
      // If no routes from toproutes, return configured interconnections as routes
      const credentials = await this.getAllCredentials();
      const routes: Array<{
        destination: string;
        prefix: string;
        country: string;
        seller: string;
        sellerId: number;
        ratePerMinute: number;
        currency: string;
        quality: string;
        routeType: string;
      }> = [];
      
      for (const cred of credentials.filter(c => c.isActive)) {
        if (cred.techPrefixes && cred.techPrefixes.length > 0) {
          for (const prefix of cred.techPrefixes) {
            routes.push({
              destination: cred.name,
              prefix: prefix,
              country: '',
              seller: cred.name,
              sellerId: 0,
              ratePerMinute: 0,
              currency: 'USD',
              quality: cred.healthStatus || 'unknown',
              routeType: cred.connectionType || 'tcxc',
            });
          }
        }
      }
      
      return routes;
    } catch (error: any) {
      console.error('[TCXC] Get routes error:', error.message);
      // Return configured interconnections as fallback
      const credentials = await this.getAllCredentials();
      const routes: Array<{
        destination: string;
        prefix: string;
        country: string;
        seller: string;
        sellerId: number;
        ratePerMinute: number;
        currency: string;
        quality: string;
        routeType: string;
      }> = [];
      
      for (const cred of credentials.filter(c => c.isActive)) {
        if (cred.techPrefixes && cred.techPrefixes.length > 0) {
          for (const prefix of cred.techPrefixes) {
            routes.push({
              destination: cred.name,
              prefix: prefix,
              country: '',
              seller: cred.name,
              sellerId: 0,
              ratePerMinute: 0,
              currency: 'USD',
              quality: cred.healthStatus || 'unknown',
              routeType: cred.connectionType || 'tcxc',
            });
          }
        }
      }
      
      return routes;
    }
  }
}
