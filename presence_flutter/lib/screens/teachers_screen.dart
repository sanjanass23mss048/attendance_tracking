import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class TeachersScreen extends StatefulWidget {
  const TeachersScreen({super.key});

  @override
  State<TeachersScreen> createState() => _TeachersScreenState();
}

class _TeachersScreenState extends State<TeachersScreen> {
  List<dynamic> teachers = [];
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
      final list = await context.read<AuthState>().api.teachers();
      setState(() => teachers = list);
    } catch (e) {
      setState(() => error = e.toString());
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
          const Text('Staff directory',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: PresenceColors.danger)),
          ],
          const SizedBox(height: 12),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else
            ...teachers.map((t) {
              final m = Map<String, dynamic>.from(t as Map);
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text('${m['name'] ?? ''}'),
                  subtitle: Text('${m['email'] ?? ''} · ${m['role'] ?? ''}'),
                ),
              );
            }),
        ],
      ),
    );
  }
}
