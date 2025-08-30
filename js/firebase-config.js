// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCfYTgv1MVWfDezRV-i00oL9ca3f56auFc",
  authDomain: "clarity-cfo.firebaseapp.com",
  projectId: "clarity-cfo",
  storageBucket: "clarity-cfo.firebasestorage.app",
  messagingSenderId: "744282604632",
  appId: "1:744282604632:web:33f064b034e82a9c40f62d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
// Force redeploy fix – 08/29/2025
