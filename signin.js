// Firebase configuration (same as before)
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
  auth.signInWithRedirect(provider);  // Initiates the redirect flow
}

// Handle the result of the redirect
auth.getRedirectResult().then((result) => {
  if (result.user) {
    // User signed in successfully
    const user = result.user;
    console.log('User signed in:', user);

    // After successful login, redirect to main page
    window.location.replace('index.html'); // Use replace to remove login page from history
  }
}).catch((error) => {
  // Handle errors
  console.error('Sign-in error:', error);
});
