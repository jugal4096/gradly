import {
  createGuestSession,
  findGuestSessionByToken,
  updateGuestActivity,
  purgeInactiveGuestSessions,
} from "./guest.repository";

const guestCleanupTimer = setInterval(() => {
  void purgeInactiveGuestSessions().catch(error => console.error("Scheduled inactive guest cleanup failed:", error));
}, 6 * 60 * 60 * 1000);
guestCleanupTimer.unref?.();

let lastGuestCleanupAt = 0;
async function runGuestCleanupIfDue() {
  if (Date.now() - lastGuestCleanupAt < 60 * 60 * 1000) return;
  lastGuestCleanupAt = Date.now();
  try { await purgeInactiveGuestSessions(); }
  catch (error) { lastGuestCleanupAt = 0; console.error("Inactive guest cleanup failed:", error); }
}

export async function startGuestSession(guestId: string, institutionId: string, externalInstitution?: { name: string; locality: string; externalId?: string }) {
  await runGuestCleanupIfDue();
  return createGuestSession(guestId, institutionId, externalInstitution);
}

export async function getGuestSession(sessionToken: string) {
  await runGuestCleanupIfDue();
  const session = await findGuestSessionByToken(sessionToken);
  if (!session) return null;
  await updateGuestActivity(session.id);
  return session;
}
