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
const categoriesTab = document.getElementById('categories-tab');
const itemsTab = document.getElementById('items-tab');
const categoryButtonsContainer = document.getElementById('category-buttons-container');
const actualButtonList = document.getElementById('actual-button-list');
const itemsListContainer = document.getElementById('items-list-container');
const itemsList = document.getElementById('items-list');
const itemsListTitle = document.getElementById('items-list-title');
const itemDetailView = document.getElementById('item-detail-view');
const itemDetailsContent = document.getElementById('item-details-content');
const viewWrapper = document.getElementById('view-wrapper');
const searchBar = document.querySelector('.search-bar');
const searchInput = document.querySelector('.search-input');
const clearSearchButton = document.getElementById('clear-search-button');
const refreshButton = document.querySelector(".refresh-button");
const profileButton = document.getElementById('profile-button');
const backButton = document.getElementById('back-button');
const headerLogo = document.getElementById('header-logo');
const sortButton = document.getElementById('sort-button');
const profileDropdown = document.getElementById('profile-dropdown');
const userEmailDisplay = document.getElementById('user-email-display');
const userJobTitleDisplay = document.getElementById('user-job-title');
const dropdownSignOutButton = document.getElementById('dropdown-sign-out-button');
// New Sort Dropdown Elements
const sortDropdown = document.getElementById('sort-dropdown');
const applySortButton = document.getElementById('apply-sort-button');
const sortDirectionRadios = document.querySelectorAll('input[name="sortDirection"]');
const sortByRadios = document.querySelectorAll('input[name="sortBy"]');


// --- State Variables ---
let initialRenderDone = false;
let lastListViewState = { view: 'categories', filter: null };
let itemsListScrollPos = 0;
// New Sorting State
let currentSortBy = 'default'; // 'default', 'code', 'name', 'category'
let currentSortDirection = 'asc'; // 'asc', 'desc'


// --- Sign Out Function ---
function signOut() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('dataSheet');
            localStorage.removeItem('permissionRows');
            console.log('User signed out and local data cleared.');
            history.replaceState({ view: 'categories', filter: null }, '', '#categories');
            window.location.href = 'signin.html';
        })
        .catch((error) => console.error('Sign-out error:', error));
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// --- Initial Load Attempt from Cache ---
function tryInitialRenderFromCache() {
    console.log("Attempting initial render from localStorage...");
    const initialCachedData = localStorage.getItem('dataSheet');
    let rendered = false;
    if (initialCachedData) {
        console.log("Cached data found.");
        try {
            const parsedData = JSON.parse(initialCachedData);
            if (!parsedData?.data) throw new Error("Cached data invalid format");
            handleUrlHash(); // Determine and show initial view
            rendered = true;
            preloadAllItemImages();
        } catch (error) {
            console.error("Error parsing/rendering initial cache:", error);
            localStorage.removeItem('dataSheet');
            showCategoriesViewUI();
            if(actualButtonList) actualButtonList.innerHTML = '<p>Error loading data. Please refresh.</p>';
            rendered = true;
        }
    } else {
        console.log("No cached data found.");
        showCategoriesViewUI();
        if(actualButtonList) actualButtonList.innerHTML = '<p>Loading data...</p>';
        rendered = true;
    }
    setupUIInteractions(); // Setup listeners regardless of cache
    return rendered;
}

// --- Setup UI Interactions ---
function setupUIInteractions() {
    setupSearch();
    setupProfileMenu();
    setupSwipeGestures(); // Uses the reverted function now
    setupBackButton();
    setupTabNav(); // Contains the updated logic
    setupRefreshButton();
    setupSortButtonAndDropdown();
    console.log("UI Interactions Setup.");
}

// --- Run initial cache check and setup ---
initialRenderDone = tryInitialRenderFromCache();

// --- Authentication State Change ---
auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed. User:", user ? user.email : 'None');
    const mainContent = document.querySelector('.main-content');
    const sortContainer = document.querySelector('.sort-container'); // Get sort container

    if (user) {
        // Show elements relevant when logged in
        profileButton.style.display = "flex";
        searchBar.style.display = 'flex';
        refreshButton.style.display = 'flex';
        if (sortContainer) sortContainer.style.display = 'block'; // Show sort container

        try {
            const hasCachedData = localStorage.getItem('dataSheet') && localStorage.getItem('permissionRows');
            let needsRender = false;
            if (!hasCachedData) {
                console.log("Auth confirmed, NO cached data. Forcing fetch...");
                await loadDataIntoLocalStorage(true);
                needsRender = true;
            } else {
                console.log("Auth confirmed, cached data found.");
                if (!initialRenderDone) {
                    console.log("Initial render wasn't done, rendering now.");
                    needsRender = true;
                } else { console.log("Initial render already done."); }
            }
            if (needsRender) { handleUrlHash(); initialRenderDone = true; }
            preloadAllItemImages();
        } catch (error) {
            console.error("Error during initial data fetch/setup:", error);
            if (mainContent) mainContent.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error loading initial data. Please refresh.</p>';
            initialRenderDone = true;
        }
    } else {
        // User is signed out. Hide elements, redirect.
        profileButton.style.display = "none";
        searchBar.style.display = 'none';
        refreshButton.style.display = 'none';
        if (sortContainer) sortContainer.style.display = 'none'; // Hide sort container
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (sortDropdown) sortDropdown.style.display = 'none'; // Ensure sort dropdown is hidden
        document.body.classList.remove('is-detail-active');
        if (window.location.pathname !== '/signin.html' && window.location.pathname !== '/NABLED-2/signin.html') {
            if (window.location.hash) { history.replaceState({ view: 'categories', filter: null }, '', window.location.pathname); }
            window.location.href = "signin.html";
        }
    }
});

