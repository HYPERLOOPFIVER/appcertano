import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Modal,
  StatusBar,
  Share,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, 
  getDocs, 
  orderBy, 
  query, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc, 
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#FF2D55',
  secondary: '#6366F1',
  background: '#000000',
  surface: '#1A1A1A',
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.5)',
  overlay: 'rgba(0,0,0,0.3)',
};

export default function Reels() {
  const router = useRouter();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userNames, setUserNames] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  const [videoRefs, setVideoRefs] = useState({});
  const [paused, setPaused] = useState({});
  
  // Modal states
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [sharesVisible, setSharesVisible] = useState(false);
  const [selectedReel, setSelectedReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const flatListRef = useRef(null);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    fetchReels();
  }, []);

  useEffect(() => {
    // Control video playback based on visible reel
    Object.entries(videoRefs).forEach(([id, ref]) => {
      if (ref) {
        const reelIndex = reels.findIndex(r => r.id === id);
        if (reelIndex === currentIndex && !paused[id]) {
          ref.playAsync();
        } else {
          ref.pauseAsync();
        }
      }
    });
  }, [currentIndex, reels, paused]);

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

  const fetchReels = async () => {
    try {
      const reelsRef = collection(db, 'reels');
      const q = query(reelsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const reelsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        likes: doc.data().likes || [],
        comments: doc.data().comments || [],
        views: doc.data().views || 0,
      }));
      
      // Fetch user data
      const userIds = [...new Set(reelsData.map(r => r.uid))];
      await Promise.all(userIds.map(fetchUserData));
      
      setReels(reelsData);
    } catch (error) {
      console.error('Error fetching reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (reelId, likes) => {
    if (!currentUserId) return;
    
    const reelRef = doc(db, 'reels', reelId);
    const isLiked = likes.includes(currentUserId);
    
    try {
      await updateDoc(reelRef, {
        likes: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
      });
      
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, likes: isLiked ? likes.filter(id => id !== currentUserId) : [...likes, currentUserId] }
          : reel
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const togglePause = (reelId) => {
    const ref = videoRefs[reelId];
    if (ref) {
      if (paused[reelId]) {
        ref.playAsync();
      } else {
        ref.pauseAsync();
      }
      setPaused(prev => ({ ...prev, [reelId]: !prev[reelId] }));
    }
  };

  const openComments = async (reel) => {
    setSelectedReel(reel);
    setCommentsVisible(true);
    setLoadingComments(true);
    
    try {
      const commentsRef = collection(db, 'reels', reel.id, 'comments');
      const q = query(commentsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      await Promise.all(commentsData.map(c => fetchUserData(c.userId)));
      setComments(commentsData);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUserId || !selectedReel) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reels', selectedReel.id, 'comments'), {
        userId: currentUserId,
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });
      
      setCommentText('');
      openComments(selectedReel);
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async (reel) => {
    try {
      await Share.share({
        message: `Check out this awesome reel on Certano! ${reel.caption || ''}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Reel Item Component
  const ReelItem = ({ item, index }) => {
    const isLiked = item.likes?.includes(currentUserId);
    const isPaused = paused[item.id];
    const likeScale = useRef(new Animated.Value(1)).current;

    const animateLike = () => {
      Animated.sequence([
        Animated.timing(likeScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
        Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    };

    const handleDoubleTap = () => {
      if (!isLiked) {
        handleLike(item.id, item.likes);
        animateLike();
      }
    };

    return (
      <View style={styles.reelContainer}>
        {/* Video */}
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoWrapper}
          onPress={() => togglePause(item.id)}
          onLongPress={handleDoubleTap}
        >
          <Video
            ref={(ref) => {
              if (ref) setVideoRefs(prev => ({ ...prev, [item.id]: ref }));
            }}
            source={{ uri: item.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={index === currentIndex && !isPaused}
            isMuted={false}
          />
          
          {/* Pause Indicator */}
          {isPaused && (
            <MotiView
              from={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              style={styles.pauseOverlay}
            >
              <View style={styles.pauseIcon}>
                <Ionicons name="play" size={50} color={COLORS.white} />
              </View>
            </MotiView>
          )}
          
          {/* Gradient Overlays */}
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent']}
            style={styles.topGradient}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bottomGradient}
          />
        </TouchableOpacity>

        {/* Right Actions */}
        <View style={styles.actionsContainer}>
          {/* Profile */}
          <MotiView
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 100 }}
          >
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => router.push(`/profile/${item.uid}`)}
            >
              {userAvatars[item.uid] ? (
                <Image source={{ uri: userAvatars[item.uid] }} style={styles.profileAvatar} />
              ) : (
                <LinearGradient colors={['#FF2D55', '#FF6B6B']} style={styles.profileAvatarPlaceholder}>
                  <Text style={styles.avatarText}>{(userNames[item.uid] || 'U')[0]}</Text>
                </LinearGradient>
              )}
              <View style={styles.followBadge}>
                <Ionicons name="add" size={12} color={COLORS.white} />
              </View>
            </TouchableOpacity>
          </MotiView>

          {/* Like */}
          <MotiView
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 200 }}
          >
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => {
                handleLike(item.id, item.likes);
                if (!isLiked) animateLike();
              }}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={35} 
                  color={isLiked ? COLORS.primary : COLORS.white} 
                />
              </Animated.View>
              <Text style={styles.actionText}>{formatCount(item.likes?.length || 0)}</Text>
            </TouchableOpacity>
          </MotiView>

          {/* Comment */}
          <MotiView
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 300 }}
          >
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => openComments(item)}
            >
              <Ionicons name="chatbubble-ellipses" size={32} color={COLORS.white} />
              <Text style={styles.actionText}>{formatCount(item.comments?.length || 0)}</Text>
            </TouchableOpacity>
          </MotiView>

          {/* Share */}
          <MotiView
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 400 }}
          >
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => handleShare(item)}
            >
              <Ionicons name="arrow-redo" size={32} color={COLORS.white} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </MotiView>

          {/* Music Disc */}
          <MotiView
            from={{ opacity: 0, translateX: 20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 500 }}
          >
            <TouchableOpacity style={styles.actionItem}>
              <MotiView
                animate={{ rotate: '360deg' }}
                transition={{ type: 'timing', duration: 3000, loop: true }}
                style={styles.musicDisc}
              >
                <LinearGradient colors={['#333', '#666']} style={styles.musicDiscInner}>
                  <Ionicons name="musical-notes" size={16} color={COLORS.white} />
                </LinearGradient>
              </MotiView>
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Bottom Info */}
        <View style={styles.bottomInfo}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
          >
            {/* Username */}
            <TouchableOpacity 
              style={styles.userRow}
              onPress={() => router.push(`/profile/${item.uid}`)}
            >
              <Text style={styles.username}>@{userNames[item.uid] || 'user'}</Text>
              {item.verified && (
                <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" />
              )}
            </TouchableOpacity>

            {/* Caption */}
            {item.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption}
              </Text>
            )}

            {/* Hashtags */}
            {item.hashtags && (
              <Text style={styles.hashtags} numberOfLines={1}>
                {item.hashtags}
              </Text>
            )}

            {/* Music */}
            <View style={styles.musicRow}>
              <Ionicons name="musical-notes" size={14} color={COLORS.white} />
              <Text style={styles.musicText} numberOfLines={1}>
                {item.musicName || 'Original Sound'} - {userNames[item.uid]}
              </Text>
            </View>
          </MotiView>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }}
        >
          <LinearGradient colors={['#FF2D55', '#FF6B6B']} style={styles.loadingIcon}>
            <Ionicons name="play" size={40} color={COLORS.white} />
          </LinearGradient>
        </MotiView>
        <Text style={styles.loadingText}>Loading Reels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity 
          style={styles.cameraBtn}
          onPress={() => router.push('/create-reel')}
          testID="create-reel-btn"
        >
          <Ionicons name="camera" size={26} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Reels Feed */}
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={({ item, index }) => <ReelItem item={item} index={index} />}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="videocam-outline" size={80} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Reels Yet</Text>
            <Text style={styles.emptyText}>Be the first to create one!</Text>
            <TouchableOpacity 
              style={styles.createBtn}
              onPress={() => router.push('/create-reel')}
            >
              <LinearGradient colors={['#FF2D55', '#FF6B6B']} style={styles.createBtnGradient}>
                <Ionicons name="add" size={24} color={COLORS.white} />
                <Text style={styles.createBtnText}>Create Reel</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Comments Modal */}
      <Modal visible={commentsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.commentsModal}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
              </Text>
              <TouchableOpacity onPress={() => setCommentsVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={styles.loadingComments}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    {userAvatars[item.userId] ? (
                      <Image source={{ uri: userAvatars[item.userId] }} style={styles.commentAvatar} />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarText}>{(userNames[item.userId] || 'U')[0]}</Text>
                      </View>
                    )}
                    <View style={styles.commentContent}>
                      <Text style={styles.commentUser}>{userNames[item.userId] || 'User'}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Ionicons name="chatbubble-outline" size={48} color={COLORS.textTertiary} />
                    <Text style={styles.emptyCommentsText}>No comments yet</Text>
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
              />
              <TouchableOpacity 
                style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
                onPress={submitComment}
                disabled={!commentText.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="send" size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIcon: {
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
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cameraBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: COLORS.background,
  },
  videoWrapper: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pauseIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  actionsContainer: {
    position: 'absolute',
    right: 12,
    bottom: 160,
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
    marginBottom: 8,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  profileAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  followBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  actionText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  musicDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 8,
    borderColor: '#333',
    backgroundColor: '#222',
  },
  musicDiscInner: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 90,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  username: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    fontSize: 15,
    color: COLORS.white,
    marginBottom: 8,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  hashtags: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  musicText: {
    fontSize: 13,
    color: COLORS.white,
    maxWidth: 180,
  },
  emptyContainer: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textTertiary,
    marginTop: 8,
    marginBottom: 24,
  },
  createBtn: {
    overflow: 'hidden',
    borderRadius: 25,
  },
  createBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  commentsModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    minHeight: '50%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  loadingComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    fontWeight: 'bold',
    color: COLORS.white,
  },
  commentContent: {
    flex: 1,
    marginLeft: 12,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: COLORS.textTertiary,
    marginTop: 12,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#1F2937',
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
    backgroundColor: '#D1D5DB',
  },
});
