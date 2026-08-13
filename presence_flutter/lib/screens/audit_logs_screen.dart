import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

const _pageSize = 40;

const _fallbackCategories = [
  'AUTH',
  'ATTENDANCE',
  'NOTIFICATION',
  'NOTICE',
  'STUDENT',
  'TEACHER',
  'HOLIDAY',
  'CALENDAR',
  'DIARY',
  'TIMETABLE',
  'APPROVAL',
  'IMPORT',
  'OTHER',
];

class AuditLogsScreen extends StatefulWidget {
  const AuditLogsScreen({super.key});

  @override
  State<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends State<AuditLogsScreen> {
  final _actorCtrl = TextEditingController();
  final _qCtrl = TextEditingController();

  String _category = '';
  String _success = '';
  DateTime? _from;
  DateTime? _to;

  List<dynamic> _logs = [];
  List<String> _categories = [..._fallbackCategories];
  int _total = 0;
  int _offset = 0;
  bool _loading = true;
  String? _error;
  String? _expandedId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _actorCtrl.dispose();
    _qCtrl.dispose();
    super.dispose();
  }

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String? get _fromIso => _from == null ? null : '${_ymd(_from!)}T00:00:00.000';
  String? get _toIso => _to == null ? null : '${_ymd(_to!)}T23:59:59.999';

