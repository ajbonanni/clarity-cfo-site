// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfYTgy1MWfDEzRv-i800L9ca3f56aufC",
  authDomain: "clarity-cfo.firebaseapp.com",
  projectId: "clarity-cfo",
  storageBucket: "clarity-cfo.appspot.com",
  messagingSenderId: "744282604632",
  appId: "1:744282604632:web:33f064b034e82a9c40f62d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
