import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getAttendanceSummary, getClasses } from '../api/presence';
import { todayYmd } from '../config';
import { colors } from '../theme';

const ROLE_LABEL = {
  INCHARGE: 'Attendance In-charge',
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
  PRINCIPAL: 'Principal',
};

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [classCount, setClassCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const date = todayYmd();

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [sum, classesRes] = await Promise.all([
        getAttendanceSummary(date),
        getClasses(),
      ]);
      setSummary(sum);
      setClassCount((classesRes.classes || []).length);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
      <Text style={styles.role}>{ROLE_LABEL[user?.role] || user?.role || 'Staff'}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && !summary ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          <StatCard label="Marked today" value={summary?.marked ?? 0} />
          <StatCard label="Present" value={summary?.present ?? 0} />
          <StatCard label="Absent" value={summary?.absent ?? 0} />
          <StatCard label="Your classes" value={classCount} />
        </View>
      )}

      <Pressable style={styles.cta} onPress={() => navigation.navigate('Classes')}>
        <Text style={styles.ctaTitle}>Mark attendance</Text>
        <Text style={styles.ctaSub}>Open your assigned classes →</Text>
      </Pressable>

      <Text style={styles.dateNote}>Today · {date}</Text>
    </ScrollView>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  hello: { fontSize: 26, fontWeight: '800', color: colors.text },
  role: { color: colors.muted, marginTop: 4, marginBottom: 20 },
  error: { color: colors.danger, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primaryDark },
  statLabel: { marginTop: 4, fontSize: 12, color: colors.muted },
  cta: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
  },
  ctaTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ctaSub: { color: '#ddd6fe', marginTop: 4, fontSize: 13 },
  dateNote: { marginTop: 16, textAlign: 'center', color: colors.muted, fontSize: 12 },
});
