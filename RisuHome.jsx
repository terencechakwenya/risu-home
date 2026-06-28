import React, { useState, useEffect, useCallback } from "react";
import {
  Home, Camera, FileText, Check, Settings, Download,
  Wallet, School, RefreshCw, ShoppingBag, ImagePlus, X, Plus, Trash2,
} from "lucide-react";

const NAVY = "#16365C";
const RED = "#ED1C24";
const MIST = "#EAF0F7";

const STATE_VERSION = 13;

const DEFAULT_STATE = {
  version: STATE_VERSION,
  month: "June 2026",
  buffer: 15999,
  envelopes: [
    { id: "groc", name: "Groceries", budget: 3200, spent: 0, account: "FNB", hybrid: true, base: 2000, weeklyRate: 400, weeks: 3 },
    { id: "lunch", name: "Kids lunch", budget: 1800, spent: 0, account: "Stanbic", weekly: true, weeklyRate: 450, weeks: 4 },
    { id: "toil", name: "Toiletries", budget: 600, spent: 0, account: "Stanbic" },
    { id: "fuel", name: "Kids pick-up fuel", budget: 1600, spent: 0, account: "FNB", weekly: true, weeklyRate: 400, weeks: 4 },
    { id: "trans", name: "Wife transport", budget: 1600, spent: 0, account: "Stanbic", weekly: true, weeklyRate: 400, weeks: 4 },
  ],
  fixed: [
    { name: "Mom rent (net)", amount: 1150 },
    { name: "Madressa", amount: 850 },
  ],
  receipts: [],
};

function guidanceText(e) {
  if (e.hybrid) return `P${e.base} month-end + P${e.weeklyRate}/wk x ${e.weeks}`;
  if (e.weekly) return `P${e.weeklyRate} each week · ${e.weeks} ${e.weeks === 1 ? "week" : "weeks"}`;
  return null;
}

const fmt = (n) => "P " + Math.round(n).toLocaleString();

function barColor(ratio) {
  if (ratio >= 0.9) return "#E24B4A";
  if (ratio >= 0.7) return "#BA7517";
  return "#639922";
}

// Downscale a captured photo to a small JPEG thumbnail (data URL) so it
// persists in local storage. Full-resolution photos go to Supabase Storage
// in the production build.
function fileToThumb(file, max = 360) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function RisuHome() {
  const [state, setState] = useState(null);
  const [role, setRole] = useState("Pearl");
  const [tab, setTab] = useState("home");

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("household:state");
        if (!r) { setState(DEFAULT_STATE); return; }
        const stored = JSON.parse(r.value);
        if (stored.version === STATE_VERSION) { setState(stored); return; }
        const migrated = {
          ...DEFAULT_STATE,
          month: stored.month || DEFAULT_STATE.month,
          buffer: stored.buffer ?? DEFAULT_STATE.buffer,
          receipts: stored.receipts || [],
          envelopes: DEFAULT_STATE.envelopes.map((e) => {
            const old = (stored.envelopes || []).find((o) => o.id === e.id);
            return { ...e, spent: old ? old.spent : 0 };
          }),
        };
        setState(migrated);
        await window.storage.set("household:state", JSON.stringify(migrated));
      } catch {
        setState(DEFAULT_STATE);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setState(next);
    try {
      await window.storage.set("household:state", JSON.stringify(next));
    } catch {
      /* in-session only if storage unavailable */
    }
  }, []);

  if (!state) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm">
        Loading your household…
      </div>
    );
  }

  const totalBudget = state.envelopes.reduce((a, e) => a + e.budget, 0);
  const totalSpent = state.envelopes.reduce((a, e) => a + e.spent, 0);

  return (
    <div
      className="mx-auto max-w-md min-h-screen flex flex-col"
      style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#F4F6F9" }}
    >
      <Header role={role} setRole={setRole} month={state.month} />

      <main className="flex-1 px-4 pb-28 pt-4">
        {tab === "home" && (
          <HomeTab state={state} role={role} totalBudget={totalBudget} totalSpent={totalSpent} />
        )}
        {tab === "add" && (
          <AddTab state={state} persist={persist} role={role} goHome={() => setTab("home")} />
        )}
        {tab === "report" && (
          <ReportTab state={state} totalBudget={totalBudget} totalSpent={totalSpent} />
        )}
        {tab === "manage" && role === "Terence" && (
          <ManageTab state={state} persist={persist} />
        )}
      </main>

      <TabBar tab={tab} setTab={setTab} role={role} />
    </div>
  );
}

