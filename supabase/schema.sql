-- Investment Dashboard Schema

create table if not exists securities (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  gf_ticker text,
  name text not null,
  isin text,
  currency text default 'EUR',
  strategy text not null check (strategy in ('Basis','Saisonalitäten','Aktien-Trading','Krypto')),
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('Kauf','Verkauf')),
  security_id uuid references securities(id),
  shares numeric not null,
  price numeric not null,
  fees numeric default 0,
  taxes numeric default 0,
  amount numeric not null,
  currency text default 'EUR',
  strategy text not null check (strategy in ('Basis','Saisonalitäten','Aktien-Trading','Krypto')),
  source text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists cashflows (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text,
  amount numeric not null,
  category text not null check (category in ('Einzahlung','Auszahlung','Zinsen','Dividende','Gebühr','Steuererstattung')),
  isin text,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_transactions_security_id on transactions(security_id);
create index if not exists idx_transactions_strategy on transactions(strategy);
create index if not exists idx_cashflows_date on cashflows(date);
create index if not exists idx_cashflows_category on cashflows(category);
