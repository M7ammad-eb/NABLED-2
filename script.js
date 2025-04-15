// Firebase configuration (replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyAzgx1Ro6M7Bf58dgshk_7Eflp-EtZc9io", // Replace with your key
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
const viewWrapper = document.getElementById('view-wrapper'); // Wrapper for views
// Search Bar Elements
const searchBar = document.querySelector('.search-bar');
const searchInput = document.querySelector('.search-input');
const clearSearchButton = document.getElementById('clear-search-button');
const refreshButton = document.querySelector(".refresh-button");
// Profile Menu Elements
const profileButton = document.getElementById('profile-button');
const profileDropdown = document.getElementById('profile-dropdown');
const userEmailDisplay = document.getElementById('user-email-display');
const userJobTitleDisplay = document.getElementById('user-job-title');
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
// Tries to render UI *if* cache exists. Returns true if rendered, false otherwise.
function tryInitialRenderFromCache() {
    console.log("Attempting initial render from localStorage...");
    const initialCachedData = localStorage.getItem('dataSheet');
    let rendered = false;

    if (initialCachedData) {
        console.log("Cached data found, attempting initial render.");
        try {
             const parsedData = JSON.parse(initialCachedData);
             if (!parsedData || !parsedData.data) throw new Error("Cached data invalid format");

            handleUrlHash(); // Determine and show initial view based on hash
            rendered = true; // Mark that we showed something
            preloadAllItemImages(); // Start preloading images

        } catch (error) {
            console.error("Error parsing or rendering initial cache:", error);
            localStorage.removeItem('dataSheet'); // Clear potentially corrupt data
            // Show categories container structure but with message if parse fails
            showCategoriesViewUI();
            if(actualButtonList) actualButtonList.innerHTML = '<p>Error loading data. Please refresh.</p>';
            rendered = true; // Still count as "rendered" (an error message)
        }
    } else {
        console.log("No cached data found for initial render attempt.");
        // Show categories container structure but with message
        showCategoriesViewUI(); // Show the basic structure
        if(actualButtonList) actualButtonList.innerHTML = '<p>Loading data...</p>'; // Show loading inside
        rendered = true; // Count showing the loading message as an initial render
    }
    // Setup UI interactions immediately
    setupSearch();
    setupProfileMenu();
    setupSwipeGestures(); // Setup swipe
    return rendered; // Return whether something was shown
}
// --- Run initial cache check and setup immediately ---
initialRenderDone = tryInitialRenderFromCache();

// --- Authentication State Change (Runs when Firebase Auth is ready) ---
auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed. User:", user ? user.email : 'None');
    const mainContent = document.querySelector('.main-content');

    if (user) {
        // User is signed in.
        profileButton.style.display = "block";
        searchBar.style.display = 'flex';
        // Profile menu setup is already called by tryInitialRenderFromCache

        try {
            // Check if data exists in cache
            const hasCachedData = localStorage.getItem('dataSheet') && localStorage.getItem('permissionRows');
            let needsRender = false;

            if (!hasCachedData) {
                // If no cache exists (fresh sign-in or cleared cache), force fetch
                console.log("Auth confirmed, NO cached data found. Forcing initial fetch...");
                await loadDataIntoLocalStorage(true); // Force fetch
                needsRender = true; // Need to render after fetch
            } else {
                // Cache exists. Check if initial render already happened.
                console.log("Auth confirmed, cached data found.");
                if (!initialRenderDone) {
                    // Render wasn't done before (e.g., auth was faster than initial check)
                    console.log("Initial render wasn't done, rendering now.");
                    needsRender = true;
                } else {
                    // Initial render was done from cache, no automatic fetch/re-render needed.
                    console.log("Initial render already done from cache. No automatic re-render.");
                }
            }

            // Render the view if needed (either after fetch or if initial render was skipped)
            if (needsRender) {
                 handleUrlHash(); // Render view based on hash
                 initialRenderDone = true; // Mark render as done
            }

            // Preload images *after* data is confirmed available (either cache or fetch)
            preloadAllItemImages();

        } catch (error) {
            // This catch handles errors from loadDataIntoLocalStorage(true) if it was called
            console.error("Error during initial data fetch/setup:", error);
            if (mainContent) mainContent.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error loading initial data. Please refresh.</p>';
            initialRenderDone = true; // Mark as done even on error
        }
    } else {
        // User is signed out.
        if (profileButton) profileButton.style.display = "none";
        if (searchBar) searchBar.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'none';
        // Redirect logic
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') {
             if (window.location.hash.startsWith('#categories') || window.location.hash.startsWith('#items')) {
                 history.replaceState(null, '', window.location.pathname);
             }
             window.location.href = "signin.html";
        }
    }
});

