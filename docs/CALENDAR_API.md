# Own Calendar — Calendarific + Sudden holidays

## Active setup

| Piece | Role |
|-------|------|
| **Calendarific** | Live national/government holidays (when API key set) |
| **Sudden Holiday form** | Rain/strike closures you add yourself |
| **Curated India list** | Fallback if Calendarific key missing or API fails |
| **Attendance** | Blocks confirm on govt + sudden dates |

## Load order

```text
1. Calendarific (if VITE_CALENDARIFIC_API_KEY is set)  ← preferred
2. Nager.Date (if it returns data)
3. India curated list (fallback)
+ Sudden holidays always from your form
```

## Enable Calendarific now

1. Create a free key: https://calendarific.com/signup  
2. Open `.env.local` in the project root  
3. Paste:

```env
VITE_HOLIDAY_COUNTRY=IN
VITE_CALENDARIFIC_API_KEY=your_real_key_here
```

4. Restart the app: `npm run dev`  
5. Open **Academic Calendar** → banner should say **Calendarific API**  
6. Use **Add Sudden Holiday** for unplanned closures  

Dev proxy: `/api/calendarific-holidays` (avoids browser CORS).
