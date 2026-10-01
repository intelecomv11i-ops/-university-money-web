-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'ครอบครัวเงินมหาลัย',
  code text unique not null default upper(substr(encode(gen_random_bytes(5),'hex'),1,8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null,
  role text not null check (role in ('mother','child')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  week_no int not null,
  label text not null,
  week_start date not null,
  week_end date not null,
  amount numeric(10,2) not null default 2000 check (amount > 0),
  status text not null default 'pending' check (status in ('pending','submitted','verified','rejected')),
  slip_path text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(family_id, week_no)
);

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.payments enable row level security;

create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.family_id=fid);
$$;

create or replace function public.is_family_mother(fid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.family_id=fid and p.role='mother');
$$;

-- Families: authenticated users can create their own family; members can view it.
drop policy if exists family_insert on public.families;
create policy family_insert on public.families for insert to authenticated with check (created_by=auth.uid());
drop policy if exists family_select on public.families;
create policy family_select on public.families for select to authenticated using (created_by=auth.uid() or public.is_family_member(id));

-- Profiles: each user can manage their own profile.
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles for insert to authenticated with check (id=auth.uid());
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_family_member(family_id));
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Payments: family members can read; mother can create/update; child can update only their submission fields via UI.
drop policy if exists payment_select on public.payments;
create policy payment_select on public.payments for select to authenticated using (public.is_family_member(family_id));
drop policy if exists payment_insert on public.payments;
create policy payment_insert on public.payments for insert to authenticated with check (public.is_family_mother(family_id));
drop policy if exists payment_update_mother on public.payments;
create policy payment_update_mother on public.payments for update to authenticated using (public.is_family_mother(family_id)) with check (public.is_family_mother(family_id));

grant usage on schema public to authenticated;
grant select, insert, update on public.families to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.payments to authenticated;

-- Private slip bucket.
insert into storage.buckets (id,name,public,file_size_limit) values ('slips','slips',false,10485760) on conflict (id) do update set public=false,file_size_limit=10485760;

drop policy if exists slips_select on storage.objects;
create policy slips_select on storage.objects for select to authenticated using (bucket_id='slips' and public.is_family_member((storage.foldername(name))[1]::uuid));
drop policy if exists slips_insert on storage.objects;
create policy slips_insert on storage.objects for insert to authenticated with check (bucket_id='slips' and public.is_family_member((storage.foldername(name))[1]::uuid));
drop policy if exists slips_update on storage.objects;
create policy slips_update on storage.objects for update to authenticated using (bucket_id='slips' and public.is_family_member((storage.foldername(name))[1]::uuid));

-- Create October 2026 rows for an existing family after registration.
-- Replace FAMILY_UUID below with the id from public.families.
-- insert into public.payments(family_id,week_no,label,week_start,week_end,amount) values
-- ('FAMILY_UUID',1,'1–7 ต.ค.','2026-10-01','2026-10-07',2000),
-- ('FAMILY_UUID',2,'8–14 ต.ค.','2026-10-08','2026-10-14',2000),
-- ('FAMILY_UUID',3,'15–21 ต.ค.','2026-10-15','2026-10-21',2000),
-- ('FAMILY_UUID',4,'22–28 ต.ค.','2026-10-22','2026-10-28',2000),
-- ('FAMILY_UUID',5,'29–31 ต.ค.','2026-10-29','2026-10-31',2000);
