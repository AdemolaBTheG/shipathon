-- Run this once in the Supabase SQL Editor if the base Joylogue schema was
-- installed before invite previews included cover art and relationship state.

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

revoke all on function public.get_invite_preview(uuid) from public;
grant execute on function public.get_invite_preview(uuid) to authenticated;

comment on function public.get_invite_preview(uuid) is
  'Returns safe inviter metadata, visible cover art, and request state for a valid invite.';
