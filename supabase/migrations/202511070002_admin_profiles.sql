create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin', 'system_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at
on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when lower(coalesce(new.raw_app_meta_data ->> 'role', '')) in ('admin', 'system_admin')
        then lower(new.raw_app_meta_data ->> 'role')
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) in ('admin', 'system_admin')
        then lower(new.raw_user_meta_data ->> 'role')
      else 'user'
    end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile
on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when lower(coalesce(u.raw_app_meta_data ->> 'role', '')) in ('admin', 'system_admin')
      then lower(u.raw_app_meta_data ->> 'role')
    when lower(coalesce(u.raw_user_meta_data ->> 'role', '')) in ('admin', 'system_admin')
      then lower(u.raw_user_meta_data ->> 'role')
    else 'user'
  end
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'system_admin')
  )
  or coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'system_admin')
  or coalesce(lower(auth.jwt() -> 'user_metadata' ->> 'role'), '') in ('admin', 'system_admin');
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles self read"
on public.profiles;

create policy "profiles self read"
on public.profiles
for select
using (auth.uid() = id or public.is_admin_user());

drop policy if exists "profiles admin manage"
on public.profiles;

create policy "profiles admin manage"
on public.profiles
for all
using (public.is_admin_user())
with check (public.is_admin_user());

do $$
begin
  if to_regclass('public.certificate_template_settings') is not null then
    execute 'drop policy if exists "certificate template settings are admin managed" on public.certificate_template_settings';
    execute '
      create policy "certificate template settings are admin managed"
      on public.certificate_template_settings
      for all
      using (public.is_admin_user())
      with check (public.is_admin_user())
    ';
  end if;
end
$$;
