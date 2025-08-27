const BLOCKED_SITES = [
  'twitter.com',
  'x.com'
];

let activeSessions = {};
let temporaryBlocks = {};

function isBlockedSite(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_SITES.some(site => 
      hostname === site || 
      hostname.endsWith('.' + site) ||
      hostname === 'www.' + site
    );
  } catch (e) {
    return false;
  }
}

function isSessionActive(tabId, url) {
  if (!activeSessions[tabId] || activeSessions[tabId].endTime <= Date.now()) {
    return false;
  }
  
  // Check if the current URL belongs to the same blocked site as the session
  try {
    const currentHostname = new URL(url).hostname.toLowerCase();
    const sessionHostname = new URL(activeSessions[tabId].targetUrl).hostname.toLowerCase();
    
    // Both URLs should be from the same blocked site
    const currentSite = BLOCKED_SITES.find(site => 
      currentHostname === site || 
      currentHostname.endsWith('.' + site) ||
      currentHostname === 'www.' + site
    );
    
    const sessionSite = BLOCKED_SITES.find(site => 
      sessionHostname === site || 
      sessionHostname.endsWith('.' + site) ||
      sessionHostname === 'www.' + site
    );
    
    return currentSite && sessionSite && currentSite === sessionSite;
  } catch (e) {
    return false;
  }
}

function isTemporarilyBlocked(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const now = Date.now();
    
    // Clean up expired blocks
    Object.keys(temporaryBlocks).forEach(site => {
      if (temporaryBlocks[site].endTime <= now) {
        delete temporaryBlocks[site];
      }
    });
    
    // Check if this site is temporarily blocked
    return BLOCKED_SITES.some(site => {
      const matches = hostname === site || 
                     hostname.endsWith('.' + site) ||
                     hostname === 'www.' + site;
      return matches && temporaryBlocks[site] && temporaryBlocks[site].endTime > now;
    });
  } catch (e) {
    return false;
  }
}

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (details.type !== 'main_frame') return;
    
    const url = details.url;
    const tabId = details.tabId;
    
    if (isBlockedSite(url) && !isSessionActive(tabId, url)) {
      if (isTemporarilyBlocked(url)) {
        // Show temporary block message
        return {
          redirectUrl: browser.runtime.getURL('block.html') + '?target=' + encodeURIComponent(url) + '&tabId=' + tabId + '&blocked=true'
        };
      } else {
        return {
          redirectUrl: browser.runtime.getURL('block.html') + '?target=' + encodeURIComponent(url) + '&tabId=' + tabId
        };
      }
    }
  },
  {
    urls: ["*://*.twitter.com/*", "*://*.x.com/*", "*://twitter.com/*", "*://x.com/*"],
    types: ["main_frame"]
  },
  ["blocking"]
);

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'allowAccess') {
    const { tabId, targetUrl, reason, duration } = message;
    
    const endTime = Date.now() + (duration * 60 * 1000);
    const visitId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    
    activeSessions[tabId] = {
      endTime: endTime,
      targetUrl: targetUrl,
      reason: reason,
      startTime: Date.now(),
      visitId: visitId
    };
    
    storeVisitRecord(targetUrl, reason, duration, visitId);
    
    setTimeout(() => {
      if (activeSessions[tabId]) {
        // Check if the tab is still on a blocked site and redirect to reflection screen
        browser.tabs.get(tabId).then(tab => {
          if (tab && isBlockedSite(tab.url)) {
            browser.tabs.update(tabId, { 
              url: browser.runtime.getURL('reflect.html') + '?target=' + encodeURIComponent(tab.url) + '&tabId=' + tabId + '&visitId=' + visitId
            });
          }
        }).catch(() => {
          // Tab might not exist anymore, ignore
        });
        delete activeSessions[tabId];
      }
    }, duration * 60 * 1000);
    
    browser.tabs.update(tabId, { url: targetUrl });
    sendResponse({ success: true });
  } else if (message.action === 'getVisitHistory') {
    getVisitHistory().then(history => {
      sendResponse({ history: history });
    });
    return true;
  } else if (message.action === 'storeReflection') {
    const { visitId, reflection } = message;
    storeReflectionForVisit(visitId, reflection).then(success => {
      sendResponse({ success: success });
    });
    return true;
  } else if (message.action === 'blockSiteTemporarily') {
    const { targetUrl, duration } = message;
    blockSiteTemporarily(targetUrl, duration);
    sendResponse({ success: true });
  }
});

function storeVisitRecord(url, reason, duration, visitId) {
  browser.storage.local.get(['visitHistory'], (result) => {
    const history = result.visitHistory || [];
    history.push({
      url: url,
      reason: reason,
      duration: duration,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      visitId: visitId
    });
    
    browser.storage.local.set({ visitHistory: history });
  });
}

function storeReflectionForVisit(visitId, reflection) {
  return new Promise((resolve) => {
    browser.storage.local.get(['visitHistory'], (result) => {
      const history = result.visitHistory || [];
      const visitIndex = history.findIndex(visit => visit.visitId === visitId);
      
      if (visitIndex !== -1) {
        history[visitIndex].reflection = reflection;
        browser.storage.local.set({ visitHistory: history }, () => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

function blockSiteTemporarily(targetUrl, durationMinutes) {
  try {
    const hostname = new URL(targetUrl).hostname.toLowerCase();
    const site = BLOCKED_SITES.find(s => 
      hostname === s || 
      hostname.endsWith('.' + s) ||
      hostname === 'www.' + s
    );
    
    if (site) {
      temporaryBlocks[site] = {
        endTime: Date.now() + (durationMinutes * 60 * 1000)
      };
    }
  } catch (e) {
    console.error('Error creating temporary block:', e);
  }
}

function getVisitHistory() {
  return new Promise((resolve) => {
    browser.storage.local.get(['visitHistory'], (result) => {
      resolve(result.visitHistory || []);
    });
  });
}

// Periodic check for expired sessions (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  Object.keys(activeSessions).forEach(tabId => {
    const session = activeSessions[tabId];
    if (session.endTime <= now) {
      browser.tabs.get(parseInt(tabId)).then(tab => {
        if (tab && isBlockedSite(tab.url)) {
          browser.tabs.update(parseInt(tabId), { 
            url: browser.runtime.getURL('reflect.html') + '?target=' + encodeURIComponent(tab.url) + '&tabId=' + tabId + '&visitId=' + session.visitId
          });
        }
        delete activeSessions[tabId];
      }).catch(() => {
        // Tab might not exist anymore
        delete activeSessions[tabId];
      });
    }
  });
}, 30000);

browser.tabs.onRemoved.addListener((tabId) => {
  delete activeSessions[tabId];
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && activeSessions[tabId]) {
    // If navigating away from blocked sites, clear the session
    if (!isBlockedSite(changeInfo.url)) {
      delete activeSessions[tabId];
    }
    // If session has expired, redirect to reflection screen and clear it
    else if (activeSessions[tabId].endTime <= Date.now()) {
      const visitId = activeSessions[tabId].visitId;
      delete activeSessions[tabId];
      browser.tabs.update(tabId, { 
        url: browser.runtime.getURL('reflect.html') + '?target=' + encodeURIComponent(changeInfo.url) + '&tabId=' + tabId + '&visitId=' + visitId
      });
    }
  }
});