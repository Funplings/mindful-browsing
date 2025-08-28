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
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');
    const currentDateElement = document.getElementById('current-date');
    
    const isTemporarilyBlocked = urlParams.get('blocked') === 'true';
    
    let currentViewDate = new Date();
    let allHistory = [];
    
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
            allHistory = response.history || [];
            displayHistoryForCurrentDate();
        }).catch(error => {
            console.error('Error loading history:', error);
            historyContainer.innerHTML = '<div class="no-history">Failed to load visit history.</div>';
        });
    }
    
    function displayHistoryForCurrentDate() {
        updateDateDisplay();
        updateNavigationButtons();
        
        const dayKey = currentViewDate.toDateString();
        const dayHistory = getHistoryForDay(dayKey);
        
        if (dayHistory.length === 0) {
            historyContainer.innerHTML = '<div class="no-history">No visits recorded for this day.</div>';
            return;
        }
        
        const totalMinutes = dayHistory.reduce((sum, item) => sum + item.duration, 0);
        
        const visitsHtml = dayHistory.map(item => {
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
        
        historyContainer.innerHTML = `
            <div class="day-total">Total screentime: ${totalMinutes} minutes</div>
            ${visitsHtml}
        `;
    }
    
    function getHistoryForDay(dayKey) {
        return allHistory.filter(item => {
            try {
                const itemHostname = new URL(item.url).hostname.toLowerCase();
                const targetHostname = new URL(targetUrl).hostname.toLowerCase();
                const itemDayKey = new Date(item.timestamp).toDateString();
                return itemHostname === targetHostname && itemDayKey === dayKey;
            } catch (e) {
                return false;
            }
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    function updateDateDisplay() {
        const today = new Date();
        const isToday = currentViewDate.toDateString() === today.toDateString();
        
        let dateText;
        if (isToday) {
            dateText = 'Today';
        } else {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (currentViewDate.toDateString() === yesterday.toDateString()) {
                dateText = 'Yesterday';
            } else {
                dateText = currentViewDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        }
        
        currentDateElement.textContent = dateText;
    }
    
    function updateNavigationButtons() {
        const today = new Date();
        const isToday = currentViewDate.toDateString() === today.toDateString();
        
        nextDayBtn.disabled = isToday;
        
        const hasHistoryForPrevDays = allHistory.some(item => {
            try {
                const itemHostname = new URL(item.url).hostname.toLowerCase();
                const targetHostname = new URL(targetUrl).hostname.toLowerCase();
                const itemDate = new Date(item.timestamp);
                return itemHostname === targetHostname && itemDate < currentViewDate;
            } catch (e) {
                return false;
            }
        });
        
        prevDayBtn.disabled = !hasHistoryForPrevDays;
    }
    
    
    // Navigation event listeners
    prevDayBtn.addEventListener('click', function() {
        currentViewDate.setDate(currentViewDate.getDate() - 1);
        displayHistoryForCurrentDate();
    });
    
    nextDayBtn.addEventListener('click', function() {
        if (currentViewDate.toDateString() !== new Date().toDateString()) {
            currentViewDate.setDate(currentViewDate.getDate() + 1);
            displayHistoryForCurrentDate();
        }
    });
    
    loadVisitHistory();
    updateCharStatus();
});