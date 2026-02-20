import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AuthStorage } from "@/lib/auth-storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, Cloud, Volume2, Brain, Play, RefreshCw, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AwsStatus {
  configured: boolean;
  polly: {
    configured: boolean;
    region: string;
  };
  bedrock: {
    configured: boolean;
    region: string;
  };
}

interface PollyVoice {
  id: string;
  name: string;
  gender: string;
  languageCode: string;
  languageName: string;
  supportedEngines: string[];
}

interface BedrockModel {
  id: string;
  alias: string;
  provider: string;
  tier: string;
}

const POLLY_ENGINES = [
  { id: "standard", name: "Standard" },
  { id: "neural", name: "Neural" },
  { id: "long-form", name: "Long-form" },
  { id: "generative", name: "Generative" },
];

export default function AwsCredentials() {
  const { toast } = useToast();
  const [isVoicePreviewOpen, setIsVoicePreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("Hello! This is a test of AWS Polly text-to-speech.");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [selectedEngine, setSelectedEngine] = useState("neural");
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<AwsStatus>({
    queryKey: ["/api/admin/aws/status"],
    refetchInterval: 30000,
  });

  const { data: voices, isLoading: voicesLoading } = useQuery<PollyVoice[]>({
    queryKey: ["/api/admin/aws/polly/voices"],
    enabled: isVoicePreviewOpen && status?.polly?.configured,
  });

  const { data: models } = useQuery<BedrockModel[]>({
    queryKey: ["/api/admin/aws/bedrock/models"],
  });

  const testPollyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/aws/test/polly");
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast({ title: "Success", description: result.message });
      } else {
        toast({ variant: "destructive", title: "Test Failed", description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const testBedrockMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/aws/test/bedrock");
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast({ title: "Success", description: result.message });
      } else {
        toast({ variant: "destructive", title: "Test Failed", description: result.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handlePlayPreview = async () => {
    if (!selectedVoice || !previewText) {
      toast({ variant: "destructive", title: "Error", description: "Please select a voice and enter text" });
      return;
    }

    setIsPlaying(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authHeader = AuthStorage.getAuthHeader();
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const response = await fetch("/api/admin/aws/polly/synthesize", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: previewText,
          voiceId: selectedVoice,
          engine: selectedEngine,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to synthesize speech");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.play();
    } catch (error: any) {
      setIsPlaying(false);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cloud className="h-6 w-6" />
            AWS Integration
          </h2>
          <p className="text-muted-foreground">
            AWS Polly (TTS) and Bedrock (LLM) services
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-status">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !status?.configured ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">AWS Not Configured</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              To enable AWS Polly and Bedrock, please add the following secrets in the Secrets tab:
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1 mb-4">
              <p>AWS_ACCESS_KEY_ID</p>
              <p>AWS_SECRET_ACCESS_KEY</p>
              <p>AWS_REGION</p>
            </div>
            <p className="text-xs text-muted-foreground">
              These credentials require IAM permissions for Polly and Bedrock services.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  AWS Polly
                </CardTitle>
                <Badge variant={status.polly.configured ? "default" : "destructive"} className="gap-1">
                  {status.polly.configured ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {status.polly.configured ? "Connected" : "Not Configured"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Neural and generative voices in 40+ languages.
                </p>
                <div className="text-sm">
                  <span className="text-muted-foreground">Region:</span>{" "}
                  <span className="font-medium">{status.polly.region}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testPollyMutation.mutate()}
                    disabled={testPollyMutation.isPending}
                    data-testid="button-test-polly"
                  >
                    {testPollyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVoicePreviewOpen(true)}
                    data-testid="button-preview-voices"
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    Preview Voices
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AWS Bedrock
                </CardTitle>
                <Badge variant={status.bedrock.configured ? "default" : "destructive"} className="gap-1">
                  {status.bedrock.configured ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {status.bedrock.configured ? "Connected" : "Not Configured"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Access Claude, Llama, Titan, and Mistral models.
                </p>
                <div className="text-sm">
                  <span className="text-muted-foreground">Region:</span>{" "}
                  <span className="font-medium">{status.bedrock.region}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testBedrockMutation.mutate()}
                  disabled={testBedrockMutation.isPending}
                  data-testid="button-test-bedrock"
                >
                  {testBedrockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </CardContent>
            </Card>
          </div>

          {models && models.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available Bedrock Models</CardTitle>
                <CardDescription>
                  These models can be used for agent conversations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-3">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-2 border rounded-lg text-sm"
                    >
                      <div>
                        <p className="font-medium">{model.alias}</p>
                        <p className="text-xs text-muted-foreground">{model.provider}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {model.tier}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={isVoicePreviewOpen} onOpenChange={setIsVoicePreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AWS Polly Voice Preview</DialogTitle>
            <DialogDescription>
              Test different Polly voices with custom text
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Preview Text</Label>
              <Input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Enter text to speak..."
                data-testid="input-preview-text"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Voice</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger data-testid="select-voice">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voicesLoading ? (
                      <div className="p-2 text-center text-muted-foreground">Loading...</div>
                    ) : (
                      voices?.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name} ({voice.languageName})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Engine</Label>
                <Select value={selectedEngine} onValueChange={setSelectedEngine}>
                  <SelectTrigger data-testid="select-engine">
                    <SelectValue placeholder="Select engine" />
                  </SelectTrigger>
                  <SelectContent>
                    {POLLY_ENGINES.map((engine) => (
                      <SelectItem key={engine.id} value={engine.id}>
                        {engine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handlePlayPreview}
              disabled={isPlaying || !selectedVoice}
              className="w-full"
              data-testid="button-play-preview"
            >
              {isPlaying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isPlaying ? "Playing..." : "Play Preview"}
            </Button>

            {voices && voices.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">All Available Voices</h4>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {voices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                        selectedVoice === voice.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedVoice(voice.id)}
                    >
                      <div>
                        <p className="font-medium text-sm">{voice.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {voice.languageName} - {voice.gender}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {voice.supportedEngines?.map((engine) => (
                          <Badge key={engine} variant="outline" className="text-xs">
                            {engine}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
