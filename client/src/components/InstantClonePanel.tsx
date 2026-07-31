/**
 * Instant Clone panel — consent + upload → local_clone profile IDs.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Play, Square, Trash2, Upload, ShieldCheck, Loader2, Copy, Check, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VoiceCloneProfile {
  id: string;
  name: string;
  providerProfileId: string;
  status: string;
  language: string | null;
  consentVersion: string;
  createdAt: string;
  errorMessage?: string | null;
}

interface ConsentInfo {
  version: string;
  summary: string;
  points: string[];
}

interface CostTakeoverStatus {
  enabled: boolean;
  live: boolean;
  gatesGreen: boolean;
  reasons: string[];
  eligibleCount: number;
  linkableCount: number;
  readyProfileCount: number;
  alreadyOnLocalCloneCount: number;
  softTakeoverActive: boolean;
}

interface LinkableAgent {
  id: string;
  name: string;
  voiceProvider: string | null;
  elevenLabsVoiceId: string | null;
  localCloneVoiceId: string | null;
  readyToFlip?: boolean;
}

export function InstantClonePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [forceMigrate, setForceMigrate] = useState(false);

  const { data: consent } = useQuery<ConsentInfo>({
    queryKey: ['/api/voice-clones/consent'],
  });

  const { data: profiles = [], isLoading } = useQuery<VoiceCloneProfile[]>({
    queryKey: ['/api/voice-clones'],
  });

  const readyProfiles = useMemo(
    () => profiles.filter((p) => p.status === 'ready'),
    [profiles],
  );

  const { data: takeoverStatus, refetch: refetchStatus } = useQuery<CostTakeoverStatus>({
    queryKey: ['/api/voice-clones/cost-takeover/status'],
  });

  const { data: eligiblePayload, refetch: refetchEligible } = useQuery<{
    agents: LinkableAgent[];
    linkable: LinkableAgent[];
  }>({
    queryKey: ['/api/voice-clones/cost-takeover/eligible'],
  });

  const linkableAgents = eligiblePayload?.linkable || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose an audio sample');
      const body = new FormData();
      body.append('name', name.trim());
      body.append('sample', file);
      body.append('consentAccepted', consentAccepted ? 'true' : 'false');
      body.append('language', 'en');
      const res = await fetch('/api/voice-clones', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to create clone');
      return json as VoiceCloneProfile;
    },
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice-clones'] });
      setName('');
      setFile(null);
      setConsentAccepted(false);
      if (fileRef.current) fileRef.current.value = '';
      toast({
        title: 'Instant Clone created',
        description: `Profile ID ${profile.providerProfileId} — set agent voiceProvider to local_clone.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Clone failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voice-clones/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice-clones'] });
      queryClient.invalidateQueries({ queryKey: ['/api/voice-clones/cost-takeover/status'] });
      toast({ title: 'Clone deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const body: Record<string, unknown> = {
        dryRun,
        force: forceMigrate,
      };
      if (selectedProfileId) body.voiceCloneProfileId = selectedProfileId;
      if (selectedAgentIds.length) body.agentIds = selectedAgentIds;
      const res = await fetch('/api/voice-clones/cost-takeover/migrate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Migration failed');
      return json as {
        dryRun: boolean;
        migrated: number;
        candidates: LinkableAgent[];
        assignedCloneId: string | null;
        forced?: boolean;
      };
    },
    onSuccess: (result) => {
      refetchStatus();
      refetchEligible();
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      if (result.dryRun) {
        toast({
          title: 'Dry run',
          description: `${result.candidates.length} agent(s) would move to local_clone` +
            (result.assignedCloneId ? ` (${result.assignedCloneId})` : ''),
        });
      } else {
        toast({
          title: 'Hard takeover complete',
          description: `Migrated ${result.migrated} agent(s) off ElevenLabs to local_clone.`,
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Migration failed', description: err.message, variant: 'destructive' });
    },
  });

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const playPreview = useCallback(
    async (id: string) => {
      if (playingId === id) {
        stopPreview();
        return;
      }
      stopPreview();
      try {
        const res = await fetch(`/api/voice-clones/${id}/preview`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Preview failed');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setPlayingId(id);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setPlayingId(null);
        };
        await audio.play();
      } catch (err: any) {
        toast({ title: 'Preview unavailable', description: err.message, variant: 'destructive' });
      }
    },
    [playingId, stopPreview, toast],
  );

  const copyId = async (providerProfileId: string) => {
    await navigator.clipboard.writeText(providerProfileId);
    setCopiedId(providerProfileId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const canSubmit = useMemo(
    () => !!name.trim() && !!file && consentAccepted && !createMutation.isPending,
    [name, file, consentAccepted, createMutation.isPending],
  );

  return (
    <div className="space-y-6" data-testid="instant-clone-panel">
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        <AlertTitle className="text-sm">Consent required</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground space-y-2">
          <p>{consent?.summary}</p>
          <ul className="list-disc pl-4 space-y-1">
            {(consent?.points || []).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {consent?.version && (
            <p className="text-[10px] uppercase tracking-wide opacity-70">Version {consent.version}</p>
          )}
        </AlertDescription>
      </Alert>

      <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clone-name">Clone name</Label>
          <Input
            id="clone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Support agent — Mira"
            maxLength={80}
            data-testid="input-clone-name"
          />
        </div>

        <div className="space-y-2">
          <Label>Voice sample (10–60s, wav/mp3/m4a, max 15MB)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              data-testid="button-clone-upload"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Choose file
            </Button>
            <span className="text-xs text-muted-foreground truncate max-w-[240px]">
              {file ? file.name : 'No file selected'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg,.flac"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="input-clone-file"
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={consentAccepted}
            onCheckedChange={(v) => setConsentAccepted(v === true)}
            data-testid="checkbox-clone-consent"
          />
          <span className="text-muted-foreground leading-snug">
            I confirm speaker consent and lawful use of this sample for Instant Clone on my account.
          </span>
        </label>

        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => createMutation.mutate()}
          data-testid="button-create-clone"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Mic className="h-4 w-4 mr-1.5" />
          )}
          Create Instant Clone
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your clones</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{profiles.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No Instant Clones yet. Upload a consented sample to get a profile ID.
          </p>
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-3"
                data-testid={`card-clone-${p.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
                      {p.providerProfileId}
                    </code>
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium',
                        p.status === 'ready'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : p.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.errorMessage && (
                    <p className="text-[11px] text-destructive mt-1 truncate">{p.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => copyId(p.providerProfileId)}
                    title="Copy profile ID"
                    data-testid={`button-copy-clone-${p.id}`}
                  >
                    {copiedId === p.providerProfileId ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={p.status !== 'ready'}
                    onClick={() => playPreview(p.id)}
                    title="Preview"
                    data-testid={`button-preview-clone-${p.id}`}
                  >
                    {playingId === p.id ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(p.id)}
                    title="Delete"
                    data-testid={`button-delete-clone-${p.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 space-y-4" data-testid="cost-takeover-panel">
        <div className="flex items-start gap-2">
          <ArrowRightLeft className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-semibold">Hard cost takeover</h3>
            <p className="text-xs text-muted-foreground">
              Assign a ready Instant Clone to ElevenLabs agents and flip{' '}
              <code className="text-[11px]">voiceProvider</code> to{' '}
              <code className="text-[11px]">local_clone</code> so calls stop using the EL pool.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <div className="text-lg font-semibold tabular-nums">{takeoverStatus?.linkableCount ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">EL agents</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <div className="text-lg font-semibold tabular-nums">{takeoverStatus?.eligibleCount ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ready to flip</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <div className="text-lg font-semibold tabular-nums">{takeoverStatus?.readyProfileCount ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ready clones</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <div className="text-lg font-semibold tabular-nums">{takeoverStatus?.alreadyOnLocalCloneCount ?? '—'}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">On local_clone</div>
          </div>
        </div>

        {takeoverStatus && !takeoverStatus.gatesGreen && (
          <Alert variant="destructive" className="py-3">
            <AlertTitle className="text-sm">Gates not green</AlertTitle>
            <AlertDescription className="text-xs space-y-1">
              {(takeoverStatus.reasons || []).map((r) => (
                <div key={r}>{r}</div>
              ))}
              <p className="pt-1 opacity-90">
                Enable <code>LOCAL_CLONE_TTS_LIVE=1</code> and <code>LOCAL_CLONE_COST_TAKEOVER=1</code>, or check
                Force below to cut over anyway.
              </p>
            </AlertDescription>
          </Alert>
        )}
        {takeoverStatus?.gatesGreen && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Gates green — soft takeover active for hybrid EL agents with a clone id.</p>
        )}

        <div className="space-y-2">
          <Label>Clone profile to assign</Label>
          <Select
            value={selectedProfileId || undefined}
            onValueChange={setSelectedProfileId}
            disabled={readyProfiles.length === 0}
          >
            <SelectTrigger data-testid="select-takeover-clone">
              <SelectValue placeholder={readyProfiles.length ? 'Select ready clone…' : 'No ready clones'} />
            </SelectTrigger>
            <SelectContent>
              {readyProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.providerProfileId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>ElevenLabs agents</Label>
            {linkableAgents.length > 0 && (
              <button
                type="button"
                className="text-[11px] text-primary"
                onClick={() =>
                  setSelectedAgentIds(
                    selectedAgentIds.length === linkableAgents.length
                      ? []
                      : linkableAgents.map((a) => a.id),
                  )
                }
                data-testid="button-toggle-all-agents"
              >
                {selectedAgentIds.length === linkableAgents.length ? 'Clear' : 'Select all'}
              </button>
            )}
          </div>
          {linkableAgents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No ElevenLabs agents on this account yet. Create agents, then return here to migrate them.
            </p>
          ) : (
            <ul className="max-h-40 overflow-y-auto space-y-1 border border-border/40 rounded-lg p-2">
              {linkableAgents.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer px-1 py-1 rounded hover:bg-muted/60">
                    <Checkbox
                      checked={selectedAgentIds.includes(a.id)}
                      onCheckedChange={() => toggleAgent(a.id)}
                      data-testid={`checkbox-takeover-agent-${a.id}`}
                    />
                    <span className="truncate flex-1">{a.name}</span>
                    {a.readyToFlip && (
                      <span className="text-[10px] text-emerald-600 shrink-0">has clone id</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <Checkbox
            checked={forceMigrate}
            onCheckedChange={(v) => setForceMigrate(v === true)}
            data-testid="checkbox-force-migrate"
          />
          <span className="text-muted-foreground leading-snug">
            Force migrate even if LIVE / COST_TAKEOVER gates are red (ops override).
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={migrateMutation.isPending || (!selectedProfileId && selectedAgentIds.length === 0 && (takeoverStatus?.eligibleCount || 0) === 0)}
            onClick={() => migrateMutation.mutate(true)}
            data-testid="button-takeover-dry-run"
          >
            Dry run
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              migrateMutation.isPending ||
              (!selectedProfileId && (takeoverStatus?.eligibleCount || 0) === 0) ||
              (selectedProfileId && selectedAgentIds.length === 0 && linkableAgents.length > 0)
            }
            onClick={() => migrateMutation.mutate(false)}
            data-testid="button-takeover-migrate"
          >
            {migrateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            )}
            Migrate to local_clone
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Soft takeover (runtime) needs <code className="text-[11px]">LOCAL_CLONE_TTS_LIVE=1</code> +{' '}
        <code className="text-[11px]">LOCAL_CLONE_COST_TAKEOVER=1</code>. Hard migrate updates agent rows permanently.
      </p>
    </div>
  );
}
