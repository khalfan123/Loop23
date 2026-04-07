import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingBag,
  Plus,
  Search,
  Pencil,
  Trash2,
  MoreHorizontal,
  Package,
  DollarSign,
  Upload,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileUp,
  Link,
  FileText,
  ClipboardPaste,
  Settings2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Sparkles,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  category?: string | null;
  sku?: string | null;
  availability: string;
  productUrl?: string | null;
  features?: string[] | null;
  metadata?: Record<string, any> | null;
  ragKnowledgeBaseId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const defaultProduct = {
  name: "",
  description: "",
  price: 0,
  currency: "USD",
  category: "",
  sku: "",
  availability: "in_stock",
  productUrl: "",
  features: [] as string[],
};

export default function ProductsInventoryView() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvImportMode, setCsvImportMode] = useState<"paste" | "upload" | "link">("upload");
  const [csvUrl, setCsvUrl] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [featureInput, setFeatureInput] = useState("");
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; phase: string } | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiMappings, setAiMappings] = useState<Record<string, string | null>>({});
  const [csvStep, setCsvStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [aiPreviewItems, setAiPreviewItems] = useState<any[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState<string>("");
  const [bulkUpdateValue, setBulkUpdateValue] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [form, setForm] = useState(defaultProduct);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof defaultProduct) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      resetForm();
      toast({ title: "Product created", description: "Product has been added to your inventory and synced to the AI knowledge base." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof defaultProduct> }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      setEditingProduct(null);
      resetForm();
      toast({ title: "Product updated", description: "Product has been updated and re-synced to the AI knowledge base." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDeleteProductId(null);
      toast({ title: "Product deleted", description: "Product has been removed from inventory and AI knowledge base." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (items: any[]) => {
      setImportProgress({ current: 0, total: items.length, phase: "Validating CSV data..." });

      await new Promise(r => setTimeout(r, 300));
      setImportProgress({ current: 0, total: items.length, phase: "Uploading products..." });

      const BATCH_SIZE = 50;
      let totalImported = 0;
      let totalSkipped = 0;
      const allErrors: any[] = [];
      let processedSoFar = 0;

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        setImportProgress({
          current: processedSoFar,
          total: items.length,
          phase: `Importing products ${i + 1}–${Math.min(i + BATCH_SIZE, items.length)} of ${items.length}...`,
        });

        const res = await apiRequest("POST", "/api/products/bulk-import", { items: batch });
        const data = await res.json();
        totalImported += data.imported || 0;
        totalSkipped += data.skipped || 0;
        if (data.errors) allErrors.push(...data.errors);
        processedSoFar += batch.length;

        setImportProgress({
          current: processedSoFar,
          total: items.length,
          phase: `Imported ${processedSoFar} of ${items.length} products...`,
        });
      }

      setImportProgress({ current: items.length, total: items.length, phase: "Syncing to AI knowledge base..." });
      await new Promise(r => setTimeout(r, 500));

      return { imported: totalImported, skipped: totalSkipped, errors: allErrors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setCsvDialogOpen(false);
      resetCsvDialog();
      toast({ title: "Import complete", description: `${data.imported} products imported successfully.${data.skipped > 0 ? ` ${data.skipped} skipped.` : ''}` });
    },
    onError: (error: any) => {
      setImportProgress(null);
      setCsvStep("preview");
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/products/bulk-delete", { ids });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast({ title: "Bulk delete complete", description: `${data.deleted} products deleted successfully.` });
    },
    onError: (error: any) => {
      toast({ title: "Bulk delete failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, any> }) => {
      const res = await apiRequest("PATCH", "/api/products/bulk-update", { ids, updates });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds(new Set());
      setBulkUpdateOpen(false);
      setBulkUpdateField("");
      setBulkUpdateValue("");
      toast({ title: "Bulk update complete", description: `${data.updated} products updated successfully.` });
    },
    onError: (error: any) => {
      toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setForm(defaultProduct);
    setFeatureInput("");
    setEditingProduct(null);
  }

  function openCreateDialog() {
    resetForm();
    setProductDialogOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      currency: product.currency,
      category: product.category || "",
      sku: product.sku || "",
      availability: product.availability,
      productUrl: product.productUrl || "",
      features: product.features || [],
    });
    setProductDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Validation error", description: "Product name is required.", variant: "destructive" });
      return;
    }
    if (form.price < 0) {
      toast({ title: "Validation error", description: "Price must be a positive number.", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      price: Number(form.price),
      features: form.features.length > 0 ? form.features : undefined,
      category: form.category || undefined,
      sku: form.sku || undefined,
      productUrl: form.productUrl || undefined,
      description: form.description || undefined,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  }

  function addFeature() {
    if (featureInput.trim()) {
      setForm(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }));
      setFeatureInput("");
    }
  }

  function removeFeature(index: number) {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  }

  async function handleAiAnalyze() {
    if (!csvText.trim()) {
      toast({ title: "No data", description: "Please upload or paste CSV data first.", variant: "destructive" });
      return;
    }
    setAiAnalyzing(true);
    try {
      const res = await apiRequest("POST", "/api/products/ai-analyze-csv", { csvText });
      const data = await res.json();
      setAiAnalysis(data.analysis);
      setAiMappings(data.analysis.mappings || {});
      setCsvStep("mapping");
    } catch (error: any) {
      toast({ title: "AI Analysis Failed", description: error.message || "Could not analyze the CSV.", variant: "destructive" });
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleAiPreview() {
    try {
      setAiAnalyzing(true);
      const res = await apiRequest("POST", "/api/products/ai-transform-csv", {
        csvText,
        mappings: aiMappings,
        delimiter: aiAnalysis?.delimiter || ",",
        detectedCurrency: aiAnalysis?.detectedCurrency,
      });
      const data = await res.json();
      setAiPreviewItems(data.items || []);
      setCsvStep("preview");
    } catch (error: any) {
      toast({ title: "Transform failed", description: error.message, variant: "destructive" });
    } finally {
      setAiAnalyzing(false);
    }
  }

  function handleAiImport() {
    if (aiPreviewItems.length === 0) {
      toast({ title: "No data", description: "No valid products to import.", variant: "destructive" });
      return;
    }
    setCsvStep("importing");
    bulkImportMutation.mutate(aiPreviewItems);
  }

  function handleCsvImport() {
    handleAiAnalyze();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/vnd.ms-excel'];
    const allowedExtensions = ['.csv', '.tsv', '.txt'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      toast({ title: "Invalid file", description: "Please upload a CSV, TSV, or TXT file.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.onerror = () => {
      toast({ title: "Read error", description: "Failed to read the file.", variant: "destructive" });
    };
    reader.readAsText(file);
  }

  async function handleUrlFetch() {
    if (!csvUrl.trim()) return;
    setFetchingUrl(true);
    try {
      const res = await apiRequest("POST", "/api/products/fetch-csv-url", { url: csvUrl.trim() });
      const data = await res.json();
      setCsvText(data.csvText);
      toast({ title: "CSV loaded", description: "CSV data fetched from URL. Click Import to proceed." });
    } catch (error: any) {
      toast({ title: "Fetch failed", description: error.message || "Could not fetch CSV from the provided URL.", variant: "destructive" });
    } finally {
      setFetchingUrl(false);
    }
  }

  function resetCsvDialog() {
    setCsvText("");
    setCsvUrl("");
    setCsvFileName("");
    setCsvImportMode("upload");
    setImportProgress(null);
    setAiAnalysis(null);
    setAiAnalyzing(false);
    setAiMappings({});
    setCsvStep("upload");
    setAiPreviewItems([]);
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case "price": aVal = a.price; bVal = b.price; break;
        case "category": aVal = (a.category || "").toLowerCase(); bVal = (b.category || "").toLowerCase(); break;
        case "sku": aVal = (a.sku || "").toLowerCase(); bVal = (b.sku || "").toLowerCase(); break;
        case "availability": aVal = a.availability; bVal = b.availability; break;
        default: aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = sortedProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, pageSize]);

  const currencySymbols: Record<string, string> = {"USD":"$","EUR":"€","GBP":"£","INR":"₹","JPY":"¥","CAD":"C$","AUD":"A$","AED":"د.إ","SAR":"﷼","QAR":"ر.ق","KWD":"د.ك","BHD":"ب.د","OMR":"ر.ع"};

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  }

  const allFilteredSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id));
  const someFilteredSelected = paginatedProducts.some(p => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      paginatedProducts.forEach(p => next.delete(p.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedProducts.forEach(p => next.add(p.id));
      setSelectedIds(next);
    }
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredProducts.map(p => p.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkUpdate() {
    if (!bulkUpdateField || !bulkUpdateValue) {
      toast({ title: "Missing data", description: "Please select a field and enter a value.", variant: "destructive" });
      return;
    }
    const updates: Record<string, any> = { [bulkUpdateField]: bulkUpdateValue };
    bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates });
  }

  useEffect(() => {
    if (products.length > 0 && selectedIds.size > 0) {
      const productIdSet = new Set(products.map(p => p.id));
      const validSelected = new Set([...selectedIds].filter(id => productIdSet.has(id)));
      if (validSelected.size !== selectedIds.size) {
        setSelectedIds(validSelected);
      }
    }
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
            data-testid="input-search-products"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setCsvDialogOpen(true)} data-testid="button-import-csv">
            <Upload className="h-4 w-4 mr-1.5" />
            Import CSV
          </Button>
          <Button size="sm" className="h-9" onClick={openCreateDialog} data-testid="button-add-product">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg" data-testid="bulk-actions-bar">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium" data-testid="text-selected-count">
              {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            {selectedIds.size < filteredProducts.length && (
              <button
                onClick={selectAllFiltered}
                className="text-xs text-primary hover:underline"
                data-testid="button-select-all-filtered"
              >
                Select all {filteredProducts.length}
              </button>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setBulkUpdateField("");
                setBulkUpdateValue("");
                setBulkUpdateOpen(true);
              }}
              data-testid="button-bulk-update"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Bulk Update
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => setBulkDeleteOpen(true)}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setSelectedIds(new Set())}
              data-testid="button-clear-selection"
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {products.length === 0 ? "No products yet" : "No matching products"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              {products.length === 0
                ? "Add your products and pricing to help the AI agent answer customer inquiries and recommend products during conversations."
                : "Try adjusting your search or filter criteria."}
            </p>
            {products.length === 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCsvDialogOpen(true)} data-testid="button-empty-import">
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import from CSV
                </Button>
                <Button onClick={openCreateDialog} data-testid="button-empty-add">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Product
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[44px] pl-4">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all products"
                    data-testid="checkbox-select-all"
                    className={someFilteredSelected && !allFilteredSelected ? "data-[state=unchecked]:bg-primary/20" : ""}
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <button onClick={() => handleSort("name")} className="flex items-center gap-0.5 hover:text-foreground transition-colors text-xs font-semibold uppercase tracking-wider" data-testid="sort-name">
                    Product <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <button onClick={() => handleSort("category")} className="flex items-center gap-0.5 hover:text-foreground transition-colors text-xs font-semibold uppercase tracking-wider" data-testid="sort-category">
                    Category <SortIcon field="category" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort("price")} className="flex items-center gap-0.5 hover:text-foreground transition-colors text-xs font-semibold uppercase tracking-wider" data-testid="sort-price">
                    Price <SortIcon field="price" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button onClick={() => handleSort("sku")} className="flex items-center gap-0.5 hover:text-foreground transition-colors text-xs font-semibold uppercase tracking-wider" data-testid="sort-sku">
                    SKU <SortIcon field="sku" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort("availability")} className="flex items-center gap-0.5 hover:text-foreground transition-colors text-xs font-semibold uppercase tracking-wider" data-testid="sort-status">
                    Status <SortIcon field="availability" />
                  </button>
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider">AI Synced</span>
                </TableHead>
                <TableHead className="w-[44px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow
                  key={product.id}
                  data-testid={`row-product-${product.id}`}
                  className={`group transition-colors ${selectedIds.has(product.id) ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-muted/40"}`}
                >
                  <TableCell className="pl-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                      aria-label={`Select ${product.name}`}
                      data-testid={`checkbox-product-${product.id}`}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate" data-testid={`text-product-name-${product.id}`}>{product.name}</span>
                          {product.productUrl && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label={`Open ${product.name} product page`}>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Open product page</p></TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[280px] leading-tight mt-0.5">{product.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 hidden md:table-cell">
                    {product.category ? (
                      <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0.5" data-testid={`badge-category-${product.id}`}>{product.category}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-baseline gap-0.5" data-testid={`text-price-${product.id}`}>
                      <span className="text-[11px] text-muted-foreground">{currencySymbols[product.currency] || product.currency}</span>
                      <span className="font-semibold text-sm tabular-nums">{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground font-mono tracking-tight">{product.sku || <span className="text-muted-foreground/50">—</span>}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant={product.availability === "in_stock" ? "default" : product.availability === "pre_order" ? "secondary" : "destructive"}
                      className="text-[11px] font-normal px-2 py-0.5"
                      data-testid={`badge-availability-${product.id}`}
                    >
                      {product.availability === "in_stock" ? "In Stock" : product.availability === "out_of_stock" ? "Out of Stock" : "Pre-Order"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 hidden xl:table-cell">
                    {product.ragKnowledgeBaseId ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 cursor-default">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-[11px]">Synced</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p className="text-xs">Available to AI agent</p></TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-400 cursor-default">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-[11px]">Pending</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p className="text-xs">Waiting for AI sync</p></TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className="py-3 pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" data-testid={`button-product-actions-${product.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => openEditDialog(product)} data-testid={`menu-edit-${product.id}`}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteProductId(product.id)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-delete-${product.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20" data-testid="table-footer">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {filteredProducts.length !== products.length
                  ? `${filteredProducts.length} of ${products.length} products`
                  : `${products.length} product${products.length !== 1 ? 's' : ''}`}
              </span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-7 w-[70px] text-xs" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">per page</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2">
                  Page {safePage} of {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage(1)} data-testid="page-first" aria-label="First page">
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} data-testid="page-prev" aria-label="Previous page">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} data-testid="page-next" aria-label="Next page">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)} data-testid="page-last" aria-label="Last page">
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Dialog open={productDialogOpen} onOpenChange={(open) => { if (!open) { setProductDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update product details. Changes will be synced to the AI knowledge base."
                : "Add a product to your inventory. It will be automatically available to the AI agent for customer inquiries."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name *</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Premium Widget Pro"
                data-testid="input-product-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the product for the AI agent..."
                rows={3}
                data-testid="input-product-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-price">Price *</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-product-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-currency">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm(prev => ({ ...prev, currency: v }))}>
                  <SelectTrigger data-testid="select-product-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED - UAE Dirham (د.إ)</SelectItem>
                    <SelectItem value="SAR">SAR - Saudi Riyal (﷼)</SelectItem>
                    <SelectItem value="QAR">QAR - Qatari Riyal (ر.ق)</SelectItem>
                    <SelectItem value="KWD">KWD - Kuwaiti Dinar (د.ك)</SelectItem>
                    <SelectItem value="BHD">BHD - Bahraini Dinar (ب.د)</SelectItem>
                    <SelectItem value="OMR">OMR - Omani Rial (ر.ع)</SelectItem>
                    <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                    <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                    <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                    <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Input
                  id="product-category"
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Electronics"
                  data-testid="input-product-category"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  value={form.sku}
                  onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="e.g., WDG-PRO-001"
                  data-testid="input-product-sku"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-availability">Availability</Label>
              <Select value={form.availability} onValueChange={(v) => setForm(prev => ({ ...prev, availability: v }))}>
                <SelectTrigger data-testid="select-product-availability">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="pre_order">Pre-Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-url">Product URL (E-Commerce Link)</Label>
              <Input
                id="product-url"
                value={form.productUrl}
                onChange={(e) => setForm(prev => ({ ...prev, productUrl: e.target.value }))}
                placeholder="https://your-store.com/products/..."
                data-testid="input-product-url"
              />
              <p className="text-xs text-muted-foreground">Link to the product page on your store (Shopify, WooCommerce, etc.). The AI agent can share this link with customers.</p>
            </div>
            <div className="space-y-2">
              <Label>Key Features</Label>
              <div className="flex gap-2">
                <Input
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                  placeholder="Add a feature and press Enter"
                  data-testid="input-product-feature"
                />
                <Button type="button" variant="outline" size="sm" onClick={addFeature} data-testid="button-add-feature">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.features.map((feature, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs gap-1 pr-1">
                      {feature}
                      <button onClick={() => removeFeature(idx)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProductDialogOpen(false); resetForm(); }} data-testid="button-cancel-product">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-product"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProductId} onOpenChange={(open) => { if (!open) setDeleteProductId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product and remove it from the AI knowledge base. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProductId && deleteMutation.mutate(deleteProductId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) setBulkDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Product{selectedIds.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected product{selectedIds.size !== 1 ? 's' : ''} and remove them from the AI knowledge base. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete {selectedIds.size} Product{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={bulkUpdateOpen} onOpenChange={(open) => { if (!open) { setBulkUpdateOpen(false); setBulkUpdateField(""); setBulkUpdateValue(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Update {selectedIds.size} Product{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Choose a field and the new value to apply to all selected products.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field to Update</Label>
              <Select value={bulkUpdateField} onValueChange={(v) => { setBulkUpdateField(v); setBulkUpdateValue(""); }}>
                <SelectTrigger data-testid="select-bulk-update-field">
                  <SelectValue placeholder="Select a field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="availability">Availability</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkUpdateField === "availability" && (
              <div className="space-y-2">
                <Label>New Availability</Label>
                <Select value={bulkUpdateValue} onValueChange={setBulkUpdateValue}>
                  <SelectTrigger data-testid="select-bulk-update-value">
                    <SelectValue placeholder="Select availability..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="pre_order">Pre-Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkUpdateField === "currency" && (
              <div className="space-y-2">
                <Label>New Currency</Label>
                <Select value={bulkUpdateValue} onValueChange={setBulkUpdateValue}>
                  <SelectTrigger data-testid="select-bulk-update-currency">
                    <SelectValue placeholder="Select currency..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                    <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                    <SelectItem value="QAR">QAR - Qatari Riyal</SelectItem>
                    <SelectItem value="KWD">KWD - Kuwaiti Dinar</SelectItem>
                    <SelectItem value="BHD">BHD - Bahraini Dinar</SelectItem>
                    <SelectItem value="OMR">OMR - Omani Rial</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkUpdateField === "category" && (
              <div className="space-y-2">
                <Label>New Category</Label>
                <Input
                  value={bulkUpdateValue}
                  onChange={(e) => setBulkUpdateValue(e.target.value)}
                  placeholder="Enter new category..."
                  data-testid="input-bulk-update-category"
                />
              </div>
            )}

            {bulkUpdateField === "price" && (
              <div className="space-y-2">
                <Label>New Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bulkUpdateValue}
                  onChange={(e) => setBulkUpdateValue(e.target.value)}
                  placeholder="Enter new price..."
                  data-testid="input-bulk-update-price"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkUpdateOpen(false); setBulkUpdateField(""); setBulkUpdateValue(""); }} data-testid="button-cancel-bulk-update">
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={bulkUpdateMutation.isPending || !bulkUpdateField || !bulkUpdateValue}
              data-testid="button-confirm-bulk-update"
            >
              {bulkUpdateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update {selectedIds.size} Product{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={csvDialogOpen} onOpenChange={(open) => { setCsvDialogOpen(open); if (!open) resetCsvDialog(); }}>
        <DialogContent className={csvStep === "preview" ? "max-w-3xl max-h-[85vh] overflow-y-auto" : csvStep === "mapping" ? "max-w-2xl max-h-[85vh] overflow-y-auto" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {csvStep === "upload" && "Import Products from CSV"}
              {csvStep === "mapping" && (
                <>
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  AI Column Mapping
                </>
              )}
              {csvStep === "preview" && "Preview Import Data"}
              {csvStep === "importing" && "Importing Products..."}
            </DialogTitle>
            <DialogDescription>
              {csvStep === "upload" && "Upload any CSV file — AI will automatically detect and map your columns to product fields."}
              {csvStep === "mapping" && "AI has analyzed your CSV. Review and adjust the column mappings below."}
              {csvStep === "preview" && `${aiPreviewItems.length} products ready to import. Review the data below.`}
              {csvStep === "importing" && "Please wait while your products are being imported and synced to the AI knowledge base."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {csvStep === "upload" && (
              <>
                {importProgress ? (
                  <div className="space-y-3 py-2" data-testid="import-progress-section">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium" data-testid="text-import-phase">{importProgress.phase}</span>
                    </div>
                    <Progress
                      value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}
                      className="h-2"
                      data-testid="progress-import"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{importProgress.current} of {importProgress.total} products</span>
                      <span>{importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        const sampleCsv = "name,price,currency,category,sku,description,availability,productUrl\nWidget Pro,29.99,USD,Electronics,WDG-001,Our best premium widget,in_stock,https://example.com/widget-pro\nWidget Basic,9.99,USD,Electronics,WDG-002,Entry level widget for beginners,in_stock,https://example.com/widget-basic\nSmart Lamp,49.99,USD,Home & Garden,SML-100,AI-powered smart lamp with voice control,in_stock,\nPremium Headset,199.00,USD,Audio,AUD-050,Noise cancelling wireless headset,pre_order,https://example.com/headset\nOrganic Tea Set,24.50,USD,Food & Drink,TEA-010,Assorted organic tea collection,in_stock,";
                        const blob = new Blob([sampleCsv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "products_sample.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline mb-1"
                      data-testid="button-download-sample"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download sample CSV template
                    </button>

                    <div className="flex gap-1 p-1 bg-muted rounded-lg" data-testid="csv-import-mode-tabs">
                      <button
                        onClick={() => { setCsvImportMode("upload"); setCsvText(""); setCsvUrl(""); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${csvImportMode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        data-testid="tab-csv-upload"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload File
                      </button>
                      <button
                        onClick={() => { setCsvImportMode("link"); setCsvText(""); setCsvFileName(""); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${csvImportMode === "link" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        data-testid="tab-csv-link"
                      >
                        <Link className="h-3.5 w-3.5" />
                        From Link
                      </button>
                      <button
                        onClick={() => { setCsvImportMode("paste"); setCsvFileName(""); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${csvImportMode === "paste" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        data-testid="tab-csv-paste"
                      >
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        Paste
                      </button>
                    </div>

                    {csvImportMode === "upload" && (
                      <div className="space-y-3">
                        <label
                          htmlFor="csv-file-upload"
                          className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                          data-testid="dropzone-csv-upload"
                        >
                          {csvFileName ? (
                            <>
                              <FileText className="h-8 w-8 text-primary" />
                              <span className="text-sm font-medium">{csvFileName}</span>
                              <span className="text-xs text-muted-foreground">
                                {csvText ? `${csvText.trim().split("\n").length} rows loaded` : "Reading..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-8 w-8 text-muted-foreground" />
                              <span className="text-sm font-medium">Click to upload CSV file</span>
                              <span className="text-xs text-muted-foreground">Supports .csv, .tsv, .txt (max 5MB)</span>
                            </>
                          )}
                        </label>
                        <input
                          id="csv-file-upload"
                          type="file"
                          accept=".csv,.tsv,.txt,text/csv,text/plain"
                          className="hidden"
                          onChange={handleFileUpload}
                          data-testid="input-csv-file"
                        />
                        {csvFileName && csvText && (
                          <Button variant="ghost" size="sm" onClick={() => { setCsvFileName(""); setCsvText(""); }} className="w-full" data-testid="button-clear-file">
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Clear file
                          </Button>
                        )}
                      </div>
                    )}

                    {csvImportMode === "link" && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            value={csvUrl}
                            onChange={(e) => setCsvUrl(e.target.value)}
                            placeholder="https://example.com/products.csv"
                            className="flex-1"
                            data-testid="input-csv-url"
                          />
                          <Button
                            variant="outline"
                            onClick={handleUrlFetch}
                            disabled={fetchingUrl || !csvUrl.trim()}
                            data-testid="button-fetch-csv-url"
                          >
                            {fetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                          </Button>
                        </div>
                        {csvText && (
                          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            CSV loaded ({csvText.trim().split("\n").length} rows)
                          </div>
                        )}
                      </div>
                    )}

                    {csvImportMode === "paste" && (
                      <Textarea
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        placeholder={"name,price,category,sku,description\nWidget Pro,29.99,Electronics,WDG-001,Our best widget\nWidget Basic,9.99,Electronics,WDG-002,Entry level widget"}
                        rows={8}
                        className="font-mono text-xs"
                        data-testid="textarea-csv-import"
                      />
                    )}

                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        AI will automatically detect your column structure and map it to product fields — no specific format required.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {csvStep === "mapping" && aiAnalysis && (
              <div className="space-y-4">
                {aiAnalysis.confidence && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    aiAnalysis.confidence === "high" ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" :
                    aiAnalysis.confidence === "medium" ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" :
                    "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                  }`}>
                    {aiAnalysis.confidence === "high" ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> :
                     aiAnalysis.confidence === "medium" ? <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" /> :
                     <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    <div>
                      <span className="text-xs font-medium capitalize">{aiAnalysis.confidence} confidence</span>
                      {aiAnalysis.notes && <p className="text-xs text-muted-foreground mt-0.5">{aiAnalysis.notes}</p>}
                    </div>
                  </div>
                )}

                {aiAnalysis.detectedCurrency && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Detected currency: <Badge variant="outline" className="text-xs">{aiAnalysis.detectedCurrency}</Badge>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Column Mappings</Label>
                  <div className="border rounded-lg divide-y">
                    {Object.entries(aiMappings).map(([csvCol, targetField]) => (
                      <div key={csvCol} className="flex items-center gap-3 px-3 py-2.5" data-testid={`mapping-row-${csvCol}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-mono truncate block">{csvCol}</span>
                        </div>
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground rotate-[-90deg] shrink-0" />
                        <Select
                          value={targetField || "_skip"}
                          onValueChange={(v) => {
                            setAiMappings(prev => {
                              const next = { ...prev };
                              if (v !== "_skip") {
                                for (const [key, val] of Object.entries(next)) {
                                  if (val === v && key !== csvCol) {
                                    next[key] = null;
                                  }
                                }
                              }
                              next[csvCol] = v === "_skip" ? null : v;
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs" data-testid={`select-mapping-${csvCol}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_skip">Skip (don't import)</SelectItem>
                            <SelectItem value="name">Product Name</SelectItem>
                            <SelectItem value="description">Description</SelectItem>
                            <SelectItem value="price">Price</SelectItem>
                            <SelectItem value="currency">Currency</SelectItem>
                            <SelectItem value="category">Category</SelectItem>
                            <SelectItem value="sku">SKU / Code</SelectItem>
                            <SelectItem value="availability">Availability</SelectItem>
                            <SelectItem value="productUrl">Product URL</SelectItem>
                            <SelectItem value="features">Features</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {!Object.values(aiMappings).includes("name") && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">A "Product Name" mapping is required to proceed.</p>
                  </div>
                )}

                {aiAnalysis.sampleMapped && aiAnalysis.sampleMapped.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">AI Sample Preview</Label>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Price</TableHead>
                            <TableHead className="text-xs">Category</TableHead>
                            <TableHead className="text-xs">SKU</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aiAnalysis.sampleMapped.slice(0, 3).map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs">{item.name || "—"}</TableCell>
                              <TableCell className="text-xs">{item.price != null ? `${item.currency || "USD"} ${item.price}` : "—"}</TableCell>
                              <TableCell className="text-xs">{item.category || "—"}</TableCell>
                              <TableCell className="text-xs">{item.sku || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {csvStep === "preview" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{aiPreviewItems.length} products ready to import</span>
                </div>
                <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs whitespace-nowrap">#</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Name</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Price</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Currency</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Category</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">SKU</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiPreviewItems.slice(0, 50).map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium max-w-[200px] truncate">{item.name}</TableCell>
                          <TableCell className="text-xs">{item.price}</TableCell>
                          <TableCell className="text-xs">{item.currency || "USD"}</TableCell>
                          <TableCell className="text-xs">{item.category || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{item.sku || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {item.availability === "in_stock" ? "In Stock" : item.availability === "out_of_stock" ? "Out of Stock" : "Pre-Order"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {aiPreviewItems.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center">Showing first 50 of {aiPreviewItems.length} products</p>
                )}
              </div>
            )}

            {csvStep === "importing" && importProgress && (
              <div className="space-y-3 py-2" data-testid="import-progress-section">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium" data-testid="text-import-phase">{importProgress.phase}</span>
                </div>
                <Progress
                  value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}
                  className="h-2"
                  data-testid="progress-import"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{importProgress.current} of {importProgress.total} products</span>
                  <span>{importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {csvStep === "upload" && (
              <>
                <Button variant="outline" onClick={() => { setCsvDialogOpen(false); resetCsvDialog(); }} disabled={bulkImportMutation.isPending || aiAnalyzing} data-testid="button-cancel-csv">Cancel</Button>
                <Button
                  onClick={handleAiAnalyze}
                  disabled={aiAnalyzing || !csvText.trim()}
                  data-testid="button-submit-csv"
                >
                  {aiAnalyzing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  {aiAnalyzing ? "Analyzing..." : "Analyze with AI"}
                </Button>
              </>
            )}
            {csvStep === "mapping" && (
              <>
                <Button variant="outline" onClick={() => setCsvStep("upload")} data-testid="button-back-mapping">
                  Back
                </Button>
                <Button
                  onClick={handleAiPreview}
                  disabled={aiAnalyzing || !Object.values(aiMappings).some(v => v === "name")}
                  data-testid="button-preview-csv"
                >
                  {aiAnalyzing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {aiAnalyzing ? "Processing..." : "Preview Import"}
                </Button>
              </>
            )}
            {csvStep === "preview" && (
              <>
                <Button variant="outline" onClick={() => setCsvStep("mapping")} data-testid="button-back-preview">
                  Back
                </Button>
                <Button
                  onClick={handleAiImport}
                  disabled={bulkImportMutation.isPending || aiPreviewItems.length === 0}
                  data-testid="button-confirm-import"
                >
                  {bulkImportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <FileUp className="h-4 w-4 mr-1.5" />
                  Import {aiPreviewItems.length} Products
                </Button>
              </>
            )}
            {csvStep === "importing" && (
              <Button variant="outline" disabled data-testid="button-importing-wait">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importing...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
