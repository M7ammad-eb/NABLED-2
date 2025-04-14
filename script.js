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

// Data sheet URLs
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';
const permissionsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv';

// --- DOM Element References ---
const signOutButton = document.getElementById('signOutButton');
const categoriesTab = document.getElementById('categories-tab');
const itemsTab = document.getElementById('items-tab');
const categoryButtonsContainer = document.getElementById('category-buttons-container');
const actualButtonList = document.getElementById('actual-button-list'); // Div inside the container for buttons
const itemsListContainer = document.getElementById('items-list-container');
const itemsList = document.getElementById('items-list'); // The actual list where items are rendered
const itemsListTitle = document.getElementById('items-list-title');
const searchBar = document.querySelector('.search-bar');
const searchInput = document.querySelector('.search-input');
const refreshButton = document.querySelector(".refresh-button");

// --- Sign Out ---
signOutButton.addEventListener('click', signOut);

function signOut() {
    auth.signOut()
        .then(() => {
            // Clear local storage on sign out
            localStorage.removeItem('dataSheet');
            localStorage.removeItem('permissionRows');
            console.log('User signed out and local data cleared.');
            window.location.href = 'signin.html';
        })
        .catch((error) => {
            console.error('Sign-out error:', error);
        });
}

// --- Service Worker Registration ---
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

// --- Authentication State Change ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        signOutButton.style.display = "block"; // Show sign out button

        // Load data into localStorage (if needed) AND THEN set up the view.
        try {
            await loadDataIntoLocalStorage(false); // Pass false for initial load (use cache/localStorage if available)
            showCategoriesView(); // Show categories view by default
            setupSearch(); // Setup search functionality (it's initially hidden)
        } catch (error) {
            console.error("Failed to load initial data or setup view:", error);
            // Display an error message in both potential views
            if(actualButtonList) actualButtonList.innerHTML = '<p>Error loading data. Please check connection and refresh.</p>';
            if(itemsList) itemsList.innerHTML = '<p>Error loading data. Please check connection and refresh.</p>';
        }

        // Offline indicator logic (optional)
        function updateOnlineStatus() {
            // Add logic here if you have an offline indicator element
             console.log("Online status:", navigator.onLine);
        }
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Check initial status

    } else {
        // User is signed out.
        signOutButton.style.display = "none";
        // Redirect to sign-in page if not already there
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') { // Adjust path if needed
             window.location.href = "signin.html";
        }
    }
});

// --- Data Loading ---
// forceRefresh = true will bypass localStorage check and add cache-busting
async function loadDataIntoLocalStorage(forceRefresh = false) {
    try {
        // Only fetch if forced OR data is not in localStorage
        if (forceRefresh || !localStorage.getItem('dataSheet') || !localStorage.getItem('permissionRows')) {
            console.log(forceRefresh ? "Forcing refresh..." : "Fetching data (missing from localStorage or refresh forced)...");

            // Add cache-busting parameter if forcing refresh
            const cacheBuster = forceRefresh ? `&_=${Date.now()}` : '';
            const currentSheetUrl = `${sheetUrl}${cacheBuster}`;
            const currentPermissionsUrl = `${permissionsSheetUrl}${cacheBuster}`;

            // Fetch both sheets concurrently
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(currentSheetUrl, { cache: forceRefresh ? 'reload' : 'default' }),
                fetch(currentPermissionsUrl, { cache: forceRefresh ? 'reload' : 'default' })
            ]);

            if (!dataResponse.ok || !permissionsResponse.ok) {
                throw new Error(`HTTP error! Status: Data=${dataResponse.status}, Permissions=${permissionsResponse.status}`);
            }

            const dataCsvText = await dataResponse.text();
            const permissionsCsvText = await permissionsResponse.text();

            const dataRows = parseCSV(dataCsvText);
            const permissionRows = parseCSV(permissionsCsvText);

            // Basic validation: Check if header row exists (at least one row)
             if (!dataRows || dataRows.length === 0) {
                 throw new Error("Fetched data sheet appears empty or invalid.");
             }
             if (!permissionRows || permissionRows.length === 0) {
                 throw new Error("Fetched permissions sheet appears empty or invalid.");
             }

            // Store the freshly fetched data
            localStorage.setItem('dataSheet', JSON.stringify({ data: dataRows }));
            localStorage.setItem('permissionRows', JSON.stringify({ data: permissionRows }));
            console.log("Data loaded into localStorage");

        } else {
            console.log("Using data from localStorage.");
        }

    } catch (error) {
        console.error("Error fetching and storing data:", error);
        // Re-throw the error to be caught by the calling function (e.g., in auth check or refresh handler)
        throw error;
    }
}

