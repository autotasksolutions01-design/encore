#!/usr/bin/env bash
set -euo pipefail

echo "════════════════════════════════════════"
echo "  🎸 Encore — Setup de desarrollo local"
echo "════════════════════════════════════════"
echo ""

# 1. Ensure local environment file exists
if [ ! -f ".env" ]; then
  echo "📝 Creando .env desde .env.example..."
  cp .env.example .env
  echo ""
fi

# 2. Levantar base de datos y Redis
echo "📦 Levantando PostgreSQL + Redis..."
docker compose up -d --wait
echo ""

# 3. Esperar a que PostgreSQL esté listo
echo "⏳ Esperando que PostgreSQL acepte conexiones..."
until docker compose exec -T db pg_isready -U encore -d encore > /dev/null 2>&1; do
  sleep 1
done
echo "   ✅ PostgreSQL listo"
echo ""

# 4. Instalar dependencias si hace falta
if [ ! -d "node_modules" ]; then
  echo "📥 Instalando dependencias..."
  npm install
  echo ""
fi

# 5. Generar Prisma Client
echo "🔧 Generando Prisma Client..."
npx prisma generate
echo ""

# 6. Sync database schema
# Greenfield/local dev workflow: db push avoids creating ad-hoc migrations during setup.
echo "🗄️  Sincronizando schema..."
npx prisma db push
echo ""

# 7. Activar PostGIS
echo "📍 Activando PostGIS..."
docker compose exec -T db psql -U encore -d encore -f /docker-entrypoint-initdb.d/01-postgis.sql 2>/dev/null || true
docker compose exec -T db psql -U encore -d encore < prisma/postgis-indexes.sql
echo "   ✅ PostGIS listo"
echo ""

# 8. Seed de datos de prueba
echo "🌱 Sembrando datos de prueba..."
npx tsx prisma/seed.ts
echo ""

echo "════════════════════════════════════════"
echo "  🚀 Arrancando servidor de desarrollo"
echo "════════════════════════════════════════"
echo ""
echo "  👉 Abrí http://localhost:3000/es/login"
echo ""
echo "  Usuarios de prueba:"
echo "    🎸 luciana@encore.local  (Guitarrista)"
echo "    🥁 martin@encore.local   (Baterista)"
echo "    🎸 valen@encore.local    (Bajista)"
echo "    🎹 seba@encore.local     (Tecladista)"
echo "    🎸 pablo@encore.local    (Guitarrista principiante)"
echo ""
echo "  Presioná Ctrl+C para parar."
echo ""

npm run dev
