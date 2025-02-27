// script.js
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv'; // Replace with your URL

fetch(sheetUrl)
  .then(response => response.text()) // Use .json() if you published as JSON
  .then(data => {
    // Process CSV data here (or JSON data)
    const rows = parseCSV(data); // Implement parseCSV function
    displayItems(rows);
  })
  .catch(error => console.error('Error fetching data:', error));

function parseCSV(csvText) {
  const rows = csvText.split('\n');
  return rows.map(row => row.split(',')); // Simple CSV parsing
}

function displayItems(items) {
  // Populate index.html with item names and IDs
}
