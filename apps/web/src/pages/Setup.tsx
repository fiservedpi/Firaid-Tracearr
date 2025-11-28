import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Server, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface PlexUser {
  id: string;
  username: string;
  email: string;
  thumb: string;
}

interface DiscoveredServer {
  name: string;
  machineIdentifier: string;
  connections: Array<{ uri: string; local: boolean }>;
}

export function Setup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, refetch } = useAuth();

  const plexUser = (location.state as { plexUser?: PlexUser })?.plexUser;

  // Server discovery state
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [showManual, setShowManual] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  // Connection state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverName, setServerName] = useState('');

  // Redirect if no Plex user in state (user navigated directly)
  useEffect(() => {
    if (!plexUser) {
      navigate('/login', { replace: true });
    }
  }, [plexUser, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !success) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, success, navigate]);

  // Discover servers on mount
  useEffect(() => {
    async function discoverServers() {
      try {
        const result = await api.auth.discoverServers();
        setServers(result.servers);

        // Auto-select first server if only one
        if (result.servers.length === 1 && result.servers[0]) {
          setSelectedServer(result.servers[0].machineIdentifier);
        }
      } catch (error) {
        console.error('Failed to discover servers:', error);
        // Fall back to manual entry
        setShowManual(true);
      } finally {
        setLoadingServers(false);
      }
    }

    if (plexUser) {
      discoverServers();
    }
  }, [plexUser]);

  const getServerUrl = (): string | null => {
    if (showManual) {
      let url = manualUrl.trim();
      if (!url) return null;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      return url.replace(/\/$/, '');
    }

    const server = servers.find((s) => s.machineIdentifier === selectedServer);
    const firstConnection = server?.connections[0];
    if (!server || !firstConnection) return null;

    // Use first (preferred) connection
    return firstConnection.uri;
  };

  const handleConnectServer = async (e: React.FormEvent) => {
    e.preventDefault();

    const serverUrl = getServerUrl();
    if (!serverUrl) {
      toast({
        title: 'No server selected',
        description: 'Please select a server or enter a URL manually',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const result = await api.auth.connectServer(serverUrl);

      if (result.success) {
        setSuccess(true);
        setServerName(result.serverName);

        // Refetch auth to update user state
        refetch();

        toast({
          title: 'Server connected!',
          description: `Successfully connected to ${result.serverName}`,
        });

        // Redirect to dashboard after brief delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect server',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!plexUser) {
    return null; // Will redirect
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Tracearr</h1>
        <p className="mt-2 text-muted-foreground">
          One more step to get started
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            {plexUser.thumb ? (
              <img
                src={plexUser.thumb}
                alt={plexUser.username}
                className="h-12 w-12 rounded-full"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Server className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="font-medium">{plexUser.username}</p>
              <p className="text-sm text-muted-foreground">{plexUser.email}</p>
            </div>
          </div>
          <CardTitle>Connect your Plex server</CardTitle>
          <CardDescription>
            Select a server to monitor with Tracearr
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Connected to <strong>{serverName}</strong>. Redirecting to dashboard...
              </AlertDescription>
            </Alert>
          ) : loadingServers ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#E5A00D]" />
              <p className="mt-4 text-sm text-muted-foreground">Discovering your Plex servers...</p>
            </div>
          ) : (
            <form onSubmit={handleConnectServer} className="space-y-4">
              {!showManual && servers.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="server">Select Server</Label>
                  <Select value={selectedServer} onValueChange={setSelectedServer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a server..." />
                    </SelectTrigger>
                    <SelectContent>
                      {servers.map((server) => (
                        <SelectItem key={server.machineIdentifier} value={server.machineIdentifier}>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            <span>{server.name}</span>
                            {server.connections[0]?.local && (
                              <span className="text-xs text-muted-foreground">(Local)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {servers.length} server{servers.length !== 1 ? 's' : ''} found on your Plex account
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => setShowManual(true)}
                  >
                    Enter server URL manually instead
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">Plex Server URL</Label>
                  <Input
                    id="serverUrl"
                    type="url"
                    placeholder="http://192.168.1.100:32400"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    required={showManual}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the URL where your Plex server is accessible.
                    Usually something like <code>http://IP:32400</code>
                  </p>
                  {servers.length > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => setShowManual(false)}
                    >
                      Select from discovered servers instead
                    </Button>
                  )}
                </div>
              )}

              <Alert variant="default" className="bg-muted">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Owner access required</AlertTitle>
                <AlertDescription>
                  You must be the owner of this Plex server to connect it to Tracearr.
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                className="w-full bg-[#E5A00D] hover:bg-[#C88A0B] text-white"
                disabled={loading || (!showManual && !selectedServer) || (showManual && !manualUrl.trim())}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Server className="mr-2 h-4 w-4" />
                    Connect Server
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Back to login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
