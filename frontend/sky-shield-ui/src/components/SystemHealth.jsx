import { motion } from 'framer-motion';

const STATUS_CLASS = {
  ONLINE: 'status-online',
  ACTIVE: 'status-active',
  DEGRADED: 'status-degraded',
  OFFLINE: 'status-offline',
  OPERATIONAL: 'status-online',
};

const StatusRow = ({ name, status }) => (
  <motion.div
    layout
    className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1.5"
  >
    <span className="text-[10px] text-zinc-400">{name}</span>
    <span className={`text-[9px] font-black uppercase tracking-wider ${STATUS_CLASS[status] || 'text-zinc-500'}`}>
      {status}
    </span>
  </motion.div>
);

const SystemHealth = ({ health }) => {
  const sensors = health?.sensors || [];
  const components = health?.components || [];

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-lg">
      <motion.div className="border-b border-zinc-800/80 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">System Health</h2>
        </div>
        <p className="mt-0.5 text-[9px] text-zinc-500">Overall: {health?.overall || 'OPERATIONAL'}</p>
      </motion.div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Sensors</p>
        {sensors.map(row => (
          <StatusRow key={row.name} name={row.name} status={row.status} />
        ))}
        <p className="pt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">Engines</p>
        {components.map(row => (
          <StatusRow key={row.name} name={row.name} status={row.status} />
        ))}
      </div>
    </div>
  );
};

export default SystemHealth;
