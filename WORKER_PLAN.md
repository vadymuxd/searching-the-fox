# Scalable Worker Plan

This document outlines a robust and scalable plan to implement an automatic job search worker for the "Searching The Fox" application.

## 1. The Goal

The primary goal is to improve user experience by proactively fetching fresh job postings for users. Instead of a user waiting up to 5 minutes for a search to complete, the application will feel instantaneous because the jobs will already be in the database.

This will be achieved by a scheduled worker that runs several times a day, performing job searches based on each user's last known search criteria.

## 2. The Challenge: Scaling

A simple, sequential approach (looping through users one by one in a single serverless function) is not scalable.

- **Vercel Timeouts:** Serverless functions on Vercel's free/pro tiers have a maximum execution time (e.g., 5 minutes). Processing hundreds of users sequentially would exceed this limit.
- **Fragility:** A single long-running process is prone to failure. If one user's search fails midway, it could stop the entire process for all subsequent users.
- **Inefficiency:** Sequential processing is slow. 100 users at ~1 minute each would take over 1.5 hours.

## 3. The Recommended Architecture: Offload and Parallelize

The best practice for this scenario is to offload the heavy lifting from the web frontend (Vercel) to a dedicated background worker service (Render).

![Architecture Diagram](https://i.imgur.com/eY2h4vW.png)

### **Component Roles:**

1.  **Vercel (Next.js App): The "Trigger"**
    *   **Role:** Its only job is to kick off the process. It should not perform any long-running tasks.
    *   **Implementation:** A Vercel Cron Job will be configured to run at the specified UK times.
    *   This cron job will call a single, lightweight API endpoint in your Next.js app (e.g., `/api/cron/trigger-worker`).
    *   This endpoint's only responsibility is to immediately send a secure "start" signal to the Python worker on Render. It should complete in milliseconds.

2.  **Render (Python `jobspy-service`): The "Worker"**
    *   **Role:** This is where all the heavy lifting happens. It's designed for long-running, intensive tasks.
    *   **Implementation:**
        *   It will expose a new, secure endpoint (e.g., `/worker/run-all-searches`).
        *   When triggered by Vercel, this endpoint will:
            1.  **Fetch Users:** Connect to the Supabase database (using the Service Role Key) and retrieve all users who have saved search preferences.
            2.  **Process in Parallel:** Instead of a simple loop, it will use a thread pool (`ThreadPoolExecutor`) to process multiple users concurrently. This is the key to speed and scalability. For example, it can process 5-10 users at the same time.
            3.  **Execute Searches:** For each user, it will call the existing `jobspy` scraping logic.
            4.  **Save to Database:** It will handle the logic to save new jobs to the `jobs` table and link them to users in the `user_jobs` table.
        *   This entire process runs on Render, independent of Vercel's timeouts.

### **Security:**

*   The connection between Vercel and Render will be secured with a shared secret key (`CRON_SECRET`). The Render worker will reject any requests that don't provide this key.
*   The Render worker will use the `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security, allowing it to work on behalf of all users. This key must be stored securely in Render's environment variables.

## 4. Implementation Steps

### **Step 1: Enhance the Python Worker (Render)**

1.  **Add Dependencies:**
    *   Add `supabase-py` to `jobspy-service/requirements.txt` to allow database access.
    *   Add `python-dotenv` for managing environment variables locally.

2.  **Configure Environment:**
    *   Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the environment variables on Render.

3.  **Create a New Worker Endpoint (`/worker/run-all-searches`):**
    *   This endpoint will contain the main logic:
        *   Initialize a Supabase client.
        *   Fetch all users and their `preferences->lastSearch`.
        *   Create a `ThreadPoolExecutor` to manage concurrent processing.
        *   Loop through users and submit a "process user" task to the thread pool for each one.
        *   The "process user" function will contain the `scrape_jobs` and database-saving logic.
    *   This ensures that if one user's search fails, it does not block the others.

### **Step 2: Simplify the Vercel Trigger**

1.  **Create a single API Route (`/api/cron/trigger-worker`):**
    *   This route will be extremely simple.
    *   It will read the `CRON_SECRET` and the `RENDER_WORKER_URL` from environment variables.
    *   It will make a single `POST` request to the Render worker's `/worker/run-all-searches` endpoint, passing the secret in the headers.
    *   It will **not** wait for a response (fire-and-forget). It should return a `202 Accepted` status immediately.

### **Step 3: Configure Vercel Cron**

1.  **Create a `vercel.json` file:**
    *   Define the cron schedule to hit the `/api/cron/trigger-worker` endpoint at the desired UK times (8:00, 10:00, 14:00, 16:00, 16:45, 22:00).
    *   It's crucial to specify the timezone as `Europe/London` to handle daylight saving changes automatically.

```json
{
  "crons": [
    {
      "path": "/api/cron/trigger-worker",
      "schedule": "0 8,10,14,16,22 * * *",
      "timezone": "Europe/London"
    },
    {
      "path": "/api/cron/trigger-worker",
      "schedule": "45 16 * * *",
      "timezone": "Europe/London"
    }
  ]
}
```

## 5. Benefits of this Approach

*   **Scalable:** Can handle hundreds or thousands of users by adjusting the number of parallel workers on Render. 100 users could be processed in minutes, not hours.
*   **Robust:** The process is isolated on Render. A failure in one user's search won't crash the entire system.
*   **Efficient:** Vercel's resources are freed up instantly. You are using the right tool for the right job (Vercel for web hosting, Render for background processing).
*   **Maintainable:** The logic is cleanly separated. The Next.js app worries about the UI, and the Python service worries about the data processing.

This plan provides a professional-grade solution that will grow with your user base.
