-- =============================================================================
-- schedule_employees.employee_id → users の外部キーを足す
--
-- 元は複合外部キー (employee_id, business_id) → employee_businesses だけだった。
-- これで「その事業を担当できる講師か」は担保できるが、employee_id 単独で users を
-- 指す関係が無いため、PostgREST が講師名を埋め込めない。
--   Could not find a relationship between 'schedule_employees' and 'users'
--
-- work_preferences は単独の外部キーと複合外部キーの両方を持っている。
-- schedule_employees だけ単独ぶんが抜けていたので揃える。
--
-- on delete restrict にするのは複合外部キーと同じ理由で、担当したコマが残っている
-- 講師を消せないようにするため（勤務実績が消えると給与の根拠が無くなる）。
-- =============================================================================

alter table public.schedule_employees
  add constraint schedule_employees_employee_id_fkey
  foreign key (employee_id) references public.users (id) on delete restrict;
