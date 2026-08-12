import "dotenv/config";
import { backfillEnrollments } from "../src/lib/enrollment-backfill";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await backfillEnrollments();
  console.log("Enrollment backfill complete:");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Enrollment backfill failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
