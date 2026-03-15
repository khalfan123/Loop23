import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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
  Bot, Layers, Brain, Zap, Mail, KeyRound,
  Globe2, Languages, Activity, Headset
} from "lucide-react";
import { Link } from "wouter";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
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
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type ViewType = "login" | "register" | "register-otp" | "forgot-password" | "reset-password";

const features = [
  {
    icon: Bot,
    title: "AI Agent Templates",
    description: "Deploy your Agent in minutes!"
  },
  {
    icon: Layers,
    title: "Custom Agents",
    description: "Design agents on Voice, SMS with no-code Agent Studio."
  },
  {
    icon: Brain,
    title: "Context-aware Agents",
    description: "1-click integrations to your FAQs, product catalogs, policies."
  },
  {
    icon: Zap,
    title: "Instant Updates",
    description: "Agents sync to your systems using powerful integrations."
  }
];

const stats = [
  { icon: Globe2, value: "100+", label: "Countries" },
  { icon: Languages, value: "30+", label: "Languages" },
  { icon: Activity, value: "99.9%", label: "Uptime" },
  { icon: Headset, value: "24/7", label: "Support" }
];

const easeOut = [0.16, 1, 0.3, 1] as const;

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
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
  const [registerOtpCode, setRegisterOtpCode] = useState<string>("");
  const [canResendOtp, setCanResendOtp] = useState(false);
  const { toast } = useToast();
  const { branding, currentLogo } = useBranding();

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (otpTimer === 0 && (activeView === 'register-otp' || activeView === 'reset-password')) {
      setCanResendOtp(true);
    }
  }, [otpTimer, activeView]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
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
      
      toast({ title: "Welcome back!", description: "Login successful" });

      const redirectPath = (result.user.role === 'admin' || result.user.role === 'super_admin') ? "/admin" : "/app";
      setPendingRedirect(redirectPath);
      setShowLoadingAnimation(true);
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRegistrationOTP = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send verification code");
      }

      toast({
        title: "Code sent!",
        description: `Check your email at ${data.email}`,
      });

      setActiveView('register-otp');
      setOtpTimer(300);
      setCanResendOtp(false);
      setRegisterOtpCode("");
    } catch (error: any) {
      toast({
        title: "Failed to send code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendRegistrationOTP = async () => {
    const data = registerForm.getValues();
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to resend verification code");
      }

      toast({
        title: "Code resent!",
        description: "A new verification code has been sent to your email",
      });

      setOtpTimer(300);
      setCanResendOtp(false);
      setRegisterOtpCode("");
    } catch (error: any) {
      toast({
        title: "Failed to resend code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerOtpCode.length !== 6) {
      toast({ title: "Invalid code", description: "Please enter a 6-digit code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.getValues().email,
          otpCode: registerOtpCode,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyResult.error || "Invalid verification code");
      }

      const registerData = registerForm.getValues();
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          name: registerData.name,
        }),
      });

      const result = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(result.error || "Registration failed");
      }

      AuthStorage.setAuthData(result.token, result.user, result.refreshToken, result.expiresIn);
      setUserName(result.user.name || result.user.email.split('@')[0]);
      
      toast({
        title: "Account created!",
        description: `Welcome, ${result.user.name}`,
      });

      const redirectPath = result.user.role === 'admin' ? "/admin" : "/app";
      setPendingRedirect(redirectPath);
      setShowLoadingAnimation(true);
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToRegisterDetails = () => {
    setActiveView('register');
    setRegisterOtpCode("");
    setOtpTimer(0);
    setCanResendOtp(false);
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
        body: JSON.stringify({ 
          email: forgotPasswordEmail, 
          newPassword: data.newPassword 
        }),
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

  const getCardTitle = () => {
    switch (activeView) {
      case "login": return "Welcome back";
      case "register": return "Create account";
      case "register-otp": return "Verify email";
      case "forgot-password": return "Forgot password?";
      case "reset-password": return "Reset password";
    }
  };

  const getCardDescription = () => {
    switch (activeView) {
      case "login": return "Sign in to continue to your dashboard";
      case "register": return "Get started with your free account";
      case "register-otp": return `Enter the code sent to ${registerForm.getValues().email}`;
      case "forgot-password": return "Enter your email to receive a reset code";
      case "reset-password": return `Enter the code sent to ${forgotPasswordEmail}`;
    }
  };

  const inputClassName = "w-full h-[52px] px-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500 transition-all text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500";

  const primaryButtonClassName = "w-full h-[52px] rounded-xl bg-blue-500 text-white font-medium border-0 shadow-lg shadow-blue-500/25 no-default-hover-elevate no-default-active-elevate hover:bg-blue-600 active:bg-blue-700 active:scale-[0.98] transition-all duration-200";

  return (
    <>
      <AILoadingAnimation 
        isVisible={showLoadingAnimation} 
        onComplete={handleLoadingComplete}
        userName={userName}
      />
      
      <div className="min-h-screen w-full flex flex-col items-center justify-start relative overflow-hidden bg-gray-50 dark:bg-[#0a0a0f] selection:bg-blue-500/30" data-testid="login-page">
        
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-400/15 dark:bg-indigo-600/8 blur-[120px]" />
          <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-cyan-400/10 dark:bg-cyan-600/8 blur-[80px]" />
          <div className="absolute top-[20%] right-[5%] w-[30%] h-[30%] rounded-full bg-purple-300/10 dark:bg-purple-600/8 blur-[90px]" />
        </div>

        <div className="w-full max-w-[480px] z-10 px-5 py-10 flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="flex flex-col items-center text-center mb-8 w-full"
          >
            <Link href="/">
              <div className="h-[120px] w-full flex items-center justify-center mb-2 cursor-pointer" data-testid="button-back-home">
                {currentLogo ? (
                  <img src={currentLogo} alt={branding.app_name} className="h-[100px] object-contain" />
                ) : (
                  <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-1 ring-black/5 dark:ring-white/10">
                    <Bot className="w-8 h-8" />
                  </div>
                )}
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
              {branding.app_name || "AgentLabs"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-[15px] max-w-[320px] leading-relaxed font-light">
              Launch AI agents &amp; automate your customer interactions
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
            className="w-full"
            key={activeView}
          >
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-gray-200/50 dark:shadow-black/50">
              
              <div className="text-center pb-5">
                {(activeView === "forgot-password" || activeView === "reset-password") && (
                  <div className="flex justify-center mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 dark:bg-blue-400/15 flex items-center justify-center">
                      {activeView === "forgot-password" ? (
                        <Mail className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                      ) : (
                        <KeyRound className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                      )}
                    </div>
                  </div>
                )}
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                  {getCardTitle()}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-light mt-1.5">
                  {getCardDescription()}
                </p>
              </div>

              <div className="pt-1">
                {(activeView === "login" || activeView === "register") && (
                  <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ViewType)}>
                    <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl bg-gray-100/80 dark:bg-white/10 p-1 h-auto">
                      <TabsTrigger 
                        value="login" 
                        data-testid="tab-login"
                        className="rounded-lg py-2.5 text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-white/15 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
                      >
                        Sign In
                      </TabsTrigger>
                      <TabsTrigger 
                        value="register" 
                        data-testid="tab-register"
                        className="rounded-lg py-2.5 text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-white/15 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
                      >
                        Sign Up
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                      <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="login-email" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Email</Label>
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="you@example.com"
                            className={inputClassName}
                            {...loginForm.register("email")}
                            data-testid="input-login-email"
                          />
                          {loginForm.formState.errors.email && (
                            <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                          )}
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between ml-1 pr-1">
                            <Label htmlFor="login-password" className="text-sm font-medium text-gray-600 dark:text-gray-400">Password</Label>
                            <button
                              type="button"
                              onClick={() => {
                                forgotPasswordForm.setValue("email", loginForm.getValues("email"));
                                setActiveView("forgot-password");
                              }}
                              className="text-xs font-medium text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors cursor-pointer"
                              data-testid="link-forgot-password"
                            >
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              id="login-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className={`${inputClassName} pr-12`}
                              {...loginForm.register("password")}
                              data-testid="input-login-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          {loginForm.formState.errors.password && (
                            <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
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
                          ) : "Sign In"}
                        </button>
                      </form>
                    </TabsContent>

                    <TabsContent value="register">
                      <form onSubmit={registerForm.handleSubmit(handleSendRegistrationOTP)} className="space-y-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="register-name" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Full Name</Label>
                          <Input
                            id="register-name"
                            type="text"
                            placeholder="John Doe"
                            className={inputClassName}
                            {...registerForm.register("name")}
                            data-testid="input-register-name"
                          />
                          {registerForm.formState.errors.name && (
                            <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="register-email" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Email</Label>
                          <Input
                            id="register-email"
                            type="email"
                            placeholder="you@example.com"
                            className={inputClassName}
                            {...registerForm.register("email")}
                            data-testid="input-register-email"
                          />
                          {registerForm.formState.errors.email && (
                            <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                          )}
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label htmlFor="register-password" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Password</Label>
                          <div className="relative">
                            <Input
                              id="register-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Create a password"
                              className={`${inputClassName} pr-12`}
                              {...registerForm.register("password")}
                              data-testid="input-register-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          {registerForm.formState.errors.password && (
                            <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="register-confirm" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Confirm Password</Label>
                          <Input
                            id="register-confirm"
                            type="password"
                            placeholder="Confirm your password"
                            className={inputClassName}
                            {...registerForm.register("confirmPassword")}
                            data-testid="input-register-confirm"
                          />
                          {registerForm.formState.errors.confirmPassword && (
                            <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                          )}
                        </div>

                        <button
                          type="submit"
                          className={primaryButtonClassName}
                          disabled={isLoading}
                          data-testid="button-register-submit"
                        >
                          {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                              <LoadingSpinner />
                              Sending code...
                            </span>
                          ) : "Send Verification Code"}
                        </button>
                      </form>
                    </TabsContent>
                  </Tabs>
                )}

                {activeView === "register-otp" && (
                  <form onSubmit={handleVerifyAndRegister} className="space-y-5">
                    <div className="text-center space-y-2 mb-4">
                      <div className="flex justify-center mb-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 dark:bg-blue-400/15">
                          <Mail className="h-6 w-6 text-blue-500 dark:text-blue-400" />
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Check your email</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
                        We sent a verification code to<br />
                        <strong className="text-gray-700 dark:text-gray-200 font-medium">{registerForm.getValues().email}</strong>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-otp" className="text-sm font-medium text-gray-600 dark:text-gray-400">Verification Code</Label>
                      <Input
                        id="register-otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        value={registerOtpCode}
                        onChange={(e) => setRegisterOtpCode(e.target.value.replace(/\D/g, ''))}
                        className={`${inputClassName} text-center text-lg tracking-widest`}
                        data-testid="input-register-otp"
                      />
                      {otpTimer > 0 && (
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500 font-light">
                          <span>Code expires in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className={primaryButtonClassName}
                      disabled={isLoading || registerOtpCode.length !== 6}
                      data-testid="button-verify-register"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <LoadingSpinner />
                          Verifying...
                        </span>
                      ) : "Verify & Create Account"}
                    </button>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="flex-1 h-[52px] rounded-xl bg-gray-100/80 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200/80 dark:hover:bg-white/15 transition-all duration-200 disabled:opacity-50"
                        onClick={handleBackToRegisterDetails}
                        disabled={isLoading}
                        data-testid="button-back-register"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>
                      <button
                        type="button"
                        className="flex-1 h-[52px] rounded-xl bg-gray-100/80 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium text-sm flex items-center justify-center hover:bg-gray-200/80 dark:hover:bg-white/15 transition-all duration-200 disabled:opacity-50"
                        onClick={handleResendRegistrationOTP}
                        disabled={isLoading || !canResendOtp}
                        data-testid="button-resend-register-otp"
                      >
                        {canResendOtp ? "Resend Code" : `Resend in ${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, '0')}`}
                      </button>
                    </div>
                  </form>
                )}

                {activeView === "forgot-password" && (
                  <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPasswordSubmit)} className="space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        className={inputClassName}
                        {...forgotPasswordForm.register("email")}
                        data-testid="input-forgot-email"
                      />
                      {forgotPasswordForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{forgotPasswordForm.formState.errors.email.message}</p>
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
                      className="w-full h-[44px] rounded-xl text-gray-600 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-200"
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
                      <Label htmlFor="reset-otp" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Verification Code</Label>
                      <Input
                        id="reset-otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className={`${inputClassName} text-center text-lg tracking-widest`}
                        {...resetPasswordForm.register("otp")}
                        data-testid="input-reset-otp"
                      />
                      {resetPasswordForm.formState.errors.otp && (
                        <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.otp.message}</p>
                      )}
                      <div className="flex justify-center">
                        {otpTimer > 0 ? (
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-light">Resend code in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendForgotPasswordOTP}
                            className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                            disabled={isLoading}
                            data-testid="button-resend-otp"
                          >
                            Resend code
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reset-password" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">New Password</Label>
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
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      {resetPasswordForm.formState.errors.newPassword && (
                        <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.newPassword.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reset-confirm" className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">Confirm New Password</Label>
                      <Input
                        id="reset-confirm"
                        type="password"
                        placeholder="Confirm your new password"
                        className={inputClassName}
                        {...resetPasswordForm.register("confirmPassword")}
                        data-testid="input-reset-confirm"
                      />
                      {resetPasswordForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.confirmPassword.message}</p>
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
                      className="w-full h-[44px] rounded-xl text-gray-600 dark:text-gray-400 font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-200"
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
              </div>
            </div>

            <p className="text-center text-sm text-gray-400 dark:text-gray-500 font-light mt-5">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors">Privacy Policy</Link>
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: easeOut }}
            className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10"
          >
            {features.map((feature, index) => (
              <div key={index} className="flex flex-col gap-1.5 p-4 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/30 dark:border-white/5 shadow-sm" data-testid={`feature-item-${index}`}>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-lg">
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white leading-none">{feature.title}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: easeOut }}
            className="w-full flex items-center justify-between p-5 mt-6 bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/30 dark:border-white/5 shadow-sm"
          >
            {stats.map((stat, index) => (
              <div key={index} className="flex flex-col items-center text-center gap-1 min-w-[70px]" data-testid={`stat-${index}`}>
                <stat.icon className="w-4 h-4 text-blue-500 mb-1" />
                <span className="font-bold text-sm text-gray-900 dark:text-white leading-none">{stat.value}</span>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
          </motion.div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center text-xs text-gray-400 dark:text-gray-500 mt-10 pb-8"
          >
            &copy; {new Date().getFullYear()} {branding.app_name || "AgentLabs"}. All rights reserved.
          </motion.p>

        </div>
      </div>
    </>
  );
}
