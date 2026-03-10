import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, Image, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, addDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const screenHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('window').width;

export default function ReelDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const userId = auth.currentUser?.uid;
  const videoRef = useRef(null);

  // Reel data state
  const [reel, setReel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // User data state
  const [userNames, setUserNames] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  
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
  const [loadingUserNames, setLoadingUserNames] = useState(false);

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

  // Fetch reel data
  const fetchReel = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const reelDoc = await getDoc(doc(db, 'reels', id));
      
      if (!reelDoc.exists()) {
        setError('Reel not found');
        return;
      }

      const reelData = reelDoc.data();
      const userSnap = await getDoc(doc(db, 'users', reelData.uid));
      const userData = userSnap.exists() ? userSnap.data() : { name: 'Unknown' };

      // Fetch user data for uploader
      await fetchUserData(reelData.uid);

      const processedReel = {
        id: reelDoc.id,
        likes: Array.isArray(reelData.likes) ? reelData.likes : [],
        comments: Array.isArray(reelData.comments) ? reelData.comments : [],
        uploaderName: userData.name || userData.displayName || 'Unknown User',
        ...reelData,
      };

      setReel(processedReel);
      
      // Fetch comments
      await fetchComments(id);
      
    } catch (err) {
      console.error('Error loading reel:', err);
      setError('Failed to load reel');
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments for the reel
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
    fetchReel();
  }, [id]);

  // Video control functions
  const handleVideoPress = async () => {
    if (!videoRef.current) return;
    
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error controlling video:', error);
    }
  };

  const toggleLike = async () => {
    if (!userId || !reel) return;
    
    const likeIds = Array.isArray(reel.likes) ? reel.likes : [];
    const isLiked = likeIds.includes(userId);

    try {
      const reelRef = doc(db, 'reels', reel.id);
      await updateDoc(reelRef, {
        likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
      });

      setReel(prev => ({
        ...prev,
        likes: isLiked
          ? likeIds.filter(id => id !== userId)
          : [...likeIds, userId],
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // Show likes modal
  const showLikes = async () => {
    if (!reel) return;
    
    const likesArray = Array.isArray(reel.likes) ? reel.likes : [];
    setCurrentLikes(likesArray);
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

  // Add comment
  const handleAddComment = async () => {
    if (!commentText.trim() || !userId || !reel) return;

    setSubmittingComment(true);

    try {
      await addDoc(collection(db, 'reels', reel.id, 'comments'), {
        text: commentText.trim(),
        userId: userId,
        createdAt: serverTimestamp(),
        replies: [],
      });

      setCommentText('');
      
      // Refresh comments
      await fetchComments(reel.id);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Add reply
  const handleAddReply = async (commentId) => {
    if (!replyText.trim() || !userId || !reel) return;

    setSubmittingReply(true);

    try {
      const commentRef = doc(db, 'reels', reel.id, 'comments', commentId);
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
      await fetchComments(reel.id);
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('Error', 'Failed to add reply');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#006D77" />
        <Text style={styles.loadingText}>Loading reel...</Text>
      </SafeAreaView>
    );
  }

  if (error || !reel) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF4757" />
          <Text style={styles.errorTitle}>Reel not found</Text>
          <Text style={styles.errorSubtitle}>{error || 'This reel may have been deleted or is not available.'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const likeIds = Array.isArray(reel.likes) ? reel.likes : [];
  const isLiked = likeIds.includes(userId);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#006D77" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reel</Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#006D77" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Video Container */}
        <View style={styles.videoContainer}>
          <TouchableOpacity 
            style={styles.videoWrapper}
            onPress={handleVideoPress}
            activeOpacity={0.9}
          >
            <Video
              ref={videoRef}
              source={{ uri: reel.videoUrl }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isPlaying}
              isLooping
              onLoad={() => setVideoLoaded(true)}
              onError={(error) => console.error('Video error:', error)}
            />
            
            {/* Play/Pause overlay */}
            {videoLoaded && (
              <View style={styles.playOverlay}>
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={32} 
                  color="white" 
                  style={styles.playIcon}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Reel Info */}
        <View style={styles.reelInfo}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <TouchableOpacity 
              style={styles.userProfile}
              onPress={() => router.push(`/profile/${reel.uid}`)}
            >
              <UserAvatar userId={reel.uid} size={50} />
            </TouchableOpacity>
            <View style={styles.userDetails}>
              <Text style={styles.username}>@{reel.uploaderName}</Text>
              <Text style={styles.date}>
                {reel.createdAt ? new Date(reel.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown date'}
              </Text>
            </View>
          </View>

          {/* Caption */}
          {reel.caption && (
            <Text style={styles.caption}>{reel.caption}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, isLiked && styles.likedButton]}
              onPress={toggleLike}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={24} 
                color={isLiked ? "#FF4757" : "#006D77"} 
              />
              <Text style={[styles.actionText, isLiked && styles.likedActionText]}>
                {likeIds.length} {likeIds.length === 1 ? 'like' : 'likes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setCommentModalVisible(true)}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#006D77" />
              <Text style={styles.actionText}>
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShareModalVisible(true)}
            >
              <Ionicons name="share-outline" size={24} color="#006D77" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Likes Preview */}
          {likeIds.length > 0 && (
            <TouchableOpacity 
              style={styles.likesPreview}
              onPress={showLikes}
            >
              <Text style={styles.likesText}>
                Liked by {likeIds.length} {likeIds.length === 1 ? 'person' : 'people'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsSectionHeader}>
            <Text style={styles.commentsSectionTitle}>Comments</Text>
            <Text style={styles.commentsCount}>{comments.length}</Text>
          </View>

          {/* Add Comment */}
          <View style={styles.commentInputSection}>
            <UserAvatar userId={userId || ''} size={32} />
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#83C5BE"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <View style={styles.commentInputFooter}>
                <Text style={styles.commentCounter}>{commentText.length}/500</Text>
                <TouchableOpacity 
                  style={[
                    styles.commentSubmitButton,
                    (!commentText.trim() || submittingComment) && styles.commentSubmitButtonDisabled
                  ]}
                  onPress={handleAddComment}
                  disabled={!commentText.trim() || submittingComment}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.commentSubmitButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Comments List */}
          {loadingComments ? (
            <View style={styles.loadingComments}>
              <ActivityIndicator size="small" color="#006D77" />
              <Text style={styles.loadingCommentsText}>Loading comments...</Text>
            </View>
          ) : comments.length > 0 ? (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              style={styles.commentsList}
            />
          ) : (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={48} color="#83C5BE" />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to comment!</Text>
            </View>
          )}
        </View>
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
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={renderComment}
                showsVerticalScrollIndicator={false}
                style={styles.commentsList}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubble-outline" size={48} color="#83C5BE" />
                    <Text style={styles.emptyTitle}>No comments yet</Text>
                    <Text style={styles.emptySubtitle}>Be the first to comment!</Text>
                  </View>
                }
              />
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
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#006D77',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4757',
    marginTop: 16,
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#83C5BE',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#006D77',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77',
  },
  moreButton: {
    padding: 4,
  },
  // Content styles
  scrollView: {
    flex: 1,
  },
  videoContainer: {
    backgroundColor: '#000000',
    aspectRatio: 9/16,
    maxHeight: screenHeight * 0.7,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
  },
 playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
},
playIcon: {
    opacity: 0.85,
    backgroundColor: '#006D77',
    borderRadius: 32,
    padding: 12,
},
reelInfo: {
    padding: 16,
    backgroundColor: '#F7FDFC',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 8,
    shadowColor: '#006D77',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    fontWeight: 'bold',
    fontSize: 16,
    color: '#006D77',
    marginBottom: 2,
},
date: {
    fontSize: 12,
    color: '#83C5BE',
},
caption: {
    fontSize: 15,
    color: '#22223B',
    marginTop: 6,
    marginBottom: 10,
    fontStyle: 'italic',
},
actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
},
actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#E9F5F6',
},
likedButton: {
    backgroundColor: '#FFE5EC',
},
actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#006D77',
    fontWeight: '500',
},
likedActionText: {
    color: '#FF4757',
    fontWeight: 'bold',
},
likesPreview: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#E9F5F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
},
likesText: {
    color: '#006D77',
    fontSize: 13,
    fontWeight: '500',
},
commentsSection: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#006D77',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
},
commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
},
commentsSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#006D77',
    flex: 1,
},
commentsCount: {
    fontSize: 15,
    color: '#83C5BE',
    fontWeight: 'bold',
    backgroundColor: '#E9F5F6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
},
commentInputSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
},
commentInputWrapper: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: '#F7FDFC',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9F5F6',
},
commentInput: {
    fontSize: 15,
    color: '#22223B',
    minHeight: 36,
    maxHeight: 80,
},
commentInputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
},
commentCounter: {
    fontSize: 12,
    color: '#83C5BE',
},
commentSubmitButton: {
    backgroundColor: '#006D77',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginLeft: 8,
},
commentSubmitButtonDisabled: {
    backgroundColor: '#B7E4C7',
},
commentSubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
},
commentsList: {
    marginTop: 4,
},
commentContainer: {
    backgroundColor: '#F7FDFC',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9F5F6',
},
commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
},
commentContent: {
    marginLeft: 8,
    flex: 1,
},
commentAuthor: {
    fontWeight: 'bold',
    color: '#006D77',
    fontSize: 14,
},
commentTime: {
    fontSize: 11,
    color: '#83C5BE',
},
commentText: {
    fontSize: 15,
    color: '#22223B',
    marginTop: 2,
    marginBottom: 4,
},
commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
},
replyButton: {
    marginRight: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#E9F5F6',
},
replyButtonText: {
    color: '#006D77',
    fontSize: 13,
    fontWeight: '500',
},
replyCount: {
    color: '#83C5BE',
    fontSize: 12,
    fontWeight: 'bold',
},
replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    marginLeft: 24,
    backgroundColor: '#E9F5F6',
    borderRadius: 10,
    padding: 6,
},
replyContent: {
    marginLeft: 8,
    flex: 1,
},
replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
},
replyAuthor: {
    fontWeight: 'bold',
    color: '#006D77',
    fontSize: 13,
    marginRight: 8,
},
replyTime: {
    fontSize: 10,
    color: '#83C5BE',
},
replyText: {
    fontSize: 14,
    color: '#22223B',
    marginTop: 1,
},
replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginLeft: 24,
},
replyInputWrapper: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#F7FDFC',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E9F5F6',
},
replyInput: {
    fontSize: 14,
    color: '#22223B',
    minHeight: 32,
    maxHeight: 60,
},
replyInputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
},
cancelReplyText: {
    color: '#83C5BE',
    fontSize: 13,
    marginRight: 12,
},
replySubmitButton: {
    backgroundColor: '#006D77',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
},
replySubmitButtonDisabled: {
    backgroundColor: '#B7E4C7',
},
replySubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
},
loadingComments: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    justifyContent: 'center',
},
loadingCommentsText: {
    marginLeft: 10,
    color: '#006D77',
    fontSize: 15,
},
emptyComments: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
},
emptyTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#006D77',
    marginTop: 8,
},
emptySubtitle: {
    fontSize: 13,
    color: '#83C5BE',
    marginTop: 2,
},
// Modal styles
modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'flex-end',
},
modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    minHeight: 320,
    maxHeight: screenHeight * 0.7,
    shadowColor: '#006D77',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
},
modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E9F5F6',
    alignSelf: 'center',
    marginVertical: 10,
},
modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
},
modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77',
},
modalContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    flex: 1,
},
modalLoading: {
    alignItems: 'center',
    marginTop: 24,
},
modalLoadingText: {
    color: '#006D77',
    fontSize: 15,
    marginTop: 8,
},
userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
},
userName: {
    marginLeft: 12,
    fontSize: 15,
    color: '#22223B',
    flex: 1,
    fontWeight: '500',
},
emptyState: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
},
// Share modal
shareOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
},
shareOption: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 18,
},
shareIcon: {
    backgroundColor: '#E9F5F6',
    borderRadius: 24,
    padding: 14,
    marginBottom: 6,
},
shareText: {
    fontSize: 13,
    color: '#006D77',
    fontWeight: '500',
},
// Avatar
avatarContainer: {
    backgroundColor: '#B7E4C7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
},
avatarImage: {
    resizeMode: 'cover',
},
avatarText: {
    color: '#006D77',
    fontWeight: 'bold',
},
});
