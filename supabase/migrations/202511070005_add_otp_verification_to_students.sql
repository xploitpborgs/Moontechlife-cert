alter table public.students
add column if not exists otp_verified boolean not null default false,
add column if not exists otp_verified_at timestamptz,
add column if not exists otp_verified_by_email text;
