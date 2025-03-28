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

// Call loadData() and proceed
// Check for user authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        signOutButton.style.display = "block";

        // Load data into localStorage (if needed) AND THEN display items.
        await loadDataIntoLocalStorage(); // Await data loading
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

// Load data into localStorage (called on login and refresh)
async function loadDataIntoLocalStorage() {
    try {
        // Fetch data ONLY if it's not already in localStorage
        if (!localStorage.getItem('dataSheet') || !localStorage.getItem('permissionRows')) {
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(sheetUrl),
                fetch(permissionsSheetUrl)
            ]);

            if (!dataResponse.ok || !permissionsResponse.ok) {
                throw new Error(`HTTP error! Status: ${dataResponse.status}, ${permissionsResponse.status}`);
            }

            const dataCsvText = await dataResponse.text();
            const permissionsCsvText = await permissionsResponse.text();

            const dataRows = parseCSV(dataCsvText);
            const permissionRows = parseCSV(permissionsCsvText);

            localStorage.setItem('dataSheet', JSON.stringify({ data: dataRows }));
            localStorage.setItem('permissionRows', JSON.stringify({ data: permissionRows }));
            console.log("Data loaded into localStorage");
        }

    } catch (error) {
        console.error("Error fetching and storing data:", error);
        // Consider showing an error to the user here.
    }
}

// deal with csv files
function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}

// Display items (using localStorage data) with transition, image, and placeholder
function displayItems() {
    const itemsList = document.getElementById('items-list');
    itemsList.innerHTML = ''; // Clear previous items

    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));

    if (cachedData && cachedData.data && cachedPermission && cachedPermission.data) {
        const dataRows = cachedData.data;
        const permissionRows = cachedPermission.data;

        const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
        const visibleColumns = userPermissions
            ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
            : [];

        if (visibleColumns.length === 0) {
            return;
        }

        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
            const itemId = item[0];
            const itemName = item[1];
            const itemImage = item[3]; // Get the image URL

            const itemDiv = document.createElement('div');

            // Use a ternary operator to check if itemImage is valid
            const imageSrc = itemImage && itemImage.trim() !== "" ? itemImage : "placeholder.png";

            itemDiv.innerHTML = `
                <a href="detail.html?id=${itemId}" class="item-row" data-item-id="${itemId}" data-transition-id="${itemId}">
                    <div class="item-code">${itemId}</div>
                    <div class="item-description">${itemName}</div>
                    <img src="${imageSrc}" alt="${itemName}" class="list-image" style="width: 30px; height: 30px; object-fit: cover; margin-right: 10px;">
                </a>`;  // Use imageSrc here
            itemsList.appendChild(itemDiv);
        }
    } else {
        itemsList.innerHTML = '<p>Error: Item data not found. Please refresh.</p>';
    }
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

// Check if cached data exists and is recent
function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const parsed = JSON.parse(cached);
        const now = new Date().getTime();
        if (now - parsed.timestamp < 60 * 60 * 1000) {
            //console.log("Using cached data for:", key);
            return parsed.data;
        }
    }
    return null;
}

// Save data to cache with a timestamp
function cacheData(key, data) {
    localStorage.setItem(key, JSON.stringify({
        data: data,
        timestamp: new Date().getTime()
    }));
}

// Function to load data (from cache or fetch)
async function loadData() {
    let dataRows = getCachedData("dataSheet");
    let permissionRows;

    if (!dataRows) {
        //console.log("Fetching fresh data...");
        try {
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(sheetUrl).then(res => res.text()),
                fetch(permissionsSheetUrl).then(res => res.text())
            ]);
            dataRows = parseCSV(dataResponse);
            permissionRows = parseCSV(permissionsResponse);
            cacheData("dataSheet", dataRows);
            cacheData("permissionRows", permissionRows);
            //console.log("cached permissionRows:", permissionRows);
        } catch (error) {
            //console.error("Error fetching data:", error);
        }
    } else {
        //console.log("Using cached data for dataRows...");
        try {
            const permissionsResponse = await fetch(permissionsSheetUrl).then(res => res.text());
            permissionRows = parseCSV(permissionsResponse);
        } catch (error) {
            //console.error("Error fetching permissions data:", error);
        }
    }
    return { dataRows, permissionRows };
}

// Refresh Button
document.querySelector(".refresh-button").addEventListener("click", async function() {
    // Clear localStorage
    localStorage.removeItem('dataSheet');
    localStorage.removeItem('permissionRows');

    // Optionally, redisplay items (which will now fetch fresh data)
    await loadDataIntoLocalStorage(); // Make sure new data is loaded
    displayItems();
    setupSearch();
});

// Search functionality (now using localStorage data)
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    const itemsList = document.getElementById('items-list');

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
          if (cachedData && cachedData.data) {
            const dataRows = cachedData.data;

            //Iterate over item, not the cached data
            Array.from(itemsList.children).forEach(itemElement => {
                const itemId = itemElement.querySelector('.item-code').textContent.toLowerCase();
                const itemDescription = itemElement.querySelector('.item-description').textContent.toLowerCase();
                itemElement.style.display = (itemId.includes(searchTerm) || itemDescription.includes(searchTerm)) ? 'flex' : 'none';
            });
        }
    });
}
