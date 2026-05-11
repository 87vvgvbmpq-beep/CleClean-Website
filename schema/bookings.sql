CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'completed')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  notes TEXT,
  consent INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'website'
);

CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings (created_at DESC);
