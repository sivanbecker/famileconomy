-- merchant_buckets: user-defined groupings of transaction descriptions
CREATE TABLE merchant_buckets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX merchant_buckets_user_idx ON merchant_buckets(user_id);

-- merchant_bucket_descriptions: descriptions that belong to a bucket
CREATE TABLE merchant_bucket_descriptions (
  bucket_id   UUID        NOT NULL REFERENCES merchant_buckets(id) ON DELETE CASCADE,
  description TEXT        NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_id, description)
);

-- Row Level Security
ALTER TABLE merchant_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_bucket_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_buckets_user_policy ON merchant_buckets
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Descriptions are accessible if their bucket is accessible (join through bucket)
CREATE POLICY merchant_bucket_descriptions_policy ON merchant_bucket_descriptions
  USING (
    bucket_id IN (
      SELECT id FROM merchant_buckets
      WHERE user_id = current_setting('app.current_user_id', true)::uuid
    )
  );
