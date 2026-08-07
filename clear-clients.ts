import "dotenv/config";
import { prisma } from "./lib/prisma";
import { assertDestructiveAllowed } from "./prisma/guard-destructive";

/**
 * Dev utility: wipe the client table.
 *
 * Runs outside a request, so there is no tenant context and the firm-scoping
 * extension injects nothing — this deletes the clients of EVERY firm on the
 * connected database, not just yours. Gated behind the destructive opt-in.
 */
async function clearClients() {
  assertDestructiveAllowed("clear-clients");

  const count = await prisma.client.count();
  console.log(`Found ${count} clients (all firms). Deleting...`);
  await prisma.client.deleteMany({});
  console.log("All clients deleted.");
}

clearClients().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