// --- Data Loading ---
async function loadDataIntoLocalStorage(forceRefresh = false) {
    let dataChanged = false;
    try {
        if (forceRefresh) {
            console.log("Forcing refresh: Fetching data...");
            const cacheBuster = `&_=${Date.now()}`;
            const [dataResponse, permissionsResponse] = await Promise.all([
                fetch(`${sheetUrl}${cacheBuster}`, { cache: 'reload' }),
                fetch(`${permissionsSheetUrl}${cacheBuster}`, { cache: 'reload' })
            ]);
            if (!dataResponse.ok || !permissionsResponse.ok) throw new Error(`HTTP error!`);
            const [dataCsvText, permissionsCsvText] = await Promise.all([dataResponse.text(), permissionsResponse.text()]);
            const dataRows = parseCSV(dataCsvText);
            const permissionRows = parseCSV(permissionsCsvText);
            if (!dataRows?.length) throw new Error("Fetched data empty.");
            if (!permissionRows?.length) throw new Error("Fetched permissions empty.");
            const newDataString = JSON.stringify({ data: dataRows });
            const newPermsString = JSON.stringify({ data: permissionRows });
            const currentData = localStorage.getItem('dataSheet');
            const currentPerms = localStorage.getItem('permissionRows');
            if (newDataString !== currentData || newPermsString !== currentPerms) {
                localStorage.setItem('dataSheet', newDataString);
                localStorage.setItem('permissionRows', newPermsString);
                console.log("New data fetched and stored."); dataChanged = true;
            } else { console.log("Fetched data same as cached."); }
        } else { console.log("Checked localStorage (background check)."); }
    } catch (error) { console.error("Error in loadDataIntoLocalStorage:", error); throw error; }
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
    const cachedDataString = localStorage.getItem('dataSheet'); if (!cachedDataString) return [];
    try {
        const { data } = JSON.parse(cachedDataString); if (!data || data.length < 2) return [];
        const categories = new Set();
        for (let i = 1; i < data.length; i++) { if (data[i]?.[1]?.trim()) categories.add(data[i][1].trim()); }
        return [...categories].sort();
    } catch (error) { console.error("Error parsing categories:", error); return []; }
}

// --- Find Item By ID ---
function findItemById(items, itemId) {
    if (!items || !itemId) return null;
    // Ensure comparison is string-based if needed, or handle types consistently
    const searchId = String(itemId).trim();
    // Assuming 'items' includes the header row, start loop from 1
    for (let i = 1; i < items.length; i++) {
        if (items[i]?.[0] && String(items[i][0]).trim() === searchId) {
            return items[i];
        }
    }
    return null;
}

// --- Get and Sort Items ---
function getSortedItems(filterCategory = null) {
    const cachedDataString = localStorage.getItem('dataSheet');
    if (!cachedDataString) return []; // Return empty array if no data

    try {
        const { data: dataRows } = JSON.parse(cachedDataString);
        if (!dataRows || dataRows.length < 2) return []; // No items to sort

        let itemsToDisplay = dataRows.slice(1); // Get all items (excluding header)

        // 1. Filter items if a category is specified
        if (filterCategory) {
            itemsToDisplay = itemsToDisplay.filter(item => (item[1]?.trim() || '') === filterCategory);
        }

        // 2. Sort the filtered items based on currentSortBy and currentSortDirection
        console.log(`Sorting items by: ${currentSortBy}, Direction: ${currentSortDirection}`);

        if (currentSortBy !== 'default') {
            itemsToDisplay.sort((a, b) => {
                let valA, valB;

                switch (currentSortBy) {
                    case 'name':
                        // Sort by Name (Column index 2) - Case-insensitive string comparison
                        valA = (a[2] || '').trim().toLowerCase();
                        valB = (b[2] || '').trim().toLowerCase();
                        return valA.localeCompare(valB, 'ar'); // Arabic locale comparison
                    case 'category':
                        // Sort by Category (Column index 1) - Case-insensitive string comparison
                        valA = (a[1] || '').trim().toLowerCase();
                        valB = (b[1] || '').trim().toLowerCase();
                        return valA.localeCompare(valB, 'ar'); // Arabic locale comparison
                    case 'code':
                        // Sort by Item Code (Column index 0) - NUMERIC comparison
                        // Attempt to parse as float, default to 0 or a large number if invalid
                        valA = parseFloat(String(a[0] || '').trim());
                        valB = parseFloat(String(b[0] || '').trim());
                        // Handle NaN (Not a Number) - place them consistently (e.g., at the end)
                        if (isNaN(valA) && isNaN(valB)) return 0;
                        if (isNaN(valA)) return 1; // Put NaN valA after valid valB
                        if (isNaN(valB)) return -1; // Put NaN valB after valid valA
                        return valA - valB; // Numeric subtraction for sorting
                    default:
                        return 0; // Should not happen if 'default' is handled, but good practice
                }
            });

            // Apply direction
            if (currentSortDirection === 'desc') {
                itemsToDisplay.reverse();
            }
        }
        // 'default' order requires no sorting after filtering

        return itemsToDisplay; // Return the sorted (and potentially filtered) array

    } catch (error) {
        console.error("Error getting or sorting items:", error);
        return []; // Return empty on error
    }
}


