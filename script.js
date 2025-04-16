// Firebase configuration
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
const profileDropdown = document.getElementById('profile-dropdown');
const userEmailDisplay = document.getElementById('user-email-display');
const userJobTitleDisplay = document.getElementById('user-job-title');
const dropdownSignOutButton = document.getElementById('dropdown-sign-out-button');

// --- State Variables ---
let initialRenderDone = false;
let lastListViewState = { view: 'categories', filter: null };
let itemsListScrollPos = 0;

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
    setupSwipeGestures();
    setupBackButton();
    setupTabNav();
    setupRefreshButton();
    console.log("UI Interactions Setup.");
}

// --- Run initial cache check and setup ---
initialRenderDone = tryInitialRenderFromCache();

// --- Authentication State Change ---
auth.onAuthStateChanged(async (user) => {
    console.log("Auth state changed. User:", user ? user.email : 'None');
    const mainContent = document.querySelector('.main-content');
    if (user) {
        profileButton.style.display = "flex";
        searchBar.style.display = 'flex';
        refreshButton.style.display = 'flex';
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
        profileButton.style.display = "none";
        searchBar.style.display = 'none';
        refreshButton.style.display = 'none';
        if (profileDropdown) profileDropdown.style.display = 'none';
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
    for (let i = 1; i < items.length; i++) { if (items[i]?.[0] === itemId) return items[i]; }
    return null;
}

// --- Display Items ---
function displayItems(filterCategory = null) {
    if (!itemsList) return; itemsList.innerHTML = '<p>Loading items...</p>';
    const cachedDataString = localStorage.getItem('dataSheet');
    if (!cachedDataString) { itemsList.innerHTML = '<p>No data available. Please refresh.</p>'; return; }
    try {
        const { data: dataRows } = JSON.parse(cachedDataString); if (!dataRows) throw new Error("Invalid data format");
        let itemsFound = false; const fragment = document.createDocumentFragment();
        for (let i = 1; i < dataRows.length; i++) {
            const item = dataRows[i];
            if (!Array.isArray(item) || item.length < 7 || item.every(cell => !cell || String(cell).trim() === '')) continue;
            const itemCategory = item[1]?.trim() || '';
            if (filterCategory && itemCategory !== filterCategory) continue;
            itemsFound = true; const itemId = String(item[0] || '').trim(); const itemName = String(item[2] || 'No Name').trim();
            const realImageSrc = [item[4], item[5], item[6]].map(img => img?.trim() || null).find(img => img);
            const itemDiv = document.createElement('div'); itemDiv.className = 'item-container';
            const clickableElement = document.createElement('button'); clickableElement.className = 'item-row';
            clickableElement.dataset.itemId = itemId; clickableElement.setAttribute('aria-label', `View details for ${itemName}`);
            const img = document.createElement('img'); img.src = "placeholder.png"; img.alt = itemName; img.className = 'list-image'; img.loading = "lazy";
            if (realImageSrc) {
                img.dataset.realSrc = realImageSrc; const imageLoader = new Image();
                imageLoader.onload = () => { if (img.dataset.realSrc === realImageSrc) img.src = realImageSrc; };
                imageLoader.onerror = () => console.warn(`Failed image load: ${realImageSrc}`); imageLoader.src = realImageSrc;
            }
            clickableElement.appendChild(img);
            const codeDiv = document.createElement('div'); codeDiv.className = 'item-code'; codeDiv.textContent = itemId; clickableElement.appendChild(codeDiv);
            const descDiv = document.createElement('div'); descDiv.className = 'item-description'; descDiv.textContent = itemName; clickableElement.appendChild(descDiv);
            clickableElement.addEventListener('click', (e) => {
                e.preventDefault(); clickableElement.classList.add('item-clicked');
                setTimeout(() => clickableElement.classList.remove('item-clicked'), 300); showItemDetailView(itemId);
            });
            itemDiv.appendChild(clickableElement); fragment.appendChild(itemDiv);
        }
        itemsList.innerHTML = '';
        if (itemsFound) { itemsList.appendChild(fragment); }
        else { itemsList.innerHTML = filterCategory ? `<p>No items found in category "${filterCategory}".</p>` : '<p>No items to display.</p>'; }
    } catch (error) { itemsList.innerHTML = '<p>Error displaying item data.</p>'; console.error("DisplayItems error:", error); }
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
    document.body.classList.toggle('is-detail-active', isDetail);
    if (itemsListContainer.classList.contains('view-active') && activeViewId !== 'items-list-container') {
        itemsListScrollPos = itemsListContainer.scrollTop; console.log(`Stored scroll: ${itemsListScrollPos}`);
    }
    views.forEach(view => {
        if (!view) return; const isActive = view.id === activeViewId; view.classList.toggle('view-active', isActive);
        const isLeft = !isActive && ((activeViewId === 'items-list-container' && view.id === 'item-detail-view') || activeViewId === 'category-buttons-container');
        const isRight = !isActive && ((activeViewId === 'items-list-container' && view.id === 'category-buttons-container') || activeViewId === 'item-detail-view');
        view.classList.toggle('view-left', isLeft); view.classList.toggle('view-right', isRight);
        if (isActive && activeViewId !== 'item-detail-view') view.scrollTop = 0;
    });
    if (!isDetail) {
        categoriesTab.classList.toggle('active', activeViewId === 'category-buttons-container');
        itemsTab.classList.toggle('active', activeViewId === 'items-list-container');
        categoriesTab.setAttribute('aria-selected', activeViewId === 'category-buttons-container');
        itemsTab.setAttribute('aria-selected', activeViewId === 'items-list-container');
    }
    console.log(`UI Updated. Active view: ${activeViewId}`);
}
function showCategoriesViewUI() {
    if (!categoryButtonsContainer) return; console.log(`UI: Categories View`);
    updateViewClasses('category-buttons-container'); displayCategoryButtons();
    lastListViewState = { view: 'categories', filter: null };
}
function showAllItemsViewUI() {
    if (!itemsListContainer || !itemsListTitle) return; console.log(`UI: All Items View`);
    itemsListTitle.textContent = 'جميع العناصر'; updateViewClasses('items-list-container'); displayItems();
    requestAnimationFrame(() => { itemsListContainer.scrollTop = itemsListScrollPos; console.log(`Restored scroll: ${itemsListScrollPos}`); });
    lastListViewState = { view: 'items', filter: null };
}
function showItemsByCategory(categoryName, isPopState = false) {
    if (!itemsListContainer || !itemsListTitle) return; console.log(`UI: Items by Category "${categoryName}"`);
    itemsListTitle.textContent = categoryName; updateViewClasses('items-list-container'); displayItems(categoryName);
    requestAnimationFrame(() => { itemsListContainer.scrollTop = itemsListScrollPos; console.log(`Restored scroll: ${itemsListScrollPos}`); });
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
    const dataRows = cachedData.data; const permissionRows = cachedPermission.data; const item = findItemById(dataRows, itemId);
    if (!item) { itemDetailsContent.innerHTML = `<p>Error: Item ID ${itemId} not found.</p>`; updateViewClasses('item-detail-view'); return; }
    const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
    const visiblePriceColumns = userPermissions ? userPermissions.slice(2).map((val, index) => (val === '1' ? index + 8 : -1)).filter(val => val !== -1) : [];
    itemDetailsContent.innerHTML = renderItemDetailsHTML(item, visiblePriceColumns, dataRows[0]);
    addCarouselFunctionality('#item-detail-view'); updateViewClasses('item-detail-view'); itemDetailView.scrollTop = 0;
    const newState = { view: 'detail', itemId: itemId }; const currentState = history.state;
    const stateChanged = !(currentState?.view === newState.view && currentState?.itemId === newState.itemId);
    if (!isPopState && stateChanged) { console.log(`Pushing state: detail ${itemId}`); history.pushState(newState, '', `#detail/${itemId}`); }
}

// Render Item Details HTML
function renderItemDetailsHTML(item, visiblePriceColumnIndices, columnNames) {
    if (!item || !columnNames) return '<p>Error rendering item details.</p>'; let html = '';
    const images = [item[4], item[5], item[6]].filter(Boolean); const placeholder = 'placeholder.png'; const hasImages = images.length > 0;
    html += `<div class="carousel-container"><div class="slides-wrapper">`; // Carousel start
    if (hasImages) { images.forEach((src, index) => { html += `<div class="slide ${index === 0 ? 'active' : ''}" data-src="${src}"><img src="${placeholder}" alt="${item[2] || 'Product Image'}" class="carousel-image"></div>`; }); }
    else { html += `<div class="slide active" data-src="${placeholder}"><img src="${placeholder}" alt="Placeholder" class="carousel-image"></div>`; }
    html += `</div>`; if (images.length > 1) { html += `<div class="carousel-dots">`; images.forEach((_, i) => { html += `<span class="dot ${i === 0 ? 'active' : ''}" data-slide-index="${i}"></span>`; }); html += `</div>`; } html += `</div>`; // Carousel end
    html += `<h2>${item[2] || ""}</h2><br>`; // Name
    html += `<p>${columnNames[0] || "ID"} <br><strong>${item[0] || ""}</strong></p>`; // ID
    if (item[3]) html += `<p>${columnNames[3] || "Specs"} <br><strong>${item[3]}</strong></p>`; // Specs
    if (item[7]) html += `<p><a href="${item[7]}" target="_blank" rel="noopener noreferrer">${columnNames[7] || "Catalog"}</a></p>`; // Catalog
    html += `<div class="price-section">`; // Price section start
    visiblePriceColumnIndices.forEach(index => {
        if (index < item.length && item[index] != null && item[index] !== '') {
            const key = columnNames[index] || `Price ${index + 1}`; const value = item[index];
            html += `<div class="price-item"><span class="price-label">${key}</span><div class="price-value-line"><strong>${value}</strong><img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol" alt="SAR"></div></div>`;
        }
    });
    html += `</div><br>`; // Price section end
    return html;
}

// Carousel Functionality (Sliding version - LTR SWIPE LOGIC)
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
        // LTR transform: Negative translateX moves left (showing next items)
        slidesWrapper.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
        currentSlide = index;
    }

    // Dot navigation
    dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i)));

    // Swipe support for Carousel (LTR DIRECTION LOGIC)
    let touchStartX = 0;
    slidesWrapper.addEventListener('touchstart', e => { if (slides.length > 1) touchStartX = e.touches[0].clientX; }, { passive: true });
    slidesWrapper.addEventListener('touchend', e => {
        if (slides.length <= 1 || touchStartX === 0) return;
        const touchEndX = e.changedTouches[0].clientX; const diff = touchEndX - touchStartX;
        // LTR: Swipe Left (negative diff) = NEXT; Swipe Right (positive diff) = PREVIOUS
        if (diff < -50) { // Swipe Right (L->R) -> Go to Previous slide
             console.log("Carousel Swipe Right (L->R) -> Previous");
             showSlide(currentSlide - 1);
        } else if (diff > 50) { // Swipe Left (R->L) -> Go to Next slide
             console.log("Carousel Swipe Left (R->L) -> Next");
             showSlide(currentSlide + 1);
        }

        touchStartX = 0; // Reset start position for next swipe
    }, { passive: true });


    showSlide(0); // Initialize
    console.log("Carousel functionality (sliding LTR) added.");
}


