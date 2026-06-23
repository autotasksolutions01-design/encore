#!/usr/bin/env bash
set -euo pipefail

echo "════════════════════════════════════════"
echo "  🎸 Encore — Setup de desarrollo local"
echo "════════════════════════════════════════"
echo ""

# 1. Levantar base de datos y Redis
echo "📦 Levantando PostgreSQL + Redis..."
docker compose up -d --wait
echo ""

# 2. Esperar a que PostgreSQL esté listo
echo "⏳ Esperando que PostgreSQL acepte conexiones..."
until docker compose exec -T db pg_isready -U encore -d encore > /dev/null 2>&1; do
  sleep 1
done
echo "   ✅ PostgreSQL listo"
echo ""

# 3. Instalar dependencias si hace falta
if [ ! -d "node_modules" ]; then
  echo "📥 Instalando dependencias..."
  npm install
  echo ""
fi

# 4. Generar Prisma Client
echo "🔧 Generando Prisma Client..."
npx prisma generate
echo ""

# 5. Correr migraciones
echo "🗄️  Aplicando migraciones..."
npx prisma migrate dev --name init 2>/dev/null || npx prisma db push
echo ""

# 6. Activar PostGIS
echo "📍 Activando PostGIS..."
docker compose exec -T db psql -U encore -d encore -f /docker-entrypoint-initdb.d/01-postgis.sql 2>/dev/null || true
docker compose exec -T db psql -U encore -d encore < prisma/postgis-indexes.sql
echo "   ✅ PostGIS listo"
echo ""

# 7. Seed de datos de prueba
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
