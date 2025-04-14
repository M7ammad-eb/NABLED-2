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
// Tabs and Views
const categoriesTab = document.getElementById('categories-tab');
const itemsTab = document.getElementById('items-tab');
const categoryButtonsContainer = document.getElementById('category-buttons-container');
const actualButtonList = document.getElementById('actual-button-list');
const itemsListContainer = document.getElementById('items-list-container');
const itemsList = document.getElementById('items-list');
const itemsListTitle = document.getElementById('items-list-title');
// Search Bar Elements
const searchBar = document.querySelector('.search-bar');
const searchInput = document.querySelector('.search-input');
const clearSearchButton = document.getElementById('clear-search-button'); // New
const refreshButton = document.querySelector(".refresh-button");
// Profile Menu Elements
const profileButton = document.getElementById('profile-button'); // New
const profileDropdown = document.getElementById('profile-dropdown'); // New
const userEmailDisplay = document.getElementById('user-email-display'); // New
const dropdownSignOutButton = document.getElementById('dropdown-sign-out-button'); // New

// --- Sign Out Function ---
// Now triggered from the dropdown menu
function signOut() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('dataSheet');
            localStorage.removeItem('permissionRows');
            console.log('User signed out and local data cleared.');
            window.location.href = 'signin.html'; // Redirect to sign-in
        })
        .catch((error) => {
            console.error('Sign-out error:', error);
            // Optionally show error to user
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
        profileButton.style.display = "block"; // Show profile button
        searchBar.style.display = 'flex'; // Show search bar

        // Load data and set initial view
        try {
            await loadDataIntoLocalStorage(false);
            // Check initial URL hash or default to categories
            handleUrlHash(); // Check hash on load
            setupSearch(); // Setup search functionality
            setupProfileMenu(); // Setup profile menu interactions
        } catch (error) {
            console.error("Failed to load initial data or setup view:", error);
            if(actualButtonList) actualButtonList.innerHTML = '<p>Error loading data. Please check connection and refresh.</p>';
            if(itemsList) itemsList.innerHTML = '<p>Error loading data. Please check connection and refresh.</p>';
        }

        // Offline indicator logic (optional)
        // ... (keep if needed) ...

    } else {
        // User is signed out.
        profileButton.style.display = "none"; // Hide profile button
        searchBar.style.display = 'none'; // Hide search bar
        profileDropdown.style.display = 'none'; // Ensure dropdown is hidden

        // Redirect to sign-in page if not already there
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') { // Adjust path if needed
             // Check if the current hash indicates a view state; if so, clear it before redirecting
             if (window.location.hash.startsWith('#categories') || window.location.hash.startsWith('#items')) {
                 history.replaceState(null, '', window.location.pathname); // Clear hash
             }
             window.location.href = "signin.html";
        }
    }
});

// --- Data Loading ---
// (Keep the existing loadDataIntoLocalStorage function as is)
async function loadDataIntoLocalStorage(forceRefresh = false) {
    try {
        if (forceRefresh || !localStorage.getItem('dataSheet') || !localStorage.getItem('permissionRows')) {
            console.log(forceRefresh ? "Forcing refresh..." : "Fetching data (missing from localStorage or refresh forced)...");
            const cacheBuster = forceRefresh ? `&_=${Date.now()}` : '';
            const currentSheetUrl = `${sheetUrl}${cacheBuster}`;
            const currentPermissionsUrl = `${permissionsSheetUrl}${cacheBuster}`;
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
             if (!dataRows || dataRows.length === 0) throw new Error("Fetched data sheet appears empty or invalid.");
             if (!permissionRows || permissionRows.length === 0) throw new Error("Fetched permissions sheet appears empty or invalid.");
            localStorage.setItem('dataSheet', JSON.stringify({ data: dataRows }));
            localStorage.setItem('permissionRows', JSON.stringify({ data: permissionRows }));
            console.log("Data loaded into localStorage");
        } else {
            console.log("Using data from localStorage.");
        }
    } catch (error) {
        console.error("Error fetching and storing data:", error);
        throw error; // Re-throw
    }
}

// --- CSV Parsing ---
// (Keep the existing parseCSV function as is)
function parseCSV(csvText) {
    if (typeof Papa === 'undefined') {
        console.error("PapaParse library not loaded!");
        return [];
    }
    const result = Papa.parse(csvText, { header: false });
    if (result.errors.length > 0) console.warn("PapaParse encountered errors:", result.errors);
    return result.data;
}

