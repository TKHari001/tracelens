CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS demo;
CREATE TABLE IF NOT EXISTS demo.sellers (
  id integer PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE IF NOT EXISTS demo.products (
  id integer PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  seller_id integer NOT NULL REFERENCES demo.sellers(id)
);
INSERT INTO demo.sellers (id, name) VALUES
  (1, 'North Studio'), (2, 'Paper & Co'), (3, 'Everyday Goods'),
  (4, 'Field Supply'), (5, 'Form Works')
ON CONFLICT (id) DO NOTHING;
INSERT INTO demo.products (id, name, price_cents, seller_id)
SELECT n, names[n], 500 + n * 125, ((n - 1) % 5) + 1
FROM generate_series(1,20) AS n,
LATERAL (SELECT ARRAY['Canvas tote','Desk notebook','Travel mug','Cotton cap',
  'Pencil set','Cable pouch','Water bottle','Desk tray','Pocket journal','Key ring',
  'Wool socks','Phone stand','Lunch box','Bookmark set','Plant pot','Mouse pad',
  'Storage basket','Coaster set','Reading light','Weekend bag'] AS names) AS catalog
ON CONFLICT (id) DO NOTHING;
