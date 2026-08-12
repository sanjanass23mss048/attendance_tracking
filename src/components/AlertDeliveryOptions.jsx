import { MessageCircle, MessageSquare, MessagesSquare } from 'lucide-react';

export const ALERT_CHANNELS = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  BOTH: 'whatsapp_sms',
};

export const ALERT_RECIPIENTS = {
  FATHER: 'father',
  MOTHER: 'mother',
  BOTH: 'both',
};

const CHANNEL_OPTIONS = [
  {
    id: ALERT_CHANNELS.WHATSAPP,
    label: 'WhatsApp',
    hint: 'Send absence alerts on WhatsApp',
    icon: MessageCircle,
    activeBorder: 'border-emerald-500',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-900',
    iconActive: 'bg-emerald-100 text-emerald-700',
    iconIdle: 'bg-emerald-50 text-emerald-600',
    radioActive: 'border-emerald-600 bg-emerald-600',
  },
  {
    id: ALERT_CHANNELS.SMS,
    label: 'SMS',
    hint: 'Send absence alerts by text message',
    icon: MessageSquare,
    activeBorder: 'border-sky-500',
    activeBg: 'bg-sky-50',
    activeText: 'text-sky-900',
    iconActive: 'bg-sky-100 text-sky-700',
    iconIdle: 'bg-sky-50 text-sky-600',
    radioActive: 'border-sky-600 bg-sky-600',
  },
  {
    id: ALERT_CHANNELS.BOTH,
    label: 'WhatsApp + SMS',
    hint: 'Send the same alert on both channels',
    icon: MessagesSquare,
    activeBorder: 'border-violet-500',
    activeBg: 'bg-violet-50',
    activeText: 'text-violet-900',
    iconActive: 'bg-violet-100 text-violet-700',
    iconIdle: 'bg-violet-50 text-violet-600',
    radioActive: 'border-violet-600 bg-violet-600',
  },
];

const RECIPIENT_OPTIONS = [
  {
    id: ALERT_RECIPIENTS.FATHER,
    label: 'Father Only',
    hint: "Send to father's registered mobile number.",
  },
  {
    id: ALERT_RECIPIENTS.MOTHER,
    label: 'Mother Only',
    hint: "Send to mother's registered mobile number.",
  },
  {
    id: ALERT_RECIPIENTS.BOTH,
    label: 'Both Parents',
    hint: 'Send the same absence alert separately to both registered parent numbers.',
  },
];

/**
 * Channel + parent recipient pickers for absence alerts.
 * Single-select cards for both sections.
 */
export default function AlertDeliveryOptions({
  channel = ALERT_CHANNELS.SMS,
  recipient = ALERT_RECIPIENTS.FATHER,
  onChannelChange,
  onRecipientChange,
  disabled = false,
  compact = false,
}) {
  return (
    <div className={`space-y-4 ${compact ? '' : ''}`}>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Send alerts via</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHANNEL_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = channel === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onChannelChange?.(opt.id)}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? `${opt.activeBorder} ${opt.activeBg}`
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? opt.iconActive : opt.iconIdle
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold ${
                      active ? opt.activeText : 'text-gray-900'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">
                    {opt.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Send alert to</h3>
        <div className="space-y-2">
          {RECIPIENT_OPTIONS.map((opt) => {
            const active = recipient === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onRecipientChange?.(opt.id)}
                className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? 'border-indigo-600' : 'border-gray-300'
                  }`}
                  aria-hidden
                >
                  {active ? <span className="h-2 w-2 rounded-full bg-indigo-600" /> : null}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold ${
                      active ? 'text-indigo-900' : 'text-gray-900'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {recipient === ALERT_RECIPIENTS.BOTH ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Alert will be sent to all available registered numbers of both parents.
          </p>
        ) : null}
      </section>
    </div>
  );
}
