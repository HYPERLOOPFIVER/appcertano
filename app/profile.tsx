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
  TextInput,
  Modal,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

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
};

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
const UPLOAD_PRESET = 'Prepop';

export default function Profile() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    website: '',
    location: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
        fetchUserData(authUser.uid);
        fetchUserPosts(authUser.uid);
        fetchFollowersAndFollowing(authUser.uid);
      } else {
        router.replace('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchUserData = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = { id: userDoc.id, ...userDoc.data() };
        setUserData(data);
        setEditForm({
          displayName: data.displayName || data.name || '',
          bio: data.bio || '',
          website: data.website || '',
          location: data.location || ''
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchUserPosts = async (userId) => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, where('uid', '==', userId), orderBy('createdAt', 'desc'));
      
      onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserPosts(posts);
      });
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };

  const fetchFollowersAndFollowing = async (userId) => {
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

  const handleImagePicker = async (type = 'profile') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        uploadImage(result.assets[0].uri, type);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const uploadImage = async (uri, type) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', { uri, type: 'image/jpeg', name: `${type}_${user.uid}.jpg` } as any);
      formData.append('upload_preset', UPLOAD_PRESET);

      const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error?.message || 'Upload failed');

      const updateField = type === 'profile' ? 'profilePic' : 'coverImage';
      await updateDoc(doc(db, 'users', user.uid), { [updateField]: data.secure_url });
      setUserData(prev => ({ ...prev, [updateField]: data.secure_url }));
      
      Alert.alert('Success! ✨', `${type === 'profile' ? 'Profile' : 'Cover'} photo updated!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setUploading(true);
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editForm.displayName,
        name: editForm.displayName,
        bio: editForm.bio,
        website: editForm.website,
        location: editForm.location,
        updatedAt: new Date()
      });
      setUserData(prev => ({ ...prev, ...editForm, name: editForm.displayName }));
      setEditModalVisible(false);
      Alert.alert('Updated! ✨', 'Your profile has been saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/login');
        }
      }
    ]);
  };

  const StatItem = ({ label, value, delay }) => (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay }}
      style={styles.statItem}
    >
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </MotiView>
  );

  const renderPostItem = ({ item, index }) => {
    const size = (width - 48) / 3;
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 50 }}
      >
        <TouchableOpacity 
          style={[styles.postItem, { width: size, height: size }]}
          onPress={() => router.push(`/post/${item.id}`)}
          testID={`post-${item.id}`}
        >
          <Image source={{ uri: item.image }} style={styles.postImage} />
          <View style={styles.postOverlay}>
            <View style={styles.postStat}>
              <Ionicons name="heart" size={14} color={COLORS.white} />
              <Text style={styles.postStatText}>{item.likes?.length || 0}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Edit Profile Modal
  const EditModal = () => (
    <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setEditModalVisible(false)} testID="close-edit-modal">
            <Ionicons name="close" size={28} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSaveProfile} disabled={uploading} testID="save-profile-btn">
            <Text style={[styles.saveText, uploading && { opacity: 0.5 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Profile Picture */}
          <MotiView
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={styles.editAvatarSection}
          >
            <TouchableOpacity onPress={() => handleImagePicker('profile')} testID="edit-profile-pic">
              {userData?.profilePic ? (
                <Image source={{ uri: userData.profilePic }} style={styles.editAvatar} />
              ) : (
                <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.editAvatarPlaceholder}>
                  <Text style={styles.editAvatarText}>{(userData?.name || 'U')[0].toUpperCase()}</Text>
                </LinearGradient>
              )}
              <View style={styles.editAvatarOverlay}>
                <Ionicons name="camera" size={20} color={COLORS.white} />
              </View>
            </TouchableOpacity>
            <Text style={styles.editAvatarLabel}>Change Photo</Text>
          </MotiView>

          {/* Form Fields */}
          {[
            { label: 'Name', value: editForm.displayName, key: 'displayName', icon: 'person-outline' },
            { label: 'Bio', value: editForm.bio, key: 'bio', icon: 'document-text-outline', multiline: true },
            { label: 'Website', value: editForm.website, key: 'website', icon: 'link-outline' },
            { label: 'Location', value: editForm.location, key: 'location', icon: 'location-outline' },
          ].map((field, index) => (
            <MotiView
              key={field.key}
              from={{ opacity: 0, translateX: -20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ delay: 200 + index * 100 }}
              style={styles.formField}
            >
              <Text style={styles.formLabel}>{field.label}</Text>
              <View style={styles.formInputContainer}>
                <Ionicons name={field.icon} size={20} color={COLORS.textTertiary} />
                <TextInput
                  style={[styles.formInput, field.multiline && styles.formInputMultiline]}
                  value={field.value}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, [field.key]: text }))}
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  placeholderTextColor={COLORS.textTertiary}
                  multiline={field.multiline}
                  testID={`edit-${field.key}-input`}
                />
              </View>
            </MotiView>
          ))}
        </ScrollView>

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.uploadingText}>Saving...</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );

  // Settings Modal
  const SettingsModal = () => (
    <Modal visible={settingsModalVisible} animationType="slide" transparent>
      <TouchableOpacity 
        style={styles.settingsOverlay} 
        activeOpacity={1} 
        onPress={() => setSettingsModalVisible(false)}
      >
        <MotiView
          from={{ translateY: 300 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.settingsSheet}
        >
          <View style={styles.settingsHandle} />
          
          {[
            { icon: 'settings-outline', label: 'Settings', color: COLORS.textPrimary },
            { icon: 'bookmark-outline', label: 'Saved Posts', color: COLORS.textPrimary },
            { icon: 'time-outline', label: 'Activity', color: COLORS.textPrimary },
            { icon: 'qr-code-outline', label: 'QR Code', color: COLORS.textPrimary },
            { icon: 'log-out-outline', label: 'Sign Out', color: COLORS.error, onPress: handleSignOut },
          ].map((item, index) => (
            <MotiView
              key={item.label}
              from={{ opacity: 0, translateX: -20 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ delay: index * 50 }}
            >
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={item.onPress || (() => {})}
                testID={`settings-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Ionicons name={item.icon} size={24} color={item.color} />
                <Text style={[styles.settingsItemText, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            </MotiView>
          ))}
        </MotiView>
      </TouchableOpacity>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Please sign in</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userData.name || 'Profile'}</Text>
        <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={styles.headerBtn} testID="settings-btn">
          <Ionicons name="menu-outline" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </MotiView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <TouchableOpacity onPress={() => handleImagePicker('cover')} testID="edit-cover-btn">
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.coverContainer}
          >
            <Image 
              source={{ uri: userData.coverImage || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800' }} 
              style={styles.coverImage} 
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              style={styles.coverGradient}
            />
            <View style={styles.coverEditIcon}>
              <Ionicons name="camera" size={16} color={COLORS.white} />
            </View>
          </MotiView>
        </TouchableOpacity>

        {/* Profile Info Card */}
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}
          style={styles.profileCard}
        >
          {/* Avatar */}
          <TouchableOpacity onPress={() => handleImagePicker('profile')} style={styles.avatarContainer} testID="edit-avatar-btn">
            {userData.profilePic ? (
              <Image source={{ uri: userData.profilePic }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{(userData.name || 'U')[0].toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.avatarEditIcon}>
              <Ionicons name="camera" size={14} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          {/* Name & Bio */}
          <MotiText
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 300 }}
            style={styles.displayName}
          >
            {userData.name || 'User'}
          </MotiText>
          
          <Text style={styles.username}>@{userData.username || user.email?.split('@')[0]}</Text>
          
          {userData.bio && <Text style={styles.bio}>{userData.bio}</Text>}

          {/* Meta Info */}
          {(userData.location || userData.website) && (
            <View style={styles.metaContainer}>
              {userData.location && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{userData.location}</Text>
                </View>
              )}
              {userData.website && (
                <View style={styles.metaItem}>
                  <Ionicons name="link-outline" size={16} color={COLORS.secondary} />
                  <Text style={[styles.metaText, { color: COLORS.secondary }]}>{userData.website}</Text>
                </View>
              )}
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <StatItem label="Posts" value={userPosts.length} delay={400} />
            <View style={styles.statDivider} />
            <StatItem label="Followers" value={followers.length} delay={500} />
            <View style={styles.statDivider} />
            <StatItem label="Following" value={following.length} delay={600} />
          </View>

          {/* Edit Button */}
          <TouchableOpacity onPress={() => setEditModalVisible(true)} testID="edit-profile-btn">
            <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.editButton}>
              <Feather name="edit-3" size={18} color={COLORS.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {[
            { key: 'posts', icon: 'grid-outline' },
            { key: 'saved', icon: 'bookmark-outline' },
            { key: 'tagged', icon: 'pricetag-outline' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              testID={`tab-${tab.key}`}
            >
              <Ionicons 
                name={tab.icon} 
                size={24} 
                color={activeTab === tab.key ? COLORS.primary : COLORS.textTertiary} 
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'posts' && (
            userPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptyText}>Share your first moment!</Text>
                <TouchableOpacity onPress={() => router.push('/create-post')} testID="create-first-post-btn">
                  <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.emptyButton}>
                    <Ionicons name="add" size={20} color={COLORS.white} />
                    <Text style={styles.emptyButtonText}>Create Post</Text>
                  </LinearGradient>
                </TouchableOpacity>
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
            )
          )}
          
          {activeTab === 'saved' && (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={64} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No Saved Posts</Text>
              <Text style={styles.emptyText}>Save posts to view them here</Text>
            </View>
          )}
          
          {activeTab === 'tagged' && (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={64} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No Tagged Posts</Text>
              <Text style={styles.emptyText}>Posts you're tagged in will appear here</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <EditModal />
      <SettingsModal />

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}
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
  signInBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  signInBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  coverContainer: {
    height: 200,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  coverEditIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    marginTop: -60,
    marginHorizontal: 16,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarContainer: {
    marginTop: -70,
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.surface,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.surface,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.secondary,
    padding: 8,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  username: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bio: {
    fontSize: 15,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.surfaceLight,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
    shadowColor: '#F50057',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  editButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabContent: {
    backgroundColor: COLORS.surface,
    minHeight: 300,
    paddingBottom: 100,
  },
  postsGrid: {
    padding: 16,
    gap: 4,
  },
  postItem: {
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  postOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  postStatText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
  },
  editAvatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarLabel: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  formInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  formInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  settingsHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  settingsItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
});
