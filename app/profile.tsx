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
  Modal
} from 'react-native';
import { Ionicons, Feather, FontAwesome, AntDesign, Entypo, MaterialIcons } from '@expo/vector-icons';
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
import { auth, db, storage } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

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

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
const UPLOAD_PRESET = 'Prepop';

export default function CertanoProfile() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
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
        const data = {
          id: userDoc.id,
          ...userDoc.data()
        };
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
      Alert.alert('Error', 'Failed to load profile data');
    }
  };

  const fetchUserPosts = async (userId) => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef, 
        where('uid', '==', userId),
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

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

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: `${type}_${user.uid}.jpg`,
      } as any);
      formData.append('upload_preset', UPLOAD_PRESET);

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Upload failed');
      }

      const downloadURL = data.secure_url;

      // Update user document
      const updateField = type === 'profile' ? 'profilePic' : 'coverImage';
      await updateDoc(doc(db, 'users', user.uid), {
        [updateField]: downloadURL
      });

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

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editForm.displayName,
        name: editForm.displayName,
        bio: editForm.bio,
        website: editForm.website,
        location: editForm.location,
        updatedAt: new Date()
      });

      setUserData(prev => ({
        ...prev,
        displayName: editForm.displayName,
        name: editForm.displayName,
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
              router.replace('/login');
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
        onPress={() => router.push(`/post/${item.id}`)}
      >
        <Image 
          source={{ uri: item.image || 'https://picsum.photos/300/300?random=' + index }} 
          style={styles.postImage} 
        />
        <View style={styles.postOverlay}>
          <View style={styles.postStats}>
            <View style={styles.postStat}>
              <AntDesign name="heart" size={12} color={COLORS.white} />
              <Text style={styles.postStatText}>{item.likes?.length || 0}</Text>
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
            <Feather name="check" size={24} color={uploading ? COLORS.textMuted : COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.editImageSection}>
            <TouchableOpacity 
              style={styles.editProfileImage}
              onPress={() => handleImagePicker('profile')}
              disabled={uploading}
            >
              {userData?.profilePic ? (
                <Image source={{ uri: userData.profilePic }} style={styles.editProfileImageContent} />
              ) : (
                <View style={styles.editProfileImagePlaceholder}>
                  <Text style={styles.editProfileImageText}>
                    {(userData?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.editImageOverlay}>
                <Ionicons name="camera" size={20} color={COLORS.white} />
              </View>
            </TouchableOpacity>
            <Text style={styles.editImageLabel}>Tap to change profile photo</Text>
          </View>

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
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{userData.displayName || userData.name || 'Profile'}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/create-story')}>
            <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setEditModalVisible(true)}>
            <Feather name="edit-3" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={24} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: userData.coverImage || 'https://picsum.photos/800/300' }} 
            style={styles.coverImage} 
          />
          <TouchableOpacity 
            style={styles.changeCoverBtn}
            onPress={() => handleImagePicker('cover')}
          >
            <Ionicons name="camera" size={16} color={COLORS.white} />
          </TouchableOpacity>
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
            <TouchableOpacity 
              style={styles.editProfileImageBtn}
              onPress={() => handleImagePicker('profile')}
            >
              <Ionicons name="camera" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{userData.displayName || userData.name || 'User'}</Text>
            <Text style={styles.username}>@{userData.username || user.email?.split('@')[0]}</Text>
            
            {userData.bio && <Text style={styles.bio}>{userData.bio}</Text>}

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
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
            onPress={() => setActiveTab('saved')}
          >
            <FontAwesome name="bookmark-o" size={20} color={activeTab === 'saved' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>Saved</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
            onPress={() => setActiveTab('tagged')}
          >
            <Feather name="tag" size={20} color={activeTab === 'tagged' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === 'tagged' && styles.activeTabText]}>Tagged</Text>
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
  scrollView: {
    flex: 1,
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
  tabContent: {
    padding: 16,
  },
  postsGrid: {
    marginHorizontal: -8,
  },
  postsRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postItem: {
    margin: 4,
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'flex-end',
    padding: 8,
    opacity: 0,
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
  editProfileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editProfileImageText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.white,
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
    fontWeight: '500',
  },
  formInput: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
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
