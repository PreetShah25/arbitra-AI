import React, { useMemo, useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from "recharts";

/**
 * Alphalink – YC Demo v4 (No-backend, interactive, themed)
 *
 * What this adds (over your current interactive UI):
 * - Theming & branding: accent color switcher + optional logo upload (client-only)
 * - Agent run simulation with retry + telemetry (latency, tokens, $cost)
 * - Tabs: Watchlist / Company / Inbox / Data Room / Settings
 * - Chart toggle (Line/Bar), CSV upload to override KPIs, and CSV download (seed files)
 * - Multi-company notes; approval queue (approve/reject)
 * - Step 1: Agent Task backbone (per-company tasks) + New Analysis modal (draft)
 * - Step 2: Screen recording & upload (client-only simulation) with Ready-to-Analyze confirmation
 * - Step 3: Video → Screenshots + Editable Plan (approve plan → run)
 */

/* ---------- UI atoms ---------- */
function Badge({ children, variant = "neutral" }: { children: React.ReactNode; variant?: "neutral" | "success" | "warning" | "danger" }) {
  const map: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-800 border-gray-200",
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-yellow-100 text-yellow-900 border-yellow-200",
    danger: "bg-red-100 text-red-800 border-red-200",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${map[variant] || map.neutral}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost" | "primary" | "destructive";
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    {
      default: "border bg-white hover:bg-gray-50",
      ghost: "border border-transparent hover:bg-gray-100",
      primary: "bg-[var(--accent)] text-white hover:brightness-95 border border-[var(--accent)]",
      destructive: "bg-red-600 text-white hover:bg-red-700 border border-red-700",
    }[variant] || "border bg-white";
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`px-3 py-2 rounded-xl text-sm ${cls} disabled:opacity-60 disabled:cursor-not-allowed transition`}>
      {children}
    </button>
  );
}

