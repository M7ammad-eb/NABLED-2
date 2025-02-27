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

// Check for user authentication on page load
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    console.log('User is already signed in:', user);
    fetchAndDisplayData();
  } else {
    // No user is signed in
    console.log('No user is signed in.');
    // Redirect to the sign-in page
    window.location.href = 'signin.html';
  }
});

// Fetch and display data from Google Sheets
function fetchAndDisplayData() {
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv'; // Replace with your published sheet URL

  fetch(sheetUrl)
    .then(response => response.text()) // Assuming CSV format
    .then(data => {
      const rows = parseCSV(data);
      displayItems(rows);
    })
    .catch(error => console.error('Error fetching data:', error));
}

function parseCSV(csvText) {
  const rows = csvText.split('\n');
  return rows.map(row => row.split(','));
}

function displayItems(items) {
  const itemsList = document.getElementById('items-list');
  itemsList.innerHTML = ''; // Clear previous items

  // Assuming the first row is the header, start from the second row
  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const itemId = item[0]; // Assuming ID is the first column
    const itemName = item[1]; // Assuming name is the second to last column

    const itemDiv = document.createElement('div');
    itemDiv.innerHTML = `<a href="detail.html?id=${itemId}">${itemName} (ID: ${itemId})</a>`;
    itemsList.appendChild(itemDiv);
  }
}
