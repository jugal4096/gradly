import {
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
  import { apiUrl } from "../lib/api";
  import { AuthContext, type AuthContextType } from "./AuthContextCore";
  

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
          apiUrl("/auth/sync"),
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
