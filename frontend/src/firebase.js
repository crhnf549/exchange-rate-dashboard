import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    projectId: "alpine-run-365610",
    appId: "1:120658363028:web:59c3f3016661c42b13aa81",
    storageBucket: "alpine-run-365610.firebasestorage.app",
    apiKey: "AIzaSyA2CiY07-E9lirh4d5_Hzf8O418azXAhjU",
    authDomain: "alpine-run-365610.firebaseapp.com",
    messagingSenderId: "120658363028",
    measurementId: "G-XXXXXXXXXX" // Not strictly needed for this app
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
