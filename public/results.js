document.addEventListener('DOMContentLoaded', function() {
    const loadingMessage = document.getElementById('loadingMessage');
    const errorContainer = document.getElementById('errorContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const searchCriteria = document.getElementById('searchCriteria');
    const resultCount = document.getElementById('resultCount');
    const jobsTableBody = document.getElementById('jobsTableBody');
    const noResults = document.getElementById('noResults');
    const errorText = document.getElementById('errorText');

    // Check if we have search criteria
    const savedCriteria = localStorage.getItem('searchCriteria');
    if (!savedCriteria) {
        showError('No search criteria found. Please start a new search.');
        return;
    }

    const criteria = JSON.parse(savedCriteria);
    searchCriteria.textContent = `Searching for "${criteria.jobTitle}" in "${criteria.location}" for last "${criteria.datePosted}"`;

    // Add refresh button functionality
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', () => {
        refreshResults(criteria);
    });

    // Check if we already have results (from a redirect)
    const savedResults = localStorage.getItem('jobResults');
    if (savedResults) {
        const results = JSON.parse(savedResults);
        displayResults(results);
        localStorage.removeItem('jobResults'); // Clean up
        return;
    }

    // If no saved results, perform the search
    performSearch(criteria);

    async function refreshResults(criteria) {
        // Show loading state
        showLoading();
        
        // Clear previous results
        resultsContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        noResults.style.display = 'none';
        
        // Clear hidden jobs for fresh start
        localStorage.removeItem('hiddenJobs');
        
        // Perform new search
        await performSearch(criteria);
    }

    function showLoading() {
        loadingMessage.style.display = 'block';
    }

    async function performSearch(criteria) {
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jobTitle: criteria.jobTitle,
                    location: criteria.location,
                    count: criteria.jobCount || 100
                })
            });

            const data = await response.json();

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
        hideLoading();

        if (!data.success || !data.data || data.data.length === 0) {
            showNoResults();
            return;
        }

        const jobs = data.data;

        // Clear existing table data
        jobsTableBody.innerHTML = '';

        // Populate table with job data
        jobs.forEach((job, index) => {
            const row = createJobRow(job, index);
            jobsTableBody.appendChild(row);
        });

        // Apply hidden state from localStorage
        applyHiddenState();

        // Update result count
        updateResultCount();

        resultsContainer.style.display = 'block';
        
        // Add "Show all" button if there are hidden rows
        addShowAllButton();
        
        // Initialize table sorting after table is created
        addTableSorting();
        
        // Sort by date by default (column 0)
        sortTable(0);
        
        // Add event delegation for hide buttons
        addHideButtonListeners();
    }

    function createJobRow(job, index) {
        const row = document.createElement('tr');
        row.dataset.jobId = job.link ? job.link.split('/').pop().split('?')[0] : `job-${index}`;
        
        // Format date in user-friendly format
        let formattedDate = 'Date not available';
        if (job.datePosted && job.datePosted !== 'Date not available') {
            try {
                const date = new Date(job.datePosted);
                if (!isNaN(date.getTime())) {
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = date.toLocaleDateString('en-US', { month: 'long' });
                    const year = date.getFullYear();
                    formattedDate = `${day} ${month} ${year}`;
                } else {
                    formattedDate = job.datePosted;
                }
            } catch (e) {
                formattedDate = job.datePosted;
            }
        }

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>
                <div class="job-title">${escapeHtml(job.title || 'No title')}</div>
            </td>
            <td>${escapeHtml(job.location || 'Location not specified')}</td>
            <td>
                <div class="company-info">
                    ${job.logo ? `<img src="${escapeHtml(job.logo)}" alt="${escapeHtml(job.company)}" class="company-logo" onerror="this.style.display='none'">` : ''}
                    <span class="company-name">${escapeHtml(job.company || 'Company not specified')}</span>
                </div>
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

    // Add event delegation for hide/unhide buttons
    function addHideButtonListeners() {
        document.getElementById('jobsTableBody').addEventListener('click', function(e) {
            if (e.target.classList.contains('hide-btn')) {
                const jobId = e.target.dataset.jobId;
                if (e.target.classList.contains('unhide-btn')) {
                    unhideJobRow(jobId);
                } else {
                    hideJobRow(jobId);
                }
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
            if (index < 5) { // Make all columns except Actions sortable
                header.style.cursor = 'pointer';
                header.title = 'Click to sort';
                header.classList.add('sortable');
                
                header.addEventListener('click', () => {
                    sortTable(index);
                });
            }
        });
    }

    function sortTable(columnIndex) {
        const table = document.getElementById('jobsTable');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const headers = document.querySelectorAll('.jobs-table th');
        
        // Toggle sort direction
        const currentDirection = table.dataset.sortDirection || 'asc';
        const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
        table.dataset.sortDirection = newDirection;
        
        rows.sort((a, b) => {
            let aText, bText;
            
            // Handle company column (index 3) - extract company name from the span
            if (columnIndex === 3) {
                aText = a.cells[columnIndex].querySelector('.company-name')?.textContent.trim() || '';
                bText = b.cells[columnIndex].querySelector('.company-name')?.textContent.trim() || '';
            } else {
                aText = a.cells[columnIndex].textContent.trim();
                bText = b.cells[columnIndex].textContent.trim();
            }
            
            // Handle date sorting for first column
            if (columnIndex === 0) {
                const aDate = new Date(aText);
                const bDate = new Date(bText);
                if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                    return newDirection === 'asc' ? aDate - bDate : bDate - aDate;
                }
            }
            

            
            // Default string sorting
            return newDirection === 'asc' ? 
                aText.localeCompare(bText) : 
                bText.localeCompare(aText);
        });
        
        // Re-append sorted rows
        rows.forEach(row => tbody.appendChild(row));
        
        // Update header indicators
        headers.forEach((h, i) => {
            h.classList.remove('sort-asc', 'sort-desc');
            if (i === columnIndex) {
                h.classList.add(`sort-${newDirection}`);
            }
        });
    }
});