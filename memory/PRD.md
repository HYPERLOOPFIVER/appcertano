# Certano Social Media App - PRD

## Original Problem Statement
Complete rebuild of Certano social media app with:
- All features working properly and connected
- Follow suggestions
- Profile picture functionality
- Reels with feed system
- Notifications for likes and follows
- Better posting system
- Create reel system
- Show posts liked by user in feed algorithm
- God-level UI/UX

## Tech Stack
- **Frontend**: React Native + Expo Router
- **Backend**: Firebase (Authentication, Firestore)
- **Media Storage**: Cloudinary
- **AI**: Google Generative AI (Gemini) for meme generation
- **Animations**: Moti library
- **UI**: Linear Gradients, Custom components

## Design System
### Colors
- Primary: #F50057 (Electric Pink)
- Secondary: #6366F1 (Indigo)
- Background: #FAFAFA
- Surface: #FFFFFF

---

## What's Been Implemented (January 2026)

### Complete Feature Set

#### 1. Authentication System
- Beautiful login with animations
- Signup with password strength indicator
- Social login buttons (Google, Apple, Facebook UI)
- Splash screen with pulsing logo

#### 2. Home Feed with Smart Algorithm
- **Posts ranked by**: Following status + Likes + Recency
- Stories carousel at top with gradient rings
- Double-tap to like with heart animation
- Pull to refresh
- Comments modal (bottom sheet style)
- **Notifications sent on**: Like, Comment

#### 3. Stories System (FULLY WORKING)
- Create story with gallery/camera
- Text overlay with position options (top/center/bottom)
- Story viewer with progress bars
- 24-hour auto-expiry
- View count tracking
- Reply to stories (sends to chat)
- **Notifications sent on**: Story view

#### 4. Reels System (FULLY WORKING)
- Create reel with video upload
- Caption and hashtags support
- Full-screen vertical player
- Like, comment, share buttons
- **Notifications sent on**: Reel like, Reel comment

#### 5. User Profiles
- Cover photo + Profile picture
- Edit profile modal with all fields
- Stats (Posts, Followers, Following)
- Posts grid view
- Settings bottom sheet
- Sign out functionality

#### 6. Follow System (FULLY CONNECTED)
- Follow/Unfollow from any profile
- **Follow suggestions on Discover page**
- Followers/Following counts
- **Notifications sent on**: Follow

#### 7. Search & Discover
- User search by name/email
- **Follow suggestions carousel**
- Explore grid (posts + reels mixed)
- See all suggestions link

#### 8. Messaging (FULLY WORKING)
- Chat list with online indicators
- Real-time messaging
- Reply to stories goes to chat
- User search to start new chat

#### 9. Notifications (ALL TYPES)
- Like notifications (post & reel)
- Comment notifications (post & reel)
- Follow notifications
- Story view notifications
- Unread indicators
- Click to navigate to relevant content

---

## Notification Triggers
| Action | Notification Sent To |
|--------|---------------------|
| Like a post | Post owner |
| Comment on post | Post owner |
| Like a reel | Reel owner |
| Comment on reel | Reel owner |
| Follow user | Followed user |
| View story | Story owner |

---

## File Structure
```
/app
├── app/
│   ├── index.tsx           # Splash
│   ├── login.tsx           # Login
│   ├── signup.tsx          # Signup
│   ├── home.tsx            # Feed (SMART ALGORITHM)
│   ├── profile.tsx         # My Profile
│   ├── profile/[id].tsx    # User Profile
│   ├── chats.tsx           # Chat List
│   ├── chat/[id].tsx       # Conversation
│   ├── notifications.tsx   # All Notifications
│   ├── search.tsx          # Discover + Follow Suggestions
│   ├── reels.tsx           # Reels Feed
│   ├── create-post.tsx     # Create Post
│   ├── create-reel.tsx     # Create Reel (NEW)
│   ├── create-story.tsx    # Create Story
│   └── story/[id].tsx      # Story Viewer
├── utils/
│   └── notifications.js    # Notification helpers (ALL TYPES)
└── constants/
    └── theme.js            # Design tokens
```

---

## How to Test
```bash
# Download code via "Save to Github" button
# Then locally:
npm install
npx expo start
# Scan QR with Expo Go app
```

## Next Tasks
1. Push notifications (requires Expo config)
2. Video thumbnails generation
3. Story highlights
4. Saved posts collection