// --- CSV Parsing ---
function parseCSV(csvText) {
    if (typeof Papa === 'undefined') {
        console.error("PapaParse library not loaded!");
        return []; // Return empty array or handle error appropriately
    }
    // Use PapaParse to parse CSV text into an array of arrays
    const result = Papa.parse(csvText, { header: false });
    if (result.errors.length > 0) {
        console.warn("PapaParse encountered errors:", result.errors);
    }
    return result.data;
}

// --- Get Unique Categories ---
function getUniqueCategories() {
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));

    if (!cachedData || !cachedData.data || cachedData.data.length < 2) { // Need at least header + 1 data row
        console.warn("No sufficient data found in localStorage for categories.");
        return [];
    }

    const dataRows = cachedData.data;
    const categories = new Set(); // Use a Set for efficient uniqueness

    // Start from 1 to skip header row
    for (let i = 1; i < dataRows.length; i++) {
        const row = dataRows[i];
        // Assuming category is in the second column (index 1)
        if (row && row[1] && typeof row[1] === 'string' && row[1].trim() !== '') {
            categories.add(row[1].trim());
        }
    }

    // Convert Set back to an array and sort alphabetically (optional)
    return [...categories].sort();
}


// --- Display Items ---
// filterCategory (optional): If provided, only items matching this category are shown.
function displayItems(filterCategory = null) {
    if (!itemsList) {
        console.error("Items list element not found!");
        return;
    }
    itemsList.innerHTML = '<p>Loading items...</p>'; // Show loading message

    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    // Permissions are not directly needed for display here, but checked for existence
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));

    if (cachedData && cachedData.data && cachedPermission && cachedPermission.data && auth.currentUser) {
        const dataRows = cachedData.data;
        let itemsFound = false; // Flag to check if any items are displayed

        // Clear previous items *before* the loop
        itemsList.innerHTML = '';

        // Start from 1 to skip header row
        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
            // Basic row validation: Ensure it's an array and has at least the columns we need (ID, Name, Category, Image URLs)
            if (!Array.isArray(item) || item.length < 7 || item.every(cell => !cell || String(cell).trim() === '')) {
                 console.warn(`Skipping invalid or empty row at index ${i}`);
                 continue; // Skip empty/invalid rows
            }

            // --- Category Filtering ---
            const itemCategory = item[1] ? String(item[1]).trim() : ''; // Assuming category is column index 1
            if (filterCategory && itemCategory !== filterCategory) {
                continue; // Skip item if a filter is set and it doesn't match
            }
            // ------------------------

            itemsFound = true; // Mark that we found at least one item to display

            const itemId = String(item[0] || '').trim();
            const itemName = String(item[2] || 'No Name').trim(); // Default name if column 2 is empty
            // Get the first available image URL from columns 4, 5, 6
            const itemImage = [item[4], item[5], item[6]].map(img => img ? String(img).trim() : null).find(img => img !== null && img !== '');

            const imageSrc = itemImage ? itemImage : "placeholder.png"; // Use placeholder if no image found

            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-container');

            // Create the link element for navigation
            const link = document.createElement('a');
            link.href = `detail.html?id=${encodeURIComponent(itemId)}`;
            link.classList.add('item-row');
            link.dataset.itemId = itemId; // Add data attributes if needed elsewhere

            // Create and append the image
            const img = document.createElement('img');
            img.src = imageSrc; // Initially set src
            img.alt = itemName;
            img.classList.add('list-image');
            // Add onerror handler *before* setting src if possible, or right after
            img.onerror = function() { this.src='placeholder.png'; this.onerror=null; }; // Fallback to placeholder on error
            link.appendChild(img);

            // Create and append item code
            const codeDiv = document.createElement('div');
            codeDiv.classList.add('item-code');
            codeDiv.textContent = itemId;
            link.appendChild(codeDiv);

            // Create and append item description
            const descDiv = document.createElement('div');
            descDiv.classList.add('item-description');
            descDiv.textContent = itemName;
            link.appendChild(descDiv);

            // Append the link to the item container div, then the container to the list
            itemDiv.appendChild(link);
            itemsList.appendChild(itemDiv);
        }

        // Handle case where no items were found (either empty sheet or filter mismatch)
        if (!itemsFound) {
            if (filterCategory) {
                itemsList.innerHTML = `<p>No items found in the category "${filterCategory}".</p>`;
            } else if (dataRows.length <= 1) {
                 itemsList.innerHTML = '<p>No item data found in the source sheet.</p>';
            } else {
                 itemsList.innerHTML = '<p>No items to display.</p>'; // Generic message
            }
        }

    } else if (!auth.currentUser) {
        itemsList.innerHTML = '<p>Please sign in to view items.</p>';
    } else {
        itemsList.innerHTML = '<p>Could not load item data. Please check your connection or refresh.</p>';
        console.error("DisplayItems called but required data/permissions missing from localStorage or user not authenticated.");
    }
}


