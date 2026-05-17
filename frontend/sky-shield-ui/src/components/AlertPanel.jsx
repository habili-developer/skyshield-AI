import { AlertTriangle, CheckCircle2, ShieldAlert, Zap } from 'lucide-react';

const levelStyles = {
  red: {
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    card: 'border-rose-500/30 bg-rose-500/5',
  },
  orange: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    card: 'border-amber-500/30 bg-amber-500/5',
  },
  yellow: {
    badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    card: 'border-yellow-500/30 bg-yellow-500/5',
  },
  green: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    card: 'border-emerald-500/30 bg-emerald-500/5',
  },
};

const AlertPanel = ({ alerts, onAcknowledge }) => {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-zinc-800 bg-[#0d0d10] shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-500" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-200">
            PRIORITY_THREAT_QUEUE
          </h2>
        </div>
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400">
          {alerts.length} ACTIVE
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#09090b] p-4 ">
        {alerts.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-[#0d0d10] text-center">
            <CheckCircle2 size={20} className="mb-2 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-500">Airspace Secure</p>
          </div>
        ) : (
          alerts.map((alert, idx) => {
            const styles = levelStyles[alert.level] || levelStyles.orange;

            return (
              <div
                key={`alert-${alert.level}-${alert.tick || idx}-${idx}`}
                className={`rounded-lg border px-3 py-3 shadow-[0_0_20px_rgba(0,0,0,0.18)] ${styles.card}`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="mt-0.5 text-amber-400" />
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-100">
                      {alert.title}
                    </p>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[9px] font-semibold uppercase ${styles.badge}`}>
                    {alert.level}
                  </span>
                </div>
                <p className="mb-3 text-[11px] leading-5 text-zinc-400">
                  {alert.explanation}
                </p>
                {onAcknowledge ? (
                  <button
                    onClick={() => onAcknowledge(alert.alert_id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
                  >
                    <Zap size={12} />
                    Confirm Awareness
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertPanel;
