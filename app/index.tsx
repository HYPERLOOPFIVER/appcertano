import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, MotiText } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#F50057',
  secondary: '#6366F1',
  white: '#FFFFFF',
  textPrimary: '#1F2937',
};

export default function Splash() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Animated Background Gradient */}
      <LinearGradient
        colors={['#1F2937', '#111827', '#0F172A']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative Circles */}
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.1 }}
        transition={{ type: 'timing', duration: 1000, delay: 200 }}
        style={styles.decorCircle1}
      />
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.08 }}
        transition={{ type: 'timing', duration: 1000, delay: 400 }}
        style={styles.decorCircle2}
      />
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.05 }}
        transition={{ type: 'timing', duration: 1000, delay: 600 }}
        style={styles.decorCircle3}
      />

      {/* Logo Container */}
      <View style={styles.content}>
        {/* Pulsing Logo */}
        <MotiView
          from={{ scale: 0, rotate: '-180deg' }}
          animate={{ scale: 1, rotate: '0deg' }}
          transition={{ type: 'spring', damping: 10, delay: 300 }}
          style={styles.logoContainer}
        >
          <LinearGradient
            colors={['#FF4D4D', '#F50057']}
            style={styles.logoGradient}
          >
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ 
                type: 'timing', 
                duration: 2000,
                loop: true,
              }}
            >
              <Ionicons name="planet" size={60} color={COLORS.white} />
            </MotiView>
          </LinearGradient>
        </MotiView>

        {/* App Name */}
        <MotiText
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 600 }}
          style={styles.title}
        >
          Certano
        </MotiText>

        {/* Tagline */}
        <MotiText
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 800 }}
          style={styles.subtitle}
        >
          India's First Social Media Platform
        </MotiText>

        {/* Animated dots */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1000 }}
          style={styles.dotsContainer}
        >
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ scale: 0.5, opacity: 0.3 }}
              animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
              transition={{
                type: 'timing',
                duration: 1000,
                delay: i * 200,
                loop: true,
              }}
              style={styles.dot}
            />
          ))}
        </MotiView>
      </View>

      {/* Get Started Button */}
      <MotiView
        from={{ opacity: 0, translateY: 50 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 15, delay: 1200 }}
        style={styles.buttonContainer}
      >
        <MotiView
          from={{ scale: 1 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
        >
          <LinearGradient
            colors={['#FF4D4D', '#F50057']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text 
              style={styles.buttonText}
              onPress={() => router.replace('/login')}
              testID="get-started-btn"
            >
              Get Started
            </Text>
            <MotiView
              from={{ translateX: 0 }}
              animate={{ translateX: [0, 5, 0] }}
              transition={{ type: 'timing', duration: 1500, loop: true }}
            >
              <Ionicons name="arrow-forward" size={24} color={COLORS.white} />
            </MotiView>
          </LinearGradient>
        </MotiView>

        {/* Terms Text */}
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1500 }}
          style={styles.termsText}
        >
          By continuing, you agree to our Terms & Privacy Policy
        </MotiText>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorCircle1: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    backgroundColor: '#F50057',
    top: -width * 0.5,
    right: -width * 0.5,
  },
  decorCircle2: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width,
    backgroundColor: '#6366F1',
    bottom: -width * 0.3,
    left: -width * 0.5,
  },
  decorCircle3: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width,
    backgroundColor: '#F50057',
    bottom: height * 0.3,
    right: -width * 0.3,
  },
  content: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logoContainer: {
    marginBottom: 32,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F50057',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F50057',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 100,
    gap: 12,
    shadowColor: '#F50057',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 20,
    textAlign: 'center',
  },
});
