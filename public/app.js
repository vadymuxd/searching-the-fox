document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('jobSearchForm');
    const submitBtn = form.querySelector('.search-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    const errorMessage = document.getElementById('errorMessage');

    // Load saved search criteria if available
    const savedJobTitle = localStorage.getItem('lastJobTitle');
    const savedLocation = localStorage.getItem('lastLocation');
    
    if (savedJobTitle) {
        document.getElementById('jobTitle').value = savedJobTitle;
    }
    if (savedLocation) {
        document.getElementById('location').value = savedLocation;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const jobTitle = document.getElementById('jobTitle').value.trim();
        const location = document.getElementById('location').value.trim();
        const jobCount = 100; // Removed jobCount field, so use default value
        
        if (!jobTitle || !location) {
            showError('Please fill in both job title and location');
            return;
        }
        
        // Save search criteria
        localStorage.setItem('lastJobTitle', jobTitle);
        localStorage.setItem('lastLocation', location);
        localStorage.setItem('searchCriteria', JSON.stringify({ jobTitle, location, datePosted: 'last 30 days' }));
        
        // Show loading state
        setLoadingState(true);
        hideError();
        
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ jobTitle, location, count: jobCount })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to scrape jobs');
            }
            
            // Store results for the results page
            localStorage.setItem('jobResults', JSON.stringify(data));
            
            // Redirect to results page
            window.location.href = '/results.html';
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'Failed to search for jobs. Please try again.');
            setLoadingState(false);
        }
    });

    function setLoadingState(loading) {
        if (loading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    // Add some UI enhancements
    const inputs = form.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            hideError();
        });

        // Add enter key support
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                form.dispatchEvent(new Event('submit'));
            }
        });
    });
});