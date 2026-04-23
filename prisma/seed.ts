import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "NubeCenter.2026";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      passwordHash,
      role: "admin",
    },
    create: {
      username: ADMIN_USERNAME,
      passwordHash,
      role: "admin",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Error running seed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
