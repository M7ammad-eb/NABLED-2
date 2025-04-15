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
// Loading Indicator
const appLoading = document.getElementById('app-loading');
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
const clearSearchButton = document.getElementById('clear-search-button');
const refreshButton = document.querySelector(".refresh-button");
// Profile Menu Elements
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');
const userEmailDisplay = document.getElementById('user-email-display');
const dropdownSignOutButton = document.getElementById('dropdown-sign-out-button');

// Flag to track if initial render happened from cache
let initialRenderDone = false;

// --- Sign Out Function ---
function signOut() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('dataSheet');
            localStorage.removeItem('permissionRows');
            console.log('User signed out and local data cleared.');
            history.replaceState(null, '', window.location.pathname);
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

// --- Initial Load Attempt from Cache (Runs immediately) ---
function tryInitialRenderFromCache() {
    console.log("Attempting initial render from localStorage...");
    const initialCachedData = localStorage.getItem('dataSheet');

    if (initialCachedData) {
        console.log("Cached data found, rendering initial view.");
        try {
             const parsedData = JSON.parse(initialCachedData);
             if (!parsedData || !parsedData.data) throw new Error("Cached data invalid format");

            handleUrlHash(); // Determine and show initial view based on hash
            if (appLoading) appLoading.style.display = 'none'; // Hide loading indicator
            initialRenderDone = true; // Mark that we showed something
            setupSearch();
            setupProfileMenu(); // Setup structure even if button hidden
        } catch (error) {
            console.error("Error parsing or rendering initial cache:", error);
            localStorage.removeItem('dataSheet'); // Clear potentially corrupt data
            // Keep loading indicator visible
        }
    } else {
        console.log("No cached data found for initial render.");
        // Keep loading indicator visible
    }
}
// --- Run initial cache check immediately ---
tryInitialRenderFromCache();

// --- Authentication State Change (Runs when Firebase Auth is ready) ---
auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed. User:", user ? user.email : 'None');
    if (user) {
        // User is signed in.
        profileButton.style.display = "block";
        searchBar.style.display = 'flex';
        if (!initialRenderDone) setupProfileMenu(); // Setup if not done yet

        try {
            // Check cache status, but DO NOT fetch automatically
            console.log("Auth confirmed, checking cache status (no fetch)...");
            await loadDataIntoLocalStorage(false); // This now ONLY checks localStorage

            // If initial render didn't happen (no cache), display message
            if (!initialRenderDone) {
                console.log("Initial render not done and cache is empty. Prompting refresh.");
                // Display message indicating no data and need for refresh
                 const mainContent = document.querySelector('.main-content');
                 if (mainContent) mainContent.innerHTML = '<p style="text-align: center; padding: 20px;">No data found. Please press the refresh button <svg style="display:inline; vertical-align:middle; width: 1em; height: 1em;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> to load.</p>';
                 // Show relevant container (e.g., categories) but with the message inside
                 itemsListContainer.style.display = 'none';
                 itemsListContainer.classList.add('content-hidden');
                 categoryButtonsContainer.style.display = 'block';
                 categoryButtonsContainer.classList.remove('content-hidden');
                 if(actualButtonList) actualButtonList.innerHTML = '<p style="text-align: center; padding: 20px;">No data found. Please press refresh.</p>';

                 if (appLoading) appLoading.style.display = 'none'; // Hide loading
                 setupSearch(); // Setup search now
                 initialRenderDone = true; // Mark as done to prevent re-triggering this block
            }
            // No need to re-render here if initialRenderDone was true,
            // because loadDataIntoLocalStorage(false) didn't change anything.
            // Re-rendering only happens after explicit refresh button press.

        } catch (error) {
            // This catch is mainly for potential errors in loadDataLocalStorage's internal logic now
            console.error("Error during background data check:", error);
            if (!initialRenderDone && appLoading) appLoading.style.display = 'none';
            const mainContent = document.querySelector('.main-content');
            if (mainContent && !initialRenderDone) mainContent.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error checking data. Please refresh.</p>';
        }
    } else {
        // User is signed out.
        profileButton.style.display = "none";
        searchBar.style.display = 'none';
        profileDropdown.style.display = 'none';
        if (appLoading) appLoading.style.display = 'none';
        // Redirect logic
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') {
             if (window.location.hash.startsWith('#categories') || window.location.hash.startsWith('#items')) {
                 history.replaceState(null, '', window.location.pathname);
             }
             window.location.href = "signin.html";
        }
    }
});

