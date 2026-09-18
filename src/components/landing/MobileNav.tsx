"use client";

import { useState } from "react";
import MyProjectsButton from "@/components/dashboard/MyProjectsButton";

const LINKS = [
  { href: "#features", label: "Features", shine: false },
  { href: "#how-it-works", label: "How it works", shine: false },
  { href: "#pricing", label: "Pricing", shine: true },
];

/** Below `sm` the pill nav has no room for Features/How it works/Pricing, so
 * they were just hidden with nothing replacing them — this is that
 * replacement: a hamburger toggle that drops down the same links. */
export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 rounded-2xl border border-neutral-200 bg-[#FCFAF7] p-2 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.15)]">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`relative block overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                link.shine
                  ? "bg-gradient-to-r from-violet-200 to-fuchsia-200 text-neutral-900 shadow-[0_1px_2px_rgba(124,58,237,0.25)]"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {link.shine && (
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                  <span className="absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-white/90 mix-blend-plus-lighter blur-[1px] [animation:shine-sweep_3s_ease-in-out_infinite]" />
                </span>
              )}
              <span className="relative">{link.label}</span>
            </a>
          ))}
          <div className="my-1 h-px bg-neutral-200" />
          <MyProjectsButton className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50" />
        </div>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
