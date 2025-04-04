// detail.js (FINAL - Correct Offline Handling)

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

async function displayItemDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    document.getElementById('item-details').innerHTML = '<p>Item ID not found.</p>';
    return;
  }

  // Get data from localStorage (populated by script.js)
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
      // Display the item
      displayItem(item, visibleColumns, dataRows[0]); // Pass columnNames
    } else {
      // Item not found in data (should be very rare)
      displayOfflineMessage(); // Use a helper function
    }
  } else {
    // localStorage is empty (should be very rare)
    displayOfflineMessage(); // Use a helper function
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
        return null;
    }
    userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) {
        let storedEmail = permissions[i][0].trim().toLowerCase();
        if (storedEmail === userEmail) {
            return permissions[i];
        }
    }
    return null;
}

// add transition
function displayItem(item, visibleColumns, columnNames) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = '';

  // Image (Placeholder initially, will be dynamically loaded)
  const img = document.createElement('img'); // Create an <img> element directly
  img.src = "placeholder.png";  // Set the placeholder image initially
  img.alt = item[1] || "Product Image"; // Use a default alt text if item[1] is undefined
  img.classList.add('product-image');
  img.dataset.src = item[3] || ""; // Store the real image URL (or empty string if it doesn't exist).  CRUCIAL for handling missing images

  itemDetailsDiv.appendChild(img);


  // Item Name
  const itemName = document.createElement('p');
  itemName.innerHTML = `<h2>${item[1] || ""}</h2><br>`; // Use empty string if item[1] is undefined.  Good practice for ALL data.
  itemDetailsDiv.appendChild(itemName);

  // Item ID
  const itemId = document.createElement('p');
  itemId.innerHTML = `${columnNames[0] || ""} <br><strong>${item[0] || ""}</strong><br>`; // Handle potential undefined values.
  itemDetailsDiv.appendChild(itemId);

  // Specifications
  const specs = document.createElement('p');
  specs.innerHTML = `${columnNames[2] || ""} <br><strong>${item[2] || ""}</strong><br>`; // Handle potential undefined values.
  itemDetailsDiv.appendChild(specs);

  // Cataloge Link
  const catalog = document.createElement('p');
  const catalogLink = item[4] ? `<a href="${item[4]}">${columnNames[4] || ""}</a>` : (columnNames[4] || ""); // Make link conditional.  Handle undefined columnNames[4] too
  catalog.innerHTML = `${catalogLink}<br>`;
  itemDetailsDiv.appendChild(catalog);


  // Prices (Corrected visibility check)
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
  //  Use an Image() object for preloading and error handling
  if (img.dataset.src) { // Only attempt to load if a data-src exists
    const realImageLoader = new Image();
    realImageLoader.src = img.dataset.src;

    realImageLoader.onload = () => {
        img.src = realImageLoader.src; // Set the src to the loaded image
    };

    realImageLoader.onerror = () => {
        // Optionally, you could change the placeholder here to a different
        // "image not found" image, or add a class to style it differently.
        // img.src = "image-not-found.png"; 
        console.error("Image failed to load:", img.dataset.src);  // Good for debugging
    };

  }
}


//Helper function to display offline message
function displayOfflineMessage() {
    document.getElementById('item-details').innerHTML = `
        <p>Item details are not available offline.</p>
        <p>Please connect to the internet to view this item.</p>
        <img src="placeholder.png" alt="Placeholder Image">
    `;
}

function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}
