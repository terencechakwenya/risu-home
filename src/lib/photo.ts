import imageCompression from "browser-image-compression";

// Compress a captured photo to a small JPEG before it's stored offline and
// uploaded to Storage. Keeps the receipt legible for Hope without bloating
// IndexedDB or the upload.
export async function compressPhoto(file: File): Promise<Blob> {
  return imageCompression(file, {
    maxWidthOrHeight: 1280,
    maxSizeMB: 0.5,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.7,
  });
}
