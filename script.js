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
const clearSearchButton = document.getElementById('clear-search-button');
const refreshButton = document.querySelector(".refresh-button");
// Profile Menu Elements
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');
const userEmailDisplay = document.getElementById('user-email-display');
const dropdownSignOutButton = document.getElementById('dropdown-sign-out-button');

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

// --- Authentication State Change ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        profileButton.style.display = "block";
        searchBar.style.display = 'flex';
        try {
            await loadDataIntoLocalStorage(false);
            handleUrlHash(); // Check hash and set initial view/state
            setupSearch();
            setupProfileMenu();
        } catch (error) {
            console.error("Failed to load initial data or setup view:", error);
            if(actualButtonList) actualButtonList.innerHTML = '<p>Error loading data. Please check connection and refresh.</p>';
            if(itemsList) itemsList.innerHTML = '<p>Error loading data. Please check connection and refresh.</p>';
        }
    } else {
        profileButton.style.display = "none";
        searchBar.style.display = 'none';
        profileDropdown.style.display = 'none';
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') {
             if (window.location.hash.startsWith('#categories') || window.location.hash.startsWith('#items')) {
                 history.replaceState(null, '', window.location.pathname);
             }
             window.location.href = "signin.html";
        }
    }
});

// --- Data Loading ---
async function loadDataIntoLocalStorage(forceRefresh = false) {
    try {
        if (forceRefresh || !localStorage.getItem('dataSheet') || !localStorage.getItem('permissionRows')) {
            console.log(forceRefresh ? "Forcing refresh..." : "Fetching data...");
            const cacheBuster = forceRefresh ? `&_=${Date.now()}` : '';
            const currentSheetUrl = `${sheetUrl}${cacheBuster}`;
            const currentPermissionsUrl = `${permissionsSheetUrl}${cacheBuster}`;
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(currentSheetUrl, { cache: forceRefresh ? 'reload' : 'default' }),
                fetch(currentPermissionsUrl, { cache: forceRefresh ? 'reload' : 'default' })
            ]);
            if (!dataResponse.ok || !permissionsResponse.ok) throw new Error(`HTTP error! Status: Data=${dataResponse.status}, Permissions=${permissionsResponse.status}`);
            const dataCsvText = await dataResponse.text();
            const permissionsCsvText = await permissionsResponse.text();
            const dataRows = parseCSV(dataCsvText);
            const permissionRows = parseCSV(permissionsCsvText);
             if (!dataRows || dataRows.length === 0) throw new Error("Fetched data sheet appears empty.");
             if (!permissionRows || permissionRows.length === 0) throw new Error("Fetched permissions sheet appears empty.");
            localStorage.setItem('dataSheet', JSON.stringify({ data: dataRows }));
            localStorage.setItem('permissionRows', JSON.stringify({ data: permissionRows }));
            console.log("Data loaded into localStorage");
        } else {
            console.log("Using data from localStorage.");
        }
    } catch (error) {
        console.error("Error fetching/storing data:", error);
        throw error;
    }
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
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    if (!cachedData || !cachedData.data || cachedData.data.length < 2) { console.warn("No sufficient data for categories."); return []; }
    const dataRows = cachedData.data;
    const categories = new Set();
    for (let i = 1; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (row && row[1] && typeof row[1] === 'string' && row[1].trim() !== '') { categories.add(row[1].trim()); }
    }
    return [...categories].sort();
}

// --- Display Items ---
function displayItems(filterCategory = null) {
    if (!itemsList) return;
    itemsList.innerHTML = '<p>Loading items...</p>';
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));
    if (cachedData?.data && cachedPermission?.data && auth.currentUser) {
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
    } else if (!auth.currentUser) {
        itemsList.innerHTML = '<p>Please sign in.</p>';
    } else {
        itemsList.innerHTML = '<p>Could not load item data.</p>';
        console.error("DisplayItems error: Data/permissions missing or user not auth.");
    }
}

