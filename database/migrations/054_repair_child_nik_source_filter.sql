-- SPDX-License-Identifier: GPL-3.0-or-later


begin;

-- Migration 053 originally compared named parameters with
-- pg_get_function_identity_arguments(), which only returns types.  On those
-- installations the transaction rolled back before the NIK predicate was
-- installed.  Re-run the patch using an unambiguous function signature so a
-- database that already recorded 053 is repaired as well.
create or replace function public.eposyandu_nik_filter_match(
  p_has_nik boolean,
  p_search text
) returns boolean
language sql
immutable
as $$
  select case
    when left(coalesce(p_search, ''), 6) = '__N0__' then not coalesce(p_has_nik, false)
    when left(coalesce(p_search, ''), 6) = '__N1__' then coalesce(p_has_nik, false)
    else true
  end
$$;

create or replace function public.eposyandu_child_search_term(
  p_search text
) returns text
language sql
immutable
as $$
  select case
    when left(coalesce(p_search, ''), 6) in ('__N0__', '__N1__')
      then nullif(substr(p_search, 7), '')
    else p_search
  end
$$;

do $$
declare
  function_definition text;
  corrected_definition text;
  function_name text;
  function_oid oid;
  function_signature text;
begin
  foreach function_name in array array[
    'eposyandu_replica_children_page',
    'eposyandu_materialized_children_page',
    -- Older callers still use the 12-argument problem function while the
    -- age-aware overload is rolled out. It has the same search predicate.
    'eposyandu_problem_children_page'
  ] loop
    function_signature := case function_name
      when 'eposyandu_problem_children_page' then
        'date, date, text, integer, integer, text, text, text, text, text, text, text'
      else
        'date, date, date, integer, integer, text, text, text, text, text, text, text, text, text'
    end;
    select p.oid
      into function_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = function_name
      -- Match input types directly so this repair works on PostgreSQL
      -- versions that format identity arguments differently.
      and oidvectortypes(p.proargtypes) = function_signature
    limit 1;

    -- Keep rolling deployments safe when the age-aware function has not
    -- reached an older environment yet; the next migration run can retry.
    if function_oid is null then
      continue;
    end if;

    function_definition := pg_get_functiondef(function_oid);
    corrected_definition := replace(
      function_definition,
      'and (nullif(trim(coalesce(p_search, '''')), '''') is null',
      'and public.eposyandu_nik_filter_match(c.has_national_id, p_search)' || chr(10) ||
      '      and (nullif(trim(coalesce(public.eposyandu_child_search_term(p_search), '''')), '''') is null'
    );
    -- The pre-age (12-argument) problem function formats the opening
    -- parenthesis on its own line. Handle that variant as well so legacy
    -- callers cannot interpret the private marker as ordinary search text.
    corrected_definition := replace(
      corrected_definition,
      'and (' || chr(10) || '        nullif(trim(coalesce(p_search, '''')), '''') is null',
      'and public.eposyandu_nik_filter_match(c.has_national_id, p_search)' || chr(10) ||
      '      and (' || chr(10) || '        nullif(trim(coalesce(public.eposyandu_child_search_term(p_search), '''')), '''') is null'
    );
    corrected_definition := replace(
      corrected_definition,
      'trim(p_search) ||',
      'trim(public.eposyandu_child_search_term(p_search)) ||'
    );

    if corrected_definition <> function_definition then
      execute corrected_definition;
    end if;
  end loop;
end
$$;

revoke all on function public.eposyandu_nik_filter_match(boolean, text) from public;
revoke all on function public.eposyandu_child_search_term(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.eposyandu_nik_filter_match(boolean,text) to service_role';
    execute 'grant execute on function public.eposyandu_child_search_term(text) to service_role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'eposyandu_api') then
    execute 'grant execute on function public.eposyandu_nik_filter_match(boolean,text) to eposyandu_api';
    execute 'grant execute on function public.eposyandu_child_search_term(text) to eposyandu_api';
  end if;
end
$$;

insert into public.schema_migrations(version, description)
values ('054', 'repair child NIK source filter function patch')
on conflict (version) do nothing;

commit;
