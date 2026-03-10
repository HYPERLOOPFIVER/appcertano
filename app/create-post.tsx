import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, ScrollView, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Add this to your environment variables or config
const GOOGLE_AI_API_KEY = 'AIzaSyCoRzhqrayROM7dImhISWNzmHzQnW09KZs'; // Replace with your actual API key

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
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // AI Meme Generation States
  const [isGeneratingMeme, setIsGeneratingMeme] = useState(false);
  const [aiGeneratedContent, setAiGeneratedContent] = useState(null);
  const [memePrompt, setMemePrompt] = useState('');
  const [showAiSection, setShowAiSection] = useState(false);

  const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dfzmg1jtd/upload';
  const UPLOAD_PRESET = 'Prepop';

  // AI Meme Generation Function
  const generateMemeWithAI = async () => {
    if (!memePrompt.trim()) {
      Alert.alert('Error', 'Please enter a meme idea or topic');
      return;
    }

    setIsGeneratingMeme(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a funny and creative meme idea based on: "${memePrompt}". 
              Please provide:
              1. A catchy post title (max 60 characters)
              2. A detailed description for the meme (2-3 sentences)
              3. A creative caption that would work well with the meme
              4. 5-7 relevant hashtags
              5. A category (like "humor", "relatable", "trending", "lifestyle", etc.)
              
              Make it engaging, shareable, and appropriate for social media. The content should be original and avoid any copyrighted material.
              
              Format your response as JSON:
              {
                "title": "...",
                "description": "...",
                "caption": "...",
                "hashtags": "...",
                "category": "..."
              }`
            }]
          }]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'AI generation failed');
      }

      // Extract the JSON from the AI response
      const aiText = data.candidates[0]?.content?.parts[0]?.text || '';
      console.log('AI Response:', aiText);
      
      // Try to parse JSON from the response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedContent = JSON.parse(jsonMatch[0]);
        setAiGeneratedContent(parsedContent);
        
        // Auto-fill the form with AI generated content
        setTitle(parsedContent.title);
        setDescription(parsedContent.description);
        setCaption(parsedContent.caption);
        setHashtags(parsedContent.hashtags);
        setCategory(parsedContent.category);
        
        Alert.alert('✨ AI Meme Generated!', 'Your meme idea has been generated and filled into the form. You can edit it before posting.');
      } else {
        throw new Error('Could not parse AI response');
      }
      
    } catch (error) {
      console.error('AI Generation Error:', error);
      Alert.alert('Error', 'Failed to generate meme idea. Please try again.');
    } finally {
      setIsGeneratingMeme(false);
    }
  };

  // Generate random meme prompts for inspiration
  const getRandomMemePrompt = () => {
    const prompts = [
      "Monday morning struggles",
      "When you see your ex with someone new",
      "Trying to adult but failing",
      "Online shopping vs reality",
      "Expectations vs reality",
      "When someone says pineapple belongs on pizza",
      "Me trying to save money",
      "Social media vs real life",
      "When you remember something embarrassing from 10 years ago",
      "Trying to look busy at work"
    ];
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    setMemePrompt(randomPrompt);
  };

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

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to add location to your post');
        setIsGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (geocode.length > 0) {
        const place = geocode[0];
        const name = place.name || '';
        const city = place.city || '';
        const region = place.region || '';
        const country = place.country || '';
        
        setPlaceName([name, city, region, country].filter(Boolean).join(', '));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const removeLocation = () => {
    setLocation(null);
    setPlaceName('');
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
    } as any);

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
      
      const postData: any = {
        uid: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        likes: [],
        comments: [],
        isAiGenerated: aiGeneratedContent ? true : false, // Flag to indicate AI-generated content
        ...(type === 'posts'
          ? { title, description, image: mediaUrl, category, hashtags }
          : { caption, videoUrl: mediaUrl, musicName, hashtags }),
      };
      
      if (location) {
        postData.location = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          placeName: placeName,
        };
      }
      
      await addDoc(collection(db, type), postData);
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
    setLocation(null);
    setPlaceName('');
    setAiGeneratedContent(null);
    setMemePrompt('');
    setShowAiSection(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Create {type}</Text>
      
      {/* AI Meme Generator Section */}
      <View style={styles.aiSection}>
        <TouchableOpacity 
          style={styles.aiToggleButton} 
          onPress={() => setShowAiSection(!showAiSection)}
        >
          <Text style={styles.aiToggleText}>
            ✨ AI Meme Generator {showAiSection ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        
        {showAiSection && (
          <View style={styles.aiContent}>
            <Text style={styles.aiDescription}>
              Let AI create awesome meme ideas for you! Just describe what kind of meme you want.
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Describe your meme idea (e.g., 'funny cat memes', 'work from home struggles')"
              value={memePrompt}
              onChangeText={setMemePrompt}
              multiline
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.smallButton, styles.randomButton]} 
                onPress={getRandomMemePrompt}
              >
                <Text style={styles.smallButtonText}>🎲 Random Idea</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.smallButton, styles.generateButton]} 
                onPress={generateMemeWithAI}
                disabled={isGeneratingMeme}
              >
                <Text style={styles.smallButtonText}>
                  {isGeneratingMeme ? '🤖 Generating...' : '✨ Generate Meme'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {aiGeneratedContent && (
              <View style={styles.aiPreview}>
                <Text style={styles.aiPreviewTitle}>🤖 AI Generated Content:</Text>
                <Text style={styles.aiPreviewText}>Title: {aiGeneratedContent.title}</Text>
                <Text style={styles.aiPreviewText}>Category: {aiGeneratedContent.category}</Text>
                <Text style={styles.aiPreviewHint}>Content has been auto-filled below. You can edit it!</Text>
              </View>
            )}
          </View>
        )}
      </View>

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
          <View style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, aiGeneratedContent && styles.aiFilledInput]} 
              placeholder="Title" 
              value={title} 
              onChangeText={setTitle} 
            />
            {aiGeneratedContent && title === aiGeneratedContent.title && (
              <Text style={styles.aiLabel}>🤖 AI</Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, aiGeneratedContent && styles.aiFilledInput]} 
              placeholder="Description" 
              value={description} 
              onChangeText={setDescription} 
              multiline
            />
            {aiGeneratedContent && description === aiGeneratedContent.description && (
              <Text style={styles.aiLabel}>🤖 AI</Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, aiGeneratedContent && styles.aiFilledInput]} 
              placeholder="Category" 
              value={category} 
              onChangeText={setCategory} 
            />
            {aiGeneratedContent && category === aiGeneratedContent.category && (
              <Text style={styles.aiLabel}>🤖 AI</Text>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, aiGeneratedContent && styles.aiFilledInput]} 
              placeholder="Caption" 
              value={caption} 
              onChangeText={setCaption} 
              multiline
            />
            {aiGeneratedContent && caption === aiGeneratedContent.caption && (
              <Text style={styles.aiLabel}>🤖 AI</Text>
            )}
          </View>
          <TextInput 
            style={styles.input} 
            placeholder="Music Name (optional)" 
            value={musicName} 
            onChangeText={setMusicName} 
          />
        </>
      )}

      <View style={styles.inputContainer}>
        <TextInput 
          style={[styles.input, aiGeneratedContent && styles.aiFilledInput]} 
          placeholder="Hashtags (comma separated)" 
          value={hashtags} 
          onChangeText={setHashtags} 
        />
        {aiGeneratedContent && hashtags === aiGeneratedContent.hashtags && (
          <Text style={styles.aiLabel}>🤖 AI</Text>
        )}
      </View>
      
      {/* Location Section */}
      <View style={styles.locationSection}>
        <Text style={styles.sectionHeading}>Location (optional)</Text>
        
        {location ? (
          <>
            <TextInput 
              style={styles.input} 
              placeholder="Place name" 
              value={placeName} 
              onChangeText={setPlaceName} 
            />
            <Button title="Remove Location" onPress={removeLocation} color="#E63946" />
          </>
        ) : (
          <Button 
            title="Add Current Location" 
            onPress={getCurrentLocation} 
            color="#457B9D"
            disabled={isGettingLocation}
          />
        )}
      </View>

      <View style={styles.bottomButtons}>
        <Button title="Upload" onPress={handleUpload} color="#006D77" />
        <View style={styles.buttonSpacer} />
        <Button 
          title={`Switch to ${type === 'posts' ? 'Reels' : 'Posts'}`} 
          onPress={() => setType(type === 'posts' ? 'reels' : 'posts')} 
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#EDF6F9' 
  },
  heading: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#006D77', 
    marginBottom: 16 
  },
  input: { 
    backgroundColor: '#fff', 
    padding: 10, 
    marginBottom: 12, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  aiFilledInput: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#f0fff0'
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 0
  },
  aiLabel: {
    position: 'absolute',
    top: -8,
    right: 10,
    backgroundColor: '#4CAF50',
    color: 'white',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: 'bold'
  },
  preview: { 
    width: '100%', 
    height: 200, 
    marginVertical: 10, 
    borderRadius: 10 
  },
  previewText: { 
    marginVertical: 10, 
    fontSize: 16, 
    color: '#333' 
  },
  locationSection: { 
    marginVertical: 15 
  },
  sectionHeading: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#006D77', 
    marginBottom: 10 
  },
  aiSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  aiToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  aiToggleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#006D77'
  },
  aiContent: {
    marginTop: 10
  },
  aiDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  smallButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 5
  },
  randomButton: {
    backgroundColor: '#457B9D'
  },
  generateButton: {
    backgroundColor: '#006D77'
  },
  smallButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12
  },
  aiPreview: {
    backgroundColor: '#f0fff0',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50'
  },
  aiPreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8
  },
  aiPreviewText: {
    fontSize: 14,
    color: '#388E3C',
    marginBottom: 4
  },
  aiPreviewHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8
  },
  bottomButtons: {
    marginTop: 20,
    marginBottom: 30
  },
  buttonSpacer: {
    height: 10
  }
});

// Additional configuration needed:
// 1. Install Google AI SDK: npm install @google/generative-ai
// 2. Get Google AI API key from: https://makersuite.google.com/app/apikey
// 3. Add the API key to your environment variables or secure storage