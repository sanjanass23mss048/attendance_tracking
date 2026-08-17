import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/mobile_ui.dart';

class _CalEvent {
  _CalEvent({
    required this.id,
    required this.title,
    required this.date,
    required this.type,
    this.source = '',
    this.subtitle,
  });
  final String id;
  final String title;
  final DateTime date;
  final String type;
  final String source;
  final String? subtitle;
}

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  static const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  DateTime month = DateTime(DateTime.now().year, DateTime.now().month, 1);
  List<_CalEvent> events = [];
  bool loading = true;
  String? error;
  int view = 0; // calendar | list
  int listTab = 0; // upcoming | all
  int? selectedDay;

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
      final start = month;
      final end = DateTime(month.year, month.month + 1, 0);
      final fmt = DateFormat('yyyy-MM-dd');
      final list = await context.read<AuthState>().api.calendarEvents(
            from: fmt.format(start),
            to: fmt.format(end),
          );
      final next = <_CalEvent>[];
      for (final raw in list) {
        final m = Map<String, dynamic>.from(raw as Map);
        final dateStr = '${m['date'] ?? m['startDate'] ?? m['start'] ?? ''}';
        final parsed = DateTime.tryParse(dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr);
        if (parsed == null) continue;
        next.add(_CalEvent(
          id: '${m['id'] ?? dateStr}-${m['title'] ?? m['name']}',
          title: '${m['title'] ?? m['name'] ?? 'Event'}',
          date: DateTime(parsed.year, parsed.month, parsed.day),
          type: '${m['type'] ?? m['kind'] ?? 'event'}'.toLowerCase(),
          source: '${m['source'] ?? ''}'.toLowerCase(),
          subtitle: m['subtitle']?.toString() ?? m['reason']?.toString(),
        ));
      }
      setState(() => events = next);
    } catch (e) {
      setState(() {
        error = e.toString();
        events = [];
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      month = DateTime(month.year, month.month + delta, 1);
      selectedDay = null;
    });
    _load();
  }

  List<_CalEvent> _eventsOn(int day) {
    return events.where((e) => e.date.year == month.year && e.date.month == month.month && e.date.day == day).toList();
  }

  List<_CalEvent> get _listEvents {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    var list = [...events];
    // Implicit Sundays
    final days = DateTime(month.year, month.month + 1, 0).day;
    for (var d = 1; d <= days; d++) {
      final dt = DateTime(month.year, month.month, d);
      if (dt.weekday == DateTime.sunday && list.every((e) => e.date != dt || e.source != 'sunday')) {
        list.add(_CalEvent(
          id: 'sun-$d',
          title: 'Weekly Holiday',
          date: dt,
          type: 'holiday',
          source: 'sunday',
        ));
      }
    }
    list.sort((a, b) => a.date.compareTo(b.date));
    if (listTab == 0) {
      list = list.where((e) => !e.date.isBefore(today)).toList();
    }
    return list;
  }

  Color _dotColor(_CalEvent e) {
    if (e.source == 'sunday' || e.type == 'holiday') return const Color(0xFFF87171);
    if (e.type == 'sudden') return const Color(0xFF7C3AED);
    if (e.type == 'exam') return const Color(0xFF10B981);
    if (e.type == 'important') return const Color(0xFFFBBF24);
    return const Color(0xFF38BDF8);
  }

  @override
  Widget build(BuildContext context) {
    final monthLabel = DateFormat('MMMM yyyy').format(month);
    final firstWeekday = DateTime(month.year, month.month, 1).weekday % 7; // Sun=0
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final cells = <({int day, bool inMonth})>[];
    final prevDays = DateTime(month.year, month.month, 0).day;
    for (var i = firstWeekday - 1; i >= 0; i--) {
      cells.add((day: prevDays - i, inMonth: false));
    }
    for (var d = 1; d <= daysInMonth; d++) {
      cells.add((day: d, inMonth: true));
    }
    while (cells.length % 7 != 0) {
      cells.add((day: cells.length - (firstWeekday + daysInMonth) + 1, inMonth: false));
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
            decoration: BoxDecoration(
              color: PresenceColors.accent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Academic Calendar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(monthLabel, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => _changeMonth(-1),
                  icon: const Icon(Icons.chevron_left, color: PresenceColors.primaryDark),
                ),
                Material(
                  color: PresenceColors.primaryDark,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => _changeMonth(1),
                    child: const SizedBox(
                      width: 44,
                      height: 44,
                      child: Icon(Icons.calendar_month, color: Colors.white, size: 18),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          PillToggle(
            labels: const ['Calendar', 'List'],
            index: view,
            onChanged: (i) => setState(() => view = i),
          ),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: PresenceColors.danger, fontSize: 12)),
          ],
          if (view == 0) ...[
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF3F4F6)),
              ),
              child: Column(
                children: [
                  Container(
                    color: const Color(0xFFF9FAFB),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        for (final d in weekdays)
                          Expanded(
                            child: Text(
                              d,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: d == 'Sun' ? const Color(0xFFEF4444) : PresenceColors.muted,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  GridView.builder(
                    itemCount: cells.length,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      childAspectRatio: 1.05,
                    ),
                    itemBuilder: (context, i) {
                      final cell = cells[i];
                      final dayEvents = cell.inMonth ? _eventsOn(cell.day) : const <_CalEvent>[];
                      final dt = cell.inMonth ? DateTime(month.year, month.month, cell.day) : null;
                      final isSunday = dt?.weekday == DateTime.sunday;
                      final isSelected = cell.inMonth && selectedDay == cell.day;
                      return InkWell(
                        onTap: cell.inMonth
                            ? () => setState(() => selectedDay = selectedDay == cell.day ? null : cell.day)
                            : null,
                        child: Container(
                          decoration: BoxDecoration(
                            color: !cell.inMonth
                                ? const Color(0xFFF9FAFB)
                                : isSelected
                                    ? const Color(0xFFEEF2FF)
                                    : isSunday
                                        ? const Color(0xFFFEF2F2)
                                        : Colors.white,
                            border: Border.all(color: const Color(0xFFF3F4F6)),
                          ),
                          child: Column(
                            children: [
                              const SizedBox(height: 6),
                              Text(
                                '${cell.day}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: cell.inMonth ? PresenceColors.text : const Color(0xFFD1D5DB),
                                ),
                              ),
                              const SizedBox(height: 4),
                              if (cell.inMonth && (isSunday || dayEvents.isNotEmpty))
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    if (isSunday)
                                      Container(width: 5, height: 5, margin: const EdgeInsets.symmetric(horizontal: 1), decoration: const BoxDecoration(color: Color(0xFFF87171), shape: BoxShape.circle)),
                                    for (final e in dayEvents.take(2))
                                      if (e.source != 'sunday')
                                        Container(
                                          width: 5,
                                          height: 5,
                                          margin: const EdgeInsets.symmetric(horizontal: 1),
                                          decoration: BoxDecoration(color: _dotColor(e), shape: BoxShape.circle),
                                        ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            if (selectedDay != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF).withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFC7D2FE)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${selectedDay.toString().padLeft(2, '0')} ${DateFormat('MMM yyyy').format(month)}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        TextButton(onPressed: () => setState(() => selectedDay = null), child: const Text('Close')),
                      ],
                    ),
                    ...() {
                      final dt = DateTime(month.year, month.month, selectedDay!);
                      final dayEvents = [
                        if (dt.weekday == DateTime.sunday)
                          _CalEvent(id: 'sun', title: 'Weekly Holiday', date: dt, type: 'holiday', source: 'sunday'),
                        ..._eventsOn(selectedDay!),
                      ];
                      if (dayEvents.isEmpty) {
                        return [const Text('No events on this day.', style: TextStyle(fontSize: 12, color: PresenceColors.muted))];
                      }
                      return [
                        for (final e in dayEvents)
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                            child: Text(e.source == 'sunday' ? 'Weekly Holiday' : e.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                          ),
                      ];
                    }(),
                  ],
                ),
              ),
            ],
          ],
          const SizedBox(height: 12),
          PillToggle(
            labels: const ['Upcoming', 'All Events'],
            index: listTab,
            onChanged: (i) => setState(() => listTab = i),
          ),
          const SizedBox(height: 12),
          if (loading)
            const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
          else if (_listEvents.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 40),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB), style: BorderStyle.solid),
              ),
              child: const Text('No events for this month.', style: TextStyle(color: PresenceColors.muted)),
            )
          else
            ..._listEvents.map((event) {
              final isSudden = event.type == 'sudden' || event.source == 'sudden';
              final isHoliday = event.type == 'holiday' || event.source == 'sunday';
              final icon = isSudden ? Icons.cloud : (isHoliday ? Icons.flag_outlined : Icons.star_outline);
              final iconBg = isSudden
                  ? const Color(0xFFEDE9FE)
                  : isHoliday
                      ? const Color(0xFFFFFBEB)
                      : const Color(0xFFF0F9FF);
              final iconFg = isSudden
                  ? const Color(0xFF6D28D9)
                  : isHoliday
                      ? const Color(0xFFB45309)
                      : const Color(0xFF0284C7);
              final tag = isSudden ? 'Sudden' : (isHoliday ? 'Holiday' : event.type);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() {
                      selectedDay = event.date.day;
                      view = 0;
                    }),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
                            child: Icon(icon, color: iconFg),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  event.source == 'sunday' ? 'Weekly Holiday' : event.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontWeight: FontWeight.w800),
                                ),
                                Text(DateFormat('dd MMM yyyy').format(event.date), style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(6)),
                                  child: Text(tag, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: iconFg)),
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
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(16)),
            child: const Row(
              children: [
                CircleAvatar(
                  backgroundColor: PresenceColors.primaryDark,
                  child: Icon(Icons.calendar_month, color: Colors.white, size: 16),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Stay informed about holidays, events and important school updates.',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