// --- Popstate Event Handler ---
function handlePopState(event) {
    console.log("popstate event fired. State:", event.state); const state = event.state;
    if (!state || state.view === 'categories') { showCategoriesViewUI(); }
    else if (state.view === 'items') { if (state.filter) showItemsByCategory(state.filter, true); else showAllItemsViewUI(); }
    else if (state.view === 'detail') { if (state.itemId) showItemDetailView(state.itemId, true); else { console.warn("Popstate: Detail state missing ID."); showCategoriesViewUI(); } }
    else { console.warn("Popstate: Unknown state.", state); showCategoriesViewUI(); }
}
window.addEventListener('popstate', handlePopState);

// --- Handle Initial URL Hash ---
function handleUrlHash() {
    const hash = window.location.hash; console.log("Handling initial hash:", hash);
    let initialState = { view: 'categories', filter: null }; let targetHash = '#categories';
    if (hash.startsWith('#detail/')) { const itemId = decodeURIComponent(hash.substring(8)); initialState = { view: 'detail', itemId: itemId }; targetHash = `#detail/${encodeURIComponent(itemId)}`; showItemDetailView(itemId, true); }
    else if (hash.startsWith('#items/')) { const category = decodeURIComponent(hash.substring(7)); initialState = { view: 'items', filter: category }; targetHash = `#items/${encodeURIComponent(category)}`; showItemsByCategory(category, true); }
    else if (hash === '#items') { initialState = { view: 'items', filter: null }; targetHash = '#items'; showAllItemsViewUI(); }
    else { initialState = { view: 'categories', filter: null }; targetHash = '#categories'; showCategoriesViewUI(); }
    console.log("Replacing initial state:", initialState); history.replaceState(initialState, '', targetHash);
}

