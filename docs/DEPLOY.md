# Deploying J-TACS

## The schema is pushed by the build — for now

`package.json` currently reads:

```
"build": "prisma generate && prisma db push --skip-generate && next build"
```

That middle step brings the database in line with `prisma/schema.prisma` on every
deploy, using the `DATABASE_URL` already configured in the hosting environment.
It is there because the first live database was several changes behind the code,
and every page in the product died on the same missing column while looking like
an authentication problem.

**Remove `prisma db push --skip-generate` from the build once the schema settles.**
It is safe while changes are additive — new tables, new columns, new enum values.
It is not safe once there is real client data and someone renames a field, because
`db push` will drop the old column and take the data with it. At that point switch
to proper migrations:

```bash
npx prisma migrate dev --name <what-changed>   # locally, creates the migration
npx prisma migrate deploy                      # in the build, applies it
```

If a deploy fails with a data-loss warning, that is the signal: stop pushing from
the build and move to migrations. Do not add `--accept-data-loss` to a build that
runs against a database holding real work.

## Checking the database from the browser

`GET /api/diagnostics` — Partner only, returns no client data.

It runs the reads the dashboard runs, one at a time, and names whichever fails:

- `P2021` — a table is missing
- `P2022` — a column is missing
- `P2007` / invalid input value for enum — the table is there but Postgres does
  not know a value the app sends

All three mean the same thing: the schema is behind the code.

The endpoint is gated on the Supabase session alone and never queries the
database to decide whether to answer. That is deliberate — an earlier version
gated on `requireAuth`, which needs the database, so a broken database made it
reply "Partner access required" and hid the very fault it existed to find.

## Environment

```bash
npm run env:check    # required config, with what breaks when each is missing
npm run db:check     # exits non-zero if the database is behind the schema
```

`.env.example` documents every variable by consequence rather than by name.

Two worth calling out:

- **`CREDENTIAL_VAULT_KEY`** — 64 hex characters, `openssl rand -hex 32`. Set it
  **before** anyone stores a government-portal credential. Changing it later makes
  everything already stored permanently unreadable.
- **`CRON_SECRET`** — without it every scheduled job returns 503 and silently does
  nothing: deadline reminders, retainer invoices, attendance close-off, overdue
  escalation. Nothing reports this; the app simply looks quiet.

## Row-level security

`prisma db push` builds the schema. It does not create the row-level security
policies in `prisma/migrations-manual/`, which are the database-level half of
tenant isolation — the part that still holds if application code has a bug.

Apply them in numeric order against the production database, `002` onwards.
`RLS_ACTIVATION_GUIDE.md` in that directory covers the order and what each one
protects.

**Never run `019_production_reset.sql`.** It truncates every table. It exists for
clearing a development database before handing a clean instance to a customer,
and it refuses the job if there is real data.

## First-run checklist

1. Set every required variable, `CREDENTIAL_VAULT_KEY` included.
2. Deploy. The build pushes the schema.
3. Open `/api/diagnostics` and confirm every check passes.
4. Sign up. That creates the firm and makes you the founding Partner.
5. Apply the RLS migrations before real client data goes in.
6. Confirm the scheduled jobs are running, or nothing happens on a schedule.
