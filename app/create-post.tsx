import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function CreatePostOrReel() {
  const [type, setType] = useState<'posts' | 'reels'>('posts');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [musicName, setMusicName] = useState('');
  const [mediaUri, setMediaUri] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
  const UPLOAD_PRESET = 'Prepop'; // Make sure this preset exists and is unsigned in Cloudinary

  const pickMedia = async () => {
    const mediaTypes = type === 'posts'
      ? ImagePicker.MediaTypeOptions.Images
      : ImagePicker.MediaTypeOptions.Videos;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const picked = result.assets[0];
      console.log('Picked media:', picked);
      setMediaUri(picked.uri);
      setMediaType(type === 'posts' ? 'image' : 'video');
    }
  };

  const uploadToCloudinary = async () => {
    if (!mediaUri) throw new Error('No media selected');

    const fileType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
    const fileExt = mediaType === 'video' ? 'mp4' : 'jpg';

    const formData = new FormData();
    formData.append('file', {
      uri: mediaUri,
      type: fileType,
      name: `upload.${fileExt}`,
    } as any); // Fix for React Native FormData

    formData.append('upload_preset', UPLOAD_PRESET);

    try {
      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Cloudinary upload failed:', data);
        throw new Error(data.error?.message || 'Upload failed');
      }

      console.log('Cloudinary upload success:', data);
      return data.secure_url;
    } catch (error: any) {
      console.error('Cloudinary Upload Error:', error.message);
      throw error;
    }
  };

  const handleUpload = async () => {
    try {
      const mediaUrl = await uploadToCloudinary();
      await addDoc(collection(db, type), {
        uid: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        likes: [],
        comments: [],
        ...(type === 'posts'
          ? { title, description, image: mediaUrl, category, hashtags }
          : { caption, videoUrl: mediaUrl, musicName, hashtags }),
      });
      Alert.alert(`${type === 'posts' ? 'Post' : 'Reel'} uploaded!`);
      resetForm();
    } catch (err) {
      console.error(err);
      Alert.alert('Upload failed');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCaption('');
    setMusicName('');
    setCategory('');
    setHashtags('');
    setMediaUri('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create {type}</Text>
      <Button title="Pick Media" onPress={pickMedia} />

      {mediaUri ? (
        type === 'posts' ? (
          <Image source={{ uri: mediaUri }} style={styles.preview} />
        ) : (
          <Text style={styles.previewText}>Video Selected</Text>
        )
      ) : null}

      {type === 'posts' ? (
        <>
          <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} />
          <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} />
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Caption" value={caption} onChangeText={setCaption} />
          <TextInput style={styles.input} placeholder="Music Name (optional)" value={musicName} onChangeText={setMusicName} />
        </>
      )}

      <TextInput style={styles.input} placeholder="Hashtags (comma separated)" value={hashtags} onChangeText={setHashtags} />

      <Button title="Upload" onPress={handleUpload} color="#006D77" />
      <Button title={`Switch to ${type === 'posts' ? 'Reels' : 'Posts'}`} onPress={() => setType(type === 'posts' ? 'reels' : 'posts')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#EDF6F9' },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#006D77', marginBottom: 16 },
  input: { backgroundColor: '#fff', padding: 10, marginBottom: 12, borderRadius: 8 },
  preview: { width: '100%', height: 200, marginVertical: 10, borderRadius: 10 },
  previewText: { marginVertical: 10, fontSize: 16, color: '#333' },
});
