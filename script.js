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
/*
// Install Prompt (add this after the service worker registration)
let deferredPrompt; // Store the install prompt

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can add to home screen
    showInstallPromotion(); // Call a function to display your custom prompt
});

function showInstallPromotion() {
    const installContainer = document.getElementById('install-container');
    const installButton = document.getElementById('installButton');

    // Show the install container
    installContainer.style.display = 'block';

    installButton.addEventListener('click', (e) => {
        deferredPrompt.prompt();

        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                //console.log('User accepted the A2HS prompt');
                installContainer.style.display = 'none'; // Hide after installation
            } else {
                //console.log('User dismissed the A2HS prompt');
            }
            deferredPrompt = null;
        });
    });
}
*/

// Call loadData() and proceed
auth.onAuthStateChanged(async (user) => {
    if (user) {
        signOutButton.style.display = "block";
        const { dataRows, permissionRows } = await loadData();
        displayItems(dataRows, permissionRows, user.email);
        setupSearch(dataRows); // Setup search after data is loaded
    } else {
        signOutButton.style.display = "none";
        window.location.href = "signin.html";
    }
});

// deal with csv files
function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}

// display the items
function displayItems(items, permissions, userEmail) {
    const itemsList = document.getElementById('items-list');
    itemsList.innerHTML = ''; // Clear previous items

    const userPermissions = getUserPermissions(permissions, userEmail);

    const visibleColumns = userPermissions
        ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
        : [];

    if (visibleColumns.length === 0) {
        //console.log('No visible columns for this user.');
        return;
    }

    for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const itemId = item[0];
        const itemName = item[1];

        const itemDiv = document.createElement('div');
        let itemHtml = `<a href="detail.html?id=${itemId}" class="item-row" data-item-id="${itemId}">`;

        itemHtml += `<div class="item-code">${itemId}</div>
                     <div class="item-description">${itemName}</div>`;
        itemHtml += `</a>`;
        itemDiv.innerHTML = itemHtml;
        itemsList.appendChild(itemDiv);
    }
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

// Search functionality
function setupSearch(items) {
    const searchInput = document.querySelector('.search-input');
    const itemsList = document.getElementById('items-list');

    searchInput.addEventListener('input', function() {
        const searchTerm = searchInput.value.toLowerCase();
        Array.from(itemsList.children).forEach(itemElement => {
            const itemId = itemElement.querySelector('.item-code').textContent.toLowerCase();
            const itemDescription = itemElement.querySelector('.item-description').textContent.toLowerCase();
            itemElement.style.display = (itemId.includes(searchTerm) || itemDescription.includes(searchTerm)) ? 'flex' : 'none';
        });
    });
}