// --- Data Loading (Only fetches if forceRefresh is true) ---
async function loadDataIntoLocalStorage(forceRefresh = false) {
    let dataChanged = false;
    try {
        if (forceRefresh) {
            console.log("Forcing refresh: Fetching data from network...");
            const cacheBuster = `&_=${Date.now()}`;
            const currentSheetUrl = `${sheetUrl}${cacheBuster}`;
            const currentPermissionsUrl = `${permissionsSheetUrl}${cacheBuster}`;
            const currentData = localStorage.getItem('dataSheet');
            const currentPerms = localStorage.getItem('permissionRows');
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(currentSheetUrl, { cache: 'reload' }),
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
            if (newDataString !== currentData || newPermsString !== currentPerms) {
                 localStorage.setItem('dataSheet', newDataString);
                 localStorage.setItem('permissionRows', newPermsString);
                 console.log("New data fetched and stored in localStorage");
                 dataChanged = true;
            } else {
                 console.log("Fetched data is the same as cached data. No update stored.");
            }
        } else {
            const currentData = localStorage.getItem('dataSheet');
            const currentPerms = localStorage.getItem('permissionRows');
            if (currentData && currentPerms) console.log("Checked localStorage (background check).");
            else console.log("No cached data found (background check).");
        }
    } catch (error) {
        console.error("Error in loadDataIntoLocalStorage:", error);
        throw error;
    }
    return dataChanged;
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

// --- Display Items (Modified Image Loading) ---
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
        itemsList.innerHTML = ''; // Clear loading message now
        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
            if (!Array.isArray(item) || item.length < 7 || item.every(cell => !cell || String(cell).trim() === '')) continue;
            const itemCategory = item[1] ? String(item[1]).trim() : '';
            if (filterCategory && itemCategory !== filterCategory) continue;
            itemsFound = true;
            const itemId = String(item[0] || '').trim();
            const itemName = String(item[2] || 'No Name').trim();
            const realImageSrc = [item[4], item[5], item[6]].map(img => img ? String(img).trim() : null).find(img => img && img !== '');
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-container');
            const link = document.createElement('a');
            link.href = `detail.html?id=${encodeURIComponent(itemId)}`;
            link.classList.add('item-row');
            link.dataset.itemId = itemId;
            const img = document.createElement('img');
            img.src = "placeholder.png"; // Start with placeholder
            img.alt = itemName;
            img.classList.add('list-image');
            img.loading = "lazy";
            if (realImageSrc) {
                img.dataset.realSrc = realImageSrc;
                const imageLoader = new Image();
                imageLoader.onload = () => { if (img && img.dataset.realSrc === realImageSrc) { img.src = realImageSrc; } };
                imageLoader.onerror = () => { console.warn(`Failed to load image: ${realImageSrc}`); };
                imageLoader.src = realImageSrc;
            }
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
        const categories = getUniqueCategories();
        if (categories.length === 0) {
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

// --- Preload All Item Images ---
function preloadAllItemImages() {
    console.log("Starting image preloading...");
    const cachedDataString = localStorage.getItem('dataSheet');
    if (!cachedDataString) { console.warn("Preload: No data in localStorage."); return; }
    try {
        const cachedData = JSON.parse(cachedDataString);
        if (!cachedData?.data) { console.warn("Preload: Invalid data format."); return; }
        const dataRows = cachedData.data;
        const uniqueImageUrls = new Set();
        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
             if (!Array.isArray(item) || item.length < 7) continue;
            [item[4], item[5], item[6]].forEach(url => {
                if (url && typeof url === 'string' && url.trim() !== '') { uniqueImageUrls.add(url.trim()); }
            });
        }
        console.log(`Preloading ${uniqueImageUrls.size} unique images...`);
        uniqueImageUrls.forEach(url => {
            const imgPreloader = new Image();
            imgPreloader.src = url;
        });
    } catch (error) { console.error("Error during image preloading:", error); }
}


// --- View Switching & History Management ---

// Show Categories View - Manages Classes and UI Update
function showCategoriesViewUI() {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab) return;
    console.log(`Updating UI for Categories View`);

    // Set classes for positioning/transition
    categoryButtonsContainer.classList.add('view-active');
    categoryButtonsContainer.classList.remove('view-left', 'view-right');

    itemsListContainer.classList.add('view-left'); // Position items offscreen left
    itemsListContainer.classList.remove('view-active', 'view-right');

    // Update Tabs
    categoriesTab.classList.add('active');
    itemsTab.classList.remove('active');
    categoriesTab.setAttribute('aria-selected', 'true');
    itemsTab.setAttribute('aria-selected', 'false');

    // Update Content
    displayCategoryButtons();
}

