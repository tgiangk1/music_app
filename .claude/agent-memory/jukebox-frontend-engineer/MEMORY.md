# Antigravity Jukebox - Frontend Patterns & Architecture

## Project Structure
```
fe/
├── src/
│   ├── components/     # Reusable UI components organized by feature
│   ├── pages/          # Route-based page components
│   ├── store/          # Zustand stores (auth, player, queue)
│   ├── hooks/          # Custom React hooks for logic abstraction
│   ├── lib/            # Utilities (api.js with axios interceptors)
│   └── main.jsx        # App entry point
├── index.html
├── tailwind.config.js
└── vite.config.js
```

## State Management: Zustand Patterns

### Stores
- `authStore`: User authentication with persistence, token refresh, admin checks
- `playerStore`: Video playback state (videoId, state, currentTime)
- `queueStore`: Song queue with add/remove/updateVote/clear actions

### Store Patterns
```javascript
// Import stores
import { usePlayerStore } from '../store/playerStore';
import { useQueueStore } from '../store/queueStore';
import { useAuthStore } from '../store/authStore';

// Direct store access (no selectors needed for simple cases)
const { user, logout } = useAuthStore();
const { videoId, state, setPlayerState } = usePlayerStore();
```

### Store Structure
- Actions are defined in the store
- State is immutable - use set() for updates
- Auth store uses zustand/persist for token storage
- Player store tracks: videoId, state ('playing'|'paused'|'idle'), currentTime, updatedAt, updatedBy

## API Integration Patterns

### API Client (lib/api.js)
- Axios instance with baseURL from VITE_API_URL env var
- Request interceptor attaches Bearer token from authStore
- Response interceptor handles 401 auto-refresh
- All API calls go through this client

### Data Fetching Pattern
```javascript
// Standard useEffect fetch pattern
useEffect(() => {
    const controller = new AbortController();
    fetchSomething(controller.signal);
    return () => controller.abort();
}, [dependencies]);
```

### Error Handling
- Try/catch all async operations
- Use toast.error() for user feedback
- Check err.response?.data?.error for backend error messages
- Handle specific error codes (401, 403, 404, 500)
- IMPORTANT: Check for both 'CanceledError' AND 'ERR_CANCELED' when aborting requests
- Don't show duplicate toasts - hooks like useQueue already show them

### Custom Hooks for Data
- `useQueue(slug)`: Manages queue fetching, add/remove/vote/reorder operations
- `usePlayer()`: Player state management
- `useSocket(slug)`: WebSocket connection for real-time sync
- `useNotifications()`: Browser notification permissions

## Component Architecture

### Component Organization
- Components are grouped by feature (Player/, Queue/, Social/)
- Each component has a single responsibility
- Use composition over inheritance
- Components receive props, extract logic into custom hooks

### Props Pattern
```javascript
function Component({ items, isLoading, onAction, user }) {
    // Prop destructuring at top
    const [localState, setLocalState] = useState();
    // ...
}
```

### Loading States
- Use skeleton components: `<div className="skeleton h-48 rounded-2xl" />`
- Show spinner: `<div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />`
- Pattern: `if (isLoading) return <SkeletonComponent />`

### Empty States
- Friendly messages with icons
- Example: Empty queue shows "Queue is empty" with music note icon
- Center-aligned with appropriate spacing

## Styling: Tailwind CSS Patterns

