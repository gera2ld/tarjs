import { TarReader, TarWriter, ITarFileInfo } from '../src';

const mtime = 1666666666666;
const tarString = `a.txt<95\\0>0000664\\00001750\\00001750\\000000000005\\030201504615210717   <101\\0>ustar\\000gera2ld<25\\0>tarjs<210\\0>hello<507\\0>b.txt<95\\0>0000664\\00001750\\00001750\\000000000005\\030201504615210720   <101\\0>ustar\\000gera2ld<25\\0>tarjs<210\\0>world<507\\0>c.txt<95\\0>0000664\\00001750\\00001750\\000000000000\\030201504615210714   <101\\0>ustar\\000gera2ld<25\\0>tarjs<7890\\0>`;

function tarDump(text: string) {
  return text
    .replace(/\0\0+/g, (m) => `<${m.length}\\0>`)
    .replace(/\0/g, '\\0');
}

function tarLoad(text: string) {
  return text
    .replace(/<(\d+)\\0>/g, (_, g) => '\0'.repeat(+g))
    .replace(/\\0/g, '\0');
}

test('tarjs writer', async () => {
  const writer = new TarWriter();
  writer.addFile('a.txt', 'hello', { mtime });
  writer.addFile('b.txt', new Blob(['world']), { mtime });
  writer.addFile('c.txt', '', { mtime });
  const blob = await writer.write();
  expect(tarDump(await blob.text())).toEqual(tarString);
});

test('tarjs reader', async () => {
  const blob = new Blob([tarLoad(tarString)]);
  const reader = await TarReader.load(blob);
  const { fileInfos } = reader;
  verifyFile(fileInfos[0], reader.getTextFile(fileInfos[0].name), {
    name: 'a.txt',
    content: 'hello',
  });
  verifyFile(fileInfos[1], reader.getTextFile(fileInfos[1].name), {
    name: 'b.txt',
    content: 'world',
  });
  verifyFile(fileInfos[2], reader.getTextFile(fileInfos[2].name), {
    name: 'c.txt',
    content: '',
  });
});

function verifyFile(
  info: ITarFileInfo,
  content: string,
  expected: { name: string; content: string },
) {
  expect(info.name).toEqual(expected.name);
  expect(info.size).toEqual(expected.content.length);
  expect(content).toEqual(expected.content);
}
