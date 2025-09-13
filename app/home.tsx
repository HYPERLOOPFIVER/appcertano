import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Modal, Pressable, TextInput, Alert, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { db, auth } from '../firebase';
import { collection, getDocs, query, orderBy, updateDoc, doc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc, onSnapshot, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Instagram-like feed algorithm constants
const FEED_ALGORITHM_WEIGHTS = {
  RECENCY: 0.35,        // How recent the post is
  ENGAGEMENT: 0.30,     // Likes, comments, shares
  RELATIONSHIP: 0.25,   // How close the user is to the author
  CONTENT_TYPE: 0.10    // Type of content (image, video, text)
};

const RELATIONSHIP_SCORES = {
  FOLLOWING: 1.0,
  MUTUAL_FOLLOWERS: 0.8,
  FOLLOWED_BY: 0.6,
  SUGGESTED: 0.3,
  STRANGER: 0.1
};

const BottomNavigation = ({ onTabPress }) => {
  const [activeTab, setActiveTab] = useState(0);

  const TABS = [
    { label: 'Home', icon: 'home' },
    { label: 'Search', icon: 'search' },
    { label: 'Post', icon: 'add-circle' },
    { label: 'Reels', icon: 'film' },
    { label: 'Profile', icon: 'person' },
  ];

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.bottomNavContainer}>
      <View style={styles.tabContainer}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab.label}
            style={[styles.tab, activeTab === idx && styles.activeTab]}
            onPress={() => {
              setActiveTab(idx);
              onTabPress && onTabPress(idx);
            }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={tab.icon} 
              size={24} 
              color={activeTab === idx ? '#6366F1' : '#83C5BE'} 
            />
            <Text style={[styles.tabLabel, { color: activeTab === idx ? '#6366F1' : '#83C5BE' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [rankedPosts, setRankedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likeModalVisible, setLikeModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [currentLikes, setCurrentLikes] = useState([]);
  const [currentPostId, setCurrentPostId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  const [loadingUserNames, setLoadingUserNames] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const router = useRouter();

  // Fetch user relationships
  const fetchUserRelationships = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      // Fetch following
      const followingRef = collection(db, 'users', userId, 'following');
      const followingSnapshot = await getDocs(followingRef);
      const following = followingSnapshot.docs.map(doc => doc.id);
      setFollowingList(following);

      // Fetch followers
      const followersRef = collection(db, 'users', userId, 'followers');
      const followersSnapshot = await getDocs(followersRef);
      const followers = followersSnapshot.docs.map(doc => doc.id);
      setFollowersList(followers);
    } catch (error) {
      console.error('Error fetching relationships:', error);
    }
  };

  // Instagram-like feed ranking algorithm
  const rankPosts = (posts, currentUserId) => {
    if (!currentUserId) return posts;

    return posts.map(post => {
      let score = 0;

      // 1. Recency score (newer posts get higher score)
      const postTime = post.createdAt?.toDate?.() || new Date(post.createdAt);
      const now = new Date();
      const hoursDiff = Math.max(0, (now - postTime) / (1000 * 60 * 60));
      const recencyScore = Math.max(0, 1 - (hoursDiff / 72)); // Decay over 72 hours
      score += recencyScore * FEED_ALGORITHM_WEIGHTS.RECENCY;

      // 2. Engagement score (likes, comments, shares)
      const likes = Array.isArray(post.likes) ? post.likes.length : 0;
      const comments = Array.isArray(post.commentCount) ? post.commentCount.length : 0;
      const engagementScore = Math.min(1, (likes * 0.6 + comments * 0.4) / 50); // Normalize to 0-1
      score += engagementScore * FEED_ALGORITHM_WEIGHTS.ENGAGEMENT;

      // 3. Relationship score
      let relationshipScore = RELATIONSHIP_SCORES.STRANGER;
      if (post.uid === currentUserId) {
        relationshipScore = 1.0; // User's own posts
      } else if (followingList.includes(post.uid) && followersList.includes(post.uid)) {
        relationshipScore = RELATIONSHIP_SCORES.MUTUAL_FOLLOWERS;
      } else if (followingList.includes(post.uid)) {
        relationshipScore = RELATIONSHIP_SCORES.FOLLOWING;
      } else if (followersList.includes(post.uid)) {
        relationshipScore = RELATIONSHIP_SCORES.FOLLOWED_BY;
      }
      score += relationshipScore * FEED_ALGORITHM_WEIGHTS.RELATIONSHIP;

      // 4. Content type score (prioritize visual content)
      const contentTypeScore = post.image ? 1.0 : 0.3;
      score += contentTypeScore * FEED_ALGORITHM_WEIGHTS.CONTENT_TYPE;

      return {
        ...post,
        _rankingScore: score,
        _relationshipType: relationshipScore === 1.0 ? 'own' : 
                          relationshipScore === RELATIONSHIP_SCORES.MUTUAL_FOLLOWERS ? 'mutual' :
                          relationshipScore === RELATIONSHIP_SCORES.FOLLOWING ? 'following' :
                          relationshipScore === RELATIONSHIP_SCORES.FOLLOWED_BY ? 'follower' : 'suggested'
      };
    }).sort((a, b) => b._rankingScore - a._rankingScore); // Sort by score descending
  };

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

  const fetchPosts = async () => {
    try {
      const postRef = collection(db, 'posts');
      const q = query(postRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const allPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Fetch author names for all posts
      const authorIds = [...new Set(allPosts.map(post => post.uid).filter(Boolean))];
      await Promise.all(authorIds.map(fetchUserData));
      
      setPosts(allPosts);
      
      // Rank posts using the algorithm
      const currentUserId = auth.currentUser?.uid;
      const ranked = rankPosts(allPosts, currentUserId);
      setRankedPosts(ranked);
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchComments = async (postId) => {
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

  useEffect(() => {
    fetchUserRelationships();
    fetchPosts();
  }, []);

  useEffect(() => {
    // Re-rank posts when relationships change
    if (posts.length > 0) {
      const currentUserId = auth.currentUser?.uid;
      const ranked = rankPosts(posts, currentUserId);
      setRankedPosts(ranked);
    }
  }, [followingList, followersList, posts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserRelationships();
    fetchPosts();
  };

  const handleLike = async (postId, likes = []) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'Please log in to like posts');
      return;
    }

    try {
      const postRef = doc(db, 'posts', postId);
      const likesArray = Array.isArray(likes) ? likes : [];
      const isLiked = likesArray.includes(userId);

      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
      });

      // Update local state and re-rank
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id === postId) {
            const currentLikes = Array.isArray(post.likes) ? post.likes : [];
            const updatedLikes = isLiked
              ? currentLikes.filter((id) => id !== userId)
              : [...currentLikes, userId];
            return { ...post, likes: updatedLikes };
          }
          return post;
        })
      );
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const fetchUserNames = async (userIds) => {
    setLoadingUserNames(true);
    try {
      await Promise.all(userIds.map(fetchUserData));
    } catch (error) {
      console.error('Error fetching user names:', error);
    } finally {
      setLoadingUserNames(false);
    }
  };

  const showLikes = async (likes) => {
    const likesArray = Array.isArray(likes) ? likes : [];
    setCurrentLikes(likesArray);
    setLikeModalVisible(true);
    
    if (likesArray.length > 0) {
      await fetchUserNames(likesArray);
    }
  };

  const showCommentModal = async (postId) => {
    setCurrentPostId(postId);
    setCommentModalVisible(true);
    await fetchComments(postId);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'Please log in to comment');
      return;
    }

    setSubmittingComment(true);

    try {
      await addDoc(collection(db, 'posts', currentPostId, 'comments'), {
        text: commentText.trim(),
        userId: userId,
        createdAt: serverTimestamp(),
        replies: [],
      });

      // Update comment count and re-rank
      const postRef = doc(db, 'posts', currentPostId);
      await updateDoc(postRef, {
        commentCount: arrayUnion(userId),
      });

      setCommentText('');
      
      // Refresh and re-rank
      await fetchComments(currentPostId);
      await fetchPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (commentId) => {
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please enter a reply');
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'Please log in to reply');
      return;
    }

    setSubmittingReply(true);

    try {
      const commentRef = doc(db, 'posts', currentPostId, 'comments', commentId);
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
      
      await fetchComments(currentPostId);
    } catch (error) {
      console.error('Error adding reply:', error);
      Alert.alert('Error', 'Failed to add reply');
    } finally {
      setSubmittingReply(false);
    }
  };

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

  const renderPost = ({ item }) => {
    const likesArray = Array.isArray(item.likes) ? item.likes : [];
    const commentArray = Array.isArray(item.commentCount) ? item.commentCount : [];
    const likesCount = likesArray.length;
    const commentCount = commentArray.length;
    const isLiked = likesArray.includes(auth.currentUser?.uid);
    const authorName = userNames[item.uid] || 'Unknown User';

    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <UserAvatar userId={item.uid} />
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
              {item._relationshipType && (
                <Text style={styles.relationshipBadge}>
                  {item._relationshipType === 'own' ? 'Your post' :
                   item._relationshipType === 'mutual' ? 'Mutual friends' :
                   item._relationshipType === 'following' ? 'Following' :
                   item._relationshipType === 'follower' ? 'Follows you' : 'Suggested for you'}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#83C5BE" />
          </TouchableOpacity>
        </View>

        <View style={styles.postContent}>
          <Text style={styles.postTitle}>{item.title}</Text>
          <Text style={styles.postDescription}>{item.description}</Text>
          
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.postImage} />
          )}
        </View>

        {(likesCount > 0 || commentCount > 0) && (
          <View style={styles.engagementStats}>
            <TouchableOpacity onPress={() => showLikes(likesArray)}>
              <Text style={styles.statsText}>
                {likesCount > 0 && `${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showCommentModal(item.id)}>
              <Text style={styles.statsText}>
                {commentCount > 0 && `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionBar}>
          <TouchableOpacity 
            style={[styles.actionButton, isLiked && styles.likedButton]}
            onPress={() => handleLike(item.id, likesArray)}
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
            onPress={() => showCommentModal(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#83C5BE" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push(`/post/${item.id}`)}
          >
            <Ionicons name="eye-outline" size={20} color="#83C5BE" />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color="#83C5BE" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={24} color="#006D77" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="chatbubble-outline" size={24} color="#006D77" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#006D77" />
          <Text style={styles.loadingText}>Loading your personalized feed...</Text>
        </View>
      ) : (
        <FlatList
          data={rankedPosts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#006D77']}
              tintColor="#006D77"
            />
          }
          contentContainerStyle={styles.feedContainer}
          ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
        />
      )}

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
              <View style={styles.commentSection}>
                <UserAvatar userId={auth.currentUser?.uid || ''} size={32} />
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

      <BottomNavigation onTabPress={(idx) => {
        switch(idx) {
          case 0:
            break;
          case 1:
            router.push('/search');
            break;
          case 2:
            router.push('/create-post');
            break;
          case 3:
            router.push('/reels');
            break;
          case 4:
            router.push('/profile');
            break;
        }
      }} />
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6F9',
  },
  bottomNavContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDF6F9',
    paddingBottom: 20, // Increased padding for bigger navbar
    paddingTop: 10,    // Added top padding for height
  },
  slideIndicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18, // Increased vertical padding for bigger touch area
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#EEF2FF',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14, // Slightly larger font
    fontWeight: '600',
    color: '#6366F1',
    marginTop: 6, // More space between icon and label
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF6F9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#006D77',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 15,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDF6F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 16,
  },
  feedContainer: {
    paddingTop: 10,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    paddingVertical: 15,
  },
  postSeparator: {
    height: 8,
    backgroundColor: '#EDF6F9',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    backgroundColor: '#006D77',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  authorDetails: {
    flex: 1,
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
    padding: 5,
  },
  moreIcon: {
    fontSize: 20,
    color: '#83C5BE',
  },
  postContent: {
    paddingHorizontal: 20,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#006D77',
    marginBottom: 8,
  },
  postDescription: {
    fontSize: 15,
    color: '#4F4F4F',
    lineHeight: 22,
    marginBottom: 15,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
  },
  engagementStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF6F9',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF6F9',
  },
  statsText: {
    fontSize: 13,
    color: '#83C5BE',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#EDF6F9',
  },
  likedButton: {
    backgroundColor: '#006D77',
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  likedIcon: {
    fontSize: 16,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#006D77',
  },
  likedText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#83C5BE',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#83C5BE',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF6F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#006D77',
  },
  modalClose: {
    fontSize: 20,
    color: '#83C5BE',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flex: 1,
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalLoadingText: {
    marginTop: 10,
    color: '#83C5BE',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF6F9',
  },
  userName: {
    flex: 1,
    fontSize: 16,
    color: '#006D77',
    fontWeight: '500',
  },
  userChevron: {
    fontSize: 18,
    color: '#83C5BE',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#006D77',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#83C5BE',
    textAlign: 'center',
  },
  commentSection: {
    flexDirection: 'row',
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  commentInputWrapper: {
    flex: 1,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#EDF6F9',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#4F4F4F',
    backgroundColor: '#EDF6F9',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF6F9',
  },
  commentCounter: {
    fontSize: 12,
    color: '#83C5BE',
  },
  commentButton: {
    backgroundColor: '#006D77',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  commentButtonDisabled: {
    backgroundColor: '#83C5BE',
    opacity: 0.5,
  },
  commentButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  commentsListContainer: {
    flex: 1,
    marginTop: 20,
  },
  commentsList: {
    flex: 1,
  },
  commentContainer: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F7',
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
    fontSize: 11,
    color: '#83C5BE',
    marginTop: 2,
  },
  commentText: {
    fontSize: 15,
    color: '#4F4F4F',
    lineHeight: 20,
    marginBottom: 8,
    marginLeft: 40,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40,
  },
  replyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#EDF6F9',
    marginRight: 12,
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
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 40,
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#EDF6F9',
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
  replyTime: {
    fontSize: 10,
    color: '#83C5BE',
  },
  replyText: {
    fontSize: 14,
    color: '#4F4F4F',
    lineHeight: 18,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: 40,
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#006D77',
  },
  replyInputWrapper: {
    flex: 1,
    marginLeft: 8,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#EDF6F9',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#4F4F4F',
    backgroundColor: '#F7F7F7',
    minHeight: 36,
    textAlignVertical: 'top',
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
    borderRadius: 15,
    minWidth: 50,
    alignItems: 'center',
  },
  replySubmitButtonDisabled: {
    backgroundColor: '#83C5BE',
    opacity: 0.5,
  },
  replySubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  storiesSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 8,
    borderBottomColor: '#EDF6F9',
  },
  storiesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#006D77',
    marginBottom: 15,
  },
  storiesContainer: {
    paddingVertical: 5,
  },
  storiesLoading: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noStories: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noStoriesText: {
    fontSize: 14,
    color: '#83C5BE',
    fontStyle: 'italic',
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 15,
    width: 70,
  },
  storyUserName: {
    fontSize: 12,
    color: '#006D77',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
    width: 70,
  },
  storyAvatarContainer: {
    backgroundColor: '#EDF6F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#83C5BE',
  },
  storyAvatarUnseen: {
    borderColor: '#006D77',
    borderWidth: 3,
  },
  storyAvatarImage: {
    resizeMode: 'cover',
  },
  storyAvatarText: {
    color: '#006D77',
    fontWeight: 'bold',
    position: 'relative',
  },
  storyProgressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 10,
    gap: 4,
  },
  storyProgressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  storyProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  storyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  storyClose: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  storyContent: {
    flex: 1,
    position: 'relative',
  },
  storyTouchLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 1,
  },
  storyTouchRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 1,
  },
  storyMediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  storyImage: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
  storyText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    margin: 20,
  },
});