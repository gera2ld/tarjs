import { TarFileType } from './constants';
import { ITarWriteItem, ITarWriteOptions } from './types';
import { getArrayBuffer, utf8Encode } from './util';

export class TarWriter {
  #fileData: ITarWriteItem[];

  constructor() {
    this.#fileData = [];
  }

  addFile(
    name: string,
    file: string | ArrayBuffer | Uint8Array | Blob,
    opts?: Partial<ITarWriteOptions>,
  ) {
    const data = getArrayBuffer(file);
    const size = (data as ArrayBuffer).byteLength ?? (file as Blob).size;
    const item: ITarWriteItem = {
      name,
      type: TarFileType.File,
      data,
      size,
      opts,
    };
    this.#fileData.push(item);
  }

  addFolder(name: string, opts?: Partial<ITarWriteOptions>) {
    this.#fileData.push({
      name,
      type: TarFileType.Dir,
      data: null,
      size: 0,
      opts,
    });
  }

  async write() {
    const buffer = createBuffer(this.#fileData);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const item of this.#fileData) {
      // write header
      writeFileName(buffer, item.name, offset);
      writeFileType(buffer, item.type, offset);
      writeFileSize(buffer, item.size, offset);
      fillHeader(buffer, offset, item.opts, item.type);
      writeChecksum(buffer, offset);

      // write data
      const itemBuffer = await item.data;
      if (itemBuffer) {
        const data = new Uint8Array(itemBuffer);
        view.set(data, offset + 512);
      }
      offset += 512 + 512 * Math.floor((item.size + 511) / 512);
    }
    return new Blob([buffer], { type: 'application/x-tar' });
  }
}

export function createBuffer(fileData: ITarWriteItem[]) {
  const dataSize = fileData.reduce(
    (prev, item) => prev + 512 + 512 * Math.floor((item.size + 511) / 512),
    0,
  );
  const bufSize = 10240 * Math.floor((dataSize + 10240 - 1) / 10240);
  return new ArrayBuffer(bufSize);
}

function writeString(
  buffer: ArrayBuffer,
  str: string,
  offset: number,
  size: number,
) {
  const bytes = utf8Encode(str);
  const view = new Uint8Array(buffer, offset, size);
  for (let i = 0; i < size; i += 1) {
    view[i] = i < bytes.length ? bytes[i] : 0;
  }
}

function writeFileName(buffer: ArrayBuffer, name: string, offset: number) {
  // offset: 0
  writeString(buffer, name, offset, 100);
}

function writeFileType(buffer: ArrayBuffer, type: TarFileType, offset: number) {
  // offset: 156
  const typeView = new Uint8Array(buffer, offset + 156, 1);
  typeView[0] = type;
}

function writeFileSize(buffer: ArrayBuffer, size: number, offset: number) {
  // offset: 124
  const sizeStr = size.toString(8).padStart(11, '0');
  writeString(buffer, sizeStr, offset + 124, 12);
}

function writeFileMode(buffer: ArrayBuffer, mode: number, offset: number) {
  // offset: 100
  writeString(buffer, mode.toString(8).padStart(7, '0'), offset + 100, 8);
}

function writeFileUid(buffer: ArrayBuffer, uid: number, offset: number) {
  // offset: 108
  writeString(buffer, uid.toString(8).padStart(7, '0'), offset + 108, 8);
}

function writeFileGid(buffer: ArrayBuffer, gid: number, offset: number) {
  // offset: 116
  writeString(buffer, gid.toString(8).padStart(7, '0'), offset + 116, 8);
}

function writeFileMtime(buffer: ArrayBuffer, mtime: number, offset: number) {
  // offset: 136
  writeString(buffer, mtime.toString(8).padStart(11, '0'), offset + 136, 12);
}

function writeFileUser(buffer: ArrayBuffer, user: string, offset: number) {
  // offset: 265
  writeString(buffer, user, offset + 265, 32);
}

function writeFileGroup(buffer: ArrayBuffer, group: string, offset: number) {
  // offset: 297
  writeString(buffer, group, offset + 297, 32);
}

function writeChecksum(buffer: ArrayBuffer, offset: number) {
  // add up header bytes
  const header = new Uint8Array(buffer, offset, 512);
  let chksum = 0;
  for (let i = 0; i < 512; i += 1) {
    chksum += header[i];
  }
  writeString(buffer, chksum.toString(8).padEnd(8, ' '), offset + 148, 8);
}

function fillHeader(
  buffer: ArrayBuffer,
  offset: number,
  opts: Partial<ITarWriteOptions> | undefined,
  fileType: TarFileType,
) {
  const { uid, gid, mode, mtime, user, group } = {
    uid: 1000,
    gid: 1000,
    mode: fileType === TarFileType.File ? 0o664 : 0o775,
    mtime: ~~(Date.now() / 1000),
    user: 'gera2ld',
    group: 'tarjs',
    ...opts,
  };

  writeFileMode(buffer, mode, offset);
  writeFileUid(buffer, uid, offset);
  writeFileGid(buffer, gid, offset);
  writeFileMtime(buffer, mtime, offset);

  writeString(buffer, 'ustar', offset + 257, 6); // magic string
  writeString(buffer, '00', offset + 263, 2); // magic version

  writeFileUser(buffer, user, offset);
  writeFileGroup(buffer, group, offset);
}