// --- Display Category Buttons ---
function displayCategoryButtons() {
    if (!actualButtonList) {
        console.error("Element to hold category buttons (#actual-button-list) not found!");
        return;
    }
    actualButtonList.innerHTML = '<p>Loading categories...</p>'; // Loading message

    try {
        const categories = getUniqueCategories(); // Get categories from localStorage data

        if (categories.length === 0) {
            actualButtonList.innerHTML = '<p>No categories found.</p>';
            return;
        }

        actualButtonList.innerHTML = ''; // Clear loading message

        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button'); // Add class for styling
            // Add event listener to show items for this category when clicked
            button.addEventListener('click', () => showItemsByCategory(category));
            actualButtonList.appendChild(button);
        });
    } catch (error) {
        console.error("Error getting or displaying categories:", error);
        actualButtonList.innerHTML = '<p>Error loading categories.</p>';
    }
}

// --- View Switching Logic ---

// Show the main categories list view
function showCategoriesView() {
    if (!itemsListContainer || !categoryButtonsContainer || !searchBar || !categoriesTab || !itemsTab) return; // Safety check

    itemsListContainer.style.display = 'none';      // Hide items list
    categoryButtonsContainer.style.display = 'block'; // Show categories container
    searchBar.style.display = 'none';               // Hide search bar

    // Update active tab state
    categoriesTab.classList.add('active');
    itemsTab.classList.remove('active');

    displayCategoryButtons(); // Populate/refresh the category buttons
    console.log("Switched to Categories View");
}

// Show the view with all items listed
function showAllItemsView() {
     if (!itemsListContainer || !categoryButtonsContainer || !searchBar || !categoriesTab || !itemsTab || !itemsListTitle) return;

    categoryButtonsContainer.style.display = 'none'; // Hide categories
    itemsListContainer.style.display = 'block';    // Show items list container
    itemsListTitle.textContent = 'جميع العناصر';      // Set title for the view
    searchBar.style.display = 'flex';              // Show search bar (assuming it uses flex)

    // Update active tab state
    itemsTab.classList.add('active');
    categoriesTab.classList.remove('active');

    displayItems(); // Display all items (no filter)
    console.log("Switched to All Items View");
}

