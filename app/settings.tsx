import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StatusBar,
  Linking,
  Image,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const COLORS = {
  primary: '#F50057',
  primaryLight: '#FF4D4D',
  secondary: '#6366F1',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [privateAccount, setPrivateAccount] = useState(false);
  const [activityStatus, setActivityStatus] = useState(true);
  const [loading, setLoading] = useState(true);

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    if (!currentUserId) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUser(data);
        setNotifications(data.settings?.notifications ?? true);
        setDarkMode(data.settings?.darkMode ?? false);
        setPrivateAccount(data.settings?.privateAccount ?? false);
        setActivityStatus(data.settings?.activityStatus ?? true);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    if (!currentUserId) return;
    try {
      await updateDoc(doc(db, 'users', currentUserId), {
        [`settings.${key}`]: value,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contact Support', 'Please contact support@certano.app to delete your account.');
          },
        },
      ]
    );
  };

  const SettingItem = ({ icon, iconColor, title, subtitle, onPress, rightElement, showArrow = true }) => (
    <TouchableOpacity 
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showArrow && onPress && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
      ))}
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </MotiView>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Profile Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 100 }}
        >
          <TouchableOpacity 
            style={styles.profileCard}
            onPress={() => router.push('/profile')}
            testID="edit-profile-btn"
          >
            <LinearGradient
              colors={['rgba(245,0,87,0.1)', 'rgba(99,102,241,0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileGradient}
            >
              {user?.profilePic ? (
                <Image source={{ uri: user.profilePic }} style={styles.profileImage} />
              ) : (
                <LinearGradient colors={['#F50057', '#FF6B6B']} style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileInitial}>{(user?.name || 'U')[0]}</Text>
                </LinearGradient>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name || 'User'}</Text>
                <Text style={styles.profileEmail}>{auth.currentUser?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textTertiary} />
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>

        {/* Account Settings */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}
        >
          <SectionTitle title="Account" />
          <View style={styles.settingsGroup}>
            <SettingItem
              icon="person-outline"
              iconColor={COLORS.secondary}
              title="Edit Profile"
              subtitle="Change photo, name, bio"
              onPress={() => router.push('/edit-profile')}
            />
            <SettingItem
              icon="lock-closed-outline"
              iconColor={COLORS.primary}
              title="Password & Security"
              subtitle="Update password, 2FA"
              onPress={() => Alert.alert('Coming Soon', 'This feature will be available soon!')}
            />
            <SettingItem
              icon="card-outline"
              iconColor="#10B981"
              title="Premium"
              subtitle="Upgrade for more features"
              onPress={() => Alert.alert('Coming Soon', 'Premium features coming soon!')}
            />
          </View>
        </MotiView>

        {/* Privacy Settings */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 300 }}
        >
          <SectionTitle title="Privacy" />
          <View style={styles.settingsGroup}>
            <SettingItem
              icon="eye-off-outline"
              iconColor="#8B5CF6"
              title="Private Account"
              subtitle="Only followers can see your posts"
              rightElement={
                <Switch
                  value={privateAccount}
                  onValueChange={(value) => {
                    setPrivateAccount(value);
                    updateSetting('privateAccount', value);
                  }}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              }
              showArrow={false}
            />
            <SettingItem
              icon="radio-outline"
              iconColor="#06B6D4"
              title="Activity Status"
              subtitle="Show when you're online"
              rightElement={
                <Switch
                  value={activityStatus}
                  onValueChange={(value) => {
                    setActivityStatus(value);
                    updateSetting('activityStatus', value);
                  }}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              }
              showArrow={false}
            />
            <SettingItem
              icon="ban-outline"
              iconColor={COLORS.error}
              title="Blocked Accounts"
              onPress={() => Alert.alert('Blocked Accounts', 'No blocked accounts yet.')}
            />
          </View>
        </MotiView>

        {/* Notifications */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 }}
        >
          <SectionTitle title="Notifications" />
          <View style={styles.settingsGroup}>
            <SettingItem
              icon="notifications-outline"
              iconColor={COLORS.warning}
              title="Push Notifications"
              subtitle="Likes, comments, follows"
              rightElement={
                <Switch
                  value={notifications}
                  onValueChange={(value) => {
                    setNotifications(value);
                    updateSetting('notifications', value);
                  }}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              }
              showArrow={false}
            />
            <SettingItem
              icon="mail-outline"
              iconColor="#3B82F6"
              title="Email Notifications"
              onPress={() => Alert.alert('Email Settings', 'Configure email preferences in your profile.')}
            />
          </View>
        </MotiView>

        {/* App Settings */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 500 }}
        >
          <SectionTitle title="App" />
          <View style={styles.settingsGroup}>
            <SettingItem
              icon="moon-outline"
              iconColor="#6366F1"
              title="Dark Mode"
              subtitle="Coming soon"
              rightElement={
                <Switch
                  value={darkMode}
                  onValueChange={(value) => {
                    setDarkMode(value);
                    updateSetting('darkMode', value);
                    Alert.alert('Coming Soon', 'Dark mode will be available in the next update!');
                  }}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              }
              showArrow={false}
            />
            <SettingItem
              icon="language-outline"
              iconColor="#EC4899"
              title="Language"
              subtitle="English"
              onPress={() => Alert.alert('Language', 'More languages coming soon!')}
            />
            <SettingItem
              icon="download-outline"
              iconColor="#10B981"
              title="Data Saver"
              onPress={() => Alert.alert('Data Saver', 'Reduce data usage for media content.')}
            />
          </View>
        </MotiView>

        {/* Support */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 600 }}
        >
          <SectionTitle title="Support" />
          <View style={styles.settingsGroup}>
            <SettingItem
              icon="help-circle-outline"
              iconColor="#3B82F6"
              title="Help Center"
              onPress={() => Linking.openURL('https://certano.app/help')}
            />
            <SettingItem
              icon="chatbubble-ellipses-outline"
              iconColor="#8B5CF6"
              title="Contact Us"
              onPress={() => Linking.openURL('mailto:support@certano.app')}
            />
            <SettingItem
              icon="document-text-outline"
              iconColor={COLORS.textSecondary}
              title="Terms of Service"
              onPress={() => Linking.openURL('https://certano.app/terms')}
            />
            <SettingItem
              icon="shield-checkmark-outline"
              iconColor={COLORS.success}
              title="Privacy Policy"
              onPress={() => Linking.openURL('https://certano.app/privacy')}
            />
          </View>
        </MotiView>

        {/* Danger Zone */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 700 }}
        >
          <SectionTitle title="Account Actions" />
          <View style={styles.settingsGroup}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} testID="logout-btn">
              <Ionicons name="log-out-outline" size={22} color={COLORS.primary} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} testID="delete-btn">
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </MotiView>

        {/* App Version */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 800 }}
          style={styles.versionContainer}
        >
          <Text style={styles.versionText}>Certano v1.0.0</Text>
          <Text style={styles.versionSubtext}>Made with ❤️</Text>
        </MotiView>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  profileCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textTertiary,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsGroup: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 14,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  settingSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    marginBottom: 24,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.error,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  versionSubtext: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
});