// --- Display Category Buttons ---
function displayCategoryButtons() {
    if (!actualButtonList) return;
    actualButtonList.innerHTML = '<p>Loading categories...</p>';
    try {
        const categories = getUniqueCategories();
        if (categories.length === 0) { actualButtonList.innerHTML = '<p>No categories found.</p>'; return; }
        actualButtonList.innerHTML = '';
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button');
            button.addEventListener('click', (e) => {
                e.preventDefault();
                showItemsByCategory(category, false); // Pass false for isPopState (this should PUSH state)
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
    categoryButtonsContainer.style.display = 'block';
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
    itemsListContainer.style.display = 'block';
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
    itemsListContainer.style.display = 'block';
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
    if (!auth.currentUser) { console.log("User not logged in, ignoring popstate."); return; }

    const state = event.state;
    // Determine the target view based on the state from history
    if (!state || state.view === 'categories') {
        console.log("Popstate: updating UI to categories view and REPLACING state");
        // *** REPLACE state when popstate lands on categories ***
        history.replaceState({ view: 'categories', filter: null }, '', '#categories');
        showCategoriesViewUI(); // Update UI only
    } else if (state.view === 'items') {
        if (state.filter) {
            console.log(`Popstate: updating UI to items for category: ${state.filter}`);
            showItemsByCategory(state.filter, true); // Update UI, mark as popstate
        } else {
            console.log("Popstate: updating UI to all items view");
            showAllItemsViewUI(); // Update UI only
        }
    } else {
         console.warn("Popstate: Unknown state received, defaulting to categories UI", state);
         history.replaceState({ view: 'categories', filter: null }, '', '#categories'); // Replace with default
         showCategoriesViewUI();
    }
}
window.addEventListener('popstate', handlePopState);

// --- Handle Initial URL Hash on Load ---
function handleUrlHash() {
    const hash = window.location.hash;
    console.log("Handling initial hash:", hash);
    let initialState = { view: 'categories', filter: null }; // Default

    // Determine initial view based on hash
    if (hash === '#items') {
        initialState = { view: 'items', filter: null };
        showAllItemsViewUI();
    } else if (hash.startsWith('#items/')) {
        const category = decodeURIComponent(hash.substring(7));
        initialState = { view: 'items', filter: category };
        showItemsByCategory(category, true);
    } else {
        initialState = { view: 'categories', filter: null };
        showCategoriesViewUI();
    }

    // Replace initial history entry correctly based on determined state
    console.log("Replacing initial state:", initialState);
    let targetHash = '#categories';
    if (initialState.view === 'items') {
        targetHash = initialState.filter ? `#items/${encodeURIComponent(initialState.filter)}` : '#items';
    }
    // Use replaceState for the very first load state
    history.replaceState(initialState, '', targetHash);
}


// --- Refresh Button Logic ---
refreshButton.addEventListener("click", async function() {
    const button = this;
    console.log("Refresh button clicked");
    button.disabled = true;
    button.classList.add('loading');
    const currentState = history.state || { view: 'categories', filter: null };
    try {
        localStorage.removeItem('dataSheet');
        localStorage.removeItem('permissionRows');
        console.log("Cleared localStorage.");
        await loadDataIntoLocalStorage(true);
        console.log("Refresh complete, restoring view for state:", currentState);
        // Restore view UI based on state BEFORE refresh
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
         showCategoriesViewUI(); // Default back to categories UI on error
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
        // If user starts typing while categories are shown, switch to All Items view
        if (categoryButtonsContainer.style.display === 'block' && searchTerm) {
             console.log("Search initiated from Categories view, switching to All Items.");
             // Manually trigger the state change PUSHING the 'items' state
             const currentState = history.state;
             const newState = { view: 'items', filter: null };
             if (!(currentState?.view === newState.view && currentState?.filter === newState.filter)) {
                 console.log("Pushing state for all items view (from search)");
                 history.pushState(newState, '', '#items'); // *** PUSH state here ***
             }
             showAllItemsViewUI(); // Update UI only
             filterDisplayedItems(searchTerm); // Filter the newly displayed items
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

// --- Tab Event Listeners (History Logic V6 - replaceState added back to popstate for Categories) ---
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
     console.log("Tab event listeners added with History Logic V6.");
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
