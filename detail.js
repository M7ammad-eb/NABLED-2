// detail.js

const firebaseConfig = {
    apiKey: "AIzaSyAzgx1Ro6M7Bf58dgshk_7Eflp-EtZc9io", // Replace
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

// --- DOM Elements ---
const wrapper = document.querySelector('.detail-page-wrapper');
const backButton = document.getElementById('back-button');
const itemDetailsDiv = document.getElementById('item-details');
const transitionDuration = 350; // Match CSS transition duration in milliseconds

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Check for user authentication
    auth.onAuthStateChanged((user) => {
        if (user) {
            displayItemDetails(); // Load content
        } else {
            // If user gets logged out while viewing detail, redirect
            window.location.href = 'signin.html';
        }
    });

    // Add Back Button Listener
    if (backButton && wrapper) {
        backButton.addEventListener('click', () => {
            // Start slide down animation
            wrapper.classList.remove('visible');
            // Wait for animation to finish before going back
            setTimeout(() => {
                window.history.back();
            }, transitionDuration); // Use timeout matching CSS transition
        });
    } else {
        console.error("Back button or wrapper not found");
    }
});


// --- Functions ---

async function displayItemDetails() {
    if (!itemDetailsDiv) {
        console.error("Item details container not found");
        return;
    }
    itemDetailsDiv.innerHTML = '<p>Loading details...</p>'; // Show loading message

    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');

    if (!itemId) {
        itemDetailsDiv.innerHTML = '<p>Item ID not found in URL.</p>';
         // Trigger slide-in even for error message
         if (wrapper) {
            requestAnimationFrame(() => { // Ensure element is ready
                 wrapper.classList.add('visible');
            });
         }
        return;
    }

    // Get data from localStorage (populated by script.js)
    const cachedDataString = localStorage.getItem('dataSheet');
    const cachedPermissionString = localStorage.getItem('permissionRows');

    if (!cachedDataString || !cachedPermissionString) {
         // Data not found in cache - show offline message
         displayOfflineMessage();
         // Trigger slide-in for the offline message
         if (wrapper) {
             requestAnimationFrame(() => {
                 wrapper.classList.add('visible');
             });
         }
         return; // Stop execution
    }

    try {
        const cachedData = JSON.parse(cachedDataString);
        const cachedPermission = JSON.parse(cachedPermissionString);

        if (cachedData && cachedData.data && cachedPermission && cachedPermission.data) {
            const dataRows = cachedData.data;
            const permissionRows = cachedPermission.data;

            const item = findItemById(dataRows, itemId);

            if (item && auth.currentUser) { // Ensure user is still available
                const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
                const visibleColumns = userPermissions
                    ? userPermissions.slice(8).map(val => val ? String(val).trim() : '0').map(Number) // Assuming prices start at index 8, map permissions
                    : []; // Default to no price columns visible if no permissions

                // Display the item
                displayItem(item, visibleColumns, dataRows[0]); // Pass columnNames (header row)

            } else if (!item) {
                // Item not found in data
                 itemDetailsDiv.innerHTML = `<p>Item with ID "${itemId}" not found.</p>`;
                 console.warn(`Item with ID ${itemId} not found in cached data.`);
            } else {
                 // Should not happen if auth listener works, but handle anyway
                 window.location.href = 'signin.html';
                 return; // Stop before triggering animation
            }
        } else {
            // Should not happen if initial check passed, but handle anyway
            displayOfflineMessage();
        }

    } catch (error) {
        console.error("Error processing item details:", error);
        itemDetailsDiv.innerHTML = `<p>Error displaying item details.</p>`;
    }

     // Trigger slide-in animation AFTER content might be ready
     if (wrapper) {
        requestAnimationFrame(() => { // Use rAF for smoother start
             wrapper.classList.add('visible');
        });
     }
}

function findItemById(items, itemId) {
    // Start from 1 to skip header row
    for (let i = 1; i < items.length; i++) {
        // Assuming item ID is in the first column (index 0)
        if (items[i] && items[i][0] === itemId) {
            return items[i];
        }
    }
    return null; // Not found
}

function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) return null;
    userEmail = userEmail.trim().toLowerCase();
    // Start from 1 to skip header row
    for (let i = 1; i < permissions.length; i++) {
        // Assuming email is in the first column (index 0)
        if (permissions[i]?.[0]) { // Check row and email cell exist
            let storedEmail = String(permissions[i][0]).trim().toLowerCase();
            if (storedEmail === userEmail) {
                return permissions[i]; // Return the full permission row
            }
        }
    }
    console.log(`Permissions not found for email: ${userEmail}`);
    return null;
}


