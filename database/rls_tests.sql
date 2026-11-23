-- Manual two-user RLS verification for Supabase SQL Editor.
-- Replace every A_UUID and B_UUID with the auth.users.id UUID for two real accounts.
-- Run the whole script in one execution while the SQL Editor uses its default
-- postgres role. Test rows are temporary and rolled back at the end.
--
-- Expected: every assertion prints a PASS notice. Any failed assertion raises
-- an exception and stops the script. The cross-owner insert tests catch the
-- expected row-level-security error and report PASS.

begin;

-- Temporary relational fixtures are created as the SQL Editor's postgres role.
insert into public.profiles (id, full_name)
values ('A_UUID'::uuid, 'RLS test A'), ('B_UUID'::uuid, 'RLS test B')
on conflict (id) do nothing;

insert into public.semesters (id, user_id, academic_year, term, status, start_date)
values
  ('b0000000-0000-4000-8000-000000000001', 'A_UUID'::uuid, '2098-2099', 'midyear', 'archived', '2098-01-01'),
  ('b0000000-0000-4000-8000-000000000002', 'B_UUID'::uuid, '2098-2099', 'midyear', 'archived', '2098-01-01');

insert into public.grading_profiles (id, user_id, name, is_default)
values
  ('b0000000-0000-4000-8000-000000000003', 'A_UUID'::uuid, 'RLS test profile', false),
  ('b0000000-0000-4000-8000-000000000004', 'B_UUID'::uuid, 'RLS test profile', false);

insert into public.grading_rules (id, user_id, grading_profile_id, min_percent, max_percent, grade)
values
  ('b0000000-0000-4000-8000-000000000013', 'A_UUID'::uuid, 'b0000000-0000-4000-8000-000000000003', 0, 100, 1),
  ('b0000000-0000-4000-8000-000000000014', 'B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000004', 0, 100, 1);

insert into public.subjects (
  id, user_id, semester_id, code, name, units, tracking_mode, weighting_mode, grading_profile_id
)
values
  ('b0000000-0000-4000-8000-000000000005', 'A_UUID'::uuid, 'b0000000-0000-4000-8000-000000000001', 'RLS-A', 'RLS Test Subject A', 3, 'assessments', 'category', 'b0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000006', 'B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000002', 'RLS-B', 'RLS Test Subject B', 3, 'assessments', 'category', 'b0000000-0000-4000-8000-000000000004');

insert into public.assessment_categories (id, user_id, subject_id, name, type)
values
  ('b0000000-0000-4000-8000-000000000007', 'A_UUID'::uuid, 'b0000000-0000-4000-8000-000000000005', 'RLS test category', 'quiz'),
  ('b0000000-0000-4000-8000-000000000008', 'B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000006', 'RLS test category', 'quiz');

insert into public.assessments (
  id, user_id, subject_id, category_id, name, input_method, weight, is_completed
)
values
  ('b0000000-0000-4000-8000-000000000009', 'A_UUID'::uuid, 'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000007', 'RLS test assessment', 'raw', 0, false),
  ('b0000000-0000-4000-8000-000000000010', 'B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000008', 'RLS test assessment', 'raw', 0, false);

insert into public.final_grades (id, user_id, subject_id, status, source)
values
  ('b0000000-0000-4000-8000-000000000011', 'A_UUID'::uuid, 'b0000000-0000-4000-8000-000000000005', 'IP', 'manual'),
  ('b0000000-0000-4000-8000-000000000012', 'B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000006', 'IP', 'manual');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'A_UUID', true);

do $$
declare
  visible_count bigint;
begin
  if auth.uid() <> 'A_UUID'::uuid then
    raise exception 'FAIL: user A claims were not applied.';
  end if;

  select count(*) into visible_count from public.semesters where id = 'b0000000-0000-4000-8000-000000000001';
  if visible_count <> 1 then raise exception 'FAIL: user A cannot read their own semester.'; end if;
  select count(*) into visible_count from public.semesters where id = 'b0000000-0000-4000-8000-000000000002';
  if visible_count <> 0 then raise exception 'FAIL: user A can read user B semester.'; end if;
  raise notice 'PASS: user A reads own semester and cannot read user B semester.';
end;
$$;

select set_config('request.jwt.claim.sub', 'B_UUID', true);

do $$
declare
  user_a_row record;
  visible_count bigint;
  affected_rows bigint;
