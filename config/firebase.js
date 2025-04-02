import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCgEpKKC1C3IBaYkpBSdWHAn62OJDCOYw8",
  authDomain: "fixifytest-437b6.firebaseapp.com",
  projectId: "fixifytest-437b6",
  storageBucket: "fixifytest-437b6.firebasestorage.app",
  messagingSenderId: "999996118740",
  appId: "1:999996118740:web:627f8ffd2b745995214d41",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage }; 