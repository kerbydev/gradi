create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text not null default 'MSU-IIT',
  program text,
  year_level text,
  active_semester_id uuid,
  gwa_decimals smallint not null default 2 check (gwa_decimals between 2 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  academic_year text not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  term text not null check (term in ('1st','2nd','midyear')),
  status text not null check (status in ('active','archived')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, academic_year, term),
  check (end_date is null or end_date >= start_date)
);
create unique index if not exists semesters_one_active_per_user
on public.semesters(user_id) where status = 'active';

create table if not exists public.grading_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
with ranked_defaults as (
  select id, row_number() over (partition by user_id order by created_at, id) as position
  from public.grading_profiles
  where is_default
)
update public.grading_profiles gp
set is_default = false, updated_at = now()
from ranked_defaults rd
where gp.id = rd.id and rd.position > 1;
create unique index if not exists grading_profiles_one_default_per_user
on public.grading_profiles(user_id) where is_default;

create or replace function public.ensure_default_grading_profile(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_profile_id uuid;
begin
  if p_user_id is null then
    raise exception 'A user ID is required.';
  end if;

  insert into public.grading_profiles (user_id, name, is_default)
  values (p_user_id, 'Default', true)
  on conflict (user_id) where is_default do nothing;

  select id into default_profile_id
  from public.grading_profiles
  where user_id = p_user_id and is_default;

  return default_profile_id;
end;
$$;
revoke all on function public.ensure_default_grading_profile(uuid) from public, anon, authenticated;

create table if not exists public.grading_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grading_profile_id uuid not null references public.grading_profiles(id) on delete cascade,
  min_percent numeric(6,2) not null check (min_percent >= 0),
  max_percent numeric(6,2) not null check (max_percent <= 100),
  grade numeric(3,2) not null constraint grading_rules_grade_valid
    check (grade in (1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,4,5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_percent <= max_percent)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  code text not null,
  name text not null,
  units numeric(4,2) not null check (units > 0 and units <= 12),
  description text,
  instructor text,
  tracking_mode text not null check (tracking_mode in ('assessments','manual')),
  weighting_mode text not null check (weighting_mode in ('individual','category')),
  grading_profile_id uuid references public.grading_profiles(id) on delete set null,
  counts_in_gwa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  type text not null check (type in ('quiz','exam','laboratory','assignment','project','recitation','activity','other')),
  weight numeric(5,2) check (weight is null or (weight >= 0 and weight <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  category_id uuid not null references public.assessment_categories(id) on delete cascade,
  name text not null,
  input_method text not null check (input_method in ('raw','percent')),
  score numeric(8,2),
  total_points numeric(8,2),
  percentage numeric(6,2),
  weight numeric(6,2) not null check (weight >= 0 and weight <= 100),
  due_date date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score is null or score >= 0),
  check (total_points is null or total_points > 0),
  check (
    input_method != 'raw'
    or ((score is null and total_points is null)
      or (score is not null and total_points is not null and score <= total_points))
  ),
  check (percentage is null or (percentage >= 0 and percentage <= 100)),
  check (input_method != 'percent' or (score is null and total_points is null)),
  check (input_method != 'raw' or percentage is null),
  check (
    not is_completed
    or (input_method = 'raw' and score is not null and total_points is not null)
    or (input_method = 'percent' and percentage is not null)
  )
);

create table if not exists public.final_grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null unique references public.subjects(id) on delete cascade,
  grade_value numeric(3,2),
  status text check (status in ('INC','IP','DR','WDRW')),
  source text not null check (source in ('computed','manual')),
  percent_basis numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((grade_value is null) <> (status is null)),
  constraint final_grades_percent_basis_valid
    check (percent_basis is null or (percent_basis >= 0 and percent_basis <= 100)),
  check (grade_value is null or ((grade_value >= 1 and grade_value <= 5) and grade_value in (1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,4,5)))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.grading_rules'::regclass
      and conname = 'grading_rules_grade_valid'
  ) then
    alter table public.grading_rules
      add constraint grading_rules_grade_valid
      check (grade in (1,1.25,1.5,1.75,2,2.25,2.5,2.75,3,4,5));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.final_grades'::regclass
      and conname = 'final_grades_percent_basis_valid'
  ) then
    alter table public.final_grades
      add constraint final_grades_percent_basis_valid
      check (percent_basis is null or (percent_basis >= 0 and percent_basis <= 100));
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  perform public.ensure_default_grading_profile(new.id);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
on conflict (id) do nothing;

do $$
declare
  existing_user record;
begin
  for existing_user in select id from auth.users loop
    perform public.ensure_default_grading_profile(existing_user.id);
  end loop;
end;
$$;

do $$ begin
  alter table public.profiles add constraint profiles_active_semester_fk
    foreign key (active_semester_id) references public.semesters(id) on delete set null;
exception when duplicate_object then null;
end $$;

create or replace function public.set_active_semester(p_semester_id uuid)
returns public.semesters
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_semester public.semesters;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.semesters
  set status = 'archived'
  where user_id = current_user_id
    and status = 'active'
    and id <> p_semester_id;

  update public.semesters
  set status = 'active'
  where id = p_semester_id and user_id = current_user_id
  returning * into selected_semester;

  if not found then
    raise exception 'Semester not found or access denied.' using errcode = 'P0002';
  end if;

  update public.profiles
  set active_semester_id = p_semester_id
  where id = current_user_id;

  return selected_semester;
end;
$$;
revoke all on function public.set_active_semester(uuid) from public, anon;
grant execute on function public.set_active_semester(uuid) to authenticated;

create or replace function public.set_default_grading_profile(p_profile_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.grading_profiles
    where id = p_profile_id and user_id = current_user_id
  ) then
    raise exception 'Grading profile not found or access denied.' using errcode = 'P0002';
  end if;

  update public.grading_profiles
  set is_default = false
  where user_id = current_user_id and is_default and id <> p_profile_id;

  update public.grading_profiles
  set is_default = true
  where id = p_profile_id and user_id = current_user_id;
end;
$$;
revoke all on function public.set_default_grading_profile(uuid) from public, anon;
grant execute on function public.set_default_grading_profile(uuid) to authenticated;

create or replace function public.clear_my_gradi_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.semesters where user_id = current_user_id;
  delete from public.grading_rules where user_id = current_user_id;
  delete from public.grading_profiles
  where user_id = current_user_id and not is_default;
  insert into public.grading_profiles (user_id, name, is_default)
  values (current_user_id, 'Default', true)
  on conflict (user_id) where is_default do nothing;
  update public.grading_profiles
  set name = 'Default', description = null
  where user_id = current_user_id and is_default;
  update public.profiles
  set full_name = null,
      university = 'MSU-IIT',
      program = null,
      year_level = null,
      active_semester_id = null,
      gwa_decimals = 2
  where id = current_user_id;
end;
$$;
revoke all on function public.clear_my_gradi_data() from public, anon;
grant execute on function public.clear_my_gradi_data() to authenticated;

create or replace function public.create_semester(
  p_academic_year text,
  p_term text,
  p_start_date date,
  p_end_date date,
  p_status text
)
returns public.semesters
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_semester public.semesters;
begin
  if p_status is null or p_status not in ('active', 'archived') then
    raise exception 'Semester status must be active or archived.';
  end if;

  insert into public.semesters (academic_year, term, start_date, end_date, status)
  values (
    p_academic_year,
    p_term,
    p_start_date,
    p_end_date,
    case when p_status = 'active' then 'archived' else p_status end
  )
  returning * into created_semester;

  if p_status = 'active' then
    return public.set_active_semester(created_semester.id);
  end if;

  return created_semester;
end;
$$;
revoke all on function public.create_semester(text, text, date, date, text) from public, anon;
grant execute on function public.create_semester(text, text, date, date, text) to authenticated;

-- Child insert/update policies also verify ownership of the parent row.
drop policy if exists "subjects_insert" on public.subjects;
create policy "subjects_insert" on public.subjects for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.semesters s
    where s.id = semester_id and s.user_id = (select auth.uid())
  )
  and (
    grading_profile_id is null
    or exists (
      select 1 from public.grading_profiles p
      where p.id = grading_profile_id and p.user_id = (select auth.uid())
    )
  )
);
drop policy if exists "subjects_update" on public.subjects;
create policy "subjects_update" on public.subjects for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.semesters s
    where s.id = semester_id and s.user_id = (select auth.uid())
  )
  and (
    grading_profile_id is null
    or exists (
      select 1 from public.grading_profiles p
      where p.id = grading_profile_id and p.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "assessment_categories_insert" on public.assessment_categories;
create policy "assessment_categories_insert" on public.assessment_categories for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  )
);
drop policy if exists "assessment_categories_update" on public.assessment_categories;
create policy "assessment_categories_update" on public.assessment_categories for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists "assessments_insert" on public.assessments;
create policy "assessments_insert" on public.assessments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.assessment_categories c
    where c.id = category_id
      and c.subject_id = assessments.subject_id
      and c.user_id = (select auth.uid())
  )
);
drop policy if exists "assessments_update" on public.assessments;
create policy "assessments_update" on public.assessments for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.assessment_categories c
    where c.id = category_id
      and c.subject_id = assessments.subject_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "final_grades_insert" on public.final_grades;
