import { createStore, get, set, del, keys } from "idb-keyval";
import type { Project, ProjectMeta } from "@/types";
import { isOpfsSupported, opfsSaveVideo, opfsGetVideo, opfsDeleteVideo } from "./opfsVideoStore";

// Project/caption/mask records are small structured JSON (including typed
// arrays for masks) — IndexedDB via idb-keyval is a good fit. Source video
// files go to OPFS instead (see opfsVideoStore.ts), which is built for large
// binary files; this store is kept only as a fallback for browsers without
// OPFS support.
const projectsStore = createStore("subtitle-studio-projects", "projects");
const videosFallbackStore = createStore("subtitle-studio-videos", "videos");

export async function listProjectMetas(): Promise<ProjectMeta[]> {
  const allKeys = await keys(projectsStore);
  const metas: ProjectMeta[] = [];
  for (const key of allKeys) {
    const project = await get<Project>(key as string, projectsStore);
    if (project) metas.push(project.meta);
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return get<Project>(id, projectsStore);
}

export async function saveProject(project: Project): Promise<void> {
  await set(project.meta.id, project, projectsStore);
}

export async function getVideoBlob(id: string): Promise<Blob | undefined> {
  if (isOpfsSupported()) {
    const file = await opfsGetVideo(id);
    if (file) return file;
  }
  return get<Blob>(id, videosFallbackStore);
}

export async function saveVideoBlob(id: string, blob: Blob): Promise<void> {
  if (isOpfsSupported()) {
    await opfsSaveVideo(id, blob);
    return;
  }
  await set(id, blob, videosFallbackStore);
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, projectsStore);
  if (isOpfsSupported()) {
    await opfsDeleteVideo(id);
  } else {
    await del(id, videosFallbackStore);
  }
}
