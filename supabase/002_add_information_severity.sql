-- Run this ONCE in Supabase SQL Editor (in addition to schema.sql, which
-- you've already run). The alerts UI (admin-alerts.html / alerts.html)
-- offers an "Information" severity option that wasn't in the original
-- enum — this adds it.
alter type alert_severity add value if not exists 'information' before 'advisory';
