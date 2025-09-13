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
  Platform,
  StatusBar,
  Dimensions,
  Alert,
  TextInput,
  Modal
} from 'react-native';

// Import icons from @expo/vector-icons instead of lucide-react
import { 
  Ionicons, 
  MaterialIcons, 
  Feather, 
  FontAwesome,
  MaterialCommunityIcons,
  AntDesign,
  Entypo
} from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';
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
import { 
  auth, 
  db, 
  storage 
} from '../firebase'; // Adjust import path as needed
import { 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

const { width } = Dimensions.get('window');

// Certano theme colors
const COLORS = {
  primary: '#006D77',
  primaryLight: '#83C5BE',
  primaryDark: '#264653',
  background: '#EDF6F9',
  surface: '#FFFFFF',
  accent: '#E9C46A',
  secondary: '#F4A261',
  error: '#E76F51',
  text: '#2A9D8F',
  textPrimary: '#006D77',
  textSecondary: '#83C5BE',
  textMuted: '#B0C4C7',
  border: '#FFDDD2',
  success: '#2A9D8F',
  warning: '#F4A261',
  white: '#FFFFFF',
  light: '#F8FDFF',
};

export default function CertanoProfile({ navigation }) {
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  
  // Edit form states
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
        // Navigate to login screen
        navigation?.navigate('Login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = {
          id: userDoc.id,
          ...userDoc.data()
        };
        setUserData(data);
        
        // Initialize edit form with current data
        setEditForm({
          displayName: data.displayName || '',
          bio: data.bio || '',
          website: data.website || '',
          location: data.location || ''
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert('Error', 'Failed to load profile data');
    }
  };

  const fetchUserPosts = async (userId) => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef, 
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const posts = [];
        snapshot.forEach((doc) => {
          posts.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setUserPosts(posts);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };

  const fetchFollowersAndFollowing = async (userId) => {
    try {
      // Fetch followers
      const followersRef = collection(db, 'users', userId, 'followers');
      const followersSnapshot = await getDocs(followersRef);
      setFollowers(followersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch following
      const followingRef = collection(db, 'users', userId, 'following');
      const followingSnapshot = await getDocs(followingRef);
      setFollowing(followingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching followers/following:", error);
    }
  };

  const handleImagePicker = async (type = 'profile') => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

      // Show options
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          { text: 'Camera', onPress: () => openCamera(type) },
          { text: 'Gallery', onPress: () => openGallery(type) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const openCamera = async (type) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        uploadImage(result.assets[0].uri, type);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
    }
  };

  const openGallery = async (type) => {
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
      console.error('Error opening gallery:', error);
    }
  };

  const uploadImage = async (uri, type) => {
    try {
      setUploading(true);

      // Convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference
      const filename = `${type}_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `users/${user.uid}/${filename}`);

      // Upload image
      await uploadBytes(storageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update user document
      const updateField = type === 'profile' ? 'profileImage' : 'coverImage';
      await updateDoc(doc(db, 'users', user.uid), {
        [updateField]: downloadURL
      });

      // Update local state
      setUserData(prev => ({
        ...prev,
        [updateField]: downloadURL
      }));

      Alert.alert('Success', `${type === 'profile' ? 'Profile' : 'Cover'} photo updated successfully!`);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setUploading(true);

      // Update user document in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editForm.displayName,
        bio: editForm.bio,
        website: editForm.website,
        location: editForm.location,
        updatedAt: new Date()
      });

      // Update local state
      setUserData(prev => ({
        ...prev,
        displayName: editForm.displayName,
        bio: editForm.bio,
        website: editForm.website,
        location: editForm.location
      }));

      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              navigation?.navigate('Login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const renderPostItem = ({ item, index }) => {
    const imageSize = (width - 48) / 3;
    
    return (
      <TouchableOpacity 
        style={[styles.postItem, { width: imageSize, height: imageSize }]}
        onPress={() => {
          navigation?.navigate('PostDetails', { postId: item.id });
        }}
      >
        <Image 
          source={{ uri: item.imageUrl || 'https://picsum.photos/300/300?random=' + index }} 
          style={styles.postImage} 
        />
        <View style={styles.postOverlay}>
          <View style={styles.postStats}>
            <View style={styles.postStat}>
              <AntDesign name="heart" size={12} color={COLORS.white} />
              <Text style={styles.postStatText}>{item.likesCount || 0}</Text>
            </View>
            <View style={styles.postStat}>
              <Feather name="message-circle" size={12} color={COLORS.white} />
              <Text style={styles.postStatText}>{item.commentsCount || 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setEditModalVisible(false)}>
            <AntDesign name="close" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSaveProfile} disabled={uploading}>
            <Feather name="save" size={24} color={uploading ? COLORS.textMuted : COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Profile Image Section */}
          <View style={styles.editImageSection}>
            <TouchableOpacity 
              style={styles.editProfileImage}
              onPress={() => handleImagePicker('profile')}
              disabled={uploading}
            >
              <Image 
                source={{ 
                  uri: userData?.profileImage || 'https://via.placeholder.com/100x100?text=User' 
                }} 
                style={styles.editProfileImageContent} 
              />
              <View style={styles.editImageOverlay}>
                <Ionicons name="camera" size={20} color={COLORS.white} />
              </View>
            </TouchableOpacity>
            <Text style={styles.editImageLabel}>Tap to change profile photo</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Display Name</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.displayName}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, displayName: text }))}
                placeholder="Enter your display name"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Bio</Text>
              <TextInput
                style={[styles.formInput, styles.bioInput]}
                value={editForm.bio}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
                placeholder="Tell us about yourself..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Website</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.website}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, website: text }))}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Location</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.location}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, location: text }))}
                placeholder="Your location"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Cover Image Section */}
          <View style={styles.editCoverSection}>
            <Text style={styles.formLabel}>Cover Photo</Text>
            <TouchableOpacity 
              style={styles.editCoverImage}
              onPress={() => handleImagePicker('cover')}
              disabled={uploading}
            >
              <Image 
                source={{ 
                  uri: userData?.coverImage || 'https://via.placeholder.com/400x200?text=Cover+Photo' 
                }} 
                style={styles.editCoverImageContent} 
              />
              <View style={styles.editImageOverlay}>
                <Ionicons name="camera" size={24} color={COLORS.white} />
                <Text style={styles.editCoverText}>Change Cover</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.uploadingText}>Updating...</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'posts':
        return userPosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="grid" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
            <Text style={styles.emptyStateText}>Your posts will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={userPosts}
            renderItem={renderPostItem}
            keyExtractor={item => item.id}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.postsGrid}
            columnWrapperStyle={styles.postsRow}
          />
        );
      case 'saved':
        return (
          <View style={styles.emptyState}>
            <FontAwesome name="bookmark-o" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyStateTitle}>No Saved Posts</Text>
            <Text style={styles.emptyStateText}>Posts you save will appear here</Text>
          </View>
        );
      case 'tagged':
        return (
          <View style={styles.emptyState}>
            <Feather name="tag" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyStateTitle}>No Tagged Posts</Text>
            <Text style={styles.emptyStateText}>Posts you're tagged in will appear here</Text>
          </View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  if (!user || !userData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Please sign in to view your profile</Text>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => navigation?.navigate('Login')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{userData.displayName || 'Profile'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerBtn}
            onPress={() => setEditModalVisible(true)}
          >
            <Feather name="edit-3" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={24} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image 
            source={{ 
              uri: userData.coverImage || 'https://via.placeholder.com/400x200?text=Cover+Photo' 
            }} 
            style={styles.coverImage} 
          />
          <View style={styles.coverOverlay} />
          <TouchableOpacity 
            style={styles.changeCoverBtn}
            onPress={() => handleImagePicker('cover')}
          >
            <Ionicons name="camera" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          {/* Profile Image */}
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ 
                uri: userData.profileImage || 'https://via.placeholder.com/100x100?text=User' 
              }} 
              style={styles.profileImage} 
            />
            <TouchableOpacity 
              style={styles.editProfileImageBtn}
              onPress={() => handleImagePicker('profile')}
            >
              <Ionicons name="camera" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.displayName}>{userData.displayName || 'User'}</Text>
              {userData.verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.username}>@{userData.username || user.email?.split('@')[0]}</Text>
            
            {userData.bio && <Text style={styles.bio}>{userData.bio}</Text>}

            {/* Profile Meta */}
            <View style={styles.profileMeta}>
              {userData.location && (
                <View style={styles.metaItem}>
                  <Entypo name="location-pin" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{userData.location}</Text>
                </View>
              )}
              {userData.website && (
                <View style={styles.metaItem}>
                  <Feather name="link" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaLink}>{userData.website}</Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <AntDesign name="calendar" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>
                  Joined {userData.createdAt?.toDate?.()?.toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  }) || 'Recently'}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{userPosts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{followers.length}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{following.length}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Feather name="grid" size={20} color={activeTab === 'posts' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
            onPress={() => setActiveTab('saved')}
          >
            <FontAwesome name="bookmark-o" size={20} color={activeTab === 'saved' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
              Saved
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
            onPress={() => setActiveTab('tagged')}
          >
            <Feather name="tag" size={20} color={activeTab === 'tagged' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === 'tagged' && styles.activeTabText]}>
              Tagged
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      {renderEditModal()}

      {/* Loading Overlay */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  signInButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerBtn: {
    padding: 8,
    marginLeft: 8,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Cover Image
  coverContainer: {
    height: 200,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 109, 119, 0.1)',
  },
  changeCoverBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Profile Section
  profileSection: {
    backgroundColor: COLORS.surface,
    marginTop: -50,
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
  editProfileImageBtn: {
    position: 'absolute',
    bottom: 0,
    right: width / 2 - 62,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  verifiedBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  metaLink: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: 6,
    fontWeight: '500',
  },

  // Stats
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
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
    // Tabs
    tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,          
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Tab Content
  tabContent: {
    padding: 16,
  },

  // Posts Grid
  postsGrid: {
    marginHorizontal: -8,
  },
  postsRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postItem: {
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.light,
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  postOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    padding: 8,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatText: {
    fontSize: 12,
    color: COLORS.white,
    marginLeft: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalContent: {
    padding: 16,
  },
  editImageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  editProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  editProfileImageContent: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  formContainer: {
    marginBottom: 24,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bioInput: {
    height: 80,
  },
  editCoverSection: {
    marginBottom: 24,
  },
  editCoverImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  editCoverImageContent: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editCoverText: {
    fontSize: 14,
    color: COLORS.white,
    marginTop: 4,
  },

  // Uploading Overlay
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
});