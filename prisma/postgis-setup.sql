-- PostGIS extension activation for Encore
-- Run once: psql <DATABASE_URL> -f prisma/postgis-setup.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Spatial GiST index on Profile(lat, lng) for ST_DWithin radius searches
CREATE INDEX IF NOT EXISTS idx_profile_geo
  ON "Profile" USING gist (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  );

-- GIN index on ProfileInstrument.instrument for array-like filtering
CREATE INDEX IF NOT EXISTS idx_profile_instrument
  ON "ProfileInstrument" USING btree (instrument);

-- GIN index on ProfileGenre.genre for array-like filtering  
CREATE INDEX IF NOT EXISTS idx_profile_genre
  ON "ProfileGenre" USING btree (genre);

-- Spatial GiST index on JamSession(lat, lng) for location search
CREATE INDEX IF NOT EXISTS idx_jam_geo
  ON "JamSession" USING gist (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  );
