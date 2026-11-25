import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { CellNotification } from '../engine/sdk';
import { t } from '../i18n';

interface NotificationBannerProps {
  notifications: readonly CellNotification[];
  focusedNotificationId: string | null;
  onFocusNotification: (notification: CellNotification) => void;
  onDismissNotification: (id: string) => void;
}

export function NotificationBanner({
  notifications,
  focusedNotificationId,
  onFocusNotification,
  onDismissNotification,
}: NotificationBannerProps) {
  if (notifications.length === 0) return null;

  const visible = notifications.slice(0, 4);
  const hiddenCount = notifications.length - visible.length;

  return (
    <div
      role="region"
      aria-label={t('hud.notifications')}
      className="pointer-events-none absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 w-full max-w-md px-4"
    >
      {visible.map((n) => {
        const isDanger = n.severity === 'danger';
        const isFocused = focusedNotificationId === n.id;

        return (
          <div
            key={n.id}
            className={`pointer-events-auto w-full flex items-start gap-2.5 bg-[#111720]/95 border rounded-lg px-3 py-2 backdrop-blur-sm shadow-lg transition-colors ${
              isFocused
                ? 'border-[#10B981]'
                : isDanger
                  ? 'border-[#F43F5E]/55'
                  : 'border-[#F59E0B]/45'
            }`}
          >
            <button
              type="button"
              onClick={() => onFocusNotification(n)}
              className="flex-1 min-w-0 flex items-start gap-2.5 text-left cursor-pointer focus-visible:outline-none"
            >
              {isDanger ? (
                <AlertCircle
                  className="w-4 h-4 text-[#F43F5E] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-xs font-semibold truncate ${
                      isDanger ? 'text-[#F43F5E]' : 'text-[#F59E0B]'
                    }`}
                  >
                    {n.title}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-[#8B98A9] shrink-0">
                    [{n.x}, {n.y}]
                  </span>
                </div>
                <p className="text-[11px] text-[#E6EDF3]/90 leading-snug mt-0.5">
                  {n.message}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onDismissNotification(n.id)}
              aria-label={t('hud.dismissNotification')}
              className="p-0.5 text-[#8B98A9] hover:text-[#E6EDF3] rounded transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <div className="pointer-events-auto text-[11px] text-[#8B98A9] bg-[#111720]/90 border border-[#1F2A38] rounded px-2.5 py-1 font-mono tabular-nums">
          {t('hud.moreNotifications', { count: hiddenCount })}
        </div>
      )}
    </div>
  );
}
