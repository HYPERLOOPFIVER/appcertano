import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, Image, RefreshControl } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

const screenHeight = Dimensions.get('window').height;

export default function Reels() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const router = useRouter();
  const userId = auth.currentUser?.uid;
  const scrollRef = useRef(null);

  // User data state
  const [userNames, setUserNames] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  const [loadingUserNames, setLoadingUserNames] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  
  // Modal state
  const [likeModalVisible, setLikeModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [currentLikes, setCurrentLikes] = useState([]);
  const [currentReelId, setCurrentReelId] = useState(null);

  // Video refs for controlling playback
  const [videoRefs, setVideoRefs] = useState({});

  // Memoized function to set video refs
  const setVideoRef = useCallback((id, ref) => {
    if (ref && !videoRefs[id]) {
      setVideoRefs(prev => ({ ...prev, [id]: ref }));
    }
  }, [videoRefs]);

  // Clean up video refs on unmount
  useEffect(() => {
    return () => {
      Object.values(videoRefs).forEach(videoRef => {
        if (videoRef) {
          videoRef.pauseAsync();
          videoRef.unloadAsync();
        }
      });
    };
  }, []);

  // Control video playback based on current reel
  useEffect(() => {
    const controlVideos = async () => {
      const currentReelId = reels[currentReelIndex]?.id;
      if (!currentReelId) return;

      try {
        await Promise.all(
          Object.entries(videoRefs).map(async ([id, videoRef]) => {
            if (videoRef) {
              if (id === currentReelId) {
                await videoRef.playAsync();
              } else {
                await videoRef.pauseAsync();
              }
            }
          })
        );
      } catch (error) {
        console.error('Error controlling videos:', error);
      }
    };

    if (reels.length > 0 && userInteracted) {
      controlVideos();
    }
  }, [currentReelIndex, reels, userInteracted]);

  // Fetch user data function
  const fetchUserData = async (userId) => {
    if (userNames[userId]) return userNames[userId];
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const name = userData.name || userData.displayName || `User ${userId.substring(0, 6)}`;
        const avatar = userData.photoURL || userData.avatar || '';
        
        setUserNames(prev => ({ ...prev, [userId]: name }));
        setUserAvatars(prev => ({ ...prev, [userId]: avatar }));
        
        return name;
      } else {
        const defaultName = `User ${userId.substring(0, 6)}`;
        setUserNames(prev => ({ ...prev, [userId]: defaultName }));
        return defaultName;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      const defaultName = `User ${userId.substring(0, 6)}`;
      setUserNames(prev => ({ ...prev, [userId]: defaultName }));
      return defaultName;
    }
  };

  const fetchReels = async () => {
    try {
      const reelsRef = collection(db, 'reels');
      const q = query(reelsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const allReels = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const userSnap = await getDoc(doc(db, 'users', data.uid));
        const userData = userSnap.exists() ? userSnap.data() : { name: 'Unknown' };

        // Fetch user data for uploader
        await fetchUserData(data.uid);

        return {
          id: docSnap.id,
          likes: Array.isArray(data.likes) ? data.likes : [],
          comments: Array.isArray(data.comments) ? data.comments : [],
          uploaderName: userData.name,
          ...data,
        };
      }));
      setReels(allReels);
    } catch (err) {
      console.error('Error loading reels:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch comments for a specific reel
  const fetchComments = async (reelId) => {
    if (!reelId) return;
    
    setLoadingComments(true);
    try {
      const commentsRef = collection(db, 'reels', reelId, 'comments');
      const q = query(commentsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const allComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Fetch user names for all commenters
      const userIds = [...new Set(allComments.map(comment => comment.userId).filter(Boolean))];
      await Promise.all(userIds.map(fetchUserData));
      
      setComments(allComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReels();
  };

  const toggleLike = async (reelId, likes = []) => {
    if (!userId) return;
    const reelRef = doc(db, 'reels', reelId);
    const likeIds = Array.isArray(likes) ? likes.map((like) => (typeof like === 'string' ? like : like.userId)) : [];
    const isLiked = likeIds.includes(userId);

    try {
      await updateDoc(reelRef, {
        likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
      });

      setReels((prev) =>
        prev.map((reel) =>
          reel.id === reelId
            ? {
                ...reel,
                likes: isLiked
                  ? likeIds.filter((id) => id !== userId)
                  : [...likeIds, userId],
              }
            : reel
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Show likes modal
  const showLikes = async (likes, reelId) => {
    const likesArray = Array.isArray(likes) ? likes : [];
    setCurrentLikes(likesArray);
    setCurrentReelId(reelId);
    setLikeModalVisible(true);
    
    if (likesArray.length > 0) {
      setLoadingUserNames(true);
      try {
        await Promise.all(likesArray.map(fetchUserData));
      } catch (error) {
        console.error('Error fetching user names:', error);
      } finally {
        setLoadingUserNames(false);
      }
    }
  };

  // Show comments modal
  const showComments = async (reelId) => {
    setCurrentReelId(reelId);
    setCommentModalVisible(true);
    await fetchComments(reelId);
  };

  // Add comment
  const handleAddComment = async () => {
    if (!commentText.trim() || !userId || !currentReelId) return;

    setSubmittingComment(true);

    try {
      await addDoc(collection(db, 'reels', currentReelId, 'comments'), {
        text: commentText.trim(),
        userId: userId,
        createdAt: serverTimestamp(),
        replies: [],
      });

      setCommentText('');
      
      // Refresh comments
      await fetchComments(currentReelId);
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Add reply
  const handleAddReply = async (commentId) => {
    if (!replyText.trim() || !userId || !currentReelId) return;

    setSubmittingReply(true);

    try {
      const commentRef = doc(db, 'reels', currentReelId, 'comments', commentId);
      await updateDoc(commentRef, {
        replies: arrayUnion({
          id: Date.now().toString(),
          text: replyText.trim(),
          userId: userId,
          createdAt: new Date(),
        }),
      });

      setReplyText('');
      setReplyingTo(null);
      
      // Refresh comments
      await fetchComments(currentReelId);
    } catch (error) {
      console.error('Error adding reply:', error);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  // User Avatar Component
  const UserAvatar = ({ userId, size = 40 }) => {
    const avatar = userAvatars[userId];
    const name = userNames[userId] || 'U';
    
    return (
      <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
    );
  };

  // Render comment
  const renderComment = ({ item }) => {
    const replies = Array.isArray(item.replies) ? item.replies : [];
    
    return (
      <View style={styles.commentContainer}>
        <View style={styles.commentHeader}>
          <UserAvatar userId={item.userId} size={32} />
          <View style={styles.commentContent}>
            <Text style={styles.commentAuthor}>{userNames[item.userId] || 'Unknown User'}</Text>
            <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        
        <Text style={styles.commentText}>{item.text}</Text>
        
        <View style={styles.commentActions}>
          <TouchableOpacity 
            style={styles.replyButton}
            onPress={() => setReplyingTo(item.id)}
          >
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
          {replies.length > 0 && (
            <Text style={styles.replyCount}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</Text>
          )}
        </View>

        {/* Replies */}
        {replies.map((reply) => (
          <View key={reply.id} style={styles.replyContainer}>
            <UserAvatar userId={reply.userId} size={24} />
            <View style={styles.replyContent}>
              <View style={styles.replyHeader}>
                <Text style={styles.replyAuthor}>{userNames[reply.userId] || 'Unknown User'}</Text>
                <Text style={styles.replyTime}>{formatTime(reply.createdAt)}</Text>
              </View>
              <Text style={styles.replyText}>{reply.text}</Text>
            </View>
          </View>
        ))}

        {/* Reply Input */}
        {replyingTo === item.id && (
          <View style={styles.replyInputContainer}>
            <UserAvatar userId={userId || ''} size={24} />
            <View style={styles.replyInputWrapper}>
              <TextInput
                style={styles.replyInput}
                placeholder="Write a reply..."
                placeholderTextColor="#83C5BE"
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={300}
              />
              <View style={styles.replyInputActions}>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Text style={styles.cancelReplyText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.replySubmitButton, (!replyText.trim() || submittingReply) && styles.replySubmitButtonDisabled]}
                  onPress={() => handleAddReply(item.id)}
                  disabled={!replyText.trim() || submittingReply}
                >
                  {submittingReply ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.replySubmitButtonText}>Reply</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / screenHeight);
    if (index !== currentReelIndex) {
      setCurrentReelIndex(index);
    }
  };

  const handleUserInteraction = () => {
    if (!userInteracted) {
      setUserInteracted(true);
      // Play the current video after first interaction
      const currentReelId = reels[currentReelIndex]?.id;
      if (currentReelId && videoRefs[currentReelId]) {
        videoRefs[currentReelId].playAsync();
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#006D77" />
        <Text style={styles.loadingText}>Loading reels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onTouchStart={handleUserInteraction}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        pagingEnabled
        snapToInterval={screenHeight}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#006D77']}
            tintColor="#006D77"
          />
        }
      >
        {reels.map((item, index) => {
          const likeIds = Array.isArray(item.likes) ? item.likes.map((like) => (typeof like === 'string' ? like : like.userId)) : [];
          const isLiked = likeIds.includes(userId);
          
          return (
            <View key={item.id} style={[styles.reelContainer, { height: screenHeight }]}>          
              <Video
                ref={(ref) => setVideoRef(item.id, ref)}
                source={{ uri: item.videoUrl }}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay={index === currentReelIndex && userInteracted}
                isLooping
                isMuted={!userInteracted} // Start muted until user interacts
                useNativeControls={false}
                onError={(error) => console.error('Video error:', error)}
              />
              
              {/* Play button overlay for first interaction */}
              {!userInteracted && (
                <TouchableOpacity 
                  style={styles.playButtonOverlay}
                  onPress={handleUserInteraction}
                >
                  <Ionicons name="play" size={48} color="white" />
                </TouchableOpacity>
              )}
              
              {/* Overlay content */}
              <View style={styles.overlay}>
                {/* User info */}
                <View style={styles.userInfo}>
                  <TouchableOpacity 
                    style={styles.userProfile}
                    onPress={() => router.push(`/profile/${item.uid}`)}
                  >
                    <UserAvatar userId={item.uid} size={50} />
                  </TouchableOpacity>
                  <View style={styles.userDetails}>
                    <Text style={styles.username}>@{item.uploaderName}</Text>
                    <Text style={styles.date}>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</Text>
                  </View>
                </View>

                {/* Caption */}
                <Text style={styles.caption}>{item.caption}</Text>

                {/* Action buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={[styles.actionButton, isLiked && styles.likedButton]}
                    onPress={() => toggleLike(item.id, item.likes)}
                  >
                    <Ionicons 
                      name={isLiked ? "heart" : "heart-outline"} 
                      size={28} 
                      color={isLiked ? "#FF4757" : "#FFFFFF"} 
                    />
                    <Text style={[styles.actionText, isLiked && styles.likedActionText]}>
                      {likeIds.length}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => showComments(item.id)}
                  >
                    <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
                    <Text style={styles.actionText}>
                      {item.comments?.length || 0}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => {
                      setCurrentReelId(item.id);
                      setShareModalVisible(true);
                    }}
                  >
                    <Ionicons name="share-outline" size={28} color="#FFFFFF" />
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="bookmark-outline" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Likes preview */}
                {likeIds.length > 0 && (
                  <TouchableOpacity 
                    style={styles.likesPreview}
                    onPress={() => showLikes(item.likes, item.id)}
                  >
                    <Text style={styles.likesText}>
                      {likeIds.length} {likeIds.length === 1 ? 'like' : 'likes'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Likes Modal */}
      <Modal visible={likeModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Likes</Text>
              <TouchableOpacity onPress={() => setLikeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#83C5BE" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {loadingUserNames ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color="#006D77" />
                  <Text style={styles.modalLoadingText}>Loading...</Text>
                </View>
              ) : currentLikes.length > 0 ? (
                currentLikes.map((uid) => (
                  <TouchableOpacity 
                    key={uid}
                    style={styles.userRow}
                    onPress={() => {
                      setLikeModalVisible(false);
                      router.push(`/profile/${uid}`);
                    }}
                  >
                    <UserAvatar userId={uid} />
                    <Text style={styles.userName}>
                      {userNames[uid] || `User ${uid.substring(0, 6)}`}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#83C5BE" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="heart-outline" size={48} color="#83C5BE" />
                  <Text style={styles.emptyTitle}>No likes yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first to like this reel!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={commentModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => {
                setCommentModalVisible(false);
                setCommentText('');
                setReplyingTo(null);
                setReplyText('');
              }}>
                <Ionicons name="close" size={24} color="#83C5BE" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {/* Add Comment Section */}
              <View style={styles.commentSection}>
                <UserAvatar userId={userId || ''} size={32} />
                <View style={styles.commentInputWrapper}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="What's on your mind?"
                    placeholderTextColor="#83C5BE"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={500}
                  />
                </View>
              </View>
              
              <View style={styles.commentFooter}>
                <Text style={styles.commentCounter}>{commentText.length}/500</Text>
                <TouchableOpacity 
                  style={[
                    styles.commentButton,
                    (!commentText.trim() || submittingComment) && styles.commentButtonDisabled
                  ]}
                  onPress={handleAddComment}
                  disabled={!commentText.trim() || submittingComment}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.commentButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Comments List */}
              <View style={styles.commentsListContainer}>
                {loadingComments ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="small" color="#006D77" />
                    <Text style={styles.modalLoadingText}>Loading comments...</Text>
                  </View>
                ) : comments.length > 0 ? (
                  <FlatList
                    data={comments}
                    keyExtractor={(item) => item.id}
                    renderItem={renderComment}
                    showsVerticalScrollIndicator={false}
                    style={styles.commentsList}
                  />
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubble-outline" size={48} color="#83C5BE" />
                    <Text style={styles.emptyTitle}>No comments yet</Text>
                    <Text style={styles.emptySubtitle}>Be the first to comment!</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal visible={shareModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share</Text>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={24} color="#83C5BE" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.shareOptions}>
                <TouchableOpacity style={styles.shareOption}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="copy-outline" size={24} color="#006D77" />
                  </View>
                  <Text style={styles.shareText}>Copy Link</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                  </View>
                  <Text style={styles.shareText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="logo-instagram" size={24} color="#E4405F" />
                  </View>
                  <Text style={styles.shareText}>Instagram</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                  </View>
                  <Text style={styles.shareText}>Twitter</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="mail-outline" size={24} color="#006D77" />
                  </View>
                  <Text style={styles.shareText}>Email</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption}>
                  <View style={styles.shareIcon}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="#006D77" />
                  </View>
                  <Text style={styles.shareText}>More</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#000000' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#000000' 
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  scrollView: { 
    flex: 1 
  },
  reelContainer: { 
    width: '100%', 
    position: 'relative',
    backgroundColor: '#000000' 
  },
  video: { 
    width: '100%', 
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userProfile: {
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  date: { 
    fontSize: 12, 
    color: '#CCCCCC', 
    marginTop: 2 
  },
  caption: { 
    fontSize: 14, 
    color: '#FFFFFF', 
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    minWidth: 60,
  },
  likedButton: {
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
  },
  actionText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '500',
  },
  likedActionText: {
    color: '#FF4757',
  },
  likesPreview: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  likesText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Avatar styles
  avatarContainer: {
    backgroundColor: '#006D77',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E9F5F6',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#006D77',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#006D77',
  },
  // User row styles (for likes modal)
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F8F8',
  },
  userName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#006D77',
    marginLeft: 12,
  },
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#83C5BE',
    marginTop: 8,
    textAlign: 'center',
  },
  // Comment styles
  commentSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
  },
  commentInputWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E9F5F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#006D77',
    backgroundColor: '#F8FCFC',
    maxHeight: 100,
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentCounter: {
    fontSize: 12,
    color: '#83C5BE',
  },
  commentButton: {
    backgroundColor: '#006D77',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  commentButtonDisabled: {
    backgroundColor: '#B0D4D6',
    opacity: 0.6,
  },
  commentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Comments list styles
  commentsListContainer: {
    flex: 1,
    paddingTop: 16,
  },
  commentsList: {
    flex: 1,
  },
  commentContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F8F8',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentContent: {
    marginLeft: 12,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#006D77',
  },
  commentTime: {
    fontSize: 12,
    color: '#83C5BE',
    marginTop: 2,
  },
  commentText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 20,
    marginVertical: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  replyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 16,
  },
  replyButtonText: {
    fontSize: 12,
    color: '#006D77',
    fontWeight: '500',
  },
  replyCount: {
    fontSize: 12,
    color: '#83C5BE',
  },
  // Reply styles
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 20,
    marginTop: 12,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#E9F5F6',
  },
  replyContent: {
    flex: 1,
    marginLeft: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#006D77',
    marginRight: 8,
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#006D77',
    marginRight: 8,
  },
  replyTime: {
    fontSize: 11,
    color: '#83C5BE',
  },
  replyText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 18,
  },
  // Reply input styles
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    marginLeft: 20,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#E9F5F6',
  },
  replyInputWrapper: {
    flex: 1,
    marginLeft: 8,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#E9F5F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#006D77',
    backgroundColor: '#F8FCFC',
    marginBottom: 8,
  },
  replyInputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelReplyText: {
    fontSize: 12,
    color: '#83C5BE',
    fontWeight: '500',
  },
  replySubmitButton: {
    backgroundColor: '#006D77',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  replySubmitButtonDisabled: {
    backgroundColor: '#B0D4D6',
    opacity: 0.6,
  },
  replySubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Share modal styles
  shareOptions: {
    paddingVertical: 20,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F8F8',
  },
  shareIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#F8FCFC',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  shareText: {
    fontSize: 16,
    color: '#006D77',
    fontWeight: '500',
  },
});