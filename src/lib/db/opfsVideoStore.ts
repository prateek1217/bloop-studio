/**
 * Origin Private File System storage for source video files. OPFS is built
 * for exactly this — large binary files with plain read/write — whereas
 * IndexedDB (used for project/caption/mask JSON in projectStore.ts) has to
 * structured-clone big blobs in and out, which is less efficient at video
 * file sizes. Falls back to IndexedDB automatically on browsers without OPFS
 * (e.g. older Safari) — see projectStore.ts.
 */

const DIR_NAME = "videos";

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function"
  );
}

async function getVideosDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR_NAME, { create: true });
}

export async function opfsSaveVideo(id: string, blob: Blob): Promise<void> {
  const dir = await getVideosDir();
  const fileHandle = await dir.getFileHandle(id, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function opfsGetVideo(id: string): Promise<File | undefined> {
  try {
    const dir = await getVideosDir();
    const fileHandle = await dir.getFileHandle(id);
    return await fileHandle.getFile();
  } catch {
    return undefined;
  }
}

export async function opfsDeleteVideo(id: string): Promise<void> {
  try {
    const dir = await getVideosDir();
    await dir.removeEntry(id);
  } catch {
    // Already gone — nothing to do.
  }
}
