-- Joylogue cloud sharing schema.
-- Run this entire file in the Supabase SQL Editor.
-- Anonymous sign-ins must also be enabled in Authentication > Providers.

create extension if not exists pgcrypto with schema extensions;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player'
    check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  invite_id uuid references public.invite_links (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);

-- Store each friendship once, with UUIDs in a stable order.
create table if not exists public.friendships (
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low::text < user_high::text)
);

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

-- This is a share-safe snapshot of SQLite, not the cloud source of truth.
-- Notes and discovery source URLs are deliberately excluded.
create table if not exists public.shared_library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  igdb_id bigint not null check (igdb_id > 0),
  game_name text not null check (char_length(game_name) between 1 and 200),
  slug text,
  cover_url text,
  release_date date,
  platforms text[] not null default '{}',
  genres text[] not null default '{}',
  game_modes text[] not null default '{}',
  status text not null default 'want-to-play'
    check (status in (
      'want-to-play',
      'playing',
      'completed',
      'shelved',
      'abandoned'
    )),
  rating numeric(2, 1) check (
    rating is null or (
      rating between 0.5 and 5
      and rating * 2 = trunc(rating * 2)
    )
  ),
  progress_current integer not null default 0 check (progress_current >= 0),
  progress_total integer not null default 100 check (progress_total > 0),
  added_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  is_visible boolean not null default true,
  synced_at timestamptz not null default now(),
  unique (owner_id, igdb_id),
  check (progress_current <= progress_total)
);

create index if not exists invite_links_owner_id_idx
  on public.invite_links (owner_id);

create index if not exists friend_requests_receiver_status_idx
  on public.friend_requests (receiver_id, status, created_at desc);

create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);

create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests (
    (least(sender_id::text, receiver_id::text)),
    (greatest(sender_id::text, receiver_id::text))
  )
  where status = 'pending';

create index if not exists shared_library_items_owner_status_idx
  on public.shared_library_items (owner_id, status, synced_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Player')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles if Auth users existed before this schema was installed.
insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data ->> 'display_name', ''), 'Player')
from auth.users as users
on conflict (id) do nothing;

create or replace function public.is_friend(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships as friendship
    where friendship.user_low = least(auth.uid()::text, other_user::text)::uuid
      and friendship.user_high = greatest(auth.uid()::text, other_user::text)::uuid
  );
$$;