// --- Refresh Button Logic ---
function setupRefreshButton() {
    refreshButton.addEventListener("click", async function() {
        const button = this; console.log("Refresh button clicked"); button.disabled = true; button.classList.add('loading');
        const currentState = history.state || { view: 'categories', filter: null };
        try {
            const dataWasRefreshed = await loadDataIntoLocalStorage(true); console.log("Refresh fetch complete. Data changed:", dataWasRefreshed);
            console.log("Refresh complete, restoring view for state:", currentState);
            if (currentState.view === 'categories') showCategoriesViewUI();
            else if (currentState.view === 'items') { if (currentState.filter) showItemsByCategory(currentState.filter, true); else showAllItemsViewUI(); }
            else if (currentState.view === 'detail') { if (currentState.itemId) showItemDetailView(currentState.itemId, true); else showCategoriesViewUI(); }
            else showCategoriesViewUI();
            if (dataWasRefreshed) preloadAllItemImages();
        } catch (error) {
            console.error("Error during refresh:", error);
            if (currentState.view === 'categories' && actualButtonList) actualButtonList.innerHTML = '<p>Error refreshing data.</p>';
            else if (currentState.view === 'items' && itemsList) itemsList.innerHTML = '<p>Error refreshing data.</p>';
            else if (currentState.view === 'detail' && itemDetailsContent) itemDetailsContent.innerHTML = '<p>Error refreshing data.</p>';
            else showCategoriesViewUI();
        } finally { button.disabled = false; button.classList.remove('loading'); console.log("Refresh attempt complete."); }
    });
}

