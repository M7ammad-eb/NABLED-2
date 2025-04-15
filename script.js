// Firebase configuration
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
const itemDetailView = document.getElementById('item-detail-view'); // New Detail View
const itemDetailsContent = document.getElementById('item-details-content'); // Container within Detail View
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
// Store the last active list view state for back navigation from detail
let lastListViewState = { view: 'categories', filter: null };

// --- Sign Out Function ---
function signOut() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('dataSheet');
            localStorage.removeItem('permissionRows');
            console.log('User signed out and local data cleared.');
            // Reset history to avoid back button issues after sign out
            history.replaceState({ view: 'categories', filter: null }, '', '#categories');
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
            showCategoriesViewUI(); // Show categories structure
            if(actualButtonList) actualButtonList.innerHTML = '<p>Error loading data. Please refresh.</p>';
            rendered = true; // Still count as "rendered" (an error message)
        }
    } else {
        console.log("No cached data found for initial render attempt.");
        showCategoriesViewUI(); // Show the basic structure
        if(actualButtonList) actualButtonList.innerHTML = '<p>Loading data...</p>'; // Show loading inside
        rendered = true; // Count showing the loading message as an initial render
    }
    // Setup UI interactions immediately
    setupSearch();
    setupProfileMenu();
    setupSwipeGestures();
    return rendered;
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

        try {
            const hasCachedData = localStorage.getItem('dataSheet') && localStorage.getItem('permissionRows');
            let needsRender = false;

            if (!hasCachedData) {
                console.log("Auth confirmed, NO cached data found. Forcing initial fetch...");
                await loadDataIntoLocalStorage(true); // Force fetch
                needsRender = true; // Need to render after fetch
            } else {
                console.log("Auth confirmed, cached data found.");
                if (!initialRenderDone) {
                    console.log("Initial render wasn't done, rendering now.");
                    needsRender = true;
                } else {
                    console.log("Initial render already done from cache. No automatic re-render.");
                }
            }

            if (needsRender) {
                 handleUrlHash(); // Render view based on hash
                 initialRenderDone = true; // Mark render as done
            }

            // Preload images after data is confirmed available
            preloadAllItemImages();

        } catch (error) {
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
            // Clear hash before redirecting
            if (window.location.hash) {
                 history.replaceState({ view: 'categories', filter: null }, '', window.location.pathname); // Clear hash
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

// --- Find Item By ID (Moved from detail.js logic) ---
function findItemById(items, itemId) {
    if (!items || !itemId) return null;
    // Start from 1 to skip potential header row
    for (let i = 1; i < items.length; i++) {
        // Check if the first element (ID) matches
        if (items[i] && items[i][0] === itemId) {
            return items[i]; // Return the full item row
        }
    }
    return null; // Not found
}


// --- Display Items (Modified Image Loading and Click Handler) ---
function displayItems(filterCategory = null) {
    if (!itemsList) return;
    itemsList.innerHTML = '<p>Loading items...</p>'; // Show loading message
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
        itemsList.innerHTML = ''; // Clear loading message or previous items

        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
            // Basic validation for a valid item row
            if (!Array.isArray(item) || item.length < 7 || item.every(cell => !cell || String(cell).trim() === '')) continue;

            const itemCategory = item[1] ? String(item[1]).trim() : '';
            // Apply category filter if provided
            if (filterCategory && itemCategory !== filterCategory) continue;

            itemsFound = true; // Mark that we found at least one item to display
            const itemId = String(item[0] || '').trim();
            const itemName = String(item[2] || 'No Name').trim();
            // Find the first valid image URL from columns 4, 5, 6
            const realImageSrc = [item[4], item[5], item[6]].map(img => img ? String(img).trim() : null).find(img => img && img !== '');

            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-container');

            // Use a button or div instead of <a> for click handling within SPA
            const clickableElement = document.createElement('button'); // Use button for better accessibility
            clickableElement.classList.add('item-row');
            clickableElement.dataset.itemId = itemId; // Store ID for click handler
            clickableElement.setAttribute('aria-label', `View details for ${itemName}`);

            const img = document.createElement('img');
            img.src = "placeholder.png"; // Start with placeholder
            img.alt = itemName;
            img.classList.add('list-image');
            img.loading = "lazy"; // Lazy load images in the list

            // Preload the real image and swap src when loaded
            if (realImageSrc) {
                img.dataset.realSrc = realImageSrc; // Store real source
                const imageLoader = new Image();
                imageLoader.onload = () => {
                    // Check if the img element still exists and corresponds to this src
                    if (img && img.dataset.realSrc === realImageSrc) {
                        img.src = realImageSrc;
                    }
                };
                imageLoader.onerror = () => { console.warn(`Failed to load image: ${realImageSrc}`); /* Keep placeholder */ };
                imageLoader.src = realImageSrc; // Start loading
            }

            clickableElement.appendChild(img);

            const codeDiv = document.createElement('div');
            codeDiv.classList.add('item-code');
            codeDiv.textContent = itemId;
            clickableElement.appendChild(codeDiv);

            const descDiv = document.createElement('div');
            descDiv.classList.add('item-description');
            descDiv.textContent = itemName;
            clickableElement.appendChild(descDiv);

            // *** Add click listener to show detail view ***
            clickableElement.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent any default button action
                 // Add visual feedback
                clickableElement.classList.add('item-clicked');
                // Remove the class after the transition
                setTimeout(() => clickableElement.classList.remove('item-clicked'), 300);
                showItemDetailView(itemId);
            });

            itemDiv.appendChild(clickableElement);
            itemsList.appendChild(itemDiv);
        }

        // Handle case where no items were found after filtering or if data is empty
        if (!itemsFound) {
             itemsList.innerHTML = filterCategory
                ? `<p>No items found in category "${filterCategory}".</p>`
                : (dataRows.length <= 1 ? '<p>No item data found.</p>' : '<p>No items to display.</p>');
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
        actualButtonList.innerHTML = ''; // Clear loading message
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button');
            button.addEventListener('click', (e) => {
                e.preventDefault();
                showItemsByCategory(category, false); // Navigate to filtered items view
            });
            actualButtonList.appendChild(button);
        });
    } catch (error) {
        console.error("Error getting/displaying categories:", error);
        actualButtonList.innerHTML = '<p>Error loading categories.</p>';
    }
}

