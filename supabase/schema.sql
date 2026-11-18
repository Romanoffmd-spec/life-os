-- Life OS: схема базы Supabase (Postgres)
-- Выполнить один раз: Supabase Dashboard -> SQL Editor -> New query -> вставить весь файл -> Run.
-- Повторный запуск безопасен (idempotent).

create extension if not exists pgcrypto;

-- =========================================================
-- 1. Универсальное хранилище записей приложения (offline-first sync)
-- =========================================================
create table if not exists public.items (
  id          text        not null,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  bigint      not null,               -- время изменения на клиенте (ms), для LWW
  deleted     boolean     not null default false,
  server_ts   timestamptz not null default clock_timestamp(), -- курсор синхронизации (время сервера)
  primary key (user_id, id)
);
create index if not exists items_user_server_ts on public.items (user_id, server_ts);

alter table public.items enable row level security;
drop policy if exists items_owner on public.items;
create policy items_owner on public.items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Пакетная запись с разрешением конфликтов last-write-wins по updated_at клиента.
create or replace function public.sync_push(p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  with incoming as (
    select (e->>'id')::text            as id,
           (e->>'kind')::text          as kind,
           coalesce(e->'data', '{}')   as data,
           (e->>'updated_at')::bigint  as updated_at,
           coalesce((e->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(p_items) e
  ), up as (
    insert into public.items (id, user_id, kind, data, updated_at, deleted, server_ts)
    select id, auth.uid(), kind, data, updated_at, deleted, clock_timestamp() from incoming
    on conflict (user_id, id) do update
      set kind = excluded.kind, data = excluded.data, updated_at = excluded.updated_at,
          deleted = excluded.deleted, server_ts = clock_timestamp()
      where public.items.updated_at < excluded.updated_at
    returning 1
  )
  select count(*) into n from up;
  return n;
end $$;

-- =========================================================
-- 2. Данные Apple Health (приходят из iOS Shortcuts)
-- =========================================================
create table if not exists public.health_samples (
  uid         text        primary key,            -- ключ дедупликации
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null,               -- steps, hrv, sleep, weight ...
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  value       double precision,
  value_text  text,
  unit        text,
  server_ts   timestamptz not null default clock_timestamp()
);
create index if not exists hs_user_server_ts on public.health_samples (user_id, server_ts);
create index if not exists hs_user_type_start on public.health_samples (user_id, type, start_at);

alter table public.health_samples enable row level security;
drop policy if exists hs_owner_read on public.health_samples;
create policy hs_owner_read on public.health_samples for select using (user_id = auth.uid());
drop policy if exists hs_owner_delete on public.health_samples;
create policy hs_owner_delete on public.health_samples for delete using (user_id = auth.uid());

-- Токены для Shortcuts (iPhone / Apple Watch). Хранится только хеш токена.
create table if not exists public.ingest_tokens (
  token_hash  text        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  tz          text        not null default 'Asia/Almaty',
  created_at  timestamptz not null default now(),
  last_used   timestamptz
);
alter table public.ingest_tokens enable row level security;
drop policy if exists it_owner on public.ingest_tokens;
create policy it_owner on public.ingest_tokens for select using (user_id = auth.uid());

-- Создать новый токен (старые токены пользователя отзываются). Возвращает токен один раз.
create or replace function public.create_ingest_token(p_tz text default 'Asia/Almaty')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.ingest_tokens where user_id = auth.uid();
  t := encode(gen_random_bytes(18), 'hex');
  insert into public.ingest_tokens (token_hash, user_id, tz)
  values (encode(digest(t, 'sha256'), 'hex'), auth.uid(), coalesce(p_tz, 'Asia/Almaty'));
  return t;
end $$;
revoke all on function public.create_ingest_token(text) from public, anon;
grant execute on function public.create_ingest_token(text) to authenticated;

create or replace function public._token_user(p_token text, out uid uuid, out tz text)
language sql
security definer
set search_path = public, extensions
as $$
  update public.ingest_tokens set last_used = now()
  where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex')
  returning user_id, tz;
$$;
revoke all on function public._token_user(text) from public, anon, authenticated;

-- Приём пачки измерений одного типа из быстрой команды iOS.
-- p_rows: строки «значение|начало|конец», разделённые ';'. Даты в ISO 8601.
-- Для сна значение текстовое (стадия), для остальных число (десятичная запятая допускается).
create or replace function public.ingest_health(p_token text, p_type text, p_rows text, p_unit text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u uuid; z text;
  rows text[]; parts text[];
  i int; n int := 0; v text; vn text; num double precision; s timestamptz; e timestamptz; k text;
  cumulative boolean;
begin
  select t.uid, t.tz into u, z from public._token_user(p_token) t;
  if u is null then raise exception 'invalid token'; end if;
  p_type := lower(trim(p_type));
  if p_type !~ '^[a-z0-9_]{1,32}$' then raise exception 'bad type'; end if;
  cumulative := p_type in ('steps','distance','active_energy','basal_energy','exercise_min','stand_min','flights');

  rows := string_to_array(coalesce(p_rows, ''), ';');
  if array_length(rows, 1) is null then return jsonb_build_object('ok', true, 'type', p_type, 'received', 0); end if;
  if array_length(rows, 1) > 5000 then raise exception 'too many rows'; end if;

  for i in 1 .. array_length(rows, 1) loop
    parts := string_to_array(rows[i], '|');
    if array_length(parts, 1) is null or array_length(parts, 1) < 2 then continue; end if;
    begin
      s := trim(parts[2])::timestamptz;
      e := coalesce(nullif(trim(coalesce(parts[3], '')), '')::timestamptz, s);
    exception when others then continue;
    end;
    v := trim(coalesce(parts[1], ''));
    -- «72,5», «8 432», «0,97» и т.п. -> число; иначе текст (стадии сна, названия тренировок)
    vn := replace(replace(replace(v, ',', '.'), ' ', ''), chr(160), '');
    vn := regexp_replace(vn, '[^0-9.\-]+$', '');   -- хвост единиц измерения, если Shortcuts его добавил
    if vn ~ '^-?[0-9]+(\.[0-9]+)?$' then num := vn::double precision; else num := null; end if;
    if cumulative then
      k := md5(u::text || '|' || p_type || '|' || s::text);
    else
      k := md5(u::text || '|' || p_type || '|' || s::text || '|' || e::text || '|' || coalesce(v, ''));
    end if;
    insert into public.health_samples (uid, user_id, type, start_at, end_at, value, value_text, unit, server_ts)
    values (k, u, p_type, s, e, num, case when num is null then nullif(left(v, 120), '') end, p_unit, clock_timestamp())
    on conflict (uid) do update
      set value = excluded.value, value_text = excluded.value_text, end_at = excluded.end_at,
          unit = excluded.unit, server_ts = clock_timestamp()
      where health_samples.value is distinct from excluded.value
         or health_samples.end_at is distinct from excluded.end_at;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'type', p_type, 'received', n);
end $$;
drop function if exists public.ingest_health(text,text,text,text,text,text);
revoke all on function public.ingest_health(text,text,text,text) from public;
grant execute on function public.ingest_health(text,text,text,text) to anon, authenticated;

-- Быстрый ввод с Apple Watch / iPhone (Shortcuts): вода, вес, привычка, заметка, энергия.
create or replace function public.quick_log(p_token text, p_kind text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  u uuid; z text; d text; now_ms bigint; hid text; num double precision;
begin
  select t.uid, t.tz into u, z from public._token_user(p_token) t;
  if u is null then raise exception 'invalid token'; end if;
  d := to_char((now() at time zone z)::date, 'YYYY-MM-DD');
  now_ms := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  p_kind := lower(trim(p_kind));
  p_value := trim(coalesce(p_value, ''));
  begin
    num := replace(p_value, ',', '.')::double precision;
  exception when others then num := null;
  end;

  if p_kind = 'water' then
    if num is null or num <= 0 or num > 5000 then raise exception 'bad amount'; end if;
    insert into public.items (id, user_id, kind, data, updated_at)
    values ('w_' || gen_random_uuid(), u, 'water', jsonb_build_object('date', d, 'ml', num, 'src', 'shortcut'), now_ms);
  elsif p_kind = 'weight' then
    if num is null or num < 30 or num > 300 then raise exception 'bad weight'; end if;
    insert into public.items (id, user_id, kind, data, updated_at)
    values ('wt_' || gen_random_uuid(), u, 'weight', jsonb_build_object('date', d, 'kg', num, 'ts', now_ms, 'src', 'shortcut'), now_ms);
  elsif p_kind = 'habit' then
    select id into hid from public.items
     where user_id = u and kind = 'habit' and not deleted and lower(data->>'name') = lower(p_value) limit 1;
    if hid is null then
      select id into hid from public.items
       where user_id = u and kind = 'habit' and not deleted and data->>'name' ilike '%' || p_value || '%' limit 1;
    end if;
    if hid is null then raise exception 'habit not found'; end if;
    insert into public.items (id, user_id, kind, data, updated_at)
    values ('hl_' || hid || '_' || d, u, 'habitlog', jsonb_build_object('habitId', hid, 'date', d, 'status', 'done', 'src', 'shortcut'), now_ms)
    on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at,
      deleted = false, server_ts = clock_timestamp();
  elsif p_kind = 'energy' then
    if num is null or num < 1 or num > 5 then raise exception 'bad energy'; end if;
    insert into public.items (id, user_id, kind, data, updated_at)
    values ('ci_' || d, u, 'checkin', jsonb_build_object('date', d, 'energy', num, 'src', 'shortcut'), now_ms)
    on conflict (user_id, id) do update set data = public.items.data || excluded.data,
      updated_at = excluded.updated_at, server_ts = clock_timestamp();
  elsif p_kind = 'note' then
    if length(p_value) = 0 then raise exception 'empty note'; end if;
    insert into public.items (id, user_id, kind, data, updated_at)
    values ('n_' || gen_random_uuid(), u, 'note', jsonb_build_object('text', left(p_value, 4000), 'date', d, 'src', 'shortcut'), now_ms);
  else
    raise exception 'unknown kind';
  end if;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'date', d);
end $$;
revoke all on function public.quick_log(text,text,text) from public;
grant execute on function public.quick_log(text,text,text) to anon, authenticated;

-- =========================================================
-- 3. Права для ролей Data API (явно, на случай если в проекте отключены права по умолчанию)
-- =========================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, delete on public.health_samples to authenticated;
grant select on public.ingest_tokens to authenticated;
grant execute on function public.sync_push(jsonb) to authenticated;
