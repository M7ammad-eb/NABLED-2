// detail.js (FINAL - Correct Offline Handling)

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
          ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number)
          : [];
      // Display the item
      displayItem(item, visibleColumns, dataRows[0]); // Pass columnNames
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
  for (let i = 1; i < items.length; i++) {
    if (items[i][0] === itemId) {
      return items[i];
    }
  }
  return null;
}

function getUserPermissions(permissions, userEmail) {
    if (!permissions) {
        return null;
    }
    userEmail = userEmail.trim().toLowerCase();
    for (let i = 1; i < permissions.length; i++) {
        let storedEmail = permissions[i][0].trim().toLowerCase();
        if (storedEmail === userEmail) {
            return permissions[i];
        }
    }
    return null;
}


function displayItem(item, visibleColumns, columnNames) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = '';

  // === 1. IMAGE CAROUSEL ===
  const carouselContainer = document.createElement('div');
  carouselContainer.className = 'carousel-container';

  const images = [item[4], item[5], item[6]].filter(Boolean); 

  // If no images, add a single placeholder
  if (images.length === 0) {
    images.push('placeholder.png');
  }

  const slidesWrapper = document.createElement('div');
  slidesWrapper.className = 'slides-wrapper';

  images.forEach((src, index) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    if (index === 0) slide.classList.add('active');

    const img = document.createElement('img');
    img.src = src === 'placeholder.png' ? src : 'placeholder.png'; // Use real src only after loading
    img.alt = item[2] || 'Product Name';
    img.classList.add('carousel-image');
    img.dataset.src = src;

    slide.appendChild(img);
    slidesWrapper.appendChild(slide);

    if (src !== 'placeholder.png') {
      const realImageLoader = new Image();
      realImageLoader.src = src;
      realImageLoader.onload = () => { img.src = realImageLoader.src; };
    }
  });

  carouselContainer.appendChild(slidesWrapper);
    
  // Dots
  if (images.length > 1) {
    const dots = document.createElement('div');
    dots.className = 'carousel-dots';
    images.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dots.appendChild(dot);
    });
    carouselContainer.appendChild(dots);
  }

  itemDetailsDiv.appendChild(carouselContainer);

  // === 2. ITEM DATA  ===
  // Item Name
  const itemName = document.createElement('p');
  itemName.innerHTML = `<h2>${item[2] || ""}</h2><br>`; // Use empty string if item[1] is undefined.  Good practice for ALL data.
  itemDetailsDiv.appendChild(itemName);

  // Item ID
  const itemId = document.createElement('p');
  itemId.innerHTML = `${columnNames[0] || ""} <br><strong>${item[0] || ""}</strong><br>`; // Handle potential undefined values.
  itemDetailsDiv.appendChild(itemId);

  // Specifications
  const specs = document.createElement('p');
  specs.innerHTML = item[3] ? `${columnNames[3]} <br><strong>${item[3]}</strong><br>` : '';
  itemDetailsDiv.appendChild(specs);

  // Cataloge Link
  const catalog = document.createElement('p');
  catalog.innerHTML = item[7] ? `<a href="${item[7]}">${columnNames[7] || ""}</a><br>` : ''; // Make link conditional.  Handle undefined columnNames[6] too
  itemDetailsDiv.appendChild(catalog);


  // Prices (Corrected visibility check)
  for (let i = 8; i < item.length; i++) {
      if (visibleColumns[i-3] === 1) { // Corrected check!
          const key = columnNames[i];
          const value = item[i];
          const prices = document.createElement('p');
          prices.innerHTML = `${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol"><br>`;
          itemDetailsDiv.appendChild(prices);
      }
  }

  // === 3. CAROUSEL LOGIC ===
  addCarouselFunctionality();
}


//Helper function to display offline message
function displayOfflineMessage() {
    document.getElementById('item-details').innerHTML = `
        <p>Item details are not available offline.</p>
        <p>Please connect to the internet to view this item.</p>
        <img src="placeholder.png" alt="Placeholder Image">
    `;
}

function parseCSV(csvText) {
    return Papa.parse(csvText, { header: false }).data;
}

function addCarouselFunctionality() {
  let currentSlide = 0;
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const slidesWrapper = document.querySelector('.slides-wrapper');

  function showSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    // Update the active slide and dot
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    slides[index].classList.add('active');
    if (dots[index]) dots[index].classList.add('active');

    // Slide the wrapper by translating it
    slidesWrapper.style.transform = `translateX(${index * 100}%)`;

    currentSlide = index;
  }

  /*document.querySelector('.carousel-arrow.left')?.addEventListener('click', () => showSlide(currentSlide - 1));
  document.querySelector('.carousel-arrow.right')?.addEventListener('click', () => showSlide(currentSlide + 1));*/
  dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i)));

  // Swipe support
  let touchStartX = 0;
  slidesWrapper.addEventListener('touchstart', e => touchStartX = e.touches[0].clientX);
  slidesWrapper.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 30) showSlide(currentSlide + 1);
    else if (diff < -30) showSlide(currentSlide - 1);
  });
}
