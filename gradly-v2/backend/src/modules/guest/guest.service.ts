import {
  createGuestSession,
  findGuestSessionByToken,
  updateGuestActivity,
} from "./guest.repository";

export async function startGuestSession(guestId: string, institutionId: string) {
  return createGuestSession(guestId, institutionId);
}

export async function getGuestSession(sessionToken: string) {
  const session = await findGuestSessionByToken(sessionToken);
  if (!session) return null;
  await updateGuestActivity(session.id);
  return session;
}
