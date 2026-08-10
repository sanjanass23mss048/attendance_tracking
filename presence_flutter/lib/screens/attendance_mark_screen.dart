import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';

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
  final date = todayYmd();
  List<_Student> students = [];
  final marks = <String, String>{};
  bool loading = true;
  bool saving = false;
  String? error;
  String? message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      message = null;
    });
    try {
      final data = await context.read<AuthState>().api.dailyAttendance(widget.sectionId, date);
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
      setState(() {
        students = list;
        marks
          ..clear()
          ..addAll(map);
      });
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

  Future<void> _pickStatus(_Student student) async {
    final chosen = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(student.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text('Roll ${student.rollNo} · choose status'),
            ),
            for (final opt in statusOptions)
              ListTile(
                leading: CircleAvatar(backgroundColor: Color(opt.color), radius: 8),
                title: Text('${opt.code} · ${opt.label}'),
                selected: (marks[student.id] ?? 'P') == opt.code,
                onTap: () => Navigator.pop(ctx, opt.code),
              ),
          ],
        ),
      ),
    );
    if (chosen != null) {
      setState(() {
        marks[student.id] = chosen;
        message = null;
      });
    }
  }

  List<Map<String, dynamic>> _payload() => [
        for (final s in students)
          {'studentId': s.id, 'status': marks[s.id] ?? 'P'},
      ];

  Future<void> _saveOnly() async {
    setState(() {
      saving = true;
      error = null;
      message = null;
    });
    try {
      await context.read<AuthState>().api.saveDaily(
            sectionId: widget.sectionId,
            date: date,
            marks: _payload(),
          );
      setState(() => message = 'Attendance saved');
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _saveAndSms() async {
    setState(() {
      saving = true;
      error = null;
      message = null;
    });
    try {
      final payload = _payload();
      await context.read<AuthState>().api.saveDaily(
            sectionId: widget.sectionId,
            date: date,
            marks: payload,
          );
      final toNotify = payload.where((m) => m['status'] != 'P').toList();
      if (toNotify.isEmpty) {
        setState(() => message = 'Saved — no absentees to SMS');
        return;
      }
      final res = await context.read<AuthState>().api.sendParentMessages(
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
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  void _markAllPresent() {
    setState(() {
      for (final s in students) {
        marks[s.id] = 'P';
      }
      message = 'All marked Present';
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = counts;
    return Scaffold(
      appBar: AppBar(
        title: Text('Class ${widget.className}-${widget.sectionName}'),
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
                      Text('$date · tap a student to set status',
                          style: const TextStyle(color: PresenceColors.muted, fontSize: 12)),
                      const SizedBox(height: 8),
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
                      final meta = statusMeta(code);
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: PresenceColors.primarySoft,
                            child: Text(s.rollNo,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: PresenceColors.primaryDark,
                                )),
                          ),
                          title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Color(meta.color),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(meta.code,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                          ),
                          onTap: () => _pickStatus(s),
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

class _Student {
  final String id;
  final String rollNo;
  final String name;
  _Student({required this.id, required this.rollNo, required this.name});
}
