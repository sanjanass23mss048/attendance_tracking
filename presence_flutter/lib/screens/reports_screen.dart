import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? report;
  bool loading = true;
  String? error;
  final date = todayYmd();

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
      final data = await context.read<AuthState>().api.dayWiseReport(date: date);
      setState(() => report = data);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = (report?['rows'] as List?) ??
        (report?['students'] as List?) ??
        (report?['data'] as List?) ??
        [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Day-wise report · $date',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 8),
          const Text('Live data from the Presence API (same as website reports).',
              style: TextStyle(color: PresenceColors.muted, fontSize: 13)),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: PresenceColors.danger)),
          ],
          const SizedBox(height: 12),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else if (rows.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(report?['holiday'] == true
                    ? 'This date is a Sunday or calendar holiday and is excluded from attendance.'
                    : report == null
                    ? 'No report data.'
                    : 'Report loaded (${report!.keys.join(', ')}).'),
              ),
            )
          else
            ...rows.take(100).map((r) {
              final m = Map<String, dynamic>.from(r as Map);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text('${m['name'] ?? m['studentName'] ?? m['className'] ?? 'Row'}'),
                  subtitle: Text(
                    '${m['status'] ?? m['section'] ?? ''} ${m['rollNo'] ?? m['roll'] ?? ''}'.trim(),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
