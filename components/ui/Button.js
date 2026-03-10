import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, RADIUS, SHADOWS, FONT_SIZE } from '../constants/theme';

// Animated Button Component
export const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false, 
  disabled = false,
  icon,
  style,
  testID,
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  if (isPrimary) {
    return (
      <MotiView
        from={{ scale: 1 }}
        animate={{ scale: disabled ? 1 : 1 }}
        transition={{ type: 'spring', damping: 15 }}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.8}
          testID={testID}
          style={[styles.buttonBase, style]}
        >
          <LinearGradient
            colors={disabled ? ['#D1D5DB', '#9CA3AF'] : GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                {icon}
                <Text style={styles.primaryButtonText}>{title}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
      style={[
        styles.buttonBase,
        isSecondary && styles.secondaryButton,
        isGhost && styles.ghostButton,
        disabled && styles.disabledButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? COLORS.primary : COLORS.textSecondary} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.buttonText,
            isSecondary && styles.secondaryButtonText,
            isGhost && styles.ghostButtonText,
          ]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Avatar Component with Gradient Ring
export const Avatar = ({ 
  uri, 
  name = 'U', 
  size = 50, 
  showRing = false,
  ringColors,
  onPress,
  testID,
}) => {
  const content = (
    <MotiView
      from={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 12 }}
    >
      {showRing ? (
        <LinearGradient
          colors={ringColors || GRADIENTS.storyRing}
          style={[
            styles.avatarRing,
            { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }
          ]}
        >
          <AvatarInner uri={uri} name={name} size={size - 4} />
        </LinearGradient>
      ) : (
        <AvatarInner uri={uri} name={name} size={size} />
      )}
    </MotiView>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} testID={testID}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const AvatarInner = ({ uri, name, size }) => {
  if (uri) {
    return (
      <MotiView
        style={[
          styles.avatarContainer,
          { width: size, height: size, borderRadius: size / 2 }
        ]}
      >
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
        >
          <Image 
            source={{ uri }} 
            style={{ width: size, height: size }} 
            resizeMode="cover"
          />
        </MotiView>
      </MotiView>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.purple}
      style={[
        styles.avatarPlaceholder,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size / 2.5 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </LinearGradient>
  );
};

// Import Image from react-native
import { Image } from 'react-native';

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: RADIUS.full,
    gap: 8,
    ...SHADOWS.lg,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.surfaceLight,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: FONT_SIZE.base,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
  },
  ghostButtonText: {
    color: COLORS.textSecondary,
  },
  avatarRing: {
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default { Button, Avatar };
