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
    itemDetailsDiv.style.position = 'relative'; // Ensure relative positioning

    // --- Shared Element Transition Start ---
    const transitionData = JSON.parse(sessionStorage.getItem('transition-start'));
    let startRect;

    if (transitionData && transitionData.id === item[0]) {
        startRect = transitionData.rect;
        sessionStorage.removeItem('transition-start');
    }

    // Image with data-transition-id, initially hidden
    const img = document.createElement('p');
    img.innerHTML = `<img src="${startRect ? transitionData.imageSrc : 'placeholder.png'}" alt="${item[1]}" class="product-image" data-src="${item[3]}" data-transition-id="${item[0]}" style="opacity: ${startRect ? 1 : 0};">`;
    itemDetailsDiv.appendChild(img);
    const imageElement = img.querySelector('.product-image');

    // ... (Rest of your displayItem function - itemName, itemId, etc.) ...
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
    // Prices (Corrected visibility check)
    for (let i = 5; i < item.length; i++) {
        if (visibleColumns[i] === 1) {
            const key = columnNames[i];
            const value = item[i];
            const prices = document.createElement('p');
            prices.innerHTML = `${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol"><br>`;
            itemDetailsDiv.appendChild(prices);
        }
    }

    // --- Shared Element Transition (Positioning and Animation) ---
    if (startRect) {
        // 1. Position the image absolutely at the *start* position
        imageElement.style.position = 'absolute';

        const containerRect = itemDetailsDiv.getBoundingClientRect();
        imageElement.style.top = `${startRect.top - containerRect.top}px`;
        imageElement.style.left = `${startRect.left - containerRect.left}px`;
        imageElement.style.width = `${startRect.width}px`;
        imageElement.style.height = `${startRect.height}px`;
        imageElement.style.opacity = 1;
        imageElement.style.transition = 'none'; // Disable transitions *initially*
        imageElement.style.zIndex = 1000;     // Ensure it's on top

        // 2. Force a reflow (necessary for the transition to work)
        void imageElement.offsetWidth;

        // 3. Set the final position/size (relative to its parent) and animate
        imageElement.style.transition = 'all 0.3s ease'; // Enable transitions
        imageElement.style.position = 'relative'; // Back to normal positioning
        imageElement.style.top = '0';
        imageElement.style.left = '0';
        imageElement.style.width = '100%'; // Or whatever your final size should be
        imageElement.style.height = '33%';
        imageElement.style.objectFit = 'cover';
        imageElement.style.opacity = 1; // Fade in

        //Clean up styles
        imageElement.addEventListener('transitionend', () => {
            imageElement.style.transition = ''; // Remove the transition
            imageElement.style.zIndex = '';    // Reset z-index
        });
    } else {
        // If no transition data, just load the image normally
        imageElement.src = imageElement.dataset.src;
        imageElement.style.opacity = 1;
    }
    // --- Shared Element Transition End ---
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
