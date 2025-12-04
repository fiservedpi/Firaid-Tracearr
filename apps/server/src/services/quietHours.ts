/**
 * Quiet Hours Service
 *
 * Suppresses non-critical notifications during user-configured quiet hours.
 * Supports timezone-aware time comparison and overnight quiet hour ranges.
 */

/**
 * Quiet hours preferences from notification settings
 */
export interface QuietHoursPrefs {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null; // "23:00"
  quietHoursEnd: string | null; // "07:00"
  quietHoursTimezone: string;
  quietHoursOverrideCritical: boolean;
}

/**
 * Severity levels that can bypass quiet hours
 */
export type NotificationSeverity = 'low' | 'warning' | 'high';

/**
 * Quiet Hours Service
 */
export class QuietHoursService {
  /**
   * Check if current time is within quiet hours for a device
   *
   * @param prefs - User's quiet hours preferences
   * @returns true if currently in quiet hours
   */
  isQuietTime(prefs: QuietHoursPrefs): boolean {
    if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return false;
    }

    // Get current time in user's timezone
    const now = new Date();
    let userTime: string;

    try {
      userTime = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: prefs.quietHoursTimezone || 'UTC',
      }).format(now);
    } catch {
      // Invalid timezone, fall back to UTC
      console.warn(
        `[QuietHours] Invalid timezone "${prefs.quietHoursTimezone}", falling back to UTC`
      );
      userTime = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      }).format(now);
    }

    const [currentHour, currentMinute] = userTime.split(':').map(Number) as [number, number];
    const [startHour, startMinute] = prefs.quietHoursStart.split(':').map(Number) as [
      number,
      number,
    ];
    const [endHour, endMinute] = prefs.quietHoursEnd.split(':').map(Number) as [number, number];

    const currentMinutes = currentHour * 60 + currentMinute;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 23:00 - 07:00)
    if (startMinutes > endMinutes) {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    // Normal quiet hours within same day (e.g., 01:00 - 06:00)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Should notification be sent given quiet hours and severity?
   *
   * @param prefs - User's quiet hours preferences
   * @param severity - Notification severity level
   * @returns true if notification should be sent
   */
  shouldSend(prefs: QuietHoursPrefs, severity: NotificationSeverity): boolean {
    if (!this.isQuietTime(prefs)) {
      return true; // Not quiet time, always send
    }

    // Critical notifications (high severity) can bypass if configured
    if (prefs.quietHoursOverrideCritical && severity === 'high') {
      return true;
    }

    return false; // Quiet time, suppress notification
  }

  /**
   * Should notification be sent for a non-severity-based event?
   * (e.g., session started/stopped, server down/up)
   *
   * Server down is treated as "high" severity by default.
   * Other events are treated as "low" severity.
   *
   * @param prefs - User's quiet hours preferences
   * @param eventType - The type of notification event
   * @returns true if notification should be sent
   */
  shouldSendEvent(
    prefs: QuietHoursPrefs,
    eventType: 'session_started' | 'session_stopped' | 'server_down' | 'server_up'
  ): boolean {
    // Server down is always treated as critical
    if (eventType === 'server_down') {
      return this.shouldSend(prefs, 'high');
    }

    // All other events are non-critical
    return this.shouldSend(prefs, 'low');
  }
}

// Export singleton instance
export const quietHoursService = new QuietHoursService();
