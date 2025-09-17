document.addEventListener('DOMContentLoaded', function() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorContainer = document.getElementById('errorContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultCount = document.getElementById('resultCount');
    const jobsTableBody = document.getElementById('jobsTableBody');
    const noResults = document.getElementById('noResults');
    const errorText = document.getElementById('errorText');

    // Store the original API data for re-filtering
    let originalApiData = null;

    // Check if we have search criteria
    const savedCriteria = localStorage.getItem('searchCriteria');
    if (!savedCriteria) {
        showError('No search criteria found. Please start a new search.');
        return;
    }

    const criteria = JSON.parse(savedCriteria);
    
    // Populate the inline input fields
    const jobTitleInput = document.getElementById('jobTitleInput');
    const locationInput = document.getElementById('locationInput');
    const dateRangeInput = document.getElementById('dateRangeInput');
    jobTitleInput.value = criteria.jobTitle;
    locationInput.value = criteria.location;
    dateRangeInput.value = criteria.dateRange || '1'; // Default to "Last 24 hours"
    
    console.log('Initial criteria loaded:', criteria);
    console.log('Date range input value set to:', dateRangeInput.value);
    
    // Add event listener to date range dropdown to log changes
    dateRangeInput.addEventListener('change', () => {
        console.log('Date range changed to:', dateRangeInput.value);
        
        // If we have original data, re-filter it instead of making a new API call
        if (originalApiData) {
            console.log('Re-filtering existing data...');
            const newDateRange = parseInt(dateRangeInput.value, 10);
            const filteredJobs = filterJobsByDateRange(originalApiData, newDateRange);
            
            console.log(`Re-filtered: ${filteredJobs.length} jobs for ${newDateRange} days`);
            
            // Update the criteria
            criteria.dateRange = dateRangeInput.value;
            
            // Clear and repopulate table
            jobsTableBody.innerHTML = '';
            
            if (filteredJobs.length === 0) {
                showNoResults();
                return;
            }
            
            filteredJobs.forEach((job, index) => {
                const row = createJobRow(job, index);
                jobsTableBody.appendChild(row);
            });
            
            // Apply states and update UI
            applyHiddenState();
            applySeenState();
            updateResultCount();
            addShowAllButton();
            addTableSorting();
            
            // Restore sort if exists
            if (savedSortColumn !== null && savedSortDirection !== null) {
                const table = document.getElementById('jobsTable');
                table.dataset.sortColumn = savedSortColumn;
                table.dataset.sortDirection = savedSortDirection;
                sortTable(parseInt(savedSortColumn), savedSortDirection, true);
            }
        }
    });

    // Add refresh button functionality
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', () => {
        console.log('Refresh button clicked');
        
        // Get current values from input fields
        const updatedCriteria = {
            jobTitle: jobTitleInput.value.trim(),
            location: locationInput.value.trim(),
            dateRange: dateRangeInput.value,
            jobCount: criteria.jobCount || 100
        };
        
        console.log('Updated criteria:', updatedCriteria);
        console.log('Previous criteria:', criteria);
        
        // Validate input
        if (!updatedCriteria.jobTitle || !updatedCriteria.location) {
            alert('Please enter both job title and location.');
            return;
        }
        
        // Update localStorage with new criteria
        localStorage.setItem('searchCriteria', JSON.stringify(updatedCriteria));
        
        // Save current sort state
        const table = document.getElementById('jobsTable');
        const sortColumn = table ? table.dataset.sortColumn : null;
        const sortDirection = table ? table.dataset.sortDirection : null;
        if (sortColumn !== undefined && sortDirection !== undefined) {
            localStorage.setItem('jobSortColumn', sortColumn);
            localStorage.setItem('jobSortDirection', sortDirection);
        }        
        refreshResults(updatedCriteria);
    });

    // Restore sorting preference on page load
    let savedSortColumn = localStorage.getItem('jobSortColumn');
    let savedSortDirection = localStorage.getItem('jobSortDirection');
    // Check if we already have results (from a redirect)
    const savedResults = localStorage.getItem('jobResults');
    if (savedResults) {
        const results = JSON.parse(savedResults);
        displayResults(results);
        // Don't remove jobResults - keep them for page refreshes
        return;
    }

    // If no saved results, perform the search
    performSearch(criteria);

    async function refreshResults(criteria) {
        console.log('refreshResults called with:', criteria);
        
        // Show loading state
        showLoading();
        
        // Clear previous results
        resultsContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        noResults.style.display = 'none';
        
        // Clear hidden jobs for fresh start
        localStorage.removeItem('hiddenJobs');
        
        // Clear seen jobs for fresh start
        localStorage.removeItem('seenJobs');
        
        // Perform new search
        await performSearch(criteria);
    }

    function showLoading() {
        loadingMessage.style.display = 'block';
    }

    async function performSearch(criteria) {
        console.log('performSearch called with criteria:', criteria);
        
        try {
            const requestBody = {
                jobTitle: criteria.jobTitle,
                location: criteria.location,
                dateRange: criteria.dateRange || '1',
                count: criteria.jobCount || 100
            };
            
            console.log('Making API request with body:', requestBody);
            
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            
            console.log('API response received:', {
                success: data.success,
                count: data.count,
                debug: data.debug,
                searchCriteria: data.searchCriteria
            });

            if (!response.ok) {
                throw new Error(data.error || 'Failed to scrape jobs');
            }

            displayResults(data);

        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'Failed to search for jobs. Please try again.');
        }
    }

    function displayResults(data) {
        console.log('displayResults called with:', {
            success: data.success,
            count: data.count,
            debug: data.debug,
            sampleJobs: data.data ? data.data.slice(0, 3).map(job => ({ title: job.title, date: job.datePosted })) : []
        });
        
        hideLoading();

        if (!data.success || !data.data || data.data.length === 0) {
            console.log('No results to display');
            showNoResults();
            return;
        }

        // Store original data for re-filtering
        originalApiData = data.data;

        // Get the current date range from the criteria
        const currentDateRange = parseInt(criteria.dateRange || '1', 10);
        
        // Filter jobs based on date range
        const filteredJobs = filterJobsByDateRange(data.data, currentDateRange);
        
        console.log(`Original jobs: ${data.data.length}, Filtered jobs: ${filteredJobs.length} (${currentDateRange} days)`);

        if (filteredJobs.length === 0) {
            showNoResults();
            return;
        }

        // Clear existing table data
        jobsTableBody.innerHTML = '';

        // Populate table with filtered job data
        filteredJobs.forEach((job, index) => {
            const row = createJobRow(job, index);
            jobsTableBody.appendChild(row);
        });

        // Apply hidden state from localStorage
        applyHiddenState();
        
        // Apply seen state from localStorage
        applySeenState();

        // Update result count
        updateResultCount();

        resultsContainer.style.display = 'block';
        
        // Add "Show all" button if there are hidden rows
        addShowAllButton();
        
        // Initialize table sorting after table is created
        addTableSorting();
        
        // Always restore previous sort state if available, and set table's dataset to match
        if (savedSortColumn !== null && savedSortDirection !== null) {
            const table = document.getElementById('jobsTable');
            table.dataset.sortColumn = savedSortColumn;
            table.dataset.sortDirection = savedSortDirection;
            sortTable(parseInt(savedSortColumn), savedSortDirection, true);
        } else {
            // Sort by date by default (column 1, since Seen is now column 0)
            sortTable(1);
        }
        
        // Add event delegation for hide buttons
        addHideButtonListeners();
    }

    function createJobRow(job, index) {
        const row = document.createElement('tr');
        row.dataset.jobId = job.link ? job.link.split('/').pop().split('?')[0] : `job-${index}`;
        
        // Format date in user-friendly format without dummy time
        let formattedDate = 'Date not available';
        if (job.datePosted && job.datePosted !== 'Date not available') {
            try {
                const date = new Date(job.datePosted);
                if (!isNaN(date.getTime())) {
                    // Format as "14 July" (no dummy time since scraping data doesn't include time)
                    const dateOptions = { 
                        day: 'numeric', 
                        month: 'long' 
                    };
                    
                    formattedDate = date.toLocaleDateString('en-US', dateOptions);
                } else {
                    formattedDate = job.datePosted;
                }
            } catch (e) {
                formattedDate = job.datePosted;
            }
        }

        row.innerHTML = `
            <td>
                <div class="seen-checkbox-container">
                    <button class="seen-btn" data-job-id="${row.dataset.jobId}" title="Mark as seen">
                        <span class="material-icons">star_border</span>
                    </button>
                </div>
            </td>
            <td>${formattedDate}</td>
            <td>
                <div class="company-info">
                    ${job.logo ? `<img src="${escapeHtml(job.logo)}" alt="${escapeHtml(job.company)}" class="company-logo" onerror="this.style.display='none'">` : ''}
                    <span class="company-name">${escapeHtml(job.company || 'Company not specified')}</span>
                </div>
            </td>
            <td>
                <div class="job-title">${escapeHtml(job.title || 'No title')}</div>
            </td>
            <td>
                <div class="action-buttons">
                    ${job.link ? 
                        `<a href="${escapeHtml(job.link)}" target="_blank" rel="noopener noreferrer" class="job-link">View</a>` : 
                        '<span style="color: #999;">No link available</span>'
                    }
                    <button class="hide-btn" data-job-id="${row.dataset.jobId}">Hide</button>
                </div>
            </td>
        `;

        return row;
    }

    function showError(message) {
        hideLoading();
        errorText.textContent = message;
        errorContainer.style.display = 'block';
    }

    function showNoResults() {
        hideLoading();
        resultsContainer.style.display = 'block';
        noResults.style.display = 'block';
        document.querySelector('.table-container').style.display = 'none';
    }

    function hideLoading() {
        loadingMessage.style.display = 'none';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Frontend date filtering function
    function filterJobsByDateRange(jobs, dateRangeDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - dateRangeDays);
        
        return jobs.filter(job => {
            if (!job.datePosted || job.datePosted === 'Date not available') return false;
            
            try {
                const lowerDateString = job.datePosted.toLowerCase().trim();
                
                // Handle "X hours ago", "X minutes ago", etc. - within 24 hours
                const hourMatch = lowerDateString.match(/(\d+)\s+hours?\s+ago/i);
                if (hourMatch) {
                    const hoursAgo = parseInt(hourMatch[1], 10);
                    return hoursAgo <= 24 && dateRangeDays >= 1;
                }
                
                if (lowerDateString.includes('minute') || lowerDateString.includes('second')) {
                    return dateRangeDays >= 1;
                }
                
                // Handle "X days ago"
                const dayMatch = lowerDateString.match(/(\d+)\s+days?\s+ago/i);
                if (dayMatch) {
                    const daysAgo = parseInt(dayMatch[1], 10);
                    return daysAgo <= dateRangeDays;
                }
                
                // Handle "X weeks ago"
                const weekMatch = lowerDateString.match(/(\d+)\s+weeks?\s+ago/i);
                if (weekMatch) {
                    const weeksAgo = parseInt(weekMatch[1], 10);
                    const daysAgo = weeksAgo * 7;
                    return daysAgo <= dateRangeDays;
                }
                
                // Handle "X months ago"
                const monthMatch = lowerDateString.match(/(\d+)\s+months?\s+ago/i);
                if (monthMatch) {
                    const monthsAgo = parseInt(monthMatch[1], 10);
                    const daysAgo = monthsAgo * 30;
                    return daysAgo <= dateRangeDays;
                }
                
                // Handle text variations
                if (lowerDateString.includes('a day ago') || lowerDateString.includes('1 day ago')) {
                    return dateRangeDays >= 1;
                }
                if (lowerDateString.includes('a week ago') || lowerDateString.includes('1 week ago')) {
                    return dateRangeDays >= 7;
                }
                if (lowerDateString.includes('a month ago') || lowerDateString.includes('1 month ago')) {
                    return dateRangeDays >= 30;
                }
                
                // Try to parse as ISO date
                const jobDate = new Date(job.datePosted);
                if (!isNaN(jobDate.getTime())) {
                    return jobDate >= cutoffDate;
                }
                
                // If we can't parse it, include for longer ranges
                return dateRangeDays >= 7;
            } catch (e) {
                return dateRangeDays >= 7;
            }
        });
    }

    // Add event delegation for hide/unhide buttons and seen buttons
    function addHideButtonListeners() {
        document.getElementById('jobsTableBody').addEventListener('click', function(e) {
            if (e.target.classList.contains('hide-btn')) {
                const jobId = e.target.dataset.jobId;
                if (e.target.classList.contains('unhide-btn')) {
                    unhideJobRow(jobId);
                } else {
                    hideJobRow(jobId);
                }
            } else if (e.target.classList.contains('seen-btn') || e.target.closest('.seen-btn')) {
                const button = e.target.classList.contains('seen-btn') ? e.target : e.target.closest('.seen-btn');
                const jobId = button.dataset.jobId;
                toggleSeenJob(jobId);
            }
        });
    }

    // Hide/Show functionality
    function hideJobRow(jobId) {
        const row = document.querySelector(`tr[data-job-id="${jobId}"]`);
        if (row) {
            row.style.display = 'none';
            row.classList.add('hidden-row');
            
            // Save to localStorage
            const hiddenJobs = JSON.parse(localStorage.getItem('hiddenJobs') || '[]');
            if (!hiddenJobs.includes(jobId)) {
                hiddenJobs.push(jobId);
                localStorage.setItem('hiddenJobs', JSON.stringify(hiddenJobs));
            }
            
            // Update result count
            updateResultCount();
            
            // Update "Show all" button
            addShowAllButton();
        }
    }

    function unhideJobRow(jobId) {
        const row = document.querySelector(`tr[data-job-id="${jobId}"]`);
        if (row) {
            // Remove the unhide styling and button
            row.classList.remove('shown-hidden-row');
            const hideBtn = row.querySelector('.hide-btn');
            if (hideBtn) {
                hideBtn.textContent = 'Hide';
                hideBtn.classList.remove('unhide-btn');
            }
            
            // Update result count
            updateResultCount();
        }
    }

    function applyHiddenState() {
        const hiddenJobs = JSON.parse(localStorage.getItem('hiddenJobs') || '[]');
        hiddenJobs.forEach(jobId => {
            const row = document.querySelector(`tr[data-job-id="${jobId}"]`);
            if (row) {
                row.style.display = 'none';
                row.classList.add('hidden-row');
            }
        });
    }

    // Seen functionality
    function toggleSeenJob(jobId) {
        const row = document.querySelector(`tr[data-job-id="${jobId}"]`);
        const seenBtn = row.querySelector('.seen-btn');
        const iconSpan = seenBtn.querySelector('.material-icons');
        
        if (row.classList.contains('job-row-seen')) {
            // Mark as unseen
            row.classList.remove('job-row-seen');
            seenBtn.classList.remove('seen');
            seenBtn.title = 'Mark as seen';
            iconSpan.textContent = 'star_border';
            
            // Remove from localStorage
            const seenJobs = JSON.parse(localStorage.getItem('seenJobs') || '[]');
            const updatedSeenJobs = seenJobs.filter(id => id !== jobId);
            localStorage.setItem('seenJobs', JSON.stringify(updatedSeenJobs));
        } else {
            // Mark as seen
            row.classList.add('job-row-seen');
            seenBtn.classList.add('seen');
            seenBtn.title = 'Mark as unseen';
            iconSpan.textContent = 'star';
            
            // Save to localStorage
            const seenJobs = JSON.parse(localStorage.getItem('seenJobs') || '[]');
            if (!seenJobs.includes(jobId)) {
                seenJobs.push(jobId);
                localStorage.setItem('seenJobs', JSON.stringify(seenJobs));
            }
        }
    }

    function applySeenState() {
        const seenJobs = JSON.parse(localStorage.getItem('seenJobs') || '[]');
        seenJobs.forEach(jobId => {
            const row = document.querySelector(`tr[data-job-id="${jobId}"]`);
            if (row) {
                row.classList.add('job-row-seen');
                const seenBtn = row.querySelector('.seen-btn');
                if (seenBtn) {
                    seenBtn.classList.add('seen');
                    seenBtn.title = 'Mark as unseen';
                    const iconSpan = seenBtn.querySelector('.material-icons');
                    if (iconSpan) {
                    iconSpan.textContent = 'star';
                    }
                }
            }
        });
    }

    function addShowAllButton() {
        const hiddenJobs = JSON.parse(localStorage.getItem('hiddenJobs') || '[]');
        const existingButton = document.getElementById('showAllBtn');
        
        if (hiddenJobs.length > 0) {
            if (!existingButton) {
                const showAllBtn = document.createElement('button');
                showAllBtn.id = 'showAllBtn';
                showAllBtn.className = 'show-all-btn';
                showAllBtn.textContent = `Show all (${hiddenJobs.length} hidden)`;
                showAllBtn.onclick = showAllHiddenRows;
                
                // Append to the container, outside the bordered table container
                const container = document.querySelector('.container');
                container.appendChild(showAllBtn);
            } else {
                existingButton.textContent = `Show all (${hiddenJobs.length} hidden)`;
            }
        } else if (existingButton) {
            existingButton.remove();
        }
    }

    function showAllHiddenRows() {
        const hiddenRows = document.querySelectorAll('.hidden-row');
        hiddenRows.forEach(row => {
            row.style.display = '';
            row.classList.remove('hidden-row');
            row.classList.add('shown-hidden-row');
            
            // Change the hide button to "Unhide" for these rows
            const hideBtn = row.querySelector('.hide-btn');
            if (hideBtn) {
                hideBtn.textContent = 'Unhide';
                hideBtn.classList.add('unhide-btn');
            }
        });
        
        // Clear localStorage
        localStorage.removeItem('hiddenJobs');
        
        // Update result count
        updateResultCount();
        
        // Remove "Show all" button
        const showAllBtn = document.getElementById('showAllBtn');
        if (showAllBtn) {
            showAllBtn.remove();
        }
    }

    function updateResultCount() {
        const visibleRows = document.querySelectorAll('#jobsTableBody tr:not(.hidden-row)');
        const totalRows = document.querySelectorAll('#jobsTableBody tr').length;
        const hiddenCount = totalRows - visibleRows.length;
        
        if (hiddenCount > 0) {
            resultCount.textContent = `Showing ${visibleRows.length} of ${totalRows} jobs (${hiddenCount} hidden)`;
        } else {
            resultCount.textContent = `Found ${totalRows} job${totalRows !== 1 ? 's' : ''}`;
        }
    }

    function addTableSorting() {
        const headers = document.querySelectorAll('.jobs-table th');
        headers.forEach((header, index) => {
            // Remove previous click listeners by cloning
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);
        });
        // Re-select headers after cloning
        const freshHeaders = document.querySelectorAll('.jobs-table th');
        freshHeaders.forEach((header, index) => {
            // Skip first column (Seen) and last column (Actions) - make columns 1, 2, 3 sortable (Date, Title, Company)
            if (index > 0 && index < 4) {
                header.style.cursor = 'pointer';
                header.title = 'Click to sort';
                header.classList.add('sortable');
                header.addEventListener('click', () => {
                    // Toggle sort direction and save to localStorage
                    sortTable(index);
                    const table = document.getElementById('jobsTable');
                    localStorage.setItem('jobSortColumn', index);
                    localStorage.setItem('jobSortDirection', table.dataset.sortDirection);
                });
            }
        });
    }

    function sortTable(columnIndex, directionOverride, isRestore) {
        const table = document.getElementById('jobsTable');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const headers = document.querySelectorAll('.jobs-table th');
        
        let newDirection;
        if (directionOverride) {
            newDirection = directionOverride;
        } else {
            const currentDirection = table.dataset.sortDirection || 'asc';
            newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
        }
        table.dataset.sortDirection = newDirection;
        table.dataset.sortColumn = columnIndex;
        
        rows.sort((a, b) => {
            let aText, bText;
            if (columnIndex === 2) {
                aText = a.cells[columnIndex].querySelector('.company-name')?.textContent.trim() || '';
                bText = b.cells[columnIndex].querySelector('.company-name')?.textContent.trim() || '';
            } else {
                aText = a.cells[columnIndex].textContent.trim();
                bText = b.cells[columnIndex].textContent.trim();
            }
            if (columnIndex === 1) {
                const currentYear = new Date().getFullYear();
                const aDate = new Date(`${aText} ${currentYear}`);
                const bDate = new Date(`${bText} ${currentYear}`);
                if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                    return newDirection === 'asc' ? aDate - bDate : bDate - aDate;
                }
            }
            return newDirection === 'asc' ? 
                aText.localeCompare(bText) : 
                bText.localeCompare(aText);
        });
        rows.forEach(row => tbody.appendChild(row));
        headers.forEach((h, i) => {
            h.classList.remove('sort-asc', 'sort-desc');
            if (i === columnIndex) {
                h.classList.add(`sort-${newDirection}`);
            }
        });
        // If restoring, don't toggle direction on next click
        if (isRestore) {
            table.dataset.sortDirection = newDirection;
        }
    }
});