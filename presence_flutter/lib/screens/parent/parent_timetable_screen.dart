import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../theme.dart';

class ParentTimetableScreen extends StatefulWidget {
  const ParentTimetableScreen({super.key});

  @override
  State<ParentTimetableScreen> createState() => _ParentTimetableScreenState();
}

class _ParentTimetableScreenState extends State<ParentTimetableScreen> {
  Map<String, dynamic>? timetable;
  bool loading = true;
  String? error;

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
      final data = await context.read<AuthState>().api.parentTimetable();
      setState(() => timetable = data);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) {
      return Center(child: Text(error!, style: const TextStyle(color: PresenceColors.danger)));
    }
    if (timetable == null) {
      return const Center(child: Text('No timetable available.'));
    }

    final days = (timetable!['days'] as List?)?.map((e) => e.toString()).toList() ?? [];
    final periods = (timetable!['periods'] as List?) ?? [];
    final grid = (timetable!['grid'] as List?) ?? [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Text(
            'Weekly timetable',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 4),
          const Text(
            'Read-only view for your child’s class.',
            style: TextStyle(color: PresenceColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(const Color(0xFFEEF2FF)),
              columns: [
                const DataColumn(label: Text('Period')),
                for (final d in days) DataColumn(label: Text(d.substring(0, 3))),
              ],
              rows: [
                for (var p = 0; p < grid.length; p++)
                  DataRow(
                    cells: [
                      DataCell(
                        Text(
                          periods.length > p
                              ? 'P${(periods[p] as Map)['period'] ?? (p + 1)}'
                              : 'P${p + 1}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      for (var d = 0; d < days.length; d++)
                        DataCell(_cell(grid[p], d)),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _cell(dynamic row, int dayIndex) {
    if (row is! List || dayIndex >= row.length) return const Text('—');
    final cell = row[dayIndex];
    if (cell is! Map) return Text(cell?.toString() ?? '—');
    final subject = cell['subject']?.toString() ?? '';
    final teacher = cell['teacher']?.toString() ?? '';
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(subject, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          if (teacher.isNotEmpty)
            Text(teacher, style: const TextStyle(fontSize: 10, color: PresenceColors.muted)),
        ],
      ),
    );
  }
}
