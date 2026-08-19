import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/mobile_ui.dart';

class TeachersScreen extends StatefulWidget {
  const TeachersScreen({super.key});

  @override
  State<TeachersScreen> createState() => _TeachersScreenState();
}

class _TeachersScreenState extends State<TeachersScreen> {
  List<Map<String, dynamic>> teachers = [];
  bool loading = true;
  String? error;
  int tab = 0; // 0 all, 1 teaching, 2 non-teaching
  String query = '';
  bool showFilters = false;
  String roleFilter = '';
  String classFilter = '';
  String statusFilter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await context.read<AuthState>().api.teachers();
      setState(() {
        teachers = list.map((t) => Map<String, dynamic>.from(t as Map)).toList();
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  bool _isTeaching(Map<String, dynamic> t) => '${t['staffType'] ?? 'teaching'}' != 'non-teaching';

  List<Map<String, dynamic>> get _filtered {
    return teachers.where((t) {
      if (tab == 1 && !_isTeaching(t)) return false;
      if (tab == 2 && _isTeaching(t)) return false;
      final hay = '${t['name']} ${t['email']} ${t['employeeId'] ?? ''} ${t['role']}'.toLowerCase();
      if (query.isNotEmpty && !hay.contains(query.toLowerCase())) return false;
      if (roleFilter.isNotEmpty && '${t['role']}' != roleFilter) return false;
      if (statusFilter.isNotEmpty && '${t['status'] ?? 'Active'}' != statusFilter) return false;
      if (classFilter.isNotEmpty) {
        final assigned = '${t['classesAssigned'] ?? ''}'.toUpperCase();
        if (!assigned.contains(classFilter.toUpperCase())) return false;
      }
      return true;
    }).toList();
  }

  Set<String> _subjects() {
    final out = <String>{};
    for (final t in teachers) {
      for (final part in '${t['subjects'] ?? ''}'.split(RegExp(r'[,;/|]+'))) {
        final s = part.trim();
        if (s.isNotEmpty) out.add(s);
      }
    }
    return out;
  }

  Set<String> _assignedClasses() {
    final out = <String>{};
    for (final t in teachers) {
      for (final part in '${t['classesAssigned'] ?? ''}'.split(RegExp(r'[,;/|]+'))) {
        final grade = part.trim().replaceFirst(RegExp(r'^class\s+', caseSensitive: false), '').split(RegExp(r'[-–—]')).first.trim();
        if (grade.isNotEmpty) out.add(grade);
      }
    }
    return out;
  }

  Color _roleChip(String role) {
    final r = role.toLowerCase();
    if (r.contains('class')) return const Color(0xFFEEF2FF);
    if (r.contains('admin')) return const Color(0xFFF5F3FF);
    if (r.contains('subject')) return const Color(0xFFECFDF5);
    return const Color(0xFFF1F5F9);
  }

  Color _roleFg(String role) {
    final r = role.toLowerCase();
    if (r.contains('class')) return const Color(0xFF3730A3);
    if (r.contains('admin')) return const Color(0xFF6D28D9);
    if (r.contains('subject')) return const Color(0xFF047857);
    return const Color(0xFF334155);
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    final teaching = teachers.where(_isTeaching).length;
    final nonTeaching = teachers.length - teaching;
    final roles = teachers.map((t) => '${t['role'] ?? ''}').where((r) => r.isNotEmpty).toSet().toList()..sort();
    final classOpts = _assignedClasses().toList()..sort(compareClassNames);

    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
            children: [
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.2,
                children: [
                  MobileKpi(
                    label: 'Teaching Staff',
                    value: loading ? '—' : '$teaching',
                    icon: Icons.groups_outlined,
                    iconBg: const Color(0xFFF5F3FF),
                    iconColor: const Color(0xFF7C3AED),
                    cardBg: const Color(0xFFF5F3FF).withValues(alpha: 0.8),
                  ),
                  MobileKpi(
                    label: 'Non-Teaching Staff',
                    value: loading ? '—' : '$nonTeaching',
                    icon: Icons.person_outline,
                    iconBg: const Color(0xFFF0F9FF),
                    iconColor: const Color(0xFF0284C7),
                    cardBg: const Color(0xFFF0F9FF).withValues(alpha: 0.8),
                  ),
                  MobileKpi(
                    label: 'Total Subjects',
                    value: loading ? '—' : '${_subjects().length}',
                    icon: Icons.menu_book_outlined,
                    iconBg: const Color(0xFFECFDF5),
                    iconColor: const Color(0xFF059669),
                    cardBg: const Color(0xFFECFDF5).withValues(alpha: 0.8),
                  ),
                  MobileKpi(
                    label: 'Classes Assigned',
                    value: loading ? '—' : '${_assignedClasses().length}',
                    icon: Icons.school_outlined,
                    iconBg: const Color(0xFFFFFBEB),
                    iconColor: const Color(0xFFD97706),
                    cardBg: const Color(0xFFFFFBEB).withValues(alpha: 0.8),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              PillToggle(
                labels: const ['All', 'Teaching', 'Non-Teaching'],
                index: tab,
                onChanged: (i) => setState(() => tab = i),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.search, size: 18, color: PresenceColors.muted),
                        hintText: 'Search name, email, ID…',
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
                      ),
                      onChanged: (v) => setState(() => query = v),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Material(
                    color: showFilters ? PresenceColors.primaryDark : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      onTap: () => setState(() => showFilters = !showFilters),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: showFilters ? PresenceColors.primaryDark : const Color(0xFFE5E7EB)),
                        ),
                        child: Icon(Icons.tune, size: 18, color: showFilters ? Colors.white : PresenceColors.muted),
                      ),
                    ),
                  ),
                ],
              ),
              if (showFilters) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _miniSelect('All Roles', roleFilter, ['', ...roles], (v) => setState(() => roleFilter = v))),
                    const SizedBox(width: 6),
                    Expanded(child: _miniSelect('All Classes', classFilter, ['', ...classOpts], (v) => setState(() => classFilter = v), labelFor: formatClassLabel)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _miniSelect('All Status', statusFilter, const ['', 'Active', 'On Leave', 'Inactive'], (v) => setState(() => statusFilter = v)),
                    ),
                  ],
                ),
              ],
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: const TextStyle(color: PresenceColors.danger, fontSize: 13)),
              ],
              const SizedBox(height: 16),
              const Text('Staff Directory', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              if (loading)
                const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
              else if (rows.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  alignment: Alignment.center,
                  child: const Text('No staff members found.', style: TextStyle(color: PresenceColors.muted)),
                )
              else
                ...rows.map((t) {
                  final role = '${t['role'] ?? ''}';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => _show(t),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundColor: const Color(0xFFEDE9FE),
                                child: Text(
                                  initialsFor(t['name']?.toString()),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF6D28D9)),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${t['name'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                                    Text('${t['email'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
                                    const SizedBox(height: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(color: _roleChip(role), borderRadius: BorderRadius.circular(6)),
                                      child: Text(role, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _roleFg(role))),
                                    ),
                                  ],
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
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            backgroundColor: PresenceColors.primaryDark,
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Add staff on the website.')),
              );
            },
            child: const Icon(Icons.add, color: Colors.white),
          ),
        ),
      ],
    );
  }

  Widget _miniSelect(String emptyLabel, String value, List<String> items, ValueChanged<String> onChanged, {String Function(String)? labelFor}) {
    final safe = items.contains(value) ? value : '';
    return DropdownButtonFormField<String>(
      value: safe,
      isExpanded: true,
      decoration: InputDecoration(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
      ),
      items: [
        for (final i in items)
          DropdownMenuItem(
            value: i,
            child: Text(
              i.isEmpty ? emptyLabel : (labelFor == null ? i : labelFor(i)),
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12),
            ),
          ),
      ],
      onChanged: (v) => onChanged(v ?? ''),
    );
  }

  void _show(Map<String, dynamic> t) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${t['name'] ?? ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text('${t['email'] ?? ''}'),
            Text('${t['role'] ?? ''} · ${t['status'] ?? 'Active'}'),
            if ('${t['classesAssigned'] ?? ''}'.isNotEmpty) Text('Classes: ${t['classesAssigned']}'),
          ],
        ),
      ),
    );
  }
}
