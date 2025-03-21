// script.js
import { auth } from './auth.js'; // Import the auth object

// Data sheet
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';
// Permissions sheet
const permissionsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv';

// Sign Out
const signOutButton = document.getElementById('signOutButton');
if (signOutButton) { // Best practice: Check if element exists
    signOutButton.addEventListener('click', signOut);
}

function signOut() {
    auth.signOut()
        .then(() => {
            window.location.href = 'signin.html';
        })
        .catch((error) => {
            console.error('Sign-out error:', error);
        });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Check for user authentication
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        if (signOutButton) {
            signOutButton.style.display = "block";
        }

        // Load data into localStorage (if needed) AND THEN display items.
        await loadDataIntoLocalStorage(); // Await data loading
        displayItems(); // No arguments needed
        setupSearch(); // Set up search AFTER data is loaded

        // Offline indicator
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
      if (signOutButton) {
        signOutButton.style.display = "none";
      }
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
        // Consider showing an error to the user here.  Good practice!
    }
}

// deal with csv files
function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}

// Display items (using localStorage data)
function displayItems() {
    const itemsList = document.getElementById('items-list');
    if (!itemsList) return; // Important: Exit if the element doesn't exist

    itemsList.innerHTML = ''; // Clear previous items

    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));


    if (cachedData && cachedData.data && cachedPermission && cachedPermission.data) {
        const dataRows = cachedData.data;
        const permissionRows = cachedPermission.data;

        const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email); // Use auth.currentUser
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

            const itemDiv = document.createElement('div');
            let itemHtml = `<a href="detail.html?id=${itemId}" class="item-row" data-item-id="${itemId}">`;
            itemHtml += `<div class="item-code">${itemId}</div>`;
            itemHtml += `<div class="item-description">${itemName}</div>`;
            itemHtml += `</a>`;
            itemDiv.innerHTML = itemHtml;
            itemsList.appendChild(itemDiv);
        }
    } else {
        // Handle cases where localStorage might be empty (should be rare)
        itemsList.innerHTML = '<p>Error: Item data not found. Please refresh.</p>';
    }
}

function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) { // Also check for null/undefined email
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

// Refresh Button (Simplified)
const refreshButton = document.querySelector(".refresh-button");
if (refreshButton) { // Check if the button exists
    refreshButton.addEventListener("click", async function() {
        // Clear localStorage to force a data refresh
        localStorage.removeItem('dataSheet');
        localStorage.removeItem('permissionRows');
        await loadDataIntoLocalStorage(); // Reload data
        displayItems(); // Re-display items
        setupSearch();   // Re-setup search
    });
}


// Search functionality (now using localStorage data)
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    const itemsList = document.getElementById('items-list');
    if (!searchInput || !itemsList) return; // Check if elements exist

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
