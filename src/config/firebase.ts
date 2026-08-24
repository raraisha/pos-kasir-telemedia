import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDEx2YuTS7xesucVh54wNhbxspWVo8FhgI",
  authDomain: "pos-kasir-5129e.firebaseapp.com",
  projectId: "pos-kasir-5129e",
  storageBucket: "pos-kasir-5129e.firebasestorage.app",
  messagingSenderId: "951222602868",
  appId: "1:951222602868:web:e905229c7ced3ba9275521",
  measurementId: "G-GVG4SFQH53"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// 2. Inisialisasi Firestore dengan Cache Offline (Multi-tab support)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export { app, auth, db };