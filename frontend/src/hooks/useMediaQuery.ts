// Copyright (C) 2026 Johandi Arifiansyach

import { useEffect, useState } from "react";

/**
 * Tracks a media query without rendering both responsive representations at
 * once. This is useful for pages that have intentionally different desktop
 * table and mobile card markup: keeping both in the DOM creates duplicate
 * accessible names and makes screen-reader/test navigation ambiguous.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    const supportsEventTarget = typeof mediaQuery.addEventListener === "function";
    if (supportsEventTarget) mediaQuery.addEventListener("change", update);
    else mediaQuery.addListener?.(update);
    return () => {
      if (supportsEventTarget) mediaQuery.removeEventListener("change", update);
      else mediaQuery.removeListener?.(update);
    };
  }, [query]);

  return matches;
}

export function useIsMobileViewport() {
  return useMediaQuery("(max-width: 767px)");
}
