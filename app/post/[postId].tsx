import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  View, 
  Text, 
  Image, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Modal, 
  ScrollView, 
  Alert,
  RefreshControl,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp, 
  collection, 
  query, 
  orderBy, 
  getDocs,
  addDoc 
} from 'firebase/firestore';

const { width: screenWidth } = Dimensions.get('window');

export default function PostDetail() {
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  
  // Post state
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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
  const [currentLikes, setCurrentLikes] = useState([]);
  
  const userId = auth.currentUser?.uid;

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

  // Fetch post data
  const fetchPost = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'posts', postId));
      if (docSnap.exists()) {
        const postData = { id: docSnap.id, ...docSnap.data() };
        setPost(postData);
        
        // Fetch author data
        if (postData.uid) {
          await fetchUserData(postData.uid);
        }
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      Alert.alert('Error', 'Failed to load post');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch comments
  const fetchComments = async () => {
    if (!postId) return;
    
    setLoadingComments(true);
    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
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

  // Initial load
  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchComments();
    }
  }, [postId]);

  // Refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    fetchPost();
    fetchComments();
  };

  // Like handler
  const handleLike = async () => {
    if (!userId || !post) {
      Alert.alert('Error', 'Please log in to like posts');
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      const likesArray = Array.isArray(post.likes) ? post.likes : [];
      const isLiked = likesArray.includes(userId);

      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
      });

      // Update local state
      setPost(prevPost => {
        const currentLikes = Array.isArray(prevPost.likes) ? prevPost.likes : [];
        const updatedLikes = isLiked
          ? currentLikes.filter((id) => id !== userId)
          : [...currentLikes, userId];
        return { ...prevPost, likes: updatedLikes };
      });
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // Show likes modal
  const showLikes = async (likes) => {
    const likesArray = Array.isArray(likes) ? likes : [];
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
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please log in to comment');
      return;
    }

    setSubmittingComment(true);

    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        text: commentText.trim(),
        userId: userId,
        createdAt: serverTimestamp(),
        replies: [],
      });

      // Update the post's comment count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentCount: arrayUnion(userId),
      });

      setCommentText('');
      Alert.alert('Success', 'Comment added successfully!');
      
      // Refresh comments and post
      await fetchComments();
      await fetchPost();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Add reply
  const handleAddReply = async (commentId) => {
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please enter a reply');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please log in to reply');
      return;
    }

    setSubmittingReply(true);

    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
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
      Alert.alert('Success', 'Reply added successfully!');
      
      // Refresh comments
      await fetchComments();
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
            <UserAvatar userId={auth.currentUser?.uid || ''} size={24} />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#006D77" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#83C5BE" />
        <Text style={styles.errorTitle}>Post not found</Text>
        <Text style={styles.errorSubtitle}>The post you're looking for doesn't exist or has been removed.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const likesArray = Array.isArray(post.likes) ? post.likes : [];
  const commentArray = Array.isArray(post.commentCount) ? post.commentCount : [];
  const likesCount = likesArray.length;
  const commentCount = commentArray.length;
  const isLiked = likesArray.includes(userId);
  const authorName = userNames[post.uid] || 'Unknown User';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={24} color="#006D77" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="share-outline" size={24} color="#006D77" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="bookmark-outline" size={24} color="#006D77" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#006D77']}
            tintColor="#006D77"
          />
        }
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <UserAvatar userId={post.uid} />
            <View style={styles.authorDetails}>
              <TouchableOpacity onPress={() => router.push(`/profile/${post.uid}`)}>
                <Text style={styles.authorName}>{authorName}</Text>
              </TouchableOpacity>
              <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#83C5BE" />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        <View style={styles.postContent}>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postDescription}>{post.description}</Text>
          
          {post.image && (
            <Image source={{ uri: post.image }} style={styles.postImage} />
          )}
        </View>

        {/* Engagement Stats */}
        {(likesCount > 0 || commentCount > 0) && (
          <View style={styles.engagementStats}>
            <TouchableOpacity onPress={() => showLikes(likesArray)}>
              <Text style={styles.statsText}>
                {likesCount > 0 && `${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCommentModalVisible(true)}>
              <Text style={styles.statsText}>
                {commentCount > 0 && `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={[styles.actionButton, isLiked && styles.likedButton]}
            onPress={handleLike}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={isLiked ? "#FF4757" : "#83C5BE"} 
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {isLiked ? 'Liked' : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setCommentModalVisible(true)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#83C5BE" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color="#83C5BE" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="bookmark-outline" size={20} color="#83C5BE" />
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Preview */}
        <View style={styles.commentsPreview}>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
          {comments.length > 0 ? (
            <View>
              {comments.slice(0, 3).map((comment) => (
                <View key={comment.id} style={styles.commentPreview}>
                  <UserAvatar userId={comment.userId} size={24} />
                  <View style={styles.commentPreviewContent}>
                    <Text style={styles.commentPreviewAuthor}>{userNames[comment.userId] || 'Unknown User'}</Text>
                    <Text style={styles.commentPreviewText} numberOfLines={2}>{comment.text}</Text>
                  </View>
                </View>
              ))}
              {comments.length > 3 && (
                <TouchableOpacity 
                  style={styles.viewAllComments}
                  onPress={() => setCommentModalVisible(true)}
                >
                  <Text style={styles.viewAllCommentsText}>View all {comments.length} comments</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
          )}
        </View>

        {/* Quick Comment Input */}
        <View style={styles.quickCommentSection}>
          <UserAvatar userId={userId || ''} size={32} />
          <TouchableOpacity 
            style={styles.quickCommentInput}
            onPress={() => setCommentModalVisible(true)}
          >
            <Text style={styles.quickCommentPlaceholder}>Add a comment...</Text>
          </TouchableOpacity>
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
                  <Text style={styles.emptySubtitle}>Be the first to like this post!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comment Modal */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDF6F9',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#006D77',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EDF6F9',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#006D77',
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
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#EDF6F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
  },
  backIcon: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorDetails: {
    marginLeft: 12,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#006D77',
  },
  postTime: {
    fontSize: 12,
    color: '#83C5BE',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  postContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#006D77',
    marginBottom: 8,
  },
  postDescription: {
    fontSize: 16,
    color: '#006D77',
    lineHeight: 24,
    marginBottom: 16,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
  },
  engagementStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#83C5BE',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E9F5F6',
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  likedButton: {
    backgroundColor: '#FFE5E5',
  },
  actionText: {
    fontSize: 14,
    color: '#83C5BE',
    marginLeft: 6,
    fontWeight: '500',
  },
  likedText: {
    color: '#FF4757',
  },
  commentsPreview: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77',
    marginBottom: 12,
  },
  commentPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  commentPreviewContent: {
    flex: 1,
    marginLeft: 8,
  },
  commentPreviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#006D77',
    marginBottom: 2,
  },
  commentPreviewText: {
    fontSize: 14,
    color: '#006D77',
    lineHeight: 20,
  },
  viewAllComments: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewAllCommentsText: {
    fontSize: 14,
    color: '#83C5BE',
    fontWeight: '500',
  },
  noCommentsText: {
    fontSize: 14,
    color: '#83C5BE',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  quickCommentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9F5F6',
  },
  quickCommentInput: {
    flex: 1,
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9F5F6',
  },
  quickCommentPlaceholder: {
    fontSize: 14,
    color: '#83C5BE',
  },
  // Avatar styles
  avatarContainer: {
    backgroundColor: '#006D77',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    color: '#83C5BE',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F8FF',
  },
  userName: {
    flex: 1,
    fontSize: 16,
    color: '#006D77',
    marginLeft: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#83C5BE',
    textAlign: 'center',
  },
  // Comment section styles
  commentSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 12,
  },
  commentInputWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  commentInput: {
    fontSize: 16,
    color: '#006D77',
    borderWidth: 1,
    borderColor: '#E9F5F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F8FF',
    textAlignVertical: 'top',
    minHeight: 80,
    maxHeight: 120,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F6',
  },
  commentCounter: {
    fontSize: 12,
    color: '#83C5BE',
  },
  commentButton: {
    backgroundColor: '#006D77',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  commentButtonDisabled: {
    backgroundColor: '#E9F5F6',
  },
  commentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentsListContainer: {
    flex: 1,
    paddingTop: 16,
  },
  commentsList: {
    flex: 1,
  },
  // Individual comment styles
  commentContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F8FF',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentContent: {
    marginLeft: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#006D77',
  },
  commentTime: {
    fontSize: 12,
    color: '#83C5BE',
    marginTop: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#006D77',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  replyButton: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  replyButtonText: {
    fontSize: 12,
    color: '#83C5BE',
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
    marginBottom: 8,
    paddingTop: 8,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#006D77',
    marginRight: 8,
  },
  replyTime: {
    fontSize: 10,
    color: '#83C5BE',
  },
  replyText: {
    fontSize: 12,
    color: '#006D77',
    lineHeight: 16,
  },
  // Reply input styles
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 20,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F8FF',
  },
  replyInputWrapper: {
    flex: 1,
    marginLeft: 8,
  },
  replyInput: {
    fontSize: 12,
    color: '#006D77',
    borderWidth: 1,
    borderColor: '#E9F5F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F8FF',
    textAlignVertical: 'top',
    minHeight: 60,
    maxHeight: 80,
  },
  replyInputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
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
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  replySubmitButtonDisabled: {
    backgroundColor: '#E9F5F6',
  },
  replySubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});