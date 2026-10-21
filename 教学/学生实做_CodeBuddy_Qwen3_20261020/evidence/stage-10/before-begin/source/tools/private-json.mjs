import { readFileSync } from 'node:fs';

// Windows PowerShell 5.1 may write UTF-8 with a BOM. Keep secrets out of parse errors.
export function readPrivateJson(file) {
  try {
    let bytes = readFileSync(file);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    // Do not attach the original error: JSON.parse may quote a password near the bad token.
    throw new Error('Private JSON configuration unavailable or invalid; save one UTF-8 JSON object (optional UTF-8 BOM). Contents withheld.');
  }
}
