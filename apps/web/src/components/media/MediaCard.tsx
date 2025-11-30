import { Film, Tv, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaCardProps {
  title: string;
  type: string;
  showTitle?: string | null;
  year?: number | null;
  playCount: number;
  watchTimeHours: number;
  thumbPath?: string | null;
  serverId?: string | null;
  rank?: number;
  className?: string;
  /** For TV shows (aggregated series), number of unique episodes watched */
  episodeCount?: number;
}

function MediaIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'movie':
      return <Film className={className} />;
    case 'episode':
      return <Tv className={className} />;
    case 'track':
      return <Music className={className} />;
    default:
      return <Film className={className} />;
  }
}

function getImageUrl(serverId: string | null | undefined, thumbPath: string | null | undefined, width = 300, height = 450) {
  if (!serverId || !thumbPath) return null;
  return `/api/v1/images/proxy?server=${serverId}&url=${encodeURIComponent(thumbPath)}&width=${width}&height=${height}&fallback=poster`;
}

export function MediaCard({
  title,
  type,
  showTitle,
  year,
  playCount,
  watchTimeHours,
  thumbPath,
  serverId,
  rank,
  className,
  episodeCount,
}: MediaCardProps) {
  const imageUrl = getImageUrl(serverId, thumbPath, 300, 450);
  const bgImageUrl = getImageUrl(serverId, thumbPath, 800, 400);
  // For individual episodes: showTitle is series name, title is episode name
  // For aggregated shows: title is series name (no showTitle), episodeCount indicates it's aggregated
  const displayTitle = type === 'episode' && showTitle ? showTitle : title;
  const subtitle = episodeCount
    ? `${episodeCount} episodes • ${year || ''}`
    : type === 'episode'
    ? title
    : year
    ? `(${year})`
    : '';

  return (
    <div
      className={cn(
        'group relative animate-fade-in-up overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/10',
        className
      )}
    >
      {/* Background with blur */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl transition-opacity group-hover:opacity-40"
        style={{
          backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
          backgroundColor: bgImageUrl ? undefined : 'hsl(var(--muted))',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />

      {/* Content */}
      <div className="relative flex gap-4 p-4">
        {/* Poster */}
        <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg bg-muted shadow-lg transition-transform group-hover:scale-105">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayTitle}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MediaIcon type={type} className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {rank && (
            <div className="absolute -left-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-md">
              #{rank}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <MediaIcon type={type} className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {type}
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold leading-tight">{displayTitle}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div>
              <span className="font-semibold text-primary">{playCount.toLocaleString()}</span>
              <span className="ml-1 text-muted-foreground">plays</span>
            </div>
            <div className="text-muted-foreground">
              {watchTimeHours.toLocaleString()}h watched
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
