import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase web config is a public identifier, not a secret —
// access is controlled by Firestore security rules.
const firebaseConfig = {
  apiKey: "AIzaSyAD5IegP1pInmYKqHorsVlFcoGURhbTSUQ",
  authDomain: "iot1-6b027.firebaseapp.com",
  projectId: "iot1-6b027",
  storageBucket: "iot1-6b027.firebasestorage.app",
  messagingSenderId: "490551616091",
  appId: "1:490551616091:web:dbf648ee2abcb0196ed57e",
};

// Reuse the app across hot reloads instead of initializing twice.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
