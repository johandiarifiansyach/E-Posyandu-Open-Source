-- SPDX-License-Identifier: GPL-3.0-or-later


begin;

-- The ASI page became a distinct-child, six-month affirmation report in
-- migration 057. Reuse its total directly for the dashboard numerator so the
-- card and page cannot drift when the ASI classification or deduplication
-- contract changes. The target remains every scoped child aged six months at
-- the end of the reporting period.
do $$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'eposyandu_dashboard_materialized_stats'
    and oidvectortypes(p.proargtypes) =
      'date, date, date, date, text, text, text, text, text, text';

  if function_definition is null then
    raise exception 'eposyandu_dashboard_materialized_stats is not installed';
  end if;

  corrected_definition := replace(
    function_definition,
    $needle$
  asi_latest as materialized (
    -- Keep one row per persisted positive measurement, exactly like the ASI
    -- table function. The table's total is a measurement-row total (and
    -- therefore remains stable even when a child has two recorded visits in
    -- one month); changing it to a distinct-child count would make the card
    -- disagree with the visible table again.
    select coalesce(m.child_id, nullif(m.legacy_child_id, '')) as child_id,
      a.exclusive_breastfeeding_status
    from public.measurements m
    join scoped_children c
      on c.id = coalesce(m.child_id, nullif(m.legacy_child_id, ''))
    join public.measurement_analysis a
      on a.measurement_id = m.id
     and a.exclusive_breastfeeding_status = 'Ya'
    where m.measurement_date between p_month_start and p_month_end
      and public.eposyandu_age_group_match(
        '6', c.birth_date, m.measurement_date, c.gestational_age_weeks
      )
  ),
  asi_counts as (
    select
      (select count(*)::integer from asi_children) as target,
      (select count(*)::integer from asi_latest) as exclusive
  )$needle$,
    $replacement$
  asi_counts as (
    select
      (select count(*)::integer from asi_children) as target,
      coalesce((
        public.eposyandu_materialized_exclusive_breastfeeding_page(
          p_month_start,
          p_month_end,
          '6',
          1,
          1,
          nullif(trim(p_village), ''),
          nullif(trim(p_posyandu), ''),
          p_role,
          p_scope_village,
          p_scope_posyandu
        )->>'total'
      )::integer, 0) as exclusive
  )$replacement$
  );

  if corrected_definition = function_definition then
    raise exception 'Dashboard ASI aggregate block was not found';
  end if;

  execute corrected_definition;
end
$$;

insert into public.schema_migrations(version, description)
values ('058', 'align dashboard ASI count with ASI page total')
on conflict (version) do nothing;

commit;