function Card({ title, actions, children, footer }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border shadow-sm bg-white">
      {(title || actions) && (
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="px-4 py-3 border-t text-xs text-gray-500">{footer}</div>}
    </div>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl border bg-white shadow-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Recording widget (Step 2) ---------- */
function RecordingWidget({ onRecorded }: { onRecorded: (url: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        onRecorded(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      alert("Screen capture permission denied. You can upload a file instead.");
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();
    setRecording(false);
  };

  return (
    <div className="space-y-2">
      {!videoUrl && (
        <div className="flex gap-2">
          <Button variant="primary" onClick={startRecording} disabled={recording}>
            Start recording
          </Button>
          <Button variant="default" onClick={stopRecording} disabled={!recording}>
            Stop & upload
          </Button>
        </div>
      )}
      {videoUrl && <video src={videoUrl} controls className="w-full rounded-xl border" />}
    </div>
  );
}

/* ---------- Mock data ---------- */
const WATCHLIST0 = [
  { ticker: "RL", name: "Ralph Lauren", sector: "Luxury", price: 194.32, change: +1.2, kpi: { AUR: 1.08, DTC: 0.63 } },
  { ticker: "LVMH", name: "LVMH", sector: "Luxury", price: 845.1, change: -0.4, kpi: { AUR: 1.05, DTC: 0.78 } },
  { ticker: "PRADA", name: "Prada", sector: "Luxury", price: 77.8, change: +0.7, kpi: { AUR: 1.04, DTC: 0.59 } },
  { ticker: "KER", name: "Kering", sector: "Luxury", price: 520.5, change: +0.9, kpi: { AUR: 1.06, DTC: 0.66 } },
];

const KPIS: Record<string, Array<{ period: string; AUR: number; DTC: number; Wholesale: number }>> = {
  RL: [
    { period: "Q1-24", AUR: 100, DTC: 60, Wholesale: 40 },
    { period: "Q2-24", AUR: 103, DTC: 61, Wholesale: 39 },
    { period: "Q3-24", AUR: 106, DTC: 62, Wholesale: 38 },
    { period: "Q4-24", AUR: 108, DTC: 63, Wholesale: 37 },
    { period: "Q1-25", AUR: 110, DTC: 64, Wholesale: 36 },
  ],
  LVMH: [
    { period: "Q1-24", AUR: 120, DTC: 70, Wholesale: 30 },
    { period: "Q2-24", AUR: 125, DTC: 72, Wholesale: 28 },
    { period: "Q3-24", AUR: 128, DTC: 73, Wholesale: 27 },
    { period: "Q4-24", AUR: 130, DTC: 74, Wholesale: 26 },
  ],
  PRADA: [
    { period: "Q1-24", AUR: 80, DTC: 50, Wholesale: 50 },
    { period: "Q2-24", AUR: 82, DTC: 52, Wholesale: 48 },
    { period: "Q3-24", AUR: 84, DTC: 53, Wholesale: 47 },
    { period: "Q4-24", AUR: 86, DTC: 54, Wholesale: 46 },
  ],
  KER: [
    { period: "Q1-24", AUR: 95, DTC: 62, Wholesale: 38 },
    { period: "Q2-24", AUR: 97, DTC: 63, Wholesale: 37 },
    { period: "Q3-24", AUR: 99, DTC: 64, Wholesale: 36 },
    { period: "Q4-24", AUR: 101, DTC: 65, Wholesale: 35 },
  ],
};

const NOTES_BY_TICKER: Record<
  string,
  Array<{ id: string; title: string; body: string; impact: "positive" | "neutral" | "danger"; citations: { label: string; url: string }[] }>
> = {
  RL: [
    { id: "n1", title: "8-K: Pricing actions reiterated in Europe", body: "RL reiterated low-single-digit price/mix actions in EU outlets.", impact: "positive", citations: [{ label: "SEC 8-K", url: "#" }] },
    { id: "n2", title: "News: China store expansion permit", body: "Permit granted for Tier-2 city doors; DTC mix up.", impact: "neutral", citations: [{ label: "Shanghai Daily", url: "#" }] },
  ],
  LVMH: [{ id: "n3", title: "Sephora expansion in China", body: "Sephora to expand into Tier-2 cities.", impact: "positive", citations: [{ label: "FT", url: "#" }] }],
  PRADA: [{ id: "n4", title: "Sustainability targets", body: "Prada sets new sustainability targets; details TBD.", impact: "neutral", citations: [{ label: "WSJ", url: "#" }] }],
  KER: [{ id: "n5", title: "Earnings beat on Gucci", body: "Kering Q4 beat driven by Gucci sales.", impact: "positive", citations: [{ label: "Bloomberg", url: "#" }] }],
};

const ACTIONS0 = [
  { id: "a1", title: "Verify EU outlet AUR delta", detail: "Run targeted scrape on EU outlets", labels: ["RL", "pricing"], status: "proposed" },
  { id: "a2", title: "Track Sephora expansion", detail: "Validate Chinese store permits", labels: ["LVMH", "expansion"], status: "proposed" },
  { id: "a3", title: "Validate sustainability targets", detail: "Check reporting standards", labels: ["PRADA", "ESG"], status: "proposed" },
];

const RAG_DOCS = [
  { id: "d1", title: "RL_FY2025_Q1_10Q.pdf", type: "filing", updated: "2025-08-12" },
  { id: "d2", title: "RL_Q1_Transcript.txt", type: "transcript", updated: "2025-08-12" },
  { id: "d3", title: "EU_Outlet_Panel.csv", type: "altdata", updated: "2025-08-10" },
  { id: "d4", title: "China_Tier2_Permits.csv", type: "altdata", updated: "2025-08-09" },
];

/* ---------- Storage helpers + tests ---------- */
const storageKey = "alphalink_tasks_v1";
const loadTasks = () => {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
};
function runSelfTests() {
  console.assert(Array.isArray(WATCHLIST0) && WATCHLIST0.length > 0, "[SelfTest] WATCHLIST0 non-empty");
  WATCHLIST0.forEach((w) => console.assert(!!KPIS[w.ticker], `[SelfTest] Missing KPI series for ${w.ticker}`));
  Object.values(NOTES_BY_TICKER)
    .flat()
    .forEach((n) => console.assert(n && n.id && n.title && typeof n.body === "string" && Array.isArray(n.citations), "[SelfTest] Bad note schema", n));
}

/* ---------- External Step-3 helpers (arg-based) ---------- */
async function generateScreenshots(args: {
  videoPreviewUrl: string;
  currentTaskId: string | null;
  draftDesc: string;
  company: { name: string } | null;
  updateTask: (id: string, patch: any) => void;
}) {
  const { videoPreviewUrl, currentTaskId, draftDesc, company, updateTask } = args;
  if (!videoPreviewUrl || !currentTaskId) {
    alert("Please upload or record a video first.");
    return [];
  }
  const video = document.createElement("video");
  video.src = videoPreviewUrl;
  video.crossOrigin = "anonymous";
  video.muted = true;
  await new Promise<void>((res) => {
    video.onloadedmetadata = () => res();
  });
  const duration = Math.min(video.duration || 0, 120);
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx = canvas.getContext("2d");
  const interval = 2;
  const maxShots = 8;
  const shots: Array<{ id: string; ts: number; dataUrl: string; note: string }> = [];
  for (let t = 0, i = 0; t < duration && i < maxShots; t += interval, i++) {
    await new Promise<void>((res) => {
      video.currentTime = t;
      video.onseeked = () => res();
    });
    if (!ctx) break;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    shots.push({ id: `${Date.now()}_${i}`, ts: t, dataUrl: canvas.toDataURL("image/webp"), note: "" });
  }
  updateTask(currentTaskId, { screenshots: shots, status: "analyzing" });
  draftUnderstanding({ shots, draftDesc, company, currentTaskId, updateTask });
  return shots;
}

function draftUnderstanding({
  shots,
  draftDesc,
  company,
  currentTaskId,
  updateTask,
}: {
  shots: Array<{ id: string; ts: number; dataUrl: string; note: string }>;
  draftDesc: string;
  company: { name: string } | null;
  currentTaskId: string | null;
  updateTask: (id: string, patch: any) => void;
}) {
  const shotCount = (shots || []).length;
  const base = (draftDesc || "").trim();
  const co = company?.name || "";
  const summary = base
    ? `I understood that this task is: ${base}. I will execute it for ${co}. I extracted ${shotCount} key frames to guide the workflow.`
    : `I extracted ${shotCount} key frames from the video for ${co}. I will open primary sources, extract KPIs (AUR/DTC/Wholesale), update the sheet, and generate an impact note with citations.`;
  const questions = [
    "Which exact ticker/sheet tab should I write the KPIs to?",
    "Any metrics beyond AUR/DTC/Wholesale to capture (e.g., region, channel, margin)?",
    "Do I need to email anyone or open any tickets when done? If yes, who?",
  ];
  const understanding = { summary, questions, answers: ["", "", ""] };
  if (currentTaskId) updateTask(currentTaskId, { understanding });
}

async function proceedToStep3(args: {
  currentTask: any | null;
  videoPreviewUrl: string;
  currentTaskId: string | null;
  draftDesc: string;
  company: { name: string } | null;
  updateTask: (id: string, patch: any) => void;
  setWizardStep: (n: number) => void;
}) {
  const { currentTask, videoPreviewUrl, currentTaskId, draftDesc, company, updateTask, setWizardStep } = args;
  let shots = currentTask?.screenshots || [];
  if (!shots.length) {
    shots = await generateScreenshots({ videoPreviewUrl, currentTaskId, draftDesc, company, updateTask });
  }
  setWizardStep(3);
}

/* ---------- Main component ---------- */
export default function App() {
  // Theme / branding
  const [theme, setTheme] = useState("brand");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const themeVars = useMemo(() => {
    if (theme === "dark") return { accent: "#6EE7B7", bgFrom: "#0f172a", bgTo: "#111827", text: "#e5e7eb" };
    if (theme === "light") return { accent: "#111827", bgFrom: "#f8fafc", bgTo: "#ffffff", text: "#0f172a" };
    return { accent: "#111827", bgFrom: "#f8fafc", bgTo: "#ffffff", text: "#111827" };
  }, [theme]);

  // App state
  const [tab, setTab] = useState("watchlist");
  const [watchlist, setWatchlist] = useState(WATCHLIST0);
  const [selected, setSelected] = useState("RL");
  const [actions, setActions] = useState(ACTIONS0);
  const [notes, setNotes] = useState(NOTES_BY_TICKER[selected]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [metrics] = useState({ latencyMs: 0, tokens: 0, cost: 0 });
  const [model] = useState("gpt-5-thinking");
  const [temperature] = useState(0);
  const [chartMode, setChartMode] = useState("line");

  // Tasks (Steps 1–3)
  const [tasks, setTasks] = useState<Record<string, any[]>>(() => loadTasks());
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const canCreate = draftName.trim().length > 0 && draftDesc.trim().length > 0;
  const [wizardStep, setWizardStep] = useState(1);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    runSelfTests();
  }, []);

  // Derived
  const company = useMemo(() => watchlist.find((c) => c.ticker === selected) || watchlist[0], [watchlist, selected]);
  const series = KPIS[selected] || [];
  const companyTasks = tasks[selected] || [];
  const currentTask = useMemo(() => (currentTaskId ? companyTasks.find((t) => t.id === currentTaskId) || null : null), [companyTasks, currentTaskId]);

  // Handlers
  const nudgePrice = (ticker: string, delta: number) => {
    setWatchlist((prev) => prev.map((w) => (w.ticker === ticker ? { ...w, price: +(w.price + delta).toFixed(2), change: +(w.change + delta / 10).toFixed(1) } : w)));
  };
  const approve = (id: string, ok: boolean) => setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: ok ? "approved" : "rejected" } : a)));

  const onCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const rows = text
          .trim()
          .split(/\r?\n/)
          .slice(1)
          .map((line) => {
            const [period, AUR, DTC, Wholesale] = line.split(",");
            return { period, AUR: +AUR, DTC: +DTC, Wholesale: +Wholesale };
          });
        (KPIS as any)[selected] = rows;
        alert(`Loaded ${rows.length} KPI rows for ${selected}.`);
      } catch {
        alert("Failed to parse CSV. Expect header: period,AUR,DTC,Wholesale");
      }
    };
    reader.readAsText(file);
  };

  const downloadCsv = () => {
    const rows = KPIS[selected] || [];
    const csv = "period,AUR,DTC,Wholesale\n" + rows.map((r) => [r.period, r.AUR, r.DTC, r.Wholesale].join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected}_KPIs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogoDataUrl(String(r.result));
    r.readAsDataURL(f);
  };

  const updateTask = (id: string, patch: any) => {
    setTasks((prev) => ({
      ...prev,
      [selected]: (prev[selected] || []).map((t: any) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const deleteTask = (id: string, ticker?: string) => {
    const key = ticker || selected;
    if (!confirm("Delete this task? This cannot be undone.")) return;
    setTasks((prev) => ({ ...prev, [key]: (prev[key] || []).filter((t: any) => t.id !== id) }));
    if (currentTaskId === id) {
      setTaskModalOpen(false);
      setCurrentTaskId(null);
      setVideoPreviewUrl("");
      setUploadProgress(0);
      setWizardStep(1);
      setDraftName("");
      setDraftDesc("");
    }
  };

  const openNewAnalysis = () => {
    setDraftName("");
    setDraftDesc("");
    setVideoPreviewUrl("");
    setUploadProgress(0);
    setWizardStep(1);
    setCurrentTaskId(null);
    setTaskModalOpen(true);
  };

  const createDraftTask = () => {
    const name = (draftName || "Untitled Analysis").trim();
    const desc = (draftDesc || "").trim();
    if (!desc) {
      alert("Please provide a non-empty description for the task.");
      return;
    }
    const id = (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2);
    const now = Date.now();
    const newTask = { id, ticker: selected, name, desc, status: "draft", createdAt: now };
    setTasks((prev) => ({ ...prev, [selected]: [newTask, ...(prev[selected] || [])] }));
    setCurrentTaskId(id);
    setWizardStep(2);
  };

  const onRecorded = (url: string) => {
    setVideoPreviewUrl(url);
    setUploadProgress(0);
    const int = setInterval(() => {
      setUploadProgress((p) => {
        const next = Math.min(100, p + 20);
        if (next >= 100) {
          clearInterval(int);
          if (currentTaskId) updateTask(currentTaskId, { status: "analyzing", videoUrl: url });
        }
        return next;
      });
    }, 200);
  };

  const onFileUpload = (file?: File | null) => {
    if (!file) return;
    onRecorded(URL.createObjectURL(file));
  };

  /* ---------- Step 3 actions (arg-based) ---------- */
  const goStep3 = async () => {
    await proceedToStep3({
      currentTask,
      videoPreviewUrl,
      currentTaskId,
      draftDesc,
      company,
      updateTask,
      setWizardStep,
    });
  };

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(to bottom, ${themeVars.bgFrom}, ${themeVars.bgTo})`, color: themeVars.text, ["--accent" as any]: themeVars.accent }}>
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b" style={{ backgroundColor: "rgba(255,255,255,0.85)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center font-bold overflow-hidden">
              {logoDataUrl ? <img src={logoDataUrl} alt="logo" className="h-8 w-8 object-cover" /> : "α"}
            </div>
            <div className="font-semibold text-lg" style={{ color: "black" }}>
              Alphalink <span className="text-gray-400">/ AlphaSentinel (Demo)</span>
            </div>
          </div>
          <div className="flex gap-2">
            {["watchlist", "company", "inbox", "dataroom", "settings"].map((t) => (
              <Button key={t} variant={tab === t ? "primary" : "ghost"} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-12 gap-4">
        {/* Left rail */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card title="Watchlist">
            <div className="space-y-2">
              {watchlist.map((c) => (
                <div key={c.ticker} className={`flex items-center justify-between p-2 rounded-xl ${selected === c.ticker ? "bg-gray-50 border" : ""}`}>
                  <div>
                    <div className="font-semibold cursor-pointer" onClick={() => { setSelected(c.ticker); setNotes(NOTES_BY_TICKER[c.ticker]); }}>
                      {c.name} <span className="text-gray-400 text-xs">({c.ticker})</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.sector} · AUR {c.kpi.AUR.toFixed(2)} · DTC {Math.round(c.kpi.DTC * 100)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm" style={{ color: "black" }}>${c.price.toFixed(2)}</div>
                    <div className={`text-xs ${c.change >= 0 ? "text-green-600" : "text-red-600"}`}>{c.change >= 0 ? "+" : ""}{c.change}%</div>
                    <div className="mt-2 flex gap-1">
                      <Button variant="ghost" onClick={() => setSelected(c.ticker)}>
                        Open
                      </Button>
                      <Button variant="ghost" title="Nudge price up" onClick={() => nudgePrice(c.ticker, +0.5)}>
                        ＋
                      </Button>
                      <Button variant="ghost" title="Nudge price down" onClick={() => nudgePrice(c.ticker, -0.5)}>
                        －
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main content */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {tab === "company" && (
            <>
              <Card
                title={`${company?.name} (${company?.ticker})`}
                actions={
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Button variant="primary" onClick={openNewAnalysis}>
                      New Analysis
                    </Button>
                    <label className="cursor-pointer">
                      Upload KPIs CSV <input type="file" accept=".csv" onChange={onCsvUpload} className="text-xs" />
                    </label>
                    <Button variant="ghost" onClick={downloadCsv}>
                      Download sample CSV
                    </Button>
                    <select className="border rounded-lg px-2 py-1" value={chartMode} onChange={(e) => setChartMode(e.target.value)}>
                      <option value="line">Line</option>
                      <option value="bar">Bar</option>
                    </select>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Key thesis bullets (editable)</div>
                    <ThesisEditor ticker={selected} />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-2">KPIs</div>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartMode === "line" ? (
                          <LineChart data={KPIS[selected]} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="AUR" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="DTC" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Wholesale" strokeWidth={2} dot={false} />
                          </LineChart>
                        ) : (
                          <BarChart data={KPIS[selected]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="AUR" />
                            <Bar dataKey="DTC" />
                            <Bar dataKey="Wholesale" />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Latest agent notes" actions={<Badge variant="success">Auto-cited</Badge>}>
                <div className="space-y-3">
                  {!notes || notes.length === 0 ? (
                    <div className="text-gray-400 text-sm">No notes yet. Run the monitor in the left panel.</div>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="p-3 rounded-xl border">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{n.title}</div>
                          <Badge variant={n.impact === "positive" ? "success" : n.impact === "danger" ? "danger" : "neutral"}>{n.impact}</Badge>
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{n.body}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {n.citations.map((c, i) => (
                            <a key={i} href={c.url} className="text-xs underline text-gray-600">
                              {c.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card title="Agent Tasks">
                <div className="space-y-2">
                  {companyTasks.length === 0 && <div className="text-gray-400 text-sm">No tasks yet. Click <span className="font-medium">New Analysis</span> to create your first task.</div>}
                  {companyTasks.map((t: any) => (
                    <div key={t.id} className="p-3 rounded-xl border flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {t.name} <span className="text-gray-400 text-xs">• {new Date(t.createdAt).toLocaleString()}</span>
                        </div>
                        {t.desc && <div className="text-xs text-gray-600 truncate max-w-xl">{t.desc}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{t.status}</Badge>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setCurrentTaskId(t.id);
                            setDraftName(t.name);
                            setDraftDesc(t.desc || "");
                            setWizardStep(t.videoUrl ? 2 : 1);
                            setVideoPreviewUrl(t.videoUrl || "");
                            setUploadProgress(t.videoUrl ? 100 : 0);
                            setTaskModalOpen(true);
                          }}
                        >
                          View
                        </Button>
                        <Button variant="destructive" onClick={() => deleteTask(t.id, t.ticker)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {tab === "inbox" && (
            <Card title="Approval queue (simulated)">
              <div className="space-y-2">
                {actions.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl border flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {a.title} <span className="text-gray-400 text-xs">[{a.labels.join(", ")}]</span>
                      </div>
                      <div className="text-sm text-gray-700">{a.detail}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.status === "proposed" && (
                        <>
                          <Button onClick={() => approve(a.id, true)} variant="primary">
                            Approve
                          </Button>
                          <Button onClick={() => approve(a.id, false)} variant="default">
                            Reject
                          </Button>
                        </>
                      )}
                      {a.status !== "proposed" && <Badge variant={a.status === "approved" ? "success" : "danger"}>{a.status}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "dataroom" && (
            <Card title="Data Room (mock RAG search)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Indexed docs</div>
                  <ul className="space-y-2">
                    {RAG_DOCS.map((d) => (
                      <li key={d.id} className="p-2 border rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{d.title}</div>
                          <div className="text-xs text-gray-500">
                            {d.type} • updated {d.updated}
                          </div>
                        </div>
                        <Badge>OK</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Ask the corpus</div>
                  <RagBox />
                </div>
              </div>
            </Card>
          )}

          {tab === "settings" && (
            <Card title="Settings (client-only)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-gray-600 mb-1">Theme</label>
                  <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                    <option value="brand">Brand</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Logo</label>
                  <input type="file" accept="image/*" onChange={onLogoUpload} className="w-full" />
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Step 2/3 Modal */}
      <Modal open={taskModalOpen} title={`New Analysis – ${company?.name} (${company?.ticker})`} onClose={() => setTaskModalOpen(false)}>
        <div className="flex items-center gap-2 mb-3 text-xs">
          <Badge variant={wizardStep >= 1 ? "success" : "neutral"}>1. Details</Badge>
          <span>→</span>
          <Badge variant={wizardStep >= 2 ? "success" : "neutral"}>2. Record / Upload</Badge>
          <span>→</span>
          <Badge variant={wizardStep >= 3 ? "success" : "neutral"}>3. Review Plan</Badge>
        </div>

        {wizardStep === 1 && (
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-gray-600 mb-1">Task name</label>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g., EU Outlet AUR scrape & model update" className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">What should the agent do? (short description, required)</label>
              <textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={3} placeholder="Briefly describe the analysis objective" className="w-full border rounded-xl px-3 py-2" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setTaskModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={createDraftTask} disabled={!canCreate}>
                Create draft
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-3 text-sm">
            <div className="text-gray-700">Record your screen to demonstrate the workflow, or upload a short <code>.mp4/.webm</code> (≤3 min recommended).</div>
            <RecordingWidget onRecorded={onRecorded} />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">
                Or upload video
                <input type="file" accept="video/*" onChange={(e) => onFileUpload(e.target.files?.[0])} className="block" />
              </label>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="text-xs w-10 text-right">{uploadProgress}%</div>
            </div>
            {videoPreviewUrl && <video src={videoPreviewUrl} controls className="w-full rounded-xl border" />}
            <div className="flex items-center justify-end pt-2 gap-2">
              <Button
                variant="default"
                onClick={async () => {
                  await generateScreenshots({ videoPreviewUrl, currentTaskId, draftDesc, company, updateTask });
                  setWizardStep(3);
                }}
                disabled={!videoPreviewUrl}
              >
                Generate screenshots now
              </Button>
              <Button
                variant="primary"
                onClick={() => goStep3()}
                disabled={uploadProgress < 100}
              >
                Proceed to Step 3
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Screenshots */}
            <div>
              <div className="text-sm text-gray-600 mb-2">Screenshots</div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-auto border rounded-xl p-2">
                {(currentTask?.screenshots || []).length === 0 && <div className="col-span-2 text-xs text-gray-500">No screenshots yet. Use “Generate screenshots now” in Step 2.</div>}
                {(currentTask?.screenshots || []).map((s: any) => (
                  <div key={s.id} className="space-y-1">
                    <img src={s.dataUrl} alt={`shot ${s.ts}s`} className="rounded-lg border" />
                    <input value={s.note || ""} onChange={(e) => updateScreenshotNote(s.id, e.target.value)} placeholder="Note (optional)" className="w-full border rounded-lg px-2 py-1 text-xs" />
                    <div className="text-[10px] text-gray-500">t={s.ts}s</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: Understanding + Plan */}
            <div>
              <div className="text-sm text-gray-600 mb-2">Agent understanding</div>
              <div className="space-y-2 p-2 border rounded-xl mb-4">
                <label className="text-xs text-gray-600">Reiteration (editable)</label>
                <textarea value={currentTask?.understanding?.summary || ""} onChange={(e) => updateUnderstandingSummary(e.target.value)} className="w-full border rounded-lg px-2 py-1 text-sm" rows={3} />
                <div className="text-xs text-gray-600 mt-1">Questions for you (optional)</div>
                <div className="space-y-2">
                  {(currentTask?.understanding?.questions || []).map((q: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="text-xs text-gray-700 flex-1">{q}</div>
                      <input value={(currentTask?.understanding?.answers || [])[i] || ""} onChange={(e) => updateUnderstandingAnswer(i, e.target.value)} placeholder="Your answer" className="border rounded-lg px-2 py-1 text-xs w-72" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-2">Editable plan</div>
              <div className="space-y-2 max-h-72 overflow-auto">
                {(currentTask?.plan || []).map((p: any) => (
                  <div key={p.id} className="p-2 border rounded-xl">
                    <div className="flex items-center gap-2">
                      <input value={p.title} onChange={(e) => updatePlanField(p.id, "title", e.target.value)} className="flex-1 border rounded-lg px-2 py-1 text-sm" />
                      <label className="text-xs flex items-center gap-1">
                        <input type="checkbox" checked={!!p.blocking} onChange={(e) => updatePlanField(p.id, "blocking", (e.target as HTMLInputElement).checked)} /> blocking
                      </label>
                    </div>
                    <textarea value={p.detail} onChange={(e) => updatePlanField(p.id, "detail", e.target.value)} className="w-full border rounded-lg px-2 py-1 text-xs mt-2" placeholder="Details" />
                    <div className="flex gap-2 justify-end mt-2">
                      <Button variant="ghost" onClick={() => movePlan(p.id, "up")}>
                        ↑
                      </Button>
                      <Button variant="ghost" onClick={() => movePlan(p.id, "down")}>
                        ↓
                      </Button>
                      <Button variant="destructive" onClick={() => removePlan(p.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="default" onClick={addPlanStep}>
                  Add step
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <footer className="max-w-6xl mx-auto px-4 py-10 text-xs text-gray-500">
        <div>
          This is a <strong>no-backend</strong> interactive demo. All data is mocked. Show: workflow, UI, guardrails, failure handling, and cost/latency telemetry.
        </div>
      </footer>
    </div>
  );
}

/* ---------- Helpers ---------- */
function RagBox() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Array<{ title: string; snippet: string; cite: string }> | null>(null);
  const ask = () => {
    if (!q.trim()) return;
    const base = [
      { title: "8-K: EU pricing actions", snippet: "…low-single-digit price/mix actions reiterated…", cite: "RL_FY2025_Q1_10Q.pdf" },
      { title: "Transcript: guidance remarks", snippet: "…DTC mix expected to rise low-single digits…", cite: "RL_Q1_Transcript.txt" },
      { title: "Alt-data panel", snippet: "…basket size up 3.1% m/m across EU outlets…", cite: "EU_Outlet_Panel.csv" },
    ];
    const filtered = base.filter((b) => q.toLowerCase().split(/\s+/).some((w) => b.snippet.toLowerCase().includes(w) || b.title.toLowerCase().includes(w)));
    setRes(filtered.length ? filtered : base.slice(0, 2));
  };
  return (
    <div>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g., 'AUR guidance Europe'" className="flex-1 border rounded-xl px-3 py-2" />
        <Button variant="primary" onClick={ask}>
          Ask
        </Button>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {!res && <div className="text-gray-400">Type a question to query the (mocked) corpus.</div>}
        {res &&
          res.map((r, i) => (
            <div key={i} className="p-2 border rounded-xl">
              <div className="font-medium">{r.title}</div>
              <div className="text-gray-700">{r.snippet}</div>
              <div className="text-xs text-gray-500">Source: {r.cite}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ThesisEditor({ ticker }: { ticker: string }) {
  const [bullets, setBullets] = useState<Record<string, string[]>>({
    RL: ["AUR glidepath sustained through FY28 with low elasticity risk", "DTC mix shift offsets wholesale margin drag", "China Tier-2 city expansion underappreciated"],
    LVMH: ["Sephora China expansion accelerates DTC mix", "Leather goods supply constraints easing into holiday", "Selective pricing power intact"],
    PRADA: ["Brand heat improving in accessories", "Sustainability narrative resonating in EU", "Wholesale normalization ongoing"],
    KER: ["Gucci turnaround on track", "Mix improving across houses", "Inventory discipline supports margins"],
  });
  const list = bullets[ticker] || bullets.RL;
  const update = (i: number, v: string) => setBullets((prev) => ({ ...prev, [ticker]: prev[ticker].map((x, idx) => (idx === i ? v : x)) }));
  return (
    <ul className="list-disc pl-5 text-sm space-y-1">
      {list.map((t, i) => (
        <li key={i}>
          <input value={t} onChange={(e) => update(i, (e.target as HTMLInputElement).value)} className="w-full border rounded-lg px-2 py-1 text-sm" />
        </li>
      ))}
      <div className="text-xs text-gray-500 mt-1">Edit live to show YC how thesis context feeds the agent.</div>
    </ul>
  );
}
