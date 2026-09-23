import { api } from "@/lib/api";

export interface CloudinarySignature {
  folder: string;
  apiKey: string;
  signature: string;
  cloudName: string;
  timestamp: number;
}

// ─── Signature fetch ──────────────────────────────────────────────────────────
// We intentionally do NOT cache the signature between uploads.
//
// Why: Cloudinary signatures are single-use for the Upload Widget and
// time-bound (60 min window). Caching caused "Invalid Signature" errors
// when the user spent time filling in the form between clicks.
//
// The signature endpoint is cheap (~100ms), so fetching fresh on every
// upload click is the correct tradeoff.

const fetchSignature = async (): Promise<CloudinarySignature> => {
  const res = await api<CloudinarySignature>("/cloudinary/signature", {
    method: "POST",
  });

  if (!res?.apiKey || !res?.cloudName || !res?.signature) {
    console.error("[Cloudinary] Unexpected signature response shape:", res);
    throw new Error("Invalid signature response from server.");
  }

  return res;
};

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Optional: call on page mount to pre-warm the signature in the background.
 * Only used to make the *very first* click feel faster — result is discarded,
 * actual uploads always fetch a fresh signature.
 */
export const prefetchCloudinarySignature = (): void => {
  fetchSignature().catch(() => {}); // fire-and-forget, errors are safe to ignore
};

/**
 * Upload a file directly to Cloudinary using a signed upload, returning the
 * CDN URL (secure_url) of the uploaded image.
 */
export const uploadImageToCloudinary = async (file: File): Promise<string> => {
  // Always fetch a fresh signature — never reuse a cached one
  const { apiKey, cloudName, folder, signature, timestamp } = await fetchSignature();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  if (folder) formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const err = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      err?.error?.message ?? `Cloudinary upload failed (${response.status})`
    );
  }

  const data = (await response.json()) as { secure_url: string };
  return data.secure_url;
};