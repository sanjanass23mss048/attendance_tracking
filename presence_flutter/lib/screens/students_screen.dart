import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/mobile_ui.dart';

class _Klass {
  _Klass(this.id, this.name, this.sections);
  final String id;
  final String name;
  final List<_Sec> sections;
}

class _Sec {
  _Sec(this.id, this.name);
  final String id;
  final String name;
}

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  List<_Klass> classes = [];
  List<dynamic> students = [];
  bool loading = true;
  String? error;
  String query = '';
  String? selectedClass;
  String? selectedSection;
  String statusFilter = '';
  bool showFilters = false;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await context.read<AuthState>().api.classes();
      final next = <_Klass>[];
      for (final raw in list) {
        final m = Map<String, dynamic>.from(raw as Map);
        final secs = <_Sec>[];
        for (final s in (m['sections'] as List? ?? [])) {
          final sm = Map<String, dynamic>.from(s as Map);
          secs.add(_Sec(sm['id']?.toString() ?? '', sm['name']?.toString() ?? ''));
        }
        next.add(_Klass(m['id']?.toString() ?? '', m['name']?.toString() ?? '', secs));
      }
      next.sort((a, b) => compareClassNames(a.name, b.name));
      selectedClass ??= next.isNotEmpty ? next.first.name : null;
      final firstSecs = next.where((c) => c.name == selectedClass).expand((c) => c.sections).toList();
      selectedSection ??= firstSecs.isNotEmpty ? firstSecs.first.name : null;
      setState(() => classes = next);
      await _loadStudents();
    } catch (e) {
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  Future<void> _loadStudents() async {
    _Klass? klass;
    for (final c in classes) {
      if (c.name == selectedClass) klass = c;
    }
    _Sec? sec;
    for (final s in klass?.sections ?? const <_Sec>[]) {
      if (s.name == selectedSection) sec = s;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await context.read<AuthState>().api.students(sectionId: sec?.id);
      setState(() => students = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<_Sec> get _sections {
    return classes.where((c) => c.name == selectedClass).expand((c) => c.sections).toList();
  }

  List<Map<String, dynamic>> get _filtered {
    return students.map((s) => Map<String, dynamic>.from(s as Map)).where((m) {
      final hay = '${m['name']} ${m['rollNo'] ?? m['roll']} ${m['admissionNo'] ?? ''} ${m['className']} ${m['sectionName']}'
          .toLowerCase();
      if (query.isNotEmpty && !hay.contains(query.toLowerCase())) return false;
      if (statusFilter.isEmpty) return true;
      final status = '${m['status'] ?? 'Active'}';
      return status.toLowerCase() == statusFilter.toLowerCase();
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    final activeCount = rows.where((s) => '${s['status'] ?? 'Active'}' == 'Active').length;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadStudents,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                Row(
                  children: [
                    Expanded(child: _select(Icons.school_outlined, selectedClass, classes.map((c) => c.name).toList(), (v) {
                      final secs = classes.where((c) => c.name == v).expand((c) => c.sections).toList();
                      setState(() {
                        selectedClass = v;
                        selectedSection = secs.isNotEmpty ? secs.first.name : null;
                      });
                      _loadStudents();
                    }, formatLabel: formatClassLabel)),
                    const SizedBox(width: 8),
                    Expanded(child: _select(Icons.groups_outlined, selectedSection, _sections.map((s) => s.name).toList(), (v) {
                      setState(() => selectedSection = v);
                      _loadStudents();
                    }, formatLabel: (s) => 'Section $s')),
                    const SizedBox(width: 8),
                    _iconBtn(
                      Icons.tune,
                      active: showFilters || statusFilter.isNotEmpty,
                      onTap: () => setState(() => showFilters = !showFilters),
                    ),
                  ],
                ),
                if (showFilters) ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: statusFilter.isEmpty ? '' : statusFilter,
                    decoration: _fieldDeco(),
                    items: const [
                      DropdownMenuItem(value: '', child: Text('All statuses')),
                      DropdownMenuItem(value: 'Active', child: Text('Active')),
                      DropdownMenuItem(value: 'Inactive', child: Text('Inactive')),
                    ],
                    onChanged: (v) => setState(() => statusFilter = v ?? ''),
                  ),
                ],
                const SizedBox(height: 10),
                TextField(
                  decoration: _fieldDeco(prefix: Icons.search, hint: 'Search by name, roll no. or admission no.'),
                  onChanged: (v) => setState(() => query = v),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _action(Icons.person_add_alt_1, 'Add Student', const Color(0xFFF5F3FF), const Color(0xFF6D28D9)),
                    _action(Icons.upload_file, 'Import', const Color(0xFFF0F9FF), const Color(0xFF0369A1)),
                    _action(Icons.download, 'Export PDF', const Color(0xFFECFDF5), const Color(0xFF047857)),
                    _action(Icons.more_horiz, 'More', Colors.white, PresenceColors.muted, bordered: true),
                  ],
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!, style: const TextStyle(color: PresenceColors.danger, fontSize: 13)),
                ],
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total Students', style: TextStyle(fontSize: 12, color: PresenceColors.muted)),
                          Text('${rows.length} Students', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFD1FAE5)),
                      ),
                      child: Text('Active: $activeCount', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF047857))),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (loading)
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (rows.isEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                    child: const Text('No students found.', style: TextStyle(color: PresenceColors.muted)),
                  )
                else
                  ...rows.map((s) {
                    final active = '${s['status'] ?? 'Active'}' == 'Active';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _showStudent(s),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 22,
                                  backgroundColor: const Color(0xFFE0F2FE),
                                  child: Text(
                                    '${s['rollNo'] ?? s['roll'] ?? '—'}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF075985)),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('${s['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                                      Text(
                                        'Admission No. ${s['admissionNo'] ?? s['admission_no'] ?? '—'}',
                                        style: const TextStyle(fontSize: 12, color: PresenceColors.muted),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: active ? const Color(0xFFECFDF5) : const Color(0xFFF3F4F6),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    active ? 'Active' : '${s['status'] ?? 'Inactive'}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: active ? const Color(0xFF047857) : PresenceColors.muted,
                                    ),
                                  ),
                                ),
                                const Icon(Icons.chevron_right, color: Color(0xFFD1D5DB)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _select(
    IconData icon,
    String? value,
    List<String> items,
    ValueChanged<String> onChanged, {
    required String Function(String) formatLabel,
  }) {
    final safe = items.contains(value) ? value : (items.isNotEmpty ? items.first : null);
    return DropdownButtonFormField<String>(
      value: safe,
      isExpanded: true,
      decoration: _fieldDeco(prefix: icon),
      items: [
        for (final i in items) DropdownMenuItem(value: i, child: Text(formatLabel(i), overflow: TextOverflow.ellipsis)),
      ],
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    );
  }

  InputDecoration _fieldDeco({IconData? prefix, String? hint}) {
    return InputDecoration(
      prefixIcon: prefix == null ? null : Icon(prefix, size: 16, color: PresenceColors.primaryDark),
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
    );
  }

  Widget _iconBtn(IconData icon, {required bool active, required VoidCallback onTap}) {
    return Material(
      color: active ? PresenceColors.primaryDark : Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: active ? PresenceColors.primaryDark : const Color(0xFFE5E7EB)),
          ),
          child: Icon(icon, size: 18, color: active ? Colors.white : PresenceColors.muted),
        ),
      ),
    );
  }

  Widget _action(IconData icon, String label, Color bg, Color fg, {bool bordered = false}) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Material(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Use the website to add, import, or export students.')),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: bordered ? const Color(0xFFE5E7EB) : bg),
              ),
              child: Column(
                children: [
                  Icon(icon, size: 18, color: fg),
                  const SizedBox(height: 6),
                  Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg, height: 1.15)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showStudent(Map<String, dynamic> s) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${s['name'] ?? ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text('Roll ${s['rollNo'] ?? s['roll'] ?? '—'} · Admission ${s['admissionNo'] ?? '—'}'),
            Text('${formatClassLabel('${s['className'] ?? selectedClass ?? ''}')} · Section ${s['sectionName'] ?? selectedSection ?? ''}'),
          ],
        ),
      ),
    );
  }
}
