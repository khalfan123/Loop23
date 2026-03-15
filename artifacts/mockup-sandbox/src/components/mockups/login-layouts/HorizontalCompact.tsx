import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Languages,
  Activity,
  Headset,
  Bot,
  Sliders,
  MessageSquare,
  Zap,
  Eye,
  EyeOff,
  ChevronRight,
  Mail,
  Lock
} from "lucide-react";

export function HorizontalCompact() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const stats = [
    { icon: Globe, label: "100+ Countries" },
    { icon: Languages, label: "30+ Languages" },
    { icon: Activity, label: "99.9% Uptime" },
    { icon: Headset, label: "24/7 Support" },
  ];

  const features = [
    { icon: Bot, title: "AI Templates" },
    { icon: Sliders, title: "Custom Agents" },
    { icon: MessageSquare, title: "Context-Aware" },
    { icon: Zap, title: "Instant Updates" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Top Banner - Stats */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-20 relative">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between overflow-x-auto hide-scrollbar text-xs font-medium">
          <div className="flex items-center space-x-8 md:space-x-12 mx-auto min-w-max">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <Icon className="w-4 h-4 text-blue-500" />
                  <span>{stat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row flex-1 h-[calc(100vh-3rem)]">
        
        {/* LEFT Column - Narrow Rail (approx 30%) */}
        <div className="w-full md:w-[30%] max-w-sm bg-slate-900 text-white flex flex-col justify-between p-8 z-10 shadow-2xl relative overflow-hidden">
          {/* Subtle gradient background for the rail */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-slate-900/90 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col h-full">
            {/* Logo Area */}
            <div className="flex items-center h-[120px]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-semibold tracking-tight">AgentLabs</span>
              </div>
            </div>

            {/* Features Rail */}
            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="mb-6">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Platform Capabilities</p>
                <div className="h-px w-8 bg-blue-500/50 rounded" />
              </div>
              
              <div className="space-y-8">
                {features.map((feature, idx) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx, duration: 0.5 }}
                      className="flex items-center space-x-4 group cursor-default"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-all duration-300">
                        <Icon className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{feature.title}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-xs text-slate-500">
              <p>© {new Date().getFullYear()} AgentLabs Inc.</p>
              <p className="mt-1">All rights reserved.</p>
            </div>
          </div>
        </div>

        {/* RIGHT Column - Form Area (approx 70%) */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-24 relative bg-slate-50 dark:bg-slate-950 overflow-y-auto">
          {/* Subtle ambient background effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md relative z-10"
          >
            {/* Headline Tagline inside Form Area */}
            <div className="text-center mb-10">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
                Welcome back
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-[280px] mx-auto leading-relaxed">
                Launch AI agents & automate your customer interactions seamlessly.
              </p>
            </div>

            {/* Card Container */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl shadow-slate-200/50 dark:shadow-black/50">
              
              {/* Tab Switcher */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl mb-8">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ${
                    isLogin 
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ${
                    !isLogin 
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form */}
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="John Doe"
                          className="w-full h-[52px] bg-slate-100/80 dark:bg-slate-950/50 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      className="w-full h-[52px] bg-slate-100/80 dark:bg-slate-950/50 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl pl-11 pr-4 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    {isLogin && (
                      <a href="#" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full h-[52px] bg-slate-100/80 dark:bg-slate-950/50 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl pl-11 pr-12 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button className="w-full h-[52px] mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]">
                  <span>{isLogin ? "Sign In to Dashboard" : "Create Account"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            </div>
            
            {/* Disclaimer */}
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8">
              By continuing, you agree to AgentLabs'{" "}
              <a href="#" className="text-slate-900 dark:text-white hover:underline">Terms of Service</a> and{" "}
              <a href="#" className="text-slate-900 dark:text-white hover:underline">Privacy Policy</a>.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
