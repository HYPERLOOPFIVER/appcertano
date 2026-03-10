import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#F50057',
  primaryLight: '#FF4D4D',
  secondary: '#6366F1',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
const UPLOAD_PRESET = 'Prepop';

const CATEGORIES = [
  { id: 'lifestyle', label: 'Lifestyle', icon: 'heart-outline', color: '#F50057' },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline', color: '#3B82F6' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline', color: '#F59E0B' },
  { id: 'fashion', label: 'Fashion', icon: 'shirt-outline', color: '#8B5CF6' },
  { id: 'tech', label: 'Tech', icon: 'laptop-outline', color: '#10B981' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness-outline', color: '#EF4444' },
  { id: 'art', label: 'Art', icon: 'color-palette-outline', color: '#EC4899' },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline', color: '#06B6D4' },
];

export default function CreatePost() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [location, setLocation] = useState(null);
  const [placeName, setPlaceName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const currentUserId = auth.currentUser?.uid;

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant gallery access to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera access to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode.length > 0) {
        const place = geocode[0];
        const parts = [place.name, place.city, place.region].filter(Boolean);
        setPlaceName(parts.join(', '));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const uploadToCloudinary = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'post.jpg',
    });
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.secure_url;
  };

  const handlePost = async () => {
    if (!imageUri) {
      Alert.alert('Image Required', 'Please select an image for your post');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Caption Required', 'Please add a caption to your post');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to create a post');
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      // Upload image
      setUploadProgress(40);
      const imageUrl = await uploadToCloudinary(imageUri);
      
      setUploadProgress(70);

      // Create post document
      const postData = {
        uid: currentUserId,
        image: imageUrl,
        caption: caption.trim(),
        hashtags: hashtags.trim(),
        category: selectedCategory,
        likes: [],
        comments: [],
        createdAt: serverTimestamp(),
      };

      if (location) {
        postData.location = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          placeName: placeName,
        };
      }

      await addDoc(collection(db, 'posts'), postData);
      
      setUploadProgress(100);

      Alert.alert('Posted! 🎉', 'Your post is now live!', [
        { text: 'View Feed', onPress: () => router.replace('/home') }
      ]);
    } catch (error) {
      console.error('Error posting:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.header}
        >
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.headerBtn}
            testID="back-btn"
          >
            <Ionicons name="close" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Post</Text>
          <TouchableOpacity
            style={[styles.postBtn, (!imageUri || !caption.trim() || uploading) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!imageUri || !caption.trim() || uploading}
            testID="post-btn"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.postBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </MotiView>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Image Section */}
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 100 }}
            style={styles.imageSection}
          >
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageBtn}
                  onPress={() => setImageUri(null)}
                >
                  <Ionicons name="close-circle" size={32} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.changeImageBtn}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={20} color={COLORS.white} />
                  <Text style={styles.changeImageText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <LinearGradient 
                  colors={['rgba(245,0,87,0.1)', 'rgba(99,102,241,0.1)']}
                  style={styles.placeholderGradient}
                >
                  <Ionicons name="images" size={60} color={COLORS.primary} />
                  <Text style={styles.placeholderTitle}>Add Photo</Text>
                  <Text style={styles.placeholderText}>Tap below to select or take a photo</Text>
                </LinearGradient>
              </View>
            )}

            {/* Image Source Buttons */}
            <View style={styles.imageSourceButtons}>
              <TouchableOpacity 
                style={styles.sourceBtn}
                onPress={pickImage}
                testID="gallery-btn"
              >
                <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.sourceBtnGradient}>
                  <Ionicons name="images" size={24} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.sourceBtnText}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.sourceBtn}
                onPress={takePhoto}
                testID="camera-btn"
              >
                <LinearGradient colors={['#F50057', '#FF4D4D']} style={styles.sourceBtnGradient}>
                  <Ionicons name="camera" size={24} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.sourceBtnText}>Camera</Text>
              </TouchableOpacity>
            </View>
          </MotiView>

          {/* Caption Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 200 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Caption</Text>
            <View style={styles.captionContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Write something amazing..."
                placeholderTextColor={COLORS.textTertiary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={2000}
                testID="caption-input"
              />
              <Text style={styles.charCount}>{caption.length}/2000</Text>
            </View>
          </MotiView>

          {/* Hashtags Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 300 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Hashtags</Text>
            <View style={styles.hashtagsContainer}>
              <Ionicons name="pricetag-outline" size={20} color={COLORS.textTertiary} />
              <TextInput
                style={styles.hashtagsInput}
                placeholder="#travel #photography #lifestyle"
                placeholderTextColor={COLORS.textTertiary}
                value={hashtags}
                onChangeText={setHashtags}
                testID="hashtags-input"
              />
            </View>
          </MotiView>

          {/* Category Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 400 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            >
              {CATEGORIES.map((cat, index) => (
                <MotiView
                  key={cat.id}
                  from={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 400 + index * 50 }}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
                    ]}
                    onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    testID={`category-${cat.id}`}
                  >
                    <Ionicons 
                      name={cat.icon} 
                      size={18} 
                      color={selectedCategory === cat.id ? COLORS.white : cat.color} 
                    />
                    <Text style={[
                      styles.categoryLabel,
                      selectedCategory === cat.id && { color: COLORS.white }
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                </MotiView>
              ))}
            </ScrollView>
          </MotiView>

          {/* Location Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 500 }}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>Location</Text>
            {location ? (
              <View style={styles.locationSelected}>
                <View style={styles.locationInfo}>
                  <Ionicons name="location" size={20} color={COLORS.primary} />
                  <Text style={styles.locationText}>{placeName}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => { setLocation(null); setPlaceName(''); }}
                  style={styles.removeLocationBtn}
                >
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addLocationBtn}
                onPress={getCurrentLocation}
                disabled={isGettingLocation}
                testID="add-location-btn"
              >
                {isGettingLocation ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.secondary} />
                    <Text style={styles.addLocationText}>Getting location...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="location-outline" size={22} color={COLORS.secondary} />
                    <Text style={styles.addLocationText}>Add Location</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </MotiView>

          {/* Upload Progress */}
          {uploading && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={styles.progressSection}
            >
              <View style={styles.progressHeader}>
                <Ionicons name="cloud-upload" size={24} color={COLORS.primary} />
                <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <MotiView
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={styles.progressBar}
                />
              </View>
            </MotiView>
          )}

          {/* Extra Spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postBtnDisabled: {
    backgroundColor: COLORS.textTertiary,
  },
  postBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  imageSection: {
    marginBottom: 24,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  imagePreview: {
    width: '100%',
    height: width * 1.1,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  changeImageText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  imagePlaceholder: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  placeholderGradient: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  placeholderText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  imageSourceButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
  },
  sourceBtn: {
    alignItems: 'center',
  },
  sourceBtnGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  sourceBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    marginLeft: 4,
  },
  captionContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  captionInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'right',
    marginTop: 8,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hashtagsInput: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  categoriesContainer: {
    gap: 10,
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  addLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  addLocationText: {
    fontSize: 16,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  locationSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  locationText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
  },
  removeLocationBtn: {
    padding: 4,
  },
  progressSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
});
