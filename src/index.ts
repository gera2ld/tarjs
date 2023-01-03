export enum TarFileType {
  File = 48,
  Dir = 53,
}
const encoder = new TextEncoder();
const utf8Encode = (input: string) => encoder.encode(input);
const decoder = new TextDecoder();
const utf8Decode = (input: Uint8Array) => decoder.decode(input);

export interface ITarFileInfo {
  name: string;
  type: TarFileType;
  size: number;
  headerOffset: number;
}

export interface ITarWriteItem {
  name: string;
  type: TarFileType;
  data: ArrayBuffer | Promise<ArrayBuffer> | null;
  size: number;
  opts?: Partial<ITarWriteOptions>;
}

export interface ITarWriteOptions {
  uid: number;
  gid: number;
  mode: number;
  mtime: number;
  user: string;
  group: string;
}

export class TarReader {
  #fileInfo: ITarFileInfo[];
  #buffer: ArrayBuffer;

  constructor() {
    this.reset();
  }

  reset() {
    this.#fileInfo = [];
    this.#buffer = null;
  }

  async readFile(file: Blob) {
    this.reset();
    this.#buffer = await readFileAsArrayBuffer(file);
    this.#readFileInfo();
    return this.#fileInfo;
  }

  #readFileInfo() {
    this.#fileInfo = [];
    let offset = 0;
    let fileSize = 0;
    let fileName = '';
    let fileType: TarFileType;
    while (offset < this.#buffer.byteLength - 512) {
      fileName = this.#readFileName(offset); // file name
      if (!fileName) {
        break;
      }
      fileType = this.#readFileType(offset);
      fileSize = this.#readFileSize(offset);

      this.#fileInfo.push({
        name: fileName,
        type: fileType,
        size: fileSize,
        headerOffset: offset,
      });

      offset += 512 + 512 * Math.floor((fileSize + 511) / 512);
    }
  }

  #readString(offset: number, maxSize: number) {
    let size = 0;
    let view = new Uint8Array(this.#buffer, offset, maxSize);
    while (size < maxSize && view[size]) size += 1;
    view = new Uint8Array(this.#buffer, offset, size);
    return utf8Decode(view);
  }

  #readFileName(offset: number) {
    return this.#readString(offset, 100);
  }

  #readFileType(offset: number) {
    // offset = 156, length = 1
    const type = this.#buffer[offset + 156];
    return type as TarFileType;
  }

  #readFileSize(offset: number) {
    // offset = 124, length = 12
    const view = new Uint8Array(this.#buffer, offset + 124, 12);
    const sizeStr = utf8Decode(view);
    return parseInt(sizeStr, 8);
  }

  #readFileBlob(offset: number, size: number, mimetype: string) {
    const view = new Uint8Array(this.#buffer, offset, size);
    return new Blob([view], { type: mimetype });
  }

  #readTextFile(offset: number, size: number) {
    const view = new Uint8Array(this.#buffer, offset, size);
    return utf8Decode(view);
  }

  getTextFile(filename: string) {
    const item = this.#fileInfo.find((info) => info.name === filename);
    if (item) return this.#readTextFile(item.headerOffset + 512, item.size);
  }

  getFileBlob(filename: string, mimetype: string) {
    const item = this.#fileInfo.find((info) => info.name === filename);
    if (item)
      return this.#readFileBlob(item.headerOffset + 512, item.size, mimetype);
  }
}

export class TarWriter {
  #fileData: ITarWriteItem[];
  #buffer: ArrayBuffer;

  constructor() {
    this.#fileData = [];
  }

  addTextFile(name: string, text: string, opts?: Partial<ITarWriteOptions>) {
    const view = utf8Encode(text);
    const item: ITarWriteItem = {
      name,
      type: TarFileType.File,
      data: view,
      size: view.length,
      opts,
    };
    this.#fileData.push(item);
  }

  addFileArrayBuffer(
    name: string,
    arrayBuffer: ArrayBuffer,
    opts?: Partial<ITarWriteOptions>
  ) {
    const view = new Uint8Array(arrayBuffer);
    const item: ITarWriteItem = {
      name,
      type: TarFileType.File,
      data: view,
      size: view.length,
      opts,
    };
    this.#fileData.push(item);
  }

