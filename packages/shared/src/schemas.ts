/**
 * Zod validation schemas for API requests
 */

import { z } from 'zod';

// Common schemas
export const uuidSchema = z.uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Auth schemas
export const loginSchema = z.object({
  serverType: z.enum(['plex', 'jellyfin', 'emby']),
  returnUrl: z.url().optional(),
});

export const callbackSchema = z.object({
  code: z.string().optional(),
  token: z.string().optional(),
  serverType: z.enum(['plex', 'jellyfin', 'emby']),
});

// Server schemas
export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['plex', 'jellyfin', 'emby']),
  url: z.url(),
  token: z.string().min(1),
});

export const serverIdParamSchema = z.object({
  id: uuidSchema,
});

// User schemas
export const updateUserSchema = z.object({
  allowGuest: z.boolean().optional(),
  trustScore: z.number().int().min(0).max(100).optional(),
});

export const updateUserIdentitySchema = z.object({
  name: z.string().max(255).nullable().optional(),
});

export type UpdateUserIdentityInput = z.infer<typeof updateUserIdentitySchema>;

export const userIdParamSchema = z.object({
  id: uuidSchema,
});

// Session schemas
export const sessionQuerySchema = paginationSchema.extend({
  serverUserId: uuidSchema.optional(),
  serverId: uuidSchema.optional(),
  state: z.enum(['playing', 'paused', 'stopped']).optional(),
  mediaType: z.enum(['movie', 'episode', 'track']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const sessionIdParamSchema = z.object({
  id: uuidSchema,
});

// Session termination schema
export const terminateSessionBodySchema = z.object({
  /** Optional message to display to user (Plex only, ignored by Jellyfin/Emby) */
  reason: z.string().max(500).optional(),
});

// Rule schemas
export const impossibleTravelParamsSchema = z.object({
  maxSpeedKmh: z.number().positive().default(500),
  ignoreVpnRanges: z.boolean().optional(),
});

export const simultaneousLocationsParamsSchema = z.object({
  minDistanceKm: z.number().positive().default(100),
});

export const deviceVelocityParamsSchema = z.object({
  maxIps: z.number().int().positive().default(5),
  windowHours: z.number().int().positive().default(24),
});

export const concurrentStreamsParamsSchema = z.object({
  maxStreams: z.number().int().positive().default(3),
});

export const geoRestrictionParamsSchema = z.object({
  blockedCountries: z.array(z.string().length(2)).default([]),
});

export const ruleParamsSchema = z.union([
  impossibleTravelParamsSchema,
  simultaneousLocationsParamsSchema,
  deviceVelocityParamsSchema,
  concurrentStreamsParamsSchema,
  geoRestrictionParamsSchema,
]);

export const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'impossible_travel',
    'simultaneous_locations',
    'device_velocity',
    'concurrent_streams',
    'geo_restriction',
  ]),
  params: z.record(z.string(), z.unknown()),
  serverUserId: uuidSchema.nullable().default(null),
  isActive: z.boolean().default(true),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const ruleIdParamSchema = z.object({
  id: uuidSchema,
});

// Violation schemas
export const violationQuerySchema = paginationSchema.extend({
  serverId: uuidSchema.optional(),
  serverUserId: uuidSchema.optional(),
  ruleId: uuidSchema.optional(),
  severity: z.enum(['low', 'warning', 'high']).optional(),
  acknowledged: z.coerce.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const violationIdParamSchema = z.object({
  id: uuidSchema,
});

// Stats schemas
export const serverIdFilterSchema = z.object({
  serverId: uuidSchema.optional(),
});

export const statsQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'year', 'all', 'custom']).default('week'),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    serverId: uuidSchema.optional(),
  })
  .refine(
    (data) => {
      // Custom period requires both dates
      if (data.period === 'custom') {
        return data.startDate && data.endDate;
      }
      return true;
    },
    { message: 'Custom period requires startDate and endDate' }
  )
  .refine(
    (data) => {
      // If dates provided, start must be before end
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    { message: 'startDate must be before endDate' }
  );

// Location stats with full filtering - uses same period system as statsQuerySchema
export const locationStatsQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'year', 'all', 'custom']).default('month'),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    serverUserId: uuidSchema.optional(),
    serverId: uuidSchema.optional(),
    mediaType: z.enum(['movie', 'episode', 'track']).optional(),
  })
  .refine(
    (data) => {
      if (data.period === 'custom') {
        return data.startDate && data.endDate;
      }
      return true;
    },
    { message: 'Custom period requires startDate and endDate' }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    { message: 'startDate must be before endDate' }
  );

// Webhook format enum
export const webhookFormatSchema = z.enum(['json', 'ntfy', 'apprise']);

// Unit system enum for display preferences
export const unitSystemSchema = z.enum(['metric', 'imperial']);