// --- Data Loading (Modified: Only fetches if forceRefresh is true) ---
async function loadDataIntoLocalStorage(forceRefresh = false) {
    let dataChanged = false;
    try {
        if (forceRefresh) {
            // --- Fetching logic (only runs when forceRefresh is true) ---
            console.log("Forcing refresh: Fetching data from network...");
            const cacheBuster = `&_=${Date.now()}`;
            const currentSheetUrl = `${sheetUrl}${cacheBuster}`;
            const currentPermissionsUrl = `${permissionsSheetUrl}${cacheBuster}`;
            const currentData = localStorage.getItem('dataSheet'); // Get current data for comparison
            const currentPerms = localStorage.getItem('permissionRows');

            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(currentSheetUrl, { cache: 'reload' }), // Force network request
                fetch(currentPermissionsUrl, { cache: 'reload' })
            ]);
            if (!dataResponse.ok || !permissionsResponse.ok) throw new Error(`HTTP error! Status: Data=${dataResponse.status}, Permissions=${permissionsResponse.status}`);

            const dataCsvText = await dataResponse.text();
            const permissionsCsvText = await permissionsResponse.text();
            const dataRows = parseCSV(dataCsvText);
            const permissionRows = parseCSV(permissionsCsvText);
             if (!dataRows || dataRows.length === 0) throw new Error("Fetched data sheet appears empty.");
             if (!permissionRows || permissionRows.length === 0) throw new Error("Fetched permissions sheet appears empty.");

            const newDataString = JSON.stringify({ data: dataRows });
            const newPermsString = JSON.stringify({ data: permissionRows });

            // Only update localStorage and flag change if data is actually different
            if (newDataString !== currentData || newPermsString !== currentPerms) {
                 localStorage.setItem('dataSheet', newDataString);
                 localStorage.setItem('permissionRows', newPermsString);
                 console.log("New data fetched and stored in localStorage");
                 dataChanged = true;
            } else {
                 console.log("Fetched data is the same as cached data. No update stored.");
            }
            // --- End of Fetching Logic ---
        } else {
            // --- Cache Check Logic (runs when forceRefresh is false) ---
            const currentData = localStorage.getItem('dataSheet');
            const currentPerms = localStorage.getItem('permissionRows');
            if (currentData && currentPerms) {
                console.log("Using data from localStorage (background check).");
            } else {
                console.log("No cached data found (background check).");
            }
            // Never fetches here, so dataChanged remains false
            // --- End of Cache Check Logic ---
        }
    } catch (error) {
        console.error("Error in loadDataIntoLocalStorage:", error);
        throw error; // Re-throw for upstream handlers (like refresh button)
    }
    return dataChanged; // Return whether NEW data was fetched and stored
}


// --- CSV Parsing ---
function parseCSV(csvText) {
    if (typeof Papa === 'undefined') { console.error("PapaParse library not loaded!"); return []; }
    const result = Papa.parse(csvText, { header: false });
    if (result.errors.length > 0) console.warn("PapaParse errors:", result.errors);
    return result.data;
}

// --- Get Unique Categories ---
function getUniqueCategories() {
    // Add check here before proceeding
    const cachedDataString = localStorage.getItem('dataSheet');
    if (!cachedDataString) { console.warn("getUniqueCategories: No data found in localStorage."); return []; }
    try {
        const cachedData = JSON.parse(cachedDataString);
        if (!cachedData || !cachedData.data || cachedData.data.length < 2) { console.warn("getUniqueCategories: No sufficient data format in localStorage."); return []; }
        const dataRows = cachedData.data;
        const categories = new Set();
        for (let i = 1; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (row && row[1] && typeof row[1] === 'string' && row[1].trim() !== '') { categories.add(row[1].trim()); }
        }
        return [...categories].sort();
    } catch (error) {
        console.error("Error parsing cached data for categories:", error);
        return [];
    }
}

