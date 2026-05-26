import { Terminal } from 'lucide-react';

const IncidentLog = ({ events }) => {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-zinc-800 bg-[#0d0d10] font-mono shadow-2xl">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <Terminal size={13} className="text-emerald-400" />
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
          _RAW_TELEMETRY_STREAM
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#070709] p-3 text-[10px] leading-5">
        {events.length === 0 ? (
          <div className="italic uppercase tracking-wide text-zinc-600">
            Initializing sensor array...
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={`${event.target_id || 'evt'}-${idx}`} className="flex flex-wrap gap-2 text-zinc-300">
              <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
              <span className="uppercase text-emerald-400">sig_in:</span>
              <span className="text-zinc-300">
                {event.target_id || 'unknown'}{' '}
                <span className="text-cyan-400/80">@{event.sensor_type || 'sensor'}</span>
              </span>
            </div>
          ))
        )}
        <div className="animate-pulse pt-1 text-emerald-400">_</div>
      </div>
    </div>
  );
};

export default IncidentLog;
