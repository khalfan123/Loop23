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
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Loader2, Star, CreditCard, Sparkles, ArrowRight, Globe, Download, Calendar, AlertCircle, Coins, TrendingUp, ArrowUpRight, Clock, FileText } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearch } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditPurchaseDialog } from "@/components/CreditPurchaseDialog";
import { useTranslation } from 'react-i18next';
import TransactionHistory from "@/pages/TransactionHistory";
import { useBranding } from "@/components/BrandingProvider";
import { SiStripe, SiRazorpay, SiPaypal } from "react-icons/si";

const PaystackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 4h20v3H2V4zm0 6h20v3H2v-3zm0 6h14v3H2v-3z"/>
  </svg>
);

const MercadoPagoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6z"/>
  </svg>
);

type GatewayType = 'stripe' | 'razorpay' | 'paypal' | 'paystack' | 'mercadopago';

const PLAN_TIER_ORDER: Record<string, number> = {
  'free': 0,
  'pro': 1,
  'enterprise': 2,
};

const getPlanChangeType = (currentPlanName: string, targetPlanName: string): 'upgrade' | 'downgrade' | 'same' => {
  const currentTier = PLAN_TIER_ORDER[currentPlanName.toLowerCase()] ?? 0;
  const targetTier = PLAN_TIER_ORDER[targetPlanName.toLowerCase()] ?? 1;
  if (targetTier > currentTier) return 'upgrade';
  if (targetTier < currentTier) return 'downgrade';
  return 'same';
};

interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  gateways: GatewayType[];
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string | null;
  razorpayMonthlyPrice: string | null;
  razorpayYearlyPrice: string | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  razorpayPlanId: string | null;
  razorpayYearlyPlanId: string | null;
  maxAgents: number;
  maxCampaigns: number;
  maxContactsPerCampaign: number;
  maxWebhooks: number;
  maxKnowledgeBases: number;
  maxFlows: number;
  maxPhoneNumbers: number;
  canChooseLlm: boolean;
  canPurchaseNumbers: boolean;
  includedCredits: number;
  features: any;
  sipEnabled?: boolean;
  restApiEnabled?: boolean;
}

interface PluginCapabilities {
  data?: {
    capabilities?: {
      [key: string]: boolean;
    };
  };
}

interface UserSubscription {
  id: string;
  planId: string;
  stripeSubscriptionId: string | null;
  razorpaySubscriptionId: string | null;
  paypalSubscriptionId: string | null;
  paystackSubscriptionCode: string | null;
  paystackEmailToken: string | null;
  mercadopagoSubscriptionId: string | null;
  status: string;
  billingPeriod: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
}

interface User {
  id: string;
  email: string;
  name: string;
  planType: string;
  credits: number;
  planId: string | null;
}

interface PaymentGatewayConfig {
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  paypalEnabled: boolean;
  paystackEnabled: boolean;
  mercadopagoEnabled: boolean;
  razorpayKeyId?: string;
  stripePublicKey?: string;
  stripeCurrency?: string;
  stripeCurrencySymbol?: string;
  stripeCurrencyLocked?: boolean;
  paypalClientId?: string;
  paypalCurrency?: string;
  paypalCurrencySymbol?: string;
  paypalMode?: string;
  paystackPublicKey?: string;
  paystackCurrency?: string;
  paystackCurrencySymbol?: string;
  paystackCurrencies?: string[];
  paystackDefaultCurrency?: string;
  mercadopagoPublicKey?: string;
  mercadopagoCurrency?: string;
  mercadopagoCurrencySymbol?: string;
  mercadopagoCurrencies?: string[];
}

interface RazorpayConfig {
  enabled: boolean;
  keyId: string | null;
}

interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price: string;
  razorpayPrice: string | null;
  paypalPrice: string | null;
  paystackPrice: string | null;
  mercadopagoPrice: string | null;
  isActive: boolean;
  stripePriceId: string | null;
}

interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
  stripePaymentId: string | null;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PlanBillingPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { branding } = useBranding();
  const searchString = useSearch();

  const [activeSection, setActiveSection] = useState("plans");

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [processingGateway, setProcessingGateway] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<GatewayType | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const sections = [
    { id: "plans", label: "Plans", icon: Crown },
    { id: "credit-packages", label: "Credit Packages", icon: TrendingUp },
    { id: "credit-records", label: "Credit Records", icon: FileText },
  ];

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<UserSubscription | null>({
    queryKey: ["/api/user-subscription"],
  });

  const { data: paymentGateway } = useQuery<PaymentGatewayConfig>({
    queryKey: ["/api/settings/payment-gateway"],
  });

  const { data: razorpayConfig } = useQuery<RazorpayConfig>({
    queryKey: ["/api/razorpay/config"],
  });

  const { data: pluginCapabilities } = useQuery<PluginCapabilities>({
    queryKey: ["/api/plugins/capabilities"],
  });

  const { data: packages, isLoading: packagesLoading } = useQuery<CreditPackage[]>({
    queryKey: ["/api/credit-packages"],
  });

  const { data: creditTransactions, isLoading: creditTransactionsLoading } = useQuery<CreditTransaction[]>({
    queryKey: ["/api/credit-transactions"],
  });

  const sipPluginEnabled = pluginCapabilities?.data?.capabilities?.['sip-engine'] ?? false;
  const restApiPluginEnabled = pluginCapabilities?.data?.capabilities?.['rest-api'] ?? false;

  const razorpayEnabled = paymentGateway?.razorpayEnabled && razorpayConfig?.keyId;

  const currencySymbols: Record<string, string> = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'C$', 'AUD': 'A$',
    'JPY': '¥', 'INR': '₹', 'BRL': 'R$', 'MXN': '$', 'CHF': 'CHF',
    'NGN': '₦', 'GHS': '₵', 'ZAR': 'R', 'KES': 'KSh',
    'ARS': '$', 'CLP': '$', 'COP': '$', 'PEN': 'S/', 'UYU': '$'
  };

  const currencyNames: Record<string, string> = {
    'USD': 'US Dollar', 'EUR': 'Euro', 'GBP': 'British Pound', 'CAD': 'Canadian Dollar',
    'AUD': 'Australian Dollar', 'JPY': 'Japanese Yen', 'INR': 'Indian Rupee',
    'BRL': 'Brazilian Real', 'MXN': 'Mexican Peso', 'CHF': 'Swiss Franc',
    'NGN': 'Nigerian Naira', 'GHS': 'Ghanaian Cedi', 'ZAR': 'South African Rand',
    'KES': 'Kenyan Shilling', 'ARS': 'Argentine Peso', 'CLP': 'Chilean Peso',
    'COP': 'Colombian Peso', 'PEN': 'Peruvian Sol', 'UYU': 'Uruguayan Peso'
  };

  const buildAvailableCurrencies = (): CurrencyOption[] => {
    if (!paymentGateway) return [];
    const currencyMap = new Map<string, GatewayType[]>();
    if (paymentGateway.stripeEnabled && paymentGateway.stripeCurrency) {
      const curr = paymentGateway.stripeCurrency.toUpperCase();
      currencyMap.set(curr, [...(currencyMap.get(curr) || []), 'stripe']);
    }
    if (paymentGateway.razorpayEnabled) {
      currencyMap.set('INR', [...(currencyMap.get('INR') || []), 'razorpay']);
    }
    if (paymentGateway.paypalEnabled && paymentGateway.paypalCurrency) {
      const curr = paymentGateway.paypalCurrency.toUpperCase();
      currencyMap.set(curr, [...(currencyMap.get(curr) || []), 'paypal']);
    }
    if (paymentGateway.paystackEnabled && paymentGateway.paystackCurrency) {
      const curr = paymentGateway.paystackCurrency.toUpperCase();
      currencyMap.set(curr, [...(currencyMap.get(curr) || []), 'paystack']);
    }
    if (paymentGateway.mercadopagoEnabled && paymentGateway.mercadopagoCurrency) {
      const curr = paymentGateway.mercadopagoCurrency.toUpperCase();
      currencyMap.set(curr, [...(currencyMap.get(curr) || []), 'mercadopago']);
    }
    return Array.from(currencyMap.entries()).map(([code, gateways]) => ({
      code,
      symbol: currencySymbols[code] || code,
      name: currencyNames[code] || code,
      gateways
    }));
  };

  const getGatewaysForCurrency = (currencyCode: string): GatewayType[] => {
    const currencies = buildAvailableCurrencies();
    const currency = currencies.find(c => c.code === currencyCode);
    return currency?.gateways || [];
  };

  const getGatewayForCurrency = (currencyCode: string): GatewayType | null => {
    const currencies = buildAvailableCurrencies();
    const currency = currencies.find(c => c.code === currencyCode);
    if (!currency || currency.gateways.length === 0) return null;
    if (currency.gateways.includes('stripe')) return 'stripe';
    return currency.gateways[0];
  };

  const getGatewayInfo = (gateway: GatewayType): { icon: React.ComponentType<{ className?: string }>; name: string; recommended?: boolean } => {
    const info: Record<GatewayType, { icon: React.ComponentType<{ className?: string }>; name: string; recommended?: boolean }> = {
      stripe: { icon: SiStripe, name: 'Stripe', recommended: true },
      razorpay: { icon: SiRazorpay, name: 'Razorpay' },
      paypal: { icon: SiPaypal, name: 'PayPal' },
      paystack: { icon: PaystackIcon, name: 'Paystack' },
      mercadopago: { icon: MercadoPagoIcon, name: 'MercadoPago' },
    };
    return info[gateway];
  };

  const getPlanPrice = (plan: Plan, currencyCode: string, period: "monthly" | "yearly"): { price: string; symbol: string } => {
    const gateway = getGatewayForCurrency(currencyCode);
    const symbol = currencySymbols[currencyCode] || '$';
    if (gateway === 'razorpay') {
      const price = period === "yearly" ? plan.razorpayYearlyPrice : plan.razorpayMonthlyPrice;
      return { price: price || (period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) || "0", symbol };
    }
    return {
      price: (period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) || "0",
      symbol
    };
  };

  const getDisplayPrice = (plan: Plan, period: "monthly" | "yearly") => {
    const price = period === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    const symbol = paymentGateway?.stripeCurrencySymbol || "$";
    return price ? `${symbol}${parseFloat(price).toFixed(2)}` : "N/A";
  };

  const getPackagePrice = (pkg: CreditPackage, currencyCode: string): { price: string; symbol: string } => {
    const gateway = getGatewayForCurrency(currencyCode);
    const symbol = currencySymbols[currencyCode] || '$';
    switch (gateway) {
      case 'razorpay':
        return { price: pkg.razorpayPrice || pkg.price, symbol };
      case 'paypal':
        return { price: pkg.paypalPrice || pkg.price, symbol };
      case 'paystack':
        return { price: pkg.paystackPrice || pkg.price, symbol };
      case 'mercadopago':
        return { price: pkg.mercadopagoPrice || pkg.price, symbol };
      default:
        return { price: pkg.price, symbol: paymentGateway?.stripeCurrencySymbol || '$' };
    }
  };

  useEffect(() => {
    if (!paymentGateway?.razorpayEnabled) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [paymentGateway?.razorpayEnabled]);

  useEffect(() => {
    if (paymentGateway) {
      const currencies = buildAvailableCurrencies();
      if (currencies.length > 0) {
        const stripeCurrencyOption = currencies.find(c => c.gateways.includes('stripe'));
        const defaultCurrencyOption = stripeCurrencyOption || currencies[0];
        const currencyCode = defaultCurrencyOption?.code || 'USD';
        setSelectedCurrency(currencyCode);
        const gateways = defaultCurrencyOption?.gateways || [];
        if (gateways.length > 0) {
          setSelectedGateway(gateways.includes('stripe') ? 'stripe' : gateways[0]);
        }
      } else {
        setSelectedCurrency('USD');
      }
    }
  }, [paymentGateway]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get('tab');
    if (tab === 'credits') setActiveSection('credit-records');
    else if (tab === 'packages') setActiveSection('credit-packages');
    else if (tab) setActiveSection(tab);
  }, [searchString]);

  useEffect(() => {
    const handlePaymentRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const stripeSessionId = params.get('session_id');
      const stripeSuccess = params.get('success');
      const paypalSubscription = params.get('paypal_subscription');
      const paypalSubscriptionId = params.get('subscription_id');
      const paystackSubscription = params.get('paystack_subscription');
      const paystackCredits = params.get('paystack_credits');
      const mercadopago = params.get('mercadopago');
      const mercadopagoSubscription = params.get('mercadopago_subscription');
      const mercadopagoPreapprovalId = params.get('preapproval_id');
      const reference = params.get('reference');
      const packageId = params.get('package_id');
      const planId = params.get('plan_id');
      const billingPeriodParam = params.get('billing_period');
      const paymentId = params.get('payment_id');

      const clearUrlParams = () => {
        window.history.replaceState({}, '', window.location.pathname);
      };

      try {
        if (stripeSuccess === 'true' && stripeSessionId) {
          const response = await apiRequest("POST", "/api/stripe/verify-session", { sessionId: stripeSessionId });
          if (response.ok) {
            toast({ title: t('billing.toast.paymentSuccess'), description: t('billing.toast.paymentSuccessDesc') });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user-subscription"] });
            queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions"] });
          }
          clearUrlParams();
        } else if (paystackSubscription === 'success' && reference) {
          const response = await apiRequest("POST", "/api/paystack/verify-subscription", { reference });
          if (response.ok) {
            toast({ title: t('billing.toast.subscriptionSuccess'), description: t('billing.toast.subscriptionSuccessDesc') });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user-subscription"] });
          }
          clearUrlParams();
        } else if (paystackCredits === 'success' && reference && packageId) {
          const response = await apiRequest("POST", "/api/paystack/verify-credits", { reference, packageId });
          if (response.ok) {
            toast({ title: t('billing.toast.paymentSuccess'), description: t('billing.toast.paymentSuccessDesc') });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions"] });
          }
          clearUrlParams();
        } else if (mercadopago === 'success' && paymentId) {
          const response = await apiRequest("POST", "/api/mercadopago/verify-payment", { paymentId });
          if (response.ok) {
            toast({ title: t('billing.toast.paymentSuccess'), description: t('billing.toast.paymentSuccessDesc') });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions"] });
          }
          clearUrlParams();
        } else if (mercadopagoSubscription === 'success' && mercadopagoPreapprovalId && planId) {
          const response = await apiRequest("POST", "/api/mercadopago/confirm-subscription", {
            subscriptionId: mercadopagoPreapprovalId,
            planId,
            billingPeriod: billingPeriodParam || 'monthly',
          });
          if (response.ok) {
            toast({ title: t('billing.toast.subscriptionSuccess'), description: t('billing.toast.subscriptionSuccessDesc') });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user-subscription"] });
          } else {
            const error = await response.json();
            throw new Error(error.error || 'Subscription confirmation failed');
          }
          clearUrlParams();
        } else if (paypalSubscription === 'success' && paypalSubscriptionId && planId) {
          const response = await apiRequest("POST", "/api/paypal/confirm-subscription", {
            subscriptionId: paypalSubscriptionId,
            planId,
            billingPeriod: billingPeriodParam || 'monthly',
          });
          if (response.ok) {
            toast({ title: t('billing.toast.subscriptionSuccess'), description: t('billing.toast.subscriptionSuccessDesc') });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user-subscription"] });
          } else {
            const error = await response.json();
            throw new Error(error.error || 'Subscription confirmation failed');
          }
          clearUrlParams();
        } else if (mercadopago === 'failed' || mercadopago === 'pending') {
          toast({
            title: mercadopago === 'pending' ? 'Payment Pending' : 'Payment Failed',
            description: mercadopago === 'pending' ? 'Your payment is being processed.' : 'Your payment could not be completed.',
            variant: mercadopago === 'failed' ? 'destructive' : 'default',
          });
          clearUrlParams();
        }
      } catch (error: any) {
        console.error('Payment verification error:', error);
        toast({ title: 'Verification Failed', description: error.message || 'Could not verify your payment. Please contact support.', variant: 'destructive' });
        clearUrlParams();
      }
    };
    handlePaymentRedirect();
  }, []);


  const stripeCheckout = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: string }) => {
      const response = await apiRequest("POST", "/api/stripe/create-checkout-session", { type: "subscription", planId, billingPeriod });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }
      return response.json();
    },
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
    onError: (error: any) => {
      toast({ title: "Checkout Failed", description: error.message, variant: "destructive" });
      setProcessingGateway(null);
    },
  });

  const razorpaySubscription = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: string }) => {
      const response = await apiRequest("POST", "/api/razorpay/create-subscription", { planId, billingPeriod });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create subscription");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (!window.Razorpay || !razorpayLoaded) {
        toast({ title: "Razorpay Not Loaded", description: "Please wait a moment and try again", variant: "destructive" });
        setProcessingGateway(null);
        return;
      }
      const options = {
        key: razorpayConfig?.keyId || paymentGateway?.razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: branding.app_name || '',
        description: `${selectedPlan?.displayName} - ${billingPeriod === "yearly" ? "Yearly" : "Monthly"}`,
        handler: async function (response: any) {
          try {
            const verifyResponse = await apiRequest("POST", "/api/razorpay/verify-subscription", {
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verifyResponse.ok) {
              toast({ title: "Subscription Active", description: "Your subscription has been activated successfully!" });
              window.location.href = "/app/settings/billing?success=true";
            } else {
              const error = await verifyResponse.json();
              throw new Error(error.error || "Verification failed");
            }
          } catch (error: any) {
            toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
          }
          setProcessingGateway(null);
          setShowPaymentDialog(false);
        },
        modal: { ondismiss: function () { setProcessingGateway(null); } },
        prefill: { email: user?.email, name: user?.name },
        theme: { color: "#6366f1" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    onError: (error: any) => {
      toast({ title: "Subscription Failed", description: error.message, variant: "destructive" });
      setProcessingGateway(null);
    },
  });

  const paypalSubscription = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: string }) => {
      const response = await apiRequest("POST", "/api/paypal/create-subscription", { planId, billingPeriod });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create PayPal subscription");
      }
      return response.json();
    },
    onSuccess: (data) => { if (data.approvalUrl) window.location.href = data.approvalUrl; },
    onError: (error: any) => {
      toast({ title: "Subscription Failed", description: error.message, variant: "destructive" });
      setProcessingGateway(null);
    },
  });

  const paystackSubscription = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: string }) => {
      const response = await apiRequest("POST", "/api/paystack/create-subscription", { planId, billingPeriod });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create Paystack subscription");
      }
      return response.json();
    },
    onSuccess: (data) => { if (data.authorizationUrl) window.location.href = data.authorizationUrl; },
    onError: (error: any) => {
      toast({ title: "Subscription Failed", description: error.message, variant: "destructive" });
      setProcessingGateway(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      let endpoint: string;
      if (subscription?.razorpaySubscriptionId) {
        endpoint = "/api/razorpay/cancel-subscription";
      } else if (subscription?.paypalSubscriptionId) {
        endpoint = "/api/paypal/cancel-subscription";
      } else if (subscription?.paystackSubscriptionCode) {
        endpoint = "/api/paystack/cancel-subscription";
      } else if (subscription?.mercadopagoSubscriptionId) {
        endpoint = "/api/mercadopago/cancel-subscription";
      } else {
        endpoint = "/api/stripe/cancel-subscription";
      }
      const response = await apiRequest("POST", endpoint);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('billing.subscriptionCancelled'), description: t('billing.subscriptionCancelledMessage') });
      setCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user-subscription"] });
    },
    onError: (error: any) => {
      toast({ title: t('billing.cancelFailed'), description: error.message, variant: "destructive" });
    },
  });

  const handleUpgradeClick = (plan: Plan) => {
    setSelectedPlan(plan);
    setBillingPeriod("monthly");
    const currencies = buildAvailableCurrencies();
    if (currencies.length > 0) {
      const defaultCurrency = currencies[0];
      setSelectedCurrency(defaultCurrency.code);
      const gateways = defaultCurrency.gateways;
      if (gateways.includes('stripe')) {
        setSelectedGateway('stripe');
      } else {
        setSelectedGateway(gateways[0] || null);
      }
    }
    setShowPaymentDialog(true);
  };

  const handleProceedToPayment = () => {
    if (!selectedPlan || !selectedGateway) return;
    setProcessingGateway(selectedGateway);
    switch (selectedGateway) {
      case 'stripe':
        stripeCheckout.mutate({ planId: selectedPlan.id, billingPeriod });
        break;
      case 'razorpay':
        if (!razorpayLoaded) {
          toast({ title: "Payment Gateway Loading", description: "Razorpay is still loading. Please try again.", variant: "destructive" });
          setProcessingGateway(null);
          return;
        }
        razorpaySubscription.mutate({ planId: selectedPlan.id, billingPeriod });
        break;
      case 'paypal':
        paypalSubscription.mutate({ planId: selectedPlan.id, billingPeriod });
        break;
      case 'paystack':
        paystackSubscription.mutate({ planId: selectedPlan.id, billingPeriod });
        break;
    }
  };

  const handlePurchaseCredits = (packageId: string) => {
    setSelectedPackageId(packageId);
    setPurchaseDialogOpen(true);
  };

  const handlePurchaseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/credit-transactions"] });
  };

  const handleExportTransactions = () => {
    window.open("/api/credit-transactions/export", "_blank");
  };

  if (userLoading || plansLoading || subscriptionLoading || packagesLoading || creditTransactionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlanName = subscription?.plan?.name || user?.planType || "free";
  const currentPlan = subscription?.plan || plans?.find((p) => p.name === currentPlanName);
  const sortedPlans = [...(plans || [])].sort((a, b) => {
    if (a.name === "free") return -1;
    if (b.name === "free") return 1;
    return parseFloat(a.monthlyPrice) - parseFloat(b.monthlyPrice);
  });

  const isPremium = currentPlanName !== "free";
  const currentBalance = user?.credits || 0;
  const hasActiveSubscription = subscription && subscription.status === "active";
  const displaySymbol = currencySymbols[selectedCurrency] || paymentGateway?.stripeCurrencySymbol || "$";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeSection === section.id
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid={`tab-${section.id}`}
          >
            <section.icon className="h-3.5 w-3.5" />
            {section.label}
            {activeSection === section.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
        ))}
      </div>

      {activeSection === "plans" && (
        <div className="space-y-6">
          {buildAvailableCurrencies().length > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-[140px]" data-testid="select-currency">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {buildAvailableCurrencies().map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
            <div className={`grid grid-cols-1 ${sortedPlans.length === 2 ? "md:grid-cols-2" : sortedPlans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"} gap-4`}>
              {sortedPlans.map((plan, index) => {
                const isCurrentPlan = currentPlanName === plan.name;
                const isFree = plan.name === "free";
                const isRecommended = !isFree && index === 1;
                const planChangeType = getPlanChangeType(currentPlanName, plan.name);
                const monthlyPriceInfo = getPlanPrice(plan, selectedCurrency, "monthly");
                const yearlyPriceInfo = getPlanPrice(plan, selectedCurrency, "yearly");
                const monthlyPrice = `${monthlyPriceInfo.symbol}${monthlyPriceInfo.price}`;
                const yearlyPrice = yearlyPriceInfo.price !== "0" ? `${yearlyPriceInfo.symbol}${yearlyPriceInfo.price}` : null;
                const yearlySavings = monthlyPriceInfo.price && yearlyPriceInfo.price !== "0"
                  ? (parseFloat(monthlyPriceInfo.price) * 12 - parseFloat(yearlyPriceInfo.price)).toFixed(0)
                  : null;

                return (
                  <div
                    key={plan.id}
                    className={`relative overflow-hidden rounded-xl bg-card border border-border transition-all duration-200 ${
                      isCurrentPlan ? "ring-2 ring-primary" : isRecommended && !isCurrentPlan ? "ring-1 ring-border" : ""
                    }`}
                    data-testid={`card-plan-${plan.name}`}
                  >
                    {isRecommended && !isCurrentPlan && (
                      <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-medium py-1.5 text-center">
                        <Crown className="h-3 w-3 inline mr-1" />
                        Most Popular
                      </div>
                    )}
                    <div className={`p-6 space-y-6 ${isRecommended && !isCurrentPlan ? "pt-10" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
                            {isFree ? <Zap className="h-4 w-4 text-muted-foreground" /> : <Crown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <h2 className="text-xl font-bold text-foreground">{plan.displayName}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>

                      <div className="pb-4 border-b border-border">
                        {isFree ? (
                          <>
                            <div className="text-3xl font-bold text-foreground">Free</div>
                            <p className="text-sm text-muted-foreground">Forever</p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold text-foreground">{monthlyPrice}</span>
                              <span className="text-muted-foreground text-sm">/month</span>
                            </div>
                            {yearlyPrice && yearlySavings && (
                              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                                Save {monthlyPriceInfo.symbol}{yearlySavings}/year
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="space-y-3">
                        {plan.maxAgents === -1 ? (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm font-medium">Unlimited AI Agents</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">{plan.maxAgents} AI Agent{plan.maxAgents > 1 ? "s" : ""}</span>
                          </div>
                        )}
                        {plan.maxCampaigns === -1 ? (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm font-medium">Unlimited Campaigns</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">{plan.maxCampaigns} Campaign{plan.maxCampaigns > 1 ? "s" : ""}</span>
                          </div>
                        )}
                        {plan.maxContactsPerCampaign === -1 ? (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm font-medium">Unlimited Contacts</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">Max {plan.maxContactsPerCampaign} contacts</span>
                          </div>
                        )}
                        {plan.canPurchaseNumbers && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">Own phone numbers</span>
                          </div>
                        )}
                        {plan.canChooseLlm && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">Choose your LLM</span>
                          </div>
                        )}
                        {plan.maxFlows !== undefined && plan.maxFlows > 0 && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">
                              {plan.maxFlows >= 999 ? "Unlimited" : plan.maxFlows} Flow Automation{plan.maxFlows !== 1 && plan.maxFlows < 999 ? "s" : ""}
                            </span>
                          </div>
                        )}
                        {plan.maxKnowledgeBases !== undefined && plan.maxKnowledgeBases > 0 && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">
                              {plan.maxKnowledgeBases >= 999 ? "Unlimited" : plan.maxKnowledgeBases} Knowledge Base{plan.maxKnowledgeBases !== 1 && plan.maxKnowledgeBases < 999 ? "s" : ""}
                            </span>
                          </div>
                        )}
                        {plan.maxWebhooks !== undefined && plan.maxWebhooks > 0 && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">
                              {plan.maxWebhooks >= 999 ? "Unlimited" : plan.maxWebhooks} Webhook{plan.maxWebhooks !== 1 && plan.maxWebhooks < 999 ? "s" : ""}
                            </span>
                          </div>
                        )}
                        {plan.maxPhoneNumbers !== undefined && plan.maxPhoneNumbers > 0 && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">
                              {plan.maxPhoneNumbers >= 999 ? "Unlimited" : plan.maxPhoneNumbers} Phone Number{plan.maxPhoneNumbers !== 1 && plan.maxPhoneNumbers < 999 ? "s" : ""}
                            </span>
                          </div>
                        )}
                        {plan.includedCredits > 0 && (
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium">{plan.includedCredits} included credits</span>
                          </div>
                        )}
                        {!isFree && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">Priority support</span>
                          </div>
                        )}
                        {sipPluginEnabled && plan.sipEnabled && !isFree && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">SIP Trunk Access</span>
                          </div>
                        )}
                        {restApiPluginEnabled && plan.restApiEnabled && !isFree && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm">REST API Access</span>
                          </div>
                        )}
                      </div>

                      <Button
                        variant={isCurrentPlan ? "outline" : isFree ? "outline" : "default"}
                        className="w-full"
                        disabled={isCurrentPlan || isFree}
                        onClick={() => !isCurrentPlan && !isFree && handleUpgradeClick(plan)}
                        data-testid={`button-select-${plan.name}`}
                      >
                        {isCurrentPlan ? (
                          "Current Plan"
                        ) : isFree ? (
                          "Free Tier"
                        ) : planChangeType === 'downgrade' ? (
                          <>Downgrade<ArrowRight className="h-4 w-4 ml-2" /></>
                        ) : (
                          <>Upgrade<ArrowRight className="h-4 w-4 ml-2" /></>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      )}

      {activeSection === "credit-packages" && (
        <div className="space-y-6">
          {packages && packages.length > 0 && (
            <div>
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                {packages.map((pkg, index) => {
                  const priceInfo = getPackagePrice(pkg, selectedCurrency);
                  const displayPrice = parseFloat(priceInfo.price);
                  const pkgCurrencySymbol = priceInfo.symbol;
                  const isPopular = index === 1;

                  return (
                    <div
                      key={pkg.id}
                      className={`p-4 flex items-center justify-between gap-4 flex-wrap ${index < packages.length - 1 ? "border-b border-border" : ""}`}
                      data-testid={`card-package-${pkg.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <Coins className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{pkg.name}</h4>
                            {isPopular && (
                              <Badge size="sm">
                                <Sparkles className="h-3 w-3 mr-1" />
                                {t('billing.popular')}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pkg.credits.toLocaleString()} credits
                            {pkg.description && ` · ${pkg.description}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold">
                            {pkgCurrencySymbol}{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pkgCurrencySymbol}{(displayPrice / pkg.credits).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {t('billing.perMinute')}
                          </div>
                        </div>
                        <Button
                          variant={isPopular ? "default" : "outline"}
                          onClick={() => handlePurchaseCredits(pkg.id)}
                          disabled={!hasActiveSubscription || !!loadingCheckout}
                          data-testid={`button-buy-${pkg.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {loadingCheckout === `package-${pkg.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {t('billing.purchase')}
                              <ArrowUpRight className="h-4 w-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {subscription && hasActiveSubscription && !subscription.cancelAtPeriodEnd && subscription.plan.name !== "free" && (subscription.stripeSubscriptionId || subscription.razorpaySubscriptionId || subscription.paypalSubscriptionId || subscription.paystackSubscriptionCode || subscription.mercadopagoSubscriptionId) && (
            <div>
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">{t('billing.subscriptionPeriod') || 'Subscription Period'}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-background p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">{t('billing.startDate') || 'Start Date'}</span>
                      </div>
                      <div className="text-xl font-bold" data-testid="text-subscription-start-date">
                        {subscription.currentPeriodStart ? format(new Date(subscription.currentPeriodStart), 'MMM dd, yyyy') : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {subscription.currentPeriodStart ? formatDistanceToNow(new Date(subscription.currentPeriodStart), { addSuffix: true }) : ''}
                      </div>
                    </div>
                    <div className="rounded-xl bg-background p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">{t('billing.renewalDate') || 'Renewal Date'}</span>
                      </div>
                      <div className="text-xl font-bold" data-testid="text-subscription-end-date">
                        {subscription.currentPeriodEnd ? format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy') : '-'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {subscription.currentPeriodEnd ? formatDistanceToNow(new Date(subscription.currentPeriodEnd), { addSuffix: true }) : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setCancelDialogOpen(true)}
                      data-testid="button-cancel-subscription"
                    >
                      {t('billing.cancelSubscription')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === "credit-records" && (
        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTransactions}
              data-testid="button-export-transactions"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('billing.exportCSV')}
            </Button>
          </div>

          <div className="rounded-xl bg-card border border-border overflow-hidden" data-testid="card-credit-records">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('billing.credit')} & {t('billing.debit')}</span>
              </div>
            </div>
            {creditTransactions && creditTransactions.length > 0 ? (
              <div className="divide-y divide-border">
                {[...creditTransactions]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((transaction) => (
                  <div key={transaction.id} className="px-4 py-3.5 flex items-center gap-3" data-testid={`row-credit-${transaction.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{transaction.description}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-1.5 w-1.5 rounded-full ${transaction.type === "credit" ? "bg-emerald-500" : "bg-red-500"}`} />
                          <span className="text-xs text-muted-foreground capitalize">{transaction.type === "credit" ? t('billing.credit') : t('billing.debit')}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-mono font-semibold tabular-nums ${transaction.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {transaction.type === "credit" ? "+" : "-"}{Math.abs(transaction.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('billing.noTransactions')}</p>
              </div>
            )}
          </div>

          <div>
            <TransactionHistory embedded />
          </div>
        </div>
      )}

      <Dialog open={showPaymentDialog && selectedPlan !== null} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          {selectedPlan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscribe to {selectedPlan.displayName}
                </DialogTitle>
                <DialogDescription>
                  Choose your currency, payment method, and billing period
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {buildAvailableCurrencies().length > 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Currency
                    </label>
                    <Select
                      value={selectedCurrency}
                      onValueChange={(v) => {
                        setSelectedCurrency(v);
                        const gateways = getGatewaysForCurrency(v);
                        if (gateways.length > 0 && (!selectedGateway || !gateways.includes(selectedGateway))) {
                          setSelectedGateway(gateways.includes('stripe') ? 'stripe' : gateways[0]);
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buildAvailableCurrencies().map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedCurrency && getGatewaysForCurrency(selectedCurrency).length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      {getGatewaysForCurrency(selectedCurrency).map((gateway) => {
                        const info = getGatewayInfo(gateway);
                        const Icon = info.icon;
                        return (
                          <Button
                            key={gateway}
                            type="button"
                            variant={selectedGateway === gateway ? 'default' : 'outline'}
                            className={`h-14 flex flex-col items-center justify-center gap-1 relative ${
                              selectedGateway === gateway ? '' : 'hover-elevate'
                            }`}
                            onClick={() => setSelectedGateway(gateway)}
                            data-testid={`button-gateway-${gateway}`}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs">{info.name}</span>
                            {info.recommended && selectedGateway !== gateway && (
                              <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5">
                                Recommended
                              </Badge>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Billing Period</label>
                  <Select value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as "monthly" | "yearly")}>
                    <SelectTrigger data-testid="select-billing-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">
                        Monthly - {(() => {
                          const { price, symbol } = getPlanPrice(selectedPlan, selectedCurrency, "monthly");
                          return `${symbol}${parseFloat(price).toFixed(2)}`;
                        })()}/month
                      </SelectItem>
                      {selectedPlan.yearlyPrice && (
                        <SelectItem value="yearly">
                          Yearly - {(() => {
                            const { price, symbol } = getPlanPrice(selectedPlan, selectedCurrency, "yearly");
                            return `${symbol}${parseFloat(price).toFixed(2)}`;
                          })()}/year
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold">
                      {(() => {
                        const { price, symbol } = getPlanPrice(selectedPlan, selectedCurrency, billingPeriod);
                        return `${symbol}${parseFloat(price).toFixed(2)}`;
                      })()}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{billingPeriod === "yearly" ? "year" : "month"}
                      </span>
                    </span>
                  </div>
                  {selectedGateway && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      {(() => {
                        const info = getGatewayInfo(selectedGateway);
                        const Icon = info.icon;
                        return (
                          <>
                            <div className={`rounded p-1 ${
                              selectedGateway === 'stripe' ? 'bg-[#635bff]' :
                              selectedGateway === 'razorpay' ? 'bg-[#072654]' :
                              selectedGateway === 'paypal' ? 'bg-[#003087]' :
                              selectedGateway === 'paystack' ? 'bg-[#00C3F7]' :
                              'bg-muted-foreground'
                            }`}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <span>Secure payment via {info.name}</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!selectedGateway || processingGateway !== null}
                  onClick={handleProceedToPayment}
                  data-testid="button-proceed-payment"
                >
                  {processingGateway ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {selectedGateway && (() => {
                        const Icon = getGatewayInfo(selectedGateway).icon;
                        return <Icon className="h-4 w-4 mr-2" />;
                      })()}
                      Proceed to Payment
                    </>
                  )}
                </Button>

                {!selectedGateway && (
                  <p className="text-xs text-muted-foreground text-center">
                    Please select a payment method to continue.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent data-testid="dialog-cancel-subscription">
          <DialogHeader>
            <DialogTitle>{t('billing.cancelConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('billing.cancelConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              {t('billing.keepSubscription')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('billing.cancelSubscription')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedPackageId && (
        <CreditPurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          packageId={selectedPackageId}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
}
