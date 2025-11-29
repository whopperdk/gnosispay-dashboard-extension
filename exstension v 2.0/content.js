// content.js

let gnosisToken = null;
let isInitialized = false;
let cardTokenMap = {}; 

async function fetchCards() {
  let authToken = gnosisToken || localStorage.getItem('gnosisPayToken');
  if (!authToken) {

    const result = await new Promise(resolve => {
      chrome.storage.local.get(['gnosisPayToken'], resolve);
    });
    if (result.gnosisPayToken) {
      authToken = result.gnosisPayToken;
      gnosisToken = authToken;
      localStorage.setItem('gnosisPayToken', authToken);
    }
  }
  if (!authToken) {
    return [];
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'fetchCards',
      url: 'https://api.gnosispay.com/api/v1/cards',
      token: authToken
    }, (response) => {
      if (chrome.runtime.lastError || response.error) {
        console.error('[fetchCards] API error:', chrome.runtime.lastError || response.error);
        reject(chrome.runtime.lastError || response.error);
        return;
      }

      if (!Array.isArray(response.data)) {
        resolve([]);
        return;
      }

      cardTokenMap = {}; 
      const cards = response.data.map(card => {
        if (card.cardToken && card.lastFourDigits) {
          cardTokenMap[card.cardToken] = card.lastFourDigits; 
        }
        return {
          id: card.id,
          cardToken: card.cardToken,
          lastFourDigits: card.lastFourDigits,
          activatedAt: card.activatedAt,
          statusCode: card.statusCode,
          statusName: card.statusName,
          virtual: card.virtual
        };
      });
      resolve(cards); 
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setGnosisToken' && message.token) {
    gnosisToken = message.token;
    localStorage.setItem('gnosisPayToken', gnosisToken);
  }
});

