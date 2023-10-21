const encoder = new TextEncoder();
export const utf8Encode = (input: string) => encoder.encode(input);
const decoder = new TextDecoder();
export const utf8Decode = (input: Uint8Array) => decoder.decode(input);

export function getArrayBuffer(file: string | ArrayBuffer | Uint8Array | Blob) {
  if (typeof file === 'string') return utf8Encode(file).buffer;
  if (file instanceof ArrayBuffer) return file;
  if (ArrayBuffer.isView(file)) return new Uint8Array(file).buffer;
  return file.arrayBuffer();
}
