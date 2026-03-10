import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, MotiText } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#F50057',
  secondary: '#6366F1',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  error: '#EF4444',
  white: '#FFFFFF',
  inputBg: '#F3F4F6',
  border: '#E5E7EB',
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Oops!', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/home');
    } catch (error) {
      let message = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      }
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Decorative Background Elements */}
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'timing', duration: 800 }}
        style={styles.decorTop}
      >
        <LinearGradient
          colors={['#FF4D4D', '#F50057']}
          style={styles.decorGradient}
        />
      </MotiView>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -30 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 200 }}
            style={styles.header}
          >
            <View style={styles.logoSmall}>
              <Ionicons name="planet" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.subtitleText}>Sign in to continue to Certano</Text>
          </MotiView>

          {/* Form Container */}
          <MotiView
            from={{ opacity: 0, translateY: 30 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 400 }}
            style={styles.formContainer}
          >
            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email</Text>
              <MotiView
                animate={{
                  borderColor: focusedInput === 'email' ? COLORS.primary : COLORS.border,
                  scale: focusedInput === 'email' ? 1.01 : 1,
                }}
                transition={{ type: 'timing', duration: 200 }}
                style={styles.inputContainer}
              >
                <Ionicons 
                  name="mail-outline" 
                  size={22} 
                  color={focusedInput === 'email' ? COLORS.primary : COLORS.textTertiary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={COLORS.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="login-email-input"
                />
              </MotiView>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <MotiView
                animate={{
                  borderColor: focusedInput === 'password' ? COLORS.primary : COLORS.border,
                  scale: focusedInput === 'password' ? 1.01 : 1,
                }}
                transition={{ type: 'timing', duration: 200 }}
                style={styles.inputContainer}
              >
                <Ionicons 
                  name="lock-closed-outline" 
                  size={22} 
                  color={focusedInput === 'password' ? COLORS.primary : COLORS.textTertiary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  testID="login-password-input"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  testID="toggle-password-btn"
                >
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={22} 
                    color={COLORS.textTertiary} 
                  />
                </TouchableOpacity>
              </MotiView>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassword} testID="forgot-password-btn">
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: loading ? 0.98 : 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <TouchableOpacity 
                onPress={handleLogin} 
                disabled={loading}
                activeOpacity={0.9}
                testID="login-submit-btn"
              >
                <LinearGradient
                  colors={loading ? ['#D1D5DB', '#9CA3AF'] : ['#FF4D4D', '#F50057']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButton}
                >
                  {loading ? (
                    <MotiView
                      from={{ rotate: '0deg' }}
                      animate={{ rotate: '360deg' }}
                      transition={{ type: 'timing', duration: 1000, loop: true }}
                    >
                      <Ionicons name="reload" size={24} color={COLORS.white} />
                    </MotiView>
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Sign In</Text>
                      <Ionicons name="arrow-forward" size={22} color={COLORS.white} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialContainer}>
              <TouchableOpacity style={styles.socialButton} testID="google-login-btn">
                <Ionicons name="logo-google" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} testID="apple-login-btn">
                <Ionicons name="logo-apple" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} testID="facebook-login-btn">
                <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              </TouchableOpacity>
            </View>
          </MotiView>

          {/* Sign Up Link */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 800 }}
            style={styles.signupContainer}
          >
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signup')} testID="goto-signup-btn">
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.12,
    paddingBottom: 40,
  },
  decorTop: {
    position: 'absolute',
    top: -height * 0.15,
    right: -width * 0.3,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width,
    overflow: 'hidden',
  },
  decorGradient: {
    flex: 1,
    opacity: 0.15,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoSmall: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 0, 87, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  formContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#F50057',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signupText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  signupLink: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
