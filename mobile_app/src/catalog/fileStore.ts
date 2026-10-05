import { File, Paths } from 'expo-file-system';
import type { CacheStore } from './cache';

const cacheFile = () => new File(Paths.document, 'catalog-v1.json');

export const fileStore: CacheStore = {
  async read() {
    const file = cacheFile();
    return file.exists ? file.text() : null;
  },
  write(contents) {
    const file = cacheFile();
    if (!file.exists) file.create();
    file.write(contents);
  },
  remove() {
    const file = cacheFile();
    if (file.exists) file.delete();
  },
};
