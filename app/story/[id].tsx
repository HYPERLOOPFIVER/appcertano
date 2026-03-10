import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Animated,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  updateDoc, 
  arrayUnion,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { notifyStoryView } from '../../utils/notifications';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const COLORS = {
  primary: '#F50057',
  secondary: '#6366F1',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#1F2937',
};

export default function StoryViewer() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);
  const currentUserId = auth.currentUser?.uid;

  const STORY_DURATION = 5000;

  useEffect(() => {
    if (id) {
      fetchUserAndStories(id as string);
    }
    return () => {
      if (progressAnimation.current) {
        progressAnimation.current.stop();
      }
    };
  }, [id]);

  useEffect(() => {
    if (stories.length > 0 && !loading && !paused) {
      startProgressAnimation();
      markStoryAsViewed();
    }
  }, [currentIndex, loading, paused]);

  const fetchUserAndStories = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUser({ id: userDoc.id, ...userDoc.data() });
      }

      const storiesRef = collection(db, 'users', userId, 'stories');
      const q = query(storiesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      
      const now = new Date();
      const activeStories = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(story => {
          const createdAt = story.createdAt?.toDate?.() || new Date(story.createdAt);
          return (now.getTime() - createdAt.getTime()) < 24 * 60 * 60 * 1000;
        });
      
      setStories(activeStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const startProgressAnimation = () => {
    progress.setValue(0);
    
    progressAnimation.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    progressAnimation.current.start(({ finished }) => {
      if (finished && !paused) {
        goToNextStory();
      }
    });
  };

  const pauseProgress = () => {
    setPaused(true);
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
  };

  const resumeProgress = () => {
    setPaused(false);
  };

  const markStoryAsViewed = async () => {
    if (!currentUserId || !stories[currentIndex] || id === currentUserId) return;
    
    try {
      const storyRef = doc(db, 'users', id as string, 'stories', stories[currentIndex].id);
      const storyDoc = await getDoc(storyRef);
      
      if (storyDoc.exists()) {
        const viewers = storyDoc.data().viewers || [];
        if (!viewers.includes(currentUserId)) {
          await updateDoc(storyRef, {
            viewers: arrayUnion(currentUserId),
          });
          
          // Notify story owner (only once per story)
          await notifyStoryView(id as string, currentUserId);
        }
      }
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  const goToNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const goToPrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handlePress = (event) => {
    const { locationX } = event.nativeEvent;
    
    if (locationX < screenWidth / 3) {
      goToPrevStory();
    } else if (locationX > (screenWidth * 2) / 3) {
      goToNextStory();
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || sendingReply || !currentUserId) return;
    
    setSendingReply(true);
    try {
      // Create a chat if doesn't exist and send message
      const chatId = [currentUserId, id].sort().join('_');
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: `Replied to your story: "${replyText.trim()}"`,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Sent! 💬', 'Your reply has been sent');
      setReplyText('');
      setShowReplyInput(false);
      resumeProgress();
    } catch (error) {
      console.error('Error sending reply:', error);
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const diff = (Date.now() - date.getTime()) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading stories...</Text>
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color={COLORS.white} />
          <Text style={styles.emptyText}>No active stories</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStory = stories[currentIndex];

  return (
    <View style={styles.container}>
      {/* Story Image */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.storyContainer}
        onPress={handlePress}
        onLongPress={pauseProgress}
        onPressOut={resumeProgress}
      >
        <Image
          source={{ uri: currentStory.imageUrl || currentStory.image }}
          style={styles.storyImage}
          resizeMode="cover"
        />
        
        <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.topGradient} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.bottomGradient} />
      </TouchableOpacity>

      {/* Progress Bars */}
      <SafeAreaView style={styles.progressContainer}>
        <View style={styles.progressBars}>
          {stories.map((_, index) => (
            <View key={index} style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width:
                      index < currentIndex
                        ? '100%'
                        : index === currentIndex
                        ? progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => {
              router.back();
              setTimeout(() => router.push(`/profile/${id}`), 100);
            }}
          >
            {user?.profilePic ? (
              <Image source={{ uri: user.profilePic }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.userTextContainer}>
              <Text style={styles.username}>{user?.name || 'User'}</Text>
              <Text style={styles.timeText}>{formatTime(currentStory.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            {id === currentUserId && currentStory.viewers?.length > 0 && (
              <View style={styles.viewCount}>
                <Ionicons name="eye" size={16} color={COLORS.white} />
                <Text style={styles.viewCountText}>{currentStory.viewers.length}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Story Text */}
      {currentStory.text && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.storyTextContainer}
        >
          <Text style={styles.storyText}>{currentStory.text}</Text>
        </MotiView>
      )}

      {/* Bottom Actions */}
      <SafeAreaView style={styles.bottomContainer}>
        {showReplyInput ? (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.replyInputContainer}
          >
            <TextInput
              style={styles.replyInput}
              placeholder="Send a message..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={replyText}
              onChangeText={setReplyText}
              autoFocus
              onBlur={() => {
                if (!replyText.trim()) {
                  setShowReplyInput(false);
                  resumeProgress();
                }
              }}
            />
            <TouchableOpacity 
              style={styles.sendButton}
              onPress={handleSendReply}
              disabled={sendingReply || !replyText.trim()}
            >
              {sendingReply ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="send" size={22} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </MotiView>
        ) : (
          <View style={styles.replyContainer}>
            <TouchableOpacity 
              style={styles.replyPlaceholder}
              onPress={() => {
                pauseProgress();
                setShowReplyInput(true);
              }}
            >
              <Text style={styles.replyPlaceholderText}>Send message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart-outline" size={28} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="paper-plane-outline" size={28} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.black,
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.white,
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  closeBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  closeBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  storyContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressBars: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userTextContainer: {
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  timeText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  viewCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewCountText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  storyTextContainer: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    borderRadius: 16,
  },
  storyText: {
    color: COLORS.white,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  replyPlaceholder: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  replyPlaceholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  actionButton: {
    padding: 8,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  replyInput: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 15,
    color: COLORS.white,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
