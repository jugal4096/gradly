import {
  findUserByFirebaseUid,
  syncUser,
} from "./auth.repository";

export async function synchronizeUser(
  firebaseUid: string,
  email: string,
  displayName?: string | null
) {
  return await syncUser({
    firebaseUid,
    email,
    displayName,
  });
}

export async function getGradlyUserByFirebaseUid(
  firebaseUid: string
) {
  return await findUserByFirebaseUid(firebaseUid);
}