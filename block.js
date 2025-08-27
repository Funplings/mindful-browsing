document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    const tabId = parseInt(urlParams.get('tabId'));
    
    const targetUrlElement = document.getElementById('target-url');
    const reasonTextarea = document.getElementById('reason');
    const charStatusElement = document.getElementById('char-status');
    const proceedBtn = document.getElementById('proceed-btn');
    const form = document.getElementById('access-form');
    const historyContainer = document.getElementById('visit-history');
    
    const isTemporarilyBlocked = urlParams.get('blocked') === 'true';
    
    if (targetUrl) {
        targetUrlElement.textContent = decodeURIComponent(targetUrl);
    }
    
    function updateCharStatus() {
        if (isTemporarilyBlocked) {
            return; // Don't allow access when temporarily blocked
        }
        
        const length = reasonTextarea.value.length;
        
        const counter = charStatusElement.parentElement;
        if (length >= 100) {
            charStatusElement.textContent = 'Minimum reached';
            counter.classList.add('valid');
            counter.classList.remove('invalid');
            proceedBtn.disabled = false;
        } else {
            charStatusElement.textContent = 'Minimum not reached';
            counter.classList.add('invalid');
            counter.classList.remove('valid');
            proceedBtn.disabled = true;
        }
    }
    
    reasonTextarea.addEventListener('input', updateCharStatus);
    
    // Handle temporary blocks
    if (isTemporarilyBlocked) {
        form.style.display = 'none';
        historyContainer.innerHTML = '<div class="temporary-block-message"><h3>⛔ Temporarily Blocked</h3><p>This site is temporarily blocked because you closed a reflection session without completing it. Please wait before trying again.</p></div>';
        return;
    }
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const reason = reasonTextarea.value.trim();
        const duration = parseInt(document.getElementById('duration').value);
        
        if (reason.length < 100) {
            alert('Please provide a reason with at least 100 characters.');
            return;
        }
        
        if (duration < 1 || duration > 180) {
            alert('Please select a duration between 1 and 180 minutes.');
            return;
        }
        
        proceedBtn.disabled = true;
        proceedBtn.textContent = 'Processing...';
        
        browser.runtime.sendMessage({
            action: 'allowAccess',
            tabId: tabId,
            targetUrl: targetUrl,
            reason: reason,
            duration: duration
        }).then(response => {
            if (response.success) {
                window.location.href = targetUrl;
            } else {
                proceedBtn.disabled = false;
                proceedBtn.textContent = 'Proceed to Site';
                alert('Failed to process request. Please try again.');
            }
        }).catch(error => {
            console.error('Error:', error);
            proceedBtn.disabled = false;
            proceedBtn.textContent = 'Proceed to Site';
            alert('An error occurred. Please try again.');
        });
    });
    
    function loadVisitHistory() {
        browser.runtime.sendMessage({
            action: 'getVisitHistory'
        }).then(response => {
            displayHistory(response.history);
        }).catch(error => {
            console.error('Error loading history:', error);
            historyContainer.innerHTML = '<div class="no-history">Failed to load visit history.</div>';
        });
    }
    
    function displayHistory(history) {
        if (!history || history.length === 0) {
            historyContainer.innerHTML = '<div class="no-history">No previous visits recorded.</div>';
            return;
        }
        
        const filteredHistory = history.filter(item => {
            try {
                const itemHostname = new URL(item.url).hostname.toLowerCase();
                const targetHostname = new URL(targetUrl).hostname.toLowerCase();
                return itemHostname === targetHostname;
            } catch (e) {
                return false;
            }
        });
        
        if (filteredHistory.length === 0) {
            historyContainer.innerHTML = '<div class="no-history">No previous visits to this site.</div>';
            return;
        }
        
        const sortedHistory = filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Group visits by day and calculate total screentime
        const dayGroups = {};
        sortedHistory.forEach(item => {
            const date = new Date(item.timestamp);
            const dayKey = date.toDateString();
            
            if (!dayGroups[dayKey]) {
                dayGroups[dayKey] = {
                    visits: [],
                    totalMinutes: 0
                };
            }
            
            dayGroups[dayKey].visits.push(item);
            dayGroups[dayKey].totalMinutes += item.duration;
        });
        
        // Sort days by date (most recent first)
        const sortedDays = Object.keys(dayGroups).sort((a, b) => new Date(b) - new Date(a));
        
        historyContainer.innerHTML = sortedDays.map(dayKey => {
            const dayData = dayGroups[dayKey];
            const dayDisplay = new Date(dayKey).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric', 
                month: 'long',
                day: 'numeric'
            });
            
            const visitsHtml = dayData.visits.map(item => {
                const date = new Date(item.timestamp);
                const formattedTime = date.toLocaleTimeString();
                
                let visitContent = `
                    <div class="history-item">
                        <div class="history-time">${formattedTime}</div>
                        <div class="history-reason"><strong>Initial reason:</strong> "${item.reason}"</div>
                        <div class="history-duration">Duration: ${item.duration} minutes</div>
                `;
                
                if (item.reflection) {
                    visitContent += `<div class="history-reflection"><strong>Post-visit reflection:</strong> "${item.reflection}"</div>`;
                }
                
                visitContent += `</div>`;
                return visitContent;
            }).join('');
            
            return `
                <div class="day-group">
                    <div class="day-header">
                        <h4>${dayDisplay}</h4>
                        <div class="day-total">Total screentime: ${dayData.totalMinutes} minutes</div>
                    </div>
                    ${visitsHtml}
                </div>
            `;
        }).join('');
    }
    
    loadVisitHistory();
    updateCharStatus();
});