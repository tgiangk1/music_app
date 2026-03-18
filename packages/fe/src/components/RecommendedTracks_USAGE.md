# RecommendedTracks Component Usage Guide

## Component Overview

The `RecommendedTracks` component displays personalized track recommendations for users based on their listening history. It integrates seamlessly with the existing Antigravity Jukebox architecture and follows all established patterns.

## Props

```javascript
<RecommendedTracks roomSlug={string} />
```

- `roomSlug` (required): The slug of the current room for queue operations

## Usage Examples

### 1. Adding to Home Page

Display recommendations on the home page for quick access to personalized tracks:

```javascript
import RecommendedTracks from '../components/RecommendedTracks';

export default function Home() {
    // ... existing code

    return (
        <div className="min-h-screen">
            {/* Existing header */}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Existing rooms section */}

                {/* Recommended Tracks Section */}
                <div className="mt-8">
                    <RecommendedTracks roomSlug="home" />
                </div>
            </main>
        </div>
    );
}
```

### 2. Adding to Room Page

Display recommendations in the room sidebar or main content area:

```javascript
import RecommendedTracks from '../components/RecommendedTracks';

export default function Room() {
    const { slug } = useParams();
    // ... existing code

    return (
        <div className="min-h-screen flex flex-col">
            {/* Existing header and main content */}

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
                    {/* Left: Player + Queue */}
                    <div className="space-y-6">
                        {/* Existing player and queue */}
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        {/* Members, Chat, Stats, etc. */}

                        {/* Recommended Tracks */}
                        <RecommendedTracks roomSlug={slug} />
                    </div>
                </div>
            </main>
        </div>
    );
}
```

### 3. Standalone Page

Create a dedicated recommendations page:

```javascript
import RecommendedTracks from '../components/RecommendedTracks';

export default function Recommendations() {
    return (
        <div className="min-h-screen">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-6">
                    <h1 className="font-display text-2xl font-bold">Your Recommendations</h1>
                    <p className="text-text-secondary text-sm mt-1">
                        Discover new music based on your listening history
                    </p>
                </div>
                <RecommendedTracks roomSlug="global" />
            </main>
        </div>
    );
}
```

## API Integration

The component expects the backend API to implement:

### GET `/api/recommendations/:userId`

**Response:**
```json
{
    "recommendations": [
        {
            "id": "rec_123",
            "youtubeId": "dQw4w9WgXcQ",
            "title": "Never Gonna Give You Up",
            "artist": "Rick Astley",
            "thumbnail": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            "duration": 212,
            "reason": "Based on your history"
        },
        // ... more tracks
    ]
}
```

**Error Responses:**
- `404`: Recommendations not available
- `500`: Internal server error

## Component Features

### 1. Loading States
- Skeleton loaders that match the final layout
- Smooth fade-in animations

### 2. Error Handling
- Friendly error messages
- Retry button with proper cleanup
- Graceful degradation

### 3. User Interactions
- **Play Now**: Click on thumbnail or title to play immediately
- **Add to Queue**: Click the + button to add without playing
- Visual feedback during operations (spinners, state changes)

### 4. Responsive Design
- 1 column: Mobile (< 640px)
- 2 columns: Tablet (640px - 1024px)
- 3 columns: Desktop (1024px - 1280px)
- 4 columns: Large screens (> 1280px)

### 5. Accessibility
- Semantic HTML structure
- Keyboard navigation support
- Focus indicators on interactive elements
- ARIA labels for icon-only buttons
- High contrast ratios

### 6. Performance
- Proper request cancellation on unmount
- Optimized re-renders with useCallback
- Lazy loading of images
- Efficient event handlers

## State Management Integration

The component uses existing Zustand stores:

```javascript
import { useAuthStore } from '../store/authStore';
import { useQueue } from '../hooks/useQueue';

const { user } = useAuthStore();  // Get current user ID
const { addSong } = useQueue(roomSlug);  // Add songs to queue
```

## Styling Integration

Uses existing Tailwind utility classes and custom components:
- `glass-card`: Glassmorphism card styling
- `skeleton`: Loading placeholder
- `btn-primary`: Primary action buttons
- `animate-fade-in`, `animate-slide-up`: Smooth animations
- Dark theme colors: `text-primary`, `text-secondary`, `text-muted`

## Error Handling Patterns

The component handles various error scenarios:

1. **Network Errors**: Shows retry button with error message
2. **404 Errors**: Displays "No recommendations yet" empty state
3. **500 Errors**: Shows error message with retry option
4. **User Not Authenticated**: Displays empty state (no user ID)

## Testing Considerations

When testing this component:

1. **Loading State**: Verify skeleton loaders appear
2. **Empty State**: Test with no recommendations
3. **Error State**: Test network failures and retry functionality
4. **Play Action**: Verify track plays and toast appears
5. **Queue Action**: Verify track adds without playing
6. **Responsive**: Test at various screen sizes
7. **Accessibility**: Test keyboard navigation and screen readers

## Troubleshooting

### Recommendations not loading
- Check if user is authenticated
- Verify API endpoint exists and returns correct format
- Check browser console for network errors

### Thumbnails not displaying
- Verify YouTube ID is correct
- Check if image URLs are accessible
- The component has automatic fallback to hqdefault.jpg

### Actions not working
- Verify `roomSlug` prop is passed correctly
- Check if user has permissions to add to queue
- Verify `useQueue` hook is working properly

## Future Enhancements

Potential improvements for the component:

1. **Filtering**: Filter by genre, mood, or time period
2. **Sorting**: Sort by relevance, popularity, or date
3. **Batch Operations**: Add multiple tracks at once
4. **Shuffle**: Randomize recommendations order
5. **Playlist Integration**: Save recommendations to playlists
6. **Dislike Feedback**: Option to dismiss recommendations
7. **Infinite Scroll**: Load more recommendations on scroll
8. **Share**: Share recommendations with other users
