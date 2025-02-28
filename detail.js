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

// URLs for data sources
const dataSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv';
const permissionsSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv';

// Cache settings
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Authenticate user on page load
auth.onAuthStateChanged(user => {
  if (user) {
    console.log('User is signed in:', user);
    displayItemDetails();
  } else {
    console.log('No user signed in. Redirecting...');
    window.location.href = 'signin.html';
  }
});

// Fetch data with caching
async function fetchDataWithCache(url, cacheKey) {
  const cachedData = localStorage.getItem(cacheKey);
  const cachedTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
  
  if (cachedData && cachedTimestamp) {
    const age = Date.now() - parseInt(cachedTimestamp, 10);
    if (age < CACHE_DURATION) {
      console.log(`Loading ${cacheKey} from cache.`);
      return JSON.parse(cachedData);
    }
  }

  console.log(`Fetching ${cacheKey} from network.`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const csvText = await response.text();
    const parsedData = parseCSV(csvText);
    
    localStorage.setItem(cacheKey, JSON.stringify(parsedData));
    localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());

    return parsedData;
  } catch (error) {
    console.error(`Error fetching ${cacheKey}:`, error);
    return null;
  }
}

// Display item details
async function displayItemDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemId = urlParams.get('id');

  if (!itemId) {
    document.getElementById('item-details').innerHTML = '<p>Item ID not found.</p>';
    return;
  }

  try {
    const [dataRows, permissionRows] = await Promise.all([
      fetchDataWithCache(dataSheetUrl, 'cachedData'),
      fetchDataWithCache(permissionsSheetUrl, 'cachedPermissions')
    ]);

    if (!dataRows || !permissionRows) throw new Error('Failed to fetch required data.');

    const item = findItemById(dataRows, itemId);
    if (item) {
      const userPermissions = getUserPermissions(permissionRows, auth.currentUser.email);
      const visibleColumns = userPermissions ? userPermissions.slice(2).filter(val => !isNaN(val)).map(Number) : [];

      displayItem(item, dataRows[0], visibleColumns);
    } else {
      document.getElementById('item-details').innerHTML = '<p>Item not found.</p>';
    }
  } catch (error) {
    console.error('Error displaying item details:', error);
    document.getElementById('item-details').innerHTML = `<p>Error fetching data: ${error.message}</p>`;
  }
}

// Parse CSV data
function parseCSV(csvText) {
  return Papa.parse(csvText, { header: false }).data;
}

// Find item by ID
function findItemById(items, itemId) {
  return items.find(row => row[0] === itemId) || null;
}

// Get user permissions
function getUserPermissions(permissions, userEmail) {
  userEmail = userEmail.trim().toLowerCase();
  return permissions.find(row => row[0].trim().toLowerCase() === userEmail) || null;
}

// Display item details
function displayItem(item, columnNames, visibleColumns) {
  const itemDetailsDiv = document.getElementById('item-details');
  itemDetailsDiv.innerHTML = '';

  item.forEach((value, index) => {
    if (visibleColumns.includes(index)) {
      const detail = document.createElement('p');
      detail.innerHTML = `<strong>${columnNames[index]}:</strong> ${value}`;
      itemDetailsDiv.appendChild(detail);
    }
  });
}
