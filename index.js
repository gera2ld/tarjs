const TYPE_FILE = {
  value: 48, // '0'
  name: 'file',
  mode: '664',
};
const TYPE_DIR = {
  value: 53, // '5'
  name: 'directory',
  mode: '775',
};
const encoder = new TextEncoder('utf-8');
const utf8Encode = encoder.encode.bind(encoder);
const decoder = new TextDecoder('utf-8');
const utf8Decode = decoder.decode.bind(decoder);

export class TarReader {
  constructor() {
    this.reset();
  }

  reset() {
    this.$fileInfo = [];
    this.$buffer = null;
  }

  readFile(file) {
    this.reset();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.$buffer = event.target.result;
        this.$readFileInfo();
        resolve(this.$fileInfo);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  $readFileInfo() {
    this.$fileInfo = [];
    let offset = 0;
    let fileSize = 0;
    let fileName = '';
    let fileType = null;
    while (offset < this.$buffer.byteLength - 512) {
      fileName = this.$readFileName(offset); // file name
      if (!fileName) {
        break;
      }
      fileType = this.$readFileType(offset);
      fileSize = this.$readFileSize(offset);

      this.$fileInfo.push({
        name: fileName,
        type: fileType,
        size: fileSize,
        headerOffset: offset,
      });

      offset += 512 + 512 * Math.floor((fileSize + 511) / 512);
    }
  }

  $readString(offset, maxSize) {
    let size = 0;
    let view = new Uint8Array(this.$buffer, offset, maxSize);
    while (size < maxSize && view[size]) size += 1;
    view = new Uint8Array(this.$buffer, offset, size);
    return utf8Decode(view);
  }

  $readFileName(offset) {
    return this.$readString(offset, 100);
  }

  $readFileType(offset) {
    // offset = 156, length = 1
    const type = this.$buffer[offset + 156];
    if (type === TYPE_DIR.value) return TYPE_DIR;
    return TYPE_FILE;
  }

  $readFileSize(offset) {
    // offset = 124, length = 12
    const view = new Uint8Array(this.$buffer, offset + 124, 12);
    const sizeStr = utf8Decode(view);
    return parseInt(sizeStr, 8);
  }

  $readFileBlob(offset, size, mimetype) {
    const view = new Uint8Array(this.$buffer, offset, size);
    return new Blob([view], { type: mimetype });
  }

  $readTextFile(offset, size) {
    const view = new Uint8Array(this.$buffer, offset, size);
    return utf8Decode(view);
  }

  getTextFile(filename) {
    const item = this.$fileInfo.find(info => info.name === filename);
    if (item) return this.$readTextFile(item.headerOffset + 512, item.size);
  }

  getFileBlob(filename, mimetype) {
    const item = this.$fileInfo.find(info => info.name === filename);
    if (item) return this.$readFileBlob(item.headerOffset + 512, item.size, mimetype);
  }
}

export class TarWriter {
  constructor() {
    this.$fileData = [];
  }

  addTextFile(name, text, opts) {
    const view = utf8Encode(text);
    const item = {
      name,
      type: TYPE_FILE,
      data: view,
      size: view.length,
      opts,
    };
    this.$fileData.push(item);
  }

  addFileArrayBuffer(name, arrayBuffer, opts) {
    const view = new Uint8Array(arrayBuffer);
    const item = {
      name,
      type: TYPE_FILE,
      data: view,
      size: view.length,
      opts,
    };
    this.$fileData.push(item);
  }

  addFile(name, file, opts) {
    const item = {
      name,
      type: TYPE_FILE,
      size: file.size,
      opts,
    };
    this.$fileData.push(item);
    item.promise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const view = new Uint8Array(e.target.result);
        item.data = view;
        resolve();
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  addFolder(name, opts) {
    this.$fileData.push({
      name,
      type: TYPE_DIR,
      opts,
    });
  }

  $createBuffer() {
    let dataSize = 0;
    this.$fileData.forEach(item => {
      dataSize += 512 + 512 * Math.floor((item.size + 511) / 512);
    });
    const bufSize = 10240 * Math.floor((dataSize + 10240 - 1) / 10240);
    this.$buffer = new ArrayBuffer(bufSize);
  }

  async write() {
    await Promise.all(this.$fileData.map(item => item.promise));
    this.$createBuffer();
    let offset = 0;
    this.$fileData.forEach(item => {
      // write header
      this.$writeFileName(item.name, offset);
      this.$writeFileType(item.type, offset);
      this.$writeFileSize(item.size, offset);
      this.$fillHeader(offset, item.opts, item.type);
      this.$writeChecksum(offset);

      // write data
      const view = new Uint8Array(this.$buffer, offset + 512, item.size);
      for (let i = 0; i < item.size; i += 1) {
        view[i] = item.data[i];
      }
      offset += 512 + 512 * Math.floor((item.size + 511) / 512);
    });
    return new Blob([this.$buffer], { type: 'application/x-tar' });
  }

  $writeString(str, offset, size) {
    const strView = utf8Encode(str);
    const view = new Uint8Array(this.$buffer, offset, size);
    for (let i = 0; i < size; i += 1) {
      view[i] = i < strView.length ? strView[i] : 0;
    }
  }

  $writeFileName(name, offset) {
    // offset: 0
    this.$writeString(name, offset, 100);
  }

  $writeFileType(type, offset) {
    // offset: 156
    const typeView = new Uint8Array(this.$buffer, offset + 156, 1);
    typeView[0] = type.value;
  }

  $writeFileSize(size, offset) {
    // offset: 124
    const sizeStr = size.toString(8).padStart(11, '0');
    this.$writeString(sizeStr, offset + 124, 12);
  }

  $writeFileMode(mode, offset) {
    // offset: 100
    this.$writeString(mode.padStart(7, '0'), offset + 100, 8);
  }

  $writeFileUid(uid, offset) {
    // offset: 108
    this.$writeString(uid.padStart(7, '0'), offset + 108, 8);
  }

  $writeFileGid(gid, offset) {
    // offset: 116
    this.$writeString(gid.padStart(7, '0'), offset + 116, 8);
  }

  $writeFileMtime(mtime, offset) {
    // offset: 136
    this.$writeString(mtime.padStart(11, '0'), offset + 136, 12);
  }

  $writeFileUser(user, offset) {
    // offset: 265
    this.$writeString(user, offset + 265, 32);
  }

  $writeFileGroup(group, offset) {
    // offset: 297
    this.$writeString(group, offset + 297, 32);
  }

  $writeChecksum(offset) {
    // offset: 148
    this.$writeString('        ', offset + 148, 8); // first fill with spaces

    // add up header bytes
    const header = new Uint8Array(this.$buffer, offset, 512);
    let chksum = 0;
    for (let i = 0; i < 512; i += 1) {
      chksum += header[i];
    }
    this.$writeString(chksum.toString(8), offset + 148, 8);
  }

  $fillHeader(offset, opts, fileType) {
    const {
      uid, gid, mode, mtime, user, group,
    } = {
      uid: 1000,
      gid: 1000,
      mode: fileType.mode,
      mtime: Date.now(),
      user: 'tarballjs',
      group: 'tarballjs',
      ...opts,
    };

    this.$writeFileMode(mode, offset);
    this.$writeFileUid(uid.toString(8), offset);
    this.$writeFileGid(gid.toString(8), offset);
    this.$writeFileMtime(Math.floor(mtime / 1000).toString(8), offset);

    this.$writeString('ustar', offset + 257, 6); // magic string
    this.$writeString('00', offset + 263, 2); // magic version

    this.$writeFileUser(user, offset);
    this.$writeFileGroup(group, offset);
  }
}
