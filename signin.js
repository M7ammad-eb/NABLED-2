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
  auth.signInWithRedirect(provider);
}

// Handle the redirect result after authentication.  This is the KEY part.
auth.getRedirectResult()
  .then((result) => {
    if (result.credential) {
      // This gives you a Google Access Token. You can use it to access the Google API.
      // const token = result.credential.accessToken; // Not usually needed for simple sign-in
      // The signed-in user info.
      const user = result.user;
      console.log('User signed in:', user);
      // Redirect to index.html AFTER successful sign-in
      window.location.href = 'index.html';
    } else if (result.user) {  //User ALREADY signed in
        window.location.href = 'index.html';
    }
  }).catch((error) => {
    // Handle Errors here.
    const errorCode = error.code;
    const errorMessage = error.message;
    // The email of the user's account used.
    const email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    const credential = error.credential;

    console.error('Sign-in error:', error);
  });
