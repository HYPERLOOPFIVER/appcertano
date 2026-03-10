import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  doc,
} from 'firebase/firestore';
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
  online: '#10B981',
};

export default function Chats() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersData, setUsersData] = useState({});
  
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUserId),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData = [];
      
      for (const chatDoc of snapshot.docs) {
        const chat = { id: chatDoc.id, ...chatDoc.data() };
        const otherUserId = chat.participants.find((p) => p !== currentUserId);
        
        if (otherUserId && !usersData[otherUserId]) {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            setUsersData((prev) => ({
              ...prev,
              [otherUserId]: { id: userDoc.id, ...userDoc.data() },
            }));
          }
        }
        
        chatsData.push({ ...chat, otherUserId });
      }
      
      setChats(chatsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return 'Now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderChatItem = ({ item, index }) => {
    const otherUser = usersData[item.otherUserId] || {};
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => router.push(`/chat/${item.otherUserId}`)}
        testID={`chat-${item.otherUserId}`}
      >
          <View style={styles.avatarContainer}>
            {otherUser.profilePic ? (
              <Image source={{ uri: otherUser.profilePic }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(otherUser.name || 'U')[0].toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.onlineIndicator} />
          </View>
          
          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName} numberOfLines={1}>
                {otherUser.name || 'User'}
              </Text>
              <Text style={styles.chatTime}>{formatTime(item.lastMessageTime)}</Text>
            </View>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || 'Start a conversation'}
            </Text>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.headerBtn} testID="new-chat-btn">
          <Ionicons name="create-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/usersearch')}>
          <Ionicons name="search" size={20} color={COLORS.textTertiary} />
          <Text style={styles.searchPlaceholder}>Search messages...</Text>
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LinearGradient colors={['#FF4D4D', '#F50057']} style={styles.emptyIcon}>
                <Ionicons name="chatbubbles" size={40} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No Messages Yet</Text>
              <Text style={styles.emptyText}>Start a conversation with someone!</Text>
              <TouchableOpacity onPress={() => router.push('/usersearch')} testID="find-people-btn">
                <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Find People</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: COLORS.textTertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  chatsList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.online,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  chatContent: {
    flex: 1,
    marginLeft: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textTertiary,
    marginBottom: 24,
  },
  emptyButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
