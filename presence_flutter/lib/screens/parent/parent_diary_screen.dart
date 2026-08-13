import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';

class ParentDiaryScreen extends StatefulWidget {
  const ParentDiaryScreen({super.key});

  @override
  State<ParentDiaryScreen> createState() => _ParentDiaryScreenState();
}

class _ParentDiaryScreenState extends State<ParentDiaryScreen> {
  List<dynamic> entries = [];
  bool loading = true;
  String? error;
  ParentStudentsState? _students;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _students = context.read<ParentStudentsState>();
      _students!.addListener(_onChildChanged);
      _load();
    });
  }

  @override
  void dispose() {
    _students?.removeListener(_onChildChanged);
    super.dispose();
  }

  void _onChildChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await context.read<AuthState>().api.parentDiary();
      setState(() => entries = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();
    final sectionId = students.selectedSectionId;

    final visible = entries.where((e) {
      if (sectionId == null || sectionId.isEmpty) return true;
      final m = Map<String, dynamic>.from(e as Map);
      final section = m['section'] is Map ? Map<String, dynamic>.from(m['section'] as Map) : null;
      final id = section?['id']?.toString() ?? m['classSectionId']?.toString();
      if (id == null || id.isEmpty) return true;
      return id == sectionId;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ParentChildDropdown(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? ListView(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                          ),
                        ],
                      )
                    : visible.isEmpty
                        ? ListView(
                            children: [
                              const SizedBox(height: 60),
                              Icon(Icons.menu_book_outlined,
                                  size: 56, color: PresenceColors.muted.withValues(alpha: 0.5)),
                              const SizedBox(height: 12),
                              const Center(
                                child: Text(
                                  'No class diary entries yet.',
                                  style: TextStyle(color: PresenceColors.muted),
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                            itemCount: visible.length,
                            itemBuilder: (context, i) {
                              final m = Map<String, dynamic>.from(visible[i] as Map);
                              final section = m['section'] is Map
                                  ? Map<String, dynamic>.from(m['section'] as Map)
                                  : null;
                              final className = section?['class'] is Map
                                  ? (section!['class'] as Map)['name']
                                  : null;
                              final sectionName = section?['name'];
                              final classLabel = (className != null && sectionName != null)
                                  ? '$className-$sectionName'
                                  : null;

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: PresenceColors.border),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.04),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            width: 42,
                                            height: 42,
                                            decoration: BoxDecoration(
                                              color: PresenceColors.primarySoft,
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: const Icon(
                                              Icons.menu_book_rounded,
                                              color: PresenceColors.primaryDark,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              m['title']?.toString() ?? 'Homework',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 16,
                                                color: PresenceColors.primaryDark,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Wrap(
                                        spacing: 10,
                                        runSpacing: 4,
                                        children: [
                                          _MetaChip(
                                            icon: Icons.calendar_today_outlined,
                                            label: _fmt(m['date']?.toString()),
                                          ),
                                          if (classLabel != null)
                                            _MetaChip(
                                              icon: Icons.class_outlined,
                                              label: classLabel,
                                            ),
                                          if (m['authorName'] != null)
                                            _MetaChip(
                                              icon: Icons.person_outline,
                                              label: m['authorName'].toString(),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        m['body']?.toString() ?? '',
                                        style: const TextStyle(
                                          height: 1.45,
                                          fontSize: 14,
                                          color: PresenceColors.text,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ),
      ],
    );
  }

  String _fmt(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(raw));
    } catch (_) {
      return raw;
    }
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    if (label.isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: PresenceColors.muted),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: PresenceColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
