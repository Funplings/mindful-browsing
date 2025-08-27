document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    const tabId = parseInt(urlParams.get('tabId'));
    const visitId = urlParams.get('visitId');
    
    const targetUrlElement = document.getElementById('target-url');
    const reflectionTextarea = document.getElementById('reflection');
    const reflectionStatus = document.getElementById('reflection-status');
    const completeBtn = document.getElementById('complete-btn');
    const form = document.getElementById('reflection-form');
    
    if (targetUrl) {
        targetUrlElement.textContent = decodeURIComponent(targetUrl);
    }
    
    function updateReflectionStatus() {
        const length = reflectionTextarea.value.length;
        
        const counter = reflectionStatus.parentElement;
        if (length >= 100) {
            reflectionStatus.textContent = 'Minimum reached';
            counter.classList.add('valid');
            counter.classList.remove('invalid');
            completeBtn.disabled = false;
        } else {
            reflectionStatus.textContent = 'Minimum not reached';
            counter.classList.add('invalid');
            counter.classList.remove('valid');
            completeBtn.disabled = true;
        }
    }
    
    reflectionTextarea.addEventListener('input', updateReflectionStatus);
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const reflection = reflectionTextarea.value.trim();
        
        if (reflection.length < 100) {
            alert('Please provide a reflection with at least 100 characters.');
            return;
        }
        
        completeBtn.disabled = true;
        completeBtn.textContent = 'Processing...';
        
        browser.runtime.sendMessage({
            action: 'storeReflection',
            visitId: visitId,
            reflection: reflection
        }).then(response => {
            if (response.success) {
                // Close the tab or redirect to initial screen
                browser.tabs.update(tabId, { 
                    url: browser.runtime.getURL('block.html') + '?target=' + encodeURIComponent(targetUrl) + '&tabId=' + tabId 
                });
            } else {
                completeBtn.disabled = false;
                completeBtn.textContent = 'Complete Reflection';
                alert('Failed to save reflection. Please try again.');
            }
        }).catch(error => {
            console.error('Error:', error);
            completeBtn.disabled = false;
            completeBtn.textContent = 'Complete Reflection';
            alert('An error occurred. Please try again.');
        });
    });
    
    // Handle page unload without completing reflection
    let reflectionCompleted = false;
    
    form.addEventListener('submit', function() {
        reflectionCompleted = true;
    });
    
    window.addEventListener('beforeunload', function(e) {
        if (!reflectionCompleted && reflectionTextarea.value.length < 100) {
            // Notify background script to block the site
            browser.runtime.sendMessage({
                action: 'blockSiteTemporarily',
                targetUrl: targetUrl,
                duration: 1 // 1 minute block
            });
        }
    });
    
    updateReflectionStatus();
});