// --- Display Items (Renders PRE-SORTED items) ---
function displayItems(itemsToRender, filterCategory = null) { // Now accepts sorted items
    if (!itemsList) return;
    itemsList.innerHTML = ''; // Clear previous content immediately

    if (!itemsToRender || itemsToRender.length === 0) {
        itemsList.innerHTML = filterCategory
            ? `<p>لا توجد عناصر في الفئة "${filterCategory}".</p>`
            : '<p>لا توجد عناصر لعرضها.</p>';
        return;
    }

    try {
        let itemsFound = false;
        const fragment = document.createDocumentFragment();
        itemsToRender.forEach(item => {
            if (!Array.isArray(item) || item.length < 3) return; // Basic check

            itemsFound = true;
            const itemId = String(item[0] || '').trim();
            const itemName = String(item[2] || 'No Name').trim();
            const realImageSrc = [item[4], item[5], item[6]].map(img => img?.trim() || null).find(img => img);
            const placeholderSrc = "placeholder.png"; // Define placeholder

            const itemDiv = document.createElement('div'); itemDiv.className = 'item-container';
            const clickableElement = document.createElement('button'); clickableElement.className = 'item-row';
            clickableElement.dataset.itemId = itemId; clickableElement.setAttribute('aria-label', `View details for ${itemName}`);

            const img = document.createElement('img');
            img.src = placeholderSrc; // Start with placeholder
            img.alt = itemName;
            img.className = 'list-image';
            img.loading = "lazy";
            img.onerror = () => { img.src = placeholderSrc; }; // Fallback to placeholder on error

            if (realImageSrc) {
                img.dataset.realSrc = realImageSrc;
                // Use Intersection Observer or simple load event for lazy loading appearance
                const imageLoader = new Image();
                imageLoader.onload = () => { if (img.dataset.realSrc === realImageSrc) img.src = realImageSrc; };
                imageLoader.onerror = () => { console.warn(`Failed image load: ${realImageSrc}`); img.src = placeholderSrc; }; // Ensure fallback
                imageLoader.src = realImageSrc;
            }

            clickableElement.appendChild(img);
            const codeDiv = document.createElement('div'); codeDiv.className = 'item-code'; codeDiv.textContent = itemId; clickableElement.appendChild(codeDiv);
            const descDiv = document.createElement('div'); descDiv.className = 'item-description'; descDiv.textContent = itemName; clickableElement.appendChild(descDiv);
            clickableElement.addEventListener('click', (e) => {
                e.preventDefault(); clickableElement.classList.add('item-clicked');
                setTimeout(() => clickableElement.classList.remove('item-clicked'), 300); showItemDetailView(itemId);
            });
            itemDiv.appendChild(clickableElement); fragment.appendChild(itemDiv);
        });

        if (itemsFound) {
            itemsList.appendChild(fragment);
            // Re-apply search filter if necessary after rendering sorted items
            if (searchInput.value) {
                filterDisplayedItems(searchInput.value);
            }
        } else {
            // This case should be handled by the initial check, but as a fallback:
             itemsList.innerHTML = filterCategory
                 ? `<p>لا توجد عناصر في الفئة "${filterCategory}".</p>`
                 : '<p>لا توجد عناصر لعرضها.</p>';
        }
    } catch (error) {
        itemsList.innerHTML = '<p>حدث خطأ أثناء عرض بيانات العنصر.</p>';
        console.error("DisplayItems rendering error:", error);
    }
}


// --- Display Category Buttons ---
function displayCategoryButtons() {
    if (!actualButtonList) return; actualButtonList.innerHTML = '<p>Loading categories...</p>';
    const cachedDataString = localStorage.getItem('dataSheet'); if (!cachedDataString) { actualButtonList.innerHTML = '<p>No data available.</p>'; return; }
    try {
        const categories = getUniqueCategories(); if (categories.length === 0) { actualButtonList.innerHTML = '<p>No categories found.</p>'; return; }
        actualButtonList.innerHTML = ''; const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            const button = document.createElement('button'); button.textContent = category; button.className = 'category-button';
            button.addEventListener('click', (e) => { e.preventDefault(); showItemsByCategory(category, false); });
            fragment.appendChild(button);
        });
        actualButtonList.appendChild(fragment);
    } catch (error) { console.error("Error displaying categories:", error); actualButtonList.innerHTML = '<p>Error loading categories.</p>'; }
}

// --- Preload All Item Images ---
function preloadAllItemImages() {
    console.log("Starting image preloading..."); const cachedDataString = localStorage.getItem('dataSheet');
    if (!cachedDataString) { console.warn("Preload: No data."); return; }
    try {
        const { data: dataRows } = JSON.parse(cachedDataString); if (!dataRows) { console.warn("Preload: Invalid data."); return; }
        const uniqueImageUrls = new Set();
        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i]; if (!Array.isArray(item) || item.length < 7) continue;
            [item[4], item[5], item[6]].forEach(url => { if (url?.trim()) uniqueImageUrls.add(url.trim()); });
        }
        console.log(`Preloading ${uniqueImageUrls.size} unique images...`);
        uniqueImageUrls.forEach(url => { (new Image()).src = url; });
    } catch (error) { console.error("Error during image preloading:", error); }
}


