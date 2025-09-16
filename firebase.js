// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBrbV69u2K3VZ_J4pUh4oNZWNBcLg3i2no",
  authDomain: "afi-dash-92d1a.firebaseapp.com",
  projectId: "afi-dash-92d1a",
  storageBucket: "afi-dash-92d1a.firebasestorage.app",
  messagingSenderId: "933874872692",
  appId: "1:933874872692:web:10f98d4b78c86052a5bc21",
  measurementId: "G-FYJJTLETCJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);