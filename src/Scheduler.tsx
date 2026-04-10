import React, { useState, useReducer, useRef, useCallback, useEffect } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Crew {
  id: string;
  name: string;
  size: number;
}

export interface JobOption {
  jobNumber: string;
  location: string;
  estimatedDays: number;
}

export interface ScheduleBlock {
  id: string;
  crewId: string;
  jobNumber: string;
  startDate: string;      // ISO YYYY-MM-DD
  durationDays: number;
  type: 'job' | 'delay';
  extended: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CREW_COL_W    = 176; // px – sticky left column
const ROW_HEIGHT    = 72;  // px per crew row
const BLOCK_MARGIN  = 5;   // px gap between block edge and row edge
const HEADER_MONTH_H = 26; // px
const HEADER_DAY_H   = 32; // px

const CREW_COLORS: string[] = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#e11d48', // rose-600
];

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

export const MOCK_CREWS: Crew[] = [
  { id: 'c1', name: 'Alpha Crew',  size: 4 },
  { id: 'c2', name: 'Beta Crew',   size: 3 },
  { id: 'c3', name: 'Gamma Crew',  size: 5 },
];

export const MOCK_JOBS: JobOption[] = [
  { jobNumber: 'J-1001', location: '123 Main St, Springfield',  estimatedDays: 5 },
  { jobNumber: 'J-1002', location: '456 Oak Ave, Shelbyville',  estimatedDays: 3 },
  { jobNumber: 'J-1003', location: '789 Pine Rd, Capital City', estimatedDays: 7 },
  { jobNumber: 'J-1004', location: '321 Elm St, Shelbyville',   estimatedDays: 4 },
  { jobNumber: 'J-1005', location: '654 Maple Dr, Springfield', estimatedDays: 6 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const toISO = (d: Date): string => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const parseDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (isoOrDate: string | Date, n: number): string => {
  const d = typeof isoOrDate === 'string' ? parseDate(isoOrDate) : new Date(isoOrDate);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

const diffDays = (a: string, b: string): number =>
  Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000);

const fmtShort = (iso: string): string =>
  parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtLong = (iso: string): string =>
  parseDate(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

const todayISO = toISO(new Date());

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE  (mock blocks relative to today)
// ═══════════════════════════════════════════════════════════════════════════════

const INITIAL_BLOCKS: ScheduleBlock[] = [
  { id: 'b1', crewId: 'c1', jobNumber: 'J-1001', startDate: addDays(todayISO, -3), durationDays: 5, type: 'job', extended: false },
  { id: 'b2', crewId: 'c1', jobNumber: 'J-1002', startDate: addDays(todayISO,  3), durationDays: 3, type: 'job', extended: false },
  { id: 'b3', crewId: 'c2', jobNumber: 'J-1003', startDate: addDays(todayISO,  0), durationDays: 7, type: 'job', extended: false },
  { id: 'b4', crewId: 'c2', jobNumber: 'J-1004', startDate: addDays(todayISO,  8), durationDays: 4, type: 'job', extended: false },
  { id: 'b5', crewId: 'c3', jobNumber: 'J-1005', startDate: addDays(todayISO,  1), durationDays: 6, type: 'job', extended: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════════════════════════════════════════

type Action =
  | { type: 'MOVE_BLOCK';   id: string; crewId: string; startDate: string }
  | { type: 'INSERT_DELAY'; blockId: string; days: number }
  | { type: 'EXTEND_JOB';   blockId: string; days: number }
  | { type: 'ADD_BLOCK';    block: ScheduleBlock }
  | { type: 'DELETE_BLOCK'; id: string };

/** Push all blocks for a crew that start on or after `fromDate` forward by `shiftDays`. */
function shiftAfter(
  blocks: ScheduleBlock[],
  crewId: string,
  fromDate: string,
  shiftDays: number,
  excludeId?: string,
): ScheduleBlock[] {
  return blocks.map(b => {
    if (b.crewId === crewId && b.id !== excludeId && b.startDate >= fromDate) {
      return { ...b, startDate: addDays(b.startDate, shiftDays) };
    }
    return b;
  });
}

function reducer(state: ScheduleBlock[], action: Action): ScheduleBlock[] {
  switch (action.type) {
    case 'MOVE_BLOCK':
      return state.map(b =>
        b.id === action.id
          ? { ...b, crewId: action.crewId, startDate: action.startDate }
          : b,
      );

    case 'INSERT_DELAY': {
      const job = state.find(b => b.id === action.blockId);
      if (!job) return state;
      const delay: ScheduleBlock = {
        id: `delay-${crypto.randomUUID()}`,
        crewId: job.crewId,
        jobNumber: `Delay \u2013 ${action.days} day${action.days !== 1 ? 's' : ''}`,
        startDate: job.startDate,
        durationDays: action.days,
        type: 'delay',
        extended: false,
      };
      // Shift the target job AND every subsequent crew block forward by `days`
      const shifted = shiftAfter(state, job.crewId, job.startDate, action.days);
      return [...shifted, delay];
    }

    case 'EXTEND_JOB': {
      const job = state.find(b => b.id === action.blockId);
      if (!job || job.type !== 'job') return state;
      const oldEnd = addDays(job.startDate, job.durationDays);
      const withExtended = state.map(b =>
        b.id === action.blockId
          ? { ...b, durationDays: b.durationDays + action.days, extended: true }
          : b,
      );
      // Shift blocks that begin at or after the job's original end date
      return shiftAfter(withExtended, job.crewId, oldEnd, action.days, action.blockId);
    }

    case 'ADD_BLOCK':
      return [...state, action.block];

    case 'DELETE_BLOCK':
      return state.filter(b => b.id !== action.id);

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════

interface TooltipState {
  block: ScheduleBlock;
  job: JobOption | undefined;
  crew: Crew | undefined;
  x: number;
  y: number;
}

const BlockTooltip = ({ tip }: { tip: TooltipState }) => {
  const { block, job, crew } = tip;
  const endDate = addDays(block.startDate, block.durationDays - 1);
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: tip.x + 14,
        top: tip.y - 10,
        background: '#0a142d',
        color: 'white',
        borderRadius: 12,
        padding: '10px 13px',
        maxWidth: 220,
        fontSize: 11,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {block.type === 'delay' ? (
        <>
          <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>⏸ Delay Block</div>
          <div style={{ color: '#64748b' }}>
            {block.durationDays} day{block.durationDays !== 1 ? 's' : ''}
          </div>
          <div style={{ color: '#475569', marginTop: 4 }}>
            {fmtShort(block.startDate)} – {fmtShort(endDate)}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{block.jobNumber}</div>
          {job && <div style={{ color: '#cbd5e1', marginBottom: 3 }}>{job.location}</div>}
          {crew && <div style={{ color: '#94a3b8', marginBottom: 3 }}>Crew: {crew.name} &middot; {crew.size} workers</div>}
          <div style={{ color: '#94a3b8' }}>{fmtLong(block.startDate)}</div>
          <div style={{ color: '#94a3b8' }}>&rarr; {fmtLong(endDate)}</div>
          <div style={{ color: '#cbd5e1', marginTop: 4, fontWeight: 600 }}>
            {block.durationDays} day{block.durationDays !== 1 ? 's' : ''}
          </div>
          {block.extended && (
            <div style={{ color: '#fbbf24', marginTop: 4, fontWeight: 700 }}>&#9733; Extended</div>
          )}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════════════════════════════════

interface CtxMenuState {
  blockId: string;
  blockType: 'job' | 'delay';
  x: number;
  y: number;
}

const CtxMenu = ({
  menu,
  onDelay,
  onExtend,
  onDelete,
  onClose,
}: {
  menu: CtxMenuState;
  onDelay: () => void;
  onExtend: () => void;
  onDelete: () => void;
  onClose: () => void;
}) => (
  <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <div
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-sm"
      style={{ left: menu.x, top: menu.y, minWidth: 176 }}
    >
      {menu.blockType === 'job' && (
        <>
          <button
            onClick={() => { onDelay(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
          >
            <Clock className="w-4 h-4 shrink-0" /> Insert Delay&hellip;
          </button>
          <button
            onClick={() => { onExtend(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 transition-colors"
          >
            <ChevronRight className="w-4 h-4 shrink-0" /> Extend Job&hellip;
          </button>
          <div className="border-t border-slate-100" />
        </>
      )}
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
      >
        <X className="w-4 h-4 shrink-0" /> Delete Block
      </button>
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════════════════════
// DAY PROMPT MODAL  (Insert Delay / Extend Job)
// ═══════════════════════════════════════════════════════════════════════════════

interface DayPromptState {
  action: 'delay' | 'extend';
  blockId: string;
}

const DayPromptModal = ({
  state,
  onConfirm,
  onClose,
}: {
  state: DayPromptState;
  onConfirm: (days: number) => void;
  onClose: () => void;
}) => {
  const [days, setDays] = useState(1);
  const isDelay = state.action === 'delay';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          {isDelay ? 'Insert Delay' : 'Extend Job'}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {isDelay
            ? 'A delay block will be inserted before this job. The job and all subsequent crew blocks will shift forward.'
            : 'The job duration will increase and all subsequent crew blocks will shift forward automatically.'}
        </p>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
          Number of Days
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          autoFocus
          onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(days); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-semibold transition-colors ${
              isDelay ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isDelay ? 'Insert Delay' : 'Extend'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADD BLOCK MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const AddBlockModal = ({
  crews,
  jobs,
  onAdd,
  onClose,
}: {
  crews: Crew[];
  jobs: JobOption[];
  onAdd: (block: ScheduleBlock) => void;
  onClose: () => void;
}) => {
  const [crewId, setCrewId]   = useState(crews[0]?.id ?? '');
  const [jobNum, setJobNum]   = useState(jobs[0]?.jobNumber ?? '');
  const [startDate, setStart] = useState(todayISO);

  const selectedJob = jobs.find(j => j.jobNumber === jobNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewId || !jobNum || !selectedJob) return;
    onAdd({
      id: `block-${crypto.randomUUID()}`,
      crewId,
      jobNumber: jobNum,
      startDate,
      durationDays: selectedJob.estimatedDays,
      type: 'job',
      extended: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">Add Job Block</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Assign to Crew
            </label>
            <select
              value={crewId}
              onChange={e => setCrewId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              {crews.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.size} workers)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Job Number
            </label>
            <select
              value={jobNum}
              onChange={e => setJobNum(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              {jobs.map(j => (
                <option key={j.jobNumber} value={j.jobNumber}>
                  {j.jobNumber} — {j.location} ({j.estimatedDays}d)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStart(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {selectedJob && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Duration: <span className="font-semibold text-slate-700">{selectedJob.estimatedDays} days</span>
              &nbsp;&middot;&nbsp;
              Location: <span className="font-semibold text-slate-700">{selectedJob.location}</span>
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Add Block
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOB BLOCK  (draggable, right-click, tooltip)
// ═══════════════════════════════════════════════════════════════════════════════

interface JobBlockProps {
  key?: React.Key;
  block: ScheduleBlock;
  crew: Crew | undefined;
  job: JobOption | undefined;
  left: number;
  width: number;
  color: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

const JobBlock = ({
  block, job, left, width, color, isDragging,
  onDragStart, onDragEnd, onContextMenu,
  onMouseEnter, onMouseMove, onMouseLeave,
}: JobBlockProps) => {
  const isDelay   = block.type === 'delay';
  const bgColor   = isDelay ? '#6b7280' : color;
  const blockW    = Math.max(width - BLOCK_MARGIN * 2, 24);
  const blockH    = ROW_HEIGHT - BLOCK_MARGIN * 2;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        left: left + BLOCK_MARGIN,
        top: BLOCK_MARGIN,
        width: blockW,
        height: blockH,
        backgroundColor: bgColor,
        backgroundImage: isDelay
          ? 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.15) 6px, rgba(0,0,0,0.15) 12px)'
          : undefined,
        opacity: isDragging ? 0.35 : 1,
        borderRadius: 8,
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 8px',
        boxSizing: 'border-box',
        boxShadow: isDragging ? 'none' : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'opacity 0.12s',
        zIndex: 5,
      }}
    >
      {/* Extended dashed border */}
      {block.extended && !isDelay && (
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: 8,
            border: '2px dashed rgba(251,191,36,0.8)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Extended corner badge */}
      {block.extended && !isDelay && (
        <div
          title="Extended"
          style={{
            position: 'absolute', top: 0, right: 0,
            width: 0, height: 0,
            borderStyle: 'solid',
            borderWidth: '0 16px 16px 0',
            borderColor: `transparent #fbbf24 transparent transparent`,
          }}
        />
      )}

      {/* Label */}
      <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {block.jobNumber}
      </div>
      {!isDelay && job && blockW > 64 && (
        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 9, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {job.location}
        </div>
      )}
      {blockW > 40 && (
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 1 }}>
          {block.durationDays}d
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCHEDULER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SchedulerProps {
  crews?: Crew[];
  jobs?: JobOption[];
  initialBlocks?: ScheduleBlock[];
  onScheduleChange?: (schedule: ScheduleBlock[]) => void;
}

export default function Scheduler({
  crews = MOCK_CREWS,
  jobs  = MOCK_JOBS,
  initialBlocks = INITIAL_BLOCKS,
  onScheduleChange,
}: SchedulerProps) {
  const [blocks, dispatch] = useReducer(reducer, initialBlocks);
  const [view, setView]    = useState<'week' | 'month'>('week');
  const [viewOffset, setViewOffset] = useState(0); // days from default start

  const dayWidth  = view === 'week' ? 60 : 24;
  const totalDays = view === 'week' ? 28 : 90;

  // View window: start 7 days before today + navigation offset
  const viewStart = addDays(addDays(todayISO, -7), viewOffset);
  const days = Array.from({ length: totalDays }, (_, i) => addDays(viewStart, i));
  const todayOffset = diffDays(todayISO, viewStart) * dayWidth;
  const totalGridWidth = totalDays * dayWidth;

  // Per-crew color lookup
  const crewColorMap = new Map(
    crews.map((c, i) => [c.id, CREW_COLORS[i % CREW_COLORS.length]]),
  );

  // Drag state
  const [draggingId,    setDraggingId]    = useState<string | null>(null);
  const [dragOffsetDays, setDragOffsetDays] = useState(0);

  // Overlay state
  const [ctxMenu,      setCtxMenu]      = useState<CtxMenuState | null>(null);
  const [dayPrompt,    setDayPrompt]    = useState<DayPromptState | null>(null);
  const [tooltip,      setTooltip]      = useState<TooltipState | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Ref to the outer scroll container (needed for drop position calc)
  const scrollRef = useRef<HTMLDivElement>(null);
  // requestAnimationFrame ID for throttling tooltip mouse-move updates
  const tooltipRafRef = useRef<number | null>(null);

  // Notify parent when blocks change
  const prevRef = useRef(blocks);
  useEffect(() => {
    if (onScheduleChange && blocks !== prevRef.current) {
      onScheduleChange(blocks);
      prevRef.current = blocks;
    }
  }, [blocks, onScheduleChange]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, block: ScheduleBlock) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetDays = Math.max(0, Math.floor((e.clientX - rect.left) / dayWidth));
    setDragOffsetDays(offsetDays);
    setDraggingId(block.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-block-id', block.id);
  }, [dayWidth]);

  const handleDragEnd = useCallback(() => setDraggingId(null), []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, crewId: string) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData('application/x-block-id');
    if (!blockId || !scrollRef.current) return;

    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    // Position within the full scrollable content
    const xInContent = e.clientX - containerRect.left + container.scrollLeft;
    // Position within the grid area (subtract the fixed crew-label column)
    const xInGrid    = xInContent - CREW_COL_W;
    const dayIndex   = Math.floor(xInGrid / dayWidth);
    const newStart   = addDays(viewStart, dayIndex - dragOffsetDays);

    dispatch({ type: 'MOVE_BLOCK', id: blockId, crewId, startDate: newStart });
    setDraggingId(null);
  }, [dayWidth, viewStart, dragOffsetDays]);

  // ── Context-menu actions ─────────────────────────────────────────────────────

  const handleDelayConfirm = (days: number) => {
    if (!dayPrompt) return;
    dispatch({ type: 'INSERT_DELAY', blockId: dayPrompt.blockId, days });
  };

  const handleExtendConfirm = (days: number) => {
    if (!dayPrompt) return;
    dispatch({ type: 'EXTEND_JOB', blockId: dayPrompt.blockId, days });
  };

  // ── Build month-label spans for header ──────────────────────────────────────

  const monthLabels: { label: string; startCol: number; span: number }[] = [];
  days.forEach((day, i) => {
    const d = parseDate(day);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const last = monthLabels[monthLabels.length - 1];
    if (!last || last.label !== label) {
      monthLabels.push({ label, startCol: i, span: 1 });
    } else {
      last.span++;
    }
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none" style={{ minHeight: 0 }}>
      {/* ─── Toolbar ─── */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0 flex-wrap"
        style={{ background: '#0a142d' }}
      >
        <Calendar className="w-5 h-5 text-blue-400 shrink-0" />
        <h2 className="text-white font-bold text-base tracking-tight mr-2">Job Scheduler</h2>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/20">
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                view === v ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewOffset(v => v - (view === 'week' ? 14 : 30))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewOffset(0)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setViewOffset(v => v + (view === 'week' ? 14 : 30))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <span className="text-slate-500 text-xs">
          {fmtShort(viewStart)} – {fmtShort(addDays(viewStart, totalDays - 1))}
        </span>

        <div className="ml-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Job
          </button>
        </div>
      </div>

      {/* ─── Grid ─── */}
      <div ref={scrollRef} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        <div style={{ minWidth: CREW_COL_W + totalGridWidth }}>

          {/* Month header */}
          <div
            className="flex"
            style={{
              height: HEADER_MONTH_H,
              position: 'sticky', top: 0, zIndex: 30,
              background: '#0a142d',
            }}
          >
            <div
              style={{
                width: CREW_COL_W, minWidth: CREW_COL_W, height: HEADER_MONTH_H,
                borderRight: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
                position: 'sticky', left: 0, zIndex: 31,
                background: '#0a142d',
              }}
            />
            <div style={{ position: 'relative', width: totalGridWidth, height: HEADER_MONTH_H }}>
              {monthLabels.map(ml => (
                <div
                  key={ml.label}
                  style={{
                    position: 'absolute',
                    left: ml.startCol * dayWidth,
                    width: ml.span * dayWidth,
                    height: HEADER_MONTH_H,
                    display: 'flex', alignItems: 'center',
                    paddingLeft: 8, boxSizing: 'border-box',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    color: '#93c5fd',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                >
                  {ml.label}
                </div>
              ))}
            </div>
          </div>

          {/* Day header */}
          <div
            className="flex"
            style={{
              height: HEADER_DAY_H,
              position: 'sticky', top: HEADER_MONTH_H, zIndex: 30,
              background: '#0d1b38',
            }}
          >
            <div
              style={{
                width: CREW_COL_W, minWidth: CREW_COL_W, height: HEADER_DAY_H,
                borderRight: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center',
                paddingLeft: 12, flexShrink: 0,
                position: 'sticky', left: 0, zIndex: 31,
                background: '#0d1b38',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#334155' }}>
                Crew
              </span>
            </div>
            <div style={{ position: 'relative', width: totalGridWidth, height: HEADER_DAY_H }}>
              {days.map((day, i) => {
                const d = parseDate(day);
                const isToday   = day === todayISO;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const showLabel = view === 'week' || i % 3 === 0;
                return (
                  <div
                    key={day}
                    style={{
                      position: 'absolute',
                      left: i * dayWidth, width: dayWidth, height: HEADER_DAY_H,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid rgba(255,255,255,0.04)',
                      backgroundColor: isToday ? 'rgba(59,130,246,0.22)' : undefined,
                      boxSizing: 'border-box',
                    }}
                  >
                    {showLabel && (
                      <>
                        <span style={{ fontSize: 9, color: isToday ? '#93c5fd' : isWeekend ? '#475569' : '#64748b', fontWeight: isToday ? 700 : 400 }}>
                          {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                        </span>
                        <span style={{ fontSize: 10, color: isToday ? '#60a5fa' : isWeekend ? '#334155' : '#94a3b8', fontWeight: isToday ? 700 : 500 }}>
                          {d.getDate()}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crew rows */}
          {crews.map((crew, ci) => {
            const crewBlocks = blocks.filter(b => b.crewId === crew.id);
            const color = crewColorMap.get(crew.id) ?? CREW_COLORS[0];

            return (
              <div key={crew.id} className="flex" style={{ height: ROW_HEIGHT }}>
                {/* Sticky crew label */}
                <div
                  style={{
                    width: CREW_COL_W, minWidth: CREW_COL_W, height: ROW_HEIGHT,
                    position: 'sticky', left: 0, zIndex: 20,
                    background: ci % 2 === 0 ? '#0d1b38' : '#0a142d',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center',
                    padding: '0 12px', gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                      {crew.name}
                    </div>
                    <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>
                      {crew.size} workers
                    </div>
                  </div>
                </div>

                {/* Drop-zone row */}
                <div
                  style={{
                    position: 'relative',
                    width: totalGridWidth, height: ROW_HEIGHT,
                    background: ci % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, crew.id)}
                >
                  {/* Day cells (grid lines + weekend shading) */}
                  {days.map((day, i) => {
                    const isWeekend = [0, 6].includes(parseDate(day).getDay());
                    return (
                      <div
                        key={day}
                        style={{
                          position: 'absolute',
                          left: i * dayWidth, top: 0,
                          width: dayWidth, height: ROW_HEIGHT,
                          borderRight: '1px solid #e2e8f0',
                          backgroundColor: isWeekend ? 'rgba(148,163,184,0.07)' : undefined,
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}

                  {/* Today line */}
                  {todayOffset >= 0 && todayOffset <= totalGridWidth && (
                    <div
                      style={{
                        position: 'absolute', left: todayOffset,
                        top: 0, width: 2, height: ROW_HEIGHT,
                        backgroundColor: '#ef4444',
                        zIndex: 8, pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Job/Delay blocks */}
                  {crewBlocks.map(block => {
                    const left  = diffDays(block.startDate, viewStart) * dayWidth;
                    const width = block.durationDays * dayWidth;
                    if (left + width < 0 || left > totalGridWidth) return null;
                    const job = jobs.find(j => j.jobNumber === block.jobNumber);
                    return (
                      <JobBlock
                        key={block.id}
                        block={block}
                        crew={crew}
                        job={job}
                        left={left}
                        width={width}
                        color={color}
                        isDragging={draggingId === block.id}
                        onDragStart={e => handleDragStart(e, block)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={e => {
                          e.preventDefault();
                          setCtxMenu({ blockId: block.id, blockType: block.type, x: e.clientX, y: e.clientY });
                        }}
                        onMouseEnter={e => setTooltip({ block, job, crew, x: e.clientX, y: e.clientY })}
                        onMouseMove={e  => {
                          const x = e.clientX;
                          const y = e.clientY;
                          if (tooltipRafRef.current !== null) return;
                          tooltipRafRef.current = requestAnimationFrame(() => {
                            tooltipRafRef.current = null;
                            setTooltip(t => t ? { ...t, x, y } : t);
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Overlays ─── */}
      {tooltip && <BlockTooltip tip={tooltip} />}

      {ctxMenu && (
        <CtxMenu
          menu={ctxMenu}
          onDelay={() => setDayPrompt({ action: 'delay',  blockId: ctxMenu.blockId })}
          onExtend={() => setDayPrompt({ action: 'extend', blockId: ctxMenu.blockId })}
          onDelete={() => dispatch({ type: 'DELETE_BLOCK', id: ctxMenu.blockId })}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {dayPrompt && (
        <DayPromptModal
          state={dayPrompt}
          onConfirm={dayPrompt.action === 'delay' ? handleDelayConfirm : handleExtendConfirm}
          onClose={() => setDayPrompt(null)}
        />
      )}

      {showAddModal && (
        <AddBlockModal
          crews={crews}
          jobs={jobs}
          onAdd={block => dispatch({ type: 'ADD_BLOCK', block })}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