// --- View Switching & History Management ---
function updateViewClasses(activeViewId) {
    const views = [categoryButtonsContainer, itemsListContainer, itemDetailView];
    const isDetail = activeViewId === 'item-detail-view';
    document.body.classList.toggle('is-detail-active', isDetail); // This line controls visibility via CSS

    // Store scroll position *before* changing classes if leaving items list
    if (itemsListContainer && itemsListContainer.classList.contains('view-active') && activeViewId !== 'items-list-container') {
        itemsListScrollPos = itemsListContainer.scrollTop;
        console.log(`Stored scroll: ${itemsListScrollPos}`);
    }

    views.forEach(view => {
        if (!view) return;
        const isActive = view.id === activeViewId;
        view.classList.toggle('view-active', isActive); // Set the active view

        // --- CORRECTED RTL POSITIONING LOGIC ---
        let isLeft = false;  // Should have transform: translateX(-100%)
        let isRight = false; // Should have transform: translateX(100%)

        if (!isActive) {
            // Determine position relative to the *active* view in RTL flow
            if (activeViewId === 'category-buttons-container') {
                // When Categories is active (rightmost), Items and Detail are to its left
                isLeft = (view.id === 'items-list-container' || view.id === 'item-detail-view');
            } else if (activeViewId === 'items-list-container') {
                // When Items is active (middle), Categories is to its right, Detail is to its left
                isRight = (view.id === 'category-buttons-container');
                isLeft = (view.id === 'item-detail-view');
            } else if (activeViewId === 'item-detail-view') {
                // When Detail is active (leftmost), Categories and Items are to its right
                isRight = (view.id === 'category-buttons-container' || view.id === 'items-list-container');
            }
        }

        // Apply the classes based on the calculated positions
        view.classList.toggle('view-left', isLeft);
        view.classList.toggle('view-right', isRight);
        // --- END OF CORRECTION ---

        // Scroll restoration/reset is handled in the show... functions
    });

    // Update tab bar state only if not in detail view
    if (!isDetail) {
        categoriesTab.classList.toggle('active', activeViewId === 'category-buttons-container');
        itemsTab.classList.toggle('active', activeViewId === 'items-list-container');
        categoriesTab.setAttribute('aria-selected', activeViewId === 'category-buttons-container');
        itemsTab.setAttribute('aria-selected', activeViewId === 'items-list-container');
    } else {
        // Ensure tabs are not active when detail view is shown
        categoriesTab.classList.remove('active');
        itemsTab.classList.remove('active');
        categoriesTab.setAttribute('aria-selected', 'false');
        itemsTab.setAttribute('aria-selected', 'false');
    }

    console.log(`UI Updated. Active view: ${activeViewId}`);
}


function showCategoriesViewUI() {
    if (!categoryButtonsContainer) return; console.log(`UI: Categories View`);
    updateViewClasses('category-buttons-container'); displayCategoryButtons();
    lastListViewState = { view: 'categories', filter: null };
}

function showAllItemsViewUI(isPopState = false, restoreScroll = true) { // Added restoreScroll flag
    if (!itemsListContainer || !itemsListTitle) return; console.log(`UI: All Items View`);
    itemsListTitle.textContent = 'جميع العناصر'; updateViewClasses('items-list-container');

    const sortedItems = getSortedItems(null); // Get sorted items with null filter
    displayItems(sortedItems, null); // Display the pre-sorted items

    if (restoreScroll) {
        requestAnimationFrame(() => {
            if (itemsListContainer) {
                 itemsListContainer.scrollTop = itemsListScrollPos;
                 console.log(`Restored scroll: ${itemsListScrollPos}`);
            }
        });
    } else {
         if (itemsListContainer) itemsListContainer.scrollTop = 0; // Scroll to top if not restoring
         itemsListScrollPos = 0; // Reset stored position
         console.log("Scrolled to top for new item view.");
    }


    lastListViewState = { view: 'items', filter: null };
    const newState = { view: 'items', filter: null }; const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.filter === newState.filter);
    if (!isPopState && stateChanged) { console.log(`Pushing state: all items`); history.pushState(newState, '', '#items'); }
}

function showItemsByCategory(categoryName, isPopState = false, restoreScroll = true) { // Added restoreScroll flag
    if (!itemsListContainer || !itemsListTitle) return; console.log(`UI: Items by Category "${categoryName}"`);
    itemsListTitle.textContent = categoryName; updateViewClasses('items-list-container');

    const sortedItems = getSortedItems(categoryName); // Get sorted items for this category
    displayItems(sortedItems, categoryName); // Display the pre-sorted items

     if (restoreScroll) {
        requestAnimationFrame(() => {
            if (itemsListContainer) {
                itemsListContainer.scrollTop = itemsListScrollPos;
                console.log(`Restored scroll: ${itemsListScrollPos}`);
            }
        });
    } else {
         if (itemsListContainer) itemsListContainer.scrollTop = 0; // Scroll to top if not restoring
         itemsListScrollPos = 0; // Reset stored position
         console.log("Scrolled to top for new category view.");
    }


    lastListViewState = { view: 'items', filter: categoryName };
    const newState = { view: 'items', filter: categoryName }; const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.filter === newState.filter);
    if (!isPopState && stateChanged) { console.log(`Pushing state: ${categoryName}`); history.pushState(newState, '', `#items/${encodeURIComponent(categoryName)}`); }
}


function showItemDetailView(itemId, isPopState = false) {
    if (!itemDetailView || !itemDetailsContent || !auth.currentUser) { console.error("Detail view elements/user missing."); return; }
    console.log(`UI: Detail View ID "${itemId}"`);

    const cachedData = JSON.parse(localStorage.getItem('dataSheet')); const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));
    if (!cachedData?.data || !cachedPermission?.data) { itemDetailsContent.innerHTML = '<p>Error: Item data missing.</p>'; updateViewClasses('item-detail-view'); return; }

    const dataRows = cachedData.data; const permissionRows = cachedPermission.data;
    const item = findItemById(dataRows, itemId); // Use findItemById, passing the full dataRows

    if (!item) { itemDetailsContent.innerHTML = `<p>Error: Item ID ${itemId} not found.</p>`; updateViewClasses('item-detail-view'); return; }

    const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
    const visiblePriceColumns = userPermissions ? userPermissions.slice(2).map((val, index) => (val === '1' ? index + 8 : -1)).filter(val => val !== -1) : [];

    itemDetailsContent.innerHTML = renderItemDetailsHTML(item, visiblePriceColumns, dataRows[0]); // Pass header row (dataRows[0])
    addCarouselFunctionality('#item-detail-view'); // Add carousel logic (now reverted)
    updateViewClasses('item-detail-view');
    requestAnimationFrame(() => { // Ensure scroll reset happens after render
         if(itemDetailView) itemDetailView.scrollTop = 0;
    });


    const newState = { view: 'detail', itemId: itemId }; const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.itemId === newState.itemId);
    if (!isPopState && stateChanged) { console.log(`Pushing state: detail ${itemId}`); history.pushState(newState, '', `#detail/${itemId}`); }
}


