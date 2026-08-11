import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import {
  getNotificationComposerOptions,
  getStudents,
  previewTeacherNotification,
  saveTeacherNotification,
} from '../api/presence';
import { colors } from '../theme';

const RECIPIENT_OPTIONS = [
  { id: 'ENTIRE_CLASS', label: 'Entire Class', icon: 'people-outline' },
  { id: 'SPECIFIC_STUDENTS', label: 'Specific Students', icon: 'person-outline' },
  { id: 'CLASS_GROUP', label: 'Class Group', icon: 'layers-outline' },
  { id: 'ALL_STUDENTS', label: 'All Students', icon: 'school-outline' },
];

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function classLabel(klass, section) {
  const c = klass?.name || '';
  const s = section?.name || '';
  const upper = String(c).toUpperCase();
  const left = upper === 'LKG' || upper === 'UKG' ? upper : `Class ${c}`;
  return s ? `${left}-${s}` : left;
}

export default function SendNotificationScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [options, setOptions] = useState({
    classes: [],
    groups: [],
    categories: [],
    canSendAllStudents: false,
    allStudentsIsSchoolWide: false,
  });

  const [recipientType, setRecipientType] = useState('ENTIRE_CLASS');
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [individualId, setIndividualId] = useState('');

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('General');
  const [delivery, setDelivery] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [attachment, setAttachment] = useState(null);

  const [preview, setPreview] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // send | draft

  const flatSections = useMemo(() => {
    const out = [];
    for (const klass of options.classes || []) {
      for (const sec of klass.sections || []) {
        out.push({
          sectionId: sec.id,
          classId: klass.id,
          className: klass.name,
          sectionName: sec.name,
          label: classLabel(klass, sec),
          studentCount: sec.studentCount || 0,
        });
      }
    }
    return out;
  }, [options.classes]);

  const sectionsForClass = useMemo(() => {
    const klass = (options.classes || []).find((c) => c.id === classId);
    return klass?.sections || [];
  }, [options.classes, classId]);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getNotificationComposerOptions();
      setOptions(data);
      if (!data.canSendAllStudents && recipientType === 'ALL_STUDENTS') {
        setRecipientType('ENTIRE_CLASS');
      }
    } catch (err) {
      setError(err.message || 'Could not load options');
    } finally {
      setLoading(false);
    }
  }, [recipientType]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (
        (recipientType === 'SPECIFIC_STUDENTS' || recipientType === 'INDIVIDUAL') &&
        sectionId
      ) {
        try {
          const data = await getStudents({ sectionId, q: studentQuery });
          if (!cancelled) setStudents(data.students || []);
        } catch (err) {
          if (!cancelled) setError(err.message || 'Could not load students');
        }
      } else if (!cancelled) {
        setStudents([]);
      }
    }
    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [recipientType, sectionId, studentQuery]);

  const buildPayload = (asDraft = false) => {
    let sectionIds = [];
    let studentIds = [];
    if (recipientType === 'ENTIRE_CLASS') {
      sectionIds = selectedSectionIds;
    } else if (recipientType === 'CLASS_GROUP') {
      sectionIds = selectedSectionIds.length ? selectedSectionIds : [];
    } else if (recipientType === 'SPECIFIC_STUDENTS') {
      sectionIds = sectionId ? [sectionId] : [];
      studentIds = selectedStudentIds;
    } else if (recipientType === 'INDIVIDUAL') {
      sectionIds = sectionId ? [sectionId] : [];
      studentIds = individualId ? [individualId] : [];
    }

    let scheduledAt = null;
    if (!asDraft && delivery === 'later') {
      if (!scheduleDate || !scheduleTime) {
        throw new Error('Enter schedule date (YYYY-MM-DD) and time (HH:mm)');
      }
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    }

    return {
      title: title.trim(),
      message: message.trim(),
      category,
      recipientType,
      sectionIds,
      studentIds,
      groupId:
        recipientType === 'CLASS_GROUP' && !selectedSectionIds.length ? groupId : null,
      delivery: asDraft ? 'now' : delivery,
      scheduledAt,
      asDraft,
    };
  };

  const validateLocal = (asDraft) => {
    if (!title.trim()) return 'Title is required';
    if (title.trim().length > 100) return 'Title max 100 characters';
    if (!message.trim()) return 'Message is required';
    if (message.trim().length > 500) return 'Message max 500 characters';
    if (asDraft) return '';
    if (recipientType === 'ENTIRE_CLASS' && !selectedSectionIds.length) {
      return 'Select at least one class';
    }
    if (recipientType === 'CLASS_GROUP' && !groupId && !selectedSectionIds.length) {
      return 'Select a class group or choose classes manually';
    }
    if (recipientType === 'SPECIFIC_STUDENTS') {
      if (!sectionId) return 'Select class and section';
      if (!selectedStudentIds.length) return 'Select at least one student';
    }
    if (recipientType === 'INDIVIDUAL') {
      if (!sectionId) return 'Select class and section';
      if (!individualId) return 'Select a student';
    }
    if (recipientType === 'ALL_STUDENTS' && !options.canSendAllStudents) {
      return 'You do not have permission to notify all students';
    }
    return '';
  };

  const toggleSection = (id) => {
    setSelectedSectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllStudents = () => setSelectedStudentIds(students.map((s) => s.id));
  const clearAllStudents = () => setSelectedStudentIds([]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      setAttachment({
        uri: file.uri,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
      });
    } catch (err) {
      setError(err.message || 'Could not pick file');
    }
  };

  const runPreview = async () => {
    setError('');
    const localErr = validateLocal(false);
    if (localErr) {
      setError(localErr);
      return;
    }
    setBusy('preview');
    try {
      const payload = buildPayload(true);
      const data = await previewTeacherNotification(payload);
      setPreview(data.preview);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message || 'Preview failed');
    } finally {
      setBusy('');
    }
  };

  const askSend = (asDraft) => {
    setError('');
    const localErr = validateLocal(asDraft);
    if (localErr) {
      setError(localErr);
      return;
    }
    if (asDraft) {
      doSave(true);
      return;
    }
    if (recipientType === 'ALL_STUDENTS') {
      Alert.alert(
        'Notify all students?',
        options.allStudentsIsSchoolWide
          ? 'This will notify students across the school classes you can access. Continue?'
          : 'This will notify all students in your assigned classes. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => setConfirmOpen(true) },
        ]
      );
      return;
    }
    setPendingAction('send');
    setConfirmOpen(true);
  };

  const doSave = async (asDraft) => {
    setConfirmOpen(false);
    setBusy(asDraft ? 'draft' : 'send');
    setError('');
    try {
      const payload = buildPayload(asDraft);
      const data = await saveTeacherNotification(payload, attachment);
      const status = data.notification?.status;
      Alert.alert(
        asDraft ? 'Draft saved' : status === 'SCHEDULED' ? 'Scheduled' : 'Sent',
        asDraft
          ? 'Your notification draft was saved.'
          : status === 'SCHEDULED'
            ? 'Notification scheduled successfully.'
            : `Notification sent to ${data.notification?.recipientCount || 0} recipient(s).`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(err.message || 'Could not save notification');
    } finally {
      setBusy('');
      setPendingAction(null);
    }
  };

  const recipientCards = RECIPIENT_OPTIONS.filter(
    (o) => o.id !== 'ALL_STUDENTS' || options.canSendAllStudents
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Send To</Text>
        <View style={styles.cardGrid}>
          {recipientCards.map((opt) => {
            const active = recipientType === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  setRecipientType(opt.id);
                  setError('');
                }}
                style={[styles.recipCard, active && styles.recipCardActive]}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={active ? colors.primaryDark : colors.muted}
                />
                <Text style={[styles.recipLabel, active && styles.recipLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Recipients</Text>

          {recipientType === 'ENTIRE_CLASS' && (
            <>
              <Text style={styles.hint}>Select one or more classes you teach.</Text>
              {flatSections.map((s) => {
                const on = selectedSectionIds.includes(s.sectionId);
                return (
                  <Pressable
                    key={s.sectionId}
                    style={[styles.checkRow, on && styles.checkRowOn]}
                    onPress={() => toggleSection(s.sectionId)}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? colors.primaryDark : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkTitle}>{s.label}</Text>
                      <Text style={styles.checkSub}>{s.studentCount} students</Text>
                    </View>
                  </Pressable>
                );
              })}
              {!flatSections.length ? (
                <Text style={styles.hint}>No assigned classes found.</Text>
              ) : null}
            </>
          )}

          {recipientType === 'CLASS_GROUP' && (
            <>
              <Text style={styles.fieldLabel}>Preset groups</Text>
              <Text style={styles.hint}>Only groups with your assigned classes are listed.</Text>
              {(options.groups || []).map((g) => {
                const on = groupId === g.id && selectedSectionIds.length === 0;
                return (
                  <Pressable
                    key={g.id}
                    style={[styles.checkRow, on && styles.checkRowOn]}
                    onPress={() => {
                      setGroupId(g.id);
                      setSelectedSectionIds([]);
                    }}
                  >
                    <Ionicons
                      name={on ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={on ? colors.primaryDark : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkTitle}>{g.label}</Text>
                      <Text style={styles.checkSub}>
                        {g.classCount} classes · {g.sectionCount} sections
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {!options.groups?.length ? (
                <Text style={styles.hint}>No class groups available for you.</Text>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                Or select classes manually
              </Text>
              <Text style={styles.hint}>
                Pick specific class–sections instead of a preset group.
              </Text>
              {flatSections.map((s) => {
                const on = selectedSectionIds.includes(s.sectionId);
                return (
                  <Pressable
                    key={s.sectionId}
                    style={[styles.checkRow, on && styles.checkRowOn]}
                    onPress={() => {
                      setGroupId('');
                      toggleSection(s.sectionId);
                    }}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? colors.primaryDark : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkTitle}>{s.label}</Text>
                      <Text style={styles.checkSub}>{s.studentCount} students</Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}

          {(recipientType === 'SPECIFIC_STUDENTS' || recipientType === 'INDIVIDUAL') && (
            <>
              <Text style={styles.fieldLabel}>Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                {(options.classes || []).map((c) => {
                  const on = classId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => {
                        setClassId(c.id);
                        setSectionId('');
                        setSelectedStudentIds([]);
                        setIndividualId('');
                      }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Section *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                {sectionsForClass.map((s) => {
                  const on = sectionId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => {
                        setSectionId(s.id);
                        setSelectedStudentIds([]);
                        setIndividualId('');
                      }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        Section {s.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {sectionId ? (
                <>
                  <Text style={styles.fieldLabel}>Search students</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Name or roll number"
                    placeholderTextColor={colors.muted}
                    value={studentQuery}
                    onChangeText={setStudentQuery}
                  />

                  {recipientType === 'SPECIFIC_STUDENTS' && (
                    <View style={styles.rowBetween}>
                      <Text style={styles.selectedCount}>
                        {selectedStudentIds.length} Students Selected
                      </Text>
                      <View style={styles.row}>
                        <Pressable onPress={selectAllStudents}>
                          <Text style={styles.link}>Select All</Text>
                        </Pressable>
                        <Text style={styles.dot}>·</Text>
                        <Pressable onPress={clearAllStudents}>
                          <Text style={styles.link}>Clear</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {students.map((s) => {
                    const label = `Roll No. ${s.rollNo} – ${s.name}`;
                    if (recipientType === 'INDIVIDUAL') {
                      const on = individualId === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.checkRow, on && styles.checkRowOn]}
                          onPress={() => setIndividualId(s.id)}
                        >
                          <Ionicons
                            name={on ? 'radio-button-on' : 'radio-button-off'}
                            size={22}
                            color={on ? colors.primaryDark : colors.muted}
                          />
                          <Text style={styles.checkTitle}>{label}</Text>
                        </Pressable>
                      );
                    }
                    const on = selectedStudentIds.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.checkRow, on && styles.checkRowOn]}
                        onPress={() => toggleStudent(s.id)}
                      >
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={on ? colors.primaryDark : colors.muted}
                        />
                        <Text style={styles.checkTitle}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.hint}>Choose class and section to load students.</Text>
              )}
            </>
          )}

          {recipientType === 'ALL_STUDENTS' && (
            <Text style={styles.warnBox}>
              This notifies a large audience
              {options.allStudentsIsSchoolWide
                ? ' across accessible school classes'
                : ' across all your assigned classes'}
              . Confirm carefully before sending.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Notification details</Text>
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            placeholder="e.g. Classwork reminder"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.counter}>{title.length}/100</Text>

          <Text style={styles.fieldLabel}>Message *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            maxLength={500}
            multiline
            textAlignVertical="top"
            placeholder="Write your message to students / parents…"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.counter}>{message.length}/500</Text>

          <Text style={styles.fieldLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {(options.categories || []).map((c) => {
              const on = category === c;
              return (
                <Pressable
                  key={c}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Attach File (Optional)</Text>
          {attachment ? (
            <View style={styles.fileRow}>
              <Ionicons name="document-text-outline" size={22} color={colors.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Text style={styles.checkSub}>{formatBytes(attachment.size)}</Text>
              </View>
              <Pressable onPress={() => setAttachment(null)}>
                <Ionicons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <Pressable style={styles.outlineBtn} onPress={pickFile}>
            <Ionicons name="attach-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.outlineBtnText}>
              {attachment ? 'Replace attachment' : '+ Add Attachment'}
            </Text>
          </Pressable>
          <Text style={styles.hint}>PDF, Word, Excel, or image · max 10 MB</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Delivery</Text>
          <Pressable style={styles.checkRow} onPress={() => setDelivery('now')}>
            <Ionicons
              name={delivery === 'now' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={colors.primaryDark}
            />
            <Text style={styles.checkTitle}>Send Now</Text>
          </Pressable>
          <Pressable style={styles.checkRow} onPress={() => setDelivery('later')}>
            <Ionicons
              name={delivery === 'later' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={colors.primaryDark}
            />
            <Text style={styles.checkTitle}>Schedule for Later</Text>
          </Pressable>
          {delivery === 'later' && (
            <View style={styles.scheduleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  value={scheduleDate}
                  onChangeText={setScheduleDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:mm"
                  placeholderTextColor={colors.muted}
                  value={scheduleTime}
                  onChangeText={setScheduleTime}
                />
              </View>
            </View>
          )}
        </View>

        <Pressable
          style={styles.previewBtn}
          onPress={runPreview}
          disabled={!!busy}
        >
          {busy === 'preview' ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : (
            <>
              <Ionicons name="eye-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.previewBtnText}>Preview Notification</Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={styles.draftBtn}
          onPress={() => askSend(true)}
          disabled={!!busy}
        >
          {busy === 'draft' ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : (
            <Text style={styles.draftBtnText}>Save as Draft</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.sendBtn}
          onPress={() => askSend(false)}
          disabled={!!busy}
        >
          {busy === 'send' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.sendBtnText}>Send Notification</Text>
            </>
          )}
        </Pressable>
      </View>

      <Modal visible={previewOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Preview</Text>
            <Text style={styles.previewMeta}>From: {user?.name || 'Teacher'}</Text>
            <Text style={styles.previewMeta}>{preview?.recipientSummary}</Text>
            <Text style={styles.previewMeta}>{preview?.category}</Text>
            <Text style={styles.previewTitle}>{preview?.title}</Text>
            <Text style={styles.previewBody}>{preview?.message}</Text>
            {attachment ? (
              <Text style={styles.previewMeta}>Attachment: {attachment.name}</Text>
            ) : null}
            <Pressable style={styles.sendBtn} onPress={() => setPreviewOpen(false)}>
              <Text style={styles.sendBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send Notification?</Text>
            <Text style={styles.previewBody}>
              This will be sent based on your recipient selection
              {delivery === 'later' ? ' at the scheduled time' : ' now'}.
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                style={styles.draftBtn}
                onPress={() => setConfirmOpen(false)}
              >
                <Text style={styles.draftBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.sendBtn} onPress={() => doSave(false)}>
                <Text style={styles.sendBtnText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 24 },
  error: {
    backgroundColor: '#fef2f2',
    color: colors.danger,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  recipCard: {
    width: '47%',
    minHeight: 84,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    justifyContent: 'center',
    gap: 6,
  },
  recipCardActive: {
    borderColor: colors.primaryDark,
    backgroundColor: '#dbeafe',
  },
  recipLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  recipLabelActive: { color: colors.primaryDark },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  cardHeading: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 120 },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12, marginTop: 4 },
  chips: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#dbeafe', borderColor: colors.primaryDark },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.primaryDark },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  checkRowOn: { backgroundColor: '#eff6ff' },
  checkTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  checkSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedCount: { fontWeight: '700', color: colors.primaryDark },
  link: { color: colors.primaryDark, fontWeight: '600' },
  dot: { color: colors.muted },
  warnBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: '#9a3412',
    fontSize: 13,
    lineHeight: 18,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
  },
  outlineBtnText: { color: colors.primaryDark, fontWeight: '700' },
  scheduleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
  },
  previewBtnText: { color: colors.primaryDark, fontWeight: '700' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    paddingBottom: 18,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  draftBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnText: { color: colors.primaryDark, fontWeight: '700' },
  sendBtn: {
    flex: 1.3,
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  previewMeta: { color: colors.muted, fontSize: 13 },
  previewTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8 },
  previewBody: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
