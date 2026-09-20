// Copyright (C) 2026 Johandi Arifiansyach

import { APP_VERSION } from "../../config/app";

export type AppFooterProps = {
  /** Optional support destination; omitted when no support channel is configured. */
  supportHref?: string;
  onVersionClick?: () => void;
};

/**
 * Quiet application footer that shares the light liquid-glass language with
 * the dashboard chrome without competing with the data cards above it.
 */
export default function AppFooter({
  supportHref,
  onVersionClick,
}: AppFooterProps) {
  return (
    <footer className="app-footer app-footer-glass mt-8 flex items-center justify-between gap-4 border-t border-white/30 px-6 py-4 text-xs text-gray-400">
      <p className="app-footer-copy min-w-0 truncate">
        E-Posyandu
      </p>

      <div className="app-footer-meta flex shrink-0 items-center justify-end gap-3">
        {supportHref ? (
          <a className="app-footer-support" href={supportHref}>
            Bantuan
          </a>
        ) : null}
        <button
          type="button"
          className="app-footer-version app-version-button"
          onClick={onVersionClick}
          aria-haspopup={onVersionClick ? "dialog" : undefined}
          title={onVersionClick ? "Lihat apa yang baru" : undefined}
        >
          v{APP_VERSION}
        </button>
      </div>
    </footer>
  );
}
