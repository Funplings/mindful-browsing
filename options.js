document.addEventListener('DOMContentLoaded', function() {
    const newSiteInput = document.getElementById('new-site');
    const addSiteBtn = document.getElementById('add-site');
    const siteList = document.getElementById('site-list');
    const statusMessage = document.getElementById('status-message');
    
    // Load current blocked sites
    loadBlockedSites();
    
    // Add site button click handler
    if (addSiteBtn) {
        console.log('Add site button found, adding event listener');
        addSiteBtn.addEventListener('click', addSite);
    } else {
        console.error('Add site button not found!');
    }
    
    // Enter key handler for input
    newSiteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addSite();
        }
    });
    
    function loadBlockedSites() {
        browser.storage.sync.get(['blockedSites'], function(result) {
            if (browser.runtime.lastError) {
                console.error('Error loading blocked sites:', browser.runtime.lastError);
                displaySites([]);
                return;
            }
            
            if (result && typeof result === 'object') {
                const sites = result.blockedSites || [];
                displaySites(sites);
            } else {
                console.warn('Invalid result from storage:', result);
                displaySites([]);
            }
        });
    }
    
    function displaySites(sites) {
        if (sites.length === 0) {
            siteList.innerHTML = '<div class="site-item">No sites currently blocked</div>';
            return;
        }
        
        siteList.innerHTML = sites.map(site => `
            <div class="site-item">
                <span class="site-domain">${site}</span>
                <button class="btn btn-danger" onclick="removeSite('${site}')">Remove</button>
            </div>
        `).join('');
    }
    
    function addSite() {
        console.log('Add site button clicked');
        const domain = newSiteInput.value.trim().toLowerCase();
        console.log('Domain entered:', domain);
        
        if (!domain) {
            showStatus('Please enter a domain name', 'error');
            return;
        }
        
        // Basic domain validation
        if (!isValidDomain(domain)) {
            console.log('Invalid domain:', domain);
            showStatus('Please enter a valid domain (e.g., example.com)', 'error');
            return;
        }
        
        console.log('Domain is valid, proceeding with addition');
        
        browser.storage.sync.get(['blockedSites'], function(result) {
            if (browser.runtime.lastError) {
                console.error('Error loading blocked sites for add:', browser.runtime.lastError);
                showStatus('Error accessing storage', 'error');
                return;
            }
            
            if (!result || typeof result !== 'object') {
                console.warn('Invalid result from storage when adding:', result);
                showStatus('Error accessing storage', 'error');
                return;
            }
            
            console.log('Current blocked sites:', result.blockedSites);
            const sites = result.blockedSites || [];
            
            if (sites.includes(domain)) {
                showStatus('This site is already in the blocklist', 'error');
                return;
            }
            
            sites.push(domain);
            console.log('Updated sites array:', sites);
            
            browser.storage.sync.set({ blockedSites: sites }, function() {
                if (browser.runtime.lastError) {
                    console.error('Storage error:', browser.runtime.lastError);
                    showStatus('Error saving site', 'error');
                    return;
                }
                
                console.log('Site saved successfully');
                showStatus('Site added successfully', 'success');
                newSiteInput.value = '';
                displaySites(sites);
                
                // Notify background script to update permissions
                browser.runtime.sendMessage({
                    action: 'updateBlockedSites',
                    sites: sites
                }).then(() => {
                    console.log('Background script notified');
                }).catch(error => {
                    console.error('Error notifying background script:', error);
                });
            });
        });
    }
    
    // Make removeSite globally accessible
    window.removeSite = function(domain) {
        browser.storage.sync.get(['blockedSites'], function(result) {
            if (browser.runtime.lastError) {
                console.error('Error loading blocked sites for remove:', browser.runtime.lastError);
                showStatus('Error accessing storage', 'error');
                return;
            }
            
            if (!result || typeof result !== 'object') {
                console.warn('Invalid result from storage when removing:', result);
                showStatus('Error accessing storage', 'error');
                return;
            }
            
            const sites = result.blockedSites || [];
            const updatedSites = sites.filter(site => site !== domain);
            
            browser.storage.sync.set({ blockedSites: updatedSites }, function() {
                showStatus('Site removed successfully', 'success');
                displaySites(updatedSites);
                
                // Notify background script to update permissions
                browser.runtime.sendMessage({
                    action: 'updateBlockedSites',
                    sites: updatedSites
                });
            });
        });
    };
    
    function isValidDomain(domain) {
        // Remove protocol if present
        domain = domain.replace(/^https?:\/\//, '');
        // Remove path if present
        domain = domain.split('/')[0];
        
        // Basic domain pattern validation
        const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
        return domainPattern.test(domain) && domain.includes('.');
    }
    
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';
        
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
});