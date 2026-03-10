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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const COLORS = {
  primary: '#006D77',
  primaryLight: '#83C5BE',
  background: '#EDF6F9',
  surface: '#FFFFFF',
  textPrimary: '#006D77',
  textSecondary: '#83C5BE',
  textMuted: '#B0C4C7',
  border: '#E9F5F6',
  white: '#FFFFFF',
  black: '#000000',
};

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
const UPLOAD_PRESET = 'Prepop';

export default function CreateStory() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [uploading, setUploading] = useState(false);
  
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
        quality: 0.8,
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
        quality: 0.8,
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
      // Upload image to Cloudinary
      const imageUrl = await uploadToCloudinary(imageUri);

      // Add story to Firestore
      const storiesRef = collection(db, 'users', currentUserId, 'stories');
      await addDoc(storiesRef, {
        imageUrl,
        text: storyText.trim() || null,
        createdAt: serverTimestamp(),
        viewers: [],
      });

      Alert.alert('Success', 'Story posted successfully!');
      router.back();
    } catch (error) {
      console.error('Error posting story:', error);
      Alert.alert('Error', 'Failed to post story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity
          style={[styles.postBtn, !imageUri && styles.postBtnDisabled]}
          onPress={handlePostStory}
          disabled={!imageUri || uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.postBtnText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Preview Area */}
      <View style={styles.previewContainer}>
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            
            {/* Text Overlay */}
            {storyText && (
              <View style={styles.textOverlay}>
                <Text style={styles.overlayText}>{storyText}</Text>
              </View>
            )}
            
            {/* Remove Image Button */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => setImageUri(null)}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="images-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.placeholderText}>Add a photo to your story</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Text Input */}
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Add text to your story..."
            placeholderTextColor={COLORS.textMuted}
            value={storyText}
            onChangeText={setStoryText}
            maxLength={200}
            multiline
          />
          <Text style={styles.charCount}>{storyText.length}/200</Text>
        </View>

        {/* Media Buttons */}
        <View style={styles.mediaButtons}>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
            <Ionicons name="images" size={28} color={COLORS.primary} />
            <Text style={styles.mediaBtnText}>Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={28} color={COLORS.primary} />
            <Text style={styles.mediaBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postBtnDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  postBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    borderRadius: 12,
  },
  overlayText: {
    color: COLORS.white,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
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
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginTop: 16,
  },
  controlsContainer: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  textInputContainer: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 50,
    maxHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  mediaBtn: {
    alignItems: 'center',
    padding: 16,
  },
  mediaBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
});
