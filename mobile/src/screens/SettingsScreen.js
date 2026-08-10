import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE, APP_NAME } from '../config';
import { colors } from '../theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>Role · {user?.role}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>App</Text>
        <Text style={styles.value}>{APP_NAME} · Native Android</Text>
        <Text style={styles.label}>API</Text>
        <Text style={styles.value}>{API_BASE}</Text>
        <Text style={styles.note}>
          This is the native Presence app (not the website browser shell).
        </Text>
      </View>

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, color: colors.muted, fontSize: 13 },
  label: { marginTop: 10, fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  value: { marginTop: 2, color: colors.text, fontSize: 13 },
  note: { marginTop: 12, fontSize: 12, color: colors.muted, lineHeight: 18 },
  logout: {
    marginTop: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '700' },
});
