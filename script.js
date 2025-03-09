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
      console.log('User signed out');
      // Redirect to sign-in page or refresh
      window.location.href = 'signin.html';
    })
    .catch((error) => {
      console.error('Sign-out error:', error);
    });
}

// Call loadData() and proceed
auth.onAuthStateChanged(async (user) => {
    if (user) {
        signOutButton.style.display = "block";
        const { dataRows, permissionRows } = await loadData();
        displayItems(dataRows, permissionRows, user.email);
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

  // Ensure visibleColumns is an array of numbers
  const visibleColumns = userPermissions
    ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
    : [];

  // Check if there are visible columns for this user
  if (visibleColumns.length === 0) {
    console.log('No visible columns for this user.');
    return; // Exit early if no columns should be displayed
  }

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const itemId = item[0];
    const itemName = item[1];

    const itemDiv = document.createElement('div');
    let itemHtml = `<a href="detail.html?id=${itemId}" class="item-row" data-item-id="${itemId}">`;

    itemHtml += `<div class="item-code">${itemId || ''}</div>
                 <div class="item-description">${itemName || ''}</div>`;
    //itemHtml += `${itemId}<br>${itemName} `;      
    itemHtml += `</a>`;
    itemDiv.innerHTML = itemHtml;
    itemsList.appendChild(itemDiv);
  }
}

function getUserPermissions(permissions, userEmail) {
  userEmail = userEmail.trim().toLowerCase(); // Normalize user email
  
  for (let i = 1; i < permissions.length; i++) {
    let storedEmail = permissions[i][0].trim().toLowerCase(); // Normalize stored email
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
        if (now - parsed.timestamp < 60 * 60 * 1000) { // 60 minutes threshold
            console.log("Using cached data for:", key);
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
    let permissionRows; // permissions not cached

    if (!dataRows) {
        console.log("Fetching fresh data...");
        try {
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(sheetUrl).then(res => res.text()),
                fetch(permissionsSheetUrl).then(res => res.text())
            ]);

            dataRows = parseCSV(dataResponse);
            permissionRows = parseCSV(permissionsResponse); // Always fetched fresh

            cacheData("dataSheet", dataRows); // Cache only dataRows
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    } else {
        console.log("Using cached data for dataRows...");
        try {
            const permissionsResponse = await fetch(permissionsSheetUrl).then(res => res.text());
            permissionRows = parseCSV(permissionsResponse); // Always fetch fresh permissions
        } catch (error) {
            console.error("Error fetching permissions data:", error);
        }
    }

    return { dataRows, permissionRows };
}

 /* // test for search
 document.addEventListener('DOMContentLoaded', function() {
     const searchInput = document.getElementById('search-input');
     const itemsList = document.getElementById('items-list');
     let allItems = []; // Store all item elements
 
     // --- Your CSV parsing code (modified) ---
     Papa.parse(sheetUrl, { //  Replace 'your-data.csv'
         download: true,
         header: true,
         complete: function(results) {
             // Clear any existing content
             itemsList.innerHTML = '';
 
             results.data.forEach(item => {
               if(!item.ID) return;
                 const itemRow = document.createElement('div');
                 itemRow.classList.add('item-row');
                 itemRow.dataset.itemId = item.ID;
 
                 const codeDiv = document.createElement('div');
                 const itemCode = document.createElement('span');
                 itemCode.textContent = item.Code || ''; // Use empty string if null/undefined
                 codeDiv.appendChild(itemCode)
 
                 const itemTitle = document.createElement('p');
                 itemTitle.textContent = item.Description || '';
                 codeDiv.appendChild(itemTitle);
 
 
                 itemRow.appendChild(codeDiv);
 
                 // Create a div for the second part
                 const secondPartDiv = document.createElement('div');
                 const secondPart = document.createElement('p');
                 secondPart.textContent = item.SecondPart || '';
                 secondPartDiv.appendChild(secondPart);
                 itemRow.appendChild(secondPartDiv);
                 itemsList.appendChild(itemRow);
 
                 // Store item data for searching
                 allItems.push({
                     element: itemRow,
                     id: item.ID.toLowerCase(), // Store lowercase for case-insensitive search
                     description: item.Description.toLowerCase() // Store lowercase
                 });
             });
         }
     });
     // --- End of CSV parsing ---
 
     // Filter function (modified)
     searchInput.addEventListener('input', function() {
         const searchTerm = searchInput.value.toLowerCase();
 
         allItems.forEach(itemData => {
             const { element, id, description } = itemData;
 
             // Check if the search term matches either the ID or the Description
             if (id.includes(searchTerm) || description.includes(searchTerm)) {
                 element.style.display = 'flex'; // Or 'block', depending on your layout
             } else {
                 element.style.display = 'none';
             }
         });
     });
 });
 */