// Show the view with items filtered by a specific category
function showItemsByCategory(categoryName) {
    if (!itemsListContainer || !categoryButtonsContainer || !searchBar || !categoriesTab || !itemsTab || !itemsListTitle) return;

    categoryButtonsContainer.style.display = 'none'; // Hide categories
    itemsListContainer.style.display = 'block';    // Show items list container
    itemsListTitle.textContent = categoryName;       // Set title to the category name
    searchBar.style.display = 'flex';              // Show search bar (can be hidden if search shouldn't work here)

    // Update active tab state (Visually switch to 'Items' tab when showing items)
    itemsTab.classList.add('active');
    categoriesTab.classList.remove('active');

    displayItems(categoryName); // Display items filtered by the category
    console.log(`Switched to Items View for Category: ${categoryName}`);
}


// --- Refresh Button Logic ---
refreshButton.addEventListener("click", async function() {
    const button = this;
    console.log("Refresh button clicked");

    // --- Visual feedback starts ---
    button.disabled = true;
    button.classList.add('loading');

    try {
        // Clear previous data from localStorage
        localStorage.removeItem('dataSheet');
        localStorage.removeItem('permissionRows');
        console.log("Cleared localStorage for data/permissions.");

        // Force fetch fresh data using cache-busting
        await loadDataIntoLocalStorage(true); // Pass true to force refresh

        // --- Refresh the CURRENT view ---
        // For simplicity, always default back to the categories view after refresh.
        // A more complex implementation could remember the last view/category.
        showCategoriesView();
        console.log("Data refreshed, showing default Categories view.");


    } catch (error) {
        console.error("Error during refresh process:", error);
        // Optionally show error to user in the UI
         if(actualButtonList) actualButtonList.innerHTML = '<p>Error refreshing data. Please try again.</p>';
         if(itemsList) itemsList.innerHTML = '<p>Error refreshing data. Please try again.</p>';
    } finally {
        // --- Visual feedback ends ---
        button.disabled = false;
        button.classList.remove('loading');
        console.log("Refresh attempt complete.");
    }
});

// --- Search Functionality ---
function setupSearch() {
    if (!searchInput || !itemsList) {
        console.warn("Search input or items list not found for setupSearch.");
        return;
    }

    // Use 'input' event for real-time filtering
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        // Get all item *containers* currently displayed in the list
        const itemElements = itemsList.querySelectorAll('.item-container');

        itemElements.forEach(itemElement => {
            const itemLink = itemElement.querySelector('a.item-row');
            if (!itemLink) return; // Skip if structure is unexpected

            const itemCodeElement = itemLink.querySelector('.item-code');
            const itemDescriptionElement = itemLink.querySelector('.item-description');

            // Check if elements exist before accessing textContent
            const itemCode = itemCodeElement ? itemCodeElement.textContent.toLowerCase() : '';
            const itemDescription = itemDescriptionElement ? itemDescriptionElement.textContent.toLowerCase() : '';

            // Show if search term is empty or if it matches code or description
            const isMatch = searchTerm === '' || itemCode.includes(searchTerm) || itemDescription.includes(searchTerm);
            // Hide/show the parent container (.item-container)
            itemElement.style.display = isMatch ? 'block' : 'none';
        });
    });
     console.log("Search functionality setup.");
}


// --- Tab Event Listeners ---
// Add listeners to switch views when tabs are clicked
if (categoriesTab && itemsTab) {
    categoriesTab.addEventListener('click', showCategoriesView);
    itemsTab.addEventListener('click', showAllItemsView);
     console.log("Tab event listeners added.");
} else {
    console.error("Tab elements not found, listeners not added.");
}

// --- Helper: Get User Permissions (Used by detail.js, keep for consistency) ---
// This function is not directly used in the main list display now, but might be needed elsewhere.
function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) {
        console.log("Permissions data or userEmail missing for getUserPermissions");
        return null;
    }
    userEmail = userEmail.trim().toLowerCase(); // Normalize email
    for (let i = 1; i < permissions.length; i++) { // Start i=1 to skip header
        if (permissions[i] && typeof permissions[i][0] === 'string') {
            let storedEmail = permissions[i][0].trim().toLowerCase(); // Normalize stored email
            if (storedEmail === userEmail) {
                return permissions[i]; // Return the full permission row
            }
        }
    }
    console.log(`Permissions not found for email: ${userEmail}`);
    return null; // Return null if no match found
}
