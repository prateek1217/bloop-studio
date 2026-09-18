"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ProjectMeta } from "@/types";
import { deleteProject, listProjectMetas } from "@/lib/db/projectStore";
import { useRequireAuth } from "@/lib/auth/useRequireAuth";
import { logout } from "@/lib/auth/client";
import ProjectCard from "@/components/dashboard/ProjectCard";
import UploadTrigger from "@/components/upload/UploadTrigger";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, checked } = useRequireAuth("/projects");

  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);

  useEffect(() => {
    if (!checked) return;
    listProjectMetas().then(setProjects);
  }, [checked]);

  async function handleDelete(id: string) {
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
    await deleteProject(id);
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  if (!checked) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-neutral-500">
        Checking your session…
      </main>
    );
  }

  const readyCount = projects?.filter((p) => p.stage === "ready" || p.stage === "completed").length ?? 0;

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]">
        <div className="absolute -left-32 top-[-200px] h-[460px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute -right-32 top-[-160px] h-[420px] w-[520px] rounded-full bg-cyan-500/15 blur-[120px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-3 inline-block">
              <Image src="/logo/bloop-wordmark-white.png" alt="Bloop Studio" width={951} height={408} className="h-6 w-auto" />
            </Link>
            <h1 className="font-gabarito text-3xl font-bold tracking-tight text-white">Your projects</h1>
            {projects && projects.length > 0 && (
              <p className="mt-1.5 text-sm text-neutral-500">
                {projects.length} {projects.length === 1 ? "project" : "projects"}
                {readyCount > 0 && <span> · {readyCount} ready to edit</span>}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <UploadTrigger className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90">
              + New project
            </UploadTrigger>
            <div className="flex items-center gap-3 rounded-full border border-neutral-800 bg-neutral-900/80 py-1.5 pl-4 pr-1.5">
              <span className="hidden text-sm text-neutral-300 sm:inline">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-neutral-700 px-3.5 py-1.5 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {projects === null ? (
          <GridSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} onDelete={handleDelete} index={i} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 py-28 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-[0_8px_24px_-6px_rgba(139,92,246,0.6)]">
        <PlusIcon />
      </div>
      <p className="font-gabarito text-lg font-semibold text-neutral-100">No projects yet</p>
      <p className="mt-1.5 max-w-xs text-sm text-neutral-500">
        Upload a talking-head video to generate your first set of AI-aware captions.
      </p>
      <UploadTrigger className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90">
        Upload a video
      </UploadTrigger>
    </div>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
          <div className="aspect-[9/16] w-full animate-pulse bg-neutral-800/70" />
          <div className="space-y-2 p-3.5">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-neutral-800/70" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-800/70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
