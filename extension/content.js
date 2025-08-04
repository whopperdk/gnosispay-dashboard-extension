// content.js

// List of MCCs with no cashback 
const NO_CASHBACK_MCCS = [
  '6010', '6011', '6012', '6051', '6211', '7995', '9211', '9222', '9311', '9399',
  '8398', '6300', '8661', '8651', '4900', '6513', '4829', '5734', '5947', '6050',
  '6532', '6533', '6536', '6537', '6538', '6540', '6760', '7372', '8999', '9223', '9411'
];

const mccCategories = [
  { category: 'Agricultural', ranges: [763, 780, 1711, 1731, 1740, 1750, 1761, 1771, 1799, 2048, 7699] },
  { category: 'Transport', ranges: [{ start: 300, end: 3299 }, { start: 3351, end: 3441 }, 4011, 4111, 4112, 4119, 4121, 4131, 4511, 7519, 7523] },
  { category: 'Utilities', ranges: [4812, 4814, 4899, 4900, 4821] },
  { category: 'Shopping', ranges: [5200, 5211, { start: 5231, end: 5251 }, 5261, 5271, 5300, 5309, 5310, 5311, 5331, 5399, 5944, 5681, 5942, 5945, 5977, 5946, 5947, 5999] },
  { category: 'Groceries', ranges: [5411, 5422, 5441, 5451, 5499, 5424] },
  { category: 'Clothing', ranges: [5611, 5621, 5631, 5641, 5651, 5655, 5661, 5681, 5691, 5697, 5699] },
  { category: 'Digital', ranges: [5815, 5816, 5817, 5818, 7372, 5734] },
  { category: 'Dining', ranges: [5811, 5812, 5813, 5814, 5819, 5462] },
  { category: 'Financial', ranges: [6012, { start: 6050, end: 6051 }, 6211, 6300, 6529, 6530, 6531, 6532, 6533, 6534, 6535, 6536, 6537, 6538, 6760] },
  { category: 'Cash', ranges: [6010, 6011] },
  { category: 'Services', ranges: [7210, 7211, 7216, 7217, 7221, 7230, 7251, 7261, 7273, 7276, 7277, 7278, 7296, 7297, 7298, 7299, 7213, 7215, 7225] },
  { category: 'Business', ranges: [7311, 7321, 7333, 7338, 7339, 7342, 7349, 7361, 7372, 7375, 7379, 7393, 7394, 7395] },
  { category: 'Entertainment', ranges: [7832, 7841, 7911, 7922, 7929, 7932, 7933, 7941, 7991, 7992, 7993, 7994, 7996, 7997, 7998, 7999, 7912, 7935, 7942] },
  { category: 'Health', ranges: [8011, 8021, 8031, 8041, 8042, 8043, 8049, 8050, 8071, 5912, 5975, 5976] },
  { category: 'Education', ranges: [8211, 8220, 8241, 8244, 8249, 8299, 8351] },
  { category: 'Government', ranges: [9399, 9402, 9405, 9700, 9701, 9702, 9211, 9222] },
  { category: 'Holidays', ranges: [{ start: 3501, end: 3835 }, 4411, 4722] },
  { category: 'Fuel', ranges: [5541, 5542, 5543] },
  { category: 'Other', ranges: [] }
];

function getMccCategory(mccCode) {
  const code = parseInt(mccCode) || 0;
  if (!mccCode || code === 0) return 'Other';
  for (const group of mccCategories) {
    for (const item of group.ranges) {
      if (typeof item === 'number' && code === item) return group.category;
      if (typeof item === 'object' && code >= item.start && code <= item.end) return group.category;
    }
  }
  return 'Other';
}

function getDataValue(tx, dataSource) {
  if (dataSource === 'category') return getMccCategory(tx.mcc || '0000');
  if (dataSource === 'tag1') return tx.tag1 || 'Untagged';
  if (dataSource === 'tag2') return tx.tag2 || 'Untagged';
  if (dataSource === 'tag3') return tx.tag3 || 'Untagged';
  return 'Other';
}

function parseTransactionDate(dateText) {
  try {
    if (!dateText.trim()) {
      console.warn(`Empty date text`);
      return '';
    }
    return dateText.trim(); 
  } catch (error) {
    console.warn(`Error parsing date "${dateText}"`, error);
    return '';
  }
}

async function waitForTable() {
  return new Promise((resolve, reject) => {
    const maxAttempts = 50;
    let attempts = 0;
    const checkTable = () => {
      const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
      if (table) resolve(table);
      else if (attempts >= maxAttempts) reject(new Error('Table not found'));
      else {
        attempts++;
        setTimeout(checkTable, 200);
      }
    };
    checkTable();
  });
}

async function scrapeTransactionsFromTable() {
  let table;
  try {
    table = await waitForTable();
  } catch (error) {
    return [];
  }
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const transactions = [];
  rows.reverse().forEach((row, index) => {
    if (row.querySelector('th')) return;
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;
    const dateText = cells[0]?.textContent.trim() || '';
    const merchantText = cells[1]?.textContent.trim() || '';
    const amountText = cells[3]?.textContent.trim() || '';
    const mccText = cells[5]?.textContent.trim() || '';
    const typeText = cells[2]?.textContent.trim().toUpperCase() || 'PURCHASE';

    let billingAmount = 0;
    try {
      const amountMatch = amountText.match(/[\d,.]+/);
      billingAmount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
    } catch (error) {}

    let mcc = '0000';
    try {
      if (mccText && /\d{4}/.test(mccText)) mcc = mccText.match(/(\d{4})/)[1];
    } catch (error) {}

    let currencySymbol = '€';
    if (amountText.includes('$')) currencySymbol = '$';
    else if (amountText.includes('£')) currencySymbol = '£';
    else if (amountText.includes('€')) currencySymbol = '€';

    let status = null;
    if (merchantText.includes('Pending')) status = 'Pending';
    else if (merchantText.includes('Declined')) status = 'Declined';
    else if (merchantText.includes('Refund')) status = 'Refund';
    else if (merchantText.includes('Insufficient')) status = 'InsufficientFunds';

    transactions.push({
      createdAt: dateText, 
      merchant: { name: merchantText },
      billingAmount,
      billingCurrency: { symbol: currencySymbol },
      mcc,
      transactionType: typeText,
      status,
      rowIndex: index
    });
  });
  return transactions;
}


let csvLoadingInProgress = false;