// Render Item Details HTML - MODIFIED
function renderItemDetailsHTML(item, visiblePriceColumnIndices, columnNames) {
    if (!item || !columnNames) return '<p>Error rendering item details.</p>';
    let html = '';
    const images = [item[4], item[5], item[6]].filter(Boolean).map(url => url.trim()); // Ensure URLs are trimmed
    const placeholder = 'placeholder.png';
    const hasImages = images.length > 0;

    // --- Carousel Section ---
    html += `<div class="carousel-container"><div class="slides-wrapper">`; // Carousel start
    if (hasImages) {
        images.forEach((src, index) => {
            html += `<div class="slide ${index === 0 ? 'active' : ''}" data-src="${src}"><img src="${placeholder}" alt="${item[2] || 'Product Image'}" class="carousel-image" onerror="this.onerror=null; this.src='${placeholder}';"></div>`;
        });
    } else {
        html += `<div class="slide active" data-src="${placeholder}"><img src="${placeholder}" alt="Placeholder" class="carousel-image"></div>`;
    }
    html += `</div>`; // End slides-wrapper
    if (images.length > 1) {
        html += `<div class="carousel-dots">`;
        images.forEach((_, i) => {
            html += `<span class="dot ${i === 0 ? 'active' : ''}" data-slide-index="${i}"></span>`;
        });
        html += `</div>`; // End carousel-dots
    }
    html += `</div>`; // End carousel-container

    // --- Text Details Section (NEW WRAPPER ADDED) ---
    html += `<div class="item-text-details">`; // Start of new wrapper

    html += `<h2>${item[2] || ""}</h2><br>`; // Name
    html += `<p>${columnNames[0] || "ID"} <br><strong>${item[0] || ""}</strong></p>`; // ID
    if (item[3]) html += `<p>${columnNames[3] || "Specs"} <br><strong>${item[3]}</strong></p>`; // Specs
    if (item[7]) html += `<p><a href="${item[7]}" target="_blank" rel="noopener noreferrer">${columnNames[7] || "Catalog"}</a></p>`; // Catalog

    // --- Price Section (moved inside the new wrapper) ---
    html += `<div class="price-section">`; // Price section start
    visiblePriceColumnIndices.forEach(index => {
        if (index < item.length && item[index] != null && String(item[index]).trim() !== '') { // Check for non-empty string
            const key = columnNames[index] || `Price ${index + 1}`; const value = item[index];
            html += `<div class="price-item"><span class="price-label">${key}</span><div class="price-value-line"><strong>${value}</strong><img src="Saudi_Riyal_Symbol-2.svg" class="currency-symbol" alt="SAR" onerror="this.style.display='none'"></div></div>`;
        }
    });
    html += `</div><br>`; // Price section end

    html += `</div>`; // End of new wrapper: item-text-details

    return html;
}


