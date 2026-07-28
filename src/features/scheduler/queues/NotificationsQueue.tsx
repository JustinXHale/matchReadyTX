import type { NotificationLogEntry } from '@/domain/types';

export function NotificationsQueue({
  notifications,
}: {
  notifications: NotificationLogEntry[];
}) {
  if (notifications.length === 0) {
    return (
      <p className="rs-match-card__meta">
        Email/SMS log entries appear here when the app sends notices.
      </p>
    );
  }

  return (
    <ul className="rs-request-list">
      {notifications.map((n) => (
        <li key={n.id} className="rs-request-item">
          <div className="rs-request-item__main">
            <strong>{n.subject}</strong>
            <div className="rs-match-card__meta">
              [{n.channel}] {n.to}
            </div>
            <div className="rs-match-card__hint">{n.body}</div>
          </div>
          <time className="rs-match-card__meta">
            {new Date(n.at).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
