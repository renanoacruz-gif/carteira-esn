CREATE TABLE IF NOT EXISTS docs (
  path TEXT PRIMARY KEY,
  parent TEXT NOT NULL,
  owner TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent, path);
CREATE INDEX IF NOT EXISTS docs_parent_upd ON docs(parent, updated_at);