(async function () {
  let isInitialized = false;
let chartContainerExists = false;
let container = null;
let selectedHighlights = new Set();
let allTransactions = [];
let merchantSearch = '';
let selectedCountry = 'all';
let selectedCategory = 'all';
let selectedMonth = 'all'; 
let selectedYear = 'all'; 
let cashbackEligible = false;
let noCashback = false;
let selectedCustomTag = 'all';
let csvLoadingInProgress = false;

  const style = document.createElement('style');
  style.textContent = `
    .financial-container { 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px; 
      display: flex; 
      justify-content: center; 
    }
    .chart-container { 
      margin: 20px 0; 
      padding: 20px; 
      border-radius: 8px; 
      background: #fcfbf9; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
      width: 600px; 
      display: flex; 
      flex-wrap: wrap; 
      gap: 20px; 
      align-items: flex-start; 
      justify-content: center; 
    }
    .chart-wrapper { 
      flex: 1; 
      min-width: 280px; 
      max-width: 280px; 
    }
    .chart-controls { 
      display: flex; 
      gap: 15px; 
      margin-bottom: 20px; 
      align-items: center; 
      flex-wrap: wrap; 
      width: 100%; 
      justify-content: center; 
    }
    .visibility-controls {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      align-items: center;
      flex-wrap: wrap;
      width: 100%;
      justify-content: center;
    }
    .visibility-controls button {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      background: #f5f5f5;
      color: #333;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .visibility-controls button[data-active="true"] {
      background: #84ab4e;
      color: white;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .visibility-controls button:hover {
      opacity: 0.9;
    }
    .chart-title { 
      font-size: 18px; 
      font-weight: bold; 
      margin-bottom: 15px; 
      color: #333; 
      text-align: center; 
    }
    #spendingChart, #yearlyHistogram { 
      width: 260px; 
      height: 260px; 
      cursor: default; 
      display: block; 
      margin: 0 auto; 
    }
    select { 
      padding: 8px 12px; 
      border-radius: 4px; 
      border: 1px solid #ddd; 
      background: white; 
      font-size: 14px; 
    }
    .chart-legend { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 10px; 
      margin-top: 15px; 
      max-height: 100px; 
      overflow-y: auto; 
      padding: 5px; 
      width: 100%; 
      justify-content: center; 
    }
    .legend-item { 
      display: flex; 
      align-items: center; 
      font-size: 12px; 
      padding: 3px 8px; 
      background: #f5f5f5; 
      border-radius: 4px; 
      cursor: pointer; 
    }
    .legend-item:hover { 
      background: #e0e0e0; 
    }
    .legend-color { 
      width: 12px; 
      height: 12px; 
      margin-right: 5px; 
      border-radius: 2px; 
    }
    .total-spent { 
      margin-top: 10px; 
      font-weight: bold; 
      color: #333; 
      padding: 8px; 
      background: #f0f8ff; 
      border-radius: 4px; 
      text-align: center; 
    }
    .csv-export-button { 
      cursor: pointer; 
      background: none; 
      border: none; 
      padding: 0; 
      margin: 0; 
      display: flex; 
      align-items: center; 
    }
    .mcc-cell, .mcc-cat-cell, .tag1-cell, .tag2-cell, .tag3-cell { 
      text-align: center; 
      padding: 8px; 
    }
    .mcc-cell div { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      width: fit-content; 
      margin: auto; 
      gap: 8px; 
    }
    .highlight-row td { 
      font-weight: bold; 
      transition: color 0.3s, font-weight 0.3s; 
    }
    .cashback-calculator {
      margin-top: 20px;
      padding: 15px;
      border: 1px solid #ccc;
      border-radius: 5px;
      width: 100%;
      box-sizing: border-box;
    }
    .calculator-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .calculator-controls label {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .calculator-controls select,
    .calculator-controls input[type="number"] {
      padding: 5px;
      border: 1px solid #ccc;
      border-radius: 3px;
    }
    .calculator-controls button {
      padding: 5px 10px;
      background-color: #84ab4e;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    .calculator-controls button:hover {
      background-color: #6f8c3e;
    }
    .cashback-result {
      margin-top: 10px;
      font-weight: bold;
      color: #333;
      text-align: center;
    }
    .hand-emoji {
      margin-left: 5px;
      font-size: 16px;
    }
    @media (max-width: 600px) { 
      .chart-container { 
        flex-direction: column; 
        align-items: center; 
        width: 100%; 
        max-width: 600px; 
      }
      .chart-wrapper { 
        min-width: 100%; 
        max-width: 100%; 
      }
      #spendingChart, #yearlyHistogram { 
        width: 100%; 
        max-width: 260px; 
      }
    }
      .custom-tags-column {
  text-align: center;
  padding: 8px;
}
.custom-tags-checkbox {
  cursor: pointer;
}
.custom-tags-module {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
  width: 100%;
  box-sizing: border-box;
  display: none;
}
.custom-tags-module h3 {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin: 0 0 10px 0;
  text-align: center;
}
.custom-tags-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: center;
}
.custom-tags-controls label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  color: #333;
}
.custom-tags-controls input[type="text"] {
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  width: 150px;
}
.custom-tags-controls button {
  padding: 5px 10px;
  background-color: #84ab4e;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.custom-tags-controls button:hover {
  background-color: #6f8c3e;
}
  .custom-tags-controls input[type="file"] {
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 14px;
}
  .custom-tags-controls button#clearTags {
  padding: 5px 10px;
  background-color: #ff4d4d;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.custom-tags-controls button#clearTags:hover {
  background-color: #cc0000;
}
@media (max-width: 600px) {
  .custom-tags-controls input[type="text"] {
    width: 100%;
    max-width: 200px;
  }
}
    .about-me-button {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      background: #f5f5f5;
      color: #333;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      width: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .about-me-button:hover {
      opacity: 0.9;
    }
    .about-me-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .about-me-modal-content {
      background: #fcfbf9;
      padding: 20px;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    .about-me-modal-content h2 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #333;
    }
    .about-me-modal-content p {
      font-size: 14px;
      color: #333;
      margin-bottom: 10px;
    }
    .about-me-modal-content h3 {
      font-size: 16px;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
      color: #333;
    }
    .close-modal-button {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #333;
    }
    .close-modal-button:hover {
      color: #84ab4e;
    }
    @media (max-width: 600px) {
      .about-me-modal-content {
        width: 95%;
        padding: 15px;
      }
    }
    .filter-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 20px;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    .search-bar input {
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-size: 14px;
      width: 200px;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-group label {
      font-size: 14px;
      color: #333;
    }
    .filter-group select {
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #ddd;
      background: white;
      font-size: 14px;
    }
    .filter-group button {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #f5f5f5;
      color: #333;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .filter-group button[data-active="true"] {
      background: #84ab4e;
      color: white;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .filter-group button:hover {
      opacity: 0.9;
    }
    @media (max-width: 600px) {
      .filter-controls {
        flex-direction: column;
        align-items: center;
      }
      .search-bar input {
        width: 100%;
        max-width: 300px;
      }
    }
      .transaction-filter-tool {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
  padding: 15px;
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;
}
.transaction-filter-tool h3 {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin: 0 0 10px 0;
  text-align: center;
}
.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: center;
  justify-content: center;
  width: 100%;
}
@media (max-width: 600px) {
  .transaction-filter-tool {
    padding: 10px;
  }
  .filter-controls {
    flex-direction: column;
    align-items: center;
  }
  .search-bar input {
    width: 100%;
    max-width: 300px;
  }
}
  `;
  document.head.appendChild(style);

async function getTransactions() {
  try {
    const response = await fetch("https://app.gnosispay.com/api/v1/transactions", {
      method: "GET",
      headers: {},
      referrer: "https://app.gnosispay.com/dashboard",
      referrerPolicy: "strict-origin-when-cross-origin",
      mode: "cors",
      credentials: "include"
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    const apiTransactions = Array.isArray(data) ? data : data.transactions || [];
    const currencyMap = { 'GBP': '£', 'USD': '$', 'EUR': '€' };
    const scrapedTransactions = await scrapeTransactionsFromTable();
    const savedTags = JSON.parse(localStorage.getItem('transactionTags') || '{}');


    const transactions = scrapedTransactions.map((scrapedTx, index) => {
      const apiTx = apiTransactions[index] || {};
      const createdAt = apiTx.createdAt || apiTx.clearedAt || scrapedTx.createdAt || '';
      const clearedAt = apiTx.clearedAt || apiTx.createdAt || scrapedTx.createdAt || '';
      const transactionTags = savedTags[index] || { tag1: '', tag2: '', tag3: '' };

      return {
        createdAt,
        clearedAt,
        isPending: apiTx.isPending || scrapedTx.status === 'Pending' || false,
        transactionAmount: apiTx.transactionAmount ? (parseFloat(apiTx.transactionAmount) / 100).toFixed(2) : '',
        transactionCurrency: apiTx.transactionCurrency ? { symbol: currencyMap[apiTx.transactionCurrency.symbol] || apiTx.transactionCurrency.symbol || '' } : { symbol: '' },
        billingAmount: (parseFloat(apiTx.billingAmount) / 100).toString() || scrapedTx.billingAmount || '0',
        billingCurrency: { symbol: currencyMap[apiTx.billingCurrency?.symbol] || scrapedTx.billingCurrency?.symbol || '£' },
        mcc: apiTx.mcc || scrapedTx.mcc || '0000',
        merchant: {
          name: scrapedTx.merchant?.name || apiTx.merchant?.name?.replace(/\s+/g, ' ').trim() || '',
          city: apiTx.merchant?.city || '',
          country: { name: apiTx.merchant?.country?.name || '' }
        },
        transactionType: apiTx.kind === "Payment" ? "PURCHASE" : apiTx.kind || scrapedTx.transactionType || "PURCHASE",
        status: apiTx.status || scrapedTx.status || "Approved",
        kind: apiTx.kind || "Payment",
        country: { name: apiTx.country?.name || scrapedTx.country?.name || 'Unknown' },
        category: scrapedTx.category || getMccCategory(apiTx.mcc || '0000'),
        rowIndex: index,
        transactions: apiTx.transactions || [],
        tag1: transactionTags.tag1 || '',
        tag2: transactionTags.tag2 || '',
        tag3: transactionTags.tag3 || ''
      };
    });

    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

async function saveTagsToStorage(transactions) {
  try {
    const tagsToSave = {};
    transactions.forEach(tx => {
      tagsToSave[tx.rowIndex] = {
        tag1: tx.tag1 || '',
        tag2: tx.tag2 || '',
        tag3: tx.tag3 || ''
      };
    });
    localStorage.setItem('transactionTags', JSON.stringify(tagsToSave));
  } catch (error) {
    console.error('Error saving tags to localStorage:', error);
    alert('Failed to save tags: ' + error.message);
  }
}

async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error('CSV file must contain at least a header row and one data row'));
          return;
        }

        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          let i = 0;
          
          while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                i += 2;
              } else {
                inQuotes = !inQuotes;
                i++;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
              i++;
            } else {
              current += char;
              i++;
            }
          }
          
          result.push(current.trim());
          return result;
        };

        const rows = lines.map(parseCSVLine);
        const headers = rows[0].map(h => h.toLowerCase().trim());
        
        console.log('CSV Headers found:', headers);
        
        const findColumnIndex = (possibleNames) => {
          for (const name of possibleNames) {
            const index = headers.findIndex(h => h.includes(name.toLowerCase()));
            if (index !== -1) {
              console.log(`Found column "${name}" at index ${index}`);
              return index;
            }
          }
          return -1;
        };

        const createdAtIndex = findColumnIndex(['createdat', 'created_at', 'date', 'created', 'timestamp']);
        const merchantIndex = findColumnIndex(['merchant', 'merchantname', 'merchant_name', 'description']);
        const amountIndex = findColumnIndex(['amount', 'billingamount', 'billing_amount', 'value']);
        const tag1Index = findColumnIndex(['tag1', 'tag_1', 'tag 1', 'category1', 'label1']);
        const tag2Index = findColumnIndex(['tag2', 'tag_2', 'tag 2', 'category2', 'label2']);
        const tag3Index = findColumnIndex(['tag3', 'tag_3', 'tag 3', 'category3', 'label3']);
        const txHashIndex = findColumnIndex(['txhash', 'tx_hash', 'transactionhash', 'transaction_hash', 'hash']);

        console.log('Column indices:', {
          createdAt: createdAtIndex,
          merchant: merchantIndex,
          amount: amountIndex,
          tag1: tag1Index,
          tag2: tag2Index,
          tag3: tag3Index,
          txHash: txHashIndex
        });

        if (createdAtIndex === -1 && txHashIndex === -1) {
          reject(new Error('CSV must contain either a date column (createdAt, created_at, date, created, or timestamp) or a transaction hash column (txHash, tx_hash, transactionHash, transaction_hash, hash)'));
          return;
        }

        if (tag1Index === -1 && tag2Index === -1 && tag3Index === -1) {
          reject(new Error('CSV must contain at least one tag column (tag1, tag2, or tag3)'));
          return;
        }

        const parsedData = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          
          if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
            continue;
          }

          const maxRequiredIndex = Math.max(
            createdAtIndex !== -1 ? createdAtIndex : 0,
            merchantIndex !== -1 ? merchantIndex : 0,
            amountIndex !== -1 ? amountIndex : 0,
            tag1Index !== -1 ? tag1Index : 0,
            tag2Index !== -1 ? tag2Index : 0, 
            tag3Index !== -1 ? tag3Index : 0,
            txHashIndex !== -1 ? txHashIndex : 0
          );

          if (row.length < maxRequiredIndex + 1) {
            console.warn(`Row ${i} has insufficient columns (${row.length} vs required ${maxRequiredIndex + 1}):`, row);
            continue;
          }

          const createdAtValue = createdAtIndex !== -1 ? (row[createdAtIndex] || '').trim() : '';
          const merchantValue = merchantIndex !== -1 ? (row[merchantIndex] || '').trim() : '';
          const amountValue = amountIndex !== -1 ? (row[amountIndex] || '').trim() : '';
          const tag1Value = tag1Index !== -1 ? (row[tag1Index] || '').trim() : '';
          const tag2Value = tag2Index !== -1 ? (row[tag2Index] || '').trim() : '';
          const tag3Value = tag3Index !== -1 ? (row[tag3Index] || '').trim() : '';
          const txHashValue = txHashIndex !== -1 ? (row[txHashIndex] || '').trim() : '';

          if (!createdAtValue && !txHashValue) {
            console.warn(`Row ${i}: Missing both date and txHash values, skipping`);
            continue;
          }

          if (createdAtValue) {
            const testDate = new Date(createdAtValue);
            if (isNaN(testDate.getTime())) {
              console.warn(`Row ${i}: Invalid date "${createdAtValue}", will try txHash matching if available`);
              if (!txHashValue) {
                continue;
              }
            }
          }

          if (tag1Value || tag2Value || tag3Value) {
            const dataItem = {
              createdAt: createdAtValue,
              merchant: merchantValue,
              amount: amountValue,
              tag1: tag1Value,
              tag2: tag2Value,
              tag3: tag3Value,
              txHash: txHashValue,
              csvRowIndex: i 
            };
            
            parsedData.push(dataItem);
          } else {
            console.warn(`Row ${i}: No tags found, skipping`);
          }
        }

        console.log(`Successfully parsed ${parsedData.length} rows with tags`);
        resolve(parsedData);
        
      } catch (error) {
        console.error('CSV parsing error:', error);
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Error reading CSV file'));
    reader.readAsText(file, 'UTF-8');
  });
}

function findBestTransactionMatchByDate(csvData, allTransactions) {
  const { createdAt, merchant, amount, txHash } = csvData;
  
  console.log(`Matching CSV row with date: ${createdAt}, merchant: ${merchant}, amount: ${amount}, txHash: ${txHash}`);
  
  if (txHash && txHash.trim()) {
    console.log(`Attempting txHash match for: ${txHash}`);
    const hashMatches = allTransactions.filter(tx => {
      const txHashFromTransaction = tx.transactions?.length > 0 && tx.transactions[0].hash 
        ? tx.transactions[0].hash.toLowerCase() 
        : '';
      const csvHashLower = txHash.toLowerCase();
      
      if (txHashFromTransaction === csvHashLower) {
        console.log(`Exact txHash match found: ${txHashFromTransaction}`);
        return true;
      }
      
      if (txHashFromTransaction && csvHashLower.length >= 8) {
        const partialMatch = txHashFromTransaction.includes(csvHashLower) || 
                           csvHashLower.includes(txHashFromTransaction);
        if (partialMatch) {
          console.log(`Partial txHash match found: ${txHashFromTransaction} vs ${csvHashLower}`);
          return true;
        }
      }
      
      return false;
    });
    
    if (hashMatches.length === 1) {
      console.log(`Single txHash match found`);
      return { transaction: hashMatches[0], confidence: 'high', matchType: 'txhash_exact' };
    } else if (hashMatches.length > 1) {
      console.log(`Multiple txHash matches found, using first one`);
      return { transaction: hashMatches[0], confidence: 'medium', matchType: 'txhash_multiple' };
    } else {
      console.log(`No txHash matches found for: ${txHash}`);
    }
  }
  
  if (!createdAt || !createdAt.trim()) {
    console.warn(`No valid date for fallback matching`);
    return null;
  }
  
  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0]; 
    } catch (error) {
      console.warn(`Date normalization failed for "${dateStr}":`, error);
      return null;
    }
  };
  
  const csvDate = normalizeDate(createdAt);
  if (!csvDate) {
    console.warn(`Invalid CSV date: ${createdAt}`);
    return null;
  }
  
  const dateMatches = allTransactions.filter(tx => {
    const txDate = normalizeDate(tx.createdAt);
    return txDate === csvDate;
  });
  
  console.log(`Found ${dateMatches.length} transactions for date ${csvDate}`);
  
  if (dateMatches.length === 0) {
    console.warn(`No transactions found for date ${csvDate}`);
    return null;
  }
  
  if (dateMatches.length === 1) {
    console.log(`Single date match found for date ${csvDate}`);
    return { transaction: dateMatches[0], confidence: 'high', matchType: 'single_date' };
  }
    
  let bestMatch = null;
  let confidence = 'medium';
  
  if (merchant && merchant.trim()) {
    const merchantMatches = dateMatches.filter(tx => {
      const txMerchant = (tx.merchant?.name || '').toLowerCase();
      const csvMerchant = merchant.toLowerCase();
      const merchantMatch = txMerchant.includes(csvMerchant) || csvMerchant.includes(txMerchant);
      if (merchantMatch) {
        console.log(`Merchant match: "${txMerchant}" vs "${csvMerchant}"`);
      }
      return merchantMatch;
    });
    
    if (merchantMatches.length === 1) {
      console.log(`Single merchant match found`);
      return { transaction: merchantMatches[0], confidence: 'high', matchType: 'date_merchant' };
    } else if (merchantMatches.length > 1) {
      bestMatch = merchantMatches[0];
      confidence = 'medium';
      console.log(`Multiple merchant matches, using first one`);
    }
  }
  
  if (!bestMatch && amount && amount.trim()) {
    const csvAmount = parseFloat(amount.replace(/[^\d.-]/g, ''));
    if (!isNaN(csvAmount)) {
      const amountMatches = dateMatches.filter(tx => {
        const txAmount = parseFloat(tx.billingAmount || 0);
        const amountMatch = Math.abs(txAmount - csvAmount) < 0.01; 
        if (amountMatch) {
          console.log(`Amount match: ${txAmount} vs ${csvAmount}`);
        }
        return amountMatch;
      });
      
      if (amountMatches.length === 1) {
        console.log(`Single amount match found`);
        return { transaction: amountMatches[0], confidence: 'high', matchType: 'date_amount' };
      } else if (amountMatches.length > 1) {
        bestMatch = amountMatches[0];
        confidence = 'medium';
        console.log(`Multiple amount matches, using first one`);
      }
    }
  }
  
  if (!bestMatch) {
    bestMatch = dateMatches[0];
    confidence = 'low';
    console.warn(`⚠️ Multiple transactions for date ${csvDate}, using first transaction (low confidence)`);
  }
  
  console.log(`Final match: ${bestMatch ? 'found' : 'not found'}, confidence: ${confidence}`);
  return { transaction: bestMatch, confidence, matchType: 'date_fallback' };
}

