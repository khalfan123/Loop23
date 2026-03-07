import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Mic, Brain, Phone, TestTube, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StatusData {
  bedrockConfigured: boolean;
  pollyConfigured: boolean;
  activeSessions: number;
  region?: string;
}

interface PollyVoice {
  id: string;
  name: string;
  gender: string;
  language: string;
  languageCode: string;
  engine: string;
  description?: string;
}

interface BedrockModel {
  modelId: string;
  alias: string;
  provider: string;
  tier: string;
}

interface Agent {
  id: number;
  name: string;
}

interface PhoneNumber {
  id: number;
  phoneNumber: string;
  label?: string;
}

export default function RockCenter() {
  const { toast } = useToast();
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [testCallResult, setTestCallResult] = useState<any>(null);
  const [bedrockTestResult, setBedrockTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pollyTestResult, setPollyTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<StatusData>({
    queryKey: ['/api/bedrock-polly/status'],
  });

  const { data: voices, isLoading: voicesLoading } = useQuery<PollyVoice[]>({
    queryKey: ['/api/bedrock-polly/voices'],
  });

  const { data: models, isLoading: modelsLoading } = useQuery<BedrockModel[]>({
    queryKey: ['/api/bedrock-polly/models'],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
  });

  const { data: phoneNumbers } = useQuery<PhoneNumber[]>({
    queryKey: ['/api/phone-numbers'],
  });

  const testCallMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/bedrock-polly/test-call', data);
      return res.json();
    },
    onSuccess: (data) => {
      setTestCallResult(data);
      toast({ title: "Test call initiated", description: "Call has been placed successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Test call failed", description: error.message || "Failed to initiate test call.", variant: "destructive" });
    },
  });

  const testBedrockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/bedrock-polly/test-bedrock', {});
      return res.json();
    },
    onSuccess: (data) => {
      setBedrockTestResult({ success: true, message: data.message || "Bedrock credentials are valid." });
      toast({ title: "Bedrock Test Passed", description: "AWS Bedrock credentials are configured correctly." });
    },
    onError: (error: any) => {
      setBedrockTestResult({ success: false, message: error.message || "Bedrock credential test failed." });
      toast({ title: "Bedrock Test Failed", description: error.message || "Check your AWS Bedrock credentials.", variant: "destructive" });
    },
  });

  const testPollyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/bedrock-polly/test-polly', {});
      return res.json();
    },
    onSuccess: (data) => {
      setPollyTestResult({ success: true, message: data.message || "Polly credentials are valid." });
      toast({ title: "Polly Test Passed", description: "AWS Polly credentials are configured correctly." });
    },
    onError: (error: any) => {
      setPollyTestResult({ success: false, message: error.message || "Polly credential test failed." });
      toast({ title: "Polly Test Failed", description: error.message || "Check your AWS Polly credentials.", variant: "destructive" });
    },
  });

  const handleTestCall = () => {
    if (!selectedAgent || !phoneNumber || !selectedFromNumber) {
      toast({ title: "Missing fields", description: "Please fill in all fields before initiating a test call.", variant: "destructive" });
      return;
    }
    testCallMutation.mutate({
      agentId: selectedAgent,
      toNumber: phoneNumber,
      fromNumberId: selectedFromNumber,
    });
  };

  const filteredVoices = (voices || []).filter((voice) => {
    if (genderFilter !== "all" && voice.gender?.toLowerCase() !== genderFilter) return false;
    if (languageFilter !== "all" && voice.languageCode !== languageFilter) return false;
    return true;
  });

  const uniqueLanguages = Array.from(new Set((voices || []).map((v) => v.languageCode).filter(Boolean)));

  const agentList = Array.isArray(agents) ? agents : [];
  const phoneNumberList = Array.isArray(phoneNumbers) ? phoneNumbers : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-rockcenter-title">RockCenter</h1>
            {status && (
              <Badge
                variant={status.bedrockConfigured && status.pollyConfigured ? "default" : "secondary"}
                data-testid="badge-engine-status"
              >
                {status.bedrockConfigured && status.pollyConfigured ? "Online" : "Partially Configured"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1" data-testid="text-rockcenter-subtitle">AWS Bedrock + Polly Voice Engine</p>
        </div>
      </div>

      {statusLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-bedrock-status">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Bedrock</p>
                    <div className="flex items-center gap-2">
                      {status?.bedrockConfigured ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium text-sm">{status?.bedrockConfigured ? "Configured" : "Not Configured"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-polly-status">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                    <Volume2 className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Polly</p>
                    <div className="flex items-center gap-2">
                      {status?.pollyConfigured ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium text-sm">{status?.pollyConfigured ? "Configured" : "Not Configured"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-sessions">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Active Sessions</p>
                    <span className="text-xl font-bold" data-testid="text-active-sessions">{status?.activeSessions ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-credential-tests">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TestTube className="h-4 w-4 text-amber-500" />
                Credential Tests
              </CardTitle>
              <CardDescription>Verify your AWS Bedrock and Polly credentials are working</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-start gap-4">
                <div className="space-y-2">
                  <Button
                    onClick={() => testBedrockMutation.mutate()}
                    disabled={testBedrockMutation.isPending}
                    data-testid="button-test-bedrock"
                  >
                    {testBedrockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Brain className="h-4 w-4 mr-2" />
                    Test Bedrock
                  </Button>
                  {bedrockTestResult && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-bedrock-result">
                      {bedrockTestResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={bedrockTestResult.success ? "text-emerald-600" : "text-red-600"}>
                        {bedrockTestResult.message}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={() => testPollyMutation.mutate()}
                    disabled={testPollyMutation.isPending}
                    data-testid="button-test-polly"
                  >
                    {testPollyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Mic className="h-4 w-4 mr-2" />
                    Test Polly
                  </Button>
                  {pollyTestResult && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-polly-result">
                      {pollyTestResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={pollyTestResult.success ? "text-emerald-600" : "text-red-600"}>
                        {pollyTestResult.message}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-test-call">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-500" />
                Test Call
              </CardTitle>
              <CardDescription>Initiate a test call using the Bedrock + Polly engine</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Agent</label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger data-testid="select-agent">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentList.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <Input
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    data-testid="input-phone-number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">From Number</label>
                  <Select value={selectedFromNumber} onValueChange={setSelectedFromNumber}>
                    <SelectTrigger data-testid="select-from-number">
                      <SelectValue placeholder="Select from number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumberList.map((pn) => (
                        <SelectItem key={pn.id} value={String(pn.id)}>
                          {pn.label ? `${pn.label} (${pn.phoneNumber})` : pn.phoneNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <Button
                  onClick={handleTestCall}
                  disabled={testCallMutation.isPending}
                  data-testid="button-initiate-test-call"
                >
                  {testCallMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Phone className="h-4 w-4 mr-2" />
                  Initiate Test Call
                </Button>
                {testCallResult && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-test-call-result">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-muted-foreground">
                      Call ID: <span className="font-medium text-foreground">{testCallResult.callId || testCallResult.callSid || "Initiated"}</span>
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-available-voices">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Mic className="h-4 w-4 text-violet-500" />
                    Available Voices
                  </CardTitle>
                  <CardDescription>AWS Polly voices available for the engine</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="w-[130px]" data-testid="select-gender-filter">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={languageFilter} onValueChange={setLanguageFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-language-filter">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Languages</SelectItem>
                      {uniqueLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {voicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredVoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No voices found matching your filters.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredVoices.map((voice) => (
                    <Card key={voice.id || voice.name} data-testid={`card-voice-${voice.id || voice.name}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{voice.name}</h4>
                            {voice.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{voice.description}</p>
                            )}
                          </div>
                          <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{voice.gender}</Badge>
                          <Badge variant="outline" className="text-xs">{voice.language || voice.languageCode}</Badge>
                          <Badge variant="outline" className="text-xs">{voice.engine}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-available-models">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-500" />
                Available Models
              </CardTitle>
              <CardDescription>AWS Bedrock models configured for the engine</CardDescription>
            </CardHeader>
            <CardContent>
              {modelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !models || models.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No models available.</p>
              ) : (
                <div className="space-y-2">
                  {models.map((model) => (
                    <div
                      key={model.modelId}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 flex-wrap"
                      data-testid={`row-model-${model.modelId}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Brain className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{model.alias || model.modelId}</p>
                          <p className="text-xs text-muted-foreground">{model.provider}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">{model.tier}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
