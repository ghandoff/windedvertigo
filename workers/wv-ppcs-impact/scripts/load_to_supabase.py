#!/usr/bin/env python3
"""Generate Postgres INSERT SQL from PPCS SQLite DB and load via supabase db query."""
import sqlite3, subprocess, tempfile, os, sys, re

PPCS_DIR = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-garrett@windedvertigo.com"
    "/Shared drives/winded.vertigo/clients/UN PRME"
    "/2026 PRME and beyond/2 PPCS content/Engagement Evidence"
    "/Dashboard/wv-ppcs-impact"
)
DB_PATH = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-garrett@windedvertigo.com"
    "/Shared drives/winded.vertigo/clients/UN PRME"
    "/2026 PRME and beyond/2 PPCS content/Engagement Evidence"
    "/Database/PPCS2026_engagement.db"
)

# Load order respects FK constraints
TABLES = [
    "participant",
    "week",
    "session_event",
    "lesson",
    "participant_alias",
    "attendance",
    "attendance_interval",
    "commons_thread",
    "chat_message",
    "commons_contribution",
    "miro_contribution",
    "survey",
    "survey_response",
    "survey_answer",
    "measure_long",
    "sentiment_annotation",
    "code",          # self-ref FK; handled specially below
    "coding",
]

IDENTITY_TABLES = {
    "participant_alias", "session_event", "attendance", "attendance_interval",
    "chat_message", "survey", "survey_response", "survey_answer",
    "measure_long", "sentiment_annotation", "code", "coding",
}

# ── Pseudonymisation routing (see migration 0002_pseudonymise.sql) ──────
# After the bridge split, direct identifiers live in the `private` schema.
# The loader sends those columns to private.* and loads only the remaining
# columns into public.*. participant_id (the pseudonym) is the join key and
# stays in both.
#
# {sqlite_table: {"private_table","id_pk","private_cols",[ "null_in_public" ]}}
SPLIT_TABLES = {
    "participant": {
        "private_table": "private.participant_identity",
        "id_pk": "participant_id",
        "private_cols": ["participant_id", "canonical_name", "first_name",
                         "last_name", "primary_email", "organization",
                         "job_title", "notes"],
    },
    "survey_response": {
        "private_table": "private.survey_response_pii",
        "id_pk": "response_id",
        "private_cols": ["response_id", "recipient_email", "recipient_first_name",
                         "recipient_last_name", "raw_name_inst", "ip_address"],
    },
    "chat_message": {
        "private_table": "private.chat_author",
        "id_pk": "message_id",
        # raw_display_name → private; omitted from public (column stays NULL)
        "private_cols": ["message_id", "raw_display_name"],
    },
}
# Whole SQLite tables that now live entirely in `private`
WHOLE_PRIVATE = {
    "participant_alias": "private.participant_alias",
}

BATCH = 200

import re as _re
_TS_PAT = _re.compile(r'^\d{4}-\d{2}-\d{2}')  # starts with YYYY-MM-DD