const handleCsvLoad = async () => {
  if (csvLoadingInProgress) {
    alert('CSV loading already in progress');
    return;
  }

  csvLoadingInProgress = true;
  console.log('Starting CSV load process...');

  try {
    const csvInput = container.querySelector('#csvInput');
    if (!csvInput?.files || csvInput.files.length === 0) {
      alert('Please select a CSV file to load tags');
      console.warn('No CSV file selected');
      return;
    }

    const file = csvInput.files[0];
    console.log(`Loading CSV file: ${file.name} (${file.size} bytes)`);
    
    const parsedData = await parseCSV(file);
    console.log(`Parsed ${parsedData.length} rows from CSV`);

    if (!parsedData.length) {
      alert('No valid data with tags found in CSV. Please check your file format and ensure it includes dates and at least one tag column.');
      console.warn('No valid data in CSV');
      return;
    }

    const transactions = await getTransactions();
    allTransactions = transactions;
    console.log(`Loaded ${allTransactions.length} transactions from API`);

    let matchedCount = 0;
    let skippedCount = 0;
    const matchResults = [];
    
    for (const csvData of parsedData) {
      const matchResult = findBestTransactionMatchByDate(csvData, allTransactions);
      
      if (matchResult && matchResult.transaction) {
        matchResults.push({ csvData, ...matchResult });
        matchedCount++;
      } else {
        console.warn(`No match found for CSV row:`, csvData);
        skippedCount++;
      }
    }

    console.log(`Matching complete: ${matchedCount} matched, ${skippedCount} skipped`);

    if (matchedCount === 0) {
      alert('No matching transactions found in CSV. Please check your date values and format.');
      return;
    }

    let tagsApplied = 0;
    matchResults.forEach(({ csvData, transaction, confidence, matchType }) => {
      console.log(`Applying tags to transaction ${transaction.rowIndex}:`, {
        old: { tag1: transaction.tag1, tag2: transaction.tag2, tag3: transaction.tag3 },
        new: { tag1: csvData.tag1, tag2: csvData.tag2, tag3: csvData.tag3 },
        confidence,
        matchType
      });
      
      let tagChanged = false;
      
      if (csvData.tag1 !== undefined && csvData.tag1 !== null) {
        const newTag = String(csvData.tag1).trim();
        if (transaction.tag1 !== newTag) {
          transaction.tag1 = newTag;
          tagChanged = true;
        }
      }
      
      if (csvData.tag2 !== undefined && csvData.tag2 !== null) {
        const newTag = String(csvData.tag2).trim();
        if (transaction.tag2 !== newTag) {
          transaction.tag2 = newTag;
          tagChanged = true;
        }
      }
      
      if (csvData.tag3 !== undefined && csvData.tag3 !== null) {
        const newTag = String(csvData.tag3).trim();
        if (transaction.tag3 !== newTag) {
          transaction.tag3 = newTag;
          tagChanged = true;
        }
      }
      
      if (tagChanged) {
        tagsApplied++;
      }
    });

    await saveTagsToStorage(allTransactions);

    csvInput.value = '';

    const summaryMessage = `Successfully loaded tags for ${matchedCount} transactions (${tagsApplied} had changes)`;
    console.log(summaryMessage);
    alert(summaryMessage);

    location.reload();
    
  } catch (error) {
    console.error('Error loading tags from CSV:', error);
    alert(`Failed to load tags: ${error.message}`);
  } finally {
    csvLoadingInProgress = false;
    console.log('CSV load process completed');
  }
};

function filterTransactions(transactions) {
  const filtered = transactions.filter(tx => {
    const merchantMatch = !merchantSearch || (tx.merchant?.name || '').toLowerCase().includes(merchantSearch.toLowerCase());
    const countryMatch = selectedCountry === 'all' || tx.country?.name === selectedCountry;
    const categoryMatch = selectedCategory === 'all' || getMccCategory(tx.mcc) === selectedCategory;
    const customTagMatch = selectedCustomTag === 'all' || 
      tx.tag1 === selectedCustomTag ||
      tx.tag2 === selectedCustomTag ||
      tx.tag3 === selectedCustomTag;
    let monthMatch = true;
    if (selectedMonth !== 'all' && tx.createdAt) {
      const txDate = new Date(tx.createdAt);
      if (!isNaN(txDate.getTime())) {
        monthMatch = txDate.getMonth() + 1 === parseInt(selectedMonth, 10);
      } else {
        console.warn(`Invalid createdAt for transaction ${tx.rowIndex}: ${tx.createdAt}`);
      }
    }
    let yearMatch = true;
    if (selectedYear !== 'all' && tx.createdAt) {
      const txDate = new Date(tx.createdAt);
      if (!isNaN(txDate.getTime())) {
        yearMatch = txDate.getFullYear() === parseInt(selectedYear, 10);
      } else {
        console.warn(`Invalid createdAt for transaction ${tx.rowIndex}: ${tx.createdAt}`);
      }
    }
    const isCashbackEligible = tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc) && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType) && tx.status === 'Approved' && tx.kind !== 'Reversal';
    let cashbackMatch = true;
    if (cashbackEligible && !noCashback) {
      cashbackMatch = isCashbackEligible;
    } else if (noCashback && !cashbackEligible) {
      cashbackMatch = !isCashbackEligible;
    }
    return merchantMatch && countryMatch && categoryMatch && customTagMatch && monthMatch && yearMatch && cashbackMatch;
  });
  return filtered;
}
function updateTableHighlights(transactions, chartType = 'pie', selectedValue = null, selectedColor = null, selectedMonth = null, selectedYear = null) {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) {
    console.warn('Table not found for highlights');
    return;
  }
  const dataSource = chartType === 'pie'
    ? container.querySelector('#dataSourceSelect')?.value || 'category'
    : container.querySelector('#dataSourceSelectYearly')?.value || 'category';
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) return;
    const mccText = cells[5]?.textContent.trim() || '';
    let mcc = '0000';
    try {
      if (mccText && /\d{4}/.test(mccText)) mcc = mccText.match(/(\d{4})/)[1];
    } catch (error) {
      console.warn(`Row ${rowIndex}: Failed to parse MCC "${mccText}"`);
    }
    const matchingTransaction = transactions.find(tx => tx.rowIndex === rowIndex);
    if (!matchingTransaction || !matchingTransaction.createdAt) {
      row.classList.remove('highlight-row');
      row.querySelectorAll('td').forEach(cell => {
        cell.style.color = '';
        cell.style.fontWeight = '';
      });
      return;
    }
    const txDate = new Date(matchingTransaction.createdAt);
    if (isNaN(txDate.getTime())) {
      console.warn(`Row ${rowIndex}: Invalid transaction date "${matchingTransaction.createdAt}"`);
      return;
    }
    const rowYear = txDate.getUTCFullYear();
    const rowMonth = txDate.getUTCMonth() + 1;
    const rowValue = getDataValue(matchingTransaction, dataSource);
    const highlightKeyMonth = `${rowYear}-${rowMonth}-${rowValue}-${chartType}-${dataSource}`;
    const highlightKeyAll = `all-${rowValue}-${chartType}-${dataSource}`;
    const shouldHighlight = selectedValue && (selectedHighlights.has(highlightKeyMonth) || selectedHighlights.has(highlightKeyAll));
    const isMatchingFilter =
      rowValue === selectedValue &&
      (!selectedMonth || selectedMonth === 'all' || parseInt(selectedMonth) === rowMonth) &&
      (!selectedYear || selectedYear === 'all' || parseInt(selectedYear) === rowYear);
    if (shouldHighlight && rowValue === selectedValue && isMatchingFilter) {
      row.classList.add('highlight-row');
      row.querySelectorAll('td').forEach(cell => {
        cell.style.color = selectedColor || '';
        cell.style.fontWeight = 'bold';
      });
    } else {
      row.classList.remove('highlight-row');
      row.querySelectorAll('td').forEach(cell => {
        cell.style.color = '';
        cell.style.fontWeight = '';
      });
    }
  });
}

function updateTableDisplay(transactions) {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) {
    console.warn('Table not found for update');
    return;
  }
  
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    console.warn('Table body not found');
    return;
  }
  
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    if (row.querySelector('th')) return;
    const matchingTx = transactions.find(tx => tx.rowIndex === index);
    row.style.display = matchingTx ? '' : 'none';
  });
  
  if (!csvLoadingInProgress) {
    try {
      updateTableHighlights(transactions);
    } catch (error) {
      console.warn('updateTableHighlights failed:', error);
    }
    
    try {
      if (typeof updateTableCashbackHighlights === 'function') {
        updateTableCashbackHighlights(transactions);
      }
    } catch (error) {
      console.warn('updateTableCashbackHighlights failed:', error);
    }
  }
}

function populateMonthDropdown(transactions) {
  const monthSelect = container?.querySelector('#monthFilter');
  if (!monthSelect) return;
  const validTransactions = transactions.filter(tx => tx.createdAt && !isNaN(new Date(tx.createdAt).getTime()));
  const months = [...new Set(
    validTransactions.map(tx => new Date(tx.createdAt).getMonth() + 1)
  )].sort((a, b) => a - b);
  monthSelect.innerHTML = '<option value="all">All Months</option>';
  months.forEach(month => {
    const option = document.createElement('option');
    const date = new Date(2000, month - 1, 1);
    option.value = month;
    option.textContent = date.toLocaleString('default', { month: 'long' });
    monthSelect.appendChild(option);
  });
}

function populateYearDropdown(transactions) {
  const yearSelect = container?.querySelector('#yearFilter');
  if (!yearSelect) return;
  const validTransactions = transactions.filter(tx => tx.createdAt && !isNaN(new Date(tx.createdAt).getTime()));
  const years = [...new Set(
    validTransactions.map(tx => new Date(tx.createdAt).getFullYear())
  )].sort((a, b) => a - b);
  yearSelect.innerHTML = '<option value="all">All Years</option>';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

  function populateCountryDropdown(transactions) {
    const countrySelect = container?.querySelector('#countryFilter');
    if (!countrySelect) return;
    const countries = [...new Set(transactions.map(tx => tx.country?.name || 'Unknown').filter(name => name))].sort();
    countrySelect.innerHTML = '<option value="all">All Countries</option>';
    countries.forEach(country => {
      const option = document.createElement('option');
      option.value = country;
      option.textContent = country;
      countrySelect.appendChild(option);
    });
  }

  function populateCategoryDropdown(transactions) {
    const categorySelect = container?.querySelector('#categoryFilter');
    if (!categorySelect) return;
    const categories = [...new Set(transactions.map(tx => getMccCategory(tx.mcc)))].sort();
    categorySelect.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });
  }

