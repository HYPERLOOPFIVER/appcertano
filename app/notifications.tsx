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
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
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
  unread: '#FFF0F3',
};

const NOTIFICATION_CONFIG = {
  like: { icon: 'heart', color: '#F50057', text: 'liked your post' },
  comment: { icon: 'chatbubble', color: '#6366F1', text: 'commented on your post' },
  follow: { icon: 'person-add', color: '#10B981', text: 'started following you' },
  mention: { icon: 'at', color: '#F59E0B', text: 'mentioned you' },
  reply: { icon: 'return-down-forward', color: '#3B82F6', text: 'replied to your comment' },
  reel_like: { icon: 'heart', color: '#F50057', text: 'liked your reel' },
  reel_comment: { icon: 'chatbubble', color: '#6366F1', text: 'commented on your reel' },
  story_view: { icon: 'eye', color: '#8B5CF6', text: 'viewed your story' },
};

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usersData, setUsersData] = useState({});
  
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', currentUserId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = [];
      
      for (const notifDoc of snapshot.docs) {
        const notification = { id: notifDoc.id, ...notifDoc.data() };
        
        if (notification.senderId && !usersData[notification.senderId]) {
          const userDoc = await getDoc(doc(db, 'users', notification.senderId));
          if (userDoc.exists()) {
            setUsersData((prev) => ({
              ...prev,
              [notification.senderId]: { id: userDoc.id, ...userDoc.data() },
            }));
          }
        }
        
        data.push(notification);
      }
      
      setNotifications(data);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handlePress = (notification) => {
    markAsRead(notification.id);
    
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.postId) router.push(`/post/${notification.postId}`);
        break;
      case 'reel_like':
      case 'reel_comment':
        if (notification.reelId) router.push('/reels');
        break;
      case 'follow':
      case 'story_view':
        if (notification.senderId) router.push(`/profile/${notification.senderId}`);
        break;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const diff = (Date.now() - date.getTime()) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderNotification = ({ item, index }) => {
    const sender = usersData[item.senderId] || {};
    const config = NOTIFICATION_CONFIG[item.type] || NOTIFICATION_CONFIG.like;
    
    return (
      <MotiView
        from={{ opacity: 0, translateX: -30 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 400, delay: index * 60 }}
      >
        <TouchableOpacity
          style={[styles.notificationItem, !item.read && styles.unreadItem]}
          onPress={() => handlePress(item)}
          testID={`notification-${item.id}`}
        >
          <TouchableOpacity onPress={() => router.push(`/profile/${item.senderId}`)}>
            {sender.profilePic ? (
              <Image source={{ uri: sender.profilePic }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{(sender.name || 'U')[0].toUpperCase()}</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
          
          <View style={styles.notificationContent}>
            <Text style={styles.notificationText}>
              <Text style={styles.senderName}>{sender.name || 'Someone'}</Text>
              {' '}{config.text}
            </Text>
            {item.text && (
              <Text style={styles.previewText} numberOfLines={1}>"{item.text}"</Text>
            )}
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
          
          <View style={[styles.typeIcon, { backgroundColor: `${config.color}20` }]}>
            <Ionicons name={config.icon} size={18} color={config.color} />
          </View>
        </TouchableOpacity>
      </MotiView>
    );
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
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.headerBtn} testID="settings-btn">
          <Ionicons name="options-outline" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </MotiView>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notificationsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={styles.emptyContainer}
            >
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.emptyIcon}>
                <Ionicons name="notifications" size={40} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptyText}>You'll see notifications for likes, comments, and follows here</Text>
            </MotiView>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
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
  notificationsList: {
    padding: 16,
  },
  notificationItem: {
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
  unreadItem: {
    backgroundColor: COLORS.unread,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  notificationText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  senderName: {
    fontWeight: '700',
  },
  previewText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
