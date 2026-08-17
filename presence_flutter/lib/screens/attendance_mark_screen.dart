import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/attendance_edit_status_banner.dart';
import '../widgets/attendance_status_chip.dart';

class AttendanceMarkScreen extends StatefulWidget {
  const AttendanceMarkScreen({
    super.key,
    required this.sectionId,
    required this.className,
    required this.sectionName,
  });

  final String sectionId;
  final String className;
  final String sectionName;

  @override
  State<AttendanceMarkScreen> createState() => _AttendanceMarkScreenState();
}

class _AttendanceMarkScreenState extends State<AttendanceMarkScreen> {
  DateTime selectedDate = DateTime.now();
  List<_Student> students = [];
  final marks = <String, String>{};
  bool loading = true;
  bool saving = false;
  String? error;
  String? message;
  Map<String, dynamic>? editContext;
  Timer? _pollTimer;

  String get date => dateYmd(selectedDate);

  bool get _canEdit => editContext?['canEdit'] == true;

  bool get _editLocked => editContext?['locked'] == true && !_canEdit;

  bool get _canRequestEdit => editContext?['canRequestEdit'] == true;

  bool get _finalized => editContext?['finalized'] == true;

  Map<String, dynamic>? get _request {
    final raw = editContext?['request'];
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  String get _requestStatus => (_request?['status'] ?? '').toString().toUpperCase();

  String get _classLabel => 'Class ${widget.className}-${widget.sectionName}';

  String get _dateLabel => DateFormat('EEE, d MMM yyyy').format(selectedDate);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _syncPoll() {
    _pollTimer?.cancel();
    _pollTimer = null;
    if (_requestStatus != 'PENDING') return;
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _refreshEditContext();
    });
  }

  Future<void> _refreshEditContext() async {
    if (!mounted) return;
    final api = context.read<AuthState>().api;
    try {
      final ctx = await api.attendanceEditContext(
            sectionId: widget.sectionId,
            date: date,
          );
      if (!mounted) return;
      setState(() => editContext = ctx);
      _syncPoll();
    } catch (_) {
      if (!mounted) return;
      setState(() => editContext = null);
      _pollTimer?.cancel();
    }
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      message = null;
    });
    try {
      final api = context.read<AuthState>().api;
      final data = await api.dailyAttendance(widget.sectionId, date);
      final list = <_Student>[];
      final map = <String, String>{};
      for (final m in (data['marks'] as List? ?? [])) {
        final row = Map<String, dynamic>.from(m as Map);
        final id = row['studentId']?.toString() ?? '';
        list.add(_Student(
          id: id,
          rollNo: row['rollNo']?.toString() ?? '',
          name: row['name']?.toString() ?? '',
        ));
        map[id] = (row['status']?.toString().isNotEmpty == true) ? row['status'].toString() : 'P';
      }
      Map<String, dynamic>? ctx;
      try {
        ctx = await api.attendanceEditContext(sectionId: widget.sectionId, date: date);
      } catch (_) {
        ctx = null;
      }
      if (!mounted) return;
      setState(() {
        students = list;
        marks
          ..clear()
          ..addAll(map);
        editContext = ctx;
      });
      _syncPoll();
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Map<String, int> get counts {
    final c = {'P': 0, 'A': 0, 'L': 0, 'H': 0, 'OH': 0, 'OF': 0};
    for (final s in students) {
      final code = marks[s.id] ?? 'P';
      c[code] = (c[code] ?? 0) + 1;
    }
    return c;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;
    if (dateYmd(picked) == date) return;
    setState(() => selectedDate = picked);
    await _load();
  }

  void _blockedMessage() {
    if (_canRequestEdit) {
      _openRequestDialog();
      return;
    }
    setState(() {
      message = _requestStatus == 'PENDING'
          ? 'Waiting for the assigned approver (WhatsApp).'
          : _finalized
              ? 'Parent SMS was sent. Request approval to edit again.'
              : 'Past dates are locked. Request approval to edit.';
    });
  }

  void _setStatus(_Student student, String code) {
    if (_editLocked) {
      _blockedMessage();
      return;
    }
    setState(() {
      marks[student.id] = code;
      message = null;
    });
  }

  List<Map<String, dynamic>> _payload() => [
        for (final s in students)
          {'studentId': s.id, 'status': marks[s.id] ?? 'P'},
      ];

  Future<void> _saveOnly() async {
    if (_editLocked) {
      _blockedMessage();
      return;
    }
    setState(() {
      saving = true;
      error = null;
      message = null;
    });
    final api = context.read<AuthState>().api;
    try {
      await api.saveDaily(
            sectionId: widget.sectionId,
            date: date,
            marks: _payload(),
          );
      if (!mounted) return;
      setState(() => message = 'Attendance saved');
      await _refreshEditContext();
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _saveAndSms() async {
    if (_editLocked) {
      _blockedMessage();
      return;
    }
    setState(() {
      saving = true;
      error = null;
      message = null;
    });
    final api = context.read<AuthState>().api;
    try {
      final payload = _payload();
      await api.saveDaily(
            sectionId: widget.sectionId,
            date: date,
            marks: payload,
          );
      final toNotify = payload.where((m) => m['status'] != 'P').toList();
      if (toNotify.isEmpty) {
        if (!mounted) return;
        setState(() => message = 'Saved — no absentees to SMS');
        await _refreshEditContext();
        return;
      }
      final res = await api.sendParentMessages(
            sectionId: widget.sectionId,
            date: date,
            messages: toNotify,
          );
      if (!mounted) return;
      final sms = (res['sms'] as Map?) ?? {};
      setState(() {
        message =
            'Saved · SMS sent ${sms['sent'] ?? 0}, skipped ${sms['skipped'] ?? 0}, failed ${sms['failed'] ?? 0}';
      });
      await _refreshEditContext();
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  void _markAllPresent() {
    if (_editLocked) {
      _blockedMessage();
      return;
    }
    setState(() {
      for (final s in students) {
        marks[s.id] = 'P';
      }
      message = 'All marked Present';
    });
  }

  Future<void> _openRequestDialog() async {
    final auth = context.read<AuthState>();
    final teacherName = auth.user?['name']?.toString() ?? '—';
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => _EditRequestDialog(
        teacherName: teacherName,
        classLabel: _classLabel,
        attendanceDateLabel: _dateLabel,
      ),
    );
    if (reason == null || !mounted) return;
    try {
      await auth.api.createAttendanceEditRequest(
            sectionId: widget.sectionId,
            attendanceDate: date,
            reason: reason,
          );
      if (!mounted) return;
      setState(() {
        message = 'Edit request sent to the assigned approver.';
        error = null;
      });
      await _refreshEditContext();
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = counts;
    return Scaffold(
      appBar: AppBar(
        title: Text(_classLabel),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  color: Colors.white,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'P ${c['P']} · A ${c['A']} · L ${c['L']} · H ${c['H']}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: _pickDate,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            border: Border.all(color: PresenceColors.border),
                            borderRadius: BorderRadius.circular(10),
                            color: PresenceColors.bg,
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 16, color: PresenceColors.primary),
                              const SizedBox(width: 8),
                              Text(
                                date,
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                              const Spacer(),
                              const Text(
                                'Change date',
                                style: TextStyle(
                                  color: PresenceColors.primary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      AttendanceEditStatusBanner(
                        locked: _editLocked,
                        canEdit: _canEdit,
                        canRequestEdit: _canRequestEdit,
                        request: _request,
                        finalized: _finalized,
                        onRequestEdit: _openRequestDialog,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Tap Present / Absent to toggle. Use ▾ for Late, Half Day, OD.',
                        style: TextStyle(color: PresenceColors.muted, fontSize: 12),
                      ),
                      if (!_editLocked)
                        TextButton(
                          onPressed: _markAllPresent,
                          child: const Text('Mark all Present'),
                        ),
                    ],
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                  ),
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(message!, style: const TextStyle(color: PresenceColors.success)),
                  ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
                    itemCount: students.length,
                    itemBuilder: (context, i) {
                      final s = students[i];
                      final code = marks[s.id] ?? 'P';
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: PresenceColors.primarySoft,
                                child: Text(
                                  s.rollNo,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: PresenceColors.primaryDark,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              ),
                              AttendanceStatusChip(
                                status: code,
                                enabled: !_editLocked,
                                onChanged: (next) => _setStatus(s, next),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: saving ? null : _saveOnly,
                  child: const Text('Save only'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: saving ? null : _saveAndSms,
                  child: saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save & SMS'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EditRequestDialog extends StatefulWidget {
  const _EditRequestDialog({
    required this.teacherName,
    required this.classLabel,
    required this.attendanceDateLabel,
  });

  final String teacherName;
  final String classLabel;
  final String attendanceDateLabel;

  @override
  State<_EditRequestDialog> createState() => _EditRequestDialogState();
}

class _EditRequestDialogState extends State<_EditRequestDialog> {
  final _reason = TextEditingController();
  String? _error;
  bool _sending = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _reason.text.trim();
    if (text.length < 3) {
      setState(() => _error = 'Reason is required (at least 3 characters).');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    Navigator.of(context).pop(text);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Request Edit'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _meta('Teacher', widget.teacherName),
            _meta('Class / Section', widget.classLabel),
            _meta('Attendance date', widget.attendanceDateLabel),
            const SizedBox(height: 12),
            TextField(
              controller: _reason,
              maxLines: 3,
              maxLength: 1000,
              decoration: const InputDecoration(
                labelText: 'Reason for requesting the change *',
                hintText: 'Explain why this attendance needs to be edited',
                alignLabelWithHint: true,
              ),
            ),
            const Text(
              'Your assigned approver will receive a WhatsApp message with Approve and Deny buttons.',
              style: TextStyle(color: PresenceColors.muted, fontSize: 12),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: PresenceColors.danger, fontSize: 13)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _sending ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _sending ? null : _submit,
          child: Text(_sending ? 'Sending…' : 'Send Request'),
        ),
      ],
    );
  }

  Widget _meta(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: PresenceColors.muted, fontSize: 11)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _Student {
  final String id;
  final String rollNo;
  final String name;
  _Student({required this.id, required this.rollNo, required this.name});
}