// --- Search Functionality ---
function setupSearch() {
    if (!searchInput || !clearSearchButton) return;
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value; clearSearchButton.style.display = searchTerm ? 'block' : 'none';
        const currentView = history.state?.view;
        if ((currentView === 'categories' || currentView === 'detail') && searchTerm) {
             console.log(`Search from ${currentView}, switching to All Items.`); const newState = { view: 'items', filter: null };
             history.pushState(newState, '', '#items'); showAllItemsViewUI(); filterDisplayedItems(searchTerm); return;
        }
        if (currentView === 'items') filterDisplayedItems(searchTerm);
    });
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = ''; clearSearchButton.style.display = 'none';
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
    if (visibleCount === 0 && term !== '') {
        if (!noResultsMsg) { noResultsMsg = document.createElement('p'); noResultsMsg.className = 'no-search-results'; currentItemsList.appendChild(noResultsMsg); }
        noResultsMsg.textContent = `No items match "${searchTerm}".`; noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) { noResultsMsg.style.display = 'none'; }
}

// --- Profile Menu Setup ---
function setupProfileMenu() {
    if (!profileButton || !profileDropdown) return;
    profileButton.addEventListener('click', (event) => {
        event.stopPropagation(); const isVisible = profileDropdown.style.display === 'block'; profileDropdown.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
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
             }
        }
    });
    dropdownSignOutButton.addEventListener('click', signOut);
    document.addEventListener('click', (event) => {
        if (profileDropdown.style.display === 'block' && !profileButton.contains(event.target) && !profileDropdown.contains(event.target)) { profileDropdown.style.display = 'none'; }
    });
}

// --- Setup Back Button Listener ---
function setupBackButton() {
    if (!backButton) return; backButton.addEventListener('click', (e) => { e.preventDefault(); console.log("Back button clicked"); history.back(); });
}

// --- Tab Event Listeners ---
function setupTabNav() {
    if (!categoriesTab || !itemsTab) { console.error("Tab elements missing."); return; }
    categoriesTab.addEventListener('click', (e) => {
        e.preventDefault(); const newState = { view: 'categories', filter: null }; console.log("Tab Click (Categories): Replacing state");
        history.replaceState(newState, '', '#categories'); showCategoriesViewUI();
    });
    itemsTab.addEventListener('click', (e) => {
        e.preventDefault(); const currentState = history.state; const newState = { view: 'items', filter: null };
        if (!(currentState?.view === newState.view && currentState?.filter === newState.filter)) {
             if (currentState?.view === 'detail') { console.log("Tab Click (Items): Replacing detail state"); history.replaceState(newState, '', '#items'); }
             else { console.log("Tab Click (Items): Pushing state"); history.pushState(newState, '', '#items'); }
        } else { console.log("Tab Click (Items): Already on all items view."); }
        showAllItemsViewUI();
    });
    console.log("Tab listeners added.");
}

