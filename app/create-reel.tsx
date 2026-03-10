import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
  black: '#000000',
};

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
const UPLOAD_PRESET = 'Prepop';

export default function CreateReel() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const currentUserId = auth.currentUser?.uid;

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant media library permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        // Use first frame as thumbnail placeholder
        setThumbnail(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        setThumbnail(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video');
    }
  };

  const uploadToCloudinary = async (uri, resourceType = 'video') => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: resourceType === 'video' ? 'video/mp4' : 'image/jpeg',
      name: resourceType === 'video' ? 'reel.mp4' : 'thumbnail.jpg',
    } as any);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('resource_type', resourceType);

    const response = await fetch(CLOUDINARY_URL.replace('/image/', `/${resourceType}/`), {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.secure_url;
  };

  const handlePostReel = async () => {
    if (!videoUri) {
      Alert.alert('Error', 'Please select a video for your reel');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to post a reel');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload video
      setUploadProgress(30);
      const videoUrl = await uploadToCloudinary(videoUri, 'video');
      
      setUploadProgress(80);

      // Create reel document
      await addDoc(collection(db, 'reels'), {
        videoUrl,
        caption: caption.trim(),
        hashtags: hashtags.trim(),
        uid: currentUserId,
        likes: [],
        comments: [],
        views: 0,
        createdAt: serverTimestamp(),
      });

      setUploadProgress(100);

      Alert.alert('Success! 🎬', 'Your reel has been posted!', [
        { text: 'View Reels', onPress: () => router.replace('/reels') }
      ]);
    } catch (error) {
      console.error('Error posting reel:', error);
      Alert.alert('Error', 'Failed to post reel. Please try again.');
    } finally {
      setUploading(false);
    }
  };

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
          <Ionicons name="close" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Reel</Text>
        <TouchableOpacity
          style={[styles.postBtn, (!videoUri || uploading) && styles.postBtnDisabled]}
          onPress={handlePostReel}
          disabled={!videoUri || uploading}
          testID="post-reel-btn"
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </MotiView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.previewSection}
        >
          <TouchableOpacity 
            style={styles.previewContainer}
            onPress={pickVideo}
            testID="video-preview"
          >
            {videoUri ? (
              <>
                <Image source={{ uri: thumbnail }} style={styles.previewImage} />
                <View style={styles.playOverlay}>
                  <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']} style={styles.overlayGradient}>
                    <Ionicons name="play-circle" size={64} color={COLORS.white} />
                    <Text style={styles.previewLabel}>Tap to change video</Text>
                  </LinearGradient>
                </View>
                <TouchableOpacity 
                  style={styles.removeBtn}
                  onPress={() => { setVideoUri(null); setThumbnail(null); }}
                >
                  <Ionicons name="close-circle" size={28} color={COLORS.white} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.placeholderIcon}>
                  <Ionicons name="videocam" size={40} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.placeholderTitle}>Add Your Video</Text>
                <Text style={styles.placeholderText}>Up to 60 seconds</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Video Source Buttons */}
          <View style={styles.sourceButtons}>
            <TouchableOpacity style={styles.sourceBtn} onPress={pickVideo} testID="gallery-btn">
              <Ionicons name="images" size={24} color={COLORS.secondary} />
              <Text style={styles.sourceBtnText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={recordVideo} testID="record-btn">
              <Ionicons name="videocam" size={24} color={COLORS.primary} />
              <Text style={styles.sourceBtnText}>Record</Text>
            </TouchableOpacity>
          </View>
        </MotiView>

        {/* Caption Input */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}
          style={styles.formSection}
        >
          <Text style={styles.formLabel}>Caption</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption for your reel..."
              placeholderTextColor={COLORS.textTertiary}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              testID="caption-input"
            />
            <Text style={styles.charCount}>{caption.length}/500</Text>
          </View>
        </MotiView>

        {/* Hashtags Input */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 300 }}
          style={styles.formSection}
        >
          <Text style={styles.formLabel}>Hashtags</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.hashtagsInput}
              placeholder="#trending #viral #funny"
              placeholderTextColor={COLORS.textTertiary}
              value={hashtags}
              onChangeText={setHashtags}
              maxLength={200}
              testID="hashtags-input"
            />
          </View>
        </MotiView>

        {/* Upload Progress */}
        {uploading && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.progressSection}
          >
            <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
            <View style={styles.progressBar}>
              <MotiView
                from={{ width: '0%' }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ type: 'timing', duration: 300 }}
                style={styles.progressFill}
              />
            </View>
          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
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
    padding: 16,
  },
  previewSection: {
    marginBottom: 24,
  },
  previewContainer: {
    height: 400,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLabel: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  sourceButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sourceBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  captionInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hashtagsInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'right',
    marginTop: 8,
  },
  progressSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
});
