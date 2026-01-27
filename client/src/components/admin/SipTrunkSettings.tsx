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
import { Plus, Trash2, Phone, Server, RefreshCw, CheckCircle2, XCircle, AlertCircle, Settings2 } from "lucide-react";

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

  const { data: providers = [] } = useQuery<SipProvider[]>({
    queryKey: ["/api/sip/providers"],
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
                  {phoneNumbers.map(phone => (
                    <TableRow key={phone.id} data-testid={`row-phone-${phone.id}`}>
                      <TableCell className="font-mono" data-testid={`text-phone-number-${phone.id}`}>{phone.phoneNumber}</TableCell>
                      <TableCell data-testid={`text-phone-label-${phone.id}`}>{phone.label || "-"}</TableCell>
                      <TableCell>
                        {phone.inboundEnabled ? (
                          <Badge className="bg-green-500" data-testid={`badge-inbound-enabled-${phone.id}`}>Enabled</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-inbound-disabled-${phone.id}`}>Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {phone.outboundEnabled ? (
                          <Badge className="bg-green-500" data-testid={`badge-outbound-enabled-${phone.id}`}>Enabled</Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-outbound-disabled-${phone.id}`}>Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {phone.agentId ? (
                          <Badge variant="outline" data-testid={`badge-agent-assigned-${phone.id}`}>Assigned</Badge>
                        ) : (
                          <span className="text-muted-foreground" data-testid={`text-agent-unassigned-${phone.id}`}>Not assigned</span>
                        )}
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
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
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
