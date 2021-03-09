# @gera2ld/tarjs

Based on [ankitrohatgi/tarballjs](https://github.com/ankitrohatgi/tarballjs).

## Features

- reading and writing
- UTF-8 support for filenames and contents

## Limitations

- Browser only, no support for NodeJS
- File name (including path) has to be less than 100 characters
- Maximum total file size seems to be limited to somewhere between 500MB to 1GB (exact limit is unknown)

## Usage

```js
// ESM
import { TarReader, TarWriter } from '@gera2ld/tarjs';
// UMD
const { TarReader, TarWriter } = window.tarball;

const reader = new TarReader();
const items = await reader.readFile(tarBlob);
```
