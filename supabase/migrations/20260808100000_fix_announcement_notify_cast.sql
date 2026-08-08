-- =============================================================================
-- お知らせ通知の型不一致を直す
--
-- users.role は列挙型 user_role、announcements.target_role は text。
-- そのまま比較すると「operator does not exist: user_role = text」で落ちる。
-- RLS 側は最初から auth_user_role()::text と書いてあったので、同じ形に揃える。
-- =============================================================================

create or replace function public.notify_announcement_sent()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.sent_at is null or (tg_op = 'UPDATE' and old.sent_at is not null) then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, subject_table, subject_id)
  select u.id, 'announcement', new.title, new.body, 'announcements', new.id
    from public.users u
   where u.active
     and u.id <> new.author_id
     and (new.target_role is null or u.role::text = new.target_role)
     and (
       new.business_id is null
       or (u.role = 'parent' and exists (
             select 1 from public.students s
              where s.parent_id = u.id and s.business_id = new.business_id and s.active))
       or (u.role = 'employee' and exists (
             select 1 from public.employee_businesses eb
              where eb.employee_id = u.id and eb.business_id = new.business_id))
     );
  return new;
end;
$$;
