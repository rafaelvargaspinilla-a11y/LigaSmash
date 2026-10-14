-- Run once in the Supabase SQL Editor. Existing non-smash resources are untouched.
-- A random 256-bit bearer code authorizes this private group. No user accounts.
create table if not exists public.smash_groups (
  code_hash bytea primary key,
  revision bigint not null default 0 check (revision >= 0),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.smash_groups enable row level security;
revoke all on public.smash_groups from public, anon, authenticated;

create table if not exists public.smash_commits (
 code_hash bytea not null references public.smash_groups(code_hash) on delete cascade,
 batch_id uuid not null,
 primary key(code_hash,batch_id)
);
alter table public.smash_commits enable row level security;
revoke all on public.smash_commits from public,anon,authenticated;

create or replace function public.smash_valid_data(payload jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; allowed text[] := ARRAY['01','02','03','04','04e','05','06','07','08','09','10','11','12','13','13e','14','15','16','17','18','19','20','21','21e','22','23','24','25','25e','26','27','28','28e','29','30','31','32','33-35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','60e','61','62','63','64','65','66','66e','67','68','69','70','71','72','73','74','75','76','77','78','79-80','81','82'];
begin
  if jsonb_typeof(payload) <> 'object' or (payload->'schemaVersion' is distinct from '1'::jsonb and payload->'schemaVersion' is distinct from '2'::jsonb and payload->'schemaVersion' is distinct from '3'::jsonb and payload->'schemaVersion' is distinct from '4'::jsonb) then return false; end if;
  if jsonb_typeof(payload->'players') is distinct from 'array' or jsonb_typeof(payload->'wins') is distinct from 'array' or jsonb_typeof(payload->'favorites') is distinct from 'array' then return false; end if;
  if jsonb_array_length(payload->'players') <> 3 or jsonb_array_length(payload->'favorites') <> 0 or octet_length(payload::text) > 20971520 then return false; end if;
  if (select count(distinct p->>'id') from jsonb_array_elements(payload->'players') p) <> 3 then return false; end if;
  if jsonb_typeof(payload->'exportedAt') is distinct from 'string' then return false; end if;
  perform (payload->>'exportedAt')::timestamptz;
  for item in select value from jsonb_array_elements(payload->'players') loop
    if jsonb_typeof(item) <> 'object' or (item->>'id' = any(array['p1','p2','p3'])) is distinct from true or jsonb_typeof(item->'name') is distinct from 'string' or length(btrim(item->>'name')) not between 1 and 40 then return false; end if;
  end loop;
  if (select count(distinct w->>'id') from jsonb_array_elements(payload->'wins') w) <> jsonb_array_length(payload->'wins') then return false; end if;
  for item in select value from jsonb_array_elements(payload->'wins') loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') not between 1 and 100 or (item->>'playerId'=any(array['p1','p2','p3'])) is distinct from true or (case when item->>'league'='duel' then ((item->'characterId'='""'::jsonb and not (item ? 'opponentCharacterId')) or (payload->'schemaVersion'='4'::jsonb and (item->>'characterId'=any(allowed)) and (item->>'opponentCharacterId'=any(allowed)))) else (item->>'characterId'=any(allowed)) end) is distinct from true then return false; end if;
    if jsonb_typeof(item->'timestamp') is distinct from 'string' or not (item->>'timestamp' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') then return false; end if;
    if to_char((item->>'timestamp')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> item->>'timestamp' then return false; end if;
    if jsonb_typeof(item->'localDate') is distinct from 'string' or not (item->>'localDate' ~ '^\d{4}-\d{2}-\d{2}$') or item->>'localDate' < '1900-01-01' then return false; end if;
    if ((item->>'localDate')::date)::text <> item->>'localDate' then return false; end if;
    if item ? 'league' then
      if item->'league' is distinct from '"duel"'::jsonb or (payload->'schemaVersion' is distinct from '3'::jsonb and payload->'schemaVersion' is distinct from '4'::jsonb) or (item->>'opponentId'=any(array['p1','p2','p3'])) is distinct from true or item->>'opponentId'=item->>'playerId' or item ? 'placements' or item ? 'characters' then return false; end if;
    elsif item ? 'opponentId' or item ? 'opponentCharacterId' then return false;
    end if;
    if item ? 'placements' then
      if payload->'schemaVersion' = '1'::jsonb or jsonb_typeof(item->'placements') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item->'placements')<>3 or item->'placements'->>0 is distinct from item->>'playerId' then return false; end if;
      if (select count(distinct value) from jsonb_array_elements_text(item->'placements'))<>3 then return false; end if;
      if exists(select 1 from jsonb_array_elements_text(item->'placements') p where p.value not in ('p1','p2','p3')) then return false; end if;
      if exists(select 1 from jsonb_array_elements(item->'placements') p where jsonb_typeof(p.value)<>'string') then return false; end if;
    end if;
    if item ? 'characters' then
      if payload->'schemaVersion'='1'::jsonb or not (item ? 'placements') or jsonb_typeof(item->'characters') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item->'characters')<>3 or item->'characters'->>0 is distinct from item->>'characterId' then return false; end if;
      if exists(select 1 from jsonb_array_elements_text(item->'characters') c where c.value is null or not(c.value=any(allowed))) then return false; end if;
      if exists(select 1 from jsonb_array_elements(item->'characters') c where jsonb_typeof(c.value)<>'string') then return false; end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end; $$;
revoke all on function public.smash_valid_data(jsonb) from public, anon, authenticated;

create or replace function public.smash_create_group(group_code text, initial_data jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin
  if group_code is null or group_code !~ '^[a-f0-9]{64}$' then raise exception 'Invalid code'; end if;
  if not public.smash_valid_data(initial_data) then raise exception 'Invalid data'; end if;
  insert into public.smash_groups(code_hash,data) values (sha256(convert_to(group_code,'UTF8')),initial_data);
  return jsonb_build_object('revision',0,'data',initial_data);
end; $$;
create or replace function public.smash_read_group(group_code text, batch_id uuid default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  if group_code is null or group_code !~ '^[a-f0-9]{64}$' then raise exception 'Group unavailable' using errcode='42501'; end if;
  select jsonb_build_object('revision',revision,'data',data,'acknowledged',exists(select 1 from public.smash_commits c where c.code_hash=g.code_hash and c.batch_id=smash_read_group.batch_id)) into result from public.smash_groups g where code_hash=sha256(convert_to(group_code,'UTF8'));
  if result is null then raise exception 'Group unavailable' using errcode='42501'; end if;
  return result;
end; $$;
create or replace function public.smash_write_group(group_code text, expected_revision bigint, new_data jsonb, batch_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare current_group public.smash_groups%rowtype; accepted boolean := false;
begin
  if group_code is null or group_code !~ '^[a-f0-9]{64}$' then raise exception 'Group unavailable' using errcode='42501'; end if;
  if not public.smash_valid_data(new_data) then raise exception 'Invalid data'; end if;
  select * into current_group from public.smash_groups where code_hash=sha256(convert_to(group_code,'UTF8')) for update;
  if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
  if batch_id is null then raise exception 'Missing batch ID'; end if;
  if exists(select 1 from public.smash_commits c where c.code_hash=current_group.code_hash and c.batch_id=smash_write_group.batch_id) then
    accepted := true;
  elsif current_group.revision=expected_revision then
    if (current_group.data->>'schemaVersion')::int > (new_data->>'schemaVersion')::int then raise exception 'Client update required'; end if;
    update public.smash_groups set data=new_data,revision=revision+1,updated_at=now() where code_hash=current_group.code_hash returning * into current_group;
    insert into public.smash_commits(code_hash,batch_id) values(current_group.code_hash,batch_id);
    accepted := true;
  end if;
  return jsonb_build_object('accepted',accepted,'state',jsonb_build_object('revision',current_group.revision,'data',current_group.data));
end; $$;
revoke all on function public.smash_create_group(text,jsonb) from public;
revoke all on function public.smash_read_group(text,uuid) from public;
revoke all on function public.smash_write_group(text,bigint,jsonb,uuid) from public;
grant execute on function public.smash_create_group(text,jsonb) to anon, authenticated;
grant execute on function public.smash_read_group(text,uuid) to anon, authenticated;
grant execute on function public.smash_write_group(text,bigint,jsonb,uuid) to anon, authenticated;
