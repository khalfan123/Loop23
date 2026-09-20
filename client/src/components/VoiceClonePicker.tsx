/**
 * Select a ready Instant Clone profile for local_clone agents.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface VoiceCloneProfile {
  id: string;
  name: string;
  providerProfileId: string;
  status: string;
}

interface VoiceClonePickerProps {
  value: string;
  onChange: (providerProfileId: string) => void;
  placeholder?: string;
}

export function VoiceClonePicker({
  value,
  onChange,
  placeholder = 'Select Instant Clone…',
}: VoiceClonePickerProps) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const { data: profiles = [], isLoading } = useQuery<VoiceCloneProfile[]>({
    queryKey: ['/api/voice-clones'],
  });

  const ready = profiles.filter((p) => p.status === 'ready');
  const selected = ready.find((p) => p.providerProfileId === value);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  };

  const preview = async () => {
    if (!selected) return;
    if (playing) {
      stop();
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch(`/api/voice-clones/${selected.id}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Preview failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlaying(true);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlaying(false);
      };
      await audio.play();
    } catch (err: any) {
      toast({ title: 'Preview unavailable', description: err.message, variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full" data-testid="voice-clone-picker">
      <div className="flex-1 min-w-0">
        <Select value={value || undefined} onValueChange={onChange} disabled={isLoading}>
          <SelectTrigger data-testid="select-local-clone-voice">
            <SelectValue placeholder={isLoading ? 'Loading clones…' : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {ready.length === 0 ? (
              <SelectItem value="__none" disabled>
                No ready Instant Clones — create one in Voices
              </SelectItem>
            ) : (
              ready.map((p) => (
                <SelectItem key={p.id} value={p.providerProfileId}>
                  {p.name} ({p.providerProfileId})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={!selected || previewing}
        onClick={preview}
        data-testid="button-preview-local-clone"
      >
        {previewing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Square className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
