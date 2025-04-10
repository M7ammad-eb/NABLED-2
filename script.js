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
            //console.log('User signed out');
            window.location.href = 'signin.html';
        })
        .catch((error) => {
            //console.error('Sign-out error:', error);
        });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js')
            .then(function(registration) {
                //console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, function(err) {
                //console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Check for user authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        signOutButton.style.display = "block";

        // Load data into localStorage (if needed) AND THEN display items.
        // Pass `false` for initial load to potentially use cache/localStorage
        await loadDataIntoLocalStorage(false);
        displayItems();
        setupSearch(); // Set up search AFTER data is loaded

        // Offline indicator (Corrected placement)
        function updateOnlineStatus() {
            const offlineMessage = document.getElementById('offline-message');
            if (offlineMessage) { // Check if element exists
                if (!navigator.onLine) {
                    offlineMessage.style.display = 'block';
                } else {
                    offlineMessage.style.display = 'none';
                }
            }
        }
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Check initial status
    } else {
        // User is signed out.
        signOutButton.style.display = "none";
        window.location.href = "signin.html";
    }
});

// Load data into localStorage (modified to accept forceRefresh)
// forceRefresh = true will bypass localStorage check and add cache-busting
async function loadDataIntoLocalStorage(forceRefresh = false) {
    try {
        // Only fetch if forced OR data is not in localStorage
        if (forceRefresh || !localStorage.getItem('dataSheet') || !localStorage.getItem('permissionRows')) {
            console.log(forceRefresh ? "Forcing refresh..." : "Fetching data as it's missing from localStorage...");

            // Add cache-busting parameter if forcing refresh
            const cacheBuster = forceRefresh ? `&_=${Date.now()}` : '';

            // Use cache-busting URLs when forcing refresh
            const currentSheetUrl = `${sheetUrl}${cacheBuster}`;
            const currentPermissionsUrl = `${permissionsSheetUrl}${cacheBuster}`;

            // --- Fetch with cache-busting ---
            // The { cache: 'reload' } option can also help instruct the browser
            // but cache-busting URLs are generally more robust against SW and intermediaries.
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(currentSheetUrl, { cache: forceRefresh ? 'reload' : 'default' }),
                fetch(currentPermissionsUrl, { cache: forceRefresh ? 'reload' : 'default' })
            ]);

            if (!dataResponse.ok || !permissionsResponse.ok) {
                throw new Error(`HTTP error! Status: ${dataResponse.status}, ${permissionsResponse.status}`);
            }

            const dataCsvText = await dataResponse.text();
            const permissionsCsvText = await permissionsResponse.text();

            const dataRows = parseCSV(dataCsvText);
            const permissionRows = parseCSV(permissionsCsvText);

            // Store the freshly fetched data
            localStorage.setItem('dataSheet', JSON.stringify({ data: dataRows }));
            localStorage.setItem('permissionRows', JSON.stringify({ data: permissionRows }));
            console.log("Data loaded into localStorage");
        } else {
             console.log("Using data from localStorage (initial load or already present).");
        }

    } catch (error) {
        console.error("Error fetching and storing data:", error);
        // Consider showing an error to the user here.
        // Potentially display old data if fetch fails but localStorage exists?
        // Or show a clearer error message on screen.
        const itemsList = document.getElementById('items-list');
        if(itemsList) {
            itemsList.innerHTML = '<p>Error loading data. Please check your connection and try refreshing.</p>';
        }
    }
}

// deal with csv files
function parseCSV(csvText) {
    // Make sure PapaParse library is loaded before calling this
    if (typeof Papa === 'undefined') {
        console.error("PapaParse library not loaded!");
        return []; // Return empty array or handle error appropriately
    }
    return Papa.parse(csvText, { header: false }).data;
}

