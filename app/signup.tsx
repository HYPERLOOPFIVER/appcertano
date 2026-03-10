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
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
  success: '#10B981',
  white: '#FFFFFF',
  inputBg: '#F3F4F6',
  border: '#E5E7EB',
};

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Oops!', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Oops!', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Oops!', 'Password must be at least 6 characters');
      return;
    }

    if (!agreeTerms) {
      Alert.alert('Terms Required', 'Please agree to the Terms & Privacy Policy');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        email: email.trim(),
        profilePic: null,
        coverImage: null,
        bio: '',
        website: '',
        location: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Welcome! 🎉', 'Your account has been created successfully!', [
        { text: 'Let\'s Go!', onPress: () => router.replace('/home') }
      ]);
    } catch (error) {
      let message = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak';
      }
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, text: '', color: COLORS.border };
    if (password.length < 4) return { level: 1, text: 'Weak', color: COLORS.error };
    if (password.length < 8) return { level: 2, text: 'Medium', color: COLORS.warning };
    return { level: 3, text: 'Strong', color: COLORS.success };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Decorative Background */}
      <MotiView
        from={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'timing', duration: 800 }}
        style={styles.decorTop}
      >
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
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
          {/* Back Button */}
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 100 }}
          >
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
              testID="back-btn"
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </MotiView>

          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 200 }}
            style={styles.header}
          >
            <Text style={styles.welcomeText}>Create Account</Text>
            <Text style={styles.subtitleText}>Join Certano today!</Text>
          </MotiView>

          {/* Form Container */}
          <MotiView
            from={{ opacity: 0, translateY: 30 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 400 }}
            style={styles.formContainer}
          >
            {/* Name Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <MotiView
                animate={{
                  borderColor: focusedInput === 'name' ? COLORS.secondary : COLORS.border,
                }}
                style={styles.inputContainer}
              >
                <Ionicons 
                  name="person-outline" 
                  size={22} 
                  color={focusedInput === 'name' ? COLORS.secondary : COLORS.textTertiary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                  testID="signup-name-input"
                />
              </MotiView>
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email</Text>
              <MotiView
                animate={{
                  borderColor: focusedInput === 'email' ? COLORS.secondary : COLORS.border,
                }}
                style={styles.inputContainer}
              >
                <Ionicons 
                  name="mail-outline" 
                  size={22} 
                  color={focusedInput === 'email' ? COLORS.secondary : COLORS.textTertiary} 
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
                  testID="signup-email-input"
                />
              </MotiView>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Password</Text>
              <MotiView
                animate={{
                  borderColor: focusedInput === 'password' ? COLORS.secondary : COLORS.border,
                }}
                style={styles.inputContainer}
              >
                <Ionicons 
                  name="lock-closed-outline" 
                  size={22} 
                  color={focusedInput === 'password' ? COLORS.secondary : COLORS.textTertiary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Create a password"
                  placeholderTextColor={COLORS.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  testID="signup-password-input"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={22} 
                    color={COLORS.textTertiary} 
                  />
                </TouchableOpacity>
              </MotiView>
              
              {/* Password Strength */}
              {password.length > 0 && (
                <MotiView
                  from={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={styles.strengthContainer}
                >
                  <View style={styles.strengthBars}>
                    {[1, 2, 3].map((level) => (
                      <MotiView
                        key={level}
                        animate={{
                          backgroundColor: level <= passwordStrength.level 
                            ? passwordStrength.color 
                            : COLORS.border,
                        }}
                        style={styles.strengthBar}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.text}
                  </Text>
                </MotiView>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <MotiView
                animate={{
                  borderColor: focusedInput === 'confirm' 
                    ? (confirmPassword && confirmPassword === password ? COLORS.success : COLORS.secondary) 
                    : COLORS.border,
                }}
                style={styles.inputContainer}
              >
                <Ionicons 
                  name="shield-checkmark-outline" 
                  size={22} 
                  color={focusedInput === 'confirm' ? COLORS.secondary : COLORS.textTertiary} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor={COLORS.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedInput('confirm')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  testID="signup-confirm-password-input"
                />
                {confirmPassword.length > 0 && (
                  <Ionicons 
                    name={confirmPassword === password ? 'checkmark-circle' : 'close-circle'} 
                    size={22} 
                    color={confirmPassword === password ? COLORS.success : COLORS.error} 
                  />
                )}
              </MotiView>
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity 
              style={styles.termsContainer}
              onPress={() => setAgreeTerms(!agreeTerms)}
              testID="agree-terms-checkbox"
            >
              <MotiView
                animate={{
                  backgroundColor: agreeTerms ? COLORS.secondary : 'transparent',
                  borderColor: agreeTerms ? COLORS.secondary : COLORS.border,
                }}
                style={styles.checkbox}
              >
                {agreeTerms && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </MotiView>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Signup Button */}
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: loading ? 0.98 : 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <TouchableOpacity 
                onPress={handleSignup} 
                disabled={loading}
                activeOpacity={0.9}
                testID="signup-submit-btn"
              >
                <LinearGradient
                  colors={loading ? ['#D1D5DB', '#9CA3AF'] : ['#6366F1', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signupButton}
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
                      <Text style={styles.signupButtonText}>Create Account</Text>
                      <Ionicons name="sparkles" size={22} color={COLORS.white} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>
          </MotiView>

          {/* Login Link */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 800 }}
            style={styles.loginContainer}
          >
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/login')} testID="goto-login-btn">
              <Text style={styles.loginLink}>Sign In</Text>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  decorTop: {
    position: 'absolute',
    top: -height * 0.2,
    left: -width * 0.3,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width,
    overflow: 'hidden',
  },
  decorGradient: {
    flex: 1,
    opacity: 0.12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: 32,
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
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  signupButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  loginText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
});
