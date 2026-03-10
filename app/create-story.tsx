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

export default function CreateStory() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [textPosition, setTextPosition] = useState('bottom');
  
  const currentUserId = auth.currentUser?.uid;

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const uploadToCloudinary = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'story.jpg',
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

    return data.secure_url;
  };

  const handlePostStory = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Please select an image for your story');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to post a story');
      return;
    }

    setUploading(true);

    try {
      const imageUrl = await uploadToCloudinary(imageUri);

      const storiesRef = collection(db, 'users', currentUserId, 'stories');
      await addDoc(storiesRef, {
        imageUrl,
        text: storyText.trim() || null,
        textPosition,
        createdAt: serverTimestamp(),
        viewers: [],
      });

      Alert.alert('Posted! 🎉', 'Your story is now live!', [
        { text: 'View Feed', onPress: () => router.replace('/home') }
      ]);
    } catch (error) {
      console.error('Error posting story:', error);
      Alert.alert('Error', 'Failed to post story. Please try again.');
    } finally {
      setUploading(false);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="close-btn">
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Story</Text>
          <TouchableOpacity
            style={[styles.shareBtn, (!imageUri || uploading) && styles.shareBtnDisabled]}
            onPress={handlePostStory}
            disabled={!imageUri || uploading}
            testID="share-story-btn"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.shareBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </MotiView>
      </SafeAreaView>

      {/* Preview Area */}
      <View style={styles.previewContainer}>
        {imageUri ? (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={styles.previewWrapper}
          >
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            
            {/* Text Overlay */}
            {storyText && (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={[
                  styles.textOverlay,
                  textPosition === 'top' && styles.textOverlayTop,
                  textPosition === 'center' && styles.textOverlayCenter,
                ]}
              >
                <Text style={styles.overlayText}>{storyText}</Text>
              </MotiView>
            )}
            
            {/* Remove Button */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => setImageUri(null)}
              testID="remove-image-btn"
            >
              <Ionicons name="trash-outline" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </MotiView>
        ) : (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.placeholderContainer}
          >
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.placeholderIcon}>
              <Ionicons name="images" size={48} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.placeholderTitle}>Add to Story</Text>
            <Text style={styles.placeholderText}>Share a photo that disappears in 24 hours</Text>
          </MotiView>
        )}
      </View>

      {/* Controls */}
      <SafeAreaView style={styles.controlsContainer}>
        <MotiView
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.controls}
        >
          {/* Text Input */}
          <View style={styles.textInputContainer}>
            <Ionicons name="text" size={20} color={COLORS.textTertiary} />
            <TextInput
              style={styles.textInput}
              placeholder="Add text to your story..."
              placeholderTextColor={COLORS.textTertiary}
              value={storyText}
              onChangeText={setStoryText}
              maxLength={200}
              testID="story-text-input"
            />
            <Text style={styles.charCount}>{storyText.length}/200</Text>
          </View>

          {/* Text Position */}
          {storyText.length > 0 && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={styles.positionContainer}
            >
              <Text style={styles.positionLabel}>Text Position:</Text>
              <View style={styles.positionButtons}>
                {['top', 'center', 'bottom'].map((pos) => (
                  <TouchableOpacity
                    key={pos}
                    style={[styles.positionBtn, textPosition === pos && styles.positionBtnActive]}
                    onPress={() => setTextPosition(pos)}
                    testID={`position-${pos}`}
                  >
                    <Text style={[styles.positionBtnText, textPosition === pos && styles.positionBtnTextActive]}>
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </MotiView>
          )}

          {/* Media Buttons */}
          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaBtn} onPress={pickImage} testID="gallery-btn">
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.mediaBtnGradient}>
                <Ionicons name="images" size={24} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.mediaBtnText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto} testID="camera-btn">
              <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.mediaBtnGradient}>
                <Ionicons name="camera" size={24} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.mediaBtnText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    zIndex: 10,
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  shareBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  shareBtnDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  shareBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  previewWrapper: {
    flex: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
    borderRadius: 16,
  },
  textOverlayTop: {
    bottom: 'auto',
    top: 100,
  },
  textOverlayCenter: {
    bottom: 'auto',
    top: '50%',
    transform: [{ translateY: -30 }],
  },
  overlayText: {
    color: COLORS.white,
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '600',
  },
  removeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 25,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderIcon: {
    width: 100,
    height: 100,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    textAlign: 'center',
  },
  controlsContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  controls: {
    padding: 20,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.white,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  positionContainer: {
    marginBottom: 16,
  },
  positionLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  positionBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  positionBtnActive: {
    backgroundColor: COLORS.secondary,
  },
  positionBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  positionBtnTextActive: {
    color: COLORS.white,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  mediaBtn: {
    alignItems: 'center',
  },
  mediaBtnGradient: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
