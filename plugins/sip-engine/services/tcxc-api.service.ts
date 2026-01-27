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
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'QA', name: 'Qatar' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
];

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
      if (options.prefix) formData.prefix = options.prefix;
      if (options.country) formData.country = options.country;
      if (options.seller) formData.seller = options.seller;
      formData.voice = options.voice !== false ? '1' : '0';
      formData.sms = options.sms ? '1' : '0';
      formData.fax = '0';
      formData.video = '0';
      formData.did_type = options.didType || 'any';
      formData.pager = String(options.limit || 20);
      formData.off = String(options.offset || 1);

      const response = await this.makeRequest('/number/market', 'POST', formData);
      
      if (response && Array.isArray(response.dids)) {
        return response.dids;
      }
      if (response && Array.isArray(response)) {
        return response;
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
}
