import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  List<dynamic> events = [];
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
      final list = await context.read<AuthState>().api.calendarEvents(
            from: fmt.format(start),
            to: fmt.format(end),
          );
      setState(() => events = list);
    } catch (e) {
      // Calendar API shape can vary — show empty with note
      setState(() {
        error = e.toString();
        events = [];
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
            const Center(child: Padding(
              padding: EdgeInsets.all(40),
              child: CircularProgressIndicator(),
            ))
          else if (events.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('No events loaded for this month.'),
              ),
            )
          else
            ...events.map((e) {
              final m = Map<String, dynamic>.from(e as Map);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text('${m['title'] ?? m['name'] ?? 'Event'}'),
                  subtitle: Text('${m['date'] ?? ''} · ${m['type'] ?? ''}'),
                ),
              );
            }),
        ],
      ),
    );
  }
}
