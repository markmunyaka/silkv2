import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    await prisma.$disconnect();
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: 'Silk Admin',
      email: 'admin@silk.com',
      password: 'admin123',
      role: 'admin',
      status: 'active',
      credits: 999,
    },
  });

  console.log('✅ Admin user created:');
  console.log(`   Email:    ${user.email}`);
  console.log(`   Password: admin123`);
  console.log(`   Name:     ${user.name}`);
  console.log(`   Role:     ${user.role}`);
  console.log('');
  console.log('👉 Go to http://localhost:3000/admin to login');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});