// Carousel Functionality (REVERTED to Original User-Provided Logic)
function addCarouselFunctionality(parentSelector) {
    const container = document.querySelector(parentSelector);
    if (!container) { console.warn("Carousel container not found:", parentSelector); return; }
    let currentSlide = 0;
    const slides = container.querySelectorAll('.slide');
    const dots = container.querySelectorAll('.dot');
    const slidesWrapper = container.querySelector('.slides-wrapper');
    if (!slides.length || !slidesWrapper) return;

    // Image Loading
    slides.forEach(slide => {
        const img = slide.querySelector('img'); const realSrc = slide.dataset.src;
        if (img && realSrc && realSrc !== 'placeholder.png') {
            const realImageLoader = new Image();
            realImageLoader.onload = () => { img.src = realSrc; };
            realImageLoader.onerror = () => console.warn(`Failed carousel image: ${realSrc}`);
            realImageLoader.src = realSrc;
        } else if (img) { img.src = realSrc || 'placeholder.png'; }
    });

    // Inner function to show slide
    function showSlide(index) {
        if (slides.length <= 1) return;
        index = (index + slides.length) % slides.length;
        // Apply transform based on index (RTL - positive translateX moves right)
        // Original logic used positive translateX for RTL
        slidesWrapper.style.transform = `translateX(${index * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
        currentSlide = index;
    }

    // Dot navigation
    dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i)));

    // Swipe support for Carousel (REVERTED to user's original logic)
    let touchStartX = 0;
    slidesWrapper.addEventListener('touchstart', e => { if (slides.length > 1) touchStartX = e.touches[0].clientX; }, { passive: true });
    slidesWrapper.addEventListener('touchend', e => {
        if (slides.length <= 1 || touchStartX === 0) return;
        const touchEndX = e.changedTouches[0].clientX; const diff = touchEndX - touchStartX;
        // Original Logic (assuming this was correct for user):
        // Swipe Left (R->L, negative diff) -> Previous
        // Swipe Right (L->R, positive diff) -> Next
        if (diff < -50) { // Swipe Left (R->L) -> Previous (User's Original)
             console.log("Carousel Swipe Left (R->L) -> Previous");
             showSlide(currentSlide - 1);
        } else if (diff > 50) { // Swipe Right (L->R) -> Next (User's Original)
             console.log("Carousel Swipe Right (L->R) -> Next");
             showSlide(currentSlide + 1);
        }
        touchStartX = 0;
    }, { passive: true });

    showSlide(0); // Initialize
    console.log("Carousel functionality (reverted swipe) added.");
}


// --- Popstate Event Handler ---
function handlePopState(event) {
    console.log("popstate event fired. State:", event.state); const state = event.state;
    // Close dropdowns on navigation
    if (profileDropdown) profileDropdown.style.display = 'none';
    if (sortDropdown) sortDropdown.style.display = 'none';

    if (!state || state.view === 'categories') { showCategoriesViewUI(); }
    else if (state.view === 'items') {
        // When navigating back/forward to an items view, restore scroll position
        if (state.filter) showItemsByCategory(state.filter, true, true);
        else showAllItemsViewUI(true, true);
    }
    else if (state.view === 'detail') { if (state.itemId) showItemDetailView(state.itemId, true); else { console.warn("Popstate: Detail state missing ID."); showCategoriesViewUI(); } }
    else { console.warn("Popstate: Unknown state.", state); showCategoriesViewUI(); }
}
window.addEventListener('popstate', handlePopState);

// --- Handle Initial URL Hash ---
function handleUrlHash() {
    const hash = window.location.hash; console.log("Handling initial hash:", hash);
    let initialState = { view: 'categories', filter: null }; let targetHash = '#categories';

    if (hash.startsWith('#detail/')) { const itemId = decodeURIComponent(hash.substring(8)); initialState = { view: 'detail', itemId: itemId }; targetHash = `#detail/${encodeURIComponent(itemId)}`; showItemDetailView(itemId, true); }
    else if (hash.startsWith('#items/')) { const category = decodeURIComponent(hash.substring(7)); initialState = { view: 'items', filter: category }; targetHash = `#items/${encodeURIComponent(category)}`; showItemsByCategory(category, true, false); } // Don't restore scroll on initial load
    else if (hash === '#items') { initialState = { view: 'items', filter: null }; targetHash = '#items'; showAllItemsViewUI(true, false); } // Don't restore scroll on initial load
    else { initialState = { view: 'categories', filter: null }; targetHash = '#categories'; showCategoriesViewUI(); }

    console.log("Replacing initial state:", initialState); history.replaceState(initialState, '', targetHash);
}

// --- Refresh Button Logic ---
function setupRefreshButton() {
    refreshButton.addEventListener("click", async function() {
        const button = this; console.log("Refresh button clicked"); button.disabled = true; button.classList.add('loading');
        // Close dropdowns on refresh
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (sortDropdown) sortDropdown.style.display = 'none';

        const currentState = history.state || { view: 'categories', filter: null };
        try {
            const dataWasRefreshed = await loadDataIntoLocalStorage(true); console.log("Refresh fetch complete. Data changed:", dataWasRefreshed);
            console.log("Refresh complete, restoring view for state:", currentState);

            // Re-render the current view - don't restore scroll after refresh
            if (currentState.view === 'categories') showCategoriesViewUI();
            else if (currentState.view === 'items') {
                if (currentState.filter) showItemsByCategory(currentState.filter, true, false);
                else showAllItemsViewUI(true, false);
            }
            else if (currentState.view === 'detail') {
                if (currentState.itemId) showItemDetailView(currentState.itemId, true);
                else showCategoriesViewUI(); // Fallback if detail ID is lost
            }
            else showCategoriesViewUI(); // Default fallback

            if (dataWasRefreshed) preloadAllItemImages();
        } catch (error) {
            console.error("Error during refresh:", error);
            // Display error within the current view context if possible
            if (currentState.view === 'categories' && actualButtonList) actualButtonList.innerHTML = '<p>Error refreshing data.</p>';
            else if (currentState.view === 'items' && itemsList) itemsList.innerHTML = '<p>Error refreshing data.</p>';
            else if (currentState.view === 'detail' && itemDetailsContent) itemDetailsContent.innerHTML = '<p>Error refreshing data.</p>';
            else showCategoriesViewUI(); // Fallback error display
        } finally { button.disabled = false; button.classList.remove('loading'); console.log("Refresh attempt complete."); }
    });
}


// --- Search Functionality ---
function setupSearch() {
    if (!searchInput || !clearSearchButton) return;

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value; clearSearchButton.style.display = searchTerm ? 'block' : 'none';
        const currentView = history.state?.view;

        // If searching from categories or detail, switch to 'all items' view first
        if ((currentView === 'categories' || currentView === 'detail') && searchTerm) {
             console.log(`Search from ${currentView}, switching to All Items.`); const newState = { view: 'items', filter: null };
             // Use pushState to allow going back to the previous view
             history.pushState(newState, '', '#items');
             showAllItemsViewUI(false, false); // Show all items (sorted), don't restore scroll
             // Apply filtering *after* the view has rendered
             requestAnimationFrame(() => filterDisplayedItems(searchTerm));
             return;
        }

        // If already in items view, just filter
        if (currentView === 'items') filterDisplayedItems(searchTerm);
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = ''; clearSearchButton.style.display = 'none';
        // Trigger the input event to re-filter (showing all items)
        searchInput.dispatchEvent(new Event('input', { bubbles: true })); searchInput.focus();
    });
}