// --- Preload All Item Images (for list and detail) ---
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
             if (!Array.isArray(item) || item.length < 7) continue; // Check basic structure
            // Add images from columns 4, 5, 6 (indices)
            [item[4], item[5], item[6]].forEach(url => {
                if (url && typeof url === 'string' && url.trim() !== '') {
                    uniqueImageUrls.add(url.trim());
                }
            });
        }
        console.log(`Preloading ${uniqueImageUrls.size} unique images...`);
        uniqueImageUrls.forEach(url => {
            const imgPreloader = new Image();
            imgPreloader.src = url; // Start loading the image
        });
    } catch (error) { console.error("Error during image preloading:", error); }
}


// --- View Switching & History Management ---

function updateViewClasses(activeViewId) {
    const views = [categoryButtonsContainer, itemsListContainer, itemDetailView];
    views.forEach(view => {
        if (!view) return; // Skip if view element doesn't exist
        if (view.id === activeViewId) {
            view.classList.add('view-active');
            view.classList.remove('view-left', 'view-right');
            view.scrollTop = 0; // Scroll to top when view becomes active
        } else {
            // Determine if the inactive view should be positioned left or right
            // This logic assumes Categories -> Items -> Detail flow
            if (activeViewId === 'category-buttons-container') {
                // If Categories is active, Items and Detail are to the left (offscreen)
                 if (view.id === 'items-list-container' || view.id === 'item-detail-view') {
                    view.classList.add('view-left');
                    view.classList.remove('view-active', 'view-right');
                 }
            } else if (activeViewId === 'items-list-container') {
                // If Items is active, Categories is to the right, Detail is to the left
                 if (view.id === 'category-buttons-container') {
                    view.classList.add('view-right');
                    view.classList.remove('view-active', 'view-left');
                 } else if (view.id === 'item-detail-view') {
                    view.classList.add('view-left');
                    view.classList.remove('view-active', 'view-right');
                 }
            } else if (activeViewId === 'item-detail-view') {
                 // If Detail is active, Categories and Items are to the right
                 if (view.id === 'category-buttons-container' || view.id === 'items-list-container') {
                    view.classList.add('view-right');
                    view.classList.remove('view-active', 'view-left');
                 }
            } else {
                 // Default: position inactive views to the left
                 view.classList.add('view-left');
                 view.classList.remove('view-active', 'view-right');
            }
        }
    });

    // Update Tab states
    categoriesTab.classList.toggle('active', activeViewId === 'category-buttons-container');
    itemsTab.classList.toggle('active', activeViewId === 'items-list-container');
    // Deactivate tabs if detail view is active
    if (activeViewId === 'item-detail-view') {
        categoriesTab.classList.remove('active');
        itemsTab.classList.remove('active');
    }
    categoriesTab.setAttribute('aria-selected', activeViewId === 'category-buttons-container');
    itemsTab.setAttribute('aria-selected', activeViewId === 'items-list-container');

    console.log(`UI Updated. Active view: ${activeViewId}`);
}


