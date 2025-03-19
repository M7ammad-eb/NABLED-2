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
const dataSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';
const permissionsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv';//added this line

let columnNames = []; // Define columnNames at the top level

// Check if the user is already logged in
auth.onAuthStateChanged(async (user) => { // Make this function async
    if (user) {
        // User is signed in, show content
        document.getElementById('login-ui').style.display = 'none';
        document.getElementById('user-content').style.display = 'block';
        document.getElementById('sign-out-button').style.display = 'block';//added

         // Fetch and store data and permissions in localStorage
        if (!localStorage.getItem('dataSheet') || !localStorage.getItem('permissionRows')) {
            try {
                const dataResponse = await fetch(dataSheetUrl);
                const dataCsvText = await dataResponse.text();
                const dataSheet = parseCSV(dataCsvText);

                const permissionsResponse = await fetch(permissionsSheetUrl);
                const permissionsCsvText = await permissionsResponse.text();
                const permissionRows = parseCSV(permissionsCsvText);

                localStorage.setItem('dataSheet', JSON.stringify({ data: dataSheet }));
                localStorage.setItem('permissionRows', JSON.stringify({ data: permissionRows }));
            } catch (error) {
                console.error("Error fetching and storing data:", error);
            }
        }

        displayItems(); // Now call displayItems after data is potentially stored
        setupSearch(JSON.parse(localStorage.getItem('dataSheet')).data);

        //Sign out
        document.getElementById('sign-out-button').addEventListener('click', () => {
          auth.signOut().then(() => {
            // Sign-out successful.
            localStorage.clear(); // Clear
            window.location.reload();
          }).catch((error) => {
            // An error happened.
            console.error("Sign-out error:", error);
          });
        });

        // Detect offline status and show message if needed.
        function updateOnlineStatus() {
            const offlineMessage = document.getElementById('offline-message');
            if (!navigator.onLine) {
                offlineMessage.style.display = 'block';
            } else {
                offlineMessage.style.display = 'none';
            }
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Check initial status
    } else {
        // User is not signed in, redirect to login page
        document.getElementById('login-ui').style.display = 'block';
        document.getElementById('user-content').style.display = 'none';
        document.getElementById('sign-out-button').style.display = 'none';//added

        // Redirect to signin.html if not already there
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') {
            window.location.href = 'signin.html';
        }
    }
});

async function displayItems() {
    const itemsContainer = document.getElementById('items-container');
    itemsContainer.innerHTML = '';

    try {
      const dataSheet = JSON.parse(localStorage.getItem('dataSheet')).data;
      const permissionRows = JSON.parse(localStorage.getItem('permissionRows')).data;
      columnNames = dataSheet[0];
      const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
      const visibleColumns = userPermissions
      ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
      : [];
      for (let i = 1; i < dataSheet.length; i++) {
        const item = dataSheet[i];
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';

        itemDiv.innerHTML = `
        <p><img src="${item[3]}" alt="${item[1]}"></p>
        <h2>${item[1]}</h2>
        `;
        // Add a click event listener to navigate to detail.html
        itemDiv.addEventListener('click', () => {
            window.location.href = `detail.html?id=${item[0]}`;
        });

        itemsContainer.appendChild(itemDiv);
    }


    } catch (error) {
        console.error("Error fetching or parsing data:", error);
        itemsContainer.innerHTML = '<p>Error loading items.</p>';
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

function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}

// Search functionality (CORRECTED)
function setupSearch(items) {
    const searchInput = document.querySelector('.search-input');
    const itemsList = document.getElementById('items-list'); // Corrected ID

    searchInput.addEventListener('input', function() {
        const searchTerm = searchInput.value.toLowerCase();
        Array.from(itemsList.children).forEach(itemElement => {
            // Get item ID and description from the cached data
            const itemId = itemElement.querySelector('h2').previousElementSibling.querySelector('img').alt; // Get ID based on image alt
            const itemDescription = itemElement.querySelector('h2').textContent.toLowerCase();
            itemElement.style.display = (itemId.includes(searchTerm) || itemDescription.includes(searchTerm)) ? 'flex' : 'none';
        });
    });
}
