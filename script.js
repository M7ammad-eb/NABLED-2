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

// Data sheet
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';
// Permissions sheet
const permissionsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv';

// Sign Out
const signOutButton = document.getElementById('signOutButton');
signOutButton.addEventListener('click', signOut);

function signOut() {
  auth.signOut()
    .then(() => {
      console.log('User signed out');
      // Redirect to sign-in page or refresh
      window.location.href = 'signin.html';
    })
    .catch((error) => {
      console.error('Sign-out error:', error);
    });
}

// Check for user authentication on page load
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    console.log('User is already signed in:', user);
    signOutButton.style.display = 'block'; // Show sign-out button
    // Fetch both data and permissions
    Promise.all([
      fetch(sheetUrl).then(response => response.text()),
      fetch(permissionsSheetUrl).then(response => response.text())
    ])
    .then(([data, permissions]) => {
      const dataRows = parseCSV(data);
      const permissionRows = parseCSV(permissions);
      displayItems(dataRows, permissionRows, user.email); // Pass user email
    })
    .catch(error => console.error('Error fetching data:', error));
  } else {
    // No user is signed in
    console.log('No user is signed in.');
    signOutButton.style.display = 'none'; // Hide sign-out button
    // Redirect to the sign-in page
    window.location.href = 'signin.html';
  }
});

function parseCSV(csvText) {
  const rows = csvText.split('\n');
  return rows.map(row => row.split(','));
}

function displayItems(items, permissions, userEmail) {
  const itemsList = document.getElementById('items-list');
  itemsList.innerHTML = ''; // Clear previous items

  const userPermissions = getUserPermissions(permissions, userEmail);

  // Ensure visibleColumns is an array of numbers
  const visibleColumns = userPermissions ? userPermissions.slice(2).map(Number) :;

  // Check if there are visible columns for this user
  if (visibleColumns.length === 0) {
    console.log('No visible columns for this user.');
    return; // Exit early if no columns should be displayed
  }

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const itemId = item[0];
    const itemName = item[item.length - 2];

    const itemDiv = document.createElement('div');
    let itemHtml = `<a href="detail.html?id=${itemId}">`;

    for (let j = 0; j < item.length; j++) {
      if (visibleColumns.includes(j)) {
        const columnName = items[0][j]; // Get column name from the header row
        itemHtml += `${columnName}: ${item[j]} `;
      }
    }

    itemHtml += `</a>`;
    itemDiv.innerHTML = itemHtml;
    itemsList.appendChild(itemDiv);
  }
}

function getUserPermissions(permissions, userEmail) {
  for (let i = 1; i < permissions.length; i++) {
    if (permissions[i][0] === userEmail) {
      return permissions[i];
    }
  }
  return null;
}
