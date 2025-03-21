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

// deal with csv files
function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}

// Display items (using localStorage data)
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

// Function to force load data (refresh button)
async function forceLoadData() {
    //console.log("Fetching new data...");
    try {
        const [dataResponse, permissionsResponse] = await Promise.all([
            fetch(sheetUrl).then(res => res.text()),
            fetch(permissionsSheetUrl).then(res => res.text())
        ]);
        dataRows = parseCSV(dataResponse);
        permissionRows = parseCSV(permissionsResponse);
        cacheData("dataSheet", dataRows);
    } catch (error) {
        //console.error("Error fetching data:", error);
    }
    return { dataRows, permissionRows };
}

// Refresh Button
document.querySelector(".refresh-button").addEventListener("click", async function() {
    //let icon = this.querySelector("svg");
    //icon.classList.add("rotate");
    const user = auth.currentUser;
    if (!user) {
        //console.error("No authenticated user found.");
        window.location.href = "signin.html";
        return;
    }
    const { dataRows, permissionRows } = await forceLoadData();
    displayItems(dataRows, permissionRows, user.email);
    setupSearch(dataRows); // Refresh the search with new data
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