function populateCustomTagDropdown(transactions) {
  const customTagSelect = container?.querySelector('#customTagFilter');
  if (!customTagSelect) return;
  
  const allTags = new Set();
  transactions.forEach(tx => {
    if (tx.tag1 && tx.tag1.trim()) allTags.add(tx.tag1.trim());
    if (tx.tag2 && tx.tag2.trim()) allTags.add(tx.tag2.trim());
    if (tx.tag3 && tx.tag3.trim()) allTags.add(tx.tag3.trim());
  });
  
  const sortedTags = Array.from(allTags).sort();
  customTagSelect.innerHTML = '<option value="all">All Custom Tags</option>';
  
  sortedTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    customTagSelect.appendChild(option);
  });
}

  async function setupButtonListeners() {
    const findWalletButton = () => {
      const tabList = document.querySelector('div[role="tablist"]');
      return tabList ? Array.from(tabList.querySelectorAll('[role="tab"]')).find(btn => btn.textContent.trim() === 'Wallet') : null;
    };
    const findCardButton = () => {
      const tabList = document.querySelector('div[role="tablist"]');
      return tabList ? Array.from(tabList.querySelectorAll('[role="tab"]')).find(btn => btn.textContent.trim() === 'Card') : null;
    };
    const removeChart = () => {
      if (container) {
        container.remove();
        container = null;
        chartContainerExists = false;
      }
    };
    const addClickListener = async (button, type) => {
      if (button && !button.dataset.listenerAdded) {
        button.addEventListener('click', async () => {
          if (type === 'Wallet') {
            removeChart();
            isInitialized = false;
          } else if (type === 'Card') {
            removeChart();
            isInitialized = false;
            await init();
          }
        });
        button.dataset.listenerAdded = 'true';
      }
    };
    let walletButton = findWalletButton();
    let cardButton = findCardButton();
    await addClickListener(walletButton, 'Wallet');
    await addClickListener(cardButton, 'Card');
    let retryCount = 0;
    const maxRetries = 10;
    const retryButtonDetection = async () => {
      if (retryCount >= maxRetries) return;
      walletButton = findWalletButton();
      cardButton = findCardButton();
      if (!walletButton || !cardButton) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        await addClickListener(findWalletButton(), 'Wallet');
        await addClickListener(findCardButton(), 'Card');
        await retryButtonDetection();
      }
    };
    await retryButtonDetection();
    const buttonObserver = new MutationObserver(async () => {
      const newWalletButton = findWalletButton();
      const newCardButton = findCardButton();
      await addClickListener(newWalletButton, 'Wallet');
      await addClickListener(newCardButton, 'Card');
    });
    const tabContainer = document.querySelector('div[role="tablist"]') || document.body;
    buttonObserver.observe(tabContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected']
    });
  }

