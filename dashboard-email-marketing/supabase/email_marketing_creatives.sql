create table if not exists public.email_marketing_creatives (
  dispatch_id text primary key,
  month_key text not null,
  campaign_name text not null,
  subject text,
  campaign_link text,
  html_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_marketing_creatives enable row level security;

comment on table public.email_marketing_creatives is
  'HTML oficial das peças de email, vinculado ao disparo granular do dashboard LATAM.';

comment on column public.email_marketing_creatives.dispatch_id is
  'Identificador único do disparo em email_marketing_campaign_metrics.';

create index if not exists email_marketing_creatives_month_key_idx
  on public.email_marketing_creatives (month_key);

create index if not exists email_marketing_creatives_updated_at_idx
  on public.email_marketing_creatives (updated_at desc);
