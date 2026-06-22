# Deployment-Anleitung

## 1. Supabase Setup

### Schritt 1: Supabase-Projekt anlegen
1. Gehe zu [supabase.com](https://supabase.com) → "New project"
2. Region: `eu-central-1` (Frankfurt) wählen
3. Notiere URL und anon key aus **Settings → API**

### Schritt 2: Datenbank-Schema anlegen
Im Supabase SQL Editor folgendes ausführen (aus `supabase/schema.sql`):

```sql
create table if not exists securities ( ... );
create table if not exists transactions ( ... );
create table if not exists cashflows ( ... );
```

→ Datei: `supabase/schema.sql` vollständig in den SQL Editor kopieren und ausführen.

### Schritt 3: Excel-Daten importieren
```bash
# In .env.local eintragen:
NEXT_PUBLIC_SUPABASE_URL=https://DEINE-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Migration ausführen:
node scripts/migrate.js
```

Das Script gibt am Ende eine Zusammenfassung aus:
- Securities in DB: 43
- Transactions in DB: 83
- Cashflows in DB: 166

---

## 2. Lokale Entwicklung

```bash
cd investment-app
npm install
cp .env.local.example .env.local  # Supabase-Daten eintragen
npm run dev
```

Öffne http://localhost:3000

---

## 3. Vercel Deployment

### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

### Option B: Via GitHub
1. Repo auf GitHub pushen
2. [vercel.com](https://vercel.com) → "Import Project" → GitHub-Repo auswählen
3. Framework: Next.js (wird auto-erkannt)

### Umgebungsvariablen in Vercel setzen:
Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL    = https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
```

### Free Tier Limits (bleiben problemlos drunter):
- Vercel: 100 GB Bandwidth/Monat, unlimited deployments
- Supabase: 500 MB DB, 2 GB Storage, 50.000 MAU

---

## 4. Supabase Row Level Security (Optional, für spätere Auth)

```sql
-- RLS aktivieren (wenn Auth eingebaut wird)
alter table securities enable row level security;
alter table transactions enable row level security;
alter table cashflows enable row level security;

-- Policy für angemeldeten User
create policy "Owner access" on securities
  for all using (auth.uid() is not null);
```

Für Version 1 (kein Auth) kann RLS deaktiviert bleiben.
