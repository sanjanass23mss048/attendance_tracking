import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class ComposeNoticeScreen extends StatefulWidget {
  const ComposeNoticeScreen({super.key});

  @override
  State<ComposeNoticeScreen> createState() => _ComposeNoticeScreenState();
}

class _ComposeNoticeScreenState extends State<ComposeNoticeScreen> {
  final titleCtrl = TextEditingController();
  final bodyCtrl = TextEditingController();
  final attachmentCtrl = TextEditingController();

  String audienceType = 'CLASS';
  bool loadingClasses = true;
  bool saving = false;
  String? error;

  /// Flat list of {id, label, className, sectionName}
  List<Map<String, String>> sections = [];
  final selectedSections = <String>{};

  List<Map<String, dynamic>> students = [];
  final selectedStudents = <String>{};
  bool loadingStudents = false;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  @override
  void dispose() {
    titleCtrl.dispose();
    bodyCtrl.dispose();
    attachmentCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadClasses() async {
    setState(() {
      loadingClasses = true;
      error = null;
    });
    try {
      final classes = await context.read<AuthState>().api.classes();
      final out = <Map<String, String>>[];
      for (final klass in classes) {
        final k = Map<String, dynamic>.from(klass as Map);
        final className = k['name']?.toString() ?? '';
        for (final sec in (k['sections'] as List? ?? [])) {
          final s = Map<String, dynamic>.from(sec as Map);
          final id = s['id']?.toString() ?? '';
          if (id.isEmpty) continue;
          out.add({
            'id': id,
            'label': '$className - ${s['name'] ?? ''}',
            'className': className,
            'sectionName': s['name']?.toString() ?? '',
          });
        }
      }
      setState(() => sections = out);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loadingClasses = false);
    }
  }

  Future<void> _loadStudentsForSelectedClasses() async {
    if (selectedSections.isEmpty) {
      setState(() {
        students = [];
        selectedStudents.clear();
      });
      return;
    }
    setState(() => loadingStudents = true);
    try {
      final api = context.read<AuthState>().api;
      final out = <Map<String, dynamic>>[];
      for (final sid in selectedSections) {
        final list = await api.students(sectionId: sid);
        final label = sections.firstWhere(
          (s) => s['id'] == sid,
          orElse: () => {'label': sid},
        )['label'];
        for (final st in list) {
          final m = Map<String, dynamic>.from(st as Map);
          m['sectionLabel'] = label;
          out.add(m);
        }
      }
      out.sort((a, b) => (a['name']?.toString() ?? '').compareTo(b['name']?.toString() ?? ''));
      setState(() {
        students = out;
        selectedStudents.removeWhere((id) => !out.any((s) => s['id']?.toString() == id));
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loadingStudents = false);
    }
  }

  Future<void> _submit() async {
    final body = bodyCtrl.text.trim();
    if (body.isEmpty) {
      setState(() => error = 'Message body is required');
      return;
    }

    String type = audienceType;
    List<String> classIds = [];
    List<String> studentIds = [];

    if (type == 'ALL') {
      // school-wide
    } else if (type == 'STUDENTS') {
      if (selectedStudents.isEmpty) {
        setState(() => error = 'Select at least one student');
        return;
      }
      studentIds = selectedStudents.toList();
    } else {
      if (selectedSections.isEmpty) {
        setState(() => error = 'Select at least one class');
        return;
      }
      classIds = selectedSections.toList();
      type = classIds.length == 1 ? 'CLASS' : 'CLASSES';
    }

    setState(() {
      saving = true;
      error = null;
    });
    try {
      await context.read<AuthState>().api.createNotice(
            title: titleCtrl.text.trim().isEmpty ? null : titleCtrl.text.trim(),
            body: body,
            audienceType: type,
            classSectionIds: classIds,
            studentClassIds: studentIds,
            attachmentName:
                attachmentCtrl.text.trim().isEmpty ? null : attachmentCtrl.text.trim(),
          );
      if (mounted) context.pop(true);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compose notice')),
      body: loadingClasses
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Audience', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Entire school'),
                      selected: audienceType == 'ALL',
                      onSelected: (_) => setState(() => audienceType = 'ALL'),
                    ),
                    ChoiceChip(
                      label: const Text('Class / Groups'),
                      selected: audienceType == 'CLASS' || audienceType == 'CLASSES',
                      onSelected: (_) => setState(() => audienceType = 'CLASS'),
                    ),
                    ChoiceChip(
                      label: const Text('Specific students'),
                      selected: audienceType == 'STUDENTS',
                      onSelected: (_) {
                        setState(() => audienceType = 'STUDENTS');
                        _loadStudentsForSelectedClasses();
                      },
                    ),
                  ],
                ),
                if (audienceType != 'ALL') ...[
                  const SizedBox(height: 16),
                  const Text('Classes', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final s in sections)
                        FilterChip(
                          label: Text(s['label'] ?? ''),
                          selected: selectedSections.contains(s['id']),
                          onSelected: (on) {
                            setState(() {
                              final id = s['id']!;
                              if (on) {
                                selectedSections.add(id);
                              } else {
                                selectedSections.remove(id);
                              }
                            });
                            if (audienceType == 'STUDENTS') {
                              _loadStudentsForSelectedClasses();
                            }
                          },
                        ),
                    ],
                  ),
                ],
                if (audienceType == 'STUDENTS') ...[
                  const SizedBox(height: 16),
                  const Text('Students', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  if (loadingStudents)
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (selectedSections.isEmpty)
                    const Text('Select class(es) first to load students.',
                        style: TextStyle(color: PresenceColors.muted))
                  else if (students.isEmpty)
                    const Text('No students found.', style: TextStyle(color: PresenceColors.muted))
                  else
                    ...students.map((st) {
                      final id = st['id']?.toString() ?? '';
                      return CheckboxListTile(
                        dense: true,
                        value: selectedStudents.contains(id),
                        onChanged: (on) {
                          setState(() {
                            if (on == true) {
                              selectedStudents.add(id);
                            } else {
                              selectedStudents.remove(id);
                            }
                          });
                        },
                        title: Text(st['name']?.toString() ?? 'Student'),
                        subtitle: Text(
                          'Roll ${st['rollNo'] ?? '—'} · ${st['sectionLabel'] ?? ''}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      );
                    }),
                ],
                if (audienceType == 'ALL') ...[
                  const SizedBox(height: 12),
                  const Text(
                    'All parents will see this on their Notice Board (e.g. holiday, school closure).',
                    style: TextStyle(color: PresenceColors.muted, fontSize: 13),
                  ),
                ],
                const SizedBox(height: 16),
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Title (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: bodyCtrl,
                  minLines: 5,
                  maxLines: 10,
                  decoration: const InputDecoration(
                    labelText: 'Message',
                    alignLabelWithHint: true,
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: attachmentCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Attachment name (optional)',
                    hintText: 'e.g. circular.pdf',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: saving ? null : _submit,
                  child: saving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Send notice'),
                ),
              ],
            ),
    );
  }
}