function displayItem(item, visiblePriceIndices, columnNames) {
    // Ensure columnNames is an array, default to empty if not
    const headers = Array.isArray(columnNames) ? columnNames : [];

    itemDetailsDiv.innerHTML = ''; // Clear loading message

    // === 1. IMAGE CAROUSEL ===
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';

    // Assuming images are in columns 4, 5, 6 (indices 4, 5, 6)
    const images = [item[4], item[5], item[6]]
                   .map(img => img ? String(img).trim() : null) // Trim and handle null/empty
                   .filter(img => img); // Filter out null/empty strings

    // If no images, add a single placeholder
    if (images.length === 0) {
        images.push('placeholder.png'); // Use the actual placeholder filename
    }

    const slidesWrapper = document.createElement('div');
    slidesWrapper.className = 'slides-wrapper';

    images.forEach((src, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        if (index === 0) slide.classList.add('active'); // Make first slide active

        const img = document.createElement('img');
        img.src = 'placeholder.png'; // Start with placeholder
        img.alt = String(item[2] || headers[2] || 'Product Image'); // Use item name (col 2) or header as alt
        img.classList.add('carousel-image');
        img.loading = 'lazy'; // Lazy load carousel images too

        // Try loading real image in background
        if (src !== 'placeholder.png') {
            img.dataset.realSrc = src;
            const imageLoader = new Image();
            imageLoader.onload = () => {
                if (img && img.dataset.realSrc === src) {
                    img.src = src; // Update if loaded successfully
                }
            };
            imageLoader.onerror = () => console.warn(`Carousel img failed: ${src}`);
            imageLoader.src = src;
        } else {
            img.src = src; // Directly use placeholder if it's the only one
        }

        slide.appendChild(img);
        slidesWrapper.appendChild(slide);
    });

    carouselContainer.appendChild(slidesWrapper);

    // Dots (only if more than one image)
    if (images.length > 1) {
        const dots = document.createElement('div');
        dots.className = 'carousel-dots';
        images.forEach((_, i) => {
            const dot = document.createElement('span');
            dot.className = 'dot' + (i === 0 ? ' active' : '');
            dot.dataset.slideIndex = i; // Add index for click handling
            dots.appendChild(dot);
        });
        carouselContainer.appendChild(dots);
    }

    itemDetailsDiv.appendChild(carouselContainer);

    // === 2. ITEM DATA ===
    // Item Name (Column 2, index 2)
    const itemName = document.createElement('h2');
    itemName.textContent = String(item[2] || 'N/A');
    itemDetailsDiv.appendChild(itemName);

    // Item ID (Column 0, index 0)
    const itemIdP = document.createElement('p');
    itemIdP.innerHTML = `${headers[0] || "ID"}: <br><strong>${String(item[0] || 'N/A')}</strong>`;
    itemDetailsDiv.appendChild(itemIdP);

    // Specifications (Column 3, index 3)
    if (item[3] && String(item[3]).trim()) {
        const specs = document.createElement('p');
        specs.innerHTML = `${headers[3] || "Specifications"}: <br><strong>${String(item[3])}</strong>`;
        itemDetailsDiv.appendChild(specs);
    }

    // Catalog Link (Column 7, index 7)
    if (item[7] && String(item[7]).trim()) {
        const catalog = document.createElement('p');
        const catalogLink = document.createElement('a');
        catalogLink.href = String(item[7]);
        catalogLink.textContent = headers[7] || "Catalog";
        catalogLink.target = "_blank"; // Open in new tab
        catalog.appendChild(catalogLink);
        itemDetailsDiv.appendChild(catalog);
    }

    // Prices (Assuming they start from Column 8, index 8)
    const priceStartIndex = 8;
    for (let i = priceStartIndex; i < item.length; i++) {
        // Check if the permission for this price column (relative index) is 1
        const permissionIndex = i - priceStartIndex; // 0-based index for permissions array
        if (visiblePriceIndices[permissionIndex] === 1) {
            const key = headers[i] || `Price ${permissionIndex + 1}`; // Header for the price column
            const value = item[i] ? String(item[i]).trim() : 'N/A'; // Price value
            if (value !== 'N/A') { // Only display if there's a value
                const pricesP = document.createElement('p');
                pricesP.innerHTML = `${key}:<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol" alt="SAR">`;
                itemDetailsDiv.appendChild(pricesP);
            }
        }
    }

    // === 3. CAROUSEL LOGIC ===
    if (images.length > 1) {
        addCarouselFunctionality();
    }
}


//Helper function to display offline message
function displayOfflineMessage() {
    if (!itemDetailsDiv) return;
    itemDetailsDiv.innerHTML = `
        <p>تفاصيل العنصر غير متاحة حاليا.</p>
        <p>يرجى الاتصال بالإنترنت لعرض هذا العنصر.</p>
        <img src="placeholder.png" alt="Placeholder Image" style="display: block; margin: 20px auto; max-width: 80%;">
    `;
}

// Helper function to parse CSV (needed if fetching directly, but here we use localStorage)
// function parseCSV(csvText) { ... } - Not needed here if data comes from localStorage

// --- Carousel Functionality ---
function addCarouselFunctionality() {
    let currentSlideIndex = 0;
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const slidesWrapper = document.querySelector('.slides-wrapper'); // Needed for swipe calculation

    if (!slidesWrapper || slides.length <= 1) return; // No functionality needed for 0 or 1 slide

    function showSlide(index) {
        // Loop index
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        // Update active slide class (handles visibility/opacity via CSS)
        slides.forEach((s, i) => {
            s.classList.toggle('active', i === index);
        });

        // Update active dot class
        dots.forEach((d, i) => {
            d.classList.toggle('active', i === index);
        });

        currentSlideIndex = index;
    }

    // Dot click listeners
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            showSlide(parseInt(dot.dataset.slideIndex, 10));
        });
    });

    // Swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50; // Min distance for swipe action

    slidesWrapper.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    slidesWrapper.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) { // Swipe Right (RTL: Previous)
                showSlide(currentSlideIndex - 1);
            } else { // Swipe Left (RTL: Next)
                showSlide(currentSlideIndex + 1);
            }
        }
         // Reset
         touchStartX = 0;
         touchEndX = 0;
    }

    // Show the initial slide correctly
    showSlide(0);
}
