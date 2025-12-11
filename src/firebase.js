import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 🔥 REPLACE WITH YOUR FIREBASE CONFIG!
const firebaseConfig = {

  apiKey: "AIzaSyBg6cIc_TLtc525GQBQvVM7polz8RAR8hg",

  authDomain: "mycircle-5841d.firebaseapp.com",

  projectId: "mycircle-5841d",

  storageBucket: "mycircle-5841d.firebasestorage.app",

  messagingSenderId: "558153786756",

  appId: "1:558153786756:web:8b8a379bcb6268f15ea9d1"

};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);