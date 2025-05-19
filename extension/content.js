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

function parseTransactionDate(dateText) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const simpleDateMatch = dateText.match(/(\w+\s+\d{1,2})/);
    if (simpleDateMatch) {
      const datePart = simpleDateMatch[1];
      const parsedDate = new Date(`${datePart} ${currentYear} 00:00 UTC`);
      if (!isNaN(parsedDate.getTime())) {
        parsedDate.setUTCHours(0, 0, 0, 0);
        return parsedDate.toISOString();
      }
    }
    const dateMatch = dateText.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (dateMatch) {
      const parsedDate = new Date(Date.UTC(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1])));
      if (!isNaN(parsedDate.getTime())) return parsedDate.toISOString();
    }
    console.warn(`Failed to parse date: "${dateText}"`);
    return now.toISOString();
  } catch (error) {
    console.warn(`Error parsing date "${dateText}":`, error);
    return new Date().toISOString();
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
  const rows = table.querySelectorAll('tbody tr');
  const transactions = [];
  rows.forEach((row, index) => {
    if (row.querySelector('th')) return;
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return; 
    const dateText = cells[0]?.textContent.trim() || '';
    const merchantText = cells[1]?.textContent.trim() || '';
    const amountText = cells[3]?.textContent.trim() || '';
    const mccText = cells[5]?.textContent.trim() || '';
    const typeText = cells[2]?.textContent.trim().toUpperCase() || 'PURCHASE'; 
    let createdAt = parseTransactionDate(dateText);
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
    let status = 'Approved';
    if (merchantText.includes('Pending')) status = 'Pending';
    else if (merchantText.includes('Declined')) status = 'Declined';
    else if (merchantText.includes('Refund')) status = 'Refund';
    else if (merchantText.includes('Insufficient')) status = 'InsufficientFunds';
    transactions.push({
      createdAt,
      merchant: { name: merchantText },
      billingAmount,
      billingCurrency: { symbol: currencySymbol },
      mcc,
      transactionType: typeText
    });
  });
  return transactions;
}

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
    .mcc-cell { 
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
      return apiTransactions.map((tx, index) => {
        const scrapedTx = scrapedTransactions[index] || {};
        return {
          createdAt: tx.createdAt || tx.clearedAt || scrapedTx.createdAt || "",
          clearedAt: tx.clearedAt || tx.createdAt || scrapedTx.createdAt || "",
          isPending: tx.isPending || scrapedTx.status === 'Pending' || false,
          billingAmount: (parseFloat(tx.billingAmount) / 100).toString() || scrapedTx.billingAmount || "0",
          billingCurrency: { symbol: currencyMap[tx.billingCurrency?.symbol] || scrapedTx.billingCurrency?.symbol || '£' },
          mcc: tx.mcc || scrapedTx.mcc || "0000",
          merchant: { name: scrapedTx.merchant?.name || tx.merchant?.name?.replace(/\s+/g, ' ').trim() || "" },
          transactionType: tx.kind === "Payment" ? "PURCHASE" : tx.kind || scrapedTx.transactionType || "PURCHASE",
          status: scrapedTx.status || tx.status || "Approved",
          kind: tx.kind || "Payment",
          country: tx.country || { name: scrapedTx.country?.name || 'Unknown' },
          category: scrapedTx.category || getMccCategory(tx.mcc || '0000'),
          rowIndex: scrapedTx.rowIndex || index
        };
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

function filterTransactions(transactions) {
  console.log('Filtering transactions:', transactions.map(tx => ({
    rowIndex: tx.rowIndex,
    merchant: tx.merchant?.name,
    country: tx.country?.name,
    category: getMccCategory(tx.mcc),
    month: tx.createdAt ? new Date(tx.createdAt).getMonth() + 1 : null,
    year: tx.createdAt ? new Date(tx.createdAt).getFullYear() : null,
    mcc: tx.mcc,
    transactionType: tx.transactionType,
    isCashbackEligible: tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc) && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType)
  })));
  const filtered = transactions.filter(tx => {
    const merchantMatch = !merchantSearch || (tx.merchant?.name || '').toLowerCase().includes(merchantSearch.toLowerCase());
    const countryMatch = selectedCountry === 'all' || tx.country?.name === selectedCountry;
    const categoryMatch = selectedCategory === 'all' || getMccCategory(tx.mcc) === selectedCategory;
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
    const isCashbackEligible = tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc) && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType);
    let cashbackMatch = true;
    if (cashbackEligible && !noCashback) {
      cashbackMatch = isCashbackEligible;
    } else if (noCashback && !cashbackEligible) {
      cashbackMatch = !isCashbackEligible;
    }
    console.log(`Transaction ${tx.rowIndex} filter check:`, {
      merchantMatch,
      countryMatch,
      categoryMatch,
      monthMatch,
      yearMatch,
      cashbackMatch,
      isCashbackEligible
    });
    return merchantMatch && countryMatch && categoryMatch && monthMatch && yearMatch && cashbackMatch;
  });
  console.log('Filtered transactions:', filtered.map(tx => ({
    rowIndex: tx.rowIndex,
    merchant: tx.merchant?.name,
    isCashbackEligible: tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc) && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType)
  })));
  return filtered;
}
function updateTableHighlights(transactions, chartType = 'pie', selectedCategory = null, selectedColor = null, selectedMonth = null, selectedYear = null) {
  const table = document.querySelector('table, [class*="table"], [class*="transactions"], [role="grid"], [class*="data"], [class*="list"]');
  if (!table) {
    console.warn('Table not found for highlights');
    return;
  }
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) return;
    const mccText = cells[4]?.textContent.trim() || '';
    let mcc = '0000';
    try {
      if (mccText && /\d{4}/.test(mccText)) mcc = mccText.match(/(\d{4})/)[1];
    } catch (error) {
      console.warn(`Failed to parse MCC "${mccText}"`);
    }
    const rowCategory = getMccCategory(mcc);
    const dateText = cells[0]?.textContent.trim() || '';
    const txDate = parseTransactionDate(dateText);
    const rowMonth = new Date(txDate).getMonth() + 1;
    const rowYear = new Date(txDate).getFullYear();
    const highlightKeyMonth = `${rowYear}-${rowMonth}-${rowCategory}-${chartType}`;
    const highlightKeyAll = `all-${rowCategory}-${chartType}`;
    const shouldHighlight = selectedCategory && selectedHighlights.has(highlightKeyMonth) || selectedHighlights.has(highlightKeyAll);
    const isMatchingTransaction = transactions.some(tx => {
      if (!tx.createdAt) return false;
      const txDateObj = new Date(tx.createdAt);
      if (isNaN(txDateObj.getTime())) return false;
      const isSameDate =
        txDateObj.getFullYear() === rowYear &&
        txDateObj.getMonth() + 1 === rowMonth &&
        txDateObj.getDate() === new Date(txDate).getDate();
      const isSameCategory = getMccCategory(tx.mcc) === rowCategory;
      return isSameDate && isSameCategory &&
             (!selectedMonth || selectedMonth === rowMonth || selectedMonth === 'all') &&
             (!selectedYear || selectedYear === rowYear || selectedYear === 'all');
    });
    if (shouldHighlight && rowCategory === selectedCategory && isMatchingTransaction) {
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
    updateTableHighlights(transactions);
    updateTableCashbackHighlights(transactions);
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
  allTransactions = transactions;
  if (!Array.isArray(transactions) || !transactions.length) {
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
        <div class="chart-title">Monthly Spending by Category</div>
        <div class="chart-controls" style="display: none;">
          <select id="monthSelect"></select>
          <select id="yearSelect"></select>
        </div>
        <canvas id="spendingChart" width="260" height="260"></canvas>
        <div class="total-spent" id="totalSpent"></div>
        <div class="chart-legend" id="pieChartLegend"></div>
      </div>
      <div class="chart-wrapper" id="yearlyChartWrapper" style="display: none;">
        <div class="chart-title">Yearly Spending by Category</div>
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
  populateMonthDropdown(transactions);
  populateYearDropdown(transactions);
  populateCountryDropdown(transactions);
  populateCategoryDropdown(transactions);
  
  populateMonthDropdownChart(defaultYear);
  populateWeekDropdown(transactions);
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
  const visaCalculatorButton = container.querySelector('#openVisaCalculator');
  const aboutMeButton = container.querySelector('#aboutMeButton');
  const aboutMeModal = container.querySelector('#aboutMeModal');
  const closeModalButton = container.querySelector('#closeAboutMeModal');
  const monthlyChartWrapper = container.querySelector('#monthlyChartWrapper');
  const yearlyChartWrapper = container.querySelector('#yearlyChartWrapper');
  const cashbackCalculatorWrapper = container.querySelector('#cashbackCalculatorWrapper');
  const filterToolWrapper = container.querySelector('#filterToolWrapper');
  const chartControls = container.querySelector('.chart-controls');
  function resetFilters(preserveCashback = false) {
    merchantSearch = '';
    selectedCountry = 'all';
    selectedCategory = 'all';
    selectedMonth = 'all';
    selectedYear = 'all';
    if (!preserveCashback) {
      cashbackEligible = false;
      noCashback = false;
    }
    const merchantSearchInput = container.querySelector('#merchantSearch');
    const countrySelect = container.querySelector('#countryFilter');
    const categorySelect = container.querySelector('#categoryFilter');
    const monthSelect = container.querySelector('#monthFilter');
    const yearSelect = container.querySelector('#yearFilter');
    const cashbackEligibleButton = container.querySelector('#cashbackEligibleFilter');
    const noCashbackButton = container.querySelector('#noCashbackFilter');
    if (merchantSearchInput) merchantSearchInput.value = '';
    if (countrySelect) countrySelect.value = 'all';
    if (categorySelect) categorySelect.value = 'all';
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

function setupFilterListeners() {
  const merchantSearchInput = container.querySelector('#merchantSearch');
  const countrySelect = container.querySelector('#countryFilter');
  const categorySelect = container.querySelector('#categoryFilter');
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
      console.log('Merchant search updated:', merchantSearch);
      applyFilters();
    });
  } else {
    console.warn('Merchant search input not found');
  }
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      selectedCountry = countrySelect.value;
      console.log('Country filter updated:', selectedCountry);
      applyFilters();
    });
  } else {
    console.warn('Country select not found');
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      selectedCategory = categorySelect.value;
      console.log('Category filter updated:', selectedCategory);
      applyFilters();
    });
  } else {
    console.warn('Category select not found');
  }
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      selectedMonth = monthSelect.value;
      console.log('Month filter updated:', selectedMonth);
      applyFilters();
    });
  } else {
    console.warn('Month select not found');
  }
  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      selectedYear = yearSelect.value;
      console.log('Year filter updated:', selectedYear);
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
      console.log('Cashback eligible toggled:', cashbackEligible, 'No cashback:', noCashback);
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
      console.log('No cashback toggled:', noCashback, 'Cashback eligible:', cashbackEligible);
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
    if (tx.isPending || tx.status === 'Reversal' || tx.status === 'Other' || tx.kind === 'Reversal') { 
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
  const totalCashback = filteredTransactions.reduce((sum, tx) => {
    const amount = parseFloat(tx.billingAmount) || 0;
    return sum + amount * cashbackRate;
  }, 0);
  const currencySymbol = filteredTransactions[0]?.billingCurrency?.symbol || '£';
  return { totalCashback, cashbackRate: cashbackRate * 100, filteredTransactions, currency: currencySymbol };
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
    const dateText = cells[0]?.textContent.trim() || '';
    const merchantText = cells[2]?.textContent.trim() || '';
    const amountText = cells[3]?.textContent.trim() || '';
    let mccText = cells[5]?.textContent.trim() || '';
    if (merchantText.toUpperCase().includes('PENDING') || merchantText.toUpperCase().includes('DECLINED') || merchantText.toUpperCase().includes('INSUFFICIENT')) {
      return;
    }
    const tableDate = parseTransactionDate(dateText);
    if (!tableDate) {
      console.warn(`Row ${rowIndex}: Invalid date "${dateText}"`);
      return;
    }
    const parsedTableDate = new Date(tableDate);
    if (isNaN(parsedTableDate.getTime())) {
      console.warn(`Row ${rowIndex}: Parsed date invalid "${tableDate}"`);
      return;
    }
    let billingAmount = 0;
    try {
      const amountMatch = amountText.match(/[\d,.]+/);
      billingAmount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
    } catch (error) {
      console.warn(`Row ${rowIndex}: Failed to parse amount "${amountText}"`);
      return;
    }
    let mcc = '0000';
    try {
      if (mccText && /\d{4}/.test(mccText)) mcc = mccText.match(/(\d{4})/)[1];
    } catch (error) {
      console.warn(`Row ${rowIndex}: Failed to parse MCC "${mccText}"`);
      return;
    }
    const isIncluded = filteredTransactions.some(tx => {
      const txCreatedAt = new Date(tx.createdAt); 
      if (isNaN(txCreatedAt.getTime())) {
        console.warn(`Transaction ${tx.rowIndex}: Invalid transaction date "${tx.createdAt}"`);
        return false;
      }
      const isSameDate =
        txCreatedAt.getUTCFullYear() === parsedTableDate.getUTCFullYear() &&
        txCreatedAt.getUTCMonth() === parsedTableDate.getUTCMonth() &&
        txCreatedAt.getUTCDate() === parsedTableDate.getUTCDate();
      const isSameAmount = Math.abs(parseFloat(tx.billingAmount) - billingAmount) < 0.5;
      const normalizedMerchantText = merchantText.replace(/\s+/g, ' ').trim().replace(/ - .*$/, ''); 
      const normalizedTxMerchant = tx.merchant?.name?.replace(/\s+/g, ' ').trim() || '';
      const merchantMatch = normalizedMerchantText && normalizedTxMerchant
        ? normalizedTxMerchant.toLowerCase().includes(normalizedMerchantText.toLowerCase()) ||
          normalizedMerchantText.toLowerCase().includes(normalizedTxMerchant.toLowerCase())
        : normalizedMerchantText === normalizedTxMerchant;
      const isSameMcc = tx.mcc === mcc;
      return isSameDate && isSameAmount && merchantMatch && isSameMcc;
    });
    const dateCell = cells[0];
    const existingEmoji = dateCell.querySelector('.hand-emoji');
    if (existingEmoji) {
      existingEmoji.remove();
      console.log(`Row ${rowIndex}: Removed existing hand emoji`);
    }
    if (isIncluded) {
      const emoji = document.createElement('span');
      emoji.className = 'hand-emoji';
      emoji.textContent = '👉';
      dateCell.insertBefore(emoji, dateCell.firstChild);
    } else {
      console.log(`Row ${rowIndex}: Skipped hand emoji for merchant "${merchantText}"`);
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
      const chartContainer = container.querySelector('#spendingChart');
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
      const allCategories = [...new Set(monthlyTransactions.map(tx => getMccCategory(tx.mcc)))].sort();
      const colors = generateColors(allCategories.length);
      const pieCategoryColors = {};
      allCategories.forEach((category, i) => pieCategoryColors[category] = colors[i]);
      const legendContainer = container.querySelector('#pieChartLegend');
      legendContainer.innerHTML = '';
      if (monthlyTransactions.length) {
        const categoryTotals = {};
        monthlyTransactions.forEach(tx => {
          const category = getMccCategory(tx.mcc);
          const amount = parseFloat(tx.billingAmount) || 0;
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        });
        const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
        allCategories.forEach((category, i) => {
          const amount = categoryTotals[category] || 0;
          const percentage = total > 0 ? (amount / total * 100).toFixed(1) : 0;
          const legendItem = document.createElement('div');
          legendItem.className = 'legend-item';
          legendItem.dataset.category = category;
          legendItem.dataset.color = colors[i];
          legendItem.dataset.chart = 'pie';
          legendItem.style.cursor = 'pointer';
          legendItem.innerHTML = `
            <div class="legend-color" style="background:${colors[i]}"></div>
            ${category}: ${percentage}%
          `;
          legendItem.addEventListener('click', () => toggleHighlight(category, colors[i], month, year, monthlyTransactions, 'pie'));
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
      const categoryTotals = {};
      monthlyTransactions.forEach(tx => {
        const category = getMccCategory(tx.mcc);
        const amount = parseFloat(tx.billingAmount) || 0;
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
      });
      const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
      const data = sortedCategories.map(([category, amount]) => ({ category, amount }));
      const labels = data.map(d => d.category);
      const amounts = data.map(d => d.amount);
      if (!labels.length || !amounts.length) {
        container.querySelector('#totalSpent').textContent = 'No data to display';
        chartContainer.getContext('2d').clearRect(0, 0, chartContainer.width, chartContainer.height);
        return;
      }
      const total = amounts.reduce((sum, amount) => sum + amount, 0);
      const currencySymbol = monthlyTransactions[0]?.billingCurrency?.symbol || '€';
      container.querySelector('#totalSpent').textContent =
        `Total Spent: ${currencySymbol}${total.toFixed(2)} (${sortedCategories.length} categories)`;
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
        ctx.fillStyle = pieCategoryColors[labels[i]];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        startAngle += sliceAngle;
      });
      chartContainer.onclick = null;
      updateTableHighlights(monthlyTransactions);
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
      const histogramContainer = container.querySelector('#yearlyHistogram');
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
        const category = getMccCategory(tx.mcc);
        const amount = parseFloat(tx.billingAmount) || 0;
        if (!yearlyData[year]) {
          yearlyData[year] = {};
          yearlyTotals[year] = 0;
        }
        yearlyData[year][category] = (yearlyData[year][category] || 0) + amount;
        yearlyTotals[year] += amount;
      });
      const years = Object.keys(yearlyData).map(Number).sort((a, b) => a - b);
      const allCategories = [...new Set(validTransactions.map(tx => getMccCategory(tx.mcc)))].sort();
      const colors = generateColors(allCategories.length);
      const histogramCategoryColors = {};
      allCategories.forEach((category, i) => histogramCategoryColors[category] = colors[i]);
      const legendContainer = container.querySelector('#histogramLegend');
      legendContainer.innerHTML = '';
      allCategories.forEach((category, i) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.dataset.category = category;
        legendItem.dataset.color = colors[i];
        legendItem.dataset.chart = 'histogram';
        legendItem.style.cursor = 'pointer';
        legendItem.innerHTML = `
          <div class="legend-color" style="background:${colors[i]}"></div>
          ${category}
        `;
        legendItem.addEventListener('click', () => toggleHighlight(category, colors[i], null, null, validTransactions, 'histogram'));
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
        `Total Spent (All Years): ${currencySymbol}${total.toFixed(2)} (${allCategories.length} categories)`;
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
        allCategories.forEach(category => {
          const amount = yearlyData[year][category] || 0;
          if (amount > 0) {
            const barHeight = amount * scaleY;
            ctx.fillStyle = histogramCategoryColors[category];
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
    function toggleHighlight(category, color, selectedMonth, selectedYear, transactions, chartType) {
      const highlightKey = selectedMonth && selectedYear
        ? `${selectedYear}-${selectedMonth}-${category}-${chartType}`
        : `all-${category}-${chartType}`;
      if (selectedHighlights.has(highlightKey)) selectedHighlights.delete(highlightKey);
      else selectedHighlights.add(highlightKey);
      updateTableHighlights(transactions, chartType, category, color, selectedMonth, selectedYear);
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
const calculateButton = container.querySelector('#calculateCashback');
calculateButton.addEventListener('click', () => {
  const weekPeriod = container.querySelector('#weekSelect').value;
  const gnoAmount = parseFloat(container.querySelector('#gnoAmount').value) || 0;
  const hasOgNft = container.querySelector('#ogNft').checked;
  const { totalCashback, cashbackRate, filteredTransactions, currency } = calculateCashback(
    allTransactions, 
    weekPeriod,
    gnoAmount,
    hasOgNft
  );
  const resultDiv = container.querySelector('#cashbackResult');
  resultDiv.textContent = `Cashback: ${currency}${totalCashback.toFixed(2)} (${cashbackRate.toFixed(2)}% rate)`;
  updateTableCashbackHighlights(filteredTransactions);
});
    window.updateChartSpending = updateChart;
    window.updateYearlyHistogram = updateYearlyHistogram;
    await updateChart(transactions);
    await updateYearlyHistogram(transactions);
  }
  async function convertToCSV(transactions) {
    if (!Array.isArray(transactions)) throw new Error('Invalid transactions data');
    const headers = ["createdAt", "billingAmount", "billingCurrency", "mcc", "merchantName", "transactionType"];
    const rows = transactions.map(tx => [
      tx.clearedAt || tx.createdAt || "",
      parseFloat(tx.billingAmount || 0).toFixed(2),
      tx.billingCurrency?.symbol || "",
      tx.mcc || "",
      (tx.merchant?.name || "").trim(),
      tx.transactionType || ""
    ].map(value => `"${value}"`).join(","));
    return [headers.join(","), ...rows].join("\n");
  }
  async function downloadCSV(data, filename = "transactions.csv") {
    try {
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
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
      headerContainer.style.gap = '32px';
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
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    if (row.querySelector('th')) return;
    const transaction = transactions[index];
    if (!transaction) return;
    const cells = row.querySelectorAll('td');
    const hasMccCell = Array.from(cells).some(cell => cell.classList.contains('mcc-cell'));
    if (!hasMccCell) {
      const mccCell = document.createElement('td');
      mccCell.classList.add('mcc-cell');
      const cellContainer = document.createElement('div');
      cellContainer.style.display = 'flex';
      cellContainer.style.alignItems = 'center';
      cellContainer.style.justifyContent = 'center';
      cellContainer.style.gap = '32px';
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
  if (!isInitialized) return;
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
