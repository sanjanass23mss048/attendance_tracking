import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../theme.dart';

const _seenKey = 'presence_flutter_notifications_seen_v1';

class _NotifItem {
  const _NotifItem({
    required this.id,
    required this.title,
    required this.body,
    required this.icon,
  });
  final String id;
  final String title;
  final String body;
  final IconData icon;
}

const _feed = [
  _NotifItem(
    id: 'attendance-today',
    title: "Mark today's attendance",
    body: 'Submit for your assigned classes',
    icon: Icons.fact_check,
  ),
  _NotifItem(
    id: 'parent-sms',
    title: 'Parent SMS after confirm',
    body: 'Send when you tap Save & SMS',
    icon: Icons.sms,
  ),
  _NotifItem(
    id: 'calendar-tip',
    title: 'Check academic calendar',
    body: 'Holidays and events for this month',
    icon: Icons.calendar_month,
  ),
];

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  Set<String> seen = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _loadSeen();
  }

  Future<void> _loadSeen() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_seenKey) ?? [];
    if (!mounted) return;
    setState(() {
      seen = list.toSet();
      loading = false;
    });
  }

  Future<void> _markAllRead() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = _feed.map((n) => n.id).toList();
    await prefs.setStringList(_seenKey, ids);
    if (!mounted) return;
    setState(() => seen = ids.toSet());
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('All notifications marked as read')),
    );
  }

  int get unreadCount => _feed.where((n) => !seen.contains(n.id)).length;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Notifications',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
              ),
            ),
            TextButton(
              onPressed: unreadCount == 0 || loading ? null : _markAllRead,
              child: const Text('Mark all as read'),
            ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'Attendance reminders, holidays, and approval alerts.',
          style: TextStyle(color: PresenceColors.muted),
        ),
        const SizedBox(height: 16),
        if (loading)
          const Center(child: Padding(
            padding: EdgeInsets.all(24),
            child: CircularProgressIndicator(),
          ))
        else
          for (final n in _feed)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              color: seen.contains(n.id) ? Colors.white : const Color(0xFFEEF2FF),
              child: ListTile(
                leading: Icon(
                  n.icon,
                  color: seen.contains(n.id)
                      ? PresenceColors.muted
                      : PresenceColors.primaryDark,
                ),
                title: Text(
                  n.title,
                  style: TextStyle(
                    fontWeight: seen.contains(n.id) ? FontWeight.w600 : FontWeight.w800,
                  ),
                ),
                subtitle: Text(n.body),
                trailing: seen.contains(n.id)
                    ? null
                    : Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: PresenceColors.primaryDark,
                          shape: BoxShape.circle,
                        ),
                      ),
              ),
            ),
      ],
    );
  }
}
