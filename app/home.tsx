import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp,
  getDoc,
  onSnapshot,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#F50057',
  primaryLight: '#FF4D4D',
  secondary: '#6366F1',
  secondaryLight: '#818CF8',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export default function Home() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentPostId, setCurrentPostId] = useState('');
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [currentLikes, setCurrentLikes] = useState([]);
  
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    fetchPosts();
    fetchStories();
  }, []);

  const fetchUserData = async (userId) => {
    if (userNames[userId]) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserNames(prev => ({ ...prev, [userId]: data.name || 'User' }));
        setUserAvatars(prev => ({ ...prev, [userId]: data.profilePic }));
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'));
      
      onSnapshot(q, async (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Fetch user data for all posts
        const userIds = [...new Set(postsData.map(p => p.uid))];
        await Promise.all(userIds.map(fetchUserData));
        
        setPosts(postsData);
        setLoading(false);
        setRefreshing(false);
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStories = async () => {
    if (!currentUserId) return;
    
    try {
      // Get following list
      const followingRef = collection(db, 'users', currentUserId, 'following');
      const followingSnapshot = await getDocs(followingRef);
      const followingIds = [currentUserId, ...followingSnapshot.docs.map(doc => doc.id)];
      
      const allStories = [];
      const now = new Date();
      
      for (const uid of followingIds) {
        const storiesRef = collection(db, 'users', uid, 'stories');
        const q = query(storiesRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const userStories = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data(), userId: uid }))
          .filter(story => {
            const createdAt = story.createdAt?.toDate?.() || new Date(story.createdAt);
            return (now - createdAt) < 24 * 60 * 60 * 1000;
          });
        
        if (userStories.length > 0) {
          await fetchUserData(uid);
          allStories.push({
            userId: uid,
            stories: userStories,
            hasUnseen: userStories.some(s => !s.viewers?.includes(currentUserId)),
          });
        }
      }
      
      setStories(allStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  const handleLike = async (postId, currentLikes = []) => {
    if (!currentUserId) return;
    
    const postRef = doc(db, 'posts', postId);
    const isLiked = currentLikes.includes(currentUserId);
    
    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const openComments = async (postId) => {
    setCurrentPostId(postId);
    setCommentModalVisible(true);
    setLoadingComments(true);
    
    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      const q = query(commentsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Fetch user data for comments
      await Promise.all(commentsData.map(c => fetchUserData(c.userId)));
      
      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUserId || submittingComment) return;
    
    setSubmittingComment(true);
    try {
      const commentsRef = collection(db, 'posts', currentPostId, 'comments');
      await addDoc(commentsRef, {
        userId: currentUserId,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });
      
      setCommentText('');
      openComments(currentPostId);
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
    fetchStories();
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const diff = (Date.now() - date.getTime()) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString();
  };

  // Story Item Component
  const StoryItem = ({ item, index, isAddStory = false }) => (
    <MotiView
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', delay: index * 50 }}
    >
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => isAddStory 
          ? router.push('/create-story')
          : router.push(`/story/${item.userId}`)
        }
        testID={isAddStory ? 'add-story-btn' : `story-${item.userId}`}
      >
        {isAddStory ? (
          <View style={styles.addStoryRing}>
            <View style={styles.addStoryInner}>
              <Ionicons name="add" size={32} color={COLORS.primary} />
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={item.hasUnseen 
              ? ['#F59E0B', '#F50057', '#C026D3']
              : [COLORS.surfaceLight, COLORS.surfaceLight]
            }
            style={styles.storyRing}
          >
            {userAvatars[item.userId] ? (
              <Image source={{ uri: userAvatars[item.userId] }} style={styles.storyAvatar} />
            ) : (
              <View style={styles.storyAvatarPlaceholder}>
                <Text style={styles.storyAvatarText}>
                  {(userNames[item.userId] || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </LinearGradient>
        )}
        <Text style={styles.storyName} numberOfLines={1}>
          {isAddStory ? 'Your Story' : (item.userId === currentUserId ? 'You' : userNames[item.userId]?.split(' ')[0])}
        </Text>
      </TouchableOpacity>
    </MotiView>
  );

  // Post Card Component
  const PostCard = ({ item, index }) => {
    const isLiked = item.likes?.includes(currentUserId);
    const [showHeart, setShowHeart] = useState(false);

    const handleDoubleTap = () => {
      if (!isLiked) {
        handleLike(item.id, item.likes);
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      }
    };

    return (
      <MotiView
        from={{ opacity: 0, translateY: 50 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: index * 100 }}
        style={styles.postCard}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postUserInfo}
            onPress={() => router.push(`/profile/${item.uid}`)}
            testID={`post-user-${item.id}`}
          >
            {userAvatars[item.uid] ? (
              <Image source={{ uri: userAvatars[item.uid] }} style={styles.postAvatar} />
            ) : (
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.postAvatarPlaceholder}>
                <Text style={styles.postAvatarText}>{(userNames[item.uid] || 'U')[0].toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.postUserText}>
              <Text style={styles.postUserName}>{userNames[item.uid] || 'User'}</Text>
              <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postMenuBtn} testID={`post-menu-${item.id}`}>
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Post Image */}
        {item.image && (
          <Pressable onPress={handleDoubleTap} style={styles.postImageContainer}>
            <Image source={{ uri: item.image }} style={styles.postImage} />
            <AnimatePresence>
              {showHeart && (
                <MotiView
                  from={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 10 }}
                  style={styles.heartOverlay}
                >
                  <Ionicons name="heart" size={80} color={COLORS.primary} />
                </MotiView>
              )}
            </AnimatePresence>
          </Pressable>
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <View style={styles.postActionsLeft}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleLike(item.id, item.likes)}
              testID={`like-btn-${item.id}`}
            >
              <MotiView
                animate={{ scale: isLiked ? [1, 1.3, 1] : 1 }}
                transition={{ type: 'spring', damping: 10 }}
              >
                <Ionicons 
                  name={isLiked ? 'heart' : 'heart-outline'} 
                  size={26} 
                  color={isLiked ? COLORS.primary : COLORS.textPrimary} 
                />
              </MotiView>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => openComments(item.id)}
              testID={`comment-btn-${item.id}`}
            >
              <Ionicons name="chatbubble-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} testID={`share-btn-${item.id}`}>
              <Ionicons name="paper-plane-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.actionBtn} testID={`save-btn-${item.id}`}>
            <Ionicons name="bookmark-outline" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Likes Count */}
        {item.likes?.length > 0 && (
          <TouchableOpacity 
            style={styles.likesContainer}
            onPress={() => {
              setCurrentLikes(item.likes);
              setLikesModalVisible(true);
            }}
            testID={`likes-count-${item.id}`}
          >
            <Text style={styles.likesText}>{item.likes.length} likes</Text>
          </TouchableOpacity>
        )}

        {/* Caption */}
        {item.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>
              <Text style={styles.captionUsername}>{userNames[item.uid]}</Text>
              {' '}{item.caption}
            </Text>
          </View>
        )}

        {/* View Comments */}
        {item.commentCount > 0 && (
          <TouchableOpacity 
            onPress={() => openComments(item.id)}
            testID={`view-comments-${item.id}`}
          >
            <Text style={styles.viewComments}>View all {item.commentCount} comments</Text>
          </TouchableOpacity>
        )}
      </MotiView>
    );
  };

  // Comments Modal
  const CommentsModal = () => (
    <Modal
      visible={commentModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setCommentModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity 
            onPress={() => setCommentModalVisible(false)}
            testID="close-comments-modal"
          >
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {loadingComments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MotiView
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                style={styles.commentItem}
              >
                {userAvatars[item.userId] ? (
                  <Image source={{ uri: userAvatars[item.userId] }} style={styles.commentAvatar} />
                ) : (
                  <View style={styles.commentAvatarPlaceholder}>
                    <Text style={styles.commentAvatarText}>
                      {(userNames[item.userId] || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>{userNames[item.userId] || 'User'}</Text>
                  <Text style={styles.commentText}>{item.text}</Text>
                  <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
                </View>
              </MotiView>
            )}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            }
            contentContainerStyle={styles.commentsList}
          />
        )}

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={COLORS.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            testID="comment-input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
            onPress={submitComment}
            disabled={!commentText.trim() || submittingComment}
            testID="submit-comment-btn"
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Header Component
  const Header = () => (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={styles.header}
    >
      <Text style={styles.headerTitle}>Certano</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity 
          style={styles.headerBtn}
          onPress={() => router.push('/notifications')}
          testID="notifications-btn"
        >
          <Ionicons name="heart-outline" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerBtn}
          onPress={() => router.push('/chats')}
          testID="chats-btn"
        >
          <Ionicons name="paper-plane-outline" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </MotiView>
  );

  // Stories Section
  const StoriesSection = () => (
    <View style={styles.storiesSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesScroll}
      >
        <StoryItem isAddStory index={0} />
        {stories.map((story, index) => (
          <StoryItem key={story.userId} item={story} index={index + 1} />
        ))}
      </ScrollView>
    </View>
  );

  // Bottom Navigation
  const BottomNav = () => (
    <MotiView
      from={{ translateY: 100 }}
      animate={{ translateY: 0 }}
      transition={{ type: 'spring', damping: 15, delay: 500 }}
      style={styles.bottomNav}
    >
      <TouchableOpacity style={styles.navItem} testID="nav-home">
        <Ionicons name="home" size={26} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => router.push('/search')}
        testID="nav-search"
      >
        <Ionicons name="search-outline" size={26} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.navItemCenter}
        onPress={() => router.push('/create-post')}
        testID="nav-create"
      >
        <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.createBtn}>
          <Ionicons name="add" size={28} color={COLORS.white} />
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.navItem}
        onPress={() => router.push('/reels')}
        testID="nav-reels"
      >
        <Ionicons name="play-circle-outline" size={26} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.navItem}
        onPress={() => router.push('/profile')}
        testID="nav-profile"
      >
        <Ionicons name="person-outline" size={26} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </MotiView>
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
        >
          <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.loadingLogo}>
            <Ionicons name="planet" size={40} color={COLORS.white} />
          </LinearGradient>
        </MotiView>
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 300 }}
          style={styles.loadingText}
        >
          Loading your feed...
        </MotiText>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Header />
      
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <PostCard item={item} index={index} />}
        ListHeaderComponent={<StoriesSection />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.feedContent}
        ListEmptyComponent={
          <View style={styles.emptyFeed}>
            <Ionicons name="images-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyFeedTitle}>No posts yet</Text>
            <Text style={styles.emptyFeedText}>Follow people to see their posts here</Text>
          </View>
        }
      />

      <BottomNav />
      <CommentsModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
  },
  storiesSection: {
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    marginBottom: 8,
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    width: 76,
  },
  addStoryRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStoryInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(245, 0, 87, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  storyAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  storyAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
  },
  storyName: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  feedContent: {
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: COLORS.surface,
    marginBottom: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  postUserText: {
    marginLeft: 12,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  postTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  postMenuBtn: {
    padding: 8,
  },
  postImageContainer: {
    width: width,
    height: width,
    backgroundColor: COLORS.surfaceLight,
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postActionsLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  likesContainer: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  captionContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  captionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '700',
  },
  viewComments: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  navItem: {
    padding: 8,
  },
  navItemCenter: {
    marginTop: -20,
  },
  createBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F50057',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyFeed: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyFeedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptyFeedText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 4,
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 8,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.textTertiary,
  },
});
