create or replace function public.append_assistant_message(
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text,
  p_metadata jsonb default '{}'::jsonb,
  p_client_message_id uuid default null
)
returns setof public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_message public.chat_messages;
  owner_id uuid;
begin
  if p_user_id is null or auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'User is not authorized' using errcode = '42501';
  end if;

  select c.user_id into owner_id
  from public.conversations c
  where c.id = p_conversation_id;

  if owner_id is null or owner_id <> p_user_id then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;

  if p_content is null or char_length(p_content) not between 1 and 12000 then
    raise exception 'Invalid assistant message content' using errcode = '22023';
  end if;

  insert into public.chat_messages (
    conversation_id, user_id, role, content, metadata, client_message_id
  )
  values (
    p_conversation_id,
    p_user_id,
    'assistant',
    p_content,
    coalesce(p_metadata, '{}'::jsonb),
    p_client_message_id
  )
  on conflict (conversation_id, client_message_id, role) do nothing;

  select m.* into inserted_message
  from public.chat_messages m
  where m.conversation_id = p_conversation_id
    and m.user_id = p_user_id
    and m.role = 'assistant'
    and (
      (p_client_message_id is not null and m.client_message_id = p_client_message_id)
      or (p_client_message_id is null and m.created_at = (
        select max(latest.created_at)
        from public.chat_messages latest
        where latest.conversation_id = p_conversation_id
          and latest.user_id = p_user_id
          and latest.role = 'assistant'
      ))
    )
  order by m.created_at desc
  limit 1;

  return next inserted_message;
end;
$$;

revoke all on function public.append_assistant_message(uuid, uuid, text, jsonb, uuid)
from public, anon, authenticated;
grant usage on schema public to authenticated;
grant execute on function public.append_assistant_message(uuid, uuid, text, jsonb, uuid)
to authenticated;
