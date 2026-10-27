-- Run ONCE in the Supabase SQL Editor (after 010). Non-destructive: one new column.
-- Purpose: stores the official numbers (alert level, sulfur dioxide, lake temperature, acidity, earthquakes, plume,
-- ground deformation) that /api/daily-digest copies word-for-word from the PHIVOLCS bulletin (no AI involved),
-- so the volcano page can show them as easy-to-read tiles.
alter table ai_digests
  add column if not exists metrics jsonb
    check (metrics is null or jsonb_typeof(metrics) = 'object');