// --- Get Unique Categories ---
// (Keep the existing getUniqueCategories function as is)
function getUniqueCategories() {
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    if (!cachedData || !cachedData.data || cachedData.data.length < 2) {
        console.warn("No sufficient data found in localStorage for categories.");
        return [];
    }
    const dataRows = cachedData.data;
    const categories = new Set();
    for (let i = 1; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row && row[1] && typeof row[1] === 'string' && row[1].trim() !== '') {
            categories.add(row[1].trim());
        }
    }
    return [...categories].sort();
}

// --- Display Items ---
// (Keep the existing displayItems function as is)
function displayItems(filterCategory = null) {
    if (!itemsList) return;
    itemsList.innerHTML = '<p>Loading items...</p>';
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));
    if (cachedData && cachedData.data && cachedPermission && cachedPermission.data && auth.currentUser) {
        const dataRows = cachedData.data;
        let itemsFound = false;
        itemsList.innerHTML = '';
        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
            if (!Array.isArray(item) || item.length < 7 || item.every(cell => !cell || String(cell).trim() === '')) continue;
            const itemCategory = item[1] ? String(item[1]).trim() : '';
            if (filterCategory && itemCategory !== filterCategory) continue;
            itemsFound = true;
            const itemId = String(item[0] || '').trim();
            const itemName = String(item[2] || 'No Name').trim();
            const itemImage = [item[4], item[5], item[6]].map(img => img ? String(img).trim() : null).find(img => img !== null && img !== '');
            const imageSrc = itemImage ? itemImage : "placeholder.png";
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-container');
            const link = document.createElement('a');
            link.href = `detail.html?id=${encodeURIComponent(itemId)}`;
            link.classList.add('item-row');
            link.dataset.itemId = itemId;
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = itemName;
            img.classList.add('list-image');
            img.loading = "lazy"; // Add lazy loading
            img.onerror = function() { this.src='placeholder.png'; this.onerror=null; };
            link.appendChild(img);
            const codeDiv = document.createElement('div');
            codeDiv.classList.add('item-code');
            codeDiv.textContent = itemId;
            link.appendChild(codeDiv);
            const descDiv = document.createElement('div');
            descDiv.classList.add('item-description');
            descDiv.textContent = itemName;
            link.appendChild(descDiv);
            itemDiv.appendChild(link);
            itemsList.appendChild(itemDiv);
        }
        if (!itemsFound) {
             if (filterCategory) itemsList.innerHTML = `<p>No items found in the category "${filterCategory}".</p>`;
             else if (dataRows.length <= 1) itemsList.innerHTML = '<p>No item data found.</p>';
             else itemsList.innerHTML = '<p>No items to display.</p>';
        }
    } else if (!auth.currentUser) {
        itemsList.innerHTML = '<p>Please sign in.</p>';
    } else {
        itemsList.innerHTML = '<p>Could not load item data.</p>';
        console.error("DisplayItems error: Data/permissions missing or user not auth.");
    }
}

// --- Display Category Buttons ---
// (Keep the existing displayCategoryButtons function, ensuring it adds listeners correctly)
function displayCategoryButtons() {
    if (!actualButtonList) return;
    actualButtonList.innerHTML = '<p>Loading categories...</p>';
    try {
        const categories = getUniqueCategories();
        if (categories.length === 0) {
            actualButtonList.innerHTML = '<p>No categories found.</p>';
            return;
        }
        actualButtonList.innerHTML = '';
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button');
            // IMPORTANT: Modify click listener to use history state
            button.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default if it was an anchor
                showItemsByCategory(category); // Let this function handle history.pushState
            });
            actualButtonList.appendChild(button);
        });
    } catch (error) {
        console.error("Error getting/displaying categories:", error);
        actualButtonList.innerHTML = '<p>Error loading categories.</p>';
    }
}

// --- View Switching & History Management ---

// Helper to check current state and prevent duplicate pushes
function shouldPushState(newState) {
    const currentState = history.state;
    if (!currentState && newState.view === 'categories') return false; // Initial state often null, treat as categories
    if (!currentState) return true; // If current is null but new isn't categories, push
    return !(currentState.view === newState.view && currentState.filter === newState.filter);
}

// Show Categories View
function showCategoriesView(isPopState = false) {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab) return;
    console.log(`showCategoriesView called (isPopState: ${isPopState})`);

    itemsListContainer.style.display = 'none';
    categoryButtonsContainer.style.display = 'block';
    categoriesTab.classList.add('active');
    itemsTab.classList.remove('active');
    categoriesTab.setAttribute('aria-selected', 'true');
    itemsTab.setAttribute('aria-selected', 'false');

    displayCategoryButtons(); // Refresh buttons

    // Update history state if not called by popstate
    const newState = { view: 'categories', filter: null };
    if (!isPopState && shouldPushState(newState)) {
         console.log("Pushing state for categories");
         history.pushState(newState, '', '#categories');
    }
}