def q(v, col=""):
    """Escape a value for SQL; null out malformed timestamps."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    # Null out values that look like partial/malformed timestamps
    # (e.g. '2026-2026-04' stored in timestamptz columns)
    if not _TS_PAT.match(s) and col in (
        "start_utc", "first_join", "last_leave", "registration_time",
        "resolved_at", "ts_utc", "created_at", "recorded_at", "opened_at",
    ):
        return "NULL"
    # Second guard: YYYY-YYYY-MM pattern (malformed)
    if _re.match(r'^\d{4}-\d{4}-\d{2}', s):
        return "NULL"
    return "'" + s.replace("'", "''") + "'"

def run_sql(sql, label=""):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        f.write(sql)
        fname = f.name
    try:
        result = subprocess.run(
            ["supabase", "db", "query", "--linked", "-f", fname],
            cwd=PPCS_DIR,
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"  ERROR {label}:\n{result.stderr}")
            return False
        return True
    finally:
        os.unlink(fname)

def load_table(cur, table):
    cur.execute(f"pragma table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    cur.execute(f"select * from {table}")
    rows = cur.fetchall()
    if not rows:
        print(f"  {table}: 0 rows — skip")
        return True

    override = "overriding system value" if table in IDENTITY_TABLES else ""
    col_list = ", ".join(cols)
    total = 0

    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        vals = []
        for row in batch:
            vals.append("(" + ", ".join(q(v, cols[ci]) for ci, v in enumerate(row)) + ")")
        sql = (
            f"insert into {table} ({col_list}) "
            f"{override} values\n"
            + ",\n".join(vals)
            + "\non conflict do nothing;"
        )
        ok = run_sql(sql, f"{table} batch {i//BATCH + 1}")
        if not ok:
            return False
        total += len(batch)
        print(f"  {table}: {total}/{len(rows)} rows", end="\r")

    print(f"  {table}: {total} rows loaded           ")
    return True

def _insert_rows(dest_table, cols, rows, override, label):
    """Insert specific (cols, rows) into dest_table in batches."""
    col_list = ", ".join(cols)
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        vals = ["(" + ", ".join(q(v, cols[ci]) for ci, v in enumerate(r)) + ")"
                for r in batch]
        sql = (f"insert into {dest_table} ({col_list}) {override} values\n"
               + ",\n".join(vals) + "\non conflict do nothing;")
        if not run_sql(sql, f"{label} batch {i//BATCH+1}"):
            return False
    return True


def load_split_table(cur, table):
    """Load a pseudonymised table: identity columns → private, rest → public."""
    spec = SPLIT_TABLES[table]
    cur.execute(f"pragma table_info({table})")
    all_cols = [r[1] for r in cur.fetchall()]
    cur.execute(f"select * from {table}")
    rows = cur.fetchall()
    if not rows:
        print(f"  {table}: 0 rows — skip")
        return True

    idx = {c: i for i, c in enumerate(all_cols)}
    priv_cols = [c for c in spec["private_cols"] if c in idx]
    # Identity columns that live ONLY in private = private_cols minus the PK.
    # The PK (id_pk) is the join key and MUST stay in public too, otherwise an
    # identity PK would be regenerated and bypass the on-conflict idempotency.
    priv_only = [c for c in priv_cols if c != spec["id_pk"]]
    pub_cols = [c for c in all_cols if c not in priv_only]
    override = "overriding system value" if table in IDENTITY_TABLES else ""

    # 1) private identity rows (PK + identifiers)
    priv_rows = [tuple(r[idx[c]] for c in priv_cols) for r in rows]
    if not _insert_rows(spec["private_table"], priv_cols, priv_rows, "",
                        f"{table}→{spec['private_table']}"):
        return False

    # 2) public rows (identifiers omitted → nullable columns default to NULL)
    pub_rows = [tuple(r[idx[c]] for c in pub_cols) for r in rows]
    if not _insert_rows(table, pub_cols, pub_rows, override, f"{table}(public)"):
        return False

    print(f"  {table}: {len(rows)} rows loaded (split → public + {spec['private_table']})")
    return True


def load_whole_private(cur, table):
    """Load an entire SQLite table into its `private` destination."""
    dest = WHOLE_PRIVATE[table]
    cur.execute(f"pragma table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    cur.execute(f"select * from {table}")
    rows = cur.fetchall()
    if not rows:
        print(f"  {table}: 0 rows — skip")
        return True
    override = "overriding system value" if table in IDENTITY_TABLES else ""
    if not _insert_rows(dest, cols, rows, override, f"{table}→{dest}"):
        return False
    print(f"  {table}: {len(rows)} rows loaded → {dest}")
    return True


def load_self_ref_table(cur, table, pk_col, parent_col):
    """Two-pass load for self-referential tables.
    Pass 1: insert all rows with parent_col = NULL.
    Pass 2: batch-UPDATE to restore parent_col values.
    """
    override = "overriding system value" if table in IDENTITY_TABLES else ""

    cur.execute(f"pragma table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    col_list = ", ".join(cols)
    parent_idx = cols.index(parent_col)
    pk_idx = cols.index(pk_col)

    cur.execute(f"select * from {table}")
    rows = cur.fetchall()
    if not rows:
        print(f"  {table}: 0 rows — skip")
        return True

    # Pass 1: all rows, parent forced to NULL
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        vals = []
        for row in batch:
            row_list = list(row)
            row_list[parent_idx] = None
            vals.append("(" + ", ".join(q(v, cols[ci]) for ci, v in enumerate(row_list)) + ")")
        sql = (
            f"insert into {table} ({col_list}) {override} values\n"
            + ",\n".join(vals)
            + "\non conflict do nothing;"
        )
        if not run_sql(sql, f"{table} pass1 batch {i//BATCH+1}"):
            return False

    # Pass 2: batch UPDATE to restore parent values (only rows that have a parent)
    parent_pairs = [
        (row[pk_idx], row[parent_idx])
        for row in rows if row[parent_idx] is not None
    ]
    for i in range(0, len(parent_pairs), BATCH):
        batch = parent_pairs[i:i+BATCH]
        # Use VALUES-based UPDATE for efficiency
        values_clause = ",\n".join(
            f"({q(child)}, {q(parent)})" for child, parent in batch
        )
        sql = (
            f"update {table} as t set {parent_col} = v.parent\n"
            f"from (values\n{values_clause}\n) as v(child, parent)\n"
            f"where t.{pk_col} = v.child;"
        )
        if not run_sql(sql, f"{table} parent_update batch {i//BATCH+1}"):
            return False

    print(f"  {table}: {len(rows)} rows loaded")
    return True

def advance_sequences(cur):
    """Advance identity sequences to max(id) after bulk load."""
    seq_sql = []
    for table in IDENTITY_TABLES:
        cur.execute(f"pragma table_info({table})")
        cols = [r[1] for r in cur.fetchall()]
        # Find the identity column (INTEGER PRIMARY KEY in SQLite)
        cur.execute(f"select * from {table} limit 0")  # just to confirm table exists
        # Use the column that corresponds to IDENTITY in postgres (first col for most)
        # Map from TABLES list
        pk_map = {
            "participant_alias": "alias_id", "session_event": "session_event_id",
            "attendance": "attendance_id", "attendance_interval": "interval_id",
            "chat_message": "message_id", "survey": "survey_id",
            "survey_response": "response_id", "survey_answer": "answer_id",
            "measure_long": "measure_row_id", "sentiment_annotation": "annotation_id",
            "code": "code_id", "coding": "coding_id",
        }
        pk_col = pk_map.get(table)
        if pk_col:
            seq_sql.append(
                f"select setval(pg_get_serial_sequence('{table}', '{pk_col}'), "
                f"coalesce((select max({pk_col}) from {table}), 1));"
            )
    return run_sql("\n".join(seq_sql), "advance_sequences")

def set_dashboard_labels():
    sql = """