// Show Categories View - Manages UI Update
function showCategoriesViewUI() {
    if (!categoryButtonsContainer) return;
    console.log(`Updating UI for Categories View`);
    updateViewClasses('category-buttons-container');
    displayCategoryButtons(); // Refresh categories
    // Store this as the last list view
    lastListViewState = { view: 'categories', filter: null };
}

// Show All Items View - Manages UI Update
function showAllItemsViewUI() {
    if (!itemsListContainer || !itemsListTitle) return;
    console.log(`Updating UI for All Items View`);
    itemsListTitle.textContent = 'جميع العناصر'; // Set title
    updateViewClasses('items-list-container');
    displayItems(); // Display all items
    // Store this as the last list view
    lastListViewState = { view: 'items', filter: null };
}

// Show Items Filtered by Category - Manages UI and PUSHES state if not popstate
function showItemsByCategory(categoryName, isPopState = false) {
    if (!itemsListContainer || !itemsListTitle) return;
    console.log(`showItemsByCategory called for "${categoryName}" (isPopState: ${isPopState})`);

    itemsListTitle.textContent = categoryName; // Set title to category name
    updateViewClasses('items-list-container'); // Make items view active
    displayItems(categoryName); // Display filtered items

    // Store this as the last list view
    lastListViewState = { view: 'items', filter: categoryName };

    // PUSH history state ONLY if called directly (not by popstate) and state actually changes
    const newState = { view: 'items', filter: categoryName };
    const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.filter === newState.filter);

    if (!isPopState && stateChanged) {
        console.log(`Pushing state for category: ${categoryName}`);
        history.pushState(newState, '', `#items/${encodeURIComponent(categoryName)}`);
    } else if (!isPopState && !stateChanged) {
        console.log(`State for category "${categoryName}" is already current. No pushState.`);
    }
}

