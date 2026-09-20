-- SPDX-License-Identifier: GPL-3.0-or-later


begin;

-- A "Ya" answer at six completed months confirms exclusive breastfeeding for
-- every preceding month whose answer was not recorded. Explicit earlier
-- answers remain authoritative. This mirrors the Python ASI context and keeps
-- the SigiZI month columns useful even when no earlier weighing took place.
create or replace function public.eposyandu_sigizi_measurement_export(
  p_month_start date,
  p_month_end date,
  p_village text default null,
  p_posyandu text default null,
  p_role text default 'Ahli Gizi',
  p_scope_village text default null,
  p_scope_posyandu text default null
) returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  execute $query$
  with scoped_children as (
    select c.id, c.name, c.national_id, c.birth_date, c.village, c.posyandu
    from public.children c
    where c.deleted_at is null
      and c.birth_date is not null
      and c.birth_date <= $1
      and c.birth_date > ($1 - interval '60 months')::date
      and public.eposyandu_scope_match(
        c.village, c.posyandu, $3, $4, $5, $6, $7
      )
  ),
  latest_current_measurements as (
    select distinct on (coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')))
      coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')) as child_id,
      m.measurement_date, m.weight_kg, m.height_cm,
      m.mid_upper_arm_circumference_cm, m.head_circumference_cm, m.edema,
      m.measurement_method, m.vitamin_a, m.mother_class_attendance, m.mbg
    from public.measurements m
    join scoped_children c
      on c.id = coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, ''))
    where m.measurement_date between $1 and $2
    order by coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')),
      m.measurement_date desc, m.created_at desc, m.id desc
  ),
  latest_asi_by_age as (
    select distinct on (
      coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')),
      public.eposyandu_age_months(c.birth_date, m.measurement_date)
    )
      coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')) as child_id,
      public.eposyandu_age_months(c.birth_date, m.measurement_date) as age_in_months,
      m.exclusive_breastfeeding
    from public.measurements m
    join scoped_children c
      on c.id = coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, ''))
    where m.measurement_date between c.birth_date and $2
      and public.eposyandu_age_months(c.birth_date, m.measurement_date) between 0 and 6
    order by coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')),
      public.eposyandu_age_months(c.birth_date, m.measurement_date),
      m.measurement_date desc, m.created_at desc, m.id desc
  ),
  asi_columns as (
    select child_id,
      max(exclusive_breastfeeding) filter (where age_in_months = 0) as asi_bulan_0,
      max(exclusive_breastfeeding) filter (where age_in_months = 1) as asi_bulan_1,
      max(exclusive_breastfeeding) filter (where age_in_months = 2) as asi_bulan_2,
      max(exclusive_breastfeeding) filter (where age_in_months = 3) as asi_bulan_3,
      max(exclusive_breastfeeding) filter (where age_in_months = 4) as asi_bulan_4,
      max(exclusive_breastfeeding) filter (where age_in_months = 5) as asi_bulan_5,
      max(exclusive_breastfeeding) filter (where age_in_months = 6) as asi_bulan_6
    from latest_asi_by_age
    group by child_id
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'nik', c.national_id,
      'nama', c.name,
      'tglUkur', m.measurement_date,
      'bb', m.weight_kg,
      'tb', m.height_cm,
      'lila', m.mid_upper_arm_circumference_cm,
      'lk', m.head_circumference_cm,
      'edema', coalesce(m.edema, ''),
      'caraUkur', case
        when m.measurement_date is null then ''
        else coalesce(
          nullif(btrim(m.measurement_method), ''),
          case
            when public.eposyandu_age_months(c.birth_date, m.measurement_date) >= 24 then 'Berdiri'
            else 'Terlentang'
          end
        )
      end,
      'vitA', coalesce(m.vitamin_a, ''),
      'asiBulan0', coalesce(nullif(a.asi_bulan_0, ''), case when a.asi_bulan_6 = 'Ya' then 'Ya' else '' end),
      'asiBulan1', coalesce(nullif(a.asi_bulan_1, ''), case when a.asi_bulan_6 = 'Ya' then 'Ya' else '' end),
      'asiBulan2', coalesce(nullif(a.asi_bulan_2, ''), case when a.asi_bulan_6 = 'Ya' then 'Ya' else '' end),
      'asiBulan3', coalesce(nullif(a.asi_bulan_3, ''), case when a.asi_bulan_6 = 'Ya' then 'Ya' else '' end),
      'asiBulan4', coalesce(nullif(a.asi_bulan_4, ''), case when a.asi_bulan_6 = 'Ya' then 'Ya' else '' end),
      'asiBulan5', coalesce(nullif(a.asi_bulan_5, ''), case when a.asi_bulan_6 = 'Ya' then 'Ya' else '' end),
      'asiBulan6', coalesce(a.asi_bulan_6, ''),
      'kelasIbu', coalesce(m.mother_class_attendance, ''),
      'mbg', coalesce(m.mbg, '')
    ) order by lower(c.name), c.id), '[]'::jsonb)
  )
  from scoped_children c
  left join latest_current_measurements m on m.child_id = c.id
  left join asi_columns a on a.child_id = c.id
  $query$
  into result
  using p_month_start, p_month_end, p_village, p_posyandu,
    p_role, p_scope_village, p_scope_posyandu;

  return result;