async function waitForPageReady(timeout = 20000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkReady = () => {
      
      const authIndicator = document.querySelector('.authenticated-user-selector, #user-profile, .dashboard, [data-logged-in=true]') || document.querySelector('body');
      if (authIndicator || document.readyState === 'complete') {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}

async function waitForToken(timeout = 15000) {
  return new Promise((resolve, reject) => {
    if (gnosisToken || localStorage.getItem('gnosisPayToken')) {
      resolve(gnosisToken || localStorage.getItem('gnosisPayToken'));
      return;
    }
    
    chrome.storage.local.get(['gnosisPayToken'], (result) => {
      if (result.gnosisPayToken) {
        gnosisToken = result.gnosisPayToken;
        localStorage.setItem('gnosisPayToken', gnosisToken);
        resolve(gnosisToken);
        return;
      }
      const startTime = Date.now();
      const checkToken = () => {
        if (gnosisToken || localStorage.getItem('gnosisPayToken')) {
          resolve(gnosisToken || localStorage.getItem('gnosisPayToken'));
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Token not captured within timeout'));
        } else {
          setTimeout(checkToken, 100);
        }
      };
      checkToken();
    });
  });
}


// List of MCCs with no cashback 
const NO_CASHBACK_MCCS = [
  '6010', '6011', '6012', '6051', '6211', '7995', '9211', '9222', '9311', '9399',
  '8398', '6300', '8661', '8651', '4900', '6513', '4829', '5734', '5947', '6050',
  '6532', '6533', '6536', '6537', '6538', '6540', '6760', '7372', '8999', '9223', '9411', '9402'
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
  
  if (dataSource === 'card') {
    
    const cardToken = tx.cardToken;
    
    if (!cardToken) {
      return 'Unknown Card';
    }
    
    
    const lastFour = cardTokenMap[cardToken];
    
    if (!lastFour) {
      return `Card ${cardToken}`;
    }
    
    
    return `Card ending in ${lastFour}`;
  }
  
  return 'Other';
}

function parseTransactionDate(dateText) {
  try {
    if (!dateText.trim()) {
      return '';
    }
    return dateText.trim(); 
  } catch (error) {
    return '';
  }
}

async function waitForTable() {
  return new Promise((resolve, reject) => {
    const maxAttempts = 50;
    let attempts = 0;
    
    const loadAllTransactions = async (container) => {
      function findLoadMoreButton() {
        const buttons = document.querySelectorAll('button');
        
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          const text = btn.textContent.trim();
          
          if (text === 'Load More') {
            return btn;
          }
        }
        return null;
      }
      
      let clickCount = 0;
      let consecutiveNotFound = 0;
            
      while (true) {
        let loadMoreButton = null;
        let searchAttempts = 0;
        
        while (!loadMoreButton && searchAttempts < 50) {
          loadMoreButton = findLoadMoreButton();
          if (!loadMoreButton) {
            await new Promise(r => setTimeout(r, 10)); 
            searchAttempts++;
          }
        }
        
        if (!loadMoreButton || loadMoreButton.disabled) {
          consecutiveNotFound++;
          
          if (consecutiveNotFound >= 3) {
            break;
          }
          
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
        
        consecutiveNotFound = 0;
        loadMoreButton.click();
        clickCount++;
        
        await new Promise(r => setTimeout(r, 200));
        
        if (clickCount % 3 === 0) {
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
      
      const finalTransactionButtons = container.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
      return finalTransactionButtons.length > 0;
    };
    
    const checkTable = async () => {
      let container = document.querySelector('.flex.flex-col.gap-4.mb-4 .bg-card.rounded-lg .p-2');
      if (!container) {
        const card = document.querySelector('.flex.flex-col.gap-4.mb-4 .bg-card.rounded-lg');
        if (card) container = card.querySelector('.p-2');
      }
      if (container) {
        try {
          const hasTransactions = await loadAllTransactions(container);
          if (hasTransactions) {
            resolve(container);
            return;
          }
        } catch (error) {
          console.error('[waitForTable] Error loading transactions:', error);
        }
      }
      if (attempts >= maxAttempts) {
        reject(new Error('Transactions container not found or failed to load all transactions'));
      } else {
        attempts++;
        setTimeout(checkTable, 200);
      }
    };
    
    checkTable();
  });
}


async function scrapeTransactionsFromTable() {
  return new Promise((resolve) => {
    const maxAttempts = 50;
    let attempts = 0;
    
    const checkTransactions = () => {
      const transactionButtons = document.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
      
      if (transactionButtons.length > 0) {
        
        const transactions = [];
        let currentDate = '';
        
        let container = document.querySelector('.flex.flex-col.gap-4.mb-4 .bg-card.rounded-lg .p-2');
        if (!container) {
          const card = document.querySelector('.flex.flex-col.gap-4.mb-4 .bg-card.rounded-lg');
          if (card) container = card.querySelector('.p-2');
        }
        if (!container) {
          resolve([]);
          return;
        }
        const allChildren = Array.from(container.children);
        
        allChildren.forEach((element) => {
          if (element.classList.contains('text-xs') && element.textContent.trim().match(/^[A-Z]{3}\s+\d+,\s+\d{4}$/)) {
            currentDate = element.textContent.trim();
          }
          else if (element.tagName === 'BUTTON') {
            try {
              const merchantElement = element.querySelector('.text-lg.text-foreground');
              const merchantText = merchantElement ? merchantElement.textContent.trim() : '';
              
              const amountElement = element.querySelector('.text-right .text-lg.text-foreground');
              const amountText = amountElement ? amountElement.textContent.trim() : '0';
              
              const timeStatusElement = element.querySelector('.text-xs.text-muted-foreground');
              const timeStatusText = timeStatusElement ? timeStatusElement.textContent.trim() : '';
              
              let billingAmount = 0;
              try {
                const cleanAmount = amountText.replace(/[£$€,\s−-]/g, '');
                billingAmount = parseFloat(cleanAmount) || 0;
              } catch (error) {
              }
              
              let currencySymbol = '£';
              if (amountText.includes('$')) currencySymbol = '$';
              else if (amountText.includes('€')) currencySymbol = '€';
              
              let status = 'Approved';
              if (timeStatusText.toLowerCase().includes('pending')) status = 'Pending';
              else if (timeStatusText.toLowerCase().includes('declined')) status = 'Declined';
              
              if (merchantText) { 
                transactions.push({
                  createdAt: currentDate,
                  merchant: { name: merchantText },
                  billingAmount,
                  billingCurrency: { symbol: currencySymbol },
                  mcc: '0000',
                  transactionType: 'PURCHASE',
                  status,
                  rowIndex: transactions.length
                });
              }
              
            } catch (error) {
            }
          }
        });
        
        transactions.reverse(); 
        resolve(transactions);
      } else if (attempts >= maxAttempts) {
        resolve([]);
      } else {
        attempts++;
        setTimeout(checkTransactions, 200);
      }
    };
    
    checkTransactions();
  });
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
let selectedCard = 'all';
let transactionsFetched = false;
let transactionsData = null;

  const style = document.createElement('style');
style.textContent = `
    /* CSS Variables for Light/Dark mode */
    html.light {
      --bg-primary: #fcfbf9;
      --bg-secondary: #f5f5f5;
      --text-primary: #333;
      --text-secondary: #666;
      --border-color: #ddd;
      --accent-bg: rgba(132, 171, 78, 0.1);
      --accent-color: #84ab4e;
      --accent-hover: #6f8c3e;
      --highlight-bg: rgba(132, 171, 78, 0.1);
    }
    
    html.dark {
      --bg-primary: #1e1e1e;
      --bg-secondary: #2d2d2d;
      --text-primary: #e0e0e0;
      --text-secondary: #b0b0b0;
      --border-color: #444;
      --accent-bg: rgba(132, 171, 78, 0.2);
      --accent-color: #a8d957;
      --accent-hover: #9bc944;
      --highlight-bg: rgba(168, 217, 87, 0.15);
    }

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
      background: var(--bg-primary); 
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
      background: var(--bg-secondary);
      color: var(--text-primary);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .visibility-controls button[data-active="true"] {
      background: var(--accent-color);
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
      color: var(--text-primary); 
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
      border: 1px solid var(--border-color); 
      background: var(--bg-secondary);
      color: var(--text-primary);
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
      background: var(--bg-secondary); 
      color: var(--text-primary);
      border-radius: 4px; 
      cursor: pointer; 
    }
    .legend-item:hover { 
      background: var(--border-color); 
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
      color: var(--text-primary); 
      padding: 8px; 
      background: var(--highlight-bg); 
      border-radius: 4px; 
      text-align: center; 
    }
    .about-me-button {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      background: var(--bg-secondary);
      color: var(--text-primary);
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
      background: var(--bg-primary);
      padding: 20px;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: relative;
      color: var(--text-primary);
    }
    .about-me-modal-content h2 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      color: var(--text-primary);
    }
    .about-me-modal-content p {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 10px;
    }
    .about-me-modal-content h3 {
      font-size: 16px;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
      color: var(--text-primary);
    }
    .close-modal-button {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: var(--text-primary);
    }
    .close-modal-button:hover {
      color: var(--accent-color);
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
      border: 1px solid var(--border-color);
      font-size: 14px;
      width: 200px;
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-group label {
      font-size: 14px;
      color: var(--text-primary);
    }
    .filter-group select {
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      font-size: 14px;
      color: var(--text-primary);
    }
    .filter-group button {
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--bg-secondary);
      color: var(--text-primary);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .filter-group button[data-active="true"] {
      background: var(--accent-color);
      color: white;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .filter-group button:hover {
      opacity: 0.9;
    }
    .transaction-filter-tool {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      padding: 15px;
      margin-bottom: 20px;
      width: 100%;
      box-sizing: border-box;
    }
    .transaction-filter-tool h3 {
      font-size: 16px;
      font-weight: bold;
      color: var(--text-primary);
      margin: 0 0 10px 0;
      text-align: center;
    }
    .custom-tags-module {
      margin-top: 20px;
      padding: 15px;
      border: 1px solid var(--border-color);
      border-radius: 5px;
      width: 100%;
      box-sizing: border-box;
      display: none;
      background: var(--bg-secondary);
    }
    .custom-tags-module h3 {
      font-size: 16px;
      font-weight: bold;
      color: var(--text-primary);
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
      color: var(--text-primary);
    }
    .custom-tags-controls input[type="text"] {
      padding: 5px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      width: 150px;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .custom-tags-controls button {
      padding: 5px 10px;
      background-color: var(--accent-color);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    .custom-tags-controls button:hover {
      background-color: var(--accent-hover);
    }
    .custom-tags-controls input[type="file"] {
      padding: 5px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--bg-primary);
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
    .cashback-calculator {
      margin-top: 20px;
      padding: 15px;
      border: 1px solid var(--border-color);
      border-radius: 5px;
      width: 100%;
      box-sizing: border-box;
      background: var(--bg-secondary);
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
      color: var(--text-primary);
    }
    .calculator-controls select,
    .calculator-controls input[type="number"] {
      padding: 5px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .calculator-controls button {
      padding: 5px 10px;
      background-color: var(--accent-color);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    .calculator-controls button:hover {
      background-color: var(--accent-hover);
    }
    .cashback-result {
      margin-top: 10px;
      font-weight: bold;
      color: var(--text-primary);
      text-align: center;
    }
    .transaction-select-mode .transaction-button {
      position: relative;
      padding-left: 40px !important;
    }
    .transaction-select-mode .transaction-checkbox {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      cursor: pointer;
      opacity: 1;
      z-index: 10;
    }
    .transaction-checkbox {
      display: none;
    }
    .transaction-button {
      position: relative;
      transition: padding-left 0.3s ease;
    }
    .transaction-button.selected {
      background-color: var(--accent-bg);
      border: 1px solid var(--accent-color);
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
      .filter-controls {
        flex-direction: column;
        align-items: center;
      }
      .search-bar input {
        width: 100%;
        max-width: 300px;
      }
      .custom-tags-controls input[type="text"] {
        width: 100%;
        max-width: 200px;
      }
      .about-me-modal-content {
        width: 95%;
        padding: 15px;
      }
    }
  `;
  document.head.appendChild(style);

async function getTransactions() {
  try {
    let authToken = gnosisToken || localStorage.getItem('gnosisPayToken');
    
    if (!authToken) {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['gnosisPayToken'], resolve);
      });
      
      if (result.gnosisPayToken) {
        authToken = result.gnosisPayToken;
        gnosisToken = authToken;
        localStorage.setItem('gnosisPayToken', authToken);
      } else {
        return await scrapeTransactionsFromTable();
      }
    }
    
    
    const cards = await fetchCards();
    const cardTokenToLastFour = {};
    cards.forEach(card => {
      cardTokenToLastFour[card.cardToken] = card.lastFourDigits;
    });

    
    const apiPromise = (async () => {
      try {
        const getCount = () => new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'fetchTransactions',
            url: 'https://api.gnosispay.com/api/v1/cards/transactions?limit=1',
            token: authToken
          }, (response) => {
            if (chrome.runtime.lastError || response.error) {
              reject(chrome.runtime.lastError || response.error);
            } else {
              resolve(response.data.count || 100);
            }
          });
        });

        let count = 100;
        try {
          count = await getCount();
        } catch (err) {
        }
        
        let allResults = [];
        let offset = 0;
        let pageSize = 100;
        let hasNext = true;
        
        while (hasNext) {
          const url = `https://api.gnosispay.com/api/v1/cards/transactions?offset=${offset}&limit=${pageSize}`;
          const response = await new Promise((resolvePage, rejectPage) => {
            chrome.runtime.sendMessage({
              action: 'fetchTransactions',
              url,
              token: authToken
            }, (resp) => {
              if (chrome.runtime.lastError || resp.error) {
                rejectPage(chrome.runtime.lastError || resp.error);
              } else {
                resolvePage(resp);
              }
            });
          });
          
          const data = response.data;
          const results = data.results || data.transactions || [];
          allResults = allResults.concat(results);
          
          if (data.next) {
            const nextMatch = data.next.match(/offset=(\d+)/);
            offset = nextMatch ? parseInt(nextMatch[1], 10) : offset + pageSize;
          } else {
            hasNext = false;
          }
        }
        
        return allResults;
      } catch (error) {
        console.error('[getTransactions] API fetch error:', error);
        return [];
      }
    })();
    
    const scrapePromise = (async () => {
      try {
        const scrapedTransactions = await scrapeTransactionsFromTable();
        return scrapedTransactions;
      } catch (error) {
        console.error('[getTransactions] Scraping error:', error);
        return [];
      }
    })();
    
    const [allResults, scrapedTransactions] = await Promise.all([apiPromise, scrapePromise]);
    
    const currencyMap = { 'GBP': '£', 'USD': '$', 'EUR': '€' };
    const savedTags = JSON.parse(localStorage.getItem('transactionTags') || '{}');
    
    const baseTransactions = scrapedTransactions.length >= allResults.length 
      ? scrapedTransactions 
      : allResults.map((apiTx, idx) => ({
          createdAt: apiTx.createdAt || apiTx.clearedAt || '',
          merchant: { name: apiTx.merchant?.name || '' },
          billingAmount: 0,
          billingCurrency: { symbol: '£' },
          mcc: apiTx.mcc || '0000',
          transactionType: apiTx.kind || 'PURCHASE',
          status: apiTx.status || 'Approved',
          rowIndex: idx
        }));
    
    const transactions = baseTransactions.map((baseTx, index) => {
      const apiTx = allResults[index] || {};
      const scrapedTx = scrapedTransactions[index] || baseTx;
      const createdAt = apiTx.createdAt || apiTx.clearedAt || scrapedTx.createdAt || '';
      const clearedAt = apiTx.clearedAt || apiTx.createdAt || scrapedTx.createdAt || '';
      const transactionTags = savedTags[index] || { tag1: '', tag2: '', tag3: '' };
      
      const cardToken = apiTx.cardToken || '';
      
      return {
        createdAt,
        clearedAt,
        isPending: apiTx.isPending || scrapedTx.status === 'Pending' || false,
        transactionAmount: apiTx.transactionAmount ? (parseFloat(apiTx.transactionAmount) / 100).toFixed(2) : '',
        transactionCurrency: apiTx.transactionCurrency ? { symbol: currencyMap[apiTx.transactionCurrency.symbol] || apiTx.transactionCurrency.symbol || '' } : { symbol: '' },
        billingAmount: apiTx.billingAmount ? (parseFloat(apiTx.billingAmount) / 100).toString() : scrapedTx.billingAmount || '0',
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
        country: { name: apiTx.merchant?.country?.name || scrapedTx.country?.name || 'Unknown' },
        category: scrapedTx.category || getMccCategory(apiTx.mcc || '0000'),
        rowIndex: index,
        transactions: apiTx.transactions || [],
        tag1: transactionTags.tag1 || '',
        tag2: transactionTags.tag2 || '',
        tag3: transactionTags.tag3 || '',
        cardToken: cardToken
      };
    });
    
    return transactions;
  } catch (error) {
    console.error('[content.js] Error fetching transactions:', error);
    return await scrapeTransactionsFromTable();
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
        
        
        const findColumnIndex = (possibleNames) => {
          for (const name of possibleNames) {
            const index = headers.findIndex(h => h.includes(name.toLowerCase()));
            if (index !== -1) {
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
            continue;
          }

          if (createdAtValue) {
            const testDate = new Date(createdAtValue);
            if (isNaN(testDate.getTime())) {
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
          }
        }

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
  
  
  if (txHash && txHash.trim()) {
    const hashMatches = allTransactions.filter(tx => {
      const txHashFromTransaction = tx.transactions?.length > 0 && tx.transactions[0].hash 
        ? tx.transactions[0].hash.toLowerCase() 
        : '';
      const csvHashLower = txHash.toLowerCase();
      
      if (txHashFromTransaction === csvHashLower) {
        return true;
      }
      
      if (txHashFromTransaction && csvHashLower.length >= 8) {
        const partialMatch = txHashFromTransaction.includes(csvHashLower) || 
                           csvHashLower.includes(txHashFromTransaction);
        if (partialMatch) {
          return true;
        }
      }
      
      return false;
    });
    
    if (hashMatches.length === 1) {
      return { transaction: hashMatches[0], confidence: 'high', matchType: 'txhash_exact' };
    } else if (hashMatches.length > 1) {
      return { transaction: hashMatches[0], confidence: 'medium', matchType: 'txhash_multiple' };
    } else {
    }
  }
  
  if (!createdAt || !createdAt.trim()) {
    return null;
  }
  
  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0]; 
    } catch (error) {
      return null;
    }
  };
  
  const csvDate = normalizeDate(createdAt);
  if (!csvDate) {
    return null;
  }
  
  const dateMatches = allTransactions.filter(tx => {
    const txDate = normalizeDate(tx.createdAt);
    return txDate === csvDate;
  });
  
  
  if (dateMatches.length === 0) {
    return null;
  }
  
  if (dateMatches.length === 1) {
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
      }
      return merchantMatch;
    });
    
    if (merchantMatches.length === 1) {
      return { transaction: merchantMatches[0], confidence: 'high', matchType: 'date_merchant' };
    } else if (merchantMatches.length > 1) {
      bestMatch = merchantMatches[0];
      confidence = 'medium';
    }
  }
  
  if (!bestMatch && amount && amount.trim()) {
    const csvAmount = parseFloat(amount.replace(/[^\d.-]/g, ''));
    if (!isNaN(csvAmount)) {
      const amountMatches = dateMatches.filter(tx => {
        const txAmount = parseFloat(tx.billingAmount || 0);
        const amountMatch = Math.abs(txAmount - csvAmount) < 0.01; 
        if (amountMatch) {
        }
        return amountMatch;
      });
      
      if (amountMatches.length === 1) {
        return { transaction: amountMatches[0], confidence: 'high', matchType: 'date_amount' };
      } else if (amountMatches.length > 1) {
        bestMatch = amountMatches[0];
        confidence = 'medium';
      }
    }
  }
  
  if (!bestMatch) {
    bestMatch = dateMatches[0];
    confidence = 'low';
  }
  
  return { transaction: bestMatch, confidence, matchType: 'date_fallback' };
}

