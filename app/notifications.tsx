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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  primary: '#006D77',
  primaryLight: '#83C5BE',
  background: '#EDF6F9',
  surface: '#FFFFFF',
  textPrimary: '#006D77',
  textSecondary: '#83C5BE',
  textMuted: '#B0C4C7',
  border: '#E9F5F6',
  white: '#FFFFFF',
  unread: '#E8F5F6',
};

const NOTIFICATION_TYPES = {
  like: { icon: 'heart', color: '#FF4757', text: 'liked your post' },
  comment: { icon: 'chatbubble', color: '#006D77', text: 'commented on your post' },
  follow: { icon: 'person-add', color: '#2E86AB', text: 'started following you' },
  mention: { icon: 'at', color: '#F4A261', text: 'mentioned you' },
  reply: { icon: 'return-down-forward', color: '#83C5BE', text: 'replied to your comment' },
};

export default function NotificationsScreen() {
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
      const notificationsData = [];
      
      for (const notifDoc of snapshot.docs) {
        const notification = { id: notifDoc.id, ...notifDoc.data() };
        
        // Fetch sender's data if not cached
        if (notification.senderId && !usersData[notification.senderId]) {
          const userDoc = await getDoc(doc(db, 'users', notification.senderId));
          if (userDoc.exists()) {
            setUsersData((prev) => ({
              ...prev,
              [notification.senderId]: { id: userDoc.id, ...userDoc.data() },
            }));
          }
        }
        
        notificationsData.push(notification);
      }
      
      setNotifications(notificationsData);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.postId) {
          router.push(`/post/${notification.postId}`);
        }
        break;
      case 'follow':
        if (notification.senderId) {
          router.push(`/profile/${notification.senderId}`);
        }
        break;
      default:
        break;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const onRefresh = () => {
    setRefreshing(true);
  };

  const renderNotificationItem = ({ item }) => {
    const sender = usersData[item.senderId] || {};
    const notifType = NOTIFICATION_TYPES[item.type] || NOTIFICATION_TYPES.like;
    
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
      >
        {/* User Avatar */}
        <TouchableOpacity onPress={() => router.push(`/profile/${item.senderId}`)}>
          {sender.profilePic ? (
            <Image source={{ uri: sender.profilePic }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(sender.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Notification Content */}
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>
            <Text style={styles.senderName}>{sender.name || 'Someone'}</Text>
            {' '}{notifType.text}
          </Text>
          {item.text && (
            <Text style={styles.previewText} numberOfLines={1}>
              "{item.text}"
            </Text>
          )}
          <Text style={styles.notificationTime}>{formatTime(item.createdAt)}</Text>
        </View>
        
        {/* Notification Type Icon */}
        <View style={[styles.typeIcon, { backgroundColor: `${notifType.color}20` }]}>
          <Ionicons name={notifType.icon} size={16} color={notifType.color} />
        </View>
        
        {/* Unread Indicator */}
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  // Group notifications by time
  const groupNotifications = () => {
    const today = [];
    const thisWeek = [];
    const earlier = [];
    const now = new Date();
    
    notifications.forEach((notif) => {
      const date = notif.createdAt?.toDate ? notif.createdAt.toDate() : new Date(notif.createdAt);
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) {
        today.push(notif);
      } else if (diffInDays < 7) {
        thisWeek.push(notif);
      } else {
        earlier.push(notif);
      }
    });
    
    return { today, thisWeek, earlier };
  };

  const { today, thisWeek, earlier } = groupNotifications();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            When someone interacts with your content, you'll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notificationsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <>
              {today.length > 0 && renderSectionHeader('Today')}
            </>
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
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerBtn: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  notificationsList: {
    padding: 16,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadNotification: {
    backgroundColor: COLORS.unread,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  notificationText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  senderName: {
    fontWeight: '600',
  },
  previewText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    marginTop: 8,
    textAlign: 'center',
  },
});
