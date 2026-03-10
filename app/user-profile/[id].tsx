import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons, Feather, AntDesign, Entypo } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#006D77',
  primaryLight: '#83C5BE',
  background: '#EDF6F9',
  surface: '#FFFFFF',
  text: '#2A9D8F',
  textPrimary: '#006D77',
  textSecondary: '#83C5BE',
  textMuted: '#B0C4C7',
  border: '#FFDDD2',
  white: '#FFFFFF',
  light: '#F8FDFF',
};

export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (id) {
      fetchUserData(id as string);
      fetchUserPosts(id as string);
      fetchFollowersAndFollowing(id as string);
      checkIfFollowing(id as string);
    }
  }, [id]);

  const fetchUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUserData({
          id: userDoc.id,
          ...userDoc.data()
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef, 
        where('uid', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserPosts(posts);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };

  const fetchFollowersAndFollowing = async (userId: string) => {
    try {
      const followersRef = collection(db, 'users', userId, 'followers');
      const followersSnapshot = await getDocs(followersRef);
      setFollowers(followersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const followingRef = collection(db, 'users', userId, 'following');
      const followingSnapshot = await getDocs(followingRef);
      setFollowing(followingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching followers/following:", error);
    }
  };

  const checkIfFollowing = async (userId: string) => {
    if (!currentUserId) return;
    try {
      const followDoc = await getDoc(doc(db, 'users', userId, 'followers', currentUserId));
      setIsFollowing(followDoc.exists());
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || !id) return;
    
    setFollowLoading(true);
    try {
      const targetUserId = id as string;
      
      if (isFollowing) {
        // Unfollow
        await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId));
        await deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f.id !== currentUserId));
      } else {
        // Follow
        await setDoc(doc(db, 'users', targetUserId, 'followers', currentUserId), {
          followedAt: new Date()
        });
        await setDoc(doc(db, 'users', currentUserId, 'following', targetUserId), {
          followedAt: new Date()
        });
        setIsFollowing(true);
        setFollowers(prev => [...prev, { id: currentUserId }]);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = () => {
    router.push(`/chat/${id}`);
  };

  const renderPostItem = ({ item, index }) => {
    const imageSize = (width - 48) / 3;
    
    return (
      <TouchableOpacity 
        style={[styles.postItem, { width: imageSize, height: imageSize }]}
        onPress={() => router.push(`/post/${item.id}`)}
      >
        <Image 
          source={{ uri: item.image || 'https://picsum.photos/300/300?random=' + index }} 
          style={styles.postImage} 
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userData.name || 'Profile'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: userData.coverImage || 'https://picsum.photos/800/300' }} 
            style={styles.coverImage} 
          />
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {userData.profilePic ? (
              <Image source={{ uri: userData.profilePic }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {(userData.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{userData.name || 'User'}</Text>
            <Text style={styles.username}>@{userData.username || userData.email?.split('@')[0]}</Text>
            
            {userData.bio && <Text style={styles.bio}>{userData.bio}</Text>}

            <View style={styles.profileMeta}>
              {userData.location && (
                <View style={styles.metaItem}>
                  <Entypo name="location-pin" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{userData.location}</Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userPosts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followers.length}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{following.length}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

            {/* Action Buttons */}
            {currentUserId !== id && (
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.followButton, isFollowing && styles.followingButton]}
                  onPress={handleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={isFollowing ? COLORS.primary : COLORS.white} />
                  ) : (
                    <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
                  <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Posts</Text>
          {userPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="grid" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
            </View>
          ) : (
            <FlatList
              data={userPosts}
              renderItem={renderPostItem}
              keyExtractor={item => item.id}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.postsGrid}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  coverContainer: {
    height: 150,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileSection: {
    backgroundColor: COLORS.surface,
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.surface,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.surface,
  },
  profileImageText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  username: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  profileMeta: {
    alignItems: 'center',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  followButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  followButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  followingButtonText: {
    color: COLORS.primary,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 8,
  },
  messageButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  postsSection: {
    padding: 16,
    backgroundColor: COLORS.surface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  postsGrid: {
    gap: 4,
  },
  postItem: {
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.light,
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
});
