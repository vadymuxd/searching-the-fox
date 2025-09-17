#!/usr/bin/env python3
"""
Test script for JobSpy functionality
"""

def test_jobspy_import():
    """Test if JobSpy can be imported and used"""
    try:
        from jobspy import scrape_jobs
        print("✅ JobSpy import successful")
        return True
    except ImportError as e:
        print(f"❌ JobSpy import failed: {e}")
        return False

def test_basic_scraping():
    """Test basic job scraping functionality"""
    try:
        from jobspy import scrape_jobs
        
        print("🔍 Testing basic job scraping...")
        
        # Test with minimal parameters
        jobs_df = scrape_jobs(
            site_name=["indeed"],
            search_term="python developer",
            location="San Francisco, CA",
            results_wanted=3,
            hours_old=72
        )
        
        if jobs_df is not None and not jobs_df.empty:
            print(f"✅ Successfully scraped {len(jobs_df)} jobs")
            print("\nSample job data:")
            for i, job in jobs_df.head(2).iterrows():
                print(f"  Job {i+1}:")
                print(f"    Site: {job.get('site', 'N/A')}")
                print(f"    Title: {job.get('title', 'N/A')}")
                print(f"    Company: {job.get('company', 'N/A')}")
                print(f"    Location: {job.get('location', 'N/A')}")
                print()
            return True
        else:
            print("❌ No jobs found")
            return False
            
    except Exception as e:
        print(f"❌ Basic scraping test failed: {e}")
        return False

def test_multiple_sites():
    """Test scraping from multiple job sites"""
    try:
        from jobspy import scrape_jobs
        
        print("🔍 Testing multiple job sites...")
        
        jobs_df = scrape_jobs(
            site_name=["indeed", "linkedin"],
            search_term="frontend developer",
            location="New York, NY",
            results_wanted=2,
            hours_old=168  # 1 week
        )
        
        if jobs_df is not None and not jobs_df.empty:
            sites = jobs_df['site'].unique()
            print(f"✅ Successfully scraped from sites: {list(sites)}")
            print(f"Total jobs found: {len(jobs_df)}")
            return True
        else:
            print("❌ No jobs found from multiple sites")
            return False
            
    except Exception as e:
        print(f"❌ Multiple sites test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 JobSpy Testing Suite")
    print("=" * 50)
    
    tests = [
        test_jobspy_import,
        test_basic_scraping,
        test_multiple_sites
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        print()
        if test():
            passed += 1
        print("-" * 30)
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! JobSpy is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the errors above.")