// --- Display Items ---
function displayItems(filterCategory = null) {
    if (!itemsList) return;
    itemsList.innerHTML = '<p>Loading items...</p>';
    const cachedDataString = localStorage.getItem('dataSheet');
    if (!cachedDataString) {
        itemsList.innerHTML = '<p>No data available. Please refresh.</p>';
        console.error("DisplayItems error: Data missing from localStorage.");
        return;
    }
    try {
        const cachedData = JSON.parse(cachedDataString);
        if (!cachedData?.data) throw new Error("Invalid data format");

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
            const itemImage = [item[4], item[5], item[6]].map(img => img ? String(img).trim() : null).find(img => img && img !== '');
            const imageSrc = itemImage || "placeholder.png";
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
            img.loading = "lazy";
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
             itemsList.innerHTML = filterCategory ? `<p>No items found in category "${filterCategory}".</p>` : (dataRows.length <= 1 ? '<p>No item data found.</p>' : '<p>No items to display.</p>');
        }
    } catch (error) {
         itemsList.innerHTML = '<p>Error displaying item data.</p>';
         console.error("DisplayItems error parsing or processing data:", error);
    }
}

// --- Display Category Buttons ---
function displayCategoryButtons() {
    if (!actualButtonList) return;
    actualButtonList.innerHTML = '<p>Loading categories...</p>';
    const cachedDataString = localStorage.getItem('dataSheet');
     if (!cachedDataString) {
         actualButtonList.innerHTML = '<p>No data available. Please refresh.</p>';
         console.warn("displayCategoryButtons: Data not ready in localStorage.");
         return;
    }
    try {
        // getUniqueCategories already checks/parses localStorage
        const categories = getUniqueCategories();
        if (categories.length === 0) {
            // Check if data exists but no categories were found
            const cachedData = JSON.parse(cachedDataString);
            if (cachedData?.data && cachedData.data.length > 1) {
                 actualButtonList.innerHTML = '<p>No categories defined in data.</p>';
            } else {
                 actualButtonList.innerHTML = '<p>No categories found.</p>';
            }
            return;
        }
        actualButtonList.innerHTML = '';
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button');
            button.addEventListener('click', (e) => {
                e.preventDefault();
                showItemsByCategory(category, false);
            });
            actualButtonList.appendChild(button);
        });
    } catch (error) {
        console.error("Error getting/displaying categories:", error);
        actualButtonList.innerHTML = '<p>Error loading categories.</p>';
    }
}


// --- View Switching & History Management ---

// Show Categories View - Updates UI only
function showCategoriesViewUI() {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab) return;
    console.log(`Updating UI for Categories View`);
    itemsListContainer.style.display = 'none';
    itemsListContainer.classList.add('content-hidden');
    categoryButtonsContainer.style.display = 'block';
    categoryButtonsContainer.classList.remove('content-hidden'); // Reveal
    categoriesTab.classList.add('active');
    itemsTab.classList.remove('active');
    categoriesTab.setAttribute('aria-selected', 'true');
    itemsTab.setAttribute('aria-selected', 'false');
    displayCategoryButtons();
}

// Show All Items View - Updates UI only
function showAllItemsViewUI() {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab || !itemsListTitle) return;
    console.log(`Updating UI for All Items View`);
    categoryButtonsContainer.style.display = 'none';
    categoryButtonsContainer.classList.add('content-hidden');
    itemsListContainer.style.display = 'block';
    itemsListContainer.classList.remove('content-hidden'); // Reveal
    itemsListTitle.textContent = 'جميع العناصر';
    itemsTab.classList.add('active');
    categoriesTab.classList.remove('active');
    itemsTab.setAttribute('aria-selected', 'true');
    categoriesTab.setAttribute('aria-selected', 'false');
    displayItems();
}

