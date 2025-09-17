document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const searchForm = document.getElementById('searchForm');
    const searchBtn = document.getElementById('searchBtn');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    const resultsContainer = document.getElementById('resultsContainer');
    const noResultsContainer = document.getElementById('noResultsContainer');
    const resultsCount = document.getElementById('resultsCount');
    const jobTableBody = document.getElementById('jobTableBody');
    const titleKeywords = document.getElementById('titleKeywords');
    const filterBtn = document.getElementById('filterBtn');
    const clearFilters = document.getElementById('clearFilters');

    // Store all jobs for filtering
    let allJobs = [];
    let displayedJobs = [];

    // Handle form submission
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await performSearch();
    });

    // Handle manual filtering with Filter button
    filterBtn.addEventListener('click', function() {
        filterJobsByKeywords();
    });

    // Handle clear filters
    clearFilters.addEventListener('click', function() {
        titleKeywords.value = '';
        filterJobsByKeywords();
    });

    // Allow Enter key to trigger filtering in the keywords input
    titleKeywords.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            filterJobsByKeywords();
        }
    });

    async function performSearch() {
        // Get form data
        const formData = new FormData(searchForm);
        const searchTerm = formData.get('searchTerm').trim();
        const location = formData.get('location').trim();
        const resultsWanted = parseInt(formData.get('resultsWanted'));
        const hoursOld = parseInt(formData.get('hoursOld'));
        const countryIndeed = formData.get('countryIndeed');
        
        // Get selected site names (now single select)
        const siteSelect = document.getElementById('siteNames');
        const siteNames = [siteSelect.value]; // Convert to array for API compatibility

        // Validate form
        if (!searchTerm || !location) {
            showError('Please enter both job title and location.');
            return;
        }

        if (!siteSelect.value) {
            showError('Please select a job site.');
            return;
        }

        // Prepare API request
        const requestData = {
            search_term: searchTerm,
            location: location,
            site_name: siteNames,
            results_wanted: resultsWanted,
            hours_old: hoursOld,
            country_indeed: countryIndeed
        };

        console.log('Sending FastAPI request:', requestData);

        // Show loading state
        showLoading();

        try {
            // Call FastAPI through Node.js proxy to avoid CORS issues
            const response = await fetch('/api/fastapi-scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('FastAPI response:', data);

            // Display results
            displayResults(data);

        } catch (error) {
            console.error('Search error:', error);
            showError(error.message || 'Failed to search for jobs. Please try again.');
        }
    }

    function showLoading() {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
        loadingMessage.style.display = 'block';
        errorContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
        noResultsContainer.style.display = 'none';
    }

    function hideLoading() {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search Jobs';
        loadingMessage.style.display = 'none';
    }

    function showError(message) {
        hideLoading();
        errorMessage.textContent = message;
        errorContainer.style.display = 'block';
        resultsContainer.style.display = 'none';
        noResultsContainer.style.display = 'none';
    }

    function displayResults(data) {
        hideLoading();
        errorContainer.style.display = 'none';

        if (!data.success || !data.jobs || data.jobs.length === 0) {
            noResultsContainer.style.display = 'block';
            resultsContainer.style.display = 'none';
            return;
        }

        // Store all jobs for filtering
        allJobs = data.jobs;
        displayedJobs = [...allJobs];

        // Update results display without any filters initially
        updateResultsDisplay();

        // Show results
        resultsContainer.style.display = 'block';
        noResultsContainer.style.display = 'none';
    }

    function updateResultsDisplay() {
        // Update count
        resultsCount.textContent = `Showing ${displayedJobs.length} of ${allJobs.length} jobs`;

        // Clear and populate table
        jobTableBody.innerHTML = '';
        
        if (displayedJobs.length === 0) {
            document.getElementById('noFilterResults').style.display = 'block';
        } else {
            document.getElementById('noFilterResults').style.display = 'none';
            displayedJobs.forEach((job, index) => {
                const row = createJobRow(job, index);
                jobTableBody.appendChild(row);
            });
        }
    }

    function filterJobsByKeywords() {
        // Get keywords from the results section input only
        const keywords = titleKeywords.value.toLowerCase().trim();
        console.log('Filtering by keywords:', keywords);
        
        if (!keywords) {
            // Show all jobs if no keywords
            displayedJobs = [...allJobs];
        } else {
            // Split keywords by comma and filter
            const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k);
            console.log('Keyword array:', keywordArray);
            
            displayedJobs = allJobs.filter(job => {
                const title = (job.title || '').toLowerCase();
                const matches = keywordArray.some(keyword => title.includes(keyword));
                if (matches) console.log('Job matched:', job.title);
                return matches;
            });
        }
        
        console.log(`Showing ${displayedJobs.length} of ${allJobs.length} jobs`);
        updateResultsDisplay();
    }

    function createJobRow(job, index) {
        const row = document.createElement('tr');
        
        // Debug log to see what data we're getting
        console.log('Creating row for job:', {
            title: job.title,
            date_posted: job.date_posted,
            site: job.site
        });
        
        // Format salary
        let salaryText = 'Not specified';
        if (job.salary_min || job.salary_max) {
            const currency = job.salary_currency || 'USD';
            if (job.salary_min && job.salary_max) {
                salaryText = `${formatCurrency(job.salary_min, currency)} - ${formatCurrency(job.salary_max, currency)}`;
            } else if (job.salary_min) {
                salaryText = `${formatCurrency(job.salary_min, currency)}+`;
            } else if (job.salary_max) {
                salaryText = `Up to ${formatCurrency(job.salary_max, currency)}`;
            }
        }

        // Format date
        let dateText = 'Unknown';
        if (job.date_posted) {
            try {
                const date = new Date(job.date_posted);
                if (!isNaN(date.getTime())) {
                    dateText = date.toLocaleDateString();
                } else {
                    dateText = job.date_posted;
                }
            } catch (e) {
                dateText = job.date_posted;
            }
        }

        // Truncate description
        let descriptionPreview = 'No description available';
        if (job.description) {
            descriptionPreview = job.description.length > 150 
                ? job.description.substring(0, 150) + '...' 
                : job.description;
        }

        row.innerHTML = `
            <td class="logo-cell">
                ${job.company_logo_url ? 
                    `<img src="${escapeHtml(job.company_logo_url)}" alt="${escapeHtml(job.company)}" class="company-logo" 
                         onerror="this.style.display='none'; console.log('Failed to load logo:', '${escapeHtml(job.company_logo_url)}');"
                         onload="console.log('Successfully loaded logo:', '${escapeHtml(job.company_logo_url)}');">` : 
                    '<div class="logo-placeholder"></div>'
                }
            </td>
            <td class="job-title">
                ${job.job_url ? 
                    `<a href="${job.job_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.title || 'No title')}</a>` : 
                    escapeHtml(job.title || 'No title')
                }
            </td>
            <td>
                <span class="company-name">${escapeHtml(job.company || 'Unknown')}</span>
            </td>
            <td>${escapeHtml(job.location || 'Unknown')}</td>
            <td>${dateText}</td>
            <td>
                <div class="action-buttons">
                    ${job.job_url ? 
                        `<a href="${job.job_url}" target="_blank" rel="noopener noreferrer" class="job-link">View Job</a>` : 
                        '<span style="color: #9b9a97;">No link</span>'
                    }
                </div>
            </td>
        `;

        return row;
    }

    function formatCurrency(amount, currency = 'USD') {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        } catch (e) {
            return `${currency} ${amount.toLocaleString()}`;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Set default values
    document.getElementById('searchTerm').value = 'lead product designer';
    document.getElementById('location').value = 'london';
    
    // Set LinkedIn as default
    document.getElementById('siteNames').value = 'linkedin';
    
    // Set default to Last 24 hours
    document.getElementById('hoursOld').value = '24';
    
    // Set default country to UK
    document.getElementById('countryIndeed').value = 'UK';
    
    console.log('FastAPI Results page loaded');
});
