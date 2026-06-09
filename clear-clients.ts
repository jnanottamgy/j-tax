import "dotenv/config";
import { prisma } from "./lib/prisma";

async function clearClients() {
  const count = await prisma.client.count();
  console.log(`Found ${count} clients. Deleting...`);
  await prisma.client.deleteMany({});
  console.log("All clients deleted.");
}

clearClients().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});