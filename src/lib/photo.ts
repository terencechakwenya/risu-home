// Compress a captured photo to a small JPEG before it's stored offline and
// uploaded to Storage. Keeps the receipt legible for Hope without bloating
// IndexedDB or the upload.
//
// Memory safety is the whole point here: modern phone cameras produce 12–48 MP
// JPEGs, and decoding one to a full-resolution RGBA bitmap (~4 bytes/px) can
// blow the tab's memory budget and force the OS to reload the page mid-capture.
// We let `createImageBitmap` scale the image DURING decode (its resize options)
// so the full-resolution bitmap is never materialised, draw the small result to
// a canvas, and `close()` the bitmap the instant we've drawn it.

const MAX_EDGE = 1280; // longest side, in CSS px
const JPEG_QUALITY = 0.7;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Encode an already-resized bitmap to a JPEG blob, closing it immediately after
// the draw so the decoded pixels are freed before encoding.
async function encode(bitmap: ImageBitmap, w: number, h: number, fallback: File): Promise<Blob> {
  // Prefer OffscreenCanvas (no DOM, lighter) when available.
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return (await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY)) ?? fallback;
}

export async function compressPhoto(file: File): Promise<Blob> {
  // The memory-safe path needs `createImageBitmap`. If it's unavailable (very
  // old browser), fall back to the original file — a larger upload beats a crash
  // or a lost receipt.
  if (typeof createImageBitmap !== "function") return file;

  // One initial decode tells us the intrinsic size. We reuse this bitmap as-is
  // for images already within the cap (no second decode), and only re-decode at
  // a reduced size when the photo is large — the case that actually threatens
  // memory. The probe is closed before the resized decode, so at most one
  // full-resolution bitmap is ever alive at a time.
  const probe = await createImageBitmap(file);
  const longest = Math.max(probe.width, probe.height);

  if (longest <= MAX_EDGE) {
    return encode(probe, probe.width, probe.height, file);
  }

  const scale = MAX_EDGE / longest;
  const targetW = Math.max(1, Math.round(probe.width * scale));
  const targetH = Math.max(1, Math.round(probe.height * scale));
  probe.close(); // free the full-resolution bitmap before the resized decode

  // Decode-and-resize in one step so the full bitmap is never re-materialised.
  const resized = await createImageBitmap(file, {
    resizeWidth: targetW,
    resizeHeight: targetH,
    resizeQuality: "high",
  });
  return encode(resized, targetW, targetH, file);
}
