import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

/**
 * Mutation hook for terminating an active streaming session
 * Invalidates active sessions cache on success
 */
export function useTerminateSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      api.sessions.terminate(sessionId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', 'active'] });
      toast({
        title: 'Stream Terminated',
        description: 'The playback session has been stopped.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Terminate',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
