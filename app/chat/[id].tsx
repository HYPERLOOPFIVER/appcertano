import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

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
  sent: '#006D77',
  received: '#F0F8F8',
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  
  const currentUserId = auth.currentUser?.uid;
  const chatId = [currentUserId, id].sort().join('_');

  useEffect(() => {
    if (!currentUserId || !id) return;

    // Fetch other user's data
    fetchOtherUser();

    // Create or update chat document
    createChatIfNotExists();

    // Subscribe to messages
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, currentUserId]);

  const fetchOtherUser = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', id as string));
      if (userDoc.exists()) {
        setOtherUser({ id: userDoc.id, ...userDoc.data() });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const createChatIfNotExists = async () => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [currentUserId, id],
          createdAt: serverTimestamp(),
          lastMessage: null,
          lastMessageTime: null,
        });
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Add message to subcollection
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: messageText,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
      });

      // Update chat document with last message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
      });

      // Scroll to bottom
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isSent = item.senderId === currentUserId;
    const showAvatar = !isSent && (index === 0 || messages[index - 1]?.senderId !== item.senderId);

    return (
      <View style={[styles.messageRow, isSent && styles.sentRow]}>
        {!isSent && showAvatar && (
          <View style={styles.avatarContainer}>
            {otherUser?.profilePic ? (
              <Image source={{ uri: otherUser.profilePic }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(otherUser?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}
        {!isSent && !showAvatar && <View style={styles.avatarSpacer} />}
        
        <View style={[styles.messageBubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
          <Text style={[styles.messageText, isSent && styles.sentText]}>{item.text}</Text>
          <Text style={[styles.messageTime, isSent && styles.sentTime]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => router.push(`/profile/${id}`)}
        >
          {otherUser?.profilePic ? (
            <Image source={{ uri: otherUser.profilePic }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {(otherUser?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{otherUser?.name || 'User'}</Text>
            <Text style={styles.headerStatus}>Tap to view profile</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-vertical" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn}>
            <Ionicons name="attach" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity 
            style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  headerStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  headerBtn: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  sentRow: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatarSpacer: {
    width: 40,
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sentBubble: {
    backgroundColor: COLORS.sent,
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: COLORS.received,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  sentText: {
    color: COLORS.white,
  },
  messageTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sentTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachBtn: {
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.textMuted,
  },
});
