import { prisma } from "../src/infrastructure/prisma.js";
import { encryptSensitive } from "../src/infrastructure/sensitive-data.js";

async function main() {
  const intents = await prisma.withdrawalIntent.findMany({ select: { id: true, accountNumber: true } });
  let updated = 0;
  for (const intent of intents) {
    const encrypted = encryptSensitive(intent.accountNumber);
    if (encrypted === intent.accountNumber) continue;
    await prisma.withdrawalIntent.update({ where: { id: intent.id }, data: { accountNumber: encrypted } });
    updated += 1;
  }
  console.log(`Encrypted ${updated} withdrawal account numbers.`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Sensitive-data encryption failed");
    process.exitCode = 1;
  });
