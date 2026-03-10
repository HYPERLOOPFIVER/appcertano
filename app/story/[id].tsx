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
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../../firebase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const COLORS = {
  primary: '#006D77',
  white: '#FFFFFF',
  black: '#000000',
};

export default function StoryViewer() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);
  const currentUserId = auth.currentUser?.uid;

  const STORY_DURATION = 5000; // 5 seconds per story

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
    if (stories.length > 0 && !loading) {
      startProgressAnimation();
      markStoryAsViewed();
    }
  }, [currentIndex, loading]);

  const fetchUserAndStories = async (userId: string) => {
    try {
      // Fetch user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUser({ id: userDoc.id, ...userDoc.data() });
      }

      // Fetch user's stories
      const storiesRef = collection(db, 'users', userId, 'stories');
      const q = query(storiesRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      
      const now = new Date();
      const activeStories = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(story => {
          const createdAt = story.createdAt?.toDate ? story.createdAt.toDate() : new Date(story.createdAt);
          const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24; // Only show stories less than 24 hours old
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
      if (finished) {
        goToNextStory();
      }
    });
  };

  const markStoryAsViewed = async () => {
    if (!currentUserId || !stories[currentIndex]) return;
    
    try {
      const storyRef = doc(db, 'users', id as string, 'stories', stories[currentIndex].id);
      await updateDoc(storyRef, {
        viewers: arrayUnion(currentUserId),
      });
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

  const handleLongPress = () => {
    setPaused(true);
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
  };

  const handlePressOut = () => {
    if (paused) {
      setPaused(false);
      startProgressAnimation();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    return `${Math.floor(diffInMinutes / 60)}h ago`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
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
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
      >
        <Image
          source={{ uri: currentStory.imageUrl || currentStory.image }}
          style={styles.storyImage}
          resizeMode="cover"
        />
        
        {/* Gradient Overlay */}
        <View style={styles.topGradient} />
        <View style={styles.bottomGradient} />
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
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userTextContainer}>
              <Text style={styles.username}>{user?.name || 'User'}</Text>
              <Text style={styles.timeText}>{formatTime(currentStory.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Story Text */}
      {currentStory.text && (
        <View style={styles.storyTextContainer}>
          <Text style={styles.storyText}>{currentStory.text}</Text>
        </View>
      )}

      {/* Bottom Actions */}
      <SafeAreaView style={styles.bottomContainer}>
        <View style={styles.replyContainer}>
          <TouchableOpacity style={styles.replyInput}>
            <Text style={styles.replyPlaceholder}>Send message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 24,
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
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userTextContainer: {
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  storyTextContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    borderRadius: 12,
  },
  storyText: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
    paddingVertical: 16,
    gap: 12,
  },
  replyInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 22,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  replyPlaceholder: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  actionButton: {
    padding: 8,
  },
});
