import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/utils";

async function createTestUser() {
  const email = "test@example.com";
  const password = "password123";
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    console.log("Test user already exists");
    return;
  }
  
  const hashedPassword = await hashPassword(password);
  
  const user = await prisma.user.create({
    data: {
      email,
      name: "Test User",
      passwordHash: hashedPassword,
      domain: "example.com"
    }
  });
  
  console.log("Test user created:", user.email);
  console.log("Password:", password);
}

createTestUser()
  .catch(console.error)
  .finally(() => process.exit(0));