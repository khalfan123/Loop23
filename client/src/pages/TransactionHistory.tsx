import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Receipt, Loader2, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "wouter";
import { AuthStorage } from "@/lib/auth-storage";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  type: string;
  gateway: string;
  amount: string;
  currency: string;
  description: string;
  status: string;
  planName: string | null;
  packageName: string | null;
  hasInvoice: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null;
  hasRefund: boolean;
  refundId: string | null;
  refundNoteNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface TransactionHistoryResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface TransactionHistoryProps {
  embedded?: boolean;
}

export default function TransactionHistory({ embedded = false }: TransactionHistoryProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [downloadingRefundNote, setDownloadingRefundNote] = useState<string | null>(null);
  const limit = 10;
  
  const { data, isLoading, isError } = useQuery<TransactionHistoryResponse>({
    queryKey: ['/api/transactions/history', { limit, offset: page * limit }],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      
      const response = await fetch(`/api/transactions/history?limit=${limit}&offset=${page * limit}`, {
        headers,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      return response.json();
    },
  });

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber?: string) => {
    setDownloadingInvoice(invoiceId);
    try {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      
      const response = await fetch(`/api/invoices/${invoiceId}/download`, {
        headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to download invoice' }));
        throw new Error(error.message || 'Failed to download invoice');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('transactionHistory.invoiceDownloaded'),
        description: t('transactionHistory.invoiceDownloadedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('transactionHistory.downloadFailed'),
        description: error.message || 'Failed to download invoice',
        variant: 'destructive',
      });
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleDownloadRefundNote = async (refundId: string, refundNoteNumber?: string) => {
    setDownloadingRefundNote(refundId);
    try {
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      
      const response = await fetch(`/api/refunds/${refundId}/download`, {
        headers,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to download refund note' }));
        throw new Error(error.message || 'Failed to download refund note');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RefundNote-${refundNoteNumber || refundId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('transactionHistory.refundNoteDownloaded'),
        description: t('transactionHistory.refundNoteDownloadedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('transactionHistory.downloadFailed'),
        description: error.message || 'Failed to download refund note',
        variant: 'destructive',
      });
    } finally {
      setDownloadingRefundNote(null);
    }
  };

  const formatCurrency = (amount: string, currency: string) => {
    const currencySymbols: Record<string, string> = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'BRL': 'R$',
      'NGN': '₦', 'GHS': '₵', 'ZAR': 'R', 'MXN': '$', 'ARS': '$',
    };
    const symbol = currencySymbols[currency] || currency + ' ';
    return `${symbol}${parseFloat(amount).toFixed(2)}`;
  };

  const getGatewayLabel = (gateway: string) => {
    const labels: Record<string, string> = {
      'stripe': 'Stripe',
      'razorpay': 'Razorpay',
      'paypal': 'PayPal',
      'paystack': 'Paystack',
      'mercadopago': 'MercadoPago',
    };
    return labels[gateway] || gateway;
  };

  const totalPages = data ? Math.ceil(data.pagination.total / limit) : 0;

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-card border border-border p-8 text-center">
        <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">{t('transactionHistory.errorTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('transactionHistory.errorDescription')}</p>
      </div>
    );
  }

  const transactions = data?.transactions || [];

  const getStatusDot = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-emerald-500",
      pending: "bg-amber-500",
      failed: "bg-red-500",
      refunded: "bg-slate-400",
    };
    return (
      <div className="flex items-center gap-1.5">
        <div className={`h-1.5 w-1.5 rounded-full ${colors[status] || "bg-slate-400"}`} />
        <span className="text-xs text-muted-foreground capitalize">{status}</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {!embedded && (
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">{t('transactionHistory.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('transactionHistory.subtitle')}</p>
          </div>
          <Link href="/app/billing">
            <Button variant="outline" size="sm" data-testid="button-back-to-billing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('transactionHistory.backToBilling')}
            </Button>
          </Link>
        </div>
      )}

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">{t('transactionHistory.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('transactionHistory.emptyDescription')}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-4 py-3.5 flex items-center gap-3" data-testid={`row-transaction-${tx.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{tx.description}</span>
                      {tx.type === 'subscription' && tx.planName && (
                        <span className="text-xs text-muted-foreground">{tx.planName}</span>
                      )}
                      {tx.type === 'credit_purchase' && tx.packageName && (
                        <span className="text-xs text-muted-foreground">{tx.packageName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tx.createdAt), 'MMM d, yyyy')}
                      </span>
                      <span className="text-xs text-muted-foreground">{getGatewayLabel(tx.gateway)}</span>
                      {getStatusDot(tx.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(tx.hasInvoice && tx.invoiceId) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadInvoice(tx.invoiceId!, tx.invoiceNumber || undefined)}
                        disabled={downloadingInvoice === tx.invoiceId}
                        data-testid={`button-download-invoice-${tx.id}`}
                      >
                        {downloadingInvoice === tx.invoiceId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                    {(tx.hasRefund && tx.refundId) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadRefundNote(tx.refundId!, tx.refundNoteNumber || undefined)}
                        disabled={downloadingRefundNote === tx.refundId}
                        data-testid={`button-download-refund-note-${tx.id}`}
                      >
                        {downloadingRefundNote === tx.refundId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                    <span className="text-sm font-mono font-semibold tabular-nums min-w-[80px] text-right">
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">
                  {t('transactionHistory.pagination', { 
                    start: page * limit + 1, 
                    end: Math.min((page + 1) * limit, data?.pagination.total || 0),
                    total: data?.pagination.total || 0 
                  })}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-previous-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data?.pagination.hasMore}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