// Settings schemas
export const updateSettingsSchema = z.object({
  allowGuestAccess: z.boolean().optional(),
  // Display preferences
  unitSystem: unitSystemSchema.optional(),
  discordWebhookUrl: z.url().nullable().optional(),
  customWebhookUrl: z.url().nullable().optional(),
  webhookFormat: webhookFormatSchema.nullable().optional(),
  ntfyTopic: z.string().max(200).nullable().optional(),
  // Poller settings
  pollerEnabled: z.boolean().optional(),
  pollerIntervalMs: z.number().int().min(5000).max(300000).optional(),
  // Tautulli integration
  tautulliUrl: z.url().nullable().optional(),
  tautulliApiKey: z.string().nullable().optional(),
  // Network/access settings
  externalUrl: z.url().nullable().optional(),
  basePath: z.string().max(100).optional(),
  trustProxy: z.boolean().optional(),
  // Authentication settings
  primaryAuthMethod: z.enum(['jellyfin', 'local']).optional(),
});

// Tautulli import schemas
export const tautulliImportSchema = z.object({
  serverId: uuidSchema, // Which Tracearr server to import into
});

// ============================================================================
// Jellystat Import Schemas
// ============================================================================

/**
 * PlayState object from Jellystat backup
 * Uses loose() to allow extra fields that Jellystat may include
 */
export const jellystatPlayStateSchema = z
  .looseObject({
    IsPaused: z.boolean().nullable().optional(),
    PositionTicks: z.number().nullable().optional(),
    RuntimeTicks: z.number().nullable().optional(),
    Completed: z.boolean().nullable().optional(),
  }); // Allow extra fields like IsMuted, VolumeLevel, CanSeek, etc.

/**
 * TranscodingInfo object from Jellystat backup
 * Uses looseObject() to allow extra fields like AudioCodec, VideoCodec, etc.
 */
export const jellystatTranscodingInfoSchema = z
  .looseObject({
    Bitrate: z.number().nullable().optional(),
  }) // Allow extra fields like AudioCodec, VideoCodec, Container, etc.
  .nullable()
  .optional();

/**
 * Individual playback activity record from Jellystat export
 * Uses looseObject() to allow extra fields like ApplicationVersion, MediaStreams, etc.
 */
export const jellystatPlaybackActivitySchema = z.looseObject({
  Id: z.string(),
  UserId: z.string(),
  UserName: z.string().nullable().optional(),
  NowPlayingItemId: z.string(),
  NowPlayingItemName: z.string(),
  SeriesName: z.string().nullable().optional(),
  SeasonId: z.string().nullable().optional(),
  EpisodeId: z.string().nullable().optional(),
  PlaybackDuration: z.union([z.string(), z.number()]), // Can be string or number
  ActivityDateInserted: z.string(), // ISO 8601 timestamp
  PlayMethod: z.enum(['DirectPlay', 'DirectStream', 'Transcode']).nullable().optional(),
  PlayState: jellystatPlayStateSchema.nullable().optional(),
  TranscodingInfo: jellystatTranscodingInfoSchema,
  RemoteEndPoint: z.string().nullable().optional(),
  Client: z.string().nullable().optional(),
  DeviceName: z.string().nullable().optional(),
  DeviceId: z.string().nullable().optional(),
  IsPaused: z.boolean().nullable().optional(), // Top-level IsPaused (separate from PlayState.IsPaused)
}); // Allow extra fields like ApplicationVersion, MediaStreams, ServerId, etc.

/**
 * Jellystat backup file structure
 * The backup is an array with a single object containing table data
 */
export const jellystatBackupSchema = z.array(
  z.object({
    jf_playback_activity: z.array(jellystatPlaybackActivitySchema).optional(),
  })
);

/**
 * Request body for Jellystat import (multipart form data is parsed separately)
 */
export const jellystatImportBodySchema = z.object({
  serverId: uuidSchema, // Which Tracearr server to import into
  enrichMedia: z.coerce.boolean().default(true), // Fetch season/episode from Jellyfin API
});

/**
 * Import job status response
 */
export const importJobStatusSchema = z.object({
  jobId: z.string(),
  state: z.enum(['queued', 'active', 'completed', 'failed', 'delayed']),
  progress: z.number().min(0).max(100).optional(),
  result: z
    .object({
      imported: z.number(),
      skipped: z.number(),
      errors: z.number(),
      enriched: z.number().optional(),
    })
    .optional(),
  failedReason: z.string().optional(),
});

// Type exports from schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type CallbackInput = z.infer<typeof callbackSchema>;
export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SessionQueryInput = z.infer<typeof sessionQuerySchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type ViolationQueryInput = z.infer<typeof violationQuerySchema>;
export type ServerIdFilterInput = z.infer<typeof serverIdFilterSchema>;
export type StatsQueryInput = z.infer<typeof statsQuerySchema>;
export type LocationStatsQueryInput = z.infer<typeof locationStatsQuerySchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type TautulliImportInput = z.infer<typeof tautulliImportSchema>;

// Jellystat types
export type JellystatPlayState = z.infer<typeof jellystatPlayStateSchema>;
export type JellystatTranscodingInfo = z.infer<typeof jellystatTranscodingInfoSchema>;
export type JellystatPlaybackActivity = z.infer<typeof jellystatPlaybackActivitySchema>;
export type JellystatBackup = z.infer<typeof jellystatBackupSchema>;
export type JellystatImportBody = z.infer<typeof jellystatImportBodySchema>;
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;
