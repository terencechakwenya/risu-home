"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Check, ImagePlus, X, Loader2, Undo2 } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { saveCapture, undoCapture } from "@/lib/db/receipts";
import { runPush } from "@/lib/sync";
import { compressPhoto } from "@/lib/photo";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";
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

// Cap how long photo compression may run. A low-memory phone can kill or stall
// the compression web worker so its promise never settles; without this bound
// the save would hang forever and leave the Save button stuck disabled.
const PHOTO_COMPRESS_TIMEOUT_MS = 15_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Prepare the optional receipt photo without ever blocking the save. On any
// failure or timeout, fall back to the original file (storing it skips the
// memory-heavy canvas decode); the worst case is simply no photo. Never rejects.
async function preparePhoto(file: File | null): Promise<Blob | null> {
  if (!file) return null;
  try {
    return await withTimeout(compressPhoto(file), PHOTO_COMPRESS_TIMEOUT_MS);
  } catch {
    return file;
  }
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

  // Recover an in-progress entry left behind by a reload (e.g. the tab was
  // killed mid photo-capture on a low-memory phone). Done in a mount effect, not
  // a lazy initial value, so the server and the first client render agree on an
  // empty form and hydration stays clean; the restore then runs once on the
  // client. This is a one-time read from an external store (localStorage), which
  // is the intended exception to the no-setState-in-effect rule.
  useEffect(() => {
    const d = loadDraft();
    if (!d) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time draft recovery from localStorage */
    setAmount(d.amount);
    setCat(d.cat);
    setNote(d.note);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist on every change. Writing from the field handlers (below) keeps the
  // three values merged and correct without an effect that could race the
  // restore above and clobber it with empty initial state.
  function persistDraft(next: Partial<{ amount: string; cat: string | null; note: string }>) {
    saveDraft({ amount, cat, note, ...next });
  }

  const photoPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );

  // Revoke the preview's object URL when the photo changes or the screen
  // unmounts. Without this, each capture leaks a URL that pins its (multi-MB)
  // blob in memory — death by a thousand cuts on a low-RAM phone.
  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  // Enable as soon as there's a positive amount and an envelope. Photo is
  // optional, and we deliberately don't gate on `member`: a low-memory event
  // can transiently wipe the Dexie-backed live query, and we don't want that to
  // leave the button stuck disabled. `onSave` still guards member before writing.
  const canSave = parseFloat(amount) > 0 && !!cat && !saving;

  function reset() {
    setAmount("");
    setCat(null);
    setNote("");
    setPhotoFile(null);
    setSaved(null);
    clearDraft();
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
    if (!(amt > 0) || !cat) return;
    setSaving(true);
    try {
      // `member` is normally hydrated, but a low-memory event can transiently
      // empty the live query. Fall back to a direct read before giving up.
      const activeMember = member ?? (await db.members.toArray())[0];
      if (!activeMember) return;

      const isPearl = activeMember.role === "pearl";
      // First-ever receipt: no server history and nothing logged on this device yet.
      const firstEver = isPearl && !pearlHadReceipts && (await db.receipts.count()) === 0;

      // The photo is optional and must NEVER block the save. Compression decodes
      // the image on a canvas/web-worker — the memory-heavy step a low-memory
      // phone can hang or kill — so it's bounded by a timeout and falls back to
      // the original file. preparePhoto never rejects.
      const photoBlob = await preparePhoto(photoFile);

      const fields = {
        household_id: activeMember.household_id,
        envelope_id: cat,
        amount: amt,
        note,
        logged_by: activeMember.role,
      };
      // If persisting the photo blob fails (e.g. IndexedDB under memory pressure),
      // save the receipt without it rather than losing the entry.
      let receipt: Receipt;
      try {
        receipt = await saveCapture({ ...fields, photoBlob });
      } catch (err) {
        if (!photoBlob) throw err;
        console.warn("Saving with photo failed; retrying without it", err);
        receipt = await saveCapture({ ...fields, photoBlob: null });
      }
      lastSaved.current = receipt;
      // The entry is safely in Dexie now — drop the recovery draft so a later
      // reload doesn't resurrect an already-saved receipt.
      clearDraft();
      // Fire-and-forget flush; no-ops when offline, retries on reconnect.
      void runPush();

      // Release the original (multi-MB) camera File now that the compressed
      // blob is safely in Dexie — don't hold it through the success screen.
      setPhotoFile(null);

      setSaved({
        envelope: envelopes.find((e) => e.id === cat)?.name ?? "",
        playful: isPearl,
        firstEver,
        cheer: savedCheer(),
      });

      // Reward good behaviour — never blocks the save. Pearl only. Deferred to
      // the next frame so the success screen (and the freeing of the form's
      // inputs + photo preview) paints before the confetti canvas allocates,
      // keeping peak memory lower on low-RAM phones.
      if (isPearl) {
        requestAnimationFrame(() => celebrate({ particles: firstEver ? 150 : 90 }));
      }
    } catch (err) {
      // Keep the entered amount/envelope so the user can retry; the finally
      // re-enables the button so the form is never left stuck.
      console.error("Failed to save receipt", err);
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
            onChange={(e) => {
              setAmount(e.target.value);
              persistDraft({ amount: e.target.value });
            }}
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
                  onClick={() => {
                    setCat(e.id);
                    persistDraft({ cat: e.id });
                  }}
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
            onChange={(e) => {
              setNote(e.target.value);
              persistDraft({ note: e.target.value });
            }}
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