// Show All Items View - Manages Classes and UI Update
function showAllItemsViewUI() {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab || !itemsListTitle) return;
    console.log(`Updating UI for All Items View`);

     // Set classes for positioning/transition
    itemsListContainer.classList.add('view-active');
    itemsListContainer.classList.remove('view-left', 'view-right');

    categoryButtonsContainer.classList.add('view-right'); // Position categories offscreen right
    categoryButtonsContainer.classList.remove('view-active', 'view-left');

    // Update Tabs
    itemsTab.classList.add('active');
    categoriesTab.classList.remove('active');
    itemsTab.setAttribute('aria-selected', 'true');
    categoriesTab.setAttribute('aria-selected', 'false');

    // Update Content
    itemsListTitle.textContent = 'جميع العناصر';
    displayItems();
}

// Show Items Filtered by Category - Manages Classes, UI, and PUSHES state if not popstate
function showItemsByCategory(categoryName, isPopState = false) {
    if (!itemsListContainer || !categoryButtonsContainer || !categoriesTab || !itemsTab || !itemsListTitle) return;
     console.log(`showItemsByCategory called for "${categoryName}" (isPopState: ${isPopState})`);

    // Update UI Classes and Content (Treat same as showing All Items view visually)
    itemsListContainer.classList.add('view-active');
    itemsListContainer.classList.remove('view-left', 'view-right');
    categoryButtonsContainer.classList.add('view-right'); // Categories offscreen right
    categoryButtonsContainer.classList.remove('view-active', 'view-left');

    itemsListTitle.textContent = categoryName;
    itemsTab.classList.add('active'); // Keep Items tab visually active
    categoriesTab.classList.remove('active');
    itemsTab.setAttribute('aria-selected', 'true');
    categoriesTab.setAttribute('aria-selected', 'false');
    displayItems(categoryName); // Display filtered items

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

    // Determine initial view based on hash AND call the appropriate UI function
    if (hash === '#items') {
        initialState = { view: 'items', filter: null };
        targetHash = '#items';
        showAllItemsViewUI(); // Show UI
    } else if (hash.startsWith('#items/')) {
        const category = decodeURIComponent(hash.substring(7));
        initialState = { view: 'items', filter: category };
        targetHash = `#items/${encodeURIComponent(category)}`;
        showItemsByCategory(category, true); // Show UI, mark as popstate
    } else {
        initialState = { view: 'categories', filter: null };
        targetHash = '#categories';
        showCategoriesViewUI(); // Show UI
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

        // Preload images again after refresh if data changed
         if (dataWasRefreshed) {
            preloadAllItemImages();
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
        // Check active view using class on container
        if (categoryButtonsContainer.classList.contains('view-active') && searchTerm) {
             console.log("Search initiated from Categories view, switching to All Items.");
             const currentState = history.state;
             const newState = { view: 'items', filter: null };
             if (!(currentState?.view === newState.view && currentState?.filter === newState.filter)) {
                 console.log("Pushing state for all items view (from search)");
                 history.pushState(newState, '', '#items');
             }
             showAllItemsViewUI(); // Update UI only
             filterDisplayedItems(searchTerm); // Filter the newly displayed items
             return;
        }
        // Filter items only if the items view is active
        if (itemsListContainer.classList.contains('view-active')) {
             filterDisplayedItems(searchTerm);
        }
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
    // Ensure elements exist before adding listeners
    if (!profileButton || !profileDropdown || !userEmailDisplay || !dropdownSignOutButton || !userJobTitleDisplay) {
         console.warn("Profile menu elements not found during setup.");
         return;
    }

    profileButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent click from immediately closing dropdown
        const isVisible = profileDropdown.style.display === 'block';
        profileDropdown.style.display = isVisible ? 'none' : 'block';

        // Update dropdown content based on current auth state
        const user = auth.currentUser; // Check auth status *at time of click*
        if (user) {
            userEmailDisplay.textContent = user.email;
            userEmailDisplay.title = user.email;
            let jobTitle = "ضيف"; // Default to Guest
            const permissionsDataString = localStorage.getItem('permissionRows');
            if (permissionsDataString) {
                try {
                    const permissionsData = JSON.parse(permissionsDataString);
                    if (permissionsData && permissionsData.data) {
                        const userPermissionRow = getUserPermissions(permissionsData.data, user.email);
                        if (userPermissionRow && userPermissionRow[1] && String(userPermissionRow[1]).trim() !== '') {
                            jobTitle = String(userPermissionRow[1]).trim();
                        }
                    }
                } catch (e) { console.error("Error parsing permissions data for job title", e); jobTitle = "Error"; }
            } else { console.warn("Permissions data not found in localStorage for job title lookup."); }
            userJobTitleDisplay.textContent = jobTitle;
            userJobTitleDisplay.style.display = 'block';
            dropdownSignOutButton.style.display = 'block';
        } else {
            userEmailDisplay.textContent = "Authenticating...";
            userEmailDisplay.title = '';
            userJobTitleDisplay.textContent = '';
            userJobTitleDisplay.style.display = 'none';
            dropdownSignOutButton.style.display = 'none';
        }
    });

    dropdownSignOutButton.addEventListener('click', signOut);

    document.addEventListener('click', (event) => {
        if (profileDropdown && profileDropdown.style.display === 'block' &&
            !profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.style.display = 'none';
        }
    });
    console.log("Profile menu setup.");
}


