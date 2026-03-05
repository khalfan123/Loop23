import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Power, PowerOff, RefreshCw, Server, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RetellCredential } from "@shared/schema";

export default function RetellCredentials() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<RetellCredential | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newMaxConcurrency, setNewMaxConcurrency] = useState(50);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [isTestingKey, setIsTestingKey] = useState(false);

  const { data: credentials = [], isLoading } = useQuery<RetellCredential[]>({
    queryKey: ["/api/admin/retell-credentials"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; apiKey: string; maxConcurrency: number }) => {
      const res = await apiRequest("POST", "/api/admin/retell-credentials", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retell-credentials"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Credential added", description: "Retell AI API key has been added successfully." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add credential" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/admin/retell-credentials/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retell-credentials"] });
      setIsEditDialogOpen(false);
      setEditingCredential(null);
      toast({ title: "Credential updated", description: "Retell AI API key has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update credential" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/retell-credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retell-credentials"] });
      toast({ title: "Credential deleted", description: "Retell AI API key has been removed." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete credential" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      const endpoint = activate ? "activate" : "deactivate";
      await apiRequest("PATCH", `/api/admin/retell-credentials/${id}/${endpoint}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/retell-credentials"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to toggle credential" });
    },
  });

  const resetForm = () => {
    setNewKeyName("");
    setNewApiKey("");
    setNewMaxConcurrency(50);
    setIsTestingKey(false);
  };

  const handleTestKey = async (apiKey: string) => {
    setIsTestingKey(true);
    try {
      const res = await apiRequest("POST", "/api/admin/retell-credentials/test", { apiKey });
      const result = await res.json();
      if (result.success) {
        toast({ title: "API Key Valid", description: `Connected successfully. Found ${result.agentCount} agent(s).` });
      } else {
        toast({ variant: "destructive", title: "Invalid API Key", description: result.error || "Could not connect to Retell AI." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Test Failed", description: error.message || "Failed to test API key." });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleEdit = (credential: RetellCredential) => {
    setEditingCredential(credential);
    setNewKeyName(credential.name);
    setNewApiKey(credential.apiKey);
    setNewMaxConcurrency(credential.maxConcurrency);
    setIsEditDialogOpen(true);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "****";
    return key.substring(0, 4) + "****" + key.substring(key.length - 4);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" data-testid="loading-retell-credentials" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Retell AI Credentials
            </CardTitle>
            <CardDescription>
              Manage Retell AI API keys for voice agent and batch calling integration.
            </CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} data-testid="button-add-retell-credential">
            <Plus className="h-4 w-4 mr-2" />
            Add API Key
          </Button>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-retell-credentials">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Retell AI credentials configured</p>
              <p className="text-sm mt-1">Add an API key to start using Retell AI for voice agents and batch calling.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {credentials.map((cred) => (
                <Card key={cred.id} data-testid={`card-retell-credential-${cred.id}`}>
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" data-testid={`text-retell-name-${cred.id}`}>{cred.name}</span>
                        <Badge variant={cred.isActive ? "default" : "secondary"} data-testid={`badge-retell-status-${cred.id}`}>
                          {cred.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-retell-health-${cred.id}`}>
                          {cred.healthStatus === "healthy" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
                          )}
                          {cred.healthStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>API Key: </span>
                        <code className="bg-muted px-1 rounded text-xs" data-testid={`text-retell-apikey-${cred.id}`}>
                          {showApiKey[cred.id] ? cred.apiKey : maskApiKey(cred.apiKey)}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setShowApiKey(prev => ({ ...prev, [cred.id]: !prev[cred.id] }))}
                          data-testid={`button-toggle-apikey-${cred.id}`}
                        >
                          {showApiKey[cred.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Max Concurrency: {cred.maxConcurrency}</span>
                        <span>Current Load: {cred.currentLoad}</span>
                        <span>Assigned Agents: {cred.totalAssignedAgents}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(cred)}
                        data-testid={`button-edit-retell-${cred.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleMutation.mutate({ id: cred.id, activate: !cred.isActive })}
                        data-testid={`button-toggle-retell-${cred.id}`}
                      >
                        {cred.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this credential?")) {
                            deleteMutation.mutate(cred.id);
                          }
                        }}
                        data-testid={`button-delete-retell-${cred.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Retell AI API Key</DialogTitle>
            <DialogDescription>
              Enter your Retell AI API key to enable voice agent and batch calling features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retell-name">Name</Label>
              <Input
                id="retell-name"
                placeholder="e.g. Production Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                data-testid="input-retell-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retell-api-key">API Key</Label>
              <Input
                id="retell-api-key"
                placeholder="Enter Retell AI API key"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                type="password"
                data-testid="input-retell-api-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retell-max-concurrency">Max Concurrency</Label>
              <Input
                id="retell-max-concurrency"
                type="number"
                value={newMaxConcurrency}
                onChange={(e) => setNewMaxConcurrency(parseInt(e.target.value) || 50)}
                min={1}
                max={500}
                data-testid="input-retell-max-concurrency"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleTestKey(newApiKey)}
              disabled={!newApiKey || isTestingKey}
              data-testid="button-test-retell-key"
            >
              {isTestingKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Test Key
            </Button>
            <Button
              onClick={() => addMutation.mutate({ name: newKeyName, apiKey: newApiKey, maxConcurrency: newMaxConcurrency })}
              disabled={!newKeyName || !newApiKey || addMutation.isPending}
              data-testid="button-save-retell-credential"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Retell AI API Key</DialogTitle>
            <DialogDescription>
              Update the credential details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-retell-name">Name</Label>
              <Input
                id="edit-retell-name"
                placeholder="e.g. Production Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                data-testid="input-edit-retell-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-retell-api-key">API Key</Label>
              <Input
                id="edit-retell-api-key"
                placeholder="Enter new API key (leave unchanged to keep existing)"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                type="password"
                data-testid="input-edit-retell-api-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-retell-max-concurrency">Max Concurrency</Label>
              <Input
                id="edit-retell-max-concurrency"
                type="number"
                value={newMaxConcurrency}
                onChange={(e) => setNewMaxConcurrency(parseInt(e.target.value) || 50)}
                min={1}
                max={500}
                data-testid="input-edit-retell-max-concurrency"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleTestKey(newApiKey)}
              disabled={!newApiKey || isTestingKey}
              data-testid="button-test-edit-retell-key"
            >
              {isTestingKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Test Key
            </Button>
            <Button
              onClick={() => {
                if (editingCredential) {
                  const data: Record<string, any> = { name: newKeyName, maxConcurrency: newMaxConcurrency };
                  if (newApiKey !== editingCredential.apiKey) {
                    data.apiKey = newApiKey;
                  }
                  updateMutation.mutate({ id: editingCredential.id, data });
                }
              }}
              disabled={!newKeyName || updateMutation.isPending}
              data-testid="button-update-retell-credential"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update Credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
