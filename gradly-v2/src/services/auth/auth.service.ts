import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    type User,
  } from "firebase/auth";
  
  import { auth } from "../../config/firebase";
  
  const googleProvider = new GoogleAuthProvider();
  
  export async function signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
  
    return result.user;
  }
  
  export async function signOutUser(): Promise<void> {
    await signOut(auth);
  }
  
  export function subscribeToAuthState(
    callback: (user: User | null) => void
  ) {
    return onAuthStateChanged(auth, callback);
  }
  
  export function getCurrentUser(): User | null {
    return auth.currentUser;
  }