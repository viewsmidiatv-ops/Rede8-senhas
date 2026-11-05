create table public.tv_instances (
 id text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
 verification_url text not null check (verification_url like 'https://%'),
 bridge_hash text not null unique check (length(bridge_hash)=64),
 created_at timestamptz not null default now()
);
create table public.tv_queue (
 instance_id text primary key references public.tv_instances(id),
 revision bigint not null check (revision>=0),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 updated_at timestamptz not null default now()
);
create table public.tv_pairings (
 id uuid primary key default gen_random_uuid(),
 instance_id text not null references public.tv_instances(id),
 code_hash text not null unique,
 token_hash text not null unique,
 label text not null check (length(label) between 1 and 80),
 status text not null default 'pending' check (status in ('pending','approved')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '10 minutes')
);
create index tv_pairings_expiration on public.tv_pairings(expires_at);
create index tv_pairings_instance on public.tv_pairings(instance_id,created_at);
create table public.tv_devices (
 id uuid primary key default gen_random_uuid(),
 instance_id text not null references public.tv_instances(id),
 token_hash text not null unique,
 label text not null check (length(label) between 1 and 80),
 approved_by text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 days'),
 revoked_at timestamptz,
 last_seen_at timestamptz
);
create index tv_devices_instance on public.tv_devices(instance_id,created_at);
create table public.tv_limits (
 key text primary key,
 hits integer not null default 0,
 expires_at timestamptz not null
);
create index tv_limits_expiration on public.tv_limits(expires_at);
alter table public.tv_instances enable row level security;
alter table public.tv_queue enable row level security;
alter table public.tv_pairings enable row level security;
alter table public.tv_devices enable row level security;
alter table public.tv_limits enable row level security;
revoke all on public.tv_instances,public.tv_queue,public.tv_pairings,public.tv_devices,public.tv_limits from public,anon,authenticated;
grant select,insert,update,delete on public.tv_instances,public.tv_queue,public.tv_pairings,public.tv_devices,public.tv_limits to service_role;

create function public.tv_pair_start(p_instance text,p_code_hash text,p_token_hash text,p_label text,p_ip_hash text)
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare total integer; deadline timestamptz; rate_key text;
begin
 perform pg_advisory_xact_lock(hashtextextended('tv-pair-'||p_instance,0));
 delete from public.tv_pairings where expires_at<now()-interval '1 hour';
 delete from public.tv_limits where expires_at<now();
 rate_key:=p_instance||':'||p_ip_hash;
 insert into public.tv_limits(key,hits,expires_at) values(rate_key,1,now()+interval '10 minutes')
 on conflict(key) do update set hits=public.tv_limits.hits+1 returning hits into total;
 if total>10 then raise exception 'Muitas tentativas. Aguarde dez minutos.'; end if;
 select count(*) into total from public.tv_pairings where instance_id=p_instance and created_at>now()-interval '10 minutes';
 if total>=100 then raise exception 'Limite temporário de ativações. Tente mais tarde.'; end if;
 insert into public.tv_pairings(instance_id,code_hash,token_hash,label) values(p_instance,p_code_hash,p_token_hash,p_label) returning expires_at into deadline;
 return deadline;
end;
$$;
create function public.tv_pair_approve(p_instance text,p_code_hash text,p_label text,p_actor text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare request public.tv_pairings%rowtype; device_id uuid; total integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('tv-approve-'||p_instance,0));
 select * into request from public.tv_pairings where instance_id=p_instance and code_hash=p_code_hash for update;
 if not found or request.expires_at<=now() or request.status<>'pending' then raise exception 'Código inválido, expirado ou já utilizado.'; end if;
 select count(*) into total from public.tv_devices where instance_id=p_instance and revoked_at is null and expires_at>now();
 if total>=30 then raise exception 'Limite de trinta aparelhos ativos. Desvincule um aparelho.'; end if;
 insert into public.tv_devices(instance_id,token_hash,label,approved_by) values(p_instance,request.token_hash,p_label,p_actor) returning id into device_id;
 update public.tv_pairings set status='approved' where id=request.id;
 return device_id;
end;
$$;
create function public.tv_queue_seed(p_instance text,p_revision bigint,p_payload jsonb)
returns setof public.tv_queue language plpgsql security invoker set search_path='' as $$
begin
 insert into public.tv_queue(instance_id,revision,payload) values(p_instance,p_revision,p_payload) on conflict(instance_id) do nothing;
 return query select * from public.tv_queue where instance_id=p_instance;
end;
$$;
create function public.tv_queue_cas(p_instance text,p_revision bigint,p_payload jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 update public.tv_queue set payload=p_payload,revision=revision+1,updated_at=now() where instance_id=p_instance and revision=p_revision;
 get diagnostics changed=row_count;
 return changed=1;
end;
$$;
revoke all on function public.tv_pair_start(text,text,text,text,text),public.tv_pair_approve(text,text,text,text),public.tv_queue_seed(text,bigint,jsonb),public.tv_queue_cas(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.tv_pair_start(text,text,text,text,text),public.tv_pair_approve(text,text,text,text),public.tv_queue_seed(text,bigint,jsonb),public.tv_queue_cas(text,bigint,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tv-media','tv-media',false,20971520,array['image/png','image/jpeg','image/webp','video/mp4','video/webm']) on conflict(id) do nothing;

revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
