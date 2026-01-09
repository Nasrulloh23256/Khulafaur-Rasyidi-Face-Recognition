import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

await prisma.user.upsert({
  where: { email },
  update: {
    name: "Admin",
    passwordHash,
    role: "ADMIN",
  },
  create: {
    name: "Admin",
    email,
    passwordHash,
    role: "ADMIN",
  },
});

console.log(`Admin user ensured for ${email}`);

await prisma.$disconnect();
