# @gera2ld/tarjs

A zero-dependency JavaScript library to read and write tar files.

## Features

- reading and writing
- UTF-8 support for filenames and contents
- no dependency, with support for Node.js, browsers, Deno

## Limitations

- File name (including path) has to be less than 100 characters
- Maximum total file size seems to be limited to somewhere between 500MB to 1GB (exact limit is unknown)

## Usage

```js
// ESM
import { TarReader, TarWriter } from '@gera2ld/tarjs';
// IIFE
const { TarReader, TarWriter } = window.tarjs;

const reader = await TarReader.load(tarFile);
console.log('Loaded items:', reader.fileInfos);
```

Check [jsdoc](https://www.jsdocs.io/package/@gera2ld/tarjs) for API reference.

## Credits

- [ankitrohatgi/tarballjs](https://github.com/ankitrohatgi/tarballjs)
- [Basic Tar Format](https://www.gnu.org/software/tar/manual/html_node/Standard.html)
