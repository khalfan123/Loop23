import { useState, useEffect, useRef } from "react";
import { Phone, Plus, Bot, Target, ChevronDown, Signal, Server, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface PhoneNumberItem {
  id: string;
  phoneNumber: string;
  friendlyName?: string | null;
  status: string;
  country: string;
  isSystemPool: boolean;
}

interface IncomingConnection {
  id: string;
  agentId: string;
  phoneNumberId: string;
  agent?: {
    id: string;
    name: string;
  } | null;
}

interface ConnectionsResponse {
  connections: IncomingConnection[];
  allConnections: IncomingConnection[];
}

interface Campaign {
  id: string;
  name: string;
  phoneNumberId?: string | null;
  status: string;
}

interface IvrConfiguration {
  id: string;
  name: string;
  phoneNumberId?: string | null;
  isActive: boolean;
}

export function PhoneNumberDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data: phoneNumbers = [] } = useQuery<PhoneNumberItem[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const { data: connectionsData } = useQuery<ConnectionsResponse>({
    queryKey: ["/api/incoming-connections"],
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: ivrConfigs = [] } = useQuery<IvrConfiguration[]>({
    queryKey: ["/api/departments/ivr/all"],
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allConnections = connectionsData?.allConnections || connectionsData?.connections || [];

  const getAssignments = (phoneId: string): { type: "agent" | "campaign" | "department"; name: string }[] => {
    const results: { type: "agent" | "campaign" | "department"; name: string }[] = [];
    const connection = allConnections.find(c => c.phoneNumberId === phoneId);
    if (connection?.agent) {
      results.push({ type: "agent", name: connection.agent.name });
    }
    const campaign = campaigns.find(c => c.phoneNumberId === phoneId && ["pending", "running", "scheduled", "paused"].includes(c.status));
    if (campaign) {
      results.push({ type: "campaign", name: campaign.name });
    }
    const ivr = ivrConfigs.find(c => c.phoneNumberId === phoneId && c.isActive);
    if (ivr) {
      results.push({ type: "department", name: ivr.name });
    }
    return results;
  };

  const userNumbers = phoneNumbers.filter(p => !p.isSystemPool);
  const poolNumbers = phoneNumbers.filter(p => p.isSystemPool);
  const totalCount = phoneNumbers.length;

  const getAssignIcon = (type: "agent" | "campaign" | "department") => {
    if (type === "campaign") return Target;
    if (type === "department") return Building2;
    return Bot;
  };

  const getAssignColor = (type: "agent" | "campaign" | "department") => {
    if (type === "department") return "text-purple-600 dark:text-purple-400";
    if (type === "campaign") return "text-orange-600 dark:text-orange-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const renderPhoneItem = (phone: PhoneNumberItem) => {
    const assignments = getAssignments(phone.id);
    return (
      <button
        key={phone.id}
        onClick={() => {
          setIsOpen(false);
          setLocation("/app/phone-numbers");
        }}
        className="w-full flex items-start gap-2.5 px-3.5 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
        data-testid={`phone-item-${phone.id}`}
      >
        <div className="flex-shrink-0 mt-1.5">
          <div className={cn(
            "w-2 h-2 rounded-full",
            phone.status === "active"
              ? "bg-emerald-500"
              : "bg-zinc-300 dark:bg-zinc-600"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {phone.friendlyName || phone.phoneNumber}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {phone.friendlyName && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {phone.phoneNumber}
              </span>
            )}
            {assignments.length > 0 ? (
              assignments.map((a, i) => {
                const Icon = getAssignIcon(a.type);
                return (
                  <span key={i} className={cn("inline-flex items-center gap-1 text-xs", getAssignColor(a.type))}>
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate max-w-[100px]">{a.name}</span>
                  </span>
                );
              })
            ) : (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">Unassigned</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          <Signal className={cn(
            "h-3.5 w-3.5",
            phone.status === "active"
              ? "text-emerald-500"
              : "text-zinc-300 dark:text-zinc-600"
          )} />
        </div>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative" data-testid="phone-number-dropdown-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-[7px] rounded-[10px] transition-colors duration-150",
          "bg-[var(--l9-surface)] border border-[var(--l9-border-control)]",
          isOpen && "bg-[var(--l9-hover)]",
        )}
        data-testid="button-phone-dropdown"
      >
        <Phone className="h-[15px] w-[15px] text-[var(--l9-text-muted)]" />
        <span className="hidden sm:inline text-[14px] font-semibold text-[var(--l9-text)] tabular-nums">
          {totalCount || 1}
        </span>
        <ChevronDown className={cn(
          "h-[13px] w-[13px] text-[var(--l9-text-faint)] transition-transform duration-150",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1.5 w-72 rounded-xl bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.08] shadow-lg overflow-hidden z-50"
          data-testid="phone-dropdown-menu"
        >
          {userNumbers.length > 0 && (
            <>
              <div className="px-3.5 py-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider" data-testid="text-your-numbers-header">
                  Your Numbers ({userNumbers.length})
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {userNumbers.map(renderPhoneItem)}
              </div>
            </>
          )}

          {poolNumbers.length > 0 && (
            <>
              <div className="px-3.5 py-2 border-b border-black/[0.04] dark:border-white/[0.06] border-t border-t-black/[0.04] dark:border-t-white/[0.06]">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5" data-testid="text-pool-numbers-header">
                  <Server className="h-3 w-3" />
                  Pool Numbers ({poolNumbers.length})
                </p>
              </div>
              <div className="max-h-32 overflow-y-auto py-1">
                {poolNumbers.map(renderPhoneItem)}
              </div>
            </>
          )}

          {userNumbers.length === 0 && poolNumbers.length === 0 && (
            <div className="px-3.5 py-4 text-center" data-testid="phone-dropdown-empty">
              <Phone className="h-5 w-5 text-zinc-300 dark:text-zinc-600 mx-auto mb-1.5" />
              <p className="text-sm text-zinc-400 dark:text-zinc-500">No numbers available</p>
            </div>
          )}

          <div className="border-t border-black/[0.04] dark:border-white/[0.06]">
            <button
              onClick={() => {
                setIsOpen(false);
                setLocation("/app/phone-numbers");
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
              data-testid="button-add-phone-number"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Add New Number</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
