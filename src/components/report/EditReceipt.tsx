"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { updateCapture, type PhotoAction } from "@/lib/db/receipts";
import { runPush } from "@/lib/sync";
import { preparePhoto } from "@/lib/photo";
import { fmt } from "@/lib/domain/format";
import type { Envelope, Receipt } from "@/lib/domain/types";

// Edit an existing receipt (Terence only — receipts_update is admin in RLS).
// Change amount, envelope and note, and add / replace / remove the photo. The
// write is optimistic + queued through the outbox (updateCapture), so it works
// offline exactly like a capture. The photo goes through the same memory-safe
// preparePhoto path as the Add screen, so editing a photo can't crash a low-RAM
// phone. Rendered as a modal over the report.
export function EditReceipt({
  receipt,
  envelopes,
  currentPhotoUrl,
  onClose,
}: {
  receipt: Receipt;
  envelopes: Envelope[];
  currentPhotoUrl: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(receipt.amount));
  const [cat, setCat] = useState<string>(receipt.envelope_id);
  const [note, setNote] = useState(receipt.note ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hadPhoto = !!(receipt.photo_path || currentPhotoUrl);

  // Object URL for the newly-picked photo, revoked when it changes or the modal
  // closes so a multi-MB blob is never pinned in memory (same discipline as Add).
  const newPreview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    if (!newPreview) return;
    return () => URL.revokeObjectURL(newPreview);
  }, [newPreview]);

  const canSave = parseFloat(amount) > 0 && !!cat && !saving;

  function pickPhoto() {
    fileRef.current?.click();
  }

  async function onSave() {
    const amt = parseFloat(amount);
    if (!(amt > 0) || !cat) return;
    setSaving(true);
    try {
      // "replace" when a new file was chosen, "remove" when the existing one was
      // cleared, otherwise leave the photo alone.
      const photoAction: PhotoAction = photoFile ? "replace" : removed ? "remove" : "keep";
      // Memory-safe: preparePhoto bounds compression with a timeout and falls
      // back to the original file — it never rejects and never blocks the save.
      const photoBlob = photoAction === "replace" ? await preparePhoto(photoFile) : null;

      await updateCapture({
        original: receipt,
        envelope_id: cat,
        amount: amt,
        note,
        photoAction,
        photoBlob,
      });

      // Flush now; when it lands, refresh the server-rendered report so envelope
      // totals reconcile. Offline this no-ops and the outbox retries on reconnect.
      void runPush().then(() => {
        if (typeof navigator === "undefined" || navigator.onLine) router.refresh();
      });

      onClose();
    } catch (err) {
      console.error("Failed to edit receipt", err);
      setSaving(false);
    }
  }

  const showCurrent = hadPhoto && !removed && !photoFile;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Edit receipt"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-auto rounded-2xl bg-white p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-700">Edit receipt</div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div>
          <div className="text-[12px] text-slate-500 mb-1.5">Amount (Pula)</div>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="edit-amount"
            placeholder="0"
            className="w-full text-center text-3xl font-semibold text-slate-800 outline-none border border-slate-200 rounded-xl px-3 py-2.5 focus:border-navy"
          />
        </div>

        <div>
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
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f) {
                setPhotoFile(f);
                setRemoved(false);
              }
            }}
            className="hidden"
          />
          {newPreview ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newPreview} alt="receipt" className="h-28 rounded-lg border border-slate-200" />
              <button
                onClick={() => {
                  setPhotoFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 shadow"
                aria-label="Discard new photo"
              >
                <X size={14} className="text-slate-500" />
              </button>
            </div>
          ) : showCurrent ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPhotoUrl ?? ""}
                alt="receipt"
                className="h-20 w-20 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={pickPhoto}
                  className="text-[12px] text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                >
                  <ImagePlus size={14} /> Replace
                </button>
                <button
                  onClick={() => setRemoved(true)}
                  className="text-[12px] text-red border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                onClick={pickPhoto}
                className="w-full py-3 rounded-lg border border-dashed border-slate-300 text-slate-500 text-[13px] flex items-center justify-center gap-2"
              >
                <ImagePlus size={16} /> {hadPhoto ? "Add a new photo" : "Snap or upload receipt"}
              </button>
              {removed && hadPhoto && (
                <button
                  onClick={() => setRemoved(false)}
                  className="text-[11px] text-slate-400 underline"
                >
                  Keep the existing photo
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onSave}
            disabled={!canSave}
            data-testid="edit-save"
            className="flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-40 bg-navy"
          >
            {saving ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                Save changes <Check size={17} />
              </>
            )}
          </button>
        </div>
        <div className="text-center text-[11px] text-slate-400">
          Works offline · {cat ? fmt(parseFloat(amount) || 0) : "pick an envelope"}
        </div>
      </div>
    </div>
  );
}