// --- NEW: Show Item Detail View ---
function showItemDetailView(itemId, isPopState = false) {
    if (!itemDetailView || !itemDetailsContent || !auth.currentUser) {
        console.error("Detail view container, content area, or user not available.");
        // Optionally redirect to signin or show an error
        return;
    }
    console.log(`showItemDetailView called for ID: "${itemId}" (isPopState: ${isPopState})`);

    // --- Get Data (Similar to old detail.js) ---
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));

    if (!cachedData?.data || !cachedPermission?.data) {
        console.error("Data or permissions missing from localStorage for detail view.");
        itemDetailsContent.innerHTML = '<p>Error: Item data not found. Please refresh.</p>';
        updateViewClasses('item-detail-view'); // Show the view with the error
        return;
    }

    const dataRows = cachedData.data;
    const permissionRows = cachedPermission.data;
    const item = findItemById(dataRows, itemId);

    if (!item) {
        console.error(`Item with ID ${itemId} not found in cached data.`);
        itemDetailsContent.innerHTML = `<p>Error: Item with ID ${itemId} not found.</p>`;
        updateViewClasses('item-detail-view');
        return;
    }

    // --- Get Permissions ---
    const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
    // Visible columns are price columns (indices 8 onwards in data)
    // Map permissions (1/0) starting from the 3rd permission column (index 2)
    const visiblePriceColumns = userPermissions
        ? userPermissions.slice(2).map((val, index) => (val === '1' ? index + 8 : -1)).filter(val => val !== -1)
        : []; // Indices of visible price columns (e.g., [8, 10])


    // --- Render Details ---
    itemDetailsContent.innerHTML = renderItemDetailsHTML(item, visiblePriceColumns, dataRows[0]); // dataRows[0] is columnNames

    // --- Activate Carousel ---
    // Ensure this function is defined later or moved from detail.js
    addCarouselFunctionality('#item-detail-view'); // Pass parent selector

    // --- Update UI ---
    updateViewClasses('item-detail-view'); // Make detail view active

    // --- Update History ---
    const newState = { view: 'detail', itemId: itemId };
    const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.itemId === newState.itemId);

    if (!isPopState && stateChanged) {
        console.log(`Pushing state for detail view: ${itemId}`);
        history.pushState(newState, '', `#detail/${itemId}`);
    } else if (!isPopState && !stateChanged) {
        console.log(`State for detail view "${itemId}" is already current. No pushState.`);
    }
}

// --- NEW: Render Item Details HTML (Logic from old displayItem) ---
function renderItemDetailsHTML(item, visiblePriceColumnIndices, columnNames) {
    if (!item || !columnNames) return '<p>Error rendering item details.</p>';

    let html = '';

    // === 1. IMAGE CAROUSEL ===
    const images = [item[4], item[5], item[6]].filter(Boolean); // Filter out empty/null image URLs
    const placeholder = 'placeholder.png';
    const hasImages = images.length > 0;

    html += `<div class="carousel-container">`;
    html += `<div class="slides-wrapper">`;

    if (hasImages) {
        images.forEach((src, index) => {
            // Use placeholder initially, load real image via JS later in addCarouselFunctionality
            html += `<div class="slide ${index === 0 ? 'active' : ''}" data-src="${src}">
                       <img src="${placeholder}" alt="${item[2] || 'Product Image'}" class="carousel-image">
                     </div>`;
        });
    } else {
        // Show only placeholder if no images
        html += `<div class="slide active" data-src="${placeholder}">
                   <img src="${placeholder}" alt="Placeholder Image" class="carousel-image">
                 </div>`;
    }

    html += `</div>`; // end slides-wrapper

    // Add Dots if more than one image
    if (images.length > 1) {
        html += `<div class="carousel-dots">`;
        images.forEach((_, i) => {
            html += `<span class="dot ${i === 0 ? 'active' : ''}" data-slide-index="${i}"></span>`;
        });
        html += `</div>`; // end carousel-dots
    }

    html += `</div>`; // end carousel-container

    // === 2. ITEM DATA ===
    // Item Name (Column 2)
    html += `<h2>${item[2] || ""}</h2><br>`;

    // Item ID (Column 0)
    html += `<p>${columnNames[0] || "ID"} <br><strong>${item[0] || ""}</strong></p>`;

    // Specifications (Column 3)
    if (item[3]) {
        html += `<p>${columnNames[3] || "Specifications"} <br><strong>${item[3]}</strong></p>`;
    }

    // Catalog Link (Column 7)
    if (item[7]) {
        html += `<p><a href="${item[7]}" target="_blank" rel="noopener noreferrer">${columnNames[7] || "Catalog"}</a></p>`;
    }

    // Prices (Columns 8 onwards, based on visibility)
    visiblePriceColumnIndices.forEach(index => {
        if (index < item.length && item[index] !== undefined && item[index] !== null && item[index] !== '') { // Check if price exists and is valid
            const key = columnNames[index] || `Price ${index + 1}`;
            const value = item[index];
            html += `<p>${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol" alt="SAR"></p>`;
        }
    });

     html += `<br>`; // Add some spacing at the end

    return html;
}

