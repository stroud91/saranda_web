// Photos uploaded for listings: address helpers and a pre-upload resize.
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_MB = 10;
export const MAX_PHOTOS = 12;

const OURS = /^\/media\/u\/[a-f0-9]{32}\.jpg$/;

/** The small version of an uploaded photo (cards and lists); other addresses are returned unchanged. */
export const thumb = (url) => (OURS.test(url || "") ? url.replace(/\.jpg$/, "_s.jpg") : url);

/**
 * Make a photo smaller before it is sent. Phone photos are 3–10 MB; this turns
 * them into a few hundred KB, so uploads work on mobile data. It also means the
 * location stored inside the file never leaves the device. If the browser can't
 * do it, the original is sent and the server does the same work.
 */
export async function shrink(file, side = 2400) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // see-through areas of a PNG become white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.88));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
