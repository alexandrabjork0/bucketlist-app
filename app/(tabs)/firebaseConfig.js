import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyALaxS7gxB1E7JmUoJlMqQjLs44evIETEw",
  authDomain: "bucketlist-app-38e15.firebaseapp.com",
  projectId: "bucketlist-app-38e15",
  storageBucket: "bucketlist-app-38e15.firebasestorage.app",
  messagingSenderId: "649671316140",
  appId: "1:649671316140:web:8bf6ce09555708e2b00509",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 