// --- NEW: Carousel Functionality (Moved from detail.js) ---
// Takes a parent selector to scope the querySelectors
function addCarouselFunctionality(parentSelector) {
    const container = document.querySelector(parentSelector);
    if (!container) return;

    let currentSlide = 0;
    const slides = container.querySelectorAll('.slide');
    const dots = container.querySelectorAll('.dot');
    const slidesWrapper = container.querySelector('.slides-wrapper');

    if (!slides.length || !slidesWrapper) {
        // console.log("Carousel elements not found or no slides.");
        return; // No carousel to set up
    }

    // --- Image Loading ---
    slides.forEach(slide => {
        const img = slide.querySelector('img');
        const realSrc = slide.dataset.src;
        if (img && realSrc && realSrc !== 'placeholder.png') {
            const realImageLoader = new Image();
            realImageLoader.onload = () => { img.src = realSrc; };
            realImageLoader.onerror = () => { console.warn(`Failed to load carousel image: ${realSrc}`); /* Keep placeholder */ };
            realImageLoader.src = realSrc;
        } else if (img && realSrc === 'placeholder.png') {
            img.src = realSrc; // Ensure placeholder is shown if it's the only source
        }
    });


    function showSlide(index) {
        if (slides.length <= 1) return; // No need to slide if only one image

        // Wrap index around
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        // Update slides and dots
        slides.forEach((s, i) => s.classList.toggle('active', i === index));
        dots.forEach((d, i) => d.classList.toggle('active', i === index));

        // --- Use CSS Transform for Sliding ---
        // We are stacking slides with absolute positioning now,
        // so transform isn't needed for the *wrapper*.
        // The active class handles visibility.
        // slidesWrapper.style.transform = `translateX(-${index * 100}%)`; // Adjust for RTL if needed, but opacity change is simpler

        currentSlide = index;
    }

    // Dot navigation
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => showSlide(i));
    });

    // Swipe support
    let touchStartX = 0;
    slidesWrapper.addEventListener('touchstart', e => {
        if (slides.length <= 1) return;
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    slidesWrapper.addEventListener('touchend', e => {
        if (slides.length <= 1 || touchStartX === 0) return;
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX;
        // Adjust sensitivity and direction for RTL if needed
        // Standard LTR swipe: Left swipe (prev) diff < -30, Right swipe (next) diff > 30
        // RTL swipe: Left swipe (R->L, next) diff < -30, Right swipe (L->R, prev) diff > 30
        if (diff > 50) showSlide(currentSlide - 1); // Swipe Right (L->R) -> Previous slide
        else if (diff < -50) showSlide(currentSlide + 1); // Swipe Left (R->L) -> Next slide
        touchStartX = 0; // Reset start position
    }, { passive: true });

    // Initialize first slide
    showSlide(0);
    console.log("Carousel functionality added.");
}


// --- Popstate Event Handler (Browser Back/Forward) ---
function handlePopState(event) {
    console.log("popstate event fired. State:", event.state);
    const state = event.state;

    // Determine the view based on the state from history
    if (!state || state.view === 'categories') {
        console.log("Popstate: updating UI to categories view");
        showCategoriesViewUI();
    } else if (state.view === 'items') {
        if (state.filter) {
            console.log(`Popstate: updating UI to items for category: ${state.filter}`);
            showItemsByCategory(state.filter, true); // Mark as popstate
        } else {
            console.log("Popstate: updating UI to all items view");
            showAllItemsViewUI();
        }
    } else if (state.view === 'detail') {
        if (state.itemId) {
             console.log(`Popstate: updating UI to detail view for item: ${state.itemId}`);
             showItemDetailView(state.itemId, true); // Mark as popstate
        } else {
             console.warn("Popstate: Detail state missing itemId, going to categories.");
             showCategoriesViewUI();
             history.replaceState({ view: 'categories', filter: null }, '', '#categories'); // Correct history
        }
    } else {
         console.warn("Popstate: Unknown state received, defaulting to categories UI", state);
         showCategoriesViewUI();
         history.replaceState({ view: 'categories', filter: null }, '', '#categories'); // Correct history
    }
}
window.addEventListener('popstate', handlePopState);

// --- Handle Initial URL Hash on Load ---
function handleUrlHash() {
    const hash = window.location.hash;
    console.log("Handling initial hash:", hash);
    let initialState = { view: 'categories', filter: null };
    let targetHash = '#categories';

    // Determine initial view based on hash and call the appropriate UI function
    if (hash.startsWith('#detail/')) {
        const itemId = decodeURIComponent(hash.substring(8));
        initialState = { view: 'detail', itemId: itemId };
        targetHash = `#detail/${encodeURIComponent(itemId)}`;
        // Need data loaded before showing detail, might need async/await or check
        // For now, assume data is ready or will be handled by showItemDetailView's checks
        showItemDetailView(itemId, true); // Show UI, mark as popstate init
    } else if (hash.startsWith('#items/')) {
        const category = decodeURIComponent(hash.substring(7));
        initialState = { view: 'items', filter: category };
        targetHash = `#items/${encodeURIComponent(category)}`;
        showItemsByCategory(category, true); // Show UI, mark as popstate init
    } else if (hash === '#items') {
        initialState = { view: 'items', filter: null };
        targetHash = '#items';
        showAllItemsViewUI(); // Show UI
    } else { // Default or #categories
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
        const dataWasRefreshed = await loadDataIntoLocalStorage(true);
        console.log("Refresh fetch complete. Data changed:", dataWasRefreshed);

        // Re-render the view that was current BEFORE the refresh started
        console.log("Refresh complete, restoring view for state:", currentState);
        if (currentState.view === 'categories') {
            showCategoriesViewUI();
        } else if (currentState.view === 'items') {
            if (currentState.filter) {
                showItemsByCategory(currentState.filter, true); // Pass true as it's restoring state
            } else {
                showAllItemsViewUI();
            }
        } else if (currentState.view === 'detail') {
             if (currentState.itemId) {
                 showItemDetailView(currentState.itemId, true); // Pass true
             } else {
                 showCategoriesViewUI(); // Fallback if detail state is invalid
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
         // Show error in the currently intended view if possible
         if (currentState.view === 'categories' && actualButtonList) actualButtonList.innerHTML = '<p>Error refreshing data.</p>';
         else if (currentState.view === 'items' && itemsList) itemsList.innerHTML = '<p>Error refreshing data.</p>';
         else if (currentState.view === 'detail' && itemDetailsContent) itemDetailsContent.innerHTML = '<p>Error refreshing data.</p>';
         else showCategoriesViewUI(); // Default back on error

    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        console.log("Refresh attempt complete.");
    }
});

// --- Search Functionality ---
function setupSearch() {
    if (!searchInput || !clearSearchButton) return; // Removed dependency on itemsList/categoryButtonsContainer here

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        clearSearchButton.style.display = searchTerm ? 'block' : 'none';

        const currentView = history.state?.view; // Check history state

        // If searching from Categories or Detail view, switch to All Items view first
        if ((currentView === 'categories' || currentView === 'detail') && searchTerm) {
             console.log(`Search initiated from ${currentView} view, switching to All Items.`);
             const newState = { view: 'items', filter: null };
             // Use pushState to make 'back' go to the view before search started
             history.pushState(newState, '', '#items');
             showAllItemsViewUI(); // Update UI to show all items
             filterDisplayedItems(searchTerm); // Then filter the newly displayed items
             return; // Done for this input event
        }

        // If already in an items view (all or filtered), just filter
        if (currentView === 'items') {
             filterDisplayedItems(searchTerm);
        }
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchButton.style.display = 'none';
        searchInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event to re-filter
        searchInput.focus();
    });
     console.log("Search functionality setup.");
}