async function createSpendingChart(transactions) {
  const fineTransactions = transactions.filter(
    tx => tx.status === 'Approved' && tx.kind !== 'Reversal'
  );
  allTransactions = fineTransactions;
  if (!Array.isArray(fineTransactions) || !fineTransactions.length) {
    container = document.createElement('div');
    container.className = 'financial-container';
    container.innerHTML = `<div class="chart-container"><div class="total-spent">Error: No valid transactions found</div></div>`;
    const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
    if (table && table.parentNode) table.parentNode.insertBefore(container, table);
    else document.body.appendChild(container);
    chartContainerExists = true;
    return;
  }
  if (chartContainerExists) {
    await updateChart(transactions);
    await updateYearlyHistogram(transactions);
    return;
  }
  const waitForContainer = () => {
    return new Promise(resolve => {
      const checkContainer = () => {
        const transactionHeader = document.querySelector('.flex.flex-row.gap-4.sm\\:gap-0.justify-between.items-start.pb-5.sm\\:pb-0');
        const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
        if (transactionHeader || table) resolve({ transactionHeader, table });
        else setTimeout(checkContainer, 200);
      };
      checkContainer();
    });
  };
  
  const { transactionHeader, table } = await waitForContainer();
  container = document.createElement('div');
  container.className = 'financial-container';
container.innerHTML = `
    <div class="chart-container">
      <div class="visibility-controls">
        <button id="toggleMonthlyChart" data-active="false">Monthly Chart</button>
        <button id="toggleYearlyChart" data-active="false">Yearly Chart</button>
        <button id="toggleCashbackCalculator" data-active="false">Cashback Calculator</button>
        <button id="toggleFilterTool" data-active="false">Transaction Filter</button>
        <button id="toggleCustomTags" data-active="false">Custom Tags</button>
        <button id="openVisaCalculator">Visa Exchange Rate</button>
        <button id="aboutMeButton" title="About this extension">?</button>
      </div>
      <div class="filter-tool-wrapper" id="filterToolWrapper" style="display: none;">
        <div class="transaction-filter-tool">
          <h3>Transaction Filter Tool</h3>
          <div class="filter-controls">
            <div class="search-bar">
              <input type="text" id="merchantSearch" placeholder="Search by merchant name..." />
            </div>
            <div class="filter-group">
              <label>Country:</label>
              <select id="countryFilter">
                <option value="all">All Countries</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Category:</label>
              <select id="categoryFilter">
                <option value="all">All Categories</option>
              </select>
            </div>
            <div class="filter-group">
            <label>Custom Tag:</label>
            <select id="customTagFilter">
            <option value="all">All Custom Tags</option>
            </select>
            </div>
            <div class="filter-group">
              <label>Month:</label>
              <select id="monthFilter">
                <option value="all">All Months</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Year:</label>
              <select id="yearFilter">
                <option value="all">All Years</option>
              </select>
            </div>
            <div class="filter-group">
              <button id="cashbackEligibleFilter" data-active="false">Cashback Eligible</button>
              <button id="noCashbackFilter" data-active="false">No Cashback</button>
            </div>
          </div>
        </div>
      </div>
      <div class="chart-wrapper" id="monthlyChartWrapper" style="display: none;">
        <div class="chart-title">Monthly Spending</div>
        <div class="chart-controls" style="display: none;">
          <select id="monthSelect"></select>
          <select id="yearSelect"></select>
          <select id="dataSourceSelect">
          <option value="category">Category</option>
          <option value="tag1">Tag1</option>
          <option value="tag2">Tag2</option>
          <option value="tag3">Tag3</option>
        </select>
        </div>
        <canvas id="spendingChart" width="260" height="260"></canvas>
        <div class="total-spent" id="totalSpent"></div>
        <div class="chart-legend" id="pieChartLegend"></div>
      </div>
      <div class="chart-wrapper" id="yearlyChartWrapper" style="display: none;">
        <div class="chart-title">Yearly Spending</div>
         <div class="chart-controls">
        <select id="dataSourceSelectYearly">
          <option value="category">Category</option>
          <option value="tag1">Tag1</option>
          <option value="tag2">Tag2</option>
          <option value="tag3">Tag3</option>
        </select>
      </div>
        <canvas id="yearlyHistogram" width="260" height="260"></canvas>
        <div class="total-spent" id="yearlyTotalSpent"></div>
        <div class="chart-legend" id="histogramLegend"></div>
      </div>
      <div class="cashback-calculator" id="cashbackCalculatorWrapper" style="display: none;">
        <div class="chart-title">Cashback Calculator</div>
        <div class="calculator-controls">
          <label>Week: <select id="weekSelect"></select></label>
          <label>GNO Amount: <input type="number" id="gnoAmount" step="0.1" min="0" placeholder="e.g., 0.1"></label>
          <label><input type="checkbox" id="ogNft"> Owns OG NFT (+1%)</label>
          <button id="calculateCashback">Calculate</button>
        </div>
        <div class="cashback-result" id="cashbackResult">Cashback: £0.00 (0% rate)</div>
        <div class="cashback-result" id="eligibleSpending">Eligible Spending: £0.00</div>
        <div class="cashback-result" id="remainingEligible">Remaining Eligible Spending: £0.00 (of 5,000 weekly cap)</div>
      </div>
      <div class="custom-tags-module" id="customTagsModule" style="display: none;">
        <div class="chart-title">Custom Tags</div>
        <div class="custom-tags-controls">
          <label>Tag1: <input type="text" id="tag1Input" placeholder="Enter Tag1"></label>
          <label>Tag2: <input type="text" id="tag2Input" placeholder="Enter Tag2"></label>
          <label>Tag3: <input type="text" id="tag3Input" placeholder="Enter Tag3"></label>
          <label>Load CSV: <input type="file" id="csvInput" accept=".csv"></label>
          <button id="applyTags">Apply</button>
          <button id="loadTags">Load</button>
          <button id="clearTags">Clear Tags</button>
        </div>
      </div>
      <div class="about-me-modal" id="aboutMeModal">
        <div class="about-me-modal-content">
          <button class="close-modal-button" id="closeAboutMeModal">×</button>
          <h2>About me</h2>
          <p>I have been a DeFi user for a fairly long time, and I'm most notably a member of Harvest's team (<b><u><a href="https://www.harvest.finance/" target="_blank" rel="noopener noreferrer">harvest.finance</a></u></b>). I have no association with Gnosis Pay's team. Feel free to reach out on Twitter (<b><u><a href="https://x.com/_kobrad" target="_blank" rel="noopener noreferrer">@_kobrad</a></b></u>) or Discord (<b>.kobrad</b>)</p>
          <h3>Disclaimer</h3>
          <p>This extension's purpose is to enhance the UI and give access to information that is mostly available via API. I have no access to your data as this runs in your browser however, a few words of caution are still necessary:</p>
          <p>Not everyone on Web3 is here to help you. I might even say that there are more malicious agents than not. Hence, be very vigilant, especially when using code from third parties.</p>
          <p>If you do want to use external code, it would be better to read the code first (or at least verify via AI if this is dangerous in any way). The code for the extension is contained within content.js. You're more than encouraged to have a look at the code.</p>
          <p>This code will work as intended, as it is within a vanilla environment. If you make changes or add further extensions, I cannot guarantee that things won't break or sensitive data may become accessible (in particular if extensions are made on purpose by malicious agents). As always, be cautious.</p>
        </div>
      </div>
    </div>
  `;
await setupTagLoadingListeners();
  if (transactionHeader && transactionHeader.parentNode) transactionHeader.parentNode.insertBefore(container, transactionHeader.nextElementSibling);
  else if (table) table.parentNode.insertBefore(container, table);
  else document.body.appendChild(container);
  chartContainerExists = true;
  const monthSelect = container.querySelector('#monthSelect');
  const yearSelect = container.querySelector('#yearSelect');
  const weekSelect = container.querySelector('#weekSelect');
  const validTransactions = transactions.filter(tx => tx.createdAt && !isNaN(new Date(tx.createdAt).getTime()));
  const transactionYears = [...new Set(validTransactions.map(tx => new Date(tx.createdAt).getFullYear()))].sort((a, b) => a - b);
  const mostRecentDate = validTransactions
    .map(tx => new Date(tx.createdAt))
    .sort((a, b) => b - a)[0] || new Date();
  const defaultMonth = mostRecentDate.getMonth() + 1;
  const defaultYear = mostRecentDate.getFullYear();
  if (transactionYears.length > 0) {
    transactionYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === defaultYear) option.selected = true;
      yearSelect.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.value = defaultYear;
    option.textContent = defaultYear;
    option.selected = true;
    yearSelect.appendChild(option);
  }
  function populateMonthDropdownChart(selectedYear) {
    monthSelect.innerHTML = '';
    const monthsWithTransactions = [...new Set(
      validTransactions
        .filter(tx => new Date(tx.createdAt).getFullYear() === parseInt(selectedYear))
        .map(tx => new Date(tx.createdAt).getMonth() + 1)
    )].sort((a, b) => a - b);
    if (monthsWithTransactions.length === 0) {
      for (let i = 0; i < 12; i++) {
        const option = document.createElement('option');
        const date = new Date(2000, i, 1);
        option.value = i + 1;
        option.textContent = date.toLocaleString('default', { month: 'long' });
        if (i + 1 === defaultMonth && selectedYear == defaultYear) option.selected = true;
        monthSelect.appendChild(option);
      }
    } else {
      monthsWithTransactions.forEach(month => {
        const option = document.createElement('option');
        const date = new Date(2000, month - 1, 1);
        option.value = month;
        option.textContent = date.toLocaleString('default', { month: 'long' });
        if (month === defaultMonth && selectedYear == defaultYear) option.selected = true;
        monthSelect.appendChild(option);
      });
    }
  }
  function populateWeekDropdown(transactions) {
    weekSelect.innerHTML = '';
    const validTxs = transactions.filter(tx => tx.clearedAt && !isNaN(new Date(tx.clearedAt).getTime()));
    if (!validTxs.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No eligible weeks';
      option.disabled = true;
      option.selected = true;
      weekSelect.appendChild(option);
      return;
    }
    const weeks = new Set();
    validTxs.forEach(tx => {
      const isEligible = tx.mcc &&
        !NO_CASHBACK_MCCS.includes(tx.mcc) &&
        !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType);
      if (!isEligible) return;
      const clearedDate = new Date(tx.clearedAt);
      const dayOfWeek = clearedDate.getUTCDay();
      const sunday = new Date(clearedDate);
      sunday.setUTCDate(clearedDate.getUTCDate() - dayOfWeek);
      sunday.setUTCHours(0, 0, 0, 0);
      const saturday = new Date(sunday);
      saturday.setUTCDate(sunday.getUTCDate() + 6);
      saturday.setUTCHours(23, 59, 59, 999);
      const weekKey = `${sunday.toISOString()}|${saturday.toISOString()}`;
      weeks.add(weekKey);
    });
    const sortedWeeks = [...weeks].sort((a, b) => new Date(a.split('|')[0]) - new Date(b.split('|')[0])).reverse();
    sortedWeeks.forEach((weekKey, index) => {
      const [start, end] = weekKey.split('|').map(d => new Date(d));
      const option = document.createElement('option');
      option.value = weekKey;
      option.textContent = `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      if (index === 0) option.selected = true;
      weekSelect.appendChild(option);
    });
    if (!sortedWeeks.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No eligible weeks';
      option.disabled = true;
      option.selected = true;
      weekSelect.appendChild(option);
    }
  }
  populateMonthDropdown(fineTransactions);
  populateYearDropdown(fineTransactions);
  populateCountryDropdown(fineTransactions);
  populateCategoryDropdown(fineTransactions);
  populateCustomTagDropdown(fineTransactions);
  populateMonthDropdownChart(defaultYear);
  populateWeekDropdown(fineTransactions);
  const waitForControls = () => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      const checkControls = () => {
        const monthFilter = container.querySelector('#monthFilter');
        const yearFilter = container.querySelector('#yearFilter');
        if (
          monthSelect &&
          yearSelect &&
          weekSelect &&
          monthSelect.options.length > 0 &&
          yearSelect.options.length > 0 &&
          monthFilter &&
          monthFilter.options.length > 1 &&
          yearFilter &&
          yearFilter.options.length > 1
        ) resolve();
        else {
          attempts++;
          if (attempts >= maxAttempts) reject(new Error('Chart controls or filter dropdowns not found or not populated'));
          else setTimeout(checkControls, 100);
        }
      };
      checkControls();
    });
  };
  try {
    await waitForControls();
    setupFilterListeners();
    setupVisibilityToggles();
  } catch (error) {
    container.querySelector('#totalSpent').textContent = 'Error: Failed to initialize chart controls';
    console.error('Failed to initialize chart controls:', error);
    return;
  }
  await updateChart(transactions);
  await updateYearlyHistogram(transactions);

function setupVisibilityToggles() {
  const monthlyChartButton = container.querySelector('#toggleMonthlyChart');
  const yearlyChartButton = container.querySelector('#toggleYearlyChart');
  const cashbackCalculatorButton = container.querySelector('#toggleCashbackCalculator');
  const filterToolButton = container.querySelector('#toggleFilterTool');
  const customTagsButton = container.querySelector('#toggleCustomTags');
  const visaCalculatorButton = container.querySelector('#openVisaCalculator');
  const aboutMeButton = container.querySelector('#aboutMeButton');
  const aboutMeModal = container.querySelector('#aboutMeModal');
  const closeModalButton = container.querySelector('#closeAboutMeModal');
  const monthlyChartWrapper = container.querySelector('#monthlyChartWrapper');
  const yearlyChartWrapper = container.querySelector('#yearlyChartWrapper');
  const cashbackCalculatorWrapper = container.querySelector('#cashbackCalculatorWrapper');
  const filterToolWrapper = container.querySelector('#filterToolWrapper');
  const customTagsModule = container.querySelector('#customTagsModule');
  const chartControls = container.querySelector('.chart-controls');

  function toggleCustomTagsColumn(show) {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) return;
  const headers = table.querySelectorAll('thead tr th');
  const customTagsHeader = Array.from(headers).find(th => th.textContent.trim() === 'Select');
  if (customTagsHeader) customTagsHeader.style.display = show ? '' : 'none';
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const customTagsCell = row.querySelector('.custom-tags-column');
    if (customTagsCell) {
      customTagsCell.style.display = show ? '' : 'none';
      const checkbox = customTagsCell.querySelector('.custom-tags-checkbox');
      if (checkbox) checkbox.style.display = show ? '' : 'none';
    }
  });
}

  function resetFilters(preserveCashback = false) {
    merchantSearch = '';
    selectedCountry = 'all';
    selectedCategory = 'all';
    selectedCustomTag = 'all';
    selectedMonth = 'all';
    selectedYear = 'all';
    if (!preserveCashback) {
      cashbackEligible = false;
      noCashback = false;
    }
    const merchantSearchInput = container.querySelector('#merchantSearch');
    const countrySelect = container.querySelector('#countryFilter');
    const categorySelect = container.querySelector('#categoryFilter');
    const customTagSelect = container.querySelector('#customTagFilter');
    const monthSelect = container.querySelector('#monthFilter');
    const yearSelect = container.querySelector('#yearFilter');
    const cashbackEligibleButton = container.querySelector('#cashbackEligibleFilter');
    const noCashbackButton = container.querySelector('#noCashbackFilter');
    if (merchantSearchInput) merchantSearchInput.value = '';
    if (countrySelect) countrySelect.value = 'all';
    if (categorySelect) categorySelect.value = 'all';
    if (customTagSelect) customTagSelect.value = 'all';
    if (monthSelect) monthSelect.value = 'all';
    if (yearSelect) yearSelect.value = 'all';
    if (cashbackEligibleButton) cashbackEligibleButton.setAttribute('data-active', cashbackEligible);
    if (noCashbackButton) noCashbackButton.setAttribute('data-active', noCashback);
    const filteredTransactions = filterTransactions(allTransactions);
    updateTableDisplay(filteredTransactions);
    updateChart(filteredTransactions);
    updateYearlyHistogram(filteredTransactions);
    populateWeekDropdown(filteredTransactions);
  }

  function toggleButton(button, wrapper, additionalWrapper = null) {
    if (!button || !wrapper) return;
    const isActive = button.getAttribute('data-active') === 'true';
    button.setAttribute('data-active', !isActive);
    wrapper.style.display = isActive ? 'none' : 'block';
    if (additionalWrapper) {
      additionalWrapper.style.display = isActive ? 'none' : 'flex';
    }
    if (button === filterToolButton && !isActive) {
      setupFilterListeners();
      populateMonthDropdown(allTransactions);
      populateYearDropdown(allTransactions);
      populateCountryDropdown(allTransactions);
      populateCategoryDropdown(allTransactions);
      populateCustomTagDropdown(allTransactions);
    }
    if (button === cashbackCalculatorButton) {
      if (isActive) {
        clearCashbackHighlights();
      }
      if (!isActive) {
        resetFilters(false);
      }
    } else if (button === filterToolButton) {
      if (isActive) {
        resetFilters(true);
      }
    } else if (button === customTagsButton) {
      toggleCustomTagsColumn(!isActive);
      if (isActive) {
      }
    }
  }

  if (monthlyChartButton && monthlyChartWrapper && chartControls) {
    monthlyChartButton.addEventListener('click', () => toggleButton(monthlyChartButton, monthlyChartWrapper, chartControls));
  }
  if (yearlyChartButton && yearlyChartWrapper) {
    yearlyChartButton.addEventListener('click', () => toggleButton(yearlyChartButton, yearlyChartWrapper));
  }
  if (cashbackCalculatorButton && cashbackCalculatorWrapper) {
    cashbackCalculatorButton.addEventListener('click', () => toggleButton(cashbackCalculatorButton, cashbackCalculatorWrapper));
  }
  if (filterToolButton && filterToolWrapper) {
    filterToolButton.addEventListener('click', () => toggleButton(filterToolButton, filterToolWrapper));
  }
  if (customTagsButton && customTagsModule) {
    customTagsButton.addEventListener('click', () => toggleButton(customTagsButton, customTagsModule));
  }
  if (visaCalculatorButton) {
    visaCalculatorButton.addEventListener('click', () => {
      window.open('https://www.visa.co.uk/support/consumer/travel-support/exchange-rate-calculator.html', '_blank');
    });
  }
  if (aboutMeButton && aboutMeModal) {
    aboutMeButton.addEventListener('click', () => {
      aboutMeModal.style.display = 'flex';
    });
  }
  if (closeModalButton && aboutMeModal) {
    closeModalButton.addEventListener('click', () => {
      aboutMeModal.style.display = 'none';
    });
  }
  if (aboutMeModal) {
    aboutMeModal.addEventListener('click', (event) => {
      if (event.target === aboutMeModal) {
        aboutMeModal.style.display = 'none';
      }
    });
  }
}

function clearTags() {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) {
    alert('Table not found');
    return;
  }

  const checkboxes = table.querySelectorAll('.custom-tags-checkbox:checked');
  let targetTransactions = [];

  if (checkboxes.length > 0) {
    checkboxes.forEach(checkbox => {
      const rowIndex = parseInt(checkbox.dataset.rowIndex);
      const transaction = allTransactions.find(tx => tx.rowIndex === rowIndex);
      if (transaction) targetTransactions.push({ transaction, rowIndex });
    });
  } else {
    targetTransactions = allTransactions.map((tx, index) => ({ transaction: tx, rowIndex: index }));
  }

  if (!targetTransactions.length) {
    alert('No transactions available to clear tags');
    return;
  }

  targetTransactions.forEach(({ transaction, rowIndex }) => {
    transaction.tag1 = '';
    transaction.tag2 = '';
    transaction.tag3 = '';

    const row = Array.from(table.querySelectorAll('tbody tr')).find(r => {
      const cb = r.querySelector('.custom-tags-checkbox');
      return cb && parseInt(cb.dataset.rowIndex) === rowIndex;
    });

    if (row) {
      const tag1Cell = row.querySelector('.tag1-cell');
      const tag2Cell = row.querySelector('.tag2-cell');
      const tag3Cell = row.querySelector('.tag3-cell');
      if (tag1Cell) tag1Cell.textContent = '';
      if (tag2Cell) tag2Cell.textContent = '';
      if (tag3Cell) tag3Cell.textContent = '';
    }
  });

  saveTagsToStorage(allTransactions);

  checkboxes.forEach(checkbox => (checkbox.checked = false));

  populateCustomTagDropdown(allTransactions);
  const filteredTransactions = filterTransactions(allTransactions);
  updateTableDisplay(filteredTransactions);
  updateChart(filteredTransactions);
  updateYearlyHistogram(filteredTransactions);
  
  alert(`Successfully cleared tags for ${targetTransactions.length} transactions`);
}


function setupFilterListeners() {
  const merchantSearchInput = container.querySelector('#merchantSearch');
  const countrySelect = container.querySelector('#countryFilter');
  const categorySelect = container.querySelector('#categoryFilter');
  const customTagSelect = container.querySelector('#customTagFilter');
  const monthSelect = container.querySelector('#monthFilter');
  const yearSelect = container.querySelector('#yearFilter');
  const cashbackEligibleButton = container.querySelector('#cashbackEligibleFilter');
  const noCashbackButton = container.querySelector('#noCashbackFilter');
  function applyFilters() {
    const filteredTransactions = filterTransactions(allTransactions);
    updateTableDisplay(filteredTransactions);
    updateChart(filteredTransactions);
    updateYearlyHistogram(filteredTransactions);
    populateWeekDropdown(filteredTransactions);
  }
  if (merchantSearchInput) {
    merchantSearchInput.addEventListener('input', () => {
      merchantSearch = merchantSearchInput.value.trim();
      applyFilters();
    });
  } else {
    console.warn('Merchant search input not found');
  }
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      selectedCountry = countrySelect.value;
      applyFilters();
    });
  } else {
    console.warn('Country select not found');
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      selectedCategory = categorySelect.value;
      applyFilters();
    });
  } else {
    console.warn('Category select not found');
  }
  if (customTagSelect) {
    customTagSelect.addEventListener('change', () => {
      selectedCustomTag = customTagSelect.value;
      applyFilters();
    });
  } else {
    console.warn('Custom tag select not found');
  }
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      selectedMonth = monthSelect.value;
      applyFilters();
    });
  } else {
    console.warn('Month select not found');
  }
  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      selectedYear = yearSelect.value;
      applyFilters();
    });
  } else {
    console.warn('Year select not found');
  }
  if (cashbackEligibleButton) {
    cashbackEligibleButton.addEventListener('click', () => {
      cashbackEligible = !cashbackEligible;
      if (cashbackEligible) noCashback = false;
      cashbackEligibleButton.setAttribute('data-active', cashbackEligible);
      const noCashbackBtn = container.querySelector('#noCashbackFilter');
      if (noCashbackBtn) noCashbackBtn.setAttribute('data-active', noCashback);
      applyFilters();
    });
  } else {
    console.warn('Cashback eligible button not found');
  }
  if (noCashbackButton) {
    noCashbackButton.addEventListener('click', () => {
      noCashback = !noCashback;
      if (noCashback) cashbackEligible = false;
      noCashbackButton.setAttribute('data-active', noCashback);
      const cashbackEligibleBtn = container.querySelector('#cashbackEligibleFilter');
      if (cashbackEligibleBtn) cashbackEligibleBtn.setAttribute('data-active', cashbackEligible);
      applyFilters();
    });
  } else {
    console.warn('No cashback button not found');
  }
}

    setupFilterListeners();
    function calculateCashbackRate(gnoAmount, hasOgNft) {
      let baseRate = 0;
      if (gnoAmount >= 0.1 && gnoAmount < 1) baseRate = 1 + ((gnoAmount - 0.1) / (1 - 0.1)) * (2 - 1);
      else if (gnoAmount >= 1 && gnoAmount < 10) baseRate = 2 + ((gnoAmount - 1) / (10 - 1)) * (3 - 2);
      else if (gnoAmount >= 10 && gnoAmount < 100) baseRate = 3 + ((gnoAmount - 10) / (100 - 10)) * (4 - 3);
      else if (gnoAmount >= 100) baseRate = 4;
      baseRate = Math.min(baseRate, 4);
      const totalRate = (hasOgNft && gnoAmount >= 0.1) ? Math.min(baseRate + 1, 5) : baseRate;
      return totalRate / 100;
    }
function calculateCashback(transactions, weekPeriod, gnoAmount, hasOgNft) {
  let from = null;
  let to = null;
  if (weekPeriod) {
    const [start, end] = weekPeriod.split('|').map(d => {
      const date = new Date(d);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid weekPeriod date: ${d}`);
        return null;
      }
      date.setUTCHours(0, 0, 0, 0);
      return date;
    });
    if (start && end) {
      from = start;
      to = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
    } else {
      console.warn('Invalid weekPeriod, no date filtering applied');
      return { totalCashback: 0, cashbackRate: 0, filteredTransactions: [], currency: '£' };
    }
  } else {
    console.warn('No weekPeriod provided, no date filtering applied');
    return { totalCashback: 0, cashbackRate: 0, filteredTransactions: [], currency: '£' };
  }
  const filteredTransactions = transactions.filter(tx => {
    const dateField = tx.clearedAt || tx.createdAt;
    if (!dateField) {
      console.warn(`Transaction ${tx.rowIndex} skipped: No valid date field`);
      return false;
    }
    if (tx.isPending || tx.status !== 'Approved' || tx.kind === 'Reversal') {
      return false;
    }
    const txDate = new Date(dateField);
    if (isNaN(txDate.getTime())) {
      console.warn(`Transaction ${tx.rowIndex} skipped: Invalid date ${dateField}`);
      return false;
    }
    const isInDateRange = txDate >= from && txDate <= to;
    const isEligibleMcc = tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc);
    const isEligibleType = tx.transactionType && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType);
    return isInDateRange && isEligibleMcc && isEligibleType;
  });
  const cashbackRate = calculateCashbackRate(gnoAmount, hasOgNft);
  const weeklyCap = 5000;
  const eligibleSpending = filteredTransactions.reduce((sum, tx) => {
    const amount = parseFloat(tx.billingAmount) || 0;
    return sum + amount;
  }, 0);
  const cappedSpending = Math.min(eligibleSpending, weeklyCap);
  const totalCashback = cappedSpending * cashbackRate;
  const remainingEligible = Math.max(0, weeklyCap - eligibleSpending);
  const currencySymbol = filteredTransactions[0]?.billingCurrency?.symbol || '£';
  return { totalCashback, cashbackRate: cashbackRate * 100, filteredTransactions, currency: currencySymbol, eligibleSpending, remainingEligible };
}

