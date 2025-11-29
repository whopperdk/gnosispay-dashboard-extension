// background.js


chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (details.url.includes('https://api.gnosispay.com/api/v1/delay-relay')) {
      for (const header of details.requestHeaders) {
        if (header.name.toLowerCase() === 'authorization' && header.value.startsWith('Bearer ')) {
          const token = header.value.replace('Bearer ', '');
          
          chrome.storage.local.set({ gnosisPayToken: token }, () => {
            if (chrome.runtime.lastError) {
              console.error('[background.js] Error storing token:', chrome.runtime.lastError);
            } else {
            }
          });


      chrome.tabs.query({ active: true, currentWindow: true }, function tabsCallback (tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'setGnosisToken',
                token: token
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('[background.js] Error sending message to tab', tabs[0].id, ':', chrome.runtime.lastError.message);
                } else {
                }
              });
            } else {
            }
          });
        }
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["https://api.gnosispay.com/api/v1/delay-relay"] },
  ["requestHeaders"]
);


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchCards' || request.action === 'fetchTransactions') {
    const actionType = request.action === 'fetchCards' ? 'cards' : 'transactions';

    fetch(request.url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${request.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': 'https://app.gnosispay.com'
      }
    })
      .then(response => {
        return response.text().then(text => ({ response, text }));
      })
      .then(({ response, text }) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}, Body: ${text.substring(0, 200)}`);
        }
        const data = JSON.parse(text);
        sendResponse({ data });
      })
      .catch(error => {
        console.error(`[background.js] Fetch ${actionType} error:`, error);
        sendResponse({ error: error.message });
      });

    return true; 
  }
});