create policy "final_grades_insert" on public.final_grades for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  )
);
drop policy if exists "final_grades_update" on public.final_grades;
create policy "final_grades_update" on public.final_grades for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.subjects s
    where s.id = subject_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists "grading_rules_insert" on public.grading_rules;
create policy "grading_rules_insert" on public.grading_rules for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.grading_profiles p
    where p.id = grading_profile_id and p.user_id = (select auth.uid())
  )
);
drop policy if exists "grading_rules_update" on public.grading_rules;
create policy "grading_rules_update" on public.grading_rules for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.grading_profiles p
    where p.id = grading_profile_id and p.user_id = (select auth.uid())
  )
);

create index if not exists semesters_user_idx on public.semesters(user_id);
create index if not exists grading_profiles_user_idx on public.grading_profiles(user_id);
create index if not exists grading_rules_profile_idx on public.grading_rules(grading_profile_id);
create index if not exists grading_rules_user_idx on public.grading_rules(user_id);
create index if not exists subjects_semester_idx on public.subjects(semester_id);
create index if not exists subjects_user_idx on public.subjects(user_id);
create index if not exists subjects_grading_profile_idx on public.subjects(grading_profile_id);
create index if not exists categories_subject_idx on public.assessment_categories(subject_id);
create index if not exists categories_user_idx on public.assessment_categories(user_id);
create index if not exists assessments_subject_idx on public.assessments(subject_id);
create index if not exists assessments_category_idx on public.assessments(category_id);
create index if not exists assessments_user_idx on public.assessments(user_id);
create index if not exists final_grades_subject_idx on public.final_grades(subject_id);
create index if not exists final_grades_user_idx on public.final_grades(user_id);
create index if not exists profiles_active_semester_idx on public.profiles(active_semester_id);

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_semesters on public.semesters;
create trigger set_updated_at_semesters before update on public.semesters for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_grading_profiles on public.grading_profiles;
create trigger set_updated_at_grading_profiles before update on public.grading_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_grading_rules on public.grading_rules;
create trigger set_updated_at_grading_rules before update on public.grading_rules for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_subjects on public.subjects;
create trigger set_updated_at_subjects before update on public.subjects for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_categories on public.assessment_categories;
create trigger set_updated_at_categories before update on public.assessment_categories for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_assessments on public.assessments;
create trigger set_updated_at_assessments before update on public.assessments for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_final_grades on public.final_grades;
create trigger set_updated_at_final_grades before update on public.final_grades for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.grading_profiles enable row level security;
alter table public.grading_rules enable row level security;
alter table public.subjects enable row level security;
alter table public.assessment_categories enable row level security;
alter table public.assessments enable row level security;
alter table public.final_grades enable row level security;

grant select, insert, update, delete on
  public.profiles,
  public.semesters,
  public.grading_profiles,
  public.grading_rules,
  public.subjects,
  public.assessment_categories,
  public.assessments,
  public.final_grades
to authenticated;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert to authenticated
with check (
  (select auth.uid()) = id
  and (
    active_semester_id is null
    or exists (
      select 1 from public.semesters s
      where s.id = active_semester_id and s.user_id = (select auth.uid())
    )
  )
);
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and (
    active_semester_id is null
    or exists (
      select 1 from public.semesters s
      where s.id = active_semester_id and s.user_id = (select auth.uid())
    )
  )
);
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

do $$
declare table_name text;
begin
  foreach table_name in array array['semesters','grading_profiles','subjects','assessment_categories','assessments','final_grades','grading_rules'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', table_name);
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    if table_name not in ('subjects','assessment_categories','assessments','final_grades','grading_rules') then
      execute format('drop policy if exists "%1$s_insert" on public.%1$s', table_name);
      execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
      execute format('drop policy if exists "%1$s_update" on public.%1$s', table_name);
      execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    end if;
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', table_name);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;
