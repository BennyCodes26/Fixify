import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Polyfill for TextEncoder which is missing on some Android devices
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = function TextEncoder() {};
  global.TextEncoder.prototype.encode = function encode(str) {
    const buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      buf[i] = str.charCodeAt(i) & 0xff;
    }
    return buf;
  };
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = function TextDecoder() {};
  global.TextDecoder.prototype.decode = function decode(bytes) {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  };
}

const firebaseConfig = {
  apiKey: "AIzaSyCgEpKKC1C3IBaYkpBSdWHAn62OJDCOYw8",
  authDomain: "fixifytest-437b6.firebaseapp.com",
  projectId: "fixifytest-437b6",
  storageBucket: "fixifytest-437b6.firebasestorage.app",
  messagingSenderId: "999996118740",
  appId: "1:999996118740:web:627f8ffd2b745995214d41",
};

// Initialize Firebase only once
let app;
let auth;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

// Disable verbose logging in production
// setLogLevel('silent');

export { app, auth, db, storage }; 