// Display items (using localStorage data) with transition, image, and placeholder
function displayItems() {
    const itemsList = document.getElementById('items-list');
    if (!itemsList) return; // Guard clause if element doesn't exist
    itemsList.innerHTML = ''; // Clear previous items

    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));

    if (cachedData && cachedData.data && cachedPermission && cachedPermission.data && auth.currentUser) { // Check auth.currentUser too
        const dataRows = cachedData.data;
        const permissionRows = cachedPermission.data;

        const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
        // Default to empty array if no permissions found
        const visibleColumns = userPermissions
            ? userPermissions.slice(2).map(String).filter(val => val.trim() !== '').map(Number).filter(val => !isNaN(val)) // More robust check for valid numbers
            : [];

        if (visibleColumns.length === 0 && userPermissions) {
            itemsList.innerHTML = '<p>You do not have permissions to view any columns. Please contact an administrator.</p>';
            return; // Stop if user has permissions row but no valid columns
        }
         if (!userPermissions) {
            itemsList.innerHTML = '<p>Your email is not configured for access. Please contact an administrator.</p>';
            return; // Stop if user email not found in permissions
        }


        for (let i = 1; i < dataRows.length; i++) { // Start from 1 to skip header row
            const item = dataRows[i];
            if (!item || item.length === 0 || item.every(cell => cell.trim() === '')) continue; // Skip empty/invalid rows

            const itemId = item[0] || ''; // Default to empty string if undefined
            const itemName = item[1] || 'No Name'; // Default name
            const itemImage = item[3]; // Get the image URL (index 3)

            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-container'); // Add a class for potential styling

            // Use a ternary operator to check if itemImage is valid and not just whitespace
            const imageSrc = itemImage && String(itemImage).trim() !== "" ? String(itemImage).trim() : "placeholder.png";

            itemDiv.innerHTML = `
                <a href="detail.html?id=${encodeURIComponent(itemId)}" class="item-row" data-item-id="${itemId}" data-transition-id="${itemId}">
                    <img src="${imageSrc}" alt="${itemName}" class="list-image" style="width: 30px; height: 30px; object-fit: cover; margin-right: 10px;" onerror="this.src='placeholder.png'; this.onerror=null;">
                    <div class="item-code">${itemId}</div>
                    <div class="item-description">${itemName}</div>
                </a>`;
            itemsList.appendChild(itemDiv);
        }
         if (itemsList.children.length === 0 && dataRows.length > 1) {
             // Data rows exist but maybe user permissions filtered everything out implicitly
             itemsList.innerHTML = '<p>No items to display based on your permissions or data.</p>';
         } else if (dataRows.length <= 1) {
             itemsList.innerHTML = '<p>No item data found in the source sheet.</p>';
         }

    } else if (!auth.currentUser) {
         itemsList.innerHTML = '<p>Authenticating...</p>'; // Or handle redirect state
    }
    else {
        // This case is now less likely if loadDataIntoLocalStorage handles errors
        itemsList.innerHTML = '<p>Loading data or error occurred. Please try refreshing.</p>';
        console.warn("DisplayItems called but data/permissions missing from localStorage.");
    }
}


function getUserPermissions(permissions, userEmail) {
  if (!permissions || !userEmail) {
    console.log("Permissions or userEmail missing for getUserPermissions");
    return null; // Or handle the missing permissions appropriately
  }
  userEmail = userEmail.trim().toLowerCase(); // Normalize email
  for (let i = 1; i < permissions.length; i++) { // Start i=1 to skip header
    // Check if permission row and email cell exist
    if(permissions[i] && typeof permissions[i][0] === 'string') {
        let storedEmail = permissions[i][0].trim().toLowerCase(); //Normalize stored email
        if (storedEmail === userEmail) {
          return permissions[i];
        }
    } else {
        // console.warn(`Invalid permission row at index ${i}:`, permissions[i]);
    }
  }
  console.log(`Permissions not found for email: ${userEmail}`);
  return null;
}

// *** Deprecated cache functions - replaced by standard localStorage usage ***
// function getCachedData(key) { ... }
// function cacheData(key, data) { ... }
// async function loadData() { ... }


// Refresh Button (Updated to call loadDataIntoLocalStorage with force=true)
document.querySelector(".refresh-button").addEventListener("click", async function() {
    console.log("Refresh button clicked");
    // Add a visual indicator that refresh is starting
    this.disabled = true; // Disable button to prevent double clicks
    this.textContent = 'Refreshing...'; // Change text

    // Clear previous data from localStorage
    localStorage.removeItem('dataSheet');
    localStorage.removeItem('permissionRows');
    console.log("Cleared localStorage for data/permissions.");

    // Force fetch fresh data using cache-busting
    await loadDataIntoLocalStorage(true); // Pass true to force refresh

    // Redisplay items with the newly fetched data
    displayItems();
    // Re-setup search on the new items
    setupSearch(); // Make sure setupSearch is robust enough to be called multiple times

    // Re-enable button and restore text
    this.disabled = false;
    this.textContent = 'Refresh'; // Or use an icon/original text

    console.log("Refresh complete.");
});

// Search functionality (now using localStorage data)
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    const itemsList = document.getElementById('items-list');

    if (!searchInput || !itemsList) {
        console.warn("Search input or items list not found for setupSearch.");
        return;
    }

    // Use 'input' event for real-time filtering
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        // Iterate over the actual item elements currently in the DOM
        const itemElements = itemsList.querySelectorAll('.item-container'); // Use the container class we added

        itemElements.forEach(itemElement => {
            const itemLink = itemElement.querySelector('a.item-row'); // Find the link inside
            if (!itemLink) return; // Skip if structure is unexpected

            const itemCodeElement = itemLink.querySelector('.item-code');
            const itemDescriptionElement = itemLink.querySelector('.item-description');

            // Check if elements exist before accessing textContent
            const itemId = itemCodeElement ? itemCodeElement.textContent.toLowerCase() : '';
            const itemDescription = itemDescriptionElement ? itemDescriptionElement.textContent.toLowerCase() : '';

            // Show if search term is empty or if it matches code or description
            const isMatch = searchTerm === '' || itemId.includes(searchTerm) || itemDescription.includes(searchTerm);
            itemElement.style.display = isMatch ? 'block' : 'none'; // Use block display for the container div
        });
    });
}