// Show Items Filtered by Category - Updates UI and PUSHES state if not popstate
function showItemsByCategory(categoryName, isPopState = false) {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab || !itemsListTitle) return;
     console.log(`showItemsByCategory called for "${categoryName}" (isPopState: ${isPopState})`);
    // Update UI
    categoryButtonsContainer.style.display = 'none';
    categoryButtonsContainer.classList.add('content-hidden');
    itemsListContainer.style.display = 'block';
    itemsListContainer.classList.remove('content-hidden'); // Reveal
    itemsListTitle.textContent = categoryName;
    itemsTab.classList.add('active');
    categoriesTab.classList.remove('active');
    itemsTab.setAttribute('aria-selected', 'true');
    categoriesTab.setAttribute('aria-selected', 'false');
    displayItems(categoryName);
    // PUSH history state ONLY if called directly (not by popstate)
    const newState = { view: 'items', filter: categoryName };
    const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.filter === newState.filter);
    if (!isPopState && stateChanged) {
        console.log(`Pushing state for category: ${categoryName}`);
        history.pushState(newState, '', `#items/${encodeURIComponent(categoryName)}`);
    }
}

// --- Popstate Event Handler (Browser Back/Forward) ---
function handlePopState(event) {
    console.log("popstate event fired. State:", event.state);
    // No auth check needed here, just render based on state
    const state = event.state;
    if (!state || state.view === 'categories') {
        console.log("Popstate: updating UI to categories view");
        showCategoriesViewUI();
    } else if (state.view === 'items') {
        if (state.filter) {
            console.log(`Popstate: updating UI to items for category: ${state.filter}`);
            showItemsByCategory(state.filter, true);
        } else {
            console.log("Popstate: updating UI to all items view");
            showAllItemsViewUI();
        }
    } else {
         console.warn("Popstate: Unknown state received, defaulting to categories UI", state);
         showCategoriesViewUI();
    }
}
window.addEventListener('popstate', handlePopState);

// --- Handle Initial URL Hash on Load ---
// This function now primarily determines the initial UI state.
function handleUrlHash() {
    const hash = window.location.hash;
    console.log("Handling initial hash:", hash);
    let initialState = { view: 'categories', filter: null };
    let targetHash = '#categories';

    if (hash === '#items') {
        initialState = { view: 'items', filter: null };
        targetHash = '#items';
        showAllItemsViewUI(); // Show UI immediately if cache was available
    } else if (hash.startsWith('#items/')) {
        const category = decodeURIComponent(hash.substring(7));
        initialState = { view: 'items', filter: category };
        targetHash = `#items/${encodeURIComponent(category)}`;
        showItemsByCategory(category, true); // Show UI immediately if cache was available
    } else {
        initialState = { view: 'categories', filter: null };
        targetHash = '#categories';
        showCategoriesViewUI(); // Show UI immediately if cache was available
    }

    // Replace initial history entry once after determining the view
    console.log("Replacing initial state:", initialState);
    history.replaceState(initialState, '', targetHash);
}


// --- Refresh Button Logic ---
refreshButton.addEventListener("click", async function() {
    const button = this;
    console.log("Refresh button clicked");
    button.disabled = true;
    button.classList.add('loading');
    const currentState = history.state || { view: 'categories', filter: null }; // Get state BEFORE refresh
    try {
        // Force fetch fresh data
        const dataWasRefreshed = await loadDataIntoLocalStorage(true); // Pass true to force refresh
        console.log("Refresh fetch complete. Data changed:", dataWasRefreshed);

        // Re-render the view that was current BEFORE the refresh started
        console.log("Refresh complete, restoring view for state:", currentState);
        if (currentState.view === 'categories') {
            showCategoriesViewUI();
        } else if (currentState.view === 'items') {
            if (currentState.filter) {
                showItemsByCategory(currentState.filter, true); // Pass true
            } else {
                showAllItemsViewUI();
            }
        } else {
             showCategoriesViewUI(); // Default fallback
        }
    } catch (error) {
        console.error("Error during refresh:", error);
         if(actualButtonList) actualButtonList.innerHTML = '<p>Error refreshing data.</p>';
         if(itemsList) itemsList.innerHTML = '<p>Error refreshing data.</p>';
         showCategoriesViewUI(); // Default back on error
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        console.log("Refresh attempt complete.");
    }
});

