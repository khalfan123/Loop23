import { db } from "../../../server/db";
import { tcxcCredentials } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
const GCC_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", prefix: "966" },
  { code: "AE", name: "United Arab Emirates", prefix: "971" },
  { code: "KW", name: "Kuwait", prefix: "965" },
  { code: "QA", name: "Qatar", prefix: "974" },
  { code: "BH", name: "Bahrain", prefix: "973" },
  { code: "OM", name: "Oman", prefix: "968" },
  { code: "GB", name: "United Kingdom", prefix: "44" },
  { code: "SE", name: "Sweden", prefix: "46" },
  { code: "PL", name: "Poland", prefix: "48" },
  { code: "NZ", name: "New Zealand", prefix: "64" }
];
const COUNTRY_CODE_TO_PREFIX = {
  "SA": "966",
  "AE": "971",
  "KW": "965",
  "QA": "974",
  "BH": "973",
  "OM": "968",
  "US": "1",
  "GB": "44",
  "DE": "49",
  "FR": "33",
  "AU": "61",
  "CA": "1",
  "SE": "46",
  "PL": "48",
  "NZ": "64"
};
class TcxcApiService {
  static async getActiveCredential() {
    const [credential] = await db.select().from(tcxcCredentials).where(and(eq(tcxcCredentials.isActive, true), eq(tcxcCredentials.isPrimary, true))).limit(1);
    if (credential) return credential;
    const [anyActive] = await db.select().from(tcxcCredentials).where(eq(tcxcCredentials.isActive, true)).limit(1);
    return anyActive || null;
  }
  static generateDigestAuth(username, password, method, uri, realm, nonce, nc, cnonce, qop) {
    const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
    const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
    const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  }
  static async makeRequest(endpoint, method = "GET", body) {
    const credential = await this.getActiveCredential();
    if (!credential) {
      throw new Error("No TCXC credentials configured");
    }
    const baseUrl = credential.apiEndpoint || "https://apiv2.telecomsxchange.com";
    const url = `${baseUrl}${endpoint}`;
    const uri = endpoint;
    const initialResponse = await fetch(url, { method });
    if (initialResponse.status === 401) {
      const authHeader = initialResponse.headers.get("www-authenticate");
      if (!authHeader || !authHeader.toLowerCase().startsWith("digest")) {
        throw new Error("TCXC API requires Digest Authentication but did not return proper challenge");
      }
      const realmMatch = authHeader.match(/realm="([^"]+)"/);
      const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
      const qopMatch = authHeader.match(/qop="([^"]+)"/);
      const realm = realmMatch ? realmMatch[1] : "";
      const nonce = nonceMatch ? nonceMatch[1] : "";
      const qop = qopMatch ? qopMatch[1].split(",")[0].trim() : "auth";
      const nc = "00000001";
      const cnonce = crypto.randomBytes(8).toString("hex");
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
      const headers = {
        "Authorization": authValue,
        "Content-Type": body ? "application/x-www-form-urlencoded" : "application/json"
      };
      const response = await fetch(url, {
        method,
        headers,
        body: body ? new URLSearchParams(body).toString() : void 0
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TCXC API error: ${response.status} - ${errorText}`);
      }
      return response.json();
    }
    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      throw new Error(`TCXC API error: ${initialResponse.status} - ${errorText}`);
    }
    return initialResponse.json();
  }
  static async getAllCredentials() {
    return db.select().from(tcxcCredentials);
  }
  static async getCredentialById(id) {
    const [credential] = await db.select().from(tcxcCredentials).where(eq(tcxcCredentials.id, id)).limit(1);
    return credential || null;
  }
  static async createCredential(params) {
    if (params.isPrimary) {
      await db.update(tcxcCredentials).set({ isPrimary: false }).where(eq(tcxcCredentials.isPrimary, true));
    }
    const [credential] = await db.insert(tcxcCredentials).values({
      name: params.name,
      apiLogin: params.apiLogin,
      apiKey: params.apiKey,
      apiEndpoint: params.apiEndpoint || "https://apiv2.telecomsxchange.com",
      isPrimary: params.isPrimary ?? false,
      isActive: true,
      techPrefixes: params.techPrefixes || [],
      connectionType: params.connectionType || "tcxc",
      sipServer: params.sipServer,
      sipPort: params.sipPort
    }).returning();
    return credential;
  }
  static async updateCredential(id, updates) {
    if (updates.isPrimary) {
      await db.update(tcxcCredentials).set({ isPrimary: false }).where(eq(tcxcCredentials.isPrimary, true));
    }
    const [updated] = await db.update(tcxcCredentials).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(tcxcCredentials.id, id)).returning();
    return updated || null;
  }
  static async deleteCredential(id) {
    const result = await db.delete(tcxcCredentials).where(eq(tcxcCredentials.id, id));
    return true;
  }
  static async testConnection() {
    try {
      const credential = await this.getActiveCredential();
      if (!credential) {
        return { success: false, message: "No TCXC credentials configured" };
      }
      await this.makeRequest("/sellers/toproutes?type=CLI&number=1&period=today", "GET");
      await db.update(tcxcCredentials).set({
        healthStatus: "healthy",
        lastHealthCheck: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(tcxcCredentials.id, credential.id));
      return { success: true, message: "Connection successful - TCXC API verified" };
    } catch (error) {
      const credential = await this.getActiveCredential();
      if (credential) {
        await db.update(tcxcCredentials).set({
          healthStatus: "unhealthy",
          lastHealthCheck: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(tcxcCredentials.id, credential.id));
      }
      return { success: false, message: error.message };
    }
  }
  static async getAvailableDids(options) {
    try {
      const params = new URLSearchParams();
      if (options?.countryCode) params.append("country", options.countryCode);
      if (options?.type) params.append("type", options.type);
      if (options?.limit) params.append("limit", options.limit.toString());
      if (options?.offset) params.append("offset", options.offset.toString());
      const queryString = params.toString();
      const endpoint = `/v1/dids/available${queryString ? `?${queryString}` : ""}`;
      const response = await this.makeRequest(endpoint);
      return response.dids || [];
    } catch (error) {
      console.error("[TCXC] Get available DIDs error:", error.message);
      return [];
    }
  }
  static async getGccDids() {
    const allDids = [];
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
  static async getMyDids() {
    try {
      const response = await this.makeRequest("/v1/dids/my");
      return response.dids || [];
    } catch (error) {
      console.error("[TCXC] Get my DIDs error:", error.message);
      return [];
    }
  }
  static async getInterconnections() {
    try {
      const response = await this.makeRequest("/v1/interconnections");
      return response.interconnections || [];
    } catch (error) {
      console.error("[TCXC] Get interconnections error:", error.message);
      return [];
    }
  }
  /**
   * Get purchased outbound routes from TCXC
   * Calls GET /buyer/purchased_routes to fetch all purchased routes with tech prefixes
   */
  static async getPurchasedRoutes() {
    try {
      let response = null;
      const endpointsToTry = [
        { endpoint: "/interconnections/list", method: "POST", body: { list: "1" } },
        { endpoint: "/buyers/interconnect", method: "POST", body: { list: "1" } },
        { endpoint: "/buyers/interconnections", method: "GET", body: null },
        { endpoint: "/buyers/routes", method: "GET", body: null },
        { endpoint: "/interconnect/list", method: "POST", body: {} }
      ];
      for (const { endpoint, method, body } of endpointsToTry) {
        try {
          console.log(`[TCXC] Trying ${method} ${endpoint}...`);
          response = await this.makeRequest(endpoint, method, body);
          console.log(`[TCXC] ${endpoint} response:`, JSON.stringify(response).substring(0, 500));
          if (response && typeof response === "object" && !response.toString().includes("<!DOCTYPE")) {
            break;
          }
        } catch (e) {
          console.log(`[TCXC] ${endpoint} failed:`, e.message?.substring(0, 100));
          continue;
        }
      }
      if (!response) {
        console.log("[TCXC] All endpoints failed to return purchased routes");
        return [];
      }
      const routes = [];
      const purchasedRoutes = response?.interconnections || response?.purchased_routes || response?.routes || response?.connections || response?.data || (Array.isArray(response) ? response : []);
      if (Array.isArray(purchasedRoutes)) {
        for (const route of purchasedRoutes) {
          routes.push({
            connectionName: route.connection_name || route.carrier_name || route.name || route.account_name || "",
            techPrefix: route.tech_prefix || route.techprefix || route.prefix || "",
            accountName: route.account_name || route.carrier_name || route.vendor_name || route.seller_name || "",
            tariffId: route.i_tariff || route.tariff_id || route.i_rate || 0,
            connectionId: route.i_connection || route.connection_id || route.i_purchased_route || 0,
            vendorId: route.i_vendor || route.vendor_id || 0,
            vendorName: route.vendor_name || route.carrier_name || route.seller_name || route.account_name || "",
            blocked: route.blocked === 1 || route.blocked === true || route.status === "blocked",
            status: route.blocked ? "blocked" : "active",
            routeType: route.route_type || route.type || "CLI",
            destination: route.destination || route.country_name || route.billing_prefix || "",
            ratePerMinute: parseFloat(route.price || route.rate || route.price_1 || "0")
          });
        }
      }
      console.log("[TCXC] Parsed purchased routes:", routes.length);
      return routes;
    } catch (error) {
      console.error("[TCXC] Get purchased routes error:", error.message);
      return [];
    }
  }
  static async purchaseDid(didId) {
    try {
      const response = await this.makeRequest("/v1/dids/purchase", "POST", { did_id: didId });
      return { success: true, phoneNumber: response.phone_number };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  static getGccCountries() {
    return GCC_COUNTRIES;
  }
  static async searchMarketplaceDids(options) {
    try {
      const formData = {};
      let phonePrefix = options.prefix;
      if (options.prefix && options.prefix.length <= 3 && /^[A-Z]{2}$/.test(options.prefix.toUpperCase())) {
        phonePrefix = COUNTRY_CODE_TO_PREFIX[options.prefix.toUpperCase()] || options.prefix;
      }
      if (phonePrefix) formData.prefix = phonePrefix;
      if (options.seller) formData.seller = options.seller;
      formData.voice = options.voice !== false ? "1" : "0";
      formData.sms = options.sms ? "1" : "0";
      formData.fax = "0";
      formData.video = "0";
      formData.did_type = options.didType || "any";
      formData.pager = String(options.limit || 50);
      formData.off = String(options.offset || 1);
      console.log("[TCXC] Marketplace search params:", formData);
      const response = await this.makeRequest("/number/market", "POST", formData);
      console.log("[TCXC] Marketplace search response:", JSON.stringify(response).substring(0, 500));
      const normalizeDid = (raw) => ({
        i_did: raw.i_did || 0,
        did: raw.number || raw.msisdn || raw.did || "",
        description: raw.description || raw.type || "",
        country: raw.country || "",
        country_code: raw.country_code || raw.country || "",
        seller: raw.vendor_name || raw.seller || "Unknown",
        seller_id: raw.i_vendor || raw.seller_id || 0,
        price_per_minute: parseFloat(raw.price_1) || parseFloat(raw.price_per_minute) || 0,
        monthly_fee: parseFloat(raw.monthly_fee) || 0,
        setup_fee: parseFloat(raw.setup_fee) || 0,
        currency: raw.currency || "USD",
        voice: raw.voice === 1 || raw.voice === true,
        sms: raw.sms === 1 || raw.sms === true,
        fax: raw.fax === 1 || raw.fax === true,
        video: raw.video === 1 || raw.video === true,
        did_type: raw.did_type || raw.type || "national",
        capacity: raw.capacity || 0
      });
      if (response && Array.isArray(response.dids)) {
        return response.dids.map(normalizeDid);
      }
      if (response && Array.isArray(response)) {
        return response.map(normalizeDid);
      }
      return [];
    } catch (error) {
      console.error("[TCXC] Search marketplace DIDs error:", error.message);
      return [];
    }
  }
  static async rentMarketplaceDid(iDid, billingAccountId, sipContact) {
    try {
      const formData = {
        i_did: String(iDid),
        billing_i_account: String(billingAccountId),
        contact: sipContact
      };
      const response = await this.makeRequest("/number/purchase", "POST", formData);
      if (response && response.did) {
        return { success: true, did: response.did };
      }
      if (response && response.success) {
        return { success: true };
      }
      return { success: false, error: "Unknown response from TCXC API" };
    } catch (error) {
      console.error("[TCXC] Rent marketplace DID error:", error.message);
      return { success: false, error: error.message };
    }
  }
  static async getSellerList() {
    try {
      const response = await this.makeRequest("/sellers/list", "GET");
      if (response && Array.isArray(response.sellers)) {
        return response.sellers;
      }
      return [];
    } catch (error) {
      console.error("[TCXC] Get seller list error:", error.message);
      return [];
    }
  }
  /**
   * Search Market View for voice termination rates
   * This searches available rates from all sellers for a specific destination prefix
   */
  static async searchMarketRates(params) {
    try {
      const formBody = {
        prefix: params.prefix,
        searchform: "1",
        type: params.routeType || "any",
        pager: String(params.limit || 50),
        off: "0"
      };
      if (params.seller) {
        formBody.seller = params.seller;
      }
      console.log("[TCXC] Market View search params:", {
        prefix: params.prefix,
        type: params.routeType || "any",
        seller: params.seller,
        limit: params.limit || 50
      });
      const response = await this.makeRequest("/marketview/search", "POST", formBody);
      console.log("[TCXC] Market View response status:", response?.status);
      if (response?.status === "success" && Array.isArray(response.rates)) {
        console.log("[TCXC] Market View found", response.rates.length, "rates");
        return response.rates.map((rate) => ({
          prefix: rate.prefix || "",
          vendorName: rate.vendor_name || "",
          connectionName: rate.connection_name || "",
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
          routeType: rate.route_type || "CLI",
          countryCode: rate.country_code || "",
          countryName: rate.country_name || "",
          description: rate.description || "",
          capacity: parseInt(rate.capacity_limit) || 0,
          sellerRating: parseFloat(rate.seller_avg_rating) || 0,
          sellerReviews: parseInt(rate.seller_reviews) || 0
        }));
      }
      return [];
    } catch (error) {
      console.error("[TCXC] Market View search error:", error.message);
      return [];
    }
  }
  static async getRoutes() {
    try {
      const response = await this.makeRequest("/sellers/toproutes?type=CLI&number=100&period=today", "GET");
      if (response && Array.isArray(response.routes)) {
        return response.routes.map((route) => ({
          destination: route.destination || route.country_name || "",
          prefix: route.prefix || route.destination_code || "",
          country: route.country_code || route.country || "",
          seller: route.seller_name || route.vendor_name || "",
          sellerId: route.i_vendor || route.seller_id || 0,
          ratePerMinute: parseFloat(route.rate || route.price_1 || "0"),
          currency: route.currency || "USD",
          quality: route.quality || route.asr || "unknown",
          routeType: route.route_type || "CLI"
        }));
      }
      const credentials = await this.getAllCredentials();
      const routes = [];
      for (const cred of credentials.filter((c) => c.isActive)) {
        if (cred.techPrefixes && cred.techPrefixes.length > 0) {
          for (const prefix of cred.techPrefixes) {
            routes.push({
              destination: cred.name,
              prefix,
              country: "",
              seller: cred.name,
              sellerId: 0,
              ratePerMinute: 0,
              currency: "USD",
              quality: cred.healthStatus || "unknown",
              routeType: cred.connectionType || "tcxc"
            });
          }
        }
      }
      return routes;
    } catch (error) {
      console.error("[TCXC] Get routes error:", error.message);
      const credentials = await this.getAllCredentials();
      const routes = [];
      for (const cred of credentials.filter((c) => c.isActive)) {
        if (cred.techPrefixes && cred.techPrefixes.length > 0) {
          for (const prefix of cred.techPrefixes) {
            routes.push({
              destination: cred.name,
              prefix,
              country: "",
              seller: cred.name,
              sellerId: 0,
              ratePerMinute: 0,
              currency: "USD",
              quality: cred.healthStatus || "unknown",
              routeType: cred.connectionType || "tcxc"
            });
          }
        }
      }
      return routes;
    }
  }
  /**
   * HLR Lookup - Validate and get information about a phone number
   * Used to verify destination numbers before making outbound calls
   */
  static async hlrLookup(phoneNumber) {
    try {
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
      console.log("[TCXC] HLR Lookup for:", cleanNumber);
      const response = await this.makeRequest(`/sellers/hlr/lookup/${cleanNumber}`, "POST");
      if (response?.status === "success" && response.response) {
        const r = response.response;
        return {
          success: true,
          data: {
            internationalFormat: r.international_format_number || cleanNumber,
            nationalFormat: r.national_format_number || "",
            countryCode: r.country_code || "",
            countryName: r.country_name || "",
            countryPrefix: r.country_prefix || "",
            currentCarrier: {
              networkCode: r.current_carrier?.network_code || "",
              name: r.current_carrier?.name || "Unknown",
              country: r.current_carrier?.country || "",
              networkType: r.current_carrier?.network_type || ""
            },
            originalCarrier: {
              networkCode: r.original_carrier?.network_code || "",
              name: r.original_carrier?.name || "Unknown",
              country: r.original_carrier?.country || "",
              networkType: r.original_carrier?.network_type || ""
            },
            ported: r.ported || "unknown",
            roaming: {
              status: r.roaming?.status || "unknown"
            }
          }
        };
      }
      return { success: false, error: response?.message || "HLR lookup failed" };
    } catch (error) {
      console.error("[TCXC] HLR Lookup error:", error.message);
      return { success: false, error: error.message };
    }
  }
}
export {
  TcxcApiService
};