function Header({ role, setRole, month }) {
  const roles = ["Pearl", "Terence"];
  return (
    <header style={{ background: NAVY }} className="px-4 pt-5 pb-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-wide" style={{ color: "#9FB4CE" }}>
            {role === "Pearl" ? "Pearl's budget" : "Admin view · you + Pearl"}
          </div>
          <div className="text-lg font-medium">{month}</div>
        </div>
        <div className="flex gap-1 rounded-full p-0.5" style={{ background: "rgba(255,255,255,0.12)" }}>
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="px-2.5 py-1 rounded-full text-[12px] transition"
              style={
                role === r
                  ? { background: RED, color: "#fff" }
                  : { color: MIST }
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function EnvelopeList({ envelopes }) {
  return (
    <div className="space-y-3">
      {envelopes.map((e) => {
        const ratio = e.budget ? e.spent / e.budget : 0;
        const over = e.spent > e.budget;
        const g = guidanceText(e);
        return (
          <div key={e.id} className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="flex justify-between items-baseline text-[13px]">
              <span className="text-slate-700">{e.name}</span>
              <span style={{ color: over ? "#E24B4A" : "#64748b" }}>
                {fmt(e.spent)} / {fmt(e.budget)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mb-1.5">{g || "\u00A0"}</div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: Math.min(100, ratio * 100) + "%", background: barColor(ratio) }}
              />
            </div>
            {over && (
              <div className="text-[11px] mt-1" style={{ color: "#E24B4A" }}>
                Over by {fmt(e.spent - e.budget)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AccountGroups({ envelopes }) {
  const groups = [
    { id: "FNB", label: "FNB · household" },
    { id: "Stanbic", label: "Stanbic · personal" },
  ];
  return (
    <div className="space-y-4">
      {groups.map((grp) => {
        const es = envelopes.filter((e) => (e.account || "FNB") === grp.id);
        const subtotal = es.reduce((a, e) => a + e.budget, 0);
        if (grp.id === "Stanbic" && es.length === 0) {
          return (
            <div key={grp.id}>
              <div className="text-[11px] text-slate-400 mb-1.5">{grp.label}</div>
              <div className="text-[12px] text-slate-400 bg-white rounded-xl border border-slate-100 px-3 py-2">
                Your personal account — kept separate from the household budget.
              </div>
            </div>
          );
        }
        if (es.length === 0) return null;
        return (
          <div key={grp.id}>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
              <span>{grp.label}</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <EnvelopeList envelopes={es} />
          </div>
        );
      })}
    </div>
  );
}

function HomeTab({ state, role, totalBudget, totalSpent }) {
  const left = totalBudget - totalSpent;

  if (role === "Pearl") {
    return (
      <div>
        <div style={{ background: NAVY }} className="rounded-2xl p-4 text-white mb-4">
          <div className="text-[12px]" style={{ color: "#9FB4CE" }}>
            Your household budget · FNB account
          </div>
          <div className="text-3xl font-semibold mt-1">{fmt(left)}</div>
          <div className="text-[12px]" style={{ color: "#9FB4CE" }}>
            left of {fmt(totalBudget)} · {fmt(totalSpent)} spent
          </div>
        </div>
        <AccountGroups envelopes={state.envelopes} />
      </div>
    );
  }

  const fixedTotal = state.fixed.reduce((a, f) => a + f.amount, 0);

  return (
    <div>
      <div style={{ background: NAVY }} className="rounded-2xl p-4 text-white mb-3">
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#9FB4CE" }}>
          <ShoppingBag size={13} /> Pearl's running budget
        </div>
        <div className="text-3xl font-semibold mt-1">{fmt(left)}</div>
        <div className="text-[12px]" style={{ color: "#9FB4CE" }}>
          left of {fmt(totalBudget)} · {fmt(totalSpent)} spent
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
        <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
          <Wallet size={13} /> Your fixed layer
        </div>
        <div className="text-2xl font-semibold mt-1 text-slate-800">{fmt(fixedTotal)}</div>
        <div className="text-[12px] text-slate-400">
          scheduled · plus school buffer {fmt(state.buffer)}
        </div>
      </div>

      <FixedLayer state={state} />

      <div className="mt-5">
        <div className="text-[12px] text-slate-500 mb-2 flex items-center gap-1.5">
          <ShoppingBag size={14} /> Pearl's household budget
        </div>
        <AccountGroups envelopes={state.envelopes} />
      </div>
    </div>
  );
}

function FixedLayer({ state }) {
  return (
    <div className="mt-1">
      <div className="text-[12px] text-slate-400 mb-2 flex items-center gap-1.5">
        Scheduled items
      </div>
      <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
        {state.fixed.map((f, i) => (
          <div key={i} className="flex justify-between px-3 py-2 text-[13px]">
            <span className="text-slate-600">{f.name}</span>
            <span className="text-slate-800">{fmt(f.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between px-3 py-2 text-[13px]" style={{ background: MIST }}>
          <span className="flex items-center gap-1.5 text-slate-700">
            <School size={14} /> School buffer
          </span>
          <span style={{ color: "#185FA5" }}>{fmt(state.buffer)}</span>
        </div>
      </div>
    </div>
  );
}

function AddTab({ state, persist, role, goHome }) {
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [saved, setSaved] = useState(false);
  const fileRef = React.useRef(null);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const thumb = await fileToThumb(file);
    if (thumb) setPhoto(thumb);
  };

  const save = () => {
    const amt = parseFloat(amount);
    if (!amt || !cat) return;
    const next = {
      ...state,
      envelopes: state.envelopes.map((e) =>
        e.id === cat ? { ...e, spent: e.spent + amt } : e
      ),
      receipts: [
        { id: Date.now(), ts: Date.now(), amount: amt, catId: cat, note, by: role, photo },
        ...state.receipts,
      ],
    };
    persist(next);
    setSaved(true);
    setTimeout(() => {
      setAmount(""); setCat(null); setNote(""); setPhoto(null); setSaved(false); goHome();
    }, 900);
  };

  if (saved) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
          style={{ background: "#EAF3DE" }}
        >
          <Check size={30} style={{ color: "#3B6D11" }} />
        </div>
        <div className="text-slate-700 font-medium">Saved</div>
        <div className="text-[12px] text-slate-400">Logged to {state.envelopes.find((e) => e.id === cat)?.name}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-slate-700 font-medium mb-3 flex items-center gap-2">
        <Camera size={18} style={{ color: RED }} /> New receipt
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-4">
        <div>
          <div className="text-[12px] text-slate-500 mb-1.5">Amount (Pula)</div>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="247.50"
            className="w-full text-2xl font-semibold text-slate-800 outline-none border border-slate-200 rounded-lg px-3 py-2 focus:border-slate-400"
          />
        </div>

        <div>
          <div className="text-[12px] text-slate-500 mb-2">Which envelope?</div>
          <div className="flex flex-wrap gap-2">
            {state.envelopes.map((e) => {
              const active = cat === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setCat(e.id)}
                  className="px-3 py-1.5 rounded-full text-[12px] border transition"
                  style={
                    active
                      ? { background: "#EAF3DE", color: "#3B6D11", borderColor: "#639922" }
                      : { background: "#fff", color: "#64748b", borderColor: "#e2e8f0" }
                  }
                >
                  {e.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[12px] text-slate-500 mb-1.5">Shop / note (optional)</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Choppies"
            className="w-full text-[14px] text-slate-700 outline-none border border-slate-200 rounded-lg px-3 py-2 focus:border-slate-400"
          />
        </div>

        <div>
          <div className="text-[12px] text-slate-500 mb-1.5">Receipt photo</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />
          {photo ? (
            <div className="relative inline-block">
              <img src={photo} alt="receipt" className="h-28 rounded-lg border border-slate-200" />
              <button
                onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 shadow"
                aria-label="Remove photo"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current && fileRef.current.click()}
              className="w-full py-3 rounded-lg border border-dashed border-slate-300 text-slate-500 text-[13px] flex items-center justify-center gap-2"
            >
              <ImagePlus size={16} /> Snap or upload receipt
            </button>
          )}
        </div>

        <button
          onClick={save}
          disabled={!amount || !cat}
          className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-40"
          style={{ background: RED }}
        >
          Save <Check size={17} />
        </button>
        <div className="text-center text-[11px] text-slate-400">
          Works offline · full-resolution photos sync in the multi-device version
        </div>
      </div>
    </div>
  );
}

function ReportTab({ state, totalBudget, totalSpent }) {
  const under = totalBudget - totalSpent;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-700 font-medium">{state.month} report</div>
        <button
          onClick={() => window.print()}
          className="text-[12px] text-slate-500 flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5"
        >
          <Download size={14} /> Export for Hope
        </button>
      </div>

      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: under >= 0 ? "#EAF3DE" : "#FCEBEB" }}
      >
        <div className="text-[12px]" style={{ color: under >= 0 ? "#3B6D11" : "#A32D2D" }}>
          Household spent this month
        </div>
        <div className="text-2xl font-semibold" style={{ color: under >= 0 ? "#27500A" : "#791F1F" }}>
          {fmt(totalSpent)} <span className="text-[12px] font-normal">/ {fmt(totalBudget)}</span>
        </div>
        <div className="text-[12px]" style={{ color: under >= 0 ? "#3B6D11" : "#A32D2D" }}>
          {under >= 0 ? `Under budget · ${fmt(under)} saved` : `Over budget by ${fmt(-under)}`}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 mb-4">
        {state.envelopes.map((e) => (
          <div key={e.id} className="flex justify-between px-3 py-2 text-[13px]">
            <span className="text-slate-600">{e.name}</span>
            <span className="text-slate-800">{fmt(e.spent)}</span>
          </div>
        ))}
        <div className="flex justify-between px-3 py-2 text-[13px]" style={{ background: MIST }}>
          <span className="flex items-center gap-1.5 text-slate-700">
            <School size={14} /> School buffer
          </span>
          <span style={{ color: "#185FA5" }}>{fmt(state.buffer)}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3">
        <div className="text-[12px] text-slate-500 mb-1">Receipts logged</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-slate-800">{state.receipts.length}</span>
          <span className="text-[12px] text-slate-400">all categorised</span>
        </div>
        <div className="mt-2 space-y-1 max-h-44 overflow-auto">
          {state.receipts.slice(0, 12).map((r) => {
            const e = state.envelopes.find((x) => x.id === r.catId);
            return (
              <div key={r.id} className="flex justify-between items-center gap-2 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5 min-w-0">
                  {r.photo && (
                    <img src={r.photo} alt="" className="h-7 w-7 rounded object-cover border border-slate-200 shrink-0" />
                  )}
                  <span className="truncate">
                    {e?.name}{r.note ? ` · ${r.note}` : ""} <span className="text-slate-300">({r.by})</span>
                  </span>
                </span>
                <span className="shrink-0">{fmt(r.amount)}</span>
              </div>
            );
          })}
          {state.receipts.length === 0 && (
            <div className="text-[12px] text-slate-400 py-2">
              No receipts yet — snap your first from the camera tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManageTab({ state, persist }) {
  const [newName, setNewName] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const [newAcct, setNewAcct] = useState("FNB");

  const setBudget = (id, v) =>
    persist({
      ...state,
      envelopes: state.envelopes.map((e) =>
        e.id === id ? { ...e, budget: parseFloat(v) || 0 } : e
      ),
    });

  const setWeeks = (id, w) =>
    persist({
      ...state,
      envelopes: state.envelopes.map((e) => {
        if (e.id !== id) return e;
        const weeks = Math.max(0, parseInt(w) || 0);
        return { ...e, weeks, budget: (e.base || 0) + e.weeklyRate * weeks };
      }),
    });

  const setBase = (id, v) =>
    persist({
      ...state,
      envelopes: state.envelopes.map((e) => {
        if (e.id !== id) return e;
        const base = parseFloat(v) || 0;
        return { ...e, base, budget: base + e.weeklyRate * e.weeks };
      }),
    });

  const setAccount = (id) =>
    persist({
      ...state,
      envelopes: state.envelopes.map((e) =>
        e.id === id
          ? { ...e, account: (e.account || "FNB") === "FNB" ? "Stanbic" : "FNB" }
          : e
      ),
    });

  const removeEnvelope = (id) =>
    persist({ ...state, envelopes: state.envelopes.filter((e) => e.id !== id) });

  const addEnvelope = () => {
    if (!newName.trim()) return;
    persist({
      ...state,
      envelopes: [
        ...state.envelopes,
        { id: `env_${Date.now()}`, name: newName.trim(), budget: parseFloat(newAmt) || 0, spent: 0, account: newAcct },
      ],
    });
    setNewName(""); setNewAmt(""); setNewAcct("FNB");
  };

  const newMonth = () => {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const [mName, yr] = state.month.split(" ");
    let mi = months.indexOf(mName) + 1; let y = parseInt(yr);
    if (mi > 11) { mi = 0; y += 1; }
    persist({
      ...state,
      month: `${months[mi]} ${y}`,
      buffer: state.buffer + 5333,
      envelopes: state.envelopes.map((e) => ({ ...e, spent: 0 })),
      receipts: [],
    });
  };

  const payTerm = () =>
    persist({ ...state, buffer: Math.max(0, state.buffer - 16000) });

  return (
    <div className="space-y-4">
      <div className="text-slate-700 font-medium flex items-center gap-2">
        <Settings size={18} /> Manage
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3">
        <div className="text-[12px] text-slate-500 mb-2">Envelope budgets</div>
        <div className="space-y-3">
          {state.envelopes.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] text-slate-600">{e.name}</div>
                <div className="text-[11px] text-slate-400">{guidanceText(e) || fmt(e.budget)}</div>
                <button
                  onClick={() => setAccount(e.id)}
                  className="mt-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-500"
                >
                  {(e.account || "FNB") === "FNB" ? "FNB · household" : "Stanbic · personal"}
                </button>
              </div>
              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                {e.hybrid ? (
                  <>
                    <input
                      type="number" value={e.base} onChange={(ev) => setBase(e.id, ev.target.value)}
                      title="Month-end base"
                      className="w-16 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
                    />
                    <span className="text-[11px] text-slate-400">+wks</span>
                    <input
                      type="number" min="0" max="6" value={e.weeks} onChange={(ev) => setWeeks(e.id, ev.target.value)}
                      title="Weeks"
                      className="w-12 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
                    />
                  </>
                ) : e.weekly ? (
                  <input
                    type="number" min="0" max="6" value={e.weeks} onChange={(ev) => setWeeks(e.id, ev.target.value)}
                    title="Weeks commuting"
                    className="w-16 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
                  />
                ) : (
                  <input
                    type="number" value={e.budget} onChange={(ev) => setBudget(e.id, ev.target.value)}
                    className="w-24 text-[13px] text-right text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
                  />
                )}
                <button
                  onClick={() => removeEnvelope(e.id)}
                  className="ml-1 text-slate-300"
                  aria-label="Remove line"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[12px] text-slate-500 mb-2">Add a budget line</div>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              placeholder="Name"
              className="flex-1 min-w-0 text-[13px] text-slate-700 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
            />
            <input
              type="number"
              value={newAmt}
              onChange={(ev) => setNewAmt(ev.target.value)}
              placeholder="P"
              className="w-16 text-[13px] text-right text-slate-700 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-slate-400"
            />
            <button
              onClick={() => setNewAcct(newAcct === "FNB" ? "Stanbic" : "FNB")}
              className="text-[10px] px-1.5 py-1 rounded border border-slate-200 text-slate-500 shrink-0"
            >
              {newAcct}
            </button>
            <button
              onClick={addEnvelope}
              disabled={!newName.trim()}
              className="rounded-lg p-1.5 text-white shrink-0 disabled:opacity-40"
              style={{ background: NAVY }}
              aria-label="Add line"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 mt-3">
          Weekly lines show a per-week amount · tap an account chip to move a line · trash to remove.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
        <div className="text-[12px] text-slate-500">School buffer · {fmt(state.buffer)}</div>
        <button
          onClick={payTerm}
          className="w-full py-2 rounded-lg text-[13px] border border-slate-200 text-slate-600 flex items-center justify-center gap-1.5"
        >
          <School size={14} /> Record term fees paid (−P 16,000)
        </button>
      </div>

      <button
        onClick={newMonth}
        className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
        style={{ background: NAVY }}
      >
        <RefreshCw size={16} /> Start new month (+P 5,333 buffer)
      </button>
      <div className="text-[11px] text-slate-400 text-center">
        Resets spending to zero, accrues the school buffer, archives receipts.
      </div>
    </div>
  );
}

function TabBar({ tab, setTab, role }) {
  const items = [
    { id: "home", label: "Home", icon: Home },
    { id: "add", label: "Add", icon: Camera },
    { id: "report", label: "Report", icon: FileText },
  ];
  if (role === "Terence") items.push({ id: "manage", label: "Manage", icon: Settings });

  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white border-t border-slate-100 flex">
      {items.map((it) => {
        const active = tab === it.id;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5"
            style={{ color: active ? NAVY : "#94a3b8" }}
          >
            <Icon size={20} />
            <span className="text-[10px]">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
