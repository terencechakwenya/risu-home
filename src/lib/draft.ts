// In-progress "Add receipt" entry, persisted to localStorage on every keystroke
// so a tab reload — which a low-memory phone can trigger while capturing a photo
// — never loses what the user already typed. Only the lightweight text fields
// are kept; the photo blob is intentionally excluded (it's the memory risk we're
// avoiding, and it's optional). Restored on mount; cleared on save/reset.

const DRAFT_KEY = "risu:add-draft";

export interface AddDraft {
  amount: string;
  cat: string | null;
  note: string;
}

const EMPTY: AddDraft = { amount: "", cat: null, note: "" };

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

// Persist the draft, or remove it entirely when nothing meaningful is entered
// so a stale empty draft never lingers. Never throws (quota / privacy mode).
export function saveDraft(draft: AddDraft): void {
  if (!hasStorage()) return;
  try {
    if (!draft.amount && !draft.cat && !draft.note.trim()) {
      window.localStorage.removeItem(DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable/full — recovery is best-effort, so just skip.
  }
}

// Load a previously saved draft, or null if there's nothing usable.
export function loadDraft(): AddDraft | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AddDraft>;
    const draft: AddDraft = {
      amount: typeof parsed.amount === "string" ? parsed.amount : "",
      cat: typeof parsed.cat === "string" ? parsed.cat : null,
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
    if (!draft.amount && !draft.cat && !draft.note.trim()) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export { EMPTY as EMPTY_DRAFT };
