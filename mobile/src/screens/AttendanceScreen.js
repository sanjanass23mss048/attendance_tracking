import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getDailyAttendance, saveDailyAttendance, submitParentMessages } from '../api/presence';
import { STATUS_OPTIONS, todayYmd } from '../config';
import { colors } from '../theme';

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
  const [sendingSms, setSendingSms] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pickerStudent, setPickerStudent] = useState(null);

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
      // If API returns empty marks list with roster elsewhere, keep empty — daily usually includes all.
      if (!list.length && Array.isArray(data.students)) {
        for (const s of data.students) {
          list.push({ id: s.id || s.studentId, rollNo: s.rollNo || s.roll, name: s.name });
          map[s.id || s.studentId] = 'P';
        }
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

  const absentish = useMemo(
    () => students.filter((s) => (marks[s.id] || 'P') !== 'P'),
    [students, marks]
  );

  const setStatus = (studentId, code) => {
    setMarks((prev) => ({ ...prev, [studentId]: code }));
    setPickerStudent(null);
    setMessage('');
  };

  const markAllPresent = () => {
    const next = {};
    for (const s of students) next[s.id] = 'P';
    setMarks(next);
    setMessage('All marked Present');
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

  const onSaveAndNotify = async () => {
    setSendingSms(true);
    setError('');
    setMessage('');
    try {
      const payload = students.map((s) => ({
        studentId: s.id,
        status: marks[s.id] || 'P',
      }));
      await saveDailyAttendance({ sectionId, date, marks: payload });
      // Absence SMS only for today's marking — never for previous-day edits.
      if (String(date) < todayYmd()) {
        setMessage('Saved. Parent SMS is only sent for today’s absentees (not previous days).');
        return;
      }
      const toNotify = payload.filter((m) => m.status !== 'P');
      if (!toNotify.length) {
        setMessage('Saved — no absentees to SMS');
        return;
      }
      const res = await submitParentMessages({
        sectionId,
        date,
        messages: toNotify.map((m) => ({ studentId: m.studentId, status: m.status })),
      });
      if (res?.skippedDelivery || res?.skipReason === 'past_attendance_date') {
        setMessage('Saved. Parent SMS is only sent for today’s absentees (not previous days).');
        return;
      }
      const sms = res.sms || {};
      setMessage(
        `Saved · SMS sent ${sms.sent ?? 0}` +
          (sms.skipped ? `, skipped ${sms.skipped}` : '') +
          (sms.failed ? `, failed ${sms.failed}` : '')
      );
    } catch (err) {
      setError(err.message || 'Save / SMS failed');
    } finally {
      setSendingSms(false);
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
          {counts.OH || counts.OF ? ` · OD ${counts.OH + counts.OF}` : ''}
        </Text>
        <Text style={styles.date}>{date} · tap a student to set status</Text>
        <View style={styles.quickRow}>
          <Pressable style={styles.quickBtn} onPress={markAllPresent}>
            <Text style={styles.quickText}>Mark all Present</Text>
          </Pressable>
          <Text style={styles.absentHint}>{absentish.length} not present</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      <FlatList
        data={students}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const code = marks[item.id] || 'P';
          const meta = statusMeta(code);
          return (
            <Pressable style={styles.row} onPress={() => setPickerStudent(item)}>
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

      <View style={styles.footer}>
        <Pressable
          style={[styles.save, styles.saveSecondary, saving && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={saving || sendingSms}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : (
            <Text style={styles.saveSecondaryText}>Save only</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.save, styles.savePrimary, sendingSms && { opacity: 0.7 }]}
          onPress={onSaveAndNotify}
          disabled={saving || sendingSms}
        >
          {sendingSms ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save & SMS parents</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={Boolean(pickerStudent)}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerStudent(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerStudent(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {pickerStudent?.name}
              {pickerStudent?.rollNo != null ? ` · Roll ${pickerStudent.rollNo}` : ''}
            </Text>
            <Text style={styles.sheetSub}>Choose attendance status</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.code}
                  style={[
                    styles.statusChip,
                    { borderColor: opt.color },
                    (marks[pickerStudent?.id] || 'P') === opt.code && {
                      backgroundColor: opt.color,
                    },
                  ]}
                  onPress={() => setStatus(pickerStudent.id, opt.code)}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      (marks[pickerStudent?.id] || 'P') === opt.code && { color: '#fff' },
                    ]}
                  >
                    {opt.code} · {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
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
  quickRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickBtn: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  quickText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  absentHint: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  error: { color: colors.danger, paddingHorizontal: 16, paddingTop: 8 },
  ok: { color: colors.success, paddingHorizontal: 16, paddingTop: 8, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 140 },
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
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  save: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  savePrimary: { backgroundColor: colors.primary },
  saveSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  saveSecondaryText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetSub: { marginTop: 4, marginBottom: 14, color: colors.muted, fontSize: 13 },
  statusGrid: { gap: 8 },
  statusChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  statusChipText: { fontWeight: '700', color: colors.text, fontSize: 14 },
});