function clearCashbackHighlights() {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) {
    console.warn('Table not found for hiding cashback highlights');
    return;
  }
  const emojis = table.querySelectorAll('.hand-emoji');
  emojis.forEach((emoji, index) => {
    emoji.style.display = 'none';
  });
}

function updateTableCashbackHighlights(filteredTransactions) {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) {
    console.warn('Table not found for cashback highlights');
    return;
  }

  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) {
      console.warn(`Row ${rowIndex}: Insufficient cells (${cells.length})`);
      return;
    }

    const merchantText = cells[2]?.textContent.trim() || '';
    if (merchantText.toUpperCase().includes('PENDING') || merchantText.toUpperCase().includes('DECLINED') || merchantText.toUpperCase().includes('INSUFFICIENT')) {
      return;
    }

    const isIncluded = filteredTransactions.some(tx => tx.rowIndex === rowIndex);

    const dateCell = cells[0];
    const existingEmoji = dateCell.querySelector('.hand-emoji');
    if (existingEmoji) {
      existingEmoji.remove();
    }

    if (isIncluded) {
      const emoji = document.createElement('span');
      emoji.className = 'hand-emoji';
      emoji.textContent = '👉';
      dateCell.insertBefore(emoji, dateCell.firstChild);
    }
  });
}

    function generateColors(count) {
      const colors = [];
      const hueStep = 360 / count;
      for (let i = 0; i < count; i++) {
        const hue = Math.floor(i * hueStep) % 360;
        colors.push(`hsl(${hue}, 70%, 50%)`);
      }
      return colors;
    }
    
   async function updateChart(transactionsToUse = allTransactions) {
  if (!container) return;
  transactionsToUse = transactionsToUse.filter(
    tx => tx.status === 'Approved' && tx.kind !== 'Reversal'
  );
  const chartContainer = container.querySelector('#spendingChart');
  const dataSourceSelect = container.querySelector('#dataSourceSelect');
  const dataSource = dataSourceSelect?.value || 'category';
  if (!chartContainer) {
    container.querySelector('#totalSpent').textContent = 'Error: Pie chart container not found';
    return;
  }
  const month = monthSelect && monthSelect.value ? parseInt(monthSelect.value) : defaultMonth;
  const year = yearSelect && yearSelect.value ? parseInt(yearSelect.value) : defaultYear;
  const monthlyTransactions = transactionsToUse.filter(tx => {
    if (!tx.createdAt) return false;
    const txDate = new Date(tx.createdAt);
    if (isNaN(txDate.getTime())) return false;
    return txDate.getMonth() + 1 === month && txDate.getFullYear() === year;
  });
  const allDataValues = [...new Set(monthlyTransactions.map(tx => getDataValue(tx, dataSource)))].sort();
  const colors = generateColors(allDataValues.length);
  const pieDataColors = {};
  allDataValues.forEach((value, i) => pieDataColors[value] = colors[i]);
  const legendContainer = container.querySelector('#pieChartLegend');
  legendContainer.innerHTML = '';
  if (monthlyTransactions.length) {
    const dataTotals = {};
    monthlyTransactions.forEach(tx => {
      const value = getDataValue(tx, dataSource);
      const amount = parseFloat(tx.billingAmount) || 0;
      dataTotals[value] = (dataTotals[value] || 0) + amount;
    });
    const total = Object.values(dataTotals).reduce((sum, amount) => sum + amount, 0);
    allDataValues.forEach((value, i) => {
      const amount = dataTotals[value] || 0;
      const percentage = total > 0 ? (amount / total * 100).toFixed(1) : 0;
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.dataset.category = value;
      legendItem.dataset.color = colors[i];
      legendItem.dataset.chart = 'pie';
      legendItem.style.cursor = 'pointer';
      legendItem.innerHTML = `
        <div class="legend-color" style="background:${colors[i]}"></div>
        ${value}: ${percentage}%
      `;
      legendItem.addEventListener('click', () => toggleHighlight(value, colors[i], month, year, monthlyTransactions, 'pie'));
      legendContainer.appendChild(legendItem);
    });
  }
  if (!monthlyTransactions.length) {
    const monthName = monthSelect && monthSelect.options[month - 1]
      ? monthSelect.options[month - 1].textContent
      : `Month ${month}`;
    container.querySelector('#totalSpent').textContent = `No transactions found for ${monthName} ${year}`;
    chartContainer.getContext('2d').clearRect(0, 0, chartContainer.width, chartContainer.height);
    return;
  }
  const dataTotals = {};
  monthlyTransactions.forEach(tx => {
    const value = getDataValue(tx, dataSource);
    const amount = parseFloat(tx.billingAmount) || 0;
    dataTotals[value] = (dataTotals[value] || 0) + amount;
  });
  const sortedData = Object.entries(dataTotals).sort((a, b) => b[1] - a[1]);
  const data = sortedData.map(([value, amount]) => ({ value, amount }));
  const labels = data.map(d => d.value);
  const amounts = data.map(d => d.amount);
  if (!labels.length || !amounts.length) {
    container.querySelector('#totalSpent').textContent = 'No data to display';
    chartContainer.getContext('2d').clearRect(0, 0, chartContainer.width, chartContainer.height);
    return;
  }
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const currencySymbol = monthlyTransactions[0]?.billingCurrency?.symbol || '€';
  container.querySelector('#totalSpent').textContent =
    `Total Spent: ${currencySymbol}${total.toFixed(2)} (${sortedData.length} ${dataSource === 'category' ? 'categories' : 'tags'})`;
  const ctx = chartContainer.getContext('2d');
  const width = 260;
  const height = 260;
  chartContainer.width = width;
  chartContainer.height = height;
  const radius = Math.min(width, height) / 2 - 10;
  const centerX = width / 2;
  const centerY = height / 2;
  ctx.fillStyle = '#fffcfc';
  ctx.fillRect(0, 0, width, height);
  let startAngle = 0;
  amounts.forEach((amount, i) => {
    const sliceAngle = (amount / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = pieDataColors[labels[i]];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    startAngle += sliceAngle;
  });
  chartContainer.onclick = null;
  updateTableHighlights(monthlyTransactions, 'pie', null, null, month, year);
}
    function calculateNiceTicks(maxValue, desiredTicks = 5) {
      const roughStep = maxValue / desiredTicks;
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
      const normalizedStep = roughStep / magnitude;
      let niceStep;
      if (normalizedStep <= 1.5) niceStep = 1;
      else if (normalizedStep <= 3) niceStep = 2;
      else if (normalizedStep <= 7) niceStep = 5;
      else niceStep = 10;
      niceStep *= magnitude;
      const niceMax = Math.ceil(maxValue / niceStep) * niceStep;
      const ticks = [];
      for (let i = 0; i <= niceMax; i += niceStep) ticks.push(i);
      if (ticks.length > desiredTicks + 1) ticks.pop();
      return { ticks, niceMax, tickStep: niceStep };
    }
async function updateYearlyHistogram(transactionsToUse = allTransactions) {
  if (!container) return;
  transactionsToUse = transactionsToUse.filter(
    tx => tx.status === 'Approved' && tx.kind !== 'Reversal'
  );
  const histogramContainer = container.querySelector('#yearlyHistogram');
  const dataSourceSelect = container.querySelector('#dataSourceSelectYearly');
  const dataSource = dataSourceSelect?.value || 'category';
  if (!histogramContainer) {
    container.querySelector('#yearlyTotalSpent').textContent = 'Error: Histogram container not found';
    return;
  }
  const validTransactions = transactionsToUse.filter(tx => tx.createdAt && !isNaN(new Date(tx.createdAt).getTime()));
  if (!validTransactions.length) {
    container.querySelector('#yearlyTotalSpent').textContent = 'No transactions found for histogram';
    histogramContainer.getContext('2d').clearRect(0, 0, histogramContainer.width, histogramContainer.height);
    return;
  }
  const yearlyData = {};
  const yearlyTotals = {};
  validTransactions.forEach(tx => {
    const year = new Date(tx.createdAt).getFullYear();
    const value = getDataValue(tx, dataSource);
    const amount = parseFloat(tx.billingAmount) || 0;
    if (!yearlyData[year]) {
      yearlyData[year] = {};
      yearlyTotals[year] = 0;
    }
    yearlyData[year][value] = (yearlyData[year][value] || 0) + amount;
    yearlyTotals[year] += amount;
  });
  const years = Object.keys(yearlyData).map(Number).sort((a, b) => a - b);
  const allDataValues = [...new Set(validTransactions.map(tx => getDataValue(tx, dataSource)))].sort();
  const colors = generateColors(allDataValues.length);
  const histogramDataColors = {};
  allDataValues.forEach((value, i) => histogramDataColors[value] = colors[i]);
  const legendContainer = container.querySelector('#histogramLegend');
  legendContainer.innerHTML = '';
  allDataValues.forEach((value, i) => {
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.dataset.category = value;
    legendItem.dataset.color = colors[i];
    legendItem.dataset.chart = 'histogram';
    legendItem.style.cursor = 'pointer';
    legendItem.innerHTML = `
      <div class="legend-color" style="background:${colors[i]}"></div>
      ${value}
    `;
    legendItem.addEventListener('click', () => toggleHighlight(value, colors[i], null, null, validTransactions, 'histogram'));
    legendContainer.appendChild(legendItem);
  });
  if (!years.length) {
    container.querySelector('#yearlyTotalSpent').textContent = 'No yearly data to display';
    histogramContainer.getContext('2d').clearRect(0, 0, histogramContainer.width, histogramContainer.height);
    return;
  }
  const total = validTransactions.reduce((sum, tx) => sum + (parseFloat(tx.billingAmount) || 0), 0);
  const currencySymbol = validTransactions[0]?.billingCurrency?.symbol || '€';
  container.querySelector('#yearlyTotalSpent').textContent =
    `Total Spent (All Years): ${currencySymbol}${total.toFixed(2)} (${allDataValues.length} ${dataSource === 'category' ? 'categories' : 'tags'})`;
  const ctx = histogramContainer.getContext('2d');
  const width = 260;
  const height = 260;
  histogramContainer.width = width;
  histogramContainer.height = height;
  ctx.fillStyle = '#fffcfc';
  ctx.fillRect(0, 0, width, height);
  const padding = { top: 20, right: 20, bottom: 20, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / years.length * 0.8;
  const barGap = chartWidth / years.length * 0.2;
  const maxYearlyTotal = Math.max(...years.map(year => yearlyTotals[year]));
  const { ticks, niceMax, tickStep } = calculateNiceTicks(maxYearlyTotal);
  const scaleY = (chartHeight - 20) / niceMax;
  years.forEach((year, i) => {
    let currentHeight = 0;
    const x = padding.left + i * (barWidth + barGap);
    allDataValues.forEach(value => {
      const amount = yearlyData[year][value] || 0;
      if (amount > 0) {
        const barHeight = amount * scaleY;
        ctx.fillStyle = histogramDataColors[value];
        ctx.fillRect(x, height - padding.bottom - currentHeight - barHeight, barWidth, barHeight);
        currentHeight += barHeight;
      }
    });
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(year.toString(), x + barWidth / 2, height - padding.bottom + 15);
    const yearTotal = yearlyTotals[year].toFixed(2);
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${currencySymbol}${yearTotal}`, x + barWidth / 2, height - padding.bottom - currentHeight - 10);
  });
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ticks.forEach(tick => {
    const y = height - padding.bottom - (tick * scaleY);
    ctx.fillText(tick.toString(), padding.left - 15, y);
  });
}
function toggleHighlight(value, color, selectedMonth, selectedYear, transactions, chartType) {
  const dataSource = chartType === 'pie'
    ? container.querySelector('#dataSourceSelect')?.value || 'category'
    : container.querySelector('#dataSourceSelectYearly')?.value || 'category';
  const highlightKey = selectedMonth && selectedYear
    ? `${selectedYear}-${selectedMonth}-${value}-${chartType}-${dataSource}`
    : `all-${value}-${chartType}-${dataSource}`;
  if (selectedHighlights.has(highlightKey)) selectedHighlights.delete(highlightKey);
  else selectedHighlights.add(highlightKey);
  updateTableHighlights(transactions, chartType, value, color, selectedMonth, selectedYear);
}

    function clearTableHighlights() {
      selectedHighlights.clear();
      const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
      if (!table) return;
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        row.classList.remove('highlight-row');
        row.querySelectorAll('td').forEach(cell => {
          cell.style.color = '';
          cell.style.fontWeight = '';
        });
      });
    }
    monthSelect.addEventListener('change', () => {
      clearTableHighlights();
      updateChart();
    });
    yearSelect.addEventListener('change', () => {
      clearTableHighlights();
      populateMonthDropdownChart(yearSelect.value);
      updateChart();
    });
    const dataSourceSelect = container.querySelector('#dataSourceSelect');
    const dataSourceSelectYearly = container.querySelector('#dataSourceSelectYearly');
    if (dataSourceSelect) {
      dataSourceSelect.addEventListener('change', () => {
        clearTableHighlights();
        updateChart();
      });
    }
    if (dataSourceSelectYearly) {
      dataSourceSelectYearly.addEventListener('change', () => {
        clearTableHighlights();
        updateYearlyHistogram();
      });
    }
const calculateButton = container.querySelector('#calculateCashback');
calculateButton.addEventListener('click', () => {
  const weekPeriod = container.querySelector('#weekSelect').value;
  const gnoAmount = parseFloat(container.querySelector('#gnoAmount').value) || 0;
  const hasOgNft = container.querySelector('#ogNft').checked;
  const { totalCashback, cashbackRate, filteredTransactions, currency, eligibleSpending, remainingEligible } = calculateCashback(
    allTransactions,
    weekPeriod,
    gnoAmount,
    hasOgNft
  );
  const resultDiv = container.querySelector('#cashbackResult');
  const eligibleSpendingDiv = container.querySelector('#eligibleSpending');
  const remainingEligibleDiv = container.querySelector('#remainingEligible');
  resultDiv.textContent = `Cashback: ${currency}${totalCashback.toFixed(2)} (${cashbackRate.toFixed(2)}% rate)`;
  eligibleSpendingDiv.textContent = `Eligible Spending of the week: ${currency}${eligibleSpending.toFixed(2)}`;
  remainingEligibleDiv.textContent = `Remaining Eligible Spending: ${currency}${remainingEligible.toFixed(2)} (of 5,000 weekly cap)`;
  updateTableCashbackHighlights(filteredTransactions);
});
const applyTagsButton = container.querySelector('#applyTags');
const clearTagsButton = container.querySelector('#clearTags');
if (clearTagsButton) {
  clearTagsButton.addEventListener('click', () => {
    clearTags();
  });
} else {
  console.warn('Clear Tags button not found');
}

if (applyTagsButton) {
  applyTagsButton.addEventListener('click', () => {
    const tag1Input = container.querySelector('#tag1Input')?.value.trim() || '';
    const tag2Input = container.querySelector('#tag2Input')?.value.trim() || '';
    const tag3Input = container.querySelector('#tag3Input')?.value.trim() || '';

    const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
    if (!table) {
      alert('Table not found');
      return;
    }
    const checkboxes = table.querySelectorAll('.custom-tags-checkbox:checked');
    if (!checkboxes.length) {
      alert('Please select at least one transaction');
      return;
    }
    if (!tag1Input && !tag2Input && !tag3Input) {
      alert('Please enter at least one tag');
      return;
    }

    checkboxes.forEach(checkbox => {
      const rowIndex = parseInt(checkbox.dataset.rowIndex);
      const transaction = allTransactions.find(tx => tx.rowIndex === rowIndex);
      const row = Array.from(table.querySelectorAll('tbody tr')).find(r => {
        const cb = r.querySelector('.custom-tags-checkbox');
        return cb && parseInt(cb.dataset.rowIndex) === rowIndex;
      });

      if (transaction && row) {
        if (tag1Input) transaction.tag1 = tag1Input;
        if (tag2Input) transaction.tag2 = tag2Input;
        if (tag3Input) transaction.tag3 = tag3Input;

        const tag1Cell = row.querySelector('.tag1-cell');
        const tag2Cell = row.querySelector('.tag2-cell');
        const tag3Cell = row.querySelector('.tag3-cell');
        if (tag1Cell) tag1Cell.textContent = transaction.tag1 || '';
        if (tag2Cell) tag2Cell.textContent = transaction.tag2 || '';
        if (tag3Cell) tag3Cell.textContent = transaction.tag3 || '';
      }
    });

    saveTagsToStorage(allTransactions);

    checkboxes.forEach(checkbox => (checkbox.checked = false));

    container.querySelector('#tag1Input').value = '';
    container.querySelector('#tag2Input').value = '';
    container.querySelector('#tag3Input').value = '';

    populateCustomTagDropdown(allTransactions);
    const filteredTransactions = filterTransactions(allTransactions);
    updateTableDisplay(filteredTransactions);
    updateChart(filteredTransactions);
    updateYearlyHistogram(filteredTransactions);
    
    alert(`Successfully applied tags to ${checkboxes.length} transactions`);
  });
}

async function waitForElement(selector, maxAttempts = 50, interval = 200) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkElement = () => {
      const element = container.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (attempts >= maxAttempts) {
        console.warn(`Element not found after ${maxAttempts} attempts: ${selector}`);
        reject(new Error(`Element not found: ${selector}`));
      } else {
        attempts++;
        setTimeout(checkElement, interval);
      }
    };
    checkElement();
  });
}

async function setupTagLoadingListeners() {
  let loadTagsButton, csvInput;
  try {
    loadTagsButton = await waitForElement('#loadTags');
    csvInput = await waitForElement('#csvInput');
  } catch (error) {
    console.error('Failed to find loadTagsButton or csvInput:', error);
    alert('Error: Custom Tags module not fully loaded. Please try refreshing the page.');
    return;
  }

const handleCsvLoad = async () => {
  if (csvLoadingInProgress) {
    alert('CSV loading already in progress');
    return;
  }

  csvLoadingInProgress = true;

  try {
    if (!csvInput.files || csvInput.files.length === 0) {
      alert('Please select a CSV file to load tags');
      console.warn('No CSV file selected');
      return;
    }

    const file = csvInput.files[0];
    
    const parsedData = await parseCSV(file);

    if (!parsedData.length) {
      alert('No valid data with tags found in CSV. Please check your file format and ensure it includes createdAt dates.');
      console.warn('No valid data in CSV');
      return;
    }

    const transactions = await getTransactions();
    allTransactions = transactions;

    let matchedCount = 0;
    let highConfidenceCount = 0;
    let mediumConfidenceCount = 0;
    let lowConfidenceCount = 0;
    
    const matchResults = parsedData.map(data => {
      const matchResult = findBestTransactionMatchByDate(data, allTransactions);
      if (matchResult) {
        return { csvData: data, ...matchResult };
      }
      return null;
    }).filter(Boolean);

    const confidenceCounts = matchResults.reduce((acc, match) => {
      acc[match.confidence] = (acc[match.confidence] || 0) + 1;
      return acc;
    }, {});
    
    const matchTypeCounts = matchResults.reduce((acc, match) => {
      acc[match.matchType] = (acc[match.matchType] || 0) + 1;
      return acc;
    }, {});
    

    matchResults.forEach(({ csvData, transaction, confidence, matchType }) => {
      
      const oldTags = { 
        tag1: transaction.tag1, 
        tag2: transaction.tag2, 
        tag3: transaction.tag3 
      };
      
      if (csvData.tag1 !== undefined && csvData.tag1 !== null) {
        transaction.tag1 = String(csvData.tag1).trim();
      }
      if (csvData.tag2 !== undefined && csvData.tag2 !== null) {
        transaction.tag2 = String(csvData.tag2).trim();
      }
      if (csvData.tag3 !== undefined && csvData.tag3 !== null) {
        transaction.tag3 = String(csvData.tag3).trim();
      }
      
      matchedCount++;
      if (confidence === 'high') highConfidenceCount++;
      if (confidence === 'medium') mediumConfidenceCount++;
      if (confidence === 'low') lowConfidenceCount++;
    });
    
    if (matchedCount === 0) {
      alert('No matching transactions found in CSV. Please check your date values and format.');
      return;
    }

    await saveTagsToStorage(allTransactions);

    csvInput.value = '';

    const summaryMessage = `Successfully loaded tags for ${matchedCount} transactions`;

    alert(summaryMessage);

    location.reload();
    
  } catch (error) {
    console.error('Error loading tags from CSV:', error);
    alert(`Failed to load tags: ${error.message}`);
  } finally {
    csvLoadingInProgress = false;
  }
};

  loadTagsButton.addEventListener('click', handleCsvLoad);
}
    window.updateChartSpending = updateChart;
    window.updateYearlyHistogram = updateYearlyHistogram;
    await updateChart(transactions);
    await updateYearlyHistogram(transactions);
  }
async function convertToCSV(transactions) {
  if (!Array.isArray(transactions)) throw new Error('Invalid transactions data');
  
  const headers = [
    "rowIndex",
    "createdAt",
    "clearedAt",
    "isPending",
    "transactionAmount",
    "transactionCurrency",
    "billingAmount",
    "billingCurrency",
    "mcc",
    "mccCategory",
    "merchantName",
    "merchantCity",
    "merchantCountry",
    "country",
    "kind",
    "status",
    "transactionHash",
    "tag1",
    "tag2",
    "tag3"
  ];
  
  const rows = transactions.map((tx, index) => [
    index.toString(), 
    tx.createdAt || "",
    tx.clearedAt || "",
    tx.isPending || false,
    tx.transactionAmount ? parseFloat(tx.transactionAmount).toFixed(2) : "",
    tx.transactionCurrency?.symbol || "",
    parseFloat(tx.billingAmount || 0).toFixed(2),
    tx.billingCurrency?.symbol || "",
    tx.mcc || "",
    getMccCategory(tx.mcc || '0000'),
    (tx.merchant?.name || "").trim(),
    (tx.merchant?.city || "").trim(),
    tx.merchant?.country?.name || "",
    tx.country?.name || "",
    tx.kind || "",
    tx.status || "",
    (tx.transactions?.length > 0 && tx.transactions[0].hash) ? tx.transactions[0].hash : "",
    tx.tag1 || "",
    tx.tag2 || "",
    tx.tag3 || ""
  ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(","));
  
  return [headers.join(","), ...rows].join("\n");
}
async function downloadCSV(data, filename = "transactions.csv") {
  try {
   
    const bom = "\uFEFF";
    const csvData = bom + data;
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('CSV download failed:', error);
    throw error;
  }
}
 async function modifyTable() {
  let table;
  try {
    table = await waitForTable();
  } catch (error) {
    return;
  }
  let transactions = [];
  try {
    transactions = await getTransactions();
  } catch (error) {
    return;
  }
  
  const headerRow = table.querySelector('thead tr');
  if (!headerRow) return;
  
  const headers = Array.from(headerRow.querySelectorAll('th'));
  const merchantIndex = headers.findIndex(th => th.textContent.trim().toLowerCase().includes('merchant'));
  const amountIndex = headers.findIndex(th => th.textContent.trim().toLowerCase().includes('amount'));
  
  if (merchantIndex === -1 || amountIndex === -1) return;
  
  let mccHeader = headers.find(th => th.textContent.trim() === 'MCC');
  let mccCatHeader = headers.find(th => th.textContent.trim() === 'MCC Cat');
  let tag1Header = headers.find(th => th.textContent.trim() === 'Tag1');
  let tag2Header = headers.find(th => th.textContent.trim() === 'Tag2');
  let tag3Header = headers.find(th => th.textContent.trim() === 'Tag3');
  let customTagsHeader = headers.find(th => th.textContent.trim() === 'Select');

  if (!mccHeader) {
    mccHeader = document.createElement('th');
    const amountHeader = headers[amountIndex];
    mccHeader.className = amountHeader.className;
    mccHeader.style.cssText = amountHeader.style.cssText;
    mccHeader.style.textAlign = 'center';
    
    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.justifyContent = 'center';
    headerContainer.style.gap = '8px';
    
    const mccText = document.createElement('span');
    mccText.textContent = 'MCC';
    headerContainer.appendChild(mccText);
    
    const csvButton = document.createElement('button');
    csvButton.className = 'csv-export-button';
    csvButton.title = 'Export to CSV';
    csvButton.style.cssText = `cursor: pointer; background: none; border: none; padding: 0; margin: 0; display: flex; align-items: center;`;
    
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('csv-icon.svg');
    icon.alt = 'Export CSV';
    icon.style.width = '20px';
    icon.style.height = '20px';
    csvButton.appendChild(icon);
    
    csvButton.addEventListener('click', async () => {
      try {
        const transactions = await getTransactions();
        if (!transactions.length) {
          alert('No transactions available');
          return;
        }
        const csvData = await convertToCSV(transactions);
        await downloadCSV(csvData);
      } catch (error) {
        alert('Export failed: ' + error.message);
      }
    });
    
    headerContainer.appendChild(csvButton);
    mccHeader.appendChild(headerContainer);
    headerRow.appendChild(mccHeader);
  }

  if (!mccCatHeader) {
    mccCatHeader = document.createElement('th');
    mccCatHeader.textContent = 'MCC Cat';
    mccCatHeader.className = headers[amountIndex].className;
    mccCatHeader.style.cssText = headers[amountIndex].style.cssText;
    mccCatHeader.style.textAlign = 'center';
    headerRow.appendChild(mccCatHeader);
  }

  if (!tag1Header) {
    tag1Header = document.createElement('th');
    tag1Header.textContent = 'Tag1';
    tag1Header.className = headers[amountIndex].className;
    tag1Header.style.cssText = headers[amountIndex].style.cssText;
    tag1Header.style.textAlign = 'center';
    headerRow.appendChild(tag1Header);
  }

  if (!tag2Header) {
    tag2Header = document.createElement('th');
    tag2Header.textContent = 'Tag2';
    tag2Header.className = headers[amountIndex].className;
    tag2Header.style.cssText = headers[amountIndex].style.cssText;
    tag2Header.style.textAlign = 'center';
    headerRow.appendChild(tag2Header);
  }

  if (!tag3Header) {
    tag3Header = document.createElement('th');
    tag3Header.textContent = 'Tag3';
    tag3Header.className = headers[amountIndex].className;
    tag3Header.style.cssText = headers[amountIndex].style.cssText;
    tag3Header.style.textAlign = 'center';
    headerRow.appendChild(tag3Header);
  }

  if (!customTagsHeader) {
    customTagsHeader = document.createElement('th');
    customTagsHeader.textContent = 'Select';
    customTagsHeader.className = headers[amountIndex].className;
    customTagsHeader.style.cssText = headers[amountIndex].style.cssText;
    customTagsHeader.style.textAlign = 'center';
    customTagsHeader.classList.add('custom-tags-column');
    customTagsHeader.style.display = 'none';
    headerRow.appendChild(customTagsHeader);
  }

  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    if (row.querySelector('th')) return;
    
    const transaction = transactions[index];
    if (!transaction) return;
    
    const cells = row.querySelectorAll('td');
    
    const hasMccCell = row.querySelector('.mcc-cell');
    const hasMccCatCell = row.querySelector('.mcc-cat-cell');
    const hasTag1Cell = row.querySelector('.tag1-cell');
    const hasTag2Cell = row.querySelector('.tag2-cell');
    const hasTag3Cell = row.querySelector('.tag3-cell');
    const hasCustomTagsCell = row.querySelector('.custom-tags-column');

    if (!hasMccCell) {
      const mccCell = document.createElement('td');
      mccCell.classList.add('mcc-cell');
      
      const cellContainer = document.createElement('div');
      cellContainer.style.display = 'flex';
      cellContainer.style.alignItems = 'center';
      cellContainer.style.justifyContent = 'center';
      cellContainer.style.gap = '8px';
      
      const valueSpan = document.createElement('span');
      valueSpan.textContent = transaction.mcc || '0000';
      cellContainer.appendChild(valueSpan);
      
      if (transaction.mcc) {
        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = NO_CASHBACK_MCCS.includes(transaction.mcc) ? '⛔' : '🤑';
        emojiSpan.style.fontSize = '16px';
        cellContainer.appendChild(emojiSpan);
      }
      
      mccCell.appendChild(cellContainer);
      
      const merchantCell = cells[merchantIndex];
      if (merchantCell) {
        mccCell.className = merchantCell.className + ' mcc-cell';
        mccCell.style.cssText = merchantCell.style.cssText;
      }
      row.appendChild(mccCell);
    }

    if (!hasMccCatCell) {
      const mccCatCell = document.createElement('td');
      mccCatCell.classList.add('mcc-cat-cell');
      mccCatCell.textContent = getMccCategory(transaction.mcc || '0000');
      
      const merchantCell = cells[merchantIndex];
      if (merchantCell) {
        mccCatCell.className = merchantCell.className + ' mcc-cat-cell';
        mccCatCell.style.cssText = merchantCell.style.cssText;
        mccCatCell.style.textAlign = 'center';
      }
      row.appendChild(mccCatCell);
    }

    if (!hasTag1Cell) {
      const tag1Cell = document.createElement('td');
      tag1Cell.classList.add('tag1-cell');
      tag1Cell.textContent = transaction.tag1 || '';
      
      const merchantCell = cells[merchantIndex];
      if (merchantCell) {
        tag1Cell.className = merchantCell.className + ' tag1-cell';
        tag1Cell.style.cssText = merchantCell.style.cssText;
        tag1Cell.style.textAlign = 'center';
      }
      row.appendChild(tag1Cell);
    }

    if (!hasTag2Cell) {
      const tag2Cell = document.createElement('td');
      tag2Cell.classList.add('tag2-cell');
      tag2Cell.textContent = transaction.tag2 || '';
      
      const merchantCell = cells[merchantIndex];
      if (merchantCell) {
        tag2Cell.className = merchantCell.className + ' tag2-cell';
        tag2Cell.style.cssText = merchantCell.style.cssText;
        tag2Cell.style.textAlign = 'center';
      }
      row.appendChild(tag2Cell);
    }

    if (!hasTag3Cell) {
      const tag3Cell = document.createElement('td');
      tag3Cell.classList.add('tag3-cell');
      tag3Cell.textContent = transaction.tag3 || '';
      
      const merchantCell = cells[merchantIndex];
      if (merchantCell) {
        tag3Cell.className = merchantCell.className + ' tag3-cell';
        tag3Cell.style.cssText = merchantCell.style.cssText;
        tag3Cell.style.textAlign = 'center';
      }
      row.appendChild(tag3Cell);
    }

    if (!hasCustomTagsCell) {
  const customTagsCell = document.createElement('td');
  customTagsCell.classList.add('custom-tags-column');
  customTagsCell.style.display = 'none'; 
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.classList.add('custom-tags-checkbox');
  checkbox.dataset.rowIndex = index;
  
  checkbox.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  
  customTagsCell.appendChild(checkbox);
  checkbox.style.display = 'none'; 
  
  const merchantCell = cells[merchantIndex];
  if (merchantCell) {
    customTagsCell.className = merchantCell.className + ' custom-tags-column';
    customTagsCell.style.cssText = merchantCell.style.cssText;
    customTagsCell.style.textAlign = 'center';
  }
  row.appendChild(customTagsCell);
}
  });
}
async function init() {
  if (isInitialized) return;
  isInitialized = true;
  if (window.location.href.startsWith('https://app.gnosispay.com/')) {
    let retries = 3;
    while (retries > 0) {
      try {
        await modifyTable();
        const transactions = await getTransactions();
        await createSpendingChart(transactions);
        await setupButtonListeners();
        const filteredTransactions = filterTransactions(transactions);
        updateTableDisplay(filteredTransactions); 
        break;
      } catch (error) {
        retries--;
        if (retries === 0) return;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}

  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else document.addEventListener('DOMContentLoaded', init);
  let lastTableContent = '';
  let tableModified = false;
const observer = new MutationObserver(async () => {
  if (!isInitialized  || csvLoadingInProgress) return;
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (table) {
    const currentContent = table.innerHTML.substring(0, 1000);
    if (currentContent === lastTableContent) return;
    lastTableContent = currentContent;
    try {
      if (!tableModified) {
        await modifyTable();
        tableModified = true;
      }
      const transactions = await getTransactions();
      allTransactions = transactions;
      const filteredTransactions = filterTransactions(transactions);
      updateTableDisplay(filteredTransactions);
      if (chartContainerExists && transactions.length > 0) {
        const updateChartFn = window.updateChartSpending;
        if (updateChartFn) {
          selectedHighlights.clear();
          await updateChartFn(filteredTransactions);
          await window.updateYearlyHistogram(filteredTransactions);
          const weekSelect = container.querySelector('#weekSelect');
          if (weekSelect) populateWeekDropdown(filteredTransactions);
          populateMonthDropdown(transactions);
          populateYearDropdown(transactions);
          populateCountryDropdown(transactions);
          populateCategoryDropdown(transactions);
          setupFilterListeners();
          setupVisibilityToggles();
        }
      } else if (transactions.length > 0) {
        await createSpendingChart(transactions);
      }
    } catch (error) {
      console.error('Error in observer:', error);
    }
  }
});
  observer.observe(document.body, { childList: true, subtree: true });
})();
