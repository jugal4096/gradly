import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-qbNN79kFiKDyH658RfX_78T6FTwNOTg",
  authDomain: "gradly-v2.firebaseapp.com",
  projectId: "gradly-v2",
  storageBucket: "gradly-v2.firebasestorage.app",
  messagingSenderId: "165177753541",
  appId: "1:165177753541:web:7741e8d320bf14358a55ac",
  measurementId: "G-443GJWY707",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);