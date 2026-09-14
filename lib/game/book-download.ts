/** Printable ASCII digits are the raw book: no display line breaks or BOM. */
export function rawBookBytes(digits: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(digits, digit => digit + 32);
}

export async function bookDownloadName(bytes: Uint8Array<ArrayBuffer>, bookmarkName?: string) {
  if (bookmarkName) {
    // Preserve the saved title while removing filesystem path/control characters.
    // Control characters cannot be used in a portable download filename.
    // eslint-disable-next-line no-control-regex
    const safe = bookmarkName.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/g, '');
    return `${safe || 'book'}.txt`;
  }
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return `${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}.txt`;
}
