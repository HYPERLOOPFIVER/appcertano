import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;
const imageSize = (screenWidth - 48) / 2;

export default function Explore() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchExploreData = async () => {
    try {
      const postRef = collection(db, 'posts');
      const reelsRef = collection(db, 'reels');
      const usersRef = collection(db, 'users');

      const [postsSnap, reelsSnap, usersSnap] = await Promise.all([
        getDocs(query(postRef, orderBy('createdAt', 'desc'))),
        getDocs(query(reelsRef, orderBy('createdAt', 'desc'))),
        getDocs(usersRef),
      ]);

      const postData = postsSnap.docs.map((doc) => ({ id: doc.id, type: 'post', ...doc.data() }));
      const reelsData = reelsSnap.docs.map((doc) => ({ id: doc.id, type: 'reel', ...doc.data() }));
      const userData = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const mixedData = [...postData, ...reelsData].sort(
        (a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.()
      );

      setFeedItems(mixedData);
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching explore data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExploreData();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers([]);
      return;
    }

    const filtered = users.filter((user) =>
      user.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const renderFeedItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => router.push(`/${item.type}/${item.id}`)}
    >
      {item.type === 'post' ? (
        <Image source={{ uri: item.image }} style={styles.image} />
      ) : Platform.OS === 'web' ? (
        <video
          src={item.videoUrl}
          style={styles.video}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <></>
      )}
    </TouchableOpacity>
  );

  const renderUser = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.userContainer}
      onPress={() => router.push(`/profile/${item.id}`)}
    >
      {item.profilePic ? (
        <Image source={{ uri: item.profilePic }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarLetter}>{item.username?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <Text style={styles.username}>{item.username}</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    const isSearching = searchQuery.trim().length > 0;
    return (
      <FlatList
        data={isSearching ? filteredUsers : feedItems}
        renderItem={isSearching ? renderUser : renderFeedItem}
        keyExtractor={(item) => item.id}
        numColumns={isSearching ? 1 : 2}
        key={isSearching ? 'users' : 'feed'}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={!isSearching ? styles.row : undefined}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#006D77" />
      ) : (
        renderContent()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF6F9',
    paddingTop: 50,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#006D77',
    marginBottom: 12,
    paddingLeft: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  imageContainer: {
    width: imageSize,
    height: imageSize,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ccc',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#83C5BE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    color: '#006D77',
    fontWeight: '500',
  },
});