const handleCsvLoad = async () => {
  if (csvLoadingInProgress) {
    alert('CSV loading already in progress');
    return;
  }

  csvLoadingInProgress = true;

  try {
    const csvInput = container.querySelector('#csvInput');
    if (!csvInput?.files || csvInput.files.length === 0) {
      alert('Please select a CSV file to load tags');
      return;
    }

    const file = csvInput.files[0];
    
    const parsedData = await parseCSV(file);

    if (!parsedData.length) {
      alert('No valid data with tags found in CSV. Please check your file format and ensure it includes dates and at least one tag column.');
      return;
    }

    const transactions = await getTransactions();
    allTransactions = transactions;

    let matchedCount = 0;
    let skippedCount = 0;
    const matchResults = [];
    
    for (const csvData of parsedData) {
      const matchResult = findBestTransactionMatchByDate(csvData, allTransactions);
      
      if (matchResult && matchResult.transaction) {
        matchResults.push({ csvData, ...matchResult });
        matchedCount++;
      } else {
        skippedCount++;
      }
    }


    if (matchedCount === 0) {
      alert('No matching transactions found in CSV. Please check your date values and format.');
      return;
    }

    let tagsApplied = 0;
    matchResults.forEach(({ csvData, transaction, confidence, matchType }) => {
      
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
    alert(summaryMessage);

    location.reload();
    
  } catch (error) {
    console.error('Error loading tags from CSV:', error);
    alert(`Failed to load tags: ${error.message}`);
  } finally {
    csvLoadingInProgress = false;
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
    
    let cardMatch = true;
    if (selectedCard && selectedCard !== 'all') {
      cardMatch = tx.cardToken === selectedCard;
      if (!cardMatch) {
        console.debug(`[filterTransactions] Transaction cardToken="${tx.cardToken}" does not match selectedCard="${selectedCard}"`);
      }
    }
    
    let monthMatch = true;
    if (selectedMonth !== 'all' && tx.createdAt) {
      const txDate = new Date(tx.createdAt);
      if (!isNaN(txDate.getTime())) {
        monthMatch = txDate.getMonth() + 1 === parseInt(selectedMonth, 10);
      }
    }
    
    let yearMatch = true;
    if (selectedYear !== 'all' && tx.createdAt) {
      const txDate = new Date(tx.createdAt);
      if (!isNaN(txDate.getTime())) {
        yearMatch = txDate.getFullYear() === parseInt(selectedYear, 10);
      }
    }
    
    const isCashbackEligible = tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc) && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType) && tx.status === 'Approved' && tx.kind !== 'Reversal';
    let cashbackMatch = true;
    if (cashbackEligible && !noCashback) {
      cashbackMatch = isCashbackEligible;
    } else if (noCashback && !cashbackEligible) {
      cashbackMatch = !isCashbackEligible;
    }
    
    return merchantMatch && countryMatch && categoryMatch && customTagMatch && monthMatch && yearMatch && cashbackMatch && cardMatch;
  });
  return filtered;
}
function updateTableHighlights(transactions, chartType = 'pie', selectedValue = null, selectedColor = null, selectedMonth = null, selectedYear = null) {
  const transactionButtons = document.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3');
  
  if (!transactionButtons.length) {
    return;
  }
  
  const dataSource = chartType === 'pie'
    ? container.querySelector('#dataSourceSelect')?.value || 'category'
    : container.querySelector('#dataSourceSelectYearly')?.value || 'category';
  
  transactionButtons.forEach((button, rowIndex) => {
    const matchingTransaction = transactions.find(tx => tx.rowIndex === rowIndex);
    
    if (!matchingTransaction || !matchingTransaction.createdAt) {
      button.style.border = '';
      button.style.backgroundColor = '';
      button.style.margin = '';
      const textElements = button.querySelectorAll('.text-lg.text-foreground, .mcc-indicator span');
      textElements.forEach(el => { el.style.color = ''; el.style.fontWeight = ''; });
      return;
    }
    
    const txDate = new Date(matchingTransaction.createdAt);
    if (isNaN(txDate.getTime())) {
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
      button.style.border = `2px solid ${selectedColor || '#84ab4e'}`;
      button.style.backgroundColor = 'rgba(132, 171, 78, 0.1)';
      button.style.borderRadius = '8px';
      button.style.margin = '2px 0';
      
      const textElements = button.querySelectorAll('.text-lg.text-foreground, .mcc-indicator span, .transaction-tags span');
      textElements.forEach(el => {
        if (el.textContent.includes(selectedValue)) {
          el.style.color = selectedColor || '#84ab4e';
          el.style.fontWeight = 'bold';
        }
      });
    } else {
      button.style.border = '';
      button.style.backgroundColor = '';
      button.style.margin = '';
      const textElements = button.querySelectorAll('.text-lg.text-foreground, .mcc-indicator span, .transaction-tags span');
      textElements.forEach(el => {
        el.style.color = '';
        el.style.fontWeight = '';
      });
    }
  });
}