// Show All Items View
function showAllItemsView(isPopState = false) {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab || !itemsListTitle) return;
    console.log(`showAllItemsView called (isPopState: ${isPopState})`);

    categoryButtonsContainer.style.display = 'none';
    itemsListContainer.style.display = 'block';
    itemsListTitle.textContent = 'جميع العناصر';
    itemsTab.classList.add('active');
    categoriesTab.classList.remove('active');
    itemsTab.setAttribute('aria-selected', 'true');
    categoriesTab.setAttribute('aria-selected', 'false');

    displayItems(); // Display all items

    // Update history state if not called by popstate
    const newState = { view: 'items', filter: null };
     if (!isPopState && shouldPushState(newState)) {
        console.log("Pushing state for all items");
        history.pushState(newState, '', '#items');
    }
}

// Show Items Filtered by Category
function showItemsByCategory(categoryName, isPopState = false) {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab || !itemsListTitle) return;
     console.log(`showItemsByCategory called for "${categoryName}" (isPopState: ${isPopState})`);

    categoryButtonsContainer.style.display = 'none';
    itemsListContainer.style.display = 'block';
    itemsListTitle.textContent = categoryName;
    itemsTab.classList.add('active'); // Visually activate Items tab
    categoriesTab.classList.remove('active');
    itemsTab.setAttribute('aria-selected', 'true');
    categoriesTab.setAttribute('aria-selected', 'false');

    displayItems(categoryName); // Display filtered items

    // Update history state if not called by popstate
    const newState = { view: 'items', filter: categoryName };
    if (!isPopState && shouldPushState(newState)) {
        console.log(`Pushing state for category: ${categoryName}`);
        history.pushState(newState, '', `#items/${encodeURIComponent(categoryName)}`);
    }
}

// --- Popstate Event Handler (Browser Back/Forward) ---
function handlePopState(event) {
    console.log("popstate event fired. State:", event.state);
    if (!auth.currentUser) {
        console.log("User not logged in, ignoring popstate.");
        return; // Don't handle history if logged out
    }

    const state = event.state;
    if (!state || state.view === 'categories') {
        // Default to categories if state is null or explicitly categories
        console.log("Popstate: showing categories view");
        showCategoriesView(true); // Pass true to prevent pushing state again
    } else if (state.view === 'items') {
        if (state.filter) {
            console.log(`Popstate: showing items for category: ${state.filter}`);
            showItemsByCategory(state.filter, true); // Pass true
        } else {
            console.log("Popstate: showing all items view");
            showAllItemsView(true); // Pass true
        }
    } else {
         console.warn("Popstate: Unknown state received, defaulting to categories", state);
         showCategoriesView(true);
    }
}
window.addEventListener('popstate', handlePopState);

// --- Handle Initial URL Hash ---
function handleUrlHash() {
    const hash = window.location.hash;
    console.log("Handling initial hash:", hash);
    let initialState = { view: 'categories', filter: null }; // Default

    if (hash === '#items') {
        initialState = { view: 'items', filter: null };
        showAllItemsView(true); // Show view without pushing state
    } else if (hash.startsWith('#items/')) {
        const category = decodeURIComponent(hash.substring(7)); // Get category name after #items/
        initialState = { view: 'items', filter: category };
        showItemsByCategory(category, true); // Show view without pushing state
    } else {
        // Default to categories (#categories or no hash/invalid hash)
        initialState = { view: 'categories', filter: null };
        showCategoriesView(true); // Show view without pushing state
    }

    // Replace initial history entry
    console.log("Replacing initial state:", initialState);
    history.replaceState(initialState, '', hash || '#categories'); // Use current hash or default
}


