import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? summary;
  int classCount = 0;
  String? error;
  bool loading = true;

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
      final auth = context.read<AuthState>();
      final date = todayYmd();
      final results = await Future.wait([
        auth.api.attendanceSummary(date),
        auth.api.classes(),
      ]);
      setState(() {
        summary = results[0] as Map<String, dynamic>;
        classCount = (results[1] as List).length;
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final name = (auth.user?['name'] ?? 'there').toString().split(' ').first;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Hello, $name',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          Text(auth.role, style: const TextStyle(color: PresenceColors.muted)),
          const SizedBox(height: 8),
          Text('Today · ${todayYmd()}',
              style: const TextStyle(color: PresenceColors.muted, fontSize: 12)),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error!, style: const TextStyle(color: PresenceColors.danger)),
          ],
          const SizedBox(height: 16),
          if (loading && summary == null)
            const Center(child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(),
            ))
          else
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _Stat('Marked', '${summary?['marked'] ?? 0}'),
                _Stat('Present', '${summary?['present'] ?? 0}'),
                _Stat('Absent', '${summary?['absent'] ?? 0}'),
                _Stat('Classes', '$classCount'),
              ],
            ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => context.go('/attendance'),
            icon: const Icon(Icons.fact_check),
            label: const Text('Mark attendance'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => context.go('/reports'),
            icon: const Icon(Icons.bar_chart),
            label: const Text('View reports'),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 42) / 2,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: PresenceColors.primaryDark,
                  )),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(color: PresenceColors.muted, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