  Future<void> _load({int? offset}) async {
    final nextOffset = offset ?? _offset;
    setState(() {
      _loading = true;
      _error = null;
      if (offset != null) _offset = offset;
    });
    try {
      final data = await context.read<AuthState>().api.auditLogs(
            category: _category,
            actor: _actorCtrl.text.trim(),
            q: _qCtrl.text.trim(),
            from: _fromIso,
            to: _toIso,
            success: _success,
            limit: _pageSize,
            offset: nextOffset,
          );
      final cats = (data['categories'] as List?)
              ?.map((c) => c.toString())
              .where((c) => c.isNotEmpty)
              .toList() ??
          [];
      setState(() {
        _logs = (data['logs'] as List?) ?? [];
        _total = (data['total'] as num?)?.toInt() ?? _logs.length;
        if (cats.isNotEmpty) _categories = cats;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _logs = [];
        _total = 0;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate({required bool from}) async {
    final initial = (from ? _from : _to) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked == null) return;
    setState(() {
      if (from) {
        _from = picked;
      } else {
        _to = picked;
      }
    });
  }

  void _clearFilters() {
    _actorCtrl.clear();
    _qCtrl.clear();
    setState(() {
      _category = '';
      _success = '';
      _from = null;
      _to = null;
      _offset = 0;
      _expandedId = null;
    });
    _load(offset: 0);
  }

  void _applyFilters() {
    _expandedId = null;
    _load(offset: 0);
  }

  String _formatWhen(dynamic iso) {
    if (iso == null) return '—';
    final parsed = DateTime.tryParse(iso.toString());
    if (parsed == null) return iso.toString();
    final local = parsed.toLocal();
    final d = _ymd(local);
    final h = local.hour.toString().padLeft(2, '0');
    final m = local.minute.toString().padLeft(2, '0');
    return '$d $h:$m';
  }

  String _actorLabel(Map<String, dynamic> log) {
    final name = (log['actorName'] ?? log['actorEmail'] ?? log['actorUserId'] ?? '').toString();
    if (name.isEmpty) return 'System / unknown';
    final role = (log['actorRole'] ?? '').toString();
    return role.isEmpty ? name : '$name · $role';
  }

  Color _categoryColor(String category) {
    switch (category.toUpperCase()) {
      case 'AUTH':
        return const Color(0xFF475569);
      case 'ATTENDANCE':
        return PresenceColors.success;
      case 'NOTIFICATION':
        return const Color(0xFF0284C7);
      case 'NOTICE':
        return PresenceColors.primaryDark;
      case 'STUDENT':
        return const Color(0xFFD97706);
      case 'TEACHER':
        return const Color(0xFF7C3AED);
      case 'HOLIDAY':
      case 'CALENDAR':
        return const Color(0xFFE11D48);
      case 'DIARY':
        return PresenceColors.primary;
      case 'TIMETABLE':
        return const Color(0xFF0E7490);
      case 'APPROVAL':
        return const Color(0xFFEA580C);
      case 'IMPORT':
        return const Color(0xFFC026D3);
      default:
        return PresenceColors.muted;
    }
  }

  int get _page => (_offset ~/ _pageSize) + 1;
  int get _totalPages => (_total <= 0) ? 1 : ((_total + _pageSize - 1) ~/ _pageSize);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (!auth.isAdmin) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Audit Logs are available to administrators only.'),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Who did what across attendance, notices, notifications, and more.',
            style: TextStyle(color: PresenceColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Filters', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _category,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: [
                      const DropdownMenuItem(value: '', child: Text('All categories')),
                      ..._categories.map(
                        (c) => DropdownMenuItem(value: c, child: Text(c)),
                      ),
                    ],
                    onChanged: (v) => setState(() => _category = v ?? ''),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _actorCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Actor (name / email / id)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _qCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Keyword',
                      hintText: 'Search summary, action, entity…',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pickDate(from: true),
                          child: Text(_from == null ? 'From date' : _ymd(_from!)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _pickDate(from: false),
                          child: Text(_to == null ? 'To date' : _ymd(_to!)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _success,
                    decoration: const InputDecoration(labelText: 'Result'),
                    items: const [
                      DropdownMenuItem(value: '', child: Text('All')),
                      DropdownMenuItem(value: 'true', child: Text('Success')),
                      DropdownMenuItem(value: 'false', child: Text('Failed')),
                    ],
                    onChanged: (v) => setState(() => _success = v ?? ''),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: _loading ? null : _applyFilters,
                          child: const Text('Apply'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _loading ? null : _clearFilters,
                          child: const Text('Clear'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$_total event${_total == 1 ? '' : 's'}',
            style: const TextStyle(color: PresenceColors.muted, fontSize: 12),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: PresenceColors.danger)),
          ],
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_logs.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('No audit events match these filters yet.'),
              ),
            )
          else
            ..._logs.map((raw) {
              final log = Map<String, dynamic>.from(raw as Map);
              final id = (log['id'] ?? '').toString();
              final category = (log['category'] ?? '').toString();
              final success = log['success'] != false;
              final open = _expandedId == id;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => setState(() => _expandedId = open ? null : id),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              open ? Icons.expand_less : Icons.expand_more,
                              color: PresenceColors.muted,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                _formatWhen(log['createdOn']),
                                style: const TextStyle(
                                  color: PresenceColors.muted,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: success
                                    ? const Color(0xFFDCFCE7)
                                    : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                success ? 'OK' : 'Failed',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: success ? PresenceColors.success : PresenceColors.danger,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _actorLabel(log),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        if ((log['actorEmail'] ?? '').toString().isNotEmpty &&
                            (log['actorName'] ?? '').toString().isNotEmpty)
                          Text(
                            '${log['actorEmail']}',
                            style: const TextStyle(color: PresenceColors.muted, fontSize: 12),
                          ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (category.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: _categoryColor(category).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  category,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: _categoryColor(category),
                                  ),
                                ),
                              ),
                            Text(
                              '${log['action'] ?? '—'}',
                              style: const TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 12,
                                color: PresenceColors.muted,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text('${log['summary'] ?? '—'}'),
                        if (open) ...[
                          const Divider(height: 20),
                          Text(
                            'Actor id: ${log['actorUserId'] ?? '—'}',
                            style: const TextStyle(fontSize: 12, color: PresenceColors.muted),
                          ),
                          Text(
                            'Entity: ${log['entityType'] ?? '—'} · ${log['entityId'] ?? '—'}',
                            style: const TextStyle(fontSize: 12, color: PresenceColors.muted),
                          ),
                          Text(
                            'IP: ${log['ipAddress'] ?? '—'}',
                            style: const TextStyle(fontSize: 12, color: PresenceColors.muted),
                          ),
                          if (log['details'] != null) ...[
                            const SizedBox(height: 8),
                            _AttendanceDetailsView(details: log['details']),
                            const SizedBox(height: 8),
                            const Text('Raw details', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                            const SizedBox(height: 4),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: PresenceColors.border),
                              ),
                              child: Text(
                                log['details'] is String
                                    ? log['details'].toString()
                                    : const JsonEncoder.withIndent('  ').convert(log['details']),
                                style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                              ),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }),
          if (!_loading && _logs.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                OutlinedButton(
                  onPressed: _page <= 1 ? null : () => _load(offset: (_offset - _pageSize).clamp(0, 1 << 30)),
                  child: const Text('Previous'),
                ),
                Text('Page $_page of $_totalPages',
                    style: const TextStyle(color: PresenceColors.muted, fontSize: 12)),
                OutlinedButton(
                  onPressed: _page >= _totalPages ? null : () => _load(offset: _offset + _pageSize),
                  child: const Text('Next'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

const _statusLabels = {
  'P': 'Present',
  'A': 'Absent',
  'L': 'Late',
  'H': 'Half Day',
  'OH': 'OD Half',
  'OF': 'OD Full',
};

class _AttendanceDetailsView extends StatelessWidget {
  const _AttendanceDetailsView({required this.details});
  final dynamic details;

  Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  List<Map<String, dynamic>> _students(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  String _studentLine(Map<String, dynamic> s) {
    final roll = s['rollNo'];
    final name = (s['name'] ?? s['studentId'] ?? 'Student').toString();
    if (roll == null || roll.toString().isEmpty) return name;
    return '#$roll $name';
  }

  Widget _group(String title, List<Map<String, dynamic>> students) {
    if (students.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$title (${students.length})',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          const SizedBox(height: 2),
          Text(
            students.map(_studentLine).join(', '),
            style: const TextStyle(fontSize: 12),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final map = _asMap(details);
    if (map == null) return const SizedBox.shrink();
    final snapshot = _asMap(map['currentAttendance']) ?? map;
    final changes = _students(map['changes']);
    final reason = (map['reason'] ?? '').toString();
    final present = _students(snapshot['present']);
    final absent = _students(snapshot['absent']);
    final late = _students(snapshot['late']);
    final halfDay = _students(snapshot['halfDay']);
    final odHalf = _students(snapshot['odHalf']);
    final odFull = _students(snapshot['odFull']);
    final hasRoster = present.isNotEmpty ||
        absent.isNotEmpty ||
        late.isNotEmpty ||
        halfDay.isNotEmpty ||
        odHalf.isNotEmpty ||
        odFull.isNotEmpty;

    if (reason.isEmpty && changes.isEmpty && !hasRoster) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (reason.isNotEmpty) ...[
          const Text('Reason', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          Text(reason, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 8),
        ],
        if (changes.isNotEmpty) ...[
          Text('Status changes (${changes.length})',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          const SizedBox(height: 4),
          ...changes.map((c) {
            final from = _statusLabels[c['from']?.toString()] ?? c['from'] ?? '?';
            final to = _statusLabels[c['to']?.toString()] ?? c['to'] ?? '?';
            return Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text('${_studentLine(c)}: $from → $to', style: const TextStyle(fontSize: 12)),
            );
          }),
          const SizedBox(height: 8),
        ],
        _group('Present', present),
        _group('Absent', absent),
        _group('Late', late),
        _group('Half day', halfDay),
        _group('OD half', odHalf),
        _group('OD full', odFull),
      ],
    );
  }
}