function updateTableDisplay(transactions) {
  const transactionButtons = document.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
  
  if (!transactionButtons.length) {
    return;
  }
  
  transactionButtons.forEach((button, index) => {
    const matchingTx = transactions.find(tx => tx.rowIndex === index);
    
    if (matchingTx) {
      button.style.display = '';
    } else {
      button.style.display = 'none';
    }
  });
  
  const container = document.querySelector('.flex.flex-col.gap-4.mb-4 .bg-card.rounded-lg .p-2');
  if (!container) {
    return;
  }
  
  const allChildren = Array.from(container.children);
  
  allChildren.forEach((wrapperDiv, index) => {
    const buttonsInWrapper = wrapperDiv.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
    
    if (buttonsInWrapper.length === 0) {
      wrapperDiv.style.display = '';
      return;
    }
    
    let hasVisibleButton = false;
    buttonsInWrapper.forEach(btn => {
      if (btn.style.display !== 'none') {
        hasVisibleButton = true;
      }
    });
    
    if (hasVisibleButton) {
      wrapperDiv.style.display = '';
    } else {
      wrapperDiv.style.display = 'none';
    }
  });
  
  
  if (!csvLoadingInProgress) {
    try {
      updateTableHighlights(transactions);
    } catch (error) {
    }
    
    try {
      if (typeof updateTableCashbackHighlights === 'function') {
        updateTableCashbackHighlights(transactions);
      }
    } catch (error) {
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
    setupTagSelectionMode();
    return;
  }
const waitForContainer = () => {
  return new Promise(resolve => {
    const checkContainer = () => {
      const transactionHeading = document.querySelector('h1');
      const headingParent = transactionHeading?.parentElement;
      
      const cardContainer = document.querySelector('.bg-card.rounded-lg');
      
      if (headingParent || cardContainer) {
        resolve({ transactionHeader: headingParent, table: cardContainer });
      } else {
        setTimeout(checkContainer, 200);
      }
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
        <button id="toggleCustomTags" data-active="false">CSV & Tags</button>
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
              <label>Card:</label>
              <select id="cardFilter">
                <option value="all">All Cards</option>
              </select>
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
          <option value="card">Cards</option>
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
          <option value="card">Cards</option>
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
        <div class="cashback-result" id="remainingEligible">Remaining Eligible Spending: $0.00 (of $0 weekly cap)</div>
      </div>
      <div class="custom-tags-module" id="customTagsModule" style="display: none;">
        <div class="chart-title">CSV & Tags</div>
        <div class="custom-tags-controls">
          <label>Tag1: <input type="text" id="tag1Input" placeholder="Enter Tag1"></label>
          <label>Tag2: <input type="text" id="tag2Input" placeholder="Enter Tag2"></label>
          <label>Tag3: <input type="text" id="tag3Input" placeholder="Enter Tag3"></label>
          <label>Load CSV: <input type="file" id="csvInput" accept=".csv"></label>
          <button id="SaveTagsCsv">Save</button>
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
  const cardFilter = container.querySelector('#cardFilter');
  if (cardFilter) {
    if (cardTokenMap && Object.keys(cardTokenMap).length > 0) {
      Object.entries(cardTokenMap).forEach(([cardToken, lastFour]) => {
        const option = document.createElement('option');
        option.value = cardToken;
        option.textContent = lastFour;
        cardFilter.appendChild(option);
      });
    } else {
    }
  }

  if (cardFilter) {
    cardFilter.addEventListener('change', () => {
      const selectedCard = cardFilter.value;
      let filtered = allTransactions;
      if (selectedCard !== 'all') {
        filtered = allTransactions.filter(tx => tx.cardToken === selectedCard);
      }
      updateTableDisplay(filtered);
    });
  }
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
  setupTagSelectionMode();


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
  } else if (button === filterToolButton) {
    if (isActive) {
      resetFilters(true);
    }
  } else if (button === customTagsButton) {
    toggleCustomTagsColumn(!isActive);
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
  const container = document.querySelector('.bg-card.rounded-lg');
  if (!container) {
    alert('Transaction container not found');
    return;
  }

  const checkboxes = container.querySelectorAll('.transaction-checkbox:checked');
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

    const button = container.querySelector(`button[data-transaction-index="${rowIndex}"]`);
    if (button) {
      const tagsDiv = button.querySelector('.transaction-tags');
      if (tagsDiv) {
        tagsDiv.innerHTML = '';
      }
    }
  });

  saveTagsToStorage(allTransactions);

  container.classList.remove('transaction-select-mode');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    const button = checkbox.closest('.transaction-button');
    if (button) button.classList.remove('selected');
  });

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
  const cardFilter = container.querySelector('#cardFilter');
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
  }
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      selectedCountry = countrySelect.value;
      applyFilters();
    });
  } else {
  }
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      selectedCategory = categorySelect.value;
      applyFilters();
    });
  } else {
  }
  if (customTagSelect) {
    customTagSelect.addEventListener('change', () => {
      selectedCustomTag = customTagSelect.value;
      applyFilters();
    });
  } else {
  }
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      selectedMonth = monthSelect.value;
      applyFilters();
    });
  } else {
  }
  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      selectedYear = yearSelect.value;
      applyFilters();
    });
  } else {
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
  }
  if (cardFilter) {
  cardFilter.addEventListener('change', () => {
    selectedCard = cardFilter.value;  
    applyFilters();  
  });
  } else {
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

    const CASHBACK_CAP_TIERS_USD = [
      { minGno: 100, maxWeeklyUsd: 1250 },
      { minGno: 10, maxWeeklyUsd: 500 },
      { minGno: 1, maxWeeklyUsd: 375 },
      { minGno: 0.1, maxWeeklyUsd: 250 }
    ];

    function getWeeklyCapUsdForGno(gnoAmount) {
      if (typeof gnoAmount !== 'number' || isNaN(gnoAmount) || gnoAmount < 0.1) return 0;
      for (const tier of CASHBACK_CAP_TIERS_USD) {
        if (gnoAmount >= tier.minGno) return tier.maxWeeklyUsd;
      }
      return 0;
    }

    async function fetchExchangeRates() {
      try {
        const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP');
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates && data.rates.EUR && data.rates.GBP) {
            return { USD_EUR: data.rates.EUR, USD_GBP: data.rates.GBP, ratesUnavailable: false };
          }
        }
      } catch (err) {
      }
      try {
        const res2 = await fetch('https://open.er-api.com/v6/latest/USD');
        if (res2.ok) {
          const d2 = await res2.json();
          if (d2 && d2.rates && d2.rates.EUR && d2.rates.GBP) {
            return { USD_EUR: d2.rates.EUR, USD_GBP: d2.rates.GBP, ratesUnavailable: false };
          }
        }
      } catch (err) {
      }

      return { USD_EUR: 1, USD_GBP: 1, ratesUnavailable: true };
    }

    function parseCurrencySymbol(sym) {
      if (!sym) return 'USD';
      try {
        if (typeof sym === 'object') {
          const keys = Object.keys(sym || {});
          const maybeSymbol = sym.symbol || sym.symbol_native || sym.currencySymbol || sym.currency_symbol;
          const maybeCode = sym.code || sym.currency || sym.currencyCode || sym.iso || sym.isoCurrency;
          if (maybeCode && typeof maybeCode === 'string') {
            const up = maybeCode.toUpperCase();
            if (up.includes('EUR')) return 'EUR';
            if (up.includes('GBP')) return 'GBP';
            if (up.includes('USD')) return 'USD';
          }
          if (maybeSymbol && typeof maybeSymbol === 'string') {
            return parseCurrencySymbol(maybeSymbol);
          }
          sym = String(sym);
        }
      } catch (e) {
        sym = String(sym);
      }

      const s = String(sym).trim();
      if (!s) return 'USD';
      const up = s.toUpperCase();
      if (s.includes('\u20AC') || s === '€' || up.includes('EUR')) return 'EUR';
      if (s.includes('\u00A3') || s === '£' || up.includes('GBP')) return 'GBP';
      if (s.includes('$') || up.includes('USD') || s === 'US$') return 'USD';
      // If the string contains common currency names
      if (up.includes('POUND') || up.includes('BRITISH')) return 'GBP';
      if (up.includes('EURO')) return 'EUR';
      return 'USD';
    }

    function getCurrencyCodeFromTx(tx) {
      if (!tx) return 'USD';
      const bc = tx.billingCurrency;
      if (bc) {
        if (typeof bc === 'string') {
          const code = parseCurrencySymbol(bc);
          return code;
        }
        if (typeof bc === 'object') {
          const possible = bc.code || bc.currency || bc.iso || bc.currencyCode || bc.symbol;
          if (possible) return parseCurrencySymbol(possible);
        }
      }
      const sym = tx.billingCurrency?.symbol || tx.currency || tx.currencyCode || tx.amountCurrency;
      return parseCurrencySymbol(sym);
    }

    function getCurrencySymbolFromTx(tx) {
      if (!tx) return '$';
      const bc = tx.billingCurrency;
      if (typeof bc === 'string') {
        const s = bc.trim();
        if (s === '£' || s === '€' || s === '$') return s;
        const code = parseCurrencySymbol(s);
        if (code === 'GBP') return '£';
        if (code === 'EUR') return '€';
        return '$';
      }
      if (typeof bc === 'object' && bc !== null) {
        if (bc.symbol && typeof bc.symbol === 'string') return bc.symbol;
        const possible = bc.code || bc.currency || bc.currencyCode || bc.iso;
        if (possible) {
          const code = parseCurrencySymbol(possible);
          if (code === 'GBP') return '£';
          if (code === 'EUR') return '€';
          return '$';
        }
      }
      const sym = tx.billingCurrency?.symbol || tx.currency || tx.currencyCode || tx.amountCurrency;
      const code = parseCurrencySymbol(sym);
      if (code === 'GBP') return '£';
      if (code === 'EUR') return '€';
      return '$';
    }

    function getSymbolFromValue(val) {
      if (!val) return '';
      if (typeof val === 'string') {
        const s = val.trim();
        if (s === '£' || s === '€' || s === '$') return s;
        const code = parseCurrencySymbol(s);
        if (code === 'GBP') return '£';
        if (code === 'EUR') return '€';
        if (code === 'USD') return '$';
        return s;
      }
      if (typeof val === 'object') {
        if (val.symbol) return String(val.symbol);
        const possible = val.code || val.currency || val.currencyCode || val.iso;
        if (possible) {
          const code = parseCurrencySymbol(possible);
          if (code === 'GBP') return '£';
          if (code === 'EUR') return '€';
          return '$';
        }
      }
      return '';
    }

    function convertAmountToUsd(amount, currencyCode, rates) {
      const a = Number(amount) || 0;
      if (!rates) return a; 
      if (currencyCode === 'USD') return a;
      if (currencyCode === 'EUR') {
        const r = rates.USD_EUR || 1;
        return r === 0 ? a : a / r;
      }
      if (currencyCode === 'GBP') {
        const r = rates.USD_GBP || 1;
        return r === 0 ? a : a / r;
      }
      return a;
    }
