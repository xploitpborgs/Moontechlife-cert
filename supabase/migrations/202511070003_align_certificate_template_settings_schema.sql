drop trigger if exists certificate_template_settings_set_updated_at
on public.certificate_template_settings;

drop function if exists public.set_certificate_template_settings_updated_at();

alter table if exists public.certificate_template_settings
  drop column if exists field_label,
  drop column if exists created_at,
  drop column if exists updated_at;
