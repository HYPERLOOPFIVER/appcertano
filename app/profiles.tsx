import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase'; // Adjust to your Firebase config
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';


const { width } = Dimensions.get('window');
const AllUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const router = useRouter();

    useEffect(() => {
        // Get current logged-in user
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user.uid);
            } else {
                setCurrentUser(null);
            }
        });

        fetchUsersWithRelatedData();
        
        // Cleanup auth listener
        return () => unsubscribe();
    }, []);

    const fetchUsersWithRelatedData = async () => {
        try {
            setError(null);
            const usersCollectionRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersCollectionRef);
            
            const usersList = await Promise.all(
                usersSnapshot.docs.map(async (userDoc) => {
                    const userData = userDoc.data();
                    const userId = userDoc.id;
                    
                    // Query posts related to this user
                    const postsQuery = query(
                        collection(db, 'posts'),
                        where('uid', '==', userId)
                    );
                    const postsSnapshot = await getDocs(postsQuery);
                    const postsCount = postsSnapshot.size;
                    
                    // Query reels related to this user
                    const reelsQuery = query(
                        collection(db, 'reels'),
                        where('uid', '==', userId)
                    );
                    const reelsSnapshot = await getDocs(reelsQuery);
                    const reelsCount = reelsSnapshot.size;
                    
                    return {
                        id: userId,
                        name: userData.name || 'Unknown',
                        email: userData.email || 'No email',
                        bio: userData.bio || 'No bio',
                        profilePic: userData.profilePic || null,
                        followers: Array.isArray(userData.followers) 
                            ? userData.followers 
                            : [],
                        following: Array.isArray(userData.following)
                            ? userData.following
                            : [],
                        posts: postsCount,
                        reels: reelsCount,
                    };
                })
            );
            
            setUsers(usersList);
        } catch (err) {
            setError('Error fetching users: ' + err.message);
            console.error('Firebase Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchUsersWithRelatedData();
    };

    const handleProfileClick = (userId) => {
        try {
            if (currentUser === userId) {
                // Navigate to own profile
                router.push('/profile');
            } else {
                // Navigate to another user's profile
                router.push(`/user-profile/${userId}`);
            }
        } catch (error) {
            Alert.alert('Navigation Error', 'Unable to navigate to profile');
        }
    };

    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const renderUserItem = ({ item: user }) => (
        <View style={styles.userCard}>
            <TouchableOpacity
                style={styles.userHeader}
                onPress={() => handleProfileClick(user.id)}
                activeOpacity={0.7}
            >
                {/* Profile Picture */}
                <View style={styles.profilePicContainer}>
                    {user.profilePic ? (
                        <Image
                            source={{ uri: user.profilePic }}
                            style={styles.profilePic}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.profilePlaceholder}>
                            <Text style={styles.profilePlaceholderText}>
                                {user.name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                        {user.name}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1}>
                        {user.email}
                    </Text>
                    {user.bio && user.bio !== 'No bio' && (
                        <Text style={styles.userBio} numberOfLines={2}>
                            {user.bio}
                        </Text>
                    )}
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        currentUser === user.id ? styles.ownProfileButton : styles.otherProfileButton
                    ]}
                    onPress={() => handleProfileClick(user.id)}
                >
                    <Text
                        style={[
                            styles.actionButtonText,
                            currentUser === user.id ? styles.ownProfileButtonText : styles.otherProfileButtonText
                        ]}
                    >
                        {currentUser === user.id ? 'View Profile' : 'Visit'}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>

            {/* Stats Section */}
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Ionicons name="heart" size={16} color="#888" />
                    <Text style={styles.statNumber}>{formatNumber(user.followers.length)}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="people" size={16} color="#888" />
                    <Text style={styles.statNumber}>{formatNumber(user.following?.length || 0)}</Text>
                    <Text style={styles.statLabel}>Following</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="camera" size={16} color="#888" />
                    <Text style={styles.statNumber}>{formatNumber(user.posts)}</Text>
                    <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="videocam" size={16} color="#888" />
                    <Text style={styles.statNumber}>{formatNumber(user.reels)}</Text>
                    <Text style={styles.statLabel}>Reels</Text>
                </View>
            </View>
        </View>
    );

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerContent}>
                <Ionicons name="people" size={24} color="#007AFF" />
                <Text style={styles.headerTitle}>Discover People</Text>
            </View>
            <TouchableOpacity>
                <Ionicons name="ellipsis-horizontal" size={24} color="#666" />
            </TouchableOpacity>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#CCC" />
            <Text style={styles.emptyStateTitle}>No Users Found</Text>
            <Text style={styles.emptyStateText}>
                There are no users to display at the moment. Pull down to refresh!
            </Text>
        </View>
    );

    const renderError = () => (
        <View style={styles.errorContainer}>
            <Ionicons name="warning" size={48} color="#FF6B6B" />
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchUsersWithRelatedData}>
                <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading users...</Text>
            </View>
        );
    }

    if (error && users.length === 0) {
        return (
            <View style={styles.container}>
                {renderHeader()}
                {renderError()}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#007AFF']}
                        tintColor="#007AFF"
                    />
                }
            />
        </View>
    );
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        padding: 16,
    },
    emptyContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        marginLeft: 8,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    userCard: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profilePicContainer: {
        marginRight: 16,
    },
    profilePic: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    profilePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profilePlaceholderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
    },
    userBio: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
    actionButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    ownProfileButton: {
        backgroundColor: '#007AFF',
    },
    otherProfileButton: {
        backgroundColor: '#ddd',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    ownProfileButtonText: {
        color: '#fff',
    },
    otherProfileButtonText: {
        color: '#333',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 16,
        color: '#666',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF6B6B',
        marginTop: 16,
    },
    errorText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
    },
    retryButton: {
        marginTop: 16,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default AllUsers;