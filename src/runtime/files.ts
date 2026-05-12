/**
 * Read a file's raw bytes as base64 (no `data:...;base64,` prefix).
 * Independent of pdfjs so it can be imported from the main bundle without
 * pulling in the heavy PDF code.
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}
