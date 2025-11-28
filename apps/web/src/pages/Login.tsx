import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Server, ExternalLink, Monitor, ChevronRight, Wifi, Globe } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { api, tokenStorage, type PlexServerInfo } from '@/lib/api';
import { Logo, LogoIcon } from '@/components/brand/Logo';

// Plex and Jellyfin brand colors
const PLEX_COLOR = 'bg-[#E5A00D] hover:bg-[#C88A0B]';
const JELLYFIN_COLOR = 'bg-[#00A4DC] hover:bg-[#0090C1]';

type AuthStep = 'initial' | 'plex-waiting' | 'server-select';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, refetch } = useAuth();

  // Setup status
  const [setupLoading, setSetupLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Auth flow state
  const [authStep, setAuthStep] = useState<AuthStep>('initial');
  const [plexAuthUrl, setPlexAuthUrl] = useState<string | null>(null);
  const [plexServers, setPlexServers] = useState<PlexServerInfo[]>([]);
  const [plexTempToken, setPlexTempToken] = useState<string | null>(null);
  const [connectingToServer, setConnectingToServer] = useState<string | null>(null);

  // Jellyfin state (always needs URL since no central discovery)
  const [jellyfinLoading, setJellyfinLoading] = useState(false);
  const [jellyfinServerUrl, setJellyfinServerUrl] = useState('');
  const [jellyfinServerName, setJellyfinServerName] = useState('');
  const [jellyfinUsername, setJellyfinUsername] = useState('');
  const [jellyfinPassword, setJellyfinPassword] = useState('');

  // Check setup status on mount
  useEffect(() => {
    async function checkSetup() {
      try {
        const status = await api.setup.status();
        setNeedsSetup(status.needsSetup);
      } catch {
        // If we can't reach the server, assume setup needed
        setNeedsSetup(true);
      } finally {
        setSetupLoading(false);
      }
    }
    checkSetup();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirectTo = searchParams.get('redirect') || '/';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, searchParams]);

  // Poll for Plex PIN claim
  const pollPlexPin = async (pinId: string) => {
    try {
      const result = await api.auth.checkPlexPin(pinId);

      if (!result.authorized) {
        // Still waiting for PIN claim, continue polling
        setTimeout(() => pollPlexPin(pinId), 2000);
        return;
      }

      // PIN claimed! Check what we got back
      if (result.needsServerSelection && result.servers && result.tempToken) {
        // New user - needs to select a server
        setPlexServers(result.servers);
        setPlexTempToken(result.tempToken);
        setAuthStep('server-select');
      } else if (result.accessToken && result.refreshToken) {
        // Returning user - auto-connected, store tokens
        tokenStorage.setTokens(result.accessToken, result.refreshToken);
        refetch();
        toast({ title: 'Success', description: 'Logged in successfully!' });
        navigate('/');
      }
    } catch (error) {
      resetPlexAuth();
      toast({
        title: 'Authentication failed',
        description: error instanceof Error ? error.message : 'Plex authentication failed',
        variant: 'destructive',
      });
    }
  };

  // Start Plex OAuth flow
  const handlePlexLogin = async () => {
    setAuthStep('plex-waiting');
    try {
      const result = await api.auth.loginPlex();
      setPlexAuthUrl(result.authUrl);

      // Open Plex auth in popup
      window.open(result.authUrl, 'plex_auth', 'width=600,height=700,popup=yes');

      // Start polling
      pollPlexPin(result.pinId);
    } catch (error) {
      resetPlexAuth();
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start Plex login',
        variant: 'destructive',
      });
    }
  };

  // Connect to selected Plex server
  const handlePlexServerSelect = async (serverUri: string, serverName: string) => {
    if (!plexTempToken) return;

    setConnectingToServer(serverName);

    try {
      const result = await api.auth.connectPlexServer({
        tempToken: plexTempToken,
        serverUri,
        serverName,
      });

      if (result.accessToken && result.refreshToken) {
        tokenStorage.setTokens(result.accessToken, result.refreshToken);
        refetch();
        toast({ title: 'Success', description: `Connected to ${serverName}` });
        navigate('/');
      }
    } catch (error) {
      setConnectingToServer(null);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect to server',
        variant: 'destructive',
      });
    }
  };

  // Reset Plex auth state
  const resetPlexAuth = () => {
    setAuthStep('initial');
    setPlexAuthUrl(null);
    setPlexServers([]);
    setPlexTempToken(null);
    setConnectingToServer(null);
  };

  // Handle Jellyfin login
  const handleJellyfinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJellyfinLoading(true);

    try {
      let serverUrl = jellyfinServerUrl.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'http://' + serverUrl;
      }
      serverUrl = serverUrl.replace(/\/$/, '');

      const result = await api.auth.loginJellyfin({
        serverUrl,
        serverName: jellyfinServerName || 'Jellyfin Server',
        username: jellyfinUsername,
        password: jellyfinPassword,
      });

      if (result.accessToken && result.refreshToken) {
        tokenStorage.setTokens(result.accessToken, result.refreshToken);
        refetch();
        toast({ title: 'Success', description: 'Connected to Jellyfin server' });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: 'Authentication failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setJellyfinLoading(false);
    }
  };

  // Show loading while checking auth/setup status
  if (authLoading || setupLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <LogoIcon className="h-16 w-16 animate-pulse" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Server selection step (only during setup)
  if (authStep === 'server-select' && plexServers.length > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoIcon className="h-20 w-20 mb-4" />
          <h1 className="text-4xl font-bold tracking-tight">Tracearr</h1>
          <p className="mt-2 text-muted-foreground">Select your Plex server</p>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Select Server</CardTitle>
            <CardDescription>
              Choose which Plex Media Server to monitor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plexServers.map((server) => (
              <div key={server.name} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Monitor className="h-4 w-4" />
                  {server.name}
                  <span className="text-xs text-muted-foreground">
                    ({server.platform} • v{server.version})
                  </span>
                </div>
                <div className="space-y-1 pl-6">
                  {server.connections.map((conn) => (
                    <Button
                      key={conn.uri}
                      variant="outline"
                      className="w-full justify-between text-left h-auto py-2"
                      onClick={() => handlePlexServerSelect(conn.uri, server.name)}
                      disabled={connectingToServer !== null}
                    >
                      <div className="flex items-center gap-2">
                        {conn.local ? (
                          <Wifi className="h-3 w-3 text-green-500" />
                        ) : (
                          <Globe className="h-3 w-3 text-blue-500" />
                        )}
                        <span className="text-xs">
                          {conn.local ? 'Local' : 'Remote'}: {conn.address}:{conn.port}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            {connectingToServer && (
              <div className="flex items-center justify-center gap-2 pt-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting to {connectingToServer}...
              </div>
            )}

            <Button variant="ghost" className="w-full mt-4" onClick={resetPlexAuth}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoIcon className="h-20 w-20 mb-4" />
        <h1 className="text-4xl font-bold tracking-tight">Tracearr</h1>
        <p className="mt-2 text-muted-foreground">
          {needsSetup
            ? 'Connect your media server to get started'
            : 'Sign in to your media server'}
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{needsSetup ? 'Setup' : 'Sign in'}</CardTitle>
          <CardDescription>
            {needsSetup
              ? 'Connect your Plex or Jellyfin server'
              : 'Sign in with your media server account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="plex" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plex">Plex</TabsTrigger>
              <TabsTrigger value="jellyfin">Jellyfin</TabsTrigger>
            </TabsList>

            <TabsContent value="plex" className="mt-6">
              {authStep === 'plex-waiting' ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#E5A00D] mb-3" />
                    <p className="text-sm font-medium">Waiting for Plex authorization...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete sign-in in the popup window
                    </p>
                    {plexAuthUrl && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => window.open(plexAuthUrl, '_blank')}
                        className="gap-1 h-auto p-0 mt-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Reopen Plex Login
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" className="w-full" onClick={resetPlexAuth}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {needsSetup
                      ? 'Sign in with Plex to connect your server. Your servers will be detected automatically.'
                      : 'Sign in with your Plex account.'}
                  </p>
                  <Button
                    className={`w-full ${PLEX_COLOR} text-white`}
                    onClick={handlePlexLogin}
                  >
                    <Server className="mr-2 h-4 w-4" />
                    Sign in with Plex
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="jellyfin" className="mt-6">
              <form onSubmit={handleJellyfinLogin} className="space-y-4">
                {needsSetup && (
                  <p className="text-sm text-muted-foreground">
                    Enter your Jellyfin server details and admin credentials.
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="jellyfinServerUrl">Server URL</Label>
                  <Input
                    id="jellyfinServerUrl"
                    type="url"
                    placeholder="http://localhost:8096"
                    value={jellyfinServerUrl}
                    onChange={(e) => setJellyfinServerUrl(e.target.value)}
                    required
                  />
                </div>
                {needsSetup && (
                  <div className="space-y-2">
                    <Label htmlFor="jellyfinServerName">Server Name</Label>
                    <Input
                      id="jellyfinServerName"
                      type="text"
                      placeholder="My Jellyfin Server"
                      value={jellyfinServerName}
                      onChange={(e) => setJellyfinServerName(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="jellyfinUsername">Username</Label>
                  <Input
                    id="jellyfinUsername"
                    type="text"
                    placeholder="Admin username"
                    value={jellyfinUsername}
                    onChange={(e) => setJellyfinUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jellyfinPassword">Password</Label>
                  <Input
                    id="jellyfinPassword"
                    type="password"
                    placeholder="Password"
                    value={jellyfinPassword}
                    onChange={(e) => setJellyfinPassword(e.target.value)}
                    required
                  />
                </div>
                {needsSetup && (
                  <p className="text-xs text-muted-foreground">
                    You must be a server administrator to connect.
                  </p>
                )}
                <Button
                  type="submit"
                  className={`w-full ${JELLYFIN_COLOR} text-white`}
                  disabled={jellyfinLoading}
                >
                  {jellyfinLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Server className="mr-2 h-4 w-4" />
                  )}
                  {needsSetup ? 'Connect Jellyfin Server' : 'Sign in with Jellyfin'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {needsSetup ? (
          <>
            By connecting, you agree to let Tracearr monitor streaming activity
            <br />
            on your media server.
          </>
        ) : (
          'Tracearr • Stream access management'
        )}
      </p>
    </div>
  );
}
