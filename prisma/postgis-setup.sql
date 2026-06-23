-- PostGIS extension activation for Encore
-- Run by docker-entrypoint-initdb.d on container init

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Indexes are created after Prisma migrations in prisma/migrations/
-- They will be applied by: npm run db:postgis

