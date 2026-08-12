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
                            children: const [
                              SizedBox(height: 80),
                              Center(child: Text('No class diary entries yet.')),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
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

                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          const Icon(Icons.menu_book_outlined,
                                              color: PresenceColors.primaryDark),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              m['title']?.toString() ?? 'Diary',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700, fontSize: 16),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        [
                                          _fmt(m['date']?.toString()),
                                          if (className != null && sectionName != null)
                                            '$className - $sectionName',
                                          if (m['authorName'] != null) m['authorName'],
                                        ].whereType<Object?>().join(' · '),
                                        style:
                                            const TextStyle(color: PresenceColors.muted, fontSize: 12),
                                      ),
                                      const SizedBox(height: 10),
                                      Text(m['body']?.toString() ?? '',
                                          style: const TextStyle(height: 1.4)),
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
