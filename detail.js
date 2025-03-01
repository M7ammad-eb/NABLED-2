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
    fetch(dataSheetUrl).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    }),
    fetch(permissionsSheetUrl).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
  ])
  .then(([data, permissions]) => {
    const dataRows = parseCSV(data);
    const permissionRows = parseCSV(permissions);

    const item = findItemById(dataRows, itemId);
    if (item) {
      const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
      const visibleColumns = userPermissions
        ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
        : [];
      console.log("Visible Columns:", visibleColumns); // Debugging
      console.log("Item:", item); // Debugging

      displayItem(item, visibleColumns);
    } else {
      document.getElementById('item-details').innerHTML = '<p>Item not found.</p>';
    }
  })
  .catch(error => {
    console.error('Error fetching data:', error);
    document.getElementById('item-details').innerHTML = `<p>Error fetching data: ${error.message}</p>`;
  });
}

function parseCSV(csvText) {
  return Papa.parse(csvText, { header: false }).data;
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
  userEmail = userEmail.trim().toLowerCase();
  for (let i = 1; i < permissions.length; i++) {
    let storedEmail = permissions[i][0].trim().toLowerCase();
    if (storedEmail === userEmail) {
      return permissions[i];
    }
  }
  return null;
}

async function displayItem(item, visibleColumns) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = '';

  // Fetch column names first
  const response = await fetch(dataSheetUrl);
  const csvText = await response.text();
  const parsedData = parseCSV(csvText);
  const columnNames = parsedData[0]; // First row contains column names

  // Display the image
  const img = document.createElement('p');
  img.innerHTML = `<img src="${item[3]}" alt="${item[1]}" height="300">`;
  itemDetailsDiv.appendChild(img);
    
  // Item Name
  const itemName = document.createElement('p');
  itemName.innerHTML = `<h2>${item[1]}</h2><br>`;
  itemDetailsDiv.appendChild(itemName);
  
  // Item ID
  const itemId = document.createElement('p');
  itemId.innerHTML = `${columnNames[0]}<br><strong>${item[0]}</strong><br>`;
  itemDetailsDiv.appendChild(itemId);

  // Specifications
  const specs = document.createElement('p');
  specs.innerHTML = `${columnNames[2]}<br><strong>${item[2]}</strong><br>`;
  itemDetailsDiv.appendChild(specs);

  // Cataloge Link
  const catalog = document.createElement('p');
  catalog.innerHTML = `<a href="${item[4]}">${columnNames[4]}</a><br>`;
  itemDetailsDiv.appendChild(catalog);
  

  for (let i = 5; i < item.length; i++) {
    if (visibleColumns[i] === 1) {
      const key = columnNames[i]; // Get the column name
      const value = item[i];

      const prices = document.createElement('p');
      prices.innerHTML = `${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" height="12"><br>`;
      itemDetailsDiv.appendChild(prices);
    }
  }
}
