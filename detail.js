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

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Check for user authentication
auth.onAuthStateChanged((user) => {
  if (user) {
    displayItemDetails();
  } else {
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

  // Get data directly from localStorage (populated by script.js)
  const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
  const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));


  if (cachedData && cachedData.data && cachedPermission && cachedPermission.data) {
    const dataRows = cachedData.data;
    const permissionRows = cachedPermission.data;

    const item = findItemById(dataRows, itemId);

    if (item) {
        const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
        const visibleColumns = userPermissions
            ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
            : [];

      // Display the item (using the simplified displayItem function)
      displayItem(item, visibleColumns, dataRows[0]); //Pass column name
    } else {
      document.getElementById('item-details').innerHTML = '<p>Item not found in cached data.</p>';
    }
  } else {
    // Handle the (very rare) case where localStorage is empty
    document.getElementById('item-details').innerHTML = `
            <p>Item details are not available offline.</p>
            <p>Please connect to the internet to view this app.</p>
        `;
  }
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
  if (!permissions) {
    return null; // Or handle the missing permissions appropriately
  }
  userEmail = userEmail.trim().toLowerCase(); // Normalize email
  for (let i = 1; i < permissions.length; i++) {
    let storedEmail = permissions[i][0].trim().toLowerCase(); //Normalize stored email
    if (storedEmail === userEmail) {
      return permissions[i];
    }
  }
  return null;
}

function displayItem(item, visibleColumns, columnNames) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = '';

  // Image (Placeholder initially, will be dynamically loaded)
  const img = document.createElement('p');
  img.innerHTML = `<img src="placeholder.png" alt="${item[1]}" class="product-image" data-src="${item[3]}">`;
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

  // Prices (CORRECTED visibility check)
  for (let i = 5; i < item.length; i++) {
    if (visibleColumns[i] === 1) { // Corrected check!
      const key = columnNames[i];
      const value = item[i];
      const prices = document.createElement('p');
      prices.innerHTML = `${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol"><br>`;
      itemDetailsDiv.appendChild(prices);
    }
  }

  // Lazy-load the real image (after everything else is displayed)
  const realImage = itemDetailsDiv.querySelector('.product-image');
    realImage.src = realImage.dataset.src; // Set the src from data-src
}

function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}
