// SPDX-License-Identifier: GPL-3.0-or-later


import { useEffect, useState } from 'react';

type TableViewportRef = { current: HTMLDivElement | null };

export type HorizontalTableScrollbarProps = {
  viewportRef: TableViewportRef;
  refreshKey: string;
};

/**
 * Safari can hide native overlay scrollbars until the user starts scrolling.
 * This always-visible range control gives mouse users an obvious horizontal
 * handle while keeping the actual table viewport as the scroll source.
 */
export default function HorizontalTableScrollbar({
  viewportRef,
  refreshKey,
}: HorizontalTableScrollbarProps) {
  const [maxScroll, setMaxScroll] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const nextMax = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      setMaxScroll(nextMax);
      setScrollLeft(Math.min(viewport.scrollLeft, nextMax));
    };

    const onScroll = () => {
      const currentMax = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      setMaxScroll(currentMax);
      setScrollLeft(Math.min(viewport.scrollLeft, currentMax));
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(viewport);
    if (viewport.firstElementChild) {
      resizeObserver?.observe(viewport.firstElementChild);
    }
    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      viewport.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, [refreshKey, viewportRef]);

  const rangeMax = Math.max(1, maxScroll);

  return (
    <div className="table-horizontal-scroll" aria-label="Gulir tabel ke kanan atau kiri">
      <input
        type="range"
        min={0}
        max={rangeMax}
        step={1}
        value={Math.min(scrollLeft, rangeMax)}
        disabled={maxScroll === 0}
        aria-label="Posisi gulir horizontal tabel"
        aria-valuemin={0}
        aria-valuemax={maxScroll}
        aria-valuenow={Math.min(scrollLeft, maxScroll)}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          setScrollLeft(next);
          if (viewportRef.current) {
            viewportRef.current.scrollLeft = next;
          }
        }}
      />
    </div>
  );
}