function filterDisplayedItems(searchTerm) {
    const term = searchTerm.toLowerCase().trim(); const currentItemsList = document.getElementById('items-list'); if (!currentItemsList) return;
    const itemElements = currentItemsList.querySelectorAll('.item-container'); let visibleCount = 0; let noResultsMsg = currentItemsList.querySelector('.no-search-results');

    itemElements.forEach(itemElement => {
        const itemButton = itemElement.querySelector('button.item-row'); if (!itemButton) return;
        const itemCode = (itemButton.querySelector('.item-code')?.textContent || '').toLowerCase();
        const itemDescription = (itemButton.querySelector('.item-description')?.textContent || '').toLowerCase();
        const isMatch = term === '' || itemCode.includes(term) || itemDescription.includes(term);
        itemElement.style.display = isMatch ? 'block' : 'none'; if (isMatch) visibleCount++;
    });

    // Manage the "no results" message
    if (visibleCount === 0 && term !== '') {
        if (!noResultsMsg) { noResultsMsg = document.createElement('p'); noResultsMsg.className = 'no-search-results'; currentItemsList.appendChild(noResultsMsg); }
        noResultsMsg.textContent = `لا توجد عناصر تطابق "${searchTerm}".`; noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) { noResultsMsg.style.display = 'none'; } // Hide message if there are results or search is empty
}


// --- Profile Menu Setup ---
function setupProfileMenu() {
    if (!profileButton || !profileDropdown) return;

    profileButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent click from closing menu immediately
        // Hide sort dropdown if open
        if (sortDropdown) sortDropdown.style.display = 'none';

        const isVisible = profileDropdown.style.display === 'block';
        profileDropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) { // If opening the dropdown
            const user = auth.currentUser;
            if (user) {
                userEmailDisplay.textContent = user.email; userEmailDisplay.title = user.email; let jobTitle = "ضيف";
                const permissionsDataString = localStorage.getItem('permissionRows');
                if (permissionsDataString) {
                    try {
                        const { data: permissionsData } = JSON.parse(permissionsDataString); const userPermissionRow = getUserPermissions(permissionsData, user.email);
                        if (userPermissionRow?.[1]?.trim()) jobTitle = userPermissionRow[1].trim();
                    } catch (e) { console.error("Error parsing permissions", e); jobTitle = "Error"; }
                }
                userJobTitleDisplay.textContent = jobTitle; userJobTitleDisplay.style.display = 'block'; dropdownSignOutButton.style.display = 'block';
            } else {
                 // Handle case where user might somehow not be available
                 userEmailDisplay.textContent = "غير مسجل الدخول";
                 userJobTitleDisplay.style.display = 'none';
                 dropdownSignOutButton.style.display = 'none';
            }
        }
    });

    dropdownSignOutButton.addEventListener('click', signOut);

    // Close dropdown if clicking outside
    document.addEventListener('click', (event) => {
        if (profileDropdown.style.display === 'block' && !profileButton.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.style.display = 'none';
        }
    });
     console.log("Profile menu listener added.");
}


// --- Setup Back Button Listener ---
function setupBackButton() {
    if (!backButton) return; backButton.addEventListener('click', (e) => { e.preventDefault(); console.log("Back button clicked"); history.back(); });
}

// --- Tab Event Listeners ---
function setupTabNav() {
    if (!categoriesTab || !itemsTab) { console.error("Tab elements missing."); return; }

    categoriesTab.addEventListener('click', (e) => {
        e.preventDefault();
        // Only navigate if not already on categories view
        if (!categoriesTab.classList.contains('active')) {
            const newState = { view: 'categories', filter: null };
            console.log("Tab Click (Categories): Replacing state");
            // Use replaceState when switching between main list views via tabs
            history.replaceState(newState, '', '#categories');
            showCategoriesViewUI();
        }
    });

    // --- UPDATED Items Tab Logic ---
    itemsTab.addEventListener('click', (e) => {
        e.preventDefault();
        const currentState = history.state || { view: 'categories', filter: null };

        // Check if we are already on the "All Items" view (Items view with no category filter)
        const isAlreadyOnAllItems = currentState.view === 'items' && currentState.filter === null;

        if (isAlreadyOnAllItems) {
            // Already on All Items, just scroll to top
            console.log("Tab Click (Items): Already on All Items view. Scrolling top.");
            if (itemsListContainer) {
                itemsListContainer.scrollTo({ top: 0, behavior: 'smooth' }); // Smooth scroll to top
            }
        } else {
            // Not on All Items view (could be Categories or Items with a filter), so switch to it
            const newState = { view: 'items', filter: null };
            console.log("Tab Click (Items): Switching to All Items view.");
            // Use replaceState to avoid adding extra history when just switching main views
            history.replaceState(newState, '', '#items');
            // Show all items, don't restore previous scroll (scrolls to top by default)
            showAllItemsViewUI(false, false);
        }
    });
    // --- END OF UPDATE ---

    console.log("Tab listeners added.");
}


