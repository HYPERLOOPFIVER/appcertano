# Certano Social Media App - PRD

## Original Problem Statement
User wanted to improve their Certano social media app by:
- Fixing broken messaging/chat
- Fixing broken profile features
- Fixing other bugs
- Improving UI/UX design
- Adding new features (stories, notifications, search)
- Performance improvements
- Mobile responsiveness

## Tech Stack
- **Frontend**: React Native + Expo Router
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Media Storage**: Cloudinary
- **AI**: Google Generative AI (Gemini) for meme generation

## User Personas
1. **Social Users**: Want to share posts, reels, and stories with friends
2. **Content Creators**: Create and share visual content
3. **Networkers**: Find and connect with other users

## Core Requirements
- User authentication (login/signup)
- Profile management with photo upload
- Posts with images and AI-generated content
- Reels (short video content)
- Stories (24-hour content)
- Real-time messaging
- Notifications
- User search and discovery
- Following/Followers system
- Likes and comments

---

## What's Been Implemented (January 2026)

### Bug Fixes
1. **Firebase Storage Export** - Added `storage` export to `firebase.js`
2. **Profile Navigation** - Fixed to use `useRouter` from expo-router instead of navigation prop
3. **Search Functionality** - Fixed to search by `name` field (was only searching `username`)
4. **Dynamic Routes** - Created missing `/profile/[id].tsx` and `/user-profile/[id].tsx` routes

### New Features Added

#### 1. Real-time Messaging System
- **Files**: `/app/app/chats.tsx`, `/app/app/chat/[id].tsx`
- **Features**:
  - Chat list showing all conversations
  - Real-time messaging with Firebase
  - User avatars and timestamps
  - Message bubbles (sent/received styling)
  - Last message preview

#### 2. Notifications System
- **Files**: `/app/app/notifications.tsx`, `/app/utils/notifications.js`
- **Features**:
  - View all notifications (likes, comments, follows)
  - Mark as read functionality
  - Navigate to relevant content
  - Time-based grouping
  - Unread indicators

#### 3. Stories Feature
- **Files**: `/app/app/story/[id].tsx`, `/app/app/create-story.tsx`
- **Features**:
  - 24-hour disappearing stories
  - Story viewing with progress bars
  - Story creation with image picker
  - Text overlay on stories
  - View tracking
  - Stories section on home feed

#### 4. Enhanced Profile Features
- **File**: `/app/app/profile.tsx` (completely rewritten)
- **Features**:
  - Cloudinary image upload (fixed Firebase Storage issues)
  - Edit profile modal
  - Cover photo support
  - Bio, website, location fields
  - Posts/Saved/Tagged tabs

#### 5. User Profile Viewing
- **File**: `/app/app/profile/[id].tsx`
- **Features**:
  - View other users' profiles
  - Follow/Unfollow functionality
  - Message button to start chat
  - View user's posts

#### 6. Improved User Search
- **Files**: `/app/app/search.tsx`, `/app/app/usersearch.tsx`
- **Features**:
  - Search by name, username, or email
  - Better user cards with avatars
  - Navigate to user profiles

#### 7. Home Feed Improvements
- **File**: `/app/app/home.tsx`
- **Features**:
  - Stories section at top
  - Notification and chat icons in header
  - Instagram-like feed algorithm

---

## Prioritized Backlog

### P0 (Critical)
- [x] Fix Firebase Storage export
- [x] Fix profile navigation
- [x] Add messaging feature
- [x] Add notifications

### P1 (High Priority)
- [x] Add stories feature
- [x] Fix user search
- [x] Add user profile viewing
- [ ] Add push notifications (requires native configuration)

### P2 (Medium Priority)
- [ ] Add saved posts functionality
- [ ] Add post sharing
- [ ] Add story replies
- [ ] Implement mention notifications

### P3 (Nice to Have)
- [ ] Direct message media sharing
- [ ] Group chats
- [ ] Story highlights
- [ ] Post scheduling

---

## Next Tasks
1. Test all features on physical device/emulator
2. Implement push notifications with Expo
3. Add saved posts collection
4. Enhance story features (stickers, filters)
5. Add analytics and insights

---

## File Structure
```
/app
├── app/
│   ├── _layout.tsx         # Root layout with SafeAreaProvider
│   ├── index.tsx           # Splash screen
│   ├── login.tsx           # Login screen
│   ├── signup.tsx          # Signup screen
│   ├── home.tsx            # Main feed with stories
│   ├── profile.tsx         # User's own profile
│   ├── profile/[id].tsx    # Other user's profile
│   ├── chat/[id].tsx       # Chat conversation
│   ├── chats.tsx           # Chat list
│   ├── notifications.tsx   # Notifications
│   ├── story/[id].tsx      # Story viewer
│   ├── create-story.tsx    # Create story
│   ├── create-post.tsx     # Create post
│   ├── search.tsx          # Explore/search
│   ├── reels.tsx           # Reels feed
│   ├── profiles.tsx        # Discover people
│   └── usersearch.tsx      # User search
├── utils/
│   └── notifications.js    # Notification helpers
├── firebase.js             # Firebase config
└── package.json
```
