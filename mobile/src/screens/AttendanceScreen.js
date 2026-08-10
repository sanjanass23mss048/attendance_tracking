import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getDailyAttendance, saveDailyAttendance } from '../api/presence';
import { STATUS_OPTIONS, todayYmd } from '../config';
import { colors } from '../theme';

function nextStatus(code) {
  const idx = STATUS_OPTIONS.findIndex((s) => s.code === code);
  const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
  return next.code;
}

function statusMeta(code) {
  return STATUS_OPTIONS.find((s) => s.code === code) || STATUS_OPTIONS[0];
}

export default function AttendanceScreen({ route, navigation }) {
  const { sectionId, className, sectionName } = route.params || {};
  const date = todayYmd();
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `Class ${className}-${sectionName}`,
    });
  }, [navigation, className, sectionName]);

  const load = useCallback(async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await getDailyAttendance(sectionId, date);
      const list = (data.marks || []).map((m) => ({
        id: m.studentId,
        rollNo: m.rollNo,
        name: m.name,
      }));
      const map = {};
      for (const m of data.marks || []) {
        map[m.studentId] = m.status || 'P';
      }
      setStudents(list);
      setMarks(map);
    } catch (err) {
      setError(err.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [sectionId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0 };
    for (const s of students) {
      const code = marks[s.id] || 'P';
      if (c[code] != null) c[code] += 1;
    }
    return c;
  }, [students, marks]);

  const toggle = (studentId) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: nextStatus(prev[studentId] || 'P'),
    }));
    setMessage('');
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = students.map((s) => ({
        studentId: s.id,
        status: marks[s.id] || 'P',
      }));
      await saveDailyAttendance({ sectionId, date, marks: payload });
      setMessage('Attendance saved');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          P {counts.P} · A {counts.A} · L {counts.L} · H {counts.H}
        </Text>
        <Text style={styles.date}>{date} · tap a student to change status</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const code = marks[item.id] || 'P';
          const meta = statusMeta(code);
          return (
            <Pressable style={styles.row} onPress={() => toggle(item.id)}>
              <View style={styles.roll}>
                <Text style={styles.rollText}>{item.rollNo}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={[styles.badge, { backgroundColor: meta.color }]}>
                <Text style={styles.badgeText}>{meta.code}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={[styles.save, saving && { opacity: 0.7 }]} onPress={onSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Save attendance</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  summary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryText: { fontWeight: '700', color: colors.text },
  date: { marginTop: 4, fontSize: 12, color: colors.muted },
  error: { color: colors.danger, paddingHorizontal: 16, paddingTop: 8 },
  ok: { color: colors.success, paddingHorizontal: 16, paddingTop: 8, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  roll: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollText: { fontWeight: '800', color: colors.primaryDark, fontSize: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  badge: { minWidth: 40, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  save: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