-- Only safe preview fields are returned. The raw invite row remains private.
drop function if exists public.get_invite_preview(uuid);
create function public.get_invite_preview(invite_token uuid)
returns table (
  owner_id uuid,
  display_name text,
  avatar_url text,
  shared_game_count bigint,
  expires_at timestamptz,
  visible_cover_urls text[],
  relationship_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invite.owner_id,
    profile.display_name,
    profile.avatar_url,
    (
      select count(*)
      from public.shared_library_items as item
      where item.owner_id = invite.owner_id
        and item.is_visible
    ),
    invite.expires_at,
    coalesce(
      array(
        select item.cover_url
        from public.shared_library_items as item
        where item.owner_id = invite.owner_id
          and item.is_visible
          and item.cover_url is not null
        order by item.synced_at desc
        limit 3
      ),
      array[]::text[]
    ),
    case
      when invite.owner_id = auth.uid() then 'self'
      when public.is_friend(invite.owner_id) then 'friends'
      when exists (
        select 1
        from public.friend_requests as request
        where request.status = 'pending'
          and (
            (request.sender_id = auth.uid() and request.receiver_id = invite.owner_id)
            or
            (request.receiver_id = auth.uid() and request.sender_id = invite.owner_id)
          )
      ) then 'request-sent'
      else 'available'
    end
  from public.invite_links as invite
  join public.profiles as profile on profile.id = invite.owner_id
  where invite.token = invite_token
    and invite.revoked_at is null
    and (invite.expires_at is null or invite.expires_at > now())
    and (invite.max_uses is null or invite.use_count < invite.max_uses);
$$;

-- Redeeming an invite creates a pending request. The invite owner must accept it.
create or replace function public.request_friendship(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invite public.invite_links%rowtype;
  existing_request_id uuid;
  new_request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select candidate.*
  into invite
  from public.invite_links as candidate
  where candidate.token = invite_token
  for update;

  if invite.id is null
    or invite.revoked_at is not null
    or (invite.expires_at is not null and invite.expires_at <= now())
    or (invite.max_uses is not null and invite.use_count >= invite.max_uses)
  then
    raise exception 'Invite is invalid or expired' using errcode = '22023';
  end if;

  if invite.owner_id = current_user_id then
    raise exception 'You cannot use your own invite' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.user_blocks as user_block
    where (user_block.blocker_id = current_user_id and user_block.blocked_id = invite.owner_id)
      or (user_block.blocker_id = invite.owner_id and user_block.blocked_id = current_user_id)
  ) then
    raise exception 'This player is unavailable' using errcode = '42501';
  end if;

  if public.is_friend(invite.owner_id) then
    return null;
  end if;

  select request.id
  into existing_request_id
  from public.friend_requests as request
  where request.status = 'pending'
    and (
      (request.sender_id = current_user_id and request.receiver_id = invite.owner_id)
      or
      (request.sender_id = invite.owner_id and request.receiver_id = current_user_id)
    )
  limit 1;

  if existing_request_id is not null then
    return existing_request_id;
  end if;

  insert into public.friend_requests (sender_id, receiver_id, invite_id)
  values (current_user_id, invite.owner_id, invite.id)
  returning id into new_request_id;

  update public.invite_links
  set use_count = use_count + 1
  where id = invite.id;

  return new_request_id;
end;
$$;

create or replace function public.respond_to_friend_request(
  friend_request_id uuid,
  accept_request boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request public.friend_requests%rowtype;
  low_user uuid;
  high_user uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select candidate.*
  into request
  from public.friend_requests as candidate
  where candidate.id = friend_request_id
  for update;

  if request.id is null
    or request.receiver_id <> current_user_id
    or request.status <> 'pending'
  then
    raise exception 'Pending friend request not found' using errcode = '22023';
  end if;

  if accept_request then
    low_user := least(request.sender_id::text, request.receiver_id::text)::uuid;
    high_user := greatest(request.sender_id::text, request.receiver_id::text)::uuid;

    insert into public.friendships (user_low, user_high)
    values (low_user, high_user)
    on conflict (user_low, user_high) do nothing;

    update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = request.id;
  else
    update public.friend_requests
    set status = 'declined', responded_at = now()
    where id = request.id;
  end if;

  return accept_request;
end;
$$;

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

alter table public.profiles enable row level security;
alter table public.invite_links enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.shared_library_items enable row level security;

drop policy if exists profiles_select_own_or_friends on public.profiles;
create policy profiles_select_own_or_friends
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_friend(id)
  or exists (
    select 1
    from public.friend_requests as request
    where request.status = 'pending'
      and (
        (request.sender_id = auth.uid() and request.receiver_id = profiles.id)
        or
        (request.receiver_id = auth.uid() and request.sender_id = profiles.id)
      )
  )
);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists invite_links_manage_own on public.invite_links;
create policy invite_links_manage_own
on public.invite_links for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists friend_requests_select_participant on public.friend_requests;
create policy friend_requests_select_participant
on public.friend_requests for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists friend_requests_cancel_sent on public.friend_requests;
create policy friend_requests_cancel_sent
on public.friend_requests for delete
to authenticated
using (sender_id = auth.uid() and status = 'pending');

drop policy if exists friendships_select_participant on public.friendships;
create policy friendships_select_participant
on public.friendships for select
to authenticated
using (user_low = auth.uid() or user_high = auth.uid());

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists shared_library_items_select_own_or_friends
  on public.shared_library_items;
create policy shared_library_items_select_own_or_friends
on public.shared_library_items for select
to authenticated
using (
  owner_id = auth.uid()
  or (is_visible and public.is_friend(owner_id))
);

drop policy if exists shared_library_items_insert_own
  on public.shared_library_items;
create policy shared_library_items_insert_own
on public.shared_library_items for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists shared_library_items_update_own
  on public.shared_library_items;
create policy shared_library_items_update_own
on public.shared_library_items for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists shared_library_items_delete_own
  on public.shared_library_items;
create policy shared_library_items_delete_own
on public.shared_library_items for delete
to authenticated
using (owner_id = auth.uid());

revoke all on public.profiles from public, anon;
revoke all on public.invite_links from public, anon;
revoke all on public.friend_requests from public, anon;
revoke all on public.friendships from public, anon;
revoke all on public.user_blocks from public, anon;
revoke all on public.shared_library_items from public, anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.invite_links to authenticated;
grant select, delete on public.friend_requests to authenticated;
grant select on public.friendships to authenticated;
grant select on public.user_blocks to authenticated;
grant select, insert, update, delete on public.shared_library_items to authenticated;

revoke all on function public.is_friend(uuid) from public;
revoke all on function public.get_invite_preview(uuid) from public;
revoke all on function public.request_friendship(uuid) from public;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
revoke all on function public.block_user(uuid) from public;

grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.get_invite_preview(uuid) to authenticated;
grant execute on function public.request_friendship(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean)
  to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;

comment on table public.shared_library_items is
  'Friend-facing snapshot of the local SQLite backlog. Private notes and source URLs are excluded.';
comment on function public.request_friendship(uuid) is
  'Redeems an invite token and creates a pending friend request.';
