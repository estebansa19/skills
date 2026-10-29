# Database & Migration Review Checklist

Schema changes are the ones that take production down and cannot be rolled back by reverting a
commit. Review them for **lock behaviour, reversibility, and data integrity** first, style last.

**Identify the engine and the migration tooling before applying anything here.** Read the
schema/structure file, the manifest, and 2–3 existing migrations. Postgres and MySQL differ on
exactly the operations that matter most. If the repo documents an online-schema-change contract
(gh-ost, pt-osc, a migration base class, a large-table list), **that contract wins**.

Severity: **blocking** (locks a live table, loses data, unrecoverable) · **should-fix** · **nit**.

---

## 1. Locking and online safety

- **DDL on a large table written as a plain blocking migration** when the repo has an
  online-schema-change path. Locking a big table blocks every read/write behind it. *blocking.*
- **Adding a column with a volatile or computed default** — on older engines this rewrites the
  whole table. Add the column nullable, backfill in batches outside the migration, then set the
  default. *blocking* on a large table.
- **`NOT NULL` added in one shot** — validate existing rows first, then add the constraint (with
  `NOT VALID` + `VALIDATE` on Postgres). *blocking.*
- **Type change in place** — usually a full rewrite plus a compatibility break. Prefer a new
  column + backfill + swap. *blocking.*
- **Non-concurrent index creation on a big table** — use `CONCURRENTLY` (Postgres, and note it
  cannot run inside a transaction) or the repo's online tool. *blocking.*
- **A foreign key added and validated in one step** — add `NOT VALID`, validate separately.
  *should-fix → blocking* by table size.
- **Several DDL statements in one migration/transaction** — a long-held lock, and a partial
  failure leaves an ambiguous state. Split them. *should-fix.*

## 2. Data integrity

- **A unique index added with no duplicate pre-check.** Under an online tool this can silently
  drop rows rather than fail. Check for duplicates first. *blocking.*
- **Backfill or bulk `update`/`update_all` inside a migration** — it runs in one transaction,
  holds locks for its whole duration, and cannot be resumed. Batch it in a separate,
  restartable task. *blocking.*
- **A column renamed or dropped while code still references it.** `grep` the app for models,
  scopes, serializers, queries and tests. Deploys are not atomic: the old code runs against the
  new schema for a window. Prefer add → backfill → dual-write → switch → drop later. *blocking.*
- **Destructive change with no data preservation path** — dropping a column or table whose data
  is not recoverable from elsewhere. *blocking.*
- **Assuming global uniqueness on a partitioned, sharded, or multi-tenant table.** *blocking.*
- **A constraint or default that contradicts existing rows.** *blocking.*

## 3. Reversibility

- **No `down` / no rollback path**, or an irreversible operation with no note saying so.
  *should-fix → blocking* by risk.
- **A `down` that loses data** — dropping a column the `up` populated. Say so explicitly.
- **Schema/structure file not regenerated**, or regenerated with unrelated churn from a
  developer's local database. *should-fix.*

## 4. Modelling and indexing

- **A new foreign key with no index** on the referencing column — every join and cascade scans.
  *should-fix.*
- **A new query pattern with no supporting index**, or a redundant index already covered by an
  existing composite's prefix. *should-fix / nit.*
- **Wrong column order in a composite index** for the query it serves. *should-fix.*
- **Nullable where the domain says required**, or a string column standing in for an enum with no
  constraint. *nit → should-fix.*
- **Oversized or under-sized types** — a `text` for a 2-char code, an `int` for something that
  will exceed it. *nit.*

## 5. Note on tooling

Migration directories are commonly excluded from the linter, so you may be the only guard on
their quality — but that is not licence to nitpick formatting. Stay on safety and integrity.

---

## Sources
- strong_migrations — https://github.com/ankane/strong_migrations
- GitLab migration style guide — https://docs.gitlab.com/ee/development/migration_style_guide.html
- PostgreSQL ALTER TABLE locking — https://www.postgresql.org/docs/current/sql-altertable.html
- gh-ost — https://github.com/github/gh-ost