// --- Refresh Button Logic ---
// (Keep existing refresh logic, but ensure it calls the correct view function after load)
refreshButton.addEventListener("click", async function() {
    const button = this;
    console.log("Refresh button clicked");
    button.disabled = true;
    button.classList.add('loading');

    // Store current view state before refresh
    const currentState = history.state || { view: 'categories', filter: null }; // Use history state

    try {
        localStorage.removeItem('dataSheet');
        localStorage.removeItem('permissionRows');
        console.log("Cleared localStorage for data/permissions.");
        await loadDataIntoLocalStorage(true); // Force refresh

        // --- Refresh the view based on the state *before* refresh ---
        console.log("Refresh complete, restoring view for state:", currentState);
        if (currentState.view === 'categories') {
            showCategoriesView(true); // Pass true as we don't want to push state
        } else if (currentState.view === 'items') {
            if (currentState.filter) {
                showItemsByCategory(currentState.filter, true); // Pass true
            } else {
                showAllItemsView(true); // Pass true
            }
        } else {
             showCategoriesView(true); // Default fallback
        }

    } catch (error) {
        console.error("Error during refresh process:", error);
         if(actualButtonList) actualButtonList.innerHTML = '<p>Error refreshing data.</p>';
         if(itemsList) itemsList.innerHTML = '<p>Error refreshing data.</p>';
         showCategoriesView(true); // Default back to categories on error
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        console.log("Refresh attempt complete.");
    }
});

// --- Search Functionality ---
function setupSearch() {
    if (!searchInput || !itemsList || !categoryButtonsContainer || !clearSearchButton) {
        console.warn("Required elements not found for setupSearch.");
        return;
    }

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value;

        // Show/hide clear button
        clearSearchButton.style.display = searchTerm ? 'block' : 'none';

        // If user starts typing while categories are shown, switch to All Items view first
        if (categoryButtonsContainer.style.display === 'block' && searchTerm) {
             console.log("Search initiated from Categories view, switching to All Items.");
             showAllItemsView(); // This will display all items
             // Now filter the newly displayed items immediately
             filterDisplayedItems(searchTerm);
             return; // Prevent filtering the (now hidden) category buttons
        }

        // Filter items currently visible
        filterDisplayedItems(searchTerm);

    });

    // Clear button functionality
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchButton.style.display = 'none'; // Hide button
        // Manually trigger input event to re-filter (showing all items in the current view)
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus(); // Set focus back to input
    });

     console.log("Search functionality setup.");
}

// Helper function to filter items currently in the DOM
function filterDisplayedItems(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const currentItemsList = document.getElementById('items-list'); // Get the list element again
    if (!currentItemsList) return;

    const itemElements = currentItemsList.querySelectorAll('.item-container');
    itemElements.forEach(itemElement => {
        const itemLink = itemElement.querySelector('a.item-row');
        if (!itemLink) return;
        const itemCode = (itemLink.querySelector('.item-code')?.textContent || '').toLowerCase();
        const itemDescription = (itemLink.querySelector('.item-description')?.textContent || '').toLowerCase();
        const isMatch = term === '' || itemCode.includes(term) || itemDescription.includes(term);
        itemElement.style.display = isMatch ? 'block' : 'none';
    });
}

// --- Profile Menu Setup ---
function setupProfileMenu() {
    if (!profileButton || !profileDropdown || !userEmailDisplay || !dropdownSignOutButton) {
        console.error("Profile menu elements not found.");
        return;
    }

    // Toggle Dropdown
    profileButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent click from immediately closing dropdown via body listener
        const isVisible = profileDropdown.style.display === 'block';
        profileDropdown.style.display = isVisible ? 'none' : 'block';
        // Populate email when showing
        if (!isVisible && auth.currentUser) {
            userEmailDisplay.textContent = auth.currentUser.email;
             userEmailDisplay.title = auth.currentUser.email; // Add title for long emails
        }
    });

    // Sign Out Button inside Dropdown
    dropdownSignOutButton.addEventListener('click', signOut);

    // Close dropdown if clicking outside
    document.addEventListener('click', (event) => {
        if (!profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.style.display = 'none';
        }
    });
    console.log("Profile menu setup.");
}


// --- Tab Event Listeners ---
// Add listeners to switch views when tabs are clicked
if (categoriesTab && itemsTab) {
    // Prevent default if they were anchors, and use history functions
    categoriesTab.addEventListener('click', (e) => { e.preventDefault(); showCategoriesView(); });
    itemsTab.addEventListener('click', (e) => { e.preventDefault(); showAllItemsView(); });
     console.log("Tab event listeners added.");
} else {
    console.error("Tab elements not found, listeners not added.");
}

// --- Helper: Get User Permissions (Used by detail.js, keep for consistency) ---
// (Keep the existing getUserPermissions function as is)
function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) return null;
    userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) {
        if (permissions[i] && typeof permissions[i][0] === 'string') {
            let storedEmail = permissions[i][0].trim().toLowerCase();
            if (storedEmail === userEmail) return permissions[i];
        }
    }
    return null;
}
