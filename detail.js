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

// URLs for both sheets
const dataSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';
const permissionsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv';

// Check for user authentication on page load
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    console.log('User is already signed in:', user);
    displayItemDetails();
  } else {
    // No user is signed in
    console.log('No user is signed in.');
    // Redirect to the sign-in page
    window.location.href = 'signin.html';
  }
});

function displayItemDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    document.getElementById('item-details').innerHTML = '<p>Item ID not found.</p>';
    return;
  }

  Promise.all([
    fetch(dataSheetUrl).then(response => response.text()),
    fetch(permissionsSheetUrl).then(response => response.text())
  ])
  .then(([data, permissions]) => {
    const dataRows = parseCSV(data);
    const permissionRows = parseCSV(permissions);

    const item = findItemById(dataRows, itemId);
    if (item) {
      const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
      const visibleColumns = userPermissions ? userPermissions.slice(2) :;
      displayItem(item, visibleColumns); // Pass visibleColumns
    } else {
      // ... (Handle item not found)
      document.getElementById('item-details').innerHTML = '<p>Item not found.</p>';
    }
  })
  .catch(error => console.error('Error fetching data:', error));
}


function parseCSV(csvText) {
  const rows = csvText.split('\n');
  return rows.map(row => row.split(','));
}

function findItemById(items, itemId) {
  for (let i = 1; i < items.length; i++) {
    if (items[i][0] === itemId) {
      return items[i];
    }
  }
  return null;
}

function getUserPermissions(permissions, userEmail) {
  for (let i = 1; i < permissions.length; i++) {
    if (permissions[i][0] === userEmail) {
      return permissions[i];
    }
  }
  return null; // Or handle the case where no permissions are found for the user
}


function displayItem(item) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = ''; // Clear previous details

  // Assuming the first row is the header, start from the second row
  // Display all columns as key-value pairs
  for (let i = 0; i < item.length; i++) {
      if (visibleColumns.includes(i)) { // Check if the column is visible
        const key = i === 0 ? 'ID' : i;
        const value = item[i];
        const detail = document.createElement('p');
        detail.innerHTML = `<strong>${key}:</strong> ${value}`;
        itemDetailsDiv.appendChild(detail);
      }
    }
}