async function calculateCashback(transactions, weekPeriod, gnoAmount, hasOgNft) {
  let from = null;
  let to = null;
  if (weekPeriod) {
    const [start, end] = weekPeriod.split('|').map(d => {
      const date = new Date(d);
      if (isNaN(date.getTime())) {
        return null;
      }
      date.setUTCHours(0, 0, 0, 0);
      return date;
    });
    if (start && end) {
      from = start;
      to = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
    } else {
      return { totalCashback: 0, cashbackRate: 0, filteredTransactions: [], currency: 'USD', eligibleSpendingUsd: 0, remainingEligibleUsd: 0 };
    }
  } else {
    return { totalCashback: 0, cashbackRate: 0, filteredTransactions: [], currency: 'USD', eligibleSpendingUsd: 0, remainingEligibleUsd: 0 };
  }
  const filteredTransactions = transactions.filter(tx => {
    const dateField = tx.clearedAt || tx.createdAt;
    if (!dateField) {
      return false;
    }
    if (tx.isPending || tx.status !== 'Approved' || tx.kind === 'Reversal') {
      return false;
    }
    const txDate = new Date(dateField);
    if (isNaN(txDate.getTime())) {
      return false;
    }
    const isInDateRange = txDate >= from && txDate <= to;
    const isEligibleMcc = tx.mcc && !NO_CASHBACK_MCCS.includes(tx.mcc);
    const isEligibleType = tx.transactionType && !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(tx.transactionType);
    return isInDateRange && isEligibleMcc && isEligibleType;
  });
  const cashbackRate = calculateCashbackRate(gnoAmount, hasOgNft);
  const weeklyCapUsd = getWeeklyCapUsdForGno(Number(gnoAmount));
  const rates = await fetchExchangeRates();
  let eligibleSpendingUsd = 0;
  const sumsByCurrency = {}; 
  filteredTransactions.forEach(tx => {
    const currencyCode = getCurrencyCodeFromTx(tx);
    const amt = parseFloat(tx.billingAmount) || 0;
    sumsByCurrency[currencyCode] = (sumsByCurrency[currencyCode] || 0) + amt;
    const amtUsd = convertAmountToUsd(amt, currencyCode, rates);
    eligibleSpendingUsd += amtUsd;
    tx._amountUsd = amtUsd;
    tx._currencyCode = currencyCode;
  });
  const cappedSpendingUsd = Math.min(eligibleSpendingUsd, weeklyCapUsd);
  const totalCashbackUsd = cappedSpendingUsd * cashbackRate;
  const remainingEligibleUsd = Math.max(0, weeklyCapUsd - eligibleSpendingUsd);
  return {
    totalCashback: Number(totalCashbackUsd.toFixed(2)),
    cashbackRate: cashbackRate * 100,
    filteredTransactions,
    currency: 'USD',
    eligibleSpendingUsd: Number(eligibleSpendingUsd.toFixed(2)),
    remainingEligibleUsd: Number(remainingEligibleUsd.toFixed(2)),
    weeklyCapUsd
    ,
    sumsByCurrency
  };
}

