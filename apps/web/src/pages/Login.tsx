import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Server, ExternalLink } from 'lucide-react';
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
import { api } from '@/lib/api';

// Plex and Jellyfin brand colors
const PLEX_COLOR = 'bg-[#E5A00D] hover:bg-[#C88A0B]';
const JELLYFIN_COLOR = 'bg-[#00A4DC] hover:bg-[#0090C1]';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, refetch } = useAuth();

  // Plex OAuth state
  const [plexLoading, setPlexLoading] = useState(false);
  const [plexPinId, setPlexPinId] = useState<string | null>(null);
  const [plexAuthUrl, setPlexAuthUrl] = useState<string | null>(null);

  // Jellyfin state
  const [jellyfinLoading, setJellyfinLoading] = useState(false);
  const [jellyfinServerUrl, setJellyfinServerUrl] = useState('');
  const [jellyfinUsername, setJellyfinUsername] = useState('');
  const [jellyfinPassword, setJellyfinPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirectTo = searchParams.get('redirect') || '/';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, searchParams]);

  // Poll for Plex OAuth completion
  const pollPlexCallback = useCallback(async (pinId: string) => {
    try {
      const result = await api.auth.checkPlexCallback(pinId);

      if (result.pending) {
        // Still waiting, continue polling
        setTimeout(() => pollPlexCallback(pinId), 2000);
        return;
      }

      if (result.success && result.needsServerConnection) {
        // OAuth successful, redirect to server setup
        navigate('/setup', { state: { plexUser: result.plexUser } });
      } else if (result.success) {
        // Fully authenticated (shouldn't happen without server connection)
        refetch();
        toast({ title: 'Success', description: 'Logged in successfully!' });
        navigate('/');
      }
    } catch (error) {
      setPlexLoading(false);
      setPlexPinId(null);
      setPlexAuthUrl(null);
      toast({
        title: 'Authentication failed',
        description: error instanceof Error ? error.message : 'Plex authentication failed',
        variant: 'destructive',
      });
    }
  }, [navigate, refetch, toast]);

  // Start Plex OAuth flow
  const handlePlexLogin = async () => {
    setPlexLoading(true);
    try {
      // Don't pass returnUrl - popup stays on Plex until user closes it
      // Main window polls for auth completion
      const result = await api.auth.loginPlex();

      setPlexPinId(result.pinId);
      setPlexAuthUrl(result.authUrl);

      // Open Plex auth in new window (popup)
      window.open(result.authUrl, 'plex_auth', 'width=600,height=700,popup=yes');

      // Start polling for completion
      pollPlexCallback(result.pinId);
    } catch (error) {
      setPlexLoading(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start Plex login',
        variant: 'destructive',
      });
    }
  };

  // Handle Jellyfin login
  const handleJellyfinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJellyfinLoading(true);

    try {
      // Normalize server URL
      let serverUrl = jellyfinServerUrl.trim();
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = 'http://' + serverUrl;
      }
      serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash

      const result = await api.auth.loginJellyfin(
        serverUrl,
        jellyfinUsername,
        jellyfinPassword
      );

      if (result.success) {
        refetch();
        toast({
          title: 'Success',
          description: `Connected to ${result.isNewServer ? 'new' : 'existing'} server`,
        });
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

  // Show loading while checking auth status
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Tracearr</h1>
        <p className="mt-2 text-muted-foreground">
          Stream access management for Plex & Jellyfin
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Connect your media server to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="plex" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plex">Plex</TabsTrigger>
              <TabsTrigger value="jellyfin">Jellyfin</TabsTrigger>
            </TabsList>

            <TabsContent value="plex" className="mt-6">
              {plexPinId && plexAuthUrl ? (
                <div className="space-y-4 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#E5A00D]" />
                  <p className="text-sm text-muted-foreground">
                    Waiting for Plex authorization...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A new window should have opened. Complete the sign-in there.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(plexAuthUrl, '_blank')}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Reopen Plex Login
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPlexLoading(false);
                      setPlexPinId(null);
                      setPlexAuthUrl(null);
                    }}
                    className="block mx-auto"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sign in with your Plex account to connect your server.
                    You must be the server owner (admin).
                  </p>
                  <Button
                    className={`w-full ${PLEX_COLOR} text-white`}
                    onClick={handlePlexLogin}
                    disabled={plexLoading}
                  >
                    {plexLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Server className="mr-2 h-4 w-4" />
                    )}
                    Sign in with Plex
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="jellyfin" className="mt-6">
              <form onSubmit={handleJellyfinLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">Server URL</Label>
                  <Input
                    id="serverUrl"
                    type="url"
                    placeholder="http://localhost:8096"
                    value={jellyfinServerUrl}
                    onChange={(e) => setJellyfinServerUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Admin username"
                    value={jellyfinUsername}
                    onChange={(e) => setJellyfinUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    value={jellyfinPassword}
                    onChange={(e) => setJellyfinPassword(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You must be a server administrator to connect.
                </p>
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
                  Connect Jellyfin Server
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By signing in, you agree to let Tracearr monitor streaming activity
        <br />
        on your connected media servers.
      </p>
    </div>
  );
}
