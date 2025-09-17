#!/usr/bin/env python3
"""
Test script for JobSpy API endpoints
"""

import requests
import json
import time

API_BASE_URL = "http://localhost:8001"

def test_health_endpoint():
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_root_endpoint():
    """Test the root endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Root endpoint working: {data['message']}")
            return True
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
        return False

def test_scrape_endpoint():
    """Test the job scraping endpoint"""
    try:
        payload = {
            "search_term": "python developer",
            "location": "San Francisco, CA",
            "site_name": ["indeed"],
            "results_wanted": 3,
            "hours_old": 72
        }
        
        print("🔍 Testing scrape endpoint...")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(
            f"{API_BASE_URL}/scrape",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60  # Scraping can take time
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Scrape endpoint successful")
            print(f"   Success: {data['success']}")
            print(f"   Total results: {data['total_results']}")
            print(f"   Jobs found: {len(data['jobs'])}")
            
            if data['jobs']:
                print("\n   Sample job:")
                job = data['jobs'][0]
                print(f"     Title: {job['title']}")
                print(f"     Company: {job['company']}")
                print(f"     Location: {job['location']}")
                print(f"     Site: {job['site']}")
                print(f"     URL: {job['job_url'][:50]}..." if job['job_url'] else "     URL: None")
            
            return True
        else:
            print(f"❌ Scrape endpoint failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data}")
            except:
                print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Scrape endpoint error: {e}")
        return False

def test_multiple_sites_endpoint():
    """Test scraping from multiple sites"""
    try:
        payload = {
            "search_term": "frontend developer",
            "location": "New York, NY",
            "site_name": ["indeed", "linkedin"],
            "results_wanted": 2,
            "hours_old": 168
        }
        
        print("🔍 Testing multiple sites endpoint...")
        
        response = requests.post(
            f"{API_BASE_URL}/scrape",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=90
        )
        
        if response.status_code == 200:
            data = response.json()
            sites = set(job['site'] for job in data['jobs'])
            print(f"✅ Multiple sites test successful")
            print(f"   Sites found: {list(sites)}")
            print(f"   Total jobs: {len(data['jobs'])}")
            return True
        else:
            print(f"❌ Multiple sites test failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Multiple sites test error: {e}")
        return False

def wait_for_server():
    """Wait for the server to be ready"""
    print("⏳ Waiting for JobSpy API server to be ready...")
    for i in range(30):  # Wait up to 30 seconds
        try:
            response = requests.get(f"{API_BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                print("✅ Server is ready!")
                return True
        except:
            pass
        
        time.sleep(1)
        if i % 5 == 0:
            print(f"   Still waiting... ({i+1}/30)")
    
    print("❌ Server not ready after 30 seconds")
    return False

if __name__ == "__main__":
    print("🧪 JobSpy API Testing Suite")
    print("=" * 50)
    
    if not wait_for_server():
        print("\n❌ Cannot connect to API server. Make sure it's running on port 8001:")
        print("   cd jobspy-service")
        print("   source jobspy-env/bin/activate")
        print("   python main.py")
        exit(1)
    
    tests = [
        test_root_endpoint,
        test_health_endpoint,
        test_scrape_endpoint,
        test_multiple_sites_endpoint
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
        print("🎉 All API tests passed! JobSpy API is working correctly.")
    else:
        print("⚠️  Some API tests failed. Check the errors above.")