// --- Swipe Gesture Handling ---
function setupSwipeGestures() {
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
    let isSwiping = false;
    const swipeThreshold = 50, maxVerticalThreshold = 75;
    if (!viewWrapper) { console.error("View wrapper missing."); return; }

    viewWrapper.addEventListener('touchstart', (event) => {
        // Disable view swipe if detail view is active
        if (document.body.classList.contains('is-detail-active')) {
            isSwiping = false;
            // console.log("View swipe disabled in detail view.");
            return;
        }
        // Block swipe if starting on truly interactive elements (input, links, non-list buttons, dots)
        // Allows swipe starting on item rows or category buttons.
        const swipeTarget = event.target;
        let blockSwipe = false;
        if (swipeTarget.closest('input, a:not(.item-row):not(.category-button), button:not(.item-row):not(.category-button), .dot')) {
             blockSwipe = true;
        }

        if (blockSwipe) {
             isSwiping = false;
             // console.log("Swipe blocked on interactive element:", event.target);
             return;
        }

        // If swipe not blocked, initialize coordinates
        touchStartX = event.changedTouches[0].screenX;
        touchStartY = event.changedTouches[0].screenY;
        isSwiping = true;
        // console.log("Swipe initiated");

    }, { passive: true });

     viewWrapper.addEventListener('touchmove', (event) => {
         if (!isSwiping) return;
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         // Cancel if swipe becomes too vertical
         if (Math.abs(touchEndY - touchStartY) > Math.abs(touchEndX - touchStartX) && Math.abs(touchEndY - touchStartY) > 20) { // Increased vertical tolerance slightly
             // console.log("Swipe cancelled: Too vertical.");
             isSwiping = false;
         }
     }, { passive: true });

    viewWrapper.addEventListener('touchend', (event) => {
         if (!isSwiping) return;
         isSwiping = false; // Mark swipe attempt as finished
         touchEndX = event.changedTouches[0].screenX;
         touchEndY = event.changedTouches[0].screenY;
         handleSwipeGesture(); // Process the swipe
    }, { passive: true });

    function handleSwipeGesture() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Reset coordinates for next swipe
        touchStartX = touchEndX = touchStartY = touchEndY = 0;

        // Check if it's a valid horizontal swipe
        if (absDeltaX > swipeThreshold && absDeltaY < maxVerticalThreshold) {
            const currentState = history.state || { view: 'categories', filter: null };
            console.log(`Processing swipe: deltaX=${deltaX.toFixed(0)}, currentState=${currentState.view}`); // Log delta and state

            // --- Corrected RTL Swipe Logic ---
            // Swipe Right (Finger L -> R, positive deltaX): Navigate "backward"
            if (deltaX < 0) {
                console.log("Swipe Right (L->R) detected - Navigating Back");
                if (currentState.view === 'items') {
                    console.log("Action: Triggering Categories Tab");
                    if(categoriesTab) categoriesTab.click();
                } else { console.log("Action: No swipe back action from categories."); }
            }
            // Swipe Left (Finger R -> L, negative deltaX): Navigate "forward"
            else if (deltaX > 0) {
                console.log("Swipe Left (R->L) detected - Navigating Forward");
                if (currentState.view === 'categories') {
                    console.log("Action: Triggering Items Tab (All Items)");
                    if(itemsTab) itemsTab.click();
                } else { console.log("Action: No swipe forward action from items."); }
            }
        } else {
            // console.log(`Swipe ignored: dX=${deltaX.toFixed(0)}, dY=${deltaY.toFixed(0)}`);
        }
    }
     console.log("Swipe gestures setup.");
}

// --- Helper: Get User Permissions ---
function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) return null; userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) { if (permissions[i]?.[0]?.trim().toLowerCase() === userEmail) { return permissions[i]; } }
    return null;
}
