import { writable } from 'svelte/store';

export type NotificationSeverity = 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: number;
}

const notifications = writable<Notification[]>([]);

export function enqueueNotification(
  payload: { message: string; severity?: NotificationSeverity },
  duration = 3200,
): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const notification: Notification = {
    id,
    message: payload.message,
    severity: payload.severity ?? 'info',
    createdAt: Date.now(),
  };
  notifications.update((items) => [notification, ...items].slice(0, 6));
  if (duration > 0) {
    setTimeout(() => dismissNotification(id), duration);
  }
  return id;
}

export function dismissNotification(id: string): void {
  notifications.update((items) => items.filter((entry) => entry.id !== id));
}

export default notifications;