  addFile(name: string, file: Blob, opts?: Partial<ITarWriteOptions>) {
    const item: ITarWriteItem = {
      name,
      type: TarFileType.File,
      size: file.size,
      data: readFileAsArrayBuffer(file),
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

  #createBuffer() {
    let dataSize = 0;
    this.#fileData.forEach((item) => {
      dataSize += 512 + 512 * Math.floor((item.size + 511) / 512);
    });
    const bufSize = 10240 * Math.floor((dataSize + 10240 - 1) / 10240);
    this.#buffer = new ArrayBuffer(bufSize);
  }

  async write() {
    this.#createBuffer();
    let offset = 0;
    for (const item of this.#fileData) {
      // write header
      this.#writeFileName(item.name, offset);
      this.#writeFileType(item.type, offset);
      this.#writeFileSize(item.size, offset);
      this.#fillHeader(offset, item.opts, item.type);
      this.#writeChecksum(offset);

      // write data
      const data = new Uint8Array(await item.data);
      const view = new Uint8Array(this.#buffer, offset + 512, item.size);
      for (let i = 0; i < item.size; i += 1) {
        view[i] = data[i];
      }
      offset += 512 + 512 * Math.floor((item.size + 511) / 512);
    }
    return new Blob([this.#buffer], { type: 'application/x-tar' });
  }

  #writeString(str: string, offset: number, size: number) {
    const strView = utf8Encode(str);
    const view = new Uint8Array(this.#buffer, offset, size);
    for (let i = 0; i < size; i += 1) {
      view[i] = i < strView.length ? strView[i] : 0;
    }
  }

  #writeFileName(name: string, offset: number) {
    // offset: 0
    this.#writeString(name, offset, 100);
  }

  #writeFileType(type: number, offset: number) {
    // offset: 156
    const typeView = new Uint8Array(this.#buffer, offset + 156, 1);
    typeView[0] = type;
  }

  #writeFileSize(size: number, offset: number) {
    // offset: 124
    const sizeStr = size.toString(8).padStart(11, '0');
    this.#writeString(sizeStr, offset + 124, 12);
  }

  #writeFileMode(mode: number, offset: number) {
    // offset: 100
    this.#writeString(mode.toString(8).padStart(7, '0'), offset + 100, 8);
  }

  #writeFileUid(uid: number, offset: number) {
    // offset: 108
    this.#writeString(uid.toString(8).padStart(7, '0'), offset + 108, 8);
  }

  #writeFileGid(gid: number, offset: number) {
    // offset: 116
    this.#writeString(gid.toString(8).padStart(7, '0'), offset + 116, 8);
  }

  #writeFileMtime(mtime: number, offset: number) {
    // offset: 136
    this.#writeString(mtime.toString(8).padStart(11, '0'), offset + 136, 12);
  }

  #writeFileUser(user: string, offset: number) {
    // offset: 265
    this.#writeString(user, offset + 265, 32);
  }

  #writeFileGroup(group: string, offset: number) {
    // offset: 297
    this.#writeString(group, offset + 297, 32);
  }

  #writeChecksum(offset: number) {
    // offset: 148
    this.#writeString('        ', offset + 148, 8); // first fill with spaces

    // add up header bytes
    const header = new Uint8Array(this.#buffer, offset, 512);
    let chksum = 0;
    for (let i = 0; i < 512; i += 1) {
      chksum += header[i];
    }
    this.#writeString(chksum.toString(8), offset + 148, 8);
  }

  #fillHeader(
    offset: number,
    opts: Partial<ITarWriteOptions>,
    fileType: TarFileType
  ) {
    const { uid, gid, mode, mtime, user, group } = {
      uid: 1000,
      gid: 1000,
      mode: fileType === TarFileType.File ? 0o664 : 0o775,
      mtime: ~~(Date.now() / 1000),
      user: 'tarballjs',
      group: 'tarballjs',
      ...opts,
    };

    this.#writeFileMode(mode, offset);
    this.#writeFileUid(uid, offset);
    this.#writeFileGid(gid, offset);
    this.#writeFileMtime(mtime, offset);

    this.#writeString('ustar', offset + 257, 6); // magic string
    this.#writeString('00', offset + 263, 2); // magic version

    this.#writeFileUser(user, offset);
    this.#writeFileGroup(group, offset);
  }
}

function readFileAsArrayBuffer(file: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = e.target.result as ArrayBuffer;
      resolve(view);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
