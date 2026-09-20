// Copyright (C) 2026 Johandi Arifiansyach

import { memo, type ReactNode } from "react";
import { Badge } from "../base/Badge";
import { getCompletedAgeInMonths } from "../../shared/formatters";

type MobileProgramCardProps = {
  child: Record<string, unknown>;
  /** Report date used when the API does not already include ageInMonths. */
  asOf?: string;
  children: ReactNode;
  action?: ReactNode;
};

function readValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value) !== "") {
      return String(value);
    }
  }
  return "-";
}

/**
 * Compact mobile presentation shared by the programme lists (ASI, MPASI,
 * and PMT).  Keeping the identity/relationship header identical to the main
 * children list makes it easier for cadres to scan the same child across
 * every monitoring programme.
 */
const MobileProgramCard = memo(function MobileProgramCard({
  child,
  asOf,
  children,
  action,
}: MobileProgramCardProps) {
  const name = readValue(child, "nama", "name");
  const nik = readValue(child, "nik", "national_id");
  const gender = readValue(child, "jk", "gender");
  const birthDate = readValue(child, "tglLahir", "birthDate", "birth_date");
  const storedAge = Number(readValue(child, "ageInMonths", "usiaBulan"));
  const calculatedAge = getCompletedAgeInMonths(birthDate, asOf);
  const ageInMonths = calculatedAge ?? (Number.isFinite(storedAge) ? Math.trunc(storedAge) : null);
  const parent = readValue(child, "namaOrtu", "parentName");
  const village = readValue(child, "desa", "village");
  const posyandu = readValue(child, "posyandu");
  const location = [village, posyandu].filter((part) => part !== "-").join(" / ");
  const relation = [
    `Ortu: ${parent === "-" ? "—" : parent}`,
    location,
  ].filter(Boolean).join(" · ");
  const isMale = gender.toUpperCase() === "L" || gender.toLowerCase() === "laki-laki";

  return (
    <article className="mobile-child-card mobile-program-card rounded-2xl bg-white/40 p-4 space-y-2.5 backdrop-blur-xl ring-1 ring-white/25">
      <div className="mobile-child-identity flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{name}</p>
          <p className="truncate font-mono text-[10px] text-slate-500">{nik}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge color={isMale ? "blue" : "pink"}>{isMale ? "L" : "P"}</Badge>
            <span className="truncate rounded-full bg-white/45 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-white/30">
              {ageInMonths === null ? "—" : `${ageInMonths} bln`}
            </span>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <p className="mobile-child-relation truncate text-[11px] text-slate-500" title={relation}>
        {relation}
      </p>
      <div className="mobile-program-card-content">{children}</div>
    </article>
  );
});

export default MobileProgramCard;
export type { MobileProgramCardProps };
