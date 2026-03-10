// Notification helper functions - properly connected to all actions
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Notification types
export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  MENTION: 'mention',
  REPLY: 'reply',
  STORY_VIEW: 'story_view',
  REEL_LIKE: 'reel_like',
  REEL_COMMENT: 'reel_comment',
};

/**
 * Create a notification for a user
 */
export const createNotification = async (recipientId, senderId, type, data = {}) => {
  // Don't create notification for own actions
  if (recipientId === senderId) return;
  if (!recipientId || !senderId) return;

  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      senderId,
      type,
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    });
    console.log(`Notification created: ${type} from ${senderId} to ${recipientId}`);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Create a like notification for posts
 */
export const notifyPostLike = async (postOwnerId, likerId, postId) => {
  await createNotification(postOwnerId, likerId, NOTIFICATION_TYPES.LIKE, { postId });
};

/**
 * Create a like notification for reels
 */
export const notifyReelLike = async (reelOwnerId, likerId, reelId) => {
  await createNotification(reelOwnerId, likerId, NOTIFICATION_TYPES.REEL_LIKE, { reelId });
};

/**
 * Create a comment notification
 */
export const notifyComment = async (postOwnerId, commenterId, postId, commentText) => {
  await createNotification(postOwnerId, commenterId, NOTIFICATION_TYPES.COMMENT, {
    postId,
    text: commentText.substring(0, 100),
  });
};

/**
 * Create a reel comment notification
 */
export const notifyReelComment = async (reelOwnerId, commenterId, reelId, commentText) => {
  await createNotification(reelOwnerId, commenterId, NOTIFICATION_TYPES.REEL_COMMENT, {
    reelId,
    text: commentText.substring(0, 100),
  });
};

/**
 * Create a follow notification
 */
export const notifyFollow = async (followedUserId, followerId) => {
  await createNotification(followedUserId, followerId, NOTIFICATION_TYPES.FOLLOW, {});
};

/**
 * Create a reply notification
 */
export const notifyReply = async (commentOwnerId, replierId, postId, replyText) => {
  await createNotification(commentOwnerId, replierId, NOTIFICATION_TYPES.REPLY, {
    postId,
    text: replyText.substring(0, 100),
  });
};

/**
 * Create a story view notification
 */
export const notifyStoryView = async (storyOwnerId, viewerId) => {
  await createNotification(storyOwnerId, viewerId, NOTIFICATION_TYPES.STORY_VIEW, {});
};

/**
 * Get post owner ID from post ID
 */
export const getPostOwnerId = async (postId) => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (postDoc.exists()) {
      return postDoc.data().uid;
    }
    return null;
  } catch (error) {
    console.error('Error getting post owner:', error);
    return null;
  }
};

/**
 * Get reel owner ID from reel ID
 */
export const getReelOwnerId = async (reelId) => {
  try {
    const reelDoc = await getDoc(doc(db, 'reels', reelId));
    if (reelDoc.exists()) {
      return reelDoc.data().uid;
    }
    return null;
  } catch (error) {
    console.error('Error getting reel owner:', error);
    return null;
  }
};
