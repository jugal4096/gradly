import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";

import { auth } from "../../config/firebase";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isGuest: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  createGuestIdentity: (guestId: string) => Promise<void>;
  deleteGuestProfile: () => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GUEST_SESSION_KEY = "gradly_guest_session";
const GUEST_ID_KEY = "gradly_guest_id";
const GUEST_TOKEN_KEY = "gradly_guest_token";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(
    () => sessionStorage.getItem(GUEST_SESSION_KEY) === "true",
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        setIsGuest(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function syncUserWithBackend(firebaseUser: FirebaseUser) {
    const idToken = await firebaseUser.getIdToken();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${apiBaseUrl}/api/auth/sync`, { method: "POST", headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" } });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || "Failed to synchronize user with Gradly backend.");
    }
  }

  async function loginWithEmail(email: string, password: string) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.removeItem(GUEST_SESSION_KEY); setIsGuest(false);
    await syncUserWithBackend(result.user);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    await syncUserWithBackend(firebaseUser);
  }

  async function createGuestIdentity(guestId: string) {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/api/guest/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ guestId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.guest?.sessionToken) {
      throw new Error(data?.message || "Unable to create your Guest ID. Please try again.");
    }
    sessionStorage.setItem(GUEST_SESSION_KEY, "true");
    sessionStorage.setItem(GUEST_TOKEN_KEY, data.guest.sessionToken);
    localStorage.setItem(GUEST_ID_KEY, data.guest.guestId);
    setIsGuest(true);
  }

  async function deleteGuestProfile() {
    const token = sessionStorage.getItem(GUEST_TOKEN_KEY);
    if (!token) throw new Error("Your guest session is missing. Sign in to your Guest ID again.");
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\\/+$/, "");
    const response = await fetch(apiBaseUrl + "/api/guest/session", {
      method: "DELETE",
      headers: { Accept: "application/json", "x-guest-session": token },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || "Unable to delete your guest profile.");
    clearGuestLocalData();
    setIsGuest(false);
  }

  function clearGuestLocalData() {
    const guestId = localStorage.getItem(GUEST_ID_KEY) || "default";
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    sessionStorage.removeItem(GUEST_TOKEN_KEY);
    localStorage.removeItem(GUEST_ID_KEY);
    for (const key of ["gradly_guest_institute", "gradly_guest_institute_name", "gradly_guest_subjects", "gradly_guest_semester_results", "gradly_guest_theme", "gradly_guest_theme_" + guestId, "gradly_guest_profile", "gradly_guest_workspace"]) localStorage.removeItem(key);
  }
  async function logout() {
    clearGuestLocalData();
    setIsGuest(false);
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        loginWithGoogle,
        loginWithEmail,
        createGuestIdentity,
        deleteGuestProfile,
        logout,
        signOut: logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
