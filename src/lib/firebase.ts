// Firebase Client Configuration
// This file initializes Firebase SDK for client-side use

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBd_XOZGXIKuJ0i9PSVr9cgdO1ppN4fJcQ",
    authDomain: "talk-to-site-a9ad9.firebaseapp.com",
    projectId: "talk-to-site-a9ad9",
    storageBucket: "talk-to-site-a9ad9.firebasestorage.app",
    messagingSenderId: "190554695160",
    appId: "1:190554695160:web:cdc6343f0d02f306cb620d",
    measurementId: "G-H2G3TWMCT3"
};

// Initialize Firebase (singleton pattern to prevent multiple instances)
let app: FirebaseApp;
let analytics: Analytics | null = null;
let firestore: Firestore;
let auth: Auth;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

// Initialize Firestore
firestore = getFirestore(app);

// Initialize Auth
auth = getAuth(app);

// Initialize Analytics (only in browser)
if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
}

export { app, analytics, firestore, auth };