// --- Sort Button and Dropdown Logic ---
function setupSortButtonAndDropdown() {
    if (!sortButton || !sortDropdown || !applySortButton) return;

    // --- Toggle Dropdown Visibility ---
    sortButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent click from closing menu immediately
        // Hide profile dropdown if open
        if (profileDropdown) profileDropdown.style.display = 'none';

        const isVisible = sortDropdown.style.display === 'block';
        sortDropdown.style.display = isVisible ? 'none' : 'block';

        // Update radio buttons to reflect current state when opening
        if (!isVisible) {
            document.querySelector(`input[name="sortDirection"][value="${currentSortDirection}"]`).checked = true;
            document.querySelector(`input[name="sortBy"][value="${currentSortBy}"]`).checked = true;
        }
    });

    // --- Apply Sort Button ---
    applySortButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Apply sort button clicked");

        // Get selected values from radio buttons
        const selectedDirection = document.querySelector('input[name="sortDirection"]:checked')?.value || 'asc';
        const selectedSortBy = document.querySelector('input[name="sortBy"]:checked')?.value || 'default';

        // Update state variables
        currentSortDirection = selectedDirection;
        currentSortBy = selectedSortBy;

        console.log(`Applying sort - By: ${currentSortBy}, Direction: ${currentSortDirection}`);

        // Close the dropdown
        sortDropdown.style.display = 'none';

        // Re-render the current items list view if it's active
        const currentState = history.state || { view: 'categories', filter: null };
        if (currentState.view === 'items') {
            console.log(`Re-rendering items list with new sort order. Filter: ${currentState.filter}`);
            // Re-call the appropriate display function. Pass false for restoreScroll to scroll to top.
            if (currentState.filter) {
                showItemsByCategory(currentState.filter, true, false); // Pass true for isPopState to avoid history push
            } else {
                showAllItemsViewUI(true, false); // Pass true for isPopState
            }
        } else {
            console.log("Sort applied, but items view is not active. Will apply when items view is shown.");
            // No immediate visual change needed, but the state is updated for next time
        }
    });

    // --- Close Dropdown on Outside Click ---
    document.addEventListener('click', (event) => {
        if (sortDropdown.style.display === 'block' && !sortButton.contains(event.target) && !sortDropdown.contains(event.target)) {
            sortDropdown.style.display = 'none';
        }
    });

    console.log("Sort button and dropdown listeners added.");
}


// --- Swipe Gesture Handling (REVERTED to Original User-Provided Logic) ---
function setupSwipeGestures() {
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
    let isSwiping = false;
    const swipeThreshold = 50, maxVerticalThreshold = 75;
    if (!viewWrapper) { console.error("View wrapper missing."); return; }

    viewWrapper.addEventListener('touchstart', (event) => {
        // Disable view swipe if detail view is active
        if (document.body.classList.contains('is-detail-active')) { isSwiping = false; return; }
        // Block swipe if starting on specific interactive elements
        const swipeTarget = event.target; let blockSwipe = false;
        // Allow swiping unless target is input, non-item link, non-item button, or carousel dot
        if (swipeTarget.closest('input, a:not(.item-row):not(.category-button), button:not(.item-row):not(.category-button), .dot')) {
             blockSwipe = true;
        }
        // Explicitly allow swipe if target is the view wrapper itself or the direct list containers
        if (swipeTarget === viewWrapper || swipeTarget === itemsListContainer || swipeTarget === categoryButtonsContainer) {
            blockSwipe = false;
        }

        if (blockSwipe) { isSwiping = false; return; }
        // Initialize swipe
        touchStartX = event.changedTouches[0].screenX;
        touchStartY = event.changedTouches[0].screenY;
        isSwiping = true;
    }, { passive: true });

     viewWrapper.addEventListener('touchmove', (event) => {
         if (!isSwiping) return;
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         // If vertical movement is significant and larger than horizontal, cancel swipe
         if (Math.abs(touchEndY - touchStartY) > Math.abs(touchEndX - touchStartX) && Math.abs(touchEndY - touchStartY) > 20) {
             // console.log("Vertical scroll detected, cancelling swipe.");
             isSwiping = false;
         }
     }, { passive: true });

    viewWrapper.addEventListener('touchend', (event) => {
         if (!isSwiping) return;
         isSwiping = false; // Swipe attempt finished
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         handleSwipeGesture(); // Process the swipe
    }, { passive: true });

    function handleSwipeGesture() {
        const deltaX = touchEndX - touchStartX; const deltaY = touchEndY - touchStartY; const absDeltaX = Math.abs(deltaX); const absDeltaY = Math.abs(deltaY);
        touchStartX = touchEndX = touchStartY = touchEndY = 0; // Reset coordinates

        // Check if it's a valid horizontal swipe (more horizontal than vertical, and exceeds threshold)
        if (absDeltaX > swipeThreshold && absDeltaY < maxVerticalThreshold) {
            const currentState = history.state || { view: 'categories', filter: null };
            console.log(`Processing swipe: deltaX=${deltaX.toFixed(0)}, currentState=${currentState.view}`);

            // --- REVERTED RTL Swipe Logic (Based on user's original code) ---
            // Swipe Right (Finger L -> R, positive deltaX): Navigate "forward" (Categories -> Items)
            if (deltaX > 0) {
                 console.log("Swipe Right (L->R) detected - Navigating Forward");
                 if (currentState.view === 'categories') {
                     console.log("Action: Triggering Items Tab (All Items)");
                     if(itemsTab && !itemsTab.classList.contains('active')) itemsTab.click(); // Click only if not active
                 } else { console.log("Action: No swipe forward action from items."); }
            }
            // Swipe Left (Finger R -> L, negative deltaX): Navigate "backward" (Items -> Categories)
            else if (deltaX < 0) {
                 console.log("Swipe Left (R->L) detected - Navigating Back");
                 if (currentState.view === 'items') {
                     console.log("Action: Triggering Categories Tab");
                     if(categoriesTab && !categoriesTab.classList.contains('active')) categoriesTab.click(); // Click only if not active
                 } else { console.log("Action: No swipe back action from categories."); }
            }
        } else {
             // console.log("Swipe gesture did not meet criteria.");
        }
    }
     console.log("Swipe gestures (Original user logic) setup.");
}


// --- Helper: Get User Permissions ---
function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) return null; userEmail = userEmail.trim().toLowerCase();
    // Start from index 1 to skip header row in permissions sheet
    for (let i = 1; i < permissions.length; i++) {
        if (permissions[i]?.[0]?.trim().toLowerCase() === userEmail) {
            return permissions[i];
        }
    }
    return null; // Return null if no match found
}
