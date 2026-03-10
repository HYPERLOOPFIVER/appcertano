// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAsjPu0kt8ilUMK9QDu9TobEzTMMkbhiQg",
  authDomain: "certano-97049.firebaseapp.com",
  projectId: "certano-97049",
  storageBucket: "certano-97049.firebasestorage.app",
  messagingSenderId: "713775491750",
  appId: "1:713775491750:web:6a2684643503e60ea6a267",
  measurementId: "G-NX8WP777E0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