// --- Tab Event Listeners (Using Balanced History Logic) ---
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
                console.log("Tab Click: Replacing filtered item state with Categories, then Pushing All Items");
                history.replaceState({ view: 'categories', filter: null }, '', '#categories');
                history.pushState(newState, '', '#items');
            } else {
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

// --- Swipe Gesture Handling ---
function setupSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;
    let scrollTarget = null;
    const swipeThreshold = 50;
    const maxVerticalThreshold = 75;

    if (!viewWrapper) { console.error("View wrapper not found for swipe gestures."); return; }

    viewWrapper.addEventListener('touchstart', (event) => {
        // *** MODIFIED: Remove .item-row from exclusion ***
        // Allow swipe unless target is explicitly interactive OR view is scrolled
        scrollTarget = event.target.closest('.view');
        const isInteractive = event.target.closest('.category-button, input, button:not(#profile-button)'); // Removed a.item-row
        const isScrolled = scrollTarget && scrollTarget.scrollTop > 0;

        // console.log('Touch Start Target:', event.target);
        // console.log('Closest Interactive:', isInteractive);
        // console.log('Is View Scrolled:', isScrolled);

        if (isInteractive || isScrolled) {
             isSwiping = false;
             console.log("Swipe ignored: Target is interactive or view is scrolled.");
             return;
        }
        touchStartX = event.changedTouches[0].screenX;
        touchStartY = event.changedTouches[0].screenY;
        isSwiping = true; // Potential swipe starts
        // console.log('Swipe Status:', isSwiping);

    }, { passive: true });

     viewWrapper.addEventListener('touchmove', (event) => {
         if (!isSwiping) return;
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         const deltaX = touchEndX - touchStartX;
         const deltaY = touchEndY - touchStartY;
         // If swipe becomes primarily vertical, cancel the horizontal swipe gesture
         if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
              // console.log("Swipe cancelled: Too vertical.");
              isSwiping = false;
         }
     }, { passive: true });

    viewWrapper.addEventListener('touchend', (event) => {
         if (!isSwiping) return;
         isSwiping = false;
        touchEndX = event.changedTouches[0].screenX;
        touchEndY = event.changedTouches[0].screenY;
        handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const startX = touchStartX; // Keep start coords for logging if needed
        touchStartX = 0; touchStartY = 0; touchEndX = 0; touchEndY = 0; // Reset

        console.log(`Swipe detected: deltaX=${deltaX.toFixed(0)}, deltaY=${deltaY.toFixed(0)}`); // Added log

        // Check if it's primarily a horizontal swipe and meets threshold
        if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < maxVerticalThreshold) {
            const currentState = history.state || { view: 'categories', filter: null };

            // *** SWAPPED LOGIC FOR RTL ***
            // Swipe Left (<-): Navigate towards Items (if on Categories) (RTL: Finger moves L->R) -> Positive deltaX
            if (deltaX > 0) { // Changed from < 0
                 console.log("Swipe Left (L->R) detected");
                 if (currentState.view === 'categories') {
                     console.log("Action: Triggering Items Tab");
                     if(itemsTab) itemsTab.click(); // Simulate click
                 } else {
                      console.log("Action: No swipe action (already on Items or Filtered)");
                 }
            }
            // Swipe Right (->): Navigate towards Categories (if on Items) (RTL: Finger moves R->L) -> Negative deltaX
            else if (deltaX < 0) { // Changed from > 0
                console.log("Swipe Right (R->L) detected");
                 if (currentState.view === 'items') { // Check if we are on any items view
                     console.log("Action: Triggering Categories Tab");
                     if(categoriesTab) categoriesTab.click(); // Simulate click
                 } else {
                     console.log("Action: No swipe action (already on Categories)");
                 }
            }
        } else {
             console.log(`Swipe ignored: dX=${deltaX.toFixed(0)}, dY=${deltaY.toFixed(0)} (Thresholds not met or too vertical)`);
        }
    }
     console.log("Swipe gestures setup.");
}


// --- Helper: Get User Permissions ---
function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) return null;
    userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) { // Start from 1 to skip header
        if (permissions[i]?.[0]) { // Check if row and first cell (email) exist
            let storedEmail = String(permissions[i][0]).trim().toLowerCase();
            if (storedEmail === userEmail) {
                return permissions[i]; // Return the entire row
            }
        }
    }
    console.log(`Permissions not found for email: ${userEmail}`);
    return null; // Return null if no match found
}
