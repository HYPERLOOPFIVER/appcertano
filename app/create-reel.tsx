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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF2D55',
  secondary: '#6366F1',
  background: '#000000',
  surface: '#1A1A1A',
  surfaceLight: '#2A2A2A',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.5)',
  white: '#FFFFFF',
};

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
const UPLOAD_PRESET = 'Prepop';

export default function CreateReel() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState(null);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [musicName, setMusicName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoRef, setVideoRef] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const currentUserId = auth.currentUser?.uid;

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant gallery access');
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
        setIsPlaying(true);
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
        Alert.alert('Permission needed', 'Please grant camera access');
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
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video');
    }
  };

  const uploadToCloudinary = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'video/mp4',
      name: 'reel.mp4',
    });
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('resource_type', 'video');

    const response = await fetch(CLOUDINARY_URL.replace('/image/', '/video/'), {
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
    if (!videoUri) {
      Alert.alert('Video Required', 'Please select a video for your reel');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to post a reel');
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Upload video
      setUploadProgress(30);
      const videoUrl = await uploadToCloudinary(videoUri);
      
      setUploadProgress(80);

      // Create reel document
      await addDoc(collection(db, 'reels'), {
        videoUrl,
        caption: caption.trim(),
        hashtags: hashtags.trim(),
        musicName: musicName.trim() || 'Original Sound',
        uid: currentUserId,
        likes: [],
        comments: [],
        views: 0,
        createdAt: serverTimestamp(),
      });

      setUploadProgress(100);

      Alert.alert('Posted! 🎬', 'Your reel is now live!', [
        { text: 'View Reels', onPress: () => router.replace('/reels') }
      ]);
    } catch (error) {
      console.error('Error posting reel:', error);
      Alert.alert('Error', 'Failed to post reel. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const togglePlayPause = () => {
    if (videoRef) {
      if (isPlaying) {
        videoRef.pauseAsync();
      } else {
        videoRef.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <SafeAreaView style={styles.headerContainer}>
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="back-btn">
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Reel</Text>
          <TouchableOpacity
            style={[styles.postBtn, (!videoUri || uploading) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!videoUri || uploading}
            testID="post-btn"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </MotiView>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video Preview */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.previewSection}
        >
          <TouchableOpacity 
            style={styles.previewContainer}
            onPress={videoUri ? togglePlayPause : pickVideo}
            activeOpacity={0.9}
            testID="video-preview"
          >
            {videoUri ? (
              <>
                <Video
                  ref={(ref) => setVideoRef(ref)}
                  source={{ uri: videoUri }}
                  style={styles.videoPreview}
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  shouldPlay={isPlaying}
                  isMuted={false}
                />
                
                {/* Play/Pause Overlay */}
                {!isPlaying && (
                  <MotiView
                    from={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={styles.playOverlay}
                  >
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={50} color={COLORS.white} />
                    </View>
                  </MotiView>
                )}

                {/* Duration Badge */}
                <View style={styles.durationBadge}>
                  <Ionicons name="time-outline" size={14} color={COLORS.white} />
                  <Text style={styles.durationText}>Max 60s</Text>
                </View>

                {/* Remove Button */}
                <TouchableOpacity 
                  style={styles.removeBtn}
                  onPress={() => setVideoUri(null)}
                >
                  <Ionicons name="trash-outline" size={22} color={COLORS.white} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <LinearGradient colors={['#FF2D55', '#FF6B6B']} style={styles.placeholderIcon}>
                  <Ionicons name="videocam" size={48} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.placeholderTitle}>Add Your Video</Text>
                <Text style={styles.placeholderText}>Up to 60 seconds</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Source Buttons */}
          <View style={styles.sourceButtons}>
            <TouchableOpacity style={styles.sourceBtn} onPress={pickVideo} testID="gallery-btn">
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.sourceBtnGradient}>
                <Ionicons name="images" size={24} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.sourceBtnText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sourceBtn} onPress={recordVideo} testID="record-btn">
              <LinearGradient colors={['#FF2D55', '#FF6B6B']} style={styles.sourceBtnGradient}>
                <Ionicons name="videocam" size={24} color={COLORS.white} />
              </LinearGradient>
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
              placeholder="Write a caption that hooks viewers..."
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
            <View style={styles.hashtagRow}>
              <Ionicons name="pricetag-outline" size={20} color={COLORS.textTertiary} />
              <TextInput
                style={styles.hashtagsInput}
                placeholder="#trending #viral #fyp"
                placeholderTextColor={COLORS.textTertiary}
                value={hashtags}
                onChangeText={setHashtags}
                maxLength={200}
                testID="hashtags-input"
              />
            </View>
          </View>
        </MotiView>

        {/* Music Name Input */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 }}
          style={styles.formSection}
        >
          <Text style={styles.formLabel}>Music / Sound</Text>
          <View style={styles.inputContainer}>
            <View style={styles.hashtagRow}>
              <Ionicons name="musical-notes-outline" size={20} color={COLORS.textTertiary} />
              <TextInput
                style={styles.hashtagsInput}
                placeholder="Original Sound"
                placeholderTextColor={COLORS.textTertiary}
                value={musicName}
                onChangeText={setMusicName}
                maxLength={100}
                testID="music-input"
              />
            </View>
          </View>
        </MotiView>

        {/* Upload Progress */}
        {uploading && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
            <Text style={styles.progressHint}>Please don't close the app</Text>
          </MotiView>
        )}

        {/* Tips */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 500 }}
          style={styles.tipsSection}
        >
          <Text style={styles.tipsTitle}>Tips for better reels</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
            <Text style={styles.tipText}>Keep videos under 30s for better engagement</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
            <Text style={styles.tipText}>Use trending hashtags to reach more people</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
            <Text style={styles.tipText}>Add captions for accessibility</Text>
          </View>
        </MotiView>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
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
    backgroundColor: COLORS.surfaceLight,
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
    height: 450,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  durationText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  removeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    width: 100,
    height: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 15,
    color: COLORS.textTertiary,
  },
  sourceButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
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
  },
  sourceBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  captionInput: {
    fontSize: 16,
    color: COLORS.white,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'right',
    marginTop: 8,
  },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hashtagsInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.white,
    paddingVertical: 4,
  },
  progressSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
    color: COLORS.white,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  tipsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
});
