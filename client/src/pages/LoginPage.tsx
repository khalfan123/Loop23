/**
 * ============================================================
 * LoginPage - Full Page Login/Register with Informative Left Panel
 * Includes inline Forgot Password flow
 * ============================================================
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/components/BrandingProvider";
import { apiRequest } from "@/lib/queryClient";
import { AuthStorage } from "@/lib/auth-storage";
import { AILoadingAnimation } from "@/components/landing/AILoadingAnimation";
import { 
  ArrowLeft, Eye, EyeOff, Check, 
  Bot, Layers, Brain, Zap, Mail, KeyRound
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
  { value: "100+", label: "Countries" },
  { value: "30+", label: "Languages" },
  { value: "99.9%", label: "Uptime" },
  { value: "24/7", label: "Support" }
];

const springTransition = { type: "spring" as const, stiffness: 300, damping: 30 };

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

  const inputClassName = "h-[52px] rounded-xl bg-gray-100/80 dark:bg-white/10 border-0 px-4 text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0 transition-all duration-300";

  const primaryButtonClassName = "w-full h-[52px] rounded-xl bg-blue-500 text-white font-medium border-0 shadow-md shadow-blue-500/20 no-default-hover-elevate no-default-active-elevate hover:bg-blue-600 active:bg-blue-700 transition-all duration-200";

  return (
    <>
      <AILoadingAnimation 
        isVisible={showLoadingAnimation} 
        onComplete={handleLoadingComplete}
        userName={userName}
      />
      
      <div className="min-h-screen flex bg-white dark:bg-[#1c1c1e]" data-testid="login-page">
        {/* Left side - Apple Mesh Gradient Panel */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/50 to-purple-50/30 dark:from-[#1c1c1e] dark:via-[#1c1c2e] dark:to-[#1c1c1e]">
          {/* Mesh gradient blobs */}
          <div className="absolute inset-0">
            <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-[100px]" />
            <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-400/20 dark:bg-purple-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-5%] left-[10%] w-[450px] h-[450px] bg-pink-300/15 dark:bg-pink-500/8 rounded-full blur-[100px]" />
            <div className="absolute top-[50%] left-[30%] w-[350px] h-[350px] bg-teal-300/15 dark:bg-teal-500/8 rounded-full blur-[80px]" />
            <div className="absolute bottom-[30%] right-[5%] w-[300px] h-[300px] bg-indigo-300/10 dark:bg-indigo-500/8 rounded-full blur-[90px]" />
          </div>
          
          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer" data-testid="link-logo">
                {branding.logo_url_dark ? (
                  <img src={currentLogo || branding.logo_url_dark} alt={branding.app_name} className="h-[120px]" />
                ) : currentLogo ? (
                  <img src={currentLogo} alt={branding.app_name} className="h-[120px]" />
                ) : null}
              </div>
            </Link>
            
            {/* Main Content */}
            <div className="space-y-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springTransition, delay: 0.1 }}
              >
                <h1 className="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-white mb-4">
                  Launch AI agents & automate your customer interactions
                </h1>
              </motion.div>
              
              {/* Features List */}
              <motion.div 
                className="space-y-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springTransition, delay: 0.2 }}
              >
                {features.map((feature, index) => (
                  <motion.div 
                    key={index}
                    className="flex items-start gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...springTransition, delay: 0.3 + index * 0.08 }}
                    data-testid={`feature-item-${index}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/15 flex items-center justify-center shrink-0">
                      <feature.icon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-gray-800 dark:text-gray-200 font-light">
                        Access pre-built <span className="font-medium">{feature.title}</span>.{" "}
                        <span className="text-gray-500 dark:text-gray-400">{feature.description}</span>
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Stats Row */}
              <motion.div
                className="pt-8 border-t border-gray-200/60 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springTransition, delay: 0.6 }}
              >
                <div className="grid grid-cols-4 gap-6">
                  {stats.map((stat, index) => (
                    <div key={index} className="text-center" data-testid={`stat-${index}`}>
                      <div className="text-2xl font-semibold tracking-tight text-blue-500 dark:text-blue-400">{stat.value}</div>
                      <div className="text-sm font-light text-gray-500 dark:text-gray-400 tracking-wide">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
            
            {/* Footer */}
            <p className="text-sm font-light text-gray-400 dark:text-gray-500 tracking-wide">
              &copy; {new Date().getFullYear()} {branding.app_name}. All rights reserved.
            </p>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50/50 dark:bg-[#1c1c1e]">
          <div className="w-full max-w-md space-y-6">
            {/* Mobile back button */}
            <div className="lg:hidden">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-home">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to home
                </Button>
              </Link>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition}
              key={activeView}
            >
              {/* Frosted glass card */}
              <div className="rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/20 p-8">
                {/* Header */}
                <div className="text-center pb-6">
                  {/* Mobile logo */}
                  <div className="lg:hidden flex justify-center mb-5">
                    {currentLogo && (
                      <img src={currentLogo} alt={branding.app_name} className="h-[120px]" />
                    )}
                  </div>
                  
                  {/* Icon for forgot/reset password views */}
                  {(activeView === "forgot-password" || activeView === "reset-password") && (
                    <div className="flex justify-center mb-5">
                      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-400/15 flex items-center justify-center">
                        {activeView === "forgot-password" ? (
                          <Mail className="w-7 h-7 text-blue-500 dark:text-blue-400" />
                        ) : (
                          <KeyRound className="w-7 h-7 text-blue-500 dark:text-blue-400" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    {getCardTitle()}
                  </h2>
                  <p className="text-base text-gray-500 dark:text-gray-400 font-light mt-2">
                    {getCardDescription()}
                  </p>
                </div>
                
                {/* Form Content */}
                <div className="pt-2">
                  {/* Login/Register Tabs */}
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
                          <div className="space-y-2">
                            <Label htmlFor="login-email" className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</Label>
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
                          
                          <div className="space-y-2">
                            <Label htmlFor="login-password" className="text-sm font-medium text-gray-600 dark:text-gray-400">Password</Label>
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
                                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                            </div>
                            {loginForm.formState.errors.password && (
                              <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                            )}
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  forgotPasswordForm.setValue("email", loginForm.getValues("email"));
                                  setActiveView("forgot-password");
                                }}
                                className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                data-testid="link-forgot-password"
                              >
                                Forgot password?
                              </button>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className={primaryButtonClassName}
                            disabled={isLoading}
                            data-testid="button-login-submit"
                          >
                            {isLoading ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Signing in...
                              </span>
                            ) : "Sign In"}
                          </button>
                        </form>
                      </TabsContent>

                      <TabsContent value="register">
                        <form onSubmit={registerForm.handleSubmit(handleSendRegistrationOTP)} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="register-name" className="text-sm font-medium text-gray-600 dark:text-gray-400">Full Name</Label>
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

                          <div className="space-y-2">
                            <Label htmlFor="register-email" className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</Label>
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
                          
                          <div className="space-y-2">
                            <Label htmlFor="register-password" className="text-sm font-medium text-gray-600 dark:text-gray-400">Password</Label>
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

                          <div className="space-y-2">
                            <Label htmlFor="register-confirm" className="text-sm font-medium text-gray-600 dark:text-gray-400">Confirm Password</Label>
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
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending code...
                              </span>
                            ) : "Send Verification Code"}
                          </button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  )}

                  {/* Registration OTP Verification */}
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
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
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

                  {/* Forgot Password Form */}
                  {activeView === "forgot-password" && (
                    <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPasswordSubmit)} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</Label>
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
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
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

                  {/* Reset Password Form */}
                  {activeView === "reset-password" && (
                    <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="reset-otp" className="text-sm font-medium text-gray-600 dark:text-gray-400">Verification Code</Label>
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

                      <div className="space-y-2">
                        <Label htmlFor="reset-password" className="text-sm font-medium text-gray-600 dark:text-gray-400">New Password</Label>
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

                      <div className="space-y-2">
                        <Label htmlFor="reset-confirm" className="text-sm font-medium text-gray-600 dark:text-gray-400">Confirm New Password</Label>
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
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
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
            </motion.div>

            {/* Terms */}
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 font-light">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors">Privacy Policy</Link>
            </p>

          </div>
        </div>
      </div>
    </>
  );
}
