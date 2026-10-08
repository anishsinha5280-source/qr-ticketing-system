"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";

/**
 * Reveals the signed token that is encoded inside the QR code. Handy for
 * testing the organizer's "Enter token manually" flow and for verifying that a
 * tampered token is rejected. The token is only ever served to its owner.
 */
export function TokenDisclosure({ token }: { token?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(token!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-800 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
        aria-expanded={open}
      >
        <Icon name={open ? "chevronRight" : "keyboard"} className="h-4 w-4" />
        {open ? "Hide signed entry token" : "Reveal signed entry token"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <p className="break-all rounded-lg border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-cyan-200/90">
            {token}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={copy}>
              <Icon name="copy" className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy token"}
            </button>
            <span className="text-[11px] text-slate-500">
              HS256-signed · changing a single character invalidates it
            </span>
          </div>
          <Alert tone="info">
            Paste this into the organizer scanner&apos;s manual entry field to test verification
            without a camera.
          </Alert>
        </div>
      )}
    </div>
  );
}