// Filters items currently visible in the #items-list container
function filterDisplayedItems(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const currentItemsList = document.getElementById('items-list'); // Get the list container
    if (!currentItemsList) return;

    const itemElements = currentItemsList.querySelectorAll('.item-container'); // Target the outer container div
    let visibleCount = 0;
    itemElements.forEach(itemElement => {
        const itemButton = itemElement.querySelector('button.item-row'); // Find the button inside
        if (!itemButton) return;

        const itemCode = (itemButton.querySelector('.item-code')?.textContent || '').toLowerCase();
        const itemDescription = (itemButton.querySelector('.item-description')?.textContent || '').toLowerCase();
        const isMatch = term === '' || itemCode.includes(term) || itemDescription.includes(term);

        itemElement.style.display = isMatch ? 'block' : 'none'; // Show/hide the container
        if (isMatch) visibleCount++;
    });

    // Optional: Show a "No results" message within the list if needed
    let noResultsMsg = currentItemsList.querySelector('.no-search-results');
    if (visibleCount === 0 && term !== '') {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('p');
            noResultsMsg.classList.add('no-search-results');
            noResultsMsg.style.textAlign = 'center';
            noResultsMsg.style.padding = '20px';
            noResultsMsg.style.color = '#666';
            noResultsMsg.style.gridColumn = '1 / -1'; // Span full width if grid
            currentItemsList.appendChild(noResultsMsg);
        }
        noResultsMsg.textContent = `No items match "${searchTerm}".`;
        noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) {
        noResultsMsg.style.display = 'none'; // Hide message if there are results or search is empty
    }
}


