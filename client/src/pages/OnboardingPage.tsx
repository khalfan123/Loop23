import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/components/BrandingProvider";
import { AuthStorage } from "@/lib/auth-storage";
import {
  Upload, FileText, CheckCircle2, X, Shield,
  Clock, Loader2, ArrowLeft, Bot
} from "lucide-react";
import { Link } from "wouter";

type OnboardingStep = "upload" | "submitting" | "pending";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { branding, currentLogo } = useBranding();
  const [step, setStep] = useState<OnboardingStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, JPEG, or PNG file",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;

    setIsUploading(true);
    setStep("submitting");

    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", "trade_license");

      const token = AuthStorage.getToken();
      const response = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const submitResponse = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!submitResponse.ok) {
        const data = await submitResponse.json();
        throw new Error(data.error || "Submission failed");
      }

      setStep("pending");
      toast({
        title: "Trade license submitted",
        description: "Your account is under review. We'll notify you once approved.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setStep("upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    AuthStorage.clearAuth();
    setLocation("/login");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-[#0a0a0f]" data-testid="onboarding-page">
      <div className="w-full max-w-[560px] mx-auto flex flex-col min-h-screen px-6 sm:px-10 py-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link href="/">
            <div className="inline-flex items-center cursor-pointer group" data-testid="button-back-home">
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt={branding.app_name}
                  className="h-[80px] w-auto max-w-[300px] object-contain object-left"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-[48px] h-[48px] bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                    <Bot className="w-6 h-6" />
                  </div>
                  <span className="text-[1.5rem] font-bold text-gray-900 dark:text-white tracking-tight">
                    {branding.app_name || "AgentLabs"}
                  </span>
                </div>
              )}
            </div>
          </Link>
        </motion.div>

        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <h1 className="text-[1.75rem] font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight" data-testid="text-onboarding-title">
                        Upload trade license
                      </h1>
                    </div>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 text-[14px] leading-relaxed" data-testid="text-onboarding-subtitle">
                    Please upload your valid trade license to complete the registration. Our team will review and activate your account.
                  </p>
                </div>

                <div
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
                    dragOver
                      ? "border-blue-400 bg-blue-50/50 dark:bg-blue-500/[0.08]"
                      : file
                        ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/[0.04]"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-trade-license"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                    data-testid="input-trade-license-file"
                  />

                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[250px]">{file.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="ml-2 w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        data-testid="button-remove-file"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Drop your trade license here
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          or click to browse — PDF, JPEG, PNG up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!file || isUploading}
                  className="w-full h-[46px] rounded-xl bg-blue-500 text-white font-semibold text-[15px] border-0 shadow-lg shadow-blue-500/25 hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-500/30 active:bg-blue-700 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-submit-trade-license"
                >
                  {isUploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </span>
                  ) : "Submit for review"}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full h-[40px] rounded-xl text-gray-500 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
                  data-testid="button-logout-onboarding"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Sign out and go back
                </button>
              </motion.div>
            )}

            {step === "submitting" && (
              <motion.div
                key="submitting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-12 space-y-4"
              >
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-gray-600 dark:text-gray-300 font-medium">Uploading your trade license...</p>
              </motion.div>
            )}

            {step === "pending" && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto">
                    <Clock className="w-10 h-10 text-amber-500 dark:text-amber-400" />
                  </div>
                  <h1 className="text-[1.75rem] font-extrabold text-gray-900 dark:text-white tracking-tight" data-testid="text-pending-title">
                    Under review
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 text-[14px] leading-relaxed max-w-[380px] mx-auto" data-testid="text-pending-subtitle">
                    Your trade license has been submitted successfully. Our team will review your documents and activate your account. You'll receive an email once your account is approved.
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50/60 dark:bg-amber-500/[0.06] border border-amber-200/50 dark:border-amber-500/15 p-4">
                  <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">What happens next?</p>
                      <ul className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1.5 leading-relaxed">
                        <li>Our team reviews your trade license (typically within 24 hours)</li>
                        <li>You'll receive an email notification with the result</li>
                        <li>Once approved, you can log in and start using the platform</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full h-[46px] rounded-xl bg-gray-100/80 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 font-medium text-[15px] flex items-center justify-center hover:bg-gray-200/80 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer"
                  data-testid="button-done-onboarding"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="py-4 border-t border-gray-100 dark:border-white/5">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            &copy; {new Date().getFullYear()} {branding.app_name || "AgentLabs"}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
