import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getClasses } from '../api/presence';
import { colors } from '../theme';

export default function ClassesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await getClasses();
      setClasses(data.classes || []);
    } catch (err) {
      setError(err.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rows = [];
  for (const klass of classes) {
    for (const section of klass.sections || []) {
      rows.push({
        key: section.id,
        className: klass.name,
        sectionName: section.name,
        sectionId: section.id,
        studentCount: section.studentCount ?? 0,
      });
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.caption}>
        Only classes assigned to your account are listed (same rules as web).
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !rows.length ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No classes assigned. Contact the in-charge.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('Attendance', {
                  sectionId: item.sectionId,
                  className: item.className,
                  sectionName: item.sectionName,
                })
              }
            >
              <View>
                <Text style={styles.title}>
                  Class {item.className} — {item.sectionName}
                </Text>
                <Text style={styles.meta}>{item.studentCount} students</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  caption: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, paddingHorizontal: 20, marginTop: 8 },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.muted },
  arrow: { fontSize: 20, color: colors.primary, fontWeight: '700' },
});
