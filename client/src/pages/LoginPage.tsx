import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/components/BrandingProvider";
import { AuthStorage } from "@/lib/auth-storage";
import { AILoadingAnimation } from "@/components/landing/AILoadingAnimation";
import {
  ArrowLeft, Eye, EyeOff,
  Bot, Mail, KeyRound, Loader2, CheckCircle2, XCircle,
  Headset, Phone, MessageSquare, Users, Mic, BarChart3, Shield,
  Sparkles, Globe
} from "lucide-react";
import { Link } from "wouter";
import uaePassLogo from "@assets/image_1774715374305.png";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

const resetPasswordSchema = z.object({
  otp: z.string().min(6, "OTP must be 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type ViewType = "login" | "register" | "forgot-password" | "reset-password";

const spring = { type: "spring", stiffness: 300, damping: 30 } as const;

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const UAEPassIcon = () => (
  <img src={uaePassLogo} alt="UAE Pass" className="w-7 h-7 object-contain" />
);

const FloatingCard = ({ children, className, delay = 0 }: { children: React.ReactNode; className: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.6, delay, type: "spring", stiffness: 200, damping: 20 }}
    className={className}
  >
    {children}
  </motion.div>
);

const CallCenterIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.3),transparent_60%)]" />

    <FloatingCard delay={0.3} className="absolute top-[8%] left-[6%] w-[76px] h-[76px] rounded-3xl bg-white/[0.12] backdrop-blur-md border border-white/20 flex items-center justify-center animate-float-slow shadow-xl shadow-black/10">
      <Phone className="w-8 h-8 text-white/90" />
    </FloatingCard>
    <FloatingCard delay={0.5} className="absolute top-[12%] right-[10%] w-16 h-16 rounded-2xl bg-white/[0.12] backdrop-blur-md border border-white/20 flex items-center justify-center animate-float-medium shadow-xl shadow-black/10">
      <MessageSquare className="w-7 h-7 text-white/90" />
    </FloatingCard>
    <FloatingCard delay={0.7} className="absolute bottom-[18%] left-[8%] w-[68px] h-[68px] rounded-2xl bg-white/[0.12] backdrop-blur-md border border-white/20 flex items-center justify-center animate-float-medium shadow-xl shadow-black/10">
      <BarChart3 className="w-7 h-7 text-white/90" />
    </FloatingCard>
    <FloatingCard delay={0.9} className="absolute bottom-[10%] right-[6%] w-16 h-16 rounded-2xl bg-white/[0.12] backdrop-blur-md border border-white/20 flex items-center justify-center animate-float-slow shadow-xl shadow-black/10">
      <Shield className="w-7 h-7 text-white/90" />
    </FloatingCard>
    <FloatingCard delay={0.4} className="absolute top-[42%] left-[3%] w-14 h-14 rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/15 flex items-center justify-center animate-float-fast shadow-lg shadow-black/10">
      <Mic className="w-6 h-6 text-white/75" />
    </FloatingCard>
    <FloatingCard delay={0.6} className="absolute top-[58%] right-[3%] w-14 h-14 rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/15 flex items-center justify-center animate-float-fast shadow-lg shadow-black/10">
      <Users className="w-6 h-6 text-white/75" />
    </FloatingCard>
    <FloatingCard delay={0.8} className="absolute top-[5%] left-[45%] w-12 h-12 rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/15 flex items-center justify-center animate-float-medium shadow-lg shadow-black/10">
      <Globe className="w-5 h-5 text-white/75" />
    </FloatingCard>
    <FloatingCard delay={1.0} className="absolute bottom-[5%] left-[40%] w-12 h-12 rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/15 flex items-center justify-center animate-float-slow shadow-lg shadow-black/10">
      <Sparkles className="w-5 h-5 text-white/75" />
    </FloatingCard>

    <div className="absolute top-[22%] left-[22%] w-2.5 h-2.5 rounded-full bg-white/25 animate-pulse" />
    <div className="absolute top-[32%] right-[18%] w-2 h-2 rounded-full bg-white/20 animate-pulse [animation-delay:400ms]" />
    <div className="absolute bottom-[28%] left-[18%] w-2 h-2 rounded-full bg-white/20 animate-pulse [animation-delay:800ms]" />
    <div className="absolute top-[68%] left-[35%] w-1.5 h-1.5 rounded-full bg-white/15 animate-pulse [animation-delay:600ms]" />
    <div className="absolute top-[18%] right-[35%] w-1.5 h-1.5 rounded-full bg-white/15 animate-pulse [animation-delay:1000ms]" />

    <div className="absolute top-[18%] left-[28%] w-[180px] h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent rotate-[25deg]" />
    <div className="absolute bottom-[22%] right-[18%] w-[140px] h-[1px] bg-gradient-to-r from-transparent via-white/12 to-transparent -rotate-[18deg]" />
    <div className="absolute top-[55%] left-[15%] w-[120px] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-[40deg]" />

    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="relative z-10 flex flex-col items-center text-center px-10 max-w-[380px]"
    >
      <div className="w-32 h-32 rounded-[2.5rem] bg-white/[0.14] backdrop-blur-xl border border-white/25 flex items-center justify-center mb-8 shadow-2xl shadow-black/25 ring-1 ring-inset ring-white/10">
        <Headset className="w-16 h-16 text-white drop-shadow-lg" />
      </div>
      <h2 className="text-[2.25rem] font-extrabold text-white mb-4 tracking-tight leading-[1.15]">
        AI-Powered<br />Call Center
      </h2>
      <p className="text-white/65 text-[15px] leading-relaxed font-light">
        Automate your customer interactions with intelligent AI agents and seamless telephony integration
      </p>

      <div className="flex flex-col items-center gap-4 mt-10">
        <div className="flex -space-x-2.5">
          {["AI", "ML", "NL", "VX"].map((label, i) => (
            <div
              key={label}
              className="w-9 h-9 rounded-full border-2 border-white/30 flex items-center justify-center text-[10px] font-bold text-white shadow-md"
              style={{ background: `hsla(${220 + i * 25}, 70%, 65%, 0.35)`, zIndex: 4 - i }}
            >
              {label}
            </div>
          ))}
        </div>
        <span className="text-white/55 text-sm font-light tracking-wide">Trusted by 1,000+ businesses worldwide</span>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-10 w-full">
        {[
          { value: "99.9%", label: "Uptime" },
          { value: "30+", label: "Languages" },
          { value: "24/7", label: "Support" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center">
            <span className="text-xl font-bold text-white">{stat.value}</span>
            <span className="text-[11px] text-white/50 font-medium uppercase tracking-wider mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  </div>
);

export default function LoginPage() {
  const [location, setLocation] = useLocation();
  const initialTab = location === "/register" ? "register" : "login";
  const [activeView, setActiveView] = useState<ViewType>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { branding, currentLogo } = useBranding();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uaeError = params.get('error');
    if (uaeError?.startsWith('uaepass_')) {
      const messages: Record<string, string> = {
        uaepass_denied: "UAE Pass authentication was cancelled or denied.",
        uaepass_missing_params: "UAE Pass response was incomplete. Please try again.",
        uaepass_invalid_state: "UAE Pass session expired. Please try again.",
        uaepass_token_failed: "Failed to verify UAE Pass credentials. Please try again.",
        uaepass_userinfo_failed: "Could not retrieve your UAE Pass profile. Please try again.",
        uaepass_callback_failed: "Something went wrong during sign-in. Please try again.",
        uaepass_storage_failed: "Could not save your session. Please try again.",
      };
      toast({ title: "UAE Pass Sign-in Failed", description: messages[uaeError] || "An unknown error occurred.", variant: "destructive" });
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (otpTimer === 0 && activeView === 'reset-password') {
      setCanResendOtp(true);
    }
  }, [otpTimer, activeView]);

  useEffect(() => {
    if (showPasswordField && passwordRef.current) {
      const timer = setTimeout(() => passwordRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
    if (!showPasswordField && emailRef.current) {
      const timer = setTimeout(() => emailRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [showPasswordField]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  const handleLoadingComplete = () => {
    if (pendingRedirect) {
      setLocation(pendingRedirect);
    }
  };

  const handleCheckEmail = useCallback(async (email: string) => {
    if (!email || !z.string().email().safeParse(email).success) {
      setEmailChecked(false);
      setEmailExists(null);
      setShowPasswordField(false);
      return;
    }

    setIsCheckingEmail(true);
    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      setEmailChecked(true);
      setEmailExists(result.exists);
      if (result.exists) {
        setShowPasswordField(true);
      }
    } catch {
      setShowPasswordField(true);
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed");
      }

      AuthStorage.setAuthData(result.token, result.user, result.refreshToken, result.expiresIn);
      setUserName(result.user.name || result.user.email.split('@')[0]);

      if (result.user.kycStatus === "pending" || result.user.kycStatus === "submitted") {
        toast({ title: "Account under review", description: "Your trade license is still being reviewed" });
        setLocation("/onboarding");
        return;
      }

      toast({ title: "Welcome back!", description: "Login successful" });

      const redirectPath = "/app";
      setPendingRedirect(redirectPath);
      setShowLoadingAnimation(true);
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const result = await response.json();
      
      if (response.ok) {
        setForgotPasswordEmail(data.email);
        setOtpTimer(300);
        setCanResendOtp(false);
        setActiveView("reset-password");
        toast({ title: "Code sent!", description: "Check your email for the verification code" });
      } else {
        toast({ title: "Failed to send code", description: result.error || "Something went wrong", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Failed to send code", description: error.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendForgotPasswordOTP = async () => {
    if (otpTimer > 0) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      const result = await response.json();
      
      if (response.ok) {
        setOtpTimer(300);
        setCanResendOtp(false);
        toast({ title: "Code resent!", description: "Check your email for the new code" });
      } else {
        toast({ title: "Failed to resend", description: result.error || "Something went wrong", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Failed to resend", description: error.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const verifyResponse = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail, otpCode: data.otp }),
      });
      const verifyResult = await verifyResponse.json();
      
      if (!verifyResponse.ok) {
        toast({ title: "Invalid code", description: verifyResult.error || "Please check the code and try again", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const resetResponse = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail, newPassword: data.newPassword }),
      });
      const resetResult = await resetResponse.json();
      
      if (resetResponse.ok) {
        toast({ title: "Password reset!", description: "You can now login with your new password" });
        resetPasswordForm.reset();
        forgotPasswordForm.reset();
        setActiveView("login");
      } else {
        toast({ title: "Failed to reset password", description: resetResult.error || "Something went wrong", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Failed to reset password", description: error.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUAEPassLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/uaepass/authorize");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start UAE Pass authentication");
      }
      window.location.href = data.authUrl;
    } catch (error: any) {
      toast({ title: "UAE Pass Error", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const getCardTitle = () => {
    switch (activeView) {
      case "login": return showPasswordField ? "Welcome back" : "Hi there!";
      case "register": return "Create account";
      case "forgot-password": return "Forgot password?";
      case "reset-password": return "Reset password";
    }
  };

  const getCardSubtitle = () => {
    switch (activeView) {
      case "login": return showPasswordField ? "Enter your password to continue" : "Have we met before?";
      case "register": return "Sign up with UAE Pass to get started";
      case "forgot-password": return "Enter your email to receive a reset code";
      case "reset-password": return `Enter the code sent to ${forgotPasswordEmail}`;
    }
  };

  const inputClassName = "w-full h-[46px] px-4 rounded-xl bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:ring-offset-0 focus-visible:border-blue-400 transition-all duration-200 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500";

  const primaryButtonClassName = "w-full h-[46px] rounded-xl bg-blue-500 text-white font-semibold text-[15px] border-0 shadow-lg shadow-blue-500/25 no-default-hover-elevate no-default-active-elevate hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-500/30 active:bg-blue-700 active:scale-[0.98] transition-all duration-200 cursor-pointer";

  const secondaryButtonClassName = "w-full h-[48px] rounded-full border-2 border-gray-300 dark:border-white/20 bg-white dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-semibold text-[15px] tracking-wide flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-gray-400 dark:hover:border-white/30 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer";

  const labelClassName = "text-sm font-medium text-gray-600 dark:text-gray-400 ml-0.5";

  return (
    <>
      <AILoadingAnimation 
        isVisible={showLoadingAnimation} 
        onComplete={handleLoadingComplete}
        userName={userName}
      />
      
      <div className="min-h-screen w-full flex bg-white dark:bg-[#0a0a0f]" data-testid="login-page">
        <div className="w-full lg:w-[52%] xl:w-[48%] flex flex-col min-h-screen">
          <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-12 xl:px-16 py-6">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ...spring }}
              className="mb-5"
            >
              <Link href="/">
                <div className="inline-flex items-center cursor-pointer group" data-testid="button-back-home">
                  {currentLogo ? (
                    <img
                      src={currentLogo}
                      alt={branding.app_name}
                      className="h-[100px] sm:h-[120px] w-auto max-w-[360px] object-contain object-left transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-[48px] h-[48px] bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/25 ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105">
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

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ...spring }}
              className="max-w-[420px] w-full"
              key={activeView}
            >
              <div className="mb-5">
                {(activeView === "forgot-password" || activeView === "reset-password") && (
                  <div className="mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      {activeView === "forgot-password" ? (
                        <Mail className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      ) : (
                        <KeyRound className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      )}
                    </div>
                  </div>
                )}
                <h1 className="text-[1.75rem] font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight" data-testid="text-page-title">
                  {getCardTitle()}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-[14px] leading-relaxed" data-testid="text-page-subtitle">
                  {getCardSubtitle()}
                </p>
              </div>

              {(activeView === "login" || activeView === "register") && (
                <Tabs value={activeView} onValueChange={(v) => {
                  setActiveView(v as ViewType);
                  setEmailChecked(false);
                  setEmailExists(null);
                  setShowPasswordField(false);
                }}>
                  <TabsList className="grid w-full grid-cols-2 mb-5 rounded-xl bg-gray-100/80 dark:bg-white/[0.06] p-1 h-auto border border-gray-200/40 dark:border-white/5">
                    <TabsTrigger 
                      value="login" 
                      data-testid="tab-login"
                      className="rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-white/12 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger 
                      value="register" 
                      data-testid="tab-register"
                      className="rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-white/12 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <AnimatePresence mode="wait">
                      {!showPasswordField ? (
                        <motion.div
                          key="email-step"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="login-email" className={labelClassName}>Email</Label>
                              <div className="relative">
                                <Input
                                  id="login-email"
                                  type="email"
                                  placeholder="jane.smith@example.com"
                                  className={`${inputClassName} pr-12`}
                                  {...loginForm.register("email", {
                                    onChange: () => {
                                      if (emailChecked) {
                                        setEmailChecked(false);
                                        setEmailExists(null);
                                      }
                                    }
                                  })}
                                  ref={(e) => {
                                    loginForm.register("email").ref(e);
                                    (emailRef as any).current = e;
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const email = loginForm.getValues("email");
                                      if (email && z.string().email().safeParse(email).success) {
                                        handleCheckEmail(email);
                                      } else {
                                        loginForm.setError("email", { message: "Please enter a valid email" });
                                      }
                                    }
                                  }}
                                  data-testid="input-login-email"
                                />
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                  <AnimatePresence mode="wait">
                                    {isCheckingEmail && (
                                      <motion.div key="checking" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
                                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                              {loginForm.formState.errors.email && (
                                <p className="text-sm text-destructive ml-0.5">{loginForm.formState.errors.email.message}</p>
                              )}
                              <AnimatePresence>
                                {!isCheckingEmail && emailChecked && emailExists === false && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="text-sm text-amber-600 dark:text-amber-400 ml-0.5"
                                  >
                                    No account found. Try signing up instead.
                                  </motion.p>
                                )}
                              </AnimatePresence>
                            </div>

                            <button
                              type="button"
                              className={primaryButtonClassName}
                              disabled={isCheckingEmail}
                              onClick={() => {
                                const email = loginForm.getValues("email");
                                if (email && z.string().email().safeParse(email).success) {
                                  handleCheckEmail(email);
                                } else {
                                  loginForm.setError("email", { message: "Please enter a valid email" });
                                }
                              }}
                              data-testid="button-continue-email"
                            >
                              {isCheckingEmail ? (
                                <span className="flex items-center justify-center gap-2">
                                  <LoadingSpinner />
                                  Checking...
                                </span>
                              ) : "Continue"}
                            </button>
                          </div>

                          <div className="flex items-center gap-4 my-4">
                            <div className="flex-1 h-px bg-gray-200/80 dark:bg-white/8" />
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-widest">or</span>
                            <div className="flex-1 h-px bg-gray-200/80 dark:bg-white/8" />
                          </div>

                          <button
                            type="button"
                            onClick={handleUAEPassLogin}
                            className={secondaryButtonClassName}
                            data-testid="button-login-uaepass"
                          >
                            <UAEPassIcon />
                            Sign in with UAE PASS
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="password-step"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPasswordField(false);
                                  setEmailChecked(false);
                                  setEmailExists(null);
                                }}
                                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                                data-testid="button-back-to-email"
                              >
                                <ArrowLeft className="w-4 h-4" />
                              </button>
                              <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{loginForm.getValues("email")}</span>
                              {emailChecked && emailExists && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              )}
                              {emailChecked && emailExists === false && (
                                <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="login-password" className={labelClassName}>Password</Label>
                              <div className="relative">
                                <Input
                                  id="login-password"
                                  type={showPassword ? "text" : "password"}
                                  placeholder="Enter your password"
                                  className={`${inputClassName} pr-12`}
                                  {...loginForm.register("password")}
                                  ref={(e) => {
                                    loginForm.register("password").ref(e);
                                    (passwordRef as any).current = e;
                                  }}
                                  data-testid="input-login-password"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 h-9 w-9"
                                  onClick={() => setShowPassword(!showPassword)}
                                  data-testid="button-toggle-password"
                                >
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              </div>
                              {loginForm.formState.errors.password && (
                                <p className="text-sm text-destructive ml-0.5">{loginForm.formState.errors.password.message}</p>
                              )}
                            </div>

                            <button
                              type="submit"
                              className={primaryButtonClassName}
                              disabled={isLoading}
                              data-testid="button-login-submit"
                            >
                              {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                  <LoadingSpinner />
                                  Signing in...
                                </span>
                              ) : "Log in"}
                            </button>

                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  forgotPasswordForm.setValue("email", loginForm.getValues("email"));
                                  setActiveView("forgot-password");
                                }}
                                className="text-sm font-medium text-gray-800 dark:text-gray-200 underline underline-offset-4 decoration-gray-300 dark:decoration-gray-600 hover:decoration-blue-500 dark:hover:decoration-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                                data-testid="link-forgot-password"
                              >
                                Forgot my password
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </TabsContent>

                  <TabsContent value="register">
                    <div className="space-y-5">
                      <div className="rounded-xl bg-blue-50/60 dark:bg-blue-500/[0.06] border border-blue-200/50 dark:border-blue-500/15 p-4">
                        <div className="flex gap-3">
                          <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Verified registration only</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                              Sign up through UAE Pass and upload your trade license. Your account will be reviewed and activated by our team.
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleUAEPassLogin}
                        className={secondaryButtonClassName}
                        data-testid="button-register-uaepass"
                      >
                        <UAEPassIcon />
                        Sign up with UAE PASS
                      </button>

                      <div className="space-y-3 pt-1">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Authenticate with UAE Pass</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Verify your identity securely</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload trade license</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Attach your valid trade license document</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Account review</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Our team will verify and activate your account</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              {activeView === "forgot-password" && (
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPasswordSubmit)} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className={labelClassName}>Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      className={inputClassName}
                      {...forgotPasswordForm.register("email")}
                      data-testid="input-forgot-email"
                    />
                    {forgotPasswordForm.formState.errors.email && (
                      <p className="text-sm text-destructive ml-0.5">{forgotPasswordForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={primaryButtonClassName}
                    disabled={isLoading}
                    data-testid="button-send-code"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner />
                        Sending...
                      </span>
                    ) : "Send Reset Code"}
                  </button>

                  <button
                    type="button"
                    className="w-full h-[44px] rounded-xl text-gray-600 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
                    onClick={() => setActiveView("login")}
                    data-testid="button-back-to-login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to login
                  </button>
                </form>
              )}

              {activeView === "reset-password" && (
                <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-otp" className={labelClassName}>Verification Code</Label>
                    <Input
                      id="reset-otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className={`${inputClassName} text-center text-lg tracking-[0.3em] font-mono`}
                      {...resetPasswordForm.register("otp")}
                      data-testid="input-reset-otp"
                    />
                    {resetPasswordForm.formState.errors.otp && (
                      <p className="text-sm text-destructive ml-0.5">{resetPasswordForm.formState.errors.otp.message}</p>
                    )}
                    <div className="flex justify-center">
                      {otpTimer > 0 ? (
                        <span className="text-sm text-gray-400 dark:text-gray-500">Resend code in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendForgotPasswordOTP}
                          className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer"
                          disabled={isLoading}
                          data-testid="button-resend-otp"
                        >
                          Resend code
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-password" className={labelClassName}>New Password</Label>
                    <div className="relative">
                      <Input
                        id="reset-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a new password"
                        className={`${inputClassName} pr-12`}
                        {...resetPasswordForm.register("newPassword")}
                        data-testid="input-reset-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-9 w-9"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {resetPasswordForm.formState.errors.newPassword && (
                      <p className="text-sm text-destructive ml-0.5">{resetPasswordForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-confirm" className={labelClassName}>Confirm New Password</Label>
                    <Input
                      id="reset-confirm"
                      type="password"
                      placeholder="Confirm your new password"
                      className={inputClassName}
                      {...resetPasswordForm.register("confirmPassword")}
                      data-testid="input-reset-confirm"
                    />
                    {resetPasswordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive ml-0.5">{resetPasswordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={primaryButtonClassName}
                    disabled={isLoading}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <LoadingSpinner />
                        Resetting...
                      </span>
                    ) : "Reset Password"}
                  </button>

                  <button
                    type="button"
                    className="w-full h-[44px] rounded-xl text-gray-600 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
                    onClick={() => {
                      setActiveView("forgot-password");
                      resetPasswordForm.reset();
                    }}
                    data-testid="button-back-to-email"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Change email
                  </button>
                </form>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 leading-relaxed">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors underline underline-offset-2 decoration-blue-500/30">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors underline underline-offset-2 decoration-blue-500/30">Privacy Policy</Link>
              </p>
            </motion.div>
          </div>

          <div className="px-6 sm:px-10 lg:px-12 xl:px-16 py-4 border-t border-gray-100 dark:border-white/5">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              &copy; {new Date().getFullYear()} {branding.app_name || "AgentLabs"}. All rights reserved.
            </p>
          </div>
        </div>

        <div className="hidden lg:block lg:w-[48%] xl:w-[52%] relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="absolute inset-0"
          >
            <CallCenterIllustration />
          </motion.div>
        </div>
      </div>
    </>
  );
}
