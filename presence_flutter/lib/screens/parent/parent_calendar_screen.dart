import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../config.dart';
import '../../state/auth_state.dart';
import '../../theme.dart';

class ParentCalendarScreen extends StatefulWidget {
  const ParentCalendarScreen({super.key});

  @override
  State<ParentCalendarScreen> createState() => _ParentCalendarScreenState();
}

class _ParentCalendarScreenState extends State<ParentCalendarScreen> {
  List<dynamic> events = [];
  List<dynamic> holidays = [];
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
      final start = DateTime(DateTime.now().year, DateTime.now().month, 1);
      final end = DateTime(start.year, start.month + 1, 0);
      final fmt = DateFormat('yyyy-MM-dd');
      final data = await context.read<AuthState>().api.parentCalendar(
            from: fmt.format(start),
            to: fmt.format(end),
          );
      setState(() {
        events = (data['events'] as List?) ?? [];
        holidays = (data['holidays'] as List?) ?? [];
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = <Map<String, dynamic>>[
      ...holidays.map((h) {
        final m = Map<String, dynamic>.from(h as Map);
        return {
          'date': m['date'],
          'title': m['title'] ?? m['Text'],
          'type': 'Holiday',
        };
      }),
      ...events.map((e) {
        final m = Map<String, dynamic>.from(e as Map);
        return {
          'date': m['date'],
          'title': m['title'],
          'type': m['type'] ?? 'Event',
          'subtitle': m['subtitle'],
        };
      }),
    ]..sort((a, b) => (a['date']?.toString() ?? '').compareTo(b['date']?.toString() ?? ''));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Academic calendar · ${todayYmd().substring(0, 7)}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 8),
          const Text('Holidays and school events for this month.',
              style: TextStyle(color: PresenceColors.muted)),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: PresenceColors.danger, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          if (loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(),
              ),
            )
          else if (items.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('No events for this month.'),
              ),
            )
          else
            for (final item in items)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: PresenceColors.primarySoft,
                    child: Text(
                      _day(item['date']?.toString()),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: PresenceColors.primaryDark,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  title: Text(item['title']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    [
                      item['date'],
                      item['type'],
                      if (item['subtitle'] != null) item['subtitle'],
                    ].whereType<Object?>().join(' · '),
                  ),
                ),
              ),
        ],
      ),
    );
  }

  String _day(String? date) {
    if (date == null || date.length < 10) return '—';
    return date.substring(8, 10);
  }
}
