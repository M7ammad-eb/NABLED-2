// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyAzgx1Ro6M7Bf58dgshk_7Eflp-EtZc9io",
  authDomain: "nab-led.firebaseapp.com",
  projectId: "nab-led",
  storageBucket: "nab-led.firebasestorage.app",
  messagingSenderId: "789022171426",
  appId: "1:789022171426:web:2d8dda594b1495be26457b",
  measurementId: "G-W58SF16RJ6"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Google Sign-In
const signInButton = document.getElementById('signInButton');
signInButton.addEventListener('click', signInWithGoogle);

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      // User signed in successfully
      const user = result.user;
      console.log('User signed in:', user);
      // Redirect to the main page after successful sign-in
      window.location.href = 'index.html';
    })
    .catch((error) => {
      // Handle sign-in error
      console.error('Sign-in error:', error);
    });
}