function clearCashbackHighlights() {
  const transactionButtons = document.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
  
  transactionButtons.forEach(button => {
    button.classList.remove('cashback-eligible-highlight');
    button.style.border = '';
    button.style.backgroundColor = '';
  });
  
}

function updateTableCashbackHighlights(filteredTransactions) {
  if (!document.querySelector('#cashback-highlight-styles')) {
    const style = document.createElement('style');
    style.id = 'cashback-highlight-styles';
    style.textContent = `
      .cashback-eligible-highlight {
        border: 2px solid #000 !important;
        background-color: rgba(0, 0, 0, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }

  const transactionButtons = document.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
  

  if (transactionButtons.length === 0) {
    return;
  }

  const eligibleRowIndices = new Set();
  filteredTransactions.forEach(tx => {
    eligibleRowIndices.add(tx.rowIndex);
  });


  let highlightCount = 0;

  transactionButtons.forEach((button, buttonIndex) => {
    const matchingTransaction = allTransactions.find(tx => tx.rowIndex === buttonIndex);
    
    if (!matchingTransaction) {
      return;
    }

    if (eligibleRowIndices.has(matchingTransaction.rowIndex)) {
      button.classList.add('cashback-eligible-highlight');
      button.style.border = '2px solid #000';
      button.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
      button.style.borderRadius = '8px';
      highlightCount++;
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
  const currencySymbol = getCurrencySymbolFromTx(monthlyTransactions[0]) || '€';
  
  let dataSourceLabel;
  if (dataSource === 'category') {
    dataSourceLabel = 'categories';
  } else if (dataSource === 'card') {
    dataSourceLabel = 'cards';
  } else if (dataSource === 'tag1' || dataSource === 'tag2' || dataSource === 'tag3') {
    dataSourceLabel = 'tags';
  } else {
    dataSourceLabel = 'items';
  }
  
  
  container.querySelector('#totalSpent').textContent =
    `Total Spent: ${currencySymbol}${total.toFixed(2)} (${sortedData.length} ${dataSourceLabel})`;
  
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
  const currencySymbol = getCurrencySymbolFromTx(validTransactions[0]) || '€';
  
  let dataSourceLabel;
  if (dataSource === 'category') {
    dataSourceLabel = 'categories';
  } else if (dataSource === 'card') {
    dataSourceLabel = 'cards';
  } else if (dataSource === 'tag1' || dataSource === 'tag2' || dataSource === 'tag3') {
    dataSourceLabel = 'tags';
  } else {
    dataSourceLabel = 'items';
  }
  
  
  container.querySelector('#yearlyTotalSpent').textContent =
    `Total Spent (All Years): ${currencySymbol}${total.toFixed(2)} (${allDataValues.length} ${dataSourceLabel})`;
  
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
if (calculateButton) {
  calculateButton.addEventListener('click', async () => {
    const weekPeriod = container.querySelector('#weekSelect').value;
    const gnoAmount = parseFloat(container.querySelector('#gnoAmount').value) || 0;
    const hasOgNft = container.querySelector('#ogNft').checked;
    try {
      const {
        totalCashback,
        cashbackRate,
        filteredTransactions,
        currency,
        eligibleSpendingUsd,
        remainingEligibleUsd,
        weeklyCapUsd,
        sumsByCurrency
      } = await calculateCashback(
        allTransactions,
        weekPeriod,
        gnoAmount,
        hasOgNft
      );

      const resultDiv = container.querySelector('#cashbackResult');
      const eligibleSpendingDiv = container.querySelector('#eligibleSpending');
      const remainingEligibleDiv = container.querySelector('#remainingEligible');
      const usdSign = '$';
      if (resultDiv) resultDiv.textContent = `Cashback: ${usdSign}${totalCashback.toFixed(2)} (${cashbackRate.toFixed(2)}% rate)`;

      const returnedSums = sumsByCurrency || {};
      let localDisplay = '';
      if (!Object.keys(returnedSums).length) {
        localDisplay = `${usdSign}${eligibleSpendingUsd.toFixed(2)}`;
      } else {
        const keys = Object.keys(returnedSums);
        if (keys.length === 1) {
          const code = keys[0];
          const localAmt = returnedSums[code] || 0;
          const symbol = code === 'GBP' ? '£' : (code === 'EUR' ? '€' : '$');
          localDisplay = `${symbol}${localAmt.toFixed(2)} (${usdSign}${eligibleSpendingUsd.toFixed(2)})`;
        } else {
          const parts = keys.map(c => {
            const sym = c === 'GBP' ? '£' : (c === 'EUR' ? '€' : '$');
            return `${c}: ${sym}${(returnedSums[c]||0).toFixed(2)}`;
          });
          localDisplay = `${parts.join(', ')}  (total ${usdSign}${eligibleSpendingUsd.toFixed(2)})`;
        }
      }

      if (eligibleSpendingDiv) eligibleSpendingDiv.textContent = `Eligible Spending of the week: ${localDisplay}`;
      if (remainingEligibleDiv) remainingEligibleDiv.textContent = `Remaining Eligible Spending: ${usdSign}${remainingEligibleUsd.toFixed(2)} (of ${usdSign}${weeklyCapUsd.toFixed(2)} weekly cap)`;

      clearCashbackHighlights();

      updateTableCashbackHighlights(filteredTransactions);
    } catch (err) {
      console.error('[calculateButton] Error calculating cashback:', err);
      alert('Failed to calculate cashback; see console for details');
    }
  });
} else {
}
const applyTagsButton = container.querySelector('#applyTags');
const saveTagsCsvButton = container.querySelector('#SaveTagsCsv');
if (saveTagsCsvButton) {
  saveTagsCsvButton.addEventListener('click', async () => {
    if (typeof convertToCSV === 'function' && typeof downloadCSV === 'function') {
      const csvData = await convertToCSV(allTransactions);
      await downloadCSV(csvData, "transactions.csv");
    } else {
      alert('CSV export function not found.');
    }
  });
}
const clearTagsButton = container.querySelector('#clearTags');
if (clearTagsButton) {
  clearTagsButton.addEventListener('click', () => {
    clearTags();
  });
} else {
}

if (applyTagsButton) {
  applyTagsButton.addEventListener('click', () => {
    const tag1Input = container.querySelector('#tag1Input')?.value.trim() || '';
    const tag2Input = container.querySelector('#tag2Input')?.value.trim() || '';
    const tag3Input = container.querySelector('#tag3Input')?.value.trim() || '';


    const checkedCheckboxes = document.querySelectorAll('.transaction-checkbox:checked');
    

    if (!checkedCheckboxes.length) {
      alert('Please select at least one transaction');
      return;
    }

    if (!tag1Input && !tag2Input && !tag3Input) {
      alert('Please enter at least one tag');
      return;
    }

    let successCount = 0;

    checkedCheckboxes.forEach(checkbox => {
      const rowIndex = parseInt(checkbox.dataset.rowIndex);
      
      const transaction = allTransactions.find(tx => tx.rowIndex === rowIndex);
      
      if (!transaction) {
        return;
      }

      
      const oldTags = { tag1: transaction.tag1, tag2: transaction.tag2, tag3: transaction.tag3 };
      
      if (tag1Input) transaction.tag1 = tag1Input;
      if (tag2Input) transaction.tag2 = tag2Input;
      if (tag3Input) transaction.tag3 = tag3Input;
      

      successCount++;
      
      const buttons = document.querySelectorAll('.transaction-button');
      let buttonFound = false;
      buttons.forEach((btn, idx) => {
        if (idx === rowIndex) {
          
          let tagsDiv = btn.querySelector('.transaction-tags');
          if (!tagsDiv) {
            tagsDiv = document.createElement('div');
            tagsDiv.className = 'transaction-tags flex gap-2 text-xs mt-1';
            const merchantContainer = btn.querySelector('div:has(.text-lg.text-foreground)');
            if (merchantContainer) {
              merchantContainer.appendChild(tagsDiv);
            }
          }
          
          tagsDiv.innerHTML = ''; 

          const addTagToUI = (tagText, tagNumber) => {
          if (tagText) {
            const tag = document.createElement('span');
            tag.className = 'bg-accent text-accent-foreground px-2 py-0.5 rounded flex items-center gap-1';
            tag.innerHTML = `<span title="Tag ${tagNumber}">🔖</span> ${tagNumber}-${tagText}`;
            tagsDiv.appendChild(tag);
          }
        };

        addTagToUI(transaction.tag1, 1);
        addTagToUI(transaction.tag2, 2);
        addTagToUI(transaction.tag3, 3);
          
          buttonFound = true;
        }
      });
      
      if (!buttonFound) {
      }
    });


    saveTagsToStorage(allTransactions);

    const savedTags = localStorage.getItem('transactionTags');

    const transactionContainer = document.querySelector('.bg-card.rounded-lg');
    transactionContainer.classList.remove('transaction-select-mode');
    checkedCheckboxes.forEach(checkbox => {
    checkbox.checked = false;
      const wrapper = checkbox.closest('.transaction-wrapper');
      const button = wrapper?.querySelector('.transaction-button');
      if (button) button.classList.remove('selected');
    });

    container.querySelector('#tag1Input').value = '';
    container.querySelector('#tag2Input').value = '';
    container.querySelector('#tag3Input').value = '';

    populateCustomTagDropdown(allTransactions);
    const filteredTransactions = filterTransactions(allTransactions);
    updateTableDisplay(filteredTransactions);
    updateChart(filteredTransactions);
    updateYearlyHistogram(filteredTransactions);
    
    alert(`Successfully applied tags to ${successCount} transactions`);
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
      return;
    }

    const file = csvInput.files[0];
    
    const parsedData = await parseCSV(file);

    if (!parsedData.length) {
      alert('No valid data with tags found in CSV. Please check your file format and ensure it includes createdAt dates.');
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
    setupTagSelectionMode();
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
    "card",
    "kind",
    "status",
    "transactionHash",
    "tag1",
    "tag2",
    "tag3"
  ];
  
  const rows = transactions.map((tx, index) => {
  const cardLastFour = cardTokenMap[tx.cardToken] || "";
  
  return [
    index.toString(), 
    tx.createdAt || "",
    tx.clearedAt || "",
    tx.isPending || false,
    tx.transactionAmount ? parseFloat(tx.transactionAmount).toFixed(2) : "",
    getSymbolFromValue(tx.transactionCurrency) || "",
    parseFloat(tx.billingAmount || 0).toFixed(2),
    getCurrencySymbolFromTx(tx) || "",
    tx.mcc || "",
    getMccCategory(tx.mcc || '0000'),
    (tx.merchant?.name || "").trim(),
    (tx.merchant?.city || "").trim(),
    tx.merchant?.country?.name || "",
    tx.country?.name || "",
    cardLastFour,
    tx.kind || "",
    tx.status || "",
    (tx.transactions?.length > 0 && tx.transactions[0].hash) ? tx.transactions[0].hash : "",
    tx.tag1 || "",
    tx.tag2 || "",
    tx.tag3 || ""
  ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(",");
});
  
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
  let container;
  try {
    container = await waitForTable();
  } catch (error) {
    console.error('[modifyTable] Container not found:', error);
    return;
  }
  
  let transactions = transactionsData;
  if (!transactions) {
    return;
  }
  
  
  const transactionButtons = document.querySelectorAll('button[type="button"].flex.items-center.justify-between.py-3.cursor-pointer');
  
  transactionButtons.forEach((button, index) => {
    const transaction = transactions[index];
    if (!transaction) return;
    
    if (button.parentElement && button.parentElement.classList.contains('transaction-wrapper')) {
      return;
    }
    
    
    button.classList.add('transaction-button');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'transaction-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '10px';
    wrapper.style.width = '100%';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'transaction-checkbox';
    checkbox.dataset.rowIndex = index;
    checkbox.style.display = 'none';
    checkbox.style.width = '18px';
    checkbox.style.height = '18px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.flexShrink = '0';
    checkbox.style.margin = '0';
    checkbox.style.padding = '0';
    
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      button.classList.toggle('selected', checkbox.checked);
    });
    
    button.parentNode.insertBefore(wrapper, button);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(button);
    
    const additionalInfoContainer = document.createElement('div');
    additionalInfoContainer.className = 'flex flex-col ml-15 text-xs text-muted-foreground';
    
    const mccIndicator = document.createElement('div');
    mccIndicator.className = 'mcc-indicator flex items-center gap-2';
    
    const mccCode = transaction.mcc || '0000';
    const mccCategory = getMccCategory(mccCode);
    const isCashbackEligible = !NO_CASHBACK_MCCS.includes(mccCode) && 
                            !['ATM_WITHDRAWAL', 'MONEY_TRANSFER', 'REFUNDED'].includes(transaction.transactionType) &&
                            transaction.status === 'Approved' &&
                            transaction.kind !== 'Reversal';
    
    const statusIndicator = isCashbackEligible ? '✅' : '❌';
    const statusTitle = isCashbackEligible ? 'Cashback Eligible' : 'Not Eligible for Cashback';
    
    mccIndicator.innerHTML = `
      <div class="flex gap-1 items-center">
        <span title="MCC Code">🏷️ ${mccCode}</span>
        <span title="${statusTitle}">${statusIndicator}</span>
      </div>
      <div class="flex gap-1 items-center">
        <span title="Category">📁 ${mccCategory}</span>
      </div>
    `;
    additionalInfoContainer.appendChild(mccIndicator);
    
    if (transaction.tag1 || transaction.tag2 || transaction.tag3) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'transaction-tags flex gap-2 text-xs mt-1';
      
      const addTag = (tagText, tagNumber) => {
        if (tagText) {
          const tag = document.createElement('span');
          tag.className = 'bg-accent text-accent-foreground px-2 py-0.5 rounded flex items-center gap-1';
          tag.innerHTML = `<span title="Tag ${tagNumber}">🔖</span> ${tagNumber}-${tagText}`;
          tagsDiv.appendChild(tag);
        }
      };
      
      addTag(transaction.tag1, 1);
      addTag(transaction.tag2, 2);
      addTag(transaction.tag3, 3);
      
      additionalInfoContainer.appendChild(tagsDiv);
    }
    
    const merchantContainer = button.querySelector('div:has(.text-lg.text-foreground)');
    if (merchantContainer) {
      merchantContainer.appendChild(additionalInfoContainer);
    }
    
    button.dataset.transactionIndex = index;
    if (isCashbackEligible) {
      button.dataset.cashbackEligible = 'true';
    }
  });
  
}


function setupTagSelectionMode() {

  const setupCustomTagsButton = () => {
    const customTagsButton = document.querySelector('#toggleCustomTags');
    if (!customTagsButton) {
      setTimeout(setupCustomTagsButton, 500);
      return;
    }


    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-active') {
          const isActive = customTagsButton.getAttribute('data-active') === 'true';
          
          
          const checkboxes = document.querySelectorAll('.transaction-checkbox');
          
          if (checkboxes.length === 0) {
            return;
          }
          
          if (isActive) {
            checkboxes.forEach((cb) => {
              cb.style.display = 'block';
            });
          } else {
            checkboxes.forEach((cb) => {
              cb.style.display = 'none';
            });
          }
        }
      });
    });

    observer.observe(customTagsButton, {
      attributes: true,
      attributeFilter: ['data-active']
    });

  };

  setupCustomTagsButton();
}


async function init() {
  if (isInitialized) return;
  isInitialized = true;
  if (window.location.href.startsWith('https://app.gnosispay.com/')) {
    await waitForPageReady();
    let retries = 3;
    while (retries > 0) {
      try {
        await waitForToken();
        const cards = await fetchCards();
        
        if (!transactionsFetched) {
          transactionsData = await getTransactions();
          transactionsFetched = true;
        }
        
        await modifyTable();

        await createSpendingChart(transactionsData);
        await setupButtonListeners();
        
        setupTagSelectionMode();
        
        setTimeout(async () => {
          const filteredTransactions = filterTransactions(transactionsData);
          updateTableDisplay(filteredTransactions);
        }, 100);
        
        break;
      } catch (error) {
        console.error('[content.js] Initialization error:', error);
        retries--;
        if (retries === 0) {
          console.error('[content.js] Failed to initialize after retries:', error);
          return;
        }
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
  if (!isInitialized || csvLoadingInProgress || !transactionsFetched) return;
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
      allTransactions = transactionsData;
      const filteredTransactions = filterTransactions(transactionsData);
      updateTableDisplay(filteredTransactions);
      if (chartContainerExists && transactionsData.length > 0) {
        const updateChartFn = window.updateChartSpending;
        if (updateChartFn) {
          selectedHighlights.clear();
          await updateChartFn(filteredTransactions);
          await window.updateYearlyHistogram(filteredTransactions);
          const weekSelect = container.querySelector('#weekSelect');
          if (weekSelect) populateWeekDropdown(filteredTransactions);
          populateMonthDropdown(transactionsData);
          populateYearDropdown(transactionsData);
          populateCountryDropdown(transactionsData);
          populateCategoryDropdown(transactionsData);
          setupFilterListeners();
          setupVisibilityToggles();
        }
      } else if (transactionsData.length > 0) {
        await createSpendingChart(transactionsData);
      }
    } catch (error) {
      console.error('Error in observer:', error);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
})();