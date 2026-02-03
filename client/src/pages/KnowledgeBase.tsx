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
import { useState, useRef, useMemo } from "react";
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
  Phone
} from "lucide-react";
import KnowledgeIntelligence from "@/components/knowledge-intelligence";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [viewMode, setViewMode] = useState<"dashboard" | "folder" | "ai-insights" | "content-studio" | "entities" | "topic-clusters" | "faqs" | "content-gaps" | "ml-conversations">("dashboard");
  
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

  // Intelligence stats for header
  interface IntelligenceStats {
    crawlJobs: number;
    entities: number;
    topics: number;
    faqs: number;
    articles: number;
    graphNodes: number;
  }

  interface PipelineJob {
    id: string;
    name: string;
    status: string;
    currentStage: string;
    overallProgress: number;
    stageProgress: number;
    estimatedTimeRemaining: number | null;
  }

  const { data: intelligenceStats } = useQuery<IntelligenceStats>({
    queryKey: ["/api/knowledge-intelligence/intelligence-stats"],
  });

  const { data: activePipelineJob } = useQuery<PipelineJob | null>({
    queryKey: ["/api/knowledge-intelligence/pipeline-jobs/active"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && ["pending", "crawling", "analyzing", "generating"].includes(data.status)) {
        return 2000;
      }
      return 30000;
    },
  });

  const formatTimeRemaining = (seconds: number | null): string => {
    if (!seconds) return "calculating...";
    if (seconds < 60) return `${seconds}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s remaining`;
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

  const startPipelineMutation = useMutation({
    mutationFn: async (data: { url?: string }) => {
      const payload = data.url 
        ? {
            name: `Analyze: ${new URL(data.url).hostname}`,
            startUrl: data.url,
            crawlType: 'single',
            maxPages: 10
          }
        : {
            name: 'Analyze All Content',
            crawlType: 'existing',
            maxPages: 0
          };
      const res = await apiRequest('POST', '/api/knowledge-intelligence/pipeline-jobs', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-intelligence/pipeline-jobs/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-intelligence/intelligence-stats'] });
      toast({
        title: "Pipeline Started",
        description: "Analyzing your content. Progress is saved automatically.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Pipeline Failed",
        description: error.message || "Failed to start the analysis pipeline.",
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
      
      const savedUrl = urlInput;
      setUrlDialogOpen(false);
      setUrlInput('');
      setUrlName('');
      setUrlFolderId('');
      
      toast({
        title: t('knowledgeBase.toast.urlAdded'),
        description: "Starting AI analysis pipeline...",
      });
      
      if (savedUrl) {
        startPipelineMutation.mutate({ url: savedUrl });
      }
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
    addUrlMutation.mutate({ 
      url: urlInput, 
      name: urlName || urlInput,
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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-[260px] border-r flex-shrink-0 bg-muted/20 flex flex-col">
        {/* Dashboard Button */}
        <div className="p-3">
          <button
            onClick={() => {
              setViewMode("dashboard");
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === "dashboard" 
                ? "bg-primary text-primary-foreground" 
                : "hover-elevate"
            }`}
            data-testid="button-dashboard"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
        </div>

        {/* Folders Section */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            <span>Folders</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => {
                setEditingFolder(null);
                setFolderName('');
                setFolderColor('#3b82f6');
                setFolderDialogOpen(true);
              }}
              data-testid="button-new-folder"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 space-y-1">
            {folders.map((folder) => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => {
                    setViewMode("folder");
                    setSelectedFolderId(folder.id);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFolderId === folder.id && viewMode === "folder"
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover-elevate"
                  }`}
                  data-testid={`folder-${folder.id}`}
                >
                  <Folder 
                    className="h-4 w-4 flex-shrink-0" 
                    style={{ color: folder.color || '#3b82f6' }}
                  />
                  <span className="truncate flex-1 text-left">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {folderStats?.folders[folder.id] || 0}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setEditingFolder(folder);
                      setFolderName(folder.name);
                      setFolderColor(folder.color || '#3b82f6');
                      setFolderDialogOpen(true);
                    }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeletingFolder(folder)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {/* Index */}
            {folderStats && folderStats.uncategorized > 0 && (
              <button
                onClick={() => {
                  setViewMode("folder");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedFolderId === null && viewMode === "folder"
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-uncategorized"
              >
                <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate flex-1 text-left">Index</span>
                <span className="text-xs text-muted-foreground">
                  {folderStats.uncategorized}
                </span>
              </button>
            )}

            {/* AI Intelligence - Integrated */}
            <div className="mt-4 pt-3 border-t border-dashed">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                AI Intelligence
              </div>
              <button
                onClick={() => {
                  setViewMode("ai-insights");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "ai-insights"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-ai-insights"
              >
                <Brain className="h-4 w-4 flex-shrink-0 text-purple-500" />
                <span className="truncate flex-1 text-left">AI Insights</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("content-studio");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "content-studio"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-content-studio"
              >
                <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span className="truncate flex-1 text-left">Content Studio</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("entities");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "entities"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-entities"
              >
                <Tags className="h-4 w-4 flex-shrink-0 text-blue-500" />
                <span className="truncate flex-1 text-left">Entities</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("topic-clusters");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "topic-clusters"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-topic-clusters"
              >
                <Layers className="h-4 w-4 flex-shrink-0 text-green-500" />
                <span className="truncate flex-1 text-left">Topics</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("faqs");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "faqs"
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-faqs"
              >
                <HelpCircle className="h-4 w-4 flex-shrink-0 text-orange-500" />
                <span className="truncate flex-1 text-left">FAQs</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("content-gaps");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "content-gaps"
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-content-gaps"
              >
                <Lightbulb className="h-4 w-4 flex-shrink-0 text-yellow-500" />
                <span className="truncate flex-1 text-left">Content Gaps</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("ml-conversations");
                  setSelectedFolderId(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  viewMode === "ml-conversations"
                    ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium"
                    : "hover-elevate"
                }`}
                data-testid="folder-ml-conversations"
              >
                <Phone className="h-4 w-4 flex-shrink-0 text-cyan-500" />
                <span className="truncate flex-1 text-left">ML Conversations</span>
              </button>
            </div>
          </div>
        </ScrollArea>

        {/* Storage Usage */}
        {storageUsage && (
          <div className="p-3 border-t">
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="border-b">
          <div className="flex items-center justify-between p-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Knowledge Base</h1>
                <p className="text-xs text-muted-foreground">
                  {dashboardStats?.totalResources || 0} resources · {dashboardStats?.totalChunks || 0} chunks
                </p>
              </div>
            </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className="gap-1.5"
              onClick={() => setUrlDialogOpen(true)}
              data-testid="button-add-url"
            >
              <Link className="h-4 w-4" />
              URL
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>

            {/* Pipeline Progress - Next to URL button */}
            {activePipelineJob && ["pending", "crawling", "analyzing", "generating"].includes(activePipelineJob.status) && (
              <div className="flex items-center gap-2 text-sm whitespace-nowrap bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="font-medium text-primary">{activePipelineJob.name}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{formatTimeRemaining(activePipelineJob.estimatedTimeRemaining)}</span>
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ width: `${activePipelineJob.overallProgress}%` }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
          </div>
          </div>

          {/* Intelligence Stats Bar */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 overflow-x-auto">
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Crawl Jobs</span>
              <span className="font-semibold">{intelligenceStats?.crawlJobs || 0}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <Tags className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-muted-foreground">Entities</span>
              <span className="font-semibold">{intelligenceStats?.entities || 0}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <Layers className="h-3.5 w-3.5 text-green-500" />
              <span className="text-muted-foreground">Topics</span>
              <span className="font-semibold">{intelligenceStats?.topics || 0}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <HelpCircle className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-muted-foreground">FAQs</span>
              <span className="font-semibold">{intelligenceStats?.faqs || 0}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <FileText className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-muted-foreground">Articles</span>
              <span className="font-semibold">{intelligenceStats?.articles || 0}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
              <Database className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-muted-foreground">Graph Nodes</span>
              <span className="font-semibold">{intelligenceStats?.graphNodes || 0}</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {viewMode === "ai-insights" ? (
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
                                {folder.count} articles
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

                {/* AI Intelligence Quick Access */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className="h-5 w-5 rounded bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                        <Brain className="h-3 w-3 text-cyan-500" />
                      </div>
                      AI Intelligence
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">ML-powered content analysis</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <button
                        onClick={() => { setViewMode("entities"); setSelectedFolderId(null); }}
                        className="p-3 rounded-lg border hover-elevate text-left"
                        data-testid="quick-access-entities"
                      >
                        <Tags className="h-4 w-4 text-blue-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Entities</p>
                        <p className="text-sm font-medium">View All</p>
                      </button>
                      <button
                        onClick={() => { setViewMode("topic-clusters"); setSelectedFolderId(null); }}
                        className="p-3 rounded-lg border hover-elevate text-left"
                        data-testid="quick-access-clusters"
                      >
                        <Layers className="h-4 w-4 text-green-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Topic Clusters</p>
                        <p className="text-sm font-medium">View All</p>
                      </button>
                      <button
                        onClick={() => { setViewMode("faqs"); setSelectedFolderId(null); }}
                        className="p-3 rounded-lg border hover-elevate text-left"
                        data-testid="quick-access-faqs"
                      >
                        <HelpCircle className="h-4 w-4 text-orange-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Detected FAQs</p>
                        <p className="text-sm font-medium">View All</p>
                      </button>
                      <button
                        onClick={() => { setViewMode("content-gaps"); setSelectedFolderId(null); }}
                        className="p-3 rounded-lg border hover-elevate text-left"
                        data-testid="quick-access-gaps"
                      >
                        <Lightbulb className="h-4 w-4 text-yellow-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Content Gaps</p>
                        <p className="text-sm font-medium">View All</p>
                      </button>
                      <button
                        onClick={() => { setViewMode("content-studio"); setSelectedFolderId(null); }}
                        className="p-3 rounded-lg border hover-elevate text-left"
                        data-testid="quick-access-content-studio"
                      >
                        <Sparkles className="h-4 w-4 text-amber-500 mb-1" />
                        <p className="text-xs text-muted-foreground">Content Studio</p>
                        <p className="text-sm font-medium">Generate</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>

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
                            <TableRow key={item.id} data-testid={`row-kb-item-${item.id}`}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {getTypeIcon(item.type)}
                                  <span className="truncate max-w-[200px]">{item.title}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getTypeBadgeVariant(item.type)}>
                                  {item.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
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
                                  <span className="text-sm text-muted-foreground">
                                    {item.ragStatus === 'completed' ? 'Ready' : 
                                     item.ragStatus === 'processing' ? 'Processing' : 
                                     item.ragStatus === 'failed' ? 'Failed' : 'Pending'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden lg:table-cell">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingItem(item)}
                                  data-testid={`button-delete-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {knowledgeBase.length === 0 && (
                  <Card className="p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Brain className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No content yet</h3>
                      <p className="text-muted-foreground mb-6 max-w-md">
                        Add URLs, upload files, or create text content to build your knowledge base.
                      </p>
                      <div className="flex gap-3">
                        <Button onClick={() => setUrlDialogOpen(true)}>
                          <Link className="h-4 w-4 mr-2" />
                          Add URL
                        </Button>
                        <Button variant="outline" onClick={() => setFileDialogOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </div>
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
                    Dashboard
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
                              <TableRow key={item.id} data-testid={`row-kb-item-${item.id}`}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {getTypeIcon(item.type)}
                                    <span className="truncate max-w-[200px]">{item.title}</span>
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
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden sm:table-cell">
                                  {formatBytes(item.storageSize)}
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden lg:table-cell">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeletingItem(item)}
                                    data-testid={`button-delete-${item.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
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
        </ScrollArea>
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
              disabled={addUrlMutation.isPending || startPipelineMutation.isPending}
              data-testid="button-submit-url"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {addUrlMutation.isPending || startPipelineMutation.isPending 
                ? 'Adding & Analyzing...' 
                : 'Add URL & Start Pipeline'}
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
    </div>
  );
}
