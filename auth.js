// auth.js
// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAzgx1Ro6M7Bf58dgshk_7Eflp-EtZc9io",
    authDomain: "nab-led.firebaseapp.com",
    projectId: "nab-led",
    storageBucket: "nab-led.firebasestorage.app",
    messagingSenderId: "789022171426",
    appId: "1:789022171426:web:2d8dda594b1495be26457b",
    measurementId: "G-W58SF16RJ6"
};

// Initialize Firebase (only once!)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Handle the result of the redirect (runs on EVERY page load)
auth.getRedirectResult().then((result) => {
    if (result.credential) { // Use result.credential, more reliable
        // User signed in successfully
        const user = result.user;
        console.log('User signed in:', user);

        // After successful login, redirect to main page
        window.location.replace('index.html');
    } else if (result.user) {
       // User is ALREADY signed in (important for subsequent page loads)
       console.log("User is already signed in:", result.user);
        // Redirect to index.html if already signed in and on signin.html
        if (window.location.pathname.includes("signin.html")) {
            window.location.replace("index.html");
        }
    }
}).catch((error) => {
    // Handle errors (and show them to the user!)
    console.error('Sign-in error:', error);
    const errorElement = document.getElementById('error-message'); // Add this to your HTML
    if (errorElement) {
        errorElement.textContent = "Sign-in Error: " + error.message;
        errorElement.style.display = 'block'; // Make sure it's visible
    }
});

// Function to check if the user is signed in (useful for index.html and other pages)
function checkAuthStatus() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in.
      console.log('User is signed in:', user);
      // You can update the UI here (e.g., show user info, hide login button)
    } else {
      // User is signed out.
      console.log('User is signed out');
      // You can update the UI here (e.g., show login button)
    }
  });
}

// Export functions for use in other scripts
export { auth, checkAuthStatus };