begin
  if auth.uid() <> 'B_UUID'::uuid then
    raise exception 'FAIL: user B claims were not applied.';
  end if;

  for user_a_row in
    select * from (values
      ('profiles', 'A_UUID'::uuid),
      ('semesters', 'b0000000-0000-4000-8000-000000000001'::uuid),
      ('grading_profiles', 'b0000000-0000-4000-8000-000000000003'::uuid),
      ('grading_rules', 'b0000000-0000-4000-8000-000000000013'::uuid),
      ('subjects', 'b0000000-0000-4000-8000-000000000005'::uuid),
      ('assessment_categories', 'b0000000-0000-4000-8000-000000000007'::uuid),
      ('assessments', 'b0000000-0000-4000-8000-000000000009'::uuid),
      ('final_grades', 'b0000000-0000-4000-8000-000000000011'::uuid)
    ) as user_a_rows(table_name, target_id)
  loop
    execute format('select count(*) from public.%I where id = $1', user_a_row.table_name)
      into visible_count using user_a_row.target_id;
    if visible_count <> 0 then
      raise exception 'FAIL: user B can read user A rows in %.', user_a_row.table_name;
    end if;

    execute format('update public.%I set updated_at = updated_at where id = $1', user_a_row.table_name)
      using user_a_row.target_id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'FAIL: user B can update user A rows in %.', user_a_row.table_name;
    end if;

    execute format('delete from public.%I where id = $1', user_a_row.table_name)
      using user_a_row.target_id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'FAIL: user B can delete user A rows in %.', user_a_row.table_name;
    end if;
  end loop;
  raise notice 'PASS: user B cannot read, update, or delete user A rows in any table.';

  begin
    insert into public.semesters (user_id, academic_year, term, status, start_date)
    values ('A_UUID'::uuid, '2097-2098', 'midyear', 'archived', '2097-01-01');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-user semester insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: cross-user semester insert rejected.';
  end;

  begin
    insert into public.profiles (id, full_name)
    values ('A_UUID'::uuid, 'Cross-owner profile');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-user profile insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: cross-user profile insert rejected.';
  end;

  begin
    insert into public.grading_profiles (user_id, name)
    values ('A_UUID'::uuid, 'Cross-owner grading profile');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-user grading profile insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: cross-user grading profile insert rejected.';
  end;

  begin
    insert into public.subjects (
      user_id, semester_id, code, name, units, tracking_mode, weighting_mode
    )
    values ('B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000001', 'RLS-X', 'Cross-owner subject', 3, 'assessments', 'category');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner subject insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: subject insert referencing another user semester rejected.';
  end;

  begin
    insert into public.subjects (
      user_id, semester_id, code, name, units, tracking_mode, weighting_mode, grading_profile_id
    )
    values ('B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000002', 'RLS-Y', 'Cross-owner profile subject', 3, 'assessments', 'category', 'b0000000-0000-4000-8000-000000000003');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner grading profile assignment succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: subject cannot reference another user grading profile.';
  end;

  begin
    insert into public.assessment_categories (user_id, subject_id, name, type)
    values ('B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000005', 'Cross-owner category', 'quiz');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner category insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: category insert referencing another user subject rejected.';
  end;

  begin
    insert into public.assessments (
      user_id, subject_id, category_id, name, input_method, weight, is_completed
    )
    values ('B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000007', 'Cross-owner assessment', 'raw', 0, false);
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner assessment insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: assessment insert referencing another user subject/category rejected.';
  end;

  begin
    insert into public.grading_rules (user_id, grading_profile_id, min_percent, max_percent, grade)
    values ('B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000003', 0, 100, 1);
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner grading rule insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: grading rule insert referencing another user profile rejected.';
  end;

  begin
    insert into public.final_grades (user_id, subject_id, status, source)
    values ('B_UUID'::uuid, 'b0000000-0000-4000-8000-000000000005', 'IP', 'manual');
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner final grade insert succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: final grade insert referencing another user subject rejected.';
  end;

  begin
    update public.profiles
    set active_semester_id = 'b0000000-0000-4000-8000-000000000001'
    where id = 'B_UUID'::uuid;
    raise exception using errcode = 'P0001', message = 'FAIL: cross-owner active semester assignment succeeded.';
  exception when insufficient_privilege then
    raise notice 'PASS: profile cannot point to another user semester.';
  end;
end;
$$;

reset role;
rollback;

-- After running, the SQL Editor should report successful completion and PASS
-- notices above. The transaction rollback removes all RLS test fixtures.
