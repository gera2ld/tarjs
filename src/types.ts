import { TarFileType } from './constants';

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
