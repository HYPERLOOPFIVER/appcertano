import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Notification types
export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  MENTION: 'mention',
  REPLY: 'reply',
};

/**
 * Create a notification for a user
 * @param {string} recipientId - The user who will receive the notification
 * @param {string} senderId - The user who triggered the notification
 * @param {string} type - The type of notification (like, comment, follow, etc.)
 * @param {object} data - Additional data (postId, text, etc.)
 */
export const createNotification = async (recipientId, senderId, type, data = {}) => {
  // Don't create notification for own actions
  if (recipientId === senderId) return;

  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      senderId,
      type,
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Create a like notification
 */
export const notifyLike = async (postOwnerId, likerId, postId) => {
  await createNotification(postOwnerId, likerId, NOTIFICATION_TYPES.LIKE, { postId });
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
