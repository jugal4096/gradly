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
    signOut,
    type User as FirebaseUser,
  } from "firebase/auth";
  
  import { auth } from "./firebase";
  import { API_BASE_URL, API_CONFIGURATION_ERROR, isApiConfigured } from "../lib/api";
  
  interface AuthContextType {
    user: FirebaseUser | null;
    loading: boolean;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
  }
  
  const AuthContext =
    createContext<AuthContextType | undefined>(
      undefined
    );
  
  export function AuthProvider({
    children,
  }: {
    children: ReactNode;
  }) {
    const [user, setUser] =
      useState<FirebaseUser | null>(null);
  
    const [loading, setLoading] =
      useState(true);
  
    useEffect(() => {
      const unsubscribe =
        onAuthStateChanged(
          auth,
          (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
          }
        );
  
      return unsubscribe;
    }, []);
  
    async function loginWithGoogle() {
      if (!isApiConfigured) throw new Error(API_CONFIGURATION_ERROR);

      const provider =
        new GoogleAuthProvider();
  
      const result =
        await signInWithPopup(
          auth,
          provider
        );
  
      const firebaseUser =
        result.user;
  
      const idToken =
        await firebaseUser.getIdToken();
  
      const response =
        await fetch(
          `${API_BASE_URL}/api/auth/sync`,
          {
            method: "POST",
  
            headers: {
              Authorization:
                `Bearer ${idToken}`,
  
              "Content-Type":
                "application/json",
            },
          }
        );
  
      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => null);
  
        throw new Error(
          errorData?.message ||
            "Failed to synchronize user with Gradly backend."
        );
      }
  
      const data =
        await response.json();
  
      void data;
    }
  
    async function logout() {
      await signOut(auth);
    }
  
    return (
      <AuthContext.Provider
        value={{
          user,
          loading,
          loginWithGoogle,
          logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }
  
  export function useAuth() {
    const context =
      useContext(AuthContext);
  
    if (!context) {
      throw new Error(
        "useAuth must be used inside AuthProvider."
      );
    }
  
    return context;
  }