import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/components/BrandingProvider";
import { Eye, EyeOff, Users, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import TeamAuth from "@/lib/team-auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function TeamMemberLogin() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { branding, currentLogo } = useBranding();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/team/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login failed");
      }

      if (result.token) {
        TeamAuth.setToken(result.token);
        TeamAuth.setMember(result.member);
        TeamAuth.setTeam(result.team);
      }

      toast({ 
        title: "Welcome!", 
        description: `Logged in as ${result.member?.name || result.member?.email}` 
      });

      setLocation("/app");
    } catch (error: any) {
      toast({ 
        title: "Login failed", 
        description: error.message || "Invalid credentials", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50/30 dark:from-[#0a0a0f] dark:via-[#0f0f1a] dark:to-[#0a0a0f] items-center justify-center p-12">
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-400/15 dark:bg-blue-500/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-5%] right-[-10%] w-[350px] h-[350px] bg-purple-400/15 dark:bg-purple-500/8 rounded-full blur-[100px]" />
          <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-teal-300/10 dark:bg-teal-500/5 rounded-full blur-[80px]" />
        </div>
        <div className="relative z-10 max-w-md text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-blue-500/10 dark:bg-blue-400/15 flex items-center justify-center backdrop-blur-sm">
              <Users className="w-10 h-10 text-blue-500 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-semibold mb-4 tracking-tight text-gray-900 dark:text-white">Team Member Portal</h1>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-light">
              Access your team workspace and collaborate with your colleagues.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-12 grid grid-cols-2 gap-4"
          >
            <div className="p-4 rounded-xl glass-card">
              <div className="text-2xl font-semibold text-blue-500 dark:text-blue-400">Secure</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-light">Access</div>
            </div>
            <div className="p-4 rounded-xl glass-card">
              <div className="text-2xl font-semibold text-blue-500 dark:text-blue-400">Role</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-light">Based</div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50/50 dark:bg-[#1c1c1e]">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>

          <div className="flex justify-center mb-8">
            {currentLogo ? (
              <img 
                src={currentLogo} 
                alt={branding.app_name} 
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <Users className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">{branding.app_name}</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/20 p-8">
            <div className="text-center pb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Team Member Login</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-light mt-2">
                Sign in with your team member credentials
              </p>
            </div>
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your.email@company.com"
                            className="h-[52px] rounded-xl bg-gray-100/80 dark:bg-white/10 border-0 px-4 text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0 transition-all duration-300"
                            {...field}
                            disabled={isLoading}
                            data-testid="input-team-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-600 dark:text-gray-400">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="h-[52px] rounded-xl bg-gray-100/80 dark:bg-white/10 border-0 px-4 pr-12 text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-0 transition-all duration-300"
                              {...field}
                              disabled={isLoading}
                              data-testid="input-team-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-[52px] rounded-xl bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20 hover:bg-blue-600 active:bg-blue-700 transition-all duration-200" 
                    disabled={isLoading}
                    data-testid="button-team-login"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
                  Not a team member?{" "}
                  <Link href="/login" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors">
                    Login as user
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Contact your team administrator if you need access or forgot your password.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
