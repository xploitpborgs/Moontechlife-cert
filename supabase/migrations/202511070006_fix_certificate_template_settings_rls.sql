alter table if exists public.certificate_template_settings
enable row level security;

drop policy if exists "certificate template settings are admin managed"
on public.certificate_template_settings;

create policy "certificate template settings are admin managed"
on public.certificate_template_settings
for all
using (public.is_admin_user())
with check (public.is_admin_user());