// --- Search Functionality ---
function setupSearch() {
    if (!searchInput || !itemsList || !categoryButtonsContainer || !clearSearchButton) return;
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        clearSearchButton.style.display = searchTerm ? 'block' : 'none';
        if (categoryButtonsContainer.style.display === 'block' && searchTerm) {
             console.log("Search initiated from Categories view, switching to All Items.");
             const currentState = history.state;
             const newState = { view: 'items', filter: null };
             if (!(currentState?.view === newState.view && currentState?.filter === newState.filter)) {
                 console.log("Pushing state for all items view (from search)");
                 history.pushState(newState, '', '#items');
             }
             showAllItemsViewUI();
             filterDisplayedItems(searchTerm);
             return;
        }
        filterDisplayedItems(searchTerm);
    });
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchButton.style.display = 'none';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus();
    });
     console.log("Search functionality setup.");
}
function filterDisplayedItems(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const currentItemsList = document.getElementById('items-list');
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
    if (!profileButton || !profileDropdown || !userEmailDisplay || !dropdownSignOutButton) return;
    profileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isVisible = profileDropdown.style.display === 'block';
        profileDropdown.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && auth.currentUser) {
            userEmailDisplay.textContent = auth.currentUser.email;
             userEmailDisplay.title = auth.currentUser.email;
        }
    });
    dropdownSignOutButton.addEventListener('click', signOut);
    document.addEventListener('click', (event) => {
        if (!profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.style.display = 'none';
        }
    });
    console.log("Profile menu setup.");
}

// --- Tab Event Listeners (Using Balanced History Logic) ---
// This version uses replaceState for Categories tab click,
// and conditional replace/push for Items tab click.
if (categoriesTab && itemsTab) {
    categoriesTab.addEventListener('click', (e) => {
        e.preventDefault();
        const newState = { view: 'categories', filter: null };
        // Always REPLACE state when navigating TO categories via tab click
        console.log("Tab Click: Forcing replaceState with categories view");
        history.replaceState(newState, '', '#categories');
        showCategoriesViewUI(); // Update UI only
    });

    itemsTab.addEventListener('click', (e) => {
        e.preventDefault();
        const currentState = history.state;
        const newState = { view: 'items', filter: null };
        // Only change history if the target state is different
        if (!(currentState?.view === newState.view && currentState?.filter === newState.filter)) {
            // Logic to ensure back goes to categories
            if (currentState && currentState.view === 'items' && currentState.filter !== null) {
                // If coming from a filtered item view, REPLACE the filtered state with Categories first, then PUSH All Items
                console.log("Tab Click: Replacing filtered item state with Categories, then Pushing All Items");
                history.replaceState({ view: 'categories', filter: null }, '', '#categories');
                history.pushState(newState, '', '#items');
            } else {
                // Otherwise (coming from categories, null, or unknown), just PUSH the All Items state
                console.log("Tab Click: Pushing state for all items view");
                history.pushState(newState, '', '#items');
            }
        } else {
            console.log("Tab Click: All items view state already current.");
        }
        showAllItemsViewUI(); // Update UI only
    });
     console.log("Tab event listeners added with Balanced History Logic V7.");
} else {
    console.error("Tab elements not found, listeners not added.");
}

// --- Helper: Get User Permissions ---
function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) return null;
    userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) {
        if (permissions[i]?.[0]) { // Check if row and first cell exist
            let storedEmail = String(permissions[i][0]).trim().toLowerCase();
            if (storedEmail === userEmail) return permissions[i];
        }
    }
    return null;
}
