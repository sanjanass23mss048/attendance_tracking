import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const logo = require('../../assets/splash-icon.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('neha.sharma@brightfuture.edu.in');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.tagline}>School attendance on your phone</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@school.edu"
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>Same school account as the Presence website.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    padding: 20,
  },
  hero: { marginBottom: 20, alignItems: 'center' },
  logo: {
    width: 200,
    height: 130,
  },
  logoWrap: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagline: { color: '#bfdbfe', marginTop: 14, fontSize: 15, fontWeight: '500' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: colors.danger, marginBottom: 10, fontSize: 13 },
  hint: { marginTop: 14, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
