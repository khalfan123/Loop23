'use strict';

import { db } from '../../../server/db';
import { tcxcCredentials } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

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

  private static async makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> {
    const credential = await this.getActiveCredential();
    if (!credential) {
      throw new Error('No TCXC credentials configured');
    }

    const baseUrl = credential.apiEndpoint || 'https://api.telecomxchange.com';
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Login': credential.apiLogin,
      'X-API-Key': credential.apiKey,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TCXC API error: ${response.status} - ${errorText}`);
    }

    return response.json();
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
        apiEndpoint: params.apiEndpoint || 'https://api.telecomxchange.com',
        isPrimary: params.isPrimary ?? false,
        isActive: true,
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

      await this.makeRequest('/v1/account/balance');
      
      await db
        .update(tcxcCredentials)
        .set({ 
          healthStatus: 'healthy', 
          lastHealthCheck: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tcxcCredentials.id, credential.id));

      return { success: true, message: 'Connection successful' };
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
}
