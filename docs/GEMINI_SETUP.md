# Gemini API Integration Setup Instructions

## 1. Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the generated API key

## 2. Set Up Environment Variables

1. Create a `.env.local` file in the root of your project:
```bash
cp .env.local.example .env.local
```

2. Open `.env.local` and replace `your_gemini_api_key_here` with your actual API key:
```
NEXT_PUBLIC_GEMINI_API_KEY=your_actual_api_key_here
```

## 3. How It Works

The new insight functionality works as follows:

1. **When search starts**: The Timer component begins showing insights immediately
2. **First insight**: Appears right away using the Gemini API
3. **Subsequent insights**: New insights appear every 15 seconds with fade animations
4. **Visual design**: 
   - Bot icon (32px) appears above the insight
   - Insight text is displayed in quotes with black color
   - Timer moves below the insight area
5. **When search completes**: Insights stop fetching and the component resets

## 4. Files Modified

- `src/components/Timer.tsx` - Added insight display and animation logic
- `src/lib/geminiService.ts` - New service for Gemini API integration
- `package.json` - Added @google/generative-ai dependency

## 5. Testing

To test the functionality:

1. Set up your API key as described above
2. Run the development server: `npm run dev`
3. Start a job search
4. You should see insights appearing every 15 seconds with smooth fade animations

## 6. Fallback Behavior

If the Gemini API is unavailable or fails:
- A fallback insight will be shown
- The timer will continue working normally
- Error messages will be logged to console (not shown to users)

## 7. API Usage

The system uses the Gemini Pro model with a specific prompt designed to generate:
- Random, interesting facts useful for job seekers
- 1-2 sentence format
- Fun and friendly tone
- No filler words or unnecessary adjectives
- Real, factual information
