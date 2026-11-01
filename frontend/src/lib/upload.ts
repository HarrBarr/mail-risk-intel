export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // mirrors backend MAX_UPLOAD_BYTES
export const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".eml"] as const;
export const ACCEPT_ATTR = [...ACCEPTED_EXTENSIONS, "text/plain", "application/pdf", "message/rfc822"].join(
  ",",
);

/** Returns a user-facing error for a file the server would reject, or null if it looks fine. */
export function validateUpload(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `"${file.name}" isn't supported. Upload a .txt, .pdf or .eml file.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  }
  return null;
}

export function validateText(text: string): string | null {
  if (!text.trim()) return "Paste the email text first.";
  if (text.length > 200_000) return "That's too long. The limit is 200,000 characters.";
  return null;
}
