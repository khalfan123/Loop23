import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Phone, Server, RefreshCw, CheckCircle2, XCircle, AlertCircle, Settings2, Bot, PhoneIncoming, PhoneOutgoing, Network, Copy, ExternalLink, Key, Plug } from "lucide-react";

interface SipProvider {
  id: string;
  name: string;
  description: string;
  defaults: {
    port: number;
    transport: string;
    mediaEncryption: string;
    requiresRegistration: boolean;
  };
}

interface SipTrunk {
  id: string;
  name: string;
  provider: string;
  sipHost: string;
  sipPort: number;
  transport: string;
  mediaEncryption: string;
  username: string | null;
  isActive: boolean;
  healthStatus: string;
  lastHealthCheck: string | null;
  createdAt: string;
}

interface SipPhoneNumber {
  id: string;
  sipTrunkId: string;
  phoneNumber: string;
  label: string | null;
  agentId: string | null;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  elevenLabsAgentId: string | null;
  type: string;
}

interface TcxcCredential {
  id: string;
  name: string;
  apiLogin: string;
  apiKey: string;
  apiEndpoint: string | null;
  isPrimary: boolean;
  isActive: boolean;
  healthStatus: string;
  lastHealthCheck: string | null;
}

export function SipTrunkSettings() {
  const { toast } = useToast();
  const [isCreateTrunkOpen, setIsCreateTrunkOpen] = useState(false);
  const [isAddPhoneOpen, setIsAddPhoneOpen] = useState(false);
  const [selectedTrunkId, setSelectedTrunkId] = useState<string | null>(null);
  const [newTrunk, setNewTrunk] = useState({
    name: "",
    provider: "tcxc",
    sipHost: "",
    sipPort: 5060,
    transport: "tls",
    mediaEncryption: "require",
    username: "",
    password: "",
  });
  const [newPhoneNumber, setNewPhoneNumber] = useState({
    phoneNumber: "",
    label: "",
  });
  const [isAddTcxcCredentialOpen, setIsAddTcxcCredentialOpen] = useState(false);
  const [newTcxcCredential, setNewTcxcCredential] = useState({
    name: "",
    apiLogin: "",
    apiKey: "",
    apiEndpoint: "https://apiv2.telecomsxchange.com",
    isPrimary: true,
  });

  const { data: providers = [] } = useQuery<SipProvider[]>({
    queryKey: ["/api/sip/providers"],
  });

  const { data: tcxcCredentials = [] } = useQuery<TcxcCredential[]>({
    queryKey: ["/api/tcxc/credentials"],
  });

  const { data: trunks = [], isLoading: loadingTrunks } = useQuery<SipTrunk[]>({
    queryKey: ["/api/sip/trunks"],
  });

  const { data: phoneNumbers = [] } = useQuery<SipPhoneNumber[]>({
    queryKey: ["/api/sip/phone-numbers"],
  });

  const createTrunkMutation = useMutation({
    mutationFn: async (data: typeof newTrunk) => {
      return apiRequest("POST", "/api/sip/trunks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/trunks"] });
      setIsCreateTrunkOpen(false);
      setNewTrunk({
        name: "",
        provider: "tcxc",
        sipHost: "",
        sipPort: 5060,
        transport: "tls",
        mediaEncryption: "require",
        username: "",
        password: "",
      });
      toast({ title: "SIP trunk created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create trunk", description: error.message, variant: "destructive" });
    },
  });

  const deleteTrunkMutation = useMutation({
    mutationFn: async (trunkId: string) => {
      return apiRequest("DELETE", `/api/sip/trunks/${trunkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/trunks"] });
      toast({ title: "SIP trunk deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete trunk", description: error.message, variant: "destructive" });
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: async (trunkId: string) => {
      return apiRequest("POST", `/api/sip/trunks/${trunkId}/health-check`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/trunks"] });
      toast({ title: "Health check completed" });
    },
  });

  const addPhoneNumberMutation = useMutation({
    mutationFn: async (data: { sipTrunkId: string; phoneNumber: string; label?: string }) => {
      return apiRequest("POST", "/api/sip/phone-numbers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/phone-numbers"] });
      setIsAddPhoneOpen(false);
      setNewPhoneNumber({ phoneNumber: "", label: "" });
      toast({ title: "Phone number added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add phone number", description: error.message, variant: "destructive" });
    },
  });

  const deletePhoneNumberMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      return apiRequest("DELETE", `/api/sip/phone-numbers/${phoneNumberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/phone-numbers"] });
      toast({ title: "Phone number removed" });
    },
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const updatePhoneNumberMutation = useMutation({
    mutationFn: async (data: { id: string; agentId?: string | null; inboundEnabled?: boolean; outboundEnabled?: boolean }) => {
      const { id, ...updateData } = data;
      return apiRequest("PATCH", `/api/sip/phone-numbers/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sip/phone-numbers"] });
      toast({ title: "Phone number updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update phone number", description: error.message, variant: "destructive" });
    },
  });

  const createTcxcCredentialMutation = useMutation({
    mutationFn: async (data: typeof newTcxcCredential) => {
      return apiRequest("POST", "/api/tcxc/credentials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/credentials"] });
      setIsAddTcxcCredentialOpen(false);
      setNewTcxcCredential({
        name: "",
        apiLogin: "",
        apiKey: "",
        apiEndpoint: "https://apiv2.telecomsxchange.com",
        isPrimary: true,
      });
      toast({ title: "TCXC credentials saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save credentials", description: error.message, variant: "destructive" });
    },
  });

  const deleteTcxcCredentialMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tcxc/credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/credentials"] });
      toast({ title: "Credentials deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete credentials", description: error.message, variant: "destructive" });
    },
  });

  const testTcxcConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/tcxc/test-connection");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tcxc/credentials"] });
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Connection test failed", description: error.message, variant: "destructive" });
    },
  });

  const handleProviderChange = (provider: string) => {
    const providerConfig = providers.find(p => p.id === provider);
    if (providerConfig) {
      setNewTrunk({
        ...newTrunk,
        provider,
        sipPort: providerConfig.defaults.port,
        transport: providerConfig.defaults.transport,
        mediaEncryption: providerConfig.defaults.mediaEncryption,
      });
    } else {
      setNewTrunk({ ...newTrunk, provider });
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Healthy</Badge>;
      case "unhealthy":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Unhealthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500"><AlertCircle className="w-3 h-3 mr-1" />Degraded</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getProviderName = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || providerId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SIP Trunks</h2>
          <p className="text-muted-foreground">
            Configure SIP trunk connections for TelecomXchange, Twilio, Telnyx, and other providers
          </p>
        </div>
        <Dialog open={isCreateTrunkOpen} onOpenChange={setIsCreateTrunkOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-trunk">
              <Plus className="w-4 h-4 mr-2" />
              Add SIP Trunk
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add SIP Trunk</DialogTitle>
              <DialogDescription>
                Connect your SIP provider to enable voice AI calls
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Trunk Name</Label>
                <Input
                  value={newTrunk.name}
                  onChange={(e) => setNewTrunk({ ...newTrunk, name: e.target.value })}
                  placeholder="My TCXC Trunk"
                  data-testid="input-trunk-name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select value={newTrunk.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map(provider => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>SIP Host</Label>
                <Input
                  value={newTrunk.sipHost}
                  onChange={(e) => setNewTrunk({ ...newTrunk, sipHost: e.target.value })}
                  placeholder="sip.telecomxchange.com"
                  data-testid="input-sip-host"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={newTrunk.sipPort}
                    onChange={(e) => setNewTrunk({ ...newTrunk, sipPort: parseInt(e.target.value) || 5060 })}
                    data-testid="input-sip-port"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Transport</Label>
                  <Select value={newTrunk.transport} onValueChange={(v) => setNewTrunk({ ...newTrunk, transport: v })}>
                    <SelectTrigger data-testid="select-transport">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (Secure)</SelectItem>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Username (optional)</Label>
                <Input
                  value={newTrunk.username}
                  onChange={(e) => setNewTrunk({ ...newTrunk, username: e.target.value })}
                  placeholder="SIP username"
                  data-testid="input-sip-username"
                />
              </div>
              <div className="grid gap-2">
                <Label>Password (optional)</Label>
                <Input
                  type="password"
                  value={newTrunk.password}
                  onChange={(e) => setNewTrunk({ ...newTrunk, password: e.target.value })}
                  placeholder="SIP password"
                  data-testid="input-sip-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateTrunkOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createTrunkMutation.mutate(newTrunk)}
                disabled={!newTrunk.name || !newTrunk.sipHost || createTrunkMutation.isPending}
                data-testid="button-create-trunk"
              >
                {createTrunkMutation.isPending ? "Creating..." : "Create Trunk"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="trunks">
        <TabsList>
          <TabsTrigger value="trunks" data-testid="tab-sip-trunks">
            <Server className="w-4 h-4 mr-2" />
            SIP Trunks ({trunks.length})
          </TabsTrigger>
          <TabsTrigger value="numbers" data-testid="tab-phone-numbers">
            <Phone className="w-4 h-4 mr-2" />
            Phone Numbers ({phoneNumbers.length})
          </TabsTrigger>
          <TabsTrigger value="interconnection" data-testid="tab-interconnection">
            <Network className="w-4 h-4 mr-2" />
            TCXC Interconnection
          </TabsTrigger>
          <TabsTrigger value="api-settings" data-testid="tab-api-settings">
            <Key className="w-4 h-4 mr-2" />
            API Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trunks" className="mt-4">
          {loadingTrunks ? (
            <Card>
              <CardContent className="py-10 text-center">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading trunks...</p>
              </CardContent>
            </Card>
          ) : trunks.length === 0 ? (
            <Card data-testid="card-empty-trunks">
              <CardContent className="py-10 text-center">
                <Server className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-empty-trunks-title">No SIP Trunks</h3>
                <p className="text-muted-foreground" data-testid="text-empty-trunks-message">Add your first SIP trunk to start making calls</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {trunks.map(trunk => (
                <Card key={trunk.id} data-testid={`card-trunk-${trunk.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-trunk-name-${trunk.id}`}>{trunk.name}</CardTitle>
                      <CardDescription data-testid={`text-trunk-host-${trunk.id}`}>{trunk.sipHost}:{trunk.sipPort}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span data-testid={`badge-trunk-health-${trunk.id}`}>{getHealthBadge(trunk.healthStatus)}</span>
                      <Badge variant="outline" data-testid={`badge-trunk-provider-${trunk.id}`}>{getProviderName(trunk.provider)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Transport: {trunk.transport.toUpperCase()} | Encryption: {trunk.mediaEncryption}
                        {trunk.username && ` | User: ${trunk.username}`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => healthCheckMutation.mutate(trunk.id)}
                          disabled={healthCheckMutation.isPending}
                          data-testid={`button-health-check-${trunk.id}`}
                        >
                          <RefreshCw className={`w-4 h-4 mr-1 ${healthCheckMutation.isPending ? 'animate-spin' : ''}`} />
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTrunkId(trunk.id);
                            setIsAddPhoneOpen(true);
                          }}
                          data-testid={`button-add-phone-${trunk.id}`}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Add DID
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Delete this SIP trunk? All associated phone numbers will also be removed.")) {
                              deleteTrunkMutation.mutate(trunk.id);
                            }
                          }}
                          data-testid={`button-delete-trunk-${trunk.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="numbers" className="mt-4">
          {phoneNumbers.length === 0 ? (
            <Card data-testid="card-empty-phones">
              <CardContent className="py-10 text-center">
                <Phone className="w-12 h-12 mx-auto text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-empty-phones-title">No Phone Numbers</h3>
                <p className="text-muted-foreground" data-testid="text-empty-phones-message">Add DIDs from your SIP trunk to use for calls</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Inbound</TableHead>
                    <TableHead>Outbound</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phoneNumbers.map(phone => {
                    const assignedAgent = agents.find(a => a.id === phone.agentId);
                    return (
                      <TableRow key={phone.id} data-testid={`row-phone-${phone.id}`}>
                        <TableCell className="font-mono" data-testid={`text-phone-number-${phone.id}`}>{phone.phoneNumber}</TableCell>
                        <TableCell data-testid={`text-phone-label-${phone.id}`}>{phone.label || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={phone.inboundEnabled}
                              onCheckedChange={(checked) => {
                                updatePhoneNumberMutation.mutate({ id: phone.id, inboundEnabled: checked });
                              }}
                              data-testid={`switch-inbound-${phone.id}`}
                            />
                            <PhoneIncoming className={`w-4 h-4 ${phone.inboundEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={phone.outboundEnabled}
                              onCheckedChange={(checked) => {
                                updatePhoneNumberMutation.mutate({ id: phone.id, outboundEnabled: checked });
                              }}
                              data-testid={`switch-outbound-${phone.id}`}
                            />
                            <PhoneOutgoing className={`w-4 h-4 ${phone.outboundEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={phone.agentId || "none"}
                            onValueChange={(value) => {
                              updatePhoneNumberMutation.mutate({ 
                                id: phone.id, 
                                agentId: value === "none" ? null : value 
                              });
                            }}
                          >
                            <SelectTrigger className="w-[180px]" data-testid={`select-agent-${phone.id}`}>
                              <SelectValue>
                                {assignedAgent ? (
                                  <div className="flex items-center gap-2">
                                    <Bot className="w-4 h-4" />
                                    <span className="truncate">{assignedAgent.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Select agent</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No agent</span>
                              </SelectItem>
                              {agents.filter(a => a.type === 'incoming').map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  <div className="flex items-center gap-2">
                                    <Bot className="w-4 h-4" />
                                    <span>{agent.name}</span>
                                    {agent.elevenLabsAgentId && (
                                      <Badge variant="outline" className="text-xs ml-1">EL</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Remove this phone number?")) {
                                deletePhoneNumberMutation.mutate(phone.id);
                              }
                            }}
                            data-testid={`button-delete-phone-${phone.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="interconnection" className="mt-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  ElevenLabs SIP Endpoint Configuration
                </CardTitle>
                <CardDescription>
                  Use these details to configure your TCXC Interconnection / Network Topology for inbound call routing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-4" data-testid="card-sip-endpoint-config">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">SIP Server Hostname</Label>
                      <p className="text-lg font-mono mt-1" data-testid="text-sip-hostname">sip.elevenlabs.io</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText("sip.elevenlabs.io");
                        toast({ title: "Copied to clipboard" });
                      }}
                      data-testid="button-copy-sip-host"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">SIP Server IP Address</Label>
                      <p className="text-lg font-mono mt-1" data-testid="text-sip-ip">Resolve via DNS: sip.elevenlabs.io</p>
                      <p className="text-xs text-muted-foreground mt-1">Use nslookup or dig to get current IP. IP may change; hostname is recommended.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText("nslookup sip.elevenlabs.io");
                        toast({ title: "Command copied - run in terminal" });
                      }}
                      data-testid="button-copy-dns-command"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy CMD
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Inbound Transport</Label>
                      <p className="text-lg font-mono mt-1" data-testid="text-transport-tcp">TCP / Port 5060</p>
                    </div>
                    <Badge variant="outline">Recommended</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">TLS Transport (Secure)</Label>
                      <p className="text-lg font-mono mt-1" data-testid="text-transport-tls">TLS / Port 5061</p>
                    </div>
                    <Badge className="bg-green-500">Most Secure</Badge>
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <Label className="text-sm font-medium">Authentication</Label>
                      <p className="text-sm mt-1" data-testid="text-auth-info">IP-based authentication (no username/password required for inbound)</p>
                      <p className="text-xs text-muted-foreground mt-1">ElevenLabs accepts inbound calls based on registered SIP trunk configuration</p>
                    </div>
                    <Badge variant="secondary">IP Auth</Badge>
                  </div>
                </div>

                <div className="rounded-lg border p-4" data-testid="card-tcxc-instructions">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    TCXC Setup Instructions
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground" data-testid="list-tcxc-steps">
                    <li data-testid="step-1">Go to <strong>My TCXC Interconnections</strong> in your TCXC dashboard</li>
                    <li data-testid="step-2">Create a new <strong>Network Topology</strong> for inbound routing</li>
                    <li data-testid="step-3">Set the destination to <code className="bg-muted px-1 rounded">sip.elevenlabs.io</code></li>
                    <li data-testid="step-4">Configure transport as <strong>TCP:5060</strong> or <strong>TLS:5061</strong></li>
                    <li data-testid="step-5">Purchase DIDs from the TCXC DID Marketplace</li>
                    <li data-testid="step-6">Route the purchased DIDs through your created interconnection</li>
                    <li data-testid="step-7">Add the DIDs to your SIP trunk in this platform and assign AI agents</li>
                  </ol>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 p-4" data-testid="card-inbound-flow">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <PhoneIncoming className="w-4 h-4" />
                    Inbound Call Flow
                  </h4>
                  <p className="text-sm text-blue-600 dark:text-blue-400" data-testid="text-inbound-flow">
                    Caller → TCXC DID → Your Interconnection → ElevenLabs SIP → AI Agent
                  </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 p-4" data-testid="card-outbound-flow">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <PhoneOutgoing className="w-4 h-4" />
                    Outbound Call Flow
                  </h4>
                  <p className="text-sm text-amber-600 dark:text-amber-400" data-testid="text-outbound-flow">
                    AI Agent → ElevenLabs SIP → TCXC Trunk → Carrier → Called Party
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2" data-testid="text-outbound-note">
                    For outbound, configure your SIP trunk with TCXC credentials in the "SIP Trunks" tab
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-did-marketplace">
              <CardHeader>
                <CardTitle data-testid="text-marketplace-title">DID Marketplace</CardTitle>
                <CardDescription data-testid="text-marketplace-description">
                  Purchase phone numbers from TCXC DID Marketplace for inbound and outbound calling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">TCXC DID Marketplace</p>
                      <p className="text-sm text-muted-foreground">Browse and purchase DIDs from 160+ countries</p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <a href="https://app.telecomxchange.com/marketplace" target="_blank" rel="noopener noreferrer" data-testid="link-tcxc-marketplace">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Marketplace
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api-settings" className="mt-4">
          <div className="grid gap-6">
            <Card data-testid="card-tcxc-credentials">
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      TCXC API Credentials
                    </CardTitle>
                    <CardDescription>
                      Configure your TelecomXchange API credentials to browse and import DIDs
                    </CardDescription>
                  </div>
                  <Dialog open={isAddTcxcCredentialOpen} onOpenChange={setIsAddTcxcCredentialOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-tcxc-credential">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Credentials
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add TCXC API Credentials</DialogTitle>
                        <DialogDescription>
                          Enter your TelecomXchange API login and key to connect your account
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Credential Name</Label>
                          <Input
                            value={newTcxcCredential.name}
                            onChange={(e) => setNewTcxcCredential({ ...newTcxcCredential, name: e.target.value })}
                            placeholder="My TCXC Account"
                            data-testid="input-tcxc-name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>API Login</Label>
                          <Input
                            value={newTcxcCredential.apiLogin}
                            onChange={(e) => setNewTcxcCredential({ ...newTcxcCredential, apiLogin: e.target.value })}
                            placeholder="your-api-login"
                            data-testid="input-tcxc-login"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={newTcxcCredential.apiKey}
                            onChange={(e) => setNewTcxcCredential({ ...newTcxcCredential, apiKey: e.target.value })}
                            placeholder="your-api-key"
                            data-testid="input-tcxc-key"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>API Endpoint (Optional)</Label>
                          <Input
                            value={newTcxcCredential.apiEndpoint}
                            onChange={(e) => setNewTcxcCredential({ ...newTcxcCredential, apiEndpoint: e.target.value })}
                            placeholder="https://apiv2.telecomsxchange.com"
                            data-testid="input-tcxc-endpoint"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddTcxcCredentialOpen(false)} data-testid="button-cancel-tcxc-credential">Cancel</Button>
                        <Button
                          onClick={() => createTcxcCredentialMutation.mutate(newTcxcCredential)}
                          disabled={!newTcxcCredential.name || !newTcxcCredential.apiLogin || !newTcxcCredential.apiKey || createTcxcCredentialMutation.isPending}
                          data-testid="button-save-tcxc-credential"
                        >
                          {createTcxcCredentialMutation.isPending ? "Saving..." : "Save Credentials"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {tcxcCredentials.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="w-12 h-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold" data-testid="text-no-credentials">No API Credentials</h3>
                    <p className="text-muted-foreground" data-testid="text-credentials-help">
                      Add your TCXC API credentials to browse and import phone numbers
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tcxcCredentials.map(cred => (
                      <div key={cred.id} className="flex items-center justify-between gap-4 flex-wrap p-4 rounded-lg border" data-testid={`card-credential-${cred.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${cred.healthStatus === 'healthy' ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                            <Plug className={`w-5 h-5 ${cred.healthStatus === 'healthy' ? 'text-green-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-cred-name-${cred.id}`}>{cred.name}</p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-cred-login-${cred.id}`}>
                              Login: {cred.apiLogin} | Key: {cred.apiKey}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {cred.healthStatus === 'healthy' ? (
                            <Badge className="bg-green-500" data-testid={`badge-healthy-${cred.id}`}>Connected</Badge>
                          ) : cred.healthStatus === 'unhealthy' ? (
                            <Badge variant="destructive" data-testid={`badge-unhealthy-${cred.id}`}>Error</Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-unknown-${cred.id}`}>Not Tested</Badge>
                          )}
                          {cred.isPrimary && <Badge variant="outline" data-testid={`badge-primary-${cred.id}`}>Primary</Badge>}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testTcxcConnectionMutation.mutate()}
                            disabled={testTcxcConnectionMutation.isPending}
                            data-testid={`button-test-${cred.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${testTcxcConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                            Test
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete these credentials?")) {
                                deleteTcxcCredentialMutation.mutate(cred.id);
                              }
                            }}
                            data-testid={`button-delete-cred-${cred.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-api-help">
              <CardHeader>
                <CardTitle>Where to Find Your API Credentials</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground" data-testid="list-api-steps">
                  <li>Log into your TCXC dashboard at <a href="https://app.telecomxchange.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover-elevate" data-testid="link-tcxc-dashboard">app.telecomxchange.com</a></li>
                  <li>Navigate to <strong>Settings</strong> or <strong>Developer</strong> section</li>
                  <li>Find <strong>API Keys</strong> or <strong>API Access</strong></li>
                  <li>Generate a new API key if you don't have one</li>
                  <li>Copy your <strong>API Login</strong> and <strong>API Key</strong> and enter them above</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddPhoneOpen} onOpenChange={setIsAddPhoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Phone Number (DID)</DialogTitle>
            <DialogDescription>
              Add a phone number from your SIP trunk
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input
                value={newPhoneNumber.phoneNumber}
                onChange={(e) => setNewPhoneNumber({ ...newPhoneNumber, phoneNumber: e.target.value })}
                placeholder="+1234567890"
                data-testid="input-phone-number"
              />
            </div>
            <div className="grid gap-2">
              <Label>Label (optional)</Label>
              <Input
                value={newPhoneNumber.label}
                onChange={(e) => setNewPhoneNumber({ ...newPhoneNumber, label: e.target.value })}
                placeholder="Main Line"
                data-testid="input-phone-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPhoneOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedTrunkId) {
                  addPhoneNumberMutation.mutate({
                    sipTrunkId: selectedTrunkId,
                    phoneNumber: newPhoneNumber.phoneNumber,
                    label: newPhoneNumber.label || undefined,
                  });
                }
              }}
              disabled={!newPhoneNumber.phoneNumber || addPhoneNumberMutation.isPending}
              data-testid="button-add-phone-number"
            >
              {addPhoneNumberMutation.isPending ? "Adding..." : "Add Number"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SipTrunkSettings;
