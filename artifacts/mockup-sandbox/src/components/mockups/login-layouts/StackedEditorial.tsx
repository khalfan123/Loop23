import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, 
  Settings2, 
  BrainCircuit, 
  Zap,
  Globe2,
  Languages,
  Activity,
  Headphones,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

export function StackedEditorial() {
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  const features = [
    {
      icon: <Bot className="w-5 h-5 text-blue-500" />,
      title: "AI Agent Templates",
      desc: "Ready-to-use templates for sales, support, and more."
    },
    {
      icon: <Settings2 className="w-5 h-5 text-blue-500" />,
      title: "Custom Agents",
      desc: "Build tailored AI workflows for your specific needs."
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-blue-500" />,
      title: "Context-aware Agents",
      desc: "Agents that remember past interactions and context."
    },
    {
      icon: <Zap className="w-5 h-5 text-blue-500" />,
      title: "Instant Updates",
      desc: "Changes deploy to your agents in real-time."
    }
  ];

  const stats = [
    { icon: <Globe2 className="w-4 h-4" />, text: "100+ Countries" },
    { icon: <Languages className="w-4 h-4" />, text: "30+ Languages" },
    { icon: <Activity className="w-4 h-4" />, text: "99.9% Uptime" },
    { icon: <Headphones className="w-4 h-4" />, text: "24/7 Support" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans overflow-x-hidden selection:bg-blue-500/30">
      
      {/* 1. TOP SECTION: Hero (~35% height) */}
      <section className="relative w-full pt-12 pb-16 px-6 lg:px-12 flex flex-col items-center justify-center min-h-[40vh] overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/10 z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-transparent to-transparent dark:from-blue-900/20 z-0" />
        
        {/* Logo Area */}
        <div className="absolute top-6 left-6 md:top-8 md:left-12 z-10 flex flex-col gap-2">
          <div className="h-[120px] w-[120px] bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-sm flex items-center justify-center">
            <span className="font-bold text-slate-800 dark:text-slate-200">Logo</span>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Bot className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">AgentLabs</span>
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center mt-32 md:mt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
              Launch AI agents & <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">automate your customer interactions</span>
            </h1>
          </motion.div>

          {/* Stats Row */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-8"
          >
            {stats.map((stat, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 text-sm font-medium bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
                {stat.icon}
                <span>{stat.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 2. MIDDLE SECTION: Features Strip */}
      <section className="relative z-20 w-full py-8 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (idx * 0.1), duration: 0.4 }}
                className="bg-white/80 dark:bg-slate-800/80 p-5 rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-sm backdrop-blur-md"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. BOTTOM SECTION: Form */}
      <section className="flex-grow flex items-center justify-center py-16 px-6 relative z-10 w-full bg-slate-50 dark:bg-slate-950">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5, type: "spring" }}
          className="w-full max-w-[420px]"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 sm:p-10">
            
            {/* Tabs */}
            <div className="flex p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl mb-8">
              <button
                onClick={() => setActiveTab('signin')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'signin' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'signup' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Sign Up
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {activeTab === 'signin' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeTab === 'signin' 
                  ? 'Enter your credentials to access your account' 
                  : 'Start automating your customer interactions today'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Work Email</label>
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  className="w-full h-[52px] px-4 bg-slate-100/80 dark:bg-slate-800/80 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                  {activeTab === 'signin' && (
                    <a href="#" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                      Forgot password?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    className="w-full h-[52px] pl-4 pr-12 bg-slate-100/80 dark:bg-slate-800/80 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button className="w-full h-[52px] mt-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all group">
                <span>{activeTab === 'signin' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
            
          </div>
        </motion.div>
      </section>

      {/* 4. FOOTER */}
      <footer className="w-full py-8 text-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} AgentLabs Inc. All rights reserved.
        </p>
      </footer>

    </div>
  );
}