### Color Palette (Dark Theme)
- Backgrounds: base (#0a0a0f), surface (#13131a), card (#1a1a24)
- Borders: border (#2a2a3d), border-glow (purple glow)
- Primary: #8b5cf6 (purple), primary-hover: #7c3aed
- Text: text-primary (#f5f3ff), text-secondary (#a1a1aa), text-muted (#52525b)
- Status: success (#10b981), danger (#ef4444), warning (#f59e0b)

### Utility Classes
```css
.glass-card          /* bg-card/80 backdrop-blur-xl border border-border rounded-2xl */
.glass-card-hover    /* glass-card + hover effects */
.btn-primary         /* Primary button with hover glow */
.btn-ghost           /* Transparent button with hover background */
.btn-danger          /* Red button for destructive actions */
.input-field         /* Styled input with focus glow */
.skeleton            /* Animated loading placeholder */
```

### Responsive Design
- Mobile-first approach
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Hidden on mobile: `hidden sm:inline`
- Breakpoints: sm (640px), md (768px), lg (1024px)

### Animations
- `animate-fade-in`: Fade in with slight translate
- `animate-slide-up`: Slide up from bottom
- `animate-slide-in`: Slide in from left
- `animate-spin`: For loading spinners
- `vinyl-spin`: Custom record spinning animation

## YouTube Integration

### Thumbnails
```javascript
// Pattern for YouTube thumbnails
const thumbnail = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
// Fallback: hqdefault.jpg
```

### Search Pattern
- Debounced search (400ms delay)
- API endpoint: `/api/youtube/search?q={query}&limit={limit}`
- Returns: videoId, title, channelName, thumbnail, duration

## Common UI Patterns

### Toast Notifications
- `toast.success('Message')` - Success messages
- `toast.error('Message')` - Error messages
- `toast('Message', { icon: '🔁' })` - Custom icon

### Modal Pattern
```javascript
const [showModal, setShowModal] = useState(false);
// Render conditionally
{showModal && <Modal onClose={() => setShowModal(false)} />}
```

### Tabs Pattern
```javascript
const [tab, setTab] = useState('queue');
// Tab buttons with conditional styling
className={`flex-1 text-sm py-2 px-4 rounded-lg transition-all font-medium
    ${tab === 'queue' ? 'bg-card text-text-primary shadow-sm' : 'text-text-muted'}`}
```

## Key Files & Paths
- API client: `packages/fe/src/lib/api.js`
- Stores: `packages/fe/src/store/`
- Pages: `packages/fe/src/pages/`
- Components: `packages/fe/src/components/`
- Hooks: `packages/fe/src/hooks/`

## Anti-Patterns to Avoid
- Don't mutate state directly - use store actions
- Don't forget cleanup in useEffect (abort controllers)
- Don't skip loading states for async operations
- Don't use inline event handlers that could cause re-renders (use useCallback)
- Don't forget error boundaries for async operations
- Don't show duplicate toasts - check if hooks already show them
- Don't forget to reset transient state (like playingSongId) on errors

## Performance Considerations
- Use useCallback for event handlers passed to children
- Use useMemo for expensive computations
- Lazy load components when needed
- Implement proper cleanup for timers, intervals, subscriptions
- Use keys correctly in lists

## Accessibility Standards
- Use semantic HTML elements (button, nav, section, article)
- Include ARIA labels for icon-only buttons
- Ensure keyboard navigation works for all interactive elements
- Provide focus indicators for all focusable elements (focus:opacity-100)
- Use proper heading hierarchy
- Include alt text for images
- Ensure color contrast meets WCAG AA standards (at least 4.5:1)
- Add role attributes where appropriate (role="article", role="status")
- Use aria-hidden="true" for decorative elements
- Use aria-label for descriptive labels (e.g., "Play [song title]")

## RecommendedTracks Component Specific Patterns

### Data Fetching
- Fetches from `GET /api/recommendations/:userId`
- Shows loading skeletons that match the final layout
- Handles 404, 500, and network errors gracefully
- Includes retry button with proper AbortController cleanup
- Checks for both 'CanceledError' and 'ERR_CANCELED' error codes
- Early return if user.id is not available

### State Management
- Uses `useAuthStore` for user authentication
- Uses `useQueue` hook for queue operations (addSong)
- Does NOT show duplicate toasts - useQueue already handles this
- Resets playingSongId on error to prevent stuck UI state
- Uses controllerRef.current for proper cleanup

### Accessibility Implementation
- Track cards use `role="article"` with descriptive `aria-label`
- Thumbnail is a `<button>` with `aria-label` for screen readers
- Add to queue button has proper `aria-label` and `title` attributes
- Loading spinners have `role="status"` for accessibility
- Decorative elements use `aria-hidden="true"`
- All images have proper alt text
- Focus indicators work with `focus:opacity-100`

### Error Handling Improvements
- Retry handler aborts previous controller and creates new one
- Previous controller is aborted before new request
- Both CancelledError and ERR_CANCELED are caught and ignored
- User-friendly error messages displayed
- Error state shows retry button
- playingSongId is reset on errors

### Loading State Pattern
- Skeletons match the exact layout of loaded content
- 4 skeleton cards with aspect-square thumbnails
- Title, artist, and button skeletons
- Smooth fade-in animation when content loads

### Responsive Grid
- Mobile (< 640px): 1 column
- Tablet (640px - 1024px): 2 columns
- Desktop (1024px - 1280px): 3 columns
- Large (> 1280px): 4 columns
