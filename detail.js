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

// URLs for both sheets (used only for initial fetching of headers)
const dataSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';

// Check for user authentication on page load
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

    try {
        // Fetch data (service worker will handle caching)
        const dataResponse = await fetch(dataSheetUrl);
        const permissionsResponse = await fetch(permissionsSheetUrl);

        if (!dataResponse.ok || !permissionsResponse.ok) {
          throw new Error("Network response was not ok");
        }
        const dataCsvText = await dataResponse.text();
        const permissionsCsvText = await permissionsResponse.text();

        const dataRows = parseCSV(dataCsvText);
        const permissionRows = parseCSV(permissionsCsvText);

        const item = findItemById(dataRows, itemId);
        if (item) {
            const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
            const visibleColumns = userPermissions
                ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
                : [];

            displayItem(item, visibleColumns, dataRows[0]); // Pass columnNames directly
        } else {
            document.getElementById('item-details').innerHTML = '<p>Item not found.</p>';
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        // Display an error message if the data couldn't be loaded
        document.getElementById('item-details').innerHTML = '<p>Error loading item details. Please check your network connection.</p>';
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
        console.log("Permissions array is null or undefined.");
        return null;
    }
    userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) {
        let storedEmail = permissions[i][0].trim().toLowerCase();
        console.log("Comparing:", userEmail, "with:", storedEmail); // Debugging
        if (storedEmail === userEmail) {
            console.log("Permissions found:", permissions[i]); // Debugging
            return permissions[i];
        }
    }
    console.log("No permissions found for:", userEmail); // Debugging
    return null;
}

async function displayItem(item, visibleColumns, columnNames) { // Receive columnNames
    const itemDetailsDiv = document.getElementById('item-details');
    itemDetailsDiv.innerHTML = '';
    
    // Display the image
    const img = document.createElement('p');
    img.innerHTML = `<img src="${item[3]}" alt="${item[1]}" class="product-image">`;
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

    // Display prices based on visible columns
    for (let i = 5; i < item.length; i++) {
        if (visibleColumns[i] === 1) {
            const key = columnNames[i];
            const value = item[i];

            const prices = document.createElement('p');
            prices.innerHTML = `${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol"><br>`;
            itemDetailsDiv.appendChild(prices);
        }
    }
}

function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}
