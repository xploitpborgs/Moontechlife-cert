create table if not exists public.certificate_template_settings (
  field_key text primary key check (field_key in ('recipient_name', 'description_text', 'qr_code')),
  x_position numeric not null,
  y_position numeric not null,
  width numeric not null,
  height numeric not null,
  default_text text,
  font_family text,
  font_size numeric,
  font_weight text,
  text_color text,
  letter_spacing numeric,
  line_height numeric,
  text_align text check (text_align in ('left', 'center', 'right')),
  is_uppercase boolean not null default false,
  is_bold boolean not null default false,
  is_italic boolean not null default false,
  auto_fit_enabled boolean not null default false
);

alter table public.certificate_template_settings enable row level security;

drop policy if exists "certificate template settings are publicly readable"
on public.certificate_template_settings;

create policy "certificate template settings are publicly readable"
on public.certificate_template_settings
for select
using (true);

drop policy if exists "certificate template settings are admin managed"
on public.certificate_template_settings;

create policy "certificate template settings are admin managed"
on public.certificate_template_settings
for all
using (
  coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'system_admin')
  or coalesce(lower(auth.jwt() -> 'user_metadata' ->> 'role'), '') in ('admin', 'system_admin')
)
with check (
  coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'system_admin')
  or coalesce(lower(auth.jwt() -> 'user_metadata' ->> 'role'), '') in ('admin', 'system_admin')
);
