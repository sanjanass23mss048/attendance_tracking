import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/mobile_ui.dart';

class _Standard {
  _Standard({
    required this.className,
    required this.sections,
    required this.studentCount,
    required this.present,
    required this.absent,
    required this.late,
    required this.halfDay,
    required this.marked,
    required this.attendancePercent,
    required this.sectionRows,
  });
  final String className;
  final int sections;
  final int studentCount;
  final int present;
  final int absent;
  final int late;
  final int halfDay;
  final int marked;
  final num attendancePercent;
  final List<Map<String, dynamic>> sectionRows;
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? summary;
  List<Map<String, dynamic>> comparison = [];
  bool loading = true;
  String? error;
  late String date;
  String? openClass;

  @override
  void initState() {
    super.initState();
    date = todayYmd();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = context.read<AuthState>().api;
      final sum = await api.attendanceSummary(date);
      final cmp = await api.classComparison(date: date);
      setState(() {
        summary = sum;
        comparison = List<Map<String, dynamic>>.from(
          (cmp['classes'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)),
        );
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<_Standard> _standards() {
    final map = <String, _Standard>{};
    final buckets = <String, List<Map<String, dynamic>>>{};
    for (final row in comparison) {
      final key = '${row['className'] ?? ''}';
      buckets.putIfAbsent(key, () => []).add(row);
    }
    for (final entry in buckets.entries) {
      var studentCount = 0, present = 0, absent = 0, late = 0, halfDay = 0, marked = 0;
      for (final row in entry.value) {
        studentCount += _n(row['studentCount']);
        present += _n(row['present']);
        absent += _n(row['absent']);
        late += _n(row['late']);
        halfDay += _n(row['halfDay']);
        marked += _n(row['marked']);
      }
      map[entry.key] = _Standard(
        className: entry.key,
        sections: entry.value.length,
        studentCount: studentCount,
        present: present,
        absent: absent,
        late: late,
        halfDay: halfDay,
        marked: marked,
        attendancePercent: attendancePercentFromCounts(
          present: present,
          absent: absent,
          late: late,
          halfDay: halfDay,
        ),
        sectionRows: entry.value,
      );
    }
    final list = map.values.toList()..sort((a, b) => compareClassNames(a.className, b.className));
    return list;
  }

  int _n(dynamic v) => int.tryParse('${v ?? 0}') ?? 0;

  @override
  Widget build(BuildContext context) {
    final standards = _standards();
    final asOf = DateFormat('dd MMM yyyy').format(parseYmd(date) ?? DateTime.now());
    _Standard? selected;
    if (openClass != null) {
      for (final s in standards) {
        if (s.className == openClass) selected = s;
      }
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              if (selected != null) ...[
                Row(
                  children: [
                    IconButton(
                      onPressed: () => setState(() => openClass = null),
                      icon: const Icon(Icons.arrow_back),
                    ),
                    Expanded(
                      child: Text(
                        '${formatClassLabel(selected.className)} Attendance',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ] else ...[
                Row(
                  children: [
                    const Expanded(
                      child: Text('Overview', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: PresenceColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_today_outlined, size: 13, color: PresenceColors.primaryDark),
                          const SizedBox(width: 6),
                          Text('As of $asOf', style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
              ],
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(error!, style: const TextStyle(color: PresenceColors.danger, fontSize: 13)),
                ),
              if (loading && summary == null)
                const Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(child: CircularProgressIndicator()),
                )
              else ...[
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.2,
                  children: selected == null
                      ? [
                          MobileKpi(
                            label: 'Total Classes',
                            value: '${summary?['totalClasses'] ?? standards.length}',
                            icon: Icons.school_outlined,
                            iconBg: const Color(0xFFEEF2FF),
                            iconColor: const Color(0xFF4F46E5),
                            cardBg: const Color(0xFFEEF2FF).withValues(alpha: 0.7),
                          ),
                          MobileKpi(
                            label: 'Total Students',
                            value: '${summary?['totalStudents'] ?? '—'}',
                            icon: Icons.groups_outlined,
                            iconBg: const Color(0xFFF0F9FF),
                            iconColor: const Color(0xFF0284C7),
                            cardBg: const Color(0xFFF0F9FF).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Present Today',
                            value: '${summary?['present'] ?? 0}',
                            icon: Icons.check_circle_outline,
                            iconBg: const Color(0xFFECFDF5),
                            iconColor: const Color(0xFF059669),
                            cardBg: const Color(0xFFECFDF5).withValues(alpha: 0.8),
                            hint: 'School-wide',
                          ),
                          MobileKpi(
                            label: 'Absent Today',
                            value: '${summary?['absent'] ?? 0}',
                            icon: Icons.cancel_outlined,
                            iconBg: const Color(0xFFFFF1F2),
                            iconColor: const Color(0xFFF43F5E),
                            cardBg: const Color(0xFFFFF1F2).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Late / Half Day',
                            value: '${_n(summary?['late']) + _n(summary?['halfDay'])}',
                            icon: Icons.schedule,
                            iconBg: const Color(0xFFFFFBEB),
                            iconColor: const Color(0xFFD97706),
                            cardBg: const Color(0xFFFFFBEB).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Attendance %',
                            value: '${summary?['attendancePercent'] ?? 0}%',
                            icon: Icons.percent,
                            iconBg: const Color(0xFFF5F3FF),
                            iconColor: const Color(0xFF7C3AED),
                            cardBg: const Color(0xFFF5F3FF).withValues(alpha: 0.8),
                          ),
                        ]
                      : [
                          MobileKpi(
                            label: 'Total Sections',
                            value: '${selected.sections}',
                            icon: Icons.view_list_outlined,
                            iconBg: const Color(0xFFEEF2FF),
                            iconColor: const Color(0xFF4F46E5),
                            cardBg: const Color(0xFFEEF2FF).withValues(alpha: 0.7),
                          ),
                          MobileKpi(
                            label: 'Total Students',
                            value: '${selected.studentCount}',
                            icon: Icons.groups_outlined,
                            iconBg: const Color(0xFFF0F9FF),
                            iconColor: const Color(0xFF0284C7),
                            cardBg: const Color(0xFFF0F9FF).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Present',
                            value: '${selected.present}',
                            icon: Icons.check_circle_outline,
                            iconBg: const Color(0xFFECFDF5),
                            iconColor: const Color(0xFF059669),
                            cardBg: const Color(0xFFECFDF5).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Absent',
                            value: '${selected.absent}',
                            icon: Icons.cancel_outlined,
                            iconBg: const Color(0xFFFFF1F2),
                            iconColor: const Color(0xFFF43F5E),
                            cardBg: const Color(0xFFFFF1F2).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Late / Half Day',
                            value: '${selected.late + selected.halfDay}',
                            icon: Icons.schedule,
                            iconBg: const Color(0xFFFFFBEB),
                            iconColor: const Color(0xFFD97706),
                            cardBg: const Color(0xFFFFFBEB).withValues(alpha: 0.8),
                          ),
                          MobileKpi(
                            label: 'Attendance',
                            value: '${selected.attendancePercent}%',
                            icon: Icons.percent,
                            iconBg: const Color(0xFFF5F3FF),
                            iconColor: const Color(0xFF7C3AED),
                            cardBg: const Color(0xFFF5F3FF).withValues(alpha: 0.8),
                          ),
                        ],
                ),
                const SizedBox(height: 20),
                Text(
                  selected == null ? 'Attendance by Standard' : 'Sections',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
                if (selected == null)
                  const Padding(
                    padding: EdgeInsets.only(top: 2, bottom: 12),
                    child: Text('Tap a class to view sections', style: TextStyle(fontSize: 13, color: PresenceColors.muted)),
                  )
                else
                  const SizedBox(height: 12),
                ...List.generate(
                  selected == null ? standards.length : selected.sectionRows.length,
                  (i) {
                    if (selected == null) {
                      final std = standards[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: MobileStandardCard(
                          title: formatClassLabel(std.className),
                          subtitle: '${std.studentCount} Students · ${std.sections} sections',
                          present: std.present,
                          absent: std.absent,
                          percent: std.attendancePercent,
                          unmarked: std.marked <= 0,
                          tone: pastelAt(i + 2),
                          onTap: () => setState(() => openClass = std.className),
                        ),
                      );
                    }
                    final sec = selected.sectionRows[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: MobileStandardCard(
                        title: '${formatClassLabel(selected.className)} – ${sec['sectionName'] ?? ''}',
                        subtitle: '${sec['studentCount'] ?? 0} Students',
                        present: _n(sec['present']),
                        absent: _n(sec['absent']),
                        percent: num.tryParse('${sec['attendancePercent'] ?? 0}') ?? 0,
                        unmarked: _n(sec['marked']) <= 0,
                        tone: pastelAt(i + 2),
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
    );
  }
}
