import { createHash } from 'crypto';
import { TarReader, TarWriter, ITarFileInfo } from '../src';

const mtime = 1666666666666;

describe('tarjs', () => {
  let blob: Blob;

  test('write', async () => {
    const writer = new TarWriter();
    writer.addFile('a.txt', 'hello', { mtime });
    writer.addFile('b.txt', new Blob(['world']), { mtime });
    writer.addFile('c.txt', '', { mtime });
    blob = await writer.write();
    const hash = hashdigest(new Uint8Array(await blob.arrayBuffer()));
    expect(hash).toEqual('acf0c99ba8727993dfab7339a1ff120083ca44ea');
  });

  test('read', async () => {
    const reader = new TarReader();
    const fileInfos = await reader.readFile(blob);
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
});

function hashdigest(input: Uint8Array) {
  const hash = createHash('sha1');
  hash.update(input);
  return hash.digest('hex');
}

function verifyFile(
  info: ITarFileInfo,
  content: string,
  expected: { name: string; content: string }
) {
  expect(info.name).toEqual(expected.name);
  expect(info.size).toEqual(expected.content.length);
  expect(content).toEqual(expected.content);
}
