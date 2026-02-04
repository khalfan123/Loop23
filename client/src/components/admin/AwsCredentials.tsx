import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Plus, Trash2, Power, PowerOff, RefreshCw, Server, Star, Loader2, Eye, EyeOff, Cloud, Volume2, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface AwsCredential {
  id: string;
  name: string;
  region: string;
  isActive: boolean;
  isPrimary: boolean;
  enabledServices: {
    polly: boolean;
    bedrock: boolean;
  };
  pollyVoiceEngine: string;
  bedrockDefaultModel: string;
  maxConcurrency: number;
  currentLoad: number;
  totalAssignedAgents: number;
  healthStatus: string;
  createdAt: string;
  updatedAt: string;
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

const AWS_REGIONS = [
  { id: "us-east-1", name: "US East (N. Virginia)" },
  { id: "us-east-2", name: "US East (Ohio)" },
  { id: "us-west-1", name: "US West (N. California)" },
  { id: "us-west-2", name: "US West (Oregon)" },
  { id: "eu-west-1", name: "EU (Ireland)" },
  { id: "eu-west-2", name: "EU (London)" },
  { id: "eu-central-1", name: "EU (Frankfurt)" },
  { id: "ap-northeast-1", name: "Asia Pacific (Tokyo)" },
  { id: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
  { id: "ap-southeast-2", name: "Asia Pacific (Sydney)" },
  { id: "ap-south-1", name: "Asia Pacific (Mumbai)" },
];

const POLLY_ENGINES = [
  { id: "standard", name: "Standard", description: "Basic TTS" },
  { id: "neural", name: "Neural", description: "High-quality neural voices" },
  { id: "long-form", name: "Long-form", description: "Optimized for longer content" },
  { id: "generative", name: "Generative", description: "Most advanced AI voices" },
];

export default function AwsCredentials() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isVoicePreviewOpen, setIsVoicePreviewOpen] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [isTestingCredentials, setIsTestingCredentials] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  
  const [newCredential, setNewCredential] = useState({
    name: "",
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
    enabledServices: { polly: true, bedrock: true },
    pollyVoiceEngine: "neural",
    bedrockDefaultModel: "",
    maxConcurrency: 100,
  });

  const { data: credentials, isLoading } = useQuery<AwsCredential[]>({
    queryKey: ["/api/admin/aws-credentials"],
    refetchInterval: 30000,
  });

  const { data: voices } = useQuery<PollyVoice[]>({
    queryKey: ["/api/admin/aws-credentials", selectedCredentialId, "polly/voices"],
    enabled: !!selectedCredentialId && isVoicePreviewOpen,
  });

  const { data: models } = useQuery<BedrockModel[]>({
    queryKey: ["/api/admin/aws-credentials", selectedCredentialId, "bedrock/models"],
    enabled: !!selectedCredentialId,
  });

  const addCredentialMutation = useMutation({
    mutationFn: async (data: typeof newCredential) => {
      return apiRequest("POST", "/api/admin/aws-credentials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aws-credentials"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "AWS credentials added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add credentials",
      });
    },
  });

  const updateCredentialMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AwsCredential> }) => {
      return apiRequest("PATCH", `/api/admin/aws-credentials/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aws-credentials"] });
      toast({
        title: "Success",
        description: "Credential updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update credential",
      });
    },
  });

  const deleteCredentialMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/aws-credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/aws-credentials"] });
      toast({
        title: "Success",
        description: "Credential deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete credential",
      });
    },
  });

  const testCredentialsMutation = useMutation({
    mutationFn: async (data: { accessKeyId: string; secretAccessKey: string; region: string }) => {
      return apiRequest("POST", "/api/admin/aws-credentials/test", data);
    },
  });

  const resetForm = () => {
    setNewCredential({
      name: "",
      accessKeyId: "",
      secretAccessKey: "",
      region: "us-east-1",
      enabledServices: { polly: true, bedrock: true },
      pollyVoiceEngine: "neural",
      bedrockDefaultModel: "",
      maxConcurrency: 100,
    });
    setShowSecretKey(false);
  };

  const handleTestCredentials = async () => {
    if (!newCredential.accessKeyId || !newCredential.secretAccessKey) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter both Access Key ID and Secret Access Key",
      });
      return;
    }

    setIsTestingCredentials(true);
    try {
      const result = await testCredentialsMutation.mutateAsync({
        accessKeyId: newCredential.accessKeyId,
        secretAccessKey: newCredential.secretAccessKey,
        region: newCredential.region,
      });

      if (result.success) {
        toast({
          title: "Credentials Valid",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Credentials Invalid",
          description: result.message || "Failed to validate credentials",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error.message || "Failed to test credentials",
      });
    } finally {
      setIsTestingCredentials(false);
    }
  };

  const handleToggleActive = (credential: AwsCredential) => {
    updateCredentialMutation.mutate({
      id: credential.id,
      data: { isActive: !credential.isActive },
    });
  };

  const handleSetPrimary = (credentialId: string) => {
    apiRequest("PATCH", `/api/admin/aws-credentials/${credentialId}/set-primary`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/aws-credentials"] });
        toast({
          title: "Success",
          description: "Primary credential updated",
        });
      })
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to set primary credential",
        });
      });
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
            Manage AWS credentials for Polly (TTS) and Bedrock (LLM) services
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-aws-credential">
          <Plus className="h-4 w-4 mr-2" />
          Add Credentials
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <Volume2 className="h-4 w-4 inline mr-2" />
              AWS Polly
            </CardTitle>
            <Badge variant="outline">Text-to-Speech</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Neural and generative voices in 40+ languages. Cost-effective alternative for high-volume campaigns.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <Brain className="h-4 w-4 inline mr-2" />
              AWS Bedrock
            </CardTitle>
            <Badge variant="outline">LLM Provider</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Access Claude, Llama, Titan, and Mistral models through a unified API.
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : credentials?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No AWS Credentials</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your AWS credentials to enable Polly and Bedrock integration.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Credentials
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials?.map((credential) => (
            <Card key={credential.id} className={!credential.isActive ? "opacity-60" : ""}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium" data-testid={`text-credential-name-${credential.id}`}>
                    {credential.name}
                  </CardTitle>
                  {credential.isPrimary && (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3" />
                      Primary
                    </Badge>
                  )}
                  <Badge 
                    variant={credential.healthStatus === "healthy" ? "outline" : "destructive"}
                    className="gap-1"
                  >
                    {credential.healthStatus === "healthy" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {credential.healthStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {!credential.isPrimary && credential.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetPrimary(credential.id)}
                      data-testid={`button-set-primary-${credential.id}`}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(credential)}
                    data-testid={`button-toggle-active-${credential.id}`}
                  >
                    {credential.isActive ? (
                      <Power className="h-4 w-4 text-green-500" />
                    ) : (
                      <PowerOff className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCredentialId(credential.id);
                      setIsVoicePreviewOpen(true);
                    }}
                    data-testid={`button-preview-voices-${credential.id}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteCredentialMutation.mutate(credential.id)}
                    data-testid={`button-delete-${credential.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Region:</span>
                    <p className="font-medium">{credential.region}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Voice Engine:</span>
                    <p className="font-medium capitalize">{credential.pollyVoiceEngine}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Services:</span>
                    <div className="flex gap-1 mt-1">
                      {credential.enabledServices?.polly && (
                        <Badge variant="secondary" className="text-xs">Polly</Badge>
                      )}
                      {credential.enabledServices?.bedrock && (
                        <Badge variant="secondary" className="text-xs">Bedrock</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assigned Agents:</span>
                    <p className="font-medium">{credential.totalAssignedAgents}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add AWS Credentials</DialogTitle>
            <DialogDescription>
              Add your AWS IAM credentials to enable Polly and Bedrock services.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production AWS"
                value={newCredential.name}
                onChange={(e) => setNewCredential({ ...newCredential, name: e.target.value })}
                data-testid="input-credential-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">Access Key ID</Label>
              <Input
                id="accessKeyId"
                placeholder="AKIA..."
                value={newCredential.accessKeyId}
                onChange={(e) => setNewCredential({ ...newCredential, accessKeyId: e.target.value })}
                data-testid="input-access-key-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">Secret Access Key</Label>
              <div className="relative">
                <Input
                  id="secretAccessKey"
                  type={showSecretKey ? "text" : "password"}
                  placeholder="Your secret access key"
                  value={newCredential.secretAccessKey}
                  onChange={(e) => setNewCredential({ ...newCredential, secretAccessKey: e.target.value })}
                  data-testid="input-secret-access-key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">AWS Region</Label>
              <Select
                value={newCredential.region}
                onValueChange={(value) => setNewCredential({ ...newCredential, region: value })}
              >
                <SelectTrigger data-testid="select-region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {AWS_REGIONS.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pollyEngine">Default Polly Voice Engine</Label>
              <Select
                value={newCredential.pollyVoiceEngine}
                onValueChange={(value) => setNewCredential({ ...newCredential, pollyVoiceEngine: value })}
              >
                <SelectTrigger data-testid="select-polly-engine">
                  <SelectValue placeholder="Select engine" />
                </SelectTrigger>
                <SelectContent>
                  {POLLY_ENGINES.map((engine) => (
                    <SelectItem key={engine.id} value={engine.id}>
                      {engine.name} - {engine.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Polly (TTS)</Label>
                <p className="text-xs text-muted-foreground">Text-to-speech service</p>
              </div>
              <Switch
                checked={newCredential.enabledServices.polly}
                onCheckedChange={(checked) =>
                  setNewCredential({
                    ...newCredential,
                    enabledServices: { ...newCredential.enabledServices, polly: checked },
                  })
                }
                data-testid="switch-enable-polly"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Bedrock (LLM)</Label>
                <p className="text-xs text-muted-foreground">AI model access</p>
              </div>
              <Switch
                checked={newCredential.enabledServices.bedrock}
                onCheckedChange={(checked) =>
                  setNewCredential({
                    ...newCredential,
                    enabledServices: { ...newCredential.enabledServices, bedrock: checked },
                  })
                }
                data-testid="switch-enable-bedrock"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleTestCredentials}
              disabled={isTestingCredentials || !newCredential.accessKeyId || !newCredential.secretAccessKey}
              data-testid="button-test-credentials"
            >
              {isTestingCredentials ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Credentials
            </Button>
            <Button
              onClick={() => addCredentialMutation.mutate(newCredential)}
              disabled={addCredentialMutation.isPending || !newCredential.name || !newCredential.accessKeyId || !newCredential.secretAccessKey}
              data-testid="button-save-credential"
            >
              {addCredentialMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isVoicePreviewOpen} onOpenChange={setIsVoicePreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AWS Polly Voices</DialogTitle>
            <DialogDescription>
              Available voices for this credential. Use these voice IDs when configuring agents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {voices?.length === 0 ? (
              <p className="text-center text-muted-foreground">No voices available</p>
            ) : (
              <div className="grid gap-2">
                {voices?.map((voice) => (
                  <div
                    key={voice.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{voice.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {voice.languageName} ({voice.languageCode}) - {voice.gender}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {voice.supportedEngines?.map((engine) => (
                        <Badge key={engine} variant="outline" className="text-xs">
                          {engine}
                        </Badge>
                      ))}
                      <code className="text-xs bg-muted px-2 py-1 rounded">{voice.id}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
