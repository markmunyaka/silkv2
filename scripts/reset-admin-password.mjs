import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'list') {
    // List all admin users
    const admins = await prisma.user.findMany({ where: { role: 'admin' } });
    if (admins.length === 0) {
      console.log('No admin users found. Create one with: node scripts/reset-admin-password.mjs create <email> <password> <name>');
    } else {
      console.log('\nExisting admin users:');
      admins.forEach((a, i) => {
        console.log(`  ${i + 1}. Email: ${a.email}  |  Name: ${a.name}`);
      });
      console.log('\nTo reset a password: node scripts/reset-admin-password.mjs reset <email> <new-password>');
    }
  } else if (command === 'reset') {
    const email = args[1];
    const newPassword = args[2];
    if (!email || !newPassword) {
      console.log('Usage: node scripts/reset-admin-password.mjs reset <email> <new-password>');
      process.exit(1);
    }
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), role: 'admin' } });
    if (!user) {
      console.log(`No admin found with email: ${email}`);
      process.exit(1);
    }
    await prisma.user.update({ where: { id: user.id }, data: { password: newPassword } });
    console.log(`✅ Password reset for ${email}! You can now log in at /admin.`);
  } else if (command === 'create') {
    const email = args[1];
    const password = args[2];
    const name = args[3] || 'Admin';
    if (!email || !password) {
      console.log('Usage: node scripts/reset-admin-password.mjs create <email> <password> [name]');
      process.exit(1);
    }
    const existing = await prisma.user.findFirst({ where: { OR: [{ email: email.toLowerCase() }, { role: 'admin' }] } });
    if (existing) {
      console.log(`User already exists with that email or an admin already exists. Use 'reset' instead.`);
      process.exit(1);
    }
    await prisma.user.create({
      data: { name, email: email.toLowerCase(), password, role: 'admin', status: 'active', credits: 999 },
    });
    console.log(`✅ Admin user created! Email: ${email} / Password: ${password} — log in at /admin`);
  } else {
    console.log(`
Usage:
  node scripts/reset-admin-password.mjs list              — List existing admin users
  node scripts/reset-admin-password.mjs reset <email> <pw> — Reset admin password
  node scripts/reset-admin-password.mjs create <email> <pw> [name] — Create new admin
    `);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});