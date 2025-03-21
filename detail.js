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

// add transition
function displayItem(item, visibleColumns, columnNames) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = '';

  // Image (Placeholder initially, will be dynamically loaded)
  const img = document.createElement('p');
  img.innerHTML = `<img src="placeholder.png" alt="${item[1]}" class="product-image" data-src="${item[3]}">`;
  itemDetailsDiv.appendChild(img);

 // Item Name
    const itemName = document.createElement('p');
    itemName.innerHTML = `<h2>${item[1]}</h2><br>`;
    itemDetailsDiv.appendChild(itemName);

    // Item ID
    const itemId = document.createElement('p');
    itemId.innerHTML = `${columnNames[0]}<br><strong>${item[0]}</strong><br>`;
    itemDetailsDiv.appendChild(itemId);

    // Specifications
    const specs = document.createElement('p');
    specs.innerHTML = `${columnNames[2]}<br><strong>${item[2]}</strong><br>`;
    itemDetailsDiv.appendChild(specs);

    // Cataloge Link
    const catalog = document.createElement('p');
    catalog.innerHTML = `<a href="${item[4]}">${columnNames[4]}</a><br>`;
    itemDetailsDiv.appendChild(catalog);

  // Prices (Corrected visibility check)
  for (let i = 5; i < item.length; i++) {
    if (visibleColumns[i] === 1) { // Corrected check!
      const key = columnNames[i];
      const value = item[i];
      const prices = document.createElement('p');
      prices.innerHTML = `${key}<br><strong>${value}</strong> <img src="https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg" class="currency-symbol"><br>`;
      itemDetailsDiv.appendChild(prices);
    }
  }

  // Lazy-load the real image (after everything else is displayed)
  const realImage = itemDetailsDiv.querySelector('.product-image');
    realImage.src = realImage.dataset.src; // Set the src from data-src

}

// slide-in & out
document.addEventListener("DOMContentLoaded", function () {
    // Function to apply slide-in
    function slideIn() {
        document.body.classList.remove("slide-out"); // Remove slide-out first
        document.body.classList.add("slide-in");
        setTimeout(() => { //Remove slide-in class, once it has been completed
            document.body.classList.remove("slide-in");
        }, 300); //match time with CSS

    }

    // Function to apply slide-out
    function slideOut() {
        document.body.classList.add("slide-out");
    }
    
    //Push state on initial page load
    if (window.history.state === null) {
        history.pushState({ initialLoad: true }, document.title, location.href);
    }

    // Check if we came from index.html using a better approach (pageshow)
    window.addEventListener("pageshow", function(event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            // Page was loaded from cache (back/forward navigation)
            slideIn(); // Apply slide-in
        } else if (sessionStorage.getItem("navigate-forward") === "true")
        {
           slideIn();
           sessionStorage.removeItem("navigate-forward"); // Clear flag
        }
    });

    // Handle Back Button (Slide Out)
    window.addEventListener("popstate", function (event) {
        if (event.state && event.state.initialLoad){
             //if initial load, ignore this event
            return;
        }
        slideOut();

        // After slide-out animation, we need to actually go back.
        setTimeout(() => {
            history.back();
        }, 300); // Match this duration with your CSS animation
    });

    // Handle Back Button via Custom Button (if exists) -  This part is correct, keep it as is
    const backButton = document.getElementById("back-button");
    if (backButton) {
        backButton.addEventListener("click", function (event) {
            event.preventDefault();
            slideOut();
            setTimeout(() => {
                window.history.back();
            }, 300);
        });
    }
});


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
