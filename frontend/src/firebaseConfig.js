// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyARNldFtiJvclnmfjhHM3nd1r7Ml-e0FDw",
  authDomain: "tickets-a13e5.firebaseapp.com",
  projectId: "tickets-a13e5",
  storageBucket: "tickets-a13e5.firebasestorage.app",
  messagingSenderId: "776141951667",
  appId: "1:776141951667:web:228f0d6bd24bf6fe60d6c6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
