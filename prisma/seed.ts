// Seed script — crea usuarios de prueba con perfiles completos
// Ejecutar: npx dotenv -- npx tsx prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEED_USERS = [
  {
    email: "luciana@encore.local",
    name: "Luciana Gómez",
    instruments: ["guitarra", "voz"],
    genres: ["rock", "indie", "pop"],
    skill: "advanced" as const,
    city: "Palermo",
    lat: -34.5884, lng: -58.4302,
    bio: "Guitarrista y cantante. Toco en Dos Astronautas. Busco banda para proyecto nuevo de rock alternativo.",
    lookingFor: [
      { instrument: "batería", genre: "rock", role: "band" as const },
      { instrument: "bajo", genre: "indie", role: "band" as const },
    ],
  },
  {
    email: "martin@encore.local",
    name: "Martín Cerati",
    instruments: ["batería", "percusión"],
    genres: ["rock", "jazz", "funk"],
    skill: "pro" as const,
    city: "Villa Crespo",
    lat: -34.6000, lng: -58.4500,
    bio: "Baterista sesionista. 15 años de experiencia. Grabo para bandas de la escena under. Disponible para sesiones y shows.",
    lookingFor: [
      { instrument: "guitarra", genre: "rock", role: "band" as const },
      { instrument: "bajo", genre: "funk", role: "jam" as const },
    ],
  },
  {
    email: "valen@encore.local",
    name: "Valentina Ríos",
    instruments: ["bajo", "sintetizador"],
    genres: ["electrónica", "indie", "pop"],
    skill: "intermediate" as const,
    city: "Palermo",
    lat: -34.5800, lng: -58.4200,
    bio: "Bajista y productora. Me gusta mezclar bajo con sintes. Busco gente para armar algo entre LCD Soundsystem y El Mató.",
    lookingFor: [
      { instrument: "batería", genre: "electrónica", role: "band" as const },
      { instrument: "voz", genre: "indie", role: "collab" as const },
    ],
  },
  {
    email: "seba@encore.local",
    name: "Sebastián Funk",
    instruments: ["teclado", "piano", "sintetizador"],
    genres: ["jazz", "funk", "soul"],
    skill: "advanced" as const,
    city: "Belgrano",
    lat: -34.5600, lng: -58.4500,
    bio: "Tecladista de formación clásica, corazón funk. Toco en trío de jazz los findes. Abierto a sesiones y colaboraciones.",
    lookingFor: [
      { instrument: "batería", genre: "jazz", role: "jam" as const },
      { instrument: "bajo", genre: "funk", role: "band" as const },
    ],
  },
  {
    email: "pablo@encore.local",
    name: "Pablo López",
    instruments: ["guitarra", "bajo", "ukelele"],
    genres: ["indie", "folk", "rock"],
    skill: "beginner" as const,
    city: "Colegiales",
    lat: -34.5750, lng: -58.4550,
    bio: "Arranqué hace un año. Toco guitarra criolla y eléctrica. Busco gente con paciencia para zapadas tranqui los findes.",
    lookingFor: [
      { instrument: "guitarra", genre: "folk", role: "jam" as const },
    ],
  },
];

async function main() {
  console.log("🌱 Sembrando Encore...\n");

  for (const userData of SEED_USERS) {
    // Crear o encontrar usuario
    let user = await prisma.user.findUnique({ where: { email: userData.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          authProvider: "dev",
          onboardingCompleted: true,
        },
      });
      console.log(`  ✅ Usuario: ${userData.name} (${userData.email})`);
    } else {
      console.log(`  ⏭  Ya existe: ${userData.name}`);
    }

    // Crear o actualizar perfil
    const existingProfile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (existingProfile) {
      console.log(`     ⏭  Perfil ya existe`);
      continue;
    }

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: userData.name,
        bio: userData.bio,
        skillLevel: userData.skill,
        city: userData.city,
        lat: userData.lat,
        lng: userData.lng,
        visibility: "public",
        publishedAt: new Date(),
      },
    });

    // Instrumentos
    for (const instrument of userData.instruments) {
      await prisma.profileInstrument.create({
        data: { profileId: profile.id, instrument },
      });
    }

    // Géneros
    for (const genre of userData.genres) {
      await prisma.profileGenre.create({
        data: { profileId: profile.id, genre },
      });
    }

    // Looking For
    for (const lf of userData.lookingFor) {
      await prisma.lookingFor.create({
        data: {
          profileId: profile.id,
          instrument: lf.instrument,
          genre: lf.genre,
          role: lf.role,
        },
      });
    }

    console.log(`     🎸 Perfil: ${userData.instruments.join(", ")} | ${userData.genres.join(", ")} | ${userData.city}`);
  }

  // Crear algunas conexiones entre usuarios
  const lucianaProfile = await prisma.profile.findFirst({ where: { user: { email: "luciana@encore.local" } } });
  const martinProfile = await prisma.profile.findFirst({ where: { user: { email: "martin@encore.local" } } });
  const valenProfile = await prisma.profile.findFirst({ where: { user: { email: "valen@encore.local" } } });
  const sebaProfile = await prisma.profile.findFirst({ where: { user: { email: "seba@encore.local" } } });

  if (lucianaProfile && martinProfile) {
    await prisma.connection.upsert({
      where: { requesterId_receiverId: { requesterId: lucianaProfile.id, receiverId: martinProfile.id } },
      create: { requesterId: lucianaProfile.id, receiverId: martinProfile.id, status: "accepted" },
      update: {},
    });
    console.log("  🔗 Luciana ↔ Martín (conectados)");
  }

  if (martinProfile && valenProfile) {
    await prisma.connection.upsert({
      where: { requesterId_receiverId: { requesterId: martinProfile.id, receiverId: valenProfile.id } },
      create: { requesterId: martinProfile.id, receiverId: valenProfile.id, status: "accepted" },
      update: {},
    });
    console.log("  🔗 Martín ↔ Valen (conectados)");
  }

  if (lucianaProfile && sebaProfile) {
    await prisma.connection.upsert({
      where: { requesterId_receiverId: { requesterId: lucianaProfile.id, receiverId: sebaProfile.id } },
      create: { requesterId: lucianaProfile.id, receiverId: sebaProfile.id, status: "accepted" },
      update: {},
    });
    console.log("  🔗 Luciana ↔ Seba (conectados)");
  }

  console.log(`\n✅ ${SEED_USERS.length} usuarios creados con perfiles completos.`);
  console.log("🚀 Listo para probar: npm run dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
