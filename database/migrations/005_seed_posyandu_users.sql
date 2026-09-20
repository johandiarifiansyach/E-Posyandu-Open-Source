-- Demo account mapping for the public E-Posyandu distribution.
-- Create these addresses in the configured auth provider first. The migration
-- only links existing auth users and never creates or exposes passwords.

begin;

with demo_accounts (email, username, role, village, posyandu) as (
  values
    ('kader@demo.eposyandu.local', 'kader-demo', 'Kader Posyandu', 'Desa Demo', 'Posyandu Demo 1'),
    ('bidan@demo.eposyandu.local', 'bidan-demo', 'Bidan Desa', 'Desa Demo', null),
    ('gizi@demo.eposyandu.local', 'gizi-demo', 'Ahli Gizi', null, null)
)
insert into public.app_users (
  user_id, username, email, role, village, posyandu, active
)
select
  users.id,
  accounts.username,
  accounts.email,
  accounts.role,
  accounts.village,
  accounts.posyandu,
  true
from demo_accounts accounts
join auth.users users on lower(users.email) = accounts.email
on conflict (user_id) do update set
  username = excluded.username,
  email = excluded.email,
  role = excluded.role,
  village = excluded.village,
  posyandu = excluded.posyandu,
  active = true,
  updated_at = timezone('utc', now());

commit;