update code set dashboard_label = 'Systems Thinking'
  where code_name = 'Complexity & Systems Thinking';
update code set dashboard_label = 'Hidden Curriculum'
  where code_name = 'Hidden Curriculum, Culture & Decolonizing';
update code set dashboard_label = 'Agency/Power/Tech'
  where code_name = 'Agency, Power & Technology';
"""
    return run_sql(sql, "dashboard_labels")

if __name__ == "__main__":
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    con.row_factory = sqlite3.Row

    print(f"Loading from: {DB_PATH}")
    print(f"Project dir:  {PPCS_DIR}\n")

    SELF_REF = {
        "code":                 ("code_id",        "parent_code_id"),
        "commons_contribution": ("contribution_id", "parent_contribution_id"),
    }
    for table in TABLES:
        if table in WHOLE_PRIVATE:
            ok = load_whole_private(cur, table)
        elif table in SPLIT_TABLES:
            ok = load_split_table(cur, table)
        elif table in SELF_REF:
            pk_col, parent_col = SELF_REF[table]
            ok = load_self_ref_table(cur, table, pk_col, parent_col)
        else:
            ok = load_table(cur, table)
        if not ok:
            print(f"\nABORTED at {table}")
            sys.exit(1)

    print("\nAdvancing identity sequences...")
    advance_sequences(cur)

    print("Setting dashboard short-name labels...")
    set_dashboard_labels()

    con.close()
    print("\nDone. Dashboard reflects data within 10 min (CF edge cache TTL).")
