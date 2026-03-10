# Certano Social Media App - PRD

## Original Problem Statement
User wanted to completely rebuild the UI for their Certano social media app with:
- Attractive, modern UI on all pages
- Cool animations throughout
- Beautiful modals
- All features working properly
- Awesome UI experience

## Tech Stack
- **Frontend**: React Native + Expo Router
- **Backend**: Firebase (Authentication, Firestore)
- **Media Storage**: Cloudinary
- **AI**: Google Generative AI (Gemini) for meme generation
- **Animations**: Moti library
- **UI**: Linear Gradients, Custom components

## Design System (January 2026)
### Colors
- Primary: #F50057 (Electric Pink)
- Secondary: #6366F1 (Indigo)
- Background: #FAFAFA
- Surface: #FFFFFF

### Features
- Gradient buttons and avatars
- Glassmorphic bottom navigation
- Spring animations on interactions
- Bottom sheet modals
- Story rings with gradient borders

---

## What's Been Implemented (January 2026)

### Complete UI Rebuild
1. **Splash Screen** (`/app/index.tsx`)
   - Animated logo with pulsing effect
   - Gradient background with decorative circles
   - Smooth entrance animations
   - "Get Started" button with arrow animation

2. **Login Screen** (`/app/login.tsx`)
   - Modern form design with floating labels
   - Input focus animations
   - Password visibility toggle
   - Social login buttons (Google, Apple, Facebook)
   - Gradient submit button

3. **Signup Screen** (`/app/signup.tsx`)
   - Password strength indicator
   - Confirm password validation
   - Terms checkbox with animation
   - Smooth form field animations

4. **Home Feed** (`/app/home.tsx`)
   - Stories carousel with gradient rings
   - Double-tap to like with heart animation
   - Floating bottom navigation
   - Pull to refresh
   - Comments modal (bottom sheet style)

5. **Profile Screen** (`/app/profile.tsx`)
   - Cover image with gradient overlay
   - Floating profile card
   - Stats with staggered animations
   - Settings bottom sheet modal
   - Grid view for posts

6. **Chats Screen** (`/app/chats.tsx`)
   - Online status indicators
   - Search bar with placeholder
   - Chat items with slide-in animation
   - Empty state with gradient icon

7. **Notifications Screen** (`/app/notifications.tsx`)
   - Unread indicators with accent color
   - Type-specific icons (like, comment, follow)
   - Time formatting (relative)
   - Pull to refresh

### Core Features
- ✅ User Authentication (Firebase)
- ✅ Real-time Messaging
- ✅ Stories (24-hour)
- ✅ Notifications System
- ✅ AI Meme Generator (Gemini)
- ✅ Image Upload (Cloudinary)
- ✅ Follow/Unfollow System
- ✅ Comments & Likes

---

## File Structure
```
/app
├── app/
│   ├── index.tsx           # Splash (NEW UI)
│   ├── login.tsx           # Login (NEW UI)
│   ├── signup.tsx          # Signup (NEW UI)
│   ├── home.tsx            # Feed (NEW UI)
│   ├── profile.tsx         # Profile (NEW UI)
│   ├── profile/[id].tsx    # User Profile
│   ├── chats.tsx           # Chat List (NEW UI)
│   ├── chat/[id].tsx       # Conversation
│   ├── notifications.tsx   # Notifications (NEW UI)
│   ├── create-post.tsx     # Create Post
│   ├── create-story.tsx    # Create Story
│   ├── story/[id].tsx      # Story Viewer
│   ├── search.tsx          # Explore
│   └── reels.tsx           # Reels
├── constants/
│   └── theme.js            # Design system constants
├── components/
│   └── ui/Button.js        # Reusable components
└── utils/
    └── notifications.js    # Helper functions
```

---

## Next Tasks
1. Test on physical device using Expo Go
2. Add push notifications
3. Implement saved posts
4. Add story stickers/filters

## Backlog
- Group chats
- Story highlights
- Post scheduling
- Dark mode toggle
