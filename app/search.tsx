import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc,
  getDoc,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { notifyFollow } from '../utils/notifications';

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 3;

const COLORS = {
  primary: '#F50057',
  secondary: '#6366F1',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  white: '#FFFFFF',
  success: '#10B981',
};

export default function Search() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedItems, setFeedItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingStatus, setFollowingStatus] = useState({});
  const [followLoading, setFollowLoading] = useState({});
  
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers([]);
      return;
    }

    const searchLower = searchQuery.toLowerCase();
    const filtered = users.filter((user) =>
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const fetchData = async () => {
    try {
      const [postsSnap, reelsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(collection(db, 'reels'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(collection(db, 'users')),
      ]);

      const postData = postsSnap.docs.map((doc) => ({ id: doc.id, type: 'post', ...doc.data() }));
      const reelsData = reelsSnap.docs.map((doc) => ({ id: doc.id, type: 'reel', ...doc.data() }));
      const userData = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Mix posts and reels
      const mixedData = [...postData, ...reelsData].sort(
        (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
      );

      setFeedItems(mixedData);
      setUsers(userData);
      
      // Get suggested users (users not followed by current user)
      if (currentUserId) {
        await fetchSuggestedUsers(userData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSuggestedUsers = async (allUsers) => {
    try {
      // Get current user's following list
      const followingRef = collection(db, 'users', currentUserId, 'following');
      const followingSnap = await getDocs(followingRef);
      const followingIds = new Set(followingSnap.docs.map(doc => doc.id));
      
      // Update following status
      const status = {};
      followingSnap.docs.forEach(doc => {
        status[doc.id] = true;
      });
      setFollowingStatus(status);

      // Filter out current user and users already followed
      const suggestions = allUsers
        .filter(user => user.id !== currentUserId && !followingIds.has(user.id))
        .slice(0, 10);
      
      setSuggestedUsers(suggestions);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    }
  };

  const handleFollow = async (userId) => {
    if (!currentUserId || followLoading[userId]) return;
    
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    
    try {
      const isFollowing = followingStatus[userId];
      
      if (isFollowing) {
        // Unfollow
        await deleteDoc(doc(db, 'users', userId, 'followers', currentUserId));
        await deleteDoc(doc(db, 'users', currentUserId, 'following', userId));
        setFollowingStatus(prev => ({ ...prev, [userId]: false }));
      } else {
        // Follow
        await setDoc(doc(db, 'users', userId, 'followers', currentUserId), {
          followedAt: new Date()
        });
        await setDoc(doc(db, 'users', currentUserId, 'following', userId), {
          followedAt: new Date()
        });
        setFollowingStatus(prev => ({ ...prev, [userId]: true }));
        
        // Send notification
        await notifyFollow(userId, currentUserId);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // Suggested User Card
  const SuggestedUserCard = ({ item, index }) => {
    const isFollowing = followingStatus[item.id];
    const isLoading = followLoading[item.id];
    
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 80 }}
        style={styles.suggestionCard}
      >
        <TouchableOpacity 
          onPress={() => router.push(`/profile/${item.id}`)}
          style={styles.suggestionProfile}
        >
          {item.profilePic ? (
            <Image source={{ uri: item.profilePic }} style={styles.suggestionAvatar} />
          ) : (
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.suggestionAvatarPlaceholder}>
              <Text style={styles.suggestionAvatarText}>{(item.name || 'U')[0].toUpperCase()}</Text>
            </LinearGradient>
          )}
          <Text style={styles.suggestionName} numberOfLines={1}>{item.name || 'User'}</Text>
          <Text style={styles.suggestionBio} numberOfLines={2}>{item.bio || 'New to Certano'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => handleFollow(item.id)}
          disabled={isLoading}
          testID={`follow-btn-${item.id}`}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? COLORS.secondary : COLORS.white} />
          ) : (
            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Grid Item
  const GridItem = ({ item, index }) => (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 30 }}
    >
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/${item.type}/${item.id}`)}
        testID={`grid-item-${item.id}`}
      >
        <Image source={{ uri: item.image || item.videoUrl }} style={styles.gridImage} />
        {item.type === 'reel' && (
          <View style={styles.reelIndicator}>
            <Ionicons name="play" size={16} color={COLORS.white} />
          </View>
        )}
        <View style={styles.gridOverlay}>
          <View style={styles.gridStat}>
            <Ionicons name="heart" size={14} color={COLORS.white} />
            <Text style={styles.gridStatText}>{item.likes?.length || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
  );

  // User Search Result
  const UserSearchResult = ({ item, index }) => (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 60 }}
    >
      <TouchableOpacity
        style={styles.userResult}
        onPress={() => router.push(`/profile/${item.id}`)}
        testID={`user-result-${item.id}`}
      >
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.userAvatar} />
        ) : (
          <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.userAvatarPlaceholder}>
            <Text style={styles.userAvatarText}>{(item.name || 'U')[0].toUpperCase()}</Text>
          </LinearGradient>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || 'User'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Discover</Text>
      </MotiView>

      {/* Search Bar */}
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 100 }}
        style={styles.searchContainer}
      >
        <Ionicons name="search" size={20} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={COLORS.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </MotiView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : searchQuery.trim() ? (
        // Search Results
        <FlatList
          data={filteredUsers}
          renderItem={({ item, index }) => <UserSearchResult item={item} index={index} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
        />
      ) : (
        // Explore View
        <FlatList
          data={feedItems}
          renderItem={({ item, index }) => <GridItem item={item} index={index} />}
          keyExtractor={(item) => item.id}
          numColumns={3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListHeaderComponent={
            <>
              {/* Follow Suggestions */}
              {suggestedUsers.length > 0 && (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={styles.suggestionsSection}
                >
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Suggested for you</Text>
                    <TouchableOpacity onPress={() => router.push('/profiles')}>
                      <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={suggestedUsers}
                    renderItem={({ item, index }) => <SuggestedUserCard item={item} index={index} />}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestionsScroll}
                  />
                </MotiView>
              )}
              
              {/* Explore Header */}
              <View style={styles.exploreHeader}>
                <Text style={styles.exploreTitle}>Explore</Text>
              </View>
            </>
          }
          contentContainerStyle={styles.gridContent}
        />
      )}

      {/* Bottom Navigation */}
      <MotiView
        from={{ translateY: 100 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 15, delay: 500 }}
        style={styles.bottomNav}
      >
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')} testID="nav-home">
          <Ionicons name="home-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} testID="nav-search">
          <Ionicons name="search" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemCenter} onPress={() => router.push('/create-post')} testID="nav-create">
          <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.createBtn}>
            <Ionicons name="add" size={28} color={COLORS.white} />
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/reels')} testID="nav-reels">
          <Ionicons name="play-circle-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')} testID="nav-profile">
          <Ionicons name="person-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </MotiView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gridContent: {
    paddingBottom: 100,
  },
  suggestionsSection: {
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  suggestionsScroll: {
    paddingHorizontal: 12,
    gap: 12,
  },
  suggestionCard: {
    width: 160,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  suggestionProfile: {
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 12,
  },
  suggestionAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  suggestionBio: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  followBtn: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  followBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  followingBtnText: {
    color: COLORS.secondary,
  },
  exploreHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exploreTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gridItem: {
    width: imageSize,
    height: imageSize,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  reelIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 8,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridStatText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  userResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textTertiary,
    marginTop: 16,
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
});
