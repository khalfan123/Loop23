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
import { useState, useRef, useMemo, Fragment, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Link, 
  FileText, 
  Type, 
  Search, 
  ChevronDown, 
  Trash2, 
  Upload, 
  Globe, 
  FileType, 
  Crown, 
  Zap, 
  Lock, 
  BookOpen, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Brain, 
  RefreshCw, 
  Plus, 
  Folder,
  FolderPlus,
  LayoutDashboard,
  Sparkles,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Database,
  BarChart3,
  Tags,
  Layers,
  HelpCircle,
  Lightbulb,
  Square,
  Phone,
  Activity,
  Wand2,
  ShoppingBag,
  Package,
  DollarSign,
  ExternalLink
} from "lucide-react";
import KnowledgeIntelligence from "@/components/knowledge-intelligence";
import ProductsInventoryView from "@/components/ProductsInventoryView";
import { AuthStorage } from "@/lib/auth-storage";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThreeColumnLayout, SubPanelSection, SubPanelItem } from "@/components/ThreeColumnLayout";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";

interface KnowledgeBaseItem {
  id: string;
  type: string;
  title: string;
  content?: string;
  url?: string;
  fileUrl?: string;
  folderId?: string | null;
  storageSize: number;
  createdAt: string;
  ragStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  ragProgress?: number;
  chunkCount?: number;
  isRAGEnabled?: boolean;
}

interface KnowledgeFolder {
  id: string;
  name: string;
  icon: string;
  color?: string;
  sortOrder: number;
}

interface StorageUsage {
  maxStorageBytes: number;
  usedStorageBytes: number;
  remainingBytes: number;
  usagePercent: number;
}

interface DashboardStats {
  totalResources: number;
  totalChunks: number;
  totalSize: number;
  typeDistribution: Record<string, number>;
  recentItems: KnowledgeBaseItem[];
}

interface FolderStats {
  folders: Record<string, number>;
  uncategorized: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  planType: string;
  credits: number;
}

const FOLDER_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

function DonutChart({ urlCount, textCount, fileCount }: { urlCount: number; textCount: number; fileCount: number }) {
  const total = urlCount + textCount + fileCount;
  if (total === 0) {
    return (
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="20"
            className="text-muted/30"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">0</span>
          <span className="text-xs text-muted-foreground">items</span>
        </div>
      </div>
    );
  }

  const urlPercent = (urlCount / total) * 100;
  const textPercent = (textCount / total) * 100;
  const filePercent = (fileCount / total) * 100;
  
  const circumference = 2 * Math.PI * 40;
  const urlDash = (urlPercent / 100) * circumference;
  const textDash = (textPercent / 100) * circumference;
  const fileDash = (filePercent / 100) * circumference;
  
  let offset = 0;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {urlCount > 0 && (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#f97316"
            strokeWidth="20"
            strokeDasharray={`${urlDash} ${circumference}`}
            strokeDashoffset={-offset}
          />
        )}
        {(() => { offset += urlDash; return null; })()}
        {textCount > 0 && (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="20"
            strokeDasharray={`${textDash} ${circumference}`}
            strokeDashoffset={-offset}
          />
        )}
        {(() => { offset += textDash; return null; })()}
        {fileCount > 0 && (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#22c55e"
            strokeWidth="20"
            strokeDasharray={`${fileDash} ${circumference}`}
            strokeDashoffset={-offset}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">items</span>
      </div>
    </div>
  );
}

export default function KnowledgeBase() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isKnowledgeSourcesExpanded, setIsKnowledgeSourcesExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<"dashboard" | "folder" | "web-crawler" | "ai-insights" | "content-studio" | "entities" | "topic-clusters" | "faqs" | "content-gaps" | "ml-conversations" | "ml-operations" | "ml-insights" | "bedrock-kb" | "products">("dashboard");
  
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlName, setUrlName] = useState("");
  const [urlFolderId, setUrlFolderId] = useState<string>("");
  
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textName, setTextName] = useState("");
  const [textFolderId, setTextFolderId] = useState<string>("");
  
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileFolderId, setFileFolderId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [deletingItem, setDeletingItem] = useState<KnowledgeBaseItem | null>(null);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);

  const [mediaGeneratingIds, setMediaGeneratingIds] = useState<Set<string>>(new Set());
  const [mediaStatusMap, setMediaStatusMap] = useState<Record<string, { status: string; filesGenerated?: number; fileNames?: string[] }>>({});

  const [bedrockQueryInput, setBedrockQueryInput] = useState("");
  const [bedrockQueryResults, setBedrockQueryResults] = useState<Array<{text: string; score: number; sourceUri?: string}>>([]);
  const bedrockFileInputRef = useRef<HTMLInputElement>(null);
  
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState("#3b82f6");
  const [editingFolder, setEditingFolder] = useState<KnowledgeFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<KnowledgeFolder | null>(null);
  
  const { toast } = useToast();

  const { data: user, isLoading: userLoading, isError: userError } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: storageUsage } = useQuery<StorageUsage>({
    queryKey: ["/api/rag-knowledge/storage"],
    enabled: user?.planType !== 'free',
  });

  const { data: knowledgeBase = [], isLoading, refetch } = useQuery<KnowledgeBaseItem[]>({
    queryKey: ["/api/rag-knowledge"],
    enabled: user?.planType !== 'free',
    refetchInterval: (query) => {
      const items = query.state.data as KnowledgeBaseItem[] | undefined;
      const hasProcessingItems = items?.some(item => item.ragStatus === 'processing');
      return hasProcessingItems ? 3000 : false;
    },
  });

  const { data: folders = [] } = useQuery<KnowledgeFolder[]>({
    queryKey: ["/api/rag-knowledge/folders"],
    enabled: user?.planType !== 'free',
  });

  const { data: folderStats } = useQuery<FolderStats>({
    queryKey: ["/api/rag-knowledge/folders/stats"],
    enabled: user?.planType !== 'free',
  });

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/rag-knowledge/stats"],
    enabled: user?.planType !== 'free',
  });

  // Pipeline job types for enrichment progress
  interface PipelineJob {
    id: string;
    name: string;
    status: string;
    currentStage: string;
    overallProgress: number;
    stageProgress: number;
    estimatedTimeRemaining: number | null;
    stageDetails?: {
      crawling?: { pagesDiscovered: number; pagesCrawled: number; completedAt?: string };
      analyzing?: {
        itemsProcessed: number;
        itemsTotal: number;
        completedAt?: string;
        businessType?: string;
        businessIndustry?: string;
        businessDescription?: string;
        isUrlEnrichment?: boolean;
        sourceUrl?: string;
      };
      generating?: {
        articlesPlanned: number;
        articlesGenerated: number;
        currentArticleTitle?: string;
        currentCategory?: string;
        completedAt?: string;
        isUrlEnrichment?: boolean;
        folderResults?: Record<string, number>;
      };
    };
  }

  const prevPipelineJobRef = useRef<PipelineJob | null | undefined>(undefined);

  const { data: activePipelineJob } = useQuery<PipelineJob | null>({
    queryKey: ["/api/knowledge-intelligence/pipeline-jobs/active"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 30000;
      // Poll frequently while running or while showing completion banner (done/error stage)
      if (["pending", "crawling", "analyzing", "generating"].includes(data.status)) return 2000;
      if (data.currentStage === "done" || data.currentStage === "error") return 5000;
      return 30000;
    },
  });

  useEffect(() => {
    const prev = prevPipelineJobRef.current;
    const cur = activePipelineJob;

    // Invalidate KB list when an active job transitions to done/null
    const wasActive = prev && ["pending", "crawling", "analyzing", "generating"].includes(prev.status);
    const isNowDoneOrNull = !cur || cur.currentStage === "done";

    if (wasActive && isNowDoneOrNull) {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
    }

    prevPipelineJobRef.current = cur;
  }, [activePipelineJob]);

  interface BedrockKBStatus {
    provisioned: boolean;
    bedrockKbId?: string;
    status?: string;
    fileCount?: number;
    configured: boolean;
    aiModel?: string;
    aiModelId?: string;
    fallbackModel?: string;
    fallbackModelId?: string;
    embeddingModel?: string;
    region?: string;
  }

  interface BedrockKBFile {
    id: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    s3Key: string;
    sizeBytes: number;
    status: string;
    createdAt: string;
  }

  const { data: bedrockStatus, isLoading: bedrockStatusLoading } = useQuery<BedrockKBStatus>({
    queryKey: ['/api/bedrock-kb/status'],
    enabled: viewMode === 'bedrock-kb',
  });

  const { data: bedrockFiles = [], isLoading: bedrockFilesLoading } = useQuery<BedrockKBFile[]>({
    queryKey: ['/api/bedrock-kb/files'],
    enabled: viewMode === 'bedrock-kb' && !!bedrockStatus?.provisioned,
  });

  const bedrockProvisionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/bedrock-kb/provision');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bedrock-kb/status'] });
      toast({ title: "Knowledge Base Provisioned", description: "Your Bedrock AI Knowledge Base is now active." });
    },
    onError: (error: any) => {
      toast({ title: "Provisioning Failed", description: error.message || "Could not provision the knowledge base.", variant: "destructive" });
    },
  });

  const bedrockUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) headers['Authorization'] = authHeader;
      const response = await fetch('/api/bedrock-kb/upload', { method: 'POST', headers, credentials: 'include', body: formData });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Upload failed'); }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bedrock-kb/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bedrock-kb/status'] });
      toast({ title: "File Uploaded", description: "File uploaded to Bedrock Knowledge Base." });
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message || "Could not upload file.", variant: "destructive" });
    },
  });

  const bedrockDeleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await apiRequest('DELETE', `/api/bedrock-kb/files/${fileId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bedrock-kb/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bedrock-kb/status'] });
      toast({ title: "File Deleted", description: "File removed from Bedrock Knowledge Base." });
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message || "Could not delete file.", variant: "destructive" });
    },
  });

  const bedrockSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/bedrock-kb/sync');
      return res.json() as Promise<{ ingestionJobId?: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Sync Started", description: `Re-indexing triggered. Job ID: ${data.ingestionJobId || 'N/A'}` });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message || "Could not trigger re-indexing.", variant: "destructive" });
    },
  });

  const bedrockQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest('POST', '/api/bedrock-kb/query', { query, numberOfResults: 5 });
      return res.json() as Promise<{ results?: Array<{ text: string; score: number; sourceUri?: string }> }>;
    },
    onSuccess: (data) => {
      setBedrockQueryResults(data.results || []);
    },
    onError: (error: any) => {
      toast({ title: "Query Failed", description: error.message || "Could not query knowledge base.", variant: "destructive" });
    },
  });

  const getBedrockFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Globe className="h-4 w-4 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Phone className="h-4 w-4 text-green-500" />;
    if (mimeType.startsWith('video/')) return <Activity className="h-4 w-4 text-red-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-600" />;
    return <FileType className="h-4 w-4 text-blue-500" />;
  };

  const uploadFileMutation = useMutation({
    mutationFn: async (data: { file: File; name?: string; folderId?: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.name) {
        formData.append('name', data.name);
      }
      if (data.folderId) {
        formData.append('folderId', data.folderId);
      }
      
      const headers: Record<string, string> = {};
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      
      const response = await fetch('/api/rag-knowledge/upload', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('knowledgeBase.errors.uploadFailed'));
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
      setFileDialogOpen(false);
      setSelectedFile(null);
      setFileName('');
      setFileFolderId('');
      toast({
        title: t('knowledgeBase.toast.fileUploaded'),
        description: t('knowledgeBase.toast.fileUploadedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('knowledgeBase.toast.uploadFailed'),
        description: error.message || t('knowledgeBase.toast.uploadFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const addUrlMutation = useMutation({
    mutationFn: async (data: { url: string; name?: string; folderId?: string }) => {
      const res = await apiRequest('POST', '/api/rag-knowledge/url', data);
      return { ...await res.json(), originalUrl: data.url };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-intelligence/pipeline-jobs/active'] });
      
      setUrlDialogOpen(false);
      setUrlInput('');
      setUrlName('');
      setUrlFolderId('');
      
      toast({
        title: t('knowledgeBase.toast.urlAdded'),
        description: "Analyzing content and generating knowledge articles…",
      });
    },
    onError: (error: any) => {
      toast({
        title: t('knowledgeBase.toast.urlFailed'),
        description: error.message || t('knowledgeBase.toast.urlFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const addTextMutation = useMutation({
    mutationFn: async (data: { text: string; name: string; folderId?: string }) => {
      const res = await apiRequest('POST', '/api/rag-knowledge/text', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
      setTextDialogOpen(false);
      setTextInput('');
      setTextName('');
      setTextFolderId('');
      toast({
        title: t('knowledgeBase.toast.textAdded'),
        description: t('knowledgeBase.toast.textAddedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('knowledgeBase.toast.textFailed'),
        description: error.message || t('knowledgeBase.toast.textFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/rag-knowledge/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
      setDeletingItem(null);
      toast({
        title: t('common.delete'),
        description: t('knowledgeBase.toast.deleted'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('knowledgeBase.toast.deleteFailed'),
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { id: string; title?: string; content?: string }) => {
      const res = await apiRequest('PATCH', `/api/rag-knowledge/${data.id}`, { title: data.title, content: data.content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
      setEditingItem(null);
      setEditTitle('');
      setEditContent('');
      toast({
        title: "Article Updated",
        description: "The article has been updated and re-indexed for AI search.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update the article.",
        variant: "destructive",
      });
    },
  });

  const purgeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', '/api/rag-knowledge/purge-all');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/storage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/stats'] });
      setPurgeDialogOpen(false);
      toast({
        title: "All Resources Deleted",
        description: `Successfully removed ${data.deletedCount} resource(s) and their chunks.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete all resources. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelPipelineMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/knowledge-intelligence/pipeline-jobs/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-intelligence/pipeline-jobs/active'] });
      toast({
        title: "Pipeline Stopped",
        description: "The pipeline job has been cancelled.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to stop the pipeline.",
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; color?: string }) => {
      const res = await apiRequest('POST', '/api/rag-knowledge/folders', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      setFolderDialogOpen(false);
      setFolderName('');
      setFolderColor('#3b82f6');
      setEditingFolder(null);
      toast({
        title: "Folder Created",
        description: "Your new folder has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; color?: string }) => {
      const res = await apiRequest('PATCH', `/api/rag-knowledge/folders/${data.id}`, { name: data.name, color: data.color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders'] });
      setFolderDialogOpen(false);
      setFolderName('');
      setFolderColor('#3b82f6');
      setEditingFolder(null);
      toast({
        title: "Folder Updated",
        description: "Your folder has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Failed to update folder",
        variant: "destructive",
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/rag-knowledge/folders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      setDeletingFolder(null);
      if (selectedFolderId === deletingFolder?.id) {
        setSelectedFolderId(null);
        setViewMode("dashboard");
      }
      toast({
        title: "Folder Deleted",
        description: "The folder has been deleted. Items moved to uncategorized.",
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Failed to delete folder",
        variant: "destructive",
      });
    },
  });

  const assignFolderMutation = useMutation({
    mutationFn: async (data: { id: string; folderId: string | null }) => {
      const res = await apiRequest('PATCH', `/api/rag-knowledge/${data.id}/folder`, { folderId: data.folderId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rag-knowledge/folders/stats'] });
      toast({
        title: "Item Moved",
        description: "Item has been moved to the selected folder.",
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Failed to move item",
        variant: "destructive",
      });
    },
  });

  const generateMediaMutation = useMutation({
    mutationFn: async (knowledgeBaseId: string) => {
      const res = await apiRequest('POST', `/api/rag-knowledge/generate-media/${knowledgeBaseId}`, { pdf: true, audio: true, images: true });
      return res.json();
    },
    onMutate: (knowledgeBaseId) => {
      setMediaGeneratingIds(prev => new Set(prev).add(knowledgeBaseId));
    },
    onSuccess: (data, knowledgeBaseId) => {
      toast({
        title: "Media Generation Started",
        description: data.message || "Generating PDF, audio, and images...",
      });
      setMediaStatusMap(prev => ({ ...prev, [knowledgeBaseId]: { status: 'generating' } }));
    },
    onError: (error: any, knowledgeBaseId) => {
      setMediaGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(knowledgeBaseId);
        return next;
      });
      toast({
        title: "Media Generation Failed",
        description: error.message || "Could not start media generation.",
        variant: "destructive",
      });
    },
  });

  const pollMediaStatus = useCallback(async (id: string) => {
    try {
      const res = await apiRequest('GET', `/api/rag-knowledge/media-status/${id}`);
      const data = await res.json();
      setMediaStatusMap(prev => ({
        ...prev,
        [id]: {
          status: data.status,
          filesGenerated: data.result?.filesGenerated,
          fileNames: data.result?.fileNames,
        },
      }));
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'none') {
        setMediaGeneratingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (data.status === 'completed') {
          toast({
            title: "Media Generated",
            description: `${data.result?.filesGenerated || 0} file(s) generated successfully.`,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/bedrock-kb/files'] });
        }
      }
    } catch {
      setMediaGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [toast]);

  useEffect(() => {
    if (mediaGeneratingIds.size === 0) return;
    const interval = setInterval(() => {
      mediaGeneratingIds.forEach(id => pollMediaStatus(id));
    }, 5000);
    return () => clearInterval(interval);
  }, [mediaGeneratingIds, pollMediaStatus]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: t('knowledgeBase.toast.fileTooLarge'),
          description: t('knowledgeBase.toast.fileTooLargeDesc'),
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      if (!fileName) {
        setFileName(file.name);
      }
    }
  };

  const handleUploadFile = () => {
    if (!selectedFile) {
      toast({
        title: t('knowledgeBase.toast.noFileSelected'),
        description: t('knowledgeBase.toast.noFileSelectedDesc'),
        variant: "destructive",
      });
      return;
    }
    uploadFileMutation.mutate({ 
      file: selectedFile, 
      name: fileName || selectedFile.name,
      folderId: fileFolderId && fileFolderId !== "none" ? fileFolderId : undefined,
    });
  };

  const handleAddUrl = () => {
    if (!urlInput) {
      toast({
        title: t('knowledgeBase.toast.urlRequired'),
        description: t('knowledgeBase.toast.urlRequiredDesc'),
        variant: "destructive",
      });
      return;
    }
    const normalizedUrl = urlInput.trim().match(/^https?:\/\//i)
      ? urlInput.trim()
      : `https://${urlInput.trim()}`;
    addUrlMutation.mutate({ 
      url: normalizedUrl, 
      name: urlName || normalizedUrl,
      folderId: urlFolderId && urlFolderId !== "none" ? urlFolderId : undefined,
    });
  };

  const handleAddText = () => {
    if (!textInput || !textName) {
      toast({
        title: t('knowledgeBase.toast.requiredFields'),
        description: t('knowledgeBase.toast.requiredFieldsDesc'),
        variant: "destructive",
      });
      return;
    }
    if (textInput.length > 300000) {
      toast({
        title: t('knowledgeBase.toast.textTooLong'),
        description: t('knowledgeBase.toast.textTooLongDesc'),
        variant: "destructive",
      });
      return;
    }
    addTextMutation.mutate({ 
      text: textInput, 
      name: textName,
      folderId: textFolderId && textFolderId !== "none" ? textFolderId : undefined,
    });
  };

  const handleSaveFolder = () => {
    if (!folderName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a folder name.",
        variant: "destructive",
      });
      return;
    }
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, name: folderName, color: folderColor });
    } else {
      createFolderMutation.mutate({ name: folderName, color: folderColor });
    }
  };

  const filteredItems = useMemo(() => {
    return knowledgeBase.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFolder = viewMode === "dashboard" || 
        (selectedFolderId === null ? !item.folderId : item.folderId === selectedFolderId);
      return matchesSearch && matchesFolder;
    });
  }, [knowledgeBase, searchQuery, viewMode, selectedFolderId]);

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    handlePageChange,
    handleItemsPerPageChange,
  } = usePagination(filteredItems, 10);

  const formatBytes = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="h-4 w-4 text-orange-500" />;
      case 'file':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'text':
        return <Type className="h-4 w-4 text-blue-500" />;
      default:
        return <FileType className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case 'url':
        return 'default';
      case 'file':
        return 'secondary';
      case 'text':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const topCategories = useMemo(() => {
    if (!folders || !folderStats) return [];
    return folders
      .map(folder => ({
        ...folder,
        count: folderStats.folders[folder.id] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [folders, folderStats]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex h-[calc(100vh-180px)] border rounded-lg bg-background overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <h2 className="text-xl font-semibold mb-2">{t('knowledgeBase.unableToLoad')}</h2>
            <p className="text-muted-foreground">
              {t('knowledgeBase.unableToLoadDesc')}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const isFreeUser = user?.planType === 'free';

  if (isFreeUser) {
    return (
      <div className="flex h-[calc(100vh-180px)] border rounded-lg bg-background overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-6 text-center">
            <div className="flex justify-center">
              <div className="relative">
                <BookOpen className="w-20 h-20 text-muted-foreground/30" />
                <Lock className="w-8 h-8 text-primary absolute -bottom-1 -right-1 bg-background rounded-full p-1" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">{t('knowledgeBase.unlock.title')}</h2>
              <p className="text-muted-foreground text-lg">
                {t('knowledgeBase.unlock.description')}
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg mb-4">{t('knowledgeBase.unlock.proFeatures')}</h3>
              <div className="grid gap-3 text-left">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.uploadDocs')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.uploadDocsDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.addWebContent')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.addWebContentDesc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t('knowledgeBase.unlock.aiSearch')}</p>
                    <p className="text-sm text-muted-foreground">{t('knowledgeBase.unlock.aiSearchDesc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                size="lg" 
                className="gap-2"
                onClick={() => setLocation('/app/upgrade')}
                data-testid="button-upgrade-to-pro"
              >
                <Crown className="w-5 h-5" />
                {t('knowledgeBase.unlock.upgradeButton')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const urlCount = dashboardStats?.typeDistribution?.url || 0;
  const textCount = dashboardStats?.typeDistribution?.text || 0;
  const fileCount = dashboardStats?.typeDistribution?.file || 0;

  const processingCount = knowledgeBase.filter(item => item.ragStatus === 'processing').length;

  const subPanelContent = (
    <>
      <SubPanelSection>
        <SubPanelItem
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Library Overview"
          isActive={viewMode === "dashboard"}
          onClick={() => { setViewMode("dashboard"); setSelectedFolderId(null); }}
          data-testid="sidebar-library-overview"
        />
        <SubPanelItem
          icon={<BarChart3 className="h-4 w-4" />}
          label="ML Conversations"
          isActive={viewMode === "ml-conversations"}
          onClick={() => { setViewMode("ml-conversations"); setSelectedFolderId(null); }}
          data-testid="sidebar-ml-conversations"
        />
        <SubPanelItem
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Products & Pricing"
          isActive={viewMode === "products"}
          onClick={() => { setViewMode("products"); setSelectedFolderId(null); }}
          data-testid="sidebar-products"
        />
      </SubPanelSection>

      {/* Knowledge Sources Section */}
      <SubPanelSection>
        <div className="mt-0 mb-2">
          <div
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-zinc-600 dark:text-zinc-400 font-semibold"
            data-testid="knowledge-sources-header"
          >
            <Database className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1 text-left uppercase tracking-wider">Knowledge Base Sources</span>
          </div>

          <div className="mt-2 space-y-1 px-2">
            {folders.filter((folder) => !['Integrations', 'Troubleshooting', 'Getting Started'].includes(folder.name)).map((folder) => {
              const isExpanded = expandedFolderIds.has(folder.id);
              const isActive = selectedFolderId === folder.id && viewMode === "folder";
              const folderItems = knowledgeBase.filter(item => item.folderId === folder.id);
              const itemCount = folderStats?.folders[folder.id] || 0;
              return (
                <div key={folder.id}>
                  <div className="group relative flex items-center">
                    <button
                      onClick={() => {
                        setExpandedFolderIds(prev => {
                          const next = new Set(prev);
                          if (next.has(folder.id)) next.delete(folder.id);
                          else next.add(folder.id);
                          return next;
                        });
                      }}
                      className="flex-shrink-0 p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      data-testid={`button-toggle-folder-${folder.id}`}
                    >
                      <ChevronRight className={cn("h-2.5 w-2.5 transition-transform duration-150", isExpanded && "rotate-90")} />
                    </button>
                    <button
                      onClick={() => { setViewMode("folder"); setSelectedFolderId(folder.id); }}
                      className={cn(
                        "flex-1 flex items-center gap-1.5 px-1 py-1 text-[12px] text-left transition-colors rounded-md",
                        isActive
                          ? "bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30"
                      )}
                      data-testid={`folder-${folder.id}`}
                    >
                      <Folder className="h-3 w-3 flex-shrink-0" style={{ color: folder.color || 'var(--muted-foreground)' }} />
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums shrink-0">{itemCount}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0 invisible group-hover:visible"
                        >
                          <MoreHorizontal className="h-2.5 w-2.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuItem onClick={() => {
                          setEditingFolder(folder);
                          setFolderName(folder.name);
                          setFolderColor(folder.color || '#3b82f6');
                          setFolderDialogOpen(true);
                        }}>
                          <Pencil className="h-3 w-3 mr-1.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingFolder(folder)}
                        >
                          <Trash2 className="h-3 w-3 mr-1.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {isExpanded && (
                    <div className="ml-4 border-l border-zinc-200 dark:border-zinc-700/50">
                      {folderItems.length === 0 ? (
                        <p className="px-2 py-1 text-[10px] text-zinc-400 dark:text-zinc-500 italic">No items</p>
                      ) : (
                        folderItems.map(item => (
                          <button
                            key={item.id}
                            onClick={() => { setViewMode("folder"); setSelectedFolderId(folder.id); setExpandedItemId(item.id); }}
                            className="w-full flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors truncate"
                            data-testid={`folder-item-${item.id}`}
                          >
                            <FileText className="h-2.5 w-2.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
                            <span className="truncate">{item.title}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => {
                setEditingFolder(null);
                setFolderName('');
                setFolderColor('#3b82f6');
                setFolderDialogOpen(true);
              }}
              className="w-full flex items-center justify-center gap-1 py-1 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-md hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 mt-1"
              data-testid="button-new-folder"
            >
              <Plus className="h-3 w-3" />
              <span>New Folder</span>
            </button>
          </div>
        </div>
      </SubPanelSection>

      {storageUsage && (
        <div className="px-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground mb-1">
            Storage: {formatBytes(storageUsage.usedStorageBytes)} / {formatBytes(storageUsage.maxStorageBytes)}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(storageUsage.usagePercent, 100)}%` }}
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <ThreeColumnLayout
      subPanel={subPanelContent}
      subPanelWidth="md"
      subPanelHeader={<span className="font-medium text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary" />Knowledge Base</span>}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b">
          <div className="flex items-center justify-between p-4 gap-4">
            {viewMode === "dashboard" && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {dashboardStats?.totalResources || 0} knowledge sources · {dashboardStats?.totalChunks || 0} knowledge chunks indexed
                </p>
              </div>
            )}

          <div className="flex items-center gap-2">
            {viewMode === "dashboard" && (
              <>
                <Button 
                  size="sm" 
                  className="gap-1.5"
                  onClick={() => setUrlDialogOpen(true)}
                  data-testid="button-add-url"
                >
                  <Link className="h-4 w-4" />
                  URL
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5"
                  onClick={() => setFileDialogOpen(true)}
                  data-testid="button-add-files"
                >
                  <FileText className="h-4 w-4" />
                  Files
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5"
                  onClick={() => setTextDialogOpen(true)}
                  data-testid="button-add-text"
                >
                  <Type className="h-4 w-4" />
                  Text
                </Button>
                {knowledgeBase.length > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="gap-1.5"
                    onClick={() => setPurgeDialogOpen(true)}
                    data-testid="button-delete-all"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete All
                  </Button>
                )}
              </>
            )}

            {/* Pipeline Progress */}
            {activePipelineJob && activePipelineJob.currentStage === "done" ? (
              <div className="flex items-start gap-2 text-sm bg-green-500/10 px-3 py-2 rounded-md border border-green-500/30 min-w-0 max-w-xl" data-testid="banner-pipeline-done">
                <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400 leading-tight">
                    {activePipelineJob.stageDetails?.analyzing?.businessType
                      ? `${activePipelineJob.stageDetails.analyzing.businessType} — Knowledge Base Ready`
                      : 'Knowledge Base Ready'}
                  </span>
                  {activePipelineJob.stageDetails?.generating?.folderResults && (
                    <span className="text-xs text-muted-foreground leading-snug" data-testid="text-category-summary">
                      {Object.entries(activePipelineJob.stageDetails.generating.folderResults)
                        .filter(([, n]) => n > 0)
                        .map(([cat, n]) => `${cat}: ${n}`)
                        .join(' · ')}
                    </span>
                  )}
                  {!activePipelineJob.stageDetails?.generating?.folderResults && (
                    <span className="text-xs text-muted-foreground leading-tight">
                      {activePipelineJob.stageDetails?.generating?.articlesGenerated ?? 0} articles generated
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground shrink-0"
                  onClick={() => queryClient.setQueryData(['/api/knowledge-intelligence/pipeline-jobs/active'], null)}
                  data-testid="button-dismiss-done-banner"
                >
                  ✕
                </Button>
              </div>
            ) : activePipelineJob && ["pending", "crawling", "analyzing", "generating"].includes(activePipelineJob.status) && (
              <div className="flex items-center gap-2 text-sm bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20 min-w-0 max-w-md">
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  {activePipelineJob.currentStage === "generating_articles" && activePipelineJob.stageDetails?.generating?.isUrlEnrichment ? (
                    <>
                      {activePipelineJob.stageDetails.analyzing?.businessType && (
                        <span className="text-xs font-semibold text-primary truncate leading-tight">
                          {activePipelineJob.stageDetails.analyzing.businessType}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground truncate leading-tight">
                        {activePipelineJob.stageDetails.generating.currentCategory
                          ? `Generating articles — ${activePipelineJob.stageDetails.generating.currentCategory}`
                          : 'Generating articles…'}
                      </span>
                    </>
                  ) : activePipelineJob.currentStage === "generating" && activePipelineJob.stageDetails?.generating?.currentArticleTitle ? (
                    <>
                      <span className="text-xs font-medium text-primary truncate leading-tight">
                        {activePipelineJob.stageDetails.generating.currentCategory}
                      </span>
                      <span className="text-xs text-muted-foreground italic truncate leading-tight">
                        {activePipelineJob.stageDetails.generating.currentArticleTitle}
                      </span>
                    </>
                  ) : activePipelineJob.currentStage === "fetching" ? (
                    <span className="text-xs font-medium text-primary truncate">Fetching URL content…</span>
                  ) : activePipelineJob.currentStage === "analyzing_content" ? (
                    <span className="text-xs font-medium text-primary truncate">Analyzing content…</span>
                  ) : activePipelineJob.currentStage === "detecting_business" ? (
                    <span className="text-xs font-medium text-primary truncate">Detecting business type…</span>
                  ) : activePipelineJob.currentStage === "analyzing" && activePipelineJob.stageDetails?.analyzing?.isUrlEnrichment ? (
                    <span className="text-xs font-medium text-primary truncate">Detecting business type…</span>
                  ) : activePipelineJob.currentStage === "analyzing" ? (
                    <span className="text-xs font-medium text-primary truncate">Analyzing content…</span>
                  ) : activePipelineJob.currentStage === "crawling" ? (
                    <span className="text-xs font-medium text-primary truncate">
                      Crawling{activePipelineJob.stageDetails?.crawling?.pagesCrawled ? ` • ${activePipelineJob.stageDetails.crawling.pagesCrawled} pages` : '…'}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-primary truncate">{activePipelineJob.name}</span>
                  )}
                </div>
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ width: `${activePipelineJob.overallProgress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{activePipelineJob.overallProgress}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => cancelPipelineMutation.mutate(activePipelineJob.id)}
                  disabled={cancelPipelineMutation.isPending}
                  title="Stop pipeline"
                  data-testid="button-stop-pipeline"
                >
                  <Square className="h-3.5 w-3.5 fill-current mr-1" />
                  Stop
                </Button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {viewMode === "web-crawler" ? (
              <KnowledgeIntelligence section="crawl" />
            ) : viewMode === "ai-insights" ? (
              <KnowledgeIntelligence section="insights" />
            ) : viewMode === "content-studio" ? (
              <KnowledgeIntelligence section="content-studio" />
            ) : viewMode === "entities" ? (
              <KnowledgeIntelligence section="entities" />
            ) : viewMode === "topic-clusters" ? (
              <KnowledgeIntelligence section="topic-clusters" />
            ) : viewMode === "faqs" ? (
              <KnowledgeIntelligence section="faqs" />
            ) : viewMode === "content-gaps" ? (
              <KnowledgeIntelligence section="content-gaps" />
            ) : viewMode === "ml-conversations" ? (
              <KnowledgeIntelligence section="ml-conversations" />
            ) : viewMode === "ml-operations" ? (
              <KnowledgeIntelligence section="ml-operations" />
            ) : viewMode === "ml-insights" ? (
              <KnowledgeIntelligence section="ml-insights" />
            ) : viewMode === "products" ? (
              <ProductsInventoryView />
            ) : viewMode === "bedrock-kb" ? (
              <div className="space-y-6">
                {bedrockStatusLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <div className="h-5 w-5 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Database className="h-3 w-3 text-amber-500" />
                          </div>
                          Bedrock AI Knowledge Base Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {bedrockStatus?.provisioned ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="default" data-testid="badge-bedrock-status">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                              {bedrockStatus.bedrockKbId && (
                                <Badge variant="outline" data-testid="badge-bedrock-kb-id">
                                  KB ID: {bedrockStatus.bedrockKbId}
                                </Badge>
                              )}
                              <Badge variant="secondary">
                                {bedrockStatus.fileCount || 0} file(s)
                              </Badge>
                              {bedrockStatus.region && (
                                <Badge variant="outline" data-testid="badge-bedrock-region">
                                  {bedrockStatus.region}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-800/30">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-1">Primary AI Model</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100" data-testid="text-bedrock-ai-model">
                                  {bedrockStatus.aiModel || "Claude Sonnet 4.6"}
                                </p>
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5" data-testid="text-bedrock-ai-model-id">
                                  {bedrockStatus.aiModelId || "global.anthropic.claude-sonnet-4-6"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-800/30">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-1">Fallback Model</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100" data-testid="text-bedrock-fallback-model">
                                  {bedrockStatus.fallbackModel || "Claude Opus 4.5"}
                                </p>
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5" data-testid="text-bedrock-fallback-model-id">
                                  {bedrockStatus.fallbackModelId || "us.anthropic.claude-opus-4-5-20251101-v1:0"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-800/30">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-1">Embedding Model</p>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100" data-testid="text-bedrock-embedding-model">
                                  {bedrockStatus.embeddingModel || "Titan Embed Text v2"}
                                </p>
                                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                                  amazon.titan-embed-text-v2:0
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => bedrockSyncMutation.mutate()}
                                disabled={bedrockSyncMutation.isPending}
                                data-testid="button-bedrock-sync"
                              >
                                {bedrockSyncMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-1.5" />
                                )}
                                Sync / Re-index
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" data-testid="badge-bedrock-not-provisioned">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Not Provisioned
                              </Badge>
                              {bedrockStatus?.configured === false && (
                                <Badge variant="destructive">
                                  Not Configured
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {bedrockStatus?.configured === false
                                ? "Bedrock Knowledge Base is not configured by the administrator. Contact support."
                                : "Provision a Bedrock AI Knowledge Base to upload files and enable AI-powered retrieval during calls."}
                            </p>
                            {bedrockStatus?.configured !== false && (
                              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-800/30 mt-2">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-1.5">Powered By</p>
                                <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-600 dark:text-zinc-400">
                                  <span><span className="font-medium text-zinc-800 dark:text-zinc-200">Claude Sonnet 4.6</span> (Primary)</span>
                                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                                  <span><span className="font-medium text-zinc-800 dark:text-zinc-200">Claude Opus 4.5</span> (Fallback)</span>
                                  <span className="text-zinc-300 dark:text-zinc-600">|</span>
                                  <span><span className="font-medium text-zinc-800 dark:text-zinc-200">Titan Embed v2</span> (Embeddings)</span>
                                </div>
                              </div>
                            )}
                            {bedrockStatus?.configured !== false && (
                              <Button
                                onClick={() => bedrockProvisionMutation.mutate()}
                                disabled={bedrockProvisionMutation.isPending}
                                data-testid="button-bedrock-provision"
                              >
                                {bedrockProvisionMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                    Provisioning...
                                  </>
                                ) : (
                                  <>
                                    <Database className="h-4 w-4 mr-1.5" />
                                    Provision Knowledge Base
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {bedrockStatus?.provisioned && (
                      <>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Upload className="h-3 w-3 text-blue-500" />
                              </div>
                              Upload Files
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              Upload images, audio, video, PDFs, and text files (max 50MB)
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div
                              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-primary/50"
                              onClick={() => bedrockFileInputRef.current?.click()}
                              data-testid="bedrock-upload-area"
                            >
                              <input
                                ref={bedrockFileInputRef}
                                type="file"
                                className="hidden"
                                accept="image/*,audio/*,video/*,.pdf,.txt,.csv,.json,.xml,.html,.md,.doc,.docx,.xls,.xlsx"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    bedrockUploadMutation.mutate(file);
                                    e.target.value = '';
                                  }
                                }}
                                data-testid="input-bedrock-file"
                              />
                              {bedrockUploadMutation.isPending ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                  <p className="text-sm text-muted-foreground">Uploading...</p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <Upload className="h-8 w-8 text-muted-foreground" />
                                  <p className="text-sm font-medium">Click to upload a file</p>
                                  <p className="text-xs text-muted-foreground">
                                    PDF, images, audio, video, text, CSV, JSON, XML, DOC, XLS
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="h-5 w-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <FileText className="h-3 w-3 text-green-500" />
                              </div>
                              Uploaded Files
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {bedrockFiles.length} file(s) in knowledge base
                            </p>
                          </CardHeader>
                          <CardContent className="p-0">
                            {bedrockFilesLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : bedrockFiles.length === 0 ? (
                              <div className="text-center py-8 text-sm text-muted-foreground">
                                No files uploaded yet. Upload files above to get started.
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>File</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="hidden md:table-cell">Size</TableHead>
                                    <TableHead className="hidden md:table-cell">Status</TableHead>
                                    <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                                    <TableHead className="w-[60px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bedrockFiles.map((file) => (
                                    <TableRow key={file.id} data-testid={`row-bedrock-file-${file.id}`}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          {getBedrockFileIcon(file.mimeType)}
                                          <span className="text-sm truncate max-w-[200px]">{file.fileName}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs">{file.fileType || file.mimeType}</Badge>
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                        {formatBytes(file.sizeBytes)}
                                      </TableCell>
                                      <TableCell className="hidden md:table-cell">
                                        <Badge variant={file.status === 'active' || file.status === 'uploaded' ? 'default' : 'secondary'} className="text-xs">
                                          {file.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                        {new Date(file.createdAt).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => bedrockDeleteFileMutation.mutate(file.id)}
                                          disabled={bedrockDeleteFileMutation.isPending}
                                          data-testid={`button-bedrock-delete-file-${file.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <div className="h-5 w-5 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Search className="h-3 w-3 text-purple-500" />
                              </div>
                              Test Query
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              Preview retrieval results from your Bedrock Knowledge Base
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Enter a test query..."
                                  value={bedrockQueryInput}
                                  onChange={(e) => setBedrockQueryInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && bedrockQueryInput.trim()) {
                                      bedrockQueryMutation.mutate(bedrockQueryInput.trim());
                                    }
                                  }}
                                  data-testid="input-bedrock-query"
                                />
                                <Button
                                  onClick={() => {
                                    if (bedrockQueryInput.trim()) {
                                      bedrockQueryMutation.mutate(bedrockQueryInput.trim());
                                    }
                                  }}
                                  disabled={bedrockQueryMutation.isPending || !bedrockQueryInput.trim()}
                                  data-testid="button-bedrock-query"
                                >
                                  {bedrockQueryMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Search className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>

                              {bedrockQueryResults.length > 0 && (
                                <div className="space-y-3" data-testid="bedrock-query-results">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {bedrockQueryResults.length} result(s)
                                  </p>
                                  {bedrockQueryResults.map((result, index) => (
                                    <div key={index} className="p-3 rounded-lg bg-muted/40 space-y-1" data-testid={`bedrock-query-result-${index}`}>
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <Badge variant="secondary" className="text-xs">
                                          Score: {(result.score * 100).toFixed(1)}%
                                        </Badge>
                                        {result.sourceUri && (
                                          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                            {result.sourceUri}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{result.text}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : viewMode === "dashboard" ? (
              /* Dashboard View */
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Your Usage Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        </div>
                        Your Usage
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Content types distribution</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <DonutChart urlCount={urlCount} textCount={textCount} fileCount={fileCount} />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="h-3 w-3 rounded-full bg-orange-500" />
                            <span>URLs</span>
                            <span className="font-medium ml-auto">{urlCount}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="h-3 w-3 rounded-full bg-blue-500" />
                            <span>Text</span>
                            <span className="font-medium ml-auto">{textCount}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="h-3 w-3 rounded-full bg-green-500" />
                            <span>Files</span>
                            <span className="font-medium ml-auto">{fileCount}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t text-sm text-muted-foreground">
                        Total Size: {formatBytes(dashboardStats?.totalSize || 0)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Categories Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Folder className="h-3 w-3 text-purple-500" />
                        </div>
                        Top Categories
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Folders by item count</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {topCategories.length > 0 ? (
                          topCategories.map((folder, index) => (
                            <button
                              key={folder.id}
                              onClick={() => {
                                setViewMode("folder");
                                setSelectedFolderId(folder.id);
                              }}
                              className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate transition-colors text-left"
                            >
                              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </span>
                              <Folder className="h-4 w-4" style={{ color: folder.color || '#3b82f6' }} />
                              <span className="flex-1 text-sm truncate">{folder.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {folder.count} items
                              </Badge>
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground py-4 text-center">
                            No folders yet. Create one to organize your content.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Items Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <RefreshCw className="h-3 w-3 text-green-500" />
                        </div>
                        Recent Items
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Latest additions</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dashboardStats?.recentItems && dashboardStats.recentItems.length > 0 ? (
                          dashboardStats.recentItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-2 rounded-md">
                              {getTypeIcon(item.type)}
                              <span className="flex-1 text-sm truncate">{item.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground py-4 text-center">
                            No items yet. Add your first content.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Processing indicator */}
                {processingCount > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 flex items-center gap-3 border border-blue-200 dark:border-blue-800">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Processing {processingCount} item(s)...
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-auto h-7 text-blue-600"
                      onClick={() => refetch()}
                      data-testid="button-refresh-status"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                )}

                {/* All Items Table */}
                {knowledgeBase.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">All Items</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Folder</TableHead>
                            <TableHead className="hidden md:table-cell">Status</TableHead>
                            <TableHead className="hidden lg:table-cell">Created</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedItems.map((item) => (
                            <Fragment key={item.id}>
                              <TableRow 
                                data-testid={`row-kb-item-${item.id}`}
                                className="cursor-pointer"
                                onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-start gap-2">
                                    <div className="mt-0.5">{getTypeIcon(item.type)}</div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate max-w-[200px]">{item.title}</span>
                                      {item.type === "url" && item.url && (
                                        <a 
                                          href={item.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-muted-foreground hover:text-primary truncate max-w-[250px]"
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`link-url-index-${item.id}`}
                                        >
                                          {item.url}
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getTypeBadgeVariant(item.type)}>
                                    {item.type}
                                  </Badge>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Select
                                    value={item.folderId || "uncategorized"}
                                    onValueChange={(value) => {
                                      assignFolderMutation.mutate({
                                        id: item.id,
                                        folderId: value === "uncategorized" ? null : value,
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="uncategorized">Index</SelectItem>
                                      {folders.map((folder) => (
                                        <SelectItem key={folder.id} value={folder.id}>
                                          {folder.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(item.ragStatus)}
                                    <div className="flex flex-col">
                                      <span className="text-sm text-muted-foreground">
                                        {item.ragStatus === 'completed' ? 'Ready' : 
                                         item.ragStatus === 'processing' ? 'Processing' : 
                                         item.ragStatus === 'failed' ? 'Failed' : 'Pending'}
                                      </span>
                                      {item.chunkCount && item.chunkCount > 0 && (
                                        <span className="text-xs text-muted-foreground">{item.chunkCount} chunks</span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden lg:table-cell">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {(item.type === 'file' || item.type === 'url') && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={mediaGeneratingIds.has(item.id)}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              generateMediaMutation.mutate(item.id);
                                            }}
                                            data-testid={`button-generate-media-${item.id}`}
                                          >
                                            {mediaGeneratingIds.has(item.id) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Wand2 className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Generate Media (PDF, Audio, Images)</TooltipContent>
                                      </Tooltip>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingItem(item);
                                        setEditTitle(item.title);
                                        setEditContent(item.content || '');
                                      }}
                                      data-testid={`button-edit-${item.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => { e.stopPropagation(); setDeletingItem(item); }}
                                      data-testid={`button-delete-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedItemId === item.id && (
                                <TableRow>
                                  <TableCell colSpan={6} className="bg-muted/30 p-0">
                                    <div className="p-4 space-y-2">
                                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        <BookOpen className="h-3 w-3" />
                                        Content Preview (What the AI agent reads)
                                      </div>
                                      <div className="bg-background rounded-md border p-3 max-h-[200px] overflow-auto">
                                        <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                                          {item.content 
                                            ? (item.content.replace(/```(\w*)\n[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1')).substring(0, 1000) + (item.content.length > 1000 ? '\n\n... [truncated]' : '')
                                            : item.url 
                                              ? `Source URL: ${item.url}\n\nContent is processed into ${item.chunkCount || 0} searchable chunks.`
                                              : 'No content preview available.'}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>Size: {item.storageSize ? `${(item.storageSize / 1024).toFixed(1)} KB` : 'N/A'}</span>
                                        <span>Chunks: {item.chunkCount || 0}</span>
                                        <span>Status: {item.ragStatus === 'completed' ? 'Ready for AI' : item.ragStatus || 'Pending'}</span>
                                      </div>
                                      {mediaStatusMap[item.id] && (
                                        <div className="flex items-center gap-2 text-xs" data-testid={`media-status-${item.id}`}>
                                          {mediaStatusMap[item.id].status === 'generating' && (
                                            <>
                                              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                              <span className="text-blue-600 dark:text-blue-400">Generating PDF, audio, images...</span>
                                            </>
                                          )}
                                          {mediaStatusMap[item.id].status === 'completed' && (
                                            <>
                                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                                              <span className="text-green-600 dark:text-green-400">{mediaStatusMap[item.id].filesGenerated || 0} files generated</span>
                                            </>
                                          )}
                                          {mediaStatusMap[item.id].status === 'failed' && (
                                            <>
                                              <AlertCircle className="h-3 w-3 text-red-500" />
                                              <span className="text-red-600 dark:text-red-400">Media generation failed</span>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {knowledgeBase.length === 0 && (
                  <Card className="p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                        <Brain className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2" data-testid="text-empty-library">No Knowledge Sources Yet</h3>
                      <p className="text-muted-foreground mb-2 max-w-lg">
                        No knowledge sources added yet. Use the ML Library tools to build your AI's knowledge base.
                      </p>
                      <p className="text-xs text-muted-foreground mb-6 max-w-md">
                        The AI will only answer questions based on these sources -- never from general knowledge.
                      </p>
                    </div>
                  </Card>
                )}

                {totalPages > 1 && (
                  <DataPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                  />
                )}
              </div>
            ) : (
              /* Folder View */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <button onClick={() => setViewMode("dashboard")} className="hover:text-foreground">
                    Library Overview
                  </button>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-foreground font-medium">
                    {selectedFolderId 
                      ? folders.find(f => f.id === selectedFolderId)?.name || "Folder"
                      : "Index"}
                  </span>
                </div>

                {filteredItems.length === 0 ? (
                  <Card className="p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Folder className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No items in this folder</h3>
                      <p className="text-muted-foreground mb-6">
                        Add content and assign it to this folder.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="hidden md:table-cell">Status</TableHead>
                              <TableHead className="hidden sm:table-cell">Size</TableHead>
                              <TableHead className="hidden lg:table-cell">Created</TableHead>
                              <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedItems.map((item) => (
                              <Fragment key={item.id}>
                                <TableRow 
                                  data-testid={`row-kb-item-${item.id}`}
                                  className="cursor-pointer"
                                  onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-start gap-2">
                                      <div className="mt-0.5">{getTypeIcon(item.type)}</div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate max-w-[200px]">{item.title}</span>
                                        {item.type === "url" && item.url && (
                                          <a 
                                            href={item.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-muted-foreground hover:text-primary truncate max-w-[250px]"
                                            onClick={(e) => e.stopPropagation()}
                                            data-testid={`link-url-${item.id}`}
                                          >
                                            {item.url}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={getTypeBadgeVariant(item.type)}>
                                      {item.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    <div className="flex items-center gap-2">
                                      {getStatusIcon(item.ragStatus)}
                                      <div className="flex flex-col">
                                        <span className="text-sm text-muted-foreground">
                                          {item.ragStatus === 'completed' ? 'Ready' : 
                                           item.ragStatus === 'processing' ? 'Processing' : 
                                           item.ragStatus === 'failed' ? 'Failed' : 'Pending'}
                                        </span>
                                        {item.chunkCount && item.chunkCount > 0 && (
                                          <span className="text-xs text-muted-foreground">{item.chunkCount} chunks</span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                                    {formatBytes(item.storageSize)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground hidden lg:table-cell">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {(item.type === 'file' || item.type === 'url') && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              disabled={mediaGeneratingIds.has(item.id)}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                generateMediaMutation.mutate(item.id);
                                              }}
                                              data-testid={`button-generate-media-folder-${item.id}`}
                                            >
                                              {mediaGeneratingIds.has(item.id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Wand2 className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Generate Media (PDF, Audio, Images)</TooltipContent>
                                        </Tooltip>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingItem(item);
                                          setEditTitle(item.title);
                                          setEditContent(item.content || '');
                                        }}
                                        data-testid={`button-edit-${item.id}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); setDeletingItem(item); }}
                                        data-testid={`button-delete-${item.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {expandedItemId === item.id && (
                                  <TableRow>
                                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                                      <div className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                          <BookOpen className="h-3 w-3" />
                                          Content Preview (What the AI agent reads)
                                        </div>
                                        <div className="bg-background rounded-md border p-3 max-h-[200px] overflow-auto">
                                          <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                                            {item.content 
                                              ? (item.content.replace(/```(\w*)\n[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1')).substring(0, 1000) + (item.content.length > 1000 ? '\n\n... [truncated]' : '')
                                              : item.url 
                                                ? `Source URL: ${item.url}\n\nContent is processed into ${item.chunkCount || 0} searchable chunks.`
                                                : 'No content preview available.'}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                          <span>Size: {item.storageSize ? `${(item.storageSize / 1024).toFixed(1)} KB` : 'N/A'}</span>
                                          <span>Chunks: {item.chunkCount || 0}</span>
                                          <span>Status: {item.ragStatus === 'completed' ? 'Ready for AI' : item.ragStatus || 'Pending'}</span>
                                        </div>
                                        {mediaStatusMap[item.id] && (
                                          <div className="flex items-center gap-2 text-xs" data-testid={`media-status-folder-${item.id}`}>
                                            {mediaStatusMap[item.id].status === 'generating' && (
                                              <>
                                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                                <span className="text-blue-600 dark:text-blue-400">Generating PDF, audio, images...</span>
                                              </>
                                            )}
                                            {mediaStatusMap[item.id].status === 'completed' && (
                                              <>
                                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                <span className="text-green-600 dark:text-green-400">{mediaStatusMap[item.id].filesGenerated || 0} files generated</span>
                                              </>
                                            )}
                                            {mediaStatusMap[item.id].status === 'failed' && (
                                              <>
                                                <AlertCircle className="h-3 w-3 text-red-500" />
                                                <span className="text-red-600 dark:text-red-400">Media generation failed</span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    {totalPages > 1 && (
                      <DataPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* URL Dialog */}
      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('knowledgeBase.dialog.addUrl.title')}</DialogTitle>
            <DialogDescription>
              {t('knowledgeBase.dialog.addUrl.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">{t('knowledgeBase.labels.url')}</Label>
              <Input
                id="url"
                placeholder={t('knowledgeBase.placeholders.url')}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                data-testid="input-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-name">{t('knowledgeBase.labels.nameOptional')}</Label>
              <Input
                id="url-name"
                placeholder={t('knowledgeBase.placeholders.urlName')}
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                data-testid="input-url-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-folder">Folder (Optional)</Label>
              <Select value={urlFolderId} onValueChange={setUrlFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleAddUrl} 
              disabled={addUrlMutation.isPending}
              data-testid="button-submit-url"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {addUrlMutation.isPending
                ? 'Adding & Analyzing...' 
                : 'Add URL & Analyze'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Dialog */}
      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('knowledgeBase.dialog.uploadFile.title')}</DialogTitle>
            <DialogDescription>
              {t('knowledgeBase.dialog.uploadFile.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">{t('knowledgeBase.labels.file')}</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  id="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".txt,.md,.html,.htm,.json,.xml,.csv"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                  data-testid="button-select-file"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedFile ? selectedFile.name : t('knowledgeBase.actions.chooseFile')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-name">{t('knowledgeBase.labels.nameOptional')}</Label>
              <Input
                id="file-name"
                placeholder={t('knowledgeBase.placeholders.fileName')}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                data-testid="input-file-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-folder">Folder (Optional)</Label>
              <Select value={fileFolderId} onValueChange={setFileFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFileDialogOpen(false);
              setSelectedFile(null);
              setFileName('');
              setFileFolderId('');
            }}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleUploadFile} 
              disabled={!selectedFile || uploadFileMutation.isPending}
              data-testid="button-submit-file"
            >
              {uploadFileMutation.isPending ? t('knowledgeBase.actions.uploading') : t('knowledgeBase.actions.uploadFile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('knowledgeBase.dialog.createText.title')}</DialogTitle>
            <DialogDescription>
              {t('knowledgeBase.dialog.createText.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="text-name">{t('common.name')}</Label>
              <Input
                id="text-name"
                placeholder={t('knowledgeBase.placeholders.textName')}
                value={textName}
                onChange={(e) => setTextName(e.target.value)}
                data-testid="input-text-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-folder">Folder (Optional)</Label>
              <Select value={textFolderId} onValueChange={setTextFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content">{t('knowledgeBase.labels.content')}</Label>
              <Textarea
                id="text-content"
                placeholder={t('knowledgeBase.placeholders.textContent')}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={10}
                className="resize-none font-mono text-sm"
                data-testid="input-text-content"
              />
              <p className="text-xs text-muted-foreground">
                {textInput.length.toLocaleString()} / 300,000 {t('knowledgeBase.labels.characters')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleAddText} 
              disabled={addTextMutation.isPending}
              data-testid="button-submit-text"
            >
              {addTextMutation.isPending ? t('knowledgeBase.actions.adding') : t('knowledgeBase.actions.addText')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={(open) => {
        setFolderDialogOpen(open);
        if (!open) {
          setEditingFolder(null);
          setFolderName('');
          setFolderColor('#3b82f6');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Edit Folder" : "Create New Folder"}</DialogTitle>
            <DialogDescription>
              {editingFolder ? "Update the folder name and color." : "Create a new folder to organize your knowledge base items."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Enter folder name..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                data-testid="input-folder-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setFolderColor(color.value)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      folderColor === color.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSaveFolder}
              disabled={createFolderMutation.isPending || updateFolderMutation.isPending}
              data-testid="button-save-folder"
            >
              {(createFolderMutation.isPending || updateFolderMutation.isPending) ? "Saving..." : (editingFolder ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => {
        if (!open) {
          setEditingItem(null);
          setEditTitle('');
          setEditContent('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Article</DialogTitle>
            <DialogDescription>
              Update the title and content of this knowledge base article. Changes will be re-indexed for AI search.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                placeholder="Article title..."
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="input-edit-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                placeholder="Article content..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={15}
                className="resize-none font-mono text-sm"
                data-testid="input-edit-content"
              />
              <p className="text-xs text-muted-foreground">
                {editContent.length.toLocaleString()} characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingItem(null);
              setEditTitle('');
              setEditContent('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingItem) {
                  updateItemMutation.mutate({
                    id: editingItem.id,
                    title: editTitle,
                    content: editContent,
                  });
                }
              }}
              disabled={updateItemMutation.isPending || !editTitle.trim()}
              data-testid="button-submit-edit"
            >
              {updateItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledgeBase.dialog.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledgeBase.dialog.delete.description', { title: deletingItem?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingItem && deleteMutation.mutate(deletingItem.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={!!deletingFolder} onOpenChange={() => setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"? Items in this folder will be moved to uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFolder && deleteFolderMutation.mutate(deletingFolder.id)}
              disabled={deleteFolderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Resources</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {knowledgeBase.length} resource(s) and their associated chunks from your knowledge base. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-purge">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purgeAllMutation.mutate()}
              disabled={purgeAllMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-purge"
            >
              {purgeAllMutation.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ThreeColumnLayout>
  );
}
