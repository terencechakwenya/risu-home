"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Check, ImagePlus, X, Loader2, Undo2 } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { saveCapture, undoCapture } from "@/lib/db/receipts";
import { runPush } from "@/lib/sync";
import { compressPhoto } from "@/lib/photo";
import { celebrate } from "@/lib/confetti";
import { savedCheer, FIRST_RECEIPT_TITLE, FIRST_RECEIPT_BODY } from "@/lib/domain/cheer";
import { fmt } from "@/lib/domain/format";
import type { Envelope, Member, Receipt } from "@/lib/domain/types";

interface SavedState {
  envelope: string;
  playful: boolean; // Pearl gets the celebration; Terence stays plain
  firstEver: boolean;
  cheer: string;
}

// Add receipt: amount → envelope chip → photo → note → save. The save is fully
// local (Dexie + outbox) so it works with no connection; a flush is kicked off
// when online. Envelopes + member come from the offline cache, falling back to
// the server-rendered initial props on a cold load.
export function AddReceipt({
  initialEnvelopes,
  initialMember,
  pearlHadReceipts = true,
}: {
  initialEnvelopes: Envelope[];
  initialMember: Member | null;
  pearlHadReceipts?: boolean;
}) {
  const cachedEnvelopes = useLiveQuery(() => db.envelopes.orderBy("sort").toArray(), []);
  const cachedMembers = useLiveQuery(() => db.members.toArray(), []);

  const envelopes = cachedEnvelopes && cachedEnvelopes.length ? cachedEnvelopes : initialEnvelopes;
  const member = cachedMembers && cachedMembers.length ? cachedMembers[0] : initialMember;

  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const lastSaved = useRef<Receipt | null>(null);

  // Auto-focus the amount field so Pearl can type the moment the screen opens.
  useEffect(() => {
    if (!saved) amountRef.current?.focus();
  }, [saved]);

  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );

  const canSave = !!parseFloat(amount) && !!cat && !!member && !saving;

  function reset() {
    setAmount("");
    setCat(null);
    setNote("");
    setPhotoFile(null);
    setSaved(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onUndo() {
    const receipt = lastSaved.current;
    lastSaved.current = null;
    reset();
    if (receipt) await undoCapture(receipt);
  }

  async function onSave() {
    const amt = parseFloat(amount);
    if (!amt || !cat || !member) return;
    setSaving(true);
    try {
      const isPearl = member.role === "pearl";
      // First-ever receipt: no server history and nothing logged on this device yet.
      const firstEver = isPearl && !pearlHadReceipts && (await db.receipts.count()) === 0;

      const photoBlob = photoFile ? await compressPhoto(photoFile) : null;
      const receipt = await saveCapture({
        household_id: member.household_id,
        envelope_id: cat,
        amount: amt,
        note,
        logged_by: member.role,
        photoBlob,
      });
      lastSaved.current = receipt;
      // Fire-and-forget flush; no-ops when offline, retries on reconnect.
      void runPush();

      // Reward good behaviour — never blocks the save. Pearl only.
      if (isPearl) celebrate({ particles: firstEver ? 150 : 90 });

      setSaved({
        envelope: envelopes.find((e) => e.id === cat)?.name ?? "",
        playful: isPearl,
        firstEver,
        cheer: savedCheer(),
      });
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;

    // Pearl — celebratory.
    if (saved.playful) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-2">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-4 risu-pop"
            style={{ background: "#EAF3DE" }}
          >
            <Check size={40} style={{ color: "#3B6D11" }} />
          </div>
          <div className="text-xl font-semibold text-slate-800">
            {saved.firstEver ? FIRST_RECEIPT_TITLE : saved.cheer}
          </div>
          <div className="text-[13px] text-slate-500 mt-1 max-w-[17rem]">
            {saved.firstEver ? FIRST_RECEIPT_BODY : `Logged to ${saved.envelope}.`}
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            {offline ? "Saved — it'll sync when you're back online." : "Saved & syncing ✨"}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl text-white text-[13px] font-medium bg-navy"
            >
              Add another
            </button>
            <button
              onClick={onUndo}
              className="px-3 py-2.5 rounded-xl text-slate-500 text-[13px] font-medium flex items-center gap-1.5 border border-slate-200"
            >
              <Undo2 size={15} /> Undo
            </button>
          </div>
        </div>
      );
    }

    // Terence — plain.
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
          style={{ background: "#EAF3DE" }}
        >
          <Check size={30} style={{ color: "#3B6D11" }} />
        </div>
        <div className="text-slate-700 font-medium">Saved</div>
        <div className="text-[12px] text-slate-400">Logged to {saved.envelope}</div>
        <div className="text-[12px] text-slate-400 mt-1">
          {offline ? "Queued — it'll sync when you're back online." : "Syncing…"}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl text-white text-[13px] font-medium bg-navy"
          >
            Add another
          </button>
          <button
            onClick={onUndo}
            className="px-3 py-2 rounded-xl text-slate-500 text-[13px] font-medium flex items-center gap-1.5 border border-slate-200"
          >
            <Undo2 size={15} /> Undo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-slate-700 font-medium mb-3 flex items-center gap-2">
        <Camera size={18} className="text-red" /> New receipt
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-4">
        <div data-tour="amount">
          <div className="text-[12px] text-slate-500 mb-1.5">Amount (Pula)</div>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            ref={amountRef}
            autoFocus
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full text-center text-4xl font-semibold text-slate-800 outline-none border border-slate-200 rounded-xl px-3 py-3 focus:border-navy"
          />
        </div>

        <div data-tour="envelope-pick">
          <div className="text-[12px] text-slate-500 mb-2">Which envelope?</div>
          <div className="flex flex-wrap gap-2">
            {envelopes.map((e) => {
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
            {envelopes.length === 0 && (
              <div className="text-[12px] text-slate-400">
                No envelopes cached yet — open the app once while online.
              </div>
            )}
          </div>
        </div>

        <div data-tour="note">
          <div className="text-[12px] text-slate-500 mb-1.5">Shop / note (optional)</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Choppies"
            className="w-full text-[14px] text-slate-700 outline-none border border-slate-200 rounded-lg px-3 py-2 focus:border-slate-400"
          />
        </div>

        <div data-tour="photo">
          <div className="text-[12px] text-slate-500 mb-1.5">Receipt photo</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          {photoPreview ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="receipt" className="h-28 rounded-lg border border-slate-200" />
              <button
                onClick={() => {
                  setPhotoFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 shadow"
                aria-label="Remove photo"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 rounded-lg border border-dashed border-slate-300 text-slate-500 text-[13px] flex items-center justify-center gap-2"
            >
              <ImagePlus size={16} /> Snap or upload receipt
            </button>
          )}
        </div>

        <button
          data-tour="save"
          onClick={onSave}
          disabled={!canSave}
          className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-40 bg-red"
        >
          {saving ? (
            <>
              <Loader2 size={17} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              Save <Check size={17} />
            </>
          )}
        </button>
        <div className="text-center text-[11px] text-slate-400">
          Works offline · {amount && cat ? fmt(parseFloat(amount) || 0) + " ready to log" : "the photo syncs when you're online"}
        </div>
      </div>
    </div>
  );
}
