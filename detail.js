// detail.js (FINAL - Correct Offline Handling & Carousel Fix)

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

// Check for user authentication
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

    // Get data from localStorage (populated by script.js)
    const cachedData = JSON.parse(localStorage.getItem('dataSheet'));
    const cachedPermission = JSON.parse(localStorage.getItem('permissionRows'));


    if (cachedData && cachedData.data && cachedPermission && cachedPermission.data) {
        const dataRows = cachedData.data;
        const permissionRows = cachedPermission.data;

        const item = findItemById(dataRows, itemId);
        if (item) {
            const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
            const visibleColumns = userPermissions
                ? userPermissions.map((val, index) => ({ val, index })) // Keep track of original index
                           .slice(2) // Skip email and name
                           .filter(obj => obj.val === "1") // Filter where value is "1" (string or number)
                           .map(obj => obj.index) // Get the original column index
                : [];
            // Display the item
            displayItem(item, visibleColumns, dataRows[0]); // Pass columnNames and corrected visibleColumns indices
        } else {
            // Item not found in data (should be very rare)
            displayOfflineMessage(); // Use a helper function
        }
    } else {
        // localStorage is empty (should be very rare)
        displayOfflineMessage(); // Use a helper function
    }
}


function findItemById(items, itemId) {
    for (let i = 1; i < items.length; i++) { // Start from 1 to skip header row
        if (items[i] && items[i][0] === itemId) { // Check if row exists before accessing index
            return items[i];
        }
    }
    return null;
}

function getUserPermissions(permissions, userEmail) {
    if (!permissions || !userEmail) { // Add check for userEmail
        return null;
    }
    const trimmedUserEmail = userEmail.trim().toLowerCase(); // Trim and lowercase user email once
    for (let i = 1; i < permissions.length; i++) { // Start from 1 to skip header row
        // Ensure the row and email cell exist and are strings before processing
        if (permissions[i] && typeof permissions[i][0] === 'string') {
             let storedEmail = permissions[i][0].trim().toLowerCase();
             if (storedEmail === trimmedUserEmail) {
                 return permissions[i]; // Return the full permission row
             }
        }
    }
    return null; // Return null if no match found
}


function displayItem(item, visibleColumnIndices, columnNames) { // Renamed parameter for clarity
    const itemDetailsDiv = document.getElementById('item-details');
    itemDetailsDiv.innerHTML = ''; // Clear previous content

    // === 1. IMAGE CAROUSEL ===
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';

    // Filter image URLs (indices 3, 4, 5) - ensure they are treated as strings and are not empty
    const images = [item[3], item[4], item[5]].filter(imgUrl => typeof imgUrl === 'string' && imgUrl.trim() !== '');

    if (images.length > 0) {
        const slidesWrapper = document.createElement('div');
        slidesWrapper.className = 'slides-wrapper';

        images.forEach((src, index) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            // Add 'active' class only to the first slide (index 0)
            if (index === 0) {
                 slide.classList.add('active');
            }

            const img = document.createElement('img');
            img.src = 'placeholder.png'; // Start with a placeholder
            img.alt = item[1] || 'Product Image'; // Use item name (index 1) as alt text
            img.className = 'carousel-image'; // Use className, not classList for initial set
            img.dataset.src = src; // Store the actual source

            slide.appendChild(img);
            slidesWrapper.appendChild(slide);

            // Preload the actual image and replace the placeholder when loaded
            const realImageLoader = new Image();
            realImageLoader.onload = () => {
                img.src = realImageLoader.src; // Set the actual source when loaded
            };
            realImageLoader.onerror = () => {
                 // Optional: Handle image loading errors, maybe keep placeholder or show error icon
                 console.error(`Failed to load image: ${src}`);
                 // img.src = 'error-placeholder.png'; // Example error image
            };
            realImageLoader.src = src; // Start loading the actual image
        });

        carouselContainer.appendChild(slidesWrapper);

        // Add Arrows only if more than one image
        if (images.length > 1) {
            const leftArrow = document.createElement('div');
            leftArrow.className = 'carousel-arrow left';
            leftArrow.innerHTML = '&#10094;'; // Left arrow symbol
            const rightArrow = document.createElement('div');
            rightArrow.className = 'carousel-arrow right';
            rightArrow.innerHTML = '&#10095;'; // Right arrow symbol
            carouselContainer.appendChild(leftArrow);
            carouselContainer.appendChild(rightArrow);

            // Add Dots only if more than one image
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'carousel-dots';
            images.forEach((_, i) => {
                const dot = document.createElement('span');
                dot.className = 'dot';
                // Add 'active' class only to the first dot (index 0)
                if (i === 0) {
                     dot.classList.add('active');
                }
                // Add data attribute to link dot to slide index
                dot.dataset.slideIndex = i;
                dotsContainer.appendChild(dot);
            });
            carouselContainer.appendChild(dotsContainer);
        }

        itemDetailsDiv.appendChild(carouselContainer);

    } else {
         // Optional: Display a default placeholder if no images are available
         const placeholder = document.createElement('img');
         placeholder.src = 'placeholder.png';
         placeholder.alt = item[1] || 'Product Image';
         placeholder.className = 'product-image-placeholder'; // Use a different class for styling if needed
         itemDetailsDiv.appendChild(placeholder);
    }


    // === 2. ITEM DATA ===
    // Helper function to safely get data and handle undefined
    const getData = (index, fallback = "") => item[index] !== undefined && item[index] !== null ? String(item[index]).trim() : fallback;
    const getColumnName = (index, fallback = "") => columnNames[index] !== undefined && columnNames[index] !== null ? String(columnNames[index]).trim() : fallback;

    // Item Name (Assuming it's always visible - index 1)
    const itemName = getData(1);
    if (itemName) {
        const nameElement = document.createElement('h2');
        nameElement.textContent = itemName;
        itemDetailsDiv.appendChild(nameElement);
    }

    // Item ID (Assuming it's always visible - index 0)
    const itemIdVal = getData(0);
    const itemIdLabel = getColumnName(0, 'ID'); // Default label if header is missing
    if (itemIdVal) {
        const idElement = document.createElement('p');
        idElement.innerHTML = `${itemIdLabel}: <strong>${itemIdVal}</strong>`;
        itemDetailsDiv.appendChild(idElement);
    }

    // Specifications (Assuming it's always visible - index 2)
    const specsVal = getData(2);
    const specsLabel = getColumnName(2, 'Specifications'); // Default label
    if (specsVal) {
        const specsElement = document.createElement('p');
        specsElement.innerHTML = `${specsLabel}: <strong>${specsVal}</strong>`;
        itemDetailsDiv.appendChild(specsElement);
    }

    // Catalog Link (Assuming it's always visible - index 6)
    const catalogUrl = getData(6);
    const catalogLabel = getColumnName(6, 'Catalog'); // Default label
    if (catalogUrl) {
        const catalogElement = document.createElement('p');
        // Basic URL validation (starts with http or https)
        if (catalogUrl.startsWith('http://') || catalogUrl.startsWith('https://')) {
             catalogElement.innerHTML = `<a href="${catalogUrl}" target="_blank" rel="noopener noreferrer">${catalogLabel}</a>`; // Added target and rel
        } else {
            // Handle cases where it might not be a valid URL (e.g., just text)
             catalogElement.textContent = `${catalogLabel}: ${catalogUrl}`;
        }
        itemDetailsDiv.appendChild(catalogElement);
    }


    // Prices and other permission-based columns (Starting from index 7)
    // Iterate through all possible columns based on columnNames length
    for (let i = 7; i < columnNames.length; i++) {
        if (visibleColumns[i-2] === 1) {
             const key = getColumnName(i);
             const value = getData(i);

            // Only display if both key and value exist
            if (key && value) {
                const dataElement = document.createElement('p');
                     dataElement.innerHTML = `${key}: <br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol" alt="SAR">`;
                     dataElement.innerHTML = `${key}: <br><strong>${value}</strong>`;
                 }
                 itemDetailsDiv.appendChild(dataElement);
            }
        }
    }

    // === 3. CAROUSEL LOGIC INITIALIZATION ===
    // Call this *after* all carousel elements are added to the DOM
    // and only if there was more than one image to display.
    if (images.length > 1) {
        addCarouselFunctionality();
    }
}


// Helper function to display offline message
function displayOfflineMessage() {
    document.getElementById('item-details').innerHTML = `
        <div style="text-align: center; padding: 20px;">
             <p>تفاصيل العنصر غير متوفرة حالياً.</p>
             <p>يرجى الاتصال بالإنترنت لعرض هذا العنصر.</p>
             <img src="placeholder.png" alt="Placeholder Image" style="max-width: 100%; height: auto; margin-top: 20px; border-radius: 8px;">
        </div>
    `;
}

// PapaParse function remains the same
function parseCSV(csvText) {
    // Added error handling for empty or invalid CSV text
    if (!csvText || typeof csvText !== 'string') {
         console.error("Invalid CSV text provided to parseCSV");
         return { data: [], errors: [{ message: "Input CSV text is empty or invalid." }], meta: {} };
    }
    try {
         return Papa.parse(csvText.trim(), { // Trim whitespace
             header: false,
             skipEmptyLines: true // Skip empty lines
         });
    } catch (error) {
         console.error("Error parsing CSV:", error);
         return { data: [], errors: [error], meta: {} }; // Return structure consistent with PapaParse
    }
}


function addCarouselFunctionality() {
    const slidesWrapper = document.querySelector('.slides-wrapper');
    // Ensure elements exist before adding listeners
    if (!slidesWrapper) {
        console.error("Slides wrapper not found for carousel functionality.");
        return;
    }
    const slides = slidesWrapper.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot'); // Dots are outside the wrapper

    if (slides.length <= 1) return; // No need for controls if 0 or 1 slide

    let currentSlide = 0; // Index of the currently active slide

    function showSlide(index) {
        // --- Using transform for sliding effect ---
        // slidesWrapper.style.transform = `translateX(-${index * 100}%)`;

        // --- Using display block/none for fade effect (as per original CSS) ---
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        slides.forEach((slide, i) => {
             slide.classList.toggle('active', i === index);
        });

        if (dots.length > 0) {
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }
        // ------------------------------------------

        currentSlide = index;
    }

    // Arrow Listeners
    const leftArrow = document.querySelector('.carousel-arrow.left');
    const rightArrow = document.querySelector('.carousel-arrow.right');

    leftArrow?.addEventListener('click', () => showSlide(currentSlide - 1));
    rightArrow?.addEventListener('click', () => showSlide(currentSlide + 1));

    // Dot Listeners
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
             // Get the target slide index from the data attribute
             const slideIndex = parseInt(e.target.dataset.slideIndex, 10);
             if (!isNaN(slideIndex)) {
                 showSlide(slideIndex);
             }
        });
    });

    // Swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    // Use slidesWrapper for touch events
    slidesWrapper.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true }); // Use passive listener for better scroll performance

    slidesWrapper.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const diff = touchStartX - touchEndX; // Calculate difference
        const sensitivity = 50; // Minimum swipe distance

        // Check swipe direction based on language direction (RTL)
        if (document.documentElement.dir === 'rtl') {
            if (diff > sensitivity) { // Swipe Left (moves to next slide in RTL)
                showSlide(currentSlide + 1);
            } else if (diff < -sensitivity) { // Swipe Right (moves to previous slide in RTL)
                showSlide(currentSlide - 1);
            }
        } else { // LTR (Standard behavior)
            if (diff > sensitivity) { // Swipe Left
                showSlide(currentSlide + 1);
            } else if (diff < -sensitivity) { // Swipe Right
                showSlide(currentSlide - 1);
            }
        }

        // Reset values for next swipe
        touchStartX = 0;
        touchEndX = 0;
    }

     // Initial setup: show the first slide
     showSlide(0);
}
