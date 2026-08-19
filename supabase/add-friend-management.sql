-- Apply this migration to existing Joylogue Supabase projects.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.prevent_blocked_friend_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.user_blocks as user_block
    where (user_block.blocker_id = new.sender_id and user_block.blocked_id = new.receiver_id)
      or (user_block.blocker_id = new.receiver_id and user_block.blocked_id = new.sender_id)
  ) then
    raise exception 'This player is unavailable' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists friend_requests_prevent_blocked on public.friend_requests;
create trigger friend_requests_prevent_blocked
before insert or update of sender_id, receiver_id on public.friend_requests
for each row execute function public.prevent_blocked_friend_request();

create or replace function public.remove_friend(other_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if other_user is null or other_user = current_user_id then
    raise exception 'Invalid friend' using errcode = '22023';
  end if;

  delete from public.friendships
  where user_low = least(current_user_id::text, other_user::text)::uuid
    and user_high = greatest(current_user_id::text, other_user::text)::uuid;
end;
$$;

create or replace function public.block_user(other_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if other_user is null or other_user = current_user_id then
    raise exception 'Invalid player' using errcode = '22023';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (current_user_id, other_user)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where user_low = least(current_user_id::text, other_user::text)::uuid
    and user_high = greatest(current_user_id::text, other_user::text)::uuid;

  delete from public.friend_requests
  where (sender_id = current_user_id and receiver_id = other_user)
    or (sender_id = other_user and receiver_id = current_user_id);
end;
$$;

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

revoke all on public.user_blocks from public, anon;
grant select on public.user_blocks to authenticated;

revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