// --- Profile Menu Setup ---
function setupProfileMenu() {
    if (!profileButton || !profileDropdown || !userEmailDisplay || !dropdownSignOutButton || !userJobTitleDisplay) {
         console.warn("Profile menu elements not found during setup.");
         return;
    }

    profileButton.addEventListener('click', (event) => {
        event.stopPropagation();
        const isVisible = profileDropdown.style.display === 'block';
        profileDropdown.style.display = isVisible ? 'none' : 'block';

        const user = auth.currentUser;
        if (user) {
            userEmailDisplay.textContent = user.email;
            userEmailDisplay.title = user.email;
            let jobTitle = "ضيف"; // Default
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

    // Close dropdown if clicking outside
    document.addEventListener('click', (event) => {
        if (profileDropdown && profileDropdown.style.display === 'block' &&
            !profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.style.display = 'none';
        }
    });
    console.log("Profile menu setup.");
}

// --- Tab Event Listeners ---
if (categoriesTab && itemsTab) {
    categoriesTab.addEventListener('click', (e) => {
        e.preventDefault();
        const currentState = history.state;
        const newState = { view: 'categories', filter: null };
        // Only change history if not already on categories
        if (currentState?.view !== 'categories') {
             // Use replaceState if coming from detail, pushState otherwise
             if (currentState?.view === 'detail') {
                 console.log("Tab Click (Categories): Replacing detail state");
                 history.replaceState(newState, '', '#categories');
             } else {
                 console.log("Tab Click (Categories): Pushing state");
                 history.pushState(newState, '', '#categories');
             }
        } else {
            console.log("Tab Click (Categories): Already on categories view.");
        }
        showCategoriesViewUI(); // Update UI
    });

    itemsTab.addEventListener('click', (e) => {
        e.preventDefault();
        const currentState = history.state;
        const newState = { view: 'items', filter: null }; // Target: All items view
        // Only change history if not already on the *exact* target state
        if (!(currentState?.view === newState.view && currentState?.filter === newState.filter)) {
             // Use replaceState if coming from detail, pushState otherwise
             if (currentState?.view === 'detail') {
                 console.log("Tab Click (Items): Replacing detail state");
                 history.replaceState(newState, '', '#items');
             } else {
                 console.log("Tab Click (Items): Pushing state");
                 history.pushState(newState, '', '#items');
             }
        } else {
            console.log("Tab Click (Items): Already on all items view.");
        }
        showAllItemsViewUI(); // Update UI
    });
     console.log("Tab event listeners added.");
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
    const swipeThreshold = 50; // Min horizontal distance
    const maxVerticalThreshold = 75; // Max vertical distance allowed

    if (!viewWrapper) { console.error("View wrapper not found for swipe gestures."); return; }

    viewWrapper.addEventListener('touchstart', (event) => {
        // Allow swipe only if not touching an interactive element within the *active* view
        const activeView = viewWrapper.querySelector('.view.view-active');
        if (!activeView) return;

        const isInteractive = event.target.closest('button, input, a, .item-row, .category-button, .dot'); // Include item rows/buttons and dots
        const isScrollBar = event.target === activeView || event.target === viewWrapper; // Crude check if touching view background/scrollbar

        if (isInteractive && !event.target.classList.contains('item-row')) { // Allow swipe on item rows
             isSwiping = false;
             // console.log("Swipe ignored: Target is interactive.");
             return;
        }
        // Allow swipe initiation even if scrolled, but check scroll position later if needed
        touchStartX = event.changedTouches[0].screenX;
        touchStartY = event.changedTouches[0].screenY;
        isSwiping = true; // Potential swipe starts
    }, { passive: true });

     viewWrapper.addEventListener('touchmove', (event) => {
         if (!isSwiping) return;
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         const deltaX = touchEndX - touchStartX;
         const deltaY = touchEndY - touchStartY;
         // Cancel horizontal swipe if it becomes too vertical
         if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
             // console.log("Swipe cancelled: Too vertical.");
             isSwiping = false;
         }
     }, { passive: true });

    viewWrapper.addEventListener('touchend', (event) => {
         if (!isSwiping) return;
         isSwiping = false; // Swipe attempt finished
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        touchStartX = 0; touchStartY = 0; touchEndX = 0; touchEndY = 0; // Reset

        // console.log(`Swipe detected: deltaX=${deltaX.toFixed(0)}, deltaY=${deltaY.toFixed(0)}`);

        // Check if it's primarily a horizontal swipe and meets threshold
        if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaY) < maxVerticalThreshold) {
            const currentState = history.state || { view: 'categories', filter: null };
            const currentViewId = currentState.view === 'detail' ? 'item-detail-view'
                                : currentState.view === 'items' ? 'items-list-container'
                                : 'category-buttons-container';

            // *** RTL Logic: L->R swipe is positive deltaX, R->L swipe is negative deltaX ***

            // Swipe Left (R->L, negative deltaX): Navigate "forward" (Categories -> Items -> Detail)
            if (deltaX < 0) {
                console.log("Swipe Left (R->L) detected");
                if (currentViewId === 'category-buttons-container') {
                    console.log("Action: Triggering Items Tab (All Items)");
                    if(itemsTab) itemsTab.click(); // Go to All Items
                } else if (currentViewId === 'items-list-container') {
                    // Cannot swipe forward from items list (need to click an item)
                    console.log("Action: No swipe forward action from items list.");
                } else if (currentViewId === 'item-detail-view') {
                     // Cannot swipe forward from detail view
                     console.log("Action: No swipe forward action from detail view.");
                }
            }
            // Swipe Right (L->R, positive deltaX): Navigate "backward" (Detail -> Items/Categories -> Categories)
            else if (deltaX > 0) {
                console.log("Swipe Right (L->R) detected");
                if (currentViewId === 'item-detail-view') {
                    console.log("Action: Simulating Back Button from Detail");
                    history.back(); // Go back to the previous state (Items or Categories)
                } else if (currentViewId === 'items-list-container') {
                    console.log("Action: Triggering Categories Tab");
                    if(categoriesTab) categoriesTab.click(); // Go back to Categories
                } else if (currentViewId === 'category-buttons-container') {
                    // Cannot swipe back from categories view
                    console.log("Action: No swipe back action from categories view.");
                }
            }
        } else {
             // console.log(`Swipe ignored: dX=${deltaX.toFixed(0)}, dY=${deltaY.toFixed(0)} (Thresholds not met or too vertical)`);
        }
    }
     console.log("Swipe gestures setup.");
}


// --- Helper: Get User Permissions (Moved from detail.js logic) ---
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

// --- Helper: Display Offline Message (Placeholder) ---
// This might be integrated directly where needed instead of a separate function
function displayOfflineMessage(containerElement) {
    if (containerElement) {
        containerElement.innerHTML = `
            <p>Item details are not available offline.</p>
            <p>Please connect to the internet to view this item.</p>
            <img src="placeholder.png" alt="Placeholder Image" style="display:block; margin: 20px auto; max-width: 80%;">
        `;
    }
}
