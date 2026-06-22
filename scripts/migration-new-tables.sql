-- Neue Asset-Klassen Tabellen
-- Ausführen in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS optionen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  underlying text NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('Call', 'Put')),
  strike decimal(20,6),
  expiry date,
  contracts integer,
  premium decimal(20,6),
  fees decimal(20,6) DEFAULT 0,
  status text DEFAULT 'offen' CHECK (status IN ('offen', 'geschlossen', 'verfallen', 'ausgeübt')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS immobilien (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  purchase_date date,
  purchase_price decimal(20,2),
  current_value decimal(20,2),
  rental_income_monthly decimal(20,2) DEFAULT 0,
  mortgage_balance decimal(20,2) DEFAULT 0,
  mortgage_rate decimal(10,4),
  area_sqm decimal(10,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firmenbeteiligungen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  sector text,
  stake_pct decimal(10,4),
  purchase_date date,
  invested_amount decimal(20,2),
  current_valuation decimal(20,2),
  annual_dividend decimal(20,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sachwerte (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Sonstiges',
  purchase_date date,
  purchase_price decimal(20,2),
  current_value decimal(20,2),
  quantity decimal(20,6) DEFAULT 1,
  unit text DEFAULT 'Stück',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_positionen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  bank text,
  account_type text DEFAULT 'Tagesgeld',
  amount decimal(20,2) NOT NULL DEFAULT 0,
  interest_rate decimal(10,4) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verbindlichkeiten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  lender text,
  liability_type text DEFAULT 'Konsumkredit',
  original_amount decimal(20,2),
  current_balance decimal(20,2) NOT NULL DEFAULT 0,
  interest_rate decimal(10,4),
  monthly_payment decimal(20,2),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS für alle neuen Tabellen aktivieren (optional, falls benötigt)
-- ALTER TABLE optionen ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE immobilien ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE firmenbeteiligungen ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sachwerte ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cash_positionen ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE verbindlichkeiten ENABLE ROW LEVEL SECURITY;