end;
$$;

-- The ASI Eksklusif page is a completed-outcome report, so it only contains
-- children measured at exactly six completed months. The six-month answer is
-- sufficient immediately; no earlier weighing row is required.
create or replace function public.eposyandu_materialized_exclusive_breastfeeding_page(
  p_measurement_start date,
  p_measurement_end date,
  p_age_group text,
  p_page integer,
  p_size integer,
  p_village text default null,
  p_posyandu text default null,
  p_role text default 'Ahli Gizi',
  p_scope_village text default null,
  p_scope_posyandu text default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selected as (
    select distinct on (c.id)
      c.id, c.name, c.national_id, c.has_national_id, c.birth_date,
      c.village, c.posyandu, m.measurement_date,
      public.eposyandu_age_months(c.birth_date, m.measurement_date) as age_in_months
    from public.children c
    join public.measurements m
      on coalesce(nullif(m.child_id, ''), nullif(m.legacy_child_id, '')) = c.id
    where c.deleted_at is null
      and m.measurement_date between p_measurement_start and p_measurement_end
      and public.eposyandu_age_months(c.birth_date, m.measurement_date) = 6
      and m.exclusive_breastfeeding = 'Ya'
      and public.eposyandu_scope_match(
        c.village, c.posyandu, p_village, p_posyandu,
        p_role, p_scope_village, p_scope_posyandu
      )
    order by c.id, m.measurement_date desc, m.created_at desc, m.id desc
  ),
  paged as (
    select *
    from selected
    order by lower(name), id
    limit greatest(1, least(coalesce(p_size, 10), 50))
    offset greatest(0, coalesce(p_page, 1) - 1)
      * greatest(1, least(coalesce(p_size, 10), 50))
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'data', jsonb_build_object(
          'nama', name,
          'nik', national_id,
          'hasNIK', has_national_id,
          'tglLahir', birth_date,
          'desa', village,
          'posyandu', posyandu,
          'tglUkur', measurement_date,
          'ageInMonths', age_in_months,
          'asiStatus', 'Ya'
        )
      ) order by lower(name), id)
      from paged
    ), '[]'::jsonb),
    'total', (select count(*) from selected),
    'ageGroup', '6',
    'calculator', 'six-month-affirmation-v1',
    'analytics', 'postgresql-read-v1'
  );
$$;

revoke all on function public.eposyandu_sigizi_measurement_export(date, date, text, text, text, text, text) from public;
revoke all on function public.eposyandu_materialized_exclusive_breastfeeding_page(date, date, text, integer, integer, text, text, text, text, text) from public;

insert into public.schema_migrations(version, description)
values ('057', 'fix exclusive breastfeeding carryback and six-month cohort')
on conflict (version) do nothing;